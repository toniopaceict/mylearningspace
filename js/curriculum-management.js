(function () {
  "use strict";

  let levels = [];
  let subjects = [];
  let currentCurriculum = [];
  let curriculumEditMode = false;
  let sortField = "level";
  let sortDirection = "asc";
  let initialised = false;

  function getWebAppUrl() {
    return window.getGlipWebAppUrl();
  }

  function safelyInit() {
    if (initialised) return;

    if (typeof isAdmin !== "function") {
      setTimeout(safelyInit, 100);
      return;
    }

    initialised = true;
    initCurriculumManagement();
  }

  document.addEventListener("glipReady", safelyInit);
  document.addEventListener("DOMContentLoaded", safelyInit);

  function initCurriculumManagement() {
    if (typeof isAdmin !== "function" || !isAdmin()) return;

    const saveBtn = document.getElementById("saveCurriculumBtn");
    const editBtn = document.getElementById("editCurriculumBtn");

    if (saveBtn) saveBtn.addEventListener("click", saveCurriculumItem);
    if (editBtn) editBtn.addEventListener("click", toggleEditMode);

    clearAddMessageOnEdit();
    setupSorting();
    updateSortIndicators();
    setupFilter();
    loadCurriculumData();

    if (typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "curriculum",
        tableName: "Curriculum",
        messageElementId: "curriculumManagementMessage",
        refresh: loadCurriculumData
      });
    }
  }

  function postToGlip(data) {
    return fetch(getWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json();
    });
  }

  function loadCurriculumData() {
    setLoadingState(true);

    postToGlip({
      action: "listCurriculumManagementAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load curriculum data.");
      }

      levels = result.levels || [];
      subjects = result.subjects || [];
      currentCurriculum = result.curriculum || [];
      curriculumEditMode = false;

      populateAddDropdowns();
      updateEditButton();
      renderCurriculum(currentCurriculum);
      setLoadingState(false);
    }).catch(function (error) {
      console.error(error);
      setLoadingState(false);
      setMessage(error.message || "Could not load curriculum data.", "error");
    });
  }

  function populateAddDropdowns() {
    populateLevelDropdown(document.getElementById("newCurriculumLevel"));
    populateSubjectDropdown(document.getElementById("newCurriculumSubject"));
  }

  function populateLevelDropdown(select, selectedValue) {
    if (!select) return;

    select.innerHTML = '<option value="">Select level</option>' +
      levels.map(function (level) {
        const selected = normaliseLevel(level.level_code) === normaliseLevel(selectedValue) ? "selected" : "";
        const label = appendPlanningWarning(
          level.level_name || formatLevel(level.level_code),
          level.active === false
        );

        return '<option value="' + escapeHtml(level.level_code) + '" ' + selected + '>' +
          escapeHtml(label) +
          '</option>';
      }).join("");
  }

  function populateSubjectDropdown(select, selectedValue) {
    if (!select) return;

    select.innerHTML = '<option value="">Select subject</option>' +
      subjects.map(function (subject) {
        const selected = String(subject.subject_code) === String(selectedValue) ? "selected" : "";
        return '<option value="' + escapeHtml(subject.subject_code) + '" ' + selected + '>' +
          escapeHtml(subject.subject_name || subject.subject_code) +
          '</option>';
      }).join("");
  }

