(function () {
  "use strict";

  const CLEAR_CONFIRMATION = "CLEAR";
  const IMPORT_CONFIRMATION = "IMPORT";

  function getWebAppUrl() {
    return window.getGlipWebAppUrl();
  }

function postToGlip(data) {
  return fetch(getWebAppUrl(), {
    method: "POST",
    body: JSON.stringify(data)
  }).then(function (response) {
    return response.text().then(function (responseText) {
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (error) {
        console.error(
          "GLIP received a non-JSON response.",
          {
            action: data && data.action,
            status: response.status,
            response: responseText
          }
        );

        throw new Error(
          "The GLIP server returned an unexpected response. " +
          "Check that the Apps Script web app has been redeployed and is accessible to anyone."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.message ||
          "The GLIP server returned an error."
        );
      }

      return result;
    });
  });
}




  

  function setMessage(elementId, text, type) {
    const message = document.getElementById(elementId);
    if (!message) return;
    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
    message.style.display = text ? "block" : "none";
  }

  function setImportBusyState(options, isBusy, text) {
    if (options && typeof options.onImportBusyStateChange === "function") {
      options.onImportBusyStateChange({
        busy: isBusy === true,
        text: text || ""
      });
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

function escapeCsvValue(value) {
  const text = String(value === null || value === undefined ? "" : value);
  return "\"" + text.replace(/"/g, "\"\"") + "\"";
}

function makeValidationErrorsFilename(sheetName) {
  const now = new Date();
  const pad = function (value) { return String(value).padStart(2, "0"); };

  const stamp = now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) + "_" +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  return "IMPORT_ERRORS_" + (sheetName || "Table") + "_" + stamp + ".csv";
}

function buildValidationErrorsCsv(validation) {
  const errors = Array.isArray(validation.errors) ? validation.errors : [];

  let csv = "";
  csv += "Table,Rows Found,Existing Rows,Rows With Errors\n";
  csv += [
    escapeCsvValue(validation.sheet_name || "Table"),
    escapeCsvValue(validation.row_count || 0),
    escapeCsvValue(validation.existing_row_count || 0),
    escapeCsvValue(validation.error_count || 0)
  ].join(",") + "\n\n";

  csv += "Error Number,Error\n";

  errors.forEach(function (error, index) {
    csv += [
      escapeCsvValue(index + 1),
      escapeCsvValue(error)
    ].join(",") + "\n";
  });

  return csv;
}

function exportValidationErrors(validation) {
  const csv = buildValidationErrorsCsv(validation);
  const filename = makeValidationErrorsFilename(validation.sheet_name || "Table");
  downloadText(filename, csv);
}
  
  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("Could not read the selected CSV file.")); };
      reader.readAsText(file);
    });
  }

  function createButton(text, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className || "glip-btn glip-btn-secondary";
    button.textContent = text;
    return button;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildValidationSummaryHtml(validation) {
    const errors = Array.isArray(validation.errors) ? validation.errors : [];
    const canImport = validation.can_import === true;

    let html = "";

    html += canImport
      ? "<p><strong>CSV validation successful.</strong></p>"
      : "<p><strong>CSV validation failed.</strong></p>";

    html += "<ul>";
    html += "<li>Rows found: " + escapeHtml(validation.row_count || 0) + "</li>";
    html += "<li>Existing rows: " + escapeHtml(validation.existing_row_count || 0) + "</li>";
    html += "<li>Rows with errors: " + escapeHtml(validation.error_count || 0) + "</li>";
    html += "</ul>";

    if (!canImport) {
      html += "<p>The import has been blocked. Fix the CSV file and try again.</p>";

      if (errors.length) {
        html += "<div class=\"glip-validation-errors\">";
        html += "<strong>Errors found:</strong>";
        html += "<ol>";

        errors.forEach(function (error) {
          html += "<li>" + escapeHtml(error) + "</li>";
        });

        html += "</ol>";
        html += "</div>";
      }

      return html;
    }

    html += "<p>A backup CSV will be downloaded before the import.</p>";
    html += "<p>This will replace the current " + escapeHtml(validation.sheet_name || "table") + " data.</p>";

    return html;
  }



function showGlipConfirmModal(options) {
  return new Promise(function (resolve) {
    let modal = document.getElementById("glipConfirmModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "glipConfirmModal";
      modal.className = "glip-confirm-modal";

      modal.innerHTML = `
        <div class="glip-confirm-box" role="dialog" aria-modal="true">
          <h2 id="glipConfirmTitle"></h2>
          <div id="glipConfirmBody" class="glip-confirm-body"></div>
          <label id="glipConfirmLabel" class="glip-confirm-label"></label>
          <input id="glipConfirmInput" class="tracker-input glip-confirm-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
          <p id="glipConfirmError" class="glip-confirm-error"></p>
          <div class="glip-confirm-actions">
            <button type="button" id="glipConfirmCancel" class="glip-btn glip-btn-secondary">Cancel</button>
            <button type="button" id="glipConfirmOk" class="glip-btn">Continue</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    }

    const title = document.getElementById("glipConfirmTitle");
    const body = document.getElementById("glipConfirmBody");
    const label = document.getElementById("glipConfirmLabel");
    const input = document.getElementById("glipConfirmInput");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    const error = document.getElementById("glipConfirmError");
    const cancelBtn = document.getElementById("glipConfirmCancel");
    const okBtn = document.getElementById("glipConfirmOk");

    title.textContent = options.title;
    body.innerHTML = options.bodyHtml;
    if (options.noConfirmationInput) {
      label.style.display = "none";
      input.style.display = "none";
    } else {
      label.style.display = "block";
      input.style.display = "block";
      label.textContent = "Type " + options.confirmationWord + " to continue.";
    }

input.value = "";
error.textContent = "";

cancelBtn.textContent = options.noConfirmationInput ? "Close" : "Cancel";

if (options.extraButtonText) {
  okBtn.textContent = options.extraButtonText;
  okBtn.style.display = "";
  okBtn.className = "glip-btn";
} else {
  okBtn.textContent = options.confirmButtonText || "Continue";
  okBtn.className = options.dangerous ? "glip-btn glip-btn-danger" : "glip-btn";

  if (options.noConfirmationInput) {
    okBtn.style.display = "none";
  } else {
    okBtn.style.display = "";
  }
}

    

    modal.classList.add("is-visible");
    if (!options.noConfirmationInput) {
  input.focus();
}

    function close(value) {
      modal.classList.remove("is-visible");
      resolve(value);
    }

okBtn.onclick = function () {
  if (options.extraButtonAction) {
    close(true);
    options.extraButtonAction();
    return;
  }

  if (!options.noConfirmationInput && input.value.trim() !== options.confirmationWord) {
    error.textContent = "The confirmation word is not correct.";

    if (!options.noConfirmationInput) {
      input.focus();
    }

    return;
  }

  close(true);
};
    

    cancelBtn.onclick = function () {
      close(false);
    };

    modal.onclick = function (event) {
      if (event.target === modal) {
        close(false);
      }
    };
  });
}

window.showGlipConfirmModal = showGlipConfirmModal;
  
  
  function makeBackupFilename(sheetName) {
    const now = new Date();
    const pad = function (value) { return String(value).padStart(2, "0"); };
    const stamp = now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) + "_" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());

    return "BACKUP_" + sheetName + "_" + stamp + ".csv";
  }

  function downloadCurrentTableBackup(options) {
    return postToGlip({
      action: "exportAdminTableCsv",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      table_key: options.tableKey
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not create the backup CSV.");
      }

      downloadText(makeBackupFilename(result.sheet_name || options.tableName), result.csv || "");
      return result;
    });
  }

  window.setupGlipCsvAdminTools = function (options) {
    if (!options || !options.tableKey || !options.tableName) return;
    if (document.getElementById("csvTools-" + options.tableKey)) return;

    const anchor = options.anchorElementId
      ? document.getElementById(options.anchorElementId)
      : document.querySelector(".teacher-actions") ||
        document.querySelector(".panel-right") ||
        document.querySelector(".management-wrap .task-box");

    if (!anchor) return;

    const wrapper = document.createElement("div");
    wrapper.id = "csvTools-" + options.tableKey;
    wrapper.className = "glip-csv-tools";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,text/csv";
    fileInput.style.display = "none";

    const exportBtn = createButton("Export CSV");
    const importBtn = createButton("Import CSV");
    const clearBtn = createButton(
    "Clear Table",
    "glip-btn glip-btn-secondary"
  );

wrapper.appendChild(exportBtn);
if (!options.hideImport) {
  wrapper.appendChild(importBtn);
}

if (!options.hideClear) {
  wrapper.appendChild(clearBtn);
}

wrapper.appendChild(fileInput);

    
    anchor.appendChild(wrapper);

    exportBtn.addEventListener("click", function () {
      setMessage(options.messageElementId, "Preparing CSV export...", "info");

      postToGlip({
        action: options.exportAction || "exportAdminTableCsv",
        admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
        table_key: options.tableKey
      }).then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not export CSV.");
        }

        downloadText(result.filename || (options.tableKey + ".csv"), result.csv || "");
        setMessage(
          options.messageElementId,
          options.exportSuccessMessage || "Sheet-format CSV exported successfully.",
          "success"
        );
      }).catch(function (error) {
        console.error(error);
        setMessage(options.messageElementId, error.message || "Could not export CSV.", "error");
      });
    });

    if (!options.hideImport) importBtn.addEventListener("click", function () {
      fileInput.value = "";
      fileInput.click();
    });

    if (!options.hideImport) fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      readFileAsText(file).then(function (csvText) {
        setMessage(
          options.messageElementId,
          options.validationMessage || "Validating sheet-format CSV before import...",
          "info"
        );

        return postToGlip({
          action: options.validateAction || "validateAdminTableCsvImport",
          admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
          table_key: options.tableKey,
          csv: csvText
        }).then(function (validation) {
          if (!validation || validation.status !== "success") {
            throw new Error(validation.message || "CSV validation failed.");
          }

      if (validation.can_import !== true) {
        return showGlipConfirmModal({
          title: "Import Validation Summary",
          bodyHtml: buildValidationSummaryHtml(validation),
          confirmationWord: "",
          confirmButtonText: "",
          extraButtonText: "Export Errors CSV",
          extraButtonAction: function () {
            exportValidationErrors(validation);
          },
          dangerous: true,
          noConfirmationInput: true
        }).then(function () {
          setMessage(options.messageElementId, "CSV import blocked. Fix the errors and try again.", "error");
          return null;
        });
      }

          

          return showGlipConfirmModal({
            title: "Import " + validation.sheet_name + " CSV",
            bodyHtml: buildValidationSummaryHtml(validation),
            confirmationWord: IMPORT_CONFIRMATION,
            confirmButtonText: "Import CSV",
            dangerous: false
          }).then(function (confirmed) {
            if (!confirmed) {
              setMessage(options.messageElementId, "CSV import cancelled.", "info");
              return null;
            }

            setMessage(options.messageElementId, "Downloading backup and importing CSV...", "info");
            setImportBusyState(options, true, "Saving...");

            return downloadCurrentTableBackup(options).then(function () {
              return postToGlip({
                action: options.importAction || "applyAdminTableCsvImport",
                admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
                table_key: options.tableKey,
                csv: csvText,
                confirmation: IMPORT_CONFIRMATION
              });
            });
          });
        });
      }).then(function (result) {
        if (!result) return;

        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not import CSV.");
        }

        setMessage(
          options.messageElementId,
          options.importSuccessMessage || "Sheet-format CSV imported successfully. A backup CSV was downloaded first.",
          "success"
        );

        setImportBusyState(options, false, "");

        if (typeof options.refresh === "function") {
          options.refresh();
        }
      }).catch(function (error) {
        console.error(error);
        setImportBusyState(options, false, "");
        setMessage(options.messageElementId, error.message || "Could not import CSV.", "error");
      });
    });

if (!options.hideClear) {
  clearBtn.addEventListener("click", function () {
    if (typeof options.beforeClear === "function") {
      options.beforeClear();
    }

    showGlipConfirmModal({
      title: "Clear " + options.tableName + " Table",
      bodyHtml:
        "<p>A backup CSV will be downloaded before the table is cleared.</p>" +
        "<p>The table data will be removed, but the column headings will be kept.</p>",
      confirmationWord: CLEAR_CONFIRMATION,
      confirmButtonText: "Clear Table",
      dangerous: true
    }).then(function (confirmed) {
      if (!confirmed) {
        setMessage(options.messageElementId, "Clear table cancelled.", "info");
        return;
      }

      setMessage(options.messageElementId, "Downloading backup and clearing table...", "info");

      downloadCurrentTableBackup(options).then(function () {
        return postToGlip({
          action: "clearAdminTableRows",
          admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
          table_key: options.tableKey,
          confirmation: CLEAR_CONFIRMATION
        });
      }).then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not clear table.");
        }

        setMessage(
          options.messageElementId,
          "Table cleared successfully. A backup CSV was downloaded first.",
          "success"
        );

        if (typeof options.onClearSuccess === "function") {
          options.onClearSuccess(result);
        }

        if (options.refreshAfterClear !== false && typeof options.refresh === "function") {
          return Promise.resolve(options.refresh());
        }

        return null;
      }).catch(function (error) {
        console.error(error);
        setMessage(options.messageElementId, error.message || "Could not clear table.", "error");
      });
    });
  });
}

    
  };
})();
