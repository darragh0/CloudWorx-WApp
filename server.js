import express from "express";
import path from "path";
import argon2 from "argon2";
import fs from "fs";
import https from "https";
import fetch from "node-fetch";
import dotenv from "dotenv";

import { dirname } from "path";
import { fileURLToPath } from "url";

// Load env vars from .env file
dotenv.config();

let reg_users = JSON.parse(fs.readFileSync("./users.json", "utf8"));

const app = express();
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

const PROJ_DIR = dirname(fileURLToPath(import.meta.url));
const PUB_DIR = path.join(PROJ_DIR, "public");
const HTML_DIR = path.join(PUB_DIR, "html");

// Middleware
app.use(express.static(PUB_DIR)); // Static files dir (for css, js, & images)
app.use(express.urlencoded({ extended: true })); // Parse incoming form data
app.use(express.json()); // Parse incoming JSON requests

// Serve `.html` files without `.html` in URL
app.get("/:page", (req, res) => {
  const page = req.params.page;
  const filePath = path.join(HTML_DIR, `${page}.html`);
  console.log(filePath);

  res.sendFile(filePath, (err) => {
    if (err) res.sendFile(path.join(HTML_DIR, "404.html"));
  });
});

// `/` -> `/index`
app.get("/", (_, res) => {
  res.sendFile(path.join(HTML_DIR, "index.html"));
});

// TODO: Send requests via sockets or API

// Registration API endpoint
app.post("/register", async (req, res) => {
  const username = req.body["signup-username"];
  const email = req.body["signup-email"];
  const pw = req.body["signup-password"];
  const recaptchaResponse = req.body["g-recaptcha-response"];

  if (!username || !email || !pw) {
    return res.status(400).send("Username, email, and password are required");
  }

  // Basic email validation on the server side
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send("Please enter a valid email address");
  }

  // Check if username already exists
  if (username in reg_users) {
    return res.status(400).send("Username already exists");
  }

  // Check if email already exists
  const emailExists = Object.values(reg_users).some(
    (user) => user.email && user.email.toLowerCase() === email.toLowerCase()
  );

  if (emailExists) {
    return res.status(400).send("Email address already in use");
  }

  // Verify reCAPTCHA
  const recaptchaResult = await verifyRecaptcha(recaptchaResponse);
  if (!recaptchaResult.success) {
    return res.status(400).send(recaptchaResult.error);
  }

  try {
    const hash = await hashPw(pw);
    console.log(
      `\x1b[1;92mRegistered user:\x1b[0m ${username} (email: ${email}, pw_hash=\`${hash}\``
    );

    // Store user data with email
    reg_users[username] = {
      email: email,
      hash: hash,
    };

    fs.writeFileSync("./users.json", JSON.stringify(reg_users, null, 2));
    res.status(200).send();
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
});

// Login API endpoint
app.post("/login", async (req, res) => {
  const username = req.body["signin-username"];
  const pw = req.body["signin-password"];

  if (!username || !pw) {
    return res.status(400).send("Username and password are required");
  }

  try {
    // Fetch hash from db
    let storedHash = null;
    if (username in reg_users) {
      // Check if the user data is in the old format (just a string hash) or new format (object with email and hash)
      storedHash =
        typeof reg_users[username] === "string"
          ? reg_users[username]
          : reg_users[username].hash;
    }

    if (!storedHash) {
      return res.status(401).send("Invalid username or password");
    }

    const isValid = await verifyPw(pw, storedHash);
    if (isValid) {
      console.log(`\x1b[1;92mUser signed in:\x1b[0m ${username}`);
      res.status(200).send();
    } else {
      res.status(401).send("Invalid username or password");
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
});

async function hashPw(pw) {
  const hash = await argon2.hash(pw, {
    type: argon2.argon2id,
    memoryCost: 12288,
    timeCost: 3, // iterations
    parallelism: 1, // threads (can bump if multi-core)
  });

  return hash;
}

async function verifyPw(pw, hash) {
  return await argon2.verify(hash, pw);
}

// Verify reCAPTCHA response
async function verifyRecaptcha(response) {
  if (!response) {
    return {
      success: false,
      error: "reCAPTCHA verification failed. Please try again.",
    };
  }

  if (!RECAPTCHA_SECRET_KEY) {
    console.error("Missing RECAPTCHA_SECRET_KEY environment variable");
    return {
      success: false,
      error: "Server configuration error. Please contact the administrator.",
    };
  }

  try {
    const verificationURL = "https://www.google.com/recaptcha/api/siteverify";
    const result = await fetch(verificationURL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${response}`,
    });

    const data = await result.json();

    if (data.success) {
      return { success: true };
    } else {
      console.error("reCAPTCHA verification failed:", data["error-codes"]);
      return {
        success: false,
        error: "reCAPTCHA verification failed. Please try again.",
      };
    }
  } catch (error) {
    console.error("Error verifying reCAPTCHA:", error);
    return {
      success: false,
      error: "Error verifying reCAPTCHA. Please try again later.",
    };
  }
}

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

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(
//     `\n\x1b[1;92mRunning on \x1b[1;96mhttp://localhost:${PORT}\x1b[0m`
//   );
// });
