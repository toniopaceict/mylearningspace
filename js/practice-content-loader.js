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

  function resolveUrl(value, baseUrl) {
    const source = text(value);
    if (!source) return "";

    try {
      return new URL(source, baseUrl).toString();
    } catch (_error) {
      return source;
    }
  }

  function resolveRelativeContentUrls(root, baseUrl) {
    if (!root || !baseUrl) return;

    root.querySelectorAll("[src]").forEach(function (element) {
      const value = element.getAttribute("src");
      if (value) element.setAttribute("src", resolveUrl(value, baseUrl));
    });

    root.querySelectorAll("[href]").forEach(function (element) {
      const value = element.getAttribute("href");
      if (value) element.setAttribute("href", resolveUrl(value, baseUrl));
    });
  }

  function makeReadable(container) {
    if (!container) return;

    container.querySelectorAll("p").forEach(function (paragraph) {
      paragraph.classList.add("q");
      paragraph.setAttribute("data-read", "");
    });

    container.querySelectorAll("ul, ol").forEach(function (list) {
      list.setAttribute("data-read", "");
    });
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

  function bindDownloadProgress() {
    const progressBar = byId("downloadProgressBar");
    const message = byId("downloadMessage");

    document
      .querySelectorAll("#requiredFilesSection .download-btn")
      .forEach(function (button) {
        if (button.dataset.practiceContentDownloadReady) return;

        button.dataset.practiceContentDownloadReady = "true";
        button.addEventListener("click", function () {
          if (progressBar) progressBar.classList.add("show");

          if (message) {
            message.textContent = "Preparing download...";
            message.className = "panel-message text-center info";
          }

          window.setTimeout(function () {
            if (progressBar) progressBar.classList.remove("show");
            if (message) {
              message.textContent = "";
              message.classList.add("hidden");
            }
          }, 3000);
        });
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
      } else {
        button.removeAttribute("href");
        button.style.display = "none";
      }
    });

    page.fileLink = files[0].link;
    page.fileButtonText = files[0].buttonText;

    const section = byId("requiredFilesSection");
    const legend = byId("requiredFilesLegend");

    if (section) section.style.display = visibleCount > 0 ? "" : "none";
    if (legend) legend.textContent = visibleCount === 1 ? "Required File" : "Required Files";

    bindDownloadProgress();
  }

  function applyRequiredFileInstructions(root) {
    const source = root.querySelector('[data-practice-content="required-files"]');
    const target = byId("requiredFilesInstructionContent");
    if (!target) return;

    if (source) {
      target.innerHTML = source.innerHTML.trim();
      makeReadable(target);
    }
  }

  function createPracticeFieldset(source, index) {
    const title = text(source.getAttribute("data-title")) || "Task " + (index + 1);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "task-box readable-section";

    const legend = document.createElement("legend");
    legend.textContent = title;
    fieldset.appendChild(legend);

    const speaker = document.createElement("button");
    speaker.type = "button";
    speaker.className = "speak-btn";
    speaker.setAttribute("onclick", "speakSection(this)");
    speaker.setAttribute("aria-label", "Read " + title + " aloud");
    speaker.textContent = "🔊";
    fieldset.appendChild(speaker);

    const content = document.createElement("div");
    content.innerHTML = source.innerHTML.trim();
    makeReadable(content);

    while (content.firstChild) {
      fieldset.appendChild(content.firstChild);
    }

    return fieldset;
  }

  function applyPracticeSections(root) {
    const target = byId("practiceContentContainer");
    if (!target) return;

    target.innerHTML = "";

    const sections = Array.from(root.querySelectorAll("[data-practice-section]"));
    sections.forEach(function (source, index) {
      target.appendChild(createPracticeFieldset(source, index));
    });
  }

  function applyContent(documentRoot, sourceUrl) {
    const root = documentRoot.querySelector("#practiceContentData");

    if (!root) {
      throw new Error("The practice content file does not contain #practiceContentData.");
    }

    resolveRelativeContentUrls(root, sourceUrl);
    applyRequiredFileInstructions(root);
    applyFileSettings(root);
    applyPracticeSections(root);

    document.dispatchEvent(
      new CustomEvent("glipPracticeContentLoaded", {
        detail: {
          fileName: getContentFileName(),
          url: sourceUrl
        }
      })
    );
  }

  function showLoadError(message) {
    const target = byId("practiceContentContainer");
    if (!target) return;

    target.innerHTML = "";

    const box = document.createElement("p");
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "The practice content could not be loaded.";
    target.appendChild(box);
  }

  function load() {
    const fileName = getContentFileName();
    const url = getContentUrl();

    // A shared activity page can first render from cached topic metadata and
    // then receive authoritative metadata from Apps Script. Reuse the current
    // promise only when it belongs to the same resolved content file.
    if (loadPromise && url && url === contentUrl) return loadPromise;

    loadPromise = null;
    contentUrl = url;

    if (!fileName || !url) {
      loadPromise = Promise.reject(
        new Error("The practice content file could not be determined.")
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
        // Do not permanently cache a failed load. A fresh topic-context
        // response may arrive immediately afterwards and should be allowed
        // to retry the content file.
        loadPromise = null;
        console.error("Could not load practice content.", error);
        showLoadError(
          "The practice content could not be loaded. Please contact your teacher."
        );
        throw error;
      });

    return loadPromise;
  }

  document.addEventListener("glipTopicContextRefreshed", function () {
    // If the authoritative refresh resolves a different activity/content
    // file, load() will replace the cached render. If nothing changed, the
    // existing promise is reused and no duplicate fetch is made.
    Promise.resolve(load()).catch(function () {
      // The normal load() error UI already explains the problem to the user.
    });
  });

  window.GLIPPracticeContent = {
    load: load,
    getContentFileName: getContentFileName,
    getContentUrl: function () { return contentUrl || getContentUrl(); }
  };
})(window);
