// =============================================================================
// WFT UPGRADE — Patch 12: Archive Upgrades
// =============================================================================
// Enhanced archiving with student/date-range/term options and archive manifests.

// ── Archive by date range ──

function normalizeWftArchiveSessionDate(session) {
    if (!session) { return ""; }
    if (session.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(String(session.dateIso))) {
        return String(session.dateIso);
    }
    var source = session.createdAt || session.date || session.timestamp || "";
    if (source && !isNaN(Date.parse(source))) {
        return new Date(source).toISOString().substring(0, 10);
    }
    if (source && /^\d{4}-\d{2}-\d{2}/.test(String(source))) {
        return String(source).substring(0, 10);
    }
    console.warn("[Archive] Skipping session with no parseable date", session.id || "");
    return "";
}

function wftMonthDayToNumber(value) {
    var parts = String(value || "").split("-");
    var month = parseInt(parts[0], 10);
    var day = parseInt(parts[1], 10);
    if (isNaN(month)) { month = 0; }
    if (isNaN(day)) { day = 0; }
    return (month * 100) + day;
}

function archiveByDateRange(startDate, endDate, studentName, callback) {
    console.log("[Archive] Archiving from", startDate, "to", endDate, "for", studentName || "all students");

    try {
        var portfolio = getPortfolioData();
        var names = studentName ? [studentName] : Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });
        var archiveSessions = {};

        for (var ni = 0; ni < names.length; ni++) {
            var name = names[ni];
            var studentData = portfolio[name];
            if (!studentData || !studentData.sessions) { continue; }

            var filtered = [];
            for (var si = 0; si < studentData.sessions.length; si++) {
                var session = studentData.sessions[si];
                var sessionDate = normalizeWftArchiveSessionDate(session);
                if (sessionDate && sessionDate >= startDate && sessionDate <= endDate) {
                    filtered.push(session);
                }
            }

            if (filtered.length > 0) {
                archiveSessions[name] = { sessions: filtered };
            }
        }

        var count = Object.keys(archiveSessions).length;
        console.log("[Archive] Found", count, "students with sessions in range");

        if (callback) { callback(null, archiveSessions, count); }
        return archiveSessions;
    } catch (e) {
        console.error("[Archive] Failed:", e);
        if (callback) { callback(e, null, 0); }
        return null;
    }
}

// ── Archive by term ──

var WFT_TERM_DATE_RANGES = {
    "Term 1 (Aug-Oct)":  { start: "08-01", end: "10-31" },
    "Term 2 (Nov-Mar)":  { start: "11-01", end: "03-31" },
    "Term 3 (Apr-Jun)":  { start: "04-01", end: "06-30" }
};

function archiveByTerm(termKey, year, studentName, callback) {
    var range = WFT_TERM_DATE_RANGES[termKey];
    if (!range) {
        if (callback) { callback(new Error("Unknown term: " + termKey), null, 0); }
        return;
    }

    var startDate = year + "-" + range.start;
    var endDate = year + "-" + range.end;

    // Handle term crossing year boundary (Nov-Mar)
    if (wftMonthDayToNumber(range.start) > wftMonthDayToNumber(range.end)) {
        endDate = (parseInt(year, 10) + 1) + "-" + range.end;
    }

    return archiveByDateRange(startDate, endDate, studentName, callback);
}

// ── Build enhanced archive ZIP ──

function buildEnhancedArchiveZip(archiveData, options, callback) {
    if (typeof JSZip === "undefined") {
        if (callback) { callback(new Error("JSZip not loaded"), null); }
        return;
    }

    options = options || {};
    var zip = new JSZip();
    var manifest = {
        archiveVersion: 2,
        createdAt: new Date().toISOString(),
        appVersion: "v9",
        studentCount: 0,
        sessionCount: 0,
        options: options
    };

    var names = Object.keys(archiveData);
    manifest.studentCount = names.length;

    // Summary CSV
    var csvLines = ["Student,Sessions,Date Range"];
    var summaryHtml = ["<h2>Archive Summary</h2>",
        "<p>Generated: " + new Date().toLocaleString() + "</p>",
        "<table border='1' cellpadding='4' style='border-collapse:collapse'>",
        "<tr><th>Student</th><th>Sessions</th><th>Date Range</th></tr>"];

    for (var ni = 0; ni < names.length; ni++) {
        var name = names[ni];
        var studentData = archiveData[name];
        var sessions = studentData.sessions || [];

        manifest.sessionCount += sessions.length;
        csvLines.push(name + "," + sessions.length + "," + (options.dateRange || "All"));

        summaryHtml.push("<tr><td>" + escapeHtml(name) + "</td><td>" + sessions.length + "</td><td>" + (options.dateRange || "All") + "</td></tr>");

        // Add student data as JSON
        zip.file("student-" + sanitizeDriveName(name) + ".json", JSON.stringify(studentData, null, 2));
    }

    summaryHtml.push("</table>");

    // Add manifest
    zip.file("archive-manifest.json", JSON.stringify(manifest, null, 2));

    // Add summary
    zip.file("summary.html", "<html><head><meta charset='UTF-8'><title>Archive Summary</title></head><body>" +
        summaryHtml.join("\n") + "</body></html>");

    // Add CSV
    zip.file("summary.csv", csvLines.join("\n"));

    // Add portfolio index
    try {
        var index = buildPortfolioIndexFromPortfolio(archiveData);
        zip.file("portfolio-index.json", JSON.stringify(index, null, 2));
    } catch (e) {}

    // Generate ZIP
    zip.generateAsync({ type: "blob" }).then(function(blob) {
        if (callback) { callback(null, blob, manifest); }
    }).catch(function(err) {
        if (callback) { callback(err, null); }
    });
}

// ── Archive removal ──

function removeArchivedSessionsFromPortfolio(archiveData, callback) {
    try {
        var portfolio = getPortfolioData();
        var names = Object.keys(archiveData);
        var removedCount = 0;

        for (var ni = 0; ni < names.length; ni++) {
            var name = names[ni];
            var archived = archiveData[name];
            if (!archived || !archived.sessions) { continue; }

            var archivedIds = {};
            for (var ai = 0; ai < archived.sessions.length; ai++) {
                var sid = archived.sessions[ai].id;
                if (sid) {
                    archivedIds[sid] = true;
                    // Record removal
                    var studentId = "";
                    try {
                        if (WFT_STUDENT_ID_MAP_V1) {
                            var settings = getRawSettings ? getRawSettings() : {};
                            studentId = (settings.studentIdMap && settings.studentIdMap[name]) || "";
                        }
                    } catch (e) {}
                    recordExtendedDeletion("archive-remove", studentId, sid, "archived");
                }
            }

            if (portfolio[name] && portfolio[name].sessions) {
                var kept = [];
                for (var si = 0; si < portfolio[name].sessions.length; si++) {
                    if (!archivedIds[portfolio[name].sessions[si].id]) {
                        kept.push(portfolio[name].sessions[si]);
                    } else {
                        removedCount += 1;
                    }
                }
                portfolio[name].sessions = kept;
            }
        }

        savePortfolioData(portfolio);
        console.log("[Archive] Removed", removedCount, "archived sessions from active portfolio");

        if (callback) { callback(null, removedCount); }
    } catch (e) {
        console.error("[Archive] Removal failed:", e);
        if (callback) { callback(e, 0); }
    }
}

// ── Utility ──

function escapeHtml(str) {
    if (!str) { return ""; }
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
