(function () {
  "use strict";

  function getConfig() {
    return window.PAGE_CONFIG || {};
  }

  function getStudentDetails() {
    return {
      student_id: sessionStorage.getItem("glipStudentId") || "",
      student_name: sessionStorage.getItem("glipStudentName") || "",
      class_id: sessionStorage.getItem("glipClassId") || ""
    };
  }

  function getResult() {
    if (!window.GLIPMatching || typeof window.GLIPMatching.getResult !== "function") {
      return { questions: [], score: 0, total_marks: 0, percentage: 0, complete: false };
    }
    return window.GLIPMatching.getResult(document);
  }

  function setMessage(text, type) {
    const message = document.getElementById("matchingSubmitMessage");
    if (!message) return;
    const value = text || "";
    message.textContent = value;
    message.className = "panel-message text-center" + (type ? " " + type : "") + (value ? "" : " hidden");
  }

  function updatePdfScore() {
    const scoreBox = document.getElementById("matchingPdfScore");
    if (!scoreBox) return;
    const result = getResult();
    const format = window.GLIPMatching && window.GLIPMatching.formatMark
      ? window.GLIPMatching.formatMark
      : function (value) { return String(value || 0); };
    scoreBox.textContent = "Score: " + format(result.score) + " / " + format(result.total_marks);
  }

  function isActivityCompleted() {
    const config = getConfig();
    const activityId = String(config.activityId || "").trim();
    if (!activityId) return false;

    try {
      const session = JSON.parse(sessionStorage.getItem("glipLearningSession") || "null");
      if (!session || !Array.isArray(session.curricula)) return false;
      return session.curricula.some(function (curriculum) {
        return (Array.isArray(curriculum.progress) ? curriculum.progress : []).some(function (row) {
          if (String(row.activity_id || row.activityId || "").trim() !== activityId) return false;
          const status = String(row.status || "").trim().toLowerCase();
          return status === "2" || status === "complete" || status === "completed";
        });
      });
    } catch (_error) {
      return false;
    }
  }

  function setCompletionState(isComplete) {
    const button = document.getElementById("submitMatchingBtn");
    const note = document.getElementById("matchingIncompleteNote");

    if (button) {
      button.dataset.completionMode = isComplete ? "incomplete" : "submit";
      if (!button.disabled) {
        button.textContent = isComplete ? "Mark as Incomplete" : "Submit Answers and Mark as Complete";
      }
    }
    if (note) note.hidden = !isComplete;
  }

  function setSubmitting(isSubmitting) {
    const button = document.getElementById("submitMatchingBtn");
    const progress = document.getElementById("matchingSubmitProgress");

    if (button) {
      button.disabled = isSubmitting;
      button.textContent = isSubmitting
        ? (button.dataset.completionMode === "incomplete" ? "Updating..." : "Submitting...")
        : (button.dataset.completionMode === "incomplete" ? "Mark as Incomplete" : "Submit Answers and Mark as Complete");
    }

    if (progress) progress.classList.toggle("show", isSubmitting);
  }

  function submitMatchingAnswers() {
    const config = getConfig();
    const student = getStudentDetails();

    if (!student.student_id) {
      setMessage("Student not logged in.", "error");
      return;
    }

    const result = getResult();
    if (!result.questions.length) {
      setMessage("No matching questions were found.", "error");
      return;
    }
    if (!result.complete) {
      setMessage("Please complete all matches before submitting.", "error");
      return;
    }

    setSubmitting(true);
    setMessage("Submitting answers and marking the activity as complete...", "info");

    fetch(config.webAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "saveMatchingResultAndProgress",
        student_id: student.student_id,
        student_name: student.student_name,
        class_id: student.class_id,
        level: config.level,
        subject_id: config.subjectId,
        topic_id: config.topicId,
        topic_name: config.topicName,
        activity_id: config.activityId,
        activity_title: config.subTitle || "Matching",
        score: result.score,
        total_marks: result.total_marks,
        percentage: result.percentage,
        answers_json: JSON.stringify(result.questions)
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== "success") {
          throw new Error(data.message || "Could not submit answers.");
        }

        setMessage(
          data.message || "Your answers have been submitted and the activity has been marked as complete.",
          "success"
        );
        setCompletionState(true);

        if (window.GLIPProgressEngine) {
          window.GLIPProgressEngine.updateProgress({
            subject_id: config.subjectId,
            level: config.level,
            topic_id: config.topicId,
            activity_id: config.activityId,
            status: "completed"
          });
        }

        window.dispatchEvent(new CustomEvent("glipProgressSaved", { detail: {
          subjectId: config.subjectId,
          level: config.level,
          topicId: config.topicId,
          activityId: config.activityId,
          status: "completed"
        }}));
      })
      .catch(function (error) {
        setMessage(error.message || "Could not contact the server.", "error");
      })
      .finally(function () { setSubmitting(false); });
  }

  function markMatchingIncomplete() {
    const config = getConfig();
    const student = getStudentDetails();

    if (!student.student_id) {
      setMessage("Student not logged in.", "error");
      return;
    }

    setSubmitting(true);
    setMessage("Marking the activity as incomplete...", "info");

    fetch(config.webAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "setStudentProgressAsIncomplete",
        student_id: student.student_id,
        class_id: student.class_id,
        subject_id: config.subjectId,
        level: config.level,
        activity_id: config.activityId
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== "success") throw new Error(data.message || "Could not update progress.");

        if (window.GLIPProgressEngine) {
          window.GLIPProgressEngine.updateProgress({
            subject_id: config.subjectId,
            level: config.level,
            topic_id: config.topicId,
            activity_id: config.activityId,
            status: "not_started"
          });
        }

        window.dispatchEvent(new CustomEvent("glipProgressSaved", { detail: {
          subjectId: config.subjectId,
          level: config.level,
          topicId: config.topicId,
          activityId: config.activityId,
          status: "not_started"
        }}));

        setCompletionState(false);
        setMessage("Activity marked as incomplete.", "success");
      })
      .catch(function (error) {
        setMessage(error.message || "Could not update progress.", "error");
      })
      .finally(function () { setSubmitting(false); });
  }

  function handleCompletionClick() {
    const button = document.getElementById("submitMatchingBtn");
    if (button && button.dataset.completionMode === "incomplete") {
      markMatchingIncomplete();
    } else {
      submitMatchingAnswers();
    }
  }

  function initialisePdf() {
    if (!window.TonioPdfExport || typeof window.TonioPdfExport.initMatchingPdfExport !== "function") return;
    window.TonioPdfExport.initMatchingPdfExport({
      buttonId: "saveMatchingPdfBtn",
      messageId: "matchingPdfMessage",
      fallbackName: "Matching"
    });
  }

  function initialise() {
    const button = document.getElementById("submitMatchingBtn");
    if (button && button.dataset.matchingSubmitReady !== "true") {
      button.dataset.matchingSubmitReady = "true";
      button.addEventListener("click", handleCompletionClick);
    }

    setCompletionState(isActivityCompleted());
    updatePdfScore();
    initialisePdf();
  }

  document.addEventListener("glipMatchingContentLoaded", function () {
    if (window.GLIPMatching && typeof window.GLIPMatching.setup === "function") {
      window.GLIPMatching.setup(document);
    }
    updatePdfScore();
    initialisePdf();
  });
  document.addEventListener("glipMatchingChanged", updatePdfScore);
  document.addEventListener("glipMatchingChecked", updatePdfScore);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }

  document.addEventListener("glipReady", initialise);
})();
