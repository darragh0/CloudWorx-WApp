/**
 * @file encrypt.js - Server-side crypto utilities.
 * @author darragh0
 */

import crypto from "crypto";
import argon2 from "argon2";

/**
 * Generate Initialization Vector (IV) from username.
 *
 * @param {string} username Username
 * @returns {Buffer} 12-byte IV
 * @private
 */
function _genIVFromUname(username) {
  const hash = crypto.createHash("sha256").update(username).digest();
  return hash.subarray(0, 12);
}

/**
 * Generate Initialization Vector (IV) for DEK (Data Encryption Key)
 * using UID & file name with some randomness.
 *
 * @param {string} uid User ID
 * @param {string} fileName File name
 * @returns {Buffer} 12-byte IV for DEK
 */
function genIVDEK(uid, fileName) {
  const hash = crypto.createHash("sha256");
  hash.update(uid);
  hash.update(fileName);
  hash.update(crypto.randomBytes(16));
  return hash.digest().subarray(0, 12);
}

/**
 * Generate Initialization Vector (IV) for file using KEK creation
 * time & file name with some randomness.
 *
 * @param {string} kekCreatedAt KEK creation time
 * @param {string} fileName File name
 * @returns {Buffer} 12-byte IV for file
 */
function genIVFile(kekCreatedAt, fileName) {
  const hash = crypto.createHash("sha256");
  hash.update(kekCreatedAt);
  hash.update(fileName);
  hash.update(crypto.randomBytes(16));
  return hash.digest().subarray(0, 12);
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
 * @param {string} str Base 64 encoded string
 * @returns {Buffer} Resulting buffer
 */
function fromBase64(str) {
  return Buffer.from(str, "base64");
}

/**
 * Encrypt data with AES-GCM.
 *
 * @param {Buffer} key Key for encryption (32 bytes for AES-256)
 * @param {Buffer} iv 12 byte Initialization Vector (IV)
 * @param {Buffer} data Data to encrypt
 * @returns {Buffer} Encrypted data
 */
function encryptData(key, iv, data) {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  // Get auth tag & combine with encrypted data
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]);
}

/**
 * Decrypt data with AES-GCM.
 *
 * @param {Buffer} key Key for decryption (32 bytes for AES-256)
 * @param {Buffer} iv 12-byte Initialization Vector (IV)
 * @param {Buffer} data Data to decrypt (includes auth tag)
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
 * @param {Buffer} pdkBuf PEK buffer to derive KEK
 * @param {string} username Username to create IV
 * @returns {KEKObj} Object containing KEK & IV used
 */
function genKEK(pdkBuf, username) {
  const iv = _genIVFromUname(username);
  const kek = crypto.randomBytes(32);
  const encryptedKEK = encryptData(pdkBuf, iv, kek);

  return { encryptedKEK, iv };
}

/**
 * Hash a password with Argon2id.
 *
 * @param {string} pw Password to hash
 * @param {int} memCost Memory cost
 * @param {int} timeCost Time cost
 * @param {int} threads Number of threads
 * @param {Buffer} [salt=null] Salt (optional for random salt)
 * @returns {HashNSalt} Object containing hash & salt
 */
async function hashPw(pw, memCost, timeCost, threads, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16); // Generate random salt if not provided
  }

  const hash = await argon2.hash(pw, {
    type: argon2.argon2id,
    memoryCost: memCost,
    timeCost: timeCost,
    parallelism: threads,
    salt: salt,
    hashLength: 32,
    raw: true,
  });

  return { hash, salt };
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

  return { publicKey, privateKey };
}

export { genIVDEK, genIVFile, toBase64, fromBase64, encryptData, decryptData, genKEK, hashPw, genED25519Pair };
