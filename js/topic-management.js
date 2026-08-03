(function () {
  "use strict";

  let curriculum = [];
  let topics = [];
  let assignments = [];
  let editMode = false;
  let sortField = "level";
  let sortDirection = "asc";
  let initialised = false;

  function getWebAppUrl() {
    return window.getGlipWebAppUrl();
  }

  function safelyInit() {
    if (initialised) return;

    if (typeof getCurrentRole !== "function") {
      setTimeout(safelyInit, 100);
      return;
    }

    initialised = true;
    initCurriculumTopicManagement();
  }

  document.addEventListener("glipReady", safelyInit);
  document.addEventListener("DOMContentLoaded", safelyInit);

  function initCurriculumTopicManagement() {
    const role = getRole();

    if (role !== "owner" && role !== "admin" && role !== "lead_teacher") return;

    document.getElementById("saveCurriculumTopicBtn").addEventListener("click", addAssignment);
    document.getElementById("cancelAddCurriculumTopicBtn").addEventListener("click", cancelAddAssignment);
    document.getElementById("newCurriculumTopicCurriculum").addEventListener("change", updateTopicDropdownForSelectedCurriculum);
    document.getElementById("editCurriculumTopicBtn").addEventListener("click", toggleEditMode);

    setupSorting();
    setupFilter();
    loadData();
  }

  function postToGlip(data) {
    return fetch(getWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json();
    });
  }

  function loadData() {
    setLoadingState(true);

    postToGlip({
      action: "getCurriculumTopicManagement",
      teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getRole()
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load topic assignments.");
      }

      const role = getRole();
      curriculum = result.curriculum || [];
      topics = (result.topics || []).filter(function (item) {
        return role === "owner" || item.active !== false;
      });
      assignments = GLIPOptimisticUpdate.mergePendingRows((result.assignments || []).filter(function (item) {
        return role === "owner" || item.topic_active !== false;
      }), assignments, "curriculum_topic_id");
      editMode = false;

      populateAddDropdowns();
      updateEditButton();
      renderAssignments();
      setLoadingState(false);
    }).catch(function (error) {
      console.error(error);
      setLoadingState(false);
      setMessage(error.message || "Could not load topic assignments.", "error");
    });
  }

      function populateAddDropdowns() {
        const curriculumSelect = document.getElementById("newCurriculumTopicCurriculum");
      
        curriculumSelect.innerHTML = '<option value="">Select level and subject</option>' +
          curriculum.map(function (item) {
            const warning = item.has_inactive_dependency === true;
      
            return '<option value="' + escapeHtml(item.curriculum_id) + '">' +
              escapeHtml(
                appendPlanningWarning(
                  formatLevel(item.level) + " – " + (item.subject_name || item.subject_code),
                  warning
                )
              ) +
              '</option>';
          }).join("");
      
        updateTopicDropdownForSelectedCurriculum();
      }

  function updateTopicDropdownForSelectedCurriculum() {
  const curriculumSelect = document.getElementById("newCurriculumTopicCurriculum");
  const topicSelect = document.getElementById("newCurriculumTopicTopic");

  const selectedCurriculumId = curriculumSelect.value;

  const selectedCurriculum = curriculum.find(function (item) {
    return String(item.curriculum_id) === String(selectedCurriculumId);
  });

  if (!selectedCurriculum) {
    topicSelect.innerHTML = '<option value="">Select topic</option>';
    return;
  }

  const matchingTopics = topics.filter(function (topic) {
    return topic.active === true &&
      String(topic.subject_id) === String(selectedCurriculum.subject_pk);
  });

  topicSelect.innerHTML = '<option value="">Select topic</option>' +
    matchingTopics.map(function (topic) {
      return '<option value="' + escapeHtml(topic.topic_id) + '">' +
        escapeHtml(topic.topic_name || topic.topic_code) +
        '</option>';
    }).join("");
}

  
  function addAssignment() {
    const curriculumId = document.getElementById("newCurriculumTopicCurriculum").value;
    const topicId = document.getElementById("newCurriculumTopicTopic").value;
    const visible = document.getElementById("newCurriculumTopicVisible").value === "true";
    const sortOrderRaw = document.getElementById("newCurriculumTopicSortOrder").value.trim();
    const sortOrder = Number(sortOrderRaw);
    const active = document.getElementById("newCurriculumTopicActive").value === "true";
    if (!curriculumId || !topicId || !sortOrderRaw) { setAddMessage("Please select a level/subject, select a topic and enter a sort order.", "error"); return; }
    if (!Number.isInteger(sortOrder) || sortOrder < 1) { setAddMessage("Sort order must be a whole number of 1 or greater.", "error"); return; }
    const curriculumInfo = curriculum.find(function (item) { return String(item.curriculum_id) === String(curriculumId); }) || {};
    const topicInfo = topics.find(function (item) { return String(item.topic_id) === String(topicId); }) || {};
    const temporaryId = "pending-topic-assignment-" + Date.now();
    const confirmedAssignment = { curriculum_topic_id: temporaryId, curriculum_id: curriculumId, topic_id: topicId, level: curriculumInfo.level, level_active: curriculumInfo.level_active !== false, subject_id: curriculumInfo.subject_id, subject_code: curriculumInfo.subject_code, subject_name: curriculumInfo.subject_name, curriculum_active: curriculumInfo.active !== false, topic_code: topicInfo.topic_code, topic_name: topicInfo.topic_name, visible: visible, sort_order: sortOrder, active: active, pending_save: true, pending_state: "saving" };
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "addCurriculumTopicManagement", teacher_id: sessionStorage.getItem("glipTeacherId"), role: getRole(), curriculum_id: curriculumId, topic_id: topicId, visible: visible, sort_order: sortOrder, active: active }); },
      failureMessage: "Could not save topic assignment.",
      apply: function (result) { confirmedAssignment.curriculum_topic_id = result.curriculum_topic_id || confirmedAssignment.curriculum_topic_id; assignments.push(confirmedAssignment); clearAddForm(); renderAssignments(); },
      onSuccess: function (result) { const row = assignments.find(function (item) { return String(item.curriculum_topic_id) === temporaryId; }); if (row) { row.curriculum_topic_id = result.curriculum_topic_id || row.curriculum_topic_id; GLIPOptimisticUpdate.markSaved(row); } setAddMessage(result.message || "Topic assignment saved.", "success"); },
      resync: resyncSilently,
      rollback: function () { assignments = assignments.filter(function (item) { return String(item.curriculum_topic_id) !== temporaryId; }); renderAssignments(); },
      onFailure: function (error) { setAddMessage(error.message || "Could not save topic assignment. The temporary row was removed.", "error"); }
    });
  }

  function toggleEditMode() {
    if (editMode) {
      saveChanges();
      return;
    }

    editMode = true;
    setMessage("", "info");
    updateEditButton();
    renderAssignments();
  }

  function cancelEditMode() {
    editMode = false;
    updateEditButton();
    renderAssignments();
    setMessage("", "info");
  }

  function updateEditButton() {
    const editBtn = document.getElementById("editCurriculumTopicBtn");
    if (!editBtn) return;

    editBtn.textContent = editMode ? "Save Changes" : "Edit Topic Assignments";

    let cancelBtn = document.getElementById("cancelCurriculumTopicEditBtn");

    if (editMode && !cancelBtn) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelCurriculumTopicEditBtn";
      cancelBtn.className = "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancelEditMode);
      editBtn.insertAdjacentElement("afterend", cancelBtn);
    }

    if (!editMode && cancelBtn) cancelBtn.remove();
  }

  function renderAssignments() {
    const tbody = document.getElementById("curriculumTopicTableBody");
    const table = document.getElementById("curriculumTopicTable");
    if (!tbody || !table) return;

    const filtered = typeof window.applyGlipTableFilter === "function"
  ? window.applyGlipTableFilter("curriculumTopic", assignments)
  : assignments;

  const sorted = getSortedAssignments(filtered);

    if (!sorted.length) {
      tbody.innerHTML = '<tr><td colspan="6">No topic assignments found.</td></tr>';
      table.style.visibility = "visible";
      return;
    }

    tbody.innerHTML = sorted.map(function (item) {
      return editMode ? renderEditRow(item) : renderViewRow(item);
    }).join("");

    if (editMode) {
      document.querySelectorAll("[data-curriculum-topic-field]").forEach(function (field) {
        field.addEventListener("input", markChangedFields);
        field.addEventListener("change", markChangedFields);
      });
    }

    table.style.visibility = "visible";
  }

