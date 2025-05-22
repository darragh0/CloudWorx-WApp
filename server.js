import express from "express";
import path from "path";
import argon2 from "argon2";
import fs from "fs";

import { dirname } from "path";
import { fileURLToPath } from "url";

let reg_users = JSON.parse(fs.readFileSync("./users.json", "utf8"));

const app = express();

const PUB_DIR = path.join(dirname(fileURLToPath(import.meta.url)), "public");
const HTML_DIR = path.join(PUB_DIR, "html");

// Middleware
app.use(express.static(PUB_DIR));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve `.html` files without `.html` in URL
app.get("/:page", (req, res) => {
  const page = req.params.page;
  const filePath = path.join(HTML_DIR, `${page}.html`);
  console.log(filePath);

  res.sendFile(filePath, (err) => {
    if (err) res.status(404).send("Page not found");
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
  const pw = req.body["signup-password"];

  if (!username || !pw) {
    return res.status(400).send("Username and password are required");
  }

  try {
    const hash = await hashPw(pw);
    console.log(
      `\x1b[1;92mRegistered user:\x1b[0m ${username} (pw_hash=\`${hash}\``
    );
    reg_users[username] = hash;
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
      storedHash = reg_users[username];
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
    memoryCost: 2 ** 16, // 64MB — tweak as needed
    timeCost: 3, // iterations
    parallelism: 1, // threads (can bump if multi-core)
  });

  return hash;
}

async function verifyPw(pw, hash) {
  return await argon2.verify(hash, pw);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `\n\x1b[1;92mRunning on \x1b[1;96mhttp://localhost:${PORT}\x1b[0m`
  );
});
