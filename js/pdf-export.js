(function (window) {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function setPanelMessage(id, text, type) {
    const el = byId(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "panel-message text-center" + (type ? " " + type : "");
  }

  function getPageHeading() {
    const config = window.PAGE_CONFIG || {};
    return {
      topic: config.topicName ||
        document.getElementById("heroMainTitle")?.textContent?.trim() ||
        config.mainTitle || "Topic",
      activity: config.subTitle ||
        document.getElementById("heroSubTitle")?.textContent?.trim() ||
        "Activity"
    };
  }

  function safeStudentName() {
    return window.GLIPPdf ? window.GLIPPdf.getStudentName() :
      (sessionStorage.getItem("glipStudentName") || "Student");
  }

  function buildLearnerFileName(metadata, activityTitle, fallback) {
    const layout = window.GLIPPdf;
    const heading = getPageHeading();
    metadata = metadata || {};

    let firstName = String(metadata.student_name || "").trim();
    let surname = String(metadata.student_surname || "").trim();

    // Compatibility fallback for older PDF-context responses.
    if ((!firstName || !surname) && metadata.student) {
      const displayParts = String(metadata.student).trim().split(/\s+/).filter(Boolean);
      if (!firstName && displayParts.length) firstName = displayParts[0];
      if (!surname && displayParts.length > 1) surname = displayParts.slice(1).join(" ");
    }

    if (!firstName) firstName = safeStudentName();

    const parts = [
      surname,
      firstName,
      metadata.class_label || window.GLIPPdf?.getClassLabel(),
      activityTitle || heading.activity
    ].filter(Boolean);

    if (layout) {
      return parts.map(function (part) {
        return layout.safeFilePart(part, fallback || "GLIP");
      }).join("_").replace(/\s+/g, "_") + ".pdf";
    }

    return parts.join("_").replace(/[\\/:*?"<>|\s]+/g, "_") + ".pdf";
  }

  async function preparePdfBase(pdf, state) {
    const layout = window.GLIPPdf;
    const metadata = await layout.getActivityMetadata();
    state.y = await layout.addHeader(pdf, {
      title: "GLIP Activity Submission",
      subtitle: "Guided Learning for Independent Progress"
    });
    layout.addMetadataTable(pdf, state, metadata);
    return metadata;
  }

  function quizIsComplete(questions) {
    return (questions || []).every(function (q) {
      return !!document.querySelector('input[name="' + q.id + '"]:checked');
    });
  }

  async function downloadQuizPDF(options) {
    options = options || {};
    const layout = window.GLIPPdf;
    const JsPDF = layout && layout.getJsPDF();
    const questions = window.QUESTIONS || [];
    if (!JsPDF || !questions.length) {
      setPanelMessage(options.messageId || "pdfMessage", "PDF generation is not available. Please refresh the page and try again.", "error");
      return;
    }

    if (!quizIsComplete(questions)) {
      setPanelMessage(options.messageId || "pdfMessage", "Please answer all quiz questions before saving the PDF.", "error");
      return;
    }

    setPanelMessage(options.messageId || "pdfMessage", "Preparing your PDF...", "info");

    const heading = getPageHeading();
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const state = { y: 18 };

    const metadata = await preparePdfBase(pdf, state);
    layout.addWrappedText(pdf, state, "Quiz Result", { fontSize: 13, style: "bold", after: 6 });

    let score = 0;
    let totalMarks = 0;
    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      const selected = document.querySelector('input[name="' + q.id + '"]:checked')?.value || "";
      const selectedOption = (q.options || []).find(function (opt) { return opt.value === selected; }) || {};
      const correctOption = (q.options || []).find(function (opt) { return opt.value === q.correct; }) || {};
      const isCorrect = selected === q.correct;
      const marks = Number(q.marks || 0);
      totalMarks += marks;
      if (isCorrect) score += marks;

      if (state.y > pageHeight - 55) {
        pdf.addPage();
        state.y = 18;
      }

      layout.addWrappedText(pdf, state,
        q.title || "Question " + (index + 1),
        { fontSize: 11, style: "bold", onNewPage: function () { return 18; } });
      layout.addWrappedText(pdf, state, q.text || "", { fontSize: 9.5 });
      layout.addWrappedText(pdf, state,
        "Answer submitted: " + (selectedOption.label || selected),
        { fontSize: 9.5, style: "bold", after: 1.5 });
      layout.addWrappedText(pdf, state,
        "Correct answer: " + (correctOption.label || q.correct),
        { fontSize: 9 });
      layout.addWrappedText(pdf, state,
        "Result: " + (isCorrect ? "Correct" : "Incorrect") + " | Marks: " + (isCorrect ? marks : 0) + " / " + marks,
        { fontSize: 9, after: 6 });
    }

    const percentage = totalMarks ? Math.round((score / totalMarks) * 100) : 0;
    layout.addWrappedText(pdf, state,
      "Score: " + score + " / " + totalMarks + " (" + percentage + "%)",
      { fontSize: 12, style: "bold", bottom: 22, after: 0 });

    layout.addFooter(pdf);
    pdf.save(buildLearnerFileName(metadata, heading.activity, options.fallbackName || "Quiz"));
    setPanelMessage(options.messageId || "pdfMessage", "Your PDF has been saved.", "success");
  }

  function collectFillBlankAnswers() {
    const blanks = Array.from(document.querySelectorAll(".drop-zone"));
    return blanks.map(function (blank) {
      const selected = String(blank.dataset.value || blank.textContent || "").trim();
      const correct = String(blank.dataset.correct || "").trim();
      const fieldset = blank.closest("fieldset");
      const legend = fieldset && fieldset.querySelector("legend");
      const match = String(blank.dataset.blankId || "").match(/blank(\d+)$/i);
      return {
        task: legend ? legend.textContent.trim() : "Task",
        blank: match ? "Blank " + match[1] : (blank.dataset.blankId || "Blank"),
        selected: selected,
        correct: correct,
        complete: !!selected && !/^blank\s*\d*$/i.test(selected),
        isCorrect: selected.toLowerCase() === correct.toLowerCase()
      };
    });
  }

  async function downloadFillBlankPDF(options) {
    options = options || {};
    const layout = window.GLIPPdf;
    const JsPDF = layout && layout.getJsPDF();
    if (!JsPDF) {
      setPanelMessage(options.messageId || "fillBlankPdfMessage", "PDF generation is not available. Please refresh the page and try again.", "error");
      return;
    }

    const answers = collectFillBlankAnswers();
    if (!answers.length || answers.some(function (a) { return !a.complete; })) {
      setPanelMessage(options.messageId || "fillBlankPdfMessage", "Please complete all blanks before saving the PDF.", "error");
      return;
    }

    setPanelMessage(options.messageId || "fillBlankPdfMessage", "Preparing your PDF...", "info");

    const heading = getPageHeading();
    const score = answers.filter(function (a) { return a.isCorrect; }).length;
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const state = { y: 18 };

    const metadata = await preparePdfBase(pdf, state);
    layout.addWrappedText(pdf, state, "Fill in the Blanks Result", { fontSize: 13, style: "bold", after: 6 });

    let currentTask = "";
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      if (state.y > pageHeight - 38) {
        pdf.addPage();
        state.y = 18;
        currentTask = "";
      }

      if (answer.task !== currentTask) {
        currentTask = answer.task;
        layout.addWrappedText(pdf, state, currentTask, { fontSize: 11, style: "bold", after: 4 });
      }

      layout.addWrappedText(pdf, state,
        answer.blank + ": " + answer.selected,
        { x: 18, maxWidth: 172, fontSize: 9.5, style: "bold", after: 1.5 });
      layout.addWrappedText(pdf, state,
        "Correct answer: " + answer.correct + " | " + (answer.isCorrect ? "Correct" : "Incorrect"),
        { x: 18, maxWidth: 172, fontSize: 9, after: 4 });
    }

    layout.addWrappedText(pdf, state,
      "Score: " + score + " / " + answers.length,
      { fontSize: 12, style: "bold", bottom: 22, after: 0 });

    layout.addFooter(pdf);
    pdf.save(buildLearnerFileName(metadata, heading.activity, options.fallbackName || "Fill in the Blanks"));
    setPanelMessage(options.messageId || "fillBlankPdfMessage", "Your PDF has been saved.", "success");
  }

  function bindButton(buttonId, handler) {
    const button = document.getElementById(buttonId);
    if (!button || button.dataset.tonioPdfBound === "true") return;
    button.addEventListener("click", handler);
    button.dataset.tonioPdfBound = "true";
  }

  function initQuizPdfExport(config) {
    const options = Object.assign({ buttonId: "savePdfBtn", fallbackName: "Quiz", messageId: "pdfMessage" }, config || {});
    bindButton(options.buttonId, function () { downloadQuizPDF(options); });
    return { download: function () { downloadQuizPDF(options); } };
  }

  function initFillBlankPdfExport(config) {
    const options = Object.assign({ buttonId: "saveFillBlankPdfBtn", fallbackName: "Fill in the Blanks", messageId: "fillBlankPdfMessage" }, config || {});
    bindButton(options.buttonId, function () { downloadFillBlankPDF(options); });
    return { download: function () { downloadFillBlankPDF(options); } };
  }

  window.TonioPdfExport = {
    initQuizPdfExport: initQuizPdfExport,
    initFillBlankPdfExport: initFillBlankPdfExport,
    downloadQuizPDF: downloadQuizPDF,
    downloadFillBlankPDF: downloadFillBlankPDF
  };
})(window);
