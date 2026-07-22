(function () {
  "use strict";

  const LIST_ACTION = "listSubjectCatalogueOwner";
  const SAVE_ACTION = "saveSubjectCatalogueOwner";
  let items = [];
  let editMode = false;
  let saving = false;
  let sortField = "subject";
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
    document.getElementById("editSubjectCatalogueBtn")?.addEventListener("click", enterEditMode);
    document.getElementById("saveSubjectCatalogueBtn")?.addEventListener("click", saveChanges);
    document.getElementById("cancelSubjectCatalogueBtn")?.addEventListener("click", cancelEditMode);
    document.querySelectorAll("#subjectCatalogueTable th[data-sort-field]").forEach(function (header) {
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
      if (!result || result.status !== "success") throw new Error((result && result.message) || "Could not load the subject catalogue.");
      install(result); setLoading(false);
    }).catch(function (error) { setLoading(false); setMessage(error.message || "Could not load the subject catalogue.", "error"); });
  }

  function loadFromBrowserCache() {
    const cached = window.GLIPManagementCache && window.GLIPManagementCache.read(LIST_ACTION, true);
    if (cached && cached.status === "success") install(cached);
  }

  function install(result) {
    items = Array.isArray(result.subjects) ? result.subjects.map(function (x) { return Object.assign({}, x); }) : [];
    editMode = false; updateButtons(); updateSortIndicators(); render();
  }

  function visibleItems() { return items; }

  function render() {
    const body = document.getElementById("subjectCatalogueTableBody");
    const table = document.getElementById("subjectCatalogueTable");
    if (!body || !table) return;
    const rows = visibleItems().slice().sort(compareItems);
    if (!rows.length) { body.innerHTML = '<tr><td colspan="4">No subjects were found.</td></tr>'; table.style.visibility = "visible"; return; }
    body.innerHTML = rows.map(function (item) {
      const usage = formatUsage(item.curriculum_count);
      const title = esc((item.used_by_levels || []).join("; "));
      const status = item.active ? "Active" : "Inactive";
      const statusCell = editMode
        ? '<select class="tracker-input" data-catalogue-id="' + esc(item.subject_id) + '" data-original="' + (item.active ? 'true' : 'false') + '"><option value="true" ' + (item.active ? 'selected' : '') + '>Active</option><option value="false" ' + (!item.active ? 'selected' : '') + '>Inactive</option></select>'
        : esc(status);
      return '<tr data-row-id="' + esc(item.subject_id) + '"><td>' + esc(item.subject_name || item.subject_code) + '</td><td>' + esc(item.subject_code) + '</td><td title="' + title + '">' + esc(usage) + '</td><td>' + statusCell + '</td></tr>';
    }).join("");
    body.querySelectorAll("[data-catalogue-id]").forEach(function (field) {
      field.addEventListener("change", function () { field.classList.toggle("teacher-field-changed", field.value !== field.dataset.original); setMessage("", "info"); });
    });
    table.style.visibility = "visible";
  }

  function compareItems(a, b) {
    let av, bv;
    if (sortField === "subject") { av = String(a.subject_name || a.subject_code).toLowerCase(); bv = String(b.subject_name || b.subject_code).toLowerCase(); }
    else if (sortField === "code") { av = String(a.subject_code).toLowerCase(); bv = String(b.subject_code).toLowerCase(); }
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
      if (field.value !== field.dataset.original) updates.push({ subject_id: field.dataset.catalogueId, active: field.value === "true" });
    });
    if (!updates.length) { setMessage("No changes to save.", "info"); return; }
    const affected = updates.map(function (u) { return items.find(function (x) { return String(x.subject_id) === String(u.subject_id); }); })
      .filter(function (x, index) { return x && updates[index].active === false && Number(x.curriculum_count || 0) > 0; });
    if (affected.length) {
      const names = affected.map(function (x) { return x.subject_name || x.subject_code; }).join(", ");
      const warningText = affected.length === 1
        ? names + " is currently used by the curriculum."
        : names + " are currently used by the curriculum.";
      
      if (!window.confirm(
        warningText +
        " Existing assignments will remain, but this content will become unavailable to students. Continue?"
      )) {
        return;
      }
    }
    const previous = items.map(function (x) { return Object.assign({}, x); });
    updates.forEach(function (u) { const x = items.find(function (i) { return String(i.subject_id) === String(u.subject_id); }); if (x) x.active = u.active; });
editMode = false;
saving = true;
updateButtons();
render();

setMessage(
  "Subject availability updated. Saving in the background...",
  "success"
);

post({
  action: SAVE_ACTION,
  subjects: updates
}).then(function (result) {
  if (!result || result.status !== "success") {
    throw new Error(
      (result && result.message) ||
      "Could not save subject availability."
    );
  }

  saving = false;
  updateButtons();

  writeCurrentBrowserCache(result.management_versions);

  setMessage(
    result.message || "Subject availability updated.",
    "success"
  );
}).catch(function (error) {
  items = previous;
  saving = false;
  updateButtons();
  render();

  setMessage(
    error.message ||
    "Could not save subject availability. The previous values were restored.",
    "error"
  );
        });
      }

  function writeCurrentBrowserCache(versions) {
    if (!window.GLIPManagementCache) return;
    const data = { status: "success", subjects: items.map(function (x) { return Object.assign({}, x); }), management_versions: versions || {} };
    window.GLIPManagementCache.write(LIST_ACTION, data, versions && versions.subjectCatalogue);
  }

  function formatUsage(count) { const n = Number(count || 0); return n ? n + (n === 1 ? " assignment" : " assignments") : "Not used"; }
  function updateButtons() {
    const edit = document.getElementById("editSubjectCatalogueBtn");
    const save = document.getElementById("saveSubjectCatalogueBtn");
    const cancel = document.getElementById("cancelSubjectCatalogueBtn");
    if (edit) { edit.style.display = editMode ? "none" : "inline-block"; edit.disabled = saving; }
    if (save) { save.style.display = editMode ? "inline-block" : "none"; save.disabled = saving; }
    if (cancel) { cancel.style.display = editMode ? "inline-block" : "none"; cancel.disabled = saving; }
  }
  function updateSortIndicators() { document.querySelectorAll("#subjectCatalogueTable th[data-sort-field]").forEach(function (h) { const f=h.dataset.sortField,l=h.dataset.label; h.textContent=f===sortField?l+(sortDirection==="asc"?" ▲":" ▼"):l+" ↕"; }); }
  function setLoading(value) { const b=document.getElementById("subjectCatalogueLoading"),t=document.getElementById("subjectCatalogueTable"); if(b)b.style.display=value?"block":"none"; if(t)t.style.visibility=value?"hidden":"visible"; }
  function setMessage(text,type) { const e=document.getElementById("subjectCatalogueMessage"); if(!e)return; e.textContent=text||""; e.className="panel-message teacher-message "+(type||"info"); }
  function esc(value) { return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
})();
