(function () {
  "use strict";

  const MOBILE_MENU_STATE_KEY = "mls_mobile_menu_open";

function getCurrentSchool(pageContext) {
  const urlSchool = getSchoolFromUrl();

  if (urlSchool) {
    return urlSchool;
  }

  return (
    pageContext.school ||
    sessionStorage.getItem("glipSchool") ||
    (typeof window.getCurrentSchoolId === "function"
      ? window.getCurrentSchoolId()
      : "")
  );
}

function getSchoolFromUrl() {
  const match = window.location.pathname.match(/\/schools\/([^/]+)\//);
  const school = match ? match[1] : "";

  if (school === "management") {
    return "";
  }

  return school;
}

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeader);
  } else {
    initHeader();
  }

  window.addEventListener("pageshow", function () {
    const pageContext = window.PAGE_MENU_CONTEXT || {};
    pageContext.school = getCurrentSchool(pageContext);
    requireGlipLogin(pageContext);
  });

  function initHeader() {
    const placeholder = document.getElementById("header-placeholder");
    if (!placeholder) return;

    const headerConfig = window.HEADER_CONFIG || {};
    const pageContext = window.PAGE_MENU_CONTEXT || {};

if (window.PAGE_CONFIG?.pageKind === "management") {
  document.body.classList.add("glip-management-page");
}

    pageContext.school = getCurrentSchool(pageContext);

    if (!requireGlipLogin(pageContext)) {
      return;
    }

    const menuKey = headerConfig.menu || "home";

    let menuData = null;
    let resolvedMenuKey = menuKey;

    if (typeof window.buildMenuConfig === "function") {
      menuData = window.buildMenuConfig(pageContext);
      resolvedMenuKey = pageContext.type || menuKey || "home";
    }

    if (!menuData && window.MENU_CONFIG && window.MENU_CONFIG[menuKey]) {
      menuData = window.MENU_CONFIG[menuKey];
      resolvedMenuKey = menuKey;
    }

    if (!menuData) {
      showHeaderError(placeholder, "Menu configuration not found.");
      return;
    }

    renderHeader(placeholder, menuData, resolvedMenuKey);
    attachMenuEvents();
    highlightCurrentPage();
    restoreMobileMenuState();
    addGlipUserBar();
    initGlipThemeToggle();
    initGlipTextSizeToggle();
    refreshMenuProgressIcons(pageContext);
  }


function buildRoleFooterLinks(existingSettingsItems) {
  const role = getCurrentRole();
  const pageContext = window.PAGE_MENU_CONTEXT || {};
  const school = getCurrentSchool(pageContext);
  const level = normaliseLevel(
    pageContext.level || sessionStorage.getItem("glipLevel") || ""
  );
  const subject = pageContext.subject || "";
  const permissions = getTeacherPermissions();

  if (!role) return [];
  if (isStudent()) {
    return [{ text: "▧ Class Resources", url: `/mylearningspace/schools/management/class-resources.html` }];
  }

  const links = [];

  /*
   * Administrator menu.
   * Leave this section unchanged.
   */
  if (isAdmin()) {
    links.push(
      {
        text: "▥ Level Management",
        url: `/mylearningspace/schools/management/level-management.html`
      },
      {
        text: "▣ Class Management",
        url: `/mylearningspace/schools/management/class-management.html`
      },
      {
        text: "▤ Subject Management",
        url: `/mylearningspace/schools/management/subject-management.html`
      },
      {
        text: "▤ Topic Management",
        url: `/mylearningspace/schools/management/topic-management.html`
      },
      {
        text: "⌘ Teacher Management",
        url: `/mylearningspace/schools/management/teacher-management.html`
      },
      {
        text: "☞ Student Management",
        url: `/mylearningspace/schools/management/student-management.html`
      },
      { spacer: true },
      {
        text: "🕮 Teaching Assignments",
        url: `/mylearningspace/schools/management/teaching-assignments.html`
      },
      {
        text: "☑ Student Assignments",
        url: `/mylearningspace/schools/management/student-subject-management.html`
      },
      { spacer: true },
      {
        text: "⌂ Subjects",
        url: `/mylearningspace/schools/${school}/subjects-home.html`
      },
      {
        text: "▧ Class Resources",
        url: `/mylearningspace/schools/management/class-resources.html`
      }
    );

    if (typeof isOwner === "function" && isOwner()) {
      links.push(
        { text: "✦ Activity Management", url: "/mylearningspace/schools/management/activity-management.html" },
        { text: "✓ Content Validator", url: "/mylearningspace/schools/management/content-validator.html" },
        { text: "◴ Performance Monitor", url: "/mylearningspace/schools/management/performance-monitor.html" },
        { spacer: true }
      );
    }

    return links;
  }

  if (!isTeachingStaff()) {
    return [];
  }

  const hasAnyAssignment = permissions.some(function (permission) {
    return isTrueValue(permission.active);
  });

  if (!hasAnyAssignment) {
    return [];
  }

  /*
   * Links shown to all teaching staff.
   */
  links.push({
    text: "⌂ Subjects",
    url: `/mylearningspace/schools/${school}/subjects-home.html`
  });
  links.push({
    text: "▧ Class Resources",
    url: `/mylearningspace/schools/management/class-resources.html`
  });

  /*
   * Lead teacher menu.
   */
  if (role === "lead_teacher") {
    links.push(
      {
        text: "▤ Topic Management",
        url: `/mylearningspace/schools/management/topic-management.html`
      },
      {
        text: "▣ Work Folder Management",
        url: `/mylearningspace/schools/management/work-folder-management.html`
      },
      {
        text: "◔ Progress",
        url: "#"
      },
      {
        spacer: true
      }
    );

    return links;
  }

/*
 * Subject teacher menu.
 */
links.push(
  {
    text: "▣ Work Folder Management",
    url: `/mylearningspace/schools/management/work-folder-management.html`
  },
  {
    text: "◔ Progress",
    url: "#"
  },
  {
    spacer: true
  }
);

return links;
}



  



  

function getTeacherPermissions() {
  try {
    return JSON.parse(sessionStorage.getItem("glipTeacherPermissions") || "[]");
  } catch {
    return [];
  }
}

function normaliseLevel(level) {
  const match = String(level || "").match(/\d+/);
  return match ? "level-" + match[0].padStart(2, "0") : "";
}

function teacherHasSubjectLevelPermission(subject, level) {
  if (isAdmin()) return true;

  if (!subject || !level) return false;

  const permissions = getTeacherPermissions();

  return permissions.some(function (permission) {
    return (
      String(permission.subject_id || "").trim() === String(subject).trim() &&
      normaliseLevel(permission.level) === normaliseLevel(level) &&
      isTrueValue(permission.active)
    );
  });
}




  
function isTrueValue(value) {
  return (
    value === true ||
    String(value || "").trim().toLowerCase() === "true" ||
    String(value || "").trim().toLowerCase() === "yes" ||
    String(value || "").trim() === "1"
  );
}


  
  function renderHeader(placeholder, menuData, menuKey) {
    const items = Array.isArray(menuData.items) ? menuData.items : [];

    let settingsItems = Array.isArray(menuData.settingsItems)
      ? menuData.settingsItems
      : [];

settingsItems = buildRoleFooterLinks(settingsItems);
    

    const menuItemsHtml = items
      .map(function (item) {
        if (item.type === "label") {
          return `<div class="side-nav-label">${escapeHtml(item.text)}</div>`;
        }

        const extraClass = item.type === "primary" ? " side-nav-primary" : "";
        const progressIcon = getMenuProgressIcon(item);

        return `
          <a href="${escapeHtml(item.url)}"
             class="side-nav-link${extraClass}"
             data-menu-url="${escapeHtml(item.url)}">

            <span class="side-nav-text">
              ${escapeHtml(item.text)}
            </span>

            ${progressIcon}
          </a>
        `;
      })
      .join("");

    const logoHtml = !menuData.homeUrl
      ? `<div class="side-nav-logo">${escapeHtml(menuData.siteTitle || "GLIP")}</div>`
      : `<a href="${escapeHtml(menuData.homeUrl)}"
            class="side-nav-logo"
            data-menu-url="${escapeHtml(menuData.homeUrl)}">
            ${escapeHtml(menuData.siteTitle || "GLIP")}
         </a>`;

    const settingsHtml = settingsItems
      .map(function (item, index) {
        const separator = "";

        if (item.spacer) {
          return '<div class="side-nav-settings-spacer"></div>';
        }
        return `
          ${separator}
          <a href="${escapeHtml(item.url)}"
             class="side-nav-settings-link"
             data-menu-url="${escapeHtml(item.url)}"
             ${item.target ? `target="${escapeHtml(item.target)}"` : ""}
             ${item.target === "_blank" ? 'rel="noopener noreferrer"' : ""}>
            ${escapeHtml(item.text)}
          </a>
        `;
      })
      .join("");

  const showDisplayToggle =
  menuKey !== "home";

const schoolLabel = getNavSchoolLabel();
const glipVersion = window.GLIP_ASSET_VERSION || "";

const footerHtml = `
  <div class="side-nav-footer">
    ${settingsHtml}

    ${
      showDisplayToggle
        ? `

        <button
      type="button"
      class="side-nav-settings-link glip-display-toggle"
      id="glipThemeToggle"
    >
      Theme: Blue
    </button>
    
    <button
      type="button"
      class="side-nav-settings-link glip-display-toggle"
      id="glipDisplayToggle"
    >
      Display: Warm
    </button>

    <button
      type="button"
      class="side-nav-settings-link glip-display-toggle"
      id="glipTextSizeToggle"
    >
      Text Size: Default
    </button>
    `
        : ""
    }

<div class="side-nav-footer-text">
  &copy; GLIP${
    schoolLabel
      ? ` | ${escapeHtml(schoolLabel)}`
      : ""
  }${
    glipVersion
      ? ` | v 1.${escapeHtml(glipVersion)}`
      : ""
  }
</div>
  </div>
`;
    

    placeholder.innerHTML = `
      <button class="mobile-menu-btn no-print" id="mobileMenuBtn" type="button"></button>
      <div class="mobile-menu-backdrop no-print" id="mobileMenuBackdrop"></div>

      <aside class="side-nav no-print" id="sideNav">
        <div class="side-nav-inner">
          ${logoHtml}
          <nav class="side-nav-menu">${menuItemsHtml}</nav>
          ${footerHtml}
        </div>
      </aside>
    `;
  }

  function attachMenuEvents() {
    const menuBtn = document.getElementById("mobileMenuBtn");
    const sideNav = document.getElementById("sideNav");
    const backdrop = document.getElementById("mobileMenuBackdrop");

    if (!menuBtn || !sideNav || !backdrop) return;

    menuBtn.addEventListener("click", function () {
      sideNav.classList.toggle("mobile-open");
      backdrop.classList.toggle("show");
      document.body.classList.toggle("menu-open");

      sessionStorage.setItem(
        MOBILE_MENU_STATE_KEY,
        sideNav.classList.contains("mobile-open") ? "true" : "false",
      );
    });

backdrop.addEventListener("click", closeMobileMenu);

sideNav.querySelectorAll("a").forEach(function (link) {
  link.addEventListener("click", function () {
    closeMobileMenu();
  });
});

function closeMobileMenu() {
      sideNav.classList.remove("mobile-open");
      backdrop.classList.remove("show");
      document.body.classList.remove("menu-open");
      sessionStorage.setItem(MOBILE_MENU_STATE_KEY, "false");
    }
  }

  function restoreMobileMenuState() {
    const shouldOpen = sessionStorage.getItem(MOBILE_MENU_STATE_KEY) === "true";
    if (!shouldOpen) return;

    const sideNav = document.getElementById("sideNav");
    const backdrop = document.getElementById("mobileMenuBackdrop");

    if (sideNav) sideNav.classList.add("mobile-open");
    if (backdrop) backdrop.classList.add("show");
    document.body.classList.add("menu-open");
  }

function highlightCurrentPage() {
  const currentFile = window.location.pathname.split("/").pop();
  const links = document.querySelectorAll(".side-nav-link");

  links.forEach(function (link) {
    const menuUrl = link.getAttribute("data-menu-url") || "";
    const linkFile = menuUrl.split("?")[0].split("/").pop();

    if (linkFile === currentFile) {
      link.classList.add("active");
    }
  });
}

  function addGlipUserBar() {
const userType = sessionStorage.getItem("glipUserType");

const studentName =
  sessionStorage.getItem("glipStudentFullName") ||
  sessionStorage.getItem("glipStudentName");

const classLabel =
  sessionStorage.getItem("glipClassLabel") ||
  sessionStorage.getItem("glipClassId");

const teacherName =
  sessionStorage.getItem("glipTeacherFullName") ||
  sessionStorage.getItem("glipTeacherName");


    

    if (!userType) return;

    let displayName = "";
    let roleLabel = "";

    
    if (userType === "student") {
      displayName = studentName || "";

if (classLabel) {
  displayName += " (" + classLabel + ")";
}
    }

    if (isStaff()) {
      displayName = teacherName || "";
    
      const currentRoleLabel = getCurrentRoleLabel();
    
      if (currentRoleLabel) {
        roleLabel = " (" + currentRoleLabel + ")";
      }
    }


    

    if (!displayName) return;

    const headerPlaceholder = document.getElementById("header-placeholder");
    if (!headerPlaceholder) return;

    const bar = document.createElement("div");
    bar.className = "glip-user-bar is-visible";
    
bar.innerHTML = `
  <span class="glip-user-name">
    Logged in as ${escapeHtml(displayName)}${escapeHtml(roleLabel)}
  </span>
  <button type="button" class="glip-btn" id="glipLogoutBtn">
    Log out
  </button>
`;
    
    const pageHero = document.querySelector(".page-hero");

    if (pageHero) {
      pageHero.insertAdjacentElement("afterend", bar);
    } else {
      headerPlaceholder.insertAdjacentElement("afterend", bar);
    }

const backgroundBtn = document.getElementById("glipDisplayToggle");

const warmEnabled =
  localStorage.getItem("glipWarmBackground") === "on";

if (warmEnabled) {
  document.body.classList.add("glip-dyslexia-bg");
}

if (backgroundBtn) {
  function updateBackgroundButton() {
    const warmEnabled =
      document.body.classList.contains("glip-dyslexia-bg");

    backgroundBtn.textContent = warmEnabled
      ? "Display: Warm"
      : "Display: White";

    backgroundBtn.setAttribute(
      "aria-label",
      warmEnabled
        ? "Switch to white background"
        : "Switch to warm background"
    );
  }

  updateBackgroundButton();

  backgroundBtn.addEventListener("click", function () {
    const enabled =
      document.body.classList.toggle("glip-dyslexia-bg");

    localStorage.setItem(
      "glipWarmBackground",
      enabled ? "on" : "off"
    );

    updateBackgroundButton();
  });
}

    
bar
  .querySelector("#glipLogoutBtn")
  .addEventListener("click", function () {

    const school = getCurrentSchool(window.PAGE_MENU_CONTEXT || {});

    // Preserve user preferences.
    const textSize = localStorage.getItem("glipTextSize");
    const warmBackground = localStorage.getItem("glipWarmBackground");
    const theme = localStorage.getItem("glipTheme");

    // Clear everything.
    sessionStorage.clear();
    localStorage.clear();

    // Restore preferences only.
    if (textSize) {
      localStorage.setItem("glipTextSize", textSize);
    }

    if (warmBackground) {
      localStorage.setItem("glipWarmBackground", warmBackground);
    }

    if (theme) {
      localStorage.setItem("glipTheme", theme);
    }

    window.location.replace(
      `${window.location.origin}/mylearningspace/schools/${school}/index.html`
    );
  });


    


    
  }

  function requireGlipLogin(pageContext) {
    const protectedTypes = [
      "level-subject-list",
      "subject-landing",
      "topic",
      "topic-visibility-home",
    ];

    const pageType = pageContext.type || "home";

    if (!protectedTypes.includes(pageType)) {
      return true;
    }

const userType = sessionStorage.getItem("glipUserType");

if (userType) {
  return true;
}

const school =
  pageContext.school ||
  sessionStorage.getItem("glipSchool") ||
  "";

document.body.innerHTML = `
  <div style="
    font-family: Arial, sans-serif;
    text-align: center;
    padding: 70px 20px;
    color: #0b3c6f;
  ">
    <h2>Your session has ended</h2>
    <p>${school
      ? "Please log in again to continue."
      : "Please open GLIP from your school's login page."}</p>
  </div>
`;

if (school) {
  setTimeout(function () {
    window.location.replace(
      `${window.location.origin}/mylearningspace/schools/${encodeURIComponent(school)}/index.html`
    );
  }, 1000);
}


    

    return false;
  }

  function getMenuProgressIcon(item) {
    const activityId = item.activity_id;

    if (!activityId) {
      return "";
    }

    return `
      <span
        class="topic-badge inline-badge side-menu-badge"
        data-menu-progress-activity-id="${escapeHtml(activityId)}"
        title="Checking progress">
      </span>
    `;
  }

  function normaliseProgressStatus(status) {
    if (status === "completed") return "completed";

    if (status === "in_progress" || status === "partly_completed") {
      return "in_progress";
    }

    return "not_started";
  }

  function getActivityProgressStatus(activityId) {
    let foundStatus = "not_started";

    Object.keys(sessionStorage).forEach(function (key) {
      if (key.endsWith("_time")) return;

      try {
        const parsed = JSON.parse(sessionStorage.getItem(key));

        if (!Array.isArray(parsed)) return;

        parsed.forEach(function (item) {
          if (String(item.activity_id) === String(activityId)) {
            foundStatus = normaliseProgressStatus(item.status);
          }
        });
      } catch {
        // Ignore non-JSON session items.
      }
    });

    return foundStatus;
  }

  function applyStatusToMenuBadge(badge, status) {
    badge.classList.remove("completed", "in-progress", "not-started");

    if (status === "completed") {
      badge.textContent = "✓";
      badge.classList.add("completed");
      badge.title = "Completed";
      return;
    }

    if (status === "in_progress") {
      badge.textContent = "✎";
      badge.classList.add("in-progress");
      badge.title = "Partly completed";
      return;
    }

    badge.textContent = "";
    badge.classList.add("not-started");
    badge.title = "Not started";
  }

  function updateMenuProgressBadges() {
    document
      .querySelectorAll("[data-menu-progress-activity-id]")
      .forEach(function (badge) {
        const activityId = badge.getAttribute("data-menu-progress-activity-id");
        const status = getActivityProgressStatus(activityId);
        applyStatusToMenuBadge(badge, status);
      });
  }

  /*
  ==================================================
  Instant progress icon refresh
  ==================================================
*/

  window.addEventListener("glipProgressSaved", function (event) {
    const detail = event.detail || {};

    const pageContext = window.PAGE_MENU_CONTEXT || {};

    const studentId = sessionStorage.getItem("glipStudentId") || "";

    if (!studentId) return;

    const level = normaliseLevel(detail.level || sessionStorage.getItem("glipLevel") || "");

    if (!level) return;

    const subject = detail.subjectId || pageContext.subject || "";

    const key = [
      "glip",
      "v1",
      pageContext.school ||
      sessionStorage.getItem("glipSchool") ||
      "unknown-school",
      level,
      studentId,
      subject,
      "progress",
    ].join("_");

    let cached = [];

    try {
      cached = JSON.parse(sessionStorage.getItem(key) || "[]");
    } catch {
      cached = [];
    }

    const existing = cached.find(function (item) {
      return item.activity_id === detail.activityId;
    });

    if (existing) {
      existing.status = detail.status;
    } else {
      cached.push({
        activity_id: detail.activityId,
        status: detail.status,
      });
    }

    sessionStorage.setItem(key, JSON.stringify(cached));

    updateMenuProgressBadges();
  });

  function refreshMenuProgressIcons(pageContext) {
    updateMenuProgressBadges();

    if (!pageContext || pageContext.type !== "topic") {
      return;
    }

    const studentId = sessionStorage.getItem("glipStudentId") || "";
    const subject = pageContext.subject || "";
    const level = normaliseLevel(
      pageContext.level || sessionStorage.getItem("glipLevel") || ""
    );

    if (!studentId || !subject || !level) {
      return;
    }

    fetch(window.getGlipWebAppUrl(), {
      method: "POST",
      body: JSON.stringify({
        action: "getMyProgress",
        student_id: studentId,
        subject_id: subject,
        level: level,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.status !== "success" || !Array.isArray(data.progress)) {
          return;
        }

        const key = [
          "glip",
          "v1",
          pageContext.school ||
      sessionStorage.getItem("glipSchool") ||
      "unknown-school",
          level,
          studentId,
          subject,
          "progress",
        ].join("_");

        sessionStorage.setItem(key, JSON.stringify(data.progress));
        sessionStorage.setItem(key + "_time", String(Date.now()));

        updateMenuProgressBadges();
      })
      .catch(function (err) {
        console.warn("Could not refresh menu progress icons.", err);
      });
  }

function applyGlipTextSize(size) {
  document.documentElement.classList.remove(
    "glip-text-normal",
    "glip-text-large",
    "glip-text-larger"
  );

  document.documentElement.classList.add(`glip-text-${size}`);
  localStorage.setItem("glipTextSize", size);
}

function formatGlipTextSize(size) {
  if (size === "large") return "Large";
  if (size === "larger") return "Larger";
  return "Default";
}

function applyGlipTheme(theme) {
  const root = document.documentElement;

  root.classList.remove(
    "glip-theme-blue",
    "glip-theme-grey",
    "glip-theme-burgundy"
  );

  if (theme === "grey") {
    root.classList.add("glip-theme-grey");
  } else if (theme === "burgundy") {
    root.classList.add("glip-theme-burgundy");
  } else {
    theme = "blue";
  }

  localStorage.setItem("glipTheme", theme);
}

function formatGlipTheme(theme) {
  if (theme === "grey") return "Grey";
  if (theme === "burgundy") return "Burgundy";
  return "Blue";
}

function initGlipThemeToggle() {
  const themeToggle = document.getElementById("glipThemeToggle");
  const savedTheme = localStorage.getItem("glipTheme") || "blue";

  applyGlipTheme(savedTheme);

  if (!themeToggle) return;

  themeToggle.textContent = `Theme: ${formatGlipTheme(savedTheme)}`;

  themeToggle.addEventListener("click", function () {
    const currentTheme = localStorage.getItem("glipTheme") || "blue";

    let nextTheme = "grey";

    if (currentTheme === "grey") {
      nextTheme = "burgundy";
    } else if (currentTheme === "burgundy") {
      nextTheme = "blue";
    }

    applyGlipTheme(nextTheme);
    themeToggle.textContent = `Theme: ${formatGlipTheme(nextTheme)}`;
  });
}

  
function initGlipTextSizeToggle() {
  const textToggle = document.getElementById("glipTextSizeToggle");
  if (!textToggle) return;

  const savedSize = localStorage.getItem("glipTextSize") || "normal";
  applyGlipTextSize(savedSize);

  textToggle.textContent = `Text Size: ${formatGlipTextSize(savedSize)}`;

  textToggle.addEventListener("click", function () {
    const currentSize = localStorage.getItem("glipTextSize") || "normal";

    let nextSize = "large";

    if (currentSize === "large") {
      nextSize = "larger";
    } else if (currentSize === "larger") {
      nextSize = "normal";
    }

    applyGlipTextSize(nextSize);
    textToggle.textContent = `Text Size: ${formatGlipTextSize(nextSize)}`;
  });
}

function getNavSchoolLabel() {
  try {
    return window.getCurrentSchoolConfig().label || "";
  } catch {
    return "";
  }
}

  
  function showHeaderError(placeholder, message) {
    placeholder.innerHTML = `<div style="padding:16px;color:red;">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();
