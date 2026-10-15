// ── WFT Version 2 archive and export helpers ──
function setWftArchiveStatus(message) {
    var el = document.getElementById("archiveStatus");
    if (el) {
        el.textContent = message || "";
    }
}

function sanitizeFileName(name) {
    var safe = String(name || "Untitled")
        .replace(/[\\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = "_" + safe;
    safe = safe.substring(0, 120).replace(/[. ]+$/, "");
    return safe || "Untitled";
}

function getUniqueFolderName(baseName, usedNames) {
    var safeBase = sanitizeFileName(baseName);
    var candidate = safeBase;
    var counter = 2;

    while (Object.prototype.hasOwnProperty.call(usedNames, candidate.toLowerCase())) {
        candidate = safeBase + " (" + counter + ")";
        counter += 1;
    }

    usedNames[candidate.toLowerCase()] = true;
    return candidate;
}

function csvEscape(value) {
    var text = String(value == null ? "" : value);
    if (/[",\r\n]/.test(text)) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

function stripHtmlToText(html) {
    var tmp;
    if (!html) return "";
    try {
        tmp = document.createElement("template");
        tmp.innerHTML = String(html || "");
        return tmp.content.textContent || "";
    } catch (e) {
        return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
}

function getNestedValue(source, path) {
    var value = source;
    var i;
    for (i = 0; i < path.length; i += 1) {
        if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, path[i])) {
            return "";
        }
        value = value[path[i]];
    }
    return value == null ? "" : value;
}

function buildExportHtmlDocument(title, bodyHtml) {
    return '<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + escapeHtml(title) + '</title>' +
        '<style>' +
        'body{font-family:Arial,sans-serif;line-height:1.5;margin:24px;color:#111;}' +
        'h1,h2,h3{margin-top:1.2em;}' +
        'table{border-collapse:collapse;width:100%;margin:12px 0;}' +
        'th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top;}' +
        '.session{border:1px solid #ddd;padding:12px;margin:16px 0;border-radius:8px;}' +
        '.muted{color:#666;}' +
        'pre{white-space:pre-wrap;background:#f7f7f7;padding:12px;border-radius:6px;}' +
        '</style>' +
        '</head>' +
        '<body>' + bodyHtml + '</body></html>';
}

function getStudentSessions(studentData) {
    return studentData && Array.isArray(studentData.sessions) ? studentData.sessions : [];
}

function getSessionDate(session) {
    if (!session) return "";
    function readSessionDate() {
        return session.date || session.createdAt || session.updatedAt || session.timestamp;
    }
    return readSessionDate() ? String(readSessionDate()) : "";
}

function getSessionTitle(session) {
    if (!session) return "";
    return session.title || session.prompt || session.assignment || "Untitled";
}

function getSessionOriginalText(session) {
    if (!session) return "";
    return session.originalText || session.originalPlainText || session.studentWriting || session.text || "";
}

function getSessionCorrectedText(session) {
    if (!session) return "";
    return session.correctedPlainText || session.correctedStory || stripHtmlToText(session.correctedHtml || session.correctedMarkup || session.correctedText || "");
}

function buildSessionExportFeedbackText(session) {
    var parts = [];
    var scores;
    if (!session) return "";

    function appendStructuredFeedback() {
        if (session.feedbackSummary && typeof session.feedbackSummary === "object") {
            if (session.feedbackSummary.strength) parts.push("Strength: " + session.feedbackSummary.strength);
            if (session.feedbackSummary.nextTime) parts.push("Next step: " + session.feedbackSummary.nextTime);
            if (session.feedbackSummary.growGoal) parts.push("Growth goal: " + session.feedbackSummary.growGoal);
            if (session.feedbackSummary.closing) parts.push("Encouragement: " + session.feedbackSummary.closing);
        }

        if (session.feedback && typeof session.feedback === "object") {
            if (session.feedback.strength) parts.push("Strength: " + session.feedback.strength);
            if (session.feedback.nextTime) parts.push("Next step: " + session.feedback.nextTime);
            if (session.feedback.growGoal) parts.push("Growth goal: " + session.feedback.growGoal);
            if (session.feedback.comment) parts.push("Comment: " + session.feedback.comment);
        }
    }

    appendStructuredFeedback();

    if (session.teacherComment) parts.push("Teacher comment: " + session.teacherComment);
    if (session.notes) parts.push("Notes: " + session.notes);

    scores = session.categoryScores || session.scores || null;
    if (scores && typeof scores === "object") {
        parts.push("Scores: " + JSON.stringify(scores));
    }

    return parts.join("\r\n");
}

function getFirstAndLastSessionDates(sessions) {
    var dates = [];
    var i;
    var value;
    for (i = 0; i < sessions.length; i += 1) {
        value = getSessionDate(sessions[i]);
        if (value) dates.push(value);
    }
    dates.sort();
    return {
        first: dates.length ? dates[0] : "",
        last: dates.length ? dates[dates.length - 1] : ""
    };
}

function buildStudentSummaryHtml(studentName, studentData, schoolYear) {
    var sessions = getStudentSessions(studentData);
    var html = "";
    var i;
    var session;

    html += '<h1>' + escapeHtml(studentName) + ' - Writing Portfolio</h1>';
    html += '<p class="muted">School Year: ' + escapeHtml(schoolYear) + '</p>';
    html += '<p>Total writing sessions: ' + sessions.length + '</p>';

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        html += '<div class="session">';
        html += '<h2>Session ' + (i + 1) + '</h2>';
        html += '<p><strong>Date:</strong> ' + escapeHtml(getSessionDate(session)) + '</p>';
        html += '<p><strong>Title/Prompt:</strong> ' + escapeHtml(getSessionTitle(session)) + '</p>';
        html += '<h3>Original Writing</h3>';
        html += '<pre>' + escapeHtml(getSessionOriginalText(session)) + '</pre>';
        html += '<h3>Corrected Writing</h3>';
        html += '<pre>' + escapeHtml(getSessionCorrectedText(session)) + '</pre>';
        html += '<h3>Feedback</h3>';
        html += '<pre>' + escapeHtml(buildSessionExportFeedbackText(session)) + '</pre>';
        html += '</div>';
    }

    return buildExportHtmlDocument(studentName + " - Portfolio Summary", html);
}

function buildStudentPortfolioHtml(studentName, studentData, schoolYear) {
    var sessions = getStudentSessions(studentData).slice().sort(function(a, b) {
        var aTime = a && a.createdAt ? Date.parse(a.createdAt) : 0;
        var bTime = b && b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
    });
    if (!sessions.length) {
        return buildExportHtmlDocument(studentName + " - Portfolio", '<div class="empty">No writing sessions recorded yet.</div>');
    }

    var html = buildStudentPortfolioHeaderHtml(studentName, sessions, schoolYear);
    // Session cards (newest first)
    html += '<h2 class="section-title">Saved Work</h2>';
    for (var si = 0; si < sessions.length; si += 1) {
        html += buildStudentPortfolioSessionHtml(sessions[si]);
    }

    html += '</div>'; // .portfolio-page
    return buildStudentPortfolioDocument(studentName, html);
}

function buildStudentPortfolioHeaderHtml(studentName, sessions, schoolYear) {
    var latestSession = sessions[0];
    var prevSession = sessions.length >= 2 ? sessions[1] : null;
    var avgOverall, latestOverall, trend, bestOverall;
    function calculateOverallScores() {
        var overalls = sessions.map(function(s) { return s.overall != null ? Number(s.overall) : null; }).filter(function(v) { return v != null && !isNaN(v); });
        avgOverall = overalls.length ? Math.round(overalls.reduce(function(a, b) { return a + b; }, 0) / overalls.length) : null;
        latestOverall = latestSession.overall != null ? Number(latestSession.overall) : null;
        var prevOverall = prevSession && prevSession.overall != null ? Number(prevSession.overall) : null;
        trend = latestOverall != null && prevOverall != null ? latestOverall - prevOverall : null;
        bestOverall = overalls.length ? Math.max.apply(null, overalls) : null;
    }
    calculateOverallScores();
    var categoryAverages = getCategoryAverageMap(sessions);
    var portfolioCategoryKeys = getPortfolioCategoryKeys(sessions);
    var weakestCategory = null;
    var strongestCategory = null;
    portfolioCategoryKeys.forEach(function(key) {
        if (categoryAverages[key] == null) return;
        if (strongestCategory == null || categoryAverages[key] > categoryAverages[strongestCategory]) strongestCategory = key;
        if (weakestCategory == null || categoryAverages[key] < categoryAverages[weakestCategory]) weakestCategory = key;
    });

    var trendText = buildStudentPortfolioTrendText(trend);

    var html = '';
    html += '<div class="portfolio-page">';

    // Header
    html += '<div class="portfolio-header">';
    html += '<h1>' + escapeHtml(studentName) + ' &mdash; Writing Portfolio</h1>';
    html += '<p class="muted">School Year: ' + escapeHtml(schoolYear) + ' &bull; ' + sessions.length + ' submission' + (sessions.length !== 1 ? 's' : '') + '</p>';
    html += '</div>';

    // Stats grid
    html += '<div class="stats-grid">';
    html += '<div class="stat-card"><div class="stat-label">Latest Score</div><div class="stat-value">' + formatStudentPortfolioScore(latestOverall) + '</div><div class="stat-trend">' + trendText + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Average Score</div><div class="stat-value">' + formatStudentPortfolioScore(avgOverall) + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Best Score</div><div class="stat-value">' + formatStudentPortfolioScore(bestOverall) + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Submissions</div><div class="stat-value">' + sessions.length + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Strongest Area</div><div class="stat-value area-name">' + escapeHtml(strongestCategory || '-') + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Focus Area</div><div class="stat-value area-name">' + escapeHtml(weakestCategory || '-') + '</div></div>';
    html += '</div>';

    return html;
}

function formatStudentPortfolioScore(score) {
    return score != null ? score + '%' : '-';
}

function buildStudentPortfolioTrendText(trend) {
    var trendText = '';
    if (trend != null) {
        if (trend > 0) trendText = '&#9650; +' + trend + '% vs previous';
        else if (trend < 0) trendText = '&#9660; ' + trend + '% vs previous';
        else trendText = 'Same as previous';
    }

    return trendText;
}

function buildStudentPortfolioSessionHtml(sess) {
    var html = '';
    var scoreColor = scoreBadgeColor(sess.overall);

    // Category chips
    var chipsHtml = '';
    var sessCategoryKeys = typeof getSessionCategoryKeys === 'function' ? getSessionCategoryKeys(sess) : Object.keys(sess.categoryScores || {});
    sessCategoryKeys.forEach(function(key) {
        var value = getNumericAssessmentScore(sess.categoryScores && sess.categoryScores[key]);
        if (value == null) value = '-';
        var chipClass = getRubricScoreColorClass(value);
        chipsHtml += '<span class="chip ' + chipClass + '"><strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(String(value)) + (value !== '-' ? '/10' : '') + '</span>';
    });

    // Feedback notes
    var feedbackText = buildSessionExportFeedbackText(sess);
    var notesContent = feedbackText ? renderSimpleMarkdown(feedbackText) : '<em>No notes saved.</em>';

    // Corrected HTML (use the same helper as the in-app portfolio when available)
    var correctedDisplayHtml = '';
    if (typeof getPortfolioCorrectedHtml === 'function') {
        correctedDisplayHtml = getPortfolioCorrectedHtml(sess);
    } else if (sess.correctedMarkup) {
        correctedDisplayHtml = renderCorrectionMarkdown(sess.correctedMarkup);
    } else if (sess.correctedHtml) {
        correctedDisplayHtml = sanitizeWftHtmlFragment(sess.correctedHtml);
    } else {
        correctedDisplayHtml = '<pre>' + escapeHtml(getSessionCorrectedText(sess)) + '</pre>';
    }

    html += '<div class="session-card">';
    function appendSessionHeader() {
        // Header row
        html += '<div class="session-card-header">';
        html += '<div class="session-card-title-wrap"><div class="session-date">' + escapeHtml(getSessionDate(sess) || 'Unknown date') + '</div><span class="session-title">' + escapeHtml(getSessionTitle(sess) || 'Untitled') + '</span></div>';
        html += '<div class="session-score" style="color:' + scoreColor + ';border-color:' + scoreColor + '33;">' + (sess.overall != null ? escapeHtml(sess.overall + '%') : 'N/A') + '</div>';
        html += '</div>';
        // Meta
        html += '<div class="session-meta">Grade level: ' + escapeHtml(sess.gradeLabel || ('Grade ' + (sess.gradeLevel || 5))) + ' - ' + escapeHtml((sess.sourceType || 'typed').replace('+', ' + ')) + ' submission' + (sess.createdAt ? ' &mdash; ' + escapeHtml(new Date(sess.createdAt).toLocaleString()) : '') + ' - Writing type: ' + escapeHtml(getWritingGenreInfoFromSession(sess).mainGenre) + '</div>';
    }
    appendSessionHeader();
    // Chips
    html += '<div class="chip-row">' + chipsHtml + '</div>';
    // Artifact grid: Original | Corrected | Notes
    html += '<div class="artifact-grid">';
    html += '<div class="artifact-box"><h5>Original Writing</h5><pre>' + escapeHtml(getSessionOriginalText(sess)) + '</pre></div>';
    html += '<div class="artifact-box"><h5>Corrected Writing</h5><div class="rich-html corrected-writing-html">' + correctedDisplayHtml + '</div></div>';
    html += '<div class="artifact-box"><h5>Teacher Notes</h5><div class="rich-html">' + notesContent + '</div></div>';
    html += '</div>';

    html += buildStudentPortfolioPhotosHtml(sess);

    html += '</div>'; // .session-card
    return html;
}

function buildStudentPortfolioPhotosHtml(sess) {
    var html = '';
    // Image strip
    if (sess.images && sess.images.length) {
        html += '<div class="photo-strip">';
        for (var imi = 0; imi < sess.images.length; imi++) {
            var img = sess.images[imi];
            if (isSafeWftImageDataUrl(img.dataUrl)) {
                html += '<div class="photo-thumb"><img src="' + escapeHtmlAttr(img.dataUrl) + '" alt="' + escapeHtmlAttr(img.name || 'Image') + '" class="export-image"><div class="thumb-caption">' + escapeHtml(img.name || 'Image') + '</div></div>';
            } else {
                html += '<div class="photo-thumb"><div class="photo-placeholder">&#128247; Image not available in export</div><div class="thumb-caption">' + escapeHtml(img.name || 'Image') + '</div></div>';
            }
        }
        html += '</div>';
    }

    return html;
}

function buildStudentPortfolioDocument(studentName, html) {
    // Inline CSS matching in-app portfolio look
    var css = ''
        + '*{box-sizing:border-box;margin:0;padding:0;}'
        + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#1e293b;background:#f1f5f9;padding:24px;}'
        + '.portfolio-page{max-width:960px;margin:0 auto;}'
        + '.portfolio-header{margin-bottom:24px;}'
        + '.portfolio-header h1{font-size:1.6rem;color:#0f172a;margin-bottom:4px;}'
        + '.muted{color:#64748b;font-size:0.9rem;}'
        + '.empty{text-align:center;color:#94a3b8;padding:60px 0;}'

        // Stats grid
        + '.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px;}'
        + '.stat-card{background:white;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;}'
        + '.stat-card .stat-label{font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;margin-bottom:6px;}'
        + '.stat-card .stat-value{font-size:1.5rem;font-weight:700;color:#0f172a;}'
        + '.stat-card .stat-value.area-name{font-size:0.85rem;}'
        + '.stat-card .stat-trend{font-size:12px;color:#64748b;margin-top:4px;}'

        // Section title
        + '.section-title{font-size:1.1rem;color:#334155;margin-bottom:14px;}'

        // Session cards
        + '.session-card{border:1px solid #e2e8f0;border-radius:10px;background:white;padding:18px;margin-bottom:16px;}'
        + '.session-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px;}'
        + '.session-card-title-wrap{flex:1;min-width:180px;}'
        + '.session-date{color:#64748b;font-size:12px;}'
        + '.session-title{font-weight:700;color:#0f172a;display:block;margin-top:2px;}'
        + '.session-score{font-weight:700;font-size:1rem;padding:6px 12px;border-radius:999px;background:#f8fafc;border:1px solid;white-space:nowrap;}'
        + '.session-meta{font-size:12px;color:#64748b;margin-bottom:10px;}'

        // Chips
        + '.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}'
        + '.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 10px;font-size:12px;background:#f8fafc;border:1px solid #cbd5e1;color:#475569;}'
        + '.chip strong{color:inherit;}'
        + '.chip.score-green{background:#ecfdf5;border-color:#86efac;color:#166534;}'
        + '.chip.score-blue{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8;}'
        + '.chip.score-amber{background:#fffbeb;border-color:#fcd34d;color:#b45309;}'
        + '.chip.score-red{background:#fef2f2;border-color:#fca5a5;color:#b91c1c;}'
        + '.chip.score-gray{background:#f8fafc;border-color:#cbd5e1;color:#475569;}'

        // Artifact grid
        + '.artifact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:4px;}'
        + '.artifact-box{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fafafa;}'
        + '.artifact-box h5{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;}'
        + '.artifact-box pre,.artifact-box .rich-html{margin:0;white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:13px;line-height:1.5;color:#111111;}'

        // Rich HTML (for corrected text with highlights)
        + '.corrected-writing-html,.corrected-writing-html *{color:#111111!important;} .rich-html .corrected-highlight{background:#fde68a;color:#111111!important;font-weight:700;padding:0 2px;border-radius:3px;}'
        + '.rich-html .story-title-line{display:block;font-weight:700;margin-bottom:10px;color:#111111;}'
        + '.rich-html strong{font-weight:700;}'
        + '.rich-html br{display:block;content:"";margin-top:4px;}'

        // Photo strip
        + '.photo-strip{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;}'
        + '.photo-thumb{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:white;max-width:200px;}'
        + '.photo-thumb .export-image{width:100%;height:auto;display:block;}'
        + '.photo-placeholder{width:200px;height:100px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#94a3b8;font-size:12px;text-align:center;padding:12px;}'
        + '.thumb-caption{font-size:11px;color:#64748b;padding:6px 8px;text-align:center;background:#f8fafc;}'

        // Print styles
        + '@media print{body{background:white;padding:0;}.session-card{break-inside:avoid;border:1px solid #ddd;}.artifact-grid{grid-template-columns:repeat(3,1fr);}}'
        + '@media(max-width:640px){.artifact-grid{grid-template-columns:1fr;}.stats-grid{grid-template-columns:repeat(2,1fr);}}'
        ;

    return '<!DOCTYPE html>'
        + '<html lang="en">'
        + '<head>'
        + '<meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        + '<title>' + escapeHtml(studentName) + ' - Writing Portfolio</title>'
        + '<style>' + css + '</style>'
        + '</head>'
        + '<body>' + html + '</body></html>';
}

function buildStudentSessionsCsv(studentName, studentData) {
    var sessions = getStudentSessions(studentData);
    var rows = [];
    var i;
    var session;

    rows.push([
        "Student Name",
        "Session Date",
        "Title/Prompt",
        "Original Word Count",
        "Corrected Word Count",
        "Strength",
        "Next Step",
        "Growth Goal",
        "Scores JSON"
    ]);

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        rows.push([
            studentName,
            getSessionDate(session),
            getSessionTitle(session),
            countWords(getSessionOriginalText(session)),
            countWords(getSessionCorrectedText(session)),
            getNestedValue(session, ["feedback", "strength"]),
            getNestedValue(session, ["feedback", "nextTime"]),
            getNestedValue(session, ["feedback", "growGoal"]),
            JSON.stringify(session.categoryScores || session.scores || {})
        ]);
    }

    return rows.map(function(row) {
        return row.map(csvEscape).join(",");
    }).join("\r\n");
}

function buildCorrectedWritingText(studentName, studentData) {
    var sessions = getStudentSessions(studentData);
    var parts = [];
    var i;
    var session;

    parts.push(studentName + " - Corrected Writing");
    parts.push("");

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        parts.push("Session " + (i + 1));
        parts.push("Date: " + getSessionDate(session));
        parts.push("Title/Prompt: " + getSessionTitle(session));
        parts.push("");
        parts.push(getSessionCorrectedText(session));
        parts.push("");
        parts.push("----------------------------------------");
        parts.push("");
    }

    return parts.join("\r\n");
}

function buildClassSummaryRows(portfolio) {
    var studentNames = Object.keys(portfolio || {}).sort(function(a, b) { return a.localeCompare(b); });
    var rows = [];
    var i;
    var studentName;
    var sessions;
    var dates;

    for (i = 0; i < studentNames.length; i += 1) {
        studentName = studentNames[i];
        sessions = getStudentSessions(portfolio[studentName]);
        dates = getFirstAndLastSessionDates(sessions);
        rows.push({
            studentName: studentName,
            sessionCount: sessions.length,
            firstDate: dates.first,
            lastDate: dates.last
        });
    }

    return rows;
}

function buildClassSummaryHtml(portfolio, schoolYear) {
    var rows = buildClassSummaryRows(portfolio);
    var totalSessions = 0;
    var html = "";
    var i;

    for (i = 0; i < rows.length; i += 1) {
        totalSessions += rows[i].sessionCount;
    }

    html += '<h1>Class Writing Summary</h1>';
    html += '<p class="muted">School Year: ' + escapeHtml(schoolYear) + '</p>';
    html += '<p>Student count: ' + rows.length + '</p>';
    html += '<p>Total writing sessions: ' + totalSessions + '</p>';
    html += '<table><thead><tr><th>Student Name</th><th>Number of Sessions</th><th>First Session Date</th><th>Last Session Date</th></tr></thead><tbody>';

    for (i = 0; i < rows.length; i += 1) {
        html += '<tr><td>' + escapeHtml(rows[i].studentName) + '</td><td>' + rows[i].sessionCount + '</td><td>' + escapeHtml(rows[i].firstDate) + '</td><td>' + escapeHtml(rows[i].lastDate) + '</td></tr>';
    }

    html += '</tbody></table>';
    return buildExportHtmlDocument("Class Summary", html);
}

function buildClassSummaryCsv(portfolio, schoolYear) {
    var rows = buildClassSummaryRows(portfolio);
    var csvRows = [];
    var i;

    csvRows.push(["School Year", schoolYear]);
    csvRows.push([]);
    csvRows.push(["Student Name", "Number of Sessions", "First Session Date", "Last Session Date"]);

    for (i = 0; i < rows.length; i += 1) {
        csvRows.push([rows[i].studentName, rows[i].sessionCount, rows[i].firstDate, rows[i].lastDate]);
    }

    return csvRows.map(function(row) {
        return row.map(csvEscape).join(",");
    }).join("\r\n");
}

function dataUrlToBlobPromise(dataUrl) {
    if (!isSafeWftImageDataUrl(dataUrl)) {
        return Promise.reject(new Error("Invalid image data URL."));
    }
    return fetch(dataUrl).then(function(response) {
        return response.blob();
    });
}

function downloadDriveFileAsBlobPromise(fileId, archiveConnection) {
    var url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media";
    return wftDriveFetch(url, undefined, archiveConnection).then(function(response) {
        return response.blob();
    });
}

function runTasksWithConcurrency(tasks, limit, progressCallback) {
    return new Promise(function(resolve, reject) {
        var index = 0;
        var active = 0;
        var completed = 0;
        var results = [];

        function next() {
            if (completed >= tasks.length) {
                resolve(results);
                return;
            }

            while (active < limit && index < tasks.length) {
                (function(taskIndex) {
                    active += 1;
                    Promise.resolve().then(tasks[taskIndex]).then(function(result) {
                        results[taskIndex] = result;
                    }).catch(function(e) {
                        results[taskIndex] = { error: String(e && e.message ? e.message : e) };
                    }).then(function() {
                        active -= 1;
                        completed += 1;
                        if (progressCallback) progressCallback(completed, tasks.length);
                        next();
                    });
                }(index));
                index += 1;
            }
        }

        try {
            next();
        } catch (e) {
            reject(e);
        }
    });
}

function getAvailableImageExportExtension(extension, imageType) {
    if (extension) return extension[0];
    if (imageType === "image/png") return ".png";
    if (imageType === "image/gif") return ".gif";
    if (imageType === "image/webp") return ".webp";
    return ".jpg";
}

function addAvailableImagesToStudentFolder(folder, studentName, studentData, options) {
    var sessions = getStudentSessions(studentData);
    var imageFolder = folder.folder("Photos");
    var manifest = [];
    var tasks = [];
    var includeImages = options && options.includeImages;
    var usedNames = Object.create(null);
    var i;
    var j;
    var session;
    var images;
    var image;

    if (!includeImages) {
        imageFolder.file("Photos not included.txt", "Images/photos were not included in this export. Re-run the export with the image option checked if needed.");
        return Promise.resolve();
    }

    function addImageExport(session, image, sessionIndex, imageIndex) {
        var baseName = sanitizeFileName((getSessionDate(session) || ("Session " + (sessionIndex + 1))) + " - " + (image.name || ("Image " + (imageIndex + 1))));
        var extension = /\.(png|jpe?g|gif|webp)$/i.exec(baseName);
        var stem = getUniqueFolderName(extension ? baseName.slice(0, -extension[0].length) : baseName, usedNames);
        var mimeType = /^data:(image\/[a-z]+);/i.exec(image.dataUrl || image.originalDataUrl || "");
        var imageType = mimeType ? mimeType[1].toLowerCase() : image.mimeType;
        var fileName = stem + getAvailableImageExportExtension(extension, imageType);

        manifest.push({
            sessionIndex: sessionIndex + 1,
            sessionDate: getSessionDate(session),
            originalName: image.name || "",
            exportedName: fileName,
            driveFileId: image.driveFileId || "",
            included: false
        });

        if (image.dataUrl || image.originalDataUrl || image.driveFileId) {
            (function(img, exportName, exportStem, entry) {
                tasks.push(function() {
                    assertWftArchiveConnection(options && options.archiveConnection);
                    var blobPromise;
                    if (img.dataUrl || img.originalDataUrl) {
                        blobPromise = dataUrlToBlobPromise(img.dataUrl || img.originalDataUrl);
                    } else {
                        blobPromise = downloadDriveFileAsBlobPromise(img.driveFileId, options && options.archiveConnection);
                    }
                    return blobPromise.then(function(blob) {
                        assertWftArchiveConnection(options && options.archiveConnection);
                        var type = /^image\/(png|jpe?g|gif|webp)$/i.exec(blob.type || "");
                        if (type) exportName = exportStem + "." + type[1].toLowerCase().replace("jpeg", "jpg");
                        imageFolder.file(exportName, blob);
                        entry.exportedName = exportName;
                        entry.included = true;
                        return true;
                    });
                });
            }(image, fileName, stem, manifest[manifest.length - 1]));
        }
    }

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        images = Array.isArray(session.images) && session.images.length ? session.images : session.photos || [];
        if (!Array.isArray(images)) images = [];

        for (j = 0; j < images.length; j += 1) {
            image = images[j] || {};
            addImageExport(session, image, i, j);
        }
    }

    if (!tasks.length) {
        imageFolder.file("No available photos.txt", "No locally available images or downloadable Drive image IDs were found for this student. Historical photos without bytes or a Drive ID are metadata-only; included=false in photos-manifest.json.");
        imageFolder.file("photos-manifest.json", JSON.stringify(manifest, null, 2));
        return Promise.resolve();
    }

    return runTasksWithConcurrency(tasks, 3, function(done, total) {
        setWftArchiveStatus("Downloading images for " + studentName + " (" + done + " of " + total + ")...");
    }).then(function(results) {
        imageFolder.file("photos-manifest.json", JSON.stringify(manifest, null, 2));
        var failed = results.find(function(result) { return result && result.error; });
        if (failed) throw new Error("A requested available photo could not be exported for " + studentName + ": " + failed.error);
    });
}

