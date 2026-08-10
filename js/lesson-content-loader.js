(function (window) {
  "use strict";

  let loadPromise = null;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getContentFileName() {
    const configured = text(window.PAGE_CONFIG && window.PAGE_CONFIG.contentFile);
    if (configured) return configured;

    const pageName = decodeURIComponent(
      (window.location.pathname || "").split("/").pop() || ""
    );

    if (!/\.html?$/i.test(pageName)) {
      return "";
    }

    return pageName.replace(/\.html?$/i, "_content.html");
  }

  function buildContentUrl(fileName) {
    return new URL(fileName, window.location.href).toString();
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
    const files = [1, 2, 3].map(function (number) {
      const source = root.querySelector('[data-file-number="' + number + '"]');
      return {
        link: source ? text(source.getAttribute("href")) : "",
        buttonText: source ? text(source.getAttribute("data-button-text")) : ""
      };
    });

    return files;
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

    if (section) {
      section.style.display = visibleCount > 0 ? "" : "none";
    }

    if (legend) {
      legend.textContent = visibleCount === 1 ? "Required File" : "Required Files";
    }

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

    const posterImagePath = posterSource
      ? text(posterSource.getAttribute("src"))
      : "";
    const videoUrl = videoSource
      ? text(videoSource.getAttribute("href"))
      : "";

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

    if (playButton) {
      playButton.setAttribute("aria-label", videoLabel);
    }

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

  function applyContent(documentRoot) {
    const root = documentRoot.querySelector("#lessonContentData");

    if (!root) {
      throw new Error("The lesson content file does not contain #lessonContentData.");
    }

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
        detail: { fileName: getContentFileName() }
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

    if (!fileName) {
      loadPromise = Promise.reject(
        new Error("The lesson content filename could not be determined.")
      );
      return loadPromise;
    }

    const url = buildContentUrl(fileName);

    loadPromise = fetch(url, { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Could not load " + fileName + ".");
        }
        return response.text();
      })
      .then(function (html) {
        const parser = new DOMParser();
        const documentRoot = parser.parseFromString(html, "text/html");
        applyContent(documentRoot);
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
    getContentFileName: getContentFileName
  };
})(window);
