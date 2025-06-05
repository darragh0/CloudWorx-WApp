/**
 * @file main.js — Common main JS file for web app.
 * @author darragh0
 */

import { fromId, queryAll, regPwToggle, onClick, onKeydown } from "./util.js";
import { valPassword, valUsername, valEmail } from "./validate.js";

/**
 * Open the given modal.
 *
 * @param {HTMLElement} modal
 */
function openModal(modal) {
  modal.classList.add("modal--active");
  const focusableElement =
    modal.querySelector("input") || modal.querySelector("textarea") || modal.querySelector("button");
  if (focusableElement) {
    focusableElement.focus();
  }
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
  const isAuthenticated = Boolean(localStorage.getItem("uid"));
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
  const filepwModal = fromId("file-password-modal");
  const privateKeyModal = fromId("private-key-modal");
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
    filepwModal.classList.remove("modal--active");
    privateKeyModal.classList.remove("modal--active");
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
  if (!localStorage.getItem("uid")) {
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
    onClick(document, (e) => {
      // Check if click is on the modal overlay (background)
      if (e.target === signupModal) {
        closeModal(signupModal);
      }
      if (e.target === signinModal) {
        closeModal(signinModal);
      }
      if (e.target === privateKeyModal) {
        closeModal(privateKeyModal);
      }
      if (e.target === filepwModal) {
        closeModal(filepwModal);
      }
    });
  }
  // Update navigation based on auth status
  function updateNavigation(isAuthenticated) {
    const navCenter = document.querySelector(".nav__center");
    const signInLink = fromId("sign-in-link");
    const navGetStarted = fromId("nav-get-started");
    const heroGetStarted = fromId("hero-get-started");
    const isHomePage = window.location.pathname === "/" || window.location.pathname === "/index";

    if (isAuthenticated) {
      // Add Files link if not already present
      const existingFilesLink =
        document.querySelector(".nav__link.files-link") || document.querySelector('.nav__center a[href$="/files"]');

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
        navGetStarted.removeEventListener("click", () => {});
        onClick(navGetStarted, (e) => {
          closeAllModals();
          e.preventDefault();
          localStorage.removeItem("uid");
          localStorage.removeItem("token");
          const isFilesPage = window.location.pathname.endsWith("files");
          const is404Page = window.location.pathname.endsWith("404");

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
        heroGetStarted.innerHTML = "See files &nbsp;&nbsp;<i class='fa-solid fa-arrow-right'></i>&nbsp;";
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
        modifiedHeroBtn.innerHTML = "Get Started &nbsp;&nbsp;<i class='fa-solid fa-arrow-right'></i>&nbsp;";
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

  // Private key download functionality
  const privateKeyTextarea = fromId("private-key-text");
  const privateSigningKeyTextarea = fromId("private-signing-key-text");
  const downloadPrivateKeyBtn = fromId("download-private-key");
  const downloadPrivateSigningKeyBtn = fromId("download-private-signing-key");
  const copyPrivateKeyBtn = fromId("copy-private-key");
  const copyPrivateSigningKeyBtn = fromId("copy-private-signing-key");
  const continueToFilesBtn = fromId("continue-to-files");

  // Function to download a file
  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Function to copy text to clipboard
  async function copyToClipboard(text, buttonElement) {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = buttonElement.innerHTML;
      buttonElement.innerHTML = '<i class="fas fa-check"></i> Copied!';
      buttonElement.classList.add("form__submit--success");

      setTimeout(() => {
        buttonElement.innerHTML = originalText;
        buttonElement.classList.remove("form__submit--success");
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  if (downloadPrivateKeyBtn) {
    onClick(downloadPrivateKeyBtn, () => {
      const privateKey = privateKeyTextarea.value;
      if (privateKey) {
        downloadFile(privateKey, "private-decryption-key.txt");
      }
    });
  }

  if (downloadPrivateSigningKeyBtn) {
    onClick(downloadPrivateSigningKeyBtn, () => {
      const privateSigningKey = privateSigningKeyTextarea.value;
      if (privateSigningKey) {
        downloadFile(privateSigningKey, "private-signing-key.txt");
      }
    });
  }

  if (copyPrivateKeyBtn) {
    onClick(copyPrivateKeyBtn, () => {
      const privateKey = privateKeyTextarea.value;
      if (privateKey) {
        copyToClipboard(privateKey, copyPrivateKeyBtn);
      }
    });
  }

  if (copyPrivateSigningKeyBtn) {
    onClick(copyPrivateSigningKeyBtn, () => {
      const privateSigningKey = privateSigningKeyTextarea.value;
      if (privateSigningKey) {
        copyToClipboard(privateSigningKey, copyPrivateSigningKeyBtn);
      }
    });
  }

  if (continueToFilesBtn) {
    onClick(continueToFilesBtn, () => {
      window.location.href = "/files";
    });
  }

  // Function to show private key modal
  function showPrivateKeyModal(privateKey, privateSigningKey) {
    const base64PrivateKey = privateKey || "";
    const base64PrivateSigningKey = privateSigningKey || "";

    privateKeyTextarea.value = base64PrivateKey;
    privateSigningKeyTextarea.value = base64PrivateSigningKey;

    closeAllModals();
    openModal(privateKeyModal);
  }

  // Form handling
  const signupForm = fromId("signup-form");
  const signinForm = fromId("signin-form");
  const filepwForm = fromId("file-password-form");

  // Store signup data to use after file pw is entered
  let payload = null;

  /********************************************************
   * Registration Form -- Modal for username, email, ...
   ********************************************************/

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrs(signupForm);

      const uname = fromId("signup-username").value;
      const email = fromId("signup-email").value;
      const pw = fromId("signup-password").value;
      const confirmPw = fromId("signup-confirm-password").value;

      let isValid = true;

      const unameemsg = valUsername(uname);
      if (unameemsg) {
        isValid = showErr("signup-username-error", unameemsg);
      }

      const emailemsg = valEmail(email);
      if (emailemsg) {
        isValid = showErr("signup-email-error", emailemsg);
      }

      const pwemsg = valPassword(pw);
      if (pwemsg) {
        isValid = showErr("signup-password-error", pwemsg);
      }

      if (!confirmPw) {
        isValid = showErr("signup-confirm-password-error", "Please confirm your password");
      } else if (pw !== confirmPw) {
        isValid = showErr("signup-confirm-password-error", "Passwords do not match");
      }

      if (!isValid) {
        return;
      }

      payload = {
        username: uname,
        email: email,
        password: pw,
        filePassword: null,
        recaptchaResponse: grecaptcha.getResponse(),
      };

      if (!payload.recaptchaResponse) {
        isValid = showErr("recaptcha-error", "Please complete the reCAPTCHA verification", true);
        return;
      }

      closeModal(signupModal);
      openModal(filepwModal);
    });
  }

  /********************************************************
   * Registration Form -- Modal for file pw
   ********************************************************/

  if (filepwForm) {
    filepwForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrs(filepwForm);

      const filepw = fromId("file-password").value;
      const fileConfirmPw = fromId("file-confirm-password").value;

      let isValid = true;

      const pwemsg = valPassword(filepw, "File Password");
      if (pwemsg) {
        isValid = showErr("file-password-error", pwemsg);
      }

      if (!fileConfirmPw) {
        isValid = showErr("file-confirm-password-error", "Please confirm your password");
      } else if (filepw !== fileConfirmPw) {
        isValid = showErr("file-confirm-password-error", "Passwords do not match");
      }

      if (!isValid || !payload) {
        return;
      }

      payload.filePassword = filepw;

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const emsg = await res.text();

        const check = (errPre, id) => {
          if (emsg.startsWith(errPre)) {
            showErr(id, emsg);
            return true;
          }
          return false;
        };

        if (check("File Password", "file-password-error")) return;

        closeModal(filepwModal);
        openModal(signupModal);

        if (check("Email", "signup-email-error")) return;
        if (check("User", "signup-username-error")) return;
        if (check("Username", "signup-username-error")) return;
        if (check("Password", "signup-password-error")) return;

        showErr("recaptcha-error", emsg, true);
        // Reset reCAPTCHA
        if (window.grecaptcha) {
          grecaptcha.reset();
        }
        return;
      }

      const data = await res.json();
      console.log("Registration response data:", data);
      const privateKey = data.privateKey;
      const privateSigningKey = data.privateSigningKey;
      console.log("Extracted keys:", {
        privateKey: privateKey ? "present" : "missing",
        privateSigningKey: privateSigningKey ? "present" : "missing",
      });

      // For demo purposes, set the user as authenticated
      localStorage.setItem("uid", data.uid);
      localStorage.setItem("token", data.token);
      updateNavigation(true);

      // Show success message briefly, then show private key modal
      const submitBtn = fromId("file-password-submit");
      const prevMsg = submitBtn.innerHTML;
      const successMsg = "Success <i class='fa-solid fa-check'></i>";
      submitBtn.classList.add("form__submit--success");
      submitBtn.innerHTML = successMsg;

      // After 1.5s, close modal and show private key
      setTimeout(() => {
        submitBtn.classList.remove("form__submit--success");
        submitBtn.innerHTML = prevMsg;
        filepwForm.reset();
        closeAllModals();
        showPrivateKeyModal(privateKey, privateSigningKey);
      }, 1500);

      // Clear stored signup data after successful registration
      payload = null;
    });
  }

  /********************************************************
   * Login Form -- Modal for username & password
   ********************************************************/

  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearErrs(signinForm);

      const uname = fromId("signin-username").value;
      const pw = fromId("signin-password").value;

      const unameemsg = valUsername(uname);
      if (unameemsg) {
        showErr("signin-username-error", unameemsg);
        return;
      }

      // Validation for password format ???
      if (!pw) {
        showErr("signin-password-error", "Please enter your password");
        return;
      }

      const payload = {
        username: uname,
        password: pw,
      };

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status == 401) {
        showErr("signin-password-error", "Invalid password");
        return;
      }

      if (!res.ok) {
        const id = res.status == 404 ? "signin-username-error" : "signin-password-error";
        await res.text().then((emsg) => showErr(id, emsg));
        return;
      }

      const data = await res.json();

      // For demo purposes, set the user as authenticated
      localStorage.setItem("uid", data.uid);
      localStorage.setItem("token", data.token);
      updateNavigation(true);
      showSuccess(fromId("sign-in-submit"), signinForm, signinModal);
    });
  }
});
