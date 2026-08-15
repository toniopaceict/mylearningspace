(function () {
  "use strict";

  let students = [];
  let subjects = [];
  let classes = [];
  let assignments = [];
  let assignmentHistory = [];
  let showAllEditorLevels = false;
  let selectedStudentId = "";
  let selectedRowKey = "";
  let initialised = false;

  let sortField = "full_name";
  let sortDirection = "asc";

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
    initStudentSubjectManagement();
  }

  document.addEventListener("glipReady", safelyInit);
  document.addEventListener("DOMContentLoaded", safelyInit);

  function initStudentSubjectManagement() {
    if (typeof isAdmin !== "function" || !isAdmin()) return;

    setupSorting();
    updateSortIndicators();
    setupFilter();
    loadData();

    if (typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "student_subjects",
        tableName: "StudentSubjects",
        anchorElementId: "studentSubjectActions",
        messageElementId: "studentSubjectSuccessMessage",
        refresh: loadData
      });
    }
  }

  function setStudentSubjectMessage(element, text, type) {
    if (!element) return;
    element.textContent = text || "";
    element.className = "panel-message " + (type || "info");
  }

  function setupFilter() {
    if (typeof window.setupGlipTableFilter !== "function") return;

    window.setupGlipTableFilter({
      filterId: "studentSubjects",
      tableId: "studentSubjectTable",
      fields: [
        { value: "full_name", label: "Full Name" },
        { value: "class_id", label: "Class" },
        { value: "level", label: "Level", getValue: function (row) { return row.level_text; } },
        { value: "subject_id", label: "Subject", getValue: function (row) { return row.subject_text; } },
        { value: "access_type", label: "Assignment Type", getValue: function (row) { return row.access_text; } },
        { value: "status", label: "Status", getValue: getStudentSubjectStatusText }
      ],
      onChange: function () {
        renderStudentSubjectTable();
      }
    });
  }

  function postToGlip(data) {
    return fetch(getWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json();
    });
  }

  function setupSorting() {
    document
      .querySelectorAll("#studentSubjectTable thead th[data-sort-field]")
      .forEach(function (header) {
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
          renderStudentSubjectTable();
        });
      });
  }

  function updateSortIndicators() {
    document
      .querySelectorAll("#studentSubjectTable thead th[data-sort-field]")
      .forEach(function (header) {
        const field = header.dataset.sortField;
        const label = header.dataset.label;

        if (field === sortField) {
          header.textContent = label + (sortDirection === "asc" ? " ▲" : " ▼");
        } else {
          header.textContent = label + " ↕";
        }
      });
  }

  function loadData() {
    setLoading(true);

    postToGlip({
      action: "getStudentSubjectManagementAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load student subject data.");
      }

      students = result.students || [];
      subjects = result.subjects || [];
      classes = result.classes || [];
      assignments = GLIPOptimisticUpdate.mergePendingRows(result.assignments || [], assignments, "student_subject_id");
      assignmentHistory = result.assignment_history || result.assignments || [];

      selectedStudentId = "";
      showAllEditorLevels = false;
      selectedRowKey = "";

      renderStudentSubjectTable();
      setLoading(false);
    }).catch(function (error) {
      console.error(error);
      setLoading(false);
      setGlobalMessage(error.message || "Could not load student subject data.");
    });
  }

function getStudentSubjectRowStatus(student) {
  const studentInactive = student.student_active === false || student.active === false;

  if (studentInactive) return "Inactive";

  return "";
}

  function hasPlanningWarningForStudent(student) {
    return student && student.level_active === false;
  }

  function isStudentSubjectRowSelectable(student) {
    return true;
  }

  function appendPlanningWarning(text, showWarning) {
    return String(text || "") + (showWarning ? " ⚠" : "");
  }

function rowNeedsAttention(row) {
  return row.student_active === false ||
    row.level_active === false ||
    row.curriculum_active === false;
}

function rowHasNoSubjectAssignment(row) {
  return row.status === "none";
}

function getStudentSubjectStatusText(row) {
  if (row.student_active === false) {
    return "Inactive";
  }

  if (row.level_active === false || row.curriculum_active === false) {
    return "Active (pending)";
  }

  if (row.status === "none") {
    return "Not assigned";
  }

  return "Assigned";
}

function formatStudentSubjectNameCell(row) {
  return escapeHtml(
    appendPlanningWarning(
      row.full_name,
      row.student_active === false
    )
  );
}

