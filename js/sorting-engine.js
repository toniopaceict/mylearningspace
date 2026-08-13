(function (window) {
  "use strict";

  function itemsFor(question) {
    const list = question.querySelector("[data-sorting-list]");
    return list ? Array.from(list.querySelectorAll("[data-sort-item]")) : [];
  }

  function questionResult(question) {
    const items = itemsFor(question);
    let correctCount = 0;
    const orderedItems = items.map(function (item, index) {
      const currentPosition = index + 1;
      const correctPosition = Number(item.dataset.correctPosition || 0);
      const isCorrect = currentPosition === correctPosition;
      if (isCorrect) correctCount += 1;
      return {
        item_number: correctPosition,
        item_text: String(item.querySelector(".sorting-item-text")?.textContent || "").trim(),
        selected_position: currentPosition,
        correct_position: correctPosition,
        is_correct: isCorrect
      };
    });

    const allCorrect = items.length > 0 && correctCount === items.length;
    const masteryConfirmed = allCorrect && question.dataset.masteryConfirmed === "true";

    return {
      question_id: question.dataset.questionId || "",
      question_title: question.dataset.questionTitle || "Question",
      correct_items: correctCount,
      total_items: items.length,
      all_correct: allCorrect,
      mastery_confirmed: masteryConfirmed,
      items: orderedItems
    };
  }

  function getResult(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const questions = Array.from(scope.querySelectorAll(".sorting-question")).map(questionResult);
    const complete = questions.length > 0 && questions.every(function (question) { return question.items.length > 0; });
    const allCorrect = complete && questions.every(function (question) { return question.all_correct; });
    const masteryConfirmed = allCorrect && questions.every(function (question) { return question.mastery_confirmed; });
    return {
      questions: questions,
      complete: complete,
      all_correct: allCorrect,
      mastery_confirmed: masteryConfirmed
    };
  }

  function setupQuestion(question) {
    if (!question || question.dataset.glipSortingReady === "true") return;
    question.dataset.glipSortingReady = "true";

    const list = question.querySelector("[data-sorting-list]");
    const checkBtn = question.querySelector(".check-sorting-btn");
    const resetBtn = question.querySelector(".reset-sorting-btn");
    const feedback = question.querySelector(".sorting-feedback");
    const feedbackText = question.querySelector(".sorting-feedback-text");
    const attemptCounter = question.querySelector(".sorting-attempt-counter");
    const attemptAim = Math.max(1, Number(question.dataset.attemptAim || 3) || 3);
    let attemptCount = 0;
    if (!list) return;

    const initialOrder = Array.from(list.querySelectorAll("[data-sort-item]")).map(function (item) {
      return item.dataset.sortKey || "";
    });
    let draggedItem = null;

    function currentItems() { return Array.from(list.querySelectorAll("[data-sort-item]")); }

    function setFeedbackState(type) {
      if (!feedback) return;
      feedback.classList.remove("hidden", "ok", "err");
      if (type === "ok" || type === "err") feedback.classList.add(type);
      else feedback.classList.add("hidden");
    }

    function clearFeedback() {
      if (feedbackText) feedbackText.textContent = "";
      setFeedbackState("");
    }

    function updatePositions() {
      const items = currentItems();
      items.forEach(function (item, index) {
        const text = String(item.querySelector(".sorting-item-text")?.textContent || "").trim();
        item.setAttribute("aria-label", "Sortable item: " + text);
        const up = item.querySelector(".sorting-move-up");
        const down = item.querySelector(".sorting-move-down");
        if (up) up.disabled = index === 0;
        if (down) down.disabled = index === items.length - 1;
      });
    }

    function clearMarks() {
      currentItems().forEach(function (item) {
        item.classList.remove("correct", "incorrect");
        const symbol = item.querySelector(".sorting-result-symbol");
        if (symbol) symbol.textContent = "";
      });
    }

    function changed() {
      question.dataset.masteryConfirmed = "false";
      clearMarks();
      clearFeedback();
      updatePositions();
      document.dispatchEvent(new CustomEvent("glipSortingChanged", { detail: questionResult(question) }));
    }

    function moveItem(item, direction) {
      if (!item) return;
      if (direction < 0 && item.previousElementSibling) {
        list.insertBefore(item, item.previousElementSibling);
        changed();
        item.focus();
      } else if (direction > 0 && item.nextElementSibling) {
        list.insertBefore(item.nextElementSibling, item);
        changed();
        item.focus();
      }
    }

    function updateAttemptCounter() {
      if (attemptCounter) {
        attemptCounter.textContent = "Attempts: " + attemptCount + " — Aim: " + attemptAim + " or fewer";
      }
    }

    function checkAnswers() {
      attemptCount += 1;
      updateAttemptCounter();
      clearMarks();
      const result = questionResult(question);
      const feedbackCopy = String(question.dataset.formativeFeedback || "").trim();

      if (result.all_correct) {
        question.dataset.masteryConfirmed = "true";
        currentItems().forEach(function (item) {
          item.classList.add("correct");
          const symbol = item.querySelector(".sorting-result-symbol");
          if (symbol) symbol.textContent = "✓";
        });
        if (feedbackText) {
          feedbackText.textContent =
            "Correct. All items are in the correct order." +
            (feedbackCopy ? " " + feedbackCopy : "");
        }
        setFeedbackState("ok");
      } else {
        question.dataset.masteryConfirmed = "false";
        if (feedbackText) {
          feedbackText.textContent =
            "The sequence is not yet correct." +
            (feedbackCopy ? " " + feedbackCopy : "");
        }
        setFeedbackState("err");
      }

      document.dispatchEvent(new CustomEvent("glipSortingChecked", {
        detail: questionResult(question)
      }));
    }

    function reset() {
      attemptCount = 0;
      updateAttemptCounter();
      const byKey = {};
      currentItems().forEach(function (item) { byKey[item.dataset.sortKey || ""] = item; });
      initialOrder.forEach(function (key) {
        if (byKey[key]) list.appendChild(byKey[key]);
      });
      changed();
    }

    list.addEventListener("click", function (event) {
      const button = event.target.closest(".sorting-move-btn");
      if (!button) return;
      const item = button.closest("[data-sort-item]");
      moveItem(item, button.classList.contains("sorting-move-up") ? -1 : 1);
    });

    list.addEventListener("keydown", function (event) {
      const item = event.target.closest && event.target.closest("[data-sort-item]");
      if (!item || event.target.closest("button")) return;
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        moveItem(item, -1);
      } else if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        moveItem(item, 1);
      }
    });

    list.addEventListener("dragstart", function (event) {
      const item = event.target.closest && event.target.closest("[data-sort-item]");
      if (!item) return;
      draggedItem = item;
      item.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.dataset.sortKey || "sorting-item");
      }
    });

    list.addEventListener("dragover", function (event) {
      if (!draggedItem) return;
      event.preventDefault();
      const target = event.target.closest && event.target.closest("[data-sort-item]");
      if (!target || target === draggedItem) return;
      const rect = target.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      if (after) list.insertBefore(draggedItem, target.nextElementSibling);
      else list.insertBefore(draggedItem, target);
      updatePositions();
    });

    list.addEventListener("drop", function (event) {
      if (!draggedItem) return;
      event.preventDefault();
      draggedItem.classList.remove("dragging");
      draggedItem = null;
      changed();
    });

    list.addEventListener("dragend", function () {
      if (draggedItem) draggedItem.classList.remove("dragging");
      draggedItem = null;
      changed();
    });

    updateAttemptCounter();

    if (checkBtn) checkBtn.addEventListener("click", checkAnswers);
    if (resetBtn) resetBtn.addEventListener("click", reset);
    updatePositions();
  }

  function setup(root) {
    const scope = root && root.querySelectorAll ? root : document;
    Array.from(scope.querySelectorAll(".sorting-question")).forEach(setupQuestion);
  }

  window.GLIPSorting = {
    setup: setup,
    getResult: getResult
  };
})(window);
