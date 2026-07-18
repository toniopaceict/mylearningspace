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
    }
  };

  window.GLIP_CACHE.clearOldVersions();
})();
