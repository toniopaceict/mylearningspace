(function (global) {
  "use strict";

  function defaultIsSuccess(result) {
    return Boolean(result && result.status === "success");
  }

  function toError(result, fallbackMessage) {
    if (result instanceof Error) return result;
    return new Error((result && result.message) || fallbackMessage || "The change could not be saved.");
  }

  function run(options) {
    options = options || {};

    if (typeof options.request !== "function") {
      return Promise.reject(new Error("GLIP optimistic update requires a request function."));
    }

    try {
      if (typeof options.apply === "function") options.apply();
    } catch (error) {
      return Promise.reject(error);
    }

    return Promise.resolve()
      .then(options.request)
      .then(function (result) {
        const isSuccess = typeof options.isSuccess === "function" ? options.isSuccess(result) : defaultIsSuccess(result);
        if (!isSuccess) throw toError(result, options.failureMessage);

        if (typeof options.onSuccess === "function") options.onSuccess(result);

        if (typeof options.resync === "function") {
          Promise.resolve()
            .then(options.resync)
            .catch(function (error) {
              console.warn(options.resyncWarning || "Silent optimistic-update resynchronisation failed.", error);
            });
        }

        return result;
      })
      .catch(function (error) {
        try {
          if (typeof options.rollback === "function") options.rollback(error);
        } catch (rollbackError) {
          console.error("GLIP optimistic-update rollback failed.", rollbackError);
        }

        if (typeof options.onFailure === "function") options.onFailure(error);
        return null;
      });
  }

  function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map(function (row) { return Object.assign({}, row); }) : [];
  }

  global.GLIPOptimisticUpdate = Object.freeze({
    run: run,
    cloneRows: cloneRows
  });
})(window);
