import express from "express";
import fs from "fs";
import https from "https";
import dotenv from "dotenv";
import { verifyPw, verifyRecaptcha, hashPw, generateUserKEK } from "./auth.js";

import { join, resolve } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

/********************************************************
 / Initialize Express app
/********************************************************/

const app = express();

const PROJ_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB_DIR = join(PROJ_DIR, "pub");
const HTML_DIR = join(PUB_DIR, "html");

// Middleware
app.use(express.static(PUB_DIR)); // Static files dir (for css, js, & images)
app.use(express.urlencoded({ extended: true })); // Parse incoming form data
app.use(express.json()); // Parse incoming JSON requests

let all_users = JSON.parse(fs.readFileSync("./users.json", "utf8"));

/********************************************************
 / Load environment variables from `.env`
/********************************************************/

dotenv.config({ path: resolve(PROJ_DIR, ".env") });
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const ARGON_ARGS = {
  memCost: process.env.ARGON_MEM_COST,
  timeCost: process.env.ARGON_TIME_COST,
  threads: process.env.ARGON_THREADS,
};

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
  const username = req.body["signup-username"];
  const email = req.body["signup-email"];
  const pw = req.body["signup-password"];
  const pek = req.body["signup-pek-password"];
  const recaptchaResponse = req.body["g-recaptcha-response"];

  if (!username || !email || !pw || !pek) {
    return res
      .status(400)
      .send("Username, email, password, and PEK are required");
  }

  // Basic email validation on the server side
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send("Please enter a valid email address");
  }

  // Check if username already exists
  if (username in all_users) {
    return res.status(400).send("Username already exists");
  }

  // Check if email already exists
  const emailExists = Object.values(all_users).some(
    (user) => user.email && user.email.toLowerCase() === email.toLowerCase()
  );

  if (emailExists) {
    return res.status(400).send("Email address already in use");
  }

  // Verify reCAPTCHA
  const recaptchaResult = await verifyRecaptcha(
    recaptchaResponse,
    RECAPTCHA_SECRET_KEY
  );
  if (!recaptchaResult.success) {
    return res.status(400).send(recaptchaResult.error);
  }

  try {
    const pek_hash = await hashPw(
      pek,
      ARGON_ARGS.memCost,
      ARGON_ARGS.timeCost,
      ARGON_ARGS.threads
    );

    const pw_hash = await hashPw(
      pw,
      ARGON_ARGS.memCost,
      ARGON_ARGS.timeCost,
      ARGON_ARGS.threads
    );

    // Generate KEK using the password as the PEK
    // In a real system, you would use a separate PEK, but for this example we'll use the password
    const { kek, iv_kek, raw_kek } = await generateUserKEK(
      pek_hash,
      ARGON_ARGS
    );

    console.log(`\x1b[1;92mRegistered user:\x1b[0m ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Password Hash: ${pw_hash}`);
    console.log(`IV_KEK: ${iv_kek}`);
    console.log(`KEK: ${kek}`);
    console.log(`Raw KEK (for debugging, should not be stored): ${raw_kek}`);

    // Store user data with email, hash, kek, and iv_kek
    all_users[username] = {
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
  const username = req.body["signin-username"];
  const pw = req.body["signin-password"];

  if (!username || !pw) {
    return res.status(400).send("Username and password are required");
  }

  try {
    // Fetch hash from db
    let storedHash = null;
    let userData = null;

    if (username in all_users) {
      userData = all_users[username];
      // Check if the user data is in the old format (just a string hash) or new format (object with email and hash)
      storedHash = typeof userData === "string" ? userData : userData.hash;
    }

    if (!storedHash) {
      return res.status(401).send("Invalid username or password");
    }

    const isValid = await verifyPw(pw, storedHash);
    if (isValid) {
      console.log(`\x1b[1;92mUser signed in:\x1b[0m ${username}`);

      // If the user has a KEK, print the KEK information
      if (userData && userData.kek && userData.iv_kek) {
        console.log(`Email: ${userData.email}`);
        console.log(`Password Hash: ${userData.hash}`);
        console.log(`IV_KEK: ${userData.iv_kek}`);
        console.log(`KEK: ${userData.kek}`);
      }

      res.status(200).send();
    } else {
      res.status(401).send("Invalid username or password");
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
});

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

// Uncomment the following lines to run the server on HTTP instead of HTTPS
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(
//     `\n\x1b[1;92mRunning on \x1b[1;96mhttp://localhost:${PORT}\x1b[0m`
//   );
// });
