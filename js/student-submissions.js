(function () {
  "use strict";
  let submissions = [];
  let assignmentId = "";
  document.addEventListener("glipReady", init);
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (typeof window.getGlipWebAppUrl !== "function") return;
    assignmentId = new URLSearchParams(location.search).get("assignment") || "";
    document.getElementById("downloadSubmissionsFolderBtn")?.addEventListener("click", downloadFolder);
    const cached = window.GLIPStoragePageCache?.get("listTeacherSubmissions");
    if (cached && cached.status === "success") applyResult(cached);
    load();
    window.GLIPStoragePageCache?.preloadOthers("listTeacherSubmissions");
  }

  function load() {
    showLoading(true);
    window.GLIPStorageDownload.post({
      action: "listTeacherSubmissions",
      teacher_id: sessionStorage.getItem("glipTeacherId") || "",
      class_teacher_id: assignmentId
    }).then(function (result) {
      if (!result || result.status !== "success") throw new Error(result && result.message || "Could not load submissions.");
      window.GLIPStoragePageCache?.set("listTeacherSubmissions", result);
      applyResult(result);
    }).catch(function (error) { message(error.message, "error"); })
      .finally(function () { showLoading(false); });
  }

  function applyResult(result) {
    submissions = (result.submissions || []).filter(function (row) {
      return !assignmentId || String(row.class_teacher_id) === String(assignmentId);
    });
    const usage = document.getElementById("studentSubmissionsStorageUsage");
    if (usage && result.storage) {
      usage.textContent = "Storage used: " + (Number(result.storage.used_bytes || 0) / 1024 / 1024).toFixed(1) +
        " MB of " + (Number(result.storage.limit_bytes || 0) / 1024 / 1024).toFixed(0) + " MB";
    }
    render();
  }

  function render() {
    const body = document.getElementById("studentSubmissionsBody");
    const table = document.getElementById("studentSubmissionsTable");
    body.innerHTML = submissions.length ? submissions.map(function (row) {
      return '<tr><td>' + esc(row.class_label) + '</td><td>' + esc(row.activity_title) + '</td><td>' + esc(row.student_name) +
        '</td><td class="student-work-file">' + esc(row.file_name) + '</td><td>' + row.version + '</td><td>' + formatDate(row.submitted_at) +
        '</td><td><button class="glip-btn" type="button" data-download="' + esc(row.file_id) + '">Download</button></td></tr>';
    }).join("") : '<tr><td colspan="7" class="text-center">No submissions have been received.</td></tr>';
    table.style.visibility = "visible";
    body.querySelectorAll("[data-download]").forEach(function (button) {
      button.addEventListener("click", function () {
        message("Preparing file...", "info");
        window.GLIPStorageDownload.downloadFile(button.dataset.download)
          .then(function () { message("File downloaded.", "success"); })
          .catch(function (error) { message(error.message, "error"); });
      });
    });
  }

  function downloadFolder() {
    message("Preparing the submissions ZIP...", "info");
    window.GLIPStorageDownload.post({
      action: "downloadTeacherStorageFolder",
      teacher_id: sessionStorage.getItem("glipTeacherId") || "",
      class_teacher_id: assignmentId,
      folder_type: "submissions"
    }).then(function (result) { window.GLIPStorageDownload.downloadBase64(result); message("Folder downloaded.", "success"); })
      .catch(function (error) { message(error.message, "error"); });
  }
  function showLoading(show) { const el=document.getElementById("studentSubmissionsLoading"); if(el)el.style.display=show?"block":"none"; }
  function message(v,t){const el=document.getElementById("studentSubmissionsMessage");if(el){el.textContent=v||"";el.className="panel-message text-center "+(t||"");}}
  function formatDate(v){if(!v)return"";const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString("en-GB");}
  function esc(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
})();
