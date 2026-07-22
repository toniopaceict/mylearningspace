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
    return fetch(window.getGlipWebAppUrl(), { method: "POST", body: JSON.stringify(data) })
      .then(function (response) { return response.json(); });
  }

  function init() {
    if (initialised || typeof isOwner !== "function") return;
    initialised = true;
    if (!isOwner()) return;
    document.getElementById("editTopicCatalogueBtn")?.addEventListener("click", enterEditMode);
    document.getElementById("saveTopicCatalogueBtn")?.addEventListener("click", saveChanges);
    document.getElementById("cancelTopicCatalogueBtn")?.addEventListener("click", cancelEditMode);
    document.getElementById("topicCatalogueSubject")?.addEventListener("change", function () { setMessage("", "info"); render(); });
    document.querySelectorAll("#topicCatalogueTable th[data-sort-field]").forEach(function (header) {
      header.style.cursor = "pointer";
      header.addEventListener("click", function () {
        const field = header.dataset.sortField;
        if (sortField === field) sortDirection = sortDirection === "asc" ? "desc" : "asc";
        else { sortField = field; sortDirection = "asc"; }
        updateSortIndicators(); render();
      });
    });
    document.addEventListener("glipManagementDataUpdated", function (event) {
      if (event.detail && event.detail.action === LIST_ACTION && !editMode && !saving) loadFromBrowserCache();
    });
    load();
  }

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 100); });

  function load() {
    const cached = window.GLIPManagementCache && window.GLIPManagementCache.read(LIST_ACTION, true);
    if (cached && cached.status === "success") {
      install(cached); setLoading(false);
      post({ action: LIST_ACTION }).catch(function () {});
      return;
    }
    setLoading(true); setMessage("", "info");
    post({ action: LIST_ACTION }).then(function (result) {
      if (!result || result.status !== "success") throw new Error((result && result.message) || "Could not load the topic catalogue.");
      install(result); setLoading(false);
    }).catch(function (error) { setLoading(false); setMessage(error.message || "Could not load the topic catalogue.", "error"); });
  }

  function loadFromBrowserCache() {
    const cached = window.GLIPManagementCache && window.GLIPManagementCache.read(LIST_ACTION, true);
    if (cached && cached.status === "success") install(cached);
  }

  function install(result) {
    items = Array.isArray(result.topics) ? result.topics.map(function (x) { return Object.assign({}, x); }) : [];
    subjects = Array.isArray(result.subjects) ? result.subjects.map(function (x) { return Object.assign({}, x); }) : [];
    populateSubjectSelect();
    editMode = false; updateButtons(); updateSortIndicators(); render();
  }

  function populateSubjectSelect() {
    const select = document.getElementById("topicCatalogueSubject");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = subjects.length ? subjects.map(function (s) {
      return '<option value="' + esc(s.subject_id) + '">' + esc(s.subject_name || s.subject_code) + ' (' + esc(s.topic_count || 0) + ' topics)</option>';
    }).join("") : '<option value="">No active subjects</option>';
    if (previous && subjects.some(function (s) { return String(s.subject_id) === String(previous); })) select.value = previous;
  }

  function visibleItems() {
    const subjectId = document.getElementById("topicCatalogueSubject")?.value || "";
    return items.filter(function (item) { return String(item.subject_id) === String(subjectId); });
  }

  function render() {
    const body = document.getElementById("topicCatalogueTableBody");
    const table = document.getElementById("topicCatalogueTable");
    if (!body || !table) return;
    const rows = visibleItems().slice().sort(compareItems);
    const summary = document.getElementById("topicCatalogueSummary");
    if (summary) summary.textContent = rows.length ? rows.length + (rows.length === 1 ? " topic" : " topics") : "No topics found for this subject.";
    if (!rows.length) { body.innerHTML = '<tr><td colspan="4">No topics were found.</td></tr>'; table.style.visibility = "visible"; return; }
    body.innerHTML = rows.map(function (item) {
      const usage = formatUsage(item.curriculum_count);
      const title = esc((item.used_by_curriculum || []).join("; "));
      const status = item.active ? "Active" : "Inactive";
      const statusCell = editMode
        ? '<select class="tracker-input" data-catalogue-id="' + esc(item.topic_id) + '" data-original="' + (item.active ? 'true' : 'false') + '"><option value="true" ' + (item.active ? 'selected' : '') + '>Active</option><option value="false" ' + (!item.active ? 'selected' : '') + '>Inactive</option></select>'
        : esc(status);
      return '<tr data-row-id="' + esc(item.topic_id) + '"><td>' + esc(item.topic_name || item.topic_code) + '</td><td>' + esc(item.topic_code) + '</td><td title="' + title + '">' + esc(usage) + '</td><td>' + statusCell + '</td></tr>';
    }).join("");
    body.querySelectorAll("[data-catalogue-id]").forEach(function (field) {
      field.addEventListener("change", function () { field.classList.toggle("teacher-field-changed", field.value !== field.dataset.original); setMessage("", "info"); });
    });
    table.style.visibility = "visible";
  }

  function compareItems(a, b) {
    let av, bv;
    if (sortField === "topic") { av = String(a.topic_name || a.topic_code).toLowerCase(); bv = String(b.topic_name || b.topic_code).toLowerCase(); }
    else if (sortField === "code") { av = String(a.topic_code).toLowerCase(); bv = String(b.topic_code).toLowerCase(); }
    else if (sortField === "usage") { av = Number(a.curriculum_count || 0); bv = Number(b.curriculum_count || 0); }
    else { av = a.active ? 1 : 0; bv = b.active ? 1 : 0; }
    if (av < bv) return sortDirection === "asc" ? -1 : 1;
    if (av > bv) return sortDirection === "asc" ? 1 : -1;
    return 0;
  }

  function enterEditMode() { if (saving) return; editMode = true; setMessage("", "info"); updateButtons(); render(); }
  function cancelEditMode() { if (saving) return; editMode = false; setMessage("", "info"); updateButtons(); render(); }

  function saveChanges() {
    if (saving) return;
    const updates = [];
    document.querySelectorAll("[data-catalogue-id]").forEach(function (field) {
      if (field.value !== field.dataset.original) updates.push({ topic_id: field.dataset.catalogueId, active: field.value === "true" });
    });
    if (!updates.length) { setMessage("No changes to save.", "info"); return; }
    const affected = updates.map(function (u) { return items.find(function (x) { return String(x.topic_id) === String(u.topic_id); }); })
      .filter(function (x, index) { return x && updates[index].active === false && Number(x.curriculum_count || 0) > 0; });
    if (affected.length) {
      const names = affected.map(function (x) { return x.topic_name || x.topic_code; }).join(", ");
      if (!window.confirm(names + " is currently used by the curriculum. Existing assignments will remain, but this content will become unavailable to students. Continue?")) return;
    }
    const previous = items.map(function (x) { return Object.assign({}, x); });
    updates.forEach(function (u) { const x = items.find(function (i) { return String(i.topic_id) === String(u.topic_id); }); if (x) x.active = u.active; });
    editMode = false; saving = true; updateButtons(); render(); setSaving(true); setMessage("", "info");
    post({ action: SAVE_ACTION, topics: updates }).then(function (result) {
      if (!result || result.status !== "success") throw new Error((result && result.message) || "Could not save topic availability.");
      saving = false; setSaving(false); updateButtons();
      writeCurrentBrowserCache(result.management_versions);
      setMessage(result.message || "Topic availability updated.", "success");
    }).catch(function (error) {
      items = previous; saving = false; setSaving(false); updateButtons(); render();
      setMessage(error.message || "Could not save topic availability. The previous values were restored.", "error");
    });
  }

  function writeCurrentBrowserCache(versions) {
    if (!window.GLIPManagementCache) return;
    const data = { status: "success", topics: items.map(function (x) { return Object.assign({}, x); }), management_versions: versions || {} };
    data.subjects = subjects.map(function (x) { return Object.assign({}, x); });
    window.GLIPManagementCache.write(LIST_ACTION, data, versions && versions.topicCatalogue);
  }

  function formatUsage(count) { const n = Number(count || 0); return n ? n + (n === 1 ? " assignment" : " assignments") : "Not used"; }
  function updateButtons() {
    const edit = document.getElementById("editTopicCatalogueBtn");
    const save = document.getElementById("saveTopicCatalogueBtn");
    const cancel = document.getElementById("cancelTopicCatalogueBtn");
    if (edit) { edit.style.display = editMode ? "none" : "inline-block"; edit.disabled = saving; }
    if (save) { save.style.display = editMode ? "inline-block" : "none"; save.disabled = saving; }
    if (cancel) { cancel.style.display = editMode ? "inline-block" : "none"; cancel.disabled = saving; }
  }
  function updateSortIndicators() { document.querySelectorAll("#topicCatalogueTable th[data-sort-field]").forEach(function (h) { const f=h.dataset.sortField,l=h.dataset.label; h.textContent=f===sortField?l+(sortDirection==="asc"?" ▲":" ▼"):l+" ↕"; }); }
  function setLoading(value) { const b=document.getElementById("topicCatalogueLoading"),t=document.getElementById("topicCatalogueTable"); if(b)b.style.display=value?"block":"none"; if(t)t.style.visibility=value?"hidden":"visible"; }
  function setSaving(value) { const b=document.getElementById("topicCatalogueSaving"); if(b)b.style.display=value?"block":"none"; }
  function setMessage(text,type) { const e=document.getElementById("topicCatalogueMessage"); if(!e)return; e.textContent=text||""; e.className="panel-message teacher-message "+(type||"info"); }
  function esc(value) { return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
})();
