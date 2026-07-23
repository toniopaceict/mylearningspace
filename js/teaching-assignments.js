(function () {
  "use strict";

  let classTeachersEditMode = false;
  let currentAssignments = [];
  let availableTeachers = [];
  let availableLevels = [];
  let availableClasses = [];
  let availableSubjects = [];

  let classTeacherSortField = "teacher_name";
  let classTeacherSortDirection = "asc";
  let classTeacherManagementInitialised = false;

  function getWebAppUrl() {
    return window.getGlipWebAppUrl();
  }

  function safelyInitClassTeacherManagement() {
    if (classTeacherManagementInitialised) return;

    if (typeof isAdmin !== "function") {
      setTimeout(safelyInitClassTeacherManagement, 100);
      return;
    }

    classTeacherManagementInitialised = true;
    initClassTeacherManagement();
  }

  document.addEventListener("glipReady", safelyInitClassTeacherManagement);
  document.addEventListener("DOMContentLoaded", safelyInitClassTeacherManagement);

  function initClassTeacherManagement() {
    if (typeof getCurrentRole !== "function") return;
    const role = getCurrentRole();
    if (role !== "owner" && role !== "admin" && role !== "lead_teacher") return;

    const saveBtn = document.getElementById("saveClassTeacherBtn");
    const editBtn = document.getElementById("editClassTeachersBtn");

    if (saveBtn) {
      saveBtn.addEventListener("click", saveClassTeacherAssignment);
    }

    if (editBtn) {
      editBtn.addEventListener("click", toggleClassTeachersEditMode);
    }

    setupClassTeacherTableSorting();
    updateSortIndicators();

    // Show the loading indicator for the complete initial data-loading sequence,
    // including teachers, levels, classes and subjects.
    setLoadingState(true);

    Promise.all([
      loadTeachers(),
      loadLevels(),
      loadClasses(),
      loadSubjects()
    ]).then(function () {
      if (!isAdmin()) {
        buildLeadTeacherLevelList();
      }
    
      populateAddDropdowns();
      loadAssignments();
    });

    if (isAdmin() && typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "class_teachers",
        tableName: "TeachingAssignments",
        messageElementId: "classTeacherManagementMessage",
        refresh: loadAssignments
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

  function loadTeachers() {
    return postToGlip({
      action: "listTeachersAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getCurrentRole()
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load teachers.");
      }

availableTeachers = result.teachers || [];
    }).catch(function (error) {
      console.error(error);
      setAddMessage("Could not load teachers.", "error");
    });
  }

function loadLevels() {
  /*
   * Administrators may select any configured level, including an inactive
   * level being prepared for future use.
   *
   * Lead teachers must remain restricted to the levels returned through
   * their permitted classes and curriculum records.
   */
  if (!isAdmin()) {
    availableLevels = [];
    return Promise.resolve();
  }

  return postToGlip({
    action: "listLevelsAdmin",
    admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
    teacher_id: sessionStorage.getItem("glipTeacherId"),
    role: getCurrentRole()
  })
    .then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load levels.");
      }

      availableLevels = result.levels || [];
    })
    .catch(function (error) {
      console.error(error);
      availableLevels = [];
      setAddMessage(
        error.message || "Could not load levels.",
        "error"
      );
    });
}

  function buildLeadTeacherLevelList() {
  const levelsByCode = {};

  availableClasses.forEach(function (item) {
    const levelCode = normaliseLevel(item.level);

    if (!levelCode) return;

    levelsByCode[levelCode] = {
      level_code: levelCode,
      level_name: formatLevel(levelCode),
      active: item.level_active !== false
    };
  });

  availableSubjects.forEach(function (item) {
    const levelCode = normaliseLevel(item.level);

    if (!levelCode) return;

    if (!levelsByCode[levelCode]) {
      levelsByCode[levelCode] = {
        level_code: levelCode,
        level_name: formatLevel(levelCode),
        active: item.level_active !== false
      };
    } else if (item.level_active === false) {
      levelsByCode[levelCode].active = false;
    }
  });

  availableLevels = Object.keys(levelsByCode)
    .map(function (levelCode) {
      return levelsByCode[levelCode];
    })
    .sort(function (a, b) {
      return normaliseLevel(a.level_code).localeCompare(
        normaliseLevel(b.level_code)
      );
    });
}


  
  