function addStudentExportFiles(folder, studentName, studentData, schoolYear, options) {
    var safeStudentName = sanitizeFileName(studentName);
    var richPortfolioHtml = buildStudentPortfolioHtml(studentName, studentData, schoolYear);
    folder.file("Portfolio.html", richPortfolioHtml);
    folder.file(safeStudentName + " - Portfolio.html", richPortfolioHtml);
    folder.file(safeStudentName + " - Portfolio Summary.html", buildStudentSummaryHtml(studentName, studentData, schoolYear));
    folder.file(safeStudentName + " - All Writing.json", JSON.stringify(studentData || { sessions: [] }, null, 2));
    folder.file(safeStudentName + " - Writing Sessions.csv", buildStudentSessionsCsv(studentName, studentData));
    folder.file(safeStudentName + " - Corrected Writing.txt", buildCorrectedWritingText(studentName, studentData));
    return addAvailableImagesToStudentFolder(folder, studentName, studentData, options || {});
}

function suggestSchoolYear() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    if (month >= 6) {
        return String(year) + "-" + String(year + 1);
    }
    return String(year - 1) + "-" + String(year);
}

function getActivePortfolioForExport() {
    preflightWftRequiredStorage();
    var deletions = normalizeDeletionsData(readWftRequiredStorage(WFT_DELETIONS_STORAGE_KEY));
    var portfolio = getLocalPortfolioSnapshot();
    if (typeof applyDeletionsToPortfolio === "function") {
        portfolio = applyDeletionsToPortfolio(portfolio, deletions);
    }
    return normalizePortfolioData(portfolio || {});
}

