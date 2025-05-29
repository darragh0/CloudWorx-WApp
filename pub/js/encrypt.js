/**
 * Generate a random initialization vector
 * @returns {Buffer} A 12-byte initialization vector
 */
function genIV() {
  return crypto.randomBytes(12);
}

/**
 * Convert an ArrayBuffer or TypedArray to base64 string.
 * Handles large arrays by processing them in chunks.
 *
 * @param {ArrayBuffer|TypedArray} buf - Buffer to convert
 * @returns {string} Base64 encoded string
 */
const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 1024; // Process in chunks to avoid "too many arguments" error

  // Process the array in chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  return btoa(binary);
};

/**
 * Generate new AES-GCM key.
 *
 * @returns {Promise<CryptoKey>} Promise that resolves to a generated AES-GCM key
 */
async function genAESKey() {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt bytes using AES-GCM.
 *
 * @param {CryptoKey} key Key for encryption
 * @param {Uint8Array} iv Initialization vector
 * @param {Uint8Array} data Data to encrypt
 *
 * @returns {Promise<Uint8Array>} Promise that resolves to encrypted data as Uint8Array
 */
async function encryptData(key, iv, data) {
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new Uint8Array(encrypted);
}

/**
 * Export CryptoKey as raw bytes.
 *
 * @param {CryptoKey} key Key to export
 * @returns {Promise<Uint8Array>} Promise that resolves to raw bytes of the key
 */
async function exportKeyRaw(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export { genIV, toBase64, genAESKey, encryptData, exportKeyRaw };
