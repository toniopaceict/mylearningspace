(function () {
  "use strict";

  function getConfig() { return window.PAGE_CONFIG || {}; }

  function getStudentDetails() {
    return {
      student_id: sessionStorage.getItem("glipStudentId") || "",
      student_name: sessionStorage.getItem("glipStudentName") || "",
      class_id: sessionStorage.getItem("glipClassId") || ""
    };
  }

  function getResult() {
    if (!window.GLIPSorting || typeof window.GLIPSorting.getResult !== "function") {
      return { questions: [], complete: false, all_correct: false };
    }
    return window.GLIPSorting.getResult(document);
  }

  function setMessage(text, type) {
    const message = document.getElementById("sortingSubmitMessage");
    if (!message) return;
    const value = text || "";
    message.textContent = value;
    message.className = "panel-message text-center" + (type ? " " + type : "") + (value ? "" : " hidden");
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
    } catch (_error) { return false; }
  }

  function setCompletionState(isComplete) {
    const button = document.getElementById("submitSortingBtn");
    const note = document.getElementById("sortingIncompleteNote");
    if (button) {
      button.dataset.completionMode = isComplete ? "incomplete" : "submit";
      if (!button.disabled) button.textContent = isComplete ? "Mark as Incomplete" : "Submit Answers and Mark as Complete";
    }
    if (note) note.hidden = !isComplete;
  }

  function setSubmitting(isSubmitting) {
    const button = document.getElementById("submitSortingBtn");
    const progress = document.getElementById("sortingSubmitProgress");
    if (button) {
      button.disabled = isSubmitting;
      button.textContent = isSubmitting
        ? (button.dataset.completionMode === "incomplete" ? "Updating..." : "Submitting...")
        : (button.dataset.completionMode === "incomplete" ? "Mark as Incomplete" : "Submit Answers and Mark as Complete");
    }
    if (progress) progress.classList.toggle("show", isSubmitting);
  }

  function updateMasterySubmissionState() {
    const button = document.getElementById("submitSortingBtn");
    if (!button || button.dataset.completionMode === "incomplete") return;
    const result = getResult();
    button.disabled = !result.all_correct;
    button.title = result.all_correct ? "" : "Check your answers and correctly order all items before submitting.";
  }

  function submitSortingAnswers() {
    const config = getConfig();
    const student = getStudentDetails();
    const result = getResult();

    if (!student.student_id) { setMessage("Student not logged in.", "error"); return; }
    if (!result.questions.length) { setMessage("No sorting questions were found.", "error"); return; }
    if (!result.all_correct) { setMessage("Please correct all sorting questions before submitting.", "error"); return; }

    setSubmitting(true);
    setMessage("Submitting answers and marking the activity as complete...", "info");

    fetch(config.webAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "saveSortingResultAndProgress",
        student_id: student.student_id,
        student_name: student.student_name,
        class_id: student.class_id,
        level: config.level,
        subject_id: config.subjectId,
        topic_id: config.topicId,
        topic_name: config.topicName,
        activity_id: config.activityId,
        activity_title: config.subTitle || "Sorting",
        answers_json: JSON.stringify(result.questions)
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== "success") throw new Error(data.message || "Could not submit answers.");
        setMessage(data.message || "Your answers have been submitted and the activity has been marked as complete.", "success");
        setCompletionState(true);
        if (window.GLIPProgressEngine) {
          window.GLIPProgressEngine.updateProgress({
            subject_id: config.subjectId, level: config.level, topic_id: config.topicId,
            activity_id: config.activityId, status: "completed"
          });
        }
        window.dispatchEvent(new CustomEvent("glipProgressSaved", { detail: {
          subjectId: config.subjectId, level: config.level, topicId: config.topicId,
          activityId: config.activityId, status: "completed"
        }}));
      })
      .catch(function (error) { setMessage(error.message || "Could not contact the server.", "error"); })
      .finally(function () { setSubmitting(false); updateMasterySubmissionState(); });
  }

  function markSortingIncomplete() {
    const config = getConfig();
    const student = getStudentDetails();
    if (!student.student_id) { setMessage("Student not logged in.", "error"); return; }

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
            subject_id: config.subjectId, level: config.level, topic_id: config.topicId,
            activity_id: config.activityId, status: "not_started"
          });
        }
        window.dispatchEvent(new CustomEvent("glipProgressSaved", { detail: {
          subjectId: config.subjectId, level: config.level, topicId: config.topicId,
          activityId: config.activityId, status: "not_started"
        }}));
        setCompletionState(false);
        setMessage("Activity marked as incomplete.", "success");
      })
      .catch(function (error) { setMessage(error.message || "Could not update progress.", "error"); })
      .finally(function () { setSubmitting(false); updateMasterySubmissionState(); });
  }

  function handleCompletionClick() {
    const button = document.getElementById("submitSortingBtn");
    if (button && button.dataset.completionMode === "incomplete") markSortingIncomplete();
    else submitSortingAnswers();
  }

  function initialisePdf() {
    if (!window.TonioPdfExport || typeof window.TonioPdfExport.initSortingPdfExport !== "function") return;
    window.TonioPdfExport.initSortingPdfExport({
      buttonId: "saveSortingPdfBtn",
      messageId: "sortingPdfMessage",
      fallbackName: "Sorting"
    });
  }

  function initialise() {
    const button = document.getElementById("submitSortingBtn");
    if (button && button.dataset.sortingSubmitReady !== "true") {
      button.dataset.sortingSubmitReady = "true";
      button.addEventListener("click", handleCompletionClick);
    }
    setCompletionState(isActivityCompleted());
    updateMasterySubmissionState();
    initialisePdf();
  }

  document.addEventListener("glipSortingContentLoaded", function () {
    if (window.GLIPSorting && typeof window.GLIPSorting.setup === "function") window.GLIPSorting.setup(document);
    initialisePdf();
    updateMasterySubmissionState();
  });
  document.addEventListener("glipSortingChanged", updateMasterySubmissionState);
  document.addEventListener("glipSortingChecked", updateMasterySubmissionState);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
  document.addEventListener("glipReady", initialise);
})();
