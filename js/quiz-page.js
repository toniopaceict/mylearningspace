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

  function initPage(config, questions, extraBox) {
    if (!config) {
      console.warn("PAGE_CONFIG is missing.");
      return;
    }

    document.title = config.pageTitle || "Quiz";

    setText("heroTopline", config.topline);
    setText("heroMainTitle", config.mainTitle);
    setText("heroSubTitle", config.subTitle);
    setText("instructionsText", config.instructionsText);
    setText("pdfBoxTitle", config.pdfBoxTitle || "Save your work as a PDF");
    setText("savePdfBtn", config.pdfButtonText || "Save as PDF");
    setText("siteFooter", config.footerText);

    let uploadCompleted = false;

    window.MARK_COMPLETE_CONFIG = {
      webAppUrl: config.webAppUrl || "",
      exerciseCode: config.exerciseCode || "",
      inputId: "studentCode",
      buttonId: "markCompleteBtn",
      messageId: "message",
      notReadyText: "Please upload your PDF copy first.",
      isReady: () => uploadCompleted
    };

    if (window.TonioQuiz) {
      window.TonioQuiz.initMainQuiz({
        formId: "quiz",
        containerId: "quizContainer",
        scoreBoxId: "scoreBox",
        resetBtnId: "resetBtnTop",
        questions: questions || [],
        extraInstructionBeforeQuestionId: extraBox?.enabled ? extraBox.beforeQuestionId : null,
        extraInstructionHtml: extraBox?.enabled ? extraBox.html : "",
        onStateChange: function () {
          if (window.TonioMarkComplete) {
            window.TonioMarkComplete.updateButtonState(true);
          }
        },
        onReset: function () {
          if (window.TonioMarkComplete) {
            window.TonioMarkComplete.updateButtonState(true);
          }
        }
      });
    } else {
      console.warn("TonioQuiz is not available.");
    }

    if (window.TonioMarkComplete) {
      window.TonioMarkComplete.initMarkComplete();
      window.TonioMarkComplete.updateButtonState(true);
    } else {
      console.warn("TonioMarkComplete is not available.");
    }

    if (window.TonioPdfExport) {
      window.TonioPdfExport.initQuizPdfExport({
        buttonId: "savePdfBtn",
        quizSelector: "#quizContainer",
        scoreSelector: "#scoreBox",
        fallbackName: config.pdfFallbackName || "Quiz",
        includeSubtitleInFileName: true
      });
    } else {
      console.warn("TonioPdfExport is not available.");
    }

    const studentNameInput = byId("studentName");
    const quizPdfFileInput = byId("quizPdfFile");
    const uploadQuizBtn = byId("uploadQuizBtn");

    async function uploadQuizPdf() {
      const studentName = (studentNameInput?.value || "").trim();
      const file = quizPdfFileInput?.files?.[0];

      if (!studentName) {
        setUploadMessage("Please enter your full name.", "#b00020");
        return;
      }

      if (!file) {
        setUploadMessage("Please choose the PDF file you downloaded.", "#b00020");
        return;
      }

      const fileNameLower = (file.name || "").toLowerCase();
      if (!fileNameLower.endsWith(".pdf")) {
        setUploadMessage("Only PDF files are allowed.", "#b00020");
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

      uploadQuizBtn.disabled = true;
      uploadQuizBtn.textContent = "Uploading...";
      setUploadMessage("Uploading your PDF...", "#0b3c6f");

      try {
        const base64Data = await fileToBase64(file);

        const safeStudentName = studentName
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "_");

        const finalFileName =
          safeStudentName + "_" + (config.uploadAssignment || "Quiz") + ".pdf";

        const response = await fetch(config.uploadWebAppUrl, {
          method: "POST",
          body: JSON.stringify({
            folderId: config.uploadFolderId,
            studentName: studentName,
            fileName: finalFileName,
            mimeType: "application/pdf",
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
            "PDF uploaded successfully. You may now mark this quiz as complete.",
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
        uploadQuizBtn.disabled = false;
        uploadQuizBtn.textContent = "Submit";
      }
    }

    uploadQuizBtn?.addEventListener("click", uploadQuizPdf);
  }

  function initialiseQuizPage() {
    if (document.documentElement.dataset.glipQuizPageReady === "true") return;
    document.documentElement.dataset.glipQuizPageReady = "true";
    initPage(window.PAGE_CONFIG, window.QUESTIONS, window.EXTRA_BOX);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseQuizPage, { once: true });
  } else {
    initialiseQuizPage();
  }
})();