function renderViewRow(item) {
  const warnings = getPlanningWarnings(item);
  const planningClass = warnings.any ? "planning-row" : "";

  return '<tr class="' + planningClass + '">' +
    '<td>' + escapeHtml(appendPlanningWarning(formatLevel(item.level), warnings.level)) + '</td>' +
    '<td>' + escapeHtml(appendPlanningWarning(item.subject_name || item.subject_code, warnings.subject)) + '</td>' +
    '<td>' + escapeHtml(appendPlanningWarning(item.topic_name || item.topic_code, warnings.topic)) + '</td>' +
    '<td>' + escapeHtml(getCurriculumTopicVisibleText(item)) + '</td>' +
    '<td>' + escapeHtml(item.sort_order) + '</td>' +
    '<td>' + escapeHtml(getCurriculumTopicStatusText(item)) + '</td>' +
    '</tr>';
}

  function renderEditRow(item) {
    const warnings = getPlanningWarnings(item);
    const planningClass = warnings.any ? "planning-row" : "";

    return '<tr class="' + planningClass + '" data-curriculum-topic-row="' + escapeHtml(item.curriculum_topic_id) + '">' +
      '<td>' + escapeHtml(appendPlanningWarning(formatLevel(item.level), warnings.level)) + '</td>' +
      '<td>' + escapeHtml(appendPlanningWarning(item.subject_name || item.subject_code, warnings.subject)) + '</td>' +
      '<td>' + escapeHtml(appendPlanningWarning(item.topic_name || item.topic_code, warnings.topic)) + '</td>' +
      '<td><select class="tracker-input" data-curriculum-topic-field="visible">' + renderBooleanOptions(item.visible, "Visible", "Hidden") + '</select></td>' +
      '<td><input class="tracker-input" type="number" min="1" step="1" data-curriculum-topic-field="sort_order" value="' + escapeHtml(item.sort_order) + '" /></td>' +
      '<td><select class="tracker-input" data-curriculum-topic-field="active">' + renderBooleanOptions(item.active, "Active", "Inactive") + '</select></td>' +
      '</tr>';
  }

  function saveChanges() {
    const rows = document.querySelectorAll("[data-curriculum-topic-row]"); const itemsToSave = [];
    rows.forEach(function (row) {
      const item = { curriculum_topic_id: row.dataset.curriculumTopicRow };
      row.querySelectorAll("[data-curriculum-topic-field]").forEach(function (field) { const name = field.dataset.curriculumTopicField; item[name] = name === "visible" || name === "active" ? field.value === "true" : field.value.trim(); });
      itemsToSave.push(item);
    });
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "updateCurriculumTopicManagement", teacher_id: sessionStorage.getItem("glipTeacherId"), role: getRole(), assignments: itemsToSave }); },
      failureMessage: "Could not save topic assignments.",
      onSuccess: function (result) { setMessage(result.message || "Topic assignments saved.", "success"); },
      resync: resyncSilently,
      rollback: function () { assignments = previousAssignments; renderAssignments(); },
      onFailure: function (error) { setMessage(error.message || "Could not save topic assignments. The previous values were restored.", "error"); }
    });
  }

  function applyUpdatesLocally(itemsToSave) {
    itemsToSave.forEach(function (update) {
      const existing = assignments.find(function (item) {
        return String(item.curriculum_topic_id) === String(update.curriculum_topic_id);
      });

      if (!existing) return;

      existing.visible = update.visible;
      existing.sort_order = update.sort_order;
      existing.active = update.active;
    });
  }

  function resyncSilently() {
    postToGlip({
      action: "getCurriculumTopicManagement",
      teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getRole()
    }).then(function (result) {
      if (!result || result.status !== "success") return;

      const role = getRole();
      curriculum = result.curriculum || [];
      topics = (result.topics || []).filter(function (item) {
        return role === "owner" || item.active !== false;
      });
      assignments = GLIPOptimisticUpdate.mergePendingRows((result.assignments || []).filter(function (item) {
        return role === "owner" || item.topic_active !== false;
      }), assignments, "curriculum_topic_id");

      renderAssignments();
    }).catch(function (error) {
      console.warn("Silent topic assignment resync failed.", error);
    });
  }