function loadClasses() {
  return postToGlip({
    action: "listClassesAdmin",
    admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getCurrentRole()
  }).then(function (result) {
    if (!result || result.status !== "success") {
      throw new Error(result.message || "Could not load classes.");
    }

    availableClasses = result.classes || [];
  }).catch(function (error) {
    console.error(error);
    setAddMessage("Could not load levels and classes.", "error");
  });
}
  

  function loadSubjects() {
    return postToGlip({
      action: "getAllSubjectsAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getCurrentRole()
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load subjects.");
      }

      availableSubjects = result.subjects || [];
    }).catch(function (error) {
      console.error(error);
      setAddMessage("Could not load subjects.", "error");
    });
  }

if (typeof window.setupGlipTableFilter === "function") {
  window.setupGlipTableFilter({
    filterId: "classTeachers",
    tableId: "classTeachersTable",
fields: [
  { value: "teacher_name", label: "Teacher", getValue: function (assignment) { return getTeacherNameById(assignment.teacher_id); } },
  { value: "level", label: "Level", getValue: function (assignment) { return formatLevel(assignment.level); } },
  { value: "subject_id", label: "Subject", getValue: function (assignment) { return getSubjectName(assignment.subject_id, assignment.level); } },
  { value: "class_id", label: "Class" },
  { value: "folder_id", label: "Work Folder" },
  { value: "class_resources_url", label: "Class Resources" },
  { value: "active", label: "Status", getValue: getAssignmentStatusText }
],
    onChange: function () {
      renderAssignments(currentAssignments);
    }
  });
}
  
  function loadAssignments() {
    const tbody = document.getElementById("classTeachersTableBody");
    if (!tbody) return;

    setLoadingState(true);

    postToGlip({
      action: "listClassTeachersAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getCurrentRole()
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load assignments.");
      }

      setLoadingState(false);
      currentAssignments = GLIPOptimisticUpdate.mergePendingRows(result.assignments || [], currentAssignments, "assignment_id");
      classTeachersEditMode = false;
      updateEditButton();
      renderAssignments(currentAssignments);
    }).catch(function (error) {
      console.error(error);
      setLoadingState(false);
      setMessage("Could not load teaching assignments.", "error");

      tbody.innerHTML = `
        <tr>
          <td colspan="6">Could not load assignments.</td>
        </tr>
      `;
    });
  }

  function populateAddDropdowns() {
    populateTeacherDropdown(
      document.getElementById("newClassTeacherTeacher")
    );

    populateLevelDropdown(
      document.getElementById("newClassTeacherLevel")
    );

    const levelSelect = document.getElementById("newClassTeacherLevel");
    const subjectSelect = document.getElementById("newClassTeacherSubject");
    const classSelect = document.getElementById("newClassTeacherClass");

    if (!levelSelect || !subjectSelect || !classSelect) return;

    levelSelect.addEventListener("change", function () {
      populateSubjectDropdownForLevel(levelSelect.value, subjectSelect);
      populateClassDropdownForLevel(levelSelect.value, classSelect);
    });
  }

  function populateTeacherDropdown(select, selectedTeacherId) {
    if (!select) return;

    select.innerHTML =
      '<option value="">Select teacher</option>' +
      availableTeachers.map(function (teacher) {
        const selected =
          teacher.teacher_id === selectedTeacherId ? "selected" : "";

        return `
          <option value="${escapeHtml(teacher.teacher_id)}" ${selected}>
            ${escapeHtml(appendPlanningWarning(formatTeacherName(teacher), teacher.active === false))}
          </option>
        `;
      }).join("");
  }

function populateLevelDropdown(select, selectedLevel) {
  if (!select) return;

  select.innerHTML =
    '<option value="">Select level</option>' +
    availableLevels.map(function (level) {
      const levelCode = normaliseLevel(level.level_code);

      const selected =
        levelCode === normaliseLevel(selectedLevel)
          ? "selected"
          : "";

      const levelLabel =
        level.level_name ||
        formatLevel(levelCode);

      return `
        <option value="${escapeHtml(levelCode)}" ${selected}>
          ${escapeHtml(
            appendPlanningWarning(
              levelLabel,
              level.active === false
            )
          )}
        </option>
      `;
    }).join("");
}

