/**
 * @file util.js - Utility functions for server-side operations.
 * @author darragh0
 */

import dotenv from "dotenv";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { resolve, join } from "path";
import { Logger } from "./logging.js";

/**
 * Short-hand for sending GET request via fetch.
 *
 * @param {string} endpoint API endpoint to fetch data from
 * @param {string} desc Description of the request (logging)
 * @param {string} token JWT token for API access
 * @param {Logger} logger Logger instance for logging
 * @returns {Promise<Response>} Response object & parsed JSON data
 */
async function getFetch(endpoint, desc, token, logger) {
  logger.debug(`Sending ${desc} request to API [GET \`${endpoint}\`]`);
  try {
    return await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    logger.crit(`Failed to fetch data from API [${desc}]: ${err.message}`);
  }
}
/**
 * Short-hand for sending POST request with JSON body via fetch.
 *
 * @param {string} endpoint API endpoint to post data to
 * @param {string} desc Description of the request (logging)
 * @param {string} token JWT token for API access
 * @param {Logger} logger Logger instance for logging
 * @param {Object} payload Payload to send in the request body
 * @param {Object} [headers={}] Additional headers to include in the request
 * @returns {Promise<Response>} Response object from fetch
 */
async function postFetchJson(endpoint, desc, token, logger, payload, headers = {}) {
  logger.debug(`Sending ${desc} request to API [POST \`${endpoint}\`]`);
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logger.crit(`Failed to post data to API [${desc}]: ${err.message}`);
  }
}

/**
 * Fetch owned files for a user via API call.
 *
 * @param {string} uid User ID to fetch files for
 * @param {string} endpoint API endpoint to fetch owned files from
 * @param {Logger} logger Logger instance for logging
 * @param {string} token JWT token for API access
 * @returns {Promise<FilesOwned>} Files array & count
 */
async function getOwnedFiles(uid, endpoint, logger, token) {
  const response = await getFetch(endpoint, "get-owned-files", token, logger);

  if (response.status === 403 || response.status === 401) {
    logger.warn(`User \`${uid}\` does not have permission to view owned files`);
    return { count: 0, files: [] };
  } else if (!response.ok) {
    logger.crit(`Failed to fetch owned files: ${response.status} (UID=\`"${uid}"\`)`);
  }

  const data = await response.json();
  logger.trace("Received response:", 0, data);

  if (data.count == 0) logger.info(`Found no files owned in API response (UID=\`${uid}\`)`);
  else logger.info(`Found ${data.count} file(s) owned (UID=\`"${uid}"\`)`);
  return data;
}

/**
 * [GET] Get public keys for given user.
 *
 * @param {string} uid User ID of the requester
 * @param {string} user Username to fetch public keys for
 * @param {Logger} logger Logger instance for logging
 * @param {string} endpoint API endpoint to fetch public keys from
 * @param {string} token JWT token for API access
 * @return {Promise<GetPublicKeysRet>}
 */
async function getPublicKeys(uid, user, endpoint, logger, token) {
  const response = await getFetch(endpoint, "get-public-keys", token, logger);

  if (response.status === 401) {
    logger.warn(`User JWT token is invalid (UID=\`"${uid}"\`)`);
    return { status: 401, msg: "User JWT token is invalid", data: null };
  } else if (response.status === 404) {
    logger.err(`User does not exist: ${response.status} (UID=\`"${uid}"\`)`);
    return { status: 404, msg: `User does not exist: ${user}`, data: null };
  } else if (!response.ok) {
    logger.crit(`Failed to fetch public keys: ${response.status} (UID=\`"${uid}"\`)`);
  }

  const data = await response.json();
  logger.trace("Received response:", 0, data);

  if (data.user_id === uid) {
    logger.warn(`User \`${uid}\` tried to fetch own public keys (UID=\`${uid}\`)`);
    return { status: 403, msg: "Cannot fetch own public keys", data: null };
  }

  return { status: 200, data: data };
}

async function revokeShare(uid, fid, uname, endpoint, logger, token) {
  const res = await postFetchJson(endpoint, "revoke-share", token, logger, { shared_with_username: uname });

  if (res.status === 401) {
    logger.warn(`User JWT token is invalid (UID=\`"${uid}"\`)`);
    return { status: 401, msg: "User JWT token is invalid" };
  } else if (res.status === 404) {
    logger.warn(`File or share does not exist: ${res.status} (FID=\`"${fid}"\`; UID=\`"${uid}"\`)`);
    return { status: 404, msg: `File or share does not exist: \`"${fid}"\` \`"${uname}"\`` };
  } else if (!res.ok) {
    logger.crit(`Failed to revoke access: ${res.status} (FID=\`"${fid}"\`; UID=\`"${uid}"\`)`);
  }

  return { status: 200 };
}