function createSchoolYearArchiveZip(schoolYear, options) {
    return new Promise(function(resolve, reject) {
        try {
            if (typeof JSZip === "undefined") {
                reject(new Error("JSZip is not loaded."));
                return;
            }

            var portfolio = getActivePortfolioForExport();
            var studentNames = Object.keys(portfolio || {}).sort(function(a, b) { return a.localeCompare(b); });
            var zip = new JSZip();
            var root = zip.folder(sanitizeFileName(schoolYear));
            var studentsFolder = root.folder("Students");
            var usedFolderNames = Object.create(null);
            var archiveInfo = {
                schemaVersion: 1,
                archiveType: "WritingFeedbackToolYearEndArchive",
                schoolYear: schoolYear,
                createdAt: new Date().toISOString(),
                studentCount: studentNames.length,
                appVersion: (typeof WFT_APP_VERSION !== "undefined" ? WFT_APP_VERSION : "v9"),
                imagesIncluded: !!(options && options.includeImages),
                imageScope: "Available local bytes and Drive image IDs only. Historical photos without either are metadata-only; see each photos-manifest.json included flag."
            };
            var chain = Promise.resolve();
            var i;

            root.file("archive-info.json", JSON.stringify(archiveInfo, null, 2));
            root.file("Complete Portfolio.json", JSON.stringify(portfolio, null, 2));
            root.file("Class Summary.html", buildClassSummaryHtml(portfolio, schoolYear));
            root.file("Class Summary.csv", buildClassSummaryCsv(portfolio, schoolYear));

            for (i = 0; i < studentNames.length; i += 1) {
                (function(studentName, studentIndex) {
                    chain = chain.then(function() {
                        var studentData = portfolio[studentName] || { sessions: [] };
                        var folderName = getUniqueFolderName(studentName, usedFolderNames);
                        var folder = studentsFolder.folder(folderName);
                        setWftArchiveStatus("Adding " + studentName + " (" + (studentIndex + 1) + " of " + studentNames.length + ")...");
                        return addStudentExportFiles(folder, studentName, studentData, schoolYear, options || {});
                    });
                }(studentNames[i], i));
            }

            chain.then(function() {
                setWftArchiveStatus("Generating zip file...");
                return zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 }
                });
            }).then(function(blob) {
                resolve({
                    blob: blob,
                    fileName: "WritingFeedbackTool-Archive-" + sanitizeFileName(schoolYear) + ".zip",
                    studentCount: studentNames.length
                });
            }).catch(function(e) {
                reject(e);
            });
        } catch (e) {
            reject(e);
        }
    });
}

