(function (window) {
  "use strict";

  const GLIP_BLUE = [11, 60, 111];
  const GLIP_LINE = [216, 227, 239];
  const DEFAULT_LOGO_URL =
    String(window.GLIP_BASE_URL || "").replace(/\/$/, "") +
    "/assets/GLIP-icon-transparent-cropped.png";
  const PDF_CONTEXT_TIMEOUT_MS = 8000;

  function getJsPDF() {
    return window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
  }

  function safeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function safeFilePart(value, fallback) {
    const cleaned = safeText(value)
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || fallback || "GLIP";
  }

  function getStudentName() {
    return safeText(sessionStorage.getItem("glipStudentName")) || "Student";
  }

  function getClassLabel() {
    return safeText(
      sessionStorage.getItem("glipClassLabel") ||
      sessionStorage.getItem("glipClassCode") ||
      sessionStorage.getItem("glipClassId")
    );
  }

  function loadImageInfo(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = function () {
        try {
          const width = img.naturalWidth || img.width || 1;
          const height = img.naturalHeight || img.height || 1;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL("image/png"),
            width: width,
            height: height,
            ratio: width / height
          });
        } catch (error) {
          resolve(null);
        }
      };

      img.onerror = function () {
        resolve(null);
      };

      img.src = src;
    });
  }

  function loadImageDataUrl(src) {
    return loadImageInfo(src).then(function (info) {
      return info ? info.dataUrl : null;
    });
  }

  function currentPageDetails() {
    const config = window.PAGE_CONFIG || {};
    return {
      student_id: safeText(sessionStorage.getItem("glipStudentId")),
      class_id: safeText(sessionStorage.getItem("glipClassId")),
      level: safeText(config.level || sessionStorage.getItem("glipLevel")),
      subject_id: safeText(config.subjectId || sessionStorage.getItem("glipSubjectId")),
      topic_id: safeText(config.topicId),
      activity_id: safeText(config.activityId)
    };
  }

  async function getActivityMetadata() {
    const config = window.PAGE_CONFIG || {};
    const fallbackFirstName = safeText(sessionStorage.getItem("glipStudentName")) || getStudentName();
    const fallbackSurname = safeText(sessionStorage.getItem("glipStudentSurname"));
    const fallbackFullName = safeText(sessionStorage.getItem("glipStudentFullName")) ||
      [fallbackFirstName, fallbackSurname].filter(Boolean).join(" ") || fallbackFirstName;
    const fallback = {
      student: fallbackFullName,
      student_name: fallbackFirstName,
      student_surname: fallbackSurname,
      class_label: getClassLabel(),
      subject: safeText(
        config.subjectName ||
        config.subject ||
        sessionStorage.getItem("glipSubjectName")
      ),
      topic: safeText(config.topicName || document.getElementById("heroMainTitle")?.textContent),
      activity: safeText(config.subTitle || document.getElementById("heroSubTitle")?.textContent),
      teacher: safeText(sessionStorage.getItem("glipSubmissionTeacherDisplayName")),
      submitted: new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
      }).replace(",", "")
    };

    if (typeof window.getGlipWebAppUrl !== "function") return fallback;
    const webAppUrl = window.getGlipWebAppUrl();
    if (!webAppUrl) return fallback;

    try {
      const requestPromise = fetch(webAppUrl, {
        method: "POST",
        body: JSON.stringify(Object.assign({ action: "getGeneratedActivityPdfContext" }, currentPageDetails()))
      })
        .then(function (response) {
          return response.json();
        })
        .catch(function () {
          return null;
        });

      const timeoutPromise = new Promise(function (resolve) {
        window.setTimeout(function () {
          resolve(null);
        }, PDF_CONTEXT_TIMEOUT_MS);
      });

      const data = await Promise.race([requestPromise, timeoutPromise]);
      if (!data || data.status !== "success" || !data.pdf_context) return fallback;
      return Object.assign({}, fallback, data.pdf_context);
    } catch (error) {
      return fallback;
    }
  }

  async function addHeader(pdf, options) {
    options = options || {};

    const pageWidth = pdf.internal.pageSize.getWidth();
    const top = Number(options.top || 10);
    const left = Number(options.left || 15);
    const maxLogoW = Number(options.logoWidth || 18);
    const maxLogoH = Number(options.logoHeight || 18);
    const logoUrl = options.logoUrl || DEFAULT_LOGO_URL;
    const logoInfo = await loadImageInfo(logoUrl);

    let logoW = maxLogoW;
    let logoH = maxLogoH;
    if (logoInfo && logoInfo.ratio) {
      logoW = maxLogoW;
      logoH = logoW / logoInfo.ratio;
      if (logoH > maxLogoH) {
        logoH = maxLogoH;
        logoW = logoH * logoInfo.ratio;
      }
    }

    const textX = left + logoW + 5;
    if (logoInfo && logoInfo.dataUrl) {
      pdf.addImage(logoInfo.dataUrl, "PNG", left, top, logoW, logoH);
    }

    pdf.setTextColor.apply(pdf, GLIP_BLUE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(safeText(options.title) || "GLIP Activity Submission", textX, top + 7);

    const subtitle = safeText(options.subtitle || "Guided Learning for Independent Progress");
    if (subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.text(subtitle, textX, top + 12.5);
    }

    const dividerY = Math.max(top + logoH + 4, top + 18);
    pdf.setDrawColor.apply(pdf, GLIP_LINE);
    pdf.setLineWidth(0.3);
    pdf.line(left, dividerY, pageWidth - left, dividerY);

    return dividerY + 7;
  }

  function addMetadataTable(pdf, state, metadata, options) {
    options = options || {};
    const pageWidth = pdf.internal.pageSize.getWidth();
    const left = Number(options.left || 15);
    const right = Number(options.right || 15);
    const labelWidth = Number(options.labelWidth || 36);
    const rowHeight = Number(options.rowHeight || 8.2);
    const usableWidth = pageWidth - left - right;
    const valueX = left + labelWidth + 4;
    const rows = [
      ["Student", metadata.student],
      ["Class", metadata.class_label],
      ["Subject", metadata.subject],
      ["Topic", metadata.topic],
      ["Activity", metadata.activity],
      ["Teacher", metadata.teacher],
      ["Submitted", metadata.submitted]
    ];

    pdf.setFontSize(9.5);
    rows.forEach(function (row) {
      const label = safeText(row[0]);
      const value = safeText(row[1]);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor.apply(pdf, GLIP_BLUE);
      pdf.text(label, left + 2, state.y + 5.1);
      pdf.setFont("helvetica", "normal");
      const valueLines = pdf.splitTextToSize(value, usableWidth - labelWidth - 6);
      pdf.text(valueLines, valueX, state.y + 5.1);
      const usedHeight = Math.max(rowHeight, valueLines.length * 4.5 + 3.5);
      pdf.setDrawColor.apply(pdf, GLIP_LINE);
      pdf.setLineWidth(0.2);
      pdf.line(left, state.y + usedHeight, pageWidth - right, state.y + usedHeight);
      state.y += usedHeight;
    });
    state.y += 8;
  }

  function addFooter(pdf, options) {
    options = options || {};
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = Number(options.left || 15);

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setDrawColor.apply(pdf, GLIP_LINE);
      pdf.setLineWidth(0.2);
      pdf.line(left, pageHeight - 13, pageWidth - left, pageHeight - 13);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor.apply(pdf, GLIP_BLUE);
      pdf.text("© GLIP", left, pageHeight - 7.5);
      pdf.text("Page " + i + " of " + totalPages, pageWidth - left, pageHeight - 7.5, {
        align: "right"
      });
    }
  }

  function addWrappedText(pdf, state, text, options) {
    options = options || {};
    const pageHeight = pdf.internal.pageSize.getHeight();
    const x = Number(options.x || 15);
    const maxWidth = Number(options.maxWidth || 180);
    const fontSize = Number(options.fontSize || 10);
    const style = options.style || "normal";
    const bottom = Number(options.bottom || 22);
    const onNewPage = options.onNewPage;

    pdf.setFont("helvetica", style);
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(String(text == null ? "" : text), maxWidth);

    lines.forEach(function (line) {
      if (state.y > pageHeight - bottom) {
        pdf.addPage();
        state.y = typeof onNewPage === "function" ? onNewPage() : 18;
      }
      pdf.text(line, x, state.y);
      state.y += fontSize * 0.45;
    });
    state.y += Number(options.after == null ? 3 : options.after);
  }

  window.GLIPPdf = {
    getJsPDF: getJsPDF,
    safeText: safeText,
    safeFilePart: safeFilePart,
    getStudentName: getStudentName,
    getClassLabel: getClassLabel,
    getActivityMetadata: getActivityMetadata,
    loadImageInfo: loadImageInfo,
    loadImageDataUrl: loadImageDataUrl,
    addHeader: addHeader,
    addMetadataTable: addMetadataTable,
    addFooter: addFooter,
    addWrappedText: addWrappedText,
    defaultLogoUrl: DEFAULT_LOGO_URL
  };
})(window);
