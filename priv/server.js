/**
 * @file server.js - Express server entry point.
 * @author darragh0
 *
 * @see https://networkninjas.gobbler.info/docs
 */

import bodyParser from "body-parser";
import express from "express";
import fs from "fs";
import https from "https";
import { genED25519Pair, genKEK, hashPw, toBase64 } from "./encrypt.js";
import { Logger, checkUserExists, parseDotEnv, checkFilesExist } from "./util.js";
import { valEmail, valPassword, valReqFields, valUsername, verifyRecaptcha } from "./validate.js";

import { dirname, join } from "path";
import { fileURLToPath } from "url";

/********************************************************
 * Initialize Logging & Validate Paths
 ********************************************************/

const PROJ_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const logger = new Logger("CloudWorxWeb.Console", { name: null });
const fLogger = new Logger(
  "CloudWorxWeb.File",
  {
    name: null,
    date: "plain",
    level: "plain",
    dateFmt: "iso",
    jsonl: true,
    colorLvl: false,
    out: join(PROJ_DIR, "logs", "server.log"),
  },
  50
);

logger.link(fLogger);
logger.info("Running `server.js`");

const cleanup = (exitCode) => {
  fLogger.flushToFile();
  if (exitCode) {
    process.exit(exitCode);
  }
};

process.on("SIGINT", () => cleanup(130));
process.on("SIGTERM", () => cleanup(0));
process.on("uncaughtException", (err) => {
  logger.err(`Uncaught Exception: ${err.message}`);
  cleanup();
  throw err;
});

const REQ_PATHS = ["pub", "pub/html", "./.env", "./certs/localhost-key.pem", "./certs/localhost.pem"];
checkFilesExist(PROJ_DIR, logger, ...REQ_PATHS);

/********************************************************
 * Load & Validate Env Vars (from `.env`)
 ********************************************************/

const REQ_ENV_KEYS = {
  RECAPTCHA_SECRET_KEY: "string",
  API_URL: "string",
  ARGON_MEM_COST: "uint",
  ARGON_TIME_COST: "uint",
  ARGON_THREADS: "uint",
};

const ENV = parseDotEnv(PROJ_DIR, logger, REQ_ENV_KEYS);
const CHECK_USERS_ENDPOINT = `${ENV.api_url}/api/auth/users`;

/********************************************************
 * Initialize Express App & Middleware
 ********************************************************/

const app = express();
const PUB_DIR = join(PROJ_DIR, "pub");
const HTML_DIR = join(PUB_DIR, "html");

app.use(express.static(PUB_DIR, { maxAge: 31557600 }));
app.use(express.urlencoded({ extended: true }));

/********************************************************
 * Page routing
 ********************************************************/

// Serve `.html` files without `.html` in URL
app.get("/:page", (req, res) => {
  const page = req.params.page;
  const filePath = join(HTML_DIR, `${page}.html`);
  console.log(filePath);

  if (page === "home") {
    return res.redirect("/");
  }

  logger.info(`\`/${page}\` endpoint hit`);
  res.sendFile(filePath, (err) => {
    if (err) res.sendFile(join(HTML_DIR, "404.html"));
  });
});

// `/` -> `/index`
app.get("/", (_, res) => {
  logger.info("`/` endpoint hit");
  res.sendFile(join(HTML_DIR, "index.html"));
});

/********************************************************
 * Registration (Signup) API endpoint
 ********************************************************/