function createSingleStudentArchiveZip(studentName, options) {
    return new Promise(function(resolve, reject) {
        try {
            if (typeof JSZip === "undefined") {
                reject(new Error("JSZip is not loaded."));
                return;
            }

            var portfolio = getActivePortfolioForExport();
            var studentData = portfolio[studentName];
            var zip = new JSZip();
            var safeStudentName = sanitizeFileName(studentName);
            var portfolioFileName = safeStudentName + " - Portfolio.html";
            var fileName;

            if (!studentData) {
                reject(new Error("No portfolio data was found for " + studentName + "."));
                return;
            }

            setWftArchiveStatus("Creating portfolio export for " + studentName + "...");

            zip.file(portfolioFileName, buildStudentPortfolioHtml(studentName, studentData, suggestSchoolYear()));

            var photos = options && options.includeImages ? addAvailableImagesToStudentFolder(zip, studentName, studentData, options) : Promise.resolve();
            photos.then(function() { return zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 6 }
            }); }).then(function(blob) {
                fileName = safeStudentName + " - Writing Portfolio.zip";
                resolve({ blob: blob, fileName: fileName, portfolioFileName: portfolioFileName });
            }).catch(function(e) {
                reject(e);
            });
        } catch (e) {
            reject(e);
        }
    });
}

