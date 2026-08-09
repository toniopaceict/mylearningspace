(function (window) {
  "use strict";

  const GLIP_BLUE = [11, 60, 111];
  const GLIP_LINE = [216, 227, 239];
  const DEFAULT_LOGO_URL =
    "https://toniopaceict.github.io/mylearningspace/assets/GLIP-icon-transparent-cropped.png";

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

  function loadImageDataUrl(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }

      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = function () {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
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

  async function addHeader(pdf, options) {
    options = options || {};

    const pageWidth = pdf.internal.pageSize.getWidth();
    const top = Number(options.top || 10);
    const left = Number(options.left || 15);
    const logoW = Number(options.logoWidth || 19);
    const logoH = Number(options.logoHeight || 25);
    const textX = left + logoW + 5;
    const logoUrl = options.logoUrl || DEFAULT_LOGO_URL;
    const logoData = await loadImageDataUrl(logoUrl);

    if (logoData) {
      pdf.addImage(logoData, "PNG", left, top, logoW, logoH);
    }

    pdf.setTextColor.apply(pdf, GLIP_BLUE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(safeText(options.title) || "GLIP", textX, top + 8);

    const subtitle = safeText(options.subtitle);
    if (subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(subtitle, textX, top + 14);
    }

    const detailLeft = safeText(options.detailLeft);
    const detailRight = safeText(options.detailRight);

    if (detailLeft || detailRight) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      if (detailLeft) pdf.text(detailLeft, textX, top + 22);
      if (detailRight) {
        pdf.text(detailRight, pageWidth - left, top + 22, { align: "right" });
      }
    }

    pdf.setDrawColor.apply(pdf, GLIP_LINE);
    pdf.setLineWidth(0.3);
    pdf.line(left, top + 30, pageWidth - left, top + 30);

    return top + 41;
  }

  function addFooter(pdf, options) {
    options = options || {};
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = Number(options.left || 15);
    const centreText = safeText(options.centreText || options.title || "GLIP");

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6);
      pdf.setTextColor.apply(pdf, GLIP_BLUE);
      pdf.text("© GLIP", left, pageHeight - 8);
      if (centreText) {
        pdf.text(centreText, pageWidth / 2, pageHeight - 8, { align: "center" });
      }
      pdf.text("Page " + i + " of " + totalPages, pageWidth - left, pageHeight - 8, {
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
    const bottom = Number(options.bottom || 20);
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
    loadImageDataUrl: loadImageDataUrl,
    addHeader: addHeader,
    addFooter: addFooter,
    addWrappedText: addWrappedText,
    defaultLogoUrl: DEFAULT_LOGO_URL
  };
})(window);
