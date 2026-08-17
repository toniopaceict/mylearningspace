(function () {
  "use strict";

  let activities = [];
  let topics = [];
  let activityTypes = [];
  let editMode = false;
  let selectedActivityId = "";
  let initialised = false;
  let sortField = "sort_order";
  let sortDirection = "asc";
  let activityCodeManuallyEdited = false;

  function post(data) {
    data.owner_teacher_id = sessionStorage.getItem("glipTeacherId");

    return fetch(window.getGlipWebAppUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
      redirect: "follow",
      cache: "no-store"
    }).then(function (response) {
      return response.text().then(function (text) {
        let result;

        try {
          result = JSON.parse(text);
        } catch (_error) {
          throw new Error(
            response.ok
              ? "The server returned an invalid response. Please refresh the page."
              : "Could not contact the GLIP server."
          );
        }

        if (!response.ok) {
          throw new Error(result.message || "Could not contact the GLIP server.");
        }

        return result;
      });
    });
  }

  function init() {
    if (initialised) return;

    if (typeof isOwner !== "function" || typeof window.getGlipWebAppUrl !== "function") {
      return;
    }

    if (!isOwner()) {
      setLoading(false);
      return;
    }

    initialised = true;

    document.getElementById("saveActivityBtn")?.addEventListener("click", addActivity);
    document.getElementById("cancelAddActivityBtn")?.addEventListener("click", resetAddActivityForm);
    document.getElementById("editActivitiesBtn")?.addEventListener("click", toggleEdit);
    document.getElementById("clearActivitySearch")?.addEventListener("click", clearSearch);
    document.getElementById("activitySearch")?.addEventListener("input", render);
    document.getElementById("activitySearchColumn")?.addEventListener("change", render);
    document.getElementById("activityTopic")?.addEventListener("change", updateGeneratedActivityId);
    document.getElementById("activityType")?.addEventListener("change", updateGeneratedActivityId);
    document.getElementById("activityTitle")?.addEventListener("input", updateSuggestedActivityCode);
    document.getElementById("activityCode")?.addEventListener("input", function () {
      activityCodeManuallyEdited = true;
      setActivityCodeHint("You may adjust the suggested code before saving. It cannot be changed afterwards.");
    });
    document.getElementById("activityCode")?.addEventListener("blur", function (event) {
      event.target.value = normaliseActivityCode(event.target.value);
    });

    setupSorting();
    load();

    if (typeof window.setupGlipCsvAdminTools === "function") {
      window.setupGlipCsvAdminTools({
        tableKey: "activities",
        tableName: "Activities",
        anchorElementId: "activityManagementActions",
        messageElementId: "activityEditMessage",
        hideClear: true,
        exportSuccessMessage: "Activities CSV exported successfully.",
        importSuccessMessage: "Activities CSV imported successfully. A backup CSV was downloaded first.",
        validationMessage: "Validating Activities CSV before import...",
        refresh: load,
        onImportBusyStateChange: function (state) {
          const box = document.getElementById("activitiesLoadingProgress");
          const text = document.getElementById("activitiesProgressText");

          if (text) {
            text.textContent = state.busy
              ? (state.text || "Saving activities...")
              : "Loading activities...";
          }

          if (box) {
            box.style.display = state.busy ? "block" : "none";
          }
        }
      });
    }
  }

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", function () {
    setLoading(true);

    let attempts = 0;
    const initialiseWhenReady = window.setInterval(function () {
      attempts += 1;
      init();

      if (initialised || attempts >= 100) {
        window.clearInterval(initialiseWhenReady);

        if (!initialised && attempts >= 100) {
          setLoading(false);
          setMessage("GLIP could not initialise Activity Management. Please reload the page.", "error");
        }
      }
    }, 100);
  });

  function setMessage(text, type) {
    const el = document.getElementById("activityMessage");
    if (!el) return;
    el.textContent = text || "";
    el.className = "panel-message " + (type || "info");
  }

  function setEditMessage(text, type) {
    const el = document.getElementById("activityEditMessage");
    if (!el) return;
    el.textContent = text || "";
    el.className = "panel-message text-center " + (type || "info");
  }

  function setAddSavingState(isSaving) {
    const saveButton = document.getElementById("saveActivityBtn");
    const cancelButton = document.getElementById("cancelAddActivityBtn");
    const progressBox = document.getElementById("saveActivityProgress");

    if (saveButton) {
      saveButton.disabled = isSaving;
      saveButton.textContent = isSaving ? "Saving..." : "Save Activity";
    }

    if (cancelButton) cancelButton.disabled = isSaving;
    if (progressBox) progressBox.style.display = isSaving ? "block" : "none";
  }

  function setEditSavingState(isSaving) {
    const saveButton = document.getElementById("editActivitiesBtn");
    const cancelButton = document.getElementById("cancelActivitiesEditBtn");
    const progressBox = document.getElementById("saveActivitiesProgress");

    if (saveButton) {
      saveButton.disabled = isSaving;
      saveButton.textContent = isSaving ? "Saving..." : editMode ? "Save Changes" : "Edit Activities";
    }

    if (cancelButton) cancelButton.disabled = isSaving;
    if (progressBox) progressBox.style.display = isSaving ? "block" : "none";
  }

  function setLoading(value) {
    const loading = document.getElementById("activitiesLoadingProgress");
    const loadingText = document.getElementById("activitiesProgressText");
    const table = document.getElementById("activitiesTable");

    if (loadingText && value) loadingText.textContent = "Loading activities...";
    if (loading) loading.style.display = value ? "block" : "none";
    if (table) table.style.visibility = value ? "hidden" : "visible";
  }

  function load() {
    setLoading(true);

    post({ action: "listActivitiesOwner" })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error((result && result.message) || "Could not load activities.");
        }

        activities = Array.isArray(result.activities) ? GLIPOptimisticUpdate.mergePendingRows(result.activities, activities, "activity_id") : activities;
        topics = Array.isArray(result.topics) ? result.topics : [];
        activityTypes = Array.isArray(result.activity_types) ? result.activity_types : [];

        populateSelectors();
        editMode = false;
        updateEditControls();
        render();
        updateGeneratedActivityId();
        setLoading(false);
      })
      .catch(function (error) {
        setLoading(false);
        setMessage(error.message || "Could not load activities.", "error");
      });
  }

  function populateSelectors() {
    const topic = document.getElementById("activityTopic");
    const type = document.getElementById("activityType");

    if (topic) {
      topic.innerHTML =
        '<option value="">Select level, subject and topic</option>' +
        topics
          .filter(function (item) {
            return item.assignments && item.assignments.length;
          })
          .map(function (item) {
            const first = item.assignments[0];

            return (
              '<option value="' + esc(item.topic_id) + '"' +
              ' data-subject="' + esc(first.subject_code) + '"' +
              ' data-level="' + esc(first.level_code) + '"' +
              ' data-topic-code="' + esc(item.topic_code) + '">' +
              esc(
                (first.level_name || first.level_code) +
                " – " +
                (first.subject_name || first.subject_code) +
                " – " +
                item.topic_name
              ) +
              "</option>"
            );
          })
          .join("");
    }

    if (type) {
      type.innerHTML =
        '<option value="">Select activity type</option>' +
        activityTypes
          .map(function (item) {
            return (
              '<option value="' + esc(item.activity_type_id) + '"' +
              ' data-code="' + esc(item.activity_type_code) + '">' +
              esc(item.activity_type_name || item.activity_type_code) +
              "</option>"
            );
          })
          .join("");
    }
  }

  function updateGeneratedActivityId() {
    const activityId = document.getElementById("activityId");
    if (!activityId) return;

    // The authoritative numeric primary key is assigned by Apps Script.
    // The browser deliberately does not calculate or reserve an ID.
    activityId.value = "";
  }

  function normaliseCodeToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function makeNumberedToken(prefix, value) {
    const match = String(value || "").match(/\d+/);
    if (match) return prefix + String(Number(match[0]));

    const fallback = normaliseCodeToken(value);
    return fallback ? prefix + fallback : "";
  }

  function normaliseActivityTypeToken(value) {
    const code = String(value || "").trim().toLowerCase();

    const aliases = {
      "fill-blanks": "fillblank",
      "fill_blank": "fillblank",
      "fill_blanks": "fillblank",
      "fillblank": "fillblank",
      "fillblanks": "fillblank"
    };

    return aliases[code] || normaliseCodeToken(code);
  }

  function normaliseActivityCode(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function suggestActivityCodeFromTitle(value) {
    return normaliseActivityCode(value).replace(/(^|_)(\d+)(?=_|$)/g, function (_match, separator, digits) {
      const number = Number(digits);
      if (!Number.isFinite(number)) return separator + digits;
      return separator + String(number).padStart(2, "0");
    });
  }

  function updateSuggestedActivityCode() {
    const title = document.getElementById("activityTitle");
    const code = document.getElementById("activityCode");
    if (!title || !code) return;

    if (!activityCodeManuallyEdited || !code.value.trim()) {
      code.value = suggestActivityCodeFromTitle(title.value);
      activityCodeManuallyEdited = false;
      setActivityCodeHint(
        code.value
          ? "Suggested from the title. You may adjust it before saving; it cannot be changed afterwards."
          : "Enter a title and GLIP will suggest the Activity Code."
      );
    }
  }

  function setActivityCodeHint(text, type) {
    const hint = document.getElementById("activityCodeHint");
    if (!hint) return;
    hint.textContent = text || "";
    hint.className = "activity-code-hint" + (type ? " " + type : "");
  }

  function addActivity() {
    const temporaryActivityId = "pending-activity-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const topicSelect = document.getElementById("activityTopic");
    const typeSelect = document.getElementById("activityType");

    const payload = {
      action: "addActivityOwner",
      activity_code: normaliseActivityCode(document.getElementById("activityCode").value),
      topic_id: topicSelect.value,
      activity_type_id: typeSelect.value,
      activity_title: document.getElementById("activityTitle").value.trim(),
      sort_order: document.getElementById("activitySortOrder").value,
      visible: document.getElementById("activityVisible").value === "true",
      active: document.getElementById("activityActive").value === "true",
      requires_submission: document.getElementById("activityRequiresSubmission").value === "true"
    };

    if (!payload.topic_id) {
      setMessage("Select a level, subject and topic.", "error");
      return;
    }

    if (!payload.activity_type_id) {
      setMessage("Select an activity type.", "error");
      return;
    }

    if (!payload.activity_code) {
      setMessage("Enter an activity code using lowercase letters, numbers and underscores.", "error");
      return;
    }

    if (!/^[a-z0-9][a-z0-9_]*$/.test(payload.activity_code)) {
      setMessage("Activity code may contain lowercase letters, numbers and underscores only.", "error");
      return;
    }

    const duplicateCode = activities.some(function (activity) {
      return String(activity.topic_id) === String(payload.topic_id) &&
        normaliseActivityCode(activity.activity_code) === payload.activity_code;
    });

    if (duplicateCode) {
      setMessage("That Activity Code is already used in the selected topic.", "error");
      setActivityCodeHint("Choose a different code for this topic.", "error");
      document.getElementById("activityCode")?.focus();
      return;
    }

    if (!payload.activity_title) {
      setMessage("Enter an activity title.", "error");
      return;
    }

    if (!payload.sort_order) {
      setMessage("Enter a sort order.", "error");
      return;
    }

    const topic = topics.find(function (item) {
      return String(item.topic_id) === String(payload.topic_id);
    });
    const assignment = topic && topic.assignments && topic.assignments[0];
    const activityType = activityTypes.find(function (item) {
      return String(item.activity_type_id) === String(payload.activity_type_id);
    });

    const optimisticActivity = {
      activity_id: temporaryActivityId,
      activity_code: payload.activity_code,
      topic_id: payload.topic_id,
      activity_type_id: payload.activity_type_id,
      activity_title: payload.activity_title,
      sort_order: payload.sort_order,
      visible: payload.visible,
      active: payload.active,
      requires_submission: payload.requires_submission,
      topic_name: topic ? topic.topic_name : "",
      topic_code: topic ? topic.topic_code : "",
      level_name: assignment ? assignment.level_name : "",
      level_code: assignment ? assignment.level_code : "",
      subject_name: assignment ? assignment.subject_name : "",
      subject_code: assignment ? assignment.subject_code : "",
      activity_type_name: activityType ? activityType.activity_type_name : "",
      activity_type_code: activityType ? activityType.activity_type_code : "",
      pending_save: true,
      pending_state: "saving"
    };


    setAddSavingState(true);

    GLIPOptimisticUpdate.run({
      request: function () { return post(payload); },
      failureMessage: "Could not save activity.",
      apply: function (result) { optimisticActivity.activity_id = String(result.activity_id || "").trim() || temporaryActivityId; activities.push(optimisticActivity); resetAddActivityForm(false); render(); },
      onSuccess: function (result) {
        const row = activities.find(function (item) {
          return String(item.activity_id) === String(temporaryActivityId);
        });

        if (row) {
          row.activity_id = String(result.activity_id || "").trim() || temporaryActivityId;
          GLIPOptimisticUpdate.markSaved(row);
          render();
        }

        setMessage(result.message || "Activity saved.", "success");
      },
      resync: resyncActivitiesSilently,
      rollback: function () {
        activities = activities.filter(function (activity) {
          return String(activity.activity_id) !== String(temporaryActivityId);
        });
        render();
      },
      onFailure: function (error) {
        setMessage(error.message || "Could not save activity. The temporary row was removed.", "error");
      }
    }).finally(function () {
      setAddSavingState(false);
    });
  }

  function resetAddActivityForm(clearMessage) {
    const topic = document.getElementById("activityTopic");
    const type = document.getElementById("activityType");
    const code = document.getElementById("activityCode");
    const title = document.getElementById("activityTitle");
    const sortOrder = document.getElementById("activitySortOrder");
    const visible = document.getElementById("activityVisible");
    const active = document.getElementById("activityActive");
    const requiresSubmission = document.getElementById("activityRequiresSubmission");

    const activityId = document.getElementById("activityId");
    if (activityId) activityId.value = "";
    if (topic) topic.value = "";
    if (type) type.value = "";
    if (code) code.value = "";
    if (title) title.value = "";
    activityCodeManuallyEdited = false;
    setActivityCodeHint("Enter a title and GLIP will suggest the Activity Code.");
    if (sortOrder) sortOrder.value = "";
    if (visible) visible.value = "true";
    if (active) active.value = "true";
    if (requiresSubmission) requiresSubmission.value = "false";

    updateGeneratedActivityId();
    if (clearMessage !== false) setMessage("", "info");
    topic?.focus();
  }

  function toggleEdit() {
    editMode = !editMode;
    selectedActivityId = "";
    updateEditControls();
    setEditMessage(
      editMode ? "Select an activity row to edit it." : "",
      "info"
    );
    render();
  }

  function cancelEdit() {
    editMode = false;
    selectedActivityId = "";
    updateEditControls();
    setEditMessage("", "info");
    render();
  }

  function updateEditControls() {
    const editButton = document.getElementById("editActivitiesBtn");
    const search = document.getElementById("activitySearch");
    const searchColumn = document.getElementById("activitySearchColumn");
    const clearButton = document.getElementById("clearActivitySearch");

    if (editButton) {
      editButton.textContent = editMode ? "Finish Editing" : "Edit Activities";
    }

    [search, searchColumn, clearButton].forEach(function (control) {
      if (control) control.disabled = false;
    });
  }

  function openActivityEditor(activityId) {
    if (!editMode) return;
    selectedActivityId =
      String(selectedActivityId) === String(activityId) ? "" : String(activityId);
    setEditMessage(
      selectedActivityId ? "" : "Select an activity row to edit it.",
      "info"
    );
    render();
  }

  function cancelInlineEdit() {
    selectedActivityId = "";
    setEditMessage("Select an activity row to edit it.", "info");
    render();
  }

  function saveChanges() {
    const row = document.querySelector("[data-activity-row]");
    if (!row) return;

    const value = function (field) {
      const control = row.querySelector('[data-field="' + field + '"]');
      return control ? control.value : "";
    };

    const update = {
      original_activity_id: row.dataset.activityRow,
      activity_id: value("activity_id"),
      activity_code: value("activity_code"),
      topic_id: value("topic_id"),
      activity_type_id: value("activity_type_id"),
      activity_title: value("activity_title"),
      sort_order: value("sort_order"),
      visible: value("visible") === "true",
      active: value("active") === "true",
      requires_submission: value("requires_submission") === "true"
    };

    GLIPOptimisticUpdate.run({
      request: function () {
        return post({
          action: "updateActivitiesOwner",
          activities: [update]
        });
      },
      failureMessage: "Could not save changes.",
      apply: function () { applyActivityUpdatesLocally([update]); selectedActivityId = ""; render(); },
      onSuccess: function (result) {
        setEditMessage(result.message || "Activity changes saved.", "success");
      },
      resync: resyncActivitiesSilently,
      rollback: function () {
        activities = previousActivities;
        render();
      },
      onFailure: function (error) {
        setEditMessage(error.message || "Could not save changes. The previous values were restored.", "error");
      }
    });
  }

  function applyActivityUpdatesLocally(updates) {
    updates.forEach(function (update) {
      const index = activities.findIndex(function (activity) {
        return String(activity.activity_id) === String(update.original_activity_id);
      });
      if (index < 0) return;

      const topic = topics.find(function (item) {
        return String(item.topic_id) === String(update.topic_id);
      });
      const assignment = topic && topic.assignments && topic.assignments[0];
      const activityType = activityTypes.find(function (item) {
        return String(item.activity_type_id) === String(update.activity_type_id);
      });

      activities[index] = Object.assign({}, activities[index], update, {
        topic_name: topic ? topic.topic_name : activities[index].topic_name,
        topic_code: topic ? topic.topic_code : activities[index].topic_code,
        level_name: assignment ? assignment.level_name : activities[index].level_name,
        level_code: assignment ? assignment.level_code : activities[index].level_code,
        subject_name: assignment ? assignment.subject_name : activities[index].subject_name,
        subject_code: assignment ? assignment.subject_code : activities[index].subject_code,
        activity_type_name: activityType ? activityType.activity_type_name : activities[index].activity_type_name,
        activity_type_code: activityType ? activityType.activity_type_code : activities[index].activity_type_code
      });
    });
  }

  function resyncActivitiesSilently() {
    post({ action: "listActivitiesOwner" })
      .then(function (result) {
        if (!result || result.status !== "success") return;

        activities = Array.isArray(result.activities) ? GLIPOptimisticUpdate.mergePendingRows(result.activities, activities, "activity_id") : activities;
        topics = Array.isArray(result.topics) ? result.topics : topics;
        activityTypes = Array.isArray(result.activity_types) ? result.activity_types : activityTypes;
        populateSelectors();
        render();
        updateGeneratedActivityId();
      })
      .catch(function (error) {
        console.warn("Activity background resynchronisation failed.", error);
      });
  }

  function clearSearch() {
    const search = document.getElementById("activitySearch");
    const searchColumn = document.getElementById("activitySearchColumn");

    if (search) search.value = "";
    if (searchColumn) searchColumn.value = "all";

    render();
    search?.focus();
  }

  function setupSorting() {
    document
      .querySelectorAll("#activitiesTable thead th[data-sort-field]")
      .forEach(function (header) {
        header.style.cursor = "pointer";
        header.setAttribute("tabindex", "0");
        header.setAttribute("role", "button");

        header.addEventListener("click", function () {
          changeSort(header.dataset.sortField);
        });

        header.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            changeSort(header.dataset.sortField);
          }
        });
      });

    updateSortHeadings();
  }

  function changeSort(field) {
    if (!field || editMode) return;

    if (sortField === field) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortField = field;
      sortDirection = "asc";
    }

    updateSortHeadings();
    render();
  }

  function updateSortHeadings() {
    document
      .querySelectorAll("#activitiesTable thead th[data-sort-field]")
      .forEach(function (header) {
        const label = header.dataset.label || header.textContent.replace(/[▲▼↕]/g, "").trim();
        const indicator =
          header.dataset.sortField === sortField
            ? sortDirection === "asc"
              ? " ▲"
              : " ▼"
            : " ↕";

        header.textContent = label + indicator;
        header.setAttribute(
          "aria-sort",
          header.dataset.sortField === sortField
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
        );
      });
  }

  function getFilteredActivities() {
    const query = String(document.getElementById("activitySearch")?.value || "")
      .trim()
      .toLowerCase();

    const column = document.getElementById("activitySearchColumn")?.value || "all";

    if (!query) return activities.slice();

    return activities.filter(function (activity) {
      if (column === "all") {
        return [
          getDisplayValue(activity, "level"),
          getDisplayValue(activity, "subject"),
          getDisplayValue(activity, "topic"),
          getDisplayValue(activity, "activity_type"),
          getDisplayValue(activity, "activity_id"),
          getDisplayValue(activity, "activity_code"),
          getDisplayValue(activity, "activity_title"),
          getDisplayValue(activity, "visible"),
          getDisplayValue(activity, "sort_order"),
          getDisplayValue(activity, "active"),
          getDisplayValue(activity, "requires_submission")
        ].some(function (value) {
          return value.toLowerCase().includes(query);
        });
      }

      return getDisplayValue(activity, column).toLowerCase().includes(query);
    });
  }

  function getSortedActivities(items) {
    return items.slice().sort(function (a, b) {
      const left = getSortValue(a, sortField);
      const right = getSortValue(b, sortField);

      if (left < right) return sortDirection === "asc" ? -1 : 1;
      if (left > right) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  function getSortValue(activity, field) {
    if (field === "sort_order") {
      const number = Number(activity.sort_order);
      return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
    }

    return getDisplayValue(activity, field).toLocaleLowerCase("en-GB");
  }

  function getDisplayValue(activity, field) {
    switch (field) {
      case "level":
        return String(activity.level_name || activity.level_code || "");
      case "subject":
        return String(activity.subject_name || activity.subject_code || "");
      case "topic":
        return String(activity.topic_name || "");
      case "activity_type":
        return String(activity.activity_type_name || activity.activity_type_code || "");
      case "activity_id":
        return String(activity.activity_id || "");
      case "activity_code":
        return String(activity.activity_code || "");
      case "activity_title":
        return String(activity.activity_title || "");
      case "visible":
        return activity.visible ? "Visible" : "Hidden";
      case "sort_order":
        return String(activity.sort_order == null ? "" : activity.sort_order);
      case "active":
        return activity.active ? "Active" : "Inactive";
      case "requires_submission":
        return activity.requires_submission ? "Required" : "Not required";
      default:
        return "";
    }
  }

  function render() {
    const filtered = getFilteredActivities();
    const rows = getSortedActivities(filtered);
    const body = document.getElementById("activitiesTableBody");
    const count = document.getElementById("activityRecordCount");

    if (count) {
      count.textContent =
        "Showing " + rows.length + " of " + activities.length +
        (activities.length === 1 ? " record" : " records");
    }

    if (!body) return;

    body.innerHTML = rows.length
      ? rows.map(function (activity) {
          return renderView(activity) +
            (editMode && String(activity.activity_id) === String(selectedActivityId)
              ? renderEdit(activity)
              : "");
        }).join("")
      : '<tr><td colspan="8">No activities found.</td></tr>';

    if (editMode) {
      document.querySelectorAll("[data-activity-view-row]").forEach(function (row) {
        row.addEventListener("click", function () {
          openActivityEditor(row.dataset.activityViewRow);
        });
        row.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openActivityEditor(row.dataset.activityViewRow);
          }
        });
      });
    }

    if (selectedActivityId) bindEditChangeTracking();

    document.getElementById("saveInlineActivityBtn")?.addEventListener("click", saveChanges);
    document.getElementById("cancelInlineActivityBtn")?.addEventListener("click", cancelInlineEdit);
  }

  function bindEditChangeTracking() {
    document.querySelectorAll("[data-activity-row] [data-field]").forEach(function (field) {
      field.addEventListener("input", markChangedFields);
      field.addEventListener("change", markChangedFields);
    });

    markChangedFields();
  }

  function markChangedFields() {
    document.querySelectorAll("[data-activity-row]").forEach(function (row) {
      const original = activities.find(function (activity) {
        return String(activity.activity_id) === String(row.dataset.activityRow);
      });

      if (!original) return;

      row.querySelectorAll("[data-field]").forEach(function (field) {
        const fieldName = field.dataset.field;
        let originalValue = original[fieldName];
        let currentValue = field.value;

        if (fieldName === "visible" || fieldName === "active" || fieldName === "requires_submission") {
          originalValue = originalValue ? "true" : "false";
        }

        field.classList.toggle(
          "activity-field-changed",
          String(currentValue).trim() !== String(originalValue == null ? "" : originalValue).trim()
        );
      });
    });
  }

  function renderView(activity) {
    const selectableClass = editMode ? " activity-edit-selectable-row" : "";
    const selectedClass =
      editMode && String(activity.activity_id) === String(selectedActivityId)
        ? " activity-row-selected"
        : "";

    return (
      '<tr class="' + (!activity.active ? "planning-row" : "") +
      selectableClass + selectedClass + '"' +
      (editMode
        ? ' data-activity-view-row="' + esc(activity.activity_id) +
          '" tabindex="0" role="button" aria-label="Edit ' +
          esc(activity.activity_title || activity.activity_code) + '"'
        : "") +
      ">" +
      "<td>" + esc(activity.level_name || activity.level_code) + "</td>" +
      "<td>" + esc(activity.subject_name || activity.subject_code) + "</td>" +
      "<td>" + esc(activity.topic_name) + "</td>" +
      "<td>" + esc(activity.activity_type_name || activity.activity_type_code) + "</td>" +
      "<td>" + esc(activity.activity_title) + "</td>" +
      "<td>" + esc(activity.sort_order == null ? "" : activity.sort_order) + "</td>" +
      "<td>" + (activity.active ? "Active" : "Inactive") + "</td>" +
      "<td>" + (activity.requires_submission ? "Required" : "Not required") + "</td>" +
      "</tr>"
    );
  }

  function renderEdit(activity) {
    const topicOptions = topics
      .map(function (topic) {
        const assignment = topic.assignments && topic.assignments[0];
        const label =
          (assignment ? (assignment.level_name || assignment.level_code) + " – " : "") +
          (assignment ? (assignment.subject_name || assignment.subject_code) + " – " : "") +
          (topic.topic_name || topic.topic_code || "Topic");

        return (
          '<option value="' + esc(topic.topic_id) + '" ' +
          (String(topic.topic_id) === String(activity.topic_id) ? "selected" : "") +
          ">" + esc(label) + "</option>"
        );
      })
      .join("");

    const typeOptions = activityTypes
      .map(function (type) {
        return (
          '<option value="' + esc(type.activity_type_id) + '" ' +
          (String(type.activity_type_id) === String(activity.activity_type_id) ? "selected" : "") +
          ">" + esc(type.activity_type_name || type.activity_type_code) + "</option>"
        );
      })
      .join("");

    return (
      '<tr class="student-subject-edit-row activity-inline-edit-row">' +
      '<td colspan="8">' +
      '<div class="student-subject-inline-panel">' +
      '<p><strong>Editing activity ' + esc(activity.activity_title || activity.activity_code) + '.</strong></p>' +
      '<div class="activity-inline-edit-grid" data-activity-row="' + esc(activity.activity_id) + '">' +

      '<label class="activity-inline-field"><span>Activity ID</span>' +
      '<input class="tracker-input" data-field="activity_id" readonly value="' +
      esc(activity.activity_id) + '"></label>' +

      '<label class="activity-inline-field activity-inline-topic"><span>Level, subject and topic</span>' +
      '<select class="tracker-input" data-field="topic_id">' + topicOptions + "</select></label>" +

      '<label class="activity-inline-field"><span>Activity type</span>' +
      '<select class="tracker-input" data-field="activity_type_id">' + typeOptions + "</select></label>" +

      '<label class="activity-inline-field"><span>Activity Code</span>' +
      '<input class="tracker-input" data-field="activity_code" readonly value="' +
      esc(activity.activity_code) + '"></label>' +

      '<label class="activity-inline-field activity-inline-title"><span>Title</span>' +
      '<input class="tracker-input" data-field="activity_title" value="' +
      esc(activity.activity_title) + '"></label>' +

      '<label class="activity-inline-field"><span>Visibility</span>' +
      '<select class="tracker-input" data-field="visible">' +
      '<option value="true" ' + (activity.visible ? "selected" : "") + ">Visible</option>" +
      '<option value="false" ' + (!activity.visible ? "selected" : "") + ">Hidden</option>" +
      "</select></label>" +

      '<label class="activity-inline-field"><span>Sort order</span>' +
      '<input class="tracker-input" type="number" min="1" data-field="sort_order" value="' +
      esc(activity.sort_order) + '"></label>' +

      '<label class="activity-inline-field"><span>Status</span>' +
      '<select class="tracker-input" data-field="active">' +
      '<option value="true" ' + (activity.active ? "selected" : "") + ">Active</option>" +
      '<option value="false" ' + (!activity.active ? "selected" : "") + ">Inactive</option>" +
      "</select></label>" +

      '<label class="activity-inline-field"><span>Submission</span>' +
      '<select class="tracker-input" data-field="requires_submission">' +
      '<option value="false" ' + (!activity.requires_submission ? "selected" : "") + ">Not required</option>" +
      '<option value="true" ' + (activity.requires_submission ? "selected" : "") + ">Required</option>" +
      "</select></label>" +

      "</div>" +
      '<div class="student-subject-button-row">' +
      '<button class="glip-btn" id="saveInlineActivityBtn" type="button">Save Changes</button>' +
      '<button class="glip-btn glip-btn-secondary" id="cancelInlineActivityBtn" type="button">Cancel</button>' +
      "</div>" +
      "</div>" +
      "</td>" +
      "</tr>"
    );
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      }[character];
    });
  }
})();