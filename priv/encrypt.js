/**
 * @file encrypt.js - Server-side crypto utilities.
 * @author darragh0
 *
 * @typedef {object} ED25519KeyPair
 * @property {string} publicKey - Public key in PEM format
 * @property {string} privateKey - Private key in PEM format
 *
 * @typedef {object} KEKObj
 * @property {string} kek Encrypted KEK in base64
 * @property {string} iv_kek IV used for KEK encryption in base64
 *
 * @typedef {object} Argon2HashParams
 * @property {string} salt Salt
 * @property {int} p Parallelism factor (threads)
 * @property {int} m Memory cost
 * @property {int} t Time cost
 */

import crypto from "crypto";
import argon2 from "argon2";

/**
 * Generate random IV.
 *
 * @returns {Buffer} 12-byte IV
 */
function genIV() {
  return crypto.randomBytes(12);
}

/**
 * Convert buffer or string to base64 string.
 *
 * @param {Buffer|string} bors Buffer or string to convert
 * @returns {string} Base64 encoded string
 */
function toBase64(bors) {
  if (typeof bors === "string") {
    bors = Buffer.from(bors);
  }
  return bors.toString("base64");
}

/**
 * Convert base64 string to Buffer.
 *
 * @param {string} base64 Base64 string to convert
 * @returns {Buffer} Resulting buffer
 */
function fromBase64(base64) {
  return Buffer.from(base64, "base64");
}

/**
 * Encrypt data with AES-GCM.
 *
 * @param {Buffer} key Key for encryption (32 bytes for AES-256)
 * @param {Buffer} iv 12 byte IV
 * @param {Buffer|string} data Data to encrypt
 * @returns {Buffer} Encrypted data
 */
function encryptData(key, iv, data) {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const dataBuffer = typeof data === "string" ? Buffer.from(data) : data;

  const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);

  // Get auth tag & combine with encrypted data
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]);
}

/**
 * Decrypt data with AES-GCM.
 *
 * @param {Buffer} key Key for decryption (32 bytes for AES-256)
 * @param {Buffer} iv - 12-byte IV
 * @param {Buffer} data - Data to decrypt (includes auth tag)
 * @returns {Buffer} Decrypted data
 */
function decryptData(key, iv, data) {
  // Extract auth tag (last 16 bytes)
  const authTag = data.subarray(data.length - 16);
  const encryptedData = data.subarray(0, data.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * Generate KEK from PEK.
 *
 * @param {string} pek PEK to derive KEK from
 * @returns {KEKObj} Object containing KEK & IV used
 */
function genKEK(pek) {
  const pekbuf = Buffer.from(pek);
  const iv_kek = genIV();
  const kek = crypto.randomBytes(32);

  // Encrypt the KEK using the hashed PEK as the key
  const encryptedKEK = encryptData(pekbuf.subarray(0, 32), iv_kek, kek);

  return {
    kek: toBase64(encryptedKEK),
    iv_kek: toBase64(iv_kek),
  };
}

/**
 * Extract Argon2 hash parameters from hash string.
 *
 * @param {string} hash
 * @returns
 */
function extractHashParams(hash) {
  const match = hash.match(/argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$(.*)/);
  if (!match) {
    throw new Error("Invalid Argon2 hash format");
  }

  const saltAndHash = match[5];
  const parts = saltAndHash.split("$");

  return {
    salt: parts[0],
    p: parseInt(match[4], 10),
    m: parseInt(match[2], 10),
    t: parseInt(match[3], 10),
  };
}

/**
 * Hash a password with Argon2id.
 *
 * @param {string} pw Password to hash
 * @param {int} memCost Memory cost
 * @param {int} timeCost Time cost
 * @param {int} threads Number of threads
 * @returns {Promise<string>} Hashed password
 */
async function hashPw(pw, memCost, timeCost, threads) {
  const hash = await argon2.hash(pw, {
    type: argon2.argon2id,
    memoryCost: memCost,
    timeCost: timeCost,
    parallelism: threads,
  });

  return hash;
}

/**
 * Remove PEM header & footer from a key.
 *
 * @param {string} pemKey PEM formatted key
 * @returns {string} Key content without header & footer
 */
function _stripPemHeaders(pemKey) {
  return pemKey
    .replace(/-----BEGIN [A-Z ]+-----\r?\n?/, "")
    .replace(/\r?\n?-----END [A-Z ]+-----\r?\n?/, "")
    .replace(/\r?\n/g, "");
}

/**
 * Generate Ed25519 keypair in PEM format.
 *
 * @returns {ED25519KeyPair} Object containing private and public keys in PEM format
 */
function genED25519Pair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKey: _stripPemHeaders(publicKey),
    privateKey: _stripPemHeaders(privateKey),
  };
}

export {
  genIV,
  toBase64,
  fromBase64,
  encryptData,
  decryptData,
  genKEK,
  hashPw,
  genED25519Pair,
  extractHashParams,
};
