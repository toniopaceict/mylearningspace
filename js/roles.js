/* =========================================================
   GLIP ROLE AND GROUP FRAMEWORK
   Central role configuration
   ========================================================= */

const GLIP_GROUPS = {
  OWNER: "OWNER_GROUP",
  ADMIN: "ADMIN_GROUP",
  TEACHING_STAFF: "TEACHING_STAFF_GROUP",
  STUDENT: "STUDENT_GROUP",
  RESERVED: "RESERVED_GROUP"
};

const GLIP_ROLES = {
  owner: {
    label: "Owner",
    group: GLIP_GROUPS.OWNER,
    dashboard: "admin-home.html",
    canLogin: true
  },

  admin: {
    label: "Admin",
    group: GLIP_GROUPS.ADMIN,
    dashboard: "admin-home.html",
    canLogin: true
  },

  lead_teacher: {
    label: "Lead Teacher",
    group: GLIP_GROUPS.TEACHING_STAFF,
    dashboard: "lead-teacher-home.html",
    canLogin: true
  },

  subject_teacher: {
    label: "Subject Teacher",
    group: GLIP_GROUPS.TEACHING_STAFF,
    dashboard: "subject-teacher-home.html",
    canLogin: true
  },

  student: {
    label: "Student",
    group: GLIP_GROUPS.STUDENT,
    dashboard: null,
    canLogin: true
  },

  support: {
    label: "Support",
    group: GLIP_GROUPS.STUDENT,
    dashboard: null,
    canLogin: true
  },

  reserved_role_1: {
    label: "Reserved Role 1",
    group: GLIP_GROUPS.RESERVED,
    dashboard: null,
    canLogin: false
  },

  reserved_role_2: {
    label: "Reserved Role 2",
    group: GLIP_GROUPS.RESERVED,
    dashboard: null,
    canLogin: false
  }
};

/* =========================================================
   BASIC ROLE HELPERS
   ========================================================= */

function getCurrentRole() {
  return (
    sessionStorage.getItem("glipRole") ||
    sessionStorage.getItem("glipTeacherRole") ||
    null
  );
}

function getRoleConfig(role) {
  return GLIP_ROLES[role] || null;
}

function getCurrentRoleConfig() {
  return getRoleConfig(getCurrentRole());
}

function getRoleLabel(role) {
  const config = getRoleConfig(role);
  return config ? config.label : "Unknown Role";
}

function getCurrentRoleLabel() {
  return getRoleLabel(getCurrentRole());
}

/* =========================================================
   GROUP HELPERS
   ========================================================= */

function getGroupForRole(role) {
  const config = getRoleConfig(role);
  return config ? config.group : null;
}

function getCurrentGroup() {
  return getGroupForRole(getCurrentRole());
}

function hasGroup(...allowedGroups) {
  const group = getCurrentGroup();
  return allowedGroups.includes(group);
}

/* =========================================================
   ROLE CHECKS
   ========================================================= */

function isOwner() {
  return getCurrentGroup() === GLIP_GROUPS.OWNER;
}

function isAdmin() {
  return isOwner() || getCurrentGroup() === GLIP_GROUPS.ADMIN;
}

function isTeachingStaff() {
  return getCurrentGroup() === GLIP_GROUPS.TEACHING_STAFF;
}

function isStudent() {
  return getCurrentRole() === "student";
}

function isSupport() {
  return getCurrentRole() === "support";
}

function isStudentLikeUser() {
  return getCurrentGroup() === GLIP_GROUPS.STUDENT;
}

function isTeacherLikeUser() {
  return isOwner() || isAdmin() || isTeachingStaff();
}

function isStaff() {
  return isOwner() || isAdmin() || isTeachingStaff() || isSupport();
}

/* =========================================================
   LOGIN AND DASHBOARD HELPERS
   ========================================================= */

function isRoleAllowed(role) {
  const config = getRoleConfig(role);
  return Boolean(config && config.canLogin);
}

function getDashboardForRole(role) {
  const config = getRoleConfig(role);

  if (!config || !config.canLogin) {
    return null;
  }

  return config.dashboard;
}
