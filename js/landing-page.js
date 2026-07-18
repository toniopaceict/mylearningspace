(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el && value != null) {
      el.textContent = value;
    }
  }

  function setHtml(id, value) {
    const el = byId(id);
    if (el && value != null) {
      el.innerHTML = value;
    }
  }

  function initPage(config) {
    if (!config) {
      console.warn("PAGE_CONFIG is missing.");
      return;
    }

    document.title = config.pageTitle || "Learning Space";

    setText("heroTopline", config.heroTopline);
    setText("heroMainTitle", config.heroMainTitle);
    setText("heroSubTitle", config.heroSubTitle);

    setText("aboutText", config.aboutText);

    const landingImg = byId("landingImg");
    if (landingImg) {
      landingImg.src = config.imageSrc || "";
      landingImg.alt = config.imageAlt || "";
    }

    setText("howToUseTitle", config.howToUseTitle);
    setHtml("howToUseIntro", config.howToUseIntro || "");
    setHtml("howToUseSteps", config.howToUseSteps || "");
    setHtml("howToUseOutro", config.howToUseOutro || "");

    setText("tipsText", config.tipsText);
    setText("siteFooter", config.footerText);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPage(window.PAGE_CONFIG);
  });
})();