(function (global) {
  "use strict";

  const resyncStates = new WeakMap();

  function defaultIsSuccess(result) {
    return Boolean(result && result.status === "success");
  }

  function toError(result, fallbackMessage) {
    if (result instanceof Error) return result;
    return new Error((result && result.message) || fallbackMessage || "The change could not be saved.");
  }

  function scheduleResync(resync, warning) {
    if (typeof resync !== "function") return;
    let state = resyncStates.get(resync);
    if (!state) {
      state = { timer: null, running: false, rerun: false, generation: 0 };
      resyncStates.set(resync, state);
    }
    state.generation += 1;
    if (state.running) {
      state.rerun = true;
      return;
    }
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(function execute() {
      state.timer = null;
      state.running = true;
      const startedGeneration = state.generation;
      Promise.resolve().then(function () {
        return resync({ generation: startedGeneration });
      }).catch(function (error) {
        console.warn(warning || "Silent optimistic-update resynchronisation failed.", error);
      }).finally(function () {
        state.running = false;
        if (state.rerun || state.generation > startedGeneration) {
          state.rerun = false;
          scheduleResync(resync, warning);
        }
      });
    }, 180);
  }

  function run(options) {
    options = options || {};
    if (typeof options.request !== "function") {
      return Promise.reject(new Error("GLIP commit-first update requires a request function."));
    }

    // Commit-first rule: do not change the visible record until Apps Script
    // confirms that the essential Sheet/Drive transaction is committed.
    return Promise.resolve()
      .then(options.request)
      .then(function (result) {
        const isSuccess = typeof options.isSuccess === "function" ? options.isSuccess(result) : defaultIsSuccess(result);
        const committed = !result || result.committed === undefined ? isSuccess : result.committed === true;
        if (!isSuccess || !committed) throw toError(result, options.failureMessage);

        if (typeof options.apply === "function") options.apply(result);
        if (typeof options.onSuccess === "function") options.onSuccess(result);
        scheduleResync(options.resync, options.resyncWarning);
        return result;
      })
      .catch(function (error) {
        // No rollback is required because the browser state was not changed
        // before commitment. Existing rollback handlers are deliberately not
        // called, preventing an old snapshot from overwriting newer UI state.
        if (typeof options.onFailure === "function") options.onFailure(error);
        return null;
      });
  }

  function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map(function (row) { return Object.assign({}, row); }) : [];
  }

  function comparableValue(value) {
    if (value === true || value === false) return value ? "true" : "false";
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function serverConfirmsPending(serverRow, localRow) {
    if (!serverRow || !localRow) return false;
    return Object.keys(localRow).every(function (field) {
      if (field.indexOf("pending_") === 0 || field === "full_name") return true;
      if (!Object.prototype.hasOwnProperty.call(serverRow, field)) return true;
      return comparableValue(serverRow[field]) === comparableValue(localRow[field]);
    });
  }

  function mergePendingRows(serverRows, localRows, keyField) {
    const confirmed = cloneRows(serverRows);
    const local = Array.isArray(localRows) ? localRows : [];
    const indexes = new Map();
    confirmed.forEach(function (row, index) {
      indexes.set(String(row && row[keyField]), index);
    });

    local.forEach(function (row) {
      if (!row || row.pending_save !== true) return;
      const key = String(row[keyField]);
      const serverIndex = indexes.get(key);
      if (serverIndex === undefined) {
        confirmed.push(Object.assign({}, row));
        indexes.set(key, confirmed.length - 1);
        return;
      }
      if (!serverConfirmsPending(confirmed[serverIndex], row)) {
        confirmed[serverIndex] = Object.assign({}, row);
      }
    });
    return confirmed;
  }

  function markUpdatesPending(rows, updates, keyField) {
    const updateKeys = new Set((updates || []).map(function (item) { return String(item && item[keyField]); }));
    (rows || []).forEach(function (row) {
      if (row && updateKeys.has(String(row[keyField]))) markPending(row);
    });
  }

  function markPending(row, operationId) {
    if (!row) return row;
    row.pending_save = true;
    row.pending_operation_id = operationId || ("op-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
    row.pending_state = "saving";
    return row;
  }

  function markSaved(row) {
    if (!row) return row;
    row.pending_save = false;
    row.pending_state = "saved";
    return row;
  }

  global.GLIPOptimisticUpdate = Object.freeze({
    run: run,
    cloneRows: cloneRows,
    mergePendingRows: mergePendingRows,
    markPending: markPending,
    markSaved: markSaved,
    markUpdatesPending: markUpdatesPending
  });
})(window);
