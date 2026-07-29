(function (window) {
  "use strict";

  const STORAGE_KEY = "glipLearningSession";
  const SCHEMA_VERSION = 1;

  function read() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (!value || Number(value.schema_version) !== SCHEMA_VERSION) return null;
      return value;
    } catch (error) {
      return null;
    }
  }

  function write(value) {
    if (!value || Number(value.schema_version) !== SCHEMA_VERSION) return false;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("Could not store the GLIP learning session.", error);
      return false;
    }
  }

  function clear() { sessionStorage.removeItem(STORAGE_KEY); }

  function hasValidSession() {
    return read() !== null;
  }

  function curricula() {
    const session = read();
    return session && Array.isArray(session.curricula) ? session.curricula : null;
  }

  function getCurriculum(criteria) {
    criteria = criteria || {};
    const curriculumId = String(criteria.curriculum_id || criteria.curriculumId || "").trim();
    const subject = String(criteria.subject_id || criteria.subject_code || criteria.subject || "").trim().toLowerCase();
    const level = String(criteria.level || criteria.level_code || "").trim().toLowerCase();

    const items = curricula();
    if (!items) return null;

    return items.find(function (item) {
      if (curriculumId && String(item.curriculum_id || "") === curriculumId) return true;
      const itemSubject = String(item.subject_id || item.subject_code || "").toLowerCase();
      const itemLevel = String(item.level || item.level_code || "").toLowerCase();
      return !!subject && !!level && itemSubject === subject && itemLevel === level;
    }) || null;
  }

  function getSubjects() {
    const items = curricula();
    if (!items) return null;

    return items.map(function (item) {
      const copy = Object.assign({}, item);
      delete copy.topics;
      delete copy.progress;
      delete copy.resources;
      return copy;
    });
  }

  function getTopics(criteria) {
    const item = getCurriculum(criteria);
    return item && Array.isArray(item.topics) ? item.topics : [];
  }

  function getProgress(criteria) {
    const item = getCurriculum(criteria);
    return item && Array.isArray(item.progress) ? item.progress : [];
  }

  function getAllProgress() {
    const items = curricula();
    if (!items) return null;

    return items.reduce(function (all, item) {
      return all.concat(Array.isArray(item.progress) ? item.progress : []);
    }, []);
  }

  function normaliseLevel(value) {
    const match = String(value || "").match(/\d+/);
    return match ? "level-" + match[0].padStart(2, "0") : "";
  }

  function curriculumMatchesProgressChange(curriculum, change) {
    const curriculumId = String(change.curriculum_id || change.curriculumId || "").trim();
    if (curriculumId && String(curriculum.curriculum_id || "") === curriculumId) {
      return true;
    }

    const suppliedSubject = String(
      change.subject_id || change.subjectId || change.subject_code || change.subjectCode || ""
    ).trim().toLowerCase();
    const subjectKeys = [
      curriculum.subject_pk,
      curriculum.subject_id,
      curriculum.subject_code
    ].map(function (value) {
      return String(value || "").trim().toLowerCase();
    }).filter(Boolean);

    const suppliedLevel = normaliseLevel(change.level || change.level_code || change.levelCode);
    const curriculumLevel = normaliseLevel(curriculum.level || curriculum.level_code);

    if (suppliedSubject && subjectKeys.indexOf(suppliedSubject) !== -1) {
      return !suppliedLevel || !curriculumLevel || suppliedLevel === curriculumLevel;
    }

    const activityId = String(change.activity_id || change.activityId || "").trim();
    if (!activityId || !Array.isArray(curriculum.topics)) return false;

    return curriculum.topics.some(function (topic) {
      return (Array.isArray(topic.activities) ? topic.activities : []).some(function (activity) {
        return String(activity.activity_id || activity.activityId || "").trim() === activityId;
      });
    });
  }

  function updateProgress(change) {
    const session = read();
    if (!session || !Array.isArray(session.curricula)) return false;

    const activityId = String(change.activity_id || change.activityId || "").trim();
    if (!activityId) return false;

    let changed = false;

    session.curricula.forEach(function (curriculum) {
      if (!curriculumMatchesProgressChange(curriculum, change)) return;
      if (!Array.isArray(curriculum.progress)) curriculum.progress = [];

      let item = curriculum.progress.find(function (row) {
        return String(row.activity_id || row.activityId || "").trim() === activityId;
      });

      if (!item) {
        item = {
          curriculum_id: curriculum.curriculum_id,
          subject_id: curriculum.subject_id || curriculum.subject_code,
          subject_code: curriculum.subject_code || curriculum.subject_id,
          level: curriculum.level || curriculum.level_code,
          topic_id: String(change.topic_id || change.topicId || ""),
          activity_id: activityId,
          status: "not_started"
        };
        curriculum.progress.push(item);
      }

      item.curriculum_id = curriculum.curriculum_id;
      item.subject_id = curriculum.subject_id || curriculum.subject_code;
      item.subject_code = curriculum.subject_code || curriculum.subject_id;
      item.level = curriculum.level || curriculum.level_code;
      item.status = String(change.status || "completed");
      if (change.topic_id || change.topicId) {
        item.topic_id = String(change.topic_id || change.topicId);
      }
      changed = true;
    });

    return changed ? write(session) : false;
  }

  function getTopicPageData(criteria) {
    const curriculum = getCurriculum(criteria);
    if (!curriculum) return null;
    const topicValue = String(criteria.topic_id || criteria.topic_code || "").trim().toLowerCase();
    const topic = (curriculum.topics || []).find(function (item) {
      return String(item.topic_pk || "") === topicValue ||
        String(item.topic_id || item.topic_code || "").toLowerCase() === topicValue;
    });
    if (!topic) return null;
    return {
      school: sessionStorage.getItem("glipSchool") || "",
      curriculum_id: curriculum.curriculum_id,
      level: { level_id: curriculum.level_id, level_code: curriculum.level, level_name: curriculum.level_name || "" },
      subject: { subject_id: curriculum.subject_pk || "", subject_code: curriculum.subject_code, subject_name: curriculum.subject_name },
      topic: { topic_id: topic.topic_pk || "", topic_code: topic.topic_code, topic_name: topic.topic_name },
      activities: Array.isArray(topic.activities) ? topic.activities : []
    };
  }

  window.GLIPLearningSession = {
    read: read, write: write, clear: clear, hasValidSession: hasValidSession,
    getSubjects: getSubjects, getCurriculum: getCurriculum,
    getTopics: getTopics, getProgress: getProgress,
    getAllProgress: getAllProgress, updateProgress: updateProgress,
    getTopicPageData: getTopicPageData
  };
})(window);
