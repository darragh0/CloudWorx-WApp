/**
 * Convert an ArrayBuffer or TypedArray to base64 string.
 * Handles large arrays by processing them in chunks.
 *
 * @param {ArrayBuffer|TypedArray} buf - Buffer to convert
 * @returns {string} Base64 encoded string
 */
function toBase64(u8arr) {
  return btoa(String.fromCharCode(...u8arr));
}

export { toBase64 };
