(function () {
  "use strict";

  const TEACHING_ROLES = ["lead_teacher", "subject_teacher"];

  const CAPABILITIES = {
    VIEW_SUBJECTS: "view_subjects",
    VIEW_CLASS_RESOURCES: "view_class_resources",
    MANAGE_WORK_FOLDERS: "manage_work_folders",
    VIEW_PROGRESS: "view_progress",
    MANAGE_TOPICS: "manage_topics"
  };

  const ROLE_CAPABILITIES = {
    lead_teacher: [
      CAPABILITIES.VIEW_SUBJECTS,
      CAPABILITIES.VIEW_CLASS_RESOURCES,
      CAPABILITIES.MANAGE_WORK_FOLDERS,
      CAPABILITIES.VIEW_PROGRESS,
      CAPABILITIES.MANAGE_TOPICS
    ],
    subject_teacher: [
      CAPABILITIES.VIEW_SUBJECTS,
      CAPABILITIES.VIEW_CLASS_RESOURCES,
      CAPABILITIES.MANAGE_WORK_FOLDERS,
      CAPABILITIES.VIEW_PROGRESS
    ]
  };

  function normaliseRole(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normaliseLevel(value) {
    const match = String(value || "").match(/\d+/);
    return match ? "level-" + match[0].padStart(2, "0") : "";
  }

  function levelNumber(value) {
    const match = normaliseLevel(value).match(/\d+/);
    return match ? match[0] : "";
  }

  function isTrue(value) {
    return value === true || ["true", "yes", "1"].includes(
      String(value || "").trim().toLowerCase()
    );
  }

  function getRole() {
    if (typeof window.getCurrentRole === "function") {
      return normaliseRole(window.getCurrentRole());
    }

    return normaliseRole(
      sessionStorage.getItem("glipRole") ||
      sessionStorage.getItem("glipTeacherRole") ||
      sessionStorage.getItem("glipUserType")
    );
  }

  function isTeachingRole(role) {
    return TEACHING_ROLES.includes(normaliseRole(role || getRole()));
  }

  function readPermissions() {
    try {
      const parsed = JSON.parse(
        sessionStorage.getItem("glipTeacherPermissions") || "[]"
      );

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("GLIP teacher permissions could not be read.", error);
      return [];
    }
  }

  function normalisePermission(permission) {
    const item = permission && typeof permission === "object" ? permission : {};

    return Object.assign({}, item, {
      active: isTrue(item.active),
      level: normaliseLevel(item.level || item.level_code),
      subject_id: String(item.subject_id || item.subject_pk || "").trim(),
      curriculum_id: String(item.curriculum_id || "").trim(),
      class_id: String(item.class_id || "").trim()
    });
  }

  function getPermissions(options) {
    const settings = options || {};
    const permissions = readPermissions().map(normalisePermission);

    return settings.includeInactive
      ? permissions
      : permissions.filter(function (permission) {
          return permission.active;
        });
  }

  function getPrimaryLevel() {
    const storedLevel = normaliseLevel(sessionStorage.getItem("glipLevel"));
    if (storedLevel) return storedLevel;

    const firstPermission = getPermissions()[0];
    return firstPermission ? firstPermission.level : "";
  }

  function hasAssignments() {
    return getPermissions().length > 0;
  }

  function hasCapability(capability, role) {
    const currentRole = normaliseRole(role || getRole());

    if (currentRole === "owner" || currentRole === "admin") {
      return true;
    }

    return (ROLE_CAPABILITIES[currentRole] || []).includes(capability);
  }

  function hasSubjectLevelPermission(subjectId, level) {
    const role = getRole();
    if (role === "owner" || role === "admin") return true;

    const subject = String(subjectId || "").trim();
    const normalisedLevel = normaliseLevel(level);
    if (!subject || !normalisedLevel) return false;

    return getPermissions().some(function (permission) {
      return permission.subject_id === subject && permission.level === normalisedLevel;
    });
  }

  function getSchool() {
    const match = window.location.pathname.match(/\/schools\/([^/]+)\//i);
    const urlSchool = match ? match[1] : "";

    return urlSchool && urlSchool !== "management"
      ? urlSchool
      : String(sessionStorage.getItem("glipSchool") || "").trim();
  }

  function getNavigationItems() {
    const school = getSchool();
    const items = [];

    if (!isTeachingRole() || !hasAssignments()) return items;

    items.push({
      text: "⌂ Subjects",
      url: "/mylearningspace/schools/" + school + "/subjects-home.html"
    });

    items.push({
      text: "▧ Class Resources",
      url: "/mylearningspace/schools/management/class-resources.html"
    });

    if (hasCapability(CAPABILITIES.MANAGE_TOPICS)) {
      items.push({
        text: "▤ Topic Management",
        url: "/mylearningspace/schools/management/topic-management.html"
      });
    }

    if (hasCapability(CAPABILITIES.MANAGE_WORK_FOLDERS)) {
      items.push({
        text: "▣ My GLIP Storage",
        url: "/mylearningspace/schools/management/work-folder-management.html"
      });

      items.push({
        text: "▨ Student Submissions",
        url: "/mylearningspace/schools/management/student-submissions.html"
      });
    }

    if (hasCapability(CAPABILITIES.VIEW_PROGRESS)) {
      items.push({ text: "◔ Progress", url: "#" });
    }

    items.push({ spacer: true });
    return items;
  }

  function requireCapability(capability) {
    if (hasCapability(capability) && hasAssignments()) return true;

    if (typeof window.redirectToSchoolLogin === "function") {
      window.redirectToSchoolLogin();
    }

    return false;
  }

  window.GLIPTeachingRole = Object.freeze({
    CAPABILITIES: Object.freeze(CAPABILITIES),
    getRole: getRole,
    isTeachingRole: isTeachingRole,
    getPermissions: getPermissions,
    getPrimaryLevel: getPrimaryLevel,
    getPrimaryLevelNumber: function () { return levelNumber(getPrimaryLevel()); },
    hasAssignments: hasAssignments,
    hasCapability: hasCapability,
    hasSubjectLevelPermission: hasSubjectLevelPermission,
    getNavigationItems: getNavigationItems,
    requireCapability: requireCapability,
    normaliseLevel: normaliseLevel
  });
})();
