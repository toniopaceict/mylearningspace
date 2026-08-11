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
    if (!button || button.dataset.fillBlankDownloadReady) return;

    button.dataset.fillBlankDownloadReady = "true";
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

  function sentenceMarkup(source, taskIndex) {
    const clone = source.cloneNode(true);
    const blanks = Array.from(clone.querySelectorAll("[data-blank]"));

    blanks.forEach(function (blank, blankIndex) {
      const answer = text(blank.getAttribute("data-answer"));
      const span = clone.ownerDocument.createElement("span");
      span.className = "drop-zone";
      span.setAttribute("data-blank-id", "task" + (taskIndex + 1) + "_blank" + (blankIndex + 1));
      span.setAttribute("data-correct", answer);
      span.setAttribute("tabindex", "0");
      span.textContent = "Blank " + (blankIndex + 1);
      blank.replaceWith(span);
    });

    return {
      html: clone.innerHTML.trim(),
      blankCount: blanks.length
    };
  }

  function readableSentenceText(source) {
    const clone = source.cloneNode(true);
    Array.from(clone.querySelectorAll("[data-blank]")).forEach(function (blank, index) {
      blank.replaceWith(clone.ownerDocument.createTextNode("blank " + (index + 1)));
    });
    return text(clone.textContent);
  }

  function taskMarkup(source, index) {
    const title = text(source.getAttribute("data-title")) || "Task " + (index + 1);
    const instructionsSource = source.querySelector("[data-instructions]");
    const sentenceSource = source.querySelector("[data-sentence]");
    const optionsSource = source.querySelector("[data-options]");

    if (!sentenceSource) {
      throw new Error(title + " does not contain a data-sentence element.");
    }

    const sentence = sentenceMarkup(sentenceSource, index);
    const readableSentence = readableSentenceText(sentenceSource);
    const instructions = instructionsSource
      ? text(instructionsSource.textContent)
      : "Drag the correct words into the blanks.";
    const options = optionsSource
      ? Array.from(optionsSource.querySelectorAll("li")).map(function (item) {
          return text(item.textContent);
        }).filter(Boolean)
      : [];

    const optionsReadable = options.length
      ? "The possible answers are: " + options.join(", ") + "."
      : "";

    const optionsHtml = options.map(function (option) {
      return '<div class="drag-option" draggable="true" data-value="' +
        escapeHtml(option) + '">' + escapeHtml(option) + "</div>";
    }).join("");

    return `
      <fieldset class="task-box readable-section drag-drop-question">
        <legend>${escapeHtml(title)}</legend>

        <button
          type="button"
          class="speak-btn"
          onclick="speakSection(this)"
          aria-label="Read ${escapeHtml(title)} aloud">
          🔊
        </button>

        <p class="q" data-read>${escapeHtml(instructions)}</p>

        <div class="drag-fill-area" aria-label="Drag-and-drop fill in the blanks activity">
          <p class="q visually-hidden" data-read>${escapeHtml(readableSentence)}</p>

          <p class="q drag-sentence" aria-hidden="true">
            ${sentence.html}
          </p>

          ${optionsReadable ? '<p class="q visually-hidden" data-read>' + escapeHtml(optionsReadable) + '</p>' : ""}

          <div class="drag-options" aria-label="Answer options">
            ${optionsHtml}
          </div>

          <div class="drag-actions no-print">
            <button type="button" class="glip-btn check-drag-drop-btn">Check Answers</button>
            <button type="button" class="glip-btn glip-btn-secondary reset-drag-drop-btn">Reset</button>
            <span class="tracker-score drag-drop-score">Score: 0 / ${sentence.blankCount}</span>
          </div>

          <p class="drag-feedback drag-drop-feedback" role="status" aria-live="polite"></p>
        </div>
      </fieldset>
    `;
  }

  function applyTasks(root) {
    const target = byId("fillBlankTasksContainer");
    if (!target) return;

    const tasks = Array.from(root.querySelectorAll("[data-fill-blank-task]"));
    target.innerHTML = tasks.map(taskMarkup).join("");

    if (window.GLIPDragDrop && typeof window.GLIPDragDrop.setup === "function") {
      window.GLIPDragDrop.setup(target);
    }
  }

  function applyContent(documentRoot, sourceUrl) {
    const root = documentRoot.querySelector("#fillBlankContentData");

    if (!root) {
      throw new Error("The Fill in the Blanks content file does not contain #fillBlankContentData.");
    }

    applyFileSettings(root);
    applyTasks(root);

    document.dispatchEvent(
      new CustomEvent("glipFillBlankContentLoaded", {
        detail: {
          fileName: getContentFileName(),
          url: sourceUrl
        }
      })
    );
  }

  function showLoadError(message) {
    const target = byId("fillBlankTasksContainer");
    if (!target) return;

    target.innerHTML = "";
    const box = document.createElement("p");
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "The Fill in the Blanks content could not be loaded.";
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
        new Error("The Fill in the Blanks content file could not be determined.")
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
        console.error("Could not load Fill in the Blanks content.", error);
        showLoadError(
          "The Fill in the Blanks content could not be loaded. Please contact your teacher."
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

  window.GLIPFillBlankContent = {
    load: load,
    getContentFileName: getContentFileName,
    getContentUrl: function () { return contentUrl || getContentUrl(); }
  };
})(window);
