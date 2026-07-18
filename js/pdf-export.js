(function (window) {
  'use strict';

  function getHeaderText(selector, fallback) {
    return document.querySelector(selector)?.textContent?.trim() || fallback || '';
  }

  function buildFileName(options) {
    const includeSubtitle = !!options.includeSubtitleInFileName;

    const subtitleText = getHeaderText('.lesson-hero-subtitle', '');
    const titleText = getHeaderText('.lesson-hero h1', options.fallbackName || 'Page');
    const partText = getHeaderText('.lesson-hero h2', '');

    const parts = includeSubtitle
      ? [subtitleText, titleText, partText]
      : [titleText, partText];

    let fileName = parts
      .filter(Boolean)
      .join(' - ')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fileName) {
      fileName = options.fallbackName || 'Page';
    }

    return fileName + '.pdf';
  }


function downloadSimplePDF(options) {
  const source = document.querySelector(options.sourceSelector || ".wrap");
  if (!source || !window.html2pdf) return;

  const config = window.PAGE_CONFIG || {};

  const pdfTitle = config.pdfTitle || config.mainTitle || options.fallbackName || "Practice Sheet";
  const pdfSubTitle = config.pdfSubTitle || config.subTitle || "";
  const footerTitle = [pdfTitle, pdfSubTitle].filter(Boolean).join(" - ");

  const fileName =
    (config.pdfFallbackName || footerTitle || options.fallbackName || "Practice Sheet")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim() + ".pdf";

  const pdfWrapper = document.createElement("div");

  pdfWrapper.style.padding = "0";
  pdfWrapper.style.margin = "0";
  pdfWrapper.style.background = "#ffffff";
  pdfWrapper.style.color = "#0b3c6f";
  pdfWrapper.style.fontFamily = "system-ui, Segoe UI, Roboto, Arial, sans-serif";
  pdfWrapper.style.fontSize = "10.5px";
  pdfWrapper.style.lineHeight = "1.35";
  pdfWrapper.style.position = "relative";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "12px";
  header.style.marginBottom = "14px";
  header.style.paddingBottom = "8px";
  header.style.borderBottom = "1px solid rgba(11, 60, 111, 0.18)";

  const logo = document.createElement("img");
  logo.src = config.pdfLogoUrl || "../../../assets/GLIP-icon-transparent-cropped.png";
  logo.alt = "GLIP logo";
  logo.style.width = "42px";
  logo.style.height = "42px";
  logo.style.objectFit = "contain";
  header.appendChild(logo);

  const titleBox = document.createElement("div");
  titleBox.innerHTML = `
    <div style="font-size:18px; font-weight:700; line-height:1.15;">${pdfTitle}</div>
    <div style="font-size:12px; margin-top:2px;">${pdfSubTitle}</div>
  `;
  header.appendChild(titleBox);
  pdfWrapper.appendChild(header);



  const contentLayer = document.createElement("div");
  contentLayer.style.position = "relative";
  contentLayer.style.zIndex = "1";

  const sourceClone = source.cloneNode(true);

sourceClone.querySelectorAll(".no-print").forEach(el => el.remove());
sourceClone.querySelectorAll("button").forEach(el => el.remove());
sourceClone.querySelectorAll(".download-btn").forEach(el => el.remove());
sourceClone.querySelectorAll(".save-progress-bar").forEach(el => el.remove());
sourceClone.querySelectorAll(".glip-progress").forEach(el => el.remove());
sourceClone.querySelectorAll(".glip-progress-bar").forEach(el => el.remove());
sourceClone.querySelectorAll(".save-progress-bar-fill").forEach(el => el.remove());
sourceClone.querySelectorAll("#downloadProgressBar").forEach(el => el.remove());
sourceClone.querySelectorAll("#saveProgressBar").forEach(el => el.remove());
sourceClone.querySelectorAll("[style*='display: none']").forEach(el => el.remove());

sourceClone.querySelectorAll("fieldset").forEach(el => {
  el.style.border = "0";
  el.style.borderRadius = "0";
  el.style.outline = "0";
  el.style.boxShadow = "none";
  el.style.padding = "0";
  el.style.margin = "0 0 18px 0";
});

  sourceClone.querySelectorAll(".task-box, .tracker-box, .download-box").forEach(el => {
  el.style.border = "0";
  el.style.borderRadius = "0";
  el.style.outline = "0";
  el.style.boxShadow = "none";
});

  sourceClone.querySelectorAll("legend").forEach(el => {
    el.style.fontSize = "13px";
    el.style.fontWeight = "700";
    el.style.marginBottom = "6px";
    el.style.padding = "0";
  });

  sourceClone.querySelectorAll(".q, li").forEach(el => {
    el.style.fontSize = "10.5px";
    el.style.lineHeight = "1.35";
  });

  sourceClone.querySelectorAll(".tasklist").forEach(el => {
    el.style.marginTop = "4px";
    el.style.marginBottom = "8px";
  });

  sourceClone.querySelectorAll(".scenario-table").forEach(el => {
    el.style.fontSize = "10px";
    el.style.maxWidth = "100%";
  });

  contentLayer.appendChild(sourceClone);
  pdfWrapper.appendChild(contentLayer);

  const opt = {
    margin: [0.45, 0.45, 0.6, 0.45],
    filename: fileName,
    image: { type: "jpeg", quality: 1 },
html2canvas: {
  scale: 4,
  useCORS: true,
  scrollY: 0,
  backgroundColor: "#ffffff",
  letterRendering: true
},
    jsPDF: {
      unit: "in",
      format: "a4",
      orientation: "portrait",
      compress: true
    },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: [".scenario-table"]
    }
  };

  window.html2pdf()
    .set(opt)
    .from(pdfWrapper)
    .toPdf()
    .get("pdf")

.then(function (pdf) {
  let totalPages = pdf.internal.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Remove an unnecessary final blank page.
  // This is safer when html2pdf creates an extra trailing page.
  if (totalPages > 1) {
    const lastPage = pdf.internal.pages[totalPages];

    if (
      lastPage &&
      Array.isArray(lastPage) &&
      lastPage.join("").trim().length < 80
    ) {
      pdf.deletePage(totalPages);
      totalPages = pdf.internal.getNumberOfPages();
    }
  }

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);

    // Footer
    pdf.setFontSize(6);


    
    pdf.setTextColor(11, 60, 111);

    pdf.text("© GLIP", 0.45, pageHeight - 0.3);

    pdf.text(
      footerTitle,
      pageWidth / 2,
      pageHeight - 0.3,
      { align: "center" }
    );

    pdf.text(
      "Page " + i + " of " + totalPages,
      pageWidth - 0.45,
      pageHeight - 0.3,
      { align: "right" }
    );
  }
})

    
    .save();
}


