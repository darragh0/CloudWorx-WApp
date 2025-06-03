/**
 * @file util.js - Utility functions for server-side operations.
 * @author darragh0
 */

import dotenv from "dotenv";
import fs from "fs";
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
   * @param {number} [flushThreshold=1000] No. of messages before flushing output (for files)
   * @param {number} [rotateAtBytes=5 * 1024 * 1024] Rotate log file at this size (in bytes)
   * @returns {Logger}
   */
  constructor(name, fmtParams = {}, flushThreshold = 1000, rotateAtBytes = 5 * 1024 * 1024) {
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
  }

  _fmtFactory() {
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
    if (!this._fmtAll) {
      this._fmtFactory();
    }

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
   * @private
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
  link(logger) {
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
  try {
    logger.debug(`Sending get-users request to API [GET \`${endpoint}\`]`);
    const response = await fetch(endpoint);

    if (!response.ok) {
      logger.err(`Failed to fetch users from API: ${response.status}`);
      return false;
    }

    const data = await response.json();
    logger.trace(`Received response:\n\`${JSON.stringify(data, null, 2)}\``);

    if (!data.users || !Array.isArray(data.users)) {
      logger.err(`Invalid response format from users API: ${JSON.stringify(data)}`);
      return false;
    }

    if (email) {
      return data.users.some((user) => user.username === username || user.email === email);
    }
    return data.users.some((user) => user.username === username);
  } catch (error) {
    logger.err(`Error checking user existence: ${error.message}`);
    return false;
  }
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

export { Logger, checkUserExists, parseDotEnv, checkFilesExist };
