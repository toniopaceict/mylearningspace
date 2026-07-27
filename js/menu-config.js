(function () {
  "use strict";

  function pad2(value) {
    const match = String(value || "").match(/\d+/);
    return match ? match[0].padStart(2, "0") : "";
  }

  function createMenu(siteTitle, homeUrl, items, settingsItems) {
    return {
      siteTitle: siteTitle,
      homeUrl: homeUrl,
      items: Array.isArray(items) ? items : [],
      settingsItems: settingsItems || null
    };
  }

  function createHomeMenu() {
    return createMenu("GLIP - Guided Learning for Independent Progress", "index.html", [], null);
  }

  function createLevelSubjectsMenu(level) {
    return createMenu("GLIP - Guided Learning for Independent Progress", null, [], [
      { text: "Subject Settings", url: "subjects-" + pad2(level) + "-settings.html", target: "_blank" }
    ]);
  }

  function createSubjectVisibilityMenu(level) {
    return createMenu("← Back to Subject List", "subjects-" + pad2(level) + "-home.html", [], null);
  }

  function createSubjectLandingMenu(school) {
    return createMenu(
      "← Back to Subject List",
      "/mylearningspace/schools/" + school + "/subjects-home.html",
      [],
      [{ text: "Topic Settings", url: "../../../topic-settings.html", target: "_blank" }]
    );
  }

  function activityTypeLabel(code) {
    const normalised = String(code || "").toLowerCase().replace(/_/g, "-");
    const labels = {
      lesson: "Lesson",
      practice: "Practice",
      quiz: "Quiz",
      "fill-blanks": "Fill in the Blanks",
      fillblank: "Fill in the Blanks",
      reflection: "End-of-Topic Reflection",
      checkpoint: "CheckPoint"
    };
    return labels[normalised] || normalised.replace(/(^|-)([a-z])/g, function (_, dash, letter) {
      return (dash ? " " : "") + letter.toUpperCase();
    });
  }

  function activityFileName(activity) {
    if (activity.file_name) return activity.file_name;

    const id = String(activity.activity_id || "");
    const type = String(activity.activity_type_code || "").toLowerCase().replace(/_/g, "-");
    const numberMatch = id.match(/(\d+)$/);
    const number = numberMatch ? pad2(numberMatch[1]) : "01";

    if (type === "reflection") return "";
    if (type === "fillblank") return "fill-blanks-" + number + ".html";
    return type + "-" + number + ".html";
  }

  function createTopicMenu(context) {
    const school = context.school || "";
    const topicCode = context.topic || "";
    const subject = context.subject || "";
    const level = context.level || "";
    const curriculumId = context.curriculumId || "";
    const topicId = context.topicId || "";
    const backToTopicsUrl = "../../../schools/" + school + "/topics-home.html";
    const query = new URLSearchParams({
      school: school,
      curriculum_id: curriculumId,
      topic_id: topicId
    }).toString();

    const activities = (Array.isArray(context.activities) ? context.activities : [])
      .filter(function (activity) {
        return activity && activity.active !== false && activity.visible !== false;
      })
      .sort(function (a, b) {
        return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
      });

    const items = activities.map(function (activity) {
      const type = String(activity.activity_type_code || "").toLowerCase().replace(/_/g, "-");
      let url;

      if (type === "reflection") {
        url = "../../../shared/reflection.html?" + new URLSearchParams({
          school: school,
          subject: subject,
          level: pad2(level),
          topic: pad2(topicCode),
          curriculum_id: curriculumId,
          topic_id: topicId,
          activity_id: activity.activity_id || ""
        }).toString();
      } else {
        url = activityFileName(activity) + (query ? "?" + query : "");
      }

      return {
        text: activity.activity_title || activityTypeLabel(type),
        url: url,
        activity_id: activity.activity_id || ""
      };
    });

    return createMenu("← Back to Topic List", backToTopicsUrl, items, null);
  }

  function createTopicVisibilityMenu(subject, level) {
    return createMenu("← Back to Topics", subject + "-topics-" + pad2(level) + "-home.html", [], null);
  }

  function createTopicVisibilityHomeMenu() {
    return createMenu("← Back to Subject List", "../subjects-home.html", [], null);
  }

  function buildMenu(context) {
    const type = context.type || "home";
    if (type === "home") return createHomeMenu();
    if (type === "level-subject-list") return createLevelSubjectsMenu(context.level);
    if (type === "subject-visibility") return createSubjectVisibilityMenu(context.level);
    if (type === "subject-landing") return createSubjectLandingMenu(context.school);
    if (type === "topic") return createTopicMenu(context);
    if (type === "topic-visibility") return createTopicVisibilityMenu(context.subject, context.level);
    if (type === "topic-visibility-home") return createTopicVisibilityHomeMenu();
    return createHomeMenu();
  }

  window.buildMenuConfig = buildMenu;
  window.MENU_CONFIG = { home: createHomeMenu() };
})();
