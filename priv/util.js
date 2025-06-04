/**
 * @file util.js - Utility functions for server-side operations.
 * @author darragh0
 */

import dotenv from "dotenv";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path, { resolve, join } from "path";

/**
 * Format a template string with values.
 *
 * @param {TStr} tStr Template string with placeholders like {key}
 * @param {TStrValues} values Keys to replace with their values
 * @returns {string} Formatted string with values replaced
 */
function fmtTstr(tStr, values) {
  return tStr.replace(/{(\w+)}/g, (_, key) => values[key] ?? "");
}

/** Logger class */
class Logger {
  /** @type {LoggerMap} */
  static _loggers = new Map();

  /** @type {Object.Map<LogLevel, number>} */
  static _levelMap = {
    TRA: 0,
    DEB: 1,
    INF: 2,
    WAR: 3,
    ERR: 4,
    CRI: 5,
  };

  /**
   * Get or create a named logger.
   *
   * @param {string} name Name of the logger
   * @returns {Logger} Logger instance if exists
   * @throws {Error} If logger with given name does not exist
   */
  static get(name) {
    if (!Logger._loggers.has(name)) {
      throw new Error(`Logger with name "${name}" does not exist`);
    }
    return Logger._loggers.get(name);
  }

  /**
   * Create a new Logger instance.
   *
   * @param {string} name Name of the logger (module or app name)
   * @param {LoggerParams} [fmtParams={}] Formatting parameters (optional)
   * @param {LogLevel} [level="debug"] Log level to set
   * @param {number} [flushThreshold=1000] No. of messages before flushing output (for files)
   * @param {number} [rotateAtBytes=5 * 1024 * 1024] Rotate log file at this size (in bytes)
   * @returns {Logger}
   */
  constructor(name, fmtParams = {}, level = "DEB", flushThreshold = 1000, rotateAtBytes = 5 * 1024 * 1024) {
    if (!("name" in fmtParams)) {
      fmtParams.name = "\x1b[2;93m({name})\x1b[0m";
    } else if (fmtParams.name === "plain") {
      fmtParams.name = "{name}";
    }

    if (!("date" in fmtParams)) {
      fmtParams.date = "\x1b[2;94m[{date}]\x1b[0m";
    } else if (fmtParams.date === "plain") {
      fmtParams.date = "{date}";
    }

    if (!("level" in fmtParams)) {
      fmtParams.level = "[{level}]";
    } else if (fmtParams.level === "plain") {
      fmtParams.level = "{level}";
    }

    if (!("dateFmt" in fmtParams)) fmtParams.dateFmt = "pretty";
    if (!("jsonl" in fmtParams)) fmtParams.jsonl = false;
    if (!("colorLvl" in fmtParams)) fmtParams.colorLvl = true;
    if (!("sep" in fmtParams)) fmtParams.sep = " ";
    if (!("msgPre" in fmtParams)) fmtParams.msgPre = "::";

    if (!("out" in fmtParams)) {
      fmtParams.out = "stdout";
    } else if (fmtParams.out !== "stdout" && fmtParams.out !== "stderr") {
      const dir = path.dirname(fmtParams.out);
      fs.mkdirSync(dir, { recursive: true });

      let suffix = 1;
      let newFile = fmtParams.out;
      while (fs.existsSync((newFile = `${fmtParams.out}.jsonl.${suffix}`))) {
        suffix++;
      }

      let prevFile = `${fmtParams.out}.jsonl.${suffix - 1}`;
      if (fs.existsSync(prevFile) && fs.statSync(prevFile).size >= this.rotateAtBytes) {
        fmtParams.out = newFile;
      } else if (fs.existsSync(prevFile)) {
        fmtParams.out = prevFile;
      } else {
        fmtParams.out = newFile;
      }
    }

    if (Logger._loggers.has(name)) {
      throw new Error(`Logger with name "${name}" already exists`);
    }

    Logger._loggers.set(name, this);
    this.name = name;
    this.level = Logger._levelMap[level];
    this.flushThreshold = flushThreshold;
    this.fmtParams = fmtParams;
    this.msgCount = 0;
    this.rotateAtBytes = rotateAtBytes;
    this.msgBuf = [];
    this.links = [];

    this._fmtName = null;
    this._fmtDate = null;
    this._fmtLevel = null;
    this._fmtAll = null;

    this._createLogFns();
  }

  /**
   * Set the log level for this logger.
   *
   * @param {LogLevel} level Log level to set
   */
  setLogLevel(level) {
    this.level = Logger._levelMap[level];
  }

