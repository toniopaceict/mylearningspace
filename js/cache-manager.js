(function () {
  "use strict";

  const version = String(window.GLIP_ASSET_VERSION || "default");
  const keyPrefix = "glip_" + version + "_";

  function makeKey(parts) {
    const cleanParts = Array.isArray(parts) ? parts : [parts];
    return keyPrefix + cleanParts.map(function (part) {
      return String(part === undefined || part === null ? "" : part).trim();
    }).join("_");
  }

  function getStorage(storageType) {
    return storageType === "session" ? sessionStorage : localStorage;
  }

  function readTimed(storageType, key, maxAge) {
    const storage = getStorage(storageType);

    try {
      const raw = storage.getItem(key);
      const savedAt = Number(storage.getItem(key + "_time") || 0);

      if (!raw || !savedAt) return null;

      if (Number.isFinite(maxAge) && maxAge >= 0 && Date.now() - savedAt > maxAge) {
        remove(storageType, key);
        return null;
      }

      return JSON.parse(raw);
    } catch (error) {
      remove(storageType, key);
      return null;
    }
  }

  function writeTimed(storageType, key, data) {
    const storage = getStorage(storageType);

    try {
      storage.setItem(key, JSON.stringify(data));
      storage.setItem(key + "_time", String(Date.now()));
      return true;
    } catch (error) {
      console.warn("GLIP cache write failed:", error);
      return false;
    }
  }

  function remove(storageType, key) {
    const storage = getStorage(storageType);
    storage.removeItem(key);
    storage.removeItem(key + "_time");
  }

  function clearOldVersionKeys(storageType) {
    const storage = getStorage(storageType);
    const keysToRemove = [];
    const versionedKeyPattern = /^glip_(?:v?\d+|default)_/;

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && versionedKeyPattern.test(key) && !key.startsWith(keyPrefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(function (key) {
      storage.removeItem(key);
    });
  }


  function normaliseLevel(level) {
    const match = String(level || "").match(/\d+/);
    return match ? "level-" + match[0].padStart(2, "0") : "";
  }

  function normaliseProgressItem(item, defaults) {
    const source = item || {};
    const fallback = defaults || {};

    return {
      subject_id: String(source.subject_id || fallback.subjectId || "").trim(),
      topic_id: String(source.topic_id || fallback.topicId || "").trim(),
      level: normaliseLevel(source.level || fallback.level || ""),
      activity_id: String(source.activity_id || "").trim(),
      status: String(source.status || "not_started").trim() || "not_started"
    };
  }

  function progressKey(context) {
    const value = context || {};
    return makeKey([
      value.school || sessionStorage.getItem("glipSchool") || "",
      normaliseLevel(value.level || sessionStorage.getItem("glipLevel") || ""),
      value.studentId || sessionStorage.getItem("glipStudentId") || "",
      value.subjectId || "",
      "progress"
    ]);
  }

  function allProgressKey(context) {
    const value = context || {};
    return makeKey([
      value.school || sessionStorage.getItem("glipSchool") || "",
      value.studentId || sessionStorage.getItem("glipStudentId") || "",
      "all-progress"
    ]);
  }

  function deduplicateProgress(items) {
    const map = new Map();

    (Array.isArray(items) ? items : []).forEach(function (item) {
      const normalised = normaliseProgressItem(item);
      if (!normalised.activity_id) return;

      const identity = [
        normalised.subject_id,
        normalised.level,
        normalised.activity_id
      ].join("|");

      map.set(identity, normalised);
    });

    return Array.from(map.values());
  }

  function readProgress(context, maxAge) {
    const parsed = readTimed("session", progressKey(context), maxAge);
    return Array.isArray(parsed) ? parsed : null;
  }

  function writeProgress(context, items) {
    const value = context || {};
    const normalised = deduplicateProgress(
      (Array.isArray(items) ? items : []).map(function (item) {
        return normaliseProgressItem(item, value);
      })
    );
    writeTimed("session", progressKey(value), normalised);
    return normalised;
  }

  function readAllProgress(context, maxAge) {
    const value = context || {};
    const parsed = readTimed("session", allProgressKey(value), maxAge);
    if (Array.isArray(parsed)) return parsed;

    // Compatibility with pages opened before the canonical cache was added.
    try {
      const legacy = JSON.parse(sessionStorage.getItem("glipProgress") || "null");
      return Array.isArray(legacy) ? deduplicateProgress(legacy) : [];
    } catch (error) {
      return [];
    }
  }

  function writeAllProgress(context, items) {
    const normalised = deduplicateProgress(items);
    writeTimed("session", allProgressKey(context), normalised);

    // Keep the legacy aggregate during the transition to the canonical API.
    sessionStorage.setItem("glipProgress", JSON.stringify(normalised));
    sessionStorage.setItem("glipProgressTime", String(Date.now()));
    return normalised;
  }

  function mergeAllProgress(context, items) {
    const combined = readAllProgress(context).concat(Array.isArray(items) ? items : []);
    return writeAllProgress(context, combined);
  }

  function upsertProgress(context, item) {
    const value = context || {};
    const next = normaliseProgressItem(item, value);
    if (!next.activity_id) return [];

    const current = readProgress(value) || [];
    const updated = current.filter(function (existing) {
      return String(existing.activity_id) !== next.activity_id;
    });
    updated.push(next);

    const written = writeProgress(value, updated);
    mergeAllProgress(value, written);
    return written;
  }

  window.GLIP_CACHE_VERSION = version;
  window.GLIP_CACHE = {
    version: version,
    makeKey: makeKey,
    readLocal: function (key, maxAge) {
      return readTimed("local", key, maxAge);
    },
    writeLocal: function (key, data) {
      return writeTimed("local", key, data);
    },
    readSession: function (key, maxAge) {
      return readTimed("session", key, maxAge);
    },
    writeSession: function (key, data) {
      return writeTimed("session", key, data);
    },
    removeLocal: function (key) {
      remove("local", key);
    },
    removeSession: function (key) {
      remove("session", key);
    },
    clearOldVersions: function () {
      clearOldVersionKeys("local");
      clearOldVersionKeys("session");
    },
    normaliseLevel: normaliseLevel,
    progressKey: progressKey,
    readProgress: readProgress,
    writeProgress: writeProgress,
    readAllProgress: readAllProgress,
    writeAllProgress: writeAllProgress,
    mergeAllProgress: mergeAllProgress,
    upsertProgress: upsertProgress
  };

  window.GLIP_CACHE.clearOldVersions();
})();
