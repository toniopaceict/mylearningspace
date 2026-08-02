(function () {
  "use strict";
  let started = false;
  let dataState = { resources: [], assignments: [], can_upload: false, storage: null };

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (started || typeof window.getGlipWebAppUrl !== "function") return;
    started = true;
    document.getElementById("uploadClassResourceBtn")?.addEventListener("click", upload);
    document.getElementById("classResourceFile")?.addEventListener("change", updateFileName);
    document.getElementById("selectAllResourceAssignments")?.addEventListener("click", function () { setAllAssignments(true); });
    document.getElementById("clearResourceAssignments")?.addEventListener("click", function () { setAllAssignments(false); });
    document.getElementById("classResourceSearch")?.addEventListener("input", render);
    document.getElementById("classResourceFilter")?.addEventListener("change", render);
    document.getElementById("clearClassResourceFilters")?.addEventListener("click", clearFilters);

    const cached = window.GLIPStoragePageCache?.get("listMyClassResources");
    if (cached) applyResult(cached, false);
    load(true);
    window.GLIPStoragePageCache?.preloadOthers("listMyClassResources");
  }

  function load(showSpinner) {
    if (showSpinner && !dataState.resources.length) loading(true);
    return window.GLIPStorageDownload.post({
      action: "listMyClassResources",
      student_id: sessionStorage.getItem("glipStudentId") || "",
      teacher_id: sessionStorage.getItem("glipTeacherId") || ""
    }).then(function (result) {
      if (!result || result.status !== "success") throw new Error(result && result.message || "Could not load resources.");
      window.GLIPStoragePageCache?.set("listMyClassResources", result);
      applyResult(result, true);
      return result;
    }).catch(function (error) { tableMessage(error.message, "error"); })
      .finally(function () { loading(false); });
  }

  function applyResult(result) {
    dataState = result;
    populateAssignments();
    populateFilter();
    renderUsage(result.storage || {});
    render();
  }

  function populateAssignments() {
    const list = document.getElementById("resourceAssignmentList");
    const panel = document.getElementById("teacherResourceUploadPanel");
    if (!list || !panel) return;
    panel.hidden = !dataState.can_upload;
    const query = new URLSearchParams(location.search).get("assignment") || "";
    list.innerHTML = (dataState.assignments || []).map(function (item) {
      const checked = query && String(item.class_teacher_id) === query ? " checked" : "";
      return '<label class="resource-assignment-option"><input type="checkbox" value="' + esc(item.class_teacher_id) + '"' + checked + '>' +
        '<span>' + esc(formatLevel(item.level) + " – " + item.class_label + " – " + item.subject_name) + '</span></label>';
    }).join("") || '<p class="meta">No active teaching assignments are available.</p>';
  }

  function populateFilter() {
    const select = document.getElementById("classResourceFilter");
    if (!select) return;
    const current = select.value;
    const options = {};
    (dataState.resources || []).forEach(function (row) {
      options[String(row.class_teacher_id)] = formatLevel(row.level) + " – " + row.class_label + " – " + row.subject_name;
    });
    select.innerHTML = '<option value="">All classes</option>' + Object.keys(options).sort(function (a, b) {
      return options[a].localeCompare(options[b], "en-GB");
    }).map(function (id) { return '<option value="' + esc(id) + '">' + esc(options[id]) + '</option>'; }).join("");
    if (options[current]) select.value = current;
  }

  function renderUsage(storage) {
    const el = document.getElementById("classResourcesStorageUsage");
    if (!el || !storage) return;
    el.textContent = "Storage used: " + formatMegabytes(storage.used_bytes) + " MB of " + formatMegabytes(storage.limit_bytes, 0) + " MB";
  }

  function render() {
    const body = document.getElementById("classResourcesBody");
    const table = document.getElementById("classResourcesTable");
    if (!body || !table) return;
    const query = String(document.getElementById("classResourceSearch")?.value || "").trim().toLowerCase();
    const assignment = document.getElementById("classResourceFilter")?.value || "";
    const rows = (dataState.resources || []).filter(function (row) {
      if (assignment && String(row.class_teacher_id) !== assignment) return false;
      if (!query) return true;
      return [row.file_name, row.subject_name, row.class_label, formatLevel(row.level)].some(function (value) {
        return String(value || "").toLowerCase().includes(query);
      });
    });

    body.innerHTML = rows.length ? rows.map(function (row) {
      return '<tr><td>' + esc(formatLevel(row.level)) + '</td><td>' + esc(row.subject_name) +
        '</td><td>' + esc(row.class_label) + '</td><td class="resource-file-cell">' + esc(row.file_name) +
        '</td><td><div class="resource-actions"><button class="glip-btn" type="button" data-download="' + esc(row.file_id) + '" title="Download">Download</button>' +
        (dataState.can_upload ? '<button class="glip-btn glip-btn-danger" type="button" data-delete="' + esc(row.resource_id) + '" data-name="' + esc(row.file_name) + '" title="Delete">Delete</button>' : '') + '</div></td></tr>';
    }).join("") : '<tr><td colspan="5" class="text-center">No resources match the current selection.</td></tr>';
    table.style.visibility = "visible";

    body.querySelectorAll("[data-download]").forEach(function (button) {
      button.addEventListener("click", function () {
        tableMessage("Preparing file...", "info");
        window.GLIPStorageDownload.downloadFile(button.dataset.download)
          .then(function () { tableMessage("File downloaded.", "success"); })
          .catch(function (error) { tableMessage(error.message, "error"); });
      });
    });
    body.querySelectorAll("[data-delete]").forEach(function (button) {
      button.addEventListener("click", function () { confirmDelete(button); });
    });
  }

  function confirmDelete(button) {
    const performDelete = function () {
      tableMessage("Deleting resource...", "info");
      window.GLIPStorageDownload.post({
        action: "deleteClassResource",
        teacher_id: sessionStorage.getItem("glipTeacherId") || "",
        resource_id: button.dataset.delete
      }).then(function (result) {
        if (!result || result.status !== "success") throw new Error(result && result.message || "Could not delete the resource.");
        tableMessage(result.message, "success");
        window.GLIPStoragePageCache?.clear();
        return load(false);
      }).then(function () { window.GLIPStoragePageCache?.preloadOthers("listMyClassResources"); })
        .catch(function (error) { tableMessage(error.message, "error"); });
    };

    if (typeof window.showGlipConfirmModal === "function") {
      window.showGlipConfirmModal({
        title: "Delete resource",
        bodyHtml: "<p>Delete <strong>" + esc(button.dataset.name) + "</strong>?</p><p>This file will no longer be available to students.</p>",
        noConfirmationInput: true,
        dangerous: true,
        extraButtonText: "Delete",
        extraButtonAction: performDelete
      });
      return;
    }
    performDelete();
  }

  async function upload() {
    const assignmentIds = Array.from(document.querySelectorAll("#resourceAssignmentList input[type=checkbox]:checked"))
      .map(function (input) { return input.value; });
    const input = document.getElementById("classResourceFile");
    const file = input && input.files ? input.files[0] : null;
    if (!assignmentIds.length) { uploadMessage("Select at least one class before uploading.", "error"); return; }
    if (!file) { uploadMessage("Choose a file before uploading.", "error"); return; }
    if (file.size > 10 * 1024 * 1024) { uploadMessage("The file is too large. The maximum size is 10 MB.", "error"); return; }

    const button = document.getElementById("uploadClassResourceBtn");
    setUploading(true);
    try {
      const result = await window.GLIPStorageDownload.post({
        action: "uploadClassResources",
        teacher_id: sessionStorage.getItem("glipTeacherId") || "",
        class_teacher_ids: assignmentIds,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        file_base64: await toBase64(file)
      });
      if (!result || result.status !== "success") throw new Error(result && result.message || "Upload failed.");
      uploadMessage(result.message, "success");
      input.value = "";
      setFileNameStatus("Uploaded file:", result.file_name || file.name);
      window.GLIPStoragePageCache?.clear();
      await load(false);
      window.GLIPStoragePageCache?.preloadOthers("listMyClassResources");
    } catch (error) {
      uploadMessage(error.message, "error");
    } finally {
      setUploading(false);
    }
  }

  function setUploading(isUploading) {
    const button = document.getElementById("uploadClassResourceBtn");
    const progress = document.getElementById("classResourceUploadProgress");
    if (button) { button.disabled = isUploading; button.textContent = isUploading ? "Uploading..." : "Upload resource"; }
    if (progress) progress.classList.toggle("show", isUploading);
  }

  function setAllAssignments(checked) {
    document.querySelectorAll("#resourceAssignmentList input[type=checkbox]").forEach(function (input) { input.checked = checked; });
  }

  function clearFilters() {
    const search = document.getElementById("classResourceSearch");
    const filter = document.getElementById("classResourceFilter");
    if (search) search.value = "";
    if (filter) filter.value = "";
    render();
  }

  function toBase64(file) { return new Promise(function (resolve, reject) { const reader = new FileReader(); reader.onload = function () { resolve(String(reader.result).split(",")[1] || ""); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
  function updateFileName() { const file = document.getElementById("classResourceFile")?.files?.[0]; setFileNameStatus("Selected file:", file ? file.name : "No file selected"); }
  function setFileNameStatus(label, fileName) { const labelEl = document.getElementById("classResourceFileLabel"); const nameEl = document.getElementById("classResourceFileName"); if (labelEl) labelEl.textContent = label || "Selected file:"; if (nameEl) nameEl.textContent = fileName || "No file selected"; }
  function loading(show) { const el = document.getElementById("classResourcesLoading"); if (el) el.style.display = show ? "block" : "none"; }
  function uploadMessage(value, type) { const el = document.getElementById("classResourceUploadMessage"); if (el) { el.textContent = value || ""; el.className = "panel-message text-center " + (type || ""); } }
  function tableMessage(value, type) { const el = document.getElementById("classResourcesMessage"); if (el) { el.textContent = value || ""; el.className = "panel-message text-center " + (type || ""); } }
  function formatLevel(v) { const m = String(v || "").match(/\d+/); return m ? "Level " + Number(m[0]) : String(v || ""); }
  function formatMegabytes(bytes, decimals) { const n = Number(bytes || 0) / 1024 / 1024; return n.toFixed(decimals == null ? 1 : decimals); }
  function esc(v) { return String(v || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
})();
