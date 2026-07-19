(function () {
  "use strict";

  function normaliseRole(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getCurrentRole() {
    const params = new URLSearchParams(window.location.search);

    return normaliseRole(
      params.get("role") || sessionStorage.getItem("glipUserType") || ""
    );
  }

  function isAllowedForRole(element, role) {
    const roles = String(element.dataset.roles || "")
      .split(/\s+/)
      .map(normaliseRole)
      .filter(Boolean);

    if (roles.length === 0 || !role || role === "owner") {
      return true;
    }

    return roles.includes(role);
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
    filterSectionsByRole();
    openRequestedSection();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseHelpPage);
  } else {
    initialiseHelpPage();
  }
})();
