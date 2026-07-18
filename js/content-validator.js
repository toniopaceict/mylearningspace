(function () {
  "use strict";

  let currentErrors = [];

  document.addEventListener("glipReady", function () {
    if (!window.isOwner || !isOwner()) return;

    const validateButton = document.getElementById("runContentValidation");
    const exportButton = document.getElementById("exportValidationErrors");

    if (validateButton) validateButton.addEventListener("click", runValidation);
    if (exportButton) exportButton.addEventListener("click", exportErrors);

    initialiseSorting();
  });

  async function runValidation() {
    const button = document.getElementById("runContentValidation");
    const message = document.getElementById("contentValidationMessage");

    button.disabled = true;
    button.textContent = "Validating...";
    message.classList.remove("error");
    message.textContent = "Running the complete publish check. This starts only on this page and does not run in the background.";
    clearResults();

    try {
      const response = await fetch(window.getGlipWebAppUrl(), {
        method: "POST",
        body: JSON.stringify({
          action: "runContentPublishValidation",
          owner_teacher_id: sessionStorage.getItem("glipTeacherId") || ""
        })
      });

      const result = await response.json();
      if (!result || result.status !== "success") {
        throw new Error((result && result.message) || "Validation could not be completed.");
      }

      currentErrors = Array.isArray(result.errors) ? result.errors.slice() : [];
      updateExportButton();

      renderSummary(result.summary || {});
      renderIssues("validationErrors", currentErrors, "No errors found.");
      renderIssues("validationWarnings", result.warnings || [], "No warnings found.");
      renderIssues("validationPassed", result.passed || [], "No passed checks were reported.");
      message.textContent = "Publish check completed in " + formatDuration(result.summary.duration_ms || 0) + ".";
    } catch (error) {
      currentErrors = [];
      updateExportButton();
      message.textContent = "Validation failed: " + (error.message || String(error));
      message.classList.add("error");
    } finally {
      button.disabled = false;
      button.textContent = "Validate";
    }
  }

  function clearResults() {
    currentErrors = [];
    updateExportButton();
    document.getElementById("validationSummary").innerHTML = "";
    ["validationErrors", "validationWarnings", "validationPassed"].forEach(function (id) {
      document.getElementById(id).innerHTML = '<tr><td colspan="4">Waiting for validation...</td></tr>';
    });
  }

  function renderSummary(summary) {
    document.getElementById("validationSummary").innerHTML =
      card("Errors", summary.errors || 0, "performance-health-danger") +
      card("Warnings", summary.warnings || 0, "performance-health-warning") +
      card("Passed", summary.passed || 0) +
      card("Pages OK", summary.pages_ok || 0) +
      card("Pages Failed", summary.pages_failed || 0, "performance-health-danger") +
      card("Duration", formatDuration(summary.duration_ms || 0));
  }

  function card(label, value, statusClass) {
    return '<div class="performance-summary-card ' + escapeHtml(statusClass || "") + '"><span>' +
      escapeHtml(label) + '</span><strong>' + escapeHtml(String(value)) + '</strong></div>';
  }

  function renderIssues(targetId, items, emptyText) {
    const body = document.getElementById(targetId);
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="4">' + escapeHtml(emptyText) + '</td></tr>';
      return;
    }

    body.innerHTML = items.map(function (item) {
      const message = item.url
        ? '<a href="' + escapeAttribute(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.message) + '</a>'
        : escapeHtml(item.message);

      return '<tr>' +
        '<td>' + escapeHtml(item.section || "") + '</td>' +
        '<td>' + escapeHtml(item.item || "") + '</td>' +
        '<td>' + escapeHtml(item.sheet_row || "") + '</td>' +
        '<td>' + message + '</td>' +
        '</tr>';
    }).join("");
  }

  function initialiseSorting() {
    document.querySelectorAll("table[data-sortable='true'] th[data-sort-key]").forEach(function (header) {
      header.style.cursor = "pointer";
      header.setAttribute("tabindex", "0");
      header.setAttribute("role", "button");
      header.addEventListener("click", function () { sortTable(header); });
      header.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          sortTable(header);
        }
      });
    });
  }

  function sortTable(header) {
    const table = header.closest("table");
    const body = table.querySelector("tbody");
    const headers = Array.from(header.parentElement.children);
    const columnIndex = headers.indexOf(header);
    const currentDirection = header.getAttribute("data-sort-direction");
    const direction = currentDirection === "asc" ? "desc" : "asc";
    const rows = Array.from(body.querySelectorAll("tr"));

    if (rows.length < 2 || rows.some(function (row) { return row.children.length < 4; })) return;

    headers.forEach(function (item) {
      item.removeAttribute("data-sort-direction");
      item.setAttribute("aria-sort", "none");
      updateSortIndicator(item, "");
    });

    rows.sort(function (a, b) {
      const left = normaliseSortValue(a.children[columnIndex].textContent, columnIndex === 2);
      const right = normaliseSortValue(b.children[columnIndex].textContent, columnIndex === 2);

      if (left < right) return direction === "asc" ? -1 : 1;
      if (left > right) return direction === "asc" ? 1 : -1;
      return 0;
    });

    rows.forEach(function (row) { body.appendChild(row); });
    header.setAttribute("data-sort-direction", direction);
    header.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
    updateSortIndicator(header, direction);
  }

  function updateSortIndicator(header, direction) {
    const label = header.querySelector(".sort-label");
    const indicator = header.querySelector(".sort-indicator");
    if (!label || !indicator) return;
    indicator.textContent = direction === "asc" ? " ▲" : direction === "desc" ? " ▼" : " ↕";
  }

  function normaliseSortValue(value, numeric) {
    const text = String(value || "").trim();
    if (numeric) {
      const number = Number(text);
      return text !== "" && !isNaN(number) ? number : Number.MAX_SAFE_INTEGER;
    }
    return text.toLocaleLowerCase("en-GB");
  }

  function updateExportButton() {
    const button = document.getElementById("exportValidationErrors");
    if (button) button.disabled = currentErrors.length === 0;
  }

  function exportErrors() {
    if (!currentErrors.length) return;

    const rows = [["Area", "Item", "Sheet row", "Problem", "HTTP status", "URL"]];
    currentErrors.forEach(function (item) {
      rows.push([
        item.section || "",
        item.item || "",
        item.sheet_row || "",
        item.message || "",
        item.http_code || "",
        item.url || ""
      ]);
    });

    const csv = rows.map(function (row) {
      return row.map(csvCell).join(",");
    }).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ").replace(/:/g, "-");

    link.href = URL.createObjectURL(blob);
    link.download = "glip-content-validator-errors-" + timestamp + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function csvCell(value) {
    const text = String(value == null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function formatDuration(ms) {
    const value = Number(ms || 0);
    return value >= 1000 ? (value / 1000).toFixed(1) + " s" : Math.round(value) + " ms";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) { return escapeHtml(value); }
})();
