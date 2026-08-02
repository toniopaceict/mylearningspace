(function () {
  "use strict";

  const CACHE_PREFIX = "glipStoragePageCache:";
  const MAX_AGE_MS = 5 * 60 * 1000;
  const ACTIONS = [
    "listMyClassResources",
    "getTeacherStorageDashboard",
    "listTeacherSubmissions"
  ];
  const inFlight = Object.create(null);
  let preloadTimer = null;

  function teacherId() {
    return String(sessionStorage.getItem("glipTeacherId") || "").trim();
  }

  function isTeachingRole() {
    const role = String(sessionStorage.getItem("glipUserType") || "").toLowerCase();
    return !!teacherId() && ["subject_teacher", "lead_teacher"].includes(role);
  }

  function key(action) { return CACHE_PREFIX + teacherId() + ":" + action; }

  function get(action) {
    if (!teacherId()) return null;
    try {
      const stored = JSON.parse(sessionStorage.getItem(key(action)) || "null");
      if (!stored || !stored.saved_at || Date.now() - stored.saved_at > MAX_AGE_MS) return null;
      return stored.value || null;
    } catch (_error) { return null; }
  }

  function set(action, value) {
    if (!teacherId() || !value) return value;
    try { sessionStorage.setItem(key(action), JSON.stringify({ saved_at: Date.now(), value: value })); }
    catch (_error) { /* Cache is an optimisation only. */ }
    return value;
  }

  function clear(actions) {
    (actions || ACTIONS).forEach(function (action) {
      try { sessionStorage.removeItem(key(action)); } catch (_error) {}
    });
  }

  function payloadFor(action) {
    return { action: action, teacher_id: teacherId(), class_teacher_id: "" };
  }

  function fetchFresh(action) {
    if (!teacherId() || !window.GLIPStorageDownload) return Promise.resolve(null);
    if (inFlight[action]) return inFlight[action];
    inFlight[action] = window.GLIPStorageDownload.post(payloadFor(action))
      .then(function (result) {
        if (result && result.status === "success") set(action, result);
        return result;
      })
      .finally(function () { delete inFlight[action]; });
    return inFlight[action];
  }

  function runIdle(callback) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(callback, { timeout: 3000 });
    } else {
      window.setTimeout(callback, 1200);
    }
  }

  function preloadOthers(currentAction) {
    // Students never use the two teacher storage pages. Avoid generating
    // needless Apps Script executions while they are loading Resources.
    if (!isTeachingRole()) return;
    if (preloadTimer) window.clearTimeout(preloadTimer);
    preloadTimer = window.setTimeout(function () {
      const queue = ACTIONS.filter(function (action) { return action !== currentAction && !get(action); });
      function next() {
        const action = queue.shift();
        if (!action) return;
        runIdle(function () {
          fetchFresh(action)
            .catch(function (error) { console.warn("GLIP storage preload failed for " + action + ".", error); })
            .finally(function () { window.setTimeout(next, 650); });
        });
      }
      next();
    }, 900);
  }

  window.GLIPStoragePageCache = Object.freeze({
    get: get, set: set, clear: clear, fetchFresh: fetchFresh, preloadOthers: preloadOthers
  });
})();