function setupFilter() {
  if (typeof window.setupGlipTableFilter !== "function") return;

  window.setupGlipTableFilter({
    filterId: "curriculumTopic",
    tableId: "curriculumTopicTable",
    fields: [
      {
        value: "level",
        label: "Level",
        getValue: function (item) {
          return formatLevel(item.level);
        }
      },
      {
        value: "subject",
        label: "Subject",
        getValue: function (item) {
          return item.subject_name || item.subject_code || "";
        }
      },
      {
        value: "topic",
        label: "Topic",
        getValue: function (item) {
          return item.topic_name || item.topic_code || "";
        }
      },
      {
        value: "visible",
        label: "Visible",
        getValue: function (item) {
          return getCurriculumTopicVisibleText(item);
        }
      },
      {
        value: "active",
        label: "Status",
        getValue: function (item) {
          return getCurriculumTopicStatusText(item);
        }
      }
    ],
    onChange: function () {
      renderAssignments();
    }
  });
}

  
  function setupSorting() {
    document.querySelectorAll("#curriculumTopicTable thead th[data-sort-field]").forEach(function (header) {
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
        renderAssignments();
      });
    });

    updateSortIndicators();
  }

  function updateSortIndicators() {
    document.querySelectorAll("#curriculumTopicTable thead th[data-sort-field]").forEach(function (header) {
      const field = header.dataset.sortField;
      const label = header.dataset.label;

      header.textContent = field === sortField
        ? label + (sortDirection === "asc" ? " ▲" : " ▼")
        : label + " ↕";
    });
  }

  function getSortedAssignments(items) {
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
    if (field === "topic") return String(item.topic_name || item.topic_code || "").toLowerCase();
    return String(item[field] || "").toLowerCase();
  }

  function markChangedFields() {
    document.querySelectorAll("[data-curriculum-topic-row]").forEach(function (row) {
      const id = row.dataset.curriculumTopicRow;
      const original = assignments.find(function (item) {
        return String(item.curriculum_topic_id) === String(id);
      });

      if (!original) return;

      row.querySelectorAll("[data-curriculum-topic-field]").forEach(function (field) {
        const name = field.dataset.curriculumTopicField;
        let originalValue = original[name];

        if (name === "visible" || name === "active") {
          originalValue = isTrue(originalValue) ? "true" : "false";
        }

        field.classList.toggle(
          "teacher-field-changed",
          String(field.value).trim() !== String(originalValue || "").trim()
        );
      });
    });
  }

  function renderBooleanOptions(value, trueLabel, falseLabel) {
    return '<option value="true" ' + (isTrue(value) ? "selected" : "") + '>' + trueLabel + '</option>' +
      '<option value="false" ' + (!isTrue(value) ? "selected" : "") + '>' + falseLabel + '</option>';
  }

