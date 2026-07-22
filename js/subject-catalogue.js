(function () {
  "use strict";

  let subjects = [];
  let originalActive = {};
  let sortField = "subject";
  let sortDirection = "asc";
  let initialised = false;

  function post(data) {
    data.owner_teacher_id = sessionStorage.getItem("glipTeacherId");
    data.teacher_id = sessionStorage.getItem("glipTeacherId");
    data.role = sessionStorage.getItem("glipUserType");
    return fetch(window.getGlipWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (response) { return response.json(); });
  }

  function init() {
    if (initialised || typeof isOwner !== "function") return;
    initialised = true;
    if (!isOwner()) return;

    document.getElementById("saveSubjectCatalogueBtn")?.addEventListener("click", save);
    document.querySelectorAll("#subjectCatalogueTable th[data-sort-field]").forEach(function (header) {
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
    setMessage("", "info");
    post({ action: "listSubjectCatalogueOwner" })
      .then(function (result) {
        if (!result || result.status !== "success") throw new Error((result && result.message) || "Could not load the subject catalogue.");
        subjects = Array.isArray(result.subjects) ? result.subjects : [];
        rememberOriginalValues();
        updateSortIndicators();
        render();
        setLoading(false);
      })
      .catch(function (error) {
        setLoading(false);
        setMessage(error.message || "Could not load the subject catalogue.", "error");
      });
  }

  function rememberOriginalValues() {
    originalActive = {};
    subjects.forEach(function (item) { originalActive[String(item.subject_id)] = item.active === true; });
  }

  function render() {
    const body = document.getElementById("subjectCatalogueTableBody");
    const table = document.getElementById("subjectCatalogueTable");
    if (!body || !table) return;

    const sorted = subjects.slice().sort(compareItems);
    if (!sorted.length) {
      body.innerHTML = '<tr><td colspan="4">No subjects were found in the Subjects sheet.</td></tr>';
      table.style.visibility = "visible";
      return;
    }

    body.innerHTML = sorted.map(function (item) {
      const usageText = formatUsage(item.curriculum_count, item.used_by_levels, "level", "levels");
      const usageTitle = Array.isArray(item.used_by_levels) ? item.used_by_levels.join("; ") : "";
      return '<tr data-subject-id="' + esc(item.subject_id) + '">' +
        '<td>' + esc(item.subject_name || item.subject_code) + '</td>' +
        '<td>' + esc(item.subject_code) + '</td>' +
        '<td title="' + esc(usageTitle) + '">' + esc(usageText) + '</td>' +
        '<td><label><input type="checkbox" data-subject-active="' + esc(item.subject_id) + '" ' + (item.active ? "checked" : "") + '> ' + (item.active ? "Active" : "Not active") + '</label></td>' +
        '</tr>';
    }).join("");

    body.querySelectorAll("[data-subject-active]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        const item = subjects.find(function (subject) { return String(subject.subject_id) === String(checkbox.dataset.subjectActive); });
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
    if (sortField === "subject") { av = String(a.subject_name || a.subject_code).toLowerCase(); bv = String(b.subject_name || b.subject_code).toLowerCase(); }
    else if (sortField === "code") { av = String(a.subject_code).toLowerCase(); bv = String(b.subject_code).toLowerCase(); }
    else if (sortField === "usage") { av = Number(a.curriculum_count || 0); bv = Number(b.curriculum_count || 0); }
    else { av = a.active ? 1 : 0; bv = b.active ? 1 : 0; }
    if (av < bv) return sortDirection === "asc" ? -1 : 1;
    if (av > bv) return sortDirection === "asc" ? 1 : -1;
    return 0;
  }

  function save() {
    const changed = subjects.filter(function (item) {
      return originalActive[String(item.subject_id)] !== (item.active === true);
    });

    if (!changed.length) {
      setMessage("No changes to save.", "info");
      return;
    }

    const affected = changed.filter(function (item) { return !item.active && Number(item.curriculum_count || 0) > 0; });
    if (affected.length) {
      const names = affected.map(function (item) { return item.subject_name || item.subject_code; }).join(", ");
      if (!window.confirm(names + " is currently used by the curriculum. Deactivating it will make it unavailable to students, although its existing assignments will remain in Google Sheets. Continue?")) {
        return;
      }
    }

    setSaving(true);
    post({
      action: "saveSubjectCatalogueOwner",
      subjects: changed.map(function (item) { return { subject_id: item.subject_id, active: item.active }; })
    }).then(function (result) {
      if (!result || result.status !== "success") throw new Error((result && result.message) || "Could not save subject availability.");
      rememberOriginalValues();
      setSaving(false);
      setMessage(result.message || "Subject availability updated.", "success");
    }).catch(function (error) {
      setSaving(false);
      setMessage(error.message || "Could not save subject availability.", "error");
      load();
    });
  }

  function formatUsage(count, labels, singular, plural) {
    const n = Number(count || 0);
    if (!n) return "Not used";
    return n + " " + (n === 1 ? singular : plural);
  }

  function updateSortIndicators() {
    document.querySelectorAll("#subjectCatalogueTable th[data-sort-field]").forEach(function (header) {
      const field = header.dataset.sortField;
      const label = header.dataset.label;
      header.textContent = field === sortField ? label + (sortDirection === "asc" ? " ▲" : " ▼") : label + " ↕";
    });
  }

  function setLoading(value) {
    const box = document.getElementById("subjectCatalogueLoading");
    const table = document.getElementById("subjectCatalogueTable");
    if (box) box.style.display = value ? "block" : "none";
    if (table) table.style.visibility = value ? "hidden" : "visible";
  }

  function setSaving(value) {
    const button = document.getElementById("saveSubjectCatalogueBtn");
    if (!button) return;
    button.disabled = value;
    button.textContent = value ? "Saving..." : "Save Changes";
  }

  function setMessage(text, type) {
    const el = document.getElementById("subjectCatalogueMessage");
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
