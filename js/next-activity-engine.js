(function () {
  "use strict";

  const CACHE_PREFIX = "glip_next_activity_";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function normaliseStatus(value) {
    const status = text(value).toLowerCase().replace(/[ -]+/g, "_");
    if (status === "2" || status === "complete" || status === "completed") return "completed";
    if (status === "1" || status === "in_progress" || status === "partly_completed" || status === "partially_completed") {
      return "in_progress";
    }
    return "not_started";
  }

  function visibleActivities(activities) {
    return (Array.isArray(activities) ? activities : [])
      .filter(function (activity) {
        return activity && activity.active !== false && activity.visible !== false;
      })
      .slice()
      .sort(function (a, b) {
        const orderDifference = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
        if (orderDifference) return orderDifference;
        return text(a.activity_id).localeCompare(text(b.activity_id));
      });
  }

  function progressIndex(progressItems) {
    const index = Object.create(null);
    (Array.isArray(progressItems) ? progressItems : []).forEach(function (item) {
      const activityId = text(item && item.activity_id);
      if (activityId) index[activityId] = normaliseStatus(item.status);
    });
    return index;
  }

  /*
   * GLIP's single authoritative next-step rule:
   * 1. Resume the first visible, active activity already in progress.
   * 2. Otherwise use the first visible, active activity not yet started.
   * 3. If every available activity is complete, return null.
   */
  function getNextActivity(activities, progressItems) {
    const ordered = visibleActivities(activities);
    const statuses = progressIndex(progressItems);

    const inProgress = ordered.find(function (activity) {
      return statuses[text(activity.activity_id)] === "in_progress";
    });
    if (inProgress) return Object.assign({}, inProgress, {
      next_step_reason: "resume",
      progress_status: "in_progress"
    });

    const notStarted = ordered.find(function (activity) {
      return (statuses[text(activity.activity_id)] || "not_started") === "not_started";
    });
    if (notStarted) return Object.assign({}, notStarted, {
      next_step_reason: "start",
      progress_status: "not_started"
    });

    return null;
  }

  function pad2(value) {
    const match = text(value).match(/\d+/);
    return match ? match[0].padStart(2, "0") : "";
  }

  function activityFileName(activity) {
    if (activity && activity.file_name) return text(activity.file_name);
    const code = text(activity && activity.activity_code).toLowerCase();
    if (/^[a-z0-9][a-z0-9_-]*$/.test(code)) return code + ".html";

    const id = text(activity && activity.activity_id);
    const type = text(activity && activity.activity_type_code).toLowerCase().replace(/_/g, "-");
    const numberMatch = id.match(/(\d+)$/);
    const number = numberMatch ? pad2(numberMatch[1]) : "01";
    if (type === "reflection") return "";
    if (type === "fillblank") return "fill-blanks-" + number + ".html";
    return type + "-" + number + ".html";
  }

  function buildActivityUrl(context, activity) {
    if (!context || !activity) return "";
    const type = text(activity.activity_type_code).toLowerCase().replace(/_/g, "-");
    const query = new URLSearchParams({
      school: text(context.school),
      curriculum_id: text(context.curriculum_id),
      topic_id: text(context.topic_id),
      activity_id: text(activity.activity_id)
    }).toString();

    if (type === "reflection") {
      return text(context.base_url || "") + "/shared/reflection.html?" + new URLSearchParams({
        school: text(context.school),
        subject: text(context.subject_code || context.subject_id),
        level: pad2(context.level_code),
        topic: pad2(context.topic_code),
        curriculum_id: text(context.curriculum_id),
        topic_id: text(context.topic_id),
        activity_id: text(activity.activity_id)
      }).toString();
    }

    if (type === "lesson" || type === "practice" || type === "quiz" || type === "free-text" || type === "fill-blanks" || type === "fillblank" || type === "matching") {
      const baseUrl = text(window.GLIP_BASE_URL).replace(/\/$/, "");
      const sharedBase = baseUrl || text(context.base_url || "").replace(/\/$/, "");
      const sharedFile = type === "lesson"
        ? "lesson.html"
        : type === "practice"
          ? "practice.html"
          : type === "quiz"
            ? "quiz.html"
            : type === "free-text"
            ? "free-text.html"
            : type === "matching"
              ? "matching.html"
              : "fill-blanks.html";
      return sharedBase
        ? sharedBase + "/shared/activities/" + sharedFile + (query ? "?" + query : "")
        : "";
    }

    const base = text(context.topic_base_url).replace(/\/$/, "");
    const fileName = activityFileName(activity);
    return base && fileName ? base + "/" + fileName + (query ? "?" + query : "") : "";
  }

  function cacheKey(context) {
    return CACHE_PREFIX + [
      text(context && context.school),
      text(context && (context.curriculum_id || context.level_code)),
      text(context && (context.topic_id || context.topic_code)),
      text(context && context.student_id)
    ].join("_");
  }

  function saveRecommendation(context, activity, url) {
    if (!context || !context.student_id) return;
    try {
      sessionStorage.setItem(cacheKey(context), JSON.stringify({
        saved_at: Date.now(),
        activity: activity || null,
        url: text(url)
      }));
    } catch (error) {
      // Recommendation caching is an optimisation only.
    }
  }

  function clearRecommendations() {
    try {
      Object.keys(sessionStorage).forEach(function (key) {
        if (key.indexOf(CACHE_PREFIX) === 0) sessionStorage.removeItem(key);
      });
    } catch (error) {
      // Ignore unavailable session storage.
    }
  }

  function preloadUrl(url) {
    if (!url) return Promise.resolve(false);
    return fetch(url, { method: "GET", cache: "force-cache", credentials: "same-origin" })
      .then(function (response) { return response.ok; })
      .catch(function () { return false; });
  }

  window.GLIPNextActivity = {
    normaliseStatus: normaliseStatus,
    getNextActivity: getNextActivity,
    buildActivityUrl: buildActivityUrl,
    saveRecommendation: saveRecommendation,
    clearRecommendations: clearRecommendations,
    preloadUrl: preloadUrl
  };
})();
