(function () {
  "use strict";

  let recentlyCommittedAssignments = new Map();

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
        refresh: loadAssignments,
        hideClear: true,
        hideImport: true
      });
    }
  }

  const READ_ONLY_ACTIONS = new Set([
    "listTeachersAdmin",
    "listLevelsAdmin",
    "listClassesAdmin",
    "getAllSubjectsAdmin",
    "listTeachingAssignmentViewAdmin"
  ]);

  function postToGlip(data, retryCount) {
    const attempt = Number(retryCount || 0);

    return fetch(getWebAppUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      cache: "no-store",
      body: JSON.stringify(data || {})
    })
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        let result;

        try {
          result = JSON.parse(text);
        } catch (error) {
          throw new Error("GLIP returned an invalid server response.");
        }

        /*
         * A newly deployed Apps Script version can occasionally return the
         * doGet fallback while the deployment is propagating. Retrying is
         * safe only for read-only actions.
         */
        if (
          result &&
          result.status === "error" &&
          result.message === "Invalid or missing action" &&
          READ_ONLY_ACTIONS.has(String(data && data.action || "")) &&
          attempt < 1
        ) {
          return new Promise(function (resolve) {
            setTimeout(resolve, 300);
          }).then(function () {
            return postToGlip(data, attempt + 1);
          });
        }

        return result;
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

      availableTeachers = (result.teachers || []).filter(function (teacher) {
        return String(teacher.role || "").trim().toLowerCase() !== "owner";
      });
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
      level_name: getLevelLabel(levelCode),
      active: item.level_active !== false
    };
  });

  availableSubjects.forEach(function (item) {
    const levelCode = normaliseLevel(item.level);

    if (!levelCode) return;

    if (!levelsByCode[levelCode]) {
      levelsByCode[levelCode] = {
        level_code: levelCode,
        level_name: getLevelLabel(levelCode),
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
  { value: "level", label: "Level", getValue: function (assignment) { return getLevelLabel(assignment); } },
  { value: "subject_id", label: "Subject", getValue: function (assignment) { return getSubjectName(assignment.subject_id, assignment.level); } },
  { value: "class_id", label: "Class" },
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
      action: "listTeachingAssignmentViewAdmin",
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
          <td colspan="5">Could not load assignments.</td>
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
        level.level_code ||
        getLevelLabel(levelCode);

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
    return !subject.level || levelsMatch(subject.level, level);
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
      return levelsMatch(item.level, level);
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

  function setAddAssignmentSaving(isSaving) {
    const button = document.getElementById("saveClassTeacherBtn");
    const progress = document.getElementById("saveClassTeacherProgress");
    const controls = document.querySelectorAll("#addClassTeacherPanel select, #addClassTeacherPanel input, #addClassTeacherPanel button");
    controls.forEach(function (control) { control.disabled = isSaving; });
    if (button) { button.disabled = isSaving; button.textContent = isSaving ? "Creating storage..." : "Save Assignment"; }
    if (progress) progress.classList.toggle("show", isSaving);
  }

  function saveClassTeacherAssignment() {
    const teacherId = document.getElementById("newClassTeacherTeacher").value.trim();
    const level = document.getElementById("newClassTeacherLevel").value.trim();
    const subjectId = document.getElementById("newClassTeacherSubject").value.trim();
    const classId = document.getElementById("newClassTeacherClass").value.trim();
    const active = document.getElementById("newClassTeacherActive").checked;
    if (!teacherId || !level || !subjectId || !classId) { setAddMessage("Teacher, level, subject and class are required.", "error"); return; }
    const normalisedLevel = normaliseLevel(level);
    const teacherInfo = availableTeachers.find(function (item) { return String(item.teacher_id) === teacherId; }) || {};
    const classInfo = getClassInfoById(classId) || {};
    const subjectInfo = getSubjectInfoByLevel(subjectId, normalisedLevel) || {};
    const temporaryId = "pending-assignment-" + Date.now();
    setAddAssignmentSaving(true);
    const confirmedAssignment = { assignment_id: temporaryId, teacher_id: teacherId, teacher_name: teacherInfo.teacher_name, teacher_surname: teacherInfo.teacher_surname, full_name: teacherInfo.full_name || [teacherInfo.teacher_name, teacherInfo.teacher_surname].filter(Boolean).join(" "), teacher_active: teacherInfo.active !== false, level: normalisedLevel, level_active: classInfo.level_active !== false, subject_id: subjectId, subject_name: subjectInfo.subject_name || subjectId, subject_code: subjectInfo.subject_code, curriculum_active: subjectInfo.curriculum_active !== false && subjectInfo.active !== false, class_id: classId, class_active: classInfo.active !== false, active: active, archived: false, status: active ? "active" : "inactive" };
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "addClassTeacherAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), role: getCurrentRole(), teacher_id: teacherId, level: normalisedLevel, subject_id: subjectId, class_id: classId, active: active }); },
      failureMessage: "Could not save assignment.",
      apply: function (result) {
        confirmedAssignment.assignment_id = result.class_teacher_id || confirmedAssignment.assignment_id;
        currentAssignments.push(confirmedAssignment);
        recentlyCommittedAssignments.set(String(confirmedAssignment.assignment_id), {
          row: Object.assign({}, confirmedAssignment),
          expires: Date.now() + 30000
        });
        clearAddForm();
        renderAssignments(currentAssignments);
      },
      onSuccess: function (result) { const row = currentAssignments.find(function (item) { return String(item.assignment_id) === temporaryId; }); if (row) { row.assignment_id = result.class_teacher_id || row.assignment_id; GLIPOptimisticUpdate.markSaved(row); } setAddMessage(result.message || "Assignment saved.", "success"); setAddAssignmentSaving(false); },
      resync: resyncAssignmentsSilently,
      rollback: function () { currentAssignments = currentAssignments.filter(function (item) { return String(item.assignment_id) !== temporaryId; }); renderAssignments(currentAssignments); },
      onFailure: function (error) { setAddMessage(error.message || "Could not save assignment. The temporary row was removed.", "error"); setAddAssignmentSaving(false); }
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
      : "Edit Status";

    let cancelBtn = document.getElementById("cancelClassTeachersEditBtn");

    if (classTeachersEditMode && !cancelBtn) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelClassTeachersEditBtn";
      cancelBtn.className = "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.marginLeft = "8px";
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
  if (assignment && (assignment.archived === true || String(assignment.status || "").toLowerCase() === "archived")) {
    return "Archived";
  }

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
      getLevelLabel(assignment),
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
  const classInfo = getClassInfoById(assignment.class_id);

  const classLabel =
    assignment.class_label ||
    (classInfo && classInfo.class_label) ||
    assignment.class_id;

  return escapeHtml(
    appendPlanningWarning(
      classLabel,
      assignment.class_active === false
    )
  );
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
          <td colspan="5">No teaching assignments found.</td>
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
  <tr class="${hasAssignmentPlanningWarning(assignment) || !isTrue(assignment.active) || assignment.archived === true ? "planning-row" : ""}">
    <td>${formatAssignmentTeacherCell(assignment)}</td>
    <td>${formatAssignmentLevelCell(assignment)}</td>
    <td>${formatAssignmentSubjectCell(assignment)}</td>
    <td>${formatAssignmentClassCell(assignment)}</td>
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
  const status = assignment.archived === true
    ? "archived"
    : (isTrue(assignment.active) ? "active" : "inactive");
  const canArchive = getCurrentRole() === "owner" || getCurrentRole() === "admin";

  return `
    <tr
      class="${hasAssignmentPlanningWarning(assignment) || status !== "active" ? "planning-row" : ""}"
      data-assignment-row="${escapeHtml(assignment.assignment_id)}"
    >
      <td>${formatAssignmentTeacherCell(assignment)}</td>
      <td>${formatAssignmentLevelCell(assignment)}</td>
      <td>${formatAssignmentSubjectCell(assignment)}</td>
      <td>${formatAssignmentClassCell(assignment)}</td>
      <td>
        <select class="tracker-input" data-assignment-field="status">
          <option value="active" ${status === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${status === "inactive" ? "selected" : ""}>Inactive</option>
          ${canArchive ? `<option value="archived" ${status === "archived" ? "selected" : ""}>Archived</option>` : ""}
        </select>
      </td>
    </tr>
  `;
}

  function handleEditFieldChange() {
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
        levelsMatch(item.level, level);
    }) || null;
  }

  function applyAssignmentUpdatesLocally(assignmentsToSave) {
    assignmentsToSave.forEach(function (update) {
      const existing = currentAssignments.find(function (assignment) {
        return String(assignment.assignment_id) === String(update.assignment_id);
      });
      if (!existing) return;
      existing.status = update.status;
      existing.archived = update.status === "archived";
      existing.active = update.status === "active";
    });
  }

  function resyncAssignmentsSilently(context) {
    const retryAttempt = context && Number(context.retryAttempt || 0) || 0;
    postToGlip({
      action: "listTeachingAssignmentViewAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      role: getCurrentRole()
    }).then(function (result) {
      if (!result || result.status !== "success") return;

      const serverRows = result.assignments || [];
      const serverIds = new Set(serverRows.map(function (row) { return String(row.assignment_id); }));
      const protectedRows = [];
      let missingCommitted = false;

      recentlyCommittedAssignments.forEach(function (entry, id) {
        if (serverIds.has(String(id))) {
          recentlyCommittedAssignments.delete(id);
          return;
        }
        if (Date.now() > entry.expires) {
          recentlyCommittedAssignments.delete(id);
          return;
        }
        protectedRows.push(Object.assign({}, entry.row));
        missingCommitted = true;
      });

      currentAssignments = serverRows.concat(protectedRows.filter(function (row) {
        return !serverIds.has(String(row.assignment_id));
      }));
      renderAssignments(currentAssignments);

      if (missingCommitted && retryAttempt < 3) {
        setTimeout(function () {
          resyncAssignmentsSilently({ retryAttempt: retryAttempt + 1 });
        }, [600, 1200, 2200][retryAttempt]);
      }
    }).catch(function (error) {
      console.warn("Silent class teacher resync failed.", error);
    });
  }

  function saveClassTeacherChanges() {
    const rows = document.querySelectorAll("[data-assignment-row]");
    const assignmentsToSave = [];

    rows.forEach(function (row) {
      const statusField = row.querySelector('[data-assignment-field="status"]');
      if (!statusField) return;
      assignmentsToSave.push({
        assignment_id: row.dataset.assignmentRow,
        status: statusField.value
      });
    });

    GLIPOptimisticUpdate.run({
      request: function () {
        return postToGlip({
          action: "updateClassTeachersAdmin",
          admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
          role: getCurrentRole(),
          assignments: assignmentsToSave
        });
      },
      failureMessage: "Could not save assignment statuses.",
      apply: function () { applyAssignmentUpdatesLocally(assignmentsToSave); classTeachersEditMode = false; updateEditButton(); renderAssignments(currentAssignments); },
      onSuccess: function (result) {
        setMessage(result.message || "Assignment statuses saved.", "success");
      },
      resync: resyncAssignmentsSilently,
      rollback: function () {
        currentAssignments = previousAssignments;
        renderAssignments(currentAssignments);
      },
      onFailure: function (error) {
        setMessage(error.message || "Could not save assignment statuses. The previous values were restored.", "error");
      }
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
    return availableTeachers
      .filter(function (teacher) {
        return String(teacher.role || "").trim().toLowerCase() !== "owner";
      })
      .map(function (teacher) {
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
        (levelRecord && (levelRecord.level_name || levelRecord.level_code)) || getLevelLabel(level),
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
      return !subject.level || levelsMatch(subject.level, level);
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
        return levelsMatch(item.level, level);
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
          : "Edit Status";
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

  function getLevelRecord(value) {
    const source = value && typeof value === "object"
      ? [
          value.level_id,
          value.level_code,
          value.level,
          value.level_name
        ]
      : [value];

    const candidates = source
      .map(function (item) { return String(item || "").trim().toLowerCase(); })
      .filter(Boolean);

    if (!candidates.length) return null;

    const exactMatch = availableLevels.find(function (level) {
      const identifiers = [
        level.level_id,
        level.level_code,
        level.level_name
      ].map(function (item) {
        return String(item || "").trim().toLowerCase();
      });

      return candidates.some(function (candidate) {
        return identifiers.indexOf(candidate) !== -1;
      });
    });

    if (exactMatch) return exactMatch;

    /*
     * Legacy pages sometimes supplied only "4" or "level-04". Match that
     * value to a year-specific code such as "level-04-26" only when the
     * result is unambiguous.
     */
    const requestedNumber = getPrimaryLevelNumber(candidates[0]);
    if (!requestedNumber) return null;

    const numberMatches = availableLevels.filter(function (level) {
      return getPrimaryLevelNumber(level.level_code || level.level_name) === requestedNumber;
    });

    return numberMatches.length === 1 ? numberMatches[0] : null;
  }

  function getPrimaryLevelNumber(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "";

    const codeMatch = text.match(/^level[-\s_]*(\d{1,2})(?:[-\s_]|$)/i);
    if (codeMatch) return String(Number(codeMatch[1]));

    const numberMatch = text.match(/\d{1,2}/);
    return numberMatch ? String(Number(numberMatch[0])) : "";
  }

  function normaliseLevel(level) {
    const record = getLevelRecord(level);
    if (record && record.level_code) {
      return String(record.level_code).trim();
    }

    const value = String(
      level && typeof level === "object"
        ? level.level_code || level.level || level.level_id || ""
        : level || ""
    ).trim();

    if (!value) return "";
    if (/^level-/i.test(value)) return value.toLowerCase();

    const levelNumber = getPrimaryLevelNumber(value);
    return levelNumber
      ? "level-" + String(levelNumber).padStart(2, "0")
      : value;
  }

  function levelsMatch(first, second) {
    const firstCode = normaliseLevel(first);
    const secondCode = normaliseLevel(second);
    return !!firstCode && !!secondCode && firstCode === secondCode;
  }

  function getLevelLabel(value) {
    const record = getLevelRecord(value);

    if (record) {
      return String(record.level_name || record.level_code || "").trim();
    }

    const levelNumber = getPrimaryLevelNumber(
      value && typeof value === "object"
        ? value.level_code || value.level || value.level_id || ""
        : value
    );

    return levelNumber ? "Level " + levelNumber : String(value || "");
  }

  function formatLevel(level) {
    return getLevelLabel(level);
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
    if (event.detail.action === "listTeachingAssignmentViewAdmin" && !classTeachersEditMode) loadAssignments();
  });
})();
