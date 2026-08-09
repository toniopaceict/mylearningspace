(function () {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

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

  function draftKey() {
    const student = getStudentDetails();
    const config = getConfig();
    if (!student.student_id || !config.activityId) return "";
    return "glipFreeTextDraft_" + student.student_id + "_" + config.activityId;
  }

  function editorText(editor) {
    if (!editor) return "";
    return String(editor.innerText || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function cleanEditorHtml(editor) {
    if (!editor) return "";
    const clone = editor.cloneNode(true);

    Array.from(clone.querySelectorAll("*")) .forEach(function (node) {
      const tag = node.tagName.toLowerCase();
      const allowed = ["b", "strong", "i", "em", "u", "br", "div", "p"];
      if (allowed.indexOf(tag) === -1) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }
      Array.from(node.attributes || []).forEach(function (attr) {
        node.removeAttribute(attr.name);
      });
    });

    return clone.innerHTML.trim();
  }

  function questionElements() {
    return Array.from(document.querySelectorAll(".free-text-question"));
  }

  function questionId(question, index) {
    return text(question.dataset.questionId) || "question_" + (index + 1);
  }

  function questionText(question, index) {
    const prompt = question.querySelector(".free-text-prompt");
    return text(prompt ? prompt.textContent : "") || "Question " + (index + 1);
  }

  function recommendedLength(question) {
    const value = Number(question.dataset.recommendedLength || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  function getEditor(question) {
    return question.querySelector(".free-text-editor");
  }

  function updateCounter(question) {
    const editor = getEditor(question);
    const counter = question.querySelector(".free-text-character-count");
    if (!editor || !counter) return;

    const count = editorText(editor).length;
    const recommended = recommendedLength(question);
    counter.textContent = recommended
      ? count + " / " + recommended + " characters"
      : count + " characters";

    const exceeded = recommended > 0 && count > recommended;
    counter.classList.toggle("over-limit", exceeded);
    counter.setAttribute("aria-label", exceeded
      ? "Recommended length exceeded. " + count + " of " + recommended + " characters."
      : counter.textContent);
  }

  function collectAnswers() {
    return questionElements().map(function (question, index) {
      const editor = getEditor(question);
      return {
        question_id: questionId(question, index),
        question_title: "Question " + (index + 1),
        question_text: questionText(question, index),
        recommended_length: recommendedLength(question),
        answer_text: editorText(editor),
        answer_html: cleanEditorHtml(editor)
      };
    });
  }

  function allQuestionsAnswered(answers) {
    return answers.length > 0 && answers.every(function (answer) {
      return text(answer.answer_text) !== "";
    });
  }

  function saveDraft() {
    const key = draftKey();
    if (!key) return;

    try {
      sessionStorage.setItem(key, JSON.stringify({
        saved_at: Date.now(),
        answers: collectAnswers().map(function (answer) {
          return {
            question_id: answer.question_id,
            answer_html: answer.answer_html
          };
        })
      }));
    } catch (_error) {
      // Draft saving is a convenience. A storage failure must not block typing.
    }
  }

  function restoreDraft() {
    const key = draftKey();
    if (!key) return false;

    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (!saved || !Array.isArray(saved.answers)) return false;

      let restored = false;
      questionElements().forEach(function (question, index) {
        const editor = getEditor(question);
        if (!editor) return;
        const id = questionId(question, index);
        const item = saved.answers.find(function (answer) {
          return text(answer.question_id) === id;
        });
        if (item && item.answer_html) {
          editor.innerHTML = item.answer_html;
          restored = true;
        }
        updateCounter(question);
      });

      return restored;
    } catch (_error) {
      return false;
    }
  }

  function clearDraft() {
    const key = draftKey();
    if (!key) return;
    try { sessionStorage.removeItem(key); } catch (_error) {}
  }

  function setMessage(id, message, type) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message || "";
    element.className = "panel-message text-center" + (type ? " " + type : "");
  }

  function formatAnswer(question, command) {
    const editor = getEditor(question);
    if (!editor) return;
    editor.focus();
    try {
      document.execCommand(command, false, null);
    } catch (_error) {}
    saveDraft();
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function readAnswer(question) {
    const editor = getEditor(question);
    const answer = editorText(editor);
    const status = question.querySelector(".free-text-speech-status");

    if (!answer) {
      if (status) status.textContent = "There is no answer to read yet.";
      return;
    }
    if (!("speechSynthesis" in window)) {
      if (status) status.textContent = "Read aloud is not available in this browser.";
      return;
    }

    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(answer);
    const requestedLanguage = text(question.dataset.speechLang);
    if (requestedLanguage) utterance.lang = requestedLanguage;
    utterance.onstart = function () {
      if (status) status.textContent = "Reading your answer...";
    };
    utterance.onend = function () {
      if (status) status.textContent = "";
    };
    utterance.onerror = function () {
      if (status) status.textContent = "Your answer could not be read aloud.";
    };
    window.speechSynthesis.speak(utterance);
  }

  function bindQuestion(question) {
    if (question.dataset.freeTextReady === "true") return;
    question.dataset.freeTextReady = "true";

    const editor = getEditor(question);
    if (!editor) return;

    editor.addEventListener("input", function () {
      updateCounter(question);
      saveDraft();
    });

    editor.addEventListener("paste", function (event) {
      // Paste plain text only. This keeps the editor limited to the three
      // formatting choices offered by GLIP while preserving Unicode text.
      event.preventDefault();
      const pasted = (event.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, pasted);
    });

    question.querySelectorAll("[data-format-command]").forEach(function (button) {
      button.addEventListener("mousedown", function (event) {
        // Keep the text selection active when the toolbar button is clicked.
        event.preventDefault();
      });
      button.addEventListener("click", function () {
        formatAnswer(question, button.dataset.formatCommand);
      });
    });

    const readButton = question.querySelector(".free-text-read-btn");
    if (readButton) readButton.addEventListener("click", function () { readAnswer(question); });

    const stopButton = question.querySelector(".free-text-stop-btn");
    if (stopButton) stopButton.addEventListener("click", function () {
      stopSpeech();
      const status = question.querySelector(".free-text-speech-status");
      if (status) status.textContent = "";
    });

    updateCounter(question);
  }

  function buildPdfContent() {
    const container = document.createElement("div");
    container.className = "free-text-pdf-document";

    const student = getStudentDetails();
    const subject = text(document.getElementById("heroTopline")?.textContent);
    const topic = text(document.getElementById("heroMainTitle")?.textContent);
    const activity = text(document.getElementById("heroSubTitle")?.textContent) || "Free Text";

    const heading = document.createElement("h1");
    heading.textContent = "GLIP - " + activity;
    container.appendChild(heading);

    const meta = document.createElement("div");
    meta.className = "free-text-pdf-meta";
    meta.innerHTML =
      "<p><strong>Student:</strong> " + escapeHtml(student.student_name) + "</p>" +
      "<p><strong>Subject:</strong> " + escapeHtml(subject) + "</p>" +
      "<p><strong>Topic:</strong> " + escapeHtml(topic) + "</p>";
    container.appendChild(meta);

    collectAnswers().forEach(function (answer, index) {
      const block = document.createElement("section");
      block.className = "free-text-pdf-answer";
      block.innerHTML =
        "<h2>Question " + (index + 1) + "</h2>" +
        "<p class=\"free-text-pdf-question\">" + escapeHtml(answer.question_text) + "</p>" +
        "<div class=\"free-text-pdf-response\">" + (answer.answer_html || "<em>No response</em>") + "</div>" +
        "<p class=\"free-text-pdf-count\">Characters: " + answer.answer_text.length +
        (answer.recommended_length ? " / recommended " + answer.recommended_length : "") + "</p>";
      container.appendChild(block);
    });

    return container;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeFileName(value) {
    return text(value || "Free Text")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_") || "Free_Text";
  }

  function saveAsPdf() {
    const answers = collectAnswers();
    if (!allQuestionsAnswered(answers)) {
      setMessage("freeTextPdfMessage", "Please answer all questions before saving the PDF.", "error");
      return;
    }
    if (typeof window.html2pdf !== "function") {
      setMessage("freeTextPdfMessage", "PDF generation is not available. Please refresh the page and try again.", "error");
      return;
    }

    setMessage("freeTextPdfMessage", "Preparing your PDF...", "info");
    const activity = text(document.getElementById("heroSubTitle")?.textContent) || "Free Text";
    const student = getStudentDetails();
    const filename = safeFileName(student.student_name) + "_" + safeFileName(activity) + ".pdf";

    // html2canvas needs the source element to be attached to the document.
    // Keep it far off-screen so students never see the temporary PDF layout.
    const pdfSource = buildPdfContent();
    pdfSource.style.position = "fixed";
    pdfSource.style.left = "-10000px";
    pdfSource.style.top = "0";
    pdfSource.style.width = "190mm";
    pdfSource.style.background = "#fff";
    pdfSource.style.padding = "8mm";
    pdfSource.setAttribute("aria-hidden", "true");
    document.body.appendChild(pdfSource);

    window.html2pdf()
      .set({
        margin: 10,
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      })
      .from(pdfSource)
      .save()
      .then(function () {
        setMessage("freeTextPdfMessage", "Your PDF has been saved.", "success");
      })
      .catch(function () {
        setMessage("freeTextPdfMessage", "Your PDF could not be created.", "error");
      })
      .finally(function () {
        if (pdfSource.parentNode) pdfSource.parentNode.removeChild(pdfSource);
      });
  }

  function setSubmitting(isSubmitting) {
    const button = document.getElementById("submitFreeTextBtn");
    const progress = document.getElementById("freeTextSubmitProgress");
    if (button) {
      button.disabled = isSubmitting;
      button.textContent = isSubmitting ? "Submitting..." : "Submit and Mark as Complete";
    }
    if (progress) progress.classList.toggle("show", isSubmitting);
  }

  function submitAnswers() {
    const config = getConfig();
    const student = getStudentDetails();
    const answers = collectAnswers();

    if (!student.student_id) {
      setMessage("freeTextSubmitMessage", "Student not logged in.", "error");
      return;
    }
    if (!allQuestionsAnswered(answers)) {
      setMessage("freeTextSubmitMessage", "Please answer all questions before submitting.", "error");
      return;
    }

    setSubmitting(true);
    setMessage("freeTextSubmitMessage", "Submitting your answers and marking the activity as complete...", "info");

    fetch(config.webAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "saveFreeTextResultAndProgress",
        student_id: student.student_id,
        student_name: student.student_name,
        class_id: student.class_id,
        level: config.level,
        subject_id: config.subjectId,
        topic_id: config.topicId,
        topic_name: config.topicName,
        activity_id: config.activityId,
        activity_title: config.subTitle || "Free Text",
        answers_json: JSON.stringify(answers)
      })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (data.status !== "success") {
          throw new Error(data.message || "Could not submit your answers.");
        }

        clearDraft();
        setMessage(
          "freeTextSubmitMessage",
          data.message || "Your answers have been submitted and the activity has been marked as complete.",
          "success"
        );

        if (window.GLIPProgressEngine && typeof window.GLIPProgressEngine.updateProgress === "function") {
          window.GLIPProgressEngine.updateProgress({
            subject_id: config.subjectId,
            level: config.level,
            topic_id: config.topicId,
            activity_id: config.activityId,
            status: "completed"
          });
        } else if (window.GLIPLearningSession) {
          window.GLIPLearningSession.updateProgress({
            subject_id: config.subjectId,
            level: config.level,
            topic_id: config.topicId,
            activity_id: config.activityId,
            status: "completed"
          });
        }

        window.dispatchEvent(new CustomEvent("glipProgressSaved", {
          detail: {
            subjectId: config.subjectId,
            level: config.level,
            topicId: config.topicId,
            activityId: config.activityId,
            status: "completed"
          }
        }));
      })
      .catch(function (error) {
        setMessage("freeTextSubmitMessage", error.message || "Could not contact the server.", "error");
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function initialise() {
    questionElements().forEach(bindQuestion);

    const restored = restoreDraft();
    if (restored) {
      setMessage("freeTextDraftMessage", "Your previous draft in this browser has been restored.", "info");
    }

    const pdfButton = document.getElementById("saveFreeTextPdfBtn");
    if (pdfButton && pdfButton.dataset.freeTextPdfReady !== "true") {
      pdfButton.dataset.freeTextPdfReady = "true";
      pdfButton.addEventListener("click", saveAsPdf);
    }

    const submitButton = document.getElementById("submitFreeTextBtn");
    if (submitButton && submitButton.dataset.freeTextSubmitReady !== "true") {
      submitButton.dataset.freeTextSubmitReady = "true";
      submitButton.addEventListener("click", submitAnswers);
    }

    window.addEventListener("pagehide", saveDraft);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }

  document.addEventListener("glipReady", initialise);
})();
