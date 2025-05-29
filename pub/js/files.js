/**
 * @file files.js – File management functionality for web app.
 * @author darragh0
 */

import {
  fromId,
  queryAll,
  onClick,
  onKeydown,
  query,
  regPwToggle,
} from "./util.js";
import {
  genIV,
  toBase64,
  genAESKey,
  encryptData,
  exportKeyRaw,
} from "./encrypt.js";

/********************************************************
 / HTML Templates
/********************************************************/

// HTML templates for file list and actions
const HTML_TEMPLATES = {
  noFiles: `
    <tr>
      <td colspan="5" class="no-files-message">No files found</td>
    </tr>
  `,
  shareIcon: '<i class="fas fa-share-alt shared-icon"></i>',
  sharedWithYouBadge:
    '<span class="file-badge file-badge--shared">Shared with you</span>',
  sharedByYouBadge:
    '<span class="file-badge file-badge--owned">Shared by you</span>',
  ownedFileActions: (file) => `
    <button class="download-btn tooltip" title="Download" data-tooltip="Download file">
      <i class="fas fa-download"></i>
    </button>
    <button class="share-btn tooltip" title="${
      file.shared ? "Manage Sharing" : "Share"
    }" data-tooltip="${
    file.shared ? "Manage who has access" : "Share with others"
  }">
      <i class="fas fa-share-alt"></i>
    </button>
    <button class="delete-btn tooltip" title="Delete" data-tooltip="Delete permanently">
      <i class="fas fa-trash"></i>
    </button>
  `,
  sharedFileActions: `
    <button class="download-btn tooltip" title="Download" data-tooltip="Download file">
      <i class="fas fa-download"></i>
    </button>
    <button class="share-btn tooltip" title="View Access" data-tooltip="View who has access">
      <i class="fas fa-users"></i>
    </button>
  `,
  sharedUsers: {
    owner: (username) => `
      <div class="user-item">
        <div class="username">
          <i class="fas fa-user"></i>
          ${username} (Owner)
        </div>
      </div>
      <div class="user-item">
        <div class="username">
          <i class="fas fa-user"></i>
          You
        </div>
      </div>
    `,
    sharedWithOthers: `
      <div class="user-item">
        <div class="username">
          <i class="fas fa-user"></i>
          john_doe
        </div>
        <button class="revoke-btn">Revoke</button>
      </div>
      <div class="user-item">
        <div class="username">
          <i class="fas fa-user"></i>
          alice_smith
        </div>
        <button class="revoke-btn">Revoke</button>
      </div>
    `,
    noUsers: `
      <div class="no-users-message">
        No users have access to this file yet. Use the form below to share this file.
      </div>
    `,
  },
  notificationIcons: {
    info: "info-circle",
    success: "check-circle",
    error: "exclamation-circle",
  },
  confirmDialog: `
    <div class="custom-confirm__content">
      <h3 class="custom-confirm__title">Confirm Action</h3>
      <p class="custom-confirm__message" id="confirm-message"></p>
      <div class="custom-confirm__actions">
        <button class="custom-confirm__button custom-confirm__button--cancel" id="confirm-cancel">Cancel</button>
        <button class="custom-confirm__button custom-confirm__button--confirm" id="confirm-ok">Confirm</button>
      </div>
    </div>
  `,
};

/********************************************************
 / File Class Definition
/********************************************************/

class File {
  /**
   * File object constructor.
   *
   * @param {string} name File name
   * @param {string} owner File owner
   * @param {int} size Size in bytes
   * @param {Date} mod Date of last modification
   * @param {boolean} shared Whether the file is shared with others (default: false)
   */
  constructor(name, owner, size, mod, shared = false) {
    if (size < 0) {
      throw new Error("File size cannot be negative");
    }
    this.name = name;
    this.owner = owner;
    this.size = size;
    this.mod = mod;
    this.shared = shared;
  }

  /**
   * Return file size in human-readable format.
   */
  fmtSize() {
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    if (this.size < 0) return "Invalid size";
    if (this.size === 0) return "0 B";

    let size = this.size;
    let i = 0;

    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }

    return `${size.toFixed(2)} ${units[i]}`;
  }

  fmtDate() {
    return this.mod.toLocaleString();
  }

  /**
   * Return whether the file is owned by the current user.
   */
  isOwned() {
    return this.owner === "me";
  }
}

/********************************************************
 / Mock Data
/********************************************************/

