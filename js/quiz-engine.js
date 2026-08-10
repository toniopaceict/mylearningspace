(function (window) {
  "use strict";

  /* =========================================================
     HELPERS
     ========================================================= */
  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* =========================================================
     BUILD OPTIONS
     ========================================================= */
  function buildOptionsHtml(question) {
    return (question.options || [])
      .map(
        (opt) => `
      <label class="option">
        <input
          type="radio"
          name="${escapeHtml(question.id)}"
          value="${escapeHtml(opt.value)}">
        <span data-read="question">Option ${escapeHtml(opt.value)}: ${escapeHtml(opt.label)}</span>
        <span class="symbol" aria-hidden="true"></span>
      </label>
    `,
      )
      .join("");
  }

  /* =========================================================
     BUILD QUESTION IMAGE
     Supports:
     - imageSrc   = image shown in the question
     - imageFull  = optional larger image for lightbox
     - imageAlt   = alt text
     - imageCaption = optional caption under image
     ========================================================= */
  function buildQuestionImageHtml(question) {
    if (!question.imageSrc) return "";

    const fullImage = question.imageFull || question.imageSrc;
    const captionText = question.imageCaption || "Click image to enlarge";

    return `
      <div class="question-image-col">
        <img
          src="${escapeHtml(question.imageSrc)}"
          alt="${escapeHtml(question.imageAlt || "")}"
          class="question-image"
          data-full="${escapeHtml(fullImage)}">
        <div class="question-image-caption">
          ${escapeHtml(captionText)}
        </div>
      </div>
    `;
  }

  /* =========================================================
     BUILD QUESTION LAYOUT
     ========================================================= */
  function buildQuestionLayoutHtml(question, includeButtonClass) {
    const hasImage = !!question.imageSrc;
    const rowClass = hasImage
      ? "question-content-row has-question-image"
      : "question-content-row no-question-image";

    return `
      <p class="q" data-read="question">${escapeHtml(question.text || "")}</p>

      <div class="${rowClass}">
        <div class="question-options-col">
          <div class="quiz-block">
            ${buildOptionsHtml(question)}
          </div>

          <div class="actions ${includeButtonClass || ""}">
            <button
              type="button"
              class="glip-btn"
              data-check="${escapeHtml(question.id)}"
              id="btn-${escapeHtml(question.id)}">
              Submit Answer
            </button>
          </div>
        </div>

        ${buildQuestionImageHtml(question)}
      </div>

      <div class="fb readable-section" id="fb-${escapeHtml(question.id)}" aria-live="polite">
        <span id="fb-text-${escapeHtml(question.id)}" data-read="feedback"></span>
        <button
          type="button"
          class="speak-btn"
          onclick="speakSection(this)"
          data-read-scope="feedback"
          aria-label="Read the feedback aloud">
          🔊
        </button>
      </div>
    `;
  }

  function setFeedback(feedback, className, text) {
    if (!feedback) return;
    feedback.className = `fb readable-section${className ? ` ${className}` : ""}`;
    const textEl = feedback.querySelector('[data-read="feedback"]');
    if (textEl) {
      textEl.textContent = text || "";
    }
  }

  /* =========================================================
     MINI QUIZ
     ========================================================= */
  function initMiniQuiz(config) {
    const container = document.getElementById(config.containerId);
    const form = document.getElementById(config.formId);
    const questions = config.questions || [];

    if (!container || !form || !questions.length) {
      return null;
    }

    function render() {
      container.innerHTML = questions
        .map(
          (question) => `
        <fieldset
          class="mcq readable-section"
          data-qid="${escapeHtml(question.id)}"
          id="fs-${escapeHtml(question.id)}">
          <legend>${escapeHtml(question.title)}</legend>
          <button
            type="button"
            class="speak-btn"
            onclick="speakSection(this)"
            data-read-scope="question"
            aria-label="Read this question and its options aloud">
            🔊
          </button>
          <p class="meta">${escapeHtml(question.meta || "")}</p>
          ${buildQuestionLayoutHtml(question, "")}
        </fieldset>
      `,
        )
        .join("");
    }

    function clearSymbols(fieldset) {
      fieldset.querySelectorAll(".symbol").forEach((symbol) => {
        symbol.textContent = "";
        symbol.className = "symbol";
      });
    }

    function setQuestionLocked(fieldset, locked) {
      fieldset.querySelectorAll('input[type="radio"]').forEach((radio) => {
        radio.disabled = locked;
      });

      const button = fieldset.querySelector(".qbtn");
      if (button) {
        button.disabled = locked;
      }

      fieldset.classList.toggle("locked", locked);
    }

    function showSymbols(fieldset, selected, correct) {
      fieldset.querySelectorAll("label.option").forEach((label) => {
        const input = label.querySelector("input");
        const symbol = label.querySelector(".symbol");

        if (input.value === selected) {
          if (input.value === correct) {
            symbol.textContent = "✓";
            symbol.classList.add("correct", "show");
          } else {
            symbol.textContent = "✗";
            symbol.classList.add("wrong", "show");
          }
        }
      });
    }

    function checkQuestion(questionId) {
      const question = questions.find((item) => item.id === questionId);
      if (!question) return;

      const selectedInput = form.querySelector(
        `input[name="${questionId}"]:checked`,
      );
      const selected = selectedInput ? selectedInput.value : "";

      const fieldset = container.querySelector(
        `fieldset[data-qid="${questionId}"]`,
      );
      const feedback = document.getElementById(`fb-${question.id}`);

      if (!fieldset || !feedback) return;

      clearSymbols(fieldset);

      if (!selected) {
        setFeedback(
          feedback,
          "err",
          "Please choose an answer, then click Submit Answer.",
        );
        return;
      }

      if (selected === question.correct) {
        setFeedback(feedback, "ok", question.fbOk);
      } else {
        setFeedback(
          feedback,
          "err",
          `${question.fbBad} The correct answer is ${question.correct}.`,
        );
      }

      showSymbols(fieldset, selected, question.correct);
      setQuestionLocked(fieldset, true);
    }

    render();

    container.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-check]");
      if (!button) return;
      checkQuestion(button.getAttribute("data-check"));
    });

    return {
      checkQuestion,
    };
  }

  /* =========================================================
     MAIN QUIZ
     ========================================================= */
  function initMainQuiz(config) {
    const form = document.getElementById(config.formId || "quiz");
    const container = document.getElementById(
      config.containerId || "quizContainer",
    );
    const scoreBox = document.getElementById(config.scoreBoxId || "scoreBox");
    const resetBtn = document.getElementById(config.resetBtnId || "resetBtnTop");
    const questions = config.questions || [];

    if (!form || !container || !questions.length) {
      return null;
    }

    const status = Object.fromEntries(
      questions.map((question) => [question.id, null]),
    );

    const totalMarks = questions.reduce(
      (sum, question) => sum + (question.marks || 0),
      0,
    );

    function allAnswered() {
      return Object.values(status).every((value) => value !== null);
    }

    function getScore() {
      return questions.reduce((sum, question) => {
        return sum + (status[question.id] === 1 ? question.marks : 0);
      }, 0);
    }

    function emitState() {
      const score = getScore();
      const percentage =
        totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    
      if (scoreBox) {
        scoreBox.textContent = `Score: ${score} / ${totalMarks}`;
      }
    
      if (typeof config.onStateChange === "function") {
        config.onStateChange({
          allAnswered: allAnswered(),
          score,
          totalMarks,
          percentage,
        });
      }
    }

    function render() {
      container.innerHTML = questions
        .map((question) => {
          const showExtraInfo =
            config.extraInstructionBeforeQuestionId &&
            question.id === config.extraInstructionBeforeQuestionId &&
            config.extraInstructionHtml;

          const markText = `${question.marks} ${
            question.marks === 1 ? "mark" : "marks"
          }`;

          return `
          ${showExtraInfo ? config.extraInstructionHtml : ""}
          <fieldset class="task-box mcq readable-section" id="fs-${escapeHtml(question.id)}">
            <legend>${escapeHtml(question.title)} - ${markText}</legend>
            <button
              type="button"
              class="speak-btn no-print"
              onclick="speakSection(this)"
              data-read-scope="question"
              aria-label="Read this question and its options aloud">
              🔊
            </button>
            ${buildQuestionLayoutHtml(question, "no-print")}
          </fieldset>
        `;
        })
        .join("");

      emitState();
    }

    function setQuestionLocked(questionId, locked) {
      const fieldset = document.getElementById(`fs-${questionId}`);
      const button = document.getElementById(`btn-${questionId}`);
      const radios = form.querySelectorAll(`input[name="${questionId}"]`);

      radios.forEach((radio) => {
        radio.disabled = locked;
      });

      if (button) {
        button.disabled = locked;
      }

      if (fieldset) {
        fieldset.classList.toggle("locked", locked);
      }
    }

    function clearSymbols(questionId) {
      form.querySelectorAll(`input[name="${questionId}"]`).forEach((radio) => {
        const symbol = radio.parentElement.querySelector(".symbol");
        if (!symbol) return;
        symbol.textContent = "";
        symbol.className = "symbol";
      });
    }

    function showSymbol(questionId, selected, correct) {
      form.querySelectorAll(`input[name="${questionId}"]`).forEach((radio) => {
        const symbol = radio.parentElement.querySelector(".symbol");
        if (!symbol) return;

        if (radio.value === selected) {
          if (radio.value === correct) {
            symbol.textContent = "✓";
            symbol.classList.add("correct", "show");
          } else {
            symbol.textContent = "✗";
            symbol.classList.add("wrong", "show");
          }
        }
      });
    }

    function checkQuestion(questionId) {
      const question = questions.find((item) => item.id === questionId);
      if (!question) return;

      const selectedInput = form.querySelector(
        `input[name="${questionId}"]:checked`,
      );
      const selected = selectedInput ? selectedInput.value : "";
      const feedback = document.getElementById(`fb-${questionId}`);

      if (!feedback) return;

      if (!selected) {
        setFeedback(
          feedback,
          "err",
          "Please choose an answer, then click Submit Answer.",
        );
        return;
      }

      clearSymbols(questionId);

      if (selected === question.correct) {
        status[questionId] = 1;
        setFeedback(feedback, "ok", question.fbOk);
      } else {
        status[questionId] = 0;
        setFeedback(
          feedback,
          "err",
          `${question.fbBad} The correct answer is ${question.correct}.`,
        );
      }

      showSymbol(questionId, selected, question.correct);
      setQuestionLocked(questionId, true);
      emitState();
    }

    function resetQuiz() {
      form.reset();

      Object.keys(status).forEach((key) => {
        status[key] = null;
      });

      questions.forEach((question) => {
        const feedback = document.getElementById(`fb-${question.id}`);
        if (feedback) {
          setFeedback(feedback, "", "");
        }
        clearSymbols(question.id);
        setQuestionLocked(question.id, false);
      });

      emitState();

      if (typeof config.onReset === "function") {
        config.onReset();
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }

    render();

    container.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-check]");
      if (!button) return;
      checkQuestion(button.getAttribute("data-check"));
    });

    if (resetBtn && !resetBtn.dataset.tonioQuizBound) {
      resetBtn.addEventListener("click", resetQuiz);
      resetBtn.dataset.tonioQuizBound = "true";
    }

    return {
      allAnswered,
      resetQuiz,
      checkQuestion,
      emitState,
    };
  }

  /* =========================================================
     EXPOSE MODULE
     ========================================================= */
  window.TonioQuiz = {
    initMiniQuiz,
    initMainQuiz,
  };
})(window);
