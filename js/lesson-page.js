(function () {
  "use strict";

const GLIP_MESSAGES = {
  preparingDownload: "Preparing download...",
};

const GLIP_CLASSES = {
  visible: "show",
};
  

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

    if (href) {
      el.href = href;
    }

    if (text) {
      el.textContent = text;
    }
  }

  function setImage(id, src, alt) {
    const el = byId(id);

    if (!el) return;

    if (src) {
      el.src = src;
    }

    if (alt) {
      el.alt = alt;
    }
  }

  function buildYoutubeUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  function buildYoutubeThumbUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  function saveLessonProgress(status) {
    const config = window.PAGE_CONFIG || {};

    const isCompleted = status === "completed";

    window.MARK_COMPLETE_CONFIG = {
      mode: "saveProgress",

      webAppUrl:
  (typeof window.getGlipWebAppUrl === "function"
    ? window.getGlipWebAppUrl()
    : config.webAppUrl || ""),

      subjectId: config.subjectId || "",
      level: config.level || "",
      topicId: config.topicId || "",
      activityId: config.activityId || "",

      status: status,

      buttonId: isCompleted
        ? "saveCompletedBtn"
        : "saveInProgressBtn",

      messageId: "message",

      loadingText: isCompleted
        ? "Saving completed progress..."
        : "Saving partly completed progress...",

      successText: isCompleted
        ? "Progress saved: completed."
        : "Progress saved: partly completed.",
    };

    window.TonioMarkComplete.saveProgress();
  }

  let glipSavePinged = false;

  function warmSaveEndpoint() {
    if (glipSavePinged) return;

    glipSavePinged = true;

    fetch(window.PAGE_CONFIG.webAppUrl + "?action=ping")
      .catch(function () {});
  }

  function initSaveButtons() {
    const inProgressBtn = byId("saveInProgressBtn");
    const completedBtn = byId("saveCompletedBtn");

    if (inProgressBtn) {
      inProgressBtn.addEventListener("click", function () {
        saveLessonProgress("in_progress");
      });

      inProgressBtn.addEventListener(
        "mouseenter",
        warmSaveEndpoint,
      );

      inProgressBtn.addEventListener(
        "focus",
        warmSaveEndpoint,
      );
    }

    if (completedBtn) {
      completedBtn.addEventListener("click", function () {
        saveLessonProgress("completed");
      });

      completedBtn.addEventListener(
        "mouseenter",
        warmSaveEndpoint,
      );

      completedBtn.addEventListener(
        "focus",
        warmSaveEndpoint,
      );
    }
  }

  function initVideoPoster() {
    const poster = byId("videoPoster");
    const wrapper = byId("videoWrapper");
    const frame = byId("videoFrame");

    if (!poster || !wrapper || !frame) {
      return;
    }

    poster.addEventListener("click", function () {
      frame.src = frame.dataset.src;

      poster.style.display = "none";
      wrapper.style.display = "block";
    });
  }

function showDownloadProgress() {
  const bar = byId("downloadProgressBar");
  const message = byId("downloadMessage");

  if (!bar || !message) {
    return;
  }

  bar.classList.add(GLIP_CLASSES.visible);
  message.textContent = GLIP_MESSAGES.preparingDownload;

  setTimeout(function () {
    bar.classList.remove("show");
    message.textContent = "";
  }, 3000);
}

  
  function initPage(config) {
    if (!config) {
      console.warn("PAGE_CONFIG is missing.");
      return;
    }

    /*
     * Use the single shared GLIP hero renderer. The fallback protects
     * older pages if the shared topic-context script is unavailable.
     */
    if (typeof window.GLIPRenderPageHero === "function") {
      window.GLIPRenderPageHero(config);
    } else {
      document.title = config.pageTitle || "Lesson Page";
      setText("heroTopline", config.topline);
      setText("heroMainTitle", config.mainTitle);
      setText("heroSubTitle", config.subTitle);
    }

setLink(
  "fileLinkBtn",
  config.fileLink || "#",
  config.fileButtonText || "Download file",
);

const fileLinkBtn = byId("fileLinkBtn");

if (fileLinkBtn) {
  fileLinkBtn.addEventListener("click", function () {
    showDownloadProgress();
  });
}

    if (config.youtubeVideoId) {
      setLink(
        "videoLink",
        buildYoutubeUrl(config.youtubeVideoId),
      );

      setImage(
        "videoThumb",
        buildYoutubeThumbUrl(config.youtubeVideoId),
        config.videoAlt || "Video lesson thumbnail",
      );
    }

    setText("siteFooter", config.footerText);

    initSaveButtons();
    initVideoPoster();
  }

function ready(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

ready(function () {
  initPage(window.PAGE_CONFIG);
});
})();
