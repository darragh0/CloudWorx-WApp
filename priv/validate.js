/**
 * @file validate.js – Server-side validation utils for POST fields.
 * @author darragh0
 */

/** @private */
const _MAX_LEN = 255;

/** @private */
const _MIN_PW_LEN = 12;

/** @private */
const _REGEX = {
  username: {
    pattern: /^[a-zA-Z0-9_-]+$/,
    msg: "Username can only contain letters, numbers, hyphens, & underscores",
  },
  email: {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    msg: "Invalid email format",
  },
  password: [
    {
      pattern: /[A-Z]/,
      msg: "one uppercase letter",
    },
    {
      pattern: /[a-z]/,
      msg: "one lowercase letter",
    },
    { pattern: /[0-9]/, msg: "one number" },
    {
      pattern: /[^A-Za-z0-9]/,
      msg: "one special character",
    },
  ],
};

/**
 * Check fields exist, are given types, & non-empty.
 *
 * @param {RequiredFields} fields Map of fields to validate (key: [value, type])
 * @returns {string} Error message or empty string if valid
 */
function valReqFields(fields) {
  let missing = [];
  let nonString = [];
  let nonUint = [];
  let empty = [];

  for (const [key, [value, vtype]] of Object.entries(fields)) {
    if (!value) {
      missing.push(`\`${key}\``);
    } else if (typeof value !== vtype) {
      if (vtype === "number" && !(Number.isInteger(value) || value <= 0)) {
        nonUint.push(`\`${key}\``);
      }
      nonString.push(`\`${key}\``);
    } else if (value.trim() === "") {
      empty.push(`\`${key}\``);
    }
  }

  let errArr = [];
  if (missing.length > 0) {
    errArr.push(`missing field(s): ${missing.join(", ")}`);
  }

  if (nonString.length > 0) {
    errArr.push(`field(s) must be a string: ${nonString.join(", ")}`);
  }

  if (nonUint.length > 0) {
    errArr.push(`field(s) must be a positive integer: ${nonUint.join(", ")}`);
  }

  if (empty.length > 0) {
    errArr.push(`field(s) must be non-empty: ${empty.join(", ")}`);
  }

  if (errArr.length > 0) {
    let errmsg = errArr.join("; ");
    return errmsg.charAt(0).toUpperCase() + errmsg.slice(1);
  }

  return "";
}

/**
 * Validate username against defined regex.
 *
 * @param {string} username
 * @returns {string} Error message or empty string if valid
 *
 * @see _REGEX.username
 * @see _MAX_LEN
 */
function valUsername(username) {
  if (username.length > _MAX_LEN) {
    return `Username must be < ${_MAX_LEN} characters`;
  }

  if (!_REGEX.username.pattern.test(username)) {
    return _REGEX.username.msg;
  }

  return "";
}

/**
 * Validate email against defined regex.
 *
 * @param {string} email
 * @returns {string} Error message or empty string if valid
 *
 * @see _REGEX.email
 * @see _MAX_LEN
 */
function valEmail(email) {
  if (email.length > _MAX_LEN) {
    return `Email must be < ${_MAX_LEN} characters`;
  }

  if (!_REGEX.email.pattern.test(email)) {
    return _REGEX.email.msg;
  }

  return "";
}

/**
 * Validate password against defined criteria.
 *
 * @param {string} pw
 * @param {PasswordKey} [key="Password"] Key for error messages
 * @returns {string} Error message or empty string if valid
 *
 * @see _REGEX.password
 * @see _MIN_PW_LEN
 * @see _MAX_LEN
 */
function valPassword(pw, key = "Password") {
  if (pw.length < _MIN_PW_LEN) {
    return `${key} must be >= ${_MIN_PW_LEN} characters`;
  }

  if (pw.length > _MAX_LEN) {
    return `${key} must be < ${_MAX_LEN} characters`;
  }

  let errmsg = "";
  for (const _re of _REGEX.password) {
    if (!_re.pattern.test(pw)) {
      if (!errmsg) {
        errmsg += `${key} must contain at least ${_re.msg}`;
      } else {
        errmsg += `, ${_re.msg}`;
      }
    }
  }

  return errmsg;
}

/**
 * Verify user's reCAPTCHA response.
 *
 * @param {string} response reCAPTCHA response token (from client)
 * @param {string} secretKey reCAPTCHA secret key (from `.env`)
 * @returns {Promise<string>} Error message or empty string if valid
 */
async function verifyRecaptcha(response, secretKey) {
  try {
    const endpoint = "https://www.google.com/recaptcha/api/siteverify";
    const result = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${secretKey}&response=${response}`,
    });

    const data = await result.json();

    if (data.success) {
      return "";
    } else {
      return `reCAPTCHA verification failed: ${data["error-codes"]}.`;
    }
  } catch (error) {
    return `reCAPTCHA verification failed: ${error}`;
  }
}

export { valReqFields, valUsername, valEmail, valPassword, verifyRecaptcha };
