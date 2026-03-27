(function () {
  /* =======================================================
     MENU VERSION
     Change this number whenever you update menu.css
     or header.js, so students get the new menu
     with a normal browser refresh.
     ======================================================= */
  const MENU_VERSION = "1";

  /* =======================================================
     LOAD SHARED MENU CSS
     This inserts menu.css into the <head>
     ======================================================= 
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "https://toniopaceict.github.io/mylearningspace/css/menu.css?v=" + MENU_VERSION;
  document.head.appendChild(css);*/

  /* =======================================================
     LOAD SHARED HEADER JS
     Wait until the page is ready, then load header.js
     This is important because header.js needs:
     <div id="header-placeholder"></div>
     to already exist in the page
     ======================================================= */
  function loadHeaderScript() {
    const headerScript = document.createElement("script");
    headerScript.src = "https://toniopaceict.github.io/mylearningspace/js/header.js?v=" + MENU_VERSION;
    document.body.appendChild(headerScript);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadHeaderScript);
  } else {
    loadHeaderScript();
  }
})();
