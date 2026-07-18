(function () {
  "use strict";

  let teachersEditMode = false;
  let currentTeachers = [];
  let selectedTeacherIds = [];
  let lastSelectedTeacherIndex = null;
  let teacherSortField = "teacher_name";
  let teacherSortDirection = "asc";
  let displayedTeachers = [];
  let teacherManagementInitialised = false;

function getWebAppUrl() {
  return window.getGlipWebAppUrl();
}

  

  function safelyInitTeacherManagement() {
    if (teacherManagementInitialised) return;

    if (typeof isAdmin !== "function") {
      setTimeout(safelyInitTeacherManagement, 100);
      return;
    }

    teacherManagementInitialised = true;
    initTeacherManagement();
  }

  document.addEventListener("glipReady", safelyInitTeacherManagement);
  document.addEventListener("DOMContentLoaded", safelyInitTeacherManagement);

  function initTeacherManagement() {
    if (typeof isAdmin !== "function" || !isAdmin()) return;

    const saveTeacherBtn = document.getElementById("saveTeacherBtn");
    const editTeachersBtn = document.getElementById("editTeachersBtn");
    const sendSelectedTeacherCodesBtn =
      document.getElementById("sendSelectedTeacherCodesBtn");

    if (saveTeacherBtn) {
      saveTeacherBtn.addEventListener("click", saveTeacher);
    }

    if (editTeachersBtn) {
      editTeachersBtn.addEventListener("click", toggleTeachersEditMode);
    }

    if (sendSelectedTeacherCodesBtn) {
      sendSelectedTeacherCodesBtn.addEventListener(
        "click",
        sendSelectedTeacherCodes
      );
    }

    setupTeacherTableSorting();
    updateSortIndicators();
    loadTeachers();

    if (typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "teachers",
        tableName: "Teachers",
        messageElementId: "teacherManagementMessage",
        refresh: loadTeachers
      });
    }
  }

  function setupTeacherTableSorting() {
    const sortableHeaders = document.querySelectorAll(
      "#teachersTable thead th[data-sort-field]"
    );

    sortableHeaders.forEach(function (header) {
      header.style.cursor = "pointer";

      header.addEventListener("click", function () {
        const field = header.dataset.sortField;

        if (teacherSortField === field) {
          teacherSortDirection =
            teacherSortDirection === "asc" ? "desc" : "asc";
        } else {
          teacherSortField = field;
          teacherSortDirection = "asc";
        }

        lastSelectedTeacherIndex = null;
        updateSortIndicators();
        renderTeachers(currentTeachers);
      });
    });
  }

    function updateSortIndicators() {
      document
        .querySelectorAll("#teachersTable thead th[data-sort-field]")
        .forEach(function (header) {
          const field = header.dataset.sortField;
          const label = header.dataset.label;
    
          if (field === teacherSortField) {
            header.textContent =
              label +
              (teacherSortDirection === "asc"
                ? " ▲"
                : " ▼");
          } else {
            header.textContent =
              label + " ↕";
          }
        });
    }

  
  function getSortedTeachers(teachers) {
    return teachers.slice().sort(function (a, b) {
      let valueA = a[teacherSortField];
      let valueB = b[teacherSortField];

      if (teacherSortField === "active") {
        valueA = valueA ? 1 : 0;
        valueB = valueB ? 1 : 0;
      } else {
        valueA = String(valueA || "").toLowerCase();
        valueB = String(valueB || "").toLowerCase();
      }

      if (valueA < valueB) return teacherSortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return teacherSortDirection === "asc" ? 1 : -1;

      return 0;
    });
  }

  function clearAddTeacherForm() {
    document.getElementById("newTeacherName").value = "";
    document.getElementById("newTeacherSurname").value = "";
    document.getElementById("newTeacherCode").value = "";
    document.getElementById("newTeacherEmail").value = "";
    document.getElementById("newTeacherRole").value = "";

    const sendCodeCheckbox =
      document.getElementById("sendTeacherCodeOnCreate");

    if (sendCodeCheckbox) {
      sendCodeCheckbox.checked = true;
    }
  }

  function setTeacherSavingState(isSaving) {
    const saveTeacherBtn = document.getElementById("saveTeacherBtn");
    const progressBox = document.getElementById("saveTeacherProgress");

    if (saveTeacherBtn) {
      saveTeacherBtn.disabled = isSaving;
      saveTeacherBtn.textContent = isSaving ? "Saving..." : "Save Teacher";
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

function saveTeacher() {
  const teacherName = document.getElementById("newTeacherName").value.trim();
  const teacherSurname = document.getElementById("newTeacherSurname").value.trim();
  const code = document.getElementById("newTeacherCode").value.trim();
  const email = document.getElementById("newTeacherEmail").value.trim();
  const role = document.getElementById("newTeacherRole").value;
  const sendCodeEmail = document.getElementById("sendTeacherCodeOnCreate")?.checked || false;
  if (!teacherName || !teacherSurname || !code || !email || !role) {
    setAddTeacherMessage("Teacher name, surname, login code, email and role are required.", "error"); return;
  }
  const temporaryId = "pending-teacher-" + Date.now();
  currentTeachers.push({ teacher_id: temporaryId, teacher_name: teacherName, teacher_surname: teacherSurname, full_name: (teacherName + " " + teacherSurname).trim(), code: code, email: email, role: role, active: true });
  renderTeachers(currentTeachers); clearAddTeacherForm();
  GLIPOptimisticUpdate.run({
    request: function () { return postToGlip({ action: "addTeacherAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), teacher_name: teacherName, teacher_surname: teacherSurname, code: code, email: email, role: role, send_code_email: sendCodeEmail }); },
    failureMessage: "Could not add teacher.",
    onSuccess: function (result) { setAddTeacherMessage(result.message || "Teacher added successfully.", "success"); },
    resync: resyncTeachersSilently,
    rollback: function () { currentTeachers = currentTeachers.filter(function (teacher) { return String(teacher.teacher_id) !== temporaryId; }); renderTeachers(currentTeachers); },
    onFailure: function (error) { setAddTeacherMessage(error.message || "Could not add teacher. The temporary row was removed.", "error"); }
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

  function setMessage(text, type) {
    const message = document.getElementById("teacherManagementMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
  }

function setAddTeacherMessage(text, type) {
  const message = document.getElementById("addTeacherMessage");
  if (!message) return;

  message.textContent = text || "";
  message.className = "panel-message add-teacher-message " + (type || "info");
}
  
  function setTeachersLoadingState(isLoading) {
    const loadingBox = document.getElementById("teachersLoadingProgress");
    const table = document.getElementById("teachersTable");

    if (loadingBox) {
      loadingBox.style.display = isLoading ? "block" : "none";
    }

    if (table) {
      table.style.visibility = isLoading ? "hidden" : "visible";
    }
  }

if (typeof window.setupGlipTableFilter === "function") {
  window.setupGlipTableFilter({
    filterId: "teachers",
    tableId: "teachersTable",
fields: [
  { value: "full_name", label: "Full Name", getValue: function (teacher) { return teacher.full_name || ""; } },
  { value: "code", label: "Code" },
  { value: "email", label: "Email" },
  { value: "role", label: "Role", getValue: function (teacher) { return formatRole(teacher.role); } },
  { value: "active", label: "Status", getValue: function (teacher) { return teacher.active ? "Active" : "Inactive"; } }
],
    onChange: function () {
      renderTeachers(currentTeachers);
    }
  });
}
  
function loadTeachers() {
  const tbody = document.getElementById("teachersTableBody");
  if (!tbody) return;

  setTeachersLoadingState(true);

  postToGlip({
    action: "listTeachersAdmin",
    admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
    teacher_id: sessionStorage.getItem("glipTeacherId"),
    role: sessionStorage.getItem("glipUserType")
  })
    .then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error(result.message || "Could not load teachers.");
      }

      setTeachersLoadingState(false);

      currentTeachers = (result.teachers || []).map(function (teacher) {
        teacher.full_name = [
          teacher.teacher_name || "",
          teacher.teacher_surname || ""
        ].join(" ").trim();

        return teacher;
      });

      teachersEditMode = false;
      updateEditTeachersButton();
      renderTeachers(currentTeachers);
    })
    .catch(function (error) {
      console.error(error);
      setTeachersLoadingState(false);
      setMessage(error.message || "Could not load teachers.", "error");

      tbody.innerHTML = `
        <tr>
          <td colspan="5">${escapeHtml(
            error.message || "Could not load teachers."
          )}</td>
        </tr>
      `;
    });
}

  

  function toggleTeachersEditMode() {
    if (teachersEditMode) {
      saveTeacherChanges();
      return;
    }

    teachersEditMode = true;
    setMessage("", "info");
    updateEditTeachersButton();
    renderTeachers(currentTeachers);
  }

  function cancelTeachersEditMode() {
    teachersEditMode = false;
    updateEditTeachersButton();
    renderTeachers(currentTeachers);
    setMessage("", "info");
  }

  function updateEditTeachersButton() {
    const editTeachersBtn = document.getElementById("editTeachersBtn");
    if (!editTeachersBtn) return;

    const sendSelectedTeacherCodesBtn =
      document.getElementById("sendSelectedTeacherCodesBtn");

    if (sendSelectedTeacherCodesBtn) {
      sendSelectedTeacherCodesBtn.style.display = teachersEditMode
        ? "none"
        : "inline-flex";
    }

    editTeachersBtn.textContent = teachersEditMode
      ? "Save Changes"
      : "Edit Teachers";

    let cancelBtn = document.getElementById("cancelTeachersEditBtn");

    if (teachersEditMode && !cancelBtn) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelTeachersEditBtn";
      cancelBtn.className = "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancelTeachersEditMode);

      editTeachersBtn.insertAdjacentElement("afterend", cancelBtn);
    }

    if (!teachersEditMode && cancelBtn) {
      cancelBtn.remove();
    }
  }

  function renderTeachers(teachers) {
    const tbody = document.getElementById("teachersTableBody");
    if (!tbody) return;
    const filteredTeachers =
  typeof window.applyGlipTableFilter === "function"
    ? window.applyGlipTableFilter("teachers", teachers)
    : teachers;

    if (!filteredTeachers.length) {
      displayedTeachers = [];

      tbody.innerHTML = `
        <tr>
          <td colspan="5">No teachers found.</td>
        </tr>
      `;
      return;
    }

    displayedTeachers = getSortedTeachers(filteredTeachers);

    tbody.innerHTML = displayedTeachers
      .map(function (teacher, index) {
        if (teachersEditMode) {
          return renderTeacherEditRow(teacher);
        }

        return `
          <tr
            class="teacher-selectable-row ${
              selectedTeacherIds.includes(teacher.teacher_id)
                ? "teacher-row-selected"
                : ""
            } ${!teacher.active ? "inactive-record-row" : ""}"
            data-teacher-id="${escapeHtml(teacher.teacher_id)}"
            data-teacher-index="${index}"
          >
<td>${formatTeacherName(teacher)}</td>
<td>${escapeHtml(teacher.code)}</td>
<td>${escapeHtml(teacher.email)}</td>
<td>${formatRole(teacher.role)}</td>
<td>${teacher.active ? "Active" : "Inactive"}</td>
          </tr>
        `;
      })
      .join("");

    if (teachersEditMode) {
      document.querySelectorAll("[data-field]").forEach(function (field) {
        field.addEventListener("input", markChangedFields);
        field.addEventListener("change", markChangedFields);
      });
    }

    if (!teachersEditMode) {
      document.querySelectorAll(".teacher-selectable-row").forEach(function (row) {
        row.addEventListener("click", handleTeacherRowSelection);
      });
    }
  }


function formatTeacherName(teacher) {
  const name = escapeHtml(teacher.full_name);

  if (teacher.active) {
    return name;
  }

  return name + ' ⚠';
}

function renderTeacherEditRow(teacher) {
  return `
    <tr data-teacher-row="${escapeHtml(teacher.teacher_id)}" class="${!teacher.active ? "inactive-record-row" : ""}">
      <td>
        <div class="teacher-name-edit-stack">
          <input
            type="text"
            class="tracker-input"
            data-field="teacher_name"
            value="${escapeHtml(teacher.teacher_name)}"
            placeholder="Name"
          />
          <input
            type="text"
            class="tracker-input"
            data-field="teacher_surname"
            value="${escapeHtml(teacher.teacher_surname)}"
            placeholder="Surname"
          />
        </div>
      </td>
      <td>
        <input
          type="text"
          class="tracker-input"
          data-field="code"
          value="${escapeHtml(teacher.code)}"
        />
      </td>
      <td>
        <input
          type="email"
          class="tracker-input"
          data-field="email"
          value="${escapeHtml(teacher.email)}"
        />
      </td>
      <td>
        <select class="tracker-input" data-field="role">
          ${renderRoleOptions(teacher.role)}
        </select>
      </td>
      <td>
        <select class="tracker-input" data-field="active">
          <option value="true" ${teacher.active ? "selected" : ""}>Active</option>
          <option value="false" ${!teacher.active ? "selected" : ""}>Inactive</option>
        </select>
      </td>
    </tr>
  `;
}


  

  function markChangedFields() {
    const rows = document.querySelectorAll("[data-teacher-row]");

    rows.forEach(function (row) {
      const teacherId = row.dataset.teacherRow;
      const originalTeacher = currentTeachers.find(function (teacher) {
        return teacher.teacher_id === teacherId;
      });

      if (!originalTeacher) return;

      row.querySelectorAll("[data-field]").forEach(function (field) {
        const fieldName = field.dataset.field;
        let currentValue = field.value;
        let originalValue = originalTeacher[fieldName];

        if (fieldName === "active") {
          originalValue = originalTeacher.active ? "true" : "false";
        }

        field.classList.toggle(
          "teacher-field-changed",
          String(currentValue).trim() !== String(originalValue).trim()
        );
      });
    });
  }

  function applyTeacherUpdatesLocally(teachersToSave) {
    teachersToSave.forEach(function (update) {
      const existing = currentTeachers.find(function (teacher) {
        return String(teacher.teacher_id) === String(update.teacher_id);
      });

      if (!existing) return;

      existing.teacher_name = update.teacher_name;
      existing.teacher_surname = update.teacher_surname;
      existing.full_name = [update.teacher_name || "", update.teacher_surname || ""].join(" ").trim();
      existing.code = update.code;
      existing.email = update.email;
      existing.role = update.role;
      existing.active = update.active;
    });
  }

function resyncTeachersSilently() {
  postToGlip({
    action: "listTeachersAdmin",
    admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
    teacher_id: sessionStorage.getItem("glipTeacherId"),
    role: sessionStorage.getItem("glipUserType")
  })
    .then(function (result) {
      if (!result || result.status !== "success") return;

      currentTeachers = (result.teachers || []).map(function (teacher) {
        teacher.full_name = [
          teacher.teacher_name || "",
          teacher.teacher_surname || ""
        ].join(" ").trim();

        return teacher;
      });

      renderTeachers(currentTeachers);
    })
    .catch(function (error) {
      console.warn("Silent teacher resync failed.", error);
    });
}


  

  function saveTeacherChanges() {
    const rows = document.querySelectorAll("[data-teacher-row]"); const teachersToSave = [];
    rows.forEach(function (row) {
      const teacher = { teacher_id: row.dataset.teacherRow };
      row.querySelectorAll("[data-field]").forEach(function (field) { teacher[field.dataset.field] = field.dataset.field === "active" ? field.value === "true" : field.value.trim(); });
      teachersToSave.push(teacher);
    });
    const previousTeachers = currentTeachers.map(function (item) { return Object.assign({}, item); });
    applyTeacherUpdatesLocally(teachersToSave); teachersEditMode = false; updateEditTeachersButton(); renderTeachers(currentTeachers);
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "updateTeachersAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), teachers: teachersToSave }); },
      failureMessage: "Could not save teacher changes.",
      onSuccess: function (result) { setMessage(result.message || "Teacher changes saved.", "success"); },
      resync: resyncTeachersSilently,
      rollback: function () { currentTeachers = previousTeachers; renderTeachers(currentTeachers); },
      onFailure: function (error) { setMessage(error.message || "Could not save teacher changes. The previous values were restored.", "error"); }
    });
  }

  function setTeachersSavingState(isSaving) {
    const editTeachersBtn = document.getElementById("editTeachersBtn");
    const cancelTeachersEditBtn =
      document.getElementById("cancelTeachersEditBtn");
    const progressBox = document.getElementById("saveTeachersProgress");

    if (editTeachersBtn) {
      editTeachersBtn.disabled = isSaving;
      editTeachersBtn.textContent = isSaving
        ? "Saving..."
        : teachersEditMode
          ? "Save Changes"
          : "Edit Teachers";
    }

    if (cancelTeachersEditBtn) {
      cancelTeachersEditBtn.disabled = isSaving;
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

  function getSelectedTeacherIds() {
    return selectedTeacherIds.slice();
  }

  function handleTeacherRowSelection(event) {
    const row = event.currentTarget;
    const teacherId = row.dataset.teacherId;
    const teacherIndex = Number(row.dataset.teacherIndex);

    if (!teacherId || Number.isNaN(teacherIndex)) return;

    if (event.shiftKey && lastSelectedTeacherIndex !== null) {
      const start = Math.min(lastSelectedTeacherIndex, teacherIndex);
      const end = Math.max(lastSelectedTeacherIndex, teacherIndex);

      const clickedRowIsSelected = selectedTeacherIds.includes(teacherId);

      for (let i = start; i <= end; i++) {
        const teacher = displayedTeachers[i];
        if (!teacher) continue;

        if (clickedRowIsSelected) {
          selectedTeacherIds = selectedTeacherIds.filter(function (id) {
            return id !== teacher.teacher_id;
          });
        } else if (!selectedTeacherIds.includes(teacher.teacher_id)) {
          selectedTeacherIds.push(teacher.teacher_id);
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (selectedTeacherIds.includes(teacherId)) {
        selectedTeacherIds = selectedTeacherIds.filter(function (id) {
          return id !== teacherId;
        });
      } else {
        selectedTeacherIds.push(teacherId);
      }

      lastSelectedTeacherIndex = teacherIndex;
    } else {
      selectedTeacherIds = [teacherId];
      lastSelectedTeacherIndex = teacherIndex;
    }

    renderTeachers(currentTeachers);
  }

function sendSelectedTeacherCodes() {
  const teacherIdsToSend = getSelectedTeacherIds();

  if (teacherIdsToSend.length === 0) {
    setMessage("Please select at least one teacher.", "error");
    return;
  }

  showGlipConfirmModal({
    title: "Send access codes",
    bodyHtml:
      "<p>Send GLIP access codes by email to " +
      teacherIdsToSend.length +
      " selected " +
      (teacherIdsToSend.length === 1 ? "teacher" : "teachers") +
      "?</p>",
    noConfirmationInput: true,
    extraButtonText: "Send codes"
  }).then(function (confirmed) {
    if (!confirmed) return;

    setMessage("Sending emails...", "info");

    postToGlip({
      action: "sendTeacherCodesBulk",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
      teacher_ids: teacherIdsToSend
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Emails could not be sent.");
        }

        setMessage(
          "Emails sent: " + result.sent + ". Failed: " + result.failed + ".",
          result.failed > 0 ? "error" : "success"
        );

        selectedTeacherIds = [];
        lastSelectedTeacherIndex = null;

        renderTeachers(currentTeachers);
      })
      .catch(function (error) {
        console.error(error);
        setMessage(error.message || "Email sending failed.", "error");
      });
  });
}


  

  function renderRoleOptions(currentRole) {
    const roles = [
      { value: "owner", label: "Owner" },
      {
        value: "subject_teacher",
        label: "Subject"
      },
      {
        value: "lead_teacher",
        label: "Lead"
      },
      {
        value: "admin",
        label: "Admin"
      }
    ];

    return roles
      .map(function (role) {
        return `
          <option
            value="${role.value}"
            ${currentRole === role.value ? "selected" : ""}
          >
            ${role.label}
          </option>
        `;
      })
      .join("");
  }

  function formatRole(role) {
    if (role === "owner") return "Owner";
    if (role === "owner") return "Owner";
    if (role === "admin") return "Admin";
    if (role === "lead_teacher") return "Lead";
    if (role === "subject_teacher") return "Subject";
    return escapeHtml(role || "Unknown");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (event.detail && event.detail.action === "listTeachersAdmin" && !teachersEditMode) loadTeachers();
  });
})();
