/**
 * @file server.js - Express server entry point.
 * @author darragh0
 *
 * @see https://networkninjas.gobbler.info/docs
 */

import bodyParser from "body-parser";
import multer from "multer";
import express from "express";
import crypto from "crypto";
import fs from "fs";
import https from "https";
import {
  fromBase64,
  genKeyPair,
  genKEK,
  hashPw,
  toBase64,
  genIVDEK,
  genIVFile,
  decryptData,
  encryptData,
  deriveSecret,
  hashSecrets,
} from "./encrypt.js";
import {
  parseDotEnv,
  checkFilesExist,
  getUserData,
  getPublicKeys,
  parseArgv,
  killPort,
  getOwnedFiles,
  getEncryptedFile,
  getFetch,
  getFilesSharedWithMe,
  shareWithBob,
  getFilesSharedByMe,
  revokeShare,
} from "./util.js";
import { Logger } from "./logging.js";
import { valEmail, valPassword, valReqFields, valUsername, verifyRecaptcha } from "./validate.js";

import { dirname, join } from "path";
import { fileURLToPath } from "url";

const upload = multer({ storage: multer.memoryStorage() });

/********************************************************
 * Argv Validation / Logging / Path Validation
 ********************************************************/

const PROJ_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARGV = parseArgv();

const logger = new Logger("CloudWorxWeb.Console", { name: null, dateFmt: "timeonly" });
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
  50,
);

fLogger.setLogLevel("TRA");
logger.setLogLevel("TRA");
logger.propagateTo(fLogger);
logger.info("Running `priv/server.js`");

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

/********************************************************
 * Initialize Express App & Middleware
 ********************************************************/

const app = express();
const PUB_DIR = join(PROJ_DIR, "pub");
const HTML_DIR = join(PUB_DIR, "html");

app.use(express.static(PUB_DIR, { maxAge: 31557600 }));

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
 * Get Owned Files
 ********************************************************/

