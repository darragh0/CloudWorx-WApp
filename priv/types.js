/**
 * @file types.js - Type definitions.
 * @author darragh0
 *
 * @typedef {Object.<string, [string, "string" | "uint"]>} RequiredFields
 * @typedef {Object.<string, "string" | "uint">} RequiredEnvKeys
 * @typedef {Object.<string, number>} ParsedEnvVars
 * @typedef {Object.<string, Logger>} LoggerMap
 * @typedef {Object.Map<LogLevel, number>} LogLevelMap
 *
 * @typedef {string} TStr Template string with "{}" placeholders for values.
 * @typedef {Object.<string, *>} TStrValues with key-value pairs for template replacement.
 * @typedef {string} FPathStr Path to a file (relative or absolute).
 *
 * @typedef {"DEB" | "INF" | "WAR" | "ERR" | "CRI"} LogLevel
 *
 * @typedef {object} LoggerParams Parameters for configuring a logger.
 * @property {TStr | "plain" | null} [name] Name of the logger
 * @property {TStr | "plain" | null} [date] Date of the log message
 * @property {TStr | "plain" | null} [level] Log level of the message
 * @property {"pretty" | "iso" | null} [dateFmt] Date format for the log messages
 * @property {string | null} [sep] Separator between log fields
 * @property {string | null} [msgSep] Separator between log message and metadata
 * @property {boolean} [jsonl] Whether to output logs in JSONL format
 * @property {boolean} [colorLvl] Whether to colorize log levels
 * @property {"console" | FPathStr} [out] Output destination for the logs
 * @property {boolean} [colorBacktickedItems] Whether to colorize backticked items in messages
 *
 * @typedef {"Password" | "file password"} PasswordKey
 * @typedef {Promise<{hash: Buffer, salt: Buffer}>} HashNSalt
 *
 * @typedef {object} KeyPair
 * @property {string|Buffer} publicKey Public key in PEM format
 * @property {string|Buffer} privateKey Private key in PEM format
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
 *
 * @typedef {object} FileDEKData
 * @property {string} key_id Unique identifier for DEK
 * @property {string} iv_dek Initialization vector for DEK encryption
 * @property {string} encrypted_dek Encrypted DEK in base64
 * @property {string} assoc_data_dek Associated data for DEK encryption
 *
 * @typedef {object} OwnedFile
 * @property {string} file_id Unique ID for file
 * @property {string} file_name Name of file
 * @property {string} file_type Type of file / Extension (e.g. ".txt")
 * @property {string} iv_file Initialization vector for file encryption
 * @property {string} assoc_data_file Associated data file (if any)
 * @property {string} created_at Creation timestamp of the file
 * @property {number} file_size Size of the file in bytes
 * @property {FileDEKData} dek_data DEK data for encrypted files
 *
 * @typedef {object} FilesOwned
 * @property {OwnedFile[]} files List of files owned by the user
 * @property {number} count Total number of files owned
 *
 * @typedef {object} SharedByMeFile
 * @property {string} share_id Unique ID for the share
 * @property {string} file_id Unique ID for file
 * @property {string} file_name Name of file
 * @property {string} file_type Type of file / Extension (e.g. ".txt")
 * @property {number} file_size Size of the file in bytes
 * @property {string} shared_with User ID of the person the file is shared with
 * @property {string} shared_with_username Username of the person the file is shared with
 * @property {string} created_at Creation timestamp of the file
 *
 * @typedef {object} FilesSharedByMe
 * @property {SharedByMeFile[]} files List of files shared by the user
 * @property {number} count Total number of files shared by the user
 *
 * @typedef {object} SharedWithMeFile
 * @property {string} share_id Unique ID for the share
 * @property {string} file_id Unique ID for file
 * @property {string} file_name Name of file
 * @property {string} file_type Type of file / Extension (e.g. ".txt")
 * @property {number} file_size Size of the file in bytes
 * @property {string} shared_by User ID of the person who shared the file
 * @property {string} shared_by_username Username of the person who shared the file
 * @property {string} created_at Creation timestamp of the file
 *
 * @typedef {object} FilesSharedWithMe
 * @property {SharedWithMeFile[]} files List of files shared with the user
 * @property {number} count Total number of files shared with the user
 *
 * @typedef {Object} PubKeyResponse
 * @property {string} username Username of the key owner
 * @property {string} user_id User ID of the key owner
 * @property {string} x25519_public_key X25519 public key in PEM format
 * @property {string} ed25519_public_key Ed25519 public key in PEM format
 * @property {string} tofu_message Message indicating trust on first use (TOFU)
 * @property {string} kek Encrypted KEK in base64
 *
 * @typedef {Object} GetPublicKeysRet
 * @property {number} status Status code of the response
 * @property {string} [msg] Message describing the response
 * @property {PubKeyResponse} [data] Public key data
 *
 * @typedef {Object} ShareDat
 * @property {string} message Success message
 * @property {string} share_id Unique ID for the share
 * @property {string} shared_with User ID of the person the file is shared with
 * @property {string} tofu_message Message indicating trust on first use (TOFU)
 *
 * @typedef {Object} ShareRet
 * @property {number} status Status code of the response
 * @property {string} [msg] Message describing the response
 * @property {ShareDat} [data] Share data
 */