function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

function ensureDriveSubfolderPromise(parentFolderId, folderName, archiveConnection) {
    var query = "name='" + escapeDriveQueryValue(folderName) + "'"
        + " and mimeType='application/vnd.google-apps.folder'"
        + " and '" + escapeDriveQueryValue(parentFolderId) + "' in parents"
        + " and trashed=false";
    var searchUrl = "https://www.googleapis.com/drive/v3/files"
        + "?q=" + encodeURIComponent(query)
        + "&fields=files(id,name,modifiedTime)"
        + "&orderBy=modifiedTime desc";

    return wftDriveFetch(searchUrl, undefined, archiveConnection).then(function(response) {
        return response.json();
    }).then(function(data) {
        assertWftArchiveConnection(archiveConnection);
        var files = data && data.files ? data.files : [];
        if (files.length && files[0].id) {
            return files[0].id;
        }
        return wftDriveFetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: folderName,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentFolderId]
            })
        }, archiveConnection).then(function(createResponse) {
            return createResponse.json();
        }).then(function(folder) {
            assertWftArchiveConnection(archiveConnection);
            if (!folder || !folder.id) {
                throw new Error("Could not create Drive folder: " + folderName);
            }
            return folder.id;
        });
    });
}

function ensureArchiveYearFolderPromise(schoolYear, archiveConnection) {
    assertWftArchiveConnection(archiveConnection);
    return ensureDriveFolderPromise(archiveConnection).then(function(rootFolderId) {
        assertWftArchiveConnection(archiveConnection);
        return ensureDriveSubfolderPromise(rootFolderId, "Archives", archiveConnection);
    }).then(function(archivesFolderId) {
        assertWftArchiveConnection(archiveConnection);
        return ensureDriveSubfolderPromise(archivesFolderId, sanitizeFileName(schoolYear), archiveConnection);
    });
}

