(function () {
  "use strict";

  function getSafeReturnPath() {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("return") || "";

    if (
      value.startsWith("/mylearningspace/") &&
      !value.startsWith("/mylearningspace/help/")
    ) {
      return value;
    }

    const school =
      sessionStorage.getItem("glipSchool") ||
      (typeof window.getCurrentSchoolId === "function"
        ? window.getCurrentSchoolId()
        : "");

    return school
      ? `/mylearningspace/schools/${encodeURIComponent(school)}/subjects-home.html`
      : "/mylearningspace/";
  }

  function getCurrentRole() {
    return String(sessionStorage.getItem("glipUserType") || "")
      .trim()
      .toLowerCase();
  }

  function isAllowedForRole(element, role) {
    const roles = String(element.dataset.roles || "")
      .split(/\s+/)
      .map(function (value) {
        return value.trim().toLowerCase();
      })
      .filter(Boolean);

    return roles.length === 0 || roles.includes(role);
  }

  function filterSectionsByRole() {
    const role = getCurrentRole();

    document.querySelectorAll("[data-roles]").forEach(function (element) {
      element.hidden = !isAllowedForRole(element, role);
    });
  }

  function showStatus(message) {
    const status = document.getElementById("glipHelpStatus");
    if (!status) return;

    status.textContent = message;
    status.hidden = false;
  }

  function openRequestedSection() {
    const params = new URLSearchParams(window.location.search);
    const sectionId = String(params.get("section") || "").trim();

    if (!sectionId || sectionId === "general") {
      showStatus("This page does not yet have help available.");
      return;
    }

    const section = document.getElementById(sectionId);

    if (!section || section.hidden) {
      showStatus("This page does not yet have help available.");
      return;
    }

    if (section.tagName.toLowerCase() === "details") {
      section.open = true;
    }

    window.requestAnimationFrame(function () {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function initialiseHelpPage() {
    const button = document.getElementById("glipHelpReturnBtn");

    if (button) {
      button.addEventListener("click", function () {
        window.location.href = getSafeReturnPath();
      });
    }

    filterSectionsByRole();
    openRequestedSection();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseHelpPage);
  } else {
    initialiseHelpPage();
  }
})();
