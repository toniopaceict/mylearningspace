(function () {
  "use strict";
  let started = false;
  let assignments = [];

  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (started || typeof window.getGlipWebAppUrl !== "function") return;
    if (typeof isTeachingStaff === "function" && !isTeachingStaff()) return;
    started = true;
    document.getElementById("downloadAllStorageBtn")?.addEventListener("click", function () {
      downloadFolder("", "all");
    });
    const cached = window.GLIPStoragePageCache?.get("getTeacherStorageDashboard");
    if (cached && cached.status === "success") {
      assignments = cached.assignments || [];
      renderUsage(cached.storage || {});
      render();
    }
    load();
    window.GLIPStoragePageCache?.preloadOthers("getTeacherStorageDashboard");
  }

  function post(data) {
    return window.GLIPStorageDownload.post(data);
  }

  function load() {
    showLoading(true);
    post({
      action: "getTeacherStorageDashboard",
      teacher_id: sessionStorage.getItem("glipTeacherId") || ""
    }).then(function (result) {
      if (!result || result.status !== "success") throw new Error(result && result.message || "Could not load GLIP storage.");
      window.GLIPStoragePageCache?.set("getTeacherStorageDashboard", result);
      assignments = result.assignments || [];
      renderUsage(result.storage || {});
      render();
    }).catch(function (error) {
      message(error.message, "error");
    }).finally(function () { showLoading(false); });
  }

  function renderUsage(storage) {
    const el = document.getElementById("teacherStorageUsage");
    if (!el) return;
    const used = Number(storage.used_mb || 0).toFixed(1);
    const limit = Number(storage.limit_mb || 500).toFixed(0);
    el.textContent = "Storage used: " + used + " MB of " + limit + " MB";
  }

  function render() {
    const body = document.getElementById("workFoldersTableBody");
    const table = document.getElementById("workFoldersTable");
    if (!body || !table) return;
    body.innerHTML = assignments.length ? assignments.map(function (item) {
      return '<tr>' +
        '<td>' + esc(formatLevel(item.level)) + '</td>' +
        '<td>' + esc(item.subject_name) + '</td>' +
        '<td>' + esc(item.class_label) + '</td>' +
        '<td>' + (item.storage_ready ? 'Ready' : 'Preparing') + '</td>' +
        '<td><div class="tracker-row" style="justify-content:flex-start">' +
          '<a class="glip-btn" href="class-resources.html?assignment=' + encodeURIComponent(item.class_teacher_id) + '">Resources</a>' +
          '<a class="glip-btn" href="student-submissions.html?assignment=' + encodeURIComponent(item.class_teacher_id) + '">Student Work</a>' +
          '<button class="glip-btn glip-btn-secondary" type="button" data-download-assignment="' + esc(item.class_teacher_id) + '">Download folder</button>' +
        '</div></td></tr>';
    }).join("") : '<tr><td colspan="5" class="text-center">No active teaching assignments were found.</td></tr>';
    table.style.visibility = "visible";
    body.querySelectorAll("[data-download-assignment]").forEach(function (button) {
      button.addEventListener("click", function () { downloadFolder(button.dataset.downloadAssignment, "all"); });
    });
  }

  function downloadFolder(assignmentId, folderType) {
    message("Preparing the ZIP file. Please wait...", "info");
    post({
      action: "downloadTeacherStorageFolder",
      teacher_id: sessionStorage.getItem("glipTeacherId") || "",
      class_teacher_id: assignmentId,
      folder_type: folderType
    }).then(function (result) {
      window.GLIPStorageDownload.downloadBase64(result);
      message("Folder downloaded.", "success");
    }).catch(function (error) { message(error.message, "error"); });
  }

  function showLoading(show) {
    const el = document.getElementById("workFoldersLoading");
    if (el) el.style.display = show ? "block" : "none";
  }
  function message(value, type) {
    const el = document.getElementById("workFoldersMessage");
    if (el) { el.textContent = value || ""; el.className = "panel-message text-center " + (type || ""); }
  }
  function formatLevel(value) { const match = String(value || "").match(/\d+/); return match ? "Level " + Number(match[0]) : String(value || ""); }
  function esc(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
})();
