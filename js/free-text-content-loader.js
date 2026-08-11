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

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function questionMarkup(source, index) {
    const questionId = text(source.getAttribute("data-question-id")) || "question_" + (index + 1);
    const recommendedValue = Number(source.getAttribute("data-recommended-length") || 0);
    const recommended = Number.isFinite(recommendedValue) && recommendedValue > 0
      ? Math.floor(recommendedValue)
      : 0;
    const prompt = text(source.textContent) || "Question " + (index + 1);
    const number = index + 1;

    return `
      <fieldset
        class="task-box readable-section free-text-question"
        data-question-id="${escapeHtml(questionId)}"
        data-recommended-length="${recommended}">

        <legend>Question ${number}</legend>

        <button
          type="button"
          class="speak-btn"
          onclick="speakSection(this)"
          aria-label="Read Question ${number} aloud">
          🔊
        </button>

        <p class="q free-text-prompt" data-read>${escapeHtml(prompt)}</p>

        <div class="free-text-toolbar no-print" aria-label="Answer formatting">
          <button
            type="button"
            class="glip-btn glip-btn-secondary free-text-format-btn"
            data-format-command="bold"
            aria-label="Bold"
            title="Bold"><strong>B</strong></button>

          <button
            type="button"
            class="glip-btn glip-btn-secondary free-text-format-btn"
            data-format-command="italic"
            aria-label="Italic"
            title="Italic"><em>I</em></button>

          <button
            type="button"
            class="glip-btn glip-btn-secondary free-text-format-btn"
            data-format-command="underline"
            aria-label="Underline"
            title="Underline"><u>U</u></button>
        </div>

        <div
          class="free-text-editor"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-label="Answer to Question ${number}"
          data-placeholder="Type your answer here..."
          spellcheck="true"></div>

        <div class="free-text-answer-meta no-print">
          <span class="free-text-character-count" aria-live="polite">0${recommended ? " / " + recommended : ""} characters</span>

          <div class="free-text-speech-actions">
            <button type="button" class="glip-btn free-text-read-btn">
              Read my answer
            </button>
            <button type="button" class="glip-btn glip-btn-secondary free-text-stop-btn">
              Stop
            </button>
          </div>
        </div>

        <p class="free-text-speech-status panel-message hidden" role="status" aria-live="polite"></p>
      </fieldset>
    `;
  }

  function applyQuestions(root) {
    const target = byId("freeTextQuestionsContainer");
    if (!target) return;

    const questions = Array.from(root.querySelectorAll("[data-free-text-question]"));
    target.innerHTML = questions.map(questionMarkup).join("");
  }

  function applyContent(documentRoot, sourceUrl) {
    const root = documentRoot.querySelector("#freeTextContentData");

    if (!root) {
      throw new Error("The Free Text content file does not contain #freeTextContentData.");
    }

    applyQuestions(root);

    document.dispatchEvent(
      new CustomEvent("glipFreeTextContentLoaded", {
        detail: {
          fileName: getContentFileName(),
          url: sourceUrl
        }
      })
    );
  }

  function showLoadError(message) {
    const target = byId("freeTextQuestionsContainer");
    if (!target) return;

    target.innerHTML = "";
    const box = document.createElement("p");
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "The Free Text content could not be loaded.";
    target.appendChild(box);
  }

  function load() {
    const fileName = getContentFileName();
    const url = getContentUrl();

    if (loadPromise && url && url === contentUrl) return loadPromise;

    loadPromise = null;
    contentUrl = url;

    if (!fileName || !url) {
      loadPromise = Promise.reject(
        new Error("The Free Text content file could not be determined.")
      );
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
        console.error("Could not load Free Text content.", error);
        showLoadError(
          "The Free Text content could not be loaded. Please contact your teacher."
        );
        throw error;
      });

    return loadPromise;
  }

  document.addEventListener("glipTopicContextRefreshed", function () {
    Promise.resolve(load()).catch(function () {
      // load() already displays the user-facing error.
    });
  });

  window.GLIPFreeTextContent = {
    load: load,
    getContentFileName: getContentFileName,
    getContentUrl: function () { return contentUrl || getContentUrl(); }
  };
})(window);