/**
 * [POST] Share file with another user.
 *
 * @param {string} uid User ID of the requester
 * @param {string} endpoint API endpoint to share the file
 * @param {Logger} logger Logger instance for logging
 * @param {string} token JWT token for API access
 * @param {Object} payload Payload containing share information
 * @return {Promise<ShareRet>}
 */
async function shareWithBob(uid, endpoint, logger, token, payload) {
  const res = await postFetchJson(endpoint, "share-file", token, logger, payload);

  if (res.status === 401) {
    logger.warn(`User JWT token is invalid (UID=\`"${uid}"\`)`);
    return { status: 401, msg: "User JWT token is invalid" };
  } else if (res.status === 400) {
    logger.warn(`Bad request (UID=\`"${uid}"\`): ${res.status} -> ${res.statusText}`);
    return { status: 400, msg: "Bad request" };
  } else if (res.status === 404) {
    logger.warn(`File or recipient not found (UID=\`"${uid}"\`): ${res.status}`);
    return { status: 404, msg: "File or recipient not found" };
  }

  const data = await res.json();
  logger.trace("Received response:", 0, data);

  return { status: 200, data: data };
}

/**
 * Fetch files shared with the current user via API call.
 *
 * @param {string} uid User ID to fetch files for
 * @param {string} endpoint API endpoint to fetch owned files from
 * @param {Logger} logger Logger instance for logging
 * @param {string} token JWT token for API access
 * @returns {Promise<FilesSharedWithMe>} Files array & count
 */
async function getFilesSharedWithMe(uid, endpoint, logger, token) {
  const response = await getFetch(endpoint, "get-shared-files", token, logger);

  if (response.status === 403 || response.status === 401) {
    logger.warn(`User \`${uid}\` does not have permission to view shared files`);
    return { count: 0, files: [] };
  } else if (!response.ok) {
    logger.crit(`Failed to fetch files shared with user: ${response.status} (UID=\`"${uid}"\`)`);
  }

  const data = await response.json();
  logger.trace("Received response:", 0, data);

  if (data.count == 0) logger.info(`Found no files shared with user in API response (UID=\`"${uid}"\`)`);
  else logger.info(`Found ${data.count} file(s) shared with user (UID=\`"${uid}"\`)`);
  return data;
}

/**
 * Fetch files shared with the current user via API call.
 *
 * @param {string} uid User ID to fetch files for
 * @param {string} endpoint API endpoint to fetch owned files from
 * @param {Logger} logger Logger instance for logging
 * @param {string} token JWT token for API access
 * @returns {Promise<FilesSharedByMe>} Files array & count
 */
async function getFilesSharedByMe(uid, endpoint, logger, token) {
  const response = await getFetch(endpoint, "get-files-shared-by-me", token, logger);

  if (response.status === 403 || response.status === 401) {
    logger.warn(`User does not have permission to view shares (UID=\`"${uid}"\`)`);
    return { status: 403, msg: "User does not have permission to view shares", data: null };
  } else if (!response.ok) {
    logger.crit(`Failed to fetch files shared by user for file \`${fname}\`: ${response.status} (UID=\`"${uid}"\`)`);
  }

  const data = await response.json();
  logger.trace("Received response:", 0, data);

  if (data.count === 0) {
    logger.info(`Found no files shared by user in API response (UID=\`"${uid}"\`)`);
    return { status: 204, msg: "No files shared by user", data: { count: 0, files: [] } };
  }

  logger.info(`Found ${data.count} file(s) shared by user (UID=\`"${uid}"\`)`);

  return { status: 200, data: data };
}

/**
 * Get encrypted file content by filename via API call.
 *
 * @param {string} fname Filename of to fetch
 * @param {string} uid User ID to fetch file for
 * @param {string} endpoint API endpoint to fetch encrypted file from
 * @param {Logger} logger Logger instance for logging
 * @param {string} token JWT token for API access
 * @returns {Promise<{status: number, content: string|Buffer}>} Encrypted file content or error object
 */
