(function () {
  "use strict";
  if (window.GLIPPerformance) return;

  const QUEUE_KEY = "glipPerformanceQueueV2";
  const SESSION_KEY = "glipPerformanceSessionIdV2";
  const SEQUENCE_KEY = "glipPerformanceSequenceV2";
  const SCHOOL_KEY = "glipPerformanceSchoolV2";
  const MAX_QUEUE = 100;
  const BATCH_SIZE = 20;
  let flushing = false;
  const nativeFetch = window.fetch.bind(window);

  function safeJson(text, fallback) {
    try { return JSON.parse(text); } catch (_) { return fallback; }
  }

  function uuid(prefix) {
    return String(prefix || "perf") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function beginNewSession() {
    const school = getSchool();
    const id = (school && school !== "unknown" ? school : "glip") + "-" + uuid("session");
    try {
      localStorage.setItem(SESSION_KEY, id);
      localStorage.setItem(SEQUENCE_KEY, "0");
    } catch (_) {}
    return id;
  }

  function getSessionId(action) {
    if (String(action || "") === "loginUser") return beginNewSession();
    let id = "";
    try { id = localStorage.getItem(SESSION_KEY) || ""; } catch (_) {}
    return id || beginNewSession();
  }

  function nextSequence() {
    let value = 0;
    try {
      value = Number(localStorage.getItem(SEQUENCE_KEY) || 0) + 1;
      localStorage.setItem(SEQUENCE_KEY, String(value));
    } catch (_) { value = 1; }
    return value;
  }

  function schoolFromPath(pathname) {
    const match = String(pathname || "").match(/\/schools\/([^/]+)\//i);
    const school = match ? String(match[1] || "").trim() : "";
    return school && school.toLowerCase() !== "management" ? school : "";
  }

  function getSchool(payload) {
    const fromPayload = payload && String(payload.school_id || payload.school || "").trim();
    const fromPath = schoolFromPath(location.pathname);
    const fromQuery = new URLSearchParams(location.search).get("school") || "";
    let fromFunction = "";
    try { fromFunction = window.getCurrentSchoolId ? String(window.getCurrentSchoolId() || "").trim() : ""; } catch (_) {}
    const fromSession = String(sessionStorage.getItem("glipSchool") || "").trim();
    let fromStored = "";
    try { fromStored = String(localStorage.getItem(SCHOOL_KEY) || "").trim(); } catch (_) {}
    const school = fromPayload || fromPath || fromQuery || fromFunction || fromSession || fromStored || "unknown";
    if (school !== "unknown") {
      try { localStorage.setItem(SCHOOL_KEY, school); } catch (_) {}
    }
    return school;
  }

  function getSchoolLabel() {
    try { return window.getCurrentSchoolLabel ? String(window.getCurrentSchoolLabel() || "") : ""; }
    catch (_) { return ""; }
  }

  function roleFromResponse(parsed) {
    return String(
      (parsed && (parsed.userType || parsed.role)) ||
      (parsed && parsed.teacher && parsed.teacher.role) ||
      ""
    ).trim().toLowerCase();
  }

  function getRole(payload, parsed) {
    const responseRole = roleFromResponse(parsed);
    if (responseRole) return responseRole;
    const stored = String(sessionStorage.getItem("glipUserType") || sessionStorage.getItem("glipRole") || "").trim().toLowerCase();
    if (stored) return stored;
    const payloadRole = payload && String(payload.role || "").trim().toLowerCase();
    if (payloadRole) return payloadRole;
    if (payload && payload.action === "loginUser") return payload.staff_member ? "staff_login" : "login_unresolved";
    return "unknown";
  }

  function getUserId(role, parsed) {
    if (role === "student") {
      return String(
        (parsed && parsed.student && parsed.student.student_id) ||
        sessionStorage.getItem("glipStudentId") ||
        ""
      );
    }
    return String(
      (parsed && parsed.teacher && parsed.teacher.teacher_id) ||
      sessionStorage.getItem("glipTeacherId") ||
      ""
    );
  }

  function pageName() {
    const pathname = String(location.pathname || "");
    const file = pathname.split("/").filter(Boolean).pop() || "index.html";
    return file.replace(/\.html?$/i, "") || "index";
  }

  function category(action, payload) {
    const explicit = payload && String(payload.performance_category || "").trim().toLowerCase();
    if (explicit) return explicit;
    const a = String(action || "").toLowerCase();
    if (a.indexOf("login") !== -1 || a.indexOf("bootstrap") !== -1) return "login";
    if (a.indexOf("warm") !== -1) return "cache_warm";
    if (/save|add|update|clear|apply|deactivate|upload/.test(a)) return "save";
    return "load";
  }

  function requestInitiator(payload) {
    const explicit = payload && String(payload.performance_initiator || "").trim();
    if (explicit) return explicit;
    return "page_request";
  }

  function targetDataset(payload) {
    return payload && String(payload.performance_target || payload.target_dataset || "").trim();
  }

  function readQueue() {
    const q = safeJson(localStorage.getItem(QUEUE_KEY) || "[]", []);
    return Array.isArray(q) ? q : [];
  }

  function writeQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); } catch (_) {}
  }

  function enqueue(event) {
    const q = readQueue();
    q.push(event);
    writeQueue(q);
    if (q.length >= BATCH_SIZE) flush();
  }

  function configUrl() {
    try {
      return window.getGlipWebAppUrl ? window.getGlipWebAppUrl() : (window.PAGE_CONFIG && window.PAGE_CONFIG.webAppUrl) || "";
    } catch (_) { return ""; }
  }

  async function flush() {
    if (flushing) return;
    const url = configUrl();
    const q = readQueue();
    if (!url || !q.length) return;

    flushing = true;
    const batch = q.slice(0, BATCH_SIZE);
    try {
      const response = await nativeFetch(url, {
        method: "POST",
        body: JSON.stringify({ action: "logPerformanceBatch", events: batch }),
        keepalive: true
      });
      const data = await response.json();
      if (data && data.status === "success") {
        /* Remove exactly the submitted event IDs, even if Apps Script ignored duplicates. */
        const submitted = {};
        batch.forEach(function (event) { submitted[String(event.event_id || "")] = true; });
        writeQueue(readQueue().filter(function (event) { return !submitted[String(event.event_id || "")]; }));
      }
    } catch (_) {
      /* Keep the batch for the next retry. */
    } finally {
      flushing = false;
    }
  }

  window.fetch = async function (input, init) {
    const method = String((init && init.method) || "GET").toUpperCase();
    if (method !== "POST" || !init || typeof init.body !== "string") return nativeFetch(input, init);

    const payload = safeJson(init.body, null);
    if (!payload || !payload.action || payload.action === "logPerformanceBatch") return nativeFetch(input, init);

    const requestId = payload.request_id || uuid("request");
    const sessionId = getSessionId(payload.action);
    const sequence = nextSequence();
    const school = getSchool(payload);
    payload.request_id = requestId;
    payload.school_id = payload.school_id || school;

    const amended = Object.assign({}, init, { body: JSON.stringify(payload) });
    const started = performance.now();
    let parsed = null;
    let status = "success";
    let httpResult = "response";
    let errorMessage = "";

    try {
      const response = await nativeFetch(input, amended);
      const clone = response.clone();
      try {
        parsed = await clone.json();
        if (!parsed || parsed.status !== "success") {
          status = "failure";
          errorMessage = String((parsed && parsed.message) || "");
        }
      } catch (_) {
        status = "failure";
        httpResult = "invalid_json";
      }

      const role = getRole(payload, parsed);
      const server = (parsed && parsed._performance) || {};
      enqueue({
        event_id: uuid("event"),
        timestamp: new Date().toISOString(),
        school_id: school,
        school_label: getSchoolLabel(),
        role: role,
        user_id: getUserId(role, parsed),
        page: location.pathname,
        action: payload.action,
        category: category(payload.action, payload),
        source: "combined",
        browser_duration_ms: Math.round(performance.now() - started),
        server_duration_ms: server.server_duration_ms || "",
        spreadsheet_read_ms: server.spreadsheet_read_ms || "",
        spreadsheet_write_ms: server.spreadsheet_write_ms || "",
        cache_duration_ms: server.cache_duration_ms || "",
        cache_population_ms: server.cache_population_ms || "",
        cache_result: server.cache_result || "unknown",
        status: status,
        http_result: httpResult,
        error_message: errorMessage,
        record_count: "",
        request_id: requestId,
        glip_version: window.GLIP_ASSET_VERSION || "",
        apps_script_version: "",
        notes: "",
        session_id: sessionId,
        request_sequence: sequence,
        page_name: pageName(),
        cache_age_ms: server.cache_age_ms === undefined ? "" : server.cache_age_ms,
        bootstrap_stage: server.bootstrap_stage || payload.stage || "",
        diagnostic_details: server.diagnostic_details || "",
        request_initiator: requestInitiator(payload),
        target_dataset: targetDataset(payload),
        warm_job_id: String(payload.performance_warm_job_id || "")
      });
      return response;
    } catch (error) {
      const role = getRole(payload, null);
      enqueue({
        event_id: uuid("event"),
        timestamp: new Date().toISOString(),
        school_id: school,
        school_label: getSchoolLabel(),
        role: role,
        user_id: getUserId(role, null),
        page: location.pathname,
        action: payload.action,
        category: category(payload.action, payload),
        source: "browser",
        browser_duration_ms: Math.round(performance.now() - started),
        server_duration_ms: "",
        spreadsheet_read_ms: "",
        spreadsheet_write_ms: "",
        cache_duration_ms: "",
        cache_population_ms: "",
        cache_result: "unknown",
        status: "failure",
        http_result: "network_error",
        error_message: String((error && error.message) || error),
        record_count: "",
        request_id: requestId,
        glip_version: window.GLIP_ASSET_VERSION || "",
        apps_script_version: "",
        notes: "",
        session_id: sessionId,
        request_sequence: sequence,
        page_name: pageName(),
        cache_age_ms: "",
        bootstrap_stage: payload.stage || "",
        diagnostic_details: "",
        request_initiator: requestInitiator(payload),
        target_dataset: targetDataset(payload),
        warm_job_id: String(payload.performance_warm_job_id || "")
      });
      throw error;
    }
  };

  window.GLIPPerformance = {
    flush: flush,
    queueEvent: enqueue,
    beginNewSession: beginNewSession
  };

  window.addEventListener("online", flush);
  window.addEventListener("pagehide", flush);
  setTimeout(flush, 3000);
  setInterval(flush, 30000);
})();
