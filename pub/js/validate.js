/**
 * @file validate.js – Client-side validation utils for form inputs.
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
 * Validate username against defined regex.
 *
 * @param {string} username
 * @returns {string} Error message or empty string if valid
 *
 * @see _REGEX.username
 * @see _MAX_LEN
 */
function valUsername(username) {
  if (!username) {
    return "Please enter a username";
  }

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
  if (!email) {
    return "Please enter an email address";
  }

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
  if (!pw) {
    return `${key} is required`;
  }

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

  if (errmsg) errmsg = errmsg.replace(/,(?!.*,)/, " &");

  return errmsg;
}

export { valUsername, valEmail, valPassword };
