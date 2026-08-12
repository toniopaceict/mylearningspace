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
      .replace(/\"/g, "&quot;")
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
    if (!button || button.dataset.matchingDownloadReady) return;

    button.dataset.matchingDownloadReady = "true";
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
    const target = byId("matchingInstructions");
    if (!target) return;

    const source = root.querySelector("[data-matching-instructions]");
    if (!source) {
      target.innerHTML = "<p>Match each item with the correct answer.</p>";
      return;
    }

    target.innerHTML = source.innerHTML;
  }

  function shuffledCopy(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function questionMarkup(source, index) {
    const questionId = text(source.getAttribute("data-question-id")) || "q" + (index + 1);
    const title = text(source.getAttribute("data-title")) || "Question " + (index + 1);
    const feedbackSource = source.querySelector("[data-feedback]");
    const formativeFeedback = feedbackSource ? text(feedbackSource.textContent) : "Review the ideas in this question and try again.";
    const promptSource = source.querySelector("[data-prompt]");
    const prompt = promptSource ? text(promptSource.textContent) : "Match the items below.";
    const pairSources = Array.from(source.querySelectorAll("[data-pair]"));

    if (!pairSources.length) {
      throw new Error(title + " does not contain any data-pair elements.");
    }

    const pairs = pairSources.map(function (pair, pairIndex) {
      const left = pair.querySelector("[data-left]");
      const right = pair.querySelector("[data-right]");
      if (!left || !right) {
        throw new Error(title + " contains a pair without both data-left and data-right.");
      }
      return {
        key: questionId + "_pair_" + (pairIndex + 1),
        left: text(left.textContent),
        right: text(right.textContent)
      };
    });

    const options = shuffledCopy(pairs);
    const readableItems = pairs.map(function (pair, pairIndex) {
      return "Item " + (pairIndex + 1) + ": " + pair.left;
    }).join(". ");
    const readableOptions = options.map(function (pair, optionIndex) {
      return "Option " + (optionIndex + 1) + ": " + pair.right;
    }).join(". ");

    const rowsHtml = pairs.map(function (pair, pairIndex) {
      return `
        <li>
          <span>${escapeHtml(pair.left)}</span>
          <span
            class="drop-zone matching-drop-zone"
            data-match-zone
            data-zone-number="${pairIndex + 1}"
            data-correct-key="${escapeHtml(pair.key)}"
            tabindex="0"
            role="button"
            aria-label="Matching box for ${escapeHtml(pair.left)}">
            Match
          </span>
        </li>
      `;
    }).join("");

    const optionsHtml = options.map(function (pair) {
      return `
        <div
          class="drag-option"
          draggable="true"
          tabindex="0"
          role="button"
          data-match-option
          data-match-key="${escapeHtml(pair.key)}"
          data-value="${escapeHtml(pair.right)}">
          ${escapeHtml(pair.right)}
        </div>
      `;
    }).join("");

    return `
      <fieldset
        class="task-box readable-section matching-question"
        data-matching-question-rendered
        data-question-id="${escapeHtml(questionId)}"
        data-question-title="${escapeHtml(title)}"
        data-formative-feedback="${escapeHtml(formativeFeedback)}">
        <legend>${escapeHtml(title)}</legend>

        <button
          type="button"
          class="speak-btn no-print"
          onclick="speakSection(this)"
          aria-label="Read ${escapeHtml(title)} and the matching options aloud">
          🔊
        </button>

        <p class="q" data-read>${escapeHtml(prompt)}</p>
        <p class="q visually-hidden" data-read>${escapeHtml(readableItems + ". " + readableOptions + ".")}</p>

        <ol class="q" aria-label="Items to match">
          ${rowsHtml}
        </ol>

        <p class="q"><strong>Answer bank</strong></p>
        <div class="drag-options" aria-label="Matching answer bank">
          ${optionsHtml}
        </div>

        <div class="drag-actions no-print">
          <button type="button" class="glip-btn check-matching-btn">Check Answers</button>
          <button type="button" class="glip-btn glip-btn-secondary reset-matching-btn">Reset</button>
        </div>

        <div class="matching-feedback fb readable-section hidden" aria-live="polite">
          <button
            type="button"
            class="speak-btn no-print"
            onclick="speakSection(this)"
            aria-label="Read the feedback aloud">
            🔊
          </button>
          <span class="matching-feedback-text" data-read></span>
        </div>
      </fieldset>
    `;
  }

  function applyQuestions(root) {
    const target = byId("matchingQuestionsContainer");
    if (!target) return;

    const questions = Array.from(root.querySelectorAll("[data-matching-question]"));
    target.innerHTML = questions.map(questionMarkup).join("");

    if (window.GLIPMatching && typeof window.GLIPMatching.setup === "function") {
      window.GLIPMatching.setup(target);
    }
  }

  function applyContent(documentRoot, sourceUrl) {
    const root = documentRoot.querySelector("#matchingContentData");

    if (!root) {
      throw new Error("The Matching content file does not contain #matchingContentData.");
    }

    applyFileSettings(root);
    applyInstructions(root);
    applyQuestions(root);

    document.dispatchEvent(
      new CustomEvent("glipMatchingContentLoaded", {
        detail: {
          fileName: getContentFileName(),
          url: sourceUrl
        }
      })
    );
  }

  function showLoadError(message) {
    const target = byId("matchingQuestionsContainer");
    if (!target) return;

    target.innerHTML = "";
    const box = document.createElement("p");
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "The Matching content could not be loaded.";
    target.appendChild(box);
  }

  function load() {
    const nextUrl = getContentUrl();

    if (!nextUrl) {
      showLoadError("The matching content could not be loaded. Please contact your teacher.");
      return Promise.reject(new Error("Matching content URL could not be resolved."));
    }

    if (loadPromise && contentUrl === nextUrl) return loadPromise;

    contentUrl = nextUrl;
    loadPromise = fetch(nextUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Matching content file was not found.");
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
        showLoadError("The matching content could not be loaded. Please contact your teacher.");
        throw error;
      });

    return loadPromise;
  }

  function refreshIfNeeded() {
    const nextUrl = getContentUrl();
    if (!nextUrl || nextUrl === contentUrl) return;
    load().catch(function (error) {
      console.error("Matching content could not be refreshed.", error);
    });
  }

  document.addEventListener("glipTopicContextRefreshed", refreshIfNeeded);

  window.GLIPMatchingContent = {
    load: load,
    getContentUrl: getContentUrl
  };
})(window);
