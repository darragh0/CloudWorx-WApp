/**
 * CloudWorx Files Page JavaScript
 */

// Mock data for demonstration
const ALL_FILES = [
  {
    id: 1,
    name: "Project Documentation.pdf",
    owner: "me",
    size: "2.4 MB",
    modified: "2025-05-15",
    shared: false,
  },
  {
    id: 2,
    name: "Financial Report.xlsx",
    owner: "me",
    size: "1.8 MB",
    modified: "2025-05-10",
    shared: true,
  },
  {
    id: 3,
    name: "Presentation.pptx",
    owner: "john_doe",
    size: "4.2 MB",
    modified: "2025-05-18",
    shared: true,
  },
  {
    id: 4,
    name: "Meeting Notes.docx",
    owner: "me",
    size: "620 KB",
    modified: "2025-05-20",
    shared: false,
  },
];

document.addEventListener("DOMContentLoaded", () => {
  const filterButtons = document.querySelectorAll(".filter-btn");
  const filesList = document.getElementById("files-list");
  const uploadBtn = document.getElementById("upload-file-btn");
  const uploadModal = document.getElementById("upload-modal");
  const shareModal = document.getElementById("share-modal");
  const closeButtons = document.querySelectorAll(".modal__close");
  const signOutBtn = document.getElementById("sign-out-btn");

  let curFilter = "all";
  let curFileId = null;

  // Filter functionality
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.getAttribute("data-filter");
      curFilter = filter;

      // Update active button
      filterButtons.forEach((btn) =>
        btn.classList.remove("filter-btn--active")
      );
      btn.classList.add("filter-btn--active");

      // Update displayed files
      displayFiles();
    });
  });

  // Display files based on current filter
  function displayFiles() {
    let filteredFiles = [];

    switch (curFilter) {
      case "owned":
        filteredFiles = ALL_FILES.filter((file) => file.owner === "me");
        break;
      case "shared":
        filteredFiles = ALL_FILES.filter((file) => file.owner !== "me");
        break;
      case "all":
      default:
        filteredFiles = ALL_FILES;
        break;
    }

    // Clear the list
    filesList.innerHTML = "";

    if (filteredFiles.length === 0) {
      filesList.innerHTML = `
        <tr>
          <td colspan="5" class="no-files-message">No files found</td>
        </tr>
      `;
      return;
    }

    // Add files to the list
    filteredFiles.forEach((file) => {
      const isOwned = file.owner === "me";

      filesList.innerHTML += `
        <tr data-file-id="${file.id}" class="${
        file.owner !== "me" ? "shared-file-row" : ""
      }">
          <td>
            <div class="file-name">
              ${
                file.owner !== "me"
                  ? '<i class="fas fa-share-alt shared-icon"></i>'
                  : ""
              }
              ${file.name}
              ${
                file.owner !== "me"
                  ? '<span class="file-badge file-badge--shared">Shared with you</span>'
                  : ""
              }
              ${
                file.owner === "me" && file.shared
                  ? '<span class="file-badge file-badge--owned">Shared by you</span>'
                  : ""
              }
            </div>
          </td>
          <td>${isOwned ? "You" : file.owner}</td>
          <td>${file.size}</td>
          <td>${formatDate(file.modified)}</td>
          <td>
            <div class="file-actions">${
              isOwned
                ? `
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
              `
                : `
                <button class="download-btn tooltip" title="Download" data-tooltip="Download file">
                  <i class="fas fa-download"></i>
                </button>
                <button class="share-btn tooltip" title="View Access" data-tooltip="View who has access">
                  <i class="fas fa-users"></i>
                </button>
                <button class="remove-btn tooltip" title="Remove from my files" data-tooltip="Remove (only for you)">
                  <i class="fas fa-times"></i>
                </button>
              `
            }
            </div>
          </td>
        </tr>
      `;
    });

    // Attach event listeners to buttons
    attachActionListeners();
  }

  // Format date for display
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
  }

  // Attach event listeners to file action buttons
  function attachActionListeners() {
    // Download buttons
    document.querySelectorAll(".download-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileId = this.closest("tr").getAttribute("data-file-id");
        downloadFile(fileId);
      });
    });

    // Share buttons
    document.querySelectorAll(".share-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileId = this.closest("tr").getAttribute("data-file-id");
        openShareModal(fileId);
      });
    });

    // Delete buttons
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileId = this.closest("tr").getAttribute("data-file-id");
        deleteFile(fileId);
      });
    });

    // Remove buttons (for files shared with the user)
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fileId = this.closest("tr").getAttribute("data-file-id");
        removeSharedFile(fileId);
      });
    });
  }

  // Create custom confirmation dialog element
  function createCustomConfirmDialog() {
    // Check if dialog already exists
    if (document.getElementById("custom-confirm-dialog")) return;

    const dialog = document.createElement("div");
    dialog.className = "custom-confirm";
    dialog.id = "custom-confirm-dialog";

    dialog.innerHTML = `
      <div class="custom-confirm__content">
        <h3 class="custom-confirm__title">Confirm Action</h3>
        <p class="custom-confirm__message" id="confirm-message"></p>
        <div class="custom-confirm__actions">
          <button class="custom-confirm__button custom-confirm__button--cancel" id="confirm-cancel">Cancel</button>
          <button class="custom-confirm__button custom-confirm__button--confirm" id="confirm-ok">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Add event listeners
    document.getElementById("confirm-cancel").addEventListener("click", () => {
      hideCustomConfirm();
    });

    // Close on click outside
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        hideCustomConfirm();
      }
    });
  }

  // Function to show custom confirm dialog
  function showCustomConfirm(message, confirmCallback) {
    // Create dialog if it doesn't exist
    createCustomConfirmDialog();

    const dialog = document.getElementById("custom-confirm-dialog");
    const messageEl = document.getElementById("confirm-message");
    const confirmBtn = document.getElementById("confirm-ok");

    // Set message
    messageEl.textContent = message;

    // Clear previous event listener and add new one
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener("click", () => {
      hideCustomConfirm();
      confirmCallback();
    });

    // Show dialog
    dialog.classList.add("custom-confirm--visible");
  }

  // Function to hide custom confirm dialog
  function hideCustomConfirm() {
    const dialog = document.getElementById("custom-confirm-dialog");
    if (dialog) {
      dialog.classList.remove("custom-confirm--visible");
    }
  }

  // File operations
  function downloadFile(fileId) {
    const file = ALL_FILES.find((f) => f.id == fileId);
    showNotification(`Downloading "${file.name}"...`, "info");

    // In a real application, this would initiate a file download
    // Simulate download completion after a delay
    setTimeout(() => {
      showNotification(`"${file.name}" downloaded successfully.`, "success");
    }, 1500);
  }

  function openShareModal(fileId) {
    curFileId = fileId;
    const file = ALL_FILES.find((f) => f.id == fileId);

    // Set file name in modal
    document.getElementById("share-file-name").textContent = file.name;

    // Display users with access (mock data)
    const usersListElement = document.getElementById("users-with-access");

    if (file.owner === "me" && file.shared) {
      usersListElement.innerHTML = `
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
      `;

      // Add event listeners to revoke buttons
      document.querySelectorAll(".revoke-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
          const username = this.parentElement
            .querySelector(".username")
            .textContent.trim();
          revokeAccess(username);
        });
      });
    } else if (file.owner !== "me") {
      usersListElement.innerHTML = `
        <div class="user-item">
          <div class="username">
            <i class="fas fa-user"></i>
            ${file.owner} (Owner)
          </div>
        </div>
        <div class="user-item">
          <div class="username">
            <i class="fas fa-user"></i>
            You
          </div>
        </div>
      `;
    } else {
      usersListElement.innerHTML = `
        <div class="no-users-message">
          No users have access to this file yet. Use the form below to share this file.
        </div>
      `;
    }

    // Show share form only if user is the owner
    const shareForm = document.getElementById("share-form");
    if (file.owner === "me") {
      shareForm.style.display = "block";
    } else {
      shareForm.style.display = "none";
    }

    // Show the modal
    shareModal.classList.add("modal--active");
  }

  function deleteFile(fileId) {
    const file = ALL_FILES.find((f) => f.id == fileId);

    // If the file is shared, show a special confirmation
    if (file.shared) {
      showCustomConfirm(
        `This file is shared with other users. Deleting it will revoke access for all users. Are you sure you want to delete "${file.name}"?`,
        function () {
          // Get the file row element
          const fileRow = document.querySelector(
            `tr[data-file-id="${fileId}"]`
          );

          // Add a fade-out animation
          if (fileRow) {
            fileRow.style.transition = "opacity 0.5s, transform 0.5s";
            fileRow.style.opacity = "0";
            fileRow.style.transform = "translateX(20px)";
          }

          // Wait for animation to complete before removing from data
          setTimeout(() => {
            // In a real application, this would send a delete request to the server and handle revoking access
            const index = ALL_FILES.findIndex((f) => f.id == fileId);
            if (index !== -1) {
              ALL_FILES.splice(index, 1);
              displayFiles();

              // Show notification
              showNotification(
                `"${file.name}" has been permanently deleted and all shared access has been revoked.`,
                "success"
              );
            }
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
            `tr[data-file-id="${fileId}"]`
          );

          // Add a fade-out animation
          if (fileRow) {
            fileRow.style.transition = "opacity 0.5s, transform 0.5s";
            fileRow.style.opacity = "0";
            fileRow.style.transform = "translateX(20px)";
          }

          // Wait for animation to complete before removing from data
          setTimeout(() => {
            // In a real application, this would send a delete request to the server
            const index = ALL_FILES.findIndex((f) => f.id == fileId);
            if (index !== -1) {
              ALL_FILES.splice(index, 1);
              displayFiles();

              // Show notification
              showNotification(
                `"${file.name}" has been permanently deleted.`,
                "success"
              );
            }
          }, 500); // Match transition duration
        }
      );
    }
  }

  function revokeAccess(username) {
    showCustomConfirm(
      `Are you sure you want to revoke access for ${username}?`,
      function () {
        // In a real application, this would update the access permissions
        showNotification(`Access revoked for ${username}`, "success");
        shareModal.classList.remove("modal--active");
      }
    );
  }

  // Function to remove a shared file from the user's view
  function removeSharedFile(fileId) {
    const file = ALL_FILES.find((f) => f.id == fileId);

    showCustomConfirm(
      `Are you sure you want to remove "${file.name}" from your files? You will no longer have access to this file.`,
      function () {
        // In a real application, this would remove the file from the user's shared files
        // but not delete the actual file or affect other users' access

        // Get the file row element
        const fileRow = document.querySelector(`tr[data-file-id="${fileId}"]`);

        // Add a fade-out animation
        if (fileRow) {
          fileRow.style.transition = "opacity 0.5s, transform 0.5s";
          fileRow.style.opacity = "0";
          fileRow.style.transform = "translateX(20px)";
        }

        // Wait for animation to complete before removing from data
        setTimeout(() => {
          // For this demo, we'll just remove it from the mockFiles array
          const index = ALL_FILES.findIndex((f) => f.id == fileId);
          if (index !== -1) {
            ALL_FILES.splice(index, 1);
            displayFiles();

            // Show custom confirmation notification instead of alert
            showNotification(
              `"${file.name}" has been removed from your files.`,
              "success"
            );
          }
        }, 500); // Match transition duration
      }
    );
  }

  // Function to show custom notifications
  function showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification notification--${type}`;

    // Add icon based on type
    let icon = "info-circle";
    if (type === "success") icon = "check-circle";
    if (type === "error") icon = "exclamation-circle";

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

  // Share form submission
  const shareForm = document.getElementById("share-form");
  if (shareForm) {
    shareForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const username = document.getElementById("share-username").value;

      if (!username) {
        document.getElementById("share-username-error").textContent =
          "Please enter a username";
        document
          .getElementById("share-username-error")
          .classList.add("form__error--visible");
        return;
      }

      // In a real application, this would share the file with the user
      const file = ALL_FILES.find((f) => f.id == curFileId);

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
      showNotification(
        `"${file.name}" has been shared with ${username}.`,
        "success"
      );
    });
  }

  // Upload button
  if (uploadBtn) {
    uploadBtn.addEventListener("click", function () {
      uploadModal.classList.add("modal--active");
    });
  }

  // Upload form
  const uploadForm = document.getElementById("upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const fileInput = document.getElementById("file-upload");

      if (!fileInput.files || fileInput.files.length === 0) {
        return;
      }

      const file = fileInput.files[0];

      // In a real application, this would upload the file to the server
      // For now, we'll add it to our mock data
      const newFile = {
        id: ALL_FILES.length + 1,
        name: file.name,
        owner: "me",
        size: formatFileSize(file.size),
        modified: new Date().toISOString().split("T")[0],
        shared: false,
      };

      ALL_FILES.unshift(newFile);

      // Clear the form, close the modal, and refresh the display
      this.reset();
      uploadModal.classList.remove("modal--active");
      displayFiles();

      // Show notification
      showNotification(
        `"${file.name}" has been uploaded successfully.`,
        "success"
      );
    });
  }

  // Format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  }

  // Close modal buttons
  closeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const modal = this.closest(".modal");
      modal.classList.remove("modal--active");
    });
  });

  // Close modals when clicking outside
  window.addEventListener("click", function (e) {
    if (e.target.classList.contains("modal")) {
      e.target.classList.remove("modal--active");
    }
  });

  // Handle sign out
  if (signOutBtn) {
    signOutBtn.addEventListener("click", function () {
      // Clear authentication state
      localStorage.removeItem("authenticated");
      // Redirect to home page
      window.location.href = "../index.html";
    });
  }

  // Initial display
  displayFiles();
});
