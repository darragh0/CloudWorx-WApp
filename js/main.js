/**
 * @param {*} id
 * @returns
 */
function fromId(id) {
  return document.getElementById(id);
}

function query(selector) {
  return document.querySelector(selector);
}

function queryAll(selector) {
  return document.querySelectorAll(selector);
}

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

document.addEventListener("DOMContentLoaded", () => {
  // Check authentication status
  const isAuthenticated = localStorage.getItem("authenticated") === "true";

  // Update navigation based on authentication status
  updateNavigation(isAuthenticated);

  /* ============================= Dark Mode ============================= */

  const dmToggle = fromId("dark-mode-toggle");
  const body = document.body;
  const icon = dmToggle ? dmToggle.querySelector("i") : null;

  const enableDarkMode = () => {
    body.classList.add("dark-mode");
    if (icon) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    }
    localStorage.setItem("darkMode", "enabled");
  };

  const disableDarkMode = () => {
    body.classList.remove("dark-mode");
    if (icon) {
      icon.classList.remove("fa-sun");
      icon.classList.add("fa-moon");
    }
    localStorage.setItem("darkMode", "disabled");
  };

  // Check for saved dark mode preference
  if (localStorage.getItem("darkMode") === "enabled") {
    enableDarkMode();
  } else {
    disableDarkMode(); // Ensure correct icon is set on initial load if not dark mode
  }

  if (dmToggle) {
    dmToggle.addEventListener("click", () => {
      if (body.classList.contains("dark-mode")) {
        disableDarkMode();
      } else {
        enableDarkMode();
      }
    });
  }

  /* ============================= Password & Username ============================= */

  const pwToggles = document.querySelectorAll(".form__password-toggle");

  pwToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const targetId = toggle.getAttribute("data-target");
      const passwordInput = fromId(targetId);

      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggle.classList.remove("fa-eye");
        toggle.classList.add("fa-eye-slash");
      } else {
        passwordInput.type = "password";
        toggle.classList.remove("fa-eye-slash");
        toggle.classList.add("fa-eye");
      }
    });
  });

  // Helper function to show error messages
  const showError = (elementId, message) => {
    const errorElement = fromId(elementId);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add("form__error--visible");
      return false;
    }
    return true;
  };

  /**
   * Validate username based on defined checks.
   * @see {@link USER_RE}
   *
   * @param {string} username
   * @returns {valid: boolean, message: string}
   */
  const validateUsername = (username) => {
    if (!username) {
      return { valid: false, message: "Please enter a username" };
    }

    if (username.length > 254) {
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
  };

  /**
   * Validate password based on defined checks.
   * @see {@link PW_RE}
   *
   * @param {string} password
   * @returns { valid: boolean, message: string }
   */
  const validatePassword = (password) => {
    if (!password) {
      return { valid: false, message: "Please enter a password" };
    }

    for (const check of PW_RE) {
      if (!check.regex.test(password)) {
        return { valid: false, message: check.message };
      }
    }

    return { valid: true };
  };

  // Helper function to clear all errors
  const clearErrors = (formElement) => {
    const errorElements = formElement.querySelectorAll(".form__error");
    errorElements.forEach((element) => {
      element.textContent = "";
      element.classList.remove("form__error--visible");
    });
  };

  // Modal functionality
  const signupModal = fromId("signup-modal");
  const signinModal = fromId("signin-modal");
  const navGetStarted = fromId("nav-get-started");
  const heroGetStarted = fromId("hero-get-started");
  const signInLink = fromId("sign-in-link");
  const showSignin = fromId("show-signin");
  const showSignup = fromId("show-signup");
  const closeButtons = queryAll(".modal__close");

  // Functions to open/close modals
  const openModal = (modal) => modal.classList.add("modal--active");
  const closeModal = (modal) => modal.classList.remove("modal--active");

  // Close all modals
  const closeAllModals = () => {
    signupModal.classList.remove("modal--active");
    signinModal.classList.remove("modal--active");
  };

  const regModal = (el, modal) => {
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeAllModals();
        openModal(modal);
      });
    }
  };

  regModal(navGetStarted, signupModal);
  regModal(heroGetStarted, signupModal);
  regModal(signInLink, signinModal);
  regModal(showSignin, signinModal);
  regModal(showSignup, signupModal);

  // Close modals with close button
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      closeAllModals();
    });
  });

  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === signupModal) {
      closeModal(signupModal);
    }
    if (e.target === signinModal) {
      closeModal(signinModal);
    }
  });

  // Close modals with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });

  // Function to update navigation based on authentication status
  function updateNavigation(isAuthenticated) {
    const navCenter = document.querySelector(".nav__center");
    const navRight = document.querySelector(".nav__right");
    const signInLink = fromId("sign-in-link");
    const navGetStarted = fromId("nav-get-started");

    // Determine correct path to files.html based on current location
    let filesPath = "html/files.html";
    // If we're in a page within the html directory, adjust the path
    if (window.location.pathname.includes("/html/")) {
      filesPath = "files.html";
    }

    if (isAuthenticated) {
      // Add Files link if not already present
      const existingFilesLink =
        document.querySelector(".nav__link.files-link") ||
        document.querySelector('.nav__center a[href$="files.html"]');

      if (!existingFilesLink) {
        const filesLink = document.createElement("a");
        filesLink.href = filesPath;
        filesLink.className = "nav__link files-link";
        filesLink.textContent = "Files";

        // Mark as active if we're on the files page
        if (window.location.pathname.endsWith("files.html")) {
          filesLink.classList.add("nav__link--active");
        }

        navCenter.appendChild(filesLink);
      }

      // Replace Sign In link and Get Started button with Sign Out button
      if (signInLink) {
        signInLink.style.display = "none";
      }

      if (navGetStarted) {
        navGetStarted.textContent = "Sign out";
        navGetStarted.id = "sign-out-btn";
        navGetStarted.addEventListener("click", (e) => {
          e.preventDefault();
          localStorage.removeItem("authenticated");

          // Redirect to home page with correct path
          if (window.location.pathname.includes("/html/")) {
            window.location.href = "../index.html";
          } else {
            window.location.reload();
          }
        });
      }
    } else {
      // Remove Files link if present
      const filesLink = document.querySelector(".nav__link.files-link");
      if (filesLink) {
        filesLink.remove();
      }

      // Restore Sign In link and Get Started button
      if (signInLink) {
        signInLink.style.display = "";
      }

      if (fromId("sign-out-btn")) {
        const signOutBtn = fromId("sign-out-btn");
        signOutBtn.textContent = "Get started";
        signOutBtn.id = "nav-get-started";

        // Reattach event listeners for Get Started
        signOutBtn.removeEventListener("click", () => {});
        signOutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          closeAllModals();
          openModal(signupModal);
        });
      }
    }
  }

  function showSuccess(submitBtn, form, modal) {
    const prevMsg = submitBtn.innerHTML;
    const successMsg = "Success <i class='fa-solid fa-check'></i>";
    submitBtn.classList.add("form__submit--success");
    submitBtn.innerHTML = successMsg;

    // Determine the correct path to files.html based on current location
    let filesPath = "html/files.html";
    if (window.location.pathname.includes("/html/")) {
      filesPath = "files.html";
    }

    // Remove success msg after 2s, close modal, and redirect to files page
    setTimeout(() => {
      submitBtn.classList.remove("form__submit--success");
      submitBtn.innerHTML = prevMsg;
      form.reset();
      closeModal(modal);
      
      // Navigate to files page after successful login/signup
      window.location.href = filesPath;
    }, 2000);
  }

  // Form handling
  const signupForm = fromId("signup-form");
  const signinForm = fromId("signin-form");

  // Handle sign-up form submission
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(signupForm);

      const username = fromId("signup-username").value;
      const password = fromId("signup-password").value;
      const confirmPassword = fromId("signup-confirm-password").value;

      let isValid = true;

      // Username validation
      const usernameResult = validateUsername(username);
      if (!usernameResult.valid) {
        isValid = showError("signup-username-error", usernameResult.message);
      }

      // Password validation
      const passwordResult = validatePassword(password);
      if (!passwordResult.valid) {
        isValid = showError("signup-password-error", passwordResult.message);
      }

      // Confirm password validation
      if (!confirmPassword) {
        isValid = showError(
          "signup-confirm-password-error",
          "Please confirm your password"
        );
      } else if (password !== confirmPassword) {
        isValid = showError(
          "signup-confirm-password-error",
          "Passwords do not match"
        );
      }

      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        isValid = showError(
          "signup-username-error",
          usernameValidation.message
        );
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        isValid = showError(
          "signup-password-error",
          passwordValidation.message
        );
      }

      if (!isValid) {
        return;
      }

      // TODO: Send register request to API
      // TODO: Handle register response (success or error)

      // For demo purposes, set the user as authenticated
      localStorage.setItem("authenticated", "true");

      // Update the navigation
      updateNavigation(true);

      showSuccess(fromId("sign-up-submit"), signupForm, signupModal);
    });
  }

  // Handle sign-in form submission
  if (signinForm) {
    signinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(signinForm);

      const username = document.getElementById("signin-username").value;
      const password = document.getElementById("signin-password").value;

      let isValid = true;

      // Username validation
      const usernameResult = validateUsername(username);
      if (!usernameResult.valid) {
        isValid = showError("signin-username-error", usernameResult.message);
      }

      // Password validation - only check if it's empty for login
      if (!password) {
        isValid = showError(
          "signin-password-error",
          "Please enter your password"
        );
      }

      if (!isValid) {
        return;
      }

      // TODO: Send sign-in request to API
      // TODO: Handle sign-in response (success or error)

      // For demo purposes, set the user as authenticated
      localStorage.setItem("authenticated", "true");

      // Update the navigation
      updateNavigation(true);

      showSuccess(fromId("sign-in-submit"), signinForm, signinModal);
    });
  }
});