// Mock data for demonstration
const ALL_FILES = [
  new File(
    "project_docs.pdf",
    "me",
    2.5 * 1024 * 1024, // 2.4 MB
    new Date("2025-05-15T12:11:45"),
    false
  ),
  new File(
    "financial_report.xlsx",
    "me",
    1.9 * 1024 * 1024, // 1.8 MB
    new Date("2025-05-10T08:45:12"),
    true
  ),
  new File(
    "presentation.pptx",
    "john_doe",
    4.4 * 1024 * 1024, // 4.2 MB
    new Date("2025-05-18T14:03:23"),
    true
  ),
  new File(
    "meeting_notes.docx",
    "me",
    635 * 1024, // 620 KB
    new Date("2025-05-20T10:32:39"),
    false
  ),
];

/********************************************************
 / Main Application Logic
/********************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = queryAll(".filter-btn");
  const filesList = fromId("files-list");
  const uploadBtn = fromId("upload-file-btn");
  const uploadModal = fromId("upload-modal");
  const shareModal = fromId("share-modal");
  const pekDownloadModal = fromId("pek-download-modal");
  const closeButtons = queryAll(".modal__close");
  const signOutBtn = fromId("sign-out-btn");

  let curFilter = "all";
  let curFileIndex = null;
  let fileToDownload = null;

  // Add filter functionality
  filterButtons.forEach((btn) => {
    onClick(btn, () => {
      curFilter = btn.getAttribute("data-filter");

      // Set to active filter
      filterButtons.forEach((btn) =>
        btn.classList.remove("filter-btn--active")
      );
      btn.classList.add("filter-btn--active");

      displayFiles();
    });
  });

  /********************************************************
   / File Display & UI Functions
  /********************************************************/

  /**
   * Display files based on current filter.
   */
  function displayFiles() {
    let filFiles = [];

    switch (curFilter) {
      case "owned":
        filFiles = ALL_FILES.filter((file) => file.isOwned() && !file.shared);
        break;
      case "shared-by-me":
        filFiles = ALL_FILES.filter((file) => file.isOwned() && file.shared);
        break;
      case "shared-by-others":
        filFiles = ALL_FILES.filter((file) => !file.isOwned());
        break;
      case "all":
      default:
        filFiles = ALL_FILES;
        break;
    }

    if (filFiles.length === 0) {
      filesList.innerHTML = HTML_TEMPLATES.noFiles;
      return;
    }

    // Reset file list HTML
    filesList.innerHTML = "";

    // Generate HTML for each file
    filFiles.forEach((file) => {
      const idx = ALL_FILES.indexOf(file);
      filesList.innerHTML += genFileRowHTML(file, idx);
    });

    // Attach event listeners to buttons
    attachActionListeners();
  }

  /**
   * Generate HTML for a file row.
   *
   * @param {File} file The file object
   * @param {number} idx The index in the ALL_FILES array
   * @returns {string} HTML for the file row
   */
  function genFileRowHTML(file, idx) {
    const isOwned = file.isOwned();

    return `
      <tr data-file-index="${idx}" class="${!isOwned ? "shared-file-row" : ""}">
        <td>
          <div class="file-name">
            ${file.name}
            ${!isOwned ? HTML_TEMPLATES.sharedWithYouBadge : ""}
            ${isOwned && file.shared ? HTML_TEMPLATES.sharedByYouBadge : ""}
          </div>
        </td>
        <td>${isOwned ? "You" : file.owner}</td>
        <td>${file.fmtSize()}</td>
        <td>${file.fmtDate()}</td>
        <td>
          <div class="file-actions">
            ${
              isOwned
                ? HTML_TEMPLATES.ownedFileActions(file)
                : HTML_TEMPLATES.sharedFileActions
            }
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Generate HTML for users with access list.
   *
   * @param {File} file The file object
   * @returns {string} HTML for the users list
   */
  function genUsersListHTML(file) {
    if (file.isOwned() && file.shared) {
      return HTML_TEMPLATES.sharedUsers.sharedWithOthers;
    } else if (!file.isOwned()) {
      return HTML_TEMPLATES.sharedUsers.owner(file.owner);
    } else {
      return HTML_TEMPLATES.sharedUsers.noUsers;
    }
  }

  /**
   * Attach event listeners to file action buttons (download, share, delete, etc.).
   */
  function attachActionListeners() {
    // Download buttons
    queryAll(".download-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileIndex = this.closest("tr").getAttribute("data-file-index");
        downloadFile(fileIndex);
      });
    });

    // Share buttons
    queryAll(".share-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileIndex = this.closest("tr").getAttribute("data-file-index");
        openShareModal(fileIndex);
      });
    });

    // Delete buttons
    queryAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileIndex = this.closest("tr").getAttribute("data-file-index");
        deleteFile(fileIndex);
      });
    });
  }

  /********************************************************
   / Confirmation Dialog Functions
  /********************************************************/

  /**
   * Create custom confirmation dialog element.
   */
  function createCustomConfirmDialog() {
    // Check if dialog already exists
    if (fromId("custom-confirm-dialog")) return;

    const dialog = document.createElement("div");
    dialog.className = "custom-confirm";
    dialog.id = "custom-confirm-dialog";
    dialog.innerHTML = HTML_TEMPLATES.confirmDialog;

    document.body.appendChild(dialog);

    // Add event listeners
    onClick(fromId("confirm-cancel"), () => {
      hideCustomConfirm();
    });

    // Close on click outside
    onClick(dialog, (e) => {
      if (e.target === dialog) {
        hideCustomConfirm();
      }
    });
  }

  /**
   * Show custom confirm dialog
   */
  function showCustomConfirm(message, confirmCallback) {
    // Create dialog if it doesn't exist
    createCustomConfirmDialog();

    const dialog = fromId("custom-confirm-dialog");
    const messageEl = fromId("confirm-message");
    const confirmBtn = fromId("confirm-ok");

    // Set message
    messageEl.textContent = message;

    // Clear previous event listener and add new one
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    onClick(newConfirmBtn, () => {
      hideCustomConfirm();
      confirmCallback();
    });

    // Show dialog
    dialog.classList.add("custom-confirm--visible");
  }

  // Function to hide custom confirm dialog
  function hideCustomConfirm() {
    const dialog = fromId("custom-confirm-dialog");
    if (dialog) {
      dialog.classList.remove("custom-confirm--visible");
    }
  }

  /********************************************************
   / File Operations
  /********************************************************/

  function downloadFile(fileIndex) {
    const file = ALL_FILES[fileIndex];
    fileToDownload = file;

    // Show PEK modal to get password for decryption
    pekDownloadModal.classList.add("modal--active");

    // Set up password toggles when the modal is opened
    setupPasswordToggles();

    // Clear any previous errors
    const pekDownloadError = fromId("pek-download-password-error");
    pekDownloadError.textContent = "";
    pekDownloadError.classList.remove("form__error--visible");

    // Focus on the password field
    fromId("pek-download-password").focus();
  }

  function openShareModal(fileIndex) {
    curFileIndex = fileIndex;
    const file = ALL_FILES[fileIndex];

    // Set file name in modal
    fromId("share-file-name").textContent = file.name;

    // Display users with access
    const usersListElement = fromId("users-with-access");
    usersListElement.innerHTML = genUsersListHTML(file);

    // Add event listeners to revoke buttons if present
    if (file.isOwned() && file.shared) {
      document.querySelectorAll(".revoke-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          const username = this.parentElement
            .querySelector(".username")
            .textContent.trim();
          revokeAccess(username);
        });
      });
    }

    // Show share form only if user is the owner
    const shareForm = fromId("share-form");
    if (file.isOwned()) {
      shareForm.style.display = "block";
    } else {
      shareForm.style.display = "none";
    }

    // Show the modal
    shareModal.classList.add("modal--active");
  }

  function deleteFile(fileIndex) {
    const file = ALL_FILES[fileIndex];

    // If the file is shared, show a special confirmation
    if (file.shared) {
      showCustomConfirm(
        `This file is shared with other users. Deleting it will revoke access for all users. Are you sure you want to delete "${file.name}"?`,
        function () {
          // Get the file row element
          const fileRow = document.querySelector(
            `tr[data-file-index="${fileIndex}"]`
          );

          // Add a fade-out animation
          if (fileRow) {
            fileRow.style.transition = "opacity 0.5s, transform 0.5s";
            fileRow.style.opacity = "0";
            fileRow.style.transform = "translateX(20px)";
          }

          // Wait for animation to complete before removing from data
          setTimeout(() => {
            // TODO: Delete file from database

            ALL_FILES.splice(fileIndex, 1);
            displayFiles();

            // Show notification
            notify(
              `"${file.name}" has been permanently deleted and all shared access has been revoked.`,
              "success"
            );
          }, 500); // Match transition duration
        }
      );
    } else {
      // Standard confirmation for non-shared files
      showCustomConfirm(
        `Are you sure you want to delete "${file.name}"?`,
        function () {
          // Get the file row element
          const fileRow = document.querySelector(
            `tr[data-file-index="${fileIndex}"]`
          );

          // Add a fade-out animation
          if (fileRow) {
            fileRow.style.transition = "opacity 0.5s, transform 0.5s";
            fileRow.style.opacity = "0";
            fileRow.style.transform = "translateX(20px)";
          }

          // Wait for animation to complete before removing from data
          setTimeout(() => {
            // TODO: Delete file from database
            ALL_FILES.splice(fileIndex, 1);
            displayFiles();

            // Show notification
            notify(`"${file.name}" has been permanently deleted.`, "success");
          }, 500); // Match transition duration
        }
      );
    }
  }

  function revokeAccess(username) {
    showCustomConfirm(
      `Are you sure you want to revoke access for ${username}?`,
      () => {
        // TODO: Update file access permissions
        notify(`Access revoked for ${username}`, "success");
        shareModal.classList.remove("modal--active");
      }
    );
  }

  /********************************************************
   / Notification System
  /********************************************************/

  /**
   * Create & show notification to the user.
   *
   * @param {string} message
   * @param {string} type
   */
  function notify(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification--${type}`;

    // Get icon based on type
    const icon =
      HTML_TEMPLATES.notificationIcons[type] ||
      HTML_TEMPLATES.notificationIcons.info;

    notification.innerHTML = `
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
    `;

    // Add to document
    document.body.appendChild(notification);

    // Trigger entrance animation
    setTimeout(() => {
      notification.classList.add("notification--visible");
    }, 10);

    // Remove after delay
    setTimeout(() => {
      notification.classList.remove("notification--visible");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /********************************************************
   / Form Handling
  /********************************************************/

  // Share form submission
  const shareForm = fromId("share-form");

  shareForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const username = fromId("share-username").value;

    if (!username) {
      fromId("share-username-error").textContent = "Please enter a username";
      document
        .getElementById("share-username-error")
        .classList.add("form__error--visible");
      return;
    }

    // TODO: Share file with user if not already shared.

    const file = ALL_FILES[curFileIndex];

    // Mark the file as shared
    if (file) {
      file.shared = true;
    }

    // Update the file list to reflect changes
    displayFiles();

    // Clear the form and close the modal
    this.reset();
    shareModal.classList.remove("modal--active");

    // Show notification
    notify(`"${file.name}" has been shared with ${username}.`, "success");
  });

  // Handle PEK download form submission
  const pekDownloadForm = fromId("pek-download-form");
  if (pekDownloadForm) {
    pekDownloadForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const pekPassword = fromId("pek-download-password").value;
      const pekDownloadError = fromId("pek-download-password-error");

      // Validate PEK
      if (!pekPassword) {
        pekDownloadError.textContent =
          "Please enter your Password Encryption Key";
        pekDownloadError.classList.add("form__error--visible");
        return;
      }

      // TODO: Use the PEK to decrypt the file's DEK

      // Close the modal
      pekDownloadModal.classList.remove("modal--active");

      // Reset the form
      this.reset();

      if (fileToDownload) {
        notify(`Downloading "${fileToDownload.name}"...`, "info");

        // Simulate download with decryption
        setTimeout(() => {
          notify(
            `"${fileToDownload.name}" downloaded and decrypted successfully.`,
            "success"
          );
          fileToDownload = null;
        }, 1500);
      }
    });
  }

  // Upload button
  onClick(uploadBtn, () => {
    uploadModal.classList.add("modal--active");
    // Set up password toggles when the modal is opened
    setupPasswordToggles();
  });

  // Upload form
  const uploadForm = fromId("upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const fileInput = fromId("file-upload");
      const selectedFileDisplay = fromId("selected-file");
      const fileUploadError = fromId("file-upload-error");
      const pekInput = fromId("upload-pek");
      const pekError = fromId("upload-pek-error");

      // Clear previous errors
      fileUploadError.textContent = "";
      fileUploadError.classList.remove("form__error--visible");
      pekError.textContent = "";
      pekError.classList.remove("form__error--visible");

      // Validate file selection
      if (!fileInput.files || fileInput.files.length === 0) {
        fileUploadError.textContent = "Please select file(s) to upload";
        fileUploadError.classList.add("form__error--visible");
        return;
      }

      // Validate PEK
      const pekPassword = pekInput.value;
      if (!pekPassword) {
        pekError.textContent = "Please enter your Password Encryption Key";
        pekError.classList.add("form__error--visible");
        return;
      }

      const file = fileInput.files[0];
      const fileBytes = new Uint8Array(await file.arrayBuffer());

      // Step 1: Generate a Data Encryption Key (DEK) for the file
      const dek = await genAESKey();

      // Step 2: Encrypt file with DEK
      const iv_file = genIV();
      const encryptedFile = await encryptData(dek, iv_file, fileBytes);

      // Step 3: Get raw DEK bytes to be encrypted
      const rawDEK = await exportKeyRaw(dek);

      // Step 4: Encrypt DEK with KEK derived from user's PEK
      const iv_dek = genIV();

      // In a real app, we would derive the KEK from the PEK
      // For this demo, we're simulating it
      // TODO: Replace with actual KEK derivation from PEK
      const kek = await genAESKey();
      const encrypted_dek = await encryptData(kek, iv_dek, rawDEK);

      // Base64 encode everything to prep for upload
      const payload = {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        iv_file: toBase64(iv_file),
        iv_dek: toBase64(iv_dek),
        encrypted_dek: toBase64(encrypted_dek),
        encrypted_file: toBase64(encryptedFile),
        // Include a reference to the PEK (not the actual PEK) for the server
        pek_used: true,
      };

      console.log("Payload to upload:", payload);
      // TODO: send to backend via fetch

      // Create a new File instance
      const newFile = new File(file.name, "me", file.size, new Date(), false);

      ALL_FILES.unshift(newFile);

      // Clear the form and selected file display
      this.reset();
      selectedFileDisplay.textContent = "";
      selectedFileDisplay.classList.remove("has-file");

      // Close the modal and refresh the display
      uploadModal.classList.remove("modal--active");
      displayFiles();

      // Show notification
      notify(
        `"${newFile.name}" has been encrypted and uploaded successfully.`,
        "success"
      );
    });
  }

  /********************************************************
   / File Upload & Drag-and-Drop
  /********************************************************/

  // Setup drag and drop functionality
  const setupFileDragAndDrop = () => {
    const dropArea = fromId("file-drop-area");
    const fileInput = fromId("file-upload");
    const selectedFileDisplay = fromId("selected-file");
    const fileUploadError = fromId("file-upload-error");

    if (!dropArea || !fileInput) return;

    // Handle file selection
    const handleFileSelection = (file) => {
      if (!file) return;

      // Clear previous errors
      fileUploadError.textContent = "";
      fileUploadError.classList.remove("form__error--visible");

      // Show selected file name
      selectedFileDisplay.textContent = file.name;
      selectedFileDisplay.classList.add("has-file");
    };

    // File input change event
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      handleFileSelection(file);
    });

    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        false
      );
    });

    // Highlight drop area when dragging over it
    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        () => {
          dropArea.classList.add("drag-over");
        },
        false
      );
    });

    // Remove highlight when leaving drop area
    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        () => {
          dropArea.classList.remove("drag-over");
        },
        false
      );
    });

    // Handle dropped files
    dropArea.addEventListener(
      "drop",
      (e) => {
        const file = e.dataTransfer.files[0]; // Get only first file

        if (file) {
          fileInput.files = e.dataTransfer.files; // Update the file input
          handleFileSelection(file);
        }
      },
      false
    );

    // Click on drop area should trigger file input
    dropArea.addEventListener("click", (e) => {
      // Don't trigger if clicking on the Browse button (it has its own handler)
      if (!e.target.classList.contains("file-select-button")) {
        fileInput.click();
      }
    });
  };

  // Setup file drag and drop
  setupFileDragAndDrop();

  /********************************************************
   / Utilities & Event Handlers
  /********************************************************/

  // Function to initialize password toggles
  const setupPasswordToggles = () => {
    const pwToggles = document.querySelectorAll(".form__password-toggle");
    pwToggles.forEach((toggle) => regPwToggle(toggle));
  };

  // Initial setup of password toggles
  setupPasswordToggles();

  // Close modal buttons
  closeButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const modal = this.closest(".modal");
      modal.classList.remove("modal--active");
    });
  });

  // Close modals when click outside
  onClick(window, (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.classList.remove("modal--active");
    }
  });

  onClick(signOutBtn, () => {
    // Reset auth state
    localStorage.removeItem("auth");
    window.location.href = "/";
  });

  // Initial display
  displayFiles();
});
