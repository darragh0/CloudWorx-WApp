/**
 * @file server.js - Express server entry point.
 * @author darragh0
 */

import express from "express";
import fs from "fs";
import https from "https";
import dotenv from "dotenv";
import { verifyPw, verifyRecaptcha } from "./verify.js";
import { genKEK, hashPw } from "./encrypt.js";

import { join, resolve } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

/********************************************************
/ Initialize Express app & Middleware
/********************************************************/

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
/ Load environment variables from `.env`
/********************************************************/

dotenv.config({ path: resolve(PROJ_DIR, ".env") });

for (const envVar of [
  "RECAPTCHA_SECRET_KEY",
  "ARGON_MEM_COST",
  "ARGON_TIME_COST",
  "ARGON_THREADS",
]) {
  if (!process.env[envVar]) {
    console.error(
      `\x1b[1;91mMissing environment variable: \x1b[1;93m${envVar}\x1b[0m`
    );
    process.exit(1);
  }
}

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const ARGON_MEM_COST = process.env.ARGON_MEM_COST;
const ARGON_TIME_COST = process.env.ARGON_TIME_COST;
const ARGON_THREADS = process.env.ARGON_THREADS;

/********************************************************
/ Page routing
/********************************************************/

// Serve `.html` files without `.html` in URL
app.get("/:page", (req, res) => {
  const page = req.params.page;
  const filePath = join(HTML_DIR, `${page}.html`);
  console.log(filePath);

  if (page === "home") {
    return res.redirect("/");
  }

  res.sendFile(filePath, (err) => {
    if (err) res.sendFile(join(HTML_DIR, "404.html"));
  });
});

// `/` -> `/index`
app.get("/", (_, res) => {
  res.sendFile(join(HTML_DIR, "index.html"));
});

// TODO: Send requests via sockets or API

/********************************************************
/ Registration (Signup) API endpoint
/********************************************************/

app.post("/register", async (req, res) => {
  const uname = req.body["signup-username"];
  const email = req.body["signup-email"];
  const pw = req.body["signup-password"];
  const filepw = req.body["signup-file-password"];
  const capRes = req.body["g-recaptcha-response"];

  if (!uname || !email || !pw || !filepw || !capRes) {
    return res
      .status(400)
      .send(
        "All fields are required: username, email, password, file password, & reCAPTCHA response"
      );
  }

  // Basic email validation on the server side
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send("Invalid email address");
  }

  // Check if username already exists
  // TODO: Actual check
  if (uname in all_users) {
    return res.status(400).send("Username already exists");
  }

  // Check if email already exists
  // TODO: Actual check
  const emailExists = Object.values(all_users).some(
    (user) => user.email && user.email.toLowerCase() === email.toLowerCase()
  );

  if (emailExists) {
    return res.status(400).send("Email address already in use");
  }

  // Verify reCAPTCHA
  const recaptchaResult = await verifyRecaptcha(capRes, RECAPTCHA_SECRET_KEY);
  if (!recaptchaResult.success) {
    return res.status(400).send(recaptchaResult.error);
  }

  try {
    const pek = await hashPw(
      filepw,
      ARGON_MEM_COST,
      ARGON_TIME_COST,
      ARGON_THREADS
    );

    const pw_hash = await hashPw(
      pw,
      ARGON_ARGS.memCost,
      ARGON_ARGS.timeCost,
      ARGON_ARGS.threads
    );

    // Generate KEK using the password as the PEK
    // In a real system, you would use a separate PEK, but for this example we'll use the password
    const { kek, iv_kek, raw_kek } = await genKEK(pek, ARGON_ARGS);

    console.log(`\x1b[1;92mRegistered user:\x1b[0m ${uname}`);
    console.log(`\x1b[1;96mEmail: ${email}\x1b[0m`);
    console.log(`\x1b[1;96mPassword Hash: ${pw_hash}\x1b[0m`);
    console.log(`\x1b[1;96mIV_KEK: ${iv_kek}\x1b[0m`);
    console.log(`\x1b[1;96mKEK: ${kek}\x1b[0m`);
    console.log(
      `\x1b[1;96mRaw KEK (for debugging, should not be stored): ${raw_kek}\x1b[0m`
    );

    // Store user data with email, hash, kek, and iv_kek
    all_users[uname] = {
      email: email,
      hash: pw_hash,
      kek: kek,
      iv_kek: iv_kek,
    };

    fs.writeFileSync("./users.json", JSON.stringify(all_users, null, 2));
    res.status(200).send();
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
});

/********************************************************
/ Login (Signin) API endpoint
/********************************************************/

app.post("/login", async (req, res) => {
  const uname = req.body["signin-username"];
  const pw = req.body["signin-password"];

  if (!uname || !pw) {
    return res.status(400).send("All fields are required: username & password");
  }

  try {
    // Fetch hash from db
    let userData = null;

    if (uname in all_users) {
      userData = all_users[uname];
    }

    if (!userData) {
      return res.status(401).send("Invalid username or password");
    }

    const isValid = await verifyPw(pw, userData.hash);
    if (isValid) {
      console.log(`\x1b[1;92mUser signed in:\x1b[0m ${uname}`);
      console.log(`\x1b[1;96mEmail: ${userData.email}\x1b[0m`);
      console.log(`\x1b[1;96mPassword Hash: ${userData.hash}\x1b[0m`);
      console.log(`\x1b[1;96mIV_KEK: ${userData.iv_kek}\x1b[0m`);
      console.log(`\x1b[1;96mKEK: ${userData.kek}\x1b[0m`);
      res.status(200).send();
    } else {
      res.status(401).send("Invalid username or password");
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
});

/********************************************************
/ File Encryption API endpoint
/********************************************************/

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
/ Server configuration
/********************************************************/

const options = {
  key: fs.readFileSync("./certs/localhost-key.pem"),
  cert: fs.readFileSync("./certs/localhost.pem"),
};

const PORT = 3443;

https.createServer(options, app).listen(PORT, () => {
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
