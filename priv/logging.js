import fs from "fs";
import path from "path";

/**
 * Format a template string with values.
 *
 * @param {TStr} tStr Template string with placeholders like {key}
 * @param {TStrValues} values Keys to replace with their values
 * @returns {string} Formatted string with values replaced
 */
export function fmtTstr(tStr, values) {
  return tStr.replace(/{(\w+)}/g, (_, key) => values[key] ?? "");
}

/** Logger class */
class Logger {
  /** @type {LoggerMap} */
  static _loggers = new Map();

  /** @type {LogLevelMap} */
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
   * NOTE: Assumes you are a good dev (like darragh0 <3) and won't give invalid parameters.
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
      fmtParams.out = "console";
    } else if (fmtParams.out !== "console") {
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

    if (!("colorBacktickedItems" in fmtParams)) {
      fmtParams.colorBacktickedItems = fmtParams.out === "console" ? true : false;
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
   * Colorize backticked items in a message.
   *
   * @param {string} msg
   * @returns {string} Message with colored items
   */
  _colorBackticked(msg) {
    const clr = {
      reset: "\x1b[0m",
      eq: "\x1b[0m",
      num: "\x1b[93m",
      arg: "\x1b[96m",
      str: "\x1b[92m",
      json: "\x1b[90m",
      other: "\x1b[94m",
      upper: "\x1b[31m",
    };

    let isJson = msg.includes("`{") && msg.includes("}`") ? true : false;
    let json = "";

    if (isJson) {
      const jsonStart = msg.indexOf("`{");
      json = msg.slice(jsonStart + 2, msg.indexOf("}`"));
      msg = msg.slice(0, jsonStart);
    }

    msg = msg.replace(/`([^`]+)`/g, (_match, content) => {
      let result = "";
      let i = 0;

      while (i < content.length) {
        if (content[i] === "=") {
          result += clr.reset + clr.eq + "=";
          i++;
          continue;
        }

        // Check for whitespace
        if (/\s/.test(content[i])) {
          result += content[i];
          i++;
          continue;
        }

        let token = "";
        while (i < content.length && !/[\s=]/.test(content[i])) {
          token += content[i];
          i++;
        }
        // Apply coloring rules to token
        if (/^\d+(\.\d+)?$/.test(token)) {
          // Number - yellow
          result += clr.reset + clr.num + token;
        } else if (/^".*"$/.test(token)) {
          // String with double quotes - keep white/default
          result += clr.reset + clr.str + token;
        } else if (/^--/.test(token)) {
          // Flag starting with -- - cyan
          result += clr.reset + clr.arg + token;
        } else if (/^[A-Z_][A-Z0-9_]*$/.test(token)) {
          // UPPERCASE_THINGS - red
          result += clr.reset + clr.upper + token;
        } else {
          result += clr.reset + clr.other + token;
        }
      }
      return result + clr.reset;
    });

    return isJson ? msg + clr.reset + clr.json + "{" + json + "}" + clr.reset : msg;
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
      } else if (this.fmtParams.dateFmt === "timeonly") {
        this._fmtDate = () =>
          fmtTstr(this.fmtParams.date, {
            date: new Date().toISOString().replace("T", " ").replace("Z", "").split(".")[0].split(" ")[1],
          });
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
      this._fmtAll = (msg, _, level, color, jsonObj, __) => {
        let outMap = {
          name: null,
          date: null,
          level: null,
        };

        if (this._fmtName) outMap.name = this._fmtName();
        if (this._fmtDate) outMap.date = this._fmtDate();
        if (this._fmtLevel) outMap.level = this._fmtLevel(level, color);

        if (this.fmtParams.colorBacktickedItems) {
          msg = this._colorBackticked(msg);
        }

        outMap.message = msg;
        let json = Object.fromEntries(Object.entries(outMap).filter(([_, v]) => v !== null));

        if (jsonObj) {
          json.json = jsonObj;
        }

        return JSON.stringify(json).replace(/"(?:\\.|[^"\\])*"|\s*:\s*|\s*,\s*/g, (match) =>
          match.startsWith('"') ? match : match.trim() + " ",
        );
      };
    } else {
      this._fmtAll = (msg, ind, level, color, jsonObj, sep) => {
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

        let outStr = null;
        if (this.fmtParams.msgPre) {
          outStr = `${pre}${out}${this.fmtParams.sep}${this.fmtParams.msgPre}${this.fmtParams.sep}${msg}`;
        } else {
          outStr = `${pre}${out}${msg}`;
        }

        outStr += jsonObj ? `${sep}\`${JSON.stringify(jsonObj, null, 2)}\`` : "";
        return this.fmtParams.colorBacktickedItems ? this._colorBackticked(outStr) : outStr;
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
   * @param {Object} json Optional JSON for trace logging
   * @param {string} sep Separator between message & JSON
   * @private
   */
  _fmt(msg, ind, level, color, json, sep) {
    return this._fmtAll(msg, ind, level, color, json, sep);
  }

  /**
   * Format & log a message.
   *
   * @param {string} msg Message to log
   * @param {number} ind Indentation level (in spaces)
   * @param {string} level Log level abbreviation (e.g. "INF")
   * @param {string} color ANSI color code
   * @param {Object|null} [json=null] Optional JSON for trace logging
   * @param {string} [sep="\n"] Separator between message & JSON
   * @private
   *
   * @see Logger.fmtTstr
   */
  _log(msg, ind, level, color, json = null, sep = "\n") {
    const lvlNum = Logger._levelMap[level];

    if (lvlNum < this.level) return;

    const fmted = this._fmt(msg, ind, level, color, json, sep);
    this.msgCount++;

    if (this.fmtParams.out === "console" && lvlNum > Logger._levelMap.INF) {
      console.error(fmted);
    } else if (this.fmtParams.out === "console") {
      console.log(fmted);
    } else if (this.msgCount == this.flushThreshold) {
      this.flushToFile();
      this.msgBuf.push(fmted);
    } else {
      this.msgBuf.push(fmted);
    }

    for (const link of this.links) {
      link._log(msg, ind, level, color, json);
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
   * @param {Object|null} [json=null] Optional JSON for trace logging
   * @param {string} [sep="\n"] Separator between message & JSON
   */
  trace(msg, ind = 0, json = null, sep = "\n") {
    this._log(msg, ind, "TRA", "2;90", json, sep);
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

export { Logger };
