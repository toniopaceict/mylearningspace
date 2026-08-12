(function () {
  "use strict";

  function setupDragAndDropQuestions(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const questions = scope.querySelectorAll(".drag-drop-question");

    questions.forEach(question => {
      if (question.dataset.glipDragDropReady === "true") return;
      question.dataset.glipDragDropReady = "true";

      const options = question.querySelectorAll(".drag-option");
      const zones = question.querySelectorAll(".drop-zone");
      const feedback = question.querySelector(".drag-drop-feedback");
      const feedbackBox = question.querySelector(".drag-feedback-box");
      const checkBtn = question.querySelector(".check-drag-drop-btn");
      const resetBtn = question.querySelector(".reset-drag-drop-btn");

      if (!options.length || !zones.length) return;

      let selectedValue = "";

      options.forEach(option => {
        option.addEventListener("dragstart", event => {
          event.dataTransfer.setData(
            "text/plain",
            option.dataset.value || option.textContent.trim()
          );
        });

        option.addEventListener("click", () => {
          selectedValue = option.dataset.value || option.textContent.trim();

          options.forEach(item => item.classList.remove("selected"));
          option.classList.add("selected");
        });
      });

      zones.forEach(zone => {
        zone.addEventListener("dragover", event => {
          event.preventDefault();
          zone.classList.add("drag-over");
        });

        zone.addEventListener("dragleave", () => {
          zone.classList.remove("drag-over");
        });

        zone.addEventListener("drop", event => {
          event.preventDefault();
          const value = event.dataTransfer.getData("text/plain");
          setZoneAnswer(zone, value);
        });

        zone.addEventListener("click", () => {
          if (selectedValue) {
            setZoneAnswer(zone, selectedValue);
          }
        });
      });

      function setZoneAnswer(zone, value) {
        zone.classList.remove(
          "drag-over",
          "correct",
          "incorrect",
          "missing"
        );

        zone.textContent = value;
        zone.dataset.selected = value;

        zone.classList.add("filled");

        if (feedback) {
          feedback.textContent = "";
          feedback.style.color = "#0b3c6f";
          if (feedbackBox) feedbackBox.classList.add("hidden");
        }
        document.dispatchEvent(new CustomEvent("glipFillBlankChanged"));
      }

      function checkAnswers() {
        const total = zones.length;
        const unfilledZones = [...zones].filter(zone => !(zone.dataset.selected || "").trim());
        zones.forEach(zone => zone.classList.remove("missing"));
        unfilledZones.forEach(zone => zone.classList.add("missing"));
        if (unfilledZones.length > 0) {
          if (feedback) { feedback.textContent = `Please complete all ${total} blanks before checking your answers.`; feedback.style.color = "#b3261e"; }
          if (feedbackBox) feedbackBox.classList.remove("hidden");
          return;
        }
        let correctCount = 0;
        zones.forEach(zone => {
          const selected = (zone.dataset.selected || "").trim().toLowerCase();
          const correct = (zone.dataset.correct || "").trim().toLowerCase();
          const isCorrect = selected === correct;
          zone.classList.toggle("correct", isCorrect);
          zone.classList.toggle("incorrect", !isCorrect);
          if (isCorrect) correctCount += 1;
        });
        if (feedback) {
          const summary = correctCount === total ? `You completed all ${total} blanks correctly.` : `You completed ${correctCount} out of ${total} blanks correctly.`;
          const explanation = (question.dataset.formativeFeedback || "").trim();
          feedback.textContent = summary + (explanation ? " " + explanation : "");
          feedback.style.color = correctCount === total ? "#137333" : "#b3261e";
        }
        if (feedbackBox) feedbackBox.classList.remove("hidden");
        document.dispatchEvent(new CustomEvent("glipFillBlankChecked", { detail: { allCorrect: correctCount === total } }));
      }

      function resetAnswers() {
        zones.forEach((zone, index) => {
          zone.textContent = `Blank ${index + 1}`;
          delete zone.dataset.selected;

          zone.classList.remove(
            "drag-over",
            "correct",
            "incorrect",
            "filled",
            "missing"
          );
        });

        selectedValue = "";
        options.forEach(item => item.classList.remove("selected"));

        if (feedback) feedback.textContent = "";
        if (feedbackBox) feedbackBox.classList.add("hidden");
        document.dispatchEvent(new CustomEvent("glipFillBlankChanged"));
      }

      if (checkBtn) checkBtn.addEventListener("click", checkAnswers);
      if (resetBtn) resetBtn.addEventListener("click", resetAnswers);
    });
  }

  window.GLIPDragDrop = {
    setup: setupDragAndDropQuestions
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setupDragAndDropQuestions(document);
    }, { once: true });
  } else {
    setupDragAndDropQuestions(document);
  }
})();