  /**
   * Create format functions based on the provided formatting parameters.
   * This is called when the logger is created or when a log message is formatted.
   *
   * @private
   */
  _createLogFns() {
    if (this.fmtParams.name) this._fmtName = () => fmtTstr(this.fmtParams.name, { name: this.name });

    if (this.fmtParams.date) {
      if (this.fmtParams.dateFmt === "iso") {
        this._fmtDate = () => fmtTstr(this.fmtParams.date, { date: new Date().toISOString() });
      } else {
        this._fmtDate = () =>
          fmtTstr(this.fmtParams.date, {
            date: new Date().toISOString().replace("T", " ").replace("Z", "").split(".")[0],
          });
      }
    }

    if (this.fmtParams.level) {
      if (this.fmtParams.colorLvl) {
        this._fmtLevel = (level, color) => `\x1b[${color}m${fmtTstr(this.fmtParams.level, { level })}\x1b[0m`;
      } else {
        this._fmtLevel = (level, _) => fmtTstr(this.fmtParams.level, { level });
      }
    }

    if (this.fmtParams.jsonl) {
      this._fmtAll = (msg, _, level, color) => {
        let outMap = {
          name: null,
          date: null,
          level: null,
        };

        if (this._fmtName) outMap.name = this._fmtName();
        if (this._fmtDate) outMap.date = this._fmtDate();
        if (this._fmtLevel) outMap.level = this._fmtLevel(level, color);

        outMap.message = msg;
        const json = Object.fromEntries(Object.entries(outMap).filter(([_, v]) => v !== null));
        return JSON.stringify(json).replace(/"(?:\\.|[^"\\])*"|\s*:\s*|\s*,\s*/g, (match) =>
          match.startsWith('"') ? match : match.trim() + " "
        );
      };
    } else {
      this._fmtAll = (msg, ind, level, color) => {
        let outMap = {
          name: null,
          date: null,
          level: null,
        };

        const pre = " ".repeat(ind);
        if (this._fmtName) outMap.name = this._fmtName();
        if (this._fmtDate) outMap.date = this._fmtDate();
        if (this._fmtLevel) outMap.level = this._fmtLevel(level, color);

        const out = Object.values(outMap)
          .filter((v) => v !== null)
          .join(this.fmtParams.sep);

        if (this.fmtParams.msgPre) {
          return `${pre}${out}${this.fmtParams.sep}${this.fmtParams.msgPre}${this.fmtParams.sep}${msg}`;
        }

        return `${pre}${out}${msg}`;
      };
    }
  }

  /**
   * Format log message.
   *
   * @param {string} msg Message to log
   * @param {number} ind Indentation level (in spaces)
   * @param {string} level Log level abbreviation (e.g. "INF")
   * @param {string} color ANSI color code
   * @private
   */
  _fmt(msg, ind, level, color) {
    return this._fmtAll(msg, ind, level, color);
  }

  /**
   * Format & log a message.
   *
   * @param {string} msg Message to log
   * @param {number} ind Indentation level (in spaces)
   * @param {string} level Log level abbreviation (e.g. "INF")
   * @param {string} color ANSI color code
   * @private
   *
   * @see Logger.fmtTstr
   */
  _log(msg, ind, level, color) {
    if (Logger._levelMap[level] < this.level) {
      return;
    }

    const fmted = this._fmt(msg, ind, level, color);
    this.msgCount++;

    if (this.fmtParams.out === "stdout") {
      console.log(fmted);
    } else if (this.fmtParams.out === "stderr") {
      console.error(fmted);
    } else if (this.msgCount == this.flushThreshold) {
      this.flushToFile();
      this.msgBuf.push(fmted);
    } else {
      this.msgBuf.push(fmted);
    }

    for (const link of this.links) {
      link._log(msg, ind, level, color);
    }
  }

  /**
   * Force flush message buffer to output (only works for files).
   *
   * @see Logger._log
   */
  flushToFile() {
    if (fs.existsSync(this.fmtParams.out) && fs.statSync(this.fmtParams.out).size >= this.rotateAtBytes) {
      const dot = this.fmtParams.out.lastIndexOf(".");
      const bname = this.fmtParams.out.slice(0, dot);
      const suffix = parseInt(this.fmtParams.out.slice(dot + 1));
      this.fmtParams.out = `${bname}.${suffix + 1}`;
    }
    fs.appendFileSync(this.fmtParams.out, `${this.msgBuf.join("\n")}\n`);
  }

  /**
   * Link this logger to another logger.
   * Propogates log messages to linked loggers.
   *
   * @param {Logger} logger Other logger to link to
   */
  propagateTo(logger) {
    if (this.links.includes(logger)) {
      throw new Error(`Logger \`${logger.name}\` is already linked to \`${this.name}\``);
    }

    this.links.push(logger);
  }
  /**
   * Log a trace-level message (faint dark-grey).
   *
   * @param {string} msg
   * @param {number} [ind=0]
   */
  trace(msg, ind = 0) {
    this._log(msg, ind, "TRA", "2;90");
  }

  /**
   * Log a debug-level message (dark grey).
   *
   * @param {string} msg
   * @param {number} [ind=0]
   */
  debug(msg, ind = 0) {
    this._log(msg, ind, "DEB", "90");
  }

  /**
   * Log an info-level message (light cyan).
   *
   * @param {string} msg
   * @param {number} [ind=0]
   */
  info(msg, ind = 0) {
    this._log(msg, ind, "INF", "96");
  }

  /**
   * Log a warning-level message (yellow).
   *
   * @param {string} msg
   * @param {number} [ind=0]
   */
  warn(msg, ind = 0) {
    this._log(msg, ind, "WAR", "93");
  }

  /**
   * Log an error-level message (red).
   *
   * @param {string} msg
   * @param {number} [ind=0]
   */
  err(msg, ind = 0) {
    this._log(msg, ind, "ERR", "91");
  }

  /**
   * Log a critical-level message (bold red).
   *
   * @param {string} msg
   * @param {number} [ind=0]
   */
  crit(msg, ind = 0) {
    this._log(msg, ind, "CRI", "1;91");
    process.exit(1);
  }
}

