/**
 * @file types.js - Type definitions.
 * @author darragh0
 *
 * @typedef {Object.<string, [string, string]>} RequiredFields
 *
 * @typedef {"Password" | "File Password"} PasswordKey
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
