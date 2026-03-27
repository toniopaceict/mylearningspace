window.FileUploadModule = (function () {
  async function init(config) {
    const uploadBtn = document.getElementById(config.buttonId);
    const fileInput = document.getElementById(config.fileInputId);
    const studentNameInput = document.getElementById(config.studentNameInputId);
    const message = document.getElementById(config.messageId);

    if (!uploadBtn || !fileInput || !studentNameInput || !message) {
      console.error("Upload module: missing HTML elements.");
      return;
    }

    uploadBtn.addEventListener("click", async () => {
      message.textContent = "";
      message.className = "";

      const file = fileInput.files[0];
      const studentName = studentNameInput.value.trim();

      if (!studentName) {
        message.textContent = "Please enter your name.";
        message.className = "error";
        return;
      }

      if (!file) {
        message.textContent = "Please choose a file first.";
        message.className = "error";
        return;
      }

      if (config.maxFileSizeMB) {
        const maxBytes = config.maxFileSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
          message.textContent = "File is too large. Maximum size is " + config.maxFileSizeMB + " MB.";
          message.className = "error";
          return;
        }
      }

      if (config.allowedExtensions && config.allowedExtensions.length > 0) {
        const lowerName = file.name.toLowerCase();
        const isAllowed = config.allowedExtensions.some(ext => lowerName.endsWith(ext.toLowerCase()));
        if (!isAllowed) {
          message.textContent = "This file type is not allowed.";
          message.className = "error";
          return;
        }
      }

      uploadBtn.disabled = true;
      uploadBtn.textContent = config.uploadingText || "Uploading...";

      try {
        const base64Data = await readFileAsBase64(file);

        const payload = {
          folderId: config.folderId,
          assignment: config.assignment || "",
          studentName: studentName,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data: base64Data
        };

        const response = await fetch(config.webAppUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
          message.textContent = result.message + " " + result.fileName;
          message.className = "success";
          fileInput.value = "";
        } else {
          message.textContent = result.message || "Upload failed.";
          message.className = "error";
        }
      } catch (err) {
        message.textContent = "Upload failed. " + err.message;
        message.className = "error";
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = config.buttonText || "Upload File";
      }
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        const base64 = result.split(",")[1];
        resolve(base64);
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return {
    init
  };
})();