async function getEncryptedFile(fname, uid, endpoint, logger, token) {
  const response = await getFetch(endpoint, "get-encrypted-file", token, logger);

  if (response.status === 403 || response.status === 401) {
    const ret = { status: 403, content: "User does not have permission to view owned files" };
    logger.warn(`${ret.content} (FILE=\`"${fname}"\`; UID=\`"${uid}"\`)`);
    return ret;
  } else if (response.status === 404) {
    const ret = { status: 404, content: `File \`"${fname}"\` not found in API` };
    logger.err(ret.content);
    return ret;
  }

  if (!response.ok) logger.crit(`Failed to get encrypted file \`"${fname}"\`: ${response.status}`);

  const data = await response.arrayBuffer();
  logger.trace(`Received response: \`${data}\``);
  return { status: 200, content: Buffer.from(data) };
}

/**
 * Fetch user data by UID via API call.
 *
 * @param {string} uid User ID to fetch data for
 * @param {string} endpoint API endpoint to fetch user data from
 * @param {Logger} logger Logger instance for logging
 * @param {string} token JWT token for API access
 * @returns {Promise<Object>} User data object or empty object if not found
 */
async function getUserData(uid, endpoint, logger, token) {
  const response = await getFetch(endpoint, "get-users", token, logger);

  if (!response.ok) logger.crit(`Failed to fetch user data (UID=\`"${uid}"\`) from API: ${response.status}`);

  const data = await response.json();
  logger.trace(`Received response:\n\`${JSON.stringify(data, null, 2)}\``);

  if (data.length == 0) logger.crit(`No user data found for user (UID=\`"${uid}"\`) in API response`);
  return data;
}

/**
 * Print usage information for the server script.
 */
function pusage() {
  console.log(
    "\n\x1b[1;96mUsage:\x1b[0;96m node server.js [--port \x1b[2mPORT\x1b[0;96m] [--retry-port] [--help]\x1b[0m\n\n" +
      "\x1b[1;96mOptions:\x1b[0;96m\n" +
      "  -p, --port \x1b[2mPORT\x1b[0m         Specify the port to run the server on (default=\x1b[93m3443\x1b[0m; " +
      "range=\x1b[93m3000\x1b[0m-\x1b[93m65535\x1b[0m)\n" +
      "  \x1b[96m-k, --kill-port\x1b[0m         Kill any server running on the specified port \x1b[91m[potentially dangerous]\x1b[0m\n" +
      "  \x1b[96m-u, --usage\x1b[0m             Show this help message\n" +
      "  \x1b[96m-h, --help\x1b[0m              ^\n",
  );
}

/**
 * Parse command line arguments for server configuration.
 *
 * @return {{forceKill: boolean, port: number}} Parsed arguments
 */
function parseArgv() {
  if (process.argv.length < 2) {
    perr(`Expected min. 2 args but got ${process.argv.length}`);
  }

  let args = process.argv.slice(2);
  let argv = {
    forceKill: false,
    port: 3443,
  };

  const VALID_ARGS = ["--port", "-p", "--force-kill", "-f", "--usage", "-u", "--help", "-h"];

  for (const arg of args) {
    if (!VALID_ARGS.includes(arg)) {
      perr(`Invalid argument: \x1b[96m${arg}\x1b[0m`);
      pusage();
    }

    if (["--usage", "-u", "--help", "-h"].includes(arg)) {
      pusage();
      process.exit(0);
    }
    if (arg.startsWith("--port") || arg.startsWith("-p")) {
      argv.port = parseInt(args[args.indexOf("--port") + 1] || args[args.indexOf("-p") + 1]);
      if (isNaN(argv.port) || argv.port < 3000 || argv.port > 65535) {
        perr(
          `Invalid port number: \x1b[2;96m\`${argv.port}\`\x1b[0m (expected \x1b[93m3000\x1b[0m-\x1b[93m65535\x1b[0m)`,
        );
      }
    } else if (["--force-kill", "-f"].includes(arg)) {
      argv.forceKill = true;
    }
  }

  return argv;
}

/**
 * Parse .env file and validate required keys.
 *
 * @param {string} proj_dir Project directory where .env file is located
 * @param {Logger} logger Logger instance for logging
 * @param {RequiredEnvKeys} req_keys Required env var names (key: type)
 * @returns {ParsedEnvVars} Parsed env vars
 */
