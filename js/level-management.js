(function () {
  "use strict";

  let levels = [];
  let editMode = false;
  let sortField = "sort_order";
  let sortDirection = "asc";
  let initialised = false;
  let pendingLevelSaves = 0;

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

  function safelyInit() {
    if (initialised) return;

    if (typeof isAdmin !== "function") {
      setTimeout(safelyInit, 100);
      return;
    }

    initialised = true;
    initLevelManagement();
  }

  document.addEventListener("glipReady", safelyInit);
  document.addEventListener("DOMContentLoaded", safelyInit);

  function initLevelManagement() {
    if (!isAdmin()) return;

    document.getElementById("saveLevelBtn")?.addEventListener("click", saveLevel);
    document.getElementById("editLevelsBtn")?.addEventListener("click", toggleEditMode);

    document.getElementById("newLevelCode")?.addEventListener("input", clearAddLevelMessage);
    document.getElementById("newLevelName")?.addEventListener("input", clearAddLevelMessage);
    document.getElementById("newLevelSortOrder")?.addEventListener("input", clearAddLevelMessage);
    document.getElementById("newLevelActive")?.addEventListener("change", clearAddLevelMessage);

    setupSorting();
    updateSortIndicators();
    loadLevels();

    if (typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "levels",
        tableName: "Levels",
        messageElementId: "levelManagementMessage",
        refresh: loadLevels,
        hideClear: true
      });
    }
  }

  function setupSorting() {
    document.querySelectorAll("#levelsTable thead th[data-sort-field]").forEach(function (header) {
      header.style.cursor = "pointer";

      header.addEventListener("click", function () {
        const field = header.dataset.sortField;

        if (sortField === field) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          sortDirection = "asc";
        }

        updateSortIndicators();
        renderLevels();
      });
    });
  }

  function updateSortIndicators() {
    document.querySelectorAll("#levelsTable thead th[data-sort-field]").forEach(function (header) {
      const field = header.dataset.sortField;
      const label = header.dataset.label;

      header.textContent = field === sortField
        ? label + (sortDirection === "asc" ? " ▲" : " ▼")
        : label + " ↕";
    });
  }

