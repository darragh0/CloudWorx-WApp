/**
 * Convert an ArrayBuffer or TypedArray to base64 string.
 * Handles large arrays by processing them in chunks.
 *
 * @param {ArrayBuffer|TypedArray} buf - Buffer to convert
 * @returns {string} Base64 encoded string
 */
function toBase64(u8arr) {
  // Handle large arrays by processing in chunks
  const CHUNK_SIZE = 8192;
  if (u8arr.length <= CHUNK_SIZE) {
    return btoa(String.fromCharCode(...u8arr));
  }

  let result = "";
  for (let i = 0; i < u8arr.length; i += CHUNK_SIZE) {
    const chunk = u8arr.slice(i, i + CHUNK_SIZE);
    result += btoa(String.fromCharCode(...chunk));
  }
  return result;
}

export { toBase64 };
