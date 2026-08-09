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

  function collectFillBlankAnswers() {
    const blanks = Array.from(document.querySelectorAll(".drop-zone"));
    let score = 0;

    const answers = blanks.map(function (blank) {
      const selectedAnswer = blank.dataset.value || blank.textContent.trim();
      const correctAnswer = blank.dataset.correct || "";
      const isCorrect =
        selectedAnswer.trim().toLowerCase() ===
        correctAnswer.trim().toLowerCase();

      if (isCorrect) score++;

      const fieldset = blank.closest("fieldset");
      const legend = fieldset ? fieldset.querySelector("legend") : null;
      const blankId = blank.dataset.blankId || "";
      const blankMatch = blankId.match(/blank(\d+)$/i);

      return {
        task_title: legend ? legend.textContent.trim() : "Task",
        blank_id: blankId,
        blank_label: blankMatch ? "Blank " + blankMatch[1] : blankId,
        selected_answer: selectedAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect
      };
    });

    return {
      answers: answers,
      score: score,
      total_marks: blanks.length
    };
  }

  function isComplete(result) {
    return result.answers.every(function (answer) {
      return answer.selected_answer && !/^Blank\s*\d*$/i.test(answer.selected_answer);
    });
  }

  function setMessage(text, type) {
    const message = document.getElementById("fillBlankSubmitMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = "panel-message text-center" + (type ? " " + type : "");
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
    const button = document.getElementById("submitFillBlankBtn");
    const note = document.getElementById("fillBlankIncompleteNote");
    if (button) {
      button.dataset.completionMode = isComplete ? "incomplete" : "submit";
      if (!button.disabled) {
        button.textContent = isComplete ? "Mark as Incomplete" : "Submit Answers and Mark as Complete";
      }
    }
    if (note) note.hidden = !isComplete;
  }

  function setSubmitting(isSubmitting) {
    const button = document.getElementById("submitFillBlankBtn");
    const progress = document.getElementById("fillBlankSubmitProgress");

    if (button) {
      button.disabled = isSubmitting;
      button.textContent = isSubmitting
        ? (button.dataset.completionMode === "incomplete" ? "Updating..." : "Submitting...")
        : (button.dataset.completionMode === "incomplete" ? "Mark as Incomplete" : "Submit Answers and Mark as Complete");
    }

    if (progress) {
      progress.classList.toggle("show", isSubmitting);
    }
  }

  function updatePdfScore() {
    const scoreBox = document.getElementById("fillBlankPdfScore");
    if (!scoreBox) return;
    const result = collectFillBlankAnswers();
    scoreBox.textContent = "Score: " + result.score + " / " + result.total_marks;
  }

  function submitFillBlankAnswers() {
    const config = getConfig();
    const student = getStudentDetails();

    if (!student.student_id) {
      setMessage("Student not logged in.", "error");
      return;
    }

    const result = collectFillBlankAnswers();

    if (!isComplete(result)) {
      setMessage("Please fill in all blanks before submitting.", "error");
      return;
    }

    setSubmitting(true);
    setMessage("Submitting answers and marking the activity as complete...", "info");

    fetch(config.webAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "saveFillBlankResultAndProgress",
        student_id: student.student_id,
        student_name: student.student_name,
        class_id: student.class_id,
        level: config.level,
        subject_id: config.subjectId,
        topic_id: config.topicId,
        topic_name: config.topicName,
        activity_id: config.activityId,
        activity_name: config.subTitle || "Fill in the Blanks",
        score: result.score,
        total_marks: result.total_marks,
        answers_json: JSON.stringify(result.answers)
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

        window.dispatchEvent(
          new CustomEvent("glipProgressSaved", {
            detail: {
              subjectId: config.subjectId,
              level: config.level,
              topicId: config.topicId,
              activityId: config.activityId,
              status: "completed"
            }
          })
        );
      })
      .catch(function (error) {
        setMessage(error.message || "Could not contact the server.", "error");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function markFillBlankIncomplete() {
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
      .catch(function (error) {
        setMessage(error.message || "Could not update progress.", "error");
      })
      .finally(function () { setSubmitting(false); });
  }

  function handleFillBlankCompletionClick() {
    const button = document.getElementById("submitFillBlankBtn");
    if (button && button.dataset.completionMode === "incomplete") {
      markFillBlankIncomplete();
    } else {
      submitFillBlankAnswers();
    }
  }

  function initialiseFillBlankPdf() {
    if (!window.TonioPdfExport || typeof window.TonioPdfExport.initFillBlankPdfExport !== "function") {
      return;
    }

    window.TonioPdfExport.initFillBlankPdfExport({
      buttonId: "saveFillBlankPdfBtn",
      messageId: "fillBlankPdfMessage",
      fallbackName: "Fill in the Blanks"
    });
  }

  function initialiseFillBlankPage() {
    const button = document.getElementById("submitFillBlankBtn");
    if (button && button.dataset.fillBlankSubmitReady !== "true") {
      button.dataset.fillBlankSubmitReady = "true";
      button.addEventListener("click", handleFillBlankCompletionClick);
    }

    if (document.documentElement.dataset.glipFillBlankPdfReady !== "true") {
      document.documentElement.dataset.glipFillBlankPdfReady = "true";
      initialiseFillBlankPdf();
    }

    setCompletionState(isActivityCompleted());
    updatePdfScore();

    if (document.documentElement.dataset.glipFillBlankScoreReady !== "true") {
      document.documentElement.dataset.glipFillBlankScoreReady = "true";
      document.addEventListener("click", function (event) {
        if (event.target.closest(".check-drag-drop-btn, .reset-drag-drop-btn")) {
          window.setTimeout(updatePdfScore, 0);
        }
      });
      document.addEventListener("drop", function () {
        window.setTimeout(updatePdfScore, 0);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseFillBlankPage, { once: true });
  } else {
    initialiseFillBlankPage();
  }

  document.addEventListener("glipReady", initialiseFillBlankPage);
})();