function clearAddForm() {
  document.getElementById("newCurriculumTopicCurriculum").value = "";
  document.getElementById("newCurriculumTopicTopic").value = "";
  document.getElementById("newCurriculumTopicVisible").value = "true";
  document.getElementById("newCurriculumTopicSortOrder").value = "";
  document.getElementById("newCurriculumTopicActive").value = "true";
  updateTopicDropdownForSelectedCurriculum();
}

function cancelAddAssignment() {
  clearAddForm();
  setAddMessage("", "info");
  updateTopicDropdownForSelectedCurriculum();
}


  

  function setMessage(text, type) {
    const message = document.getElementById("curriculumTopicManagementMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
  }

  function setAddMessage(text, type) {
    const message = document.getElementById("addCurriculumTopicMessage");
    if (!message) return;
    message.textContent = text || "";
    message.className = "panel-message add-teacher-message " + (type || "info");
  }

  function setLoadingState(isLoading) {
    const loadingBox = document.getElementById("curriculumTopicLoadingProgress");
    const table = document.getElementById("curriculumTopicTable");

    if (loadingBox) loadingBox.style.display = isLoading ? "block" : "none";
    if (table) table.style.visibility = isLoading ? "hidden" : "visible";
  }

  function setAddSavingState(isSaving) {
    const btn = document.getElementById("saveCurriculumTopicBtn");
    const progressBox = document.getElementById("saveCurriculumTopicProgress");

    if (btn) {
      btn.disabled = isSaving;
      btn.textContent = isSaving ? "Saving..." : "Save Topic Assignment";
    }

    if (progressBox) progressBox.style.display = isSaving ? "block" : "none";
  }

  function setSavingState(isSaving) {
    const btn = document.getElementById("editCurriculumTopicBtn");
    const cancelBtn = document.getElementById("cancelCurriculumTopicEditBtn");
    const progressBox = document.getElementById("saveCurriculumTopicChangesProgress");

    if (btn) {
      btn.disabled = isSaving;
      btn.textContent = isSaving ? "Saving..." : editMode ? "Save Changes" : "Edit Topic Assignments";
    }

    if (cancelBtn) cancelBtn.disabled = isSaving;
    if (progressBox) progressBox.style.display = isSaving ? "block" : "none";
  }

  function getRole() {
    return sessionStorage.getItem("glipRole") ||
      sessionStorage.getItem("glipTeacherRole") ||
      "";
  }

  function formatLevel(level) {
    const match = String(level || "").match(/\d+/);
    return match ? "Level " + Number(match[0]) : String(level || "");
  }

  function appendWarning(text, showWarning) {
    return String(text || "") + (showWarning ? " ⚠" : "");
  }

  function isTrue(value) {
    return value === true ||
      String(value).toLowerCase() === "true" ||
      String(value).toLowerCase() === "yes" ||
      String(value) === "1";
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

function getPlanningWarnings(item) {
  const matchingCurriculum = curriculum.find(function (candidate) {
    return String(candidate.curriculum_id) === String(item && item.curriculum_id);
  });

  const matchingTopic = topics.find(function (candidate) {
    return String(candidate.topic_id) === String(item && item.topic_id);
  });

  const levelInactive =
    item && item.level_active === false ||
    matchingCurriculum && matchingCurriculum.level_active === false;

  const subjectInactive =
    item && item.subject_active === false ||
    item && item.curriculum_active === false ||
    matchingCurriculum && matchingCurriculum.subject_active === false ||
    matchingCurriculum && matchingCurriculum.active === false;

  const topicInactive =
    item && item.topic_active === false ||
    matchingTopic && matchingTopic.active === false;

  const anySpecificWarning =
    Boolean(levelInactive || subjectInactive || topicInactive);

  return {
    level: Boolean(levelInactive),
    subject: Boolean(subjectInactive),
    topic: Boolean(topicInactive),
    any: anySpecificWarning ||
      Boolean(item && item.has_inactive_dependency === true)
  };
}

function hasInactiveParentWarning(item) {
  return getPlanningWarnings(item).any;
}

function appendPlanningWarning(text, showWarning) {
  return String(text || "") + (showWarning ? " ⚠" : "");
}

function getCurriculumTopicStatusText(item) {
  if (!isTrue(item.active)) {
    return "Inactive";
  }

  if (hasInactiveParentWarning(item)) {
    return "Active (pending)";
  }

  return "Active";
}

function getCurriculumTopicVisibleText(item) {
  if (!isTrue(item.visible)) {
    return "Hidden";
  }

  if (hasInactiveParentWarning(item)) {
    return "Visible (pending)";
  }

  return "Visible";
}


  

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (event.detail && event.detail.action === "getCurriculumTopicManagement" && !editMode) loadData();
  });
})();
