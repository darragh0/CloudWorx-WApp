/**
 * @file util.js - General utility functions.
 * @author darragh0
 */

/**
 * Shorthand for `document.getElementById()`.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
function fromId(id) {
  return document.getElementById(id);
}

/**
 * Shorthand for `document.querySelector()`.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 */
function query(selector) {
  return document.querySelector(selector);
}

/**
 * Shorthand for `document.querySelectorAll()`.
 *
 * @param {string} selector
 * @returns {NodeList}
 */
function queryAll(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Register a password toggle button.
 *
 * @param {HTMLElement} toggle Toggle button
 */
function regPwToggle(toggle) {
  console.log(`Registering password toggle for element with data-target: ${toggle.getAttribute("data-target")}`);

  toggle.addEventListener("click", () => {
    console.log(`Password toggle clicked for: ${toggle.getAttribute("data-target")}`);
    const targetId = toggle.getAttribute("data-target");
    const passwordInput = fromId(targetId);

    if (!passwordInput) {
      console.error(`Password input with id "${targetId}" not found`);
      return;
    }

    console.log(`Found password input: ${passwordInput.id}, current type: ${passwordInput.type}`);

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggle.classList.remove("fa-eye");
      toggle.classList.add("fa-eye-slash");
      console.log(`Changed to text type and updated icon to fa-eye-slash`);
    } else {
      passwordInput.type = "password";
      toggle.classList.remove("fa-eye-slash");
      toggle.classList.add("fa-eye");
      console.log(`Changed to password type and updated icon to fa-eye`);
    }
  });
}

/**
 * Call given function when element is clicked.
 *
 * @param {HTMLElement} el Element to listen on
 * @param {EventListenerCallback} cb Callback function
 */
function onClick(el, cb) {
  el.addEventListener("click", (e) => {
    cb(e);
  });
}

/**
 * Call given function when given key is pressed.
 *
 * @param {HTMLElement} el Element to listen on
 * @param {string} key Key to listen for
 * @param {EventListenerCallback} cb Callback function
 */
function onKeydown(el, key, cb) {
  el.addEventListener("keydown", (e) => {
    if (e.key === key) {
      cb(e);
    }
  });
}

export { fromId, query, queryAll, regPwToggle, onClick, onKeydown };
