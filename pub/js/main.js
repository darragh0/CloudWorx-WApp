/**
 * @file main.js — Common main JS file for web app.
 * @author darragh0
 */

import { fromId, queryAll, regPwToggle, onClick, onKeydown } from "./util.js";
import { valPw, valUsername, valEmail } from "./val.js";

/**
 * Open the given modal.
 *
 * @param {HTMLElement} modal
 */
function openModal(modal) {
  modal.classList.add("modal--active");
  modal.querySelector("input").focus();
}

/**
 * Close the given modal.
 *
 * @param {HTMLElement} modal
 */
function closeModal(modal) {
  modal.classList.remove("modal--active");
}

/**
 * Show a success message and redirect after a delay.
 *
 * @param {HTMLElement} submitBtn
 * @param {HTMLFormElement} form
 * @param {HTMLElement} modal
 */
function showSuccess(submitBtn, form, modal) {
  const prevMsg = submitBtn.innerHTML;
  const successMsg = "Success <i class='fa-solid fa-check'></i>";
  submitBtn.classList.add("form__submit--success");
  submitBtn.innerHTML = successMsg;

  // Remove success msg after 2s, close modal, and redirect to files page
  setTimeout(() => {
    submitBtn.classList.remove("form__submit--success");
    submitBtn.innerHTML = prevMsg;
    form.reset();
    closeModal(modal);
    window.location.href = "/files";
  }, 2000);
}

/**
 * Show an error message for a specific form field.
 *
 * @param {string} elementId
 * @param {string} message
 * @param {boolean} centered (default: false)
 * @returns {boolean}
 */
