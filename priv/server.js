/**
 * @file server.js - Express server entry point.
 * @author darragh0
 *
 * @see https://networkninjas.gobbler.info/docs
 */

// TODO: Ensure semantically-correct failure/success codes

import bodyParser from "body-parser";
import multer from "multer";
import express from "express";
import crypto from "crypto";
import fs from "fs";
import https from "https";
import { fromBase64, genED25519Pair, genKEK, hashPw, toBase64, genIVDEK, genIVFile, decryptData, encryptData } from "./encrypt.js";
import { Logger, checkUserExists, parseDotEnv, checkFilesExist, getUserData, parseArgv, killPort } from "./util.js";
import { valEmail, valPassword, valReqFields, valUsername, verifyRecaptcha } from "./validate.js";

import { dirname, join } from "path";
import { fileURLToPath } from "url";

const upload = multer({ storage: multer.memoryStorage() });

/********************************************************
 * Argv Validation / Logging / Path Validation
 ********************************************************/

const ARGV = parseArgv();
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

fLogger.setLogLevel("TRA");
logger.setLogLevel("TRA");
logger.propagateTo(fLogger);
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
// app.use(express.urlencoded({ extended: true }));

/********************************************************
 * Page routing
 ********************************************************/

// Serve `.html` files without `.html` in URL
app.get("/:page", (req, res) => {
  const page = req.params.page;
  const filePath = join(HTML_DIR, `${page}.html`);

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
  if ((r = check("Validating format of request fields", valReqFields, fields, logger))) return r;
  if ((r = check("Validating email", valEmail, email, logger))) return r;
  if ((r = check("Validating username", valUsername, uname, logger))) return r;
  if ((r = check("Validating password", valPassword, pw, logger))) return r;
  if ((r = check("Validating file password", valPassword, fpw, "File Password", logger))) return r;
  if ((r = check("Verifying reCAPTCHA response", verifyRecaptcha, capRes, ENV.recaptcha_secret_key, logger))) return r;

  // FIXME: Change to use API check user exists functionality (response.status === 409)
  logger.debug(`Checking if user already exists (\`${uname}\`/\`${email})\``);
  const exists = await checkUserExists(uname, CHECK_USERS_ENDPOINT, logger, email);
  if (exists) {
    const emsg = `Username or email already registered: \`${uname}\`/\`${email}\``;
    logger.warn(emsg);
    return res.status(403).send(emsg);
  }

  logger.debug("Creating payload for backend");
  logger.debug("Generating ED25519 key pair");
  const { publicKey, privateKey } = genED25519Pair();

  logger.debug("Generating PDK");
  const { hash: PDK, salt: saltPDK } = await hashPw(fpw, ENV.argon_mem_cost, ENV.argon_time_cost, ENV.argon_threads);

  logger.debug("Generating KEK");
  const { encryptedKEK, iv } = genKEK(PDK, uname);

  logger.debug("Creating payload for registration API");
  const payload = {
    username: uname,
    auth_password: pw,
    email: email,
    public_key: toBase64(publicKey),
    iv_KEK: toBase64(iv),
    salt: toBase64(saltPDK),
    p: ENV.argon_threads,
    m: ENV.argon_mem_cost,
    t: ENV.argon_time_cost,
    encrypted_KEK: toBase64(encryptedKEK),
  };

  const endpoint = `${ENV.api_url}/api/auth/register`;
  logger.debug(`Sending registration request to API [POST \`${endpoint}\`]`);
  logger.trace(`Sending payload:\n\`${JSON.stringify(payload, null, 2)}\``);

  try {
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
      uid: data.user_id,
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
  if ((r = check("Validating format of request fields", valReqFields, fields, logger))) return r;
  if ((r = check("Validating username", valUsername, uname, logger))) return r;

  // Validation for password format ???
  // if ((res = check("Validating password", valPassword, pw))) return res;

  logger.debug(`Checking if user exists (\`${uname}\`)`);
  const exists = await checkUserExists(uname, CHECK_USERS_ENDPOINT, logger);
  if (!exists) {
    const emsg = `User \`${uname}\` does not exist`;
    logger.warn(emsg);
    return res.status(403).send(emsg);
  }

  logger.debug("Creating payload for login API");
  const payload = {
    username: uname,
    entered_auth_password: pw,
  };

  const endpoint = `${ENV.api_url}/api/auth/login`;
  logger.debug(`Sending login request to API [POST \`${endpoint}\`]`);
  logger.trace(`Sending payload:\n\`${JSON.stringify(payload, null, 2)}\``);

  try {
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
      uid: data.user_id,
    });
  } catch (err) {
    logger.err(`Login error: ${err.message}`);
    return res.status(500).send("Internal server error during login");
  }
});

/********************************************************
 * File Encryption API endpoint
 ********************************************************/