function uploadBlobToDrivePromise(fileName, blob, mimeType, folderId, archiveConnection) {
    var boundary = "----WFTArchiveBoundary" + Date.now();
    var metadata = JSON.stringify({
        name: fileName,
        parents: [folderId],
        mimeType: mimeType
    });
    var body = new Blob([
        "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + metadata + "\r\n",
        "--" + boundary + "\r\nContent-Type: " + mimeType + "\r\n\r\n",
        blob,
        "\r\n--" + boundary + "--"
    ], { type: "multipart/related; boundary=" + boundary });

    return wftDriveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size", {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        body: body
    }, archiveConnection).then(function(response) {
        return response.json();
    }).then(function(fileData) {
        if (!fileData || !fileData.id) {
            throw new Error("Archive upload did not return a Drive file ID.");
        }
        return fileData;
    });
}

function saveArchiveZipToDrive(fileName, blob, schoolYear, archiveConnection) {
    if (!driveAccessToken) {
        return Promise.reject(new Error("Please sign in with Google before saving an archive to Drive."));
    }
    archiveConnection = archiveConnection || captureWftArchiveConnection();
    assertWftArchiveConnection(archiveConnection);
    return ensureArchiveYearFolderPromise(schoolYear, archiveConnection).then(function(folderId) {
        assertWftArchiveConnection(archiveConnection);
        return uploadBlobToDrivePromise(fileName, blob, "application/zip", folderId, archiveConnection);
    });
}

