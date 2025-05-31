/**
 * @file verify.js - Verfication utilities for passwords & reCAPTCHA.
 * @author darragh0
 */

import argon2 from "argon2";
import fetch from "node-fetch";

/**
 * Verify a password against a hash.
 *
 * @param {string} pw Password to verify
 * @param {string} hash Argon2id hash
 * @returns
 */
async function verifyPw(pw, hash) {
  return await argon2.verify(hash, pw);
}

/**
 * Verify user's reCAPTCHA response.
 *
 * @param {string} response reCAPTCHA response token (from client)
 * @param {string} secretKey reCAPTCHA secret key (from `.env`)
 * @returns
 */
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
export { verifyPw, verifyRecaptcha };
