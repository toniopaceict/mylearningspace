(function () {
  "use strict";

 const DEFAULT_TOPIC_ACTIVITIES = [
  { type: "lesson", number: 1 },
  { type: "practice", number: 1 },
  { type: "quiz", number: 1 },
];

 // Optional custom menu label.
// If not provided, use the default generated label.
  
const TOPIC_ACTIVITY_OVERRIDES = {
  "2": [
    { type: "lesson", number: 1 },
    { type: "practice", number: 1, label: "Practice 1A" },
    { type: "practice", number: 2, label: "Practice 1B" },
    { type: "quiz", number: 1 },
    { type: "practice", number: 3 },
    { type: "fill-blanks", number: 1 },
    { type: "reflection", number: 1 },
  ],
}; 

  function pad2(value) {
    const match = String(value || "").match(/\d+/);
    return match ? match[0].padStart(2, "0") : "";
  }

  function createMenu(siteTitle, homeUrl, items = [], settingsItems = null) {
    return {
      siteTitle,
      homeUrl,
      items,
      settingsItems,
    };
  }

  function createHomeMenu() {
    return createMenu(
      "GLIP - Guided Learning for Independent Progress",
      "index.html",
      [],
      null
    );
  }

function createLevelSubjectsMenu(level) {
  return createMenu(
    "GLIP - Guided Learning for Independent Progress",
    null,
    [],
    [
      {
        text: "Subject Settings",
        url: `subjects-${pad2(level)}-settings.html`,
        target: "_blank",
      },
    ]
  );
}

  function createSubjectVisibilityMenu(level) {
    return createMenu(
      "← Back to Subject List",
      `subjects-${pad2(level)}-home.html`,
      [],
      null
    );
  }

function createSubjectLandingMenu(school, level, subject) {
  return createMenu(
    "← Back to Subject List",
    `/mylearningspace/schools/${school}/subjects-home.html`,
    [],
    [
      {
        text: "Topic Settings",
        url: `../../../topic-settings.html`,
        target: "_blank",
      },
    ]
  );
}

  function createTopicMenu(school, level, subject, topic, isSharedPage) {
    const topicNumberRaw = String(topic).match(/\d+/)?.[0] || "1";
    const topicNumber = String(Number(topicNumberRaw));

    const topicToken = `${subject}_l${Number(level)}_t${Number(topicNumber)}`;
    const activityConfig =
      TOPIC_ACTIVITY_OVERRIDES[topicNumber] ||
      DEFAULT_TOPIC_ACTIVITIES;
    const topicFolder = `topic-${pad2(topicNumber)}`;

    const topicPagePrefix = isSharedPage
      ? `../content/${subject}/${topicFolder}/`
      : "";

    const backToTopicsUrl = isSharedPage
? `../schools/${school}/topics-home.html`
: `../../../schools/${school}/topics-home.html`;

    const items = activityConfig.map(function (activity) {

    let typeLabel =
      activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
    
if (activity.type === "reflection") {
  typeLabel = "End-of-Topic Reflection";
}

if (activity.type === "fill-blanks") {
  typeLabel = "Fill in the Blanks";
}

if (activity.type === "checkpoint") {
  typeLabel = "CheckPoint";
}
      

      const pageUrl =
        activity.type === "reflection"
          ? `../../../shared/reflection.html?school=${school}&subject=${subject}&level=${pad2(level)}&topic=${pad2(topicNumber)}`
          : `${topicPagePrefix}${activity.type}-${pad2(activity.number)}.html`;

return {
  text:
    activity.label ||
    (activity.type === "reflection"
      ? typeLabel
      : `${typeLabel} ${activity.number}`),

        url:
          isSharedPage && activity.type === "reflection"
            ? `reflection.html?school=${school}&subject=${subject}&level=${pad2(level)}&topic=${pad2(topicNumber)}`
            : pageUrl,

activity_id:
  activity.type === "reflection"
    ? `${topicToken}_reflection`
    : activity.type === "fill-blanks"
      ? `${topicToken}_fillblank${activity.number}`
      : `${topicToken}_${activity.type}${activity.number}`,
      };
    });

    return createMenu("← Back to Topic List", backToTopicsUrl, items, null);
  }

  function createTopicVisibilityMenu(subject, level) {
    return createMenu(
      "← Back to Topics",
      `${subject}-topics-${pad2(level)}-home.html`,
      [],
      null
    );
  }

  function createTopicVisibilityHomeMenu(level) {
    return createMenu(
      "← Back to Subject List",
      `../subjects-home.html`,
      [],
      null
    );
  }

  function buildMenu(context) {
    const type = context.type || "home";

    if (type === "home") {
      return createHomeMenu();
    }

    if (type === "level-subject-list") {
      return createLevelSubjectsMenu(context.level);
    }

    if (type === "subject-visibility") {
      return createSubjectVisibilityMenu(context.level);
    }

    if (type === "subject-landing") {
      return createSubjectLandingMenu(
        context.school,
        context.level,
        context.subject
      );
    }

    if (type === "topic") {
      return createTopicMenu(
        context.school,
        context.level,
        context.subject,
        context.topic,
        context.sharedPage === true
      );
    }

    if (type === "topic-visibility") {
      return createTopicVisibilityMenu(context.subject, context.level);
    }

    if (type === "topic-visibility-home") {
      return createTopicVisibilityHomeMenu(context.level || "");
    }

    return createHomeMenu();
  }

  window.buildMenuConfig = buildMenu;

  window.MENU_CONFIG = {
    home: createHomeMenu(),
  };
})();
