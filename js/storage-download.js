(function () {
  "use strict";

  function downloadBase64(result) {
    if (!result || result.status !== "success" || !result.base64) {
      throw new Error((result && result.message) || "The file could not be prepared.");
    }
    const binary = atob(result.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: result.mime_type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.file_name || "download";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function post(data) {
    return fetch(window.getGlipWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (response) { return response.json(); });
  }

  window.GLIPStorageDownload = Object.freeze({
    post: post,
    downloadBase64: downloadBase64,
    downloadFile: function (fileId) {
      return post({
        action: "getStoredFilePayload",
        file_id: fileId,
        student_id: sessionStorage.getItem("glipStudentId") || "",
        teacher_id: sessionStorage.getItem("glipTeacherId") || ""
      }).then(function (result) {
        downloadBase64(result);
        return result;
      });
    }
  });
})();
