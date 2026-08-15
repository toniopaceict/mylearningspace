(function () {
  "use strict";

  let studentsEditMode = false;
  let currentStudents = [];
  let selectedStudentIds = [];
  let lastSelectedStudentIndex = null;
  let studentSortField = "full_name";
  let studentSortDirection = "asc";
  let displayedStudents = [];
  let studentManagementInitialised = false;
  let availableStudentClasses = [];
  let pendingStudentSaves = 0;

  function getWebAppUrl() {
    return window.getGlipWebAppUrl();
  }

  function safelyInitStudentManagement() {
    if (studentManagementInitialised) return;

    if (typeof isAdmin !== "function") {
      setTimeout(safelyInitStudentManagement, 100);
      return;
    }

    studentManagementInitialised = true;
    initStudentManagement();
  }

  document.addEventListener("glipReady", safelyInitStudentManagement);
  document.addEventListener("DOMContentLoaded", safelyInitStudentManagement);

  function initStudentManagement() {
    if (typeof isAdmin !== "function" || !isAdmin()) return;

    const saveStudentBtn = document.getElementById("saveStudentBtn");
    const editStudentsBtn = document.getElementById("editStudentsBtn");
    const sendSelectedStudentCodesBtn =
      document.getElementById("sendSelectedStudentCodesBtn");

    if (saveStudentBtn) {
      saveStudentBtn.addEventListener("click", saveStudent);
    }

    if (editStudentsBtn) {
      editStudentsBtn.addEventListener("click", toggleStudentsEditMode);
    }

    if (sendSelectedStudentCodesBtn) {
      sendSelectedStudentCodesBtn.addEventListener(
        "click",
        sendSelectedStudentCodes
      );
    }

    [
      "newStudentName",
      "newStudentSurname",
      "newStudentCode",
      "newStudentEmail"
    ].forEach(function (fieldId) {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener("input", clearAddStudentMessage);
      }
    });

    [
      "newStudentLevel",
      "newStudentClassId",
      "sendStudentCodeOnCreate"
    ].forEach(function (fieldId) {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener("change", clearAddStudentMessage);
      }
    });

    setupStudentTableSorting();
    updateSortIndicators();
    loadStudents();
    loadStudentClasses();

    if (typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "students",
        tableName: "Students",
        messageElementId: "studentManagementMessage",
        refresh: loadStudents,
        onImportBusyStateChange: function (state) {
          const box = document.getElementById("studentsLoadingProgress");
          const text = document.getElementById("studentsProgressText");

          if (text) {
            text.textContent = state.busy
              ? (state.text || "Saving...")
              : "Loading students...";
          }

          if (box) {
            box.style.display = state.busy ? "block" : "none";
          }
        }
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

  function addFullName(student) {
    student.full_name = (
      (student.student_name || "") +
      " " +
      (student.student_surname || "")
    ).trim();

    return student;
  }

  function setupStudentTableSorting() {
    const sortableHeaders = document.querySelectorAll(
      "#studentsTable thead th[data-sort-field]"
    );

    sortableHeaders.forEach(function (header) {
      header.style.cursor = "pointer";

      header.addEventListener("click", function () {
        const field = header.dataset.sortField;

        if (studentSortField === field) {
          studentSortDirection =
            studentSortDirection === "asc" ? "desc" : "asc";
        } else {
          studentSortField = field;
          studentSortDirection = "asc";
        }

        lastSelectedStudentIndex = null;
        updateSortIndicators();
        renderStudents(currentStudents);
      });
    });
  }

  function updateSortIndicators() {
    document
      .querySelectorAll("#studentsTable thead th[data-sort-field]")
      .forEach(function (header) {
        const field = header.dataset.sortField;
        const label = header.dataset.label;

        if (field === studentSortField) {
          header.textContent =
            label + (studentSortDirection === "asc" ? " ▲" : " ▼");
        } else {
          header.textContent = label + " ↕";
        }
      });
  }

  function getSortedStudents(students) {
    return students.slice().sort(function (a, b) {
      let valueA = a[studentSortField];
      let valueB = b[studentSortField];

      if (studentSortField === "active") {
        valueA = valueA ? 1 : 0;
        valueB = valueB ? 1 : 0;
      } else {
        valueA = String(valueA || "").toLowerCase();
        valueB = String(valueB || "").toLowerCase();
      }

      if (valueA < valueB) return studentSortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return studentSortDirection === "asc" ? 1 : -1;

      return 0;
    });
  }

  function setMessage(text, type) {
    const message = document.getElementById("studentManagementMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
  }

  function setAddStudentMessage(text, type) {
    const message = document.getElementById("addStudentMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className =
      "panel-message add-teacher-message " + (type || "info");
  }

  function clearAddStudentMessage() {
    setAddStudentMessage("", "info");
  }

  function setStudentsLoadingState(isLoading) {
    const loadingBox = document.getElementById("studentsLoadingProgress");
    const progressText = document.getElementById("studentsProgressText");
    const table = document.getElementById("studentsTable");

    if (progressText) {
      progressText.textContent = "Loading students...";
    }

    if (loadingBox) {
      loadingBox.style.display = isLoading ? "block" : "none";
    }

    if (table) {
      table.style.visibility = isLoading ? "hidden" : "visible";
    }
  }

  function setStudentSavingState(isSaving) {
    const saveStudentBtn = document.getElementById("saveStudentBtn");
    const progressBox = document.getElementById("studentsLoadingProgress");
    const progressText = document.getElementById("studentsProgressText");

    if (saveStudentBtn) {
      saveStudentBtn.disabled = isSaving;
      saveStudentBtn.textContent = isSaving ? "Saving..." : "Save Student";
    }

    if (progressText) {
      progressText.textContent = isSaving
        ? "Saving..."
        : "Loading students...";
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

  function clearAddStudentForm() {
    document.getElementById("newStudentName").value = "";
    document.getElementById("newStudentSurname").value = "";
    document.getElementById("newStudentCode").value = "";
    document.getElementById("newStudentEmail").value = "";
    document.getElementById("newStudentLevel").value = "";

    const classSelect = document.getElementById("newStudentClassId");

    if (classSelect) {
      classSelect.innerHTML = '<option value="">Select level first</option>';
      classSelect.disabled = true;
    }

    const sendCodeCheckbox =
      document.getElementById("sendStudentCodeOnCreate");

    if (sendCodeCheckbox) {
      sendCodeCheckbox.checked = true;
    }
  }

  function saveStudent() {
    if (pendingStudentSaves > 0) {
      setAddStudentMessage(
        "Please wait until the current student has finished saving.",
        "info"
      );
      return;
    }

    const studentName = document
      .getElementById("newStudentName")
      .value.trim();
    const studentSurname = document
      .getElementById("newStudentSurname")
      .value.trim();
    const code = document
      .getElementById("newStudentCode")
      .value.trim();
    const email = document
      .getElementById("newStudentEmail")
      .value.trim();
    const level = document
      .getElementById("newStudentLevel")
      .value.trim();
    const classId = document
      .getElementById("newStudentClassId")
      .value.trim();
    const sendCodeEmail =
      document.getElementById("sendStudentCodeOnCreate")?.checked || false;

    setAddStudentMessage("", "info");

    if (!studentName || !studentSurname || !code || !level || !classId) {
      setAddStudentMessage(
        "First name, surname, login code and class are required.",
        "error"
      );
      return;
    }

    const classInfo = availableStudentClasses.find(function (item) {
      return String(item.class_id) === String(classId);
    });

    const normalisedLevel = classInfo
      ? String(classInfo.level || level).trim()
      : String(level || "").trim();

    if (!classInfo) {
      setAddStudentMessage(
        "The selected class is no longer available. Please select it again.",
        "error"
      );
      loadStudentClasses();
      return;
    }

    const temporaryId = "pending-student-" + Date.now();

    const optimisticStudent = addFullName({
      student_id: temporaryId,
      student_name: studentName,
      student_surname: studentSurname,
      code: code,
      email: email,
      level: normalisedLevel,
      class_id: classId,
      class_label: classInfo.class_label || classId,
      level_active: classInfo.level_active !== false,
      class_active: classInfo.active !== false,
      active: true,
      pending_save: true
    });

        pendingStudentSaves += 1;
    updateEditStudentsButton();
    setStudentSavingState(true);

    GLIPOptimisticUpdate.run({
      request: function () {
        return postToGlip({
          action: "addStudentAdmin",
          admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
          student_name: studentName,
          student_surname: studentSurname,
          code: code,
          email: email,
          level: normalisedLevel,
          class_id: classId,
          send_code_email: sendCodeEmail
        });
      },

      failureMessage: "Could not add student.",
      apply: function () { currentStudents.push(optimisticStudent); clearAddStudentForm(); renderStudents(currentStudents); },

      onSuccess: function (result) {
        const temporaryStudent = currentStudents.find(function (student) {
          return String(student.student_id) === temporaryId;
        });

        if (temporaryStudent) {
          temporaryStudent.student_id =
            result.student_id !== undefined && result.student_id !== null
              ? String(result.student_id)
              : temporaryStudent.student_id;
          GLIPOptimisticUpdate.markSaved(temporaryStudent);
        }

        pendingStudentSaves = Math.max(0, pendingStudentSaves - 1);
        setStudentSavingState(false);
        updateEditStudentsButton();
        renderStudents(currentStudents);

        setAddStudentMessage(
          result.message || "Student added successfully.",
          "success"
        );
      },

      resync: resyncStudentsSilently,

      rollback: function () {
        currentStudents = currentStudents.filter(function (student) {
          return String(student.student_id) !== temporaryId;
        });

        pendingStudentSaves = Math.max(0, pendingStudentSaves - 1);
        setStudentSavingState(false);
        updateEditStudentsButton();
        renderStudents(currentStudents);
      },

      onFailure: function (error) {
        setAddStudentMessage(
          error.message ||
            "Could not add student. The temporary row was removed.",
          "error"
        );
      }
    });
  }

  function loadStudentClasses() {
    return postToGlip({
      action: "listClassesAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not load classes.");
        }

        availableStudentClasses = result.classes || [];
        populateAddStudentDropdowns();
      })
      .catch(function (error) {
        console.error(error);
        setAddStudentMessage("Could not load levels and classes.", "error");
      });
  }

    function isStudentLevelInactive(level) {
    const norm = normaliseLevel(level);
    const match = availableStudentClasses.find(function (item) {
      return normaliseLevel(item.level) === norm;
    });
    return !!(match && match.level_active === false);
  }

function populateAddStudentDropdowns() {
    const levelSelect = document.getElementById("newStudentLevel");
    const classSelect = document.getElementById("newStudentClassId");

    if (!levelSelect || !classSelect) return;

    const levels = [...new Set(
      availableStudentClasses.map(function (item) {
        return item.level;
      })
    )];

    levelSelect.innerHTML =
      '<option value="">Select level</option>' +
      levels.map(function (level) {
        return '<option value="' + escapeHtml(level) + '">' +
          escapeHtml(appendPlanningWarning(formatLevel(level), isStudentLevelInactive(level))) +
          '</option>';
      }).join("");

    classSelect.innerHTML = '<option value="">Select level first</option>';
    classSelect.disabled = true;

    levelSelect.addEventListener("change", function () {
      populateClassDropdownForLevel(levelSelect.value, classSelect);
    });
  }

  function getStudentClassDisplayText(classId) {
    const match = availableStudentClasses.find(function (item) {
      return String(item.class_id) === String(classId);
    });

    return match ? getClassDisplayText(match) : classId;
  }

  function getClassDisplayText(item) {
    const code = String(item.class_id || "").trim();
    const label = String(item.class_label || "").trim();

    if (!label || label === code) {
      return code;
    }

    return label + " (" + code + ")";
  }

  function isClassAvailableForAssignment(item) {
    return item && item.active && item.level_active !== false;
  }

  function getAssignableStudentClasses(selectedClassId) {
    return availableStudentClasses.slice();
  }

  function populateClassDropdownForLevel(level, classSelect, selectedClassId) {
    if (!level) {
      classSelect.innerHTML = '<option value="">Select level first</option>';
      classSelect.disabled = true;
      return;
    }

    const classesForLevel = getAssignableStudentClasses(selectedClassId).filter(function (item) {
      return normaliseLevel(item.level) === normaliseLevel(level);
    });

    classSelect.innerHTML =
      '<option value="">Select class</option>' +
      classesForLevel.map(function (item) {
        const selected = String(item.class_id) === String(selectedClassId) ? "selected" : "";

        return '<option value="' + escapeHtml(item.class_id) + '" ' + selected + '>' +
          escapeHtml(appendPlanningWarning(getClassDisplayText(item), item.active === false || item.level_active === false)) +
          '</option>';
      }).join("");

    classSelect.disabled = classesForLevel.length === 0;
  }

  if (typeof window.setupGlipTableFilter === "function") {
    window.setupGlipTableFilter({
      filterId: "students",
      tableId: "studentsTable",
      fields: [
        { value: "full_name", label: "Full Name" },
        { value: "code", label: "Code" },
        { value: "email", label: "Email" },
        {
          value: "level",
          label: "Level",
          getValue: function (student) {
            return formatLevel(student.level);
          }
        },
        { value: "class_id", label: "Class" },
        {
          value: "active",
          label: "Status",
getValue: getStudentStatusText
        }
      ],
      onChange: function () {
        renderStudents(currentStudents);
      }
    });
  }

  function loadStudents() {
    const tbody = document.getElementById("studentsTableBody");
    if (!tbody) return;

    setStudentsLoadingState(true);

    postToGlip({
      action: "listStudentsAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not load students.");
        }

        setStudentsLoadingState(false);
        currentStudents = GLIPOptimisticUpdate.mergePendingRows((result.students || []).map(addFullName), currentStudents, "student_id");
        studentsEditMode = false;
        updateEditStudentsButton();
        renderStudents(currentStudents);
      })
      .catch(function (error) {
        console.error(error);
        setStudentsLoadingState(false);
        setMessage("Could not load students.", "error");

        tbody.innerHTML = `
          <tr>
            <td colspan="6">Could not load students.</td>
          </tr>
        `;
      });
  }

  function toggleStudentsEditMode() {
    if (pendingStudentSaves > 0) {
      setMessage(
        "Please wait until the new student has finished saving.",
        "info"
      );
      return;
    }

    if (studentsEditMode) {
      saveStudentChanges();
      return;
    }

    studentsEditMode = true;
    setMessage("", "info");
    updateEditStudentsButton();
    renderStudents(currentStudents);
  }

  function cancelStudentsEditMode() {
    studentsEditMode = false;
    updateEditStudentsButton();
    renderStudents(currentStudents);
    setMessage("", "info");
  }

  function updateEditStudentsButton() {
    const editStudentsBtn = document.getElementById("editStudentsBtn");
    if (!editStudentsBtn) return;

    const hasPendingSaves = pendingStudentSaves > 0;
    const sendSelectedStudentCodesBtn =
      document.getElementById("sendSelectedStudentCodesBtn");

    editStudentsBtn.disabled = hasPendingSaves;
    editStudentsBtn.textContent = studentsEditMode
      ? "Save Changes"
      : "Edit Students";
    editStudentsBtn.title = hasPendingSaves
      ? "Please wait until the new student has finished saving."
      : "";

    if (sendSelectedStudentCodesBtn) {
      sendSelectedStudentCodesBtn.style.display = studentsEditMode
        ? "none"
        : "inline-flex";
      sendSelectedStudentCodesBtn.disabled = hasPendingSaves;
      sendSelectedStudentCodesBtn.title = hasPendingSaves
        ? "Please wait until the new student has finished saving."
        : "";
    }

    let cancelBtn = document.getElementById("cancelStudentsEditBtn");

    if (studentsEditMode && !cancelBtn && !hasPendingSaves) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelStudentsEditBtn";
      cancelBtn.className =
        "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.marginLeft = "8px";
      cancelBtn.addEventListener("click", cancelStudentsEditMode);

      editStudentsBtn.insertAdjacentElement("afterend", cancelBtn);
    }

    if ((!studentsEditMode || hasPendingSaves) && cancelBtn) {
      cancelBtn.remove();
    }
  }

    function appendPlanningWarning(text, showWarning) {
    return String(text || "") + (showWarning ? " ⚠" : "");
  }

  function getStudentClassById(classId) {
    return availableStudentClasses.find(function (item) {
      return String(item.class_id) === String(classId);
    }) || null;
  }

function studentIsInactive(student) {
  return student.active === false;
}

function studentHasInactiveLevel(student) {
  return student.level_active === false;
}

function studentHasInactiveClass(student) {
  return student.class_active === false;
}

function studentNeedsAttention(student) {
  return studentIsInactive(student) ||
    studentHasInactiveLevel(student) ||
    studentHasInactiveClass(student);
}

function getStudentStatusText(student) {
  if (studentIsInactive(student)) {
    return "Inactive";
  }

  if (studentHasInactiveLevel(student) || studentHasInactiveClass(student)) {
    return "Active (pending)";
  }

  return "Active";
}

function formatStudentNameCell(student) {
  return escapeHtml(
    appendPlanningWarning(
      student.full_name,
      studentIsInactive(student)
    )
  );
}

function formatStudentLevelCell(student) {
  return escapeHtml(
    appendPlanningWarning(
      formatLevel(student.level),
      studentHasInactiveLevel(student)
    )
  );
}

function formatStudentClassCell(student) {
  return escapeHtml(
    appendPlanningWarning(
      getStudentClassDisplayText(student.class_id),
      studentHasInactiveClass(student)
    )
  );
}


  
function renderStudents(students) {
    const tbody = document.getElementById("studentsTableBody");
    if (!tbody) return;

    const filteredStudents =
      typeof window.applyGlipTableFilter === "function"
        ? window.applyGlipTableFilter("students", students)
        : students;

    if (!filteredStudents.length) {
      displayedStudents = [];

      tbody.innerHTML = `
        <tr>
          <td colspan="6">No students found.</td>
        </tr>
      `;
      return;
    }

    displayedStudents = getSortedStudents(filteredStudents);

    tbody.innerHTML = displayedStudents
      .map(function (student, index) {
        if (studentsEditMode) {
          return renderStudentEditRow(student);
        }

        return `
          <tr
class="teacher-selectable-row ${studentNeedsAttention(student) ? "planning-row" : ""} ${
  selectedStudentIds.includes(student.student_id)
    ? "teacher-row-selected"
    : ""
}"
            data-student-id="${escapeHtml(student.student_id)}"
            data-student-index="${index}"
          >
<td>${formatStudentNameCell(student)}</td>
<td>${escapeHtml(student.code)}</td>
<td>${escapeHtml(student.email)}</td>
<td>${formatStudentLevelCell(student)}</td>
<td>${formatStudentClassCell(student)}</td>
<td>${getStudentStatusText(student)}</td>
          </tr>
        `;
      })
      .join("");

    document.querySelectorAll(".student-edit-level").forEach(function (levelSelect) {
      levelSelect.addEventListener("change", function () {
        const row = levelSelect.closest("tr");
        const classSelect = row.querySelector(".student-edit-class");

        classSelect.innerHTML =
          '<option value="">Select class</option>' +
          renderClassOptions(levelSelect.value, "");

        classSelect.value = "";

        setMessage("", "info");
        markChangedFields();
      });
    });

    if (studentsEditMode) {
      document.querySelectorAll("[data-field]").forEach(function (field) {
        field.addEventListener("input", function () {
          setMessage("", "info");
          markChangedFields();
        });

        field.addEventListener("change", function () {
          setMessage("", "info");
          markChangedFields();
        });
      });
    }

    if (!studentsEditMode) {
      document.querySelectorAll(".teacher-selectable-row").forEach(function (row) {
        row.addEventListener("click", handleStudentRowSelection);
      });
    }
  }

  function renderLevelOptions(selectedLevel) {
    const levels = [...new Set(
      getAssignableStudentClasses().map(function (item) {
        return item.level;
      })
    )];

    if (selectedLevel && levels.indexOf(selectedLevel) === -1) {
      levels.push(selectedLevel);
    }

    return levels.map(function (level) {
      const selected = level === selectedLevel ? "selected" : "";

      return '<option value="' + escapeHtml(level) + '" ' + selected + '>' +
        escapeHtml(appendPlanningWarning(formatLevel(level), isStudentLevelInactive(level))) +
        '</option>';
    }).join("");
  }

  function renderClassOptions(level, selectedClassId) {
    const classesForLevel = getAssignableStudentClasses(selectedClassId).filter(function (item) {
      return normaliseLevel(item.level) === normaliseLevel(level);
    });

    return classesForLevel.map(function (item) {
      const selected = item.class_id === selectedClassId ? "selected" : "";

      return '<option value="' + escapeHtml(item.class_id) + '" ' + selected + '>' +
        escapeHtml(getClassDisplayText(item)) +
        '</option>';
    }).join("");
  }

  function renderStudentEditRow(student) {
    return `
      <tr
  class="${studentNeedsAttention(student) ? "planning-row" : ""}"
  data-student-row="${escapeHtml(student.student_id)}"
>
        <td>
          <div class="name-edit-stack">
            <input
              type="text"
              class="tracker-input"
              autocomplete="off"
              data-field="student_name"
              value="${escapeHtml(student.student_name)}"
              placeholder="Name"
            />

            <input
              type="text"
              class="tracker-input"
              autocomplete="off"
              data-field="student_surname"
              value="${escapeHtml(student.student_surname)}"
              placeholder="Surname"
            />
          </div>
        </td>

        <td>
          <input
            type="text"
            class="tracker-input"
            autocomplete="off"
            data-field="code"
            value="${escapeHtml(student.code)}"
          />
        </td>

        <td>
          <input
            type="email"
            class="tracker-input"
            autocomplete="off"
            data-field="email"
            value="${escapeHtml(student.email)}"
          />
        </td>

        <td>
          <select class="tracker-input student-edit-level" data-field="level">
            ${renderLevelOptions(student.level)}
          </select>
        </td>

        <td>
          <select class="tracker-input student-edit-class" data-field="class_id">
            <option value="">Select class</option>
            ${renderClassOptions(student.level, student.class_id)}
          </select>
        </td>

        <td>
          <select class="tracker-input" data-field="active">
            <option value="true" ${student.active ? "selected" : ""}>Active</option>
            <option value="false" ${!student.active ? "selected" : ""}>Inactive</option>
          </select>
        </td>
      </tr>
    `;
  }

  function markChangedFields() {
    const rows = document.querySelectorAll("[data-student-row]");

    rows.forEach(function (row) {
      const studentId = row.dataset.studentRow;
      const originalStudent = currentStudents.find(function (student) {
        return student.student_id === studentId;
      });

      if (!originalStudent) return;

      row.querySelectorAll("[data-field]").forEach(function (field) {
        const fieldName = field.dataset.field;
        let currentValue = field.value;
        let originalValue = originalStudent[fieldName];

        if (fieldName === "active") {
          originalValue = originalStudent.active ? "true" : "false";
        }

        field.classList.toggle(
          "teacher-field-changed",
          String(currentValue).trim() !== String(originalValue || "").trim()
        );
      });
    });
  }

  function applyStudentUpdatesLocally(studentsToSave) {
    studentsToSave.forEach(function (update) {
      const existing = currentStudents.find(function (student) {
        return String(student.student_id) === String(update.student_id);
      });

      if (!existing) return;

      const classInfo = getStudentClassById(update.class_id);

      existing.student_name = update.student_name;
      existing.student_surname = update.student_surname;
      existing.full_name = [update.student_name || "", update.student_surname || ""].join(" ").trim();
      existing.code = update.code;
      existing.email = update.email;
      existing.level = update.level;
      existing.class_id = update.class_id;
      existing.level_active = classInfo ? classInfo.level_active : existing.level_active;
      existing.class_active = classInfo ? classInfo.active : existing.class_active;
      existing.active = update.active;
    });
  }

  function resyncStudentsSilently() {
    postToGlip({
      action: "listStudentsAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") return;
      currentStudents = GLIPOptimisticUpdate.mergePendingRows((result.students || []).map(addFullName), currentStudents, "student_id");
      renderStudents(currentStudents);
    }).catch(function (error) {
      console.warn("Silent student resync failed.", error);
    });
  }

  function saveStudentChanges() {
    const rows = document.querySelectorAll("[data-student-row]"); const studentsToSave = [];
    rows.forEach(function (row) {
      const student = { student_id: row.dataset.studentRow };
      row.querySelectorAll("[data-field]").forEach(function (field) {
        if (field.dataset.field === "active") student[field.dataset.field] = field.value === "true";
        else if (field.dataset.field === "level") student[field.dataset.field] = normaliseLevel(field.value.trim());
        else student[field.dataset.field] = field.value.trim();
      });
      studentsToSave.push(student);
    });
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "updateStudentsAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), students: studentsToSave }); },
      failureMessage: "Could not save student changes.",
      apply: function () { applyStudentUpdatesLocally(studentsToSave); studentsEditMode = false; updateEditStudentsButton(); renderStudents(currentStudents); },
      onSuccess: function (result) { setMessage(result.message || "Student changes saved.", "success"); },
      resync: resyncStudentsSilently,
      rollback: function () { currentStudents = previousStudents; renderStudents(currentStudents); },
      onFailure: function (error) { setMessage(error.message || "Could not save student changes. The previous values were restored.", "error"); }
    });
  }

  function setStudentsSavingState(isSaving) {
    const editStudentsBtn = document.getElementById("editStudentsBtn");
    const cancelStudentsEditBtn =
      document.getElementById("cancelStudentsEditBtn");
    const progressBox = document.getElementById("saveStudentsProgress");

    if (editStudentsBtn) {
      editStudentsBtn.disabled = isSaving;
      editStudentsBtn.textContent = isSaving
        ? "Saving..."
        : studentsEditMode
          ? "Save Changes"
          : "Edit Students";
    }

    if (cancelStudentsEditBtn) {
      cancelStudentsEditBtn.disabled = isSaving;
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

  function handleStudentRowSelection(event) {
    const row = event.currentTarget;
    const studentId = row.dataset.studentId;
    const studentIndex = Number(row.dataset.studentIndex);

    if (!studentId || Number.isNaN(studentIndex)) return;

    if (event.shiftKey && lastSelectedStudentIndex !== null) {
      const start = Math.min(lastSelectedStudentIndex, studentIndex);
      const end = Math.max(lastSelectedStudentIndex, studentIndex);

      const clickedRowIsSelected = selectedStudentIds.includes(studentId);

      for (let i = start; i <= end; i++) {
        const student = displayedStudents[i];
        if (!student) continue;

        if (clickedRowIsSelected) {
          selectedStudentIds = selectedStudentIds.filter(function (id) {
            return id !== student.student_id;
          });
        } else if (!selectedStudentIds.includes(student.student_id)) {
          selectedStudentIds.push(student.student_id);
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (selectedStudentIds.includes(studentId)) {
        selectedStudentIds = selectedStudentIds.filter(function (id) {
          return id !== studentId;
        });
      } else {
        selectedStudentIds.push(studentId);
      }

      lastSelectedStudentIndex = studentIndex;
    } else {
      if (
        selectedStudentIds.length === 1 &&
        selectedStudentIds.includes(studentId)
      ) {
        selectedStudentIds = [];
        lastSelectedStudentIndex = null;
      } else {
        selectedStudentIds = [studentId];
        lastSelectedStudentIndex = studentIndex;
      }
    }

    renderStudents(currentStudents);
  }

  function sendSelectedStudentCodes() {
    if (pendingStudentSaves > 0) {
      setMessage(
        "Please wait until the new student has finished saving.",
        "info"
      );
      return;
    }

    const studentIdsToSend = selectedStudentIds.slice();

    if (studentIdsToSend.length === 0) {
      setMessage("Please select at least one student.", "error");
      return;
    }

    if (typeof window.showGlipConfirmModal !== "function") {
      setMessage("Confirmation box could not be loaded.", "error");
      return;
    }

    window.showGlipConfirmModal({
      title: "Send Student Access Codes",
      bodyHtml:
        "<p>Send GLIP access codes to <strong>" +
        studentIdsToSend.length +
        "</strong> selected student(s)?</p>",
      noConfirmationInput: true,
      extraButtonText: "Send Codes",
      extraButtonAction: function () {
        proceedWithSendingStudentCodes(studentIdsToSend);
      }
    });
  }

  function proceedWithSendingStudentCodes(studentIdsToSend) {
    setMessage("Sending emails...", "info");

    postToGlip({
      action: "sendStudentCodesBulk",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      student_ids: studentIdsToSend
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Emails could not be sent.");
        }

        setMessage(
          "Emails sent: " + result.sent + ". Failed: " + result.failed + ".",
          result.failed > 0 ? "error" : "success"
        );

        selectedStudentIds = [];
        lastSelectedStudentIndex = null;
        renderStudents(currentStudents);
      })
      .catch(function (error) {
        console.error(error);
        setMessage(error.message || "Email sending failed.", "error");
      });
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
    if (/^level-/i.test(value)) return value.toLowerCase();

    const match = value.match(/(?:level[-_\s]*)?0*(\d+)(?:[-_\s]+(\d{2,4}))?/i);
    if (!match) return value.toLowerCase();

    return "level-" + String(Number(match[1])).padStart(2, "0") + (match[2] ? "-" + match[2] : "");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (!event.detail) return;
    if (event.detail.action === "listClassesAdmin") loadStudentClasses();
    if (event.detail.action === "listStudentsAdmin" && !studentsEditMode) loadStudents();
  });
})();