app.post("/register", bodyParser.json(), async (req, res) => {
  const uname = req.body.username;
  const email = req.body.email;
  const pw = req.body.password;
  const fpw = req.body.filePassword;
  const capRes = req.body.recaptchaResponse;

  const fields = {
    username: [uname, "string"],
    email: [email, "string"],
    password: [pw, "string"],
    filePassword: [fpw, "string"],
    recaptchaResponse: [capRes, "string"],
  };

  const check = (logmsg, fn, ...args) => {
    logger.debug(logmsg);
    const emsg = fn(...args);
    if (emsg.length > 0) {
      logger.warn(emsg);
      return res.status(400).send(emsg);
    }
    return null;
  };

  let r;
  if ((r = check("Validating format of request fields", valReqFields, fields))) return r;
  if ((r = check("Validating email", valEmail, email))) return r;
  if ((r = check("Validating username", valUsername, uname))) return r;
  if ((r = check("Validating password", valPassword, pw))) return r;
  if ((r = check("Validating file password", valPassword, fpw, "File Password"))) return r;
  if ((r = check("Verifying reCAPTCHA response", verifyRecaptcha, capRes, ENV.recaptcha_secret_key))) return r;

  logger.debug(`Checking if user already exists (\`${uname}\`/\`${email})\``);
  const exists = await checkUserExists(uname, CHECK_USERS_ENDPOINT, logger, email);
  if (exists) {
    const emsg = `Username or email already registered: \`${uname}\`/\`${email}\``;
    logger.warn(emsg);
    return res.status(403).send(emsg);
  }

  logger.debug("Creating payload for backend");
  try {
    logger.debug("Generating ED25519 key pair");
    const { publicKey, privateKey } = genED25519Pair();

    logger.debug("Generating PDK");
    const pek = await hashPw(fpw, ENV.argon_mem_cost, ENV.argon_time_cost, ENV.argon_threads);
    const pek_salt = pek.split("$")[4] || "";

    logger.debug("Generating KEK");
    const { encryptedKEK, iv } = genKEK(pek, uname);

    logger.debug("Creating payload for registration API");
    const payload = {
      username: uname,
      auth_password: pw,
      email: email,
      public_key: toBase64(publicKey),
      iv_KEK: toBase64(iv),
      salt: toBase64(pek_salt),
      p: ENV.argon_threads,
      m: ENV.argon_mem_cost,
      t: ENV.argon_time_cost,
      encrypted_KEK: toBase64(encryptedKEK),
    };

    const endpoint = `${ENV.api_url}/api/auth/register`;
    logger.debug(`Sending registration request to API [POST \`${endpoint}\`]`);
    logger.trace(`Sending payload:\n\`${JSON.stringify(payload, null, 2)}\``);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    logger.trace(`Received response:\n\`${JSON.stringify(data, null, 2)}\``);

    if (response.status !== 201) {
      const emsg = data.message || data.error || "Registration failed";
      logger.err(`API registration failed: ${emsg}`);
      return res.status(response.status).send(emsg);
    }

    logger.debug("API registration successful");
    logger.debug(`User \`${uname}\` registered successfully`);
    res.status(201).json({
      privateKey: toBase64(privateKey),
      token: data.token,
      user_id: data.user_id,
    });
  } catch (err) {
    logger.err(`Registration error: ${err.message}`);
    return res.status(500).send("Internal server error during registration");
  }
});

/********************************************************
 * Login API endpoint
 ********************************************************/

app.post("/login", bodyParser.json(), async (req, res) => {
  const uname = req.body.username;
  const pw = req.body.password;

  const fields = {
    username: [uname, "string"],
    password: [pw, "string"],
  };

  const check = (logmsg, fn, ...args) => {
    logger.debug(logmsg);
    const emsg = fn(...args);
    if (emsg.length > 0) {
      logger.warn(emsg);
      return res.status(400).send(emsg);
    }
    return null;
  };

  let r;
  if ((r = check("Validating format of request fields", valReqFields, fields))) return r;
  if ((r = check("Validating username", valUsername, uname))) return r;

  // Validation for password format ???
  // if ((res = check("Validating password", valPassword, pw))) return res;

  logger.debug(`Checking if user exists (\`${uname}\`)`);
  const exists = await checkUserExists(uname, CHECK_USERS_ENDPOINT, logger);
  if (!exists) {
    const emsg = `User \`${uname}\` does not exist`;
    logger.warn(emsg);
    return res.status(403).send(emsg);
  }

  try {
    logger.debug("Creating payload for login API");
    const payload = {
      username: uname,
      entered_auth_password: pw,
    };

    const endpoint = `${ENV.api_url}/api/auth/login`;
    logger.debug(`Sending login request to API [POST \`${endpoint}\`]`);
    logger.trace(`Sending payload:\n\`${JSON.stringify(payload, null, 2)}\``);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    logger.trace(`Received response:\n\`${JSON.stringify(data, null, 2)}\``);

    if (response.status !== 200) {
      const emsg = data.message || data.error || "Login failed";
      logger.err(`API login failed: ${emsg}`);
      return res.status(response.status).send(emsg);
    }

    logger.debug("API login successful");
    logger.debug(`User \`${uname}\` logged in successfully`);
    res.status(200).json({
      token: data.token,
      user_id: data.user_id,
    });
  } catch (err) {
    logger.err(`Login error: ${err.message}`);
    return res.status(500).send("Internal server error during login");
  }
});

