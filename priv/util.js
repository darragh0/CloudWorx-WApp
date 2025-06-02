/**
 * @file util.js - Utility functions for server-side operations.
 * @author darragh0
 */

/** Logger class */
class Logger {
  /** @type {Object.<string, Logger>} */
  static _loggers = new Map();

  /**
   * Get or create a named logger.
   *
   * @param {string} name
   * @returns {Logger}
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
   * @returns {Logger}
   */
  constructor(name) {
    if (Logger._loggers.has(name)) {
      throw new Error(`Logger with name "${name}" already exists`);
    }
    Logger._loggers.set(name, this);
    this.name = name;
  }

  /**
   * Return current timestamp in `YYYY-MM-DD HH:MM:SS` format.
   *
   * @returns {string}
   * @private
   */
  _ts() {
    return new Date().toISOString().replace("T", " ").replace("Z", "").split(".")[0];
  }

  /**
   * Format log message with message, level & ANSI colors.
   *
   * @param {string} msg Message to log
   * @param {number} ind Indentation level (in spaces)
   * @param {string} lvl Log level abbreviation (e.g. "INF")
   * @param {string} clr ANSI color code
   * @private
   */
  _log(msg, ind, lvl, clr) {
    const pre = " ".repeat(ind);
    console.log(`${pre}\x1b[2;94m[${this._ts()}]\x1b[0m \x1b[${clr}m[${lvl}]\x1b[0m :: ${msg}`);
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

export { Logger, checkUserExists };
