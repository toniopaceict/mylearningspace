(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el && value != null) {
      el.textContent = value;
    }
  }

  function setLink(id, href, text) {
    const el = byId(id);
    if (!el) return;

    el.href = href || "#";

    if (text) {
      el.textContent = text;
    }
  }

  function setUploadMessage(text, colour) {
    const uploadMessage = byId("uploadMessage");
    if (!uploadMessage) return;

    uploadMessage.textContent = text;
    uploadMessage.style.color = colour || "#0b3c6f";
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.onload = function () {
        const result = reader.result || "";
        const base64 = String(result).split(",")[1] || "";
        resolve(base64);
      };

      reader.onerror = function () {
        reject(new Error("Could not read the file."));
      };

      reader.readAsDataURL(file);
    });
  }

  function initPage(config) {
    if (!config) {
      console.warn("PAGE_CONFIG is missing.");
      return;
    }

    document.title = config.pageTitle || "Practice Sheet";

    setText("heroTopline", config.topline);
    setText("heroMainTitle", config.mainTitle);
    setText("heroSubTitle", config.subTitle);

    setLink("fileLinkBtn", config.fileLink, config.fileButtonText || "Download file");

    setText("saveSubmitTitle", config.saveSubmitTitle);
    setText("submitIntroText", config.submitIntroText);
    setText("savePdfBtn", config.pdfButtonText || "Download Practice Sheet");
    setText("siteFooter", config.footerText);

    let uploadCompleted = false;

    window.MARK_COMPLETE_CONFIG = {
      webAppUrl: config.webAppUrl || "",
      exerciseCode: config.exerciseCode || "",
      inputId: "studentCode",
      buttonId: "markCompleteBtn",
      messageId: "message",
      notReadyText: "Please upload your work first.",
      isReady: () => uploadCompleted
    };

    if (window.TonioMarkComplete) {
      window.TonioMarkComplete.initMarkComplete();
      window.TonioMarkComplete.updateButtonState(true);
    } else {
      console.warn("TonioMarkComplete is not available.");
    }

    if (window.TonioPdfExport) {
      window.TonioPdfExport.initSimplePdfExport({
        buttonId: "savePdfBtn",
        sourceSelector: ".wrap",
        fallbackName: config.pdfFallbackName || "Practice Sheet",
        includeSubtitleInFileName: false
      });
    } else {
      console.warn("TonioPdfExport is not available.");
    }

    const studentNameInput = byId("studentName");
    const practiceFileInput = byId("practiceFile");
    const uploadPracticeBtn = byId("uploadPracticeBtn");

    async function uploadPracticeFile() {
      const studentName = (studentNameInput?.value || "").trim();
      const file = practiceFileInput?.files?.[0];

      if (!studentName) {
        setUploadMessage("Please enter your full name.", "#b00020");
        return;
      }

      if (!file) {
        setUploadMessage("Please choose a file to submit.", "#b00020");
        return;
      }

      const maxBytes = (config.uploadMaxFileSizeMB || 10) * 1024 * 1024;
      if (file.size > maxBytes) {
        setUploadMessage(
          `The file is too large. Maximum size is ${config.uploadMaxFileSizeMB || 10} MB.`,
          "#b00020"
        );
        return;
      }

      uploadPracticeBtn.disabled = true;
      uploadPracticeBtn.textContent = "Uploading...";
      setUploadMessage("Uploading your file...", "#0b3c6f");

      try {
        const base64Data = await fileToBase64(file);

        const safeStudentName = studentName
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "_");

        const originalFileName = file.name || "submission";
        const extensionMatch = originalFileName.match(/(\.[^.]*)$/);
        const extension = extensionMatch ? extensionMatch[1] : "";

        const finalFileName =
          safeStudentName + "_" + (config.uploadAssignment || "Practice") + extension;

        const response = await fetch(config.uploadWebAppUrl, {
          method: "POST",
          body: JSON.stringify({
            folderId: config.uploadFolderId,
            studentName: studentName,
            fileName: finalFileName,
            mimeType: file.type || "application/octet-stream",
            base64Data: base64Data,
            assignment: config.uploadAssignment
          })
        });

        if (!response.ok) {
          throw new Error("Upload failed. Please try again.");
        }

        const result = await response.json();

        if (result && result.success) {
          uploadCompleted = true;
          setUploadMessage(
            "File uploaded successfully. You may now mark this practice sheet as complete.",
            "#0b7a3d"
          );

          if (window.TonioMarkComplete) {
            window.TonioMarkComplete.updateButtonState(true);
          }
        } else {
          throw new Error(result?.message || "Upload failed.");
        }
      } catch (error) {
        uploadCompleted = false;
        setUploadMessage(error.message || "Upload failed.", "#b00020");

        if (window.TonioMarkComplete) {
          window.TonioMarkComplete.updateButtonState(true);
        }
      } finally {
        uploadPracticeBtn.disabled = false;
        uploadPracticeBtn.textContent = "Submit";
      }
    }

    uploadPracticeBtn?.addEventListener("click", uploadPracticeFile);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPage(window.PAGE_CONFIG);
  });
})();