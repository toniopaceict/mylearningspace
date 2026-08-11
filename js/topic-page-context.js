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
    const path = window.location.pathname || "";

    // Current content architecture: topics are independent of subjects.
    const topicPoolMatch = path.match(
      /\/content\/topics\/([^/]+)\/([^/]+\.html)$/i
    );

    if (topicPoolMatch) {
      return {
        topic_code: decodeURIComponent(topicPoolMatch[1]),
        page_file: decodeURIComponent(topicPoolMatch[2])
      };
    }

    // Temporary backwards compatibility for bookmarks or cached URLs that
    // still use the pre-v437 subject/topic folder structure.
    const legacyMatch = path.match(
      /\/content\/([^/]+)\/([^/]+)\/([^/]+\.html)$/i
    );

    if (!legacyMatch) return {};

    return {
      subject_code: decodeURIComponent(legacyMatch[1]),
      topic_code: decodeURIComponent(legacyMatch[2]),
      page_file: decodeURIComponent(legacyMatch[3])
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

    const activityCode = text(activity.activity_code || activity.code);
    const suppliedFileName = text(
      activity.file_name || activity.page_file || activity.filename
    );

    return {
      activity_id: text(activity.activity_id),
      activity_code: activityCode,
      activity_title: text(activity.activity_title || activity.title),
      activity_type_code: typeCode,
      sort_order: Number(activity.sort_order) || 0,
      visible: activity.visible !== false,
      active: activity.active !== false,
      requires_submission: activity.requires_submission === true || String(activity.requires_submission).toLowerCase() === "true",

      // Newer activity rows may provide file_name explicitly.
      // Older/current rows use activity_code as the HTML filename stem.
      file_name: suppliedFileName || (activityCode ? activityCode + ".html" : "")
    };
  }

  function fileStem(fileName) {
    return text(fileName)
      .toLowerCase()
      .replace(/[?#].*$/, "")
      .replace(/\.html?$/, "");
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

  /*
   * Single authoritative renderer for the standard GLIP page hero.
   *
   * PAGE_CONFIG owns the final display mapping:
   *   topline  = subject name
   *   mainTitle = topic name
   *   subTitle = activity title
   *
   * Both the initial lesson render and later metadata refreshes call
   * this same function, preventing the hero mappings from drifting.
   */
  function renderPageHero(config) {
    const page = config || {};
    const topline = document.getElementById("heroTopline");
    const title = document.getElementById("heroMainTitle");
    const subtitle = document.getElementById("heroSubTitle");

    if (topline) topline.textContent = text(page.topline);
    if (title) title.textContent = text(page.mainTitle);
    if (subtitle) {
      const subtitleText = text(page.subTitle);
      subtitle.textContent = subtitleText;
      subtitle.hidden = !subtitleText;
    }

    document.title = text(page.pageTitle) || "GLIP";
  }

  /*
   * Retained as a compatibility method for existing callers.
   * Topic data must first be mapped into PAGE_CONFIG by
   * applyPageConfig(); this function then uses the shared renderer.
   */
  function applyTopicHeadings() {
    renderPageHero(window.PAGE_CONFIG || {});
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

    // The activity_id in the current URL is authoritative. Shared activity
    // templates (lesson.html, practice.html, etc.) are reused by many
    // activities, so a PAGE_CONFIG value left from an earlier cached render
    // must never override the activity the user actually selected.
    const queryActivityId = text(
      new URLSearchParams(window.location.search || "").get("activity_id")
    );
    const configuredActivityId = text(
      queryActivityId || topicData.activity_id || config.activityId
    );
    const pageFile = text(topicData.page_file).toLowerCase();

    const currentPageStem = fileStem(pageFile);

    // The current HTML filename is the primary identity of an activity page.
    // A stored activity_id may belong to the activity visited immediately before
    // this one, so it must never override a clear filename match.
    const activities = topicData.activities || [];

    let activity = activities.find(function (item) {
      const itemFile = text(item.file_name).toLowerCase();
      const itemFileStem = fileStem(itemFile);
      const activityCode = fileStem(item.activity_code);

      return Boolean(
        pageFile &&
        (
          itemFile === pageFile ||
          (currentPageStem && itemFileStem === currentPageStem) ||
          (currentPageStem && activityCode === currentPageStem)
        )
      );
    }) || null;

    // Only fall back to activity_id when the page itself cannot identify the
    // activity. This supports older links without allowing stale session data
    // to make one activity inherit another activity's metadata.
    if (!activity && configuredActivityId) {
      activity = activities.find(function (item) {
        return text(item.activity_id) === configuredActivityId;
      }) || null;
    }

    config.subjectId = topicData.subject_id || "";
    config.level = topicData.level_code || "";
    config.topicId = topicData.topic_id || "";
    config.topicCode = topicData.topic_code || "";
    config.topicName = topicData.topic_name || "";
    config.activityId = activity
      ? activity.activity_id
      : configuredActivityId;
    config.activityCode = activity ? activity.activity_code : text(config.activityCode);

    // The branding statement remains consistent on every GLIP page.
    // Topic pages show only the topic. Activity pages show topic + activity.
    config.topline = "Guided Learning for Independent Progress";
    config.mainTitle = topicData.topic_name || "";
    config.subTitle = config.pageKind === "topic-home"
      ? ""
      : (activity ? activity.activity_title : "");

    if (config.mainTitle && config.subTitle) {
      config.pageTitle =
        config.mainTitle + " – " + config.subTitle + " – GLIP";
    } else if (config.mainTitle && config.topline) {
      config.pageTitle =
        config.mainTitle + " – " + config.topline + " – GLIP";
    }

    // Submission behaviour is metadata-driven for every activity type.
    // The HTML page stores neither a submission flag nor a Drive folder ID.
    config.requiresSubmission = Boolean(activity && activity.requires_submission);
    config.uploadAssignment = config.activityId;

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
    let learningSessionTopic = null;

    // Cached context is useful for a fast first paint, but activity metadata that
    // controls permissions/visibility must be confirmed by a fresh Apps Script
    // response before dependent controls are shown.
    window.GLIP_TOPIC_CONTEXT_AUTHORITATIVE = false;

    if (window.GLIPLearningSession) {
      const topicPage = window.GLIPLearningSession.getTopicPageData({
        curriculum_id: initial.curriculum_id,
        subject_id: initial.subject_code || initial.subject_id,
        level: initial.level_code,
        topic_id: initial.topic_id || initial.topic_code
      });
      if (topicPage) {
        learningSessionTopic = normaliseResponse({ topic_page: topicPage }, initial);
      }
    }

    const cached = learningSessionTopic || readCache(initial);

    function install(topicData) {
      if (!topicData) return;
      window.GLIP_TOPIC_PAGE_DATA = topicData;
      window.PAGE_MENU_CONTEXT = buildPageContext(topicData);

      // First map authoritative Google Sheets metadata into PAGE_CONFIG.
      // Then render the hero once using the shared renderer.
      applyPageConfig(topicData);
      applyTopicHeadings();
    }

    function refreshInBackground() {
      return postTopicData(initial)
        .then(function (fresh) {
          if (!fresh) return cached || initial;
          writeCache(initial, fresh);
          saveStoredContext(fresh);
          install(fresh);
          window.GLIP_TOPIC_CONTEXT_AUTHORITATIVE = true;
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
      install(cached);

      // Cached learning-session data may have been created before a new
      // Activities field was introduced. Always refresh from Apps Script so
      // metadata such as requires_submission is never decided by stale cache.
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


  window.GLIPRenderPageHero = renderPageHero;

  window.GLIPTopicContext = {
    initialise: initialise,
    applyTopicHeadings: applyTopicHeadings,
    renderPageHero: renderPageHero
  };
})();
