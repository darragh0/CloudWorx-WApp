/**
 * @file server.js - Express server entry point.
 * @author darragh0
 */

import express from "express";
import fs from "fs";
import https from "https";
import dotenv from "dotenv";
import { verifyPw, verifyRecaptcha } from "./verify.js";
import { valFieldFmt, Logger } from "./util.js";
import {
  genKEK,
  hashPw,
  genED25519Pair,
  toBase64,
} from "./encrypt.js";

import { join, resolve } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

/********************************************************
 * Initialize Express app & Middleware
 ********************************************************/

const logger = new Logger("cloudworx_web_client");

for (const file of [
  "./users.json",
  "./certs/localhost-key.pem",
  "./certs/localhost.pem",
]) {
  if (!fs.existsSync(file)) {
    logger.crit(`Missing required file: \x1b[93m\`${file}\`\x1b[0m`);
    process.exit(1);
  }
}

const app = express();

const PROJ_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB_DIR = join(PROJ_DIR, "pub");
const HTML_DIR = join(PUB_DIR, "html");

// Static files dir (for css, js, & images)
app.use(express.static(PUB_DIR));
// Parse incoming form data
app.use(express.urlencoded({ extended: true }));
// Parse incoming JSON requests
app.use(express.json());

let all_users = JSON.parse(fs.readFileSync("./users.json", "utf8"));

/********************************************************
 * Load environment variables from `.env`
 ********************************************************/

dotenv.config({ path: resolve(PROJ_DIR, ".env") });

for (const envVar of [
  "RECAPTCHA_SECRET_KEY",
  "ARGON_MEM_COST",
  "ARGON_TIME_COST",
  "ARGON_THREADS",
  "NETWORK_HOST",
  "NETWORK_PORT",
]) {
  if (!process.env[envVar]) {
    logger.crit(`Missing env var: \x1b[93m\`${envVar}\`\x1b[0m`);
    process.exit(1);
  }
}

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const ARGON_MEM_COST = process.env.ARGON_MEM_COST;
const ARGON_TIME_COST = process.env.ARGON_TIME_COST;
const ARGON_THREADS = process.env.ARGON_THREADS;
const NETWORK_HOST = process.env.NETWORK_HOST;
const NETWORK_PORT = process.env.NETWORK_PORT;

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

// TODO: Send requests via sockets or API
/********************************************************
 * Registration (Signup) API endpoint
 ********************************************************/

/**
 * Check if username or email already exists via API call
 *
 * @param {string} username Username to check
 * @param {string} email Email to check
 * @returns {Promise<boolean>} True if user exists, false otherwise
 */
async function checkUserExists(username, email) {
  try {
    const apiUrl = `${NETWORK_HOST}:${NETWORK_PORT}/api/auth/users`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      logger.warn(`Failed to fetch users from API: ${response.status}`);
      return false;
    }

    const data = await response.json();

    if (!data.users || !Array.isArray(data.users)) {
      logger.warn("Invalid response format from users API");
      return false;
    }

    return data.users.some(
      (user) => user.username === username || user.email === email
    );
  } catch (error) {
    logger.warn(`Error checking user existence: ${error.message}`);
    return false;
  }
}