app.post("/encrypt-file", upload.single("file"), async (req, res) => {
  console.log(req.file);
  console.log(req.body);
  const fname = req.file.originalname;
  const ftype = req.file.mimetype;
  const fsize = req.file.size;
  const fbuf = req.file.buffer;
  const fpw = req.body.filePassword;
  const uid = req.body.userId;
  const token = req.body.token;

  const fields = {
    fileName: [fname, "string"],
    fileType: [ftype, "string"],
    fileSize: [fsize, "uint"],
    fileBuffer: [fbuf, "buffer"],
    filePassword: [fpw, "string"],
    userId: [uid, "string"],
    token: [token, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const getEndpoint = `${ENV.api_url}/api/auth/user_info`;
  logger.debug(`Attempting to fetch user data (UID=\`${uid}\`)`);
  const data = await getUserData(uid, getEndpoint, logger, token);

  if (Object.keys(data).length === 0) {
    const emsg = `Could not get user from ID: \`${uid}\``;
    logger.warn(emsg);
    return res.status(403).send(emsg);
  }

  logger.debug("Ensuring response data is valid");
  let missing = [];
  for (const key of ["encrypted_KEK", "iv_KEK", "salt", "kek_created_at"]) {
    if (!data[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const emsg = `User \`${uid}\` is missing the following key(s): ${missing.join(", ")}`;
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  logger.debug("Creating payload for backend");

  logger.debug("Generating PDK");
  const { hash: PDK, salt: _ } = await hashPw(fpw, ENV.argon_mem_cost, ENV.argon_time_cost, ENV.argon_threads, fromBase64(data.salt));

  const encryptedKEK = fromBase64(data.encrypted_KEK);
  const ivKEK = fromBase64(data.iv_KEK);

  logger.debug("Generating DEK IV & DEK");
  const ivDEK = genIVDEK(uid, fname);
  const DEK = crypto.randomBytes(32);

  logger.debug("Generating File IV");
  const ivFile = genIVFile(data.kek_created_at, fname);

  // 7. Decrypt KEK with encrypted_KEK (ciphertext), iv_KEK(nonce), and PDK(key)
  logger.debug("Decrypting KEK");
  let KEK;
  try {
    KEK = decryptData(PDK, ivKEK, encryptedKEK);
  } catch (err) {
    logger.warn(`Failed to decrypt KEK: Invalid file password`);
    return res.status(400).send("Invalid file password");
  }

  // 8. encrypted_file -> Encrypt file with DEK and iv_file
  logger.debug("Encrypting File Content");
  const encryptedFile = encryptData(DEK, ivFile, fbuf);

  // 9.  encrypted_dek -> Encrypt DEK with KEK and iv_dek
  logger.debug("Encrypting DEK");
  const encryptedDEK = encryptData(KEK, ivDEK, DEK);

  // 10. Send encrypted_file, iv_file, encrypted_dek, iv_dek, to database
  const postEndpoint = `${ENV.api_url}/api/files`;
  logger.debug(`Sending encrypt-file request to API [POST \`${postEndpoint}\`]`);

  const form = new FormData();
  const blob = new Blob([encryptedFile], { type: ftype });
  form.append("encrypted_file", blob, {
    filename: fname,
    contentType: ftype,
  });

  const headers = {
    ...form.headers,
    Authorization: `Bearer ${token}`,
    "X-File-Name": fname,
    "X-IV-File": ivFile.toString("utf8"),
    "X-File-Type": ftype,
    "X-File-Size": fsize.toString("utf8"),
    "X-IV-DEK": ivDEK.toString("utf8"),
    "X-Encrypted-DEK": encryptedDEK.toString("utf8"),
  };

  try {
    const response = await fetch(postEndpoint, {
      method: "POST",
      headers,
      body: form,
    });

    const data = await response.json();
    logger.trace(`Received response:\n\`${JSON.stringify(data, null, 2)}\``);

    if (response.status !== 201 && response.status !== 200) {
      const emsg = data.message || data.error || "File upload failed";
      logger.err(`API file upload failed: ${emsg}`);
      return res.status(response.status).send(emsg);
    }

    res.status(200).json({
      file_id: data.file_id,
    });
  } catch (error) {
    console.error("Error encrypting file:", error);
    res.status(500).send("Failed to encrypt file");
  }
});

/********************************************************
 * Server configuration
 ********************************************************/

const SERVER_OPTS = {
  key: fs.readFileSync("./certs/localhost-key.pem"),
  cert: fs.readFileSync("./certs/localhost.pem"),
};

const MAX_PORT = Math.max(ARGV.port + 100, 65535);

function tryPort(port) {
  const server = https.createServer(SERVER_OPTS, app);

  server.listen(port, () => {
    logger.info(`Running on https://localhost:${port}`);
  });

  server.on("error", async (err) => {
    if (err.code === "EADDRINUSE") {
      if (ARGV.forceKill) {
        logger.warn(`Port \`${port}\` is already in use. Attempting to kill...`);
        await killPort(port, logger);
        setTimeout(() => tryPort(port), 1000);
        return;
      }

      if (!ARGV.retry) {
        logger.crit(`Port \`${port}\` is already in use.`);
      }

      if (port < MAX_PORT) {
        tryPort(port + 1);
      } else {
        logger.crit(`No ports available in range \`${port}-${maxPort}\`.`);
      }
    } else {
      logger.crit(`Unexpected error: ${err}`);
    }
  });
}

tryPort(ARGV.port);

// To run the server on HTTP instead of HTTPS:
//
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(
//     `\n\x1b[1;92mRunning on \x1b[1;96mhttp://localhost:${PORT}\x1b[0m`
//   );
// });
