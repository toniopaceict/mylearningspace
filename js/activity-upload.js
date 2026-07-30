(function () {
  "use strict";

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function getConfig() {
    return window.PAGE_CONFIG || {};
  }

  function ensureSection() {
    let section = document.getElementById("glipActivitySubmission");
    if (section) return section;

    section = document.createElement("section");
    section.id = "glipActivitySubmission";
    section.className = "task-box panel-box";
    section.hidden = true;
    section.innerHTML =
      '<h2>Submit your work</h2>' +
      '<p>Choose the completed file you want to send to your teacher.</p>' +
      '<div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">' +
      '<input id="glipSubmissionFile" class="tracker-input" type="file">' +
      '<button id="glipSubmissionButton" class="glip-btn" type="button">Submit file</button>' +
      '</div>' +
      '<p id="glipSubmissionMessage" class="panel-message" role="status" aria-live="polite"></p>';

    const footer = document.getElementById("siteFooter");
    if (footer && footer.parentElement) {
      footer.parentElement.insertBefore(section, footer);
    } else {
      document.body.appendChild(section);
    }

    return section;
  }

  function setMessage(message, type) {
    const element = document.getElementById("glipSubmissionMessage");
    if (!element) return;
    element.textContent = message || "";
    element.className = "panel-message" + (type ? " " + type : "");
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || "").split(",")[1] || "");
      };
      reader.onerror = function () {
        reject(new Error("The file could not be read."));
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadFile() {
    const config = getConfig();
    const fileInput = document.getElementById("glipSubmissionFile");
    const button = document.getElementById("glipSubmissionButton");
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    const student = {
      student_id: text(sessionStorage.getItem("glipStudentId")),
      student_name: text(sessionStorage.getItem("glipStudentName")),
      class_id: text(sessionStorage.getItem("glipClassId"))
    };

    if (!student.student_id || !student.class_id) {
      setMessage("Student details could not be found. Please log in again.", "error");
      return;
    }

    if (!file) {
      setMessage("Choose a file before submitting.", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("The file is too large. The maximum size is 10 MB.", "error");
      return;
    }

    if (!config.activityId || !config.subjectId || !config.topicId || !config.level) {
      setMessage("The activity information is still loading. Please try again.", "error");
      return;
    }

    button.disabled = true;
    setMessage("Uploading your file...", "info");

    try {
      const response = await fetch(config.webAppUrl || window.getGlipWebAppUrl(), {
        method: "POST",
        body: JSON.stringify({
          action: "uploadFile",
          student_id: student.student_id,
          student_name: student.student_name,
          class_id: student.class_id,
          level: config.level,
          subject_id: config.subjectId,
          topic_id: config.topicId,
          activity_id: config.activityId,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_base64: await fileToBase64(file)
        })
      });

      const result = await response.json();
      if (!result || result.status !== "success") {
        throw new Error((result && result.message) || "The file could not be uploaded.");
      }

      setMessage("File submitted successfully.", "success");
      window.dispatchEvent(new CustomEvent("glipActivitySubmitted", {
        detail: { activityId: config.activityId }
      }));
    } catch (error) {
      setMessage(error.message || "The file could not be uploaded.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function refresh() {
    const config = getConfig();
    const section = ensureSection();
    const legacyButton = document.getElementById("uploadPracticeBtn");
    const legacyPanel = legacyButton && legacyButton.closest(".task-box, .panel-box, section");
    if (legacyPanel && legacyPanel !== section) legacyPanel.hidden = true;

    section.hidden = !(
      config.pageKind !== "topic-home" &&
      config.requiresSubmission === true
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureSection();
    const button = document.getElementById("glipSubmissionButton");
    if (button) button.addEventListener("click", uploadFile);
    refresh();
  });

  document.addEventListener("glipTopicContextRefreshed", refresh);
  document.addEventListener("glipReady", refresh);
})();