/**
 * Check if username or email already exists via API call
 *
 * @param {string} username Username to check
 * @param {string} endpoint API endpoint to check against
 * @param {Logger} logger Logger instance for logging
 * @param {string|null} [email=null] Email to check
 * @returns {Promise<boolean>} True if user exists, false otherwise
 */
async function checkUserExists(username, endpoint, logger, email = null) {
  logger.debug(`Sending get-users request to API [GET \`${endpoint}\`]`);
  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      logger.crit(`Failed to fetch users from API: ${response.status}`);
      return false;
    }

    const data = await response.json();
    logger.trace(`Received response:\n\`${JSON.stringify(data, null, 2)}\``);

    if (!data.users || !Array.isArray(data.users)) {
      logger.crit(`Invalid response format from users API: ${JSON.stringify(data)}`);
      return false;
    }

    if (email) {
      return data.users.some((user) => user.username === username || user.email === email);
    }
    return data.users.some((user) => user.username === username);
  } catch (error) {
    logger.crit(`Error checking user existence: ${error.message}`);
    return false;
  }
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
  logger.debug(`Sending get-users request to API [GET \`${endpoint}\`]`);
  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      logger.warn(`Failed to fetch data for user \`${uid}\` from API: ${response.status}`);
      return {};
    }

    const data = await response.json();
    logger.trace(`Received response:\n\`${JSON.stringify(data, null, 2)}\``);
    return data;
  } catch (error) {
    logger.crit(`Error fetching user data: ${error.message}`);
    return {};
  }
}

/**
 * Print usage information for the server script.
 */
function pusage() {
  console.log(
    "\n\x1b[1;96mUsage:\x1b[0;96m node server.js [--port \x1b[2mPORT\x1b[0;96m] [--retry-port] [--help]\x1b[0m\n\n" +
      "\x1b[1;96mOptions:\x1b[0;96m\n" +
      "  -p, --port \x1b[2mPORT\x1b[0m         Specify the port to run the server on (default=\x1b[93m3443\x1b[0m)\n" +
      "  \x1b[96m-r, --retry-port\x1b[0m        Keep trying ports 100x until one is available\n" +
      "  \x1b[96m-k, --kill-port\x1b[0m         Kill any server running on the specified port \x1b[91m[potentially dangerous]\x1b[0m\n" +
      "  \x1b[96m-u, --usage\x1b[0m             Show this help message\n" +
      "  \x1b[96m-h, --help\x1b[0m              ^\n"
  );
}

/**
 * Parse command line arguments for server configuration.
 *
 * @return {{retry: boolean, forceKill: boolean, port: number}} Parsed arguments
 */
function parseArgv() {
  if (process.argv.length < 2) {
    perr(`Expected min. 2 args but got ${process.argv.length}`);
  }

  let args = process.argv.slice(2);
  let argv = {
    retry: false,
    forceKill: false,
    port: 3443,
  };

  const VALID_ARGS = ["--port", "-p", "--retry-port", "-r", "--kill-port", "-k", "--usage", "-u", "--help", "-h"];

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
      if (isNaN(argv.port) || argv.port < 1 || argv.port > 65535) {
        perr(`Invalid port number: \x1b[2;96m\`${argv.port}\`\x1b[0m`);
      }
    } else if (["--retry-port", "-r"].includes(arg)) {
      if (argv.forceKill) {
        perr("Cannot use \x1b[96m--kill-port\x1b[0m with \x1b[96m--retry-port\x1b[0m");
      }
      argv.retry = true;
    } else if (["--kill-port", "-k"].includes(arg)) {
      if (argv.retry) {
        perr("Cannot use \x1b[96m--kill-port\x1b[0m with \x1b[96m--retry-port\x1b[0m");
      }
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

    if (ukey in req_keys) {
      logger.info(`Loaded env var: \`${ukey}=${value}\``);
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
                `All methods failed - lsof: ${lsofError.message}, fuser: ${fuserError.message}, netstat: ${netstatError.message}, ss: ${ssError.message}`
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

export { Logger, checkUserExists, parseArgv, parseDotEnv, checkFilesExist, getUserData, killPort };