function showErr(elementId, message, centered = false) {
  const errorElement = fromId(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("form__error--visible");
    if (centered) {
      errorElement.style.margin = "auto";
    }
    return false;
  }
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  // Update navigation based on authentication status
  const isAuthenticated = localStorage.getItem("auth") === "true";
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
    onClick(dmToggle, () => {
      if (body.classList.contains("dark-mode")) {
        disableDarkMode();
      } else {
        enableDarkMode();
      }
    });
  }

  /* ============================= Password & Username ============================= */

  const pwToggles = document.querySelectorAll(".form__password-toggle");
  pwToggles.forEach((toggle) => regPwToggle(toggle));

  // Helper function to clear all errors
  const clearErrs = (formElement) => {
    const errorElements = formElement.querySelectorAll(".form__error");
    errorElements.forEach((element) => {
      element.textContent = "";
      element.classList.remove("form__error--visible");
    });
  };

  // Modal functionality
  const signupModal = fromId("signup-modal");
  const signinModal = fromId("signin-modal");
  const pekModal = fromId("pek-modal");
  const navGetStarted = fromId("nav-get-started");
  const heroGetStarted = fromId("hero-get-started");
  const signInLink = fromId("sign-in-link");
  const showSignin = fromId("show-signin");
  const showSignup = fromId("show-signup");
  const closeButtons = queryAll(".modal__close");

  // Close all modals
  const closeAllModals = () => {
    signupModal.classList.remove("modal--active");
    signinModal.classList.remove("modal--active");
    pekModal.classList.remove("modal--active");
  };

  const regModal = (el, modal) => {
    if (el) {
      onClick(el, () => {
        closeAllModals();
        openModal(modal);
      });
    }
  };

  // Only register click handlers for "Get started" buttons if not authenticated
  if (localStorage.getItem("auth") !== "true") {
    regModal(navGetStarted, signupModal);
    regModal(heroGetStarted, signupModal);
  }

  regModal(signInLink, signinModal);
  regModal(showSignin, signinModal);
  regModal(showSignup, signupModal);

  // Note: files page has own close button logic
  if (window.location.pathname !== "/files") {
    closeButtons.forEach((button) => {
      onClick(button, () => closeAllModals());
    });

    // Close modals when clicking outside / when press Esc
    onKeydown(document, "Escape", () => closeAllModals());
    onClick(window, (e) => {
      if (e.target === signupModal) {
        closeModal(signupModal);
      }
      if (e.target === signinModal) {
        closeModal(signinModal);
      }
    });
  }
  // Update navigation based on auth status
  function updateNavigation(isAuthenticated) {
    const navCenter = document.querySelector(".nav__center");
    const navRight = document.querySelector(".nav__right");
    const signInLink = fromId("sign-in-link");
    const navGetStarted = fromId("nav-get-started");
    const heroGetStarted = fromId("hero-get-started");
    const isHomePage =
      window.location.pathname === "/" || window.location.pathname === "/index";

    if (isAuthenticated) {
      // Add Files link if not already present
      const existingFilesLink =
        document.querySelector(".nav__link.files-link") ||
        document.querySelector('.nav__center a[href$="/files"]');

      if (!existingFilesLink) {
        const filesLink = document.createElement("a");
        filesLink.href = "/files";
        filesLink.className = "nav__link files-link";
        filesLink.textContent = "Files";

        // Mark as active if we're on the files page
        if (window.location.pathname.endsWith("files")) {
          filesLink.classList.add("nav__link--active");
        }

        navCenter.appendChild(filesLink);
      }

      // Hide Sign In link
      if (signInLink) {
        signInLink.style.display = "none";
      }

      // Update navigation "Get started" button based on page
      if (navGetStarted) {
        navGetStarted.textContent = "Sign out";
        navGetStarted.id = "sign-out-btn";
        onClick(navGetStarted, (e) => {
          e.preventDefault();
          localStorage.removeItem("auth");
          const isFilesPage = window.location.pathname.endsWith("files");
          const is404Page = window.location.pathname.endsWith("404");
          console.log(is404Page);

          if (isFilesPage || is404Page) {
            window.location.href = "/";
          } else {
            window.location.reload();
          }
        });
      }

      // Update hero "Get started" button on home page
      if (heroGetStarted && isHomePage) {
        heroGetStarted.textContent = "See files ";
        heroGetStarted.innerHTML =
          "See files &nbsp;&nbsp;<i class='fa-solid fa-arrow-right'></i>&nbsp;";
        heroGetStarted.id = "hero-see-files";
        // Remove existing event listeners
        heroGetStarted.replaceWith(heroGetStarted.cloneNode(true));
        // Add new event listener
        onClick(fromId("hero-see-files"), (e) => {
          e.preventDefault();
          window.location.href = "/files";
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

      // Reset navigation button
      const modifiedBtn = fromId("sign-out-btn") || fromId("nav-see-files");
      if (modifiedBtn) {
        modifiedBtn.textContent = "Get started";
        modifiedBtn.id = "nav-get-started";

        // Reattach event listeners for Get Started
        modifiedBtn.removeEventListener("click", () => {});
        onClick(modifiedBtn, (e) => {
          e.preventDefault();
          closeAllModals();
          openModal(signupModal);
        });
      }

      // Reset hero button on home page
      const modifiedHeroBtn = fromId("hero-see-files");
      if (modifiedHeroBtn && isHomePage) {
        modifiedHeroBtn.innerHTML =
          "Get Started &nbsp;&nbsp;<i class='fa-solid fa-arrow-right'></i>&nbsp;";
        modifiedHeroBtn.id = "hero-get-started";
        // Remove existing event listeners
        modifiedHeroBtn.replaceWith(modifiedHeroBtn.cloneNode(true));
        // Add new event listener
        onClick(fromId("hero-get-started"), (e) => {
          e.preventDefault();
          closeAllModals();
          openModal(signupModal);
        });
      }
    }
  }

  // Form handling
  const signupForm = fromId("signup-form");
  const signinForm = fromId("signin-form");
  const pekForm = fromId("pek-form");

  // Store signup data to use after PEK is entered
  let signupData = null;

  // Handle sign-up form submission
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrs(signupForm);

      const username = fromId("signup-username").value;
      const email = fromId("signup-email").value;
      const password = fromId("signup-password").value;
      const confirmPassword = fromId("signup-confirm-password").value;

      let isValid = true;

      // Username validation
      const usernameResult = valUsername(username);
      if (!usernameResult.valid) {
        isValid = showErr("signup-username-error", usernameResult.message);
      }

      // Email validation
      const emailResult = valEmail(email);
      if (!emailResult.valid) {
        isValid = showErr("signup-email-error", emailResult.message);
      }

      // Password validation
      const passwordResult = valPw(password);
      if (!passwordResult.valid) {
        isValid = showErr("signup-password-error", passwordResult.message);
      }

      // Confirm password validation
      if (!confirmPassword) {
        isValid = showErr(
          "signup-confirm-password-error",
          "Please confirm your password"
        );
      } else if (password !== confirmPassword) {
        isValid = showErr(
          "signup-confirm-password-error",
          "Passwords do not match"
        );
      }

      if (!isValid) {
        return;
      }

      const form = e.target;
      const formData = new FormData(form);
      signupData = Object.fromEntries(formData.entries());
      const captchaResponse = signupData["g-recaptcha-response"];

      if (!captchaResponse) {
        isValid = showErr(
          "recaptcha-error",
          "Please complete the reCAPTCHA verification",
          true
        );
        return;
      }

      // Store signup data and show PEK modal
      closeModal(signupModal);
      openModal(pekModal);
    });
  }

  // Handle PEK form submission
  if (pekForm) {
    pekForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrs(pekForm);

      const pekPassword = fromId("pek-password").value;
      const pekConfirmPassword = fromId("pek-confirm-password").value;

      let isValid = true;

      // PEK password validation
      const passwordResult = valPw(pekPassword);
      if (!passwordResult.valid) {
        isValid = showErr("pek-password-error", passwordResult.message);
      }

      // Confirm PEK validation
      if (!pekConfirmPassword) {
        isValid = showErr(
          "pek-confirm-password-error",
          "Please confirm your password"
        );
      } else if (pekPassword !== pekConfirmPassword) {
        isValid = showErr(
          "pek-confirm-password-error",
          "Passwords do not match"
        );
      }

      if (!isValid || !signupData) {
        return;
      }

      // Add PEK to signup data
      signupData["signup-pek-password"] = pekPassword;

      // Send complete signup data to backend
      const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupData),
      });

      if (!res.ok) {
        const errorMsg = await res.text();
        // Check if it's a reCAPTCHA error
        if (errorMsg.includes("reCAPTCHA")) {
          // Go back to signup modal to show the error
          closeModal(pekModal);
          openModal(signupModal);
          showErr("recaptcha-error", errorMsg);
          // Reset reCAPTCHA
          if (window.grecaptcha) {
            grecaptcha.reset();
          }
        } else {
          // Go back to signup modal to show the error
          closeModal(pekModal);
          openModal(signupModal);
          showErr("signup-username-error", errorMsg);
        }
        return;
      }

      // For demo purposes, set the user as authenticated
      localStorage.setItem("auth", "true");
      updateNavigation(true);
      showSuccess(fromId("pek-submit"), pekForm, pekModal);

      // Clear stored signup data after successful registration
      signupData = null;
    });
  }

  // Handle sign-in form submission
  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrs(signinForm);

      const username = fromId("signin-username").value;
      const password = fromId("signin-password").value;

      let isValid = true;

      // Username validation
      const usernameResult = valUsername(username);
      if (!usernameResult.valid) {
        isValid = showErr("signin-username-error", usernameResult.message);
      }

      // Password validation - only check if it's empty for login
      if (!password) {
        isValid = showErr(
          "signin-password-error",
          "Please enter your password"
        );
      }

      if (!isValid) {
        return;
      }

      const form = e.target;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorMsg = await res.text();
        showErr("signin-password-error", errorMsg);
        return;
      }

      // TODO: Handle sign-in response (success or error)

      // For demo purposes, set the user as authenticated
      localStorage.setItem("auth", "true");
      updateNavigation(true);
      showSuccess(fromId("sign-in-submit"), signinForm, signinModal);
    });
  }
});
