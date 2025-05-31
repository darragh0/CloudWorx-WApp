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
 * Send file to server for encryption.
 * This delegates the encryption process to the server side.
 *
 * @param {File} file File to encrypt
 * @param {string} filepw User's file password
 * @returns {Promise<Object>} Promise that resolves to the encryption payload from server
 */
async function encryptFile(file, filepw) {
  // Convert file to base64
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const fileContent = toBase64(fileBytes);

  // Prepare payload for server
  const payload = {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    fileContent: fileContent,
    filePw: filepw,
  };

  // Send to server for encryption
  const response = await fetch("/encrypt-file", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Error encrypting file");
  }

  return await response.json();
}

export { toBase64, encryptFile };
