(function () {
  "use strict";

  let rows = [];
  let sessions = [];
  let sortField = "timestamp";
  let sortDirection = "desc";
  const expandedSessions = {};

  document.addEventListener("glipReady", init);

  function post(data) {
    return fetch(window.getGlipWebAppUrl(), {
      method: "POST",
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json();
    });
  }

  function adminId() {
    return sessionStorage.getItem("glipTeacherId") || "";
  }

  function value(id) {
    return document.getElementById(id).value;
  }

  function init() {
    if (!window.isAdmin || !isAdmin()) return;

    document.getElementById("applyPerfFilters").onclick = load;
    document.getElementById("resetPerfFilters").onclick = reset;
    document.getElementById("clearPerformanceLog").onclick = clearLog;

    document.querySelectorAll("#performanceTable th[data-field]").forEach(function (th) {
      th.onclick = function () {
        const field = th.dataset.field;
        if (sortField === field) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          sortDirection = "asc";
        }
        renderRows();
      };
    });

    load();
  }

  function payload() {
    return {
      action: "getPerformanceMonitorData",
      admin_teacher_id: adminId(),
      date_from: value("perfDateFrom"),
      date_to: value("perfDateTo"),
      school_id: value("perfSchool"),
      filter_action: value("perfAction"),
      filter_role: value("perfRole"),
      cache_result: value("perfCache"),
      filter_status: value("perfStatus"),
      session_id: value("perfSession"),
      page_name: value("perfPage"),
      request_initiator: value("perfInitiator"),
      target_dataset: value("perfTarget"),
      minimum_duration: value("perfMin"),
      search: value("perfSearch"),
      limit: 1000
    };
  }

  async function load() {
    message("Loading performance information...");

    try {
      const result = await post(payload());
      if (!result || result.status !== "success") {
        message((result && result.message) || "Unable to load performance information.", true);
        return;
      }

      rows = result.rows || [];
      sessions = (result.summary && result.summary.sessions) || [];
      fillFilters(result.filters || {});
      renderSummary(result.summary || {});
      renderSessionExplorer();
      renderRows();
      document.getElementById("retentionText").textContent =
        "Logs are retained for " + result.retention.days + " days, up to " +
        Number(result.retention.maximum_rows).toLocaleString() + " rows per school.";
      message("Showing " + rows.length + " of " + result.total_rows + " matching records.");
    } catch (error) {
      message("Unable to load performance information: " + (error.message || error), true);
    }
  }

  function fillFilters(filters) {
    fill("perfSchool", filters.schools);
    fill("perfAction", filters.actions);
    fill("perfRole", filters.roles);
    fill("perfSession", filters.sessions);
    fill("perfPage", filters.pages);
    fill("perfInitiator", filters.initiators);
    fill("perfTarget", filters.targets);
  }

  function fill(id, items) {
    const element = document.getElementById(id);
    const current = element.value;
    while (element.options.length > 1) element.remove(1);
    (items || []).forEach(function (item) {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      element.appendChild(option);
    });
    element.value = current;
  }

  function card(label, valueText, note, statusClass) {
    return '<div class="performance-summary-card ' + escapeHtml(statusClass || "") + '">' +
      '<span>' + escapeHtml(label) + '</span>' +
      '<strong>' + escapeHtml(String(valueText)) + '</strong>' +
      (note ? '<small>' + escapeHtml(note) + '</small>' : '') +
      '</div>';
  }

  function healthAssessment(summary) {
    const failures = Number(summary.failure_count || 0);
    const averageBrowser = Number(summary.average_browser_duration_ms || 0);
    const hitRate = Number(summary.cache_hit_rate || 0);

    if (failures >= 3 || averageBrowser >= 5000) {
      return { label: "Needs attention", className: "performance-health-danger" };
    }
    if (failures > 0 || averageBrowser >= 2000 || (summary.cache_hit_count + summary.cache_miss_count > 4 && hitRate < 60)) {
      return { label: "Monitor", className: "performance-health-warning" };
    }
    return { label: "Good", className: "performance-health-good" };
  }

  function renderSummary(summary) {
    const health = healthAssessment(summary);
    document.getElementById("performanceSummary").innerHTML =
      card("Overall health", health.label, "Based on the selected records", health.className) +
      card("Requests", summary.request_count || 0, "Logged events") +
      card("Average browser", formatDuration(summary.average_browser_duration_ms || 0), "User-experienced time") +
      card("Average server", formatDuration(summary.average_server_duration_ms || 0), "Apps Script processing") +
      card("Failures", summary.failure_count || 0, "Selected period") +
      card("Cache hit rate", (summary.cache_hit_rate || 0) + "%", (summary.cache_hit_count || 0) + " hits, " + (summary.cache_miss_count || 0) + " misses");

    document.getElementById("slowestActionsBody").innerHTML = (summary.slowest_actions || []).map(function (item) {
      return "<tr><td>" + escapeHtml(item.action) + "</td><td>" + item.request_count +
        "</td><td>" + formatDuration(item.average_duration_ms) +
        "</td><td>" + formatDuration(item.maximum_duration_ms) +
        "</td><td>" + item.failures + "</td></tr>";
    }).join("") || '<tr><td colspan="5">No data.</td></tr>';

    document.getElementById("recentFailuresBody").innerHTML = (summary.recent_failures || []).map(function (item) {
      return "<tr><td>" + formatDate(item.timestamp) + "</td><td>" + displayRole(item.role) +
        "</td><td>" + escapeHtml(item.action) + "</td><td>" + escapeHtml(item.error_message) + "</td></tr>";
    }).join("") || '<tr><td colspan="4">No recent failures.</td></tr>';
  }

  function renderSessionExplorer() {
    const container = document.getElementById("performanceSessions");
    if (!sessions.length) {
      container.innerHTML = '<p class="q">No sessions match the selected filters.</p>';
      return;
    }

    container.innerHTML = sessions.map(function (session) {
      const sessionRows = rowsForSession(session.session_id);
      const expanded = !!expandedSessions[session.session_id];
      const timeline = expanded ? renderSessionTimeline(sessionRows) : "";
      const sequenceNote = session.maximum_sequence > session.request_count
        ? session.request_count + " logged records; sequence reached " + session.maximum_sequence
        : session.request_count + " logged records";

      return '<section class="performance-session-card">' +
        '<button type="button" class="performance-session-toggle" data-session="' + escapeAttribute(session.session_id) + '" aria-expanded="' + expanded + '">' +
          '<span class="performance-session-heading"><strong>' + escapeHtml(shortSession(session.session_id)) + '</strong><small>' + formatDate(session.started_at) + '</small></span>' +
          '<span><strong>' + displayRole(session.role) + '</strong><small>Role</small></span>' +
          '<span><strong>' + formatDuration(session.elapsed_duration_ms) + '</strong><small>Timeline span</small></span>' +
          '<span><strong>' + formatDuration(session.average_duration_ms) + '</strong><small>Average request</small></span>' +
          '<span><strong>' + escapeHtml(session.slowest_action || "–") + '</strong><small>Slowest: ' + formatDuration(session.slowest_duration_ms) + '</small></span>' +
          '<span><strong>' + session.failure_count + '</strong><small>Failures</small></span>' +
          '<span class="performance-session-chevron">' + (expanded ? "▲" : "▼") + '</span>' +
        '</button>' +
        '<div class="performance-session-note">' + escapeHtml(sequenceNote) + '; cache hit rate ' + session.cache_hit_rate + '%.</div>' +
        timeline +
      '</section>';
    }).join("");

    container.querySelectorAll(".performance-session-toggle").forEach(function (button) {
      button.onclick = function () {
        const id = button.dataset.session;
        expandedSessions[id] = !expandedSessions[id];
        renderSessionExplorer();
      };
    });
  }

  function rowsForSession(sessionId) {
    return rows.filter(function (row) {
      return String(row.session_id || "") === String(sessionId || "");
    }).sort(function (a, b) {
      const sequenceDifference = Number(a.request_sequence || 0) - Number(b.request_sequence || 0);
      return sequenceDifference || (new Date(a.timestamp) - new Date(b.timestamp));
    });
  }

  function sessionStartTime(sessionRows) {
    if (!sessionRows.length) return 0;
    return Math.min.apply(null, sessionRows.map(function (row) { return new Date(row.timestamp).getTime(); }));
  }

  function renderSessionTimeline(sessionRows) {
    if (!sessionRows.length) {
      return '<p class="performance-session-empty">The detailed rows for this session are outside the current 1,000-row display limit.</p>';
    }
    const start = sessionStartTime(sessionRows);
    return '<div class="performance-session-timeline">' + sessionRows.map(function (row) {
      const elapsed = Math.max(0, new Date(row.timestamp).getTime() - start);
      return '<div class="performance-timeline-item ' + (row.status === "failure" ? "performance-timeline-failure" : "") + '">' +
        '<span class="performance-timeline-sequence">' + number(row.request_sequence) + '</span>' +
        '<span class="performance-timeline-elapsed">+' + formatDuration(elapsed) + '</span>' +
        '<span class="performance-timeline-main"><strong>' + escapeHtml(row.action) + '</strong><small>' + escapeHtml((row.bootstrap_stage ? row.bootstrap_stage + ' · ' : '') + (row.page_name || row.page || "Unknown page") + (row.request_initiator ? ' · ' + row.request_initiator : '') + (row.target_dataset ? ' · ' + row.target_dataset : '')) + '</small>' + diagnosticInline(row) + '</span>' +
        '<span class="performance-timeline-duration">' + formatDuration(performanceDuration(row)) + '</span>' +
        '<span class="performance-timeline-cache">' + cacheText(row) + '</span>' +
        '<span class="performance-timeline-status">' + escapeHtml(row.status || "") + '</span>' +
      '</div>';
    }).join("") + '</div>';
  }

  function renderRows() {
    const elapsedByEvent = calculateElapsedByEvent(rows);
    const sorted = rows.slice().sort(function (a, b) {
      let x = a[sortField];
      let y = b[sortField];
      if (sortField === "timestamp") {
        x = new Date(x).getTime();
        y = new Date(y).getTime();
      } else if (sortField === "elapsed_ms") {
        x = elapsedByEvent[a.event_id] || 0;
        y = elapsedByEvent[b.event_id] || 0;
      } else if (sortField === "total_delay_ms") {
        x = totalDelay(a);
        y = totalDelay(b);
      } else if (sortField === "server_share") {
        x = serverShare(a);
        y = serverShare(b);
      } else if (sortField.indexOf("_ms") !== -1 || sortField === "request_sequence") {
        x = Number(x || 0);
        y = Number(y || 0);
      } else {
        x = String(x || "").toLowerCase();
        y = String(y || "").toLowerCase();
      }
      return (x < y ? -1 : x > y ? 1 : 0) * (sortDirection === "asc" ? 1 : -1);
    });

    document.getElementById("performanceTableBody").innerHTML = sorted.map(function (row) {
      return '<tr class="' + (row.status === "failure" ? "performance-failure-row" : "") + '">' +
        "<td>" + formatDate(row.timestamp) + "</td>" +
        "<td>" + escapeHtml(row.page_name || row.page) + "</td>" +
        "<td>" + escapeHtml(shortSession(row.session_id)) + "</td>" +
        "<td>" + number(row.request_sequence) + "</td>" +
        "<td>" + (row.session_id ? "+" + formatDuration(elapsedByEvent[row.event_id] || 0) : "–") + "</td>" +
        "<td>" + displayRole(row.role) + "</td>" +
        "<td>" + escapeHtml(row.action) + "</td>" +
        "<td>" + escapeHtml(row.bootstrap_stage || "") + "</td>" +
        "<td>" + escapeHtml(row.request_initiator || "") + "</td>" +
        "<td>" + escapeHtml(row.target_dataset || "") + "</td>" +
        '<td class="' + delayClass(totalDelay(row)) + '">' + number(totalDelay(row)) + "</td>" +
        "<td>" + number(row.browser_duration_ms) + "</td>" +
        "<td>" + number(row.server_duration_ms) + "</td>" +
        '<td class="' + shareClass(serverShare(row)) + '">' + formatPercentage(serverShare(row)) + "</td>" +
        "<td>" + number(row.spreadsheet_read_ms) + "</td>" +
        "<td>" + number(row.spreadsheet_write_ms) + "</td>" +
        "<td>" + escapeHtml(row.cache_result) + "</td>" +
        "<td>" + number(row.cache_age_ms) + "</td>" +
        "<td>" + escapeHtml(row.status) + "</td>" +
        "<td>" + escapeHtml(row.error_message) + "</td>" +
        "<td>" + diagnosticCell(row) + "</td></tr>";
    }).join("") || '<tr><td colspan="21">No matching records.</td></tr>';
  }


  function parseDiagnosticDetails(row) {
    const text = String((row && row.diagnostic_details) || "").trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function diagnosticSummary(row) {
    return parseDiagnosticDetails(row).map(function (step) {
      const details = step.details || {};
      const parts = [String(step.name || "step") + " " + formatDuration(step.duration_ms || 0)];
      if (details.cache_result) parts.push("cache " + details.cache_result);
      if (details.producer_ms !== undefined) parts.push("producer " + formatDuration(details.producer_ms));
      if (details.cache_read_ms !== undefined) parts.push("lookup " + formatDuration(details.cache_read_ms));
      if (details.cache_write_ms !== undefined) parts.push("cache write " + formatDuration(details.cache_write_ms));
      if (details.serialise_ms !== undefined) parts.push("serialise " + formatDuration(details.serialise_ms));
      if (details.versions_ms !== undefined) parts.push("versions " + formatDuration(details.versions_ms));
      return parts.join(" · ");
    });
  }

  function diagnosticInline(row) {
    const summary = diagnosticSummary(row);
    if (!summary.length) return "";
    return '<small class="performance-diagnostic-inline">' + escapeHtml(summary.join(" | ")) + '</small>';
  }

  function diagnosticCell(row) {
    const summary = diagnosticSummary(row);
    if (!summary.length) return "–";
    return '<details class="performance-diagnostic-details"><summary>' + summary.length + ' step' + (summary.length === 1 ? '' : 's') + '</summary>' +
      '<div>' + summary.map(function (line) { return '<p>' + escapeHtml(line) + '</p>'; }).join('') + '</div></details>';
  }

  function calculateElapsedByEvent(sourceRows) {
    const starts = {};
    const elapsed = {};
    sourceRows.forEach(function (row) {
      const id = String(row.session_id || "");
      if (!id) return;
      const stamp = new Date(row.timestamp).getTime();
      if (starts[id] == null || stamp < starts[id]) starts[id] = stamp;
    });
    sourceRows.forEach(function (row) {
      const id = String(row.session_id || "");
      if (!id || starts[id] == null) return;
      elapsed[row.event_id] = Math.max(0, new Date(row.timestamp).getTime() - starts[id]);
    });
    return elapsed;
  }

  function totalDelay(row) {
    const browser = Number((row && row.browser_duration_ms) || 0);
    const server = Number((row && row.server_duration_ms) || 0);
    return browser > 0 ? browser : server;
  }

  function serverShare(row) {
    const total = totalDelay(row);
    const server = Number((row && row.server_duration_ms) || 0);
    if (!total || !server) return 0;
    return Math.max(0, Math.min(1, server / total));
  }

  function formatPercentage(valueText) {
    const value = Number(valueText || 0);
    return value ? Math.round(value * 100) + "%" : "–";
  }

  function delayClass(milliseconds) {
    const value = Number(milliseconds || 0);
    if (value > 10000) return "performance-delay-danger";
    if (value >= 5000) return "performance-delay-high";
    if (value >= 2000) return "performance-delay-warning";
    return "performance-delay-good";
  }

  function shareClass(valueText) {
    const value = Number(valueText || 0);
    if (value >= 0.8) return "performance-share-high";
    if (value >= 0.5) return "performance-share-medium";
    return "performance-share-low";
  }

  function performanceDuration(row) {
    return Number(row.browser_duration_ms || row.server_duration_ms || 0);
  }

  function cacheText(row) {
    const result = String(row.cache_result || "not_used");
    if (result === "hit" && row.cache_age_ms !== "" && row.cache_age_ms != null) {
      return "hit · age " + formatDuration(row.cache_age_ms);
    }
    return result;
  }

  function displayRole(role) {
    const text = String(role || "").trim().toLowerCase();
    if (!text || text === "unknown") return "Guest";
    return escapeHtml(text.replace(/_/g, " ").replace(/\b\w/g, function (character) { return character.toUpperCase(); }));
  }

  function shortSession(valueText) {
    const text = String(valueText || "");
    return text.length > 22 ? text.slice(0, 10) + "…" + text.slice(-8) : text;
  }

  function number(valueText) {
    return valueText === "" || valueText == null ? "–" : Math.round(Number(valueText));
  }

  function formatDuration(valueText) {
    const milliseconds = Math.max(0, Number(valueText || 0));
    if (milliseconds < 1000) return Math.round(milliseconds) + " ms";
    return (milliseconds / 1000).toFixed(milliseconds < 10000 ? 2 : 1) + " s";
  }

  function formatDate(valueText) {
    const date = new Date(valueText);
    return isNaN(date) ? escapeHtml(valueText) : date.toLocaleString();
  }

  function escapeHtml(valueText) {
    return String(valueText || "").replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  function escapeAttribute(valueText) {
    return escapeHtml(valueText).replace(/`/g, "&#96;");
  }

  function message(text, error) {
    const paragraph = document.getElementById("performanceMessage");
    paragraph.textContent = text || "";
    paragraph.classList.toggle("error", !!error);
  }

  function reset() {
    [
      "perfDateFrom", "perfDateTo", "perfSchool", "perfAction", "perfRole",
      "perfCache", "perfStatus", "perfSession", "perfPage", "perfInitiator",
      "perfTarget", "perfMin", "perfSearch"
    ].forEach(function (id) {
      document.getElementById(id).value = "";
    });
    load();
  }

  async function clearLog() {
    if (!confirm("Clear all performance log entries for this school?")) return;
    try {
      const result = await post({ action: "clearPerformanceLog", admin_teacher_id: adminId() });
      if (result && result.status === "success") load();
      else message((result && result.message) || "Unable to clear the log.", true);
    } catch (error) {
      message("Unable to clear the log: " + (error.message || error), true);
    }
  }
})();