function captureWftArchiveClassState() {
    preflightWftRequiredStorage();
    getLocalPortfolioSnapshot();
    if (wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
    return stableStringify({
        stored: ['wft_portfolio', 'wft_students', 'wft_settings', WFT_DELETIONS_STORAGE_KEY, 'wft_selectedStudent', PENDING_PORTFOLIO_SYNC_KEY].map(function(key) { return localStorage.getItem(key); }),
        settings: getLocalSettingsSnapshot(),
        students: students,
        selectedStudent: selectedStudent,
        counters: [wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter],
        pending: pendingPortfolioSync,
        writing: String((document.getElementById('studentWriting') || {}).value || ''),
        images: getSessionImagePayloads(),
        reassessmentSource: activePortfolioReassessmentSource,
        analysis: latestAnalysisData,
        analysisInput: activeAnalysisContext && activeAnalysisContext.input
    });
}

function clearCurrentClassAfterSuccessfulArchive(expectedState) {
    if (expectedState !== undefined && captureWftArchiveClassState() !== expectedState) return false;
    getLocalPortfolioSnapshot();
    var change = { portfolio: {}, deletions: getEmptyDeletionsData(), students: [], selectedStudent: "" };
    try {
        saveWftStudentChange(change);
    } catch (e) {
        if (!change.committed) throw e;
        students = change.students;
        selectedStudent = change.selectedStudent;
        wftDebugWarn("[WFT Archive] Class cleared; sync publication needs retry:", e);
    }

    try {
        renderStudentList();
        populateStudentDropdown();
        refreshPortfolioDropdown();
        renderStudentPortfolio();
    } catch (e) {
        wftDebugWarn("[WFT Archive] Could not refresh UI after clearing class:", e);
    }

    try {
        if (typeof scheduleWftDriveSync === "function") {
            scheduleWftDriveSync("archive-clear-current-class");
        }
    } catch (e) {
        wftDebugWarn("[WFT Archive] Class cleared; sync scheduling needs retry:", e);
    }
    return true;
}

async function archiveCurrentSchoolYear() {
    var defaultYear = suggestSchoolYear();
    var schoolYear = await wftTextInput("Enter the school year for this archive.", {
        title: "Archive Current School Year",
        label: "School year",
        defaultValue: defaultYear,
        confirmText: "Continue"
    });
    var includeImagesEl = document.getElementById("archiveIncludeImages");
    var includeImages = !!(includeImagesEl && includeImagesEl.checked);

    if (!schoolYear) return;
    schoolYear = String(schoolYear).trim();
    if (!schoolYear) {
        alert("Please enter a school year.");
        return;
    }

    if (!(await wftConfirm("Archive current school year? The app will create a zip organized by student name, save it to Google Drive, download a copy, and then clear the active class list and portfolio after the archive is saved.", {
        title: "Archive Current School Year",
        confirmText: "Create Archive",
        danger: true
    }))) {
        return;
    }

    setWftArchiveStatus("Starting archive...");

    var archiveSaved = false;
    var archiveDownloaded = false;
    var classState;
    var archiveConnection = captureWftArchiveConnection();
    return Promise.resolve().then(function() {
        classState = captureWftArchiveClassState();
        assertWftArchiveConnection(archiveConnection);
        return createSchoolYearArchiveZip(schoolYear, { includeImages: includeImages, archiveConnection: archiveConnection });
    })
        .then(function(result) {
            assertWftArchiveConnection(archiveConnection);
            if (!result.blob || result.blob.size < 1000) {
                throw new Error("Archive file appears to be empty or invalid.");
            }
            setWftArchiveStatus("Saving archive to Google Drive...");
            return saveArchiveZipToDrive(result.fileName, result.blob, schoolYear, archiveConnection).then(function() {
                archiveSaved = true;
                return result;
            });
        })
        .then(function(result) {
            assertWftArchiveConnection(archiveConnection);
            downloadBlob(result.blob, result.fileName);
            archiveDownloaded = true;
            assertWftArchiveConnection(archiveConnection);
            if (clearCurrentClassAfterSuccessfulArchive(classState) === false) {
                setWftArchiveStatus("Snapshot archive saved and downloaded. Current class retained because work changed during the archive.");
                alert("The snapshot archive was saved to Drive and downloaded. The current class was retained because writing, photos, roster, settings or pending work changed. Review the changes before archiving again.");
                return;
            }
            setWftArchiveStatus("Archive complete. Current class was cleared.");
            alert("Archive created, saved to Drive, downloaded, and current class cleared.");
        })
        .catch(function(e) {
            wftDebugError("[WFT Archive] Archive failed:", e);
            if (archiveSaved) {
                setWftArchiveStatus("Archive saved to Drive" + (archiveDownloaded ? " and downloaded" : "") + ". Current class retained; local completion needs attention.");
                alert("The snapshot archive was saved to Drive" + (archiveDownloaded ? " and downloaded" : "") + ". The current class was retained. " + e.message);
                return;
            }
            setWftArchiveStatus(e.wftStudentChangeRecovery ? "Archive saved. Local class recovery needed." : "Archive failed. Current class was not cleared.");
            alert(e.wftStudentChangeRecovery ? e.message : "The archive could not be completed. The current class was not cleared. " + (e && e.message ? e.message : e));
        });
}

function exportSelectedStudentPortfolio() {
    var select = document.getElementById("portfolioStudentSelect");
    var studentName = select && select.value ? select.value : "";
    var includeImagesEl = document.getElementById("archiveIncludeImages");
    var includeImages = !!(includeImagesEl && includeImagesEl.checked);

    if (!studentName) {
        alert("Please select a student above first, then click Export This Student.");
        updateExportSelectedStudentButton();
        return;
    }

    return createSingleStudentArchiveZip(studentName, { includeImages: includeImages })
        .then(function(result) {
            if (!result.blob || result.blob.size < 500) {
                throw new Error("Student export appears to be empty or invalid.");
            }
            downloadBlob(result.blob, result.fileName);
            setWftArchiveStatus("Student export complete: " + studentName + ". Open the downloaded zip, then open " + (result.portfolioFileName || (studentName + " - Portfolio.html")) + ".");
        })
        .catch(function(e) {
            wftDebugError("[WFT Archive] Student export failed:", e);
            setWftArchiveStatus("Student export failed.");
            alert("The student export could not be completed. " + (e && e.message ? e.message : e));
        });
}



