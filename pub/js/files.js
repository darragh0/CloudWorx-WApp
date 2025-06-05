/**
 * @file files.js - File management functionality for web app.
 * @author darragh0
 */

import { fromId, queryAll, onClick, regPwToggle } from "./util.js";

/********************************************************
 / HTML Templates
/********************************************************/

// HTML templates for file list and actions
const HTML_TEMPLATES = {
  noFiles: `
    <tr>
      <td colspan="6" class="no-files-message">No files found</td>
    </tr>
  `,
  shareIcon: '<i class="fas fa-share-alt shared-icon"></i>',
  ownedFileActions: (file) => `
    <button class="download-btn tooltip" title="Download" data-tooltip="Download file">
      <i class="fas fa-download"></i>
    </button>
    <button class="share-btn tooltip" title="${file.shared ? "Manage Sharing" : "Share"}" data-tooltip="${
    file.shared ? "Manage who has access" : "Share with others"
  }">
      <i class="fas fa-share-alt"></i>
    </button>
    <button class="delete-btn tooltip" title="Delete" data-tooltip="Delete permanently">
      <i class="fas fa-trash"></i>
    </button>
  `,
  sharedFileActions: (file) => `
    <button class="download-btn tooltip" title="Download" data-tooltip="Download file">
      <i class="fas fa-download"></i>
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
 / File Utility Functions
/********************************************************/

/**
 * Create a file object with validation.
 *
 * @param {string} name File name
 * @param {string} type File type/extension or MIME type
 * @param {string} owner File owner
 * @param {number} size Size in bytes
 * @param {Date} mod Date of last modification
 * @param {string} [fileId=null] File ID from backend
 * @param {Object} [dekData=null] DEK encryption data
 * @param {string} [ivFile=null] IV for file encryption
 * @param {string} [assocDataFile=null] Associated data for file
 * @param {boolean} [shared=false] Whether the file is shared with others
 * @param {string} [sharedByUsername=null] Username of who shared the file (for shared files)
 * @param {string} [sharedBy=null] ID of who shared the file (for shared files)
 * @param {Array} [shares=null] Array of shares information for files shared by current user
 * @returns {Object} File object
 */
function mkFile(
  name,
  type,
  owner,
  size,
  mod,
  fileId = null,
  dekData = null,
  ivFile = null,
  assocDataFile = null,
  shared = false,
  sharedByUsername = null,
  sharedBy = null,
  shares = null,
) {
  if (size < 0) {
    throw new Error("File size cannot be negative");
  }
  return {
    name,
    type,
    owner,
    size,
    mod,
    fileId,
    dekData,
    ivFile,
    assocDataFile,
    shared,
    sharedByUsername,
    sharedBy,
    shares,
  };
}

/**
 * Check if the file size is invalid.
 *
 * @param {number} fsize File size in bytes
 * @returns {boolean} True if size is invalid, false otherwise
 */
function isInvalidSize(fsize) {
  return fsize === undefined || fsize === null || isNaN(fsize) || fsize < 0;
}

/**
 * Return file size in human-readable format.
 *
 * @param {number} fsize File size in bytes
 * @returns {string} Formatted file size
 */
function fmtFileSize(fsize) {
  if (isInvalidSize(fsize)) {
    return "Invalid size";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  if (fsize < 0) return "Invalid size";
  if (fsize === 0) return "0 B";

  let i = 0;
  let size = fsize;

  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }

  return `${size.toFixed(2)} ${units[i]}`;
}

/**
 * Return formatted date string.
 *
 * @param {Date} fcreated File object
 * @returns {string} Formatted date
 */
function fmtFileDate(fcreated) {
  return fcreated.toLocaleString("en-GB") || "Unknown";
}

/**
 * Return whether the file is owned by the current user.
 *
 * @param {Object} file File object
 * @returns {boolean} True if owned by current user
 */
function isFileOwned(file) {
  return file.owner === "me";
}

/**
 * Return formatted file type for display.
 * Gets MIME type if known file type, else file extension.
 *
 * @param {string|null} ftype File type
 * @returns {string} Formatted file type or extension
 */
function fmtFileType(ftype) {
  const mimeTypes = {
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    zip: "application/zip",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
  };

  return ftype && ftype in mimeTypes ? mimeTypes[ftype] : ftype || "Unknown";
}

/********************************************************
 / Data Storage
/********************************************************/

/**
 * Get files from the backend database based on filter.
 */
async function loadOwnedFiles() {
  try {
    const res = await fetch("/api/get-files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: localStorage.getItem("uid"),
        token: localStorage.getItem("token"),
      }),
    });

    if (!res.ok) {
      const emsg = await res.text();
      showErrorInFilesList(`Server error: ${emsg || "Unknown error occurred"}`);
      return [];
    }

    if (res.status === 204) {
      // No files found
      return [];
    }

    const data = await res.json();

    // Convert backend files to file objects
    const ownedFiles = data.files.map((file) => {
      return mkFile(
        file.file_name,
        file.file_type,
        "me",
        file.file_size,
        new Date(file.created_at),
        file.file_id,
        file.dek_data,
        file.iv_file,
        file.assoc_data_file,
        false,
      );
    });

    return ownedFiles;
  } catch (error) {
    showErrorInFilesList("Failed to load files. Please try refreshing the page.");
    return [];
  }
}

/**
 * Get files shared with the current user from the backend database.
 */
async function loadSharedFiles() {
  try {
    const res = await fetch("/api/get-files-shared-by-others", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: localStorage.getItem("uid"),
        token: localStorage.getItem("token"),
      }),
    });

    if (!res.ok) {
      const emsg = await res.text();
      showErrorInFilesList(`Server error: ${emsg || "Unknown error occurred"}`);
      return [];
    }

    if (res.status === 204) {
      // No files found
      return [];
    }

    const data = await res.json();

    // Convert backend files to file objects
    const sharedFiles = data.files.map((file) => {
      return mkFile(
        file.file_name,
        file.file_type,
        file.shared_by_username || file.shared_by || "Unknown", // Use username if available, fallback to shared_by
        file.file_size,
        new Date(file.created_at),
        file.file_id,
        file.dek_data,
        file.iv_file,
        file.assoc_data_file,
        false, // These are shared files, not files we own that are shared
        file.shared_by_username,
        file.shared_by,
      );
    });

    return sharedFiles;
  } catch (error) {
    showErrorInFilesList("Failed to load shared files. Please try refreshing the page.");
    return [];
  }
}

/**
 * Get files shared by the current user from the backend database.
 */
async function loadSharedByMeFiles() {
  try {
    const res = await fetch("/api/get-files-shared-by-me", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: localStorage.getItem("uid"),
        token: localStorage.getItem("token"),
      }),
    });

    if (!res.ok) {
      const emsg = await res.text();
      showErrorInFilesList(`Server error: ${emsg || "Unknown error occurred"}`);
      return [];
    }

    if (res.status === 204) {
      // No files found
      return [];
    }

    const data = await res.json();

    // Convert backend files to file objects
    const sharedByMeFiles = data.files.map((file) => {
      return mkFile(
        file.file_name,
        file.file_type,
        "me",
        file.file_size,
        new Date(file.created_at),
        file.file_id,
        null, // DEK data not included in shared files list
        null, // IV not included in shared files list
        null, // Associated data not included in shared files list
        true, // These are files we own that are shared
        null,
        null,
        file.shares, // Add shares information
      );
    });

    return sharedByMeFiles;
  } catch (error) {
    showErrorInFilesList("Failed to load shared files. Please try refreshing the page.");
    return [];
  }
}

/**
 * Show error message in the files list area
 */
function showErrorInFilesList(message) {
  const filesList = fromId("files-list");
  filesList.innerHTML = `
    <tr>
      <td colspan="6" class="no-files-message error-message">${message}</td>
    </tr>
  `;
}

/********************************************************
 / Main Application Logic
/********************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  let ownedFiles = [];
  let sharedFiles = [];
  let sharedByMeFiles = [];

  const filterButtons = queryAll(".filter-btn");
  const filesList = fromId("files-list");
  const uploadBtn = fromId("upload-file-btn");
  const uploadModal = fromId("upload-modal");
  const shareModal = fromId("share-modal");
  const dlModal = fromId("download-modal");
  const closeButtons = queryAll(".modal__close");
  const signOutBtn = fromId("sign-out-btn");

  let curFilter = "owned";
  let curFileIndex = null;
  let fileToDownload = null;

  // Add filter functionality
  filterButtons.forEach((btn) => {
    onClick(btn, () => {
      curFilter = btn.getAttribute("data-filter");

      // Set to active filter
      filterButtons.forEach((btn) => btn.classList.remove("filter-btn--active"));
      btn.classList.add("filter-btn--active");

      displayFiles(true);
    });
  });

  /********************************************************
   / File Display & UI Functions
  /********************************************************/

  /**
   * Display files based on current filter.
   *
   * @param {boolean} update Whether to update the file list
   */
  async function displayFiles(update) {
    let filFiles = [];

    switch (curFilter) {
      case "owned":
        ownedFiles = update ? await loadOwnedFiles() : ownedFiles;
        filFiles = ownedFiles.filter((file) => !file.shared);
        break;
      case "shared-by-me":
        sharedByMeFiles = update ? await loadSharedByMeFiles() : sharedByMeFiles;
        // Also load owned files if not already loaded, for encryption data
        if (ownedFiles.length === 0 && update) {
          ownedFiles = await loadOwnedFiles();
        }
        filFiles = sharedByMeFiles;
        break;
      case "shared-by-others":
        sharedFiles = update ? await loadSharedFiles() : sharedFiles;
        filFiles = sharedFiles;
        break;
    }

    if (filFiles.length === 0) {
      filesList.innerHTML = HTML_TEMPLATES.noFiles;
      return;
    }

    filesList.innerHTML = "";

    // Generate HTML for each file
    filFiles.forEach((file, arrayIndex) => {
      let idx, fileSource;

      if (curFilter === "shared-by-others") {
        idx = arrayIndex;
        fileSource = "shared";
      } else if (curFilter === "shared-by-me") {
        idx = arrayIndex;
        fileSource = "shared-by-me";
      } else {
        idx = ownedFiles.indexOf(file);
        fileSource = "owned";
      }

      filesList.innerHTML += genFileRowHTML(file, idx, fileSource);
    });

    // Attach event listeners to buttons
    attachActionListeners();
  }

  /**
   * Generate HTML for a file row.
   *
   * @param {Object} file The file object
   * @param {number} idx The index in the allFiles array
   * @param {string} fileSource Whether this is an "owned", "shared", or "shared-by-me" file
   * @returns {string} HTML for the file row
   */
  function genFileRowHTML(file, idx, fileSource = "owned") {
    const isSharedFile = fileSource === "shared";
    const isSharedByMeFile = fileSource === "shared-by-me";

    let ownerDisplay = "You";
    if (isSharedFile) {
      ownerDisplay = file.owner;
    } else if (isSharedByMeFile) {
      // For shared-by-me files, always show "Me" as owner
      ownerDisplay = "You";
    }

    const actionTemplate = isSharedFile
      ? HTML_TEMPLATES.sharedFileActions(file)
      : HTML_TEMPLATES.ownedFileActions(file);

    return `
      <tr data-file-index="${idx}" data-file-source="${fileSource}">
        <td>
          <div class="file-name">
            ${file.name}
          </div>
        </td>
        <td>${ownerDisplay}</td>
        <td>${fmtFileType(file.type)}</td>
        <td>${fmtFileSize(file.size)}</td>
        <td>${fmtFileDate(file.mod)}</td>
        <td>
          <div class="file-actions">
            ${actionTemplate}
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Generate HTML for users with access list.
   *
   * @param {Object} file The file object
   * @returns {string} HTML for the users list
   */
  function genUsersListHTML(file) {
    if (isFileOwned(file) && file.shared) {
      return HTML_TEMPLATES.sharedUsers.sharedWithOthers;
    } else if (!isFileOwned(file)) {
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
        const fileSource = this.closest("tr").getAttribute("data-file-source");
        downloadFile(fileIndex, fileSource);
      });
    });

    // Share buttons
    queryAll(".share-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileIndex = this.closest("tr").getAttribute("data-file-index");
        const fileSource = this.closest("tr").getAttribute("data-file-source");
        openShareModal(fileIndex, fileSource);
      });
    });

    // Delete buttons
    queryAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileIndex = this.closest("tr").getAttribute("data-file-index");
        const fileSource = this.closest("tr").getAttribute("data-file-source");
        deleteFile(fileIndex, fileSource);
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

  function downloadFile(fileIndex, fileSource = "owned") {
    let file;

    if (fileSource === "shared") {
      file = sharedFiles[fileIndex];
    } else if (fileSource === "shared-by-me") {
      file = sharedByMeFiles[fileIndex];

      // For shared-by-me files, we need to get the encryption data from owned files
      // since the shared files list doesn't include this information
      const ownedFile = ownedFiles.find((ownedFile) => ownedFile.fileId === file.fileId);
      if (ownedFile) {
        // Copy encryption data from the owned file
        file.dekData = ownedFile.dekData;
        file.ivFile = ownedFile.ivFile;
        file.assocDataFile = ownedFile.assocDataFile;
      } else {
        // If we can't find the owned file, we need to load owned files first
        notify("Loading file details...", "info");
        loadOwnedFiles().then((loadedOwnedFiles) => {
          ownedFiles = loadedOwnedFiles;
          const ownedFile = ownedFiles.find((ownedFile) => ownedFile.fileId === file.fileId);
          if (ownedFile) {
            file.dekData = ownedFile.dekData;
            file.ivFile = ownedFile.ivFile;
            file.assocDataFile = ownedFile.assocDataFile;
            proceedWithDownload(file);
          } else {
            notify("Error: Could not find file encryption details.", "error");
          }
        });
        return;
      }
    } else {
      file = ownedFiles[fileIndex];
    }

    proceedWithDownload(file);
  }

  function proceedWithDownload(file) {
    fileToDownload = file;

    dlModal.classList.add("modal--active");

    // Set up password toggles when the modal is opened
    setupPasswordToggles();

    // Clear any previous errors
    const pwDlError = fromId("download-modal-password-error");
    pwDlError.textContent = "";
    pwDlError.classList.remove("form__error--visible");

    // Focus on the password field
    fromId("download-password").focus();
  }

  function openShareModal(fileIndex, fileSource = "owned") {
    curFileIndex = fileIndex;
    let file;

    if (fileSource === "shared") {
      file = sharedFiles[fileIndex];
    } else if (fileSource === "shared-by-me") {
      file = sharedByMeFiles[fileIndex];
    } else {
      file = ownedFiles[fileIndex];
    }

    // Only allow sharing of owned files and files shared by me
    if (fileSource === "shared") {
      notify("You cannot share files that are shared with you.", "error");
      return;
    }

    // Set file name in modal
    fromId("share-file-name").textContent = file.name;

    // Clear form
    clearShareForm();

    // Show current users if this is a shared-by-me file
    if (fileSource === "shared-by-me" && file.shares && file.shares.length > 0) {
      populateCurrentUsers(file.shares);
    } else {
      hideCurrentUsers();
    }

    // Show the modal
    shareModal.classList.add("modal--active");

    // Re-initialize password toggles for the share modal
    setupPasswordToggles();
  }

  // Function to clear share form
  function clearShareForm() {
    // Clear username input
    const usernameInput = fromId("share-username");
    if (usernameInput) {
      usernameInput.value = "";
    }

    // Clear file password input
    const passwordInput = fromId("share-file-password");
    if (passwordInput) {
      passwordInput.value = "";
    }

    // Clear key file inputs
    const x25519FileInput = fromId("x25519-key-file");
    const ed25519FileInput = fromId("ed25519-key-file");
    if (x25519FileInput) x25519FileInput.value = "";
    if (ed25519FileInput) ed25519FileInput.value = "";

    // Clear key text areas
    const x25519TextInput = fromId("x25519-key-text");
    const ed25519TextInput = fromId("ed25519-key-text");
    if (x25519TextInput) x25519TextInput.value = "";
    if (ed25519TextInput) ed25519TextInput.value = "";

    // Clear file name displays
    const x25519FileName = fromId("x25519-file-name");
    const ed25519FileName = fromId("ed25519-file-name");
    if (x25519FileName) x25519FileName.textContent = "";
    if (ed25519FileName) ed25519FileName.textContent = "";

    // Clear all error messages
    const errors = ["share-username-error", "share-file-password-error", "x25519-key-error", "ed25519-key-error"];
    errors.forEach((errorId) => {
      const errorElement = fromId(errorId);
      if (errorElement) {
        errorElement.textContent = "";
        errorElement.classList.remove("form__error--visible");
      }
    });
  }

  // Function to set up share form file handlers
  function setupShareFormFileHandlers() {
    // X25519 key file handler
    const x25519FileInput = fromId("x25519-key-file");
    const x25519TextInput = fromId("x25519-key-text");
    const x25519FileName = fromId("x25519-file-name");

    if (x25519FileInput) {
      x25519FileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const content = await file.text();
            x25519TextInput.value = content;
            x25519FileName.textContent = file.name;
          } catch (error) {
            fromId("x25519-key-error").textContent = "Error reading file";
            fromId("x25519-key-error").classList.add("form__error--visible");
          }
        }
      });
    }

    // Ed25519 key file handler
    const ed25519FileInput = fromId("ed25519-key-file");
    const ed25519TextInput = fromId("ed25519-key-text");
    const ed25519FileName = fromId("ed25519-file-name");

    if (ed25519FileInput) {
      ed25519FileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const content = await file.text();
            ed25519TextInput.value = content;
            ed25519FileName.textContent = file.name;
          } catch (error) {
            fromId("ed25519-key-error").textContent = "Error reading file";
            fromId("ed25519-key-error").classList.add("form__error--visible");
          }
        }
      });
    }

    // Clear file name when text area is manually edited
    if (x25519TextInput) {
      x25519TextInput.addEventListener("input", () => {
        if (x25519FileName) x25519FileName.textContent = "";
      });
    }

    if (ed25519TextInput) {
      ed25519TextInput.addEventListener("input", () => {
        if (ed25519FileName) ed25519FileName.textContent = "";
      });
    }
  }

  function deleteFile(fileIndex, fileSource = "owned") {
    let file;

    if (fileSource === "shared") {
      file = sharedFiles[fileIndex];
    } else if (fileSource === "shared-by-me") {
      file = sharedByMeFiles[fileIndex];
    } else {
      file = ownedFiles[fileIndex];
    }

    // Only allow deletion of owned files and files shared by me
    if (fileSource === "shared") {
      notify("You cannot delete files that are shared with you.", "error");
      return;
    }

    // If the file is shared, show a special confirmation
    if (file.shared) {
      showCustomConfirm(
        `This file is shared with other users. Deleting it will revoke access for all users. Are you sure you want to delete "${file.name}"?`,
        function () {
          // Get the file row element
          const fileRow = document.querySelector(`tr[data-file-index="${fileIndex}"]`);

          // Add a fade-out animation
          if (fileRow) {
            fileRow.style.transition = "opacity 0.5s, transform 0.5s";
            fileRow.style.opacity = "0";
            fileRow.style.transform = "translateX(20px)";
          }

          // Wait for animation to complete before removing from data
          setTimeout(async () => {
            try {
              // Call the delete endpoint
              const res = await fetch("/api/delete-file", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fileName: file.name,
                  userId: localStorage.getItem("uid"),
                  token: localStorage.getItem("token"),
                }),
              });

              if (!res.ok) {
                const emsg = await res.text();
                notify(`Failed to delete file: ${emsg || "Unknown error occurred"}`, "error");
                // Restore the file row visibility on error
                if (fileRow) {
                  fileRow.style.opacity = "1";
                  fileRow.style.transform = "translateX(0)";
                }
                return;
              }

              // Remove from local data and refresh display
              ownedFiles.splice(fileIndex, 1);
              displayFiles(true);

              // Show notification
              notify(`"${file.name}" has been permanently deleted and all shared access has been revoked.`, "success");
            } catch (error) {
              console.error("Error deleting file:", error);
              notify(`Failed to delete file: ${error.message}`, "error");
              // Restore the file row visibility on error
              if (fileRow) {
                fileRow.style.opacity = "1";
                fileRow.style.transform = "translateX(0)";
              }
            }
          }, 500); // Match transition duration
        },
      );
    } else {
      // Standard confirmation for non-shared files
      showCustomConfirm(`Are you sure you want to delete "${file.name}"?`, function () {
        // Get the file row element
        const fileRow = document.querySelector(`tr[data-file-index="${fileIndex}"]`);

        // Add a fade-out animation
        if (fileRow) {
          fileRow.style.transition = "opacity 0.5s, transform 0.5s";
          fileRow.style.opacity = "0";
          fileRow.style.transform = "translateX(20px)";
        }

        // Wait for animation to complete before removing from data
        setTimeout(async () => {
          try {
            console.log("Deleting file:", file.name);
            // Call the delete endpoint
            const res = await fetch("/api/delete-file", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileName: file.name,
                userId: localStorage.getItem("uid"),
                token: localStorage.getItem("token"),
              }),
            });

            if (!res.ok) {
              const emsg = await res.text();
              notify(`Failed to delete file: ${emsg || "Unknown error occurred"}`, "error");
              // Restore the file row visibility on error
              if (fileRow) {
                fileRow.style.opacity = "1";
                fileRow.style.transform = "translateX(0)";
              }
              return;
            }

            // Remove from local data and refresh display
            ownedFiles.splice(fileIndex, 1);
            displayFiles(true);

            // Show notification
            notify(`"${file.name}" has been permanently deleted.`, "success");
          } catch (error) {
            console.error("Error deleting file:", error);
            notify(`Failed to delete file: ${error.message}`, "error");
            // Restore the file row visibility on error
            if (fileRow) {
              fileRow.style.opacity = "1";
              fileRow.style.transform = "translateX(0)";
            }
          }
        }, 500); // Match transition duration
      });
    }
  }

  function revokeAccess(shareId, username) {
    showCustomConfirm(`Are you sure you want to revoke access for ${username}?`, async () => {
      try {
        // Get the current file being shared
        let file;
        if (curFilter === "shared-by-me") {
          file = sharedByMeFiles[curFileIndex];
        } else {
          file = ownedFiles[curFileIndex];
        }

        if (!file) {
          notify("Error: Unable to identify the file. Please try again.", "error");
          return;
        }

        const requestData = {
          userId: localStorage.getItem("uid"),
          token: localStorage.getItem("token"),
          fileId: file.file_id,
          username: username,
        };

        console.log("Revoking access with data:", { ...requestData, token: "[REDACTED]" });

        const response = await fetch("/api/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });

        if (response.ok) {
          notify(`Access revoked for ${username}`, "success");

          // Refresh the files list to update share status
          await displayFiles(true);

          // Update the current users list in the modal
          const updatedFile = await getCurrentFileData();
          if (updatedFile && updatedFile.shares) {
            populateCurrentUsers(updatedFile.shares);
          } else {
            hideCurrentUsers();
          }
        } else {
          const errorText = await response.text();
          console.error("Revoke API error:", { status: response.status, error: errorText });
          notify(`Failed to revoke access: ${errorText}`, "error");
        }
      } catch (error) {
        console.error("Error revoking access:", error);
        notify("Failed to revoke access. Please try again.", "error");
      }
    });
  }

  // Helper function to get current file data after operations
  async function getCurrentFileData() {
    try {
      let file;
      if (curFilter === "shared-by-me") {
        file = sharedByMeFiles[curFileIndex];
      } else {
        file = ownedFiles[curFileIndex];
      }

      // Re-fetch the shared-by-me files to get updated share information
      const response = await fetch("/api/files-shared-by-me", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: localStorage.getItem("uid"),
          token: localStorage.getItem("token"),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Find the current file in the updated data
        const updatedFile = data.files.find((f) => f.file_id === file.file_id);
        return updatedFile;
      }
    } catch (error) {
      console.error("Error getting current file data:", error);
    }
    return null;
  }

  // Function to populate current users in share modal
  function populateCurrentUsers(shares) {
    const currentUsersSection = fromId("share-form-current-users");
    const currentUsersList = fromId("current-users-list");

    console.log("Populating current users with shares:", shares);

    if (shares && shares.length > 0) {
      let usersHTML = "";
      shares.forEach((share) => {
        console.log("Adding share for user:", share.username, "with shareId:", share.share_id);
        usersHTML += `
          <div class="user-item">
            <div class="username">
              <i class="fas fa-user"></i>
              ${share.username}
            </div>
            <button type="button" class="revoke-btn" data-share-id="${share.share_id}" data-username="${share.username}">
              <i class="fas fa-times"></i> Revoke
            </button>
          </div>
        `;
      });

      currentUsersList.innerHTML = usersHTML;
      currentUsersSection.style.display = "block";

      // Attach revoke button listeners
      attachRevokeListeners();
    } else {
      console.log("No shares found, hiding current users section");
      hideCurrentUsers();
    }
  }

  // Function to hide current users section
  function hideCurrentUsers() {
    const currentUsersSection = fromId("share-form-current-users");
    currentUsersSection.style.display = "none";
  }

  // Function to attach event listeners to revoke buttons
  function attachRevokeListeners() {
    const revokeButtons = queryAll(".revoke-btn");
    console.log(`Attaching listeners to ${revokeButtons.length} revoke buttons`);

    revokeButtons.forEach((btn) => {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const shareId = this.getAttribute("data-share-id");
        const username = this.getAttribute("data-username");

        console.log(`Revoke button clicked for user: ${username}, shareId: ${shareId}`);

        if (!username) {
          notify("Error: Unable to identify user. Please try again.", "error");
          return;
        }

        revokeAccess(shareId, username);
      });
    });
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
    const icon = HTML_TEMPLATES.notificationIcons[type] || HTML_TEMPLATES.notificationIcons.info;

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

  shareForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Get form values
    const username = fromId("share-username").value;
    const filePassword = fromId("share-file-password").value;
    const x25519KeyText = fromId("x25519-key-text").value;
    const ed25519KeyText = fromId("ed25519-key-text").value;
    const x25519FileInput = fromId("x25519-key-file");
    const ed25519FileInput = fromId("ed25519-key-file");

    // Clear previous errors
    const errorElements = [
      "share-username-error",
      "share-file-password-error",
      "x25519-key-error",
      "ed25519-key-error",
    ];
    errorElements.forEach((errorId) => {
      const errorElement = fromId(errorId);
      if (errorElement) {
        errorElement.textContent = "";
        errorElement.classList.remove("form__error--visible");
      }
    });

    // Validate inputs
    let hasErrors = false;

    if (!username.trim()) {
      const usernameError = fromId("share-username-error");
      usernameError.textContent = "Please enter a username";
      usernameError.classList.add("form__error--visible");
      hasErrors = true;
    }

    if (!filePassword.trim()) {
      const passwordError = fromId("share-file-password-error");
      passwordError.textContent = "Please enter your file password";
      passwordError.classList.add("form__error--visible");
      hasErrors = true;
    }

    // Check x25519 key (either file or text required)
    let x25519Key = "";
    if (x25519FileInput.files.length > 0) {
      try {
        x25519Key = await readFileAsText(x25519FileInput.files[0]);
      } catch (error) {
        const x25519Error = fromId("x25519-key-error");
        x25519Error.textContent = "Error reading decryption key file";
        x25519Error.classList.add("form__error--visible");
        hasErrors = true;
      }
    } else if (x25519KeyText.trim()) {
      x25519Key = x25519KeyText.trim();
    } else {
      const x25519Error = fromId("x25519-key-error");
      x25519Error.textContent = "Please provide your decryption key";
      x25519Error.classList.add("form__error--visible");
      hasErrors = true;
    }

    // Check ed25519 key (either file or text required)
    let ed25519Key = "";
    if (ed25519FileInput.files.length > 0) {
      try {
        ed25519Key = await readFileAsText(ed25519FileInput.files[0]);
      } catch (error) {
        const ed25519Error = fromId("ed25519-key-error");
        ed25519Error.textContent = "Error reading signing key file";
        ed25519Error.classList.add("form__error--visible");
        hasErrors = true;
      }
    } else if (ed25519KeyText.trim()) {
      ed25519Key = ed25519KeyText.trim();
    } else {
      const ed25519Error = fromId("ed25519-key-error");
      ed25519Error.textContent = "Please provide your signing key";
      ed25519Error.classList.add("form__error--visible");
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    const file = ownedFiles[curFileIndex];
    if (!file) {
      notify("File not found. Please refresh and try again.", "error");
      return;
    }

    const uid = localStorage.getItem("uid");
    const token = localStorage.getItem("token");

    if (!uid || !token) {
      notify("Authentication error. Please log in again.", "error");
      return;
    }

    try {
      // Disable submit button during request
      const submitBtn = fromId("share-submit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sharing...";
      }

      // Prepare the request payload
      const payload = {
        fileName: file.name,
        fileId: file.fileId,
        userId: uid,
        token: token,
        recipient: username.trim(),
        filePassword: filePassword.trim(),
        encryptedDEK: file.dekData.encrypted_dek,
        ivDEK: file.dekData.iv_dek,
        ivFile: file.ivFile,
        x25519: x25519Key,
        ed25519: ed25519Key,
      };

      const response = await fetch("/api/share-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 404) {
          // User not found
          const usernameError = fromId("share-username-error");
          usernameError.textContent = "User not found. Please check the username and try again.";
          usernameError.classList.add("form__error--visible");
        } else if (response.status === 400) {
          // Bad request - could be invalid keys or other validation error
          notify(`Invalid request: ${errorText}`, "error");
        } else {
          // Other errors
          notify(`Error sharing file: ${errorText || "Unknown error occurred"}`, "error");
        }
        return;
      }

      const responseData = await response.json();

      // Mark the file as shared
      if (file) {
        file.shared = true;
      }

      // Update the file list to reflect changes
      displayFiles(true);

      // Clear the form and close the modal
      clearShareForm();
      shareModal.classList.remove("modal--active");

      // Show success notification
      let successMessage = `"${file.name}" has been shared with ${username}.`;
      if (responseData.tofu_message) {
        successMessage += ` (${responseData.tofu_message})`;
      }
      notify(successMessage, "success");
    } catch (error) {
      console.error("Error sharing file:", error);
      notify("Network error occurred while sharing file. Please try again.", "error");
    } finally {
      // Re-enable submit button
      const submitBtn = fromId("share-submit");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Share File";
      }
    }
  });

  const dlForm = fromId("download-form");
  if (dlForm) {
    dlForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const filepw = fromId("download-password").value;
      const dlError = fromId("download-modal-password-error");

      if (!filepw) {
        dlError.textContent = "Please enter your file password";
        dlError.classList.add("form__error--visible");
        return;
      }

      if (Object.keys(fileToDownload).length === 0 || !fileToDownload.name || isInvalidSize(fileToDownload.size)) {
        dlError.classList.add("form__error--visible");
        dlError.textContent = "Invalid file selected";
        return;
      }

      const uid = localStorage.getItem("uid");
      const token = localStorage.getItem("token");

      if (!uid || !token) {
        throw new Error("User credentials have been cleared. Please log out & back in again.");
      }

      const payload = {
        fileName: fileToDownload.name,
        filePassword: filepw,
        userId: uid,
        token: token,
        encryptedDEK: fileToDownload.dekData.encrypted_dek,
        ivDEK: fileToDownload.dekData.iv_dek,
        ivFile: fileToDownload.ivFile,
      };

      try {
        // Send to server for encryption
        const res = await fetch("/api/decrypt-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const emsg = await res.text();
          throw new Error(emsg || "Error decrypting file");
        }

        await res.blob().then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileToDownload.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        });
      } catch (error) {
        dlError.textContent = error.message || "Unknown error occurred while downloading file";
        dlError.classList.add("form__error--visible");
        return;
      }

      dlModal.classList.remove("modal--active");
      dlForm.reset();

      if (fileToDownload) {
        notify(`Downloading "${fileToDownload.name}"...`, "info");

        setTimeout(() => {
          notify(`"${fileToDownload.name}" downloaded and decrypted successfully.`, "success");
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
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fileInput = fromId("file-upload");
      const selectedFilesDisplay = fromId("selected-files");
      const fileUploadError = fromId("file-upload-error");
      const filepwInput = fromId("upload-file-password");
      const filepwError = fromId("upload-file-password-error");

      // Clear previous errors
      fileUploadError.textContent = "";
      fileUploadError.classList.remove("form__error--visible");
      filepwError.textContent = "";
      filepwError.classList.remove("form__error--visible");

      // Validate file selection
      if (!fileInput || fileInput.files.length === 0) {
        fileUploadError.textContent = "Please select file(s) to upload";
        fileUploadError.classList.add("form__error--visible");
        return;
      }

      const filepw = filepwInput.value;
      if (!filepw) {
        filepwError.textContent = "Please enter your file password";
        filepwError.classList.add("form__error--visible");
        return;
      }

      const files = Array.from(fileInput.files);

      // Validate all files
      for (const file of files) {
        if (!file || !file.name || isInvalidSize(file.size)) {
          fileUploadError.textContent = `Invalid file: ${file?.name || "unknown"}`;
          fileUploadError.classList.add("form__error--visible");
          return;
        }
      }

      const uid = localStorage.getItem("uid");
      const token = localStorage.getItem("token");

      if (!uid || !token) {
        throw new Error("User credentials have been cleared. Please log out & back in again.");
      }

      try {
        // Disable the submit button during upload
        const submitBtn = fromId("upload-submit");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = `Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`;
        }

        // Upload each file separately
        const uploadPromises = files.map(async (file) => {
          const ftype = file.name.includes(".") ? file.name.split(".").pop() : "" || "unknown";

          const formData = new FormData();
          formData.append("file", file);
          formData.append("fileType", ftype);
          formData.append("filePassword", filepw);
          formData.append("userId", uid);
          formData.append("token", token);

          const res = await fetch("/api/encrypt-file", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const emsg = await res.text();
            throw new Error(`Error uploading ${file.name}: ${emsg || "Unknown error"}`);
          }

          return res.json();
        });

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        // Clear the form and selected files display
        clearSelectedFiles();

        // Close the modal and refresh the display
        uploadModal.classList.remove("modal--active");
        uploadForm.reset();
        displayFiles(true);

        // Show notification
        const fileNames = files.map((f) => f.name).join(", ");
        if (files.length === 1) {
          notify(`"${fileNames}" has been encrypted and uploaded successfully.`, "success");
        } else {
          notify(`${files.length} files have been encrypted and uploaded successfully.`, "success");
        }
      } catch (error) {
        filepwError.textContent = error.message || "Unknown error";
        filepwError.classList.add("form__error--visible");
      } finally {
        // Re-enable the submit button
        const submitBtn = fromId("upload-submit");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Upload";
        }
      }
    });
  }

  /********************************************************
   / File Upload & Drag-and-Drop
  /********************************************************/

  // Function to clear selected files display
  const clearSelectedFiles = () => {
    const selectedFilesDisplay = fromId("selected-files");
    const fileInput = fromId("file-upload");
    const fileUploadError = fromId("file-upload-error");

    if (fileInput) {
      fileInput.value = "";
    }

    if (selectedFilesDisplay) {
      selectedFilesDisplay.innerHTML = "";
    }

    if (fileUploadError) {
      fileUploadError.textContent = "";
      fileUploadError.classList.remove("form__error--visible");
    }
  };

  // Function to display selected files
  const displaySelectedFiles = (files) => {
    const selectedFilesDisplay = fromId("selected-files");
    if (!selectedFilesDisplay) return;

    selectedFilesDisplay.innerHTML = "";

    Array.from(files).forEach((file, index) => {
      const fileItem = document.createElement("div");
      fileItem.className = "selected-file has-file";
      fileItem.innerHTML = `
        <div class="selected-file__name">${file.name}</div>
        <button type="button" class="selected-file__remove" data-file-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      `;
      selectedFilesDisplay.appendChild(fileItem);

      // Add remove button functionality
      const removeBtn = fileItem.querySelector(".selected-file__remove");
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeFileByIndex(index);
      });
    });
  };

  // Function to remove a file by index
  const removeFileByIndex = (indexToRemove) => {
    const fileInput = fromId("file-upload");
    if (!fileInput || !fileInput.files) return;

    // Create a new FileList without the removed file
    const dt = new DataTransfer();
    Array.from(fileInput.files).forEach((file, index) => {
      if (index !== indexToRemove) {
        dt.items.add(file);
      }
    });

    fileInput.files = dt.files;

    // Update the display
    if (fileInput.files.length === 0) {
      clearSelectedFiles();
    } else {
      displaySelectedFiles(fileInput.files);
    }
  };

  // Setup drag and drop functionality
  const setupFileDragAndDrop = () => {
    const dropArea = fromId("file-drop-area");
    const fileInput = fromId("file-upload");
    const fileUploadError = fromId("file-upload-error");

    if (!dropArea || !fileInput) return;

    // Handle file selection
    const handleFileSelection = (files) => {
      if (!files || files.length === 0) return;

      // Clear previous errors
      if (fileUploadError) {
        fileUploadError.textContent = "";
        fileUploadError.classList.remove("form__error--visible");
      }

      // Display selected files
      displaySelectedFiles(files);
    };

    // File input change event
    fileInput.addEventListener("change", (e) => {
      handleFileSelection(e.target.files);
    });

    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        false,
      );
    });

    // Highlight drop area when dragging over it
    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        () => {
          dropArea.classList.add("drag-over");
        },
        false,
      );
    });

    // Remove highlight when leaving drop area
    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        () => {
          dropArea.classList.remove("drag-over");
        },
        false,
      );
    });

    // Handle dropped files
    dropArea.addEventListener(
      "drop",
      (e) => {
        const droppedFiles = e.dataTransfer.files;

        if (droppedFiles.length > 0) {
          // Combine existing files with new dropped files
          const existingFiles = fileInput.files || [];
          const dt = new DataTransfer();

          // Add existing files
          Array.from(existingFiles).forEach((file) => {
            dt.items.add(file);
          });

          // Add new dropped files
          Array.from(droppedFiles).forEach((file) => {
            dt.items.add(file);
          });

          fileInput.files = dt.files;
          handleFileSelection(fileInput.files);
        }
      },
      false,
    );

    // Click on drop area should trigger file input
    dropArea.addEventListener("click", (e) => {
      // Don't trigger if clicking on the Browse button (it has its own handler)
      if (!e.target.classList.contains("file-select-button") && !e.target.closest(".selected-file")) {
        fileInput.click();
      }
    });
  };

  // Setup file drag and drop
  setupFileDragAndDrop();

  /********************************************************
   / Utilities & Event Handlers
  /********************************************************/ // Function to initialize password toggles
  const setupPasswordToggles = () => {
    // Get all password toggles that are currently in the DOM
    const pwToggles = document.querySelectorAll(".form__password-toggle");

    pwToggles.forEach((toggle) => {
      // Check if this toggle already has an event listener
      if (!toggle.hasAttribute("data-pw-initialized")) {
        regPwToggle(toggle);
        toggle.setAttribute("data-pw-initialized", "true");
      }
    });
  };

  // Initial setup of password toggles
  setupPasswordToggles();

  // Setup share form file handlers
  setupShareFormFileHandlers();

  // Function to reset upload modal state (only for page load, not modal close)
  const resetUploadModalOnLoad = () => {
    const fileInput = fromId("file-upload");
    const selectedFilesDisplay = fromId("selected-files");
    const fileUploadError = fromId("file-upload-error");
    const filepwInput = fromId("upload-file-password");
    const filepwError = fromId("upload-file-password-error");

    if (fileInput) {
      fileInput.value = "";
    }

    if (selectedFilesDisplay) {
      selectedFilesDisplay.innerHTML = "";
    }

    // Clear errors
    if (fileUploadError) {
      fileUploadError.textContent = "";
      fileUploadError.classList.remove("form__error--visible");
    }
    if (filepwError) {
      filepwError.textContent = "";
      filepwError.classList.remove("form__error--visible");
    }

    // Clear password field
    if (filepwInput) {
      filepwInput.value = "";
    }
  };

  // Reset upload form on page load to ensure clean state after reload
  resetUploadModalOnLoad();

  // Check if file input has files on page load (in case of reload) and sync display
  const syncFileDisplayOnLoad = () => {
    const fileInput = fromId("file-upload");
    const selectedFilesDisplay = fromId("selected-files");

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      // File input has files but display might not be updated - force clear everything
      fileInput.value = "";
      if (selectedFilesDisplay) {
        selectedFilesDisplay.innerHTML = "";
      }
    }
  };

  // Sync file display on load
  syncFileDisplayOnLoad();

  // Close modal buttons
  closeButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const modal = this.closest(".modal");

      // Clear share form if closing share modal
      if (modal.id === "share-modal") {
        clearShareForm();
      }

      modal.classList.remove("modal--active");
    });
  });

  // Close modals when click outside
  onClick(window, (e) => {
    if (e.target.classList.contains("modal")) {
      // Clear share form if closing share modal
      if (e.target.id === "share-modal") {
        clearShareForm();
      }

      e.target.classList.remove("modal--active");
    }
  });

  onClick(signOutBtn, () => {
    // Reset auth state
    localStorage.removeItem("uid");
    localStorage.removeItem("token");
    window.location.href = "/";
  });

  // Initial display
  displayFiles(true);
  console.log("hi");
});

/**
 * Utility function to read file as text
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