function saveCurriculumItem() {
  const level = document.getElementById("newCurriculumLevel").value.trim();
  const subject = document.getElementById("newCurriculumSubject").value.trim();
  const visible = document.getElementById("newCurriculumVisible").value === "true";
  const sortOrderRaw = document.getElementById("newCurriculumSortOrder").value.trim();
  const sortOrder = Number(sortOrderRaw);
  const active = document.getElementById("newCurriculumActive").value === "true";

  if (!level || !subject || !sortOrderRaw) {
    setAddMessage(
      "Please select a level and subject, and enter a valid sort order (1 or greater).",
      "error"
    );
    return;
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    setAddMessage("Sort order must be a whole number of 1 or greater.", "error");
    return;
  }

  setAddSavingState(true);
  setAddMessage("Saving curriculum item...", "info");

  postToGlip({
    action: "addCurriculumAdmin",
    admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
    level: level,
    subject_id: subject,
    visible: visible,
    sort_order: sortOrder,
    active: active
  }).then(function (result) {
    if (!result || result.status !== "success") {
      throw new Error(result.message || "Could not save curriculum item.");
    }

    setAddSavingState(false);
    setAddMessage(result.message || "Curriculum item saved.", "success");
    clearAddForm();
    loadCurriculumData();
  }).catch(function (error) {
    console.error(error);
    setAddSavingState(false);
    setAddMessage(error.message || "Could not save curriculum item.", "error");
  });
}


  

  function toggleEditMode() {
    if (curriculumEditMode) {
      saveCurriculumChanges();
      return;
    }

    curriculumEditMode = true;
    setMessage("", "info");
    updateEditButton();
    renderCurriculum(currentCurriculum);
  }

  function cancelEditMode() {
    curriculumEditMode = false;
    updateEditButton();
    renderCurriculum(currentCurriculum);
    setMessage("", "info");
  }

  function updateEditButton() {
    const editBtn = document.getElementById("editCurriculumBtn");
    if (!editBtn) return;

    editBtn.textContent = curriculumEditMode ? "Save Changes" : "Edit Curriculum";

    let cancelBtn = document.getElementById("cancelCurriculumEditBtn");

    if (curriculumEditMode && !cancelBtn) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelCurriculumEditBtn";
      cancelBtn.className = "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancelEditMode);
      editBtn.insertAdjacentElement("afterend", cancelBtn);
    }

    if (!curriculumEditMode && cancelBtn) cancelBtn.remove();
  }

  function renderCurriculum(items) {
    const tbody = document.getElementById("curriculumTableBody");
    const table = document.getElementById("curriculumTable");
    if (!tbody || !table) return;

    const filteredItems = typeof window.applyGlipTableFilter === "function"
      ? window.applyGlipTableFilter("curriculum", items)
      : items;

    const sortedItems = getSortedCurriculum(filteredItems);

    if (!sortedItems.length) {
      tbody.innerHTML = '<tr><td colspan="6">No curriculum items found.</td></tr>';
      table.style.visibility = "visible";
      return;
    }

    tbody.innerHTML = sortedItems.map(function (item) {
      return curriculumEditMode ? renderEditRow(item) : renderViewRow(item);
    }).join("");

    if (curriculumEditMode) {
      document.querySelectorAll("[data-curriculum-field]").forEach(function (field) {
        field.addEventListener("input", markChangedFields);
        field.addEventListener("change", markChangedFields);
      });
    }

    table.style.visibility = "visible";
  }

    function hasInactiveParentWarning(item) {
    return item && item.level_active === false;
  }

  function appendPlanningWarning(text, showWarning) {
    return String(text || "") + (showWarning ? " ⚠" : "");
  }

  function getCurriculumStatusText(item) {
  if (!isTrue(item.active)) {
    return "Inactive";
  }

  if (hasInactiveParentWarning(item)) {
    return "Active (pending)";
  }

  return "Active";
}

function getCurriculumVisibleText(item) {
  if (!isTrue(item.visible)) {
    return "Hidden";
  }

  if (hasInactiveParentWarning(item)) {
    return "Visible (pending)";
  }

  return "Visible";
}


  

function renderViewRow(item) {
  const planningClass = hasInactiveParentWarning(item) ? "planning-row" : "";

  return '<tr class="' + planningClass + '">' +
    '<td>' + escapeHtml(appendPlanningWarning(formatLevel(item.level), hasInactiveParentWarning(item))) + '</td>' +
    '<td>' + escapeHtml(item.subject_name || item.subject_code || item.subject_id) + '</td>' +
    '<td>' + escapeHtml(getCurriculumVisibleText(item)) + '</td>' +
    '<td>' + escapeHtml(item.sort_order) + '</td>' +
    '<td>' + escapeHtml(getCurriculumStatusText(item)) + '</td>' +
    '</tr>';
}

