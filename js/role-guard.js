/* =========================================================
   GLIP ROLE GUARD
   Page access control by role or group
   ========================================================= */

function getSchoolLoginUrl() {
  const storedSchool = String(
    sessionStorage.getItem("glipSchool") || ""
  ).trim();

  if (storedSchool) {
    return "/mylearningspace/schools/" +
      encodeURIComponent(storedSchool) +
      "/index.html";
  }

  const match = window.location.pathname.match(/\/schools\/([^/]+)\//i);
  const school = match ? String(match[1] || "").trim() : "";

  if (school && school !== "management") {
    return "/mylearningspace/schools/" +
      encodeURIComponent(school) +
      "/index.html";
  }

  return "";
}

function showMissingSchoolMessage() {
  document.body.innerHTML = `
    <div style="
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 70px 20px;
      color: #0b3c6f;
    ">
      <h2>School not identified</h2>
      <p>Please open GLIP from your school's login page.</p>
    </div>
  `;
}

function redirectToSchoolLogin() {
  const loginUrl = getSchoolLoginUrl();

  if (!loginUrl) {
    showMissingSchoolMessage();
    return;
  }

  window.location.replace(loginUrl);
}

function requireRole(...allowedRoles) {
  const role = getCurrentRole();

  if (!allowedRoles.includes(role)) {
    redirectToSchoolLogin();
    return false;
  }

  return true;
}

function requireGroup(...allowedGroups) {
  const group = getCurrentGroup();

  if (!allowedGroups.includes(group)) {
    redirectToSchoolLogin();
    return false;
  }

  return true;
}
