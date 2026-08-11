(function (window) {
  "use strict";

  let loadPromise = null;
  let contentUrl = "";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getContentFileName() {
    const page = window.PAGE_CONFIG || {};
    const configured = text(page.contentFile);
    if (configured) return configured;

    const activityCode = text(page.activityCode);
    return activityCode ? activityCode + "_content.html" : "";
  }

  function getContentUrl() {
    const page = window.PAGE_CONFIG || {};
    const configuredUrl = text(page.contentUrl);
    if (configuredUrl) return configuredUrl;

    const fileName = getContentFileName();
    const topicCode = text(page.topicCode);
    const baseUrl = text(window.GLIP_BASE_URL).replace(/\/$/, "");

    if (!fileName || !topicCode || !baseUrl) return "";

    return (
      baseUrl +
      "/content/topics/" +
      encodeURIComponent(topicCode) +
      "/" +
      encodeURIComponent(fileName)
    );
  }

  function resolveTopicAssetUrl(value) {
    const source = text(value);
    if (!source) return "";
    if (/^(?:https?:|data:|blob:|\/)/i.test(source)) return source;

    const page = window.PAGE_CONFIG || {};
    const topicCode = text(page.topicCode);
    const baseUrl = text(window.GLIP_BASE_URL).replace(/\/$/, "");
    if (!baseUrl || !topicCode) return source;

    return (
      baseUrl +
      "/content/topics/" +
      encodeURIComponent(topicCode) +
      "/" +
      source.replace(/^\.\//, "")
    );
  }

  function readFileSettings(root) {
    return [1, 2, 3].map(function (number) {
      const source = root.querySelector('[data-file-number="' + number + '"]');
      return {
        link: source ? text(source.getAttribute("href")) : "",
        buttonText: source ? text(source.getAttribute("data-button-text")) : ""
      };
    });
  }

  function bindDownloadProgress(button) {
    if (!button || button.dataset.quizDownloadReady) return;

    button.dataset.quizDownloadReady = "true";
    button.addEventListener("click", function () {
      const progressBar = byId("downloadProgressBar");
      const message = byId("downloadMessage");

      if (progressBar) progressBar.classList.add("show");
      if (message) {
        message.textContent = "Preparing download...";
        message.className = "panel-message text-center info";
      }

      window.setTimeout(function () {
        if (progressBar) progressBar.classList.remove("show");
        if (message) {
          message.textContent = "";
          message.className = "panel-message text-center hidden";
        }
      }, 3000);
    });
  }

  function applyFileSettings(root) {
    const page = window.PAGE_CONFIG || (window.PAGE_CONFIG = {});
    const quiz = window.QUIZ_CONFIG || (window.QUIZ_CONFIG = {});
    const files = readFileSettings(root);
    const buttonIds = ["fileLinkBtn1", "fileLinkBtn2", "fileLinkBtn3"];
    let visibleCount = 0;

    files.forEach(function (file, index) {
      const number = index + 1;
      quiz["fileLink" + number] = file.link;
      quiz["fileButtonText" + number] = file.buttonText;
      page["fileLink" + number] = file.link;
      page["fileButtonText" + number] = file.buttonText;

      const button = byId(buttonIds[index]);
      if (!button) return;

      if (file.link) {
        button.href = file.link;
        button.textContent = file.buttonText || "Download required file";
        button.style.display = "inline-flex";
        visibleCount += 1;
        bindDownloadProgress(button);
      } else {
        button.removeAttribute("href");
        button.style.display = "none";
      }
    });

    const section = byId("requiredFilesSection");
    const legend = byId("requiredFilesLegend");
    if (section) section.style.display = visibleCount > 0 ? "" : "none";
    if (legend) legend.textContent = visibleCount === 1 ? "Required File" : "Required Files";
  }

  function applyGeneralSettings(root) {
    const general = root.querySelector('[data-quiz-settings="general"]');
    const page = window.PAGE_CONFIG || (window.PAGE_CONFIG = {});
    const quiz = window.QUIZ_CONFIG || (window.QUIZ_CONFIG = {});

    const instructions = general ? general.querySelector("[data-instructions]") : null;
    const pdfTitle = general ? general.querySelector("[data-pdf-title]") : null;
    const pdfButtonText = general ? general.querySelector("[data-pdf-button-text]") : null;
    const pdfFallbackName = general ? general.querySelector("[data-pdf-fallback-name]") : null;

    quiz.instructionsText = instructions ? text(instructions.textContent) : "";
    quiz.pdfBoxTitle = pdfTitle ? text(pdfTitle.textContent) : "Save your work as a PDF and keep a copy for future reference.";
    quiz.pdfButtonText = pdfButtonText ? text(pdfButtonText.textContent) : "Save as PDF";
    quiz.pdfFallbackName = pdfFallbackName ? text(pdfFallbackName.textContent) : "Quiz";

    page.instructionsText = quiz.instructionsText;
    page.pdfBoxTitle = quiz.pdfBoxTitle;
    page.pdfButtonText = quiz.pdfButtonText;
    page.pdfFallbackName = quiz.pdfFallbackName;
  }

  function readQuestion(source, index) {
    const id = text(source.getAttribute("data-question-id")) || "q" + (index + 1);
    const title = text(source.getAttribute("data-title")) || "Q" + (index + 1);
    const marks = Number(source.getAttribute("data-marks")) || 1;
    const correct = text(source.getAttribute("data-correct"));
    const questionText = source.querySelector("[data-question-text]");
    const optionsRoot = source.querySelector("[data-options]");
    const fbOk = source.querySelector("[data-feedback-correct]");
    const fbBad = source.querySelector("[data-feedback-incorrect]");
    const image = source.querySelector("[data-question-image]");

    const options = optionsRoot
      ? Array.from(optionsRoot.querySelectorAll("[data-value]")).map(function (option) {
          return {
            value: text(option.getAttribute("data-value")),
            label: text(option.textContent)
          };
        }).filter(function (option) { return option.value; })
      : [];

    const question = {
      id: id,
      title: title,
      marks: marks,
      text: questionText ? text(questionText.textContent) : "",
      correct: correct,
      options: options,
      fbOk: fbOk ? text(fbOk.textContent) : "Correct.",
      fbBad: fbBad ? text(fbBad.textContent) : "Not correct."
    };

    if (image) {
      question.imageSrc = resolveTopicAssetUrl(image.getAttribute("src"));
      question.imageFull = resolveTopicAssetUrl(image.getAttribute("data-full")) || question.imageSrc;
      question.imageAlt = text(image.getAttribute("alt"));
      question.imageCaption = text(image.getAttribute("data-caption"));
    }

    return question;
  }

  function applyQuestions(root) {
    const questions = Array.from(root.querySelectorAll("[data-quiz-question]")).map(readQuestion);
    window.QUESTIONS = questions;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function applyExtraBox(root) {
    const source = root.querySelector("[data-extra-box]");
    if (!source) {
      window.EXTRA_BOX = { enabled: false, beforeQuestionId: "", html: "" };
      return;
    }

    const enabled = text(source.getAttribute("data-enabled")).toLowerCase() === "true";
    const beforeQuestionId = text(source.getAttribute("data-before-question-id"));
    const title = text(source.getAttribute("data-title")) || "Extra Instructions";
    const content = source.querySelector("[data-extra-content]");

    window.EXTRA_BOX = {
      enabled: enabled,
      beforeQuestionId: beforeQuestionId,
      html: enabled
        ? '<fieldset class="task-box readable-section"><legend>' + escapeHtml(title) + '</legend>' +
          '<button type="button" class="speak-btn" onclick="speakSection(this)" aria-label="Read the extra instructions aloud">🔊</button>' +
          '<div data-read>' + (content ? content.innerHTML : "") + '</div></fieldset>'
        : ""
    };
  }

  function applyContent(documentRoot, sourceUrl) {
    const root = documentRoot.querySelector("#quizContentData");
    if (!root) {
      throw new Error("The Quiz content file does not contain #quizContentData.");
    }

    applyFileSettings(root);
    applyGeneralSettings(root);
    applyQuestions(root);
    applyExtraBox(root);

    document.dispatchEvent(
      new CustomEvent("glipQuizContentLoaded", {
        detail: {
          fileName: getContentFileName(),
          url: sourceUrl
        }
      })
    );
  }

  function showLoadError(message) {
    const target = byId("quizContainer");
    if (!target) return;

    target.innerHTML = "";
    const box = document.createElement("p");
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "The Quiz content could not be loaded.";
    target.appendChild(box);
  }

  function load() {
    const fileName = getContentFileName();
    const url = getContentUrl();

    if (loadPromise && url && url === contentUrl) return loadPromise;

    loadPromise = null;
    contentUrl = url;

    if (!fileName || !url) {
      loadPromise = Promise.reject(new Error("The Quiz content file could not be determined."));
      return loadPromise;
    }

    loadPromise = fetch(url, { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load " + fileName + ".");
        return response.text();
      })
      .then(function (html) {
        const parser = new DOMParser();
        const documentRoot = parser.parseFromString(html, "text/html");
        applyContent(documentRoot, url);
        return true;
      })
      .catch(function (error) {
        loadPromise = null;
        console.error("Could not load Quiz content.", error);
        showLoadError("The Quiz content could not be loaded. Please contact your teacher.");
        throw error;
      });

    return loadPromise;
  }

  document.addEventListener("glipTopicContextRefreshed", function () {
    Promise.resolve(load()).catch(function () {
      // load() already displays the user-facing error.
    });
  });

  window.GLIPQuizContent = {
    load: load,
    getContentFileName: getContentFileName,
    getContentUrl: function () { return contentUrl || getContentUrl(); }
  };
})(window);
