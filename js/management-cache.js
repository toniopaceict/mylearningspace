(function () {
  "use strict";

  const STORAGE_VERSION = String(window.GLIP_CACHE_VERSION || window.GLIP_ASSET_VERSION || "default");
  const CACHE_PREFIX = "glipManagementCache_" + STORAGE_VERSION + "_";
  const VERSION_KEY_PREFIX = "glipManagementVersions_" + STORAGE_VERSION + "_";
  const LAST_VERSION_CHECK_PREFIX = "glipManagementVersionCheck_" + STORAGE_VERSION + "_";
  const MAX_AGE_MS = 10 * 60 * 1000;
  const VERSION_CHECK_INTERVAL_MS = 90 * 1000;
  const VERSION_CHECK_IDLE_MS = 20 * 1000;
  const BACKGROUND_WARM_IDLE_MS = 2500;
  const BACKGROUND_RETRY_MS = 750;
  const nativeFetch = window.fetch.bind(window);
  const inFlightReads = {};
  let versionCheckPromise = null;
  let lastUserActivityAt = Date.now();
  let activeForegroundRequests = 0;
  let backgroundTaskRunning = false;
  let backgroundTaskCounter = 0;
  let adaptiveVersionTimer = null;
  const backgroundTasks = [];
  const backgroundTasksById = {};

  const ACTION_DATASETS = {
    listLevelsManagementAdmin: "levels",
    listLevelsAdmin: "levels",
    listSubjectCatalogueOwner: "subjectCatalogue",
    listTopicCatalogueOwner: "topicCatalogue",
    listCurriculumManagementAdmin: "subjects",
    getAllSubjectsAdmin: "subjects",
    getCurriculumTopicManagement: "topics",
    listTeachersAdmin: "teachers",
    listClassesAdmin: "classes",
    listClassTeachersAdmin: "teachingAssignmentView",
    listTeachingAssignmentViewAdmin: "teachingAssignmentView",
    listStudentsAdmin: "students",
    getStudentSubjectManagementAdmin: "studentSubjects",
    listMyWorkFolders: "workFolders"
  };

  const ACTION_PRIMARY_COLLECTIONS = {
    listLevelsManagementAdmin: ["levels"],
    listLevelsAdmin: ["levels"],
    listSubjectCatalogueOwner: ["subjects"],
    listTopicCatalogueOwner: ["topics"],
    listCurriculumManagementAdmin: ["curriculum", "subjects"],
    getAllSubjectsAdmin: ["subjects"],
    getCurriculumTopicManagement: ["topics", "curriculum_topics"],
    listTeachersAdmin: ["teachers"],
    listClassesAdmin: ["classes"],
    listClassTeachersAdmin: ["assignments", "class_teachers", "teaching_assignments"],
    listTeachingAssignmentViewAdmin: ["assignments", "class_teachers", "teaching_assignments"],
    listStudentsAdmin: ["students"],
    // The combined Student Subject response may legitimately contain no
    // assignments while still containing students. Including students here
    // allows the complete cached management view to be reused immediately.
    getStudentSubjectManagementAdmin: ["students", "student_subjects", "assignments"],
    listMyWorkFolders: ["folders", "assignments", "work_folders"]
  };

  function cachedResultConfirmsRecords(action, data) {
    const fields = ACTION_PRIMARY_COLLECTIONS[action] || [];
    if (!fields.length || !data || data.status !== "success") return true;

    const presentFields = fields.filter(function (field) {
      return Array.isArray(data[field]);
    });

    // Unknown response shape: preserve existing cache behaviour.
    if (!presentFields.length) return true;

    return presentFields.some(function (field) {
      return data[field].length > 0;
    });
  }

  const DATASET_ACTIONS = Object.keys(ACTION_DATASETS).reduce(function (map, action) {
    const dataset = ACTION_DATASETS[action];
    if (!map[dataset]) map[dataset] = [];
    map[dataset].push(action);
    return map;
  }, {});

  const WRITE_DEPENDENCIES = {
    addLevelAdmin: ["levels", "subjects", "classes", "teachingAssignmentView", "students", "studentSubjects", "workFolders"],
    updateLevelsAdmin: ["levels", "subjects", "classes", "teachingAssignmentView", "students", "studentSubjects", "workFolders"],
    saveSubjectCatalogueOwner: ["subjectCatalogue", "topicCatalogue", "subjects", "topics", "teachingAssignmentView", "studentSubjects", "workFolders"],
    saveTopicCatalogueOwner: ["topicCatalogue", "topics"],
    addCurriculumAdmin: ["subjects", "topics", "teachingAssignmentView", "studentSubjects", "workFolders"],
    updateCurriculumAdmin: ["subjects", "topics", "teachingAssignmentView", "studentSubjects", "workFolders"],
    addCurriculumTopicManagement: ["topics"],
    updateCurriculumTopicManagement: ["topics"],
    addTeacherAdmin: ["teachers", "teachingAssignmentView", "workFolders"],
    updateTeachersAdmin: ["teachers", "teachingAssignmentView", "workFolders"],
    deactivateTeacherAdmin: ["teachers", "teachingAssignmentView", "workFolders"],
    addClassAdmin: ["classes", "teachingAssignmentView", "students", "studentSubjects", "workFolders"],
    updateClassesAdmin: ["classes", "teachingAssignmentView", "students", "studentSubjects", "workFolders"],
    addClassTeacherAdmin: ["teachingAssignmentView", "workFolders", "studentSubjects"],
    updateClassTeachersAdmin: ["teachingAssignmentView", "workFolders", "studentSubjects"],
    updateMyWorkFolders: ["workFolders", "teachingAssignmentView"],
    addStudentAdmin: ["students", "studentSubjects"],
    updateStudentsAdmin: ["students", "studentSubjects"],
    saveStudentSubjectsAdmin: ["studentSubjects"],
    saveAllSubjectsAdmin: ["subjects", "topics", "teachingAssignmentView", "studentSubjects", "workFolders"],
    applyAdminTableCsvImport: "fromTableKey",
    clearAdminTableRows: "fromTableKey"
  };

  const TABLE_DEPENDENCIES = {
    levels: WRITE_DEPENDENCIES.updateLevelsAdmin,
    curriculum: WRITE_DEPENDENCIES.updateCurriculumAdmin,
    teachers: WRITE_DEPENDENCIES.updateTeachersAdmin,
    classes: WRITE_DEPENDENCIES.updateClassesAdmin,
    class_teachers: WRITE_DEPENDENCIES.updateClassTeachersAdmin,
    teaching_assignments: WRITE_DEPENDENCIES.updateClassTeachersAdmin,
    students: WRITE_DEPENDENCIES.updateStudentsAdmin,
    student_subjects: WRITE_DEPENDENCIES.saveStudentSubjectsAdmin,
    curriculum_topics: WRITE_DEPENDENCIES.updateCurriculumTopicManagement,
    topic_assignments: WRITE_DEPENDENCIES.updateCurriculumTopicManagement
  };

  const PAGE_PREDICTIONS = {
    "level-management.html": ["listCurriculumManagementAdmin", "listClassesAdmin"],
    "subject-management.html": ["listCurriculumManagementAdmin"],
    "topic-management.html": ["getCurriculumTopicManagement"],
    "teacher-management.html": ["listClassTeachersAdmin", "listMyWorkFolders"],
    "class-management.html": ["listClassTeachersAdmin", "listStudentsAdmin"],
    "teaching-assignments.html": ["listTeachersAdmin", "listClassesAdmin", "getAllSubjectsAdmin", "listMyWorkFolders"],
    "student-management.html": ["getStudentSubjectManagementAdmin", "listClassesAdmin"],
    "student-subject-management.html": ["listStudentsAdmin", "listCurriculumManagementAdmin"],
    "work-folder-management.html": ["listMyWorkFolders"]
  };



  // After a committed write, warm only the dataset used by the page that
  // initiated the change. Related datasets remain invalidated and reload when
  // their pages are actually opened. This avoids several warm requests
  // competing to rebuild the same relational snapshot.
  const POST_SAVE_PRIMARY_ACTION = {
    addLevelAdmin: "listLevelsManagementAdmin",
    updateLevelsAdmin: "listLevelsManagementAdmin",
    addClassAdmin: "listClassesAdmin",
    updateClassesAdmin: "listClassesAdmin",
    addCurriculumAdmin: "listCurriculumManagementAdmin",
    updateCurriculumAdmin: "listCurriculumManagementAdmin",
    addCurriculumTopicManagement: "getCurriculumTopicManagement",
    updateCurriculumTopicManagement: "getCurriculumTopicManagement",
    addTeacherAdmin: "listTeachersAdmin",
    updateTeachersAdmin: "listTeachersAdmin",
    deactivateTeacherAdmin: "listTeachersAdmin",
    addStudentAdmin: "listStudentsAdmin",
    updateStudentsAdmin: "listStudentsAdmin",
    saveStudentSubjectsAdmin: "getStudentSubjectManagementAdmin",
    addClassTeacherAdmin: "listClassTeachersAdmin",
    updateClassTeachersAdmin: "listClassTeachersAdmin"
  };

  const WARMING_DELAY_MS = 150;
  const TEACHING_ASSIGNMENT_POST_SAVE_IDLE_MS = 6000;
  const WARMING_GAP_MS = 75;
  const ADMIN_BACKGROUND_QUEUE_KEY = "glipAdminBackgroundWarmQueue";
  const WARM_JOB_PREFIX = "glipWarmJob_" + STORAGE_VERSION + "_";
  const WARM_JOB_TTL_MS = 2 * 60 * 1000;
  const ADMIN_BACKGROUND_PAUSE_MS = 1200;
  let warmingSequence = Promise.resolve();
  let backgroundWarmRunning = false;
  let backgroundPauseUntil = 0;

  function userScope() {
    return [
      sessionStorage.getItem("glipSchool") || "",
      sessionStorage.getItem("glipUserType") || "",
      sessionStorage.getItem("glipTeacherId") || ""
    ].join("_");
  }

  function entryKey(action) {
    return CACHE_PREFIX + userScope() + "_" + action;
  }

  function versionsKey() {
    return VERSION_KEY_PREFIX + userScope();
  }

  function lastVersionCheckKey() {
    return LAST_VERSION_CHECK_PREFIX + userScope();
  }

  function readEntry(action, allowStale) {
    try {
      const raw = sessionStorage.getItem(entryKey(action));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || !entry.data || entry.data.status !== "success") return null;
      const tooOld = Date.now() - Number(entry.savedAt || 0) > MAX_AGE_MS;
      if (!allowStale && (entry.stale === true || tooOld)) return null;
      return entry;
    } catch (error) {
      return null;
    }
  }

  function read(action, allowStale) {
    const entry = readEntry(action, allowStale === true);
    return entry ? entry.data : null;
  }

  function readVersions() {
    try {
      return JSON.parse(sessionStorage.getItem(versionsKey()) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function writeVersions(versions) {
    if (!versions || typeof versions !== "object") return;
    sessionStorage.setItem(versionsKey(), JSON.stringify(versions));
  }

  function write(action, data, version) {
    if (!ACTION_DATASETS[action] || !data || data.status !== "success") return false;
    const versions = readVersions();
    const dataset = ACTION_DATASETS[action];
    const resolvedVersion = version !== undefined && version !== null
      ? Number(version)
      : Number((data.management_versions || {})[dataset] || versions[dataset] || 0);

    sessionStorage.setItem(entryKey(action), JSON.stringify({
      savedAt: Date.now(),
      stale: false,
      dataset: dataset,
      version: resolvedVersion,
      data: data
    }));

    if (resolvedVersion) {
      versions[dataset] = resolvedVersion;
      writeVersions(versions);
    }
    return true;
  }

  function actionsForDatasets(datasets) {
    const result = [];
    (datasets || []).forEach(function (dataset) {
      (DATASET_ACTIONS[dataset] || []).forEach(function (action) {
        if (result.indexOf(action) === -1) result.push(action);
      });
    });
    return result;
  }

  function markDatasetsStale(datasets, remove) {
    actionsForDatasets(datasets).forEach(function (action) {
      if (remove === true) {
        sessionStorage.removeItem(entryKey(action));
        return;
      }
      const entry = readEntry(action, true);
      if (!entry) return;
      entry.stale = true;
      sessionStorage.setItem(entryKey(action), JSON.stringify(entry));
    });
  }

  function invalidatedDatasets(action, requestData) {
    const rule = WRITE_DEPENDENCIES[action];
    if (rule === "fromTableKey") {
      return TABLE_DEPENDENCIES[String((requestData || {}).table_key || "").toLowerCase()] || Object.keys(DATASET_ACTIONS);
    }
    return Array.isArray(rule) ? rule : [];
  }

  function installBootstrap(result) {
    if (!result || result.status !== "success" || !result.datasets) return false;
    if (result.versions) writeVersions(result.versions);
    Object.keys(result.datasets).forEach(function (action) {
      const dataset = ACTION_DATASETS[action];
      write(action, result.datasets[action], result.versions && result.versions[dataset]);
    });
    sessionStorage.setItem("glipManagementCacheReady", "true");
    sessionStorage.setItem("glipManagementCacheTime", String(Date.now()));
    return true;
  }

  function responseFrom(data) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  function parseRequest(options) {
    if (!options || String(options.method || "GET").toUpperCase() !== "POST") return null;
    if (typeof options.body !== "string") return null;
    try { return JSON.parse(options.body); } catch (error) { return null; }
  }

  function apiUrlFrom(input) {
    if (typeof input === "string") return input;
    if (input && input.url) return input.url;
    return "";
  }

  function staffPayload(action) {
    const role = sessionStorage.getItem("glipUserType") || "";
    const teacherId = sessionStorage.getItem("glipTeacherId") || "";
    return {
      action: action,
      role: role,
      teacher_id: teacherId,
      admin_teacher_id: teacherId
    };
  }

  function performancePayload(payload, category, initiator, target, warmJobId) {
    const result = Object.assign({}, payload || {});
    result.performance_category = category || result.performance_category || "load";
    result.performance_initiator = initiator || result.performance_initiator || "page_request";
    result.performance_target = target || result.performance_target || "";
    result.performance_warm_job_id = warmJobId || result.performance_warm_job_id || "";
    return result;
  }

  function warmJobKey(jobId) {
    return WARM_JOB_PREFIX + userScope() + "_" + String(jobId || "").replace(/[^a-z0-9_.:-]/gi, "_");
  }

  function claimWarmJob(jobId) {
    if (!jobId) return true;
    const key = warmJobKey(jobId);
    const existing = Number(sessionStorage.getItem(key) || 0);
    if (existing && Date.now() - existing < WARM_JOB_TTL_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  }

  function releaseWarmJob(jobId) {
    if (jobId) sessionStorage.removeItem(warmJobKey(jobId));
  }

  function isBackgroundEligible(minIdleMs) {
    return !document.hidden &&
      activeForegroundRequests === 0 &&
      Date.now() - lastUserActivityAt >= Math.max(0, Number(minIdleMs) || 0);
  }

  function processBackgroundTasks() {
    if (backgroundTaskRunning || !backgroundTasks.length) return;

    backgroundTasks.sort(function (a, b) {
      return b.priority - a.priority || a.order - b.order;
    });

    const task = backgroundTasks[0];
    if (!isBackgroundEligible(task.minIdleMs)) {
      window.setTimeout(processBackgroundTasks, BACKGROUND_RETRY_MS);
      return;
    }

    backgroundTasks.shift();
    backgroundTaskRunning = true;

    Promise.resolve()
      .then(task.factory)
      .then(task.resolve, task.reject)
      .finally(function () {
        delete backgroundTasksById[task.id];
        backgroundTaskRunning = false;
        window.setTimeout(processBackgroundTasks, WARMING_GAP_MS);
      });
  }

  function enqueueBackgroundTask(id, factory, options) {
    const taskId = String(id || ("background:" + (++backgroundTaskCounter)));
    if (backgroundTasksById[taskId]) return backgroundTasksById[taskId].promise;

    let resolveTask;
    let rejectTask;
    const promise = new Promise(function (resolve, reject) {
      resolveTask = resolve;
      rejectTask = reject;
    });

    const task = {
      id: taskId,
      factory: factory,
      priority: Number((options || {}).priority || 0),
      minIdleMs: Number((options || {}).minIdleMs || BACKGROUND_WARM_IDLE_MS),
      order: ++backgroundTaskCounter,
      resolve: resolveTask,
      reject: rejectTask,
      promise: promise
    };

    backgroundTasksById[taskId] = task;
    backgroundTasks.push(task);
    processBackgroundTasks();
    return promise;
  }

  function rawPostJson(url, payload) {
    return nativeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error("Management request failed.");
      return response.json();
    });
  }

  function backgroundPostJson(url, payload, taskId, options) {
    return enqueueBackgroundTask(taskId, function () {
      return rawPostJson(url, payload);
    }, options);
  }

  function foregroundFetch(input, options) {
    activeForegroundRequests += 1;
    pauseBackgroundWarming(ADMIN_BACKGROUND_PAUSE_MS);
    return nativeFetch(input, options).finally(function () {
      activeForegroundRequests = Math.max(0, activeForegroundRequests - 1);
      window.setTimeout(processBackgroundTasks, 0);
    });
  }

  function hasPendingAdminWarmWork() {
    const queue = readAdminBackgroundQueue();
    if (queue && (queue.actions.length || queue.warmSubjectsHome || (queue.subjectLevels || []).length)) return true;
    return backgroundWarmRunning || backgroundTasks.some(function (task) {
      return String(task.id || "").indexOf("admin_") === 0 || String(task.id || "").indexOf("warm:") === 0;
    });
  }

  function checkVersions(url, force) {
    if (!url) return Promise.resolve({});

    if (!force && hasPendingAdminWarmWork()) {
      return Promise.resolve(readVersions());
    }

    const role = String(sessionStorage.getItem("glipUserType") || "").toLowerCase();
    const teacherId = String(sessionStorage.getItem("glipTeacherId") || "").trim();
    const isAuthenticatedStaff = teacherId && ["owner", "admin", "lead_teacher", "subject_teacher"].includes(role);
    if (!isAuthenticatedStaff) return Promise.resolve(readVersions());

    const lastCheck = Number(sessionStorage.getItem(lastVersionCheckKey()) || 0);
    if (!force && Date.now() - lastCheck < VERSION_CHECK_INTERVAL_MS) {
      return Promise.resolve(readVersions());
    }
    if (versionCheckPromise) return versionCheckPromise;

    versionCheckPromise = backgroundPostJson(
      url,
      performancePayload(staffPayload("getManagementDatasetVersions"), "version_check", "management_version_check", "management_versions", "versions"),
      "version_check:management_versions",
      { priority: 5, minIdleMs: VERSION_CHECK_IDLE_MS }
    )
      .then(function (result) {
        if (!result || result.status !== "success" || !result.versions) return readVersions();
        const localVersions = readVersions();
        const changed = [];
        Object.keys(result.versions).forEach(function (dataset) {
          if (Number(localVersions[dataset] || 0) !== Number(result.versions[dataset] || 0)) changed.push(dataset);
        });
        if (changed.length) markDatasetsStale(changed, false);
        writeVersions(result.versions);
        sessionStorage.setItem(lastVersionCheckKey(), String(Date.now()));
        scheduleAdaptiveVersionCheck(VERSION_CHECK_INTERVAL_MS);
        return result.versions;
      })
      .catch(function () { return readVersions(); })
      .finally(function () { versionCheckPromise = null; });

    return versionCheckPromise;
  }

  function fetchAndCache(input, options, requestData) {
    const action = requestData.action;
    if (inFlightReads[action]) return inFlightReads[action].then(responseFrom);

    inFlightReads[action] = foregroundFetch(input, options)
      .then(function (response) {
        return response.clone().json().then(function (data) {
          write(action, data);
          return data;
        });
      })
      .finally(function () { delete inFlightReads[action]; });

    return inFlightReads[action].then(responseFrom);
  }

  function refreshInBackground(input, options, requestData, oldData) {
    const action = requestData.action;
    if (inFlightReads[action]) return;
    inFlightReads[action] = enqueueBackgroundTask(
      "silent_refresh:" + action,
      function () { return rawPostJson(apiUrlFrom(input), requestData); },
      { priority: 15, minIdleMs: BACKGROUND_WARM_IDLE_MS }
    )
      .then(function (freshData) { return freshData; })
      .then(function (freshData) {
        if (!freshData || freshData.status !== "success") return;
        write(action, freshData);
        if (JSON.stringify(oldData) !== JSON.stringify(freshData)) {
          document.dispatchEvent(new CustomEvent("glipManagementDataUpdated", {
            detail: { action: action }
          }));
        }
      })
      .catch(function (error) {
        console.warn("Silent management refresh failed:", error);
      })
      .finally(function () { delete inFlightReads[action]; });
  }

  function prefetchAction(action, apiUrl) {
    if (!ACTION_DATASETS[action] || !apiUrl) return Promise.resolve(null);
    if (read(action, false)) return Promise.resolve(read(action, false));
    const jobId = "predictive:" + action;
    if (!claimWarmJob(jobId)) return Promise.resolve(null);
    let payload = staffPayload(action);
    if (action === "getCurriculumTopicManagement") payload.role = sessionStorage.getItem("glipUserType") || "admin";
    payload = performancePayload(payload, "cache_warm", "predictive_page_warm", ACTION_DATASETS[action], jobId);
    return backgroundPostJson(
      apiUrl,
      payload,
      jobId,
      { priority: 20, minIdleMs: BACKGROUND_WARM_IDLE_MS }
    ).then(function (data) {
      write(action, data);
      return data;
    }).catch(function () { return null; }).finally(function () {
      releaseWarmJob(jobId);
    });
  }

  function canWarmAction(action) {
    const role = String(sessionStorage.getItem("glipUserType") || "").toLowerCase();
    if (role === "owner" || role === "admin") return action !== "listMyWorkFolders";
    if (role === "lead_teacher") {
      return action === "listCurriculumManagementAdmin" ||
        action === "getCurriculumTopicManagement";
    }
    return false;
  }

  function warmAction(action, apiUrl, initiator) {
    if (!canWarmAction(action) || !ACTION_DATASETS[action] || !apiUrl) return Promise.resolve(null);

    const jobId = String(initiator || "management_warm") + ":" + action;
    if (!claimWarmJob(jobId)) return Promise.resolve(null);

    let payload = staffPayload(action);
    if (action === "getCurriculumTopicManagement") {
      payload.role = sessionStorage.getItem("glipUserType") || "admin";
    }
    payload = performancePayload(payload, "cache_warm", initiator || "management_warm", ACTION_DATASETS[action], jobId);

    if (inFlightReads[action]) {
      releaseWarmJob(jobId);
      return inFlightReads[action].catch(function () { return null; });
    }

    inFlightReads[action] = backgroundPostJson(
      apiUrl,
      payload,
      jobId,
      { priority: initiator === "post_save_warm" ? 30 : 10, minIdleMs: BACKGROUND_WARM_IDLE_MS }
    )
      .then(function (data) {
        if (data && data.status === "success") write(action, data);
        return data;
      })
      .catch(function (error) {
        console.warn("Management cache warming failed for " + action + ":", error);
        return null;
      })
      .finally(function () {
        delete inFlightReads[action];
        releaseWarmJob(jobId);
      });

    return inFlightReads[action];
  }

  function warmDatasets(datasets, apiUrl) {
    const actions = actionsForDatasets(datasets).filter(canWarmAction);
    if (!actions.length || !apiUrl) return Promise.resolve();

    warmingSequence = warmingSequence
      .catch(function () {})
      .then(function () {
        return new Promise(function (resolve) { window.setTimeout(resolve, WARMING_DELAY_MS); });
      })
      .then(function () {
        return actions.reduce(function (promise, action) {
          return promise
            .then(function () { return warmAction(action, apiUrl, "post_save_warm"); })
            .then(function () {
              return new Promise(function (resolve) { window.setTimeout(resolve, WARMING_GAP_MS); });
            });
        }, Promise.resolve());
      });

    return warmingSequence;
  }


  function sleep(milliseconds) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, Math.max(0, Number(milliseconds) || 0));
    });
  }

  function pauseBackgroundWarming(milliseconds) {
    backgroundPauseUntil = Math.max(
      backgroundPauseUntil,
      Date.now() + Math.max(0, Number(milliseconds) || ADMIN_BACKGROUND_PAUSE_MS)
    );
  }

  function waitForBackgroundPermission() {
    const wait = backgroundPauseUntil - Date.now();
    if (wait <= 0 && !document.hidden) return Promise.resolve();

    return sleep(Math.max(wait, 300)).then(waitForBackgroundPermission);
  }

  function readAdminBackgroundQueue() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(ADMIN_BACKGROUND_QUEUE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.actions)) parsed.actions = [];
      if (!Array.isArray(parsed.subjectLevels)) parsed.subjectLevels = [];
      parsed.warmSubjectsHome = parsed.warmSubjectsHome === true;
      return parsed;
    } catch (error) {
      sessionStorage.removeItem(ADMIN_BACKGROUND_QUEUE_KEY);
      return null;
    }
  }

  function writeAdminBackgroundQueue(queue) {
    if (!queue || (!queue.actions.length && !queue.warmSubjectsHome && !(queue.subjectLevels || []).length)) {
      sessionStorage.removeItem(ADMIN_BACKGROUND_QUEUE_KEY);
      return;
    }
    sessionStorage.setItem(ADMIN_BACKGROUND_QUEUE_KEY, JSON.stringify(queue));
  }

  function normaliseLevelFolder(value) {
    const match = String(value || "").match(/\d+/);
    return match ? "level-" + match[0].padStart(2, "0") : "";
  }

  function subjectCacheKeyForLevel(level) {
    if (!window.GLIP_CACHE) return "";
    return window.GLIP_CACHE.makeKey([
      sessionStorage.getItem("glipSchool") || "",
      level,
      sessionStorage.getItem("glipUserType") || "admin",
      sessionStorage.getItem("glipTeacherId") || "",
      "",
      "subjects"
    ]);
  }

  function levelsForAdminSubjectWarm() {
    const cached = read("listLevelsManagementAdmin", true);
    const levels = cached && Array.isArray(cached.levels) ? cached.levels : [];
    const result = [];

    levels.forEach(function (item) {
      const level = normaliseLevelFolder(
        item.level_code || item.level_name || item.level || item.level_id
      );
      if (level && result.indexOf(level) === -1) result.push(level);
    });

    if (!result.length) {
      const permissionsRaw = sessionStorage.getItem("glipTeacherPermissions") || "[]";
      try {
        JSON.parse(permissionsRaw).forEach(function (permission) {
          const level = normaliseLevelFolder(permission.level || permission.level_code);
          if (level && result.indexOf(level) === -1) result.push(level);
        });
      } catch (error) {}
    }

    return result;
  }

  function ensureSubjectWarmLevels(queue) {
    if (!queue) return queue;
    if (!Array.isArray(queue.subjectLevels)) queue.subjectLevels = [];
    if (queue.warmSubjectsHome && !queue.subjectLevels.length) {
      queue.subjectLevels = levelsForAdminSubjectWarm();
      queue.warmSubjectsHome = false;
      writeAdminBackgroundQueue(queue);
    }
    return queue;
  }

  function warmAdminSubjectBundle(apiUrl, levels) {
    const uniqueLevels = (levels || []).filter(function (level, index, list) {
      return level && list.indexOf(level) === index;
    });
    const pendingLevels = uniqueLevels.filter(function (level) {
      const localKey = subjectCacheKeyForLevel(level);
      return !(localKey && window.GLIP_CACHE && window.GLIP_CACHE.readLocal(localKey));
    });

    if (!pendingLevels.length) {
      return Promise.resolve({ status: "success", skipped: "local_cache", completed_levels: uniqueLevels });
    }

    const target = "subjects_home_bundle:" + pendingLevels.join(",");
    const jobId = "admin_subjects_home_bundle";
    if (!claimWarmJob(jobId)) return Promise.resolve({ status: "success", skipped: "already_running" });

    return backgroundPostJson(apiUrl, performancePayload({
      action: "getAdminSubjectsHomeWarmBundle",
      levels: pendingLevels,
      role: "admin",
      teacher_id: sessionStorage.getItem("glipTeacherId") || "",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId") || ""
    }, "cache_warm", "admin_login_background", target, jobId), jobId,
      { priority: 8, minIdleMs: BACKGROUND_WARM_IDLE_MS })
      .then(function (result) {
        if (!result || result.status !== "success") {
          // Permission and validation failures are permanent for this login
          // session. Mark all requested levels as handled so the background
          // queue cannot retry the same failed request indefinitely.
          if (result && (result.permanent === true || /access is required/i.test(String(result.message || "")))) {
            return {
              status: "permanent_failure",
              permanent: true,
              message: result.message || "Background warming is not available for this role.",
              completed_levels: pendingLevels.slice()
            };
          }
          return result;
        }

        if (window.GLIP_CACHE) {
          const byLevel = result.subjects_by_level || {};
          pendingLevels.forEach(function (level) {
            const key = subjectCacheKeyForLevel(level);
            if (key) window.GLIP_CACHE.writeLocal(key, Array.isArray(byLevel[level]) ? byLevel[level] : []);
          });
        }
        result.completed_levels = pendingLevels.slice();
        return result;
      })
      .catch(function (error) {
        console.warn("Admin Subjects Home bundle warming failed:", error);
        return { status: "temporary_failure", completed_levels: [] };
      })
      .finally(function () { releaseWarmJob(jobId); });
  }

  function resumeAdminBackgroundWarm(apiUrl) {
    if (backgroundWarmRunning || !apiUrl) return;
    if (!["owner", "admin"].includes(String(sessionStorage.getItem("glipUserType") || "").toLowerCase())) return;

    const queue = readAdminBackgroundQueue();
    if (!queue) return;

    backgroundWarmRunning = true;

    sleep(600)
      .then(waitForBackgroundPermission)
      .then(function processNextAction() {
        const current = readAdminBackgroundQueue();
        if (!current) return null;

        if (current.actions.length) {
          const action = current.actions[0];
          return waitForBackgroundPermission()
            .then(function () { return warmAction(action, apiUrl, "admin_login_background"); })
            .then(function () {
              const latest = readAdminBackgroundQueue();
              if (!latest) return;
              if (latest.actions[0] === action) latest.actions.shift();
              else latest.actions = latest.actions.filter(function (item) { return item !== action; });
              writeAdminBackgroundQueue(latest);
            })
            .then(function () { return sleep(WARMING_GAP_MS); })
            .then(processNextAction);
        }

        ensureSubjectWarmLevels(current);
        const subjectQueue = readAdminBackgroundQueue();
        if (subjectQueue && subjectQueue.subjectLevels.length) {
          const levels = subjectQueue.subjectLevels.slice();
          return waitForBackgroundPermission()
            .then(function () { return warmAdminSubjectBundle(apiUrl, levels); })
            .then(function (result) {
              if (!result) return;

              const successful = result.status === "success";
              const permanentFailure = result.status === "permanent_failure" || result.permanent === true;
              if (!successful && !permanentFailure) return;

              const completed = Array.isArray(result.completed_levels)
                ? result.completed_levels
                : levels;
              const latest = readAdminBackgroundQueue();
              if (!latest) return;
              latest.subjectLevels = (latest.subjectLevels || []).filter(function (item) {
                return completed.indexOf(item) === -1;
              });
              if (permanentFailure) latest.warmSubjectsHome = false;
              writeAdminBackgroundQueue(latest);
            })
            .then(function () { return sleep(WARMING_GAP_MS); })
            .then(processNextAction);
        }

        writeAdminBackgroundQueue(current);
        return null;
      })
      .catch(function (error) {
        console.warn("Admin background cache warming paused:", error);
      })
      .finally(function () {
        backgroundWarmRunning = false;
      });
  }

  function predictiveLoad(apiUrl) {
    const page = String(window.location.pathname.split("/").pop() || "").toLowerCase();
    const actions = PAGE_PREDICTIONS[page] || [];
    const run = function () {
      actions.reduce(function (promise, action) {
        return promise.then(function () { return prefetchAction(action, apiUrl); });
      }, Promise.resolve());
    };
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 2000 });
    else window.setTimeout(run, 500);
  }

  window.fetch = function (input, options) {
    const requestData = parseRequest(options);
    const action = requestData && requestData.action;
    const apiUrl = apiUrlFrom(input);

    if (action && ACTION_DATASETS[action]) {
      pauseBackgroundWarming(ADMIN_BACKGROUND_PAUSE_MS);
      const cachedEntry = readEntry(action, false);
      if (cachedEntry) {
        /*
         * A cached non-empty result may be shown immediately. A cached empty
         * result must never be used as proof that records do not exist. In
         * that case, wait for Apps Script and let the authoritative response
         * decide whether the page should show an empty state.
         */
        if (!cachedResultConfirmsRecords(action, cachedEntry.data)) {
          return fetchAndCache(input, options, requestData);
        }

        checkVersions(apiUrl, false).then(function () {
          const latestEntry = readEntry(action, false);
          if (!latestEntry) refreshInBackground(input, options, requestData, cachedEntry.data);
        });
        return Promise.resolve(responseFrom(cachedEntry.data));
      }

      const staleEntry = readEntry(action, true);
      if (staleEntry) {
        if (!cachedResultConfirmsRecords(action, staleEntry.data)) {
          return fetchAndCache(input, options, requestData);
        }

        refreshInBackground(input, options, requestData, staleEntry.data);
        return Promise.resolve(responseFrom(staleEntry.data));
      }

      return fetchAndCache(input, options, requestData);
    }

    return foregroundFetch(input, options).then(function (response) {
      if (!action || !WRITE_DEPENDENCIES[action]) return response;

      const clone = response.clone();

      // Complete cache invalidation before the page receives the successful
      // write response. This prevents an immediate silent re-read from being
      // served from the pre-save browser cache and overwriting the page's
      // optimistic local update.
      return clone.json()
        .then(function (data) {
          if (data && data.status === "success") {
            const datasets = invalidatedDatasets(action, requestData);
            markDatasetsStale(datasets, true);
            if (data.management_versions) writeVersions(data.management_versions);

            // Teaching Assignment writes previously warmed three related
            // datasets immediately. Each warm could rebuild the relational
            // snapshot and compete with the owner's next action. Warm only the
            // page the user is currently viewing, and only after a genuine idle
            // period. Student Subjects and Work Folders remain invalidated and
            // will load authoritatively when their pages are opened.
            const primaryAction = POST_SAVE_PRIMARY_ACTION[action] || "";
            if (primaryAction) {
              enqueueBackgroundTask(
                "post_save_primary:" + primaryAction,
                function () { return warmAction(primaryAction, apiUrl, "post_save_warm"); },
                {
                  priority: 8,
                  minIdleMs: (action === "addClassTeacherAdmin" || action === "updateClassTeachersAdmin")
                    ? TEACHING_ASSIGNMENT_POST_SAVE_IDLE_MS
                    : BACKGROUND_WARM_IDLE_MS
                }
              );
            } else {
              window.setTimeout(function () {
                warmDatasets(datasets, apiUrl);
              }, 0);
            }
          }
          return response;
        })
        .catch(function () {
          return response;
        });
    });
  };

  function noteUserActivity() {
    lastUserActivityAt = Date.now();
    pauseBackgroundWarming(ADMIN_BACKGROUND_PAUSE_MS);
    scheduleAdaptiveVersionCheck(VERSION_CHECK_IDLE_MS);
  }

  function scheduleAdaptiveVersionCheck(delayMs) {
    if (adaptiveVersionTimer) window.clearTimeout(adaptiveVersionTimer);
    adaptiveVersionTimer = window.setTimeout(function () {
      adaptiveVersionTimer = null;
      checkVersions(currentApiUrl(), false);
    }, Math.max(1000, Number(delayMs) || VERSION_CHECK_IDLE_MS));
  }

  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(function (eventName) {
    window.addEventListener(eventName, noteUserActivity, { passive: true });
  });

  function currentApiUrl() {
    try {
      if (typeof window.getGlipWebAppUrl === "function") return window.getGlipWebAppUrl();
    } catch (error) {}
    return window.GLIP_API_URL || "";
  }

  document.addEventListener("glipReady", function () {
    const apiUrl = currentApiUrl();
    predictiveLoad(apiUrl);
    scheduleAdaptiveVersionCheck(VERSION_CHECK_IDLE_MS);

    const startBackgroundWarm = function () {
      resumeAdminBackgroundWarm(apiUrl);
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(startBackgroundWarm, { timeout: 1800 });
    } else {
      window.setTimeout(startBackgroundWarm, 900);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      lastUserActivityAt = Date.now();
      resumeAdminBackgroundWarm(currentApiUrl());
      scheduleAdaptiveVersionCheck(VERSION_CHECK_IDLE_MS);
      processBackgroundTasks();
    }
  });

  window.addEventListener("pageshow", function () {
    resumeAdminBackgroundWarm(currentApiUrl());
  });

  window.addEventListener("focus", function () {
    lastUserActivityAt = Date.now();
    scheduleAdaptiveVersionCheck(VERSION_CHECK_IDLE_MS);
    processBackgroundTasks();
  });

  window.GLIPManagementCache = {
    installBootstrap: installBootstrap,
    read: read,
    write: write,
    checkVersions: checkVersions,
    prefetch: prefetchAction,
    warmDatasets: function (datasets) { return warmDatasets(datasets, currentApiUrl()); },
    resumeAdminBackgroundWarm: function () { return resumeAdminBackgroundWarm(currentApiUrl()); },
    pauseBackgroundWarm: pauseBackgroundWarming,
    scheduleVersionCheck: function () { scheduleAdaptiveVersionCheck(VERSION_CHECK_IDLE_MS); },
    schedulerStatus: function () {
      return {
        queued: backgroundTasks.length,
        running: backgroundTaskRunning,
        foregroundRequests: activeForegroundRequests,
        idleForMs: Date.now() - lastUserActivityAt
      };
    },
    invalidateDatasets: function (datasets) { markDatasetsStale(datasets, true); },
    invalidateActions: function (actions) {
      (actions || []).forEach(function (action) { sessionStorage.removeItem(entryKey(action)); });
    },
    clear: function () {
      Object.keys(sessionStorage).forEach(function (storageKey) {
        if (storageKey.indexOf(CACHE_PREFIX) === 0 ||
            storageKey.indexOf(VERSION_KEY_PREFIX) === 0 ||
            storageKey.indexOf(LAST_VERSION_CHECK_PREFIX) === 0 ||
            storageKey.indexOf("glipManagementCache") === 0 ||
            storageKey.indexOf(WARM_JOB_PREFIX) === 0) {
          sessionStorage.removeItem(storageKey);
        }
      });
    }
  };
})();
