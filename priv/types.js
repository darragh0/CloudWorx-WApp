/**
 * @file types.js - Type definitions.
 * @author darragh0
 *
 * @typedef {Object.<string, [string, "string" | "uint"]>} RequiredFields
 * @typedef {Object.<string, "string" | "uint">} RequiredEnvKeys
 * @typedef {Object.<string, number>} ParsedEnvVars
 * @typedef {Object.<string, Logger>} LoggerMap
 *
 * @typedef {string} TStr Template string with "{}" placeholders for values.
 * @typedef {Object.<string, *>} TStrValues with key-value pairs for template replacement.
 * @typedef {string} FPathStr Path to a file (relative or absolute).
 *
 * @typedef {object} LoggerParams Parameters for configuring a logger.
 * @property {TStr | "plain" | null} [name] Name of the logger
 * @property {TStr | "plain" | null} [date] Date of the log message.
 * @property {TStr | "plain" | null} [level] Log level of the message.
 * @property {"pretty" | "iso" | null} [dateFmt] Date format for the log messages.
 * @property {string | null} [sep] Separator between log fields.
 * @property {string | null} [msgSep] Separator between log message and metadata.
 * @property {boolean} [jsonl] Whether to output logs in JSONL format.
 * @property {boolean} [colorLvl] Whether to colorize log levels.
 * @property {"stdout" | "stderr" | FPathStr} [out] Output destination for the logs.
 *
 * @typedef {"Password" | "File Password"} PasswordKey
 *
 * @typedef {object} ED25519KeyPair
 * @property {string} publicKey Public key in PEM format
 * @property {string} privateKey Private key in PEM format
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