function setLevelsLoadingState(isLoading) {
  const loadingBox = document.getElementById("levelsLoadingProgress");
  const table = document.getElementById("levelsTable");

  if (loadingBox) {
    loadingBox.style.display = isLoading ? "block" : "none";
  }

  if (table) {
    table.style.visibility = isLoading ? "hidden" : "visible";
  }
}

  

  function setMessage(text, type) {
    const message = document.getElementById("levelManagementMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
  }

  function setAddMessage(text, type) {
    const message = document.getElementById("addLevelMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message text-center " + (type || "info");
  }

  function clearAddLevelMessage() {
    setAddMessage("", "info");
  }

  function loadLevels() {
  setLevelsLoadingState(true);
    postToGlip({
      action: "listLevelsManagementAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load levels.");
      }
      setLevelsLoadingState(false);
      levels = GLIPOptimisticUpdate.mergePendingRows(result.levels || [], levels, "level_id");
      editMode = false;
      updateEditButton();
      renderLevels();
    }).catch(function (error) {
      setLevelsLoadingState(false);
      console.error(error);
      setMessage(error.message || "Could not load levels.", "error");
    });
  }

  function getSortedLevels() {
    return levels.slice().sort(function (a, b) {
      let valueA = a[sortField];
      let valueB = b[sortField];

      if (sortField === "sort_order") {
        valueA = Number(valueA || 0);
        valueB = Number(valueB || 0);
      } else if (sortField === "active") {
        valueA = a.active ? 1 : 0;
        valueB = b.active ? 1 : 0;
      } else {
        valueA = String(valueA || "").toLowerCase();
        valueB = String(valueB || "").toLowerCase();
      }

      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  function renderLevels() {
    const tbody = document.getElementById("levelsTableBody");
    if (!tbody) return;

    const rows = getSortedLevels();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">No levels found.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (level) {
      return editMode ? renderEditRow(level) : renderViewRow(level);
    }).join("");

    if (editMode) {
      document.querySelectorAll("[data-level-field]").forEach(function (field) {
        field.addEventListener("input", markChangedFields);
        field.addEventListener("change", markChangedFields);
      });
    }
  }

function renderViewRow(level) {
  const planningClass = level.active === false ? "planning-row" : "";

  return `
    <tr class="${planningClass}">
      <td>${escapeHtml(level.level_code)}</td>
      <td>${escapeHtml(level.level_name)}</td>
      <td>${escapeHtml(level.sort_order)}</td>
      <td>${level.active ? "Active" : "Inactive"}</td>
    </tr>
  `;
}

function renderEditRow(level) {
  const planningClass = level.active === false ? "planning-row" : "";

  return `
    <tr class="${planningClass}" data-level-row="${escapeHtml(level.level_id)}">
      <td>
        <input class="tracker-input" data-level-field="level_code" value="${escapeHtml(level.level_code)}" />
      </td>
      <td>
        <input class="tracker-input" data-level-field="level_name" value="${escapeHtml(level.level_name)}" />
      </td>
      <td>
        <input class="tracker-input" type="number" min="1" step="1" data-level-field="sort_order" value="${escapeHtml(level.sort_order)}" />
      </td>
      <td>
        <select class="tracker-input" data-level-field="active">
          <option value="true" ${level.active ? "selected" : ""}>Active</option>
          <option value="false" ${!level.active ? "selected" : ""}>Inactive</option>
        </select>
      </td>
    </tr>
  `;
}

function saveLevel() {
  const levelCode = document
    .getElementById("newLevelCode")
    .value.trim();

  const levelName = document
    .getElementById("newLevelName")
    .value.trim();

  const sortOrderRaw = document
    .getElementById("newLevelSortOrder")
    .value.trim();

  const sortOrder = Number(sortOrderRaw);

  const active =
    document.getElementById("newLevelActive").value === "true";

  if (!levelCode || !levelName || !sortOrderRaw) {
    setAddMessage(
      "Level code, level name and sort order are required.",
      "error"
    );
    return;
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    setAddMessage(
      "Sort order must be a whole number of 1 or greater.",
      "error"
    );
    return;
  }

  const duplicate = levels.some(function (level) {
    return String(level.level_code || "")
      .trim()
      .toLowerCase() === levelCode.toLowerCase();
  });

  if (duplicate) {
    setAddMessage("This level code already exists.", "error");
    return;
  }

  setAddMessage("", "info");

  const temporaryId = "pending-level-" + Date.now();

  const confirmedLevel = { level_id: temporaryId, level_code: levelCode, level_name: levelName, sort_order: sortOrder, active: active };
  pendingLevelSaves += 1;
  updateEditButton();

  GLIPOptimisticUpdate.run({
    request: function () {
      return postToGlip({
        action: "addLevelAdmin",
        admin_teacher_id:
          sessionStorage.getItem("glipTeacherId"),
        level_code: levelCode,
        level_name: levelName,
        sort_order: sortOrder,
        active: active
      });
    },

    failureMessage: "Could not save level.",
    apply: function (result) {
      confirmedLevel.level_id = result.level_id || confirmedLevel.level_id;
      levels.push(confirmedLevel);
      document.getElementById("newLevelCode").value = "";
      document.getElementById("newLevelName").value = "";
      document.getElementById("newLevelSortOrder").value = "";
      document.getElementById("newLevelActive").value = "true";
      renderLevels();
    },

    onSuccess: function (result) {
      pendingLevelSaves = Math.max(0, pendingLevelSaves - 1);
      updateEditButton();
      renderLevels();

      setAddMessage(
        result.message || "Level added successfully.",
        "success"
      );
    },

    resync: resyncLevelsSilently,

    rollback: function () {
      levels = levels.filter(function (level) {
        return String(level.level_id) !== temporaryId;
      });

      pendingLevelSaves = Math.max(0, pendingLevelSaves - 1);
      updateEditButton();
      renderLevels();
    },

    onFailure: function (error) {
      setAddMessage(
        error.message ||
          "Could not save level. The temporary row was removed.",
        "error"
      );
    }
  });
}

function toggleEditMode() {
  if (pendingLevelSaves > 0) {
    setMessage(
      "Please wait until the new level has finished saving.",
      "info"
    );
    return;
  }

  if (editMode) {
    saveChanges();
    return;
  }

  setMessage("", "info");

  editMode = true;
  updateEditButton();
  renderLevels();
}

function updateEditButton() {
  const btn = document.getElementById("editLevelsBtn");
  if (!btn) return;

const hasPendingSaves = pendingLevelSaves > 0;

btn.disabled = hasPendingSaves;
btn.textContent = editMode ? "Save Changes" : "Edit Levels";

btn.title = hasPendingSaves
  ? "Please wait until the new level has finished saving."
  : "";

  let cancelBtn = document.getElementById("cancelLevelsEditBtn");

  if (editMode && !cancelBtn && !hasPendingSaves) {
    cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "cancelLevelsEditBtn";
    cancelBtn.className =
      "glip-btn glip-btn-secondary teacher-cancel-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.marginLeft = "8px";

    cancelBtn.addEventListener("click", function () {
      editMode = false;
      updateEditButton();
      renderLevels();
      setMessage("", "info");
    });

    btn.insertAdjacentElement("afterend", cancelBtn);
  }

  if ((!editMode || hasPendingSaves) && cancelBtn) {
    cancelBtn.remove();
  }
}

  function markChangedFields() {
    setMessage("", "info");

    document.querySelectorAll("[data-level-row]").forEach(function (row) {
      const levelId = row.dataset.levelRow;
      const original = levels.find(function (level) {
        return String(level.level_id) === String(levelId);
      });

      if (!original) return;

      row.querySelectorAll("[data-level-field]").forEach(function (field) {
        const fieldName = field.dataset.levelField;
        let originalValue = original[fieldName];

        if (fieldName === "active") {
          originalValue = original.active ? "true" : "false";
        }

        field.classList.toggle(
          "teacher-field-changed",
          String(field.value).trim() !== String(originalValue || "").trim()
        );
      });
    });
  }

  function saveChanges() {
    const rows = document.querySelectorAll("[data-level-row]");
    const updates = [];
    rows.forEach(function (row) {
      const item = { level_id: row.dataset.levelRow };
      row.querySelectorAll("[data-level-field]").forEach(function (field) {
        item[field.dataset.levelField] = field.dataset.levelField === "active" ? field.value === "true" : field.value.trim();
      });
      updates.push(item);
    });

    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "updateLevelsAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), levels: updates }); },
      failureMessage: "Could not save level changes.",
      apply: function () { applyLevelUpdatesLocally(updates); editMode = false; updateEditButton(); renderLevels(); },
      onSuccess: function (result) { setMessage(result.message || "Level changes saved.", "success"); },
      resync: resyncLevelsSilently,
      rollback: function () { levels = previousLevels; renderLevels(); },
      onFailure: function (error) { setMessage(error.message || "Could not save level changes. The previous values were restored.", "error"); }
    });
  }

  function applyLevelUpdatesLocally(updates) {
    updates.forEach(function (update) {
      const existing = levels.find(function (level) {
        return String(level.level_id) === String(update.level_id);
      });

      if (!existing) return;

      existing.level_code = update.level_code;
      existing.level_name = update.level_name;
      existing.sort_order = update.sort_order;
      existing.active = update.active;
    });
  }

  function resyncLevelsSilently() {
    postToGlip({
      action: "listLevelsManagementAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") return;
      levels = GLIPOptimisticUpdate.mergePendingRows(result.levels || [], levels, "level_id");
      renderLevels();
    }).catch(function (error) {
      console.warn("Silent level resync failed.", error);
    });
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (event.detail && event.detail.action === "listLevelsManagementAdmin" && !editMode) loadLevels();
  });
})();
