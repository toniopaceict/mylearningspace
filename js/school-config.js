(function () {
  "use strict";

  const SCHOOL_CONFIG = {
    toniopace_school: {
      label: "Tonio Pace",
      webAppUrl: "https://script.google.com/macros/s/AKfycbyRMUoeoT-jPTjMSWEk4eTj4CLo6OYYehMegXnw4OciwpdcYvtLMUrS4r5NtCd0QEILOA/exec"
    },
 
    raphael: {
      label: "St Raphael's School",
      webAppUrl: "https://script.google.com/macros/s/AKfycbyBqXP62z6NBh5QulyefkF-iXXCccBv4w-LvJDWMbIGzAvIBO0cNrobJYtmvmSwQCq5TQ/exec"
    },

    mylearningspace: {
      label: "My Learning Space",
      webAppUrl: "https://script.google.com/macros/s/AKfycbzX6Z89fAg0JwKG5aBcWjOKuk3f1z2vHKaK6eagaExawFfARn-Z96RQj77p3rb5GsVH/exec"
    },
    

    demo: {
      label: "Demo School",
      webAppUrl: "https://script.google.com/macros/s/AKfycbymb_aa7J8xt_elqj3MARgt_1BwBZz06_YPGbZEt6VajPnMDcxu78wElqc-BARJ4w0nIQ/exec"
    }
  };

  function getSchoolFromPath() {
    const match = window.location.pathname.match(/\/schools\/([^/]+)\//i);
    const school = match ? String(match[1] || "").trim() : "";

    return school && school !== "management" ? school : "";
  }

  function getSchoolFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("school") || "").trim();
  }

  function getCurrentSchoolId() {
    const schoolId =
      getSchoolFromPath() ||
      getSchoolFromQuery() ||
      String(sessionStorage.getItem("glipSchool") || "").trim();

    if (schoolId && SCHOOL_CONFIG[schoolId]) {
      sessionStorage.setItem("glipSchool", schoolId);
    }

    return schoolId;
  }

  function getCurrentSchoolConfig() {
    const schoolId = getCurrentSchoolId();

    if (!schoolId) {
      throw new Error(
        "The school could not be identified. Please open GLIP from your school's login page."
      );
    }

    if (!SCHOOL_CONFIG[schoolId]) {
      throw new Error("Unknown school: " + schoolId);
    }

    return SCHOOL_CONFIG[schoolId];
  }

  function getCurrentSchoolLabel() {
    return getCurrentSchoolConfig().label;
  }

  function getGlipWebAppUrl() {
    return getCurrentSchoolConfig().webAppUrl;
  }

  function applyCurrentSchoolToPageConfig() {
    const schoolId = getCurrentSchoolId();

    if (!schoolId || !SCHOOL_CONFIG[schoolId]) {
      return;
    }

    if (window.PAGE_MENU_CONTEXT) {
      window.PAGE_MENU_CONTEXT.school = schoolId;
    }

    if (window.PAGE_CONFIG) {
      window.PAGE_CONFIG.school = schoolId;
      window.PAGE_CONFIG.webAppUrl = SCHOOL_CONFIG[schoolId].webAppUrl;

      if (Object.prototype.hasOwnProperty.call(window.PAGE_CONFIG, "uploadWebAppUrl")) {
        window.PAGE_CONFIG.uploadWebAppUrl = SCHOOL_CONFIG[schoolId].webAppUrl;
      }
    }
  }

  window.GLIP_SCHOOL_CONFIG = SCHOOL_CONFIG;
  window.getCurrentSchoolId = getCurrentSchoolId;
  window.getCurrentSchoolConfig = getCurrentSchoolConfig;
  window.getCurrentSchoolLabel = getCurrentSchoolLabel;
  window.getGlipWebAppUrl = getGlipWebAppUrl;
  window.applyCurrentSchoolToPageConfig = applyCurrentSchoolToPageConfig;

  applyCurrentSchoolToPageConfig();
})();
