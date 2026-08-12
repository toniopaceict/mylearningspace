(function (window) {
  "use strict";

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function roundMark(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatMark(value) {
    const n = roundMark(value);
    return Number.isInteger(n) ? String(n) : String(n.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "");
  }

  function questionResult(question) {
    const zones = Array.from(question.querySelectorAll("[data-match-zone]"));
    let correctCount = 0;
    const pairs = zones.map(function (zone, index) {
      const selectedKey = String(zone.dataset.selectedKey || "");
      const correctKey = String(zone.dataset.correctKey || "");
      const selectedText = String(zone.dataset.selectedValue || "");
      const isCorrect = !!selectedKey && selectedKey === correctKey;
      if (isCorrect) correctCount += 1;
      const item = zone.parentElement ? zone.parentElement.querySelector("span:first-child") : null;
      const correctOption = question.querySelector('[data-match-option][data-match-key="' + correctKey + '"]');
      return { pair_number:index+1, left_text:item ? item.textContent.trim() : "Item " + (index+1), selected_answer:selectedText, correct_answer:correctOption ? correctOption.dataset.value || correctOption.textContent.trim() : "", is_correct:isCorrect };
    });
    return { question_id:question.dataset.questionId || "", question_title:question.dataset.questionTitle || "Question", correct_pairs:correctCount, total_pairs:zones.length, all_correct:zones.length > 0 && correctCount === zones.length, pairs:pairs };
  }

  function getResult(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const results = Array.from(scope.querySelectorAll(".matching-question")).map(questionResult);
    const complete = results.length > 0 && results.every(function (q) { return q.pairs.every(function (pair) { return !!pair.selected_answer; }); });
    const allCorrect = complete && results.every(function (q) { return q.all_correct; });
    return { questions:results, complete:complete, all_correct:allCorrect };
  }

  function setupQuestion(question) {
    if (!question || question.dataset.glipMatchingReady === "true") return;
    question.dataset.glipMatchingReady = "true";

    const options = Array.from(question.querySelectorAll("[data-match-option]"));
    const zones = Array.from(question.querySelectorAll("[data-match-zone]"));
    const checkBtn = question.querySelector(".check-matching-btn");
    const resetBtn = question.querySelector(".reset-matching-btn");
    const feedback = question.querySelector(".matching-feedback");
    const feedbackText = question.querySelector(".matching-feedback-text");
    let selectedKey = "";

    function optionByKey(key) {
      return options.find(function (option) {
        return String(option.dataset.matchKey || "") === String(key || "");
      });
    }

    function clearFeedback() {
      if (feedbackText) feedbackText.textContent = "";
      if (feedback) feedback.classList.add("hidden");
    }

    function selectOption(option) {
      selectedKey = String(option && option.dataset.matchKey || "");
      options.forEach(function (item) {
        item.classList.toggle("selected", item === option);
      });
    }

    function clearDuplicateAssignment(key, exceptZone) {
      zones.forEach(function (zone) {
        if (zone === exceptZone) return;
        if (String(zone.dataset.selectedKey || "") === String(key || "")) {
          clearZone(zone);
        }
      });
    }

    function setZone(zone, key) {
      const option = optionByKey(key);
      if (!zone || !option) return;

      clearDuplicateAssignment(key, zone);
      zone.dataset.selectedKey = key;
      zone.dataset.selectedValue = option.dataset.value || option.textContent.trim();
      zone.textContent = zone.dataset.selectedValue;
      zone.classList.remove("drag-over", "correct", "incorrect", "missing");
      zone.classList.add("filled");
      selectedKey = "";
      options.forEach(function (item) { item.classList.remove("selected"); });
      clearFeedback();
      document.dispatchEvent(new CustomEvent("glipMatchingChanged"));
    }

    function clearZone(zone) {
      if (!zone) return;
      delete zone.dataset.selectedKey;
      delete zone.dataset.selectedValue;
      zone.textContent = "Match";
      zone.classList.remove("drag-over", "filled", "correct", "incorrect", "missing");
    }

    function lock(locked) {
      zones.forEach(function (zone) {
        zone.style.pointerEvents = locked ? "none" : "";
        zone.setAttribute("aria-disabled", locked ? "true" : "false");
      });
      options.forEach(function (option) {
        option.draggable = !locked;
        option.style.pointerEvents = locked ? "none" : "";
        option.style.opacity = locked ? "0.65" : "";
        option.setAttribute("aria-disabled", locked ? "true" : "false");
      });
      if (checkBtn) checkBtn.disabled = locked;
      if (resetBtn) resetBtn.style.display = locked ? "none" : "";
    }

    options.forEach(function (option) {
      option.addEventListener("dragstart", function (event) {
        event.dataTransfer.setData("text/plain", String(option.dataset.matchKey || ""));
      });
      option.addEventListener("click", function () { selectOption(option); });
      option.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectOption(option);
        }
      });
    });

    zones.forEach(function (zone) {
      zone.addEventListener("dragover", function (event) {
        event.preventDefault();
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", function () {
        zone.classList.remove("drag-over");
      });
      zone.addEventListener("drop", function (event) {
        event.preventDefault();
        zone.classList.remove("drag-over");
        setZone(zone, event.dataTransfer.getData("text/plain"));
      });
      zone.addEventListener("click", function () {
        if (selectedKey) setZone(zone, selectedKey);
      });
      zone.addEventListener("keydown", function (event) {
        if ((event.key === "Enter" || event.key === " ") && selectedKey) {
          event.preventDefault();
          setZone(zone, selectedKey);
        }
      });
    });

    function checkAnswers() {
      const missing = zones.filter(function (zone) {
        return !String(zone.dataset.selectedKey || "").trim();
      });
      zones.forEach(function (zone) { zone.classList.remove("missing"); });
      missing.forEach(function (zone) { zone.classList.add("missing"); });

      if (missing.length) {
        if (feedbackText) feedbackText.textContent = "Please complete all matches before checking your answers.";
        if (feedback) feedback.classList.remove("hidden");
        return;
      }

      zones.forEach(function (zone) {
        const correct = String(zone.dataset.selectedKey || "") === String(zone.dataset.correctKey || "");
        zone.classList.toggle("correct", correct);
        zone.classList.toggle("incorrect", !correct);
      });

      const result = questionResult(question);
      if (feedbackText) {
        const summary = result.all_correct
          ? "You matched all " + result.total_pairs + " items correctly."
          : "You matched " + result.correct_pairs + " out of " + result.total_pairs + " items correctly.";
        const explanation = String(question.dataset.formativeFeedback || "").trim();
        feedbackText.textContent = summary + (explanation ? " " + explanation : "");
      }
      if (feedback) feedback.classList.remove("hidden");
      document.dispatchEvent(new CustomEvent("glipMatchingChecked", { detail: { allCorrect: result.all_correct } }));
    }

    function resetAnswers() {
      zones.forEach(clearZone);
      selectedKey = "";
      options.forEach(function (option) {
        option.classList.remove("selected");
        option.style.opacity = "";
      });
      clearFeedback();
      lock(false);
      document.dispatchEvent(new CustomEvent("glipMatchingChanged"));
    }

    if (checkBtn) checkBtn.addEventListener("click", checkAnswers);
    if (resetBtn) resetBtn.addEventListener("click", resetAnswers);
  }

  function setup(root) {
    const scope = root && root.querySelectorAll ? root : document;
    Array.from(scope.querySelectorAll(".matching-question")).forEach(setupQuestion);
  }

  window.GLIPMatching = {
    setup: setup,
    getResult: getResult,
    formatMark: formatMark
  };
})(window);
