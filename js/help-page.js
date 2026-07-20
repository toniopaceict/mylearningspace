(function () {
  "use strict";

  let currentRole = "";
  let requestedSectionId = "";

  function normaliseRole(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normaliseSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
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
    document.querySelectorAll(".help-topic").forEach(function (section) {
      const allowed = isAllowedForRole(section, currentRole);
      section.dataset.roleAllowed = allowed ? "true" : "false";
      section.hidden = !allowed;
    });
  }

  function showStatus(message) {
    const status = document.getElementById("glipHelpStatus");
    if (!status) return;

    status.textContent = message;
    status.hidden = false;
  }

  function hideStatus() {
    const status = document.getElementById("glipHelpStatus");
    if (!status) return;

    status.textContent = "";
    status.hidden = true;
  }

  function openRequestedSection() {
    const params = new URLSearchParams(window.location.search);
    requestedSectionId = String(params.get("section") || "").trim();

    if (!requestedSectionId || requestedSectionId === "general") {
      showStatus("This page does not yet have help available.");
      return;
    }

    const section = document.getElementById(requestedSectionId);

    if (!section || section.hidden) {
      showStatus("This page does not yet have help available.");
      return;
    }

    hideStatus();
    section.open = true;

    window.requestAnimationFrame(function () {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function getRoleAllowedTopics() {
    return Array.from(document.querySelectorAll(".help-topic")).filter(function (section) {
      return section.dataset.roleAllowed === "true";
    });
  }

  function restoreTopicsAfterSearch() {
    getRoleAllowedTopics().forEach(function (section) {
      section.hidden = false;
      section.open = section.id === requestedSectionId;
    });

    document.querySelectorAll('.help-topic[data-role-allowed="false"]').forEach(function (section) {
      section.hidden = true;
    });
  }

  function runHelpSearch() {
    const input = document.getElementById("glipHelpSearch");
    const clearButton = document.getElementById("glipHelpSearchClear");
    const searchStatus = document.getElementById("glipHelpSearchStatus");
    if (!input || !clearButton || !searchStatus) return;

    const query = normaliseSearchText(input.value);
    clearButton.hidden = !query;

    if (!query) {
      restoreTopicsAfterSearch();
      searchStatus.textContent = "";
      return;
    }

    const words = query.split(" ").filter(Boolean);
    let matches = 0;

    getRoleAllowedTopics().forEach(function (section) {
      const searchableText = normaliseSearchText(section.textContent);
      const isMatch = words.every(function (word) {
        return searchableText.includes(word);
      });

      section.hidden = !isMatch;
      section.open = isMatch;
      if (isMatch) matches += 1;
    });

    if (matches === 0) {
      searchStatus.textContent = "No help sections match your search.";
    } else if (matches === 1) {
      searchStatus.textContent = "1 matching help section.";
    } else {
      searchStatus.textContent = matches + " matching help sections.";
    }
  }

  function initialiseSearch() {
    const input = document.getElementById("glipHelpSearch");
    const clearButton = document.getElementById("glipHelpSearchClear");
    if (!input || !clearButton) return;

    input.addEventListener("input", runHelpSearch);
    input.addEventListener("search", runHelpSearch);

    clearButton.addEventListener("click", function () {
      input.value = "";
      runHelpSearch();
      input.focus();
    });
  }

  function initialiseHelpPage() {
    currentRole = getCurrentRole();
    filterSectionsByRole();
    openRequestedSection();
    initialiseSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseHelpPage);
  } else {
    initialiseHelpPage();
  }
})();
