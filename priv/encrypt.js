/**
 * @file encrypt.js - Server-side crypto utilities.
 * @author darragh0
 */

import crypto from "crypto";
import { argon2d } from "argon2";

/**
 * Generate random IV.
 *
 * @returns {Buffer} 12-byte IV
 */
function genIV() {
  return crypto.randomBytes(12);
}

/**
 * Convert buffer to base64 string.
 *
 * @param {Buffer} buf Buffer to convert
 * @returns {string} Base64 encoded string
 */
function toBase64(buf) {
  return buf.toString("base64");
}

/**
 * Convert a base64 string to Buffer
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
 *
 * Decrypt data with AES-GCM.
 *
 * @param {Buffer} key Key for decryption (32 bytes for AES-256)
 * @param {Buffer} iv - 12-byte IV
 * @param {Buffer} data - Data to decrypt (includes auth tag)
 * @returns {Buffer} Decrypted data
 */
function decryptData(key, iv, data) {
  // Extract auth tag (last 16 bytes)
  const authTag = data.slice(data.length - 16);
  const encryptedData = data.slice(0, data.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * Generate KEK from PEK.
 * Uses Argon2id to hash PEK & uses that hash as the key for AES encryption.
 *
 * @param {string|Buffer} pek PEK to derive KEK from
 * @param {object} argonOptions Options for Argon2id hashing
 * @returns {object} Object containing the KEK and IV used
 */
async function genKEK(pek, argonOptions) {
  // Convert PEK to buffer if it's a string
  const pekBuffer = typeof pek === "string" ? Buffer.from(pek) : pek;

  // Hash the PEK using Argon2id
  const hash = await argon2.hash(pekBuffer.toString("hex"), {
    type: argon2.argon2id,
    memoryCost: argonOptions.memCost,
    timeCost: argonOptions.timeCost,
    parallelism: argonOptions.threads,
    raw: true, // Get raw hash bytes
  });

  // Use the hash as the key for AES encryption
  const hashBuffer = Buffer.from(hash);

  // Generate a random initialization vector for KEK encryption
  const iv_kek = genIV();

  // Generate a random key to use as the KEK
  const rawKek = crypto.randomBytes(32);

  // Encrypt the KEK using the hashed PEK as the key
  const encryptedKEK = encryptData(hashBuffer.slice(0, 32), iv_kek, rawKek);

  return {
    kek: toBase64(encryptedKEK),
    iv_kek: toBase64(iv_kek),
    raw_kek: toBase64(rawKek), // This is just for debugging, should not be stored
  };
}

/**
 * Hash a password using Argon2id.
 *
 * @param {string|Buffer} pw Password to hash
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

export {
  genIV,
  toBase64,
  fromBase64,
  encryptData,
  decryptData,
  genKEK,
  hashPw,
};
