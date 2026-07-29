(function (window) {
  "use strict";

  function text(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function normaliseLevel(value) {
    const match = text(value).match(/\d+/);
    return match ? "level-" + match[0].padStart(2, "0") : "";
  }

  function normaliseStatus(value) {
    const status = text(value).toLowerCase().replace(/[ -]+/g, "_");

    if (status === "2" || status === "complete" || status === "completed") {
      return "completed";
    }

    if (
      status === "1" ||
      status === "in_progress" ||
      status === "partly_completed" ||
      status === "partially_completed"
    ) {
      return "in_progress";
    }

    return "not_started";
  }

  function unique(values) {
    return Array.from(new Set((values || []).map(text).filter(Boolean)));
  }

  function topicKeys(topic) {
    const value = topic || {};
    return unique([
      value.topic_pk,
      value.topic_id,
      value.topic_code,
      value.topicId,
      value.topicCode,
      value.folder,
      value.id
    ]).map(function (item) {
      return item.toLowerCase();
    });
  }

  function subjectKeys(subject) {
    const value = subject || {};
    return unique([
      value.subject_pk,
      value.subject_id,
      value.subject_code,
      value.subjectId,
      value.subjectCode
    ]).map(function (item) {
      return item.toLowerCase();
    });
  }

  function visibleActivities(activities) {
    return (Array.isArray(activities) ? activities : []).filter(function (activity) {
      return activity && activity.active !== false && activity.visible !== false;
    });
  }

  function activityIds(activities) {
    return unique(visibleActivities(activities).map(function (activity) {
      return activity.activity_id || activity.activityId;
    }));
  }

  function progressIndex(progressItems) {
    const index = Object.create(null);

    (Array.isArray(progressItems) ? progressItems : []).forEach(function (item) {
      const activityId = text(item && (item.activity_id || item.activityId));
      if (!activityId) return;
      index[activityId] = normaliseStatus(item.status);
    });

    return index;
  }

  function aggregateStatuses(statuses) {
    const values = (Array.isArray(statuses) ? statuses : []).map(normaliseStatus);
    if (values.length === 0) return "not_started";
    if (values.every(function (status) { return status === "completed"; })) {
      return "completed";
    }
    if (values.some(function (status) {
      return status === "completed" || status === "in_progress";
    })) {
      return "in_progress";
    }
    return "not_started";
  }

  function getSessionProgress(criteria) {
    if (!window.GLIPLearningSession) return null;

    if (criteria && (criteria.curriculum_id || criteria.subject_id || criteria.subject_code)) {
      const progress = window.GLIPLearningSession.getProgress(criteria);
      if (Array.isArray(progress)) return progress;
    }

    const allProgress = window.GLIPLearningSession.getAllProgress();
    return Array.isArray(allProgress) ? allProgress : null;
  }

  function getProgressItems(explicitItems, criteria) {
    const sessionItems = getSessionProgress(criteria || {});
    if (Array.isArray(sessionItems)) return sessionItems;
    return Array.isArray(explicitItems) ? explicitItems : [];
  }

  function progressForTopic(topic, progressItems) {
    const keys = topicKeys(topic);
    const ids = activityIds(topic && topic.activities);
    const idSet = new Set(ids);

    return (Array.isArray(progressItems) ? progressItems : []).filter(function (item) {
      const progressTopic = text(item && (item.topic_id || item.topicId)).toLowerCase();
      const progressActivity = text(item && (item.activity_id || item.activityId));
      return (progressTopic && keys.indexOf(progressTopic) !== -1) ||
        (progressActivity && idSet.has(progressActivity));
    });
  }

  function getTopicStatus(topic, explicitProgress) {
    const progressItems = getProgressItems(explicitProgress, {
      curriculum_id: topic && topic.curriculum_id,
      subject_id: topic && (topic.subject_id || topic.subject_code),
      level: topic && (topic.level || topic.level_code)
    });

    const ids = activityIds(topic && topic.activities);
    const matching = progressForTopic(topic, progressItems);

    if (ids.length > 0) {
      const index = progressIndex(matching);
      return aggregateStatuses(ids.map(function (activityId) {
        return index[activityId] || "not_started";
      }));
    }

    return aggregateStatuses(matching.map(function (item) {
      return item.status;
    }));
  }

  function findCurriculum(subject) {
    if (!window.GLIPLearningSession || !subject) return null;

    return window.GLIPLearningSession.getCurriculum({
      curriculum_id: subject.curriculum_id,
      subject_id: subject.subject_id || subject.subject_code,
      level: subject.level || subject.level_code
    });
  }

  function getSubjectStatus(subject, explicitProgress) {
    const curriculum = findCurriculum(subject);
    const progressItems = getProgressItems(explicitProgress, {
      curriculum_id: subject && subject.curriculum_id,
      subject_id: subject && (subject.subject_id || subject.subject_code),
      level: subject && (subject.level || subject.level_code)
    });

    if (curriculum && Array.isArray(curriculum.topics)) {
      const statuses = curriculum.topics.map(function (topic) {
        return getTopicStatus(topic, progressItems);
      });
      return aggregateStatuses(statuses);
    }

    const keys = subjectKeys(subject);
    const level = normaliseLevel(subject && (subject.level || subject.level_code));
    const matching = progressItems.filter(function (item) {
      const itemSubject = text(item && item.subject_id).toLowerCase();
      const itemLevel = normaliseLevel(item && item.level);
      return keys.indexOf(itemSubject) !== -1 && (!level || !itemLevel || level === itemLevel);
    });

    return aggregateStatuses(matching.map(function (item) {
      return item.status;
    }));
  }

  function badgeHtml(status) {
    const value = normaliseStatus(status);
    if (value === "completed") {
      return '<span class="topic-badge completed" title="Completed">✓</span>';
    }
    if (value === "in_progress") {
      return '<span class="topic-badge in-progress" title="Partly completed">✎</span>';
    }
    return '<span class="topic-badge not-started" title="Not started"></span>';
  }

  function applyBadge(element, status) {
    if (!element) return;
    const value = normaliseStatus(status);
    element.classList.remove("completed", "in-progress", "not-started");

    if (value === "completed") {
      element.textContent = "✓";
      element.classList.add("completed");
      element.title = "Completed";
      return;
    }

    if (value === "in_progress") {
      element.textContent = "✎";
      element.classList.add("in-progress");
      element.title = "Partly completed";
      return;
    }

    element.textContent = "";
    element.classList.add("not-started");
    element.title = "Not started";
  }

  function updateProgress(change) {
    const value = change || {};

    if (window.GLIPLearningSession) {
      window.GLIPLearningSession.updateProgress(value);
    }

    if (window.GLIP_CACHE) {
      const context = {
        school: sessionStorage.getItem("glipSchool") || "",
        studentId: sessionStorage.getItem("glipStudentId") || "",
        subjectId: value.subject_id || value.subjectId || "",
        level: value.level || ""
      };

      window.GLIP_CACHE.upsertProgress(context, {
        subject_id: context.subjectId,
        topic_id: value.topic_id || value.topicId || "",
        level: context.level,
        activity_id: value.activity_id || value.activityId || "",
        status: value.status || "completed"
      });
    }
  }

  window.GLIPProgressEngine = {
    normaliseStatus: normaliseStatus,
    getTopicStatus: getTopicStatus,
    getSubjectStatus: getSubjectStatus,
    badgeHtml: badgeHtml,
    applyBadge: applyBadge,
    updateProgress: updateProgress
  };
})(window);
