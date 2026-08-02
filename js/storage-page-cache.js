(function () {
  "use strict";

  const CACHE_PREFIX = "glipStoragePageCache:";
  const MAX_AGE_MS = 5 * 60 * 1000;
  const ACTIONS = [
    "listMyClassResources",
    "getTeacherStorageDashboard",
    "listTeacherSubmissions"
  ];

  function teacherId() {
    return String(sessionStorage.getItem("glipTeacherId") || "").trim();
  }

  function key(action) {
    return CACHE_PREFIX + teacherId() + ":" + action;
  }

  function get(action) {
    if (!teacherId()) return null;
    try {
      const stored = JSON.parse(sessionStorage.getItem(key(action)) || "null");
      if (!stored || !stored.saved_at || Date.now() - stored.saved_at > MAX_AGE_MS) return null;
      return stored.value || null;
    } catch (_error) {
      return null;
    }
  }

  function set(action, value) {
    if (!teacherId() || !value) return value;
    try {
      sessionStorage.setItem(key(action), JSON.stringify({ saved_at: Date.now(), value: value }));
    } catch (_error) {
      /* Storage is an optimisation only. */
    }
    return value;
  }

  function clear(actions) {
    (actions || ACTIONS).forEach(function (action) {
      try { sessionStorage.removeItem(key(action)); } catch (_error) {}
    });
  }

  function payloadFor(action) {
    return {
      action: action,
      teacher_id: teacherId(),
      class_teacher_id: ""
    };
  }

  function fetchFresh(action) {
    if (!teacherId() || !window.GLIPStorageDownload) return Promise.resolve(null);
    return window.GLIPStorageDownload.post(payloadFor(action)).then(function (result) {
      if (result && result.status === "success") set(action, result);
      return result;
    });
  }

  function preloadOthers(currentAction) {
    ACTIONS.filter(function (action) { return action !== currentAction; })
      .forEach(function (action) {
        fetchFresh(action).catch(function (error) {
          console.warn("GLIP storage preload failed for " + action + ".", error);
        });
      });
  }

  window.GLIPStoragePageCache = Object.freeze({
    get: get,
    set: set,
    clear: clear,
    fetchFresh: fetchFresh,
    preloadOthers: preloadOthers
  });
})();
