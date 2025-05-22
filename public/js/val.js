const MAX_LEN = 255;

const USER_RE = /^[a-zA-Z0-9_-]+$/;
const PW_RE = [
  {
    regex: /.{12,}/,
    message: "Password must be at least 12 characters long",
  },
  {
    regex: /[A-Z]/,
    message: "Password must include at least one uppercase letter",
  },
  {
    regex: /[a-z]/,
    message: "Password must include at least one lowercase letter",
  },
  { regex: /[0-9]/, message: "Password must include at least one number" },
  {
    regex: /[^A-Za-z0-9]/,
    message: "Password must include at least one special character",
  },
];

/**
 * Validate password based on defined checks.
 * @see {@link PW_RE}
 *
 * @param {string} password
 * @returns { valid: boolean, message: string }
 */
function valPw(password) {
  if (!password) {
    return { valid: false, message: "Please enter a password" };
  }

  if (password.length > MAX_LEN) {
    return {
      valid: false,
      message: "Password must be less than 256 characters",
    };
  }

  for (const check of PW_RE) {
    if (!check.regex.test(password)) {
      return { valid: false, message: check.message };
    }
  }

  return { valid: true };
}

/**
 * Validate username based on defined checks.
 * @see {@link USER_RE}
 *
 * @param {string} username
 * @returns {valid: boolean, message: string}
 */
function valUsername(username) {
  if (!username) {
    return { valid: false, message: "Please enter a username" };
  }

  if (username.length > MAX_LEN) {
    return {
      valid: false,
      message: "Username must be less than 255 characters",
    };
  }

  // Check for alphanumeric, hyphen, and underscore characters only
  if (!USER_RE.test(username)) {
    return {
      valid: false,
      message:
        "Username can only contain letters, numbers, hyphens, and underscores",
    };
  }

  return { valid: true };
}

export { valPw, valUsername };
