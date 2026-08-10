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

  /*
   * Content files live in the topic folder while the shared Lesson page
   * lives under /shared/activities/. Resolve relative links before content
   * is copied into the shared page so images and links continue to point to
   * the lesson's own topic folder.
   */
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

  function makeReadable(container, options) {
    if (!container) return;

    const settings = options || {};

    container.querySelectorAll("p").forEach(function (paragraph) {
      paragraph.classList.add("q");
      paragraph.setAttribute("data-read", "");
    });

    container.querySelectorAll("ul, ol").forEach(function (list) {
      list.setAttribute("data-read", "");
    });

    if (settings.outcomes) {
      container.querySelectorAll("ul").forEach(function (list) {
        list.classList.add("lesson-outcomes");
      });
    }
  }

  function copyContent(source, targetId, options) {
    const target = byId(targetId);
    if (!target) return;

    target.innerHTML = source ? source.innerHTML.trim() : "";
    makeReadable(target, options);
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

  function applyFileSettings(root) {
    const page = window.PAGE_CONFIG || (window.PAGE_CONFIG = {});
    const files = readFileSettings(root);

    files.forEach(function (file, index) {
      const number = index + 1;
      page["fileLink" + number] = file.link;
      page["fileButtonText" + number] = file.buttonText;
    });

    page.fileLink = files[0].link;
    page.fileButtonText = files[0].buttonText;

    const buttonIds = ["fileLinkBtn", "fileLinkBtn2", "fileLinkBtn3"];
    let visibleCount = 0;

    files.forEach(function (file, index) {
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

    const section = byId("requiredFilesSection");
    const legend = byId("requiredFilesLegend");

    if (section) section.style.display = visibleCount > 0 ? "" : "none";
    if (legend) legend.textContent = visibleCount === 1 ? "Required File" : "Required Files";

    bindAdditionalDownloadProgress();
  }

  function bindAdditionalDownloadProgress() {
    const progressBar = byId("downloadProgressBar");
    const message = byId("downloadMessage");

    ["fileLinkBtn2", "fileLinkBtn3"].forEach(function (buttonId) {
      const button = byId(buttonId);
      if (!button || button.dataset.lessonContentDownloadReady) return;

      button.dataset.lessonContentDownloadReady = "true";
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

  function applyVideoSettings(root) {
    const page = window.PAGE_CONFIG || (window.PAGE_CONFIG = {});
    const posterSource = root.querySelector("[data-video-poster]");
    const videoSource = root.querySelector("[data-video-url]");

    const posterImagePath = posterSource ? text(posterSource.getAttribute("src")) : "";
    const videoUrl = videoSource ? text(videoSource.getAttribute("href")) : "";

    const poster = byId("videoPoster");
    const posterImage = byId("videoPosterImage");
    const playButton = poster ? poster.querySelector(".video-play-btn") : null;
    const videoFrame = byId("videoFrame");

    const activityTitle = text(page.subTitle) || "this lesson";
    const videoLabel = "Play the video for " + activityTitle;
    const videoTitle = activityTitle + " video lesson";

    if (poster) {
      poster.setAttribute("aria-label", videoLabel);
      poster.style.display = videoUrl ? "" : "none";
    }

    if (posterImage) {
      posterImage.src = posterImagePath;
      posterImage.alt = "Preview image for the " + activityTitle + " video lesson";
    }

    if (playButton) playButton.setAttribute("aria-label", videoLabel);

    if (videoFrame) {
      videoFrame.title = videoTitle;
      videoFrame.dataset.src = videoUrl;
    }

    if (poster && !poster.dataset.keyboardReady) {
      poster.dataset.keyboardReady = "true";
      poster.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          poster.click();
        }
      });
    }
  }

  function applyContent(documentRoot, sourceUrl) {
    const root = documentRoot.querySelector("#lessonContentData");

    if (!root) {
      throw new Error("The lesson content file does not contain #lessonContentData.");
    }

    resolveRelativeContentUrls(root, sourceUrl);

    copyContent(
      root.querySelector('[data-lesson-content="overview"]'),
      "lessonOverviewContent",
      { outcomes: true }
    );

    copyContent(
      root.querySelector('[data-lesson-content="required-files"]'),
      "requiredFilesInstructionContent"
    );

    copyContent(
      root.querySelector('[data-lesson-content="video"]'),
      "videoLessonInstructionContent"
    );

    applyFileSettings(root);
    applyVideoSettings(root);

    document.dispatchEvent(
      new CustomEvent("glipLessonContentLoaded", {
        detail: {
          fileName: getContentFileName(),
          url: sourceUrl
        }
      })
    );
  }

  function showLoadError(message) {
    const target = byId("lessonOverviewContent");
    if (!target) return;

    target.innerHTML = "";

    const box = document.createElement("p");
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "The lesson content could not be loaded.";
    target.appendChild(box);
  }

  function load() {
    if (loadPromise) return loadPromise;

    const fileName = getContentFileName();
    const url = getContentUrl();
    contentUrl = url;

    if (!fileName || !url) {
      loadPromise = Promise.reject(
        new Error("The lesson content file could not be determined.")
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
        console.error("Could not load lesson content.", error);
        showLoadError(
          "The lesson content could not be loaded. Please contact your teacher."
        );
        throw error;
      });

    return loadPromise;
  }

  window.GLIPLessonContent = {
    load: load,
    getContentFileName: getContentFileName,
    getContentUrl: function () { return contentUrl || getContentUrl(); }
  };
})(window);
