(function (window) {
  "use strict";

  let loadPromise = null;
  let contentUrl = "";

  function byId(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getContentFileName() {
    const config = window.PAGE_CONFIG || {};
    const code = text(config.activityCode || config.activity_code);
    return code ? code + "_content.html" : "";
  }

  function getTopicCode() {
    const config = window.PAGE_CONFIG || {};
    return text(config.topicCode || config.topic_code);
  }

  function getContentUrl() {
    const fileName = getContentFileName();
    const topicCode = getTopicCode();
    const baseUrl = text(window.GLIP_BASE_URL).replace(/\/$/, "");
    if (!fileName || !topicCode || !baseUrl) return "";
    return baseUrl + "/content/topics/" + encodeURIComponent(topicCode) + "/" + encodeURIComponent(fileName);
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
    if (!button || button.dataset.sortingDownloadReady) return;
    button.dataset.sortingDownloadReady = "true";
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
    const files = readFileSettings(root);
    const buttonIds = ["fileLinkBtn1", "fileLinkBtn2", "fileLinkBtn3"];
    let visibleCount = 0;

    files.forEach(function (file, index) {
      const number = index + 1;
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

  function applyInstructions(root) {
    const target = byId("sortingInstructions");
    if (!target) return;
    const source = root.querySelector("[data-sorting-instructions]");
    target.innerHTML = source ? source.innerHTML : "<p>Arrange the items in the correct order.</p>";
  }

  function shuffledIndexes(length) {
    const indexes = Array.from({ length: length }, function (_value, index) { return index; });
    if (length < 2) return indexes;

    function shuffle() {
      for (let i = indexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = indexes[i];
        indexes[i] = indexes[j];
        indexes[j] = tmp;
      }
    }

    // Avoid occasionally presenting the already-correct order.
    for (let attempt = 0; attempt < 8; attempt++) {
      shuffle();
      if (indexes.some(function (value, index) { return value !== index; })) break;
    }
    return indexes;
  }

  function questionMarkup(source, index) {
    const questionId = text(source.getAttribute("data-question-id")) || "q" + (index + 1);
    const title = text(source.getAttribute("data-title")) || "Question " + (index + 1);
    const promptSource = source.querySelector("[data-prompt]");
    const prompt = promptSource ? text(promptSource.textContent) : "Arrange the items in the correct order.";
    const feedbackSource = source.querySelector("[data-feedback]");
    const formativeFeedback = feedbackSource ? text(feedbackSource.textContent) : "Review the sequence and try again.";
    const itemSources = Array.from(source.querySelectorAll("[data-sorting-items] > li"));

    if (itemSources.length < 2) {
      throw new Error(title + " must contain at least two sorting items.");
    }

    const items = itemSources.map(function (item, itemIndex) {
      return {
        key: questionId + "_item_" + (itemIndex + 1),
        value: text(item.textContent),
        correctPosition: itemIndex + 1
      };
    });
    const order = shuffledIndexes(items.length);

    const itemHtml = order.map(function (itemIndex, displayIndex) {
      const item = items[itemIndex];
      return `
        <li
          class="sorting-item"
          draggable="true"
          tabindex="0"
          data-sort-item
          data-sort-key="${escapeHtml(item.key)}"
          data-correct-position="${item.correctPosition}"
          aria-label="Position ${displayIndex + 1}: ${escapeHtml(item.value)}">
          <span class="sorting-handle" aria-hidden="true">☰</span>
          <span class="sorting-position" aria-hidden="true">${displayIndex + 1}.</span>
          <span class="sorting-item-text" data-read>${escapeHtml(item.value)}</span>
          <span class="sorting-move-controls no-print">
            <button type="button" class="sorting-move-btn sorting-move-up" aria-label="Move ${escapeHtml(item.value)} up" title="Move up">▲</button>
            <button type="button" class="sorting-move-btn sorting-move-down" aria-label="Move ${escapeHtml(item.value)} down" title="Move down">▼</button>
          </span>
          <span class="sorting-result-symbol" aria-hidden="true"></span>
        </li>`;
    }).join("");

    return `
      <fieldset
        class="task-box readable-section sorting-question"
        data-sorting-question-rendered
        data-question-id="${escapeHtml(questionId)}"
        data-question-title="${escapeHtml(title)}"
        data-formative-feedback="${escapeHtml(formativeFeedback)}">
        <legend>${escapeHtml(title)}</legend>

        <button
          type="button"
          class="speak-btn no-print"
          onclick="speakSection(this)"
          aria-label="Read ${escapeHtml(title)} and the current order aloud">
          🔊
        </button>

        <p class="q" data-read>${escapeHtml(prompt)}</p>

        <ol class="sorting-list" data-sorting-list aria-label="Items to arrange in order">
          ${itemHtml}
        </ol>

        <div class="drag-actions no-print">
          <button type="button" class="glip-btn check-sorting-btn">Check Answers</button>
          <button type="button" class="glip-btn glip-btn-secondary reset-sorting-btn">Reset</button>
        </div>

        <div class="sorting-feedback fb readable-section hidden" aria-live="polite">
          <button
            type="button"
            class="speak-btn no-print"
            onclick="speakSection(this)"
            aria-label="Read the feedback aloud">
            🔊
          </button>
          <span class="sorting-feedback-text" data-read></span>
        </div>
      </fieldset>`;
  }

  function applyQuestions(root) {
    const target = byId("sortingQuestionsContainer");
    if (!target) return;
    const questions = Array.from(root.querySelectorAll("[data-sorting-question]"));
    target.innerHTML = questions.map(questionMarkup).join("");
    if (window.GLIPSorting && typeof window.GLIPSorting.setup === "function") {
      window.GLIPSorting.setup(target);
    }
  }

  function applyContent(documentRoot, sourceUrl) {
    const root = documentRoot.querySelector("#sortingContentData");
    if (!root) throw new Error("The Sorting content file does not contain #sortingContentData.");
    applyFileSettings(root);
    applyInstructions(root);
    applyQuestions(root);
    document.dispatchEvent(new CustomEvent("glipSortingContentLoaded", {
      detail: { fileName: getContentFileName(), url: sourceUrl }
    }));
  }

  function showLoadError(message) {
    const target = byId("sortingQuestionsContainer");
    if (!target) return;
    target.innerHTML = "";
    const box = document.createElement("p");
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "The Sorting content could not be loaded.";
    target.appendChild(box);
  }

  function load() {
    const nextUrl = getContentUrl();
    if (!nextUrl) {
      showLoadError("The sorting content could not be loaded. Please contact your teacher.");
      return Promise.reject(new Error("Sorting content URL could not be resolved."));
    }
    if (loadPromise && contentUrl === nextUrl) return loadPromise;
    contentUrl = nextUrl;
    loadPromise = fetch(nextUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Sorting content file was not found.");
        return response.text();
      })
      .then(function (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        applyContent(doc, nextUrl);
        return true;
      })
      .catch(function (error) {
        loadPromise = null;
        showLoadError("The sorting content could not be loaded. Please contact your teacher.");
        throw error;
      });
    return loadPromise;
  }

  function refreshIfNeeded() {
    const nextUrl = getContentUrl();
    if (!nextUrl || nextUrl === contentUrl) return;
    load().catch(function (error) { console.error("Sorting content could not be refreshed.", error); });
  }

  document.addEventListener("glipTopicContextRefreshed", refreshIfNeeded);

  window.GLIPSortingContent = {
    load: load,
    getContentUrl: getContentUrl
  };
})(window);
