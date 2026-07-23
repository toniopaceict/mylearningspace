(function () {
  "use strict";

  const LIST_ACTION = "listTopicCatalogueOwner";
  const SAVE_ACTION = "saveTopicCatalogueOwner";

  let items = [];
  let subjects = [];
  let editMode = false;
  let saving = false;
  let sortField = "topic";
  let sortDirection = "asc";
  let initialised = false;

  function post(data) {
    data.owner_teacher_id = sessionStorage.getItem("glipTeacherId");
    data.teacher_id = sessionStorage.getItem("glipTeacherId");
    data.role = sessionStorage.getItem("glipUserType");

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

    document.getElementById("editTopicCatalogueBtn")
      ?.addEventListener("click", enterEditMode);

    document.getElementById("saveTopicCatalogueBtn")
      ?.addEventListener("click", saveChanges);

    document.getElementById("cancelTopicCatalogueBtn")
      ?.addEventListener("click", cancelEditMode);

    document.getElementById("topicCatalogueSubject")
      ?.addEventListener("change", function () {
        setMessage("", "info");
        render();
      });

    document.querySelectorAll("#topicCatalogueTable th[data-sort-field]")
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
          render();
        });
      });

    document.addEventListener("glipManagementDataUpdated", function (event) {
      if (
        event.detail &&
        event.detail.action === LIST_ACTION &&
        !editMode &&
        !saving
      ) {
        loadFromBrowserCache();
      }
    });

    load();
  }

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(init, 100);
  });

  function load() {
    const cached =
      window.GLIPManagementCache &&
      window.GLIPManagementCache.read(LIST_ACTION, true);

    if (cached && cached.status === "success") {
      install(cached);
      setLoading(false);

      post({ action: LIST_ACTION }).catch(function () {});
      return;
    }

    setLoading(true);
    setMessage("", "info");

    post({ action: LIST_ACTION })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(
            (result && result.message) ||
            "Could not load the topic catalogue."
          );
        }

        install(result);
        setLoading(false);
      })
      .catch(function (error) {
        setLoading(false);
        setMessage(
          error.message || "Could not load the topic catalogue.",
          "error"
        );
      });
  }

  function loadFromBrowserCache() {
    const cached =
      window.GLIPManagementCache &&
      window.GLIPManagementCache.read(LIST_ACTION, true);

    if (cached && cached.status === "success") {
      install(cached);
    }
  }

  function install(result) {
    items = Array.isArray(result.topics)
      ? result.topics.map(function (item) {
          return Object.assign({}, item);
        })
      : [];

    subjects = Array.isArray(result.subjects)
      ? result.subjects.map(function (subject) {
          return Object.assign({}, subject);
        })
      : [];

    populateSubjectSelect();

    editMode = false;
    saving = false;

    updateButtons();
    updateSortIndicators();
    render();
  }

  function populateSubjectSelect() {
    const select = document.getElementById("topicCatalogueSubject");
    if (!select) return;

    const previous = select.value;

    select.innerHTML = subjects.length
      ? subjects.map(function (subject) {
          return (
            '<option value="' +
            esc(subject.subject_id) +
            '">' +
            esc(subject.subject_name || subject.subject_code) +
            "</option>"
          );
        }).join("")
      : '<option value="">No active subjects</option>';

    if (
      previous &&
      subjects.some(function (subject) {
        return String(subject.subject_id) === String(previous);
      })
    ) {
      select.value = previous;
    }
  }

  function visibleItems() {
    const subjectId =
      document.getElementById("topicCatalogueSubject")?.value || "";

    return items.filter(function (item) {
      return String(item.subject_id) === String(subjectId);
    });
  }

  function render() {
    const body = document.getElementById("topicCatalogueTableBody");
    const table = document.getElementById("topicCatalogueTable");
    const summary = document.getElementById("topicCatalogueSummary");

    if (!body || !table) return;

    const rows = visibleItems().slice().sort(compareItems);

    if (summary) {
      summary.textContent = rows.length
        ? rows.length + (rows.length === 1 ? " topic" : " topics")
        : "No topics found for this subject.";
    }

    if (!rows.length) {
      body.innerHTML =
        '<tr><td colspan="4">No topics were found.</td></tr>';

      table.style.visibility = "visible";
      return;
    }

    body.innerHTML = rows.map(function (item) {
      const usage = formatUsage(item.curriculum_count);
      const title = esc((item.used_by_curriculum || []).join("; "));
      const status = item.active ? "Active" : "Inactive";

      const statusCell = editMode
        ? '<select class="tracker-input" ' +
          'data-catalogue-id="' +
          esc(item.topic_id) +
          '" data-original="' +
          (item.active ? "true" : "false") +
          '">' +
          '<option value="true" ' +
          (item.active ? "selected" : "") +
          '>Active</option>' +
          '<option value="false" ' +
          (!item.active ? "selected" : "") +
          '>Inactive</option>' +
          '</select>'
        : esc(status);

      return (
        '<tr class="' +
        (!item.active ? "planning-row" : "") +
        '" data-row-id="' +
        esc(item.topic_id) +
        '">' +
        '<td>' +
        esc(item.topic_name || item.topic_code) +
        '</td>' +
        '<td>' +
        esc(item.topic_code) +
        '</td>' +
        '<td title="' +
        title +
        '">' +
        esc(usage) +
        '</td>' +
        '<td>' +
        statusCell +
        '</td>' +
        '</tr>'
      );
    }).join("");

    body.querySelectorAll("[data-catalogue-id]")
      .forEach(function (field) {
        field.addEventListener("change", function () {
          field.classList.toggle(
            "teacher-field-changed",
            field.value !== field.dataset.original
          );

          setMessage("", "info");
        });
      });

    table.style.visibility = "visible";
  }

  function compareItems(a, b) {
    let valueA;
    let valueB;

    if (sortField === "topic") {
      valueA = String(a.topic_name || a.topic_code).toLowerCase();
      valueB = String(b.topic_name || b.topic_code).toLowerCase();
    } else if (sortField === "code") {
      valueA = String(a.topic_code).toLowerCase();
      valueB = String(b.topic_code).toLowerCase();
    } else if (sortField === "usage") {
      valueA = Number(a.curriculum_count || 0);
      valueB = Number(b.curriculum_count || 0);
    } else {
      valueA = a.active ? 1 : 0;
      valueB = b.active ? 1 : 0;
    }

    if (valueA < valueB) {
      return sortDirection === "asc" ? -1 : 1;
    }

    if (valueA > valueB) {
      return sortDirection === "asc" ? 1 : -1;
    }

    return 0;
  }

  function enterEditMode() {
    if (saving) return;

    editMode = true;
    setMessage("", "info");
    updateButtons();
    render();
  }

  function cancelEditMode() {
    if (saving) return;

    editMode = false;
    setMessage("", "info");
    updateButtons();
    render();
  }


  function showTopicCatalogueConfirm(options) {
    if (typeof window.showGlipConfirmModal === "function") {
      return window.showGlipConfirmModal(options);
    }

    return new Promise(function (resolve) {
      let modal = document.getElementById("topicCatalogueConfirmModal");

      if (!modal) {
        modal = document.createElement("div");
        modal.id = "topicCatalogueConfirmModal";
        modal.className = "glip-confirm-modal";
        modal.innerHTML =
          '<div class="glip-confirm-box" role="dialog" aria-modal="true" aria-labelledby="topicCatalogueConfirmTitle">' +
            '<h2 id="topicCatalogueConfirmTitle"></h2>' +
            '<div id="topicCatalogueConfirmBody" class="glip-confirm-body"></div>' +
            '<div class="glip-confirm-actions">' +
              '<button type="button" id="topicCatalogueConfirmCancel" class="glip-btn glip-btn-secondary teacher-cancel-btn">Cancel</button>' +
              '<button type="button" id="topicCatalogueConfirmOk" class="glip-btn">Continue</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(modal);
      }

      const title = modal.querySelector("#topicCatalogueConfirmTitle");
      const body = modal.querySelector("#topicCatalogueConfirmBody");
      const cancelBtn = modal.querySelector("#topicCatalogueConfirmCancel");
      const okBtn = modal.querySelector("#topicCatalogueConfirmOk");
      const box = modal.querySelector(".glip-confirm-box");
      let settled = false;

      title.textContent = options.title || "Confirm change";
      body.innerHTML = options.bodyHtml || "";
      okBtn.textContent = options.confirmButtonText || "Continue";
      cancelBtn.textContent = options.cancelButtonText || "Cancel";

      function close(value) {
        if (settled) return;
        settled = true;
        modal.classList.remove("is-visible");
        document.removeEventListener("keydown", onKeyDown);
        resolve(value);
      }

      function onKeyDown(event) {
        if (event.key === "Escape") close(false);
      }

      cancelBtn.onclick = function () { close(false); };
      okBtn.onclick = function () { close(true); };
      modal.onclick = function (event) {
        if (event.target === modal) close(false);
      };
      box.onclick = function (event) { event.stopPropagation(); };

      document.addEventListener("keydown", onKeyDown);
      modal.classList.add("is-visible");
      setTimeout(function () { okBtn.focus(); }, 0);
    });
  }

  function saveChanges() {
    if (saving) return;

    const updates = [];

    document.querySelectorAll("[data-catalogue-id]")
      .forEach(function (field) {
        if (field.value !== field.dataset.original) {
          updates.push({
            topic_id: field.dataset.catalogueId,
            active: field.value === "true"
          });
        }
      });

    if (!updates.length) {
      setMessage("No changes to save.", "info");
      return;
    }

    const affected = updates
      .map(function (update) {
        const item = items.find(function (candidate) {
          return String(candidate.topic_id) === String(update.topic_id);
        });

        return {
          item: item,
          becomingInactive: update.active === false
        };
      })
      .filter(function (entry) {
        return (
          entry.item &&
          entry.becomingInactive &&
          Number(entry.item.curriculum_count || 0) > 0
        );
      })
      .map(function (entry) {
        return entry.item;
      });

    if (!affected.length) {
      applyAndSaveUpdates(updates);
      return;
    }

    const selectedSubjectId =
      document.getElementById("topicCatalogueSubject")?.value || "";

    const selectedSubject = subjects.find(function (subject) {
      return String(subject.subject_id) === String(selectedSubjectId);
    });

    const subjectName = selectedSubject
      ? selectedSubject.subject_name || selectedSubject.subject_code
      : "the selected subject";

    const topicNames = affected.map(function (item) {
      return item.topic_name || item.topic_code;
    });

    const bodyHtml = affected.length === 1
      ? "<p><strong>" + esc(topicNames[0]) + "</strong> will remain assigned to the subject <strong>" + esc(subjectName) + "</strong>, but if its status is changed to <strong>Inactive</strong>, it will become unavailable to students.</p><p>Do you want to continue?</p>"
      : "<p>The following topics will remain assigned to the subject <strong>" + esc(subjectName) + "</strong>, but if their status is changed to <strong>Inactive</strong>, they will become unavailable to students:</p><p><strong>" + esc(topicNames.join(", ")) + "</strong></p><p>Do you want to continue?</p>";

    showTopicCatalogueConfirm({
      title: "Change topic status?",
      bodyHtml: bodyHtml,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel"
    }).then(function (confirmed) {
      if (confirmed) {
        applyAndSaveUpdates(updates);
      }
    });
  }

  function applyAndSaveUpdates(updates) {
    const previousItems = items.map(function (item) {
      return Object.assign({}, item);
    });

    updates.forEach(function (update) {
      const item = items.find(function (candidate) {
        return String(candidate.topic_id) === String(update.topic_id);
      });

      if (item) {
        item.active = update.active;
      }
    });

    editMode = false;
    saving = true;

    updateButtons();
    render();

    setMessage(
      "Topic availability updated. Saving in the background...",
      "success"
    );

    post({
      action: SAVE_ACTION,
      topics: updates
    })
      .then(function (result) {
        if (!result || result.status !== "success") {
          throw new Error(
            (result && result.message) ||
            "Could not save topic availability."
          );
        }

        saving = false;
        updateButtons();

        writeCurrentBrowserCache(result.management_versions);

        setMessage(
          result.message || "Topic availability updated.",
          "success"
        );
      })
      .catch(function (error) {
        items = previousItems;
        saving = false;

        updateButtons();
        render();

        setMessage(
          error.message ||
          "Could not save topic availability. The previous values were restored.",
          "error"
        );
      });
  }

  function writeCurrentBrowserCache(versions) {
    if (!window.GLIPManagementCache) return;

    const data = {
      status: "success",
      topics: items.map(function (item) {
        return Object.assign({}, item);
      }),
      subjects: subjects.map(function (subject) {
        return Object.assign({}, subject);
      }),
      management_versions: versions || {}
    };

    window.GLIPManagementCache.write(
      LIST_ACTION,
      data,
      versions && versions.topicCatalogue
    );
  }

  function formatUsage(count) {
    const number = Number(count || 0);

    return number
      ? "Assigned to " + number + (number === 1 ? " subject" : " subjects")
      : "Not assigned";
  }

  function updateButtons() {
    const edit = document.getElementById("editTopicCatalogueBtn");
    const save = document.getElementById("saveTopicCatalogueBtn");
    const cancel = document.getElementById("cancelTopicCatalogueBtn");
    const subjectSelect = document.getElementById("topicCatalogueSubject");

    if (edit) {
      edit.style.display = editMode ? "none" : "inline-block";
      edit.disabled = saving;
      edit.title = saving
        ? "Please wait until the topic changes have finished saving."
        : "";
    }

    if (save) {
      save.style.display = editMode ? "inline-block" : "none";
      save.disabled = saving;
    }

    if (cancel) {
      cancel.style.display = editMode ? "inline-block" : "none";
      cancel.disabled = saving;
    }

    if (subjectSelect) {
      subjectSelect.disabled = saving;
      subjectSelect.title = saving
        ? "Please wait until the topic changes have finished saving."
        : "";
    }
  }

  function updateSortIndicators() {
    document.querySelectorAll("#topicCatalogueTable th[data-sort-field]")
      .forEach(function (header) {
        const field = header.dataset.sortField;
        const label = header.dataset.label;

        header.textContent =
          field === sortField
            ? label + (sortDirection === "asc" ? " ▲" : " ▼")
            : label + " ↕";
      });
  }

  function setLoading(value) {
    const loadingBox = document.getElementById("topicCatalogueLoading");
    const table = document.getElementById("topicCatalogueTable");

    if (loadingBox) {
      loadingBox.style.display = value ? "block" : "none";
    }

    if (table) {
      table.style.visibility = value ? "hidden" : "visible";
    }
  }

  function setMessage(text, type) {
    const message = document.getElementById("topicCatalogueMessage");
    if (!message) return;

    message.textContent = text || "";
    message.className =
      "panel-message teacher-message " + (type || "info");
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
