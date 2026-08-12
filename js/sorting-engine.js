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

    return {
      question_id: question.dataset.questionId || "",
      question_title: question.dataset.questionTitle || "Question",
      correct_items: correctCount,
      total_items: items.length,
      all_correct: items.length > 0 && correctCount === items.length,
      items: orderedItems
    };
  }

  function getResult(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const questions = Array.from(scope.querySelectorAll(".sorting-question")).map(questionResult);
    const complete = questions.length > 0 && questions.every(function (question) { return question.items.length > 0; });
    const allCorrect = complete && questions.every(function (question) { return question.all_correct; });
    return { questions: questions, complete: complete, all_correct: allCorrect };
  }

  function setupQuestion(question) {
    if (!question || question.dataset.glipSortingReady === "true") return;
    question.dataset.glipSortingReady = "true";

    const list = question.querySelector("[data-sorting-list]");
    const checkBtn = question.querySelector(".check-sorting-btn");
    const resetBtn = question.querySelector(".reset-sorting-btn");
    const feedback = question.querySelector(".sorting-feedback");
    const feedbackText = question.querySelector(".sorting-feedback-text");
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
        const position = item.querySelector(".sorting-position");
        const text = String(item.querySelector(".sorting-item-text")?.textContent || "").trim();
        if (position) position.textContent = (index + 1) + ".";
        item.setAttribute("aria-label", "Position " + (index + 1) + ": " + text);
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

    function checkAnswers() {
      clearMarks();
      const result = questionResult(question);
      currentItems().forEach(function (item, index) {
        const isCorrect = index + 1 === Number(item.dataset.correctPosition || 0);
        item.classList.add(isCorrect ? "correct" : "incorrect");
        const symbol = item.querySelector(".sorting-result-symbol");
        if (symbol) symbol.textContent = isCorrect ? "✓" : "✗";
      });

      const feedbackCopy = String(question.dataset.formativeFeedback || "").trim();
      const lead = result.all_correct
        ? "You placed all " + result.total_items + " items in the correct order."
        : "You placed " + result.correct_items + " out of " + result.total_items + " items in the correct position.";
      if (feedbackText) feedbackText.textContent = lead + (feedbackCopy ? " " + feedbackCopy : "");
      setFeedbackState(result.all_correct ? "ok" : "err");
      document.dispatchEvent(new CustomEvent("glipSortingChecked", { detail: result }));
    }

    function reset() {
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