function renderEditRow(item) {
  const planningClass = hasInactiveParentWarning(item) ? "planning-row" : "";

  return '<tr class="' + planningClass + '" data-curriculum-row="' + escapeHtml(item.curriculum_id) + '">' +
    '<td><select class="tracker-input" data-curriculum-field="level">' + renderLevelOptions(item.level) + '</select></td>' +
    '<td><select class="tracker-input" data-curriculum-field="subject_id">' + renderSubjectOptions(item.subject_code || item.subject_id) + '</select></td>' +
    '<td><select class="tracker-input" data-curriculum-field="visible">' + renderBooleanOptions(item.visible, "Visible", "Hidden") + '</select></td>' +
    '<td><input class="tracker-input" type="number" min="1" step="1" data-curriculum-field="sort_order" value="' + escapeHtml(item.sort_order) + '" /></td>' +
    '<td><select class="tracker-input" data-curriculum-field="active">' + renderBooleanOptions(item.active, "Active", "Inactive") + '</select></td>' +
    '</tr>';
}

  function renderLevelOptions(selectedLevel) {
    return levels.map(function (level) {
      const selected = normaliseLevel(level.level_code) === normaliseLevel(selectedLevel) ? "selected" : "";
      const label = appendPlanningWarning(
        level.level_name || formatLevel(level.level_code),
        level.active === false
      );
      return '<option value="' + escapeHtml(level.level_code) + '" ' + selected + '>' + escapeHtml(label) + '</option>';
    }).join("");
  }

  function renderSubjectOptions(selectedSubject) {
    return subjects.map(function (subject) {
      const selected = String(subject.subject_code) === String(selectedSubject) ? "selected" : "";
      return '<option value="' + escapeHtml(subject.subject_code) + '" ' + selected + '>' + escapeHtml(subject.subject_name || subject.subject_code) + '</option>';
    }).join("");
  }

  function renderBooleanOptions(value, trueLabel, falseLabel) {
    return '<option value="true" ' + (isTrue(value) ? "selected" : "") + '>' + trueLabel + '</option>' +
      '<option value="false" ' + (!isTrue(value) ? "selected" : "") + '>' + falseLabel + '</option>';
  }

  function saveCurriculumChanges() {
    const rows = document.querySelectorAll("[data-curriculum-row]");
    const itemsToSave = [];

    rows.forEach(function (row) {
      const item = { curriculum_id: row.dataset.curriculumRow };

      row.querySelectorAll("[data-curriculum-field]").forEach(function (field) {
        const fieldName = field.dataset.curriculumField;
        if (fieldName === "visible" || fieldName === "active") {
          item[fieldName] = field.value === "true";
        } else {
          item[fieldName] = field.value.trim();
        }
      });

      itemsToSave.push(item);
    });

    setSavingState(true);
    setMessage("Saving curriculum changes...", "info");

    postToGlip({
      action: "updateCurriculumAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      curriculum: itemsToSave
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not save curriculum changes.");
      }

      applyCurriculumUpdatesLocally(itemsToSave);
      curriculumEditMode = false;
      updateEditButton();
      renderCurriculum(currentCurriculum);
      setSavingState(false);
      setMessage("Curriculum changes saved.", "success");
      resyncCurriculumSilently();
    }).catch(function (error) {
      console.error(error);
      setSavingState(false);
      setMessage(error.message || "Could not save curriculum changes.", "error");
    });
  }

  function applyCurriculumUpdatesLocally(itemsToSave) {
    itemsToSave.forEach(function (update) {
      const existing = currentCurriculum.find(function (item) {
        return String(item.curriculum_id) === String(update.curriculum_id);
      });

      if (!existing) return;

      const levelInfo = levels.find(function (level) {
        return normaliseLevel(level.level_code) === normaliseLevel(update.level);
      });

      const subjectInfo = subjects.find(function (subject) {
        return String(subject.subject_code) === String(update.subject_id) ||
          String(subject.subject_id) === String(update.subject_id);
      });

      existing.level = update.level;
      existing.level_active = levelInfo ? levelInfo.active !== false : existing.level_active;
      existing.subject_id = update.subject_id;
      existing.subject_code = subjectInfo ? subjectInfo.subject_code : update.subject_id;
      existing.subject_name = subjectInfo ? subjectInfo.subject_name : existing.subject_name;
      existing.visible = update.visible;
      existing.sort_order = update.sort_order;
      existing.active = update.active;
    });
  }

  function resyncCurriculumSilently() {
    postToGlip({
      action: "listCurriculumManagementAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") return;
      levels = result.levels || [];
      subjects = result.subjects || [];
      currentCurriculum = result.curriculum || [];
      renderCurriculum(currentCurriculum);
    }).catch(function (error) {
      console.warn("Silent curriculum resync failed.", error);
    });
  }

  function setupSorting() {
    document.querySelectorAll("#curriculumTable thead th[data-sort-field]").forEach(function (header) {
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
        renderCurriculum(currentCurriculum);
      });
    });
  }

  function updateSortIndicators() {
    document.querySelectorAll("#curriculumTable thead th[data-sort-field]").forEach(function (header) {
      const field = header.dataset.sortField;
      const label = header.dataset.label;
      header.textContent = field === sortField
        ? label + (sortDirection === "asc" ? " ▲" : " ▼")
        : label + " ↕";
    });
  }

  function getSortedCurriculum(items) {
    return items.slice().sort(function (a, b) {
      const valueA = getSortValue(a, sortField);
      const valueB = getSortValue(b, sortField);
      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  function getSortValue(item, field) {
    if (field === "visible" || field === "active") return isTrue(item[field]) ? 1 : 0;
    if (field === "sort_order") return Number(item.sort_order || 0);
    if (field === "subject") return String(item.subject_name || item.subject_code || "").toLowerCase();
    return String(item[field] || "").toLowerCase();
  }

  function setupFilter() {
    if (typeof window.setupGlipTableFilter !== "function") return;

    window.setupGlipTableFilter({
      filterId: "curriculum",
      tableId: "curriculumTable",
      fields: [
        { value: "level", label: "Level", getValue: function (item) { return formatLevel(item.level); } },
        { value: "subject", label: "Subject", getValue: function (item) { return item.subject_name || item.subject_code || ""; } },
        { value: "visible", label: "Visible", getValue: function (item) { return getCurriculumVisibleText(item); } },
        { value: "active", label: "Status", getValue: function (item) { return getCurriculumStatusText(item); } }
      ],
      onChange: function () {
        renderCurriculum(currentCurriculum);
      }
    });
  }

  function markChangedFields() {
    document.querySelectorAll("[data-curriculum-row]").forEach(function (row) {
      const id = row.dataset.curriculumRow;
      const original = currentCurriculum.find(function (item) {
        return String(item.curriculum_id) === String(id);
      });
      if (!original) return;

      row.querySelectorAll("[data-curriculum-field]").forEach(function (field) {
        const name = field.dataset.curriculumField;
        let currentValue = field.value;
        let originalValue = original[name];

        if (name === "level") originalValue = normaliseLevel(original.level);
        if (name === "visible" || name === "active") originalValue = isTrue(originalValue) ? "true" : "false";
        if (name === "subject_id") originalValue = original.subject_code || original.subject_id;

        field.classList.toggle("teacher-field-changed", String(currentValue).trim() !== String(originalValue || "").trim());
      });
    });
  }

  function clearAddForm() {
    document.getElementById("newCurriculumLevel").value = "";
    document.getElementById("newCurriculumSubject").value = "";
    document.getElementById("newCurriculumVisible").value = "true";
    document.getElementById("newCurriculumSortOrder").value = "";
    document.getElementById("newCurriculumActive").value = "true";
  }

  function clearAddMessageOnEdit() {
    document.querySelectorAll("#addCurriculumPanel input, #addCurriculumPanel select").forEach(function (field) {
      field.addEventListener("input", function () { setAddMessage("", "info"); });
      field.addEventListener("change", function () { setAddMessage("", "info"); });
    });
  }

  function setMessage(text, type) {
    const message = document.getElementById("curriculumManagementMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
  }

  function setAddMessage(text, type) {
    const message = document.getElementById("addCurriculumMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = "panel-message add-teacher-message " + (type || "info");
  }

  function setLoadingState(isLoading) {
    const loadingBox = document.getElementById("curriculumLoadingProgress");
    const table = document.getElementById("curriculumTable");
    if (loadingBox) loadingBox.style.display = isLoading ? "block" : "none";
    if (table) table.style.visibility = isLoading ? "hidden" : "visible";
  }

  function setAddSavingState(isSaving) {
    const btn = document.getElementById("saveCurriculumBtn");
    const progressBox = document.getElementById("saveCurriculumProgress");
    if (btn) {
      btn.disabled = isSaving;
      btn.textContent = isSaving ? "Saving..." : "Save Curriculum Item";
    }
    if (progressBox) progressBox.style.display = isSaving ? "block" : "none";
  }

  function setSavingState(isSaving) {
    const btn = document.getElementById("editCurriculumBtn");
    const cancelBtn = document.getElementById("cancelCurriculumEditBtn");
    const progressBox = document.getElementById("saveCurriculumChangesProgress");
    if (btn) {
      btn.disabled = isSaving;
      btn.textContent = isSaving ? "Saving..." : curriculumEditMode ? "Save Changes" : "Edit Curriculum";
    }
    if (cancelBtn) cancelBtn.disabled = isSaving;
    if (progressBox) progressBox.style.display = isSaving ? "block" : "none";
  }

  function normaliseLevel(value) {
    const text = String(value || "").trim().toLowerCase();
    const match = text.match(/\d+/);
    return match ? "level-" + match[0].padStart(2, "0") : text;
  }

  function formatLevel(level) {
    const match = String(level || "").match(/\d+/);
    return match ? "Level " + Number(match[0]) : String(level || "");
  }

  function isTrue(value) {
    return value === true || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "yes" || String(value) === "1";
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
