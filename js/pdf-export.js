(function (window) {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function setPanelMessage(id, text, type) {
    const el = byId(id);
    if (!el) return;
    const value = text || "";
    el.textContent = value;
    el.className = "panel-message text-center" + (type ? " " + type : "") + (value ? "" : " hidden");
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
      firstName,
      surname,
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

    // If the richer server PDF context is unavailable or incomplete,
    // complete the student identity from the login session.
    const sessionFirstName = String(
      sessionStorage.getItem("glipStudentName") || ""
    ).trim();
    const sessionSurname = String(
      sessionStorage.getItem("glipStudentSurname") || ""
    ).trim();
    const sessionFullName = String(
      sessionStorage.getItem("glipStudentFullName") || ""
    ).trim();

    if (!String(metadata.student_name || "").trim() && sessionFirstName) {
      metadata.student_name = sessionFirstName;
    }

    if (!String(metadata.student_surname || "").trim() && sessionSurname) {
      metadata.student_surname = sessionSurname;
    }

    if (!String(metadata.student || "").trim()) {
      metadata.student =
        sessionFullName ||
        [metadata.student_name, metadata.student_surname]
          .filter(Boolean)
          .join(" ")
          .trim();
    }

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
    if (answers.some(function (a) { return !a.isCorrect; })) {
      setPanelMessage(options.messageId || "fillBlankPdfMessage", "Please correct all blanks before saving the PDF.", "error");
      return;
    }

    setPanelMessage(options.messageId || "fillBlankPdfMessage", "Preparing your PDF...", "info");

    const heading = getPageHeading();
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const left = 15;
    const right = 15;
    const state = { y: 18 };

    const metadata = await preparePdfBase(pdf, state);

    function newPage() {
      pdf.addPage();
      state.y = 18;
    }

    function ensureSpace(requiredHeight) {
      if (state.y + requiredHeight > pageHeight - 22) newPage();
    }

    function drawResultSymbol(x, y, width, height) {
      const cx = x + width / 2;
      const cy = y + height / 2;
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(18, 54, 91);
      pdf.line(cx - 1.3, cy, cx - 0.3, cy + 1.0);
      pdf.line(cx - 0.3, cy + 1.0, cx + 1.6, cy - 1.2);
    }

    function drawTableHeader(columnWidths) {
      const headers = ["Blank", "Answer selected", "Result"];
      const headerHeight = 9;
      ensureSpace(headerHeight + 4);
      let x = left;
      headers.forEach(function (header, index) {
        const w = columnWidths[index];
        pdf.setFillColor(238, 244, 249);
        pdf.setDrawColor(204, 216, 228);
        pdf.setTextColor(18, 54, 91);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.rect(x, state.y, w, headerHeight, "FD");
        if (index === 2) pdf.text(header, x + w / 2, state.y + 5.8, { align: "center" });
        else pdf.text(header, x + 2.2, state.y + 5.8);
        x += w;
      });
      state.y += headerHeight;
    }

    function drawAnswerRow(answer, columnWidths) {
      const blankLines = pdf.splitTextToSize(String(answer.blank || ""), columnWidths[0] - 4.4);
      const answerLines = pdf.splitTextToSize(String(answer.selected || ""), columnWidths[1] - 4.4);
      const rowHeight = Math.max(10, 4.2 + Math.max(blankLines.length, answerLines.length) * 4.2);
      if (state.y + rowHeight > pageHeight - 22) {
        newPage();
        drawTableHeader(columnWidths);
      }
      let x = left;
      pdf.setDrawColor(204, 216, 228);
      pdf.setLineWidth(0.25);
      columnWidths.forEach(function (w) {
        pdf.rect(x, state.y, w, rowHeight);
        x += w;
      });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.2);
      pdf.setTextColor(18, 54, 91);
      pdf.text(blankLines, left + 2.2, state.y + 5.3);
      pdf.text(answerLines, left + columnWidths[0] + 2.2, state.y + 5.3);
      drawResultSymbol(left + columnWidths[0] + columnWidths[1], state.y, columnWidths[2], rowHeight);
      state.y += rowHeight;
    }

    ensureSpace(14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(18, 54, 91);
    pdf.text("Fill in the Blanks Result", left, state.y);
    pdf.setFontSize(11);
    pdf.text("Completed", pageWidth - right, state.y, { align: "right" });
    state.y += 3.2;
    pdf.setDrawColor(18, 54, 91);
    pdf.setLineWidth(0.35);
    pdf.line(left, state.y, pageWidth - right, state.y);
    state.y += 10.5;

    const columnWidths = [45, 113, 22];
    const taskGroups = [];
    answers.forEach(function (answer) {
      let group = taskGroups.find(function (item) { return item.task === answer.task; });
      if (!group) {
        group = { task: answer.task, answers: [] };
        taskGroups.push(group);
      }
      group.answers.push(answer);
    });

    taskGroups.forEach(function (group, index) {
      if (index > 0) state.y += 10;
      ensureSpace(22);
      layout.addWrappedText(pdf, state, group.task || "Task", {
        fontSize: 11,
        style: "bold",
        maxWidth: pageWidth - left - right,
        after: 0
      });
      state.y = Math.max(18, state.y - 2);
      drawTableHeader(columnWidths);
      group.answers.forEach(function (answer) {
        drawAnswerRow(answer, columnWidths);
      });
    });

    layout.addFooter(pdf);
    const fillBlankFileName = buildLearnerFileName(
      metadata,
      heading.activity,
      options.fallbackName || "Fill in the Blanks"
    ).replace(/\.pdf$/i, "_v1.pdf");
    pdf.save(fillBlankFileName);
    setPanelMessage(options.messageId || "fillBlankPdfMessage", "Your PDF has been saved.", "success");
  }

  function collectMatchingResult() {
    if (!window.GLIPMatching || typeof window.GLIPMatching.getResult !== "function") {
      return { questions: [], score: 0, total_marks: 0, complete: false };
    }
    return window.GLIPMatching.getResult(document);
  }

  async function downloadMatchingPDF(options) {
    options = options || {};
    const layout = window.GLIPPdf;
    const JsPDF = layout && layout.getJsPDF();
    if (!JsPDF) {
      setPanelMessage(options.messageId || "matchingPdfMessage", "PDF generation is not available. Please refresh the page and try again.", "error");
      return;
    }

    const result = collectMatchingResult();
    if (!result.questions.length || !result.complete) {
      setPanelMessage(options.messageId || "matchingPdfMessage", "Please complete all matches before saving the PDF.", "error");
      return;
    }
    if (!result.all_correct) {
      setPanelMessage(options.messageId || "matchingPdfMessage", "Please correct all matches before saving the PDF.", "error");
      return;
    }

    setPanelMessage(options.messageId || "matchingPdfMessage", "Preparing your PDF...", "info");

    const heading = getPageHeading();
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const left = 15;
    const right = 15;
    const usableWidth = pageWidth - left - right;
    const state = { y: 18 };
    const metadata = await preparePdfBase(pdf, state);

    function newPage() {
      pdf.addPage();
      state.y = 18;
    }

    function ensureSpace(requiredHeight) {
      if (state.y + requiredHeight > pageHeight - 22) {
        newPage();
      }
    }

    function normalTextLines(value, width, size) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(size || 9.2);
      return pdf.splitTextToSize(String(value == null ? "" : value), width);
    }

    function drawResultSymbol(isCorrect, x, y, width, height) {
      const cx = x + width / 2;
      const cy = y + height / 2;
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(18, 54, 91);

      if (isCorrect) {
        pdf.line(cx - 1.3, cy, cx - 0.3, cy + 1.0);
        pdf.line(cx - 0.3, cy + 1.0, cx + 1.6, cy - 1.2);
      } else {
        pdf.line(cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.2);
        pdf.line(cx + 1.2, cy - 1.2, cx - 1.2, cy + 1.2);
      }
    }

    function drawTableHeader(columnWidths) {
      const headers = ["Item", "Match selected", "Result"];
      const headerHeight = 9;
      ensureSpace(headerHeight + 4);

      let x = left;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(18, 54, 91);
      pdf.setFillColor(238, 244, 249);
      pdf.setDrawColor(204, 216, 228);
      pdf.setLineWidth(0.25);

      headers.forEach(function (header, index) {
        const w = columnWidths[index];
        // Reapply the same header styling for every cell.
        pdf.setFillColor(238, 244, 249);
        pdf.setDrawColor(204, 216, 228);
        pdf.setTextColor(18, 54, 91);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.rect(x, state.y, w, headerHeight, "FD");
        if (index === 2) {
          pdf.text(header, x + w / 2, state.y + 5.8, { align: "center" });
        } else {
          pdf.text(header, x + 2.2, state.y + 5.8);
        }
        x += w;
      });

      state.y += headerHeight;
    }

    function drawMatchingRow(pair, columnWidths) {
      const itemWidth = columnWidths[0] - 4.4;
      const selectedWidth = columnWidths[1] - 4.4;
      const itemLines = normalTextLines(pair.left_text, itemWidth, 9.2);
      const selectedLines = normalTextLines(pair.selected_answer, selectedWidth, 9.2);
      const correctLines = pair.is_correct
        ? []
        : normalTextLines("Correct match: " + pair.correct_answer, selectedWidth, 8.5);

      const lineHeight = 4.2;
      const selectedCount = selectedLines.length + correctLines.length;
      const rowHeight = Math.max(
        10,
        4.2 + Math.max(itemLines.length, selectedCount) * lineHeight
      );

      if (state.y + rowHeight > pageHeight - 22) {
        newPage();
        drawTableHeader(columnWidths);
      }

      let x = left;
      pdf.setDrawColor(204, 216, 228);
      pdf.setLineWidth(0.25);
      columnWidths.forEach(function (w) {
        pdf.rect(x, state.y, w, rowHeight);
        x += w;
      });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.2);
      pdf.setTextColor(18, 54, 91);
      pdf.text(itemLines, left + 2.2, state.y + 5.3);
      pdf.text(selectedLines, left + columnWidths[0] + 2.2, state.y + 5.3);

      if (!pair.is_correct && correctLines.length) {
        pdf.setFontSize(8.5);
        pdf.text(
          correctLines,
          left + columnWidths[0] + 2.2,
          state.y + 5.3 + selectedLines.length * lineHeight
        );
      }

      drawResultSymbol(
        !!pair.is_correct,
        left + columnWidths[0] + columnWidths[1],
        state.y,
        columnWidths[2],
        rowHeight
      );

      state.y += rowHeight;
    }

    // Main result heading and score share one line, followed by a divider.
    ensureSpace(14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(18, 54, 91);
    pdf.text("Matching Result", left, state.y);
    pdf.setFontSize(11);
    pdf.text("Completed", pageWidth - right, state.y, { align: "right" });
    state.y += 3.2;
    pdf.setDrawColor(18, 54, 91);
    pdf.setLineWidth(0.35);
    pdf.line(left, state.y, pageWidth - right, state.y);
    // Leave a clear visual gap between the result heading and Question 1.
    state.y += 10.5;

    const columnWidths = [50, 108, 22];

    result.questions.forEach(function (question, questionIndex) {
      const questionHeading = question.question_title + " – All " + question.total_pairs + " matches correct";

      // Give each new question breathing room from the previous table,
      // while keeping its own heading close to its table.
      if (questionIndex > 0) state.y += 10;
      ensureSpace(22);
      layout.addWrappedText(pdf, state, questionHeading, {
        fontSize: 11,
        style: "bold",
        maxWidth: usableWidth,
        after: 0
      });

      // Keep the question title visually attached to its own table.
      state.y = Math.max(18, state.y - 2);

      drawTableHeader(columnWidths);
      question.pairs.forEach(function (pair) {
        drawMatchingRow(pair, columnWidths);
      });
    });

    layout.addFooter(pdf);
    const matchingFileName = buildLearnerFileName(
      metadata,
      heading.activity,
      options.fallbackName || "Matching"
    ).replace(/\.pdf$/i, "_v1.pdf");
    pdf.save(matchingFileName);
    setPanelMessage(options.messageId || "matchingPdfMessage", "Your PDF has been saved.", "success");
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

  function initMatchingPdfExport(config) {
    const options = Object.assign({ buttonId: "saveMatchingPdfBtn", fallbackName: "Matching", messageId: "matchingPdfMessage" }, config || {});
    bindButton(options.buttonId, function () { downloadMatchingPDF(options); });
    return { download: function () { downloadMatchingPDF(options); } };
  }

  window.TonioPdfExport = {
    initQuizPdfExport: initQuizPdfExport,
    initFillBlankPdfExport: initFillBlankPdfExport,
    initMatchingPdfExport: initMatchingPdfExport,
    downloadQuizPDF: downloadQuizPDF,
    downloadFillBlankPDF: downloadFillBlankPDF,
    downloadMatchingPDF: downloadMatchingPDF
  };
})(window);
