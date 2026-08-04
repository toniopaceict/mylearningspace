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
    const role = String(sessionStorage.getItem("glipUserType") || "").toLowerCase();
    const isLeadTeacher = role === "lead_teacher";
    if (typeof isAdmin !== "function" || (!isAdmin() && !isLeadTeacher)) return;

    const addPanel = document.getElementById("addCurriculumPanel");
    if (addPanel && isLeadTeacher) addPanel.style.display = "none";

    const saveBtn = document.getElementById("saveCurriculumBtn");
    const editBtn = document.getElementById("editCurriculumBtn");

    if (saveBtn) saveBtn.addEventListener("click", saveCurriculumItem);
    if (editBtn) editBtn.addEventListener("click", toggleEditMode);

    clearAddMessageOnEdit();
    setupSorting();
    updateSortIndicators();
    setupFilter();
    loadCurriculumData();

    if (isAdmin() && typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "curriculum",
        tableName: "SubjectAssignments",
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
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: sessionStorage.getItem("glipUserType")
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load subject assignment data.");
      }

      levels = result.levels || [];
      subjects = result.subjects || [];
      currentCurriculum = GLIPOptimisticUpdate.mergePendingRows(result.curriculum || [], currentCurriculum, "curriculum_id");
      curriculumEditMode = false;

      populateAddDropdowns();
      updateEditButton();
      renderCurriculum(currentCurriculum);
      setLoadingState(false);
    }).catch(function (error) {
      console.error(error);
      setLoadingState(false);
      setMessage(error.message || "Could not load subject assignment data.", "error");
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
      subjects.filter(function (subject) { return subject.active !== false; }).map(function (subject) {
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


  const temporaryId = "pending-curriculum-" + Date.now();
  const levelInfo = levels.find(function (item) { return normaliseLevel(item.level_code) === normaliseLevel(level); }) || {};
  const subjectInfo = subjects.find(function (item) { return String(item.subject_code) === String(subject) || String(item.subject_id) === String(subject); }) || {};
  const confirmedCurriculum = { curriculum_id: temporaryId, level: level, level_active: levelInfo.active !== false, subject_id: subjectInfo.subject_id || subject, subject_code: subjectInfo.subject_code || subject, subject_name: subjectInfo.subject_name || subject, subject_active: subjectInfo.active !== false, visible: visible, sort_order: sortOrder, active: active };

  GLIPOptimisticUpdate.run({
    request: function () { return postToGlip({ action: "addCurriculumAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), level: level, subject_id: subject, visible: visible, sort_order: sortOrder, active: active }); },
    failureMessage: "Could not save subject assignment.",
    apply: function (result) { confirmedCurriculum.curriculum_id = result.curriculum_id || confirmedCurriculum.curriculum_id; currentCurriculum.push(confirmedCurriculum); clearAddForm(); renderCurriculum(currentCurriculum); },
    onSuccess: function (result) { const row = currentCurriculum.find(function (item) { return item.curriculum_id === temporaryId; }); if (row) { row.curriculum_id = result.curriculum_id || row.curriculum_id; GLIPOptimisticUpdate.markSaved(row); } setAddMessage(result.message || "Subject assignment saved.", "success"); },
    resync: resyncCurriculumSilently,
    rollback: function () { currentCurriculum = currentCurriculum.filter(function (item) { return item.curriculum_id !== temporaryId; }); renderCurriculum(currentCurriculum); },
    onFailure: function (error) { setAddMessage(error.message || "Could not save subject assignment. The temporary row was removed.", "error"); }
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

    editBtn.textContent = curriculumEditMode ? "Save Changes" : "Edit Subjects";

    let cancelBtn = document.getElementById("cancelCurriculumEditBtn");

    if (curriculumEditMode && !cancelBtn) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelCurriculumEditBtn";
      cancelBtn.className = "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.marginLeft = "8px";
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
      tbody.innerHTML = '<tr><td colspan="6">No subject assignments found.</td></tr>';
      table.style.visibility = "visible";
      return;
    }

    tbody.innerHTML = sortedItems.map(function (item) {
      return curriculumEditMode ? renderEditRow(item) : renderViewRow(item);
    }).join("");

    if (curriculumEditMode) {
      document.querySelectorAll("[data-curriculum-field]").forEach(function (field) {
    field.addEventListener("input", function () {
      markChangedField(field);
    });
    
    field.addEventListener("change", function () {
      markChangedField(field);
    });
      });
    }

    table.style.visibility = "visible";
  }

  function getSubjectRecord(item) {
    if (!item) return null;

    return subjects.find(function (subject) {
      return String(subject.subject_id) === String(item.subject_id) ||
        String(subject.subject_code) === String(item.subject_code || item.subject_id);
    }) || null;
  }

  function getPlanningWarnings(item) {
    const subject = getSubjectRecord(item);
    const levelInactive = !!(item && item.level_active === false);
    const subjectInactive = !!(
      item && item.subject_active === false ||
      subject && subject.active === false
    );

    return {
      level: levelInactive,
      subject: subjectInactive,
      any: levelInactive || subjectInactive
    };
  }

  function hasInactiveParentWarning(item) {
    return getPlanningWarnings(item).any;
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
  const warnings = getPlanningWarnings(item);
  const planningClass = (warnings.any || !isTrue(item.active)) ? "planning-row" : "";

  return '<tr class="' + planningClass + '">' +
    '<td>' + escapeHtml(appendPlanningWarning(formatLevel(item.level), warnings.level)) + '</td>' +
    '<td>' + escapeHtml(appendPlanningWarning(item.subject_name || item.subject_code || item.subject_id, warnings.subject)) + '</td>' +
    '<td>' + escapeHtml(getCurriculumVisibleText(item)) + '</td>' +
    '<td>' + escapeHtml(item.sort_order) + '</td>' +
    '<td>' + escapeHtml(getCurriculumStatusText(item)) + '</td>' +
    '</tr>';
}

function renderEditRow(item) {
  const warnings = getPlanningWarnings(item);
  const planningClass = (warnings.any || !isTrue(item.active)) ? "planning-row" : "";

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
      const label = appendPlanningWarning(
        subject.subject_name || subject.subject_code,
        subject.active === false
      );
      return '<option value="' + escapeHtml(subject.subject_code) + '" ' + selected + '>' + escapeHtml(label) + '</option>';
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

    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "updateCurriculumAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), teacher_id: sessionStorage.getItem("glipTeacherId"), role: sessionStorage.getItem("glipUserType"), curriculum: itemsToSave }); },
      failureMessage: "Could not save subject changes.",
      apply: function () {
        applyCurriculumUpdatesLocally(itemsToSave);
        curriculumEditMode = false;
        updateEditButton();
        renderCurriculum(currentCurriculum);
      },
      onSuccess: function (result) { setMessage(result.message || "Subject changes saved.", "success"); },
      resync: resyncCurriculumSilently,
      rollback: function () { currentCurriculum = previousCurriculum; renderCurriculum(currentCurriculum); },
      onFailure: function (error) { setMessage(error.message || "Could not save subject changes. The previous values were restored.", "error"); }
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
      existing.subject_active = subjectInfo ? subjectInfo.active !== false : existing.subject_active;
      existing.visible = update.visible;
      existing.sort_order = update.sort_order;
      existing.active = update.active;
    });
  }

  function resyncCurriculumSilently() {
    postToGlip({
      action: "listCurriculumManagementAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: sessionStorage.getItem("glipUserType")
    }).then(function (result) {
      if (!result || result.status !== "success") return;
      levels = result.levels || [];
      subjects = result.subjects || [];
      currentCurriculum = GLIPOptimisticUpdate.mergePendingRows(result.curriculum || [], currentCurriculum, "curriculum_id");
      renderCurriculum(currentCurriculum);
    }).catch(function (error) {
      console.warn("Silent subject resync failed.", error);
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

function markChangedField(field) {
  const row = field.closest("[data-curriculum-row]");
  if (!row) return;

  const id = row.dataset.curriculumRow;

  const original = currentCurriculum.find(function (item) {
    return String(item.curriculum_id) === String(id);
  });

  if (!original) return;

  const name = field.dataset.curriculumField;

  let currentValue = String(field.value).trim();
  let originalValue = original[name];

  if (name === "level") {
    originalValue = normaliseLevel(original.level);
  } else if (name === "subject_id") {
    originalValue = original.subject_code || original.subject_id;
  } else if (name === "visible" || name === "active") {
    originalValue = isTrue(originalValue) ? "true" : "false";
  }

  field.classList.toggle(
    "teacher-field-changed",
    currentValue !== String(originalValue || "").trim()
  );
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
      btn.textContent = isSaving ? "Saving..." : "Save Subject Assignment";
    }
    if (progressBox) progressBox.style.display = isSaving ? "block" : "none";
  }

  function setSavingState(isSaving) {
    const btn = document.getElementById("editCurriculumBtn");
    const cancelBtn = document.getElementById("cancelCurriculumEditBtn");
    const progressBox = document.getElementById("saveCurriculumChangesProgress");
    if (btn) {
      btn.disabled = isSaving;
      btn.textContent = isSaving ? "Saving..." : curriculumEditMode ? "Save Changes" : "Edit Subjects";
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

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (event.detail && event.detail.action === "listCurriculumManagementAdmin" && !curriculumEditMode) loadCurriculumData();
  });
})();
