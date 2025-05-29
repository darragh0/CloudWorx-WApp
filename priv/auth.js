import argon2 from "argon2";
import fetch from "node-fetch";
import { generateKEK } from "./encrypt.js";

async function verifyPw(pw, hash) {
  return await argon2.verify(hash, pw);
}

// Verify reCAPTCHA response
async function verifyRecaptcha(response, secretKey) {
  if (!response) {
    return {
      success: false,
      error: "reCAPTCHA verification failed. Please try again.",
    };
  }

  if (!secretKey) {
    console.error("Missing RECAPTCHA_SECRET_KEY environment variable");
    return {
      success: false,
      error: "Server configuration error. Please contact the administrator.",
    };
  }

  try {
    const verificationURL = "https://www.google.com/recaptcha/api/siteverify";
    const result = await fetch(verificationURL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${secretKey}&response=${response}`,
    });

    const data = await result.json();

    if (data.success) {
      return { success: true };
    } else {
      console.error("reCAPTCHA verification failed:", data["error-codes"]);
      return {
        success: false,
        error: "reCAPTCHA verification failed. Please try again.",
      };
    }
  } catch (error) {
    console.error("Error verifying reCAPTCHA:", error);
    return {
      success: false,
      error: "Error verifying reCAPTCHA. Please try again later.",
    };
  }
}

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
 * Generate KEK (Key Encryption Key) from PEK (Password Encryption Key)
 * @param {string} pek - Password Encryption Key
 * @param {object} argonOptions - Options for Argon2id hashing
 * @returns {object} Object containing the KEK and IV used
 */
async function generateUserKEK(pek, argonOptions) {
  return await generateKEK(pek, argon2, argonOptions);
}

export { verifyPw, verifyRecaptcha, hashPw, generateUserKEK };
