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

      return {
        blank_id: blank.dataset.blankId || "",
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

  function setMessage(text, colour) {
    const message = document.getElementById("fillBlankSubmitMessage");
    if (!message) return;

    message.textContent = text || "";
    message.style.color = colour || "#0b3c6f";
  }

  function submitFillBlankAnswers() {
    const config = getConfig();
    const student = getStudentDetails();

    if (!student.student_id) {
      setMessage("Student not logged in.", "#b3261e");
      return;
    }

    const result = collectFillBlankAnswers();

    if (result.answers.some(a => !a.selected_answer || a.selected_answer.startsWith("Blank"))) {
      setMessage("Please fill in all blanks before submitting.", "#b3261e");
      return;
    }

    setMessage("Submitting answers...", "#0b3c6f");

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
          setMessage("Answers submitted successfully.", "#137333");

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
          setMessage(data.message || "Could not submit answers.", "#b3261e");
        }
      })
      .catch(() => {
        setMessage("Could not contact the server.", "#b3261e");
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const button = document.getElementById("submitFillBlankBtn");
    if (!button) return;

    button.addEventListener("click", submitFillBlankAnswers);
  });
})();