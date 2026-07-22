(function () {
  "use strict";

  let subjects = [];
  let topics = [];
  let originalActive = {};
  let sortField = "topic";
  let sortDirection = "asc";
  let initialised = false;

  function post(data) {
    data.owner_teacher_id = sessionStorage.getItem("glipTeacherId");
    data.teacher_id = sessionStorage.getItem("glipTeacherId");
    data.role = sessionStorage.getItem("glipUserType");
    return fetch(window.getGlipWebAppUrl(), { method: "POST", body: JSON.stringify(data) })
      .then(function (response) { return response.json(); });
  }

  function init() {
    if (initialised || typeof isOwner !== "function") return;
    initialised = true;
    if (!isOwner()) return;

    document.getElementById("topicCatalogueSubject")?.addEventListener("change", function () { setMessage("", "info"); render(); });
    document.getElementById("saveTopicCatalogueBtn")?.addEventListener("click", save);
    document.querySelectorAll("#topicCatalogueTable th[data-sort-field]").forEach(function (header) {
      header.style.cursor = "pointer";
      header.addEventListener("click", function () {
        const field = header.dataset.sortField;
        if (sortField === field) sortDirection = sortDirection === "asc" ? "desc" : "asc";
        else { sortField = field; sortDirection = "asc"; }
        updateSortIndicators();
        render();
      });
    });
    load();
  }

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 100); });

  function load() {
    setLoading(true);
    post({ action: "listTopicCatalogueOwner" }).then(function (result) {
      if (!result || result.status !== "success") throw new Error((result && result.message) || "Could not load the topic catalogue.");
      subjects = Array.isArray(result.subjects) ? result.subjects : [];
      topics = Array.isArray(result.topics) ? result.topics : [];
      rememberOriginalValues();
      populateSubjects();
      updateSortIndicators();
      render();
      setLoading(false);
    }).catch(function (error) {
      setLoading(false);
      setMessage(error.message || "Could not load the topic catalogue.", "error");
    });
  }

  function rememberOriginalValues() {
    originalActive = {};
    topics.forEach(function (item) { originalActive[String(item.topic_id)] = item.active === true; });
  }

  function populateSubjects() {
    const select = document.getElementById("topicCatalogueSubject");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">Select subject</option>' + subjects.map(function (subject) {
      return '<option value="' + esc(subject.subject_id) + '">' + esc((subject.subject_name || subject.subject_code) + " (" + subject.topic_count + " topics)") + '</option>';
    }).join("");
    if (subjects.some(function (subject) { return String(subject.subject_id) === String(previous); })) select.value = previous;
    else if (subjects.length === 1) select.value = subjects[0].subject_id;
  }

  function render() {
    const body = document.getElementById("topicCatalogueTableBody");
    const table = document.getElementById("topicCatalogueTable");
    const summary = document.getElementById("topicCatalogueSummary");
    const subjectId = document.getElementById("topicCatalogueSubject")?.value || "";
    if (!body || !table) return;

    if (!subjects.length) {
      body.innerHTML = '<tr><td colspan="4">Activate at least one subject in the Subject Catalogue first.</td></tr>';
      if (summary) summary.textContent = "No active subjects are available.";
      table.style.visibility = "visible";
      return;
    }

    if (!subjectId) {
      body.innerHTML = '<tr><td colspan="4">Select a subject to view its topics.</td></tr>';
      if (summary) summary.textContent = "";
      table.style.visibility = "visible";
      return;
    }

    const subject = subjects.find(function (item) { return String(item.subject_id) === String(subjectId); });
    const matching = topics.filter(function (item) { return String(item.subject_id) === String(subjectId); }).sort(compareItems);
    if (summary) summary.textContent = (subject ? (subject.subject_name || subject.subject_code) : "Subject") + ": " + matching.length + (matching.length === 1 ? " topic" : " topics");

    if (!matching.length) {
      body.innerHTML = '<tr><td colspan="4">No topics were found for this subject in the Topics sheet.</td></tr>';
      table.style.visibility = "visible";
      return;
    }

    body.innerHTML = matching.map(function (item) {
      const labels = Array.isArray(item.used_by_curriculum) ? item.used_by_curriculum : [];
      const usage = Number(item.curriculum_count || 0) ? item.curriculum_count + (Number(item.curriculum_count) === 1 ? " assignment" : " assignments") : "Not used";
      return '<tr data-topic-id="' + esc(item.topic_id) + '">' +
        '<td>' + esc(item.topic_name || item.topic_code) + '</td>' +
        '<td>' + esc(item.topic_code) + '</td>' +
        '<td title="' + esc(labels.join("; ")) + '">' + esc(usage) + '</td>' +
        '<td><label><input type="checkbox" data-topic-active="' + esc(item.topic_id) + '" ' + (item.active ? "checked" : "") + '> ' + (item.active ? "Active" : "Not active") + '</label></td>' +
        '</tr>';
    }).join("");

    body.querySelectorAll("[data-topic-active]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        const item = topics.find(function (topic) { return String(topic.topic_id) === String(checkbox.dataset.topicActive); });
        if (!item) return;
        item.active = checkbox.checked;
        checkbox.parentElement.lastChild.textContent = checkbox.checked ? " Active" : " Not active";
        setMessage("", "info");
      });
    });
    table.style.visibility = "visible";
  }

  function compareItems(a, b) {
    let av;
    let bv;
    if (sortField === "topic") { av = String(a.topic_name || a.topic_code).toLowerCase(); bv = String(b.topic_name || b.topic_code).toLowerCase(); }
    else if (sortField === "code") { av = String(a.topic_code).toLowerCase(); bv = String(b.topic_code).toLowerCase(); }
    else if (sortField === "usage") { av = Number(a.curriculum_count || 0); bv = Number(b.curriculum_count || 0); }
    else { av = a.active ? 1 : 0; bv = b.active ? 1 : 0; }
    if (av < bv) return sortDirection === "asc" ? -1 : 1;
    if (av > bv) return sortDirection === "asc" ? 1 : -1;
    return 0;
  }

  function save() {
    const changed = topics.filter(function (item) { return originalActive[String(item.topic_id)] !== (item.active === true); });
    if (!changed.length) { setMessage("No changes to save.", "info"); return; }

    const affected = changed.filter(function (item) { return !item.active && Number(item.curriculum_count || 0) > 0; });
    if (affected.length) {
      const names = affected.map(function (item) { return item.topic_name || item.topic_code; }).join(", ");
      if (!window.confirm(names + " is currently used by the curriculum. Deactivating it will make it unavailable to students, although its existing assignments will remain in Google Sheets. Continue?")) return;
    }

    setSaving(true);
    post({ action: "saveTopicCatalogueOwner", topics: changed.map(function (item) { return { topic_id: item.topic_id, active: item.active }; }) })
      .then(function (result) {
        if (!result || result.status !== "success") throw new Error((result && result.message) || "Could not save topic availability.");
        rememberOriginalValues();
        setSaving(false);
        setMessage(result.message || "Topic availability updated.", "success");
      }).catch(function (error) {
        setSaving(false);
        setMessage(error.message || "Could not save topic availability.", "error");
        load();
      });
  }

  function updateSortIndicators() {
    document.querySelectorAll("#topicCatalogueTable th[data-sort-field]").forEach(function (header) {
      const field = header.dataset.sortField;
      const label = header.dataset.label;
      header.textContent = field === sortField ? label + (sortDirection === "asc" ? " ▲" : " ▼") : label + " ↕";
    });
  }

  function setLoading(value) {
    const box = document.getElementById("topicCatalogueLoading");
    const table = document.getElementById("topicCatalogueTable");
    if (box) box.style.display = value ? "block" : "none";
    if (table) table.style.visibility = value ? "hidden" : "visible";
  }

  function setSaving(value) {
    const button = document.getElementById("saveTopicCatalogueBtn");
    if (!button) return;
    button.disabled = value;
    button.textContent = value ? "Saving..." : "Save Changes";
  }

  function setMessage(text, type) {
    const el = document.getElementById("topicCatalogueMessage");
    if (!el) return;
    el.textContent = text || "";
    el.className = "panel-message teacher-message " + (type || "info");
  }

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
})();
