// =============================================================================
// WFT UPGRADE — Patch 1: Data Model Preparation
// =============================================================================
// Adds stable student IDs and session date normalization without
// changing storage behavior yet.

// ── Stable ID Generator ──

function getWftShortIdPart(len) {
    if (typeof _wftGenShortId === "function") { return _wftGenShortId(len); }
    if (typeof generateWftShortId === "function") { return generateWftShortId(len); }
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    var count = len || 4;
    for (var i = 0; i < count; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

function createWftId(prefix) {
    var ts = Date.now().toString(36);
    var rand = getWftShortIdPart(4);
    return (prefix || "id") + "_" + ts + "_" + rand;
}

// ── Student ID Helpers ──

function sanitizeStudentIdPart(value) {
    if (!value) { return "unknown"; }
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .substring(0, 30) || "unknown";
}

function createStableStudentId(studentName, existingMap) {
    var safePart = sanitizeStudentIdPart(studentName);
    var d = new Date();
    var datePart = d.getFullYear().toString() +
        ("0" + (d.getMonth() + 1)).slice(-2) +
        ("0" + d.getDate()).slice(-2);
    var baseId = "stu_" + safePart + "_" + datePart;

    // If baseId is already taken by another name, append a random suffix
    if (existingMap) {
        var existingKeys = Object.keys(existingMap);
        var conflict = false;
        for (var i = 0; i < existingKeys.length; i++) {
            var mappedId = existingMap[existingKeys[i]];
            if (mappedId === baseId && existingKeys[i] !== studentName) {
                conflict = true;
                break;
            }
        }
        if (conflict) {
            baseId = baseId + "_" + getWftShortIdPart(4);
        }
    }

    return baseId;
}

// ── Get-or-create for student ID ──

function getOrCreateStudentId(studentName) {
    // Check settings.studentIdMap first
    var settings;
    try {
        settings = getRawSettings ? getRawSettings() : {};
    } catch (e) {
        settings = {};
    }
    if (!settings.studentIdMap) { settings.studentIdMap = {}; }

    if (settings.studentIdMap[studentName]) {
        return settings.studentIdMap[studentName];
    }

    var newId = createStableStudentId(studentName, settings.studentIdMap);
    settings.studentIdMap[studentName] = newId;

    // Also update student records if present
    if (!settings.studentRecords) { settings.studentRecords = []; }
    var found = false;
    for (var i = 0; i < settings.studentRecords.length; i++) {
        if (settings.studentRecords[i].displayName === studentName) {
            settings.studentRecords[i].studentId = newId;
            settings.studentRecords[i].updatedAt = new Date().toISOString();
            found = true;
            break;
        }
    }
    if (!found) {
        settings.studentRecords.push({
            studentId: newId,
            displayName: studentName,
            legacyNameKeys: [studentName],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // Persist settings
    if (typeof saveSettingsToLocalStorage === "function") {
        try { saveSettingsToLocalStorage(settings); } catch (e) {}
    }

    return newId;
}

// ── Session Date Normalization ──

function normalizeWftSessionDate(session) {
    if (!session) { return; }

    // createdAt
    if (!session.createdAt || isNaN(Date.parse(session.createdAt))) {
        if (session.timestamp && !isNaN(Date.parse(session.timestamp))) {
            session.createdAt = session.timestamp;
        } else if (session.date && !isNaN(Date.parse(session.date))) {
            session.createdAt = session.date;
        } else {
            session.createdAt = new Date().toISOString();
        }
    }

    // Do not refresh updatedAt during normalization.
    // Merge logic uses updatedAt to decide which version is newer, so
    // unchanged legacy sessions should keep their existing timestamp.
    if (!session.updatedAt || isNaN(Date.parse(session.updatedAt))) {
        session.updatedAt = session.createdAt || new Date().toISOString();
    }

    if (!session.normalizedAt || isNaN(Date.parse(session.normalizedAt))) {
        session.normalizedAt = new Date().toISOString();
    }

    // dateIso
    if (!session.dateIso) {
        try {
            session.dateIso = new Date(session.createdAt).toISOString().substring(0, 10);
        } catch (e) {
            session.dateIso = new Date().toISOString().substring(0, 10);
        }
    }

    // displayDate
    if (!session.displayDate) {
        if (session.date) {
            session.displayDate = session.date;
        } else {
            try {
                var d = new Date(session.dateIso);
                var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                session.displayDate = months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
            } catch (e) {
                session.displayDate = session.dateIso;
            }
        }
    }

    // session.id
    if (!session.id) {
        session.id = createWftId("sess");
    }
}

function normalizeWftSessionForStorage(session) {
    normalizeWftSessionDate(session);
    // Could add additional storage-specific normalization here later
    return session;
}

// ── Student Record Normalization ──

function normalizeWftStudentRecord(studentName, sessions) {
    if (!sessions || !Array.isArray(sessions)) { sessions = []; }

    for (var i = 0; i < sessions.length; i++) {
        normalizeWftSessionForStorage(sessions[i]);
    }

    // Sort sessions by date (newest first)
    sessions.sort(function(a, b) {
        if (!a.createdAt) { return 1; }
        if (!b.createdAt) { return -1; }
        if (a.createdAt < b.createdAt) { return 1; }
        if (a.createdAt > b.createdAt) { return -1; }
        return 0;
    });

    return sessions;
}

// ── Portfolio Normalization for Schema V1 ──

function normalizeWftPortfolioForSchemaV1(portfolio) {
    if (!portfolio) { return {}; }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        return portfolio;
    }

    var normalized = {};
    var studentNames = Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });

    for (var i = 0; i < studentNames.length; i++) {
        var name = studentNames[i];
        var studentData = portfolio[name];
        if (!studentData || typeof studentData !== "object") { continue; }

        var sessions = studentData.sessions || [];
        if (Array.isArray(studentData) && !studentData.sessions) {
            // Legacy format where portfolio[name] was directly the sessions array
            sessions = studentData;
        }

        normalized[name] = {
            sessions: normalizeWftStudentRecord(name, sessions)
        };

        // Also ensure stable ID exists if student ID map is active
        if (WFT_STUDENT_ID_MAP_V1) {
            try { getOrCreateStudentId(name); } catch (e) {}
        }
    }

    // Preserve _meta if it existed
    if (portfolio._meta) {
        normalized._meta = portfolio._meta;
    }

    return normalized;
}
