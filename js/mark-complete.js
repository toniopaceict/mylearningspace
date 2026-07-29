(function (window) {
  "use strict";

  let currentConfig = null;

  function getConfig() {
    return Object.assign(
      {},
      currentConfig || {},
      window.MARK_COMPLETE_CONFIG || {},
    );
  }

  function getById(id) {
    return id ? document.getElementById(id) : null;
  }

function setMessage(text, colour) {
  const config = getConfig();
  const message = getById(config.messageId || "message");
  if (!message) return;

  message.innerText = text || "";
  message.style.color = colour || config.defaultColour || "#0b3c6f";

  if (text) {
    setTimeout(function () {
      message.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
  }
}

function toggleSaveProgressBar(show) {
  const bar = document.getElementById("saveProgressBar");
  if (!bar) return;

  bar.classList.toggle("show", !!show);
}

  function updateButtonState(enabled) {
    const config = getConfig();
    const button = getById(config.buttonId || "markCompleteBtn");
    if (!button) return;

    button.disabled = !enabled;
  }

  function isReadyToSubmit() {
    const config = getConfig();

    if (typeof config.isReady === "function") {
      return !!config.isReady();
    }

    return true;
  }

  function clearGlipProgressCache() {
    if (window.GLIPNextActivity && typeof window.GLIPNextActivity.clearRecommendations === "function") {
      window.GLIPNextActivity.clearRecommendations();
    }

    const studentId = sessionStorage.getItem("glipStudentId") || "";
    const level = sessionStorage.getItem("glipLevel") || "";

    Object.keys(sessionStorage).forEach(function (key) {
      const isProgressCache =
        key === "glipProgress" ||
        key === "glipProgressTime" ||
        key.includes("_progress_" + studentId) ||
        key.includes("_progress_time_" + studentId);

      const isCurrentLevel = !level || key.includes(level);

      if (isProgressCache && isCurrentLevel) {
        sessionStorage.removeItem(key);
      }
    });
  }

  function getLoggedInStudentId() {
    return sessionStorage.getItem("glipStudentId") || "";
  }

  function dispatchProgressSaved(config) {
    setTimeout(function () {
      window.dispatchEvent(
        new CustomEvent("glipProgressSaved", {
          detail: {
            subjectId: config.subjectId,
            level: config.level,
            topicId: config.topicId || "",
            isLastActivity: config.isLastActivity === true,
            activityId: config.activityId,
            status: config.status || "completed",
          },
        }),
      );
    }, 0);
  }

  function saveProgress() {
    const config = getConfig();
    const button = getById(config.buttonId || "markCompleteBtn");

    const studentId = getLoggedInStudentId();

    if (!studentId) {
      setMessage(
        config.notLoggedInText || "Student not logged in.",
        config.errorColour || "#b3261e",
      );

      if (button) button.disabled = false;
      return;
    }

    if (!config.webAppUrl) {
      setMessage(
        config.missingWebAppText || "Progress tracker is not configured.",
        config.errorColour || "#b3261e",
      );

      if (button) button.disabled = false;
      return;
    }

    setMessage(
      config.loadingText || "Saving progress...",
      config.loadingColour || "#0b3c6f",
    );

    toggleSaveProgressBar(true);

    window.dispatchEvent(
      new CustomEvent("glipProgressSaveStarted", {
        detail: {
          subjectId: config.subjectId,
          level: config.level,
          topicId: config.topicId || "",
          isLastActivity: config.isLastActivity === true,
          activityId: config.activityId,
          status: config.status || "completed",
        },
      }),
    );

    if (button) button.disabled = true;

    const webAppUrl =
  (typeof window.getGlipWebAppUrl === "function"
    ? window.getGlipWebAppUrl()
    : config.webAppUrl || "");

fetch(webAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "saveProgress",
        student_id: studentId,
        subject_id: config.subjectId,
        level: config.level,
        activity_id: config.activityId,
        status: config.status || "completed",
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.status === "success") {
          if (window.GLIPProgressEngine) {
            window.GLIPProgressEngine.updateProgress({
              subject_id: config.subjectId,
              level: config.level,
              topic_id: config.topicId || "",
              activity_id: config.activityId,
              status: config.status || "completed"
            });
          } else if (window.GLIPLearningSession) {
            window.GLIPLearningSession.updateProgress({
              subject_id: config.subjectId,
              level: config.level,
              topic_id: config.topicId || "",
              activity_id: config.activityId,
              status: config.status || "completed"
            });
          }

          // Keep the current progress cache intact. The glipProgressSaved
          // event below updates compatibility caches.
          if (window.GLIPNextActivity && typeof window.GLIPNextActivity.clearRecommendations === "function") {
            window.GLIPNextActivity.clearRecommendations();
          }

          setMessage(
            config.successText || "Progress saved.",
            config.successColour || "#137333",
          );

          toggleSaveProgressBar(false);

          if (button) button.disabled = false;

          dispatchProgressSaved(config);
        } else {
          setMessage(
            data.message || config.errorText || "Could not save progress.",
            config.errorColour || "#b3261e",
          );

          toggleSaveProgressBar(false);

          if (button) button.disabled = false;
        }
      })

      .catch(function () {
        setMessage(
          config.contactErrorText || "Could not contact the progress tracker.",
          config.errorColour || "#b3261e",
        );

        toggleSaveProgressBar(false);

        if (button) button.disabled = false;
      });
  }

  function markComplete() {
    const config = getConfig();

    if (config.mode === "saveProgress") {
      saveProgress();
      return;
    }

    const input = getById(config.inputId || "studentCode");
    const button = getById(config.buttonId || "markCompleteBtn");

    if (!input || !button) return;

    if (!isReadyToSubmit()) {
      setMessage(
        config.notReadyText ||
          "Please complete all required work before marking this as complete.",
        config.errorColour || "#b3261e",
      );
      updateButtonState(false);
      return;
    }

    const code = input.value.trim();

    if (!code) {
      setMessage(
        config.emptyCodeText || "Please enter your student code.",
        config.errorColour || "#b3261e",
      );
      return;
    }

    setMessage(
      config.loadingText || "Loading...",
      config.loadingColour || "#0b3c6f",
    );

    button.disabled = true;

    fetch(
      config.webAppUrl +
        "?action=markComplete" +
        "&studentCode=" +
        encodeURIComponent(code) +
        "&exerciseCode=" +
        encodeURIComponent(config.exerciseCode),
    )
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.ok) {
          clearGlipProgressCache();

          const msg =
            data.message ||
            config.successText ||
            "Exercise marked as complete.";

          if (msg.toLowerCase().includes("already")) {
            setMessage(msg, config.alreadyColour || "#ff8c00");
          } else {
            setMessage(msg, config.successColour || "#137333");
          }
        } else {
          setMessage(
            data.message || config.notFoundText || "Student not found.",
            config.errorColour || "#b3261e",
          );
        }
      })
      .catch(function () {
        setMessage(
          config.contactErrorText || "Could not contact the progress tracker.",
          config.errorColour || "#b3261e",
        );
      })
      .finally(function () {
        if (typeof config.isReady === "function") {
          updateButtonState(isReadyToSubmit());
        } else {
          button.disabled = false;
        }
      });
  }

  function initMarkComplete(config) {
    currentConfig = Object.assign(
      {
        inputId: "studentCode",
        buttonId: "markCompleteBtn",
        messageId: "message",
        defaultColour: "#0b3c6f",
        successColour: "#137333",
        alreadyColour: "#ff8c00",
        errorColour: "#b3261e",
        loadingColour: "#0b3c6f",
        mode: "markComplete",
      },
      window.MARK_COMPLETE_CONFIG || {},
      config || {},
    );

    const input = getById(currentConfig.inputId);
    const button = getById(currentConfig.buttonId);

    if (button && !button.dataset.tonioMarkBound) {
      button.addEventListener("click", markComplete);
      button.dataset.tonioMarkBound = "true";
    }

    if (input && !input.dataset.tonioEnterBound) {
      input.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          markComplete();
        }
      });
      input.dataset.tonioEnterBound = "true";
    }

    if (typeof currentConfig.isReady === "function") {
      updateButtonState(isReadyToSubmit());
    }

    if (currentConfig.initialMessage) {
      setMessage(
        currentConfig.initialMessage,
        currentConfig.initialMessageColour || currentConfig.defaultColour,
      );
    }

    return {
      markComplete: markComplete,
      saveProgress: saveProgress,
      setMessage: setMessage,
      updateButtonState: updateButtonState,
      clearGlipProgressCache: clearGlipProgressCache,
    };
  }

  window.TonioMarkComplete = {
    initMarkComplete: initMarkComplete,
    markComplete: markComplete,
    saveProgress: saveProgress,
    setMessage: setMessage,
    updateButtonState: updateButtonState,
    clearGlipProgressCache: clearGlipProgressCache,
  };

  window.markComplete = markComplete;
})(window);