function formatStudentSubjectLevelCell(row) {
  return escapeHtml(
    appendPlanningWarning(
      row.level_text || "-",
      row.level_active === false
    )
  );
}

function formatStudentSubjectSubjectCell(row) {
  return escapeHtml(
    appendPlanningWarning(
      row.subject_text,
      row.curriculum_active === false
    )
  );
}

  
  function buildDisplayRows() {
    const rows = [];
    const studentsWithAssignments = {};

    assignments.forEach(function (assignment) {
      const student = findStudentById(assignment.student_id);
      if (!student) return;

      const subjectInfo = findSubjectByLevelAndId(
        assignment.level,
        assignment.subject_id
      );

      studentsWithAssignments[String(student.student_id)] = true;

      rows.push({
        row_key: makeRowKey(student.student_id, assignment.level, assignment.subject_id, assignment.access_type),
        student_id: student.student_id,
        full_name: formatStudentName(student),
        class_id: getAssignmentClassLabel(assignment, student),
        level: assignment.level,
        level_text: formatLevel(assignment.level),
        level_active: subjectInfo
          ? subjectInfo.level_active !== false
          : assignment.level_active !== false,
        student_active: student.student_active !== false && student.active !== false,
        selectable: isStudentSubjectRowSelectable(student),
        subject_id: assignment.subject_id,
        subject_text: assignment.subject_name || assignment.subject_id || "",
        curriculum_active: subjectInfo
          ? subjectInfo.curriculum_active !== false && subjectInfo.active !== false
          : assignment.curriculum_active !== false,
        access_type: assignment.access_type || "current",
        access_text: formatAccessType(assignment.access_type),
        status: "assigned",
        status_text: ""
      });
    });

    students.forEach(function (student) {
      if (studentsWithAssignments[String(student.student_id)]) return;

      rows.push({
        row_key: makeRowKey(student.student_id, "", "", "none"),
        student_id: student.student_id,
        full_name: formatStudentName(student),
        class_id: student.class_label || student.class_code || student.class_id,
        level: student.level || "",
        level_text: student.level ? formatLevel(student.level) : "",
        level_active: student.level_active !== false,
        student_active: student.student_active !== false && student.active !== false,
        selectable: isStudentSubjectRowSelectable(student),
        subject_id: "",
        subject_text: "No subject assigned",
        access_type: "",
        access_text: "-",
        status: "none",
        status_text: ""
      });
    });

    return rows;
  }

  function getSortedDisplayRows() {
    return buildDisplayRows().sort(function (a, b) {
      const valueA = getSortValue(a, sortField);
      const valueB = getSortValue(b, sortField);

      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;

      return String(a.full_name || "").localeCompare(String(b.full_name || ""));
    });
  }

  function getSortValue(row, field) {
    if (field === "level") return String(row.level_text || "").toLowerCase();
    if (field === "subject_id") return String(row.subject_text || "").toLowerCase();
    if (field === "access_type") return String(row.access_text || "").toLowerCase();
    if (field === "status") return String(row.status_text || "").toLowerCase();

    return String(row[field] || "").toLowerCase();
  }

  function renderStudentSubjectTable() {
    const tbody = document.getElementById("studentSubjectTableBody");
    const table = document.getElementById("studentSubjectTable");

    if (!tbody || !table) return;

    const sortedRowsRaw = getSortedDisplayRows();

    const sortedRows =
      typeof window.applyGlipTableFilter === "function"
        ? window.applyGlipTableFilter("studentSubjects", sortedRowsRaw)
        : sortedRowsRaw;

    if (!sortedRows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">No students or assignments found.</td>
        </tr>
      `;
      table.style.visibility = "visible";
      return;
    }

    tbody.innerHTML = sortedRows.map(function (row) {
      const isSelectable = row.selectable !== false;
      const isSelected = isSelectable && row.row_key === selectedRowKey;

      return `
        <tr
  data-row-key="${escapeHtml(row.row_key)}"
  data-student-id="${escapeHtml(row.student_id)}"
  data-selectable="${isSelectable ? "true" : "false"}"
  class="student-subject-row ${(rowNeedsAttention(row) || rowHasNoSubjectAssignment(row)) ? "planning-row" : ""} ${isSelected ? "selected-row" : ""}"
>
  <td>${formatStudentSubjectNameCell(row)}</td>
  <td>${escapeHtml(row.class_id)}</td>
  <td>${formatStudentSubjectLevelCell(row)}</td>
  <td>${formatStudentSubjectSubjectCell(row)}</td>
  <td>${escapeHtml(row.access_text || "-")}</td>
  <td>${escapeHtml(getStudentSubjectStatusText(row))}</td>
</tr>
        ${isSelected && isSelectable ? renderAssignmentEditRow(row.student_id) : ""}
      `;
    }).join("");

    document.querySelectorAll(".student-subject-row").forEach(function (row) {
      row.addEventListener("click", function () {
        hideSuccessMessage();

        const studentId = row.dataset.studentId || "";
        const rowKey = row.dataset.rowKey || "";

        if (selectedRowKey === rowKey) {
          selectedStudentId = "";
          selectedRowKey = "";
          showAllEditorLevels = false;
        } else {
          if (selectedStudentId !== studentId) showAllEditorLevels = false;
          selectedStudentId = studentId;
          selectedRowKey = rowKey;
        }

        renderStudentSubjectTable();
      });
    });

    document.querySelectorAll("[data-save-student-subjects]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        saveAssignments(btn.dataset.studentId);
      });
    });

    document.querySelectorAll("[data-cancel-student-subjects]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        selectedStudentId = "";
        selectedRowKey = "";
        showAllEditorLevels = false;
        renderStudentSubjectTable();
      });
    });

    document.querySelectorAll("[data-toggle-student-subject-levels]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        showAllEditorLevels = !showAllEditorLevels;
        renderStudentSubjectTable();
      });
    });

    document.querySelectorAll("[data-student-subject-assignment]").forEach(function (select) {
      select.addEventListener("change", function (event) {
        event.stopPropagation();
        syncClassControls(select.dataset.studentSubjectAssignment || "");
      });
    });

    table.style.visibility = "visible";
  }

  function renderAssignmentEditRow(studentId) {
    const student = findStudentById(studentId);

    if (!student) {
      return `
        <tr class="student-subject-edit-row">
          <td colspan="6">
            <div class="student-subject-inline-panel">
              Student not found.
            </div>
          </td>
        </tr>
      `;
    }

    if (!isStudentSubjectRowSelectable(student)) {
      return `
        <tr class="student-subject-edit-row">
          <td colspan="6">
            <div class="student-subject-inline-panel">
              This row is shown for reference only and cannot be edited because its status is: <strong>${escapeHtml(getStudentSubjectRowStatus(student))}</strong>.
            </div>
          </td>
        </tr>
      `;
    }

    const editableSubjects = getEditableSubjectsForStudent(student);
    const assignmentMap = getAssignmentStateMap(student.student_id);
    const visibleSubjects = showAllEditorLevels
      ? editableSubjects
      : editableSubjects.filter(function (subject) {
          return normaliseLevel(subject.level) === normaliseLevel(student.level);
        });
    const options = renderGroupedSubjectOptions(visibleSubjects, assignmentMap, student);

    return `
      <tr class="student-subject-edit-row">
        <td colspan="6">
          <div class="student-subject-inline-panel">
            <p class="panel-message" style="text-align:left;">
              <strong>Editing assignments for ${escapeHtml(formatStudentName(student))}.</strong><br>
              Changes made here apply to all subject assignments for this student. Current uses the class recorded in Student Management. Repeat and Revision use the class selected below.
            </p>

            <div class="student-subject-button-row" style="margin-top:0; margin-bottom:1rem;">
              <button
                type="button"
                class="glip-btn"
                data-save-student-subjects
                data-student-id="${escapeHtml(student.student_id)}"
              >
                Save All Assignments
              </button>

              <button
                type="button"
                class="glip-btn glip-btn-secondary"
                data-cancel-student-subjects
                data-student-id="${escapeHtml(student.student_id)}"
              >
                Cancel
              </button>

              <button
                type="button"
                class="glip-btn glip-btn-secondary"
                data-toggle-student-subject-levels
                data-student-id="${escapeHtml(student.student_id)}"
              >
                ${showAllEditorLevels ? "Show active levels" : "Show all levels"}
              </button>

              <span
                class="panel-message student-subject-inline-message"
                id="studentSubjectMessage-${escapeHtml(student.student_id)}"
              ></span>
              <div id="studentSubjectSaveProgress-${escapeHtml(student.student_id)}" class="glip-progress" style="display:none">
                <div class="glip-progress-bar"></div>
              </div>
            </div>

            <div class="topics-table-wrap">
              <table class="topics-table management-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Subject</th>
                    <th>Assignment Type</th>
                    <th>Class</th>
                  </tr>
                </thead>
                <tbody>
                  ${options || '<tr><td colspan="4">No active subjects found.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

function renderGroupedSubjectOptions(editableSubjects, activeMap, student) {
  return editableSubjects.map(function (subject) {
    const key = makeSubjectKey(subject.level, subject.subject_id);
    const existing = activeMap[key] || null;
    const value = existing && existing.active !== false
      ? existing.access_type || "current"
      : "not_assigned";
    const isCurrentLevel = normaliseLevel(subject.level) === normaliseLevel(student.level);
    const classOptions = getClassesForLevel(subject.level);
    const existingClassId = existing ? String(existing.class_id || "") : "";
    const currentClassPk = String(student.class_pk || "");
    const selectedClassId = isCurrentLevel ? currentClassPk : existingClassId;

    return `
      <tr>
        <td>${escapeHtml(appendPlanningWarning(formatLevel(subject.level), subject.level_active === false))}</td>
        <td>${escapeHtml(appendPlanningWarning(subject.subject_name || subject.subject_id, subject.curriculum_active === false || subject.active === false))}</td>
        <td>
          <select
            class="tracker-input student-subject-assignment-select"
            data-student-subject-assignment="${escapeHtml(student.student_id)}"
            data-level-code="${escapeHtml(subject.level)}"
            data-subject-id="${escapeHtml(subject.subject_id)}"
            data-current-level="${isCurrentLevel ? "true" : "false"}"
          >
            <option value="not_assigned" ${value === "not_assigned" ? "selected" : ""}>Not assigned</option>
            ${isCurrentLevel ? `
              ${value !== "not_assigned" && value !== "current" ? `
                <option value="${escapeHtml(value)}" selected disabled>${escapeHtml(formatAccessType(value))} (change to Current)</option>
              ` : ""}
              <option value="current" ${value === "current" ? "selected" : ""}>Current</option>
            ` : `
              ${value === "current" ? `
                <option value="current" selected disabled>Current (change to Repeat or Revision)</option>
              ` : ""}
              <option value="repeat" ${value === "repeat" ? "selected" : ""}>Repeat</option>
              <option value="revision" ${value === "revision" ? "selected" : ""}>Revision</option>
            `}
          </select>
        </td>
        <td>
          ${isCurrentLevel ? `
            <span data-current-class-label>${escapeHtml(student.class_label || student.class_code || student.class_id || "-")}</span>
            <input
              type="hidden"
              data-student-subject-class="${escapeHtml(student.student_id)}"
              data-level-code="${escapeHtml(subject.level)}"
              data-subject-id="${escapeHtml(subject.subject_id)}"
              value="${escapeHtml(currentClassPk)}"
            >
          ` : `
            <select
              class="tracker-input student-subject-class-select"
              data-student-subject-class="${escapeHtml(student.student_id)}"
              data-level-code="${escapeHtml(subject.level)}"
              data-subject-id="${escapeHtml(subject.subject_id)}"
              data-original-class-id="${escapeHtml(existingClassId)}"
              data-original-access-type="${escapeHtml(existing ? existing.access_type || "" : "")}"
              ${value === "not_assigned" || value === "current" ? "disabled" : ""}
            >
              <option value="">Select class</option>
              ${classOptions.map(function (klass) {
                const classId = String(klass.class_pk || klass.class_id || "");
                const label = klass.class_label || klass.class_code || klass.class_id || classId;
                const warning = klass.active === false ? " ⚠" : "";
                return `<option value="${escapeHtml(classId)}" ${classId === selectedClassId ? "selected" : ""}>${escapeHtml(label + warning)}</option>`;
              }).join("")}
            </select>
          `}
        </td>
      </tr>
    `;
  }).join("");
}

  function setStudentSubjectSavingState(studentId, isSaving) {
    const saveBtn = document.querySelector(`[data-save-student-subjects][data-student-id="${studentId}"]`);
    const cancelBtn = document.querySelector(`[data-cancel-student-subjects][data-student-id="${studentId}"]`);
    const selects = document.querySelectorAll(`[data-student-subject-assignment="${studentId}"]`);
    const classSelects = document.querySelectorAll(`select[data-student-subject-class="${studentId}"]`);
    const progress = document.getElementById("studentSubjectSaveProgress-" + studentId);
    if (saveBtn) { saveBtn.disabled = isSaving; saveBtn.textContent = isSaving ? "Saving..." : "Save All Assignments"; }
    if (cancelBtn) cancelBtn.disabled = isSaving;
    selects.forEach(function (select) { select.disabled = isSaving; });
    classSelects.forEach(function (select) {
      if (isSaving) {
        select.disabled = true;
      } else {
        const assignmentSelect = findAssignmentSelect(studentId, select.dataset.levelCode, select.dataset.subjectId);
        select.disabled = !assignmentSelect || assignmentSelect.value === "not_assigned" || assignmentSelect.value === "current";
      }
    });
    if (progress) progress.style.display = isSaving ? "block" : "none";
  }

  function saveAssignments(studentId) {
    const selects = Array.from(document.querySelectorAll(`[data-student-subject-assignment="${studentId}"]`));
    const messageEl = document.getElementById("studentSubjectMessage-" + studentId);
    const assignmentsToSave = [];
    const errors = [];
    const revisionOverrides = [];

    selects.forEach(function (select) {
      if (select.value === "not_assigned") return;

      const levelCode = select.dataset.levelCode || "";
      const subjectId = select.dataset.subjectId || "";
      const classControl = findClassControl(studentId, levelCode, subjectId);
      const classId = classControl ? String(classControl.value || "").trim() : "";
      const subjectInfo = findSubjectByLevelAndId(levelCode, subjectId) || {};
      const subjectName = subjectInfo.subject_name || subjectId;

      if (!classId) {
        errors.push(formatLevel(levelCode) + " / " + subjectName + ": select a class for " + formatAccessType(select.value) + ".");
        return;
      }

      if (
        select.value === "revision" &&
        classControl &&
        classControl.tagName === "SELECT" &&
        String(classControl.dataset.originalAccessType || "").toLowerCase() === "revision" &&
        String(classControl.dataset.originalClassId || "") &&
        String(classControl.dataset.originalClassId || "") !== classId
      ) {
        revisionOverrides.push({
          level: formatLevel(levelCode),
          subject: subjectName,
          oldClass: getClassLabelById(classControl.dataset.originalClassId),
          newClass: getClassLabelById(classId)
        });
      }

      assignmentsToSave.push({
        level_code: levelCode,
        subject_id: subjectId,
        access_type: select.value,
        class_id: classId,
        active: true
      });
    });

    if (errors.length) {
      setStudentSubjectMessage(messageEl, errors[0], "error");
      return;
    }

    const proceed = function () {
      setStudentSubjectMessage(messageEl, "", "info");
      setStudentSubjectSavingState(studentId, true);

      GLIPOptimisticUpdate.run({
        request: function () {
          return postToGlip({
            action: "saveStudentSubjectsAdmin",
            admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
            student_id: studentId,
            assignments_to_save: assignmentsToSave
          });
        },
        failureMessage: "Could not save assignments.",
        apply: function () {
          applyStudentSubjectAssignmentsLocally(studentId, assignmentsToSave);
          selectedStudentId = "";
          selectedRowKey = "";
          showAllEditorLevels = false;
          renderStudentSubjectTable();
        },
        onSuccess: function () {
          showSuccessMessage();
        },
        resync: resyncStudentSubjectsSilently,
        onFailure: function (error) {
          setStudentSubjectMessage(messageEl, error.message || "Could not save assignments. The previous values were retained.", "error");
        }
      }).finally(function () {
        setStudentSubjectSavingState(studentId, false);
      });
    };

    if (revisionOverrides.length && typeof window.showGlipConfirmModal === "function") {
      const rows = revisionOverrides.map(function (item) {
        return "<li><strong>" + escapeHtml(item.level + " / " + item.subject) + "</strong>: " +
          escapeHtml(item.oldClass || "previous class") + " → " + escapeHtml(item.newClass || "new class") + "</li>";
      }).join("");

      window.showGlipConfirmModal({
        title: "Change Revision Class",
        bodyHtml:
          "<p>Changing a Revision class changes the historical resource folders available to this student.</p>" +
          "<ul>" + rows + "</ul>" +
          "<p>Continue only if this change is intentional.</p>",
        noConfirmationInput: true,
        extraButtonText: "Change Revision Class",
        extraButtonAction: proceed
      });
      return;
    }

    proceed();
  }

  function applyStudentSubjectAssignmentsLocally(studentId, assignmentsToSave) {
    assignments = assignments.filter(function (assignment) {
      return String(assignment.student_id) !== String(studentId);
    });

    assignmentsToSave.forEach(function (item) {
      const subjectInfo = findSubjectByLevelAndId(
        item.level_code,
        item.subject_id
      ) || {};

      assignments.push({
        student_id: studentId,
        level: item.level_code,
        subject_id: item.subject_id,
        subject_name: subjectInfo.subject_name || item.subject_id,
        level_active: subjectInfo.level_active !== false,
        curriculum_active: subjectInfo.curriculum_active !== false && subjectInfo.active !== false,
        class_id: item.class_id,
        access_type: item.access_type,
        active: true
      });
    });
  }

  function resyncStudentSubjectsSilently() {
    postToGlip({
      action: "getStudentSubjectManagementAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") return;
      students = result.students || [];
      subjects = result.subjects || [];
      classes = result.classes || [];
      assignments = GLIPOptimisticUpdate.mergePendingRows(result.assignments || [], assignments, "student_subject_id");
      assignmentHistory = result.assignment_history || result.assignments || [];
      renderStudentSubjectTable();
    }).catch(function (error) {
      console.warn("Silent student subject resync failed.", error);
    });
  }

  function getEditableSubjectsForStudent(student) {
    const map = {};
    const list = [];

    // The Students table is now the only assignment editor. Show every
    // curriculum subject from every level so Current, Repeat or Revision
    // access can be managed here without the former Add Student
    // Assignment fieldset.
    subjects.forEach(function (subject) {
      const key = makeSubjectKey(subject.level, subject.subject_id);
      if (map[key]) return;

      map[key] = true;
      list.push(subject);
    });

    // Preserve any existing assignment that is not present in the current
    // curriculum dataset, for example an older/inactive curriculum record.
    assignments
      .filter(function (assignment) {
        return String(assignment.student_id) === String(student.student_id);
      })
      .forEach(function (assignment) {
        const key = makeSubjectKey(assignment.level, assignment.subject_id);
        if (map[key]) return;

        map[key] = true;
        list.push({
          level: assignment.level,
          subject_id: assignment.subject_id,
          subject_name: assignment.subject_name || assignment.subject_id,
          level_active: assignment.level_active,
          curriculum_active: assignment.curriculum_active
        });
      });

    return list.sort(function (a, b) {
      const levelA = normaliseLevel(a.level);
      const levelB = normaliseLevel(b.level);

      if (levelA !== levelB) return levelA.localeCompare(levelB);

      return String(a.subject_name || a.subject_id || "")
        .localeCompare(String(b.subject_name || b.subject_id || ""));
    });
  }

  function getAssignmentStateMap(studentId) {
    const map = {};

    assignmentHistory.forEach(function (assignment) {
      if (String(assignment.student_id) !== String(studentId)) return;

      const key = makeSubjectKey(assignment.level, assignment.subject_id);
      const existing = map[key];

      // Prefer an active record if duplicate historical rows ever exist.
      if (existing && existing.active !== false && assignment.active === false) return;

      map[key] = {
        class_id: assignment.class_id || "",
        access_type: String(assignment.access_type || "current").toLowerCase(),
        active: assignment.active !== false
      };
    });

    return map;
  }

  function getClassesForLevel(level) {
    const levelKey = normaliseLevel(level);
    return classes
      .filter(function (klass) {
        return normaliseLevel(klass.level) === levelKey;
      })
      .sort(function (a, b) {
        const sortA = Number(a.sort_order || 0);
        const sortB = Number(b.sort_order || 0);
        if (sortA !== sortB) return sortA - sortB;
        return String(a.class_label || a.class_code || "").localeCompare(String(b.class_label || b.class_code || ""));
      });
  }

  function getClassById(classId) {
    const id = String(classId || "");
    return classes.find(function (klass) {
      return String(klass.class_pk || klass.class_id || "") === id;
    }) || null;
  }

  function getClassLabelById(classId) {
    const klass = getClassById(classId);
    return klass ? (klass.class_label || klass.class_code || klass.class_id || String(classId || "")) : String(classId || "");
  }

  function getAssignmentClassLabel(assignment, student) {
    if (assignment && String(assignment.class_id || "").trim()) {
      return getClassLabelById(assignment.class_id);
    }
    return student.class_label || student.class_code || student.class_id || "";
  }

  function findAssignmentSelect(studentId, levelCode, subjectId) {
    return Array.from(document.querySelectorAll(`[data-student-subject-assignment="${studentId}"]`)).find(function (select) {
      return normaliseLevel(select.dataset.levelCode) === normaliseLevel(levelCode) &&
        String(select.dataset.subjectId || "") === String(subjectId || "");
    }) || null;
  }

  function findClassControl(studentId, levelCode, subjectId) {
    return Array.from(document.querySelectorAll(`[data-student-subject-class="${studentId}"]`)).find(function (control) {
      return normaliseLevel(control.dataset.levelCode) === normaliseLevel(levelCode) &&
        String(control.dataset.subjectId || "") === String(subjectId || "");
    }) || null;
  }

  function syncClassControls(studentId) {
    document.querySelectorAll(`[data-student-subject-assignment="${studentId}"]`).forEach(function (assignmentSelect) {
      const classControl = findClassControl(studentId, assignmentSelect.dataset.levelCode, assignmentSelect.dataset.subjectId);
      if (!classControl || classControl.tagName !== "SELECT") return;
      classControl.disabled = assignmentSelect.value === "not_assigned" || assignmentSelect.value === "current";
    });
  }

  function findSubjectByLevelAndId(level, subjectId) {
    return subjects.find(function (subject) {
      return normaliseLevel(subject.level) === normaliseLevel(level) &&
        String(subject.subject_id) === String(subjectId);
    }) || null;
  }

  function findStudentById(studentId) {
    return students.find(function (student) {
      return String(student.student_id) === String(studentId);
    }) || null;
  }

  function formatStudentName(student) {
    return [
      student.student_name,
      student.student_surname
    ].filter(Boolean).join(" ");
  }

  function makeSubjectKey(level, subjectId) {
    return normaliseLevel(level) + "|" + String(subjectId || "").toLowerCase();
  }

  function makeRowKey(studentId, level, subjectId, accessType) {
    return [
      String(studentId || ""),
      normaliseLevel(level),
      String(subjectId || "").toLowerCase(),
      String(accessType || "").toLowerCase()
    ].join("|");
  }

  function formatAccessType(accessType) {
  const text = String(accessType || "").toLowerCase();

  if (text === "revision") return "Revision";
  if (text === "repeat") return "Repeat";
  if (text === "current") return "Current";

  return text || "-";
}

  function formatLevel(level) {
    const value = String(level || "").trim();
    if (!value) return "";

    const match = value.match(/(?:level[-_\s]*)?0*(\d+)(?:[-_\s]+(\d{2,4}))?/i);
    if (!match) return value;

    return "Level " + Number(match[1]) + (match[2] ? "-" + match[2] : "");
  }

  function normaliseLevel(level) {
    const value = String(level || "").trim();

    if (!value) return "";

    if (value.indexOf("level-") === 0) return value;

    const digits = value.replace(/\D/g, "");

    if (!digits) return value;

    return "level-" + digits.padStart(2, "0");
  }

  function showSuccessMessage() {
    const el = document.getElementById("studentSubjectSuccessMessage");

    if (!el) return;

    el.className = "panel-message success";
    el.style.display = "block";

    clearTimeout(showSuccessMessage.timer);

    showSuccessMessage.timer = setTimeout(function () {
      el.style.display = "none";
    }, 3000);
  }

  function hideSuccessMessage() {
    const el = document.getElementById("studentSubjectSuccessMessage");

    if (!el) return;

    el.style.display = "none";
  }

  function setLoading(isLoading) {
    const progress = document.getElementById("studentSubjectLoadingProgress");
    const table = document.getElementById("studentSubjectTable");

    if (progress) {
      progress.style.display = isLoading ? "block" : "none";
    }

    if (table) {
      table.style.visibility = isLoading ? "hidden" : "visible";
    }
  }

  function setGlobalMessage(message) {
    const tbody = document.getElementById("studentSubjectTableBody");
    const table = document.getElementById("studentSubjectTable");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">${escapeHtml(message)}</td>
        </tr>
      `;
    }

    if (table) {
      table.style.visibility = "visible";
    }
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
    if (event.detail && event.detail.action === "getStudentSubjectManagementAdmin" && !selectedRowKey) loadData();
  });
})();
