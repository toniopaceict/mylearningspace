(function () {
  "use strict";

  const CONTEXT_STORAGE_KEY = "glipTopicPageContext";
  const CONTEXT_CACHE_PREFIX = "glip_topic_page_data_";
  const CONTEXT_CACHE_MAX_AGE = 2 * 60 * 60 * 1000;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function getQuery() {
    return new URLSearchParams(window.location.search || "");
  }

  function getPathContext() {
    const match = window.location.pathname.match(
      /\/content\/([^/]+)\/([^/]+)\/([^/]+\.html)$/i
    );

    if (!match) return {};

    return {
      subject_code: decodeURIComponent(match[1]),
      topic_code: decodeURIComponent(match[2]),
      page_file: decodeURIComponent(match[3])
    };
  }

  function readStoredContext() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CONTEXT_STORAGE_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveStoredContext(context) {
    try {
      sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context || {}));
    } catch (error) {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
  }

  function getInitialContext() {
    const query = getQuery();
    const path = getPathContext();
    const stored = readStoredContext();

    return {
      school: text(query.get("school") || stored.school || sessionStorage.getItem("glipSchool")),
      curriculum_id: text(query.get("curriculum_id") || stored.curriculum_id || sessionStorage.getItem("glipCurriculumId")),
      topic_id: text(query.get("topic_id") || stored.topic_id),
      activity_id: text(
        query.get("activity_id") ||
        (window.PAGE_CONFIG && window.PAGE_CONFIG.activityId) ||
        stored.activity_id
      ),
      level_id: text(stored.level_id || sessionStorage.getItem("glipLevelId")),
      level_code: text(stored.level_code || sessionStorage.getItem("glipLevel")),
      subject_id: text(stored.subject_id || sessionStorage.getItem("glipSubjectId")),
      subject_code: text(path.subject_code || stored.subject_code || sessionStorage.getItem("glipSubjectId")),
      subject_name: text(stored.subject_name || sessionStorage.getItem("glipSubjectName")),
      topic_code: text(path.topic_code || stored.topic_code),
      topic_name: text(stored.topic_name),
      page_file: text(path.page_file)
    };
  }

  function cacheKey(context) {
    return CONTEXT_CACHE_PREFIX + [
      context.school,
      context.curriculum_id || context.level_id || context.level_code,
      context.topic_id || context.topic_code
    ].join("_");
  }

  function readCache(context) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(cacheKey(context)) || "null");
      if (!parsed || !parsed.saved_at || !parsed.data) return null;
      if (Date.now() - parsed.saved_at > CONTEXT_CACHE_MAX_AGE) return null;
      return parsed.data;
    } catch (error) {
      return null;
    }
  }

  function writeCache(context, data) {
    try {
      sessionStorage.setItem(cacheKey(context), JSON.stringify({
        saved_at: Date.now(),
        data: data
      }));
    } catch (error) {
      // A failed cache write must not prevent the page from loading.
    }
  }

  function normaliseActivity(activity) {
    const typeCode = text(activity.activity_type_code || activity.type_code || activity.type)
      .toLowerCase()
      .replace(/_/g, "-");

    return {
      activity_id: text(activity.activity_id),
      activity_code: text(activity.activity_code || activity.code),
      activity_title: text(activity.activity_title || activity.title),
      activity_type_code: typeCode,
      sort_order: Number(activity.sort_order) || 0,
      visible: activity.visible !== false,
      active: activity.active !== false,
      file_name: text(activity.file_name || activity.page_file || activity.filename)
    };
  }

  function normaliseResponse(data, initial) {
    const source = data && data.topic_page ? data.topic_page : data || {};
    const topic = source.topic || {};
    const subject = source.subject || {};
    const level = source.level || {};
    const activities = Array.isArray(source.activities)
      ? source.activities.map(normaliseActivity)
      : [];

    return {
      school: text(source.school || initial.school),
      curriculum_id: text(source.curriculum_id || initial.curriculum_id),
      topic_id: text(topic.topic_id || source.topic_id || initial.topic_id),
      topic_code: text(topic.topic_code || source.topic_code || initial.topic_code),
      topic_name: text(topic.topic_name || source.topic_name || initial.topic_name),
      subject_id: text(subject.subject_id || source.subject_id || initial.subject_id),
      subject_code: text(subject.subject_code || source.subject_code || initial.subject_code),
      subject_name: text(subject.subject_name || source.subject_name || initial.subject_name),
      level_id: text(level.level_id || source.level_id || initial.level_id),
      level_code: text(level.level_code || source.level_code || initial.level_code),
      activities: activities,
      activity_id: text(initial.activity_id),
      page_file: initial.page_file
    };
  }

  function buildPageContext(topicData) {
    return {
      type: "topic",
      school: topicData.school,
      curriculumId: topicData.curriculum_id,
      topicId: topicData.topic_id,
      level: topicData.level_code,
      subject: topicData.subject_code || topicData.subject_id,
      topic: topicData.topic_code,
      activities: topicData.activities || []
    };
  }

  function applyTopicHeadings(topicData) {
    const title = document.getElementById("heroMainTitle");
    const subtitle = document.getElementById("heroSubTitle");

    if (title && topicData.topic_name) title.textContent = topicData.topic_name;
    if (subtitle && topicData.subject_name) subtitle.textContent = topicData.subject_name;

    if (topicData.topic_name && topicData.subject_name) {
      document.title = topicData.topic_name + " – " + topicData.subject_name + " – GLIP";
    }
  }

  function showContextError(message) {
    const shell = document.querySelector(".page-shell");
    const wrap = shell && shell.querySelector(".wrap");
    if (!wrap || document.getElementById("topicContextMessage")) return;

    const box = document.createElement("div");
    box.id = "topicContextMessage";
    box.className = "panel-message error text-center";
    box.setAttribute("role", "alert");
    box.textContent = message || "Topic information could not be loaded.";
    wrap.insertBefore(box, wrap.firstChild);
  }

  function applyPageConfig(topicData) {
    const config = window.PAGE_CONFIG || (window.PAGE_CONFIG = {});
    const configuredActivityId = text(config.activityId || topicData.activity_id);
    const pageFile = text(topicData.page_file).toLowerCase();

    const activity = (topicData.activities || []).find(function (item) {
      if (configuredActivityId && text(item.activity_id) === configuredActivityId) {
        return true;
      }

      return pageFile &&
        text(item.file_name).toLowerCase() === pageFile;
    }) || null;

    config.subjectId = topicData.subject_id || "";
    config.level = topicData.level_code || "";
    config.topicId = topicData.topic_id || "";
    config.topicName = topicData.topic_name || "";
    config.activityId = activity
      ? activity.activity_id
      : configuredActivityId;

    // Human-readable metadata is authoritative in Google Sheets.
    config.topline = topicData.subject_name || "";
    config.mainTitle = topicData.topic_name || "";
    config.subTitle = activity ? activity.activity_title : "";

    if (config.mainTitle && config.subTitle) {
      config.pageTitle =
        config.mainTitle + " – " + config.subTitle + " – GLIP";
    } else if (config.mainTitle && config.topline) {
      config.pageTitle =
        config.mainTitle + " – " + config.topline + " – GLIP";
    }

    topicData.activity_id = config.activityId;
    topicData.activity_title = config.subTitle;
  }

  function postTopicData(initial) {
    if (!window.getGlipWebAppUrl || (!initial.topic_id && !initial.topic_code)) {
      return Promise.reject(new Error("The topic could not be identified from this page."));
    }

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;

    return fetch(window.getGlipWebAppUrl(), {
      method: "POST",
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({
        action: "getTopicPageData",
        school_id: initial.school,
        curriculum_id: initial.curriculum_id,
        topic_id: initial.topic_id,
        topic_code: initial.topic_code,
        subject_id: initial.subject_id,
        subject_code: initial.subject_code,
        level_id: initial.level_id,
        level: initial.level_code,
        userType: sessionStorage.getItem("glipRole") || sessionStorage.getItem("glipUserType") || "student",
        teacher_id: sessionStorage.getItem("glipTeacherId") || "",
        student_id: sessionStorage.getItem("glipStudentId") || ""
      })
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Topic data request failed.");
        return response.json();
      })
      .then(function (data) {
        if (!data || data.status !== "success") {
          throw new Error((data && data.message) || "Topic data could not be loaded.");
        }
        return normaliseResponse(data, initial);
      })
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
      });
  }

  function initialise() {
    const initial = getInitialContext();
    const cached = readCache(initial);

    function install(topicData) {
      if (!topicData) return;
      window.GLIP_TOPIC_PAGE_DATA = topicData;
      window.PAGE_MENU_CONTEXT = buildPageContext(topicData);
      applyTopicHeadings(topicData);
      applyPageConfig(topicData);
    }

    function refreshInBackground() {
      return postTopicData(initial)
        .then(function (fresh) {
          if (!fresh) return cached || initial;
          writeCache(initial, fresh);
          saveStoredContext(fresh);
          install(fresh);
          document.dispatchEvent(new CustomEvent("glipTopicContextRefreshed", {
            detail: fresh
          }));
          return fresh;
        })
        .catch(function (error) {
          console.error("GLIP topic context:", error);
          return cached || initial;
        });
    }

    if (cached) {
      // Do not hold the whole page while Apps Script checks for a fresher
      // copy. The login stage or an earlier topics page has already warmed
      // this authoritative context.
      install(cached);
      setTimeout(refreshInBackground, 0);
      return Promise.resolve(cached);
    }

    window.PAGE_MENU_CONTEXT = buildPageContext(initial);

    return refreshInBackground()
      .then(function (fresh) {
        const resolved = fresh || initial;
        install(resolved);
        return resolved;
      })
      .catch(function (error) {
        applyPageConfig(initial);
        const message = error && error.name === "AbortError"
          ? "Topic information took too long to load. Please refresh the page."
          : (error && error.message ? error.message : "Topic information could not be loaded.");
        showContextError(message);
        return initial;
      });
  }


  window.GLIPTopicContext = {
    initialise: initialise,
    applyTopicHeadings: applyTopicHeadings
  };
})();