app.post("/register", async (req, res) => {
  const uname = req.body.username;
  const email = req.body.email;
  const pw = req.body.password;
  const filepw = req.body.filePassword;
  const capRes = req.body.recaptchaResponse;

  const fields = {
    username: uname,
    email: email,
    password: pw,
    filePassword: filepw,
    recaptchaResponse: capRes,
  };

  logger.debug("Validating request fields");
  const errstr = valFieldFmt(fields);

  if (errstr.length > 0) {
    logger.err(errstr);
    return res.status(400).send(errstr);
  }

  logger.debug("Validating email fmt");
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    const emsg = "Invalid email address format";
    logger.err(emsg);
    return res.status(400).send(emsg);
  }

  logger.debug("Checking if user already exists");
  const userExists = await checkUserExists(uname, email);
  if (userExists) {
    const emsg = "Username or email already exists";
    logger.err(emsg);
    return res.status(403).send(emsg);
  }

  logger.debug("Validating reCAPTCHA response");
  const recaptchaResult = await verifyRecaptcha(capRes, RECAPTCHA_SECRET_KEY);
  if (!recaptchaResult.success) {
    const emsg = `reCAPTCHA verification failed: ${recaptchaResult.error}`;
    logger.err(emsg);
    return res.status(400).send(emsg);
  }

  logger.debug("Creating payload for backend");
  try {
    logger.debug("Generating ED25519 key pair");
    const { publicKey, privateKey } = genED25519Pair();

    logger.debug("Hashing file password");
    const pek = await hashPw(
      filepw,
      ARGON_MEM_COST,
      ARGON_TIME_COST,
      ARGON_THREADS
    );

    const salt = pek.split("$")[4] || "";

    logger.debug("Hashing auth password");
    const pw_hash = await hashPw(
      pw,
      ARGON_MEM_COST,
      ARGON_TIME_COST,
      ARGON_THREADS
    );

    logger.debug("Generating KEK");
    const { kek, iv_kek } = genKEK(pek);

    logger.debug("Creating payload");
    const payload = {
      username: uname,
      auth_password: pw_hash,
      email: email,
      public_key: toBase64(publicKey),
      iv_KEK: iv_kek,
      salt: salt,
      p: ARGON_THREADS,
      m: ARGON_MEM_COST,
      t: ARGON_TIME_COST,
      encrypted_KEK: kek,
    };

    logger.debug(`Payload created:\n${JSON.stringify(payload, null, 2)}`);

    logger.debug("Sending registration request to API");
    const apiUrl = `${NETWORK_HOST}:${NETWORK_PORT}/api/auth/register`;
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await apiResponse.json();

    if (apiResponse.status !== 201) {
      const errorMessage = responseData.message || responseData.error || 'Registration failed';
      logger.err(`API registration failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    if (apiResponse.status !== 201) {
      const errorMessage = responseData.message || responseData.error || 'Registration failed';
      logger.err(`API registration failed: ${errorMessage}`);
      return res.status(apiResponse.status).json({ error: errorMessage });
    }

    logger.debug("API registration successful");

    all_users[uname] = {
      email: email,
      hash: pw_hash,
      kek: kek,
      iv_kek: iv_kek,
      publicKey: publicKey,
    };

    fs.writeFileSync("./users.json", JSON.stringify(all_users, null, 2));

    logger.debug(`User \x1b[1;96m${uname}\x1b[0m registered successfully`);
    res.status(201).json({ 
      privateKey: toBase64(privateKey),
      token: responseData.token,
      user_id: responseData.user_id
    });
  } catch (err) {
    logger.err(err.message);
    return res.status(500).send("Internal server error");
  }
});

/********************************************************
 * Login API endpoint
 ********************************************************/

app.post("/login", async (req, res) => {
  const uname = req.body.username;
  const pw = req.body.password;

  if (!uname || !pw) {
    return res.status(400).send("All fields are required: username & password");
  }

  try {
    let userData = null;

    if (uname in all_users) {
      userData = all_users[uname];
    }

    if (!userData) {
      return res.status(400).send("Invalid username or password");
    }

    const isValid = await verifyPw(pw, userData.hash);
    if (!isValid) {
      return res.status(400).send("Invalid username or password");
    }

    logger.debug("Sending login request to API");
    const apiUrl = `${NETWORK_HOST}:${NETWORK_PORT}/api/auth/login`;
    const apiPayload = {
      username: uname,
      entered_auth_password: pw
    };

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiPayload),
    });

    const responseData = await apiResponse.json();

    if (apiResponse.status !== 200) {
      const errorMessage = responseData.message || responseData.error || 'Login failed';
      logger.err(`API login failed: ${errorMessage}`);
      return res.status(apiResponse.status).json({ error: errorMessage });
    }

    logger.debug(`User \x1b[1;96m${uname}\x1b[0m logged in successfully`);
    res.status(200).json({ 
      token: responseData.token,
      user_id: responseData.user_id
    });
  } catch (err) {
    logger.err(`Login error: ${err.message}`);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************
 * File Encryption API endpoint
 ********************************************************/

app.post("/encrypt-file", async (req, res) => {
  try {
    const { fileName, fileType, fileSize, fileContent, filePw } = req.body;

    if (!fileName || !fileType || !fileSize || !fileContent || !filePw) {
      return res.status(400).json({
        error:
          "All fields are required: fileName, fileType, fileSize, fileContent, & filePw",
      });
    }

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
      memCost: ARGON_MEM_COST,
      timeCost: ARGON_TIME_COST,
      threads: ARGON_THREADS,
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
  console.log(
    `\n\x1b[1;92mRunning on \x1b[1;96mhttps://localhost:${PORT}\x1b[0m`
  );
});

// To run the server on HTTP instead of HTTPS:
//
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(
//     `\n\x1b[1;92mRunning on \x1b[1;96mhttp://localhost:${PORT}\x1b[0m`
//   );
// });