function populateSubjectDropdownForLevel(level, select, selectedSubjectId) {
  if (!select) return;

  if (!level) {
    select.innerHTML = '<option value="">Select level first</option>';
    select.disabled = true;
    return;
  }

  const subjectsForLevel = availableSubjects.filter(function (subject) {
    return !subject.level || normaliseLevel(subject.level) === normaliseLevel(level);
  });

  select.innerHTML =
    '<option value="">Select subject</option>' +
    subjectsForLevel.map(function (subject) {
      const selected =
        subject.subject_id === selectedSubjectId ? "selected" : "";

      return `
        <option value="${escapeHtml(subject.subject_id)}" ${selected}>
          ${escapeHtml(appendPlanningWarning(subject.subject_name || subject.subject_id, subject.active === false || subject.curriculum_active === false))}
        </option>
      `;
    }).join("");

  select.disabled = false;
}

  function populateClassDropdownForLevel(level, select, selectedClassId) {
    if (!select) return;

    if (!level) {
      select.innerHTML = '<option value="">Select level first</option>';
      select.disabled = true;
      return;
    }

    const classesForLevel = availableClasses.filter(function (item) {
      return normaliseLevel(item.level) === normaliseLevel(level);
    });

    select.innerHTML =
      '<option value="">Select class</option>' +
      classesForLevel.map(function (item) {
        const selected =
          item.class_id === selectedClassId ? "selected" : "";

        return `
          <option value="${escapeHtml(item.class_id)}" ${selected}>
            ${escapeHtml(appendPlanningWarning(item.class_id, item.active === false))}
          </option>
        `;
      }).join("");

    select.disabled = classesForLevel.length === 0;
  }

  function saveClassTeacherAssignment() {
    const teacherId = document.getElementById("newClassTeacherTeacher").value.trim();
    const level = document.getElementById("newClassTeacherLevel").value.trim();
    const subjectId = document.getElementById("newClassTeacherSubject").value.trim();
    const classId = document.getElementById("newClassTeacherClass").value.trim();
    const folderId = document.getElementById("newClassTeacherFolderId").value.trim();
    const classResourcesUrl = document.getElementById("newClassTeacherResourcesUrl").value.trim();
    const active = document.getElementById("newClassTeacherActive").checked;
    if (!teacherId || !level || !subjectId || !classId) { setAddMessage("Teacher, level, subject and class are required.", "error"); return; }
    const normalisedLevel = normaliseLevel(level);
    const teacherInfo = availableTeachers.find(function (item) { return String(item.teacher_id) === teacherId; }) || {};
    const classInfo = getClassInfoById(classId) || {};
    const subjectInfo = getSubjectInfoByLevel(subjectId, normalisedLevel) || {};
    const temporaryId = "pending-assignment-" + Date.now();
    currentAssignments.push({ assignment_id: temporaryId, teacher_id: teacherId, teacher_name: teacherInfo.teacher_name, teacher_surname: teacherInfo.teacher_surname, full_name: teacherInfo.full_name || [teacherInfo.teacher_name, teacherInfo.teacher_surname].filter(Boolean).join(" "), teacher_active: teacherInfo.active !== false, level: normalisedLevel, level_active: classInfo.level_active !== false, subject_id: subjectId, subject_name: subjectInfo.subject_name || subjectId, subject_code: subjectInfo.subject_code, curriculum_active: subjectInfo.curriculum_active !== false && subjectInfo.active !== false, class_id: classId, class_active: classInfo.active !== false, folder_id: folderId, class_resources_url: classResourcesUrl, active: active, pending_save: true, pending_state: "saving" });
    renderAssignments(currentAssignments); clearAddForm();
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "addClassTeacherAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), role: getCurrentRole(), teacher_id: teacherId, level: normalisedLevel, subject_id: subjectId, class_id: classId, folder_id: folderId, class_resources_url: classResourcesUrl, active: active }); },
      failureMessage: "Could not save assignment.",
      onSuccess: function (result) { const row = currentAssignments.find(function (item) { return String(item.assignment_id) === temporaryId; }); if (row) { row.assignment_id = result.class_teacher_id || row.assignment_id; GLIPOptimisticUpdate.markSaved(row); } setAddMessage(result.message || "Assignment saved.", "success"); },
      resync: resyncAssignmentsSilently,
      rollback: function () { currentAssignments = currentAssignments.filter(function (item) { return String(item.assignment_id) !== temporaryId; }); renderAssignments(currentAssignments); },
      onFailure: function (error) { setAddMessage(error.message || "Could not save assignment. The temporary row was removed.", "error"); }
    });
  }

  function toggleClassTeachersEditMode() {
    if (classTeachersEditMode) {
      saveClassTeacherChanges();
      return;
    }

    classTeachersEditMode = true;
    setMessage("", "info");
    updateEditButton();
    renderAssignments(currentAssignments);
  }

  function cancelClassTeachersEditMode() {
    classTeachersEditMode = false;
    updateEditButton();
    renderAssignments(currentAssignments);
    setMessage("", "info");
  }

  function updateEditButton() {
    const editBtn = document.getElementById("editClassTeachersBtn");
    if (!editBtn) return;

    editBtn.textContent = classTeachersEditMode
      ? "Save Changes"
      : "Edit Assignments";

    let cancelBtn = document.getElementById("cancelClassTeachersEditBtn");

    if (classTeachersEditMode && !cancelBtn) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelClassTeachersEditBtn";
      cancelBtn.className = "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancelClassTeachersEditMode);

      editBtn.insertAdjacentElement("afterend", cancelBtn);
    }

    if (!classTeachersEditMode && cancelBtn) {
      cancelBtn.remove();
    }
  }

    function appendPlanningWarning(text, showWarning) {
    return String(text || "") + (showWarning ? " ⚠" : "");
  }

  function hasAssignmentPlanningWarning(assignment) {
    return assignment &&
      (assignment.level_active === false ||
        assignment.class_active === false ||
        assignment.curriculum_active === false ||
        assignment.teacher_active === false);
  }