/********************************************************
 * File Encryption API endpoint
 ********************************************************/

app.post("/encrypt-file", bodyParser.json(), async (req, res) => {
  const fname = req.body.fileName;
  const ftype = req.body.fileType;
  const fsize = req.body.fileSize;
  const fcont = req.body.fileContent;
  const fpw = req.body.filePw;

  const fields = {
    fileName: [fname, "string"],
    fileType: [ftype, "string"],
    fileSize: [fsize, "uint"],
    fileContent: [fcont, "string"],
    filePw: [fpw, "string"],
  };

  const emsg = valReqFields(fields);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  // Steps for encrypting a file:
  // 1. salt -> from GET /api/auth/{user-id}
  // 2. pdk -> Hash file password with Argon2id with salt
  // 3. iv_file -> Generate 12-byte IV with hash(user-id + file name + smth random)
  // 4. dek -> 32 random bytes
  // 6. encrypted_file -> Encrypt file with DEK and iv_file
  // 7.

  try {
    // Step 1: Generate a Data Encryption Key (DEK) for the file
    const dek = crypto.randomBytes(32); // 256-bit key

    // Step 2: Generate IV for file encryption
    const iv_file = genIV();

    // Step 3: Decrypt base64 file content to get raw bytes
    const fileBytes = Buffer.from(fileContent, "base64");

    // Step 4: Encrypt file with DEK
    const encryptedFile = encryptData(dek, iv_file, fileBytes);

    // Step 5: Generate IV for DEK encryption
    const iv_dek = genIV();

    // Step 6: Generate KEK from user's PEK
    const argonOptions = {
      memCost: ENV.argon_mem_cost,
      timeCost: ENV.argon_time_cost,
      threads: ENV.argon_threads,
    };

    const { kek, iv_kek, raw_kek } = await genKEK(pek, argonOptions);

    // Step 7: Encrypt DEK with the raw KEK
    const kekBuffer = Buffer.from(raw_kek, "base64");
    const encrypted_dek = encryptData(kekBuffer, iv_dek, dek);

    // Step 8: Prepare response payload
    const payload = {
      fileName,
      fileType,
      fileSize,
      iv_file: toBase64(iv_file),
      iv_dek: toBase64(iv_dek),
      encrypted_dek: toBase64(encrypted_dek),
      encrypted_file: toBase64(encryptedFile),
    };

    res.status(200).json(payload);
  } catch (error) {
    console.error("Error encrypting file:", error);
    res.status(500).json({ error: "Failed to encrypt file" });
  }
});

/********************************************************
 * Server configuration
 ********************************************************/

const PORT = 3443;
const SERVER_OPTS = {
  key: fs.readFileSync("./certs/localhost-key.pem"),
  cert: fs.readFileSync("./certs/localhost.pem"),
};

https.createServer(SERVER_OPTS, app).listen(PORT, () => {
  logger.info(`Running on \`https://localhost:${PORT}\``);
});

// To run the server on HTTP instead of HTTPS:
//
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(
//     `\n\x1b[1;92mRunning on \x1b[1;96mhttp://localhost:${PORT}\x1b[0m`
//   );
// });
