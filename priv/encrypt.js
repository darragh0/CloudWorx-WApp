// Server-side encryption utilities
import crypto from "crypto";

/**
 * Generate a random initialization vector
 * @returns {Buffer} A 12-byte initialization vector
 */
function genIV() {
  return crypto.randomBytes(12);
}

/**
 * Convert a Buffer to base64 string
 * @param {Buffer} buf - Buffer to convert
 * @returns {string} Base64 encoded string
 */
function toBase64(buf) {
  return buf.toString("base64");
}

/**
 * Convert a base64 string to Buffer
 * @param {string} base64 - Base64 string to convert
 * @returns {Buffer} Resulting buffer
 */
function fromBase64(base64) {
  return Buffer.from(base64, "base64");
}

/**
 * Encrypt data using AES-GCM
 * @param {Buffer} key - Key for encryption (must be 32 bytes for AES-256)
 * @param {Buffer} iv - Initialization vector (12 bytes)
 * @param {Buffer|string} data - Data to encrypt
 * @returns {Buffer} Encrypted data
 */
function encryptData(key, iv, data) {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const dataBuffer = typeof data === "string" ? Buffer.from(data) : data;

  const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);

  // Get authentication tag and combine with encrypted data
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]);
}

/**
 * Decrypt data using AES-GCM
 * @param {Buffer} key - Key for decryption (must be 32 bytes for AES-256)
 * @param {Buffer} iv - Initialization vector (12 bytes)
 * @param {Buffer} data - Data to decrypt (includes authentication tag)
 * @returns {Buffer} Decrypted data
 */
function decryptData(key, iv, data) {
  // Extract the auth tag (last 16 bytes)
  const authTag = data.slice(data.length - 16);
  const encryptedData = data.slice(0, data.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * Generate a KEK (Key Encryption Key) from a PEK (Password Encryption Key)
 * Uses Argon2id to hash the PEK and then uses that hash as the key for AES encryption
 *
 * @param {string|Buffer} pek - Password Encryption Key
 * @param {object} argonOptions - Options for Argon2id hashing
 * @returns {object} Object containing the KEK and IV used
 */
async function generateKEK(pek, argon2, argonOptions) {
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

export { genIV, toBase64, fromBase64, encryptData, decryptData, generateKEK };
