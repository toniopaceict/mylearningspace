(function () {
  "use strict";

  let currentClasses = [];
  let classesEditMode = false;
  let classSortField = "level";
  let classSortDirection = "asc";
  let classManagementInitialised = false;
  let pendingClassSaves = 0;
  let levelNamesByCode = {};

  function getWebAppUrl() {
    return window.getGlipWebAppUrl();
  }

  function safelyInitClassManagement() {
    if (classManagementInitialised) return;

    if (typeof isAdmin !== "function") {
      setTimeout(safelyInitClassManagement, 100);
      return;
    }

    classManagementInitialised = true;
    initClassManagement();
  }

  document.addEventListener("glipReady", safelyInitClassManagement);
  document.addEventListener("DOMContentLoaded", safelyInitClassManagement);

  function initClassManagement() {
    if (typeof isAdmin !== "function" || !isAdmin()) return;

    const saveClassBtn = document.getElementById("saveClassBtn");
    const editClassesBtn = document.getElementById("editClassesBtn");

    if (saveClassBtn) {
      saveClassBtn.addEventListener("click", saveClass);
    }

clearAddClassMessageOnEdit();
    
    if (editClassesBtn) {
      editClassesBtn.addEventListener("click", toggleClassesEditMode);
    }

    setupClassTableSorting();
    updateSortIndicators();

    if (typeof window.setupGlipTableFilter === "function") {
      window.setupGlipTableFilter({
        filterId: "classes",
        tableId: "classesTable",
        fields: [
          { value: "level", label: "Level", getValue: function (item) { return getLevelDisplayName(item.level); } },
          { value: "class_id", label: "Class Code" },
          { value: "class_label", label: "Class Label" },
          { value: "sort_order", label: "Sort Order" },
          { value: "active", label: "Status", getValue: formatClassStatus }
        ],
        onChange: function () {
          renderClasses(currentClasses);
        }
      });
    }
loadLevelsDropdown();
    loadClasses();

    if (typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "classes",
        tableName: "Classes",
        messageElementId: "classManagementMessage",
        refresh: loadClasses
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

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normaliseLevel(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function normaliseClassCode(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function formatLevel(level) {
    const value = normaliseLevel(level);
    if (!value) return "";

    return value
      .split("-")
      .filter(Boolean)
      .map(function (part) {
        if (/^\d+$/.test(part)) {
          return String(Number(part));
        }

        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  function getLevelDisplayName(levelCode) {
    const normalisedCode = normaliseLevel(levelCode);

    return levelNamesByCode[normalisedCode] ||
      formatLevel(levelCode);
  }

function loadLevelsDropdown() {
  const levelSelect = document.getElementById("newClassLevel");
  if (!levelSelect) return;

  postToGlip({
    action: "listLevelsAdmin",
    admin_teacher_id: sessionStorage.getItem("glipTeacherId")
  })
    .then(function (result) {
      if (!result || result.status !== "success") {
        throw new Error("Could not load levels.");
      }

      levelSelect.innerHTML =
        '<option value="">Select level</option>';

      levelNamesByCode = {};

      (result.levels || []).forEach(function (level) {
        const normalisedCode = normaliseLevel(level.level_code);
        levelNamesByCode[normalisedCode] =
          level.level_name || formatLevel(level.level_code);

        const option = document.createElement("option");

        option.value = level.level_code;
        option.textContent = appendPlanningWarning(
          level.level_name || formatLevel(level.level_code),
          level.active === false
        );

        levelSelect.appendChild(option);
      });
    })
    .catch(function (error) {
      console.error(error);
    });
}

  
  function setMessage(text, type) {
    const message = document.getElementById("classManagementMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message " + (type || "info");
  }

  function setAddClassMessage(text, type) {
    const message = document.getElementById("addClassMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className = "panel-message add-teacher-message " + (type || "info");
  }

  function clearAddClassMessageOnEdit() {
  const fields = document.querySelectorAll(
    "#addClassPanel input, #addClassPanel select"
  );

  fields.forEach(function (field) {
    field.addEventListener("input", function () {
      setAddClassMessage("", "info");
    });

    field.addEventListener("change", function () {
      setAddClassMessage("", "info");
    });
  });
}
  

  function setClassesLoadingState(isLoading) {
    const loadingBox = document.getElementById("classesLoadingProgress");
    const table = document.getElementById("classesTable");

    if (loadingBox) {
      loadingBox.style.display = isLoading ? "block" : "none";
    }

    if (table) {
      table.style.visibility = isLoading ? "hidden" : "visible";
    }
  }

  function setClassSavingState(isSaving) {
    const saveClassBtn = document.getElementById("saveClassBtn");
    const progressBox = document.getElementById("saveClassProgress");

    if (saveClassBtn) {
      saveClassBtn.disabled = isSaving;
      saveClassBtn.textContent = isSaving ? "Saving..." : "Save Class";
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

  function setClassesSavingState(isSaving) {
    const editClassesBtn = document.getElementById("editClassesBtn");
    const progressBox = document.getElementById("saveClassesProgress");

    if (editClassesBtn) {
      editClassesBtn.disabled = isSaving;
      editClassesBtn.textContent = isSaving ? "Saving..." : "Save Changes";
    }

    if (progressBox) {
      progressBox.style.display = isSaving ? "block" : "none";
    }
  }

  function clearAddClassForm() {
    document.getElementById("newClassLevel").value = "";
    document.getElementById("newClassId").value = "";
    document.getElementById("newClassLabel").value = "";
    document.getElementById("newClassSortOrder").value = "";
    document.getElementById("newClassActive").value = "true";
  }

  function setupClassTableSorting() {
    const headers = document.querySelectorAll(
      "#classesTable thead th[data-sort-field]"
    );

    headers.forEach(function (header) {
      header.style.cursor = "pointer";

      header.addEventListener("click", function () {
        const field = header.dataset.sortField;

        if (classSortField === field) {
          classSortDirection =
            classSortDirection === "asc" ? "desc" : "asc";
        } else {
          classSortField = field;
          classSortDirection = "asc";
        }

        updateSortIndicators();
        renderClasses(currentClasses);
      });
    });
  }

  function updateSortIndicators() {
    document
      .querySelectorAll("#classesTable thead th[data-sort-field]")
      .forEach(function (header) {
        const field = header.dataset.sortField;
        const label = header.dataset.label;

        if (field === classSortField) {
          header.textContent =
            label + (classSortDirection === "asc" ? " ▲" : " ▼");
        } else {
          header.textContent = label + " ↕";
        }
      });
  }

  function getSortedClasses(classes) {
    return classes.slice().sort(function (a, b) {
      let valueA = a[classSortField];
      let valueB = b[classSortField];

      if (classSortField === "level") {
        valueA = getLevelDisplayName(a.level);
        valueB = getLevelDisplayName(b.level);
      } else if (classSortField === "active") {
        valueA = a.active ? 1 : 0;
        valueB = b.active ? 1 : 0;
      } else if (classSortField === "sort_order") {
        valueA = Number(valueA || 999);
        valueB = Number(valueB || 999);
      } else {
        valueA = String(valueA || "").toLowerCase();
        valueB = String(valueB || "").toLowerCase();
      }

      if (valueA < valueB) return classSortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return classSortDirection === "asc" ? 1 : -1;

      return 0;
    });
  }

  function loadClasses() {
    const tbody = document.getElementById("classesTableBody");
    if (!tbody) return;

    setClassesLoadingState(true);

    postToGlip({
      action: "listClassesAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(result.message || "Could not load classes.");
        }

        currentClasses = GLIPOptimisticUpdate.mergePendingRows(result.classes || [], currentClasses, "class_id");
        classesEditMode = false;
        updateEditClassesButton();
        renderClasses(currentClasses);
        setClassesLoadingState(false);
      })
      .catch(function (error) {
        console.error(error);
        setClassesLoadingState(false);
        setMessage("Could not load classes.", "error");

        tbody.innerHTML = `
          <tr>
            <td colspan="5">Could not load classes.</td>
          </tr>
        `;
      });
  }

  function saveClass() {
    const level = normaliseLevel(
      document.getElementById("newClassLevel").value
    );
    const classId = normaliseClassCode(
      document.getElementById("newClassId").value
    );
    const classLabel = document.getElementById("newClassLabel").value.trim();
    const sortOrderRaw = document
      .getElementById("newClassSortOrder")
      .value.trim();
    const sortOrder = Number(sortOrderRaw);
    const active =
      document.getElementById("newClassActive").value === "true";

    setAddClassMessage("", "info");

    if (!level || !classId || !classLabel || !sortOrderRaw) {
      setAddClassMessage(
        "Level, class code, class label and sort order are required.",
        "error"
      );
      return;
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      setAddClassMessage(
        "Sort order must be a whole number of 1 or greater.",
        "error"
      );
      return;
    }

    const duplicate = currentClasses.some(function (item) {
      return normaliseClassCode(item.class_id) === classId;
    });

    if (duplicate) {
      setAddClassMessage("This class code already exists.", "error");
      return;
    }

    const temporaryId = "pending-class-" + Date.now();

    const optimisticClass = {
      temporary_id: temporaryId,
      level: level,
      class_id: classId,
      class_label: classLabel,
      sort_order: sortOrder,
      active: active,
      level_active: getLevelActiveForClass(level),
      pending_save: true
    };

    currentClasses.push(optimisticClass);
    pendingClassSaves += 1;

    updateEditClassesButton();
    renderClasses(currentClasses);
    clearAddClassForm();

    GLIPOptimisticUpdate.run({
      request: function () {
        return postToGlip({
          action: "addClassAdmin",
          admin_teacher_id: sessionStorage.getItem("glipTeacherId"),
          level: level,
          class_id: classId,
          class_label: classLabel,
          sort_order: sortOrder,
          active: active
        });
      },

      failureMessage: "Could not save class.",

      onSuccess: function (result) {
        const temporaryClass = currentClasses.find(function (item) {
          return item.temporary_id === temporaryId;
        });

        if (temporaryClass) {
          GLIPOptimisticUpdate.markSaved(temporaryClass);
          delete temporaryClass.temporary_id;
        }

        pendingClassSaves = Math.max(0, pendingClassSaves - 1);
        updateEditClassesButton();
        renderClasses(currentClasses);

        setAddClassMessage(
          result.message || "Class added successfully.",
          "success"
        );
      },

      resync: resyncClassesSilently,

      rollback: function () {
        currentClasses = currentClasses.filter(function (item) {
          return item.temporary_id !== temporaryId;
        });

        pendingClassSaves = Math.max(0, pendingClassSaves - 1);
        updateEditClassesButton();
        renderClasses(currentClasses);
      },

      onFailure: function (error) {
        setAddClassMessage(
          error.message ||
            "Could not save class. The temporary row was removed.",
          "error"
        );
      }
    });
  }

  function toggleClassesEditMode() {
    if (pendingClassSaves > 0) {
      setMessage(
        "Please wait until the new class has finished saving.",
        "info"
      );
      return;
    }

    if (classesEditMode) {
      saveClassChanges();
      return;
    }

    setMessage("", "info");

    classesEditMode = true;
    updateEditClassesButton();
    renderClasses(currentClasses);
  }

  function cancelClassesEditMode() {
    classesEditMode = false;
    updateEditClassesButton();
    renderClasses(currentClasses);
    setMessage("", "info");
  }

  function updateEditClassesButton() {
    const editClassesBtn = document.getElementById("editClassesBtn");
    if (!editClassesBtn) return;

    const hasPendingSaves = pendingClassSaves > 0;

    editClassesBtn.disabled = hasPendingSaves;
    editClassesBtn.textContent = classesEditMode
      ? "Save Changes"
      : "Edit Classes";

    editClassesBtn.title = hasPendingSaves
      ? "Please wait until the new class has finished saving."
      : "";

    let cancelBtn = document.getElementById("cancelClassesEditBtn");

    if (classesEditMode && !cancelBtn && !hasPendingSaves) {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.id = "cancelClassesEditBtn";
      cancelBtn.className =
        "glip-btn glip-btn-secondary teacher-cancel-btn";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancelClassesEditMode);

      editClassesBtn.insertAdjacentElement("afterend", cancelBtn);
    }

    if ((!classesEditMode || hasPendingSaves) && cancelBtn) {
      cancelBtn.remove();
    }
  }

    function appendPlanningWarning(text, showWarning) {
    return String(text || "") + (showWarning ? " ⚠" : "");
  }

function classHasInactiveLevel(item) {
  return item.level_active === false;
}

function classIsInactive(item) {
  return item.active === false;
}

function classNeedsAttention(item) {
  return classHasInactiveLevel(item) || classIsInactive(item);
}

function formatClassStatus(item) {
  if (item.active && classHasInactiveLevel(item)) {
    return "Active (pending)";
  }

  return item.active ? "Active" : "Inactive";
}

function formatClassLevelCell(item) {
  return escapeHtml(
    appendPlanningWarning(
      getLevelDisplayName(item.level),
      classHasInactiveLevel(item)
    )
  );
}

function formatClassCodeCell(item) {
  return escapeHtml(
    appendPlanningWarning(
      item.class_id,
      classIsInactive(item)
    )
  );
}

  function formatClassLabelCell(item) {
  return escapeHtml(
    appendPlanningWarning(
      item.class_label,
      classIsInactive(item)
    )
  );
}
  
  
function renderClasses(classes) {
    const tbody = document.getElementById("classesTableBody");
    if (!tbody) return;

    const filteredClasses =
      typeof window.applyGlipTableFilter === "function"
        ? window.applyGlipTableFilter("classes", classes)
        : classes;

    if (!filteredClasses.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">No classes found.</td>
        </tr>
      `;
      return;
    }

    const sortedClasses = getSortedClasses(filteredClasses);

    tbody.innerHTML = sortedClasses
      .map(function (item) {
        if (classesEditMode) {
          return renderClassEditRow(item);
        }

return `
  <tr class="${classNeedsAttention(item) ? "planning-row" : ""}">
    <td>${formatClassLevelCell(item)}</td>
    <td>${formatClassCodeCell(item)}</td>
    <td>${formatClassLabelCell(item)}</td>
    <td>${escapeHtml(item.sort_order)}</td>
    <td>${formatClassStatus(item)}</td>
  </tr>
`;
        
      })
      .join("");

    if (classesEditMode) {
      document
        .querySelectorAll("#classesTableBody input, #classesTableBody select")
        .forEach(function (field) {
          field.addEventListener("input", markChangedFields);
          field.addEventListener("change", markChangedFields);
        });

    }
  }

  function renderClassEditRow(item) {
    return `
<tr
  class="${classNeedsAttention(item) ? "planning-row" : ""}"
  data-class-row="${escapeHtml(item.level + "|" + item.class_id)}"
        data-original-level="${escapeHtml(item.level)}"
        data-original-class-id="${escapeHtml(item.class_id)}"
      >
        <td>
          <input
            type="text"
            class="tracker-input"
            data-field="level"
            value="${escapeHtml(item.level)}"
          />
        </td>

        <td>
          <input
            type="text"
            class="tracker-input"
            data-field="class_id"
            value="${escapeHtml(item.class_id)}"
          />
        </td>

        <td>
          <input
            type="text"
            class="tracker-input"
            data-field="class_label"
            value="${escapeHtml(item.class_label)}"
          />
        </td>

        <td>
          <input
            type="number"
            class="tracker-input"
            data-field="sort_order"
            min="1"
            step="1"
            value="${escapeHtml(item.sort_order)}"
          />
        </td>

        <td>
          <select class="tracker-input" data-field="active">
            <option value="true" ${item.active ? "selected" : ""}>Active</option>
            <option value="false" ${!item.active ? "selected" : ""}>Inactive</option>
          </select>
        </td>
      </tr>
    `;
  }

  function markChangedFields() {
    setMessage("", "info");

    const rows = document.querySelectorAll("[data-class-row]");

    rows.forEach(function (row) {
      const originalLevel = row.dataset.originalLevel;
      const originalClassId = row.dataset.originalClassId;

      const originalClass = currentClasses.find(function (item) {
        return item.level === originalLevel &&
          item.class_id === originalClassId;
      });

      if (!originalClass) return;

      row.querySelectorAll("[data-field]").forEach(function (field) {
        const key = field.dataset.field;
        let currentValue = field.value;
        let originalValue = originalClass[key];

        if (key === "level") {
          currentValue = normaliseLevel(currentValue);
          originalValue = normaliseLevel(originalValue);
        }

        if (key === "class_id") {
          currentValue = normaliseClassCode(currentValue);
          originalValue = normaliseClassCode(originalValue);
        }

        if (key === "active") {
          currentValue = currentValue === "true";
          originalValue = originalClass.active === true;
        }

        if (key === "sort_order") {
          currentValue = Number(currentValue || 999);
          originalValue = Number(originalValue || 999);
        }

        if (String(currentValue) !== String(originalValue)) {
          field.classList.add("teacher-field-changed");
        } else {
          field.classList.remove("teacher-field-changed");
        }
      });
    });
  }

  function getLevelActiveForClass(level) {
    const norm = normaliseLevel(level);
    const match = currentClasses.find(function (item) {
      return normaliseLevel(item.level) === norm && item.level_active !== undefined;
    });

    return match ? match.level_active : true;
  }

  function applyClassUpdatesLocally(classes) {
    classes.forEach(function (update) {
      const existing = currentClasses.find(function (item) {
        return normaliseLevel(item.level) === normaliseLevel(update.original_level) &&
          String(item.class_id) === String(update.original_class_id);
      });

      if (!existing) return;

      existing.level = update.level;
      existing.level_active = getLevelActiveForClass(update.level);
      existing.class_id = update.class_id;
      existing.class_label = update.class_label;
      existing.sort_order = update.sort_order;
      existing.active = update.active;
    });
  }

  function resyncClassesSilently() {
    postToGlip({
      action: "listClassesAdmin",
      admin_teacher_id: sessionStorage.getItem("glipTeacherId")
    }).then(function (result) {
      if (!result || result.status !== "success") return;
      currentClasses = GLIPOptimisticUpdate.mergePendingRows(result.classes || [], currentClasses, "class_id");
      renderClasses(currentClasses);
    }).catch(function (error) {
      console.warn("Silent class resync failed.", error);
    });
  }

  function saveClassChanges() {
    const rows = document.querySelectorAll("[data-class-row]"); const classes = [];
    rows.forEach(function (row) {
      const item = { original_level: row.dataset.originalLevel, original_class_id: row.dataset.originalClassId };
      row.querySelectorAll("[data-field]").forEach(function (field) { item[field.dataset.field] = field.value; });
      item.level = normaliseLevel(item.level);
      item.class_id = normaliseClassCode(item.class_id);
      item.active = item.active === "true";
      item.sort_order = Number(item.sort_order || 999);
      classes.push(item);
    });
    if (!classes.length) { setMessage("No class changes to save.", "info"); return; }
    const previousClasses = currentClasses.map(function (item) { return Object.assign({}, item); });
    GLIPOptimisticUpdate.markUpdatesPending(currentClasses, classes.map(function (item) { return { class_id: item.original_class_id }; }), "class_id"); applyClassUpdatesLocally(classes); classesEditMode = false; updateEditClassesButton(); renderClasses(currentClasses);
    GLIPOptimisticUpdate.run({
      request: function () { return postToGlip({ action: "updateClassesAdmin", admin_teacher_id: sessionStorage.getItem("glipTeacherId"), classes: classes }); },
      failureMessage: "Could not save class changes.",
      onSuccess: function (result) { setMessage(result.message || "Class changes saved.", "success"); },
      resync: resyncClassesSilently,
      rollback: function () { currentClasses = previousClasses; renderClasses(currentClasses); },
      onFailure: function (error) { setMessage(error.message || "Could not save class changes. The previous values were restored.", "error"); }
    });
  }

  document.addEventListener("glipManagementDataUpdated", function (event) {
    if (!event.detail) return;
    if (event.detail.action === "listLevelsAdmin") loadLevelsDropdown();
    if (event.detail.action === "listClassesAdmin" && !classesEditMode) loadClasses();
  });
})();
