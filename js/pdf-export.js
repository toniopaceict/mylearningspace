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

  function cleanScoreText(text) {
    return String(text || "").replace(/\s*\(\d+%\)\s*/g, "").trim();
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

  function buildLearnerFileName(activityTitle, fallback) {
    const layout = window.GLIPPdf;
    const heading = getPageHeading();
    const parts = [heading.topic, activityTitle || heading.activity, safeStudentName()];
    if (layout) {
      return parts.map(function (part) {
        return layout.safeFilePart(part, fallback || "GLIP");
      }).join(" - ") + ".pdf";
    }
    return parts.join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  }

  function downloadSimplePDF(options) {
    options = options || {};
    const source = document.querySelector(options.sourceSelector || ".wrap");
    if (!source || !window.html2pdf) return;

    const config = window.PAGE_CONFIG || {};
    const heading = getPageHeading();
    const pdfTitle = config.pdfTitle || heading.topic || options.fallbackName || "GLIP";
    const pdfSubTitle = config.pdfSubTitle || heading.activity || "";
    const footerTitle = [pdfTitle, pdfSubTitle].filter(Boolean).join(" - ");
    const fileName = buildLearnerFileName(pdfSubTitle, options.fallbackName || "Page");

    const pdfWrapper = document.createElement("div");
    pdfWrapper.style.padding = "0";
    pdfWrapper.style.margin = "0";
    pdfWrapper.style.background = "#ffffff";
    pdfWrapper.style.color = "#0b3c6f";
    pdfWrapper.style.fontFamily = "system-ui, Segoe UI, Roboto, Arial, sans-serif";
    pdfWrapper.style.fontSize = "10.5px";
    pdfWrapper.style.lineHeight = "1.35";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "12px";
    header.style.marginBottom = "14px";
    header.style.paddingBottom = "8px";
    header.style.borderBottom = "1px solid rgba(11, 60, 111, 0.18)";

    const logo = document.createElement("img");
    logo.src = window.GLIPPdf?.defaultLogoUrl ||
      "https://toniopaceict.github.io/mylearningspace/assets/GLIP-icon-transparent-cropped.png";
    logo.alt = "GLIP logo";
    logo.style.width = "42px";
    logo.style.height = "42px";
    logo.style.objectFit = "contain";
    header.appendChild(logo);

    const titleBox = document.createElement("div");
    titleBox.innerHTML =
      '<div style="font-size:18px;font-weight:700;line-height:1.15;">' + pdfTitle + '</div>' +
      '<div style="font-size:12px;margin-top:2px;">' + pdfSubTitle + '</div>';
    header.appendChild(titleBox);
    pdfWrapper.appendChild(header);

    const sourceClone = source.cloneNode(true);
    sourceClone.querySelectorAll(".no-print, button, #downloadProgressBar, #saveProgressBar").forEach(function (el) {
      el.remove();
    });
    sourceClone.querySelectorAll("fieldset").forEach(function (el) {
      el.style.border = "0";
      el.style.padding = "0";
      el.style.margin = "0 0 18px 0";
      el.style.boxShadow = "none";
    });
    sourceClone.querySelectorAll("legend").forEach(function (el) {
      el.style.fontSize = "13px";
      el.style.fontWeight = "700";
      el.style.marginBottom = "6px";
      el.style.padding = "0";
    });
    pdfWrapper.appendChild(sourceClone);

    window.html2pdf()
      .set({
        margin: [0.45, 0.45, 0.6, 0.45],
        filename: fileName,
        image: { type: "jpeg", quality: 1 },
        html2canvas: { scale: 3, useCORS: true, scrollY: 0, backgroundColor: "#ffffff" },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"] }
      })
      .from(pdfWrapper)
      .toPdf()
      .get("pdf")
      .then(function (pdf) {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(6);
          pdf.setTextColor(11, 60, 111);
          pdf.text("© GLIP", 0.45, pageHeight - 0.3);
          pdf.text(footerTitle, pageWidth / 2, pageHeight - 0.3, { align: "center" });
          pdf.text("Page " + i + " of " + totalPages, pageWidth - 0.45, pageHeight - 0.3, { align: "right" });
        }
      })
      .save();
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

    const config = window.PAGE_CONFIG || {};
    const heading = getPageHeading();
    const student = safeStudentName();
    const scoreText = cleanScoreText(document.querySelector(options.scoreSelector || "#scoreBox")?.textContent);
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const state = { y: 18 };

    async function pageHeader() {
      state.y = await layout.addHeader(pdf, {
        title: heading.topic,
        subtitle: heading.activity,
        detailLeft: student,
        detailRight: scoreText
      });
      return state.y;
    }

    await pageHeader();

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      const selected = document.querySelector('input[name="' + q.id + '"]:checked')?.value || "";
      const selectedOption = (q.options || []).find(function (opt) { return opt.value === selected; }) || {};
      const correctOption = (q.options || []).find(function (opt) { return opt.value === q.correct; }) || {};
      const isCorrect = selected === q.correct;

      if (state.y > pageHeight - 55) {
        pdf.addPage();
        await pageHeader();
      }

      layout.addWrappedText(pdf, state,
        (q.title || "Question " + (index + 1)) + " - " + (q.marks || 0) + " " + ((q.marks || 0) === 1 ? "mark" : "marks"),
        { fontSize: 12, style: "bold", onNewPage: function () { return 18; } });
      layout.addWrappedText(pdf, state, q.text || "", { fontSize: 10 });

      (q.options || []).forEach(function (opt) {
        layout.addWrappedText(pdf, state, opt.value + ". " + opt.label, { x: 20, maxWidth: 170, fontSize: 9.5, after: 1.5 });
      });

      layout.addWrappedText(pdf, state,
        "Your answer: " + (selectedOption.label || selected),
        { fontSize: 10, style: "bold" });
      layout.addWrappedText(pdf, state,
        "Correct answer: " + (correctOption.label || q.correct),
        { fontSize: 9.5 });
      layout.addWrappedText(pdf, state,
        "Result: " + (isCorrect ? "Correct" : "Incorrect"),
        { fontSize: 9.5, style: "bold", after: 7 });
    }

    layout.addFooter(pdf, { centreText: heading.topic + " - " + heading.activity });
    pdf.save(buildLearnerFileName(heading.activity, options.fallbackName || "Quiz"));
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
    const student = safeStudentName();
    const score = answers.filter(function (a) { return a.isCorrect; }).length;
    const scoreText = "Score: " + score + " / " + answers.length;
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const state = { y: 18 };

    async function pageHeader() {
      state.y = await layout.addHeader(pdf, {
        title: heading.topic,
        subtitle: heading.activity,
        detailLeft: student,
        detailRight: scoreText
      });
      return state.y;
    }

    await pageHeader();
    let currentTask = "";

    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      if (state.y > pageHeight - 38) {
        pdf.addPage();
        await pageHeader();
        currentTask = "";
      }

      if (answer.task !== currentTask) {
        currentTask = answer.task;
        layout.addWrappedText(pdf, state, currentTask, { fontSize: 12, style: "bold", after: 4 });
      }

      layout.addWrappedText(pdf, state,
        answer.blank + ": " + answer.selected,
        { x: 18, maxWidth: 172, fontSize: 10, style: "bold", after: 1.5 });
      layout.addWrappedText(pdf, state,
        "Correct answer: " + answer.correct + " | " + (answer.isCorrect ? "Correct" : "Incorrect"),
        { x: 18, maxWidth: 172, fontSize: 9, after: 4 });
    }

    layout.addFooter(pdf, { centreText: heading.topic + " - " + heading.activity });
    pdf.save(buildLearnerFileName(heading.activity, options.fallbackName || "Fill in the Blanks"));
    setPanelMessage(options.messageId || "fillBlankPdfMessage", "Your PDF has been saved.", "success");
  }

  function bindButton(buttonId, handler) {
    const button = document.getElementById(buttonId);
    if (!button || button.dataset.tonioPdfBound === "true") return;
    button.addEventListener("click", handler);
    button.dataset.tonioPdfBound = "true";
  }

  function initSimplePdfExport(config) {
    const options = Object.assign({ buttonId: "savePdfBtn", sourceSelector: ".wrap", fallbackName: "Page" }, config || {});
    bindButton(options.buttonId, function () { downloadSimplePDF(options); });
    return { download: function () { downloadSimplePDF(options); } };
  }

  function initQuizPdfExport(config) {
    const options = Object.assign({ buttonId: "savePdfBtn", scoreSelector: "#scoreBox", fallbackName: "Quiz", messageId: "pdfMessage" }, config || {});
    bindButton(options.buttonId, function () { downloadQuizPDF(options); });
    return { download: function () { downloadQuizPDF(options); } };
  }

  function initFillBlankPdfExport(config) {
    const options = Object.assign({ buttonId: "saveFillBlankPdfBtn", fallbackName: "Fill in the Blanks", messageId: "fillBlankPdfMessage" }, config || {});
    bindButton(options.buttonId, function () { downloadFillBlankPDF(options); });
    return { download: function () { downloadFillBlankPDF(options); } };
  }

  window.TonioPdfExport = {
    initSimplePdfExport: initSimplePdfExport,
    initQuizPdfExport: initQuizPdfExport,
    initFillBlankPdfExport: initFillBlankPdfExport,
    downloadSimplePDF: downloadSimplePDF,
    downloadQuizPDF: downloadQuizPDF,
    downloadFillBlankPDF: downloadFillBlankPDF
  };
})(window);
