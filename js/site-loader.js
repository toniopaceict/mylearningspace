(function () {
  "use strict";
 
  
  
  const GLIP_ASSET_VERSION = "451";
  const GLIP_BASE_URL = "https://toniopaceict.github.io/mylearningspace";

  const GLIP_PAGE_CHECK_CLASS = "glip-page-checking";
  let pageRevealScheduled = false;
  let pageRevealed = false;
  let pageRevealFallbackTimer = null;

  window.GLIP_ASSET_VERSION = GLIP_ASSET_VERSION;
  window.GLIP_BASE_URL = GLIP_BASE_URL;

  /*
   * Keep the page shell hidden while shared and page-specific scripts
   * replace placeholder content. The class is added before the body is
   * parsed, which prevents a flash of default headings on a hard refresh.
   */
  document.documentElement.classList.add(GLIP_PAGE_CHECK_CLASS);

  /*
   * Safety fallback: a script or network error must never leave the page
   * permanently hidden. Normal initialisation clears this timer.
   */
  pageRevealFallbackTimer = window.setTimeout(revealPageShell, 8000);

  loadCssOnce(versionedAssetUrl("/css/main.css"));

  loadScriptOnce(versionedAssetUrl("/js/cache-manager.js"), function () {
    loadScriptOnce(versionedAssetUrl("/js/learning-session.js"), function () {
    loadScriptOnce(versionedAssetUrl("/js/progress-engine.js"), function () {
    loadScriptOnce(versionedAssetUrl("/js/school-config.js"), function () {
      loadScriptOnce(versionedAssetUrl("/js/performance-monitor-client.js"), function () {
    loadScriptOnce(versionedAssetUrl("/js/roles.js"), function () {
      loadScriptOnce(versionedAssetUrl("/js/teaching-role-context.js"), function () {
      loadScriptOnce(versionedAssetUrl("/js/role-guard.js"), function () {
        loadScriptOnce(versionedAssetUrl("/js/next-activity-engine.js"), function () {
        loadScriptOnce(versionedAssetUrl("/js/menu-config.js"), function () {
          loadScriptOnce(versionedAssetUrl("/js/management-cache.js"), function () {
            prepareTopicContext(function () {
              loadScriptOnce(versionedAssetUrl("/js/header.js"), function () {
                loadPageSpecificScripts(function () {
                  document.dispatchEvent(new CustomEvent("glipReady"));
                  revealPageShell();
                });
              });
            });
          });
        });
        });
      });
      });
    });
  });
  });
  });
  });
  });

  function prepareTopicContext(callback) {
    const pageKind = getPageKind(window.PAGE_CONFIG || {});

    if (pageKind !== "topic-home" && pageKind !== "lesson" &&
        pageKind !== "practice" && pageKind !== "quiz" &&
        pageKind !== "fillblank" && pageKind !== "free-text") {
      callback();
      return;
    }

    loadScriptOnce(versionedAssetUrl("/js/topic-page-context.js"), function () {
      if (!window.GLIPTopicContext || typeof window.GLIPTopicContext.initialise !== "function") {
        callback();
        return;
      }

      Promise.resolve(window.GLIPTopicContext.initialise())
        .catch(function (error) {
          console.error("Could not initialise topic context.", error);
        })
        .finally(callback);
    });
  }

  function versionedAssetUrl(path) {
    if (!path) return path;

    if (/^https?:\/\//i.test(path)) {
      return addVersion(path);
    }

    return addVersion(GLIP_BASE_URL + path);
  }

  function addVersion(url) {
    if (!url) return url;

    if (url.indexOf("?v=") !== -1 || url.indexOf("&v=") !== -1) {
      return url;
    }

    return url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + encodeURIComponent(GLIP_ASSET_VERSION);
  }

  function getPageKind(config) {
    if (config && config.pageKind) {
      return String(config.pageKind).toLowerCase();
    }

    const path = window.location.pathname.toLowerCase();

    if (path.indexOf("/schools/management/") !== -1) return "management";
    if (path.indexOf("quiz") !== -1) return "quiz";
    if (path.indexOf("practice") !== -1) return "practice";
    if (path.indexOf("fill-blank") !== -1 || path.indexOf("fillblank") !== -1) return "fillblank";
    if (path.indexOf("lesson") !== -1) return "lesson";
    if (path.indexOf("topic-") !== -1 && path.indexOf("-home") !== -1) return "topic-home";
    if (path.indexOf("reflection") !== -1) return "reflection";
    if (path.indexOf("free_text") !== -1 || path.indexOf("free-text") !== -1) return "free-text";

    return "";
  }

function getManagementScripts() {
  const path = window.location.pathname.toLowerCase();
  const page = path.split("/").pop();

const managementScriptsByPage = {
  "activity-management.html": ["/js/activity-management.js"],
  "subject-catalogue.html": ["/js/subject-catalogue.js"],
  "topic-catalogue.html": ["/js/topic-catalogue.js"],
  "performance-monitor.html": ["/js/performance-monitor.js"],
  "content-validator.html": ["/js/content-validator.js"],
  "teacher-management.html": [
    "/js/admin-csv-tools.js",
    "/js/table-filter.js",
    "/js/teacher-management.js"
  ],

  "class-management.html": [
    "/js/admin-csv-tools.js",
    "/js/table-filter.js",
    "/js/class-management.js"
  ],

  "student-management.html": [
    "/js/admin-csv-tools.js",
    "/js/table-filter.js",
    "/js/student-management.js"
  ],

  "teaching-assignments.html": [
    "/js/admin-csv-tools.js",
    "/js/table-filter.js",
    "/js/teaching-assignments.js"
  ],

"subject-management.html": [
  "/js/admin-csv-tools.js",
  "/js/table-filter.js",
  "/js/subject-management.js"
],

  "topic-management.html": [
  "/js/admin-csv-tools.js",
  "/js/table-filter.js",
  "/js/topic-management.js"
],

  "level-management.html": [
  "/js/admin-csv-tools.js",
  "/js/table-filter.js",
  "/js/level-management.js"
],
  

"student-subject-management.html": [
  "/js/admin-csv-tools.js",
  "/js/table-filter.js",
  "/js/student-subject-management.js"
],

"work-folder-management.html": [
  "/js/storage-download.js",
  "/js/storage-page-cache.js",
  "/js/table-filter.js",
  "/js/work-folder-management.js"
],

"class-resources.html": [
  "/js/storage-download.js",
  "/js/storage-page-cache.js",
  "/js/admin-csv-tools.js",
  "/js/class-resources.js"
],

"student-submissions.html": [
  "/js/storage-download.js",
  "/js/storage-page-cache.js",
  "/js/student-submissions.js"
]
};

  return managementScriptsByPage[page] || [];
}
  

  function loadPageSpecificScripts(callback) {
    const config = window.PAGE_CONFIG || {};
    const pageKind = getPageKind(config);
    const scripts = [];

    scripts.push("/js/accessibility.js");

    if (["lesson", "practice", "quiz", "fillblank", "reflection", "free-text"].indexOf(pageKind) !== -1) {
      scripts.push("/js/activity-upload.js");
    }

    if (pageKind === "lesson" || pageKind === "practice" || pageKind === "fillblank") {
      scripts.push("/js/mark-complete.js");
      scripts.push("/js/lesson-page.js");
    }

    if (pageKind === "practice" || pageKind === "fillblank") {
      scripts.push("/js/drag-drop.js");
    }

    if (pageKind === "practice") {
      scripts.push("/js/lightbox.js");
      scripts.push("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
      scripts.push("/js/glip-pdf.js");
      scripts.push("/js/pdf-export.js");
      scripts.push("/js/practice-page.js");
    }

    if (pageKind === "quiz") {
      scripts.push("/js/quiz-engine.js");
      scripts.push("/js/mark-complete.js");
      scripts.push("/js/lightbox.js");
      scripts.push("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      scripts.push("/js/glip-pdf.js");
      scripts.push("/js/pdf-export.js");
      scripts.push("/js/quiz-page.js");
    }

    if (pageKind === "fillblank") {
      scripts.push("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      scripts.push("/js/glip-pdf.js");
      scripts.push("/js/pdf-export.js");
    }


    if (pageKind === "free-text") {
      scripts.push("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js");
      scripts.push("/js/free-text-page.js");
    }

    if (pageKind === "topic-home") {
      scripts.push("/js/landing-page.js");
    }

    if (pageKind === "management") {
      scripts.push("/js/management-cache.js");
      scripts.push("/js/optimistic-update.js");
      getManagementScripts().forEach(function (scriptPath) {
        scripts.push(scriptPath);
      });
    }

    if (Array.isArray(config.extraScripts)) {
      config.extraScripts.forEach(function (scriptPath) {
        scripts.push(scriptPath);
      });
    }

    loadScriptList(deduplicate(scripts), callback);
  }

  function loadScriptList(paths, callback) {
    const list = (paths || []).slice();

    function next() {
      const path = list.shift();

      if (!path) {
        if (callback) callback();
        return;
      }

      if (/^https?:\/\//i.test(path)) {
        loadScriptOnce(path, next);
      } else {
        loadScriptOnce(versionedAssetUrl(path), next);
      }
    }

    next();
  }

  function deduplicate(items) {
    const seen = {};

    return items.filter(function (item) {
      if (!item || seen[item]) return false;

      seen[item] = true;
      return true;
    });
  }

  function loadCssOnce(href) {
    const baseHref = href.split("?")[0];

    const existing = Array.prototype.find.call(
      document.querySelectorAll("link[rel='stylesheet']"),
      function (link) {
        return link.href && link.href.split("?")[0] === baseHref;
      }
    );

    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;

    document.head.appendChild(link);
  }

  function loadScriptOnce(src, callback) {
    const baseSrc = src.split("?")[0];

    const existing = Array.prototype.find.call(
      document.querySelectorAll("script[src]"),
      function (script) {
        return script.src && script.src.split("?")[0] === baseSrc;
      }
    );

    if (existing) {
      if (callback) {
        if (existing.dataset.glipLoaded === "true") {
          callback();
        } else {
          existing.addEventListener("load", callback, { once: true });
        }
      }

      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;

    script.onload = function () {
      script.dataset.glipLoaded = "true";
      if (callback) callback();
    };

    document.head.appendChild(script);
  }

  function revealPageShell() {
    if (pageRevealed || pageRevealScheduled) return;

    pageRevealScheduled = true;

    runWhenDomReady(function () {
      /*
       * Two animation frames allow DOMContentLoaded handlers and synchronous
       * glipReady listeners to finish updating headings before the shell is
       * shown.
       */
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          document.documentElement.classList.remove(GLIP_PAGE_CHECK_CLASS);
          pageRevealed = true;
          pageRevealScheduled = false;

          if (pageRevealFallbackTimer) {
            window.clearTimeout(pageRevealFallbackTimer);
            pageRevealFallbackTimer = null;
          }

          document.dispatchEvent(new CustomEvent("glipPageVisible"));
        });
      });
    });
  }

  function runWhenDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

})();
