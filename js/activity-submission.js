(function () {
  "use strict";

  function getConfig() {
    return window.PAGE_CONFIG || {};
  }

  function setMessage(text, colour) {
    const message = document.getElementById("fillBlankSubmitMessage");
    if (!message) return;

    message.textContent = text || "";
    message.style.color = colour || "#0b3c6f";
  }

  function getStudentDetails() {
    return {
      student_id: sessionStorage.getItem("glipStudentId") || "",
      student_name: sessionStorage.getItem("glipStudentName") || "",
      class_id: sessionStorage.getItem("glipClassId") || ""
    };
  }

  function getDropZoneAnswer(blank) {
    const value = blank.dataset.value || blank.textContent || "";
    return value.trim();
  }

  function collectFillBlankAnswers() {
    const blanks = Array.from(document.querySelectorAll(".drop-zone"));

    let score = 0;

    const answers = blanks.map(function (blank, index) {
      const selectedAnswer = getDropZoneAnswer(blank);
      const correctAnswer = String(blank.dataset.correct || "").trim();

      const isAnswered =
        selectedAnswer &&
        !/^blank\s*\d+$/i.test(selectedAnswer);

      const isCorrect =
        isAnswered &&
        selectedAnswer.toLowerCase() === correctAnswer.toLowerCase();

      if (isCorrect) score += 1;

      return {
        blank_id: blank.dataset.blankId || "blank" + (index + 1),
        selected_answer: isAnswered ? selectedAnswer : "",
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

  function submitFillBlankAnswers() {
    const config = getConfig();
    const student = getStudentDetails();

    if (!student.student_id) {
      setMessage("Student not logged in.", "#b3261e");
      return;
    }

    if (!config.webAppUrl) {
      setMessage("Submission link is not configured.", "#b3261e");
      return;
    }

    const result = collectFillBlankAnswers();

    const hasMissingAnswers = result.answers.some(function (answer) {
      return !answer.selected_answer;
    });

    if (hasMissingAnswers) {
      setMessage("Please fill in all blanks before submitting.", "#b3261e");
      return;
    }

    const button = document.getElementById("submitFillBlankBtn");
    if (button) button.disabled = true;

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
        activity_title: config.subTitle || "Fill in the Blanks",
        score: result.score,
        total_marks: result.total_marks,
        answers_json: JSON.stringify(result.answers)
      })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
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

          return;
        }

        setMessage(data.message || "Could not submit answers.", "#b3261e");

        if (button) button.disabled = false;
      })
      .catch(function () {
        setMessage("Could not contact the server.", "#b3261e");

        if (button) button.disabled = false;
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const button = document.getElementById("submitFillBlankBtn");
    if (!button) return;

    button.addEventListener("click", submitFillBlankAnswers);
  });
})();