async function downloadQuizPDF(options) {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) return;

  const questions = window.QUESTIONS || [];
  if (!questions.length) return;

  const config = window.PAGE_CONFIG || {};

  const studentName =
    sessionStorage.getItem("glipStudentName") || "Student";

  const safeStudentName = studentName
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const topicName =
  config.pdfTopicTitle ||
  document.querySelector(".page-hero h1")?.textContent?.trim() ||
  config.topline ||
  "Topic";

const quizTitle =
  config.pdfQuizTitle ||
  document.querySelector(".page-hero h2")?.textContent?.trim() ||
  [config.mainTitle, config.subTitle].filter(Boolean).join(" ") ||
  "Quiz";

  const safeTopicName = topicName
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const fileName = `${safeTopicName} - ${quizTitle} - ${safeStudentName}.pdf`;

let scoreText =
  document.querySelector(options.scoreSelector || "#scoreBox")
    ?.textContent?.trim() || "";

scoreText = scoreText.replace(/\s*\(\d+%\)\s*/g, "");

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait"
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let y = 18;
  let currentQuestionTitle = "Quiz";
  const pageQuestionMap = {};

  function markPage() {
    const pageNo = pdf.internal.getCurrentPageInfo().pageNumber;
    pageQuestionMap[pageNo] = currentQuestionTitle;
  }

  function addNewPage() {
    pdf.addPage();
    y = 18;
    markPage();
  }

  function addText(text, x, fontSize, style, maxWidth) {
    pdf.setFont("helvetica", style || "normal");
    pdf.setFontSize(fontSize);

    const lines = pdf.splitTextToSize(String(text || ""), maxWidth || 180);

    lines.forEach(function (line) {
      if (y > pageHeight - 22) {
        addNewPage();
      }

      pdf.text(line, x, y);
      y += fontSize * 0.45;
    });

    y += 3;
  }

  async function loadImageDataUrl(src) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL("image/png"));
      };

      img.onerror = function () {
        resolve(null);
      };

      img.src = src;
    });
  }

  const logoData = await loadImageDataUrl(
    config.pdfLogoUrl || "../../../assets/GLIP-icon-transparent.png"
  );


pdf.setTextColor(11, 60, 111);

/* Quiz PDF header */
const headerTop = 10;

const logoX = 15;
const logoY = headerTop;
const logoW = 19;
const logoH = 25;

const textX = logoX + logoW + 5;

if (logoData) {
  pdf.addImage(logoData, "PNG", logoX, logoY, logoW, logoH);
}

pdf.setFont("helvetica", "bold");
pdf.setFontSize(18);
pdf.text(topicName, textX, headerTop + 8);

pdf.setFont("helvetica", "normal");
pdf.setFontSize(13);
pdf.text(quizTitle, textX, headerTop + 14);

pdf.setFontSize(10);
pdf.text(safeStudentName, textX, headerTop + 22);

if (scoreText) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(scoreText, pageWidth - 15, headerTop + 22, {
    align: "right"
  });
}

