(function () {
  "use strict";

  let assignments = [];
  let sortField = "level";
  let sortDirection = "asc";
  let initialised = false;

  document.addEventListener("glipReady", safelyInit);
  document.addEventListener("DOMContentLoaded", safelyInit);

  function safelyInit() {
    if (initialised) return;

    if (typeof isTeachingStaff !== "function") {
      setTimeout(safelyInit, 100);
      return;
    }

    if (!isTeachingStaff()) return;

    initialised = true;
    initWorkFolderManagement();
  }

function initWorkFolderManagement() {
  const saveBtn = document.getElementById("saveWorkFoldersBtn");

  if (saveBtn) {
    saveBtn.addEventListener("click", saveChanges);
  }

  const cancelBtn = document.getElementById("cancelWorkFoldersBtn");

  if (cancelBtn) {
cancelBtn.addEventListener("click", function () {
  renderTable();
  setMessage("", "");
  updateActionButtons();
});
  }

setupSorting();
loadWorkFolders();
updateActionButtons();
}

  function getWebAppUrl() {
    return window.getGlipWebAppUrl();
  }

  function postToGlip(data) {
    return fetch(getWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json();
    });
  }

  function loadWorkFolders(silent) {
    if (!silent) {
      showLoading(true);
      setMessage("", "");
    }

    return postToGlip({
      action: "listMyWorkFolders",
      teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: sessionStorage.getItem("glipRole") || sessionStorage.getItem("glipTeacherRole")
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not load work folders.");
        }

        assignments = result.assignments || [];
        renderTable();
      })
      .catch(function (error) {
        console.error(error);
        setMessage(error.message || "Could not load work folders.", "error");
      })
      .finally(function () {
        if (!silent) showLoading(false);
      });
  }

function isInactive(value) {
  return value === false || String(value).toLowerCase() === "false";
}

function getWarningIcon(message) {
  return '<span class="planning-warning" title="' +
    escapeHtml(message) +
    '">&#9888;</span>';
}

function hasInactiveDependency(item) {
  return (
    item.has_inactive_dependency === true ||
    isInactive(item.level_active) ||
    isInactive(item.class_active) ||
    isInactive(item.curriculum_active)
  );
}


  
function renderTable() {
  const tbody = document.getElementById("workFoldersTableBody");
  const table = document.getElementById("workFoldersTable");

  if (!tbody || !table) return;

  const rows = assignments.slice().sort(compareRows);

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">
          No class folder assignments were found.
        </td>
      </tr>
    `;
    table.style.visibility = "visible";
    updateSortIndicators();
    return;
  }

  tbody.innerHTML = rows.map(function (item) {
    const levelWarning = isInactive(item.level_active)
      ? getWarningIcon("This level is inactive.")
      : "";

    const subjectWarning = isInactive(item.curriculum_active)
      ? getWarningIcon("This subject assignment is inactive.")
      : "";

    const classWarning = isInactive(item.class_active)
      ? getWarningIcon("This class is inactive.")
      : "";

    const rowClass = hasInactiveDependency(item)
      ? ' class="planning-row"'
      : "";

    return `
      <tr${rowClass} data-work-folder-row="${escapeHtml(item.class_teacher_id)}">
        <td>${escapeHtml(formatLevel(item.level || item.level_code))} ${levelWarning}</td>
        <td>${escapeHtml(item.subject_name || item.subject_code || item.subject_id || "")} ${subjectWarning}</td>
        <td>${escapeHtml(item.class_label || item.class_code || "")} ${classWarning}</td>
        <td>
          <input type="url" class="tracker-input work-folder-input" value="${escapeHtml(item.folder_id || "")}" data-work-folder-field="folder_id" data-class-teacher-id="${escapeHtml(item.class_teacher_id)}" placeholder="Work folder URL" />
        </td>
        <td>
          <input type="url" class="tracker-input work-folder-input" value="${escapeHtml(item.class_resources_url || "")}" data-work-folder-field="class_resources_url" data-class-teacher-id="${escapeHtml(item.class_teacher_id)}" placeholder="Class resources URL" />
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-work-folder-field]").forEach(function (input) {
    input.addEventListener("input", markChangedFields);
  });

  table.style.visibility = "visible";
  updateSortIndicators();
  markChangedFields();
}

  function saveChanges() {
    const changes = collectChanges();

    if (!changes.length) {
      setMessage("No changes to save.", "success");
      return;
    }

    showSaving(true);
    setMessage("", "");

    postToGlip({
      action: "updateMyWorkFolders",
      teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: sessionStorage.getItem("glipRole") || sessionStorage.getItem("glipTeacherRole"),
      assignments: changes
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not save folder links.");
        }

        applyChangesLocally(changes);
        renderTable();
        updateActionButtons();
        setMessage(result.message || "Folder links saved.", "success");

        setTimeout(function () {
          loadWorkFolders(true);
        }, 1200);
      })
      .catch(function (error) {
        console.error(error);
        setMessage(error.message || "Could not save folder links.", "error");
      })
      .finally(function () {
        showSaving(false);
      });
  }

  function collectChanges() {
    const changes = [];
    document.querySelectorAll("[data-work-folder-row]").forEach(function (row) {
      const id = row.dataset.workFolderRow;
      const original = assignments.find(function (item) { return String(item.class_teacher_id) === String(id); });
      if (!original) return;
      const folderInput = row.querySelector('[data-work-folder-field="folder_id"]');
      const resourcesInput = row.querySelector('[data-work-folder-field="class_resources_url"]');
      const folderId = String(folderInput ? folderInput.value : "").trim();
      const classResourcesUrl = String(resourcesInput ? resourcesInput.value : "").trim();
      if (folderId !== String(original.folder_id || "").trim() || classResourcesUrl !== String(original.class_resources_url || "").trim()) {
        changes.push({ class_teacher_id: id, folder_id: folderId, class_resources_url: classResourcesUrl });
      }
    });
    return changes;
  }

  function applyChangesLocally(changes) {
    changes.forEach(function (change) {
      const item = assignments.find(function (row) {
        return String(row.class_teacher_id) === String(change.class_teacher_id);
      });

      if (item) {
        item.folder_id = change.folder_id;
        item.class_resources_url = change.class_resources_url;
      }
    });
  }


