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

  function setMessage(text, type) {
    const message = document.getElementById("fillBlankSubmitMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message text-center" + (type ? " " + type : "");
  }

  function submitFillBlankAnswers() {
    const config = getConfig();
    const student = getStudentDetails();

    if (!student.student_id) {
      setMessage("Student not logged in.", "error");
      return;
    }

    const result = collectFillBlankAnswers();

    if (result.answers.some(a => !a.selected_answer || a.selected_answer.startsWith("Blank"))) {
      setMessage("Please fill in all blanks before submitting.", "error");
      return;
    }

    setMessage("Submitting answers...", "info");

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
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          setMessage(data.message || "Answers submitted successfully.", "success");

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
        } else {
          setMessage(data.message || "Could not submit answers.", "error");
        }
      })
      .catch(() => {
        setMessage("Could not contact the server.", "error");
      });
  }

  function initialiseFillBlankSubmission() {
    const button = document.getElementById("submitFillBlankBtn");
    if (!button || button.dataset.fillBlankSubmitReady === "true") return;

    button.dataset.fillBlankSubmitReady = "true";
    button.addEventListener("click", submitFillBlankAnswers);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseFillBlankSubmission, { once: true });
  } else {
    initialiseFillBlankSubmission();
  }
})();