function getAssignmentStatusText(assignment) {
  if (!isTrue(assignment.active)) {
    return "Inactive";
  }

  if (hasAssignmentPlanningWarning(assignment)) {
    return "Active (pending)";
  }

  return "Active";
}

function formatAssignmentTeacherCell(assignment) {
  return escapeHtml(
    appendPlanningWarning(
      getTeacherNameById(assignment.teacher_id),
      assignment.teacher_active === false
    )
  );
}

function formatAssignmentLevelCell(assignment) {
  return escapeHtml(
    appendPlanningWarning(
      formatLevel(assignment.level),
      assignment.level_active === false
    )
  );
}

function formatAssignmentSubjectCell(assignment) {
  return escapeHtml(
    appendPlanningWarning(
      getSubjectName(assignment.subject_id, assignment.level),
      assignment.curriculum_active === false
    )
  );
}

function formatAssignmentClassCell(assignment) {
  return escapeHtml(
    appendPlanningWarning(
      assignment.class_id,
      assignment.class_active === false
    )
  );
}
  
function formatFolderLink(url, label) {
    const value = String(url || "").trim();
    if (!value) return '<span class="muted-text">Not assigned</span>';
    return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }

function renderAssignments(assignments) {
    const tbody = document.getElementById("classTeachersTableBody");
    if (!tbody) return;
const filteredAssignments =
  typeof window.applyGlipTableFilter === "function"
    ? window.applyGlipTableFilter("classTeachers", assignments)
    : assignments;
    if (!filteredAssignments.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">No teaching assignments found.</td>
        </tr>
      `;
      return;
    }

    const sortedAssignments = getSortedAssignments(filteredAssignments);

    tbody.innerHTML = sortedAssignments.map(function (assignment) {
      if (classTeachersEditMode) {
        return renderAssignmentEditRow(assignment);
      }

     return `
  <tr class="${hasAssignmentPlanningWarning(assignment) || !isTrue(assignment.active) ? "planning-row" : ""}">
    <td>${formatAssignmentTeacherCell(assignment)}</td>
    <td>${formatAssignmentLevelCell(assignment)}</td>
    <td>${formatAssignmentSubjectCell(assignment)}</td>
    <td>${formatAssignmentClassCell(assignment)}</td>
    <td class="work-folder-cell" title="${escapeHtml(assignment.folder_id || "")}">
      ${formatFolderLink(assignment.folder_id, "Open Work Folder")}
    </td>
    <td class="work-folder-cell" title="${escapeHtml(assignment.class_resources_url || "")}">
      ${formatFolderLink(assignment.class_resources_url, "Open Class Resources")}
    </td>
    <td>${getAssignmentStatusText(assignment)}</td>
  </tr>
`;
    }).join("");

    if (classTeachersEditMode) {
      document.querySelectorAll("[data-assignment-field]").forEach(function (field) {
        field.addEventListener("input", markChangedFields);
        field.addEventListener("change", handleEditFieldChange);
      });
    }
  }

function renderAssignmentEditRow(assignment) {
  return `
    <tr
  class="${hasAssignmentPlanningWarning(assignment) || !isTrue(assignment.active) ? "planning-row" : ""}"
  data-assignment-row="${escapeHtml(assignment.assignment_id)}"
>
      <td>
        ${escapeHtml(getTeacherNameById(assignment.teacher_id))}
        <input
          type="hidden"
          data-assignment-field="teacher_id"
          value="${escapeHtml(assignment.teacher_id)}"
        />
      </td>

      <td>
        <select class="tracker-input" data-assignment-field="level">
          ${renderLevelOptions(assignment.level)}
        </select>
      </td>

      <td>
        <select class="tracker-input" data-assignment-field="subject_id">
          ${renderSubjectOptionsForLevel(
            assignment.level,
            assignment.subject_id
          )}
        </select>
      </td>

      <td>
        <select class="tracker-input" data-assignment-field="class_id">
          ${renderClassOptionsForLevel(
            assignment.level,
            assignment.class_id
          )}
        </select>
      </td>

      <td>
        <input
          type="text"
          class="tracker-input work-folder-input"
          data-assignment-field="folder_id"
          value="${escapeHtml(assignment.folder_id || "")}"
          placeholder="Work folder URL"
        />
      </td>

      <td>
        <input
          type="url"
          class="tracker-input work-folder-input"
          data-assignment-field="class_resources_url"
          value="${escapeHtml(assignment.class_resources_url || "")}"
          placeholder="Class resources URL"
        />
      </td>

      <td>
        <select class="tracker-input" data-assignment-field="active">
          <option value="true" ${isTrue(assignment.active) ? "selected" : ""}>Active</option>
          <option value="false" ${!isTrue(assignment.active) ? "selected" : ""}>Inactive</option>
        </select>
      </td>
    </tr>
  `;
}

  

  function handleEditFieldChange(event) {
    const field = event.target;

    if (field.dataset.assignmentField === "level") {
      const row = field.closest("[data-assignment-row]");
      const subjectSelect = row.querySelector('[data-assignment-field="subject_id"]');
      const classSelect = row.querySelector('[data-assignment-field="class_id"]');

      subjectSelect.innerHTML = renderSubjectOptionsForLevel(field.value, "");
      classSelect.innerHTML = renderClassOptionsForLevel(field.value, "");
    }

    markChangedFields();
  }

  function getTeacherActiveById(teacherId) {
    const teacher = availableTeachers.find(function (item) {
      return String(item.teacher_id) === String(teacherId);
    });
    return teacher ? teacher.active !== false : true;
  }

  function getClassInfoById(classId) {
    return availableClasses.find(function (item) {
      return String(item.class_id) === String(classId);
    }) || null;
  }

  function getSubjectInfoByLevel(subjectId, level) {
    return availableSubjects.find(function (item) {
      return String(item.subject_id) === String(subjectId) &&
        normaliseLevel(item.level) === normaliseLevel(level);
    }) || null;
  }

  function applyAssignmentUpdatesLocally(assignmentsToSave) {
    assignmentsToSave.forEach(function (update) {
      const existing = currentAssignments.find(function (assignment) {
        return String(assignment.assignment_id) === String(update.assignment_id);
      });

      if (!existing) return;

      const classInfo = getClassInfoById(update.class_id);
      const subjectInfo = getSubjectInfoByLevel(update.subject_id, update.level);

      existing.teacher_id = update.teacher_id;
      existing.teacher_active = getTeacherActiveById(update.teacher_id);
      existing.level = update.level;
      existing.level_active = classInfo ? classInfo.level_active : existing.level_active;
      existing.subject_id = update.subject_id;
      existing.curriculum_active = subjectInfo ? subjectInfo.curriculum_active !== false && subjectInfo.active !== false : existing.curriculum_active;
      existing.class_id = update.class_id;
      existing.class_active = classInfo ? classInfo.active !== false : existing.class_active;
      existing.folder_id = update.folder_id;
      existing.class_resources_url = update.class_resources_url;
      existing.active = update.active;
    });
  }

  function resyncAssignmentsSilently() {
    postToGlip({
      action: "listClassTeachersAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getCurrentRole()
    }).then(function (result) {
      if (!result || result.status !== "success") return;
      currentAssignments = GLIPOptimisticUpdate.mergePendingRows(result.assignments || [], currentAssignments, "assignment_id");
      renderAssignments(currentAssignments);
    }).catch(function (error) {
      console.warn("Silent class teacher resync failed.", error);
    });
  }

  function saveClassTeacherChanges() {
    const rows = document.querySelectorAll("[data-assignment-row]"); const assignmentsToSave = [];
    rows.forEach(function (row) {
      const assignment = { assignment_id: row.dataset.assignmentRow };
      row.querySelectorAll("[data-assignment-field]").forEach(function (field) {
        const fieldName = field.dataset.assignmentField;
        if (fieldName === "can_view_progress" || fieldName === "can_override" || fieldName === "active") assignment[fieldName] = field.value === "true";
        else if (fieldName === "level") assignment[fieldName] = normaliseLevel(field.value);
        else assignment[fieldName] = field.value.trim();
      }); assignmentsToSave.push(assignment);
    });
    const previousAssignments = currentAssignments.map(function (item) { return Object.assign({}, item); });
    applyAssignmentUpdatesLocally(assignmentsToSave); GLIPOptimisticUpdate.markUpdatesPending(currentAssignments, assignmentsToSave, "assignment_id"); classTeachersEditMode = false; updateEditButton(); renderAssignments(currentAssignments);
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "updateClassTeachersAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), role: getCurrentRole(), assignments: assignmentsToSave }); },
      failureMessage: "Could not save assignment changes.",
      onSuccess: function (result) { setMessage(result.message || "Assignment changes saved.", "success"); },
      resync: resyncAssignmentsSilently,
      rollback: function () { currentAssignments = previousAssignments; renderAssignments(currentAssignments); },
      onFailure: function (error) { setMessage(error.message || "Could not save assignment changes. The previous values were restored.", "error"); }
    });
  }

  function setupClassTeacherTableSorting() {
    document
      .querySelectorAll("#classTeachersTable thead th[data-sort-field]")
      .forEach(function (header) {
        header.style.cursor = "pointer";

        header.addEventListener("click", function () {
          const field = header.dataset.sortField;

          if (classTeacherSortField === field) {
            classTeacherSortDirection =
              classTeacherSortDirection === "asc" ? "desc" : "asc";
          } else {
            classTeacherSortField = field;
            classTeacherSortDirection = "asc";
          }

          updateSortIndicators();
          renderAssignments(currentAssignments);
        });
      });
  }

  function updateSortIndicators() {
    document
      .querySelectorAll("#classTeachersTable thead th[data-sort-field]")
      .forEach(function (header) {
        const field = header.dataset.sortField;
        const label = header.dataset.label;

        if (field === classTeacherSortField) {
          header.textContent =
            label + (classTeacherSortDirection === "asc" ? " ▲" : " ▼");
        } else {
          header.textContent = label + " ↕";
        }
      });
  }

  function getSortedAssignments(assignments) {
    return assignments.slice().sort(function (a, b) {
      let valueA = getSortValue(a, classTeacherSortField);
      let valueB = getSortValue(b, classTeacherSortField);

      if (valueA < valueB) return classTeacherSortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return classTeacherSortDirection === "asc" ? 1 : -1;

      return 0;
    });
  }

  function getSortValue(assignment, field) {
    if (field === "teacher_name") {
      return getTeacherNameById(assignment.teacher_id).toLowerCase();
    }

    if (
      field === "can_view_progress" ||
      field === "can_override" ||
      field === "active"
    ) {
      return isTrue(assignment[field]) ? 1 : 0;
    }

    return String(assignment[field] || "").toLowerCase();
  }

  function markChangedFields() {
    const rows = document.querySelectorAll("[data-assignment-row]");

    rows.forEach(function (row) {
      const assignmentId = row.dataset.assignmentRow;

      const original = currentAssignments.find(function (assignment) {
        return String(assignment.assignment_id) === String(assignmentId);
      });

      if (!original) return;

      row.querySelectorAll("[data-assignment-field]").forEach(function (field) {
        const fieldName = field.dataset.assignmentField;
        let currentValue = field.value;
        let originalValue = original[fieldName];

        if (
          fieldName === "can_view_progress" ||
          fieldName === "can_override" ||
          fieldName === "active"
        ) {
          originalValue = isTrue(originalValue) ? "true" : "false";
        }

        if (fieldName === "level") {
          currentValue = normaliseLevel(currentValue);
          originalValue = normaliseLevel(originalValue);
        }

        field.classList.toggle(
          "teacher-field-changed",
          String(currentValue).trim() !== String(originalValue || "").trim()
        );
      });
    });
  }

  function renderTeacherOptions(selectedTeacherId) {
    return availableTeachers.map(function (teacher) {
      const selected =
        teacher.teacher_id === selectedTeacherId ? "selected" : "";

      return `
        <option value="${escapeHtml(teacher.teacher_id)}" ${selected}>
          ${escapeHtml(formatTeacherName(teacher))}
        </option>
      `;
    }).join("");
  }

  function renderLevelOptions(selectedLevel) {
    return getAvailableLevels().map(function (level) {
      const selected =
        normaliseLevel(level) === normaliseLevel(selectedLevel)
          ? "selected"
          : "";

      const levelRecord = availableLevels.find(function (item) {
        return normaliseLevel(item.level_code) === normaliseLevel(level);
      });

      const levelLabel = appendPlanningWarning(
        (levelRecord && levelRecord.level_name) || formatLevel(level),
        !!(levelRecord && levelRecord.active === false)
      );

      return `
        <option value="${escapeHtml(level)}" ${selected}>
          ${escapeHtml(levelLabel)}
        </option>
      `;
    }).join("");
  }

function renderSubjectOptionsForLevel(level, selectedSubjectId) {
  return availableSubjects
    .filter(function (subject) {
      return !subject.level || normaliseLevel(subject.level) === normaliseLevel(level);
    })
    .map(function (subject) {
      const selected =
        subject.subject_id === selectedSubjectId ? "selected" : "";

      return `
        <option value="${escapeHtml(subject.subject_id)}" ${selected}>
          ${escapeHtml(appendPlanningWarning(subject.subject_name || subject.subject_id, subject.active === false || subject.curriculum_active === false))}
        </option>
      `;
    }).join("");
}

  function renderClassOptionsForLevel(level, selectedClassId) {
    return availableClasses
      .filter(function (item) {
        return normaliseLevel(item.level) === normaliseLevel(level);
      })
      .map(function (item) {
        const selected =
          item.class_id === selectedClassId ? "selected" : "";

        return `
          <option value="${escapeHtml(item.class_id)}" ${selected}>
            ${escapeHtml(appendPlanningWarning(item.class_id, item.active === false))}
          </option>
        `;
      }).join("");
  }

function isLevelActiveForManagement(level) {
  const normalisedLevel = normaliseLevel(level);

  const match = availableLevels.find(function (item) {
    return normaliseLevel(item.level_code) === normalisedLevel;
  });

  return !match || match.active !== false;
}

function getAvailableLevels() {
  return availableLevels
    .map(function (level) {
      return normaliseLevel(level.level_code);
    })
    .filter(function (level) {
      return !!level;
    });
}

  function clearAddForm() {
    document.getElementById("newClassTeacherTeacher").value = "";
    document.getElementById("newClassTeacherLevel").value = "";

    const subjectSelect = document.getElementById("newClassTeacherSubject");
    const classSelect = document.getElementById("newClassTeacherClass");

    subjectSelect.innerHTML = '<option value="">Select level first</option>';
    subjectSelect.disabled = true;

    classSelect.innerHTML = '<option value="">Select level first</option>';
    classSelect.disabled = true;

const activeCheckbox = document.getElementById("newClassTeacherActive");

if (activeCheckbox) {
  activeCheckbox.checked = true;
}

const folderInput = document.getElementById("newClassTeacherFolderId");

if (folderInput) {
  folderInput.value = "";
}

const resourcesInput = document.getElementById("newClassTeacherResourcesUrl");
if (resourcesInput) {
  resourcesInput.value = "";
}
    
  }

  function setAddSavingState(isSaving) {
    const btn = document.getElementById("saveClassTeacherBtn");
    const progressBox = document.getElementById("saveClassTeacherProgress");

    if (btn) {
      btn.disabled = isSaving;
      btn.textContent = isSaving ? "Saving..." : "Save Assignment";
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

  function setSavingState(isSaving) {
    const editBtn = document.getElementById("editClassTeachersBtn");
    const cancelBtn = document.getElementById("cancelClassTeachersEditBtn");
    const progressBox = document.getElementById("saveClassTeachersProgress");

    if (editBtn) {
      editBtn.disabled = isSaving;
      editBtn.textContent = isSaving
        ? "Saving..."
        : classTeachersEditMode
          ? "Save Changes"
          : "Edit Assignments";
    }

    if (cancelBtn) {
      cancelBtn.disabled = isSaving;
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

  function setLoadingState(isLoading) {
    const loadingBox = document.getElementById("classTeachersLoadingProgress");
    const table = document.getElementById("classTeachersTable");

    if (loadingBox) {
      loadingBox.style.display = isLoading ? "block" : "none";
    }

    if (table) {
      table.style.visibility = isLoading ? "hidden" : "visible";
    }
  }

  function setMessage(text, type) {
    const message = document.getElementById("classTeacherManagementMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
  }

  function setAddMessage(text, type) {
    const message = document.getElementById("addClassTeacherMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className =
      "panel-message add-teacher-message " + (type || "info");
  }

  function getTeacherNameById(teacherId) {
    const teacher = availableTeachers.find(function (item) {
      return String(item.teacher_id) === String(teacherId);
    });

    return teacher ? formatTeacherName(teacher) : teacherId;
  }

  function formatTeacherName(teacher) {
    return [
      teacher.teacher_name,
      teacher.teacher_surname
    ].filter(Boolean).join(" ");
  }

  function getSubjectName(subjectId, level) {
    const subject = availableSubjects.find(function (item) {
      return (
        String(item.subject_id) === String(subjectId) &&
        normaliseLevel(item.level) === normaliseLevel(level)
      );
    });

    return subject ? subject.subject_name || subjectId : subjectId;
  }

  function formatYesNo(value) {
    return isTrue(value) ? "Yes" : "No";
  }

  function isTrue(value) {
    return value === true || String(value).toLowerCase() === "true";
  }

  function normaliseLevel(level) {
    const value = String(level || "").trim();

    if (!value) return "";

    if (value.indexOf("level-") === 0) {
      return value;
    }

    const digits = value.replace(/\D/g, "");

    if (!digits) return value;

    return "level-" + digits.padStart(2, "0");
  }

  function formatLevel(level) {
    const value = normaliseLevel(level);
    const digits = value.replace(/\D/g, "");

    return digits ? "Level " + Number(digits) : level;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (!event.detail) return;
    if (event.detail.action === "listTeachersAdmin") loadTeachers().then(populateAddDropdowns);
    if (event.detail.action === "listClassesAdmin") loadClasses().then(populateAddDropdowns);
    if (event.detail.action === "getAllSubjectsAdmin") loadSubjects().then(populateAddDropdowns);
    if (event.detail.action === "listClassTeachersAdmin" && !classTeachersEditMode) loadAssignments();
  });
})();