function markChangedFields() {
  document.querySelectorAll("[data-work-folder-row]").forEach(function (row) {
    const id = row.dataset.workFolderRow;
    const original = assignments.find(function (item) { return String(item.class_teacher_id) === String(id); });
    if (!original) return;
    row.querySelectorAll("[data-work-folder-field]").forEach(function (input) {
      const field = input.dataset.workFolderField;
      input.classList.toggle("teacher-field-changed", String(input.value || "").trim() !== String(original[field] || "").trim());
    });
  });
  updateActionButtons();
}

function updateActionButtons() {
  const saveBtn = document.getElementById("saveWorkFoldersBtn");
  const cancelBtn = document.getElementById("cancelWorkFoldersBtn");

  if (saveBtn) {
    saveBtn.disabled = false;
  }

  if (cancelBtn) {
    cancelBtn.disabled = false;
  }
}



  


  
  function setupSorting() {
    document.querySelectorAll("#workFoldersTable th[data-sort-field]").forEach(function (th) {
      th.addEventListener("click", function () {
        const field = th.dataset.sortField;

        if (sortField === field) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          sortDirection = "asc";
        }

        renderTable();
      });
    });
  }

  function compareRows(a, b) {
    const valueA = getSortValue(a, sortField);
    const valueB = getSortValue(b, sortField);

    if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
    if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;

    return 0;
  }

  function getSortValue(item, field) {
    if (field === "level") return String(item.level || item.level_code || "").toLowerCase();
    if (field === "subject_name") return String(item.subject_name || item.subject_code || "").toLowerCase();
    if (field === "class_code") return String(item.class_code || item.class_label || "").toLowerCase();
    if (field === "folder_id") return String(item.folder_id || "").toLowerCase();
    if (field === "class_resources_url") return String(item.class_resources_url || "").toLowerCase();

    return String(item[field] || "").toLowerCase();
  }

function updateSortIndicators() {
  document.querySelectorAll("#workFoldersTable th[data-sort-field]").forEach(function (th) {
    const label = th.dataset.label || th.textContent.replace(/[▲▼↕]/g, "").trim();

    if (th.dataset.sortField === sortField) {
      th.textContent = label + (sortDirection === "asc" ? " ▲" : " ▼");
    } else {
      th.textContent = label + " ↕";
    }
  });
}

  

  function showLoading(show) {
    const box = document.getElementById("workFoldersLoadingProgress");
    if (box) box.style.display = show ? "block" : "none";
  }

  function showSaving(show) {
    const box = document.getElementById("saveWorkFoldersProgress");
    const btn = document.getElementById("saveWorkFoldersBtn");

    if (box) box.style.display = show ? "block" : "none";
    if (btn) {
  btn.disabled = false;
}
  }

  function setMessage(message, type) {
    const el = document.getElementById("workFolderMessage");
    if (!el) return;

    el.textContent = message || "";
    el.className = "panel-message text-center";

    if (type === "success") el.classList.add("success");
    if (type === "error") el.classList.add("error");
  }

  function formatLevel(level) {
    const match = String(level || "").match(/\d+/);
    return match ? "Level " + Number(match[0]) : String(level || "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (event.detail && event.detail.action === "listMyWorkFolders" && !document.querySelector(".work-folder-field-changed")) loadWorkFolders(true);
  });
})();