pdf.setDrawColor(216, 227, 239);
pdf.setLineWidth(0.3);
pdf.line(15, 40, pageWidth - 12, 40);

y = 51;

  


  


  
  markPage();

function estimateTextHeight(text, fontSize, maxWidth) {
  const lines = pdf.splitTextToSize(String(text || ""), maxWidth || 180);

  return lines.length * fontSize * 0.45 + 3;
}

function estimateQuestionHeight(q, selected) {
  let height = 0;

  height += estimateTextHeight(
    `${q.title || "Question"} - ${q.marks || 0} ${
      q.marks === 1 ? "mark" : "marks"
    }`,
    12,
    180
  );

  height += estimateTextHeight(q.text || "", 10, 180);
    if (q.imageSrc || q.imageFull) {
    height += 61;
  }

  (q.options || []).forEach(function (opt) {
    height += estimateTextHeight(
      `${opt.value}. ${opt.label}`,
      10,
      170
    );
  });

  height += estimateTextHeight(
    `Selected answer: ${selected}`,
    10,
    180
  );

  if (selected !== "Not answered") {
    const feedback =
      selected === q.correct
        ? q.fbOk
        : `${q.fbBad} The correct answer is ${q.correct}.`;

    if (feedback) {
      height += estimateTextHeight(
        `Feedback: ${feedback}`,
        9,
        180
      );
    }
  }

  height += 8;

  return height;
}
  
  for (const [index, q] of questions.entries()) {
    currentQuestionTitle = q.title || "Q" + (index + 1);
    markPage();

    const selected =
      document.querySelector(`input[name="${q.id}"]:checked`)?.value ||
      "Not answered";

const estimatedHeight = estimateQuestionHeight(q, selected);

if (y + estimatedHeight > pageHeight - 22) {
  addNewPage();
}
    
    addText(
      `${currentQuestionTitle} - ${q.marks || 0} ${
        q.marks === 1 ? "mark" : "marks"
      }`,
      15,
      12,
      "bold"
    );

addText(q.text || "", 15, 10, "normal", 180);

const imageSrc = q.imageFull || q.imageSrc;

if (imageSrc) {
  const imageData = await loadImageDataUrl(imageSrc);

  if (imageData) {
    const imgW = 80;
    const imgH = 55;

    if (y + imgH > pageHeight - 22) {
      addNewPage();
    }

    pdf.addImage(imageData, "PNG", 15, y, imgW, imgH);
    y += imgH + 6;
  }
}

(q.options || []).forEach(function (opt) {
  addText(`${opt.value}. ${opt.label}`, 20, 10, "normal", 170);
});



    

    addText(`Selected answer: ${selected}`, 15, 10, "bold", 180);

    if (selected !== "Not answered") {
      const feedback =
        selected === q.correct
          ? q.fbOk
          : `${q.fbBad} The correct answer is ${q.correct}.`;

      if (feedback) {
        addText(`Feedback: ${feedback}`, 15, 9, "normal", 180);
      }
    }

    y += 4;
  }

  const totalPages = pdf.internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(11, 60, 111);

    pdf.text(`${topicName} - ${quizTitle}`, 15, pageHeight - 8);

       pdf.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 15,
      pageHeight - 8,
      { align: "right" }
    );
  }

  pdf.save(fileName);
}

  
  

  function bindButton(buttonId, handler) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (button.dataset.tonioPdfBound) return;

    button.addEventListener('click', handler);
    button.dataset.tonioPdfBound = 'true';
  }

  function initSimplePdfExport(config) {
    const options = Object.assign(
      {
        buttonId: 'savePdfBtn',
        sourceSelector: '.wrap',
        fallbackName: 'Page',
        includeSubtitleInFileName: false
      },
      config || {}
    );

    bindButton(options.buttonId, function () {
      downloadSimplePDF(options);
    });

    return {
      download: function () {
        downloadSimplePDF(options);
      }
    };
  }

  function initQuizPdfExport(config) {
    const options = Object.assign(
      {
        buttonId: 'savePdfBtn',
        quizSelector: '#quizContainer',
        scoreSelector: '#scoreBox',
        fallbackName: 'Quiz',
        includeSubtitleInFileName: true
      },
      config || {}
    );

    bindButton(options.buttonId, function () {
      downloadQuizPDF(options);
    });

    return {
      download: function () {
        downloadQuizPDF(options);
      }
    };
  }

  window.TonioPdfExport = {
    initSimplePdfExport,
    initQuizPdfExport,
    downloadSimplePDF,
    downloadQuizPDF
  };

  window.downloadPDF = function () {
    downloadSimplePDF({
      sourceSelector: '.wrap',
      fallbackName: 'Page',
      includeSubtitleInFileName: false
    });
  };

  window.saveAsPdf = function () {
    downloadQuizPDF({
      quizSelector: '#quizContainer',
      scoreSelector: '#scoreBox',
      fallbackName: 'Quiz',
      includeSubtitleInFileName: true
    });
  };
})(window);