app.post("/api/get-files", bodyParser.json(), async (req, res) => {
  logger.info("`/api/get-files` `server.js` API endpoint hit");

  const token = req.body.token;
  const uid = req.body.userId;
  const fields = {
    token: [token, "string"],
    userId: [uid, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const getEndpoint = `${ENV.api_url}/api/files`;
  logger.debug(`Attempting to fetch owned files (UID=\`"${uid}"\`)`);
  let data = await getOwnedFiles(uid, getEndpoint, logger, token);

  if (data.count == 0) {
    return res.status(204).send();
  }

  logger.debug("Get owned files API call successful");
  res.status(200).json({
    files: data.files,
    count: data.count,
  });
});

/********************************************************
 * Get Files Shared by me API Endpoint
 ********************************************************/

app.post("/api/get-files-shared-by-me", bodyParser.json(), async (req, res) => {
  logger.info("`/api/get-files-shared-by-me` `server.js` API endpoint hit");

  const token = req.body.token;
  const uid = req.body.userId;
  const fields = {
    token: [token, "string"],
    userId: [uid, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const getEndpoint = `${ENV.api_url}/api/shares/shared-by-me`;
  logger.debug(`Attempting to fetch shared files (UID=\`"${uid}"\`)`);
  let { data, status, msg } = await getFilesSharedByMe(uid, getEndpoint, logger, token);

  if (status === 204) {
    return res.status(204).send(msg);
  }

  if (status !== 200) {
    return res.status(status).send(msg);
  }

  let seen_files = new Map();
  for (const file of data.files) {
    if (!seen_files.has(file.file_id)) {
      // First time seeing this file - preserve all original file data
      file.shares = [{ share_id: file.share_id, user_id: file.shared_with, username: file.shared_with_username }];
      // Clean up share-specific fields from the file object
      file.share_id = undefined;
      file.shared_with = undefined;
      file.shared_with_username = undefined;
      seen_files.set(file.file_id, file);
      continue;
    }

    // File already exists - just add the share info to the existing file
    seen_files.get(file.file_id).shares.push({
      share_id: file.share_id,
      user_id: file.shared_with,
      username: file.shared_with_username,
    });
  }

  // Convert the Map values back to an array
  const processed_files = Array.from(seen_files.values());

  logger.debug("Get shared files API call successful");
  res.status(200).json({
    files: processed_files,
    count: processed_files.length,
  });
});

/********************************************************
 * Get Files Shared by Others API Endpoint
 ********************************************************/

app.post("/api/get-files-shared-by-others", bodyParser.json(), async (req, res) => {
  logger.info("`/api/get-files-shared-by-others` `server.js` API endpoint hit");

  const token = req.body.token;
  const uid = req.body.userId;
  const fields = {
    token: [token, "string"],
    userId: [uid, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const getEndpoint = `${ENV.api_url}/api/shares/shared-with-me`;
  logger.debug(`Attempting to fetch shared files (UID=\`"${uid}"\`)`);
  let data = await getFilesSharedWithMe(uid, getEndpoint, logger, token);

  if (data.count == 0) {
    return res.status(204).send();
  }

  logger.debug("Get shared files API call successful");
  res.status(200).json({
    files: data.files,
    count: data.count,
  });
});

/********************************************************
 * Registration (Signup) API endpoint
 ********************************************************/

app.post("/api/register", bodyParser.json(), async (req, res) => {
  logger.info("`/api/register` `server.js` API endpoint hit");

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

  logger.debug("Creating payload for backend");
  logger.debug("Generating key pair (x2)");
  const { publicKey, privateKey } = genKeyPair("x25519");
  const { publicKey: publicSigningKey, privateKey: privateSigningKey } = genKeyPair("ed25519");

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
    signing_public_key: toBase64(publicSigningKey),
    iv_KEK: toBase64(iv),
    salt: toBase64(saltPDK),
    p: ENV.argon_threads,
    m: ENV.argon_mem_cost,
    t: ENV.argon_time_cost,
    encrypted_KEK: toBase64(encryptedKEK),
  };

  const endpoint = `${ENV.api_url}/api/auth/register`;
  logger.debug(`Sending registration request to API [POST \`${endpoint}\`]`);

  const filteredJson = Object.fromEntries(
    Object.entries(payload).filter(
      ([k, _]) => k !== "auth_password" && k !== "public_key" && k !== "signing_public_key",
    ),
  );

  logger.trace("Sending payload (excluding sensitive data):", 0, filteredJson);

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

    if (response.status == 409) {
      const emsg = data.message || data.error || `Username or email already registered: \`${uname}\`/\`${email}\``;
      logger.warn(`API registration failed: ${emsg}`);
      return res.status(409).send(emsg);
    }

    if (response.status !== 201) {
      const emsg = data.message || data.error || "Registration failed";
      logger.err(`API registration failed: ${emsg}`);
      return res.status(response.status).send(emsg);
    }

    logger.debug("API registration successful");
    logger.debug(`User \`${uname}\` registered successfully`);

    res.status(201).json({
      privateKey: toBase64(privateKey),
      privateSigningKey: toBase64(privateSigningKey),
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

app.post("/api/login", bodyParser.json(), async (req, res) => {
  logger.info("`/api/login` `server.js` API endpoint hit");

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

  logger.debug("Creating payload for login API");
  const payload = {
    username: uname,
    entered_auth_password: pw,
  };

  const endpoint = `${ENV.api_url}/api/auth/login`;
  logger.debug(`Sending login request to API [POST \`${endpoint}\`]`);

  const filteredJson = Object.fromEntries(Object.entries(payload).filter(([k, _]) => k !== "entered_auth_password"));

  logger.trace("Sending payload (excluding sensitive data):", 0, filteredJson);

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

    if (response.status == 404) {
      const emsg = data.message || data.error || "Invalid username";
      logger.warn(`API login failed: ${emsg}`);
      return res.status(404).send(`${emsg.replace("!", "")}: ${uname}`);
    }

    if (response.status == 401) {
      const emsg = data.message || data.error || "Invalid password";
      logger.warn(`API login failed: ${emsg}`);
      return res.status(401).send();
    }

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

app.post("/api/encrypt-file", upload.single("file"), async (req, res) => {
  logger.info("`/api/encrypt-file` `server.js` API endpoint hit");

  const fname = req.file.originalname;
  const ftype = req.body.fileType;
  const fsize = req.file.size;
  const fbuf = req.file.buffer;
  const fpw = req.body.filePassword;
  const uid = req.body.userId;
  const tok = req.body.token;

  const fields = {
    fileName: [fname, "string"],
    fileType: [ftype, "string"],
    fileSize: [fsize, "uint"],
    fileBuffer: [fbuf, "buffer"],
    filePassword: [fpw, "string"],
    userId: [uid, "string"],
    token: [tok, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const getEndpoint = `${ENV.api_url}/api/auth/user_info`;
  logger.debug(`Attempting to fetch user data (UID=\`"${uid}"\`)`);
  const data = await getUserData(uid, getEndpoint, logger, tok);

  if (Object.keys(data).length === 0) {
    const emsg = `Could not get user from ID: \`${uid}\``;
    logger.warn(emsg);
    return res.status(403).send(emsg);
  }

  logger.debug("Ensuring response data is valid");
  let missing = [];
  for (const key of ["encrypted_KEK", "iv_KEK", "salt", "kek_created_at", "p", "m", "t"]) {
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
  const { hash: PDK, salt: _ } = await hashPw(fpw, data.m, data.t, data.p, fromBase64(data.salt));

  const encryptedKEK = fromBase64(data.encrypted_KEK);
  const ivKEK = fromBase64(data.iv_KEK);

  logger.debug("Generating DEK IV & DEK");
  const ivDEK = genIVDEK(uid, fname);
  const DEK = crypto.randomBytes(32);

  logger.debug("Generating File IV");
  const ivFile = genIVFile(data.kek_created_at, fname);

  // 1. Decrypt encrypted_KEK with iv_KEK, & PDK
  logger.debug("Decrypting KEK");
  let KEK;
  try {
    KEK = decryptData(PDK, ivKEK, encryptedKEK);
  } catch (err) {
    logger.warn(`Failed to decrypt KEK: Invalid file password`);
    return res.status(400).send("Invalid file password");
  }

  // 2. encrypted_file -> Encrypt file with DEK and iv_file
  logger.debug("Encrypting File Content");
  const encryptedFile = encryptData(DEK, ivFile, fbuf);

  // 3.  encrypted_dek -> Encrypt DEK with KEK and iv_dek
  logger.debug("Encrypting DEK");
  const encryptedDEK = encryptData(KEK, ivDEK, DEK);

  // 4. Send encrypted_file, iv_file, encrypted_dek, iv_dek, to database
  const postEndpoint = `${ENV.api_url}/api/files`;
  logger.debug(`Sending encrypt-file request to API [POST \`${postEndpoint}\`]`);

  const form = new FormData();
  const blob = new File([encryptedFile], fname, { type: ftype });
  // form.append("file", blob);
  form.append("encrypted_file", blob);

  const headers = {
    Authorization: `Bearer ${tok}`,
    "X-File-Name": fname,
    "X-IV-File": toBase64(ivFile),
    "X-File-Type": ftype,
    "X-File-Size": fsize.toString(),
    "X-IV-DEK": toBase64(ivDEK),
    "X-Encrypted-DEK": toBase64(encryptedDEK),
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
 * File Deletion API endpoint
 ********************************************************/

app.post("/api/delete-file", bodyParser.json(), async (req, res) => {
  logger.info("`/api/delete-file` `server.js` API endpoint hit");

  const fname = req.body.fileName;
  const uid = req.body.userId;
  const tok = req.body.token;

  const fields = {
    fileName: [fname, "string"],
    userId: [uid, "string"],
    token: [tok, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const endpoint = `${ENV.api_url}/api/files/${fname}`;
  logger.debug(`Attempting to delete file (FILE="\`${fname}\`"; UID=\`"${uid}"\`)`);

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tok}`,
      },
    });

    if (response.status === 403 || response.status === 401) {
      const emsg = `User \`${uid}\` does not have permission to delete file: \`${fname}\``;
      logger.warn(emsg);
      return res.status(403).send(emsg);
    }

    if (response.status === 404) {
      const emsg = "File does not exist or access denied";
      logger.warn(`API file deletion failed: ${emsg}`);
      return res.status(404).send(emsg);
    }

    if (response.status !== 200) {
      const data = await response.json();
      const emsg = data.message || data.error || "File deletion failed";
      logger.err(`API file deletion failed: ${emsg}`);
      return res.status(response.status).send(emsg);
    }

    logger.debug(`File \`${fname}\` deleted successfully`);
    res.status(200).send();
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).send("Failed to delete file");
  }
});

/********************************************************
 * Access Revocation API endpoint
 ********************************************************/

app.post("/api/revoke", bodyParser.json(), async (req, res) => {
  logger.info("`/api/revoke` `server.js` API endpoint hit");

  const fid = req.body.fileId;
  const uname = req.body.username;
  const uid = req.body.userId;
  const tok = req.body.token;

  const fields = {
    fileId: [fid, "string"],
    username: [uname, "string"],
    userId: [uid, "string"],
    token: [tok, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const endpoint = `${ENV.api_url}/api/shares/${fid}`;
  logger.debug(`Attempting to delete file (FILE="\`${fid}\`"; UID=\`"${uid}"\`)`);

  const { status, msg } = await revokeShare(uid, uname, fid, endpoint, logger, tok);

  if (status !== 200) return res.status(status).send(msg);
  res.status(200).send();
});

/********************************************************
 * File Decryption API endpoint
 ********************************************************/

const decryptFileContent = async (fname, fpw, uid, tok, encryptedDEK, ivDEK, ivFile) => {
  const endpoint = `${ENV.api_url}/api/files/${fname}`;
  const { status, content: fcont } = await getEncryptedFile(fname, uid, endpoint, logger, tok);

  if (status !== 200) {
    return { status, msg: `Failed to get encrypted file: ${fcont}` };
  }

  const getEndpoint = `${ENV.api_url}/api/auth/user_info`;
  logger.debug(`Attempting to fetch user data (UID="${uid}")`);
  const data = await getUserData(uid, getEndpoint, logger, tok);

  if (Object.keys(data).length === 0) {
    return { status: 403, msg: `Could not get user from ID: ${uid}` };
  }

  logger.debug("Ensuring response data is valid");
  let missing = [];
  for (const key of ["encrypted_KEK", "iv_KEK", "salt", "p", "m", "t"]) {
    if (!data[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return { status: 400, msg: `User ${uid} is missing key(s): ${missing.join(", ")}` };
  }

  const encryptedKEK = fromBase64(data.encrypted_KEK);
  const ivKEK = fromBase64(data.iv_KEK);

  logger.debug("Generating PDK");
  const { hash: PDK, salt: _ } = await hashPw(fpw, data.m, data.t, data.p, fromBase64(data.salt));

  // 1. Decrypt encrypted_KEK with iv_KEK, & PDK
  logger.debug("Decrypting KEK");
  let KEK;
  try {
    KEK = decryptData(PDK, ivKEK, encryptedKEK);
  } catch (err) {
    return { status: 400, msg: "Invalid file password" };
  }

  // 2. Decrypt DEK with KEK & ivDEK
  logger.debug("Decrypting DEK");
  const DEK = decryptData(KEK, ivDEK, encryptedDEK);

  // 3. Decrypt encrypted_file with DEK & ivFile
  logger.debug("Decrypting File Content");
  const fileContent = decryptData(DEK, ivFile, fcont);

  return { status: 200, content: fileContent };
};

app.post("/api/decrypt-file", bodyParser.json(), async (req, res) => {
  logger.info("`/api/decrypt-file` `server.js` API endpoint hit");

  const fname = req.body.fileName;
  const fpw = req.body.filePassword;
  const uid = req.body.userId;
  const tok = req.body.token;
  const encryptedDEK = fromBase64(req.body.encryptedDEK);
  const ivDEK = fromBase64(req.body.ivDEK);
  const ivFile = fromBase64(req.body.ivFile);

  // TODO: Validate nonce lengths etc.

  const fields = {
    fileId: [fname, "string"],
    filePassword: [fpw, "string"],
    userId: [uid, "string"],
    token: [tok, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const decRes = await decryptFileContent(fname, fpw, uid, tok, encryptedDEK, ivDEK, ivFile);
  if (decRes.status !== 200) {
    logger.warn(`Decryption failed: ${decRes.msg}`);
    return res.status(decRes.status).send(decRes.msg);
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.status(200).send(decRes.content);
});

/********************************************************
 * Decrypt Shared File API endpoint
 ********************************************************/

app.post("/api/decrypt-shared-file", bodyParser.json(), async (req, res) => {
  logger.info("`/api/decrypt-shared-file` `server.js` API endpoint hit");

  const sid = req.body.fileName; // share id
  const alice = req.body.owner;
  const fpw = req.body.filePassword;
  const uid = req.body.userId;
  const tok = req.body.token;

  const fields = {
    shareId: [sid, "string"],
    fileName: [fname, "string"],
    owner: [alice, "string"],
    filePassword: [fpw, "string"],
    userId: [uid, "string"],
    token: [tok, "string"],
    x25519PrivateKey: [req.body.x25519, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const bobX25519Private = fromBase64(req.body.x25519);

  const epKey = `${ENV.api_url}/api/shares/public-key/${alice}`;
  const { status: getStatus, msg: getMsg, data: keyData } = await getPublicKeys(uid, alice, epKey, logger, tok);

  if (getStatus !== 200) {
    logger.warn(`Failed to get public keys for user \`"${alice}"\``);
    return res.status(getStatus).send(getMsg);
  }

  logger.debug(`Public keys for user \`${alice}\` retrieved successfully`);
  const aliceX25519Public = keyData.x25519_public_key;
  const aliceED25519Public = keyData.ed25519_public_key;

  logger.debug("Attempting to decrypt shared file");
  const epDl = `${ENV.api_url}/api/shares/download/${sid}`;

  const result = await getFetch(epDl, "download-shared-file", tok, logger);

  if (response.status === 401 || response.status === 403) {
    logger.warn(`User JWT token is invalid (UID=\`"${uid}"\`)`);
    return res.status(401).send("Unauthorized access to shared file");
  }

  if (res.status === 404) {
    logger.warn(`Shared file with ID \`"${sid}"\` not found or access denied`);
    return res.status(404).send("Shared file not found or access denied");
  }

  const data = await result.json();
  logger.trace("Received response:", 0, data);

  const spkiPrefix = Buffer.from([
    0x30,
    0x2a, // SEQUENCE, length 42
    0x30,
    0x05, // SEQUENCE
    0x06,
    0x03,
    0x2b,
    0x65,
    0x6e, // OID: 1.3.101.110 (X25519)
    0x03,
    0x21,
    0x00, // BIT STRING, length 33, unused bits: 0
  ]);

  const der = Buffer.concat([spkiPrefix, fromBase64(data.ephemeral_public_key)]);
  const ephemeralPublicKey = crypto.createPublicKey({
    key: der,
    format: "der",
    type: "spki",
  });

  const sigData = Buffer.concat([ephemeralPublicKey, data.nonce, data.encrypted_file]);
  const isverified = crypto.verify(
    null,
    sigData,
    {
      key: publicKeyPEM,
      format: "pem",
      type: "spki",
    },
    fromBase64(data.signature),
  );

  if (!isverified) {
    logger.warn("Signature verification failed for shared file");
    return res.status(400).send("Signature verification failed for shared file");
  }

  // "file_id": "string",
  // "file_name": "string",
  // "file_type": "string",
  // "file_size": 0,
  // "shared_by": "string",
  // "shared_by_username": "string",
  // "encrypted_file": "string",
  // "nonce": "string",
  // "ephemeral_public_key": "string",
  // "sender_signature": "string",
  // "sender_x25519_public_key": "string",
  // "sender_ed25519_public_key": "string",
  // "created_at": "string"
  //
  //
});

/********************************************************
 * File Sharing API endpoint
 ********************************************************/

app.post("/api/share-file", bodyParser.json(), async (req, res) => {
  logger.info("`/api/share-file` `server.js` API endpoint hit");

  const fname = req.body.fileName;
  const fpw = req.body.filePassword;
  const fid = req.body.fileId;
  const uid = req.body.userId;
  const tok = req.body.token;
  const bob = req.body.recipient;

  const fields = {
    fileName: [fname, "string"],
    userId: [uid, "string"],
    token: [tok, "string"],
    recipient: [bob, "string"],
    encryptedDEK: [req.body.encryptedDEK, "string"],
    ivDEK: [req.body.ivDEK, "string"],
    ivFile: [req.body.ivFile, "string"],
    x25519PrivateKey: [req.body.x25519, "string"],
    ed25519PrivateKey: [req.body.ed25519, "string"],
  };

  logger.info("Validating format of request fields");
  const emsg = valReqFields(fields, logger);
  if (emsg.length > 0) {
    logger.warn(emsg);
    return res.status(400).send(emsg);
  }

  const encryptedDEK = fromBase64(req.body.encryptedDEK);
  const ivDEK = fromBase64(req.body.ivDEK);
  const ivFile = fromBase64(req.body.ivFile);
  const aliceX25519Private = fromBase64(req.body.x25519);
  const aliceED25519Private = fromBase64(req.body.ed25519);

  const epKey = `${ENV.api_url}/api/shares/public-key/${bob}`;
  const { status: getStatus, msg: getMsg, data: keyData } = await getPublicKeys(uid, bob, epKey, logger, tok);

  if (getStatus !== 200) {
    logger.warn(`Failed to get public keys for user \`"${bob}"\``);
    return res.status(getStatus).send(getMsg);
  }

  logger.debug(`Public keys for user \`${bob}\` retrieved successfully`);
  const bobX25519Public = keyData.x25519_public_key;
  const bobED25519Public = keyData.ed25519_public_key;

  logger.debug("Attempting to decrypt file");

  const decRes = await decryptFileContent(fname, fpw, uid, tok, encryptedDEK, ivDEK, ivFile);
  if (decRes.status !== 200) {
    logger.warn(`Decryption failed: ${decRes.msg}`);
    return res.status(decRes.status).send(decRes.msg);
  }

  const fcont = decRes.content;

  logger.debug("Generating ephemeral key pair (X25519)");
  let { publicKey: ephemeralPublicKey, privateKey: ephemeralPrivateKey } = genKeyPair("x25519", "der");

  ephemeralPublicKey = ephemeralPublicKey.subarray(12, 44);

  logger.debug("Deriving shared secrets");
  const secret1 = deriveSecret(ephemeralPrivateKey, bobX25519Public, "der");
  const secret2 = deriveSecret(aliceX25519Private, bobX25519Public, "pem");

  logger.debug("Generate AES key from shared secrets");
  const aesKey = hashSecrets(secret1, secret2);

  logger.debug("Generating encryption nonce");
  const nonce = crypto.randomBytes(12);
  const encryptedFile4Bob = encryptData(aesKey, nonce, fcont);

  logger.debug("Generating signature for share");
  const sigData = Buffer.concat([ephemeralPublicKey, nonce, encryptedFile4Bob]);
  const sig = crypto.sign(null, sigData, { key: aliceED25519Private });

  const payload = {
    shared_with_username: bob,
    encrypted_file: toBase64(encryptedFile4Bob),
    nonce: toBase64(nonce),
    ephemeral_public_key: toBase64(ephemeralPublicKey),
    signature: toBase64(sig),
  };

  const epShare = `${ENV.api_url}/api/shares/${fid}/share`;
  const { status: postStatus, msg: postMsg, data } = await shareWithBob(uid, epShare, logger, tok, payload);

  if (postStatus !== 200) {
    logger.warn(`Failed to share \`"${fname}"\` with user: \`"${bob}"\``);
    return res.status(postStatus).send(postMsg);
  }

  return res.status(200).json({
    message: data.message,
    share_id: data.share_id,
    shared_with: data.shared_with,
    tofu_message: data.tofu_message,
  });
});

/********************************************************
 * Server configuration
 ********************************************************/

const SERVER_OPTS = {
  key: fs.readFileSync("./certs/localhost-key.pem"),
  cert: fs.readFileSync("./certs/localhost.pem"),
};

function tryPort(port) {
  const server = https.createServer(SERVER_OPTS, app);

  server.listen(port, () => {
    logger.info(`Running on \`https://localhost:${port}\``);
  });

  server.on("error", async (err) => {
    if (err.code === "EADDRINUSE") {
      if (ARGV.forceKill) {
        logger.warn(`Port \`${port}\` is already in use. Attempting to kill...`);
        await killPort(port, logger);
        setTimeout(() => tryPort(port), 1000);
        return;
      } else {
        logger.crit(`Port \`${port}\` is already in use. Terminating program. Use \`--force-kill\` to override`);
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
// });
