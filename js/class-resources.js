(function () {
  "use strict";
  let started = false;
  let dataState = { resources: [], assignments: [], can_upload: false };

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (started || typeof window.getGlipWebAppUrl !== "function") return;
    started = true;
    document.getElementById("resourceAssignment")?.addEventListener("change", render);
    document.getElementById("uploadClassResourceBtn")?.addEventListener("click", upload);
    document.getElementById("classResourceFile")?.addEventListener("change", updateFileName);
    load();
  }

  function load() {
    loading(true);
    window.GLIPStorageDownload.post({
      action: "listMyClassResources",
      student_id: sessionStorage.getItem("glipStudentId") || "",
      teacher_id: sessionStorage.getItem("glipTeacherId") || ""
    }).then(function (result) {
      if (!result || result.status !== "success") throw new Error(result && result.message || "Could not load class resources.");
      dataState = result;
      populateAssignments();
      render();
    }).catch(function (error) { message(error.message, "error"); })
      .finally(function () { loading(false); });
  }

  function populateAssignments() {
    const select = document.getElementById("resourceAssignment");
    const panel = document.getElementById("teacherResourceUploadPanel");
    if (!select || !panel) return;
    panel.hidden = !dataState.can_upload;
    select.innerHTML = '<option value="">All teaching assignments</option>' +
      (dataState.assignments || []).map(function (item) {
        return '<option value="' + esc(item.class_teacher_id) + '">' +
          esc(formatLevel(item.level) + " – " + item.subject_name + " – " + item.class_label) + '</option>';
      }).join("");
    const query = new URLSearchParams(location.search).get("assignment") || "";
    if (query) select.value = query;
  }

  function render() {
    const body = document.getElementById("classResourcesBody");
    const table = document.getElementById("classResourcesTable");
    const assignment = document.getElementById("resourceAssignment")?.value || "";
    const rows = (dataState.resources || []).filter(function (row) {
      return !assignment || String(row.class_teacher_id) === assignment;
    });
    body.innerHTML = rows.length ? rows.map(function (row) {
      return '<tr><td>' + esc(formatLevel(row.level)) + '</td><td>' + esc(row.subject_name) +
        '</td><td>' + esc(row.class_label) + '</td><td>' + esc(row.file_name) +
        '</td><td>' + formatBytes(row.file_size_bytes) + '</td><td><button class="glip-btn" type="button" data-download="' + esc(row.file_id) + '">Download</button>' +
        (dataState.can_upload ? ' <button class="glip-btn glip-btn-danger" type="button" data-delete="' + esc(row.resource_id) + '">Delete</button>' : '') + '</td></tr>';
    }).join("") : '<tr><td colspan="6" class="text-center">No class resources are currently available.</td></tr>';
    table.style.visibility = "visible";
    body.querySelectorAll("[data-download]").forEach(function (button) {
      button.addEventListener("click", function () {
        message("Preparing file...", "info");
        window.GLIPStorageDownload.downloadFile(button.dataset.download)
          .then(function () { message("File downloaded.", "success"); })
          .catch(function (error) { message(error.message, "error"); });
      });
    });
    body.querySelectorAll("[data-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (!confirm("Delete this class resource?")) return;
        window.GLIPStorageDownload.post({ action: "deleteClassResource", teacher_id: sessionStorage.getItem("glipTeacherId") || "", resource_id: button.dataset.delete })
          .then(function (result) { if (!result || result.status !== "success") throw new Error(result && result.message); message(result.message, "success"); load(); })
          .catch(function (error) { message(error.message, "error"); });
      });
    });
  }

  async function upload() {
    const assignment = document.getElementById("resourceAssignment")?.value || "";
    const input = document.getElementById("classResourceFile");
    const file = input && input.files ? input.files[0] : null;
    if (!assignment) { message("Select one teaching assignment before uploading.", "error"); return; }
    if (!file) { message("Choose a file before uploading.", "error"); return; }
    if (file.size > 10 * 1024 * 1024) { message("The file is too large. The maximum size is 10 MB.", "error"); return; }
    const button = document.getElementById("uploadClassResourceBtn");
    button.disabled = true; button.textContent = "Uploading...";
    try {
      const result = await window.GLIPStorageDownload.post({
        action: "uploadClassResource",
        teacher_id: sessionStorage.getItem("glipTeacherId") || "",
        class_teacher_id: assignment,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || "application/octet-stream",
        file_base64: await toBase64(file)
      });
      if (!result || result.status !== "success") throw new Error(result && result.message || "Upload failed.");
      message(result.message, "success");
      input.value = "";
      setFileNameStatus("Uploaded file:", result.file_name || file.name);
      await load();
    } catch (error) { message(error.message, "error"); }
    finally { button.disabled = false; button.textContent = "Upload resource"; }
  }

  function toBase64(file) { return new Promise(function (resolve, reject) { const reader = new FileReader(); reader.onload = function () { resolve(String(reader.result).split(",")[1] || ""); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
  function updateFileName() {
    const file = document.getElementById("classResourceFile")?.files?.[0];
    setFileNameStatus("Selected file:", file ? file.name : "No file selected");
  }

  function setFileNameStatus(label, fileName) {
    const labelEl = document.getElementById("classResourceFileLabel");
    const nameEl = document.getElementById("classResourceFileName");
    if (labelEl) labelEl.textContent = label || "Selected file:";
    if (nameEl) nameEl.textContent = fileName || "No file selected";
  }
  function loading(show) { const el = document.getElementById("classResourcesLoading"); if (el) el.style.display = show ? "block" : "none"; }
  function message(value, type) { const el = document.getElementById("classResourcesMessage"); if (el) { el.textContent = value || ""; el.className = "panel-message text-center " + (type || ""); } }
  function formatLevel(v) { const m = String(v || "").match(/\d+/); return m ? "Level " + Number(m[0]) : String(v || ""); }
  function formatBytes(v) { const n=Number(v||0); return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(1)+" MB"; }
  function esc(v) { return String(v || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
})();
