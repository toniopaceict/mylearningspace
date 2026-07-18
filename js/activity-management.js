(function () {
  "use strict";

  let activities = [];
  let topics = [];
  let activityTypes = [];
  let editMode = false;
  let initialised = false;
  let sortField = "sort_order";
  let sortDirection = "asc";

  function post(data) {
    data.owner_teacher_id = sessionStorage.getItem("glipTeacherId");
    return fetch(window.getGlipWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json();
    });
  }

  function init() {
    if (initialised || typeof isOwner !== "function") return;
    initialised = true;
    if (!isOwner()) return;

    document.getElementById("saveActivityBtn")?.addEventListener("click", addActivity);
    document.getElementById("cancelAddActivityBtn")?.addEventListener("click", resetAddActivityForm);
    document.getElementById("editActivitiesBtn")?.addEventListener("click", toggleEdit);
    document.getElementById("clearActivitySearch")?.addEventListener("click", clearSearch);
    document.getElementById("activitySearch")?.addEventListener("input", render);
    document.getElementById("activitySearchColumn")?.addEventListener("change", render);
    document.getElementById("activityTopic")?.addEventListener("change", updateGeneratedActivityId);
    document.getElementById("activityType")?.addEventListener("change", updateGeneratedActivityId);

    setupSorting();
    applyActivityTableColumnSizing();
    load();
  }

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(init, 100);
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
    const table = document.getElementById("activitiesTable");

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

        activities = Array.isArray(result.activities) ? result.activities : [];
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
    const topicSelect = document.getElementById("activityTopic");
    const typeSelect = document.getElementById("activityType");

    if (!activityId || !topicSelect || !typeSelect) return;

    const topicOption = topicSelect.options[topicSelect.selectedIndex];
    const typeOption = typeSelect.options[typeSelect.selectedIndex];

    if (!topicSelect.value || !typeSelect.value || !topicOption || !typeOption) {
      activityId.value = "";
      return;
    }

    const subjectToken = normaliseCodeToken(topicOption.dataset.subject);
    const levelToken = makeNumberedToken("l", topicOption.dataset.level);
    const topicToken = makeNumberedToken("t", topicOption.dataset.topicCode);
    const typeToken = normaliseActivityTypeToken(typeOption.dataset.code);

    if (!subjectToken || !levelToken || !topicToken || !typeToken) {
      activityId.value = "";
      return;
    }

    const prefix = [subjectToken, levelToken, topicToken, typeToken].join("_");
    let highestNumber = 0;

    activities.forEach(function (activity) {
      const id = String(activity.activity_id || "").trim().toLowerCase();
      const match = id.match(new RegExp("^" + escapeRegExp(prefix) + "(\\d+)$"));

      if (match) {
        highestNumber = Math.max(highestNumber, Number(match[1]) || 0);
      }
    });

    activityId.value = prefix + (highestNumber + 1);
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

  function addActivity() {
    const activityId = document.getElementById("activityId").value.trim();
    const topicSelect = document.getElementById("activityTopic");
    const typeSelect = document.getElementById("activityType");

    const payload = {
      action: "addActivityOwner",
      activity_id: activityId,
      topic_id: topicSelect.value,
      activity_type_id: typeSelect.value,
      activity_title: document.getElementById("activityTitle").value.trim(),
      sort_order: document.getElementById("activitySortOrder").value,
      visible: document.getElementById("activityVisible").value === "true",
      active: document.getElementById("activityActive").value === "true"
    };

    if (!payload.topic_id) {
      setMessage("Select a level, subject and topic.", "error");
      return;
    }

    if (!payload.activity_type_id) {
      setMessage("Select an activity type.", "error");
      return;
    }

    if (!payload.activity_id) {
      setMessage("The Activity ID could not be generated.", "error");
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
      activity_id: payload.activity_id,
      topic_id: payload.topic_id,
      activity_type_id: payload.activity_type_id,
      activity_title: payload.activity_title,
      sort_order: payload.sort_order,
      visible: payload.visible,
      active: payload.active,
      topic_name: topic ? topic.topic_name : "",
      topic_code: topic ? topic.topic_code : "",
      level_name: assignment ? assignment.level_name : "",
      level_code: assignment ? assignment.level_code : "",
      subject_name: assignment ? assignment.subject_name : "",
      subject_code: assignment ? assignment.subject_code : "",
      activity_type_name: activityType ? activityType.activity_type_name : "",
      activity_type_code: activityType ? activityType.activity_type_code : ""
    };

    activities.push(optimisticActivity);
    render();
    resetAddActivityForm(false);

    GLIPOptimisticUpdate.run({
      request: function () { return post(payload); },
      failureMessage: "Could not save activity.",
      onSuccess: function (result) {
        setMessage(result.message || "Activity saved.", "success");
      },
      resync: resyncActivitiesSilently,
      rollback: function () {
        activities = activities.filter(function (activity) {
          return String(activity.activity_id) !== String(payload.activity_id);
        });
        render();
      },
      onFailure: function (error) {
        setMessage(error.message || "Could not save activity. The temporary row was removed.", "error");
      }
    });
  }

  function resetAddActivityForm(clearMessage) {
    const topic = document.getElementById("activityTopic");
    const type = document.getElementById("activityType");
    const title = document.getElementById("activityTitle");
    const sortOrder = document.getElementById("activitySortOrder");
    const visible = document.getElementById("activityVisible");
    const active = document.getElementById("activityActive");

    if (topic) topic.value = "";
    if (type) type.value = "";
    if (title) title.value = "";
    if (sortOrder) sortOrder.value = "";
    if (visible) visible.value = "true";
    if (active) active.value = "true";

    updateGeneratedActivityId();
    if (clearMessage !== false) setMessage("", "info");
    topic?.focus();
  }

  function toggleEdit() {
    if (!editMode) {
      editMode = true;
      updateEditControls();
      render();
      return;
    }

    saveChanges();
  }

  function cancelEdit() {
    editMode = false;
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
      editButton.textContent = editMode ? "Save Changes" : "Edit Activities";
    }

    let cancelButton = document.getElementById("cancelActivitiesEditBtn");

    if (editMode && !cancelButton && editButton) {
      cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.id = "cancelActivitiesEditBtn";
      cancelButton.className = "glip-btn glip-btn-secondary";
      cancelButton.textContent = "Cancel";
      cancelButton.addEventListener("click", cancelEdit);
      editButton.insertAdjacentElement("afterend", cancelButton);
    }

    if (!editMode && cancelButton) cancelButton.remove();

    [search, searchColumn, clearButton].forEach(function (control) {
      if (control) control.disabled = editMode;
    });
  }

  function saveChanges() {
    const rows = Array.from(document.querySelectorAll("[data-activity-row]"));

    const updates = rows.map(function (row) {
      const value = function (field) {
        return row.querySelector('[data-field="' + field + '"]').value;
      };

      return {
        original_activity_id: row.dataset.activityRow,
        activity_id: value("activity_id"),
        topic_id: value("topic_id"),
        activity_type_id: value("activity_type_id"),
        activity_title: value("activity_title"),
        sort_order: value("sort_order"),
        visible: value("visible") === "true",
        active: value("active") === "true"
      };
    });

    const previousActivities = activities.map(function (activity) {
      return Object.assign({}, activity);
    });

    applyActivityUpdatesLocally(updates);
    editMode = false;
    updateEditControls();
    render();

    GLIPOptimisticUpdate.run({
      request: function () {
        return post({
          action: "updateActivitiesOwner",
          activities: updates
        });
      },
      failureMessage: "Could not save changes.",
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

        activities = Array.isArray(result.activities) ? result.activities : activities;
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

  function applyActivityTableColumnSizing() {
    const table = document.getElementById("activitiesTable");
    if (!table) return;

    const sortHeading = table.querySelector("thead th:nth-child(8)");
    if (sortHeading) {
      sortHeading.style.width = "78px";
      sortHeading.style.whiteSpace = "nowrap";
    }
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
          getDisplayValue(activity, "activity_title"),
          getDisplayValue(activity, "visible"),
          getDisplayValue(activity, "sort_order"),
          getDisplayValue(activity, "active")
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
      case "activity_title":
        return String(activity.activity_title || "");
      case "visible":
        return activity.visible ? "Visible" : "Hidden";
      case "sort_order":
        return String(activity.sort_order == null ? "" : activity.sort_order);
      case "active":
        return activity.active ? "Active" : "Inactive";
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
      ? rows.map(editMode ? renderEdit : renderView).join("")
      : '<tr><td colspan="9">No activities found.</td></tr>';

    if (editMode) bindEditChangeTracking();
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

        if (fieldName === "visible" || fieldName === "active") {
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
    return (
      '<tr class="' + (!activity.active ? "planning-row" : "") + '">' +
      "<td>" + esc(activity.level_name || activity.level_code) + "</td>" +
      "<td>" + esc(activity.subject_name || activity.subject_code) + "</td>" +
      "<td>" + esc(activity.topic_name) + "</td>" +
      "<td>" + esc(activity.activity_type_name || activity.activity_type_code) + "</td>" +
      "<td>" + esc(activity.activity_id) + "</td>" +
      "<td>" + esc(activity.activity_title) + "</td>" +
      "<td>" + (activity.visible ? "Visible" : "Hidden") + "</td>" +
      "<td>" + esc(activity.sort_order) + "</td>" +
      "<td>" + (activity.active ? "Active" : "Inactive") + "</td>" +
      "</tr>"
    );
  }

  function renderEdit(activity) {
    const topicOptions = topics
      .map(function (topic) {
        const assignment = topic.assignments && topic.assignments[0];
        const label = topic.topic_name || topic.topic_code || "Topic";

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
      '<tr data-activity-row="' + esc(activity.activity_id) + '">' +
      '<td>' + esc(activity.level_name || activity.level_code) + '</td>' +
      '<td>' + esc(activity.subject_name || activity.subject_code) + '</td>' +
      '<td><select class="tracker-input" data-field="topic_id">' +
      topicOptions +
      "</select></td>" +
      '<td><select class="tracker-input" data-field="activity_type_id">' +
      typeOptions +
      "</select></td>" +
      '<td><input class="tracker-input" data-field="activity_id" readonly value="' +
      esc(activity.activity_id) +
      '"></td>' +
      '<td><input class="tracker-input" data-field="activity_title" value="' +
      esc(activity.activity_title) +
      '"></td>' +
      '<td><select class="tracker-input" data-field="visible">' +
      '<option value="true" ' + (activity.visible ? "selected" : "") + ">Visible</option>" +
      '<option value="false" ' + (!activity.visible ? "selected" : "") + ">Hidden</option>" +
      "</select></td>" +
      '<td><input class="tracker-input" type="number" min="1" data-field="sort_order" value="' +
      esc(activity.sort_order) +
      '"></td>' +
      '<td><select class="tracker-input" data-field="active">' +
      '<option value="true" ' + (activity.active ? "selected" : "") + ">Active</option>" +
      '<option value="false" ' + (!activity.active ? "selected" : "") + ">Inactive</option>" +
      "</select></td>" +
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