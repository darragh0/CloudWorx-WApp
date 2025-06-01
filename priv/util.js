/**
 * @file util.js - Utility functions for server-side operations.
 * @author darragh0
 */

/**
 * Check API fields are valid.
 *
 * @param {*} fields
 * @return {string} Error message
 */
function valFieldFmt(fields) {
  let errors = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!value) {
      errors.push(`Field \`${key}\` is required`);
    } else if (typeof value !== "string") {
      errors.push(`Field \`${key}\` must be a string`);
    } else if (value.trim() === "") {
      errors.push(`Field \`${key}\` must be non-empty`);
    }
  }

  let errstr = "";
  if (errors.length > 0) {
    errstr += "Invalid request:\n";
    errstr += errors.map((err) => `- ${err}`).join("\n");
  }

  return errstr;
}

class Logger {
  constructor(name) {
    this.name = name;
  }

  _ts() {
    return new Date()
      .toISOString()
      .replace("T", " ")
      .replace("Z", "")
      .split(".")[0];
  }

  _log(msg, ind, lvl, clr) {
    const pre = " ".repeat(ind);
    console.log(
      `${pre}\x1b[2;94m[${this._ts()}]\x1b[0m \x1b[${clr}m[${lvl}]\x1b[0m :: ${msg}`
    );
  }

  debug(msg, ind = 0) {
    this._log(msg, ind, "DEB", "90");
  }

  info(msg, ind = 0) {
    this._log(msg, ind, "INF", "96");
  }

  warn(msg, ind = 0) {
    this._log(msg, ind, "WAR", "93");
  }

  err(msg, ind = 0) {
    this._log(msg, ind, "ERR", "91");
  }

  crit(msg, ind = 0) {
    this._log(msg, ind, "CRI", "1;91");
    process.exit(1);
  }
}

export { valFieldFmt, Logger };