function parseDotEnv(proj_dir, logger, req_keys) {
  const parsedEnv = dotenv.config({ path: resolve(proj_dir, ".env") });

  let ENV = {};

  for (const [key, value] of Object.entries(parsedEnv.parsed)) {
    const ukey = key.toUpperCase().trim();
    const lkey = key.toLowerCase().trim();

    if (ukey in req_keys && req_keys[ukey] === "uint") {
      logger.info(`Loaded env var: \`${ukey}=${value}\``);
    } else if (ukey in req_keys && req_keys[ukey] === "string") {
      logger.info(`Loaded env var: \`${ukey}="${value}"\``);
    } else {
      logger.warn(`Unknown env var: \`${ukey}\` (ignored)`);
      continue;
    }

    let type = req_keys[ukey];
    if (type === "uint") {
      ENV[lkey] = parseInt(value);
    } else {
      ENV[lkey] = value.trim();
    }
  }

  let exit = false;
  for (const ukey of Object.keys(req_keys)) {
    if (!ENV[ukey.toLowerCase()]) {
      logger.crit(`Missing env var: \`${ukey}\``);
      exit = true;
    }
  }

  if (exit) process.exit(1);
  return ENV;
}

/**
 * Check if required files/folders exist; log errors & exit if not.
 *
 * @param {Logger} logger Logger instance for logging
 * @param  {...string} paths File/folder paths to check
 */
function checkFilesExist(proj_dir, logger, ...paths) {
  let exit = false;
  for (let path of paths) {
    path = join(proj_dir, path);
    if (!fs.existsSync(path)) {
      logger.crit(`Missing required file or folder: \`${path}\``);
      exit = true;
    }
  }

  if (exit) process.exit(1);
}

/**
 * Print error message to stderr (before logger setup).
 *
 * @param {string} msg Error message to print
 * @private
 */
function perr(msg) {
  console.error(`\x1b[1;91mError:\x1b[0m ${msg}`);
  process.exit(1);
}

const _execAsync = promisify(exec);

/**
 * Forcefully kills processes using the specified port across different platforms.
 *
 * @param {number} port The port number to free up by killing associated processes
 * @param {Logger} logger Logger instance for logging
 * @returns {Promise<void>} Resolves when processes are successfully killed and port is released
 * @async
 */
async function killPort(port, logger) {
  const platform = process.platform;

  try {
    if (platform === "win32") {
      // Windows
      const { stdout } = await _execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split("\n");

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          await _execAsync(`taskkill /PID ${pid} /F`);
          logger.info(`Killed process \`${pid}\` on port \`${port}\``);
        }
      }
    } else {
      // Unix-like systems (Linux, macOS, etc.)
      try {
        const { stdout } = await _execAsync(`lsof -ti:${port}`);
        const pids = stdout
          .trim()
          .split("\n")
          .filter((pid) => pid);

        for (const pid of pids) {
          await _execAsync(`kill -9 ${pid}`);
          logger.info(`Killed process \`${pid}\` on port \`${port}\``);
        }
      } catch (lsofError) {
        // Fallback to fuser if lsof fails
        try {
          await _execAsync(`fuser -k ${port}/tcp`);
          logger.info(`Killed processes on port \`${port}\` using fuser`);
        } catch (fuserError) {
          // Final fallback: use netstat + ps (available on most systems)
          try {
            const { stdout } = await _execAsync(`netstat -tlnp 2>/dev/null | grep :${port}`);
            const lines = stdout.trim().split("\n");

            for (const line of lines) {
              const pidMatch = line.match(/(\d+)\/[^\s]+$/);
              if (pidMatch) {
                const pid = pidMatch[1];
                await _execAsync(`kill -9 ${pid}`);
                logger.info(`Killed process \`${pid}\` on port \`${port}\` using netstat`);
              }
            }
          } catch (netstatError) {
            // Last resort: use ss command (part of iproute2, usually available)
            try {
              const { stdout } = await _execAsync(`ss -tlnp | grep :${port}`);
              const lines = stdout.trim().split("\n");

              for (const line of lines) {
                const pidMatch = line.match(/pid=(\d+)/);
                if (pidMatch) {
                  const pid = pidMatch[1];
                  await _execAsync(`kill -9 ${pid}`);
                  logger.info(`Killed process \`${pid}\` on port \`${port}\` using ss`);
                }
              }
            } catch (ssError) {
              throw new Error(
                `All methods failed - lsof: ${lsofError.message}, fuser: ${fuserError.message}, netstat: ${netstatError.message}, ss: ${ssError.message}`,
              );
            }
          }
        }
      }
    }

    // Wait a moment for port to be released
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    logger.crit(`Failed to kill port \`${port}\`: ${error.message}`);
  }
}

export {
  Logger,
  parseArgv,
  parseDotEnv,
  checkFilesExist,
  getUserData,
  getFetch,
  killPort,
  getOwnedFiles,
  getFilesSharedWithMe,
  getEncryptedFile,
  shareWithBob,
  getFilesSharedByMe,
  getPublicKeys,
  revokeShare,
};
