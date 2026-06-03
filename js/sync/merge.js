// =============================================================================
// WFT UPGRADE — Patch 10: Split-file Merge & Deletion Handling
// =============================================================================
// Multi-device sync safety for per-student files. Handles conflict resolution
// and extended deletion records.

// ── Merge helpers ──

function mergeStudentPortfolioFiles(localFile, remoteFile, deletions) {
    if (!localFile && !remoteFile) { return null; }
    if (!localFile) { return applyDeletionsToFile(remoteFile, deletions); }
    if (!remoteFile) { return applyDeletionsToFile(localFile, deletions); }

    var merged = {
        schemaVersion: 1,
        format: "student-portfolio-v1",
        studentId: localFile.studentId || remoteFile.studentId,
        displayName: remoteFile.displayName || localFile.displayName,
        legacyNameKeys: mergeStringArrays(
            localFile.legacyNameKeys || [],
            remoteFile.legacyNameKeys || []
        ),
        createdAt: chooseOlderDate(localFile.createdAt, remoteFile.createdAt),
        updatedAt: new Date().toISOString(),
        sessions: mergeStudentSessions(
            localFile.sessions || [],
            remoteFile.sessions || [],
            deletions || [],
            localFile.studentId || remoteFile.studentId || ""
        )
    };

    return merged;
}

function mergeStudentSessions(localSessions, remoteSessions, deletions, studentId) {
    var merged = {};
    var allSessions = (localSessions || []).concat(remoteSessions || []);

    for (var i = 0; i < allSessions.length; i++) {
        var session = allSessions[i];
        if (!session) { continue; }

        var sessionId = session.id || "";
        if (!sessionId) {
            // Assign an ID before checking the deletion log so all later logic
            // works with one clear session identifier. A previously ID-less
            // legacy session cannot match an old deletion record by ID.
            session.id = createWftId("sess");
            sessionId = session.id;
        }

        var sessionStudentId = session.studentId || studentId || "";
        if (isStudentSessionDeleted(sessionId, sessionStudentId, deletions, session.updatedAt || session.createdAt)) {
            continue;
        }

        if (!merged[sessionId]) {
            merged[sessionId] = session;
        } else {
            // Conflict: keep newer
            merged[sessionId] = chooseNewerSession(merged[sessionId], session);
        }
    }

    // Convert back to array and sort
    var result = [];
    var keys = Object.keys(merged);
    for (var j = 0; j < keys.length; j++) {
        result.push(merged[keys[j]]);
    }

    result.sort(function(a, b) {
        if (!a.createdAt) { return 1; }
        if (!b.createdAt) { return -1; }
        if (a.createdAt < b.createdAt) { return 1; }
        if (a.createdAt > b.createdAt) { return -1; }
        return 0;
    });

    return result;
}

function getWftDeletionRecords(deletions) {
    var clean = (typeof normalizeDeletionsData === "function") ? normalizeDeletionsData(deletions || {}) : (deletions || {});
    var records = Array.isArray(clean.records) ? clean.records.slice(0) : [];
    var deletedSessions = clean.deletedSessions && typeof clean.deletedSessions === "object" ? clean.deletedSessions : {};
    var keys = Object.keys(deletedSessions);
    for (var i = 0; i < keys.length; i++) {
        var legacy = deletedSessions[keys[i]] || {};
        var legacyRecord = {
            id: legacy.id || keys[i], type: legacy.type || "session",
            studentId: legacy.studentId || "", studentName: legacy.studentName || "",
            sessionId: legacy.sessionId || "", deletedAt: legacy.deletedAt || clean.updatedAt || "",
            deviceId: legacy.deviceId || "", reason: legacy.reason || "teacher_delete"
        };
        // Preserve lamportClock if present (from WFT_LAMPORT_V1 records)
        if (typeof legacy.lamportClock === "number") { legacyRecord.lamportClock = legacy.lamportClock; }
        records.push(legacyRecord);
    }
    return records;
}

function isStudentSessionDeleted(sessionId, studentId, deletions, sessionUpdatedAt) {
    if (!deletions || !sessionId) { return false; }
    var records = getWftDeletionRecords(deletions);
    var sessionUpdateMs = sessionUpdatedAt && !isNaN(Date.parse(sessionUpdatedAt)) ? Date.parse(sessionUpdatedAt) : 0;
    var normalizedStudentId = String(studentId || "");
    for (var i = 0; i < records.length; i++) {
        var d = records[i] || {};
        var type = d.type || "session";
        if ((type === "session" || type === "archive-remove") && String(d.sessionId || "") === String(sessionId)) {
            if (normalizedStudentId && d.studentId && String(d.studentId) !== normalizedStudentId) { continue; }
            // Deletions always win over live sessions (preserve behavior)
            // When WFT_LAMPORT_V1, deletions are identified by lamportClock on the deletion record
            var useLamport = WFT_LAMPORT_V1 && (typeof d.lamportClock === "number" && !isNaN(d.lamportClock));
            if (useLamport) {
                // Deletion record has lamport; any deletion record wins (live sessions have no lamport or lower)
                return true;
            }
            var deletedMs = d.deletedAt && !isNaN(Date.parse(d.deletedAt)) ? Date.parse(d.deletedAt) : 0;
            if (!deletedMs) { continue; }
            // Deletion wins only when it is strictly newer than the session.
            // Equal timestamps can happen during sync batches and should not delete live data.
            if (!sessionUpdateMs || deletedMs > sessionUpdateMs) { return true; }
        }
    }
    return false;
}

function isSessionDeleted(sessionId, studentIdOrDeletions, deletionsMaybe, sessionUpdatedAt) {
    // Backward-compatible wrapper. Prefer isStudentSessionDeleted(...) for new code.
    var studentId = "";
    var deletions = deletionsMaybe;
    if (deletionsMaybe === undefined && studentIdOrDeletions && typeof studentIdOrDeletions === "object") {
        deletions = studentIdOrDeletions;
    } else {
        studentId = String(studentIdOrDeletions || "");
    }
    return isStudentSessionDeleted(sessionId, studentId, deletions, sessionUpdatedAt);
}

function chooseNewerSession(sessionA, sessionB) {
    // Lamport clock logic for WFT_LAMPORT_V1 (disabled by default)
    if (WFT_LAMPORT_V1) {
        var lamA = (typeof sessionA.lamportClock === "number" && !isNaN(sessionA.lamportClock)) ? sessionA.lamportClock : -1;
        var lamB = (typeof sessionB.lamportClock === "number" && !isNaN(sessionB.lamportClock)) ? sessionB.lamportClock : -1;
        if (lamA !== lamB) {
            return (lamA > lamB) ? sessionA : sessionB;
        }
        // Lamports equal (or both absent) — fall back to timestamp
    }
    var timeA = sessionA.updatedAt ? Date.parse(sessionA.updatedAt) : 0;
    var timeB = sessionB.updatedAt ? Date.parse(sessionB.updatedAt) : 0;

    if (isNaN(timeA)) { timeA = 0; }
    if (isNaN(timeB)) { timeB = 0; }

    if (timeA >= timeB) { return sessionA; }
    return sessionB;
}

function applyDeletionsToFile(file, deletions) {
    if (!file) { return null; }
    var filtered = {
        schemaVersion: file.schemaVersion,
        format: file.format,
        studentId: file.studentId,
        displayName: file.displayName,
        legacyNameKeys: file.legacyNameKeys || [],
        createdAt: file.createdAt,
        updatedAt: file.updatedAt || new Date().toISOString(),
        sessions: []
    };

    var sessions = file.sessions || [];
    for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        if (!isSessionDeleted(s.id, file.studentId || "", deletions, s.updatedAt || s.createdAt)) {
            filtered.sessions.push(s);
        }
    }

    return filtered;
}

// ── Extended deletion records ──

function recordExtendedDeletion(type, studentId, sessionId, reason) {
    var deletions;
    try { deletions = getDeletionsData ? getDeletionsData() : {}; } catch (e) { deletions = {}; }
    if (typeof normalizeDeletionsData === "function") { deletions = normalizeDeletionsData(deletions || {}); }
    if (!deletions.deletedSessions) { deletions.deletedSessions = {}; }
    if (!Array.isArray(deletions.records)) { deletions.records = []; }
    var record = {
        id: createWftId("del"), type: type || "session", studentId: studentId || "",
        sessionId: sessionId || "", deletedAt: new Date().toISOString(),
        deviceId: getWftDeviceId(), reason: reason || "user-delete"
    };
    // Lamport clock stamp for WFT_LAMPORT_V1 (disabled by default)
    if (WFT_LAMPORT_V1) {
        try {
            record.lamportClock = incrementDeviceLamport();
        } catch (eLam) {
            record.lamportClock = 0;
        }
    }
    deletions.records.push(record);
    if ((record.type === "session" || record.type === "archive-remove") && record.sessionId) {
        deletions.deletedSessions["session:" + (record.studentId || "") + ":" + record.sessionId] = record;
    }
    try { if (typeof saveDeletionsData === "function") { saveDeletionsData(deletions); } } catch (e2) {}
    return record;
}

// ── Drive conflict handler ──

function syncStudentFileWithMerge(studentId, localData, callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) {
        if (callback) { callback(null, localData); }
        return;
    }

    loadStudentFileFromDrive(studentId, function(err, remoteFile) {
        if (err) {
            console.warn("[Merge] Could not load remote file for", studentId, ":", err.message);
            // Save local as authoritative
            saveStudentFileToDrive(studentId, localData, function(saveErr, fileId) {
                if (saveErr) { console.warn("[Merge] Could not save local student file after remote load failure for", studentId, ":", saveErr.message || saveErr); }
                if (callback) { callback(saveErr, localData); }
            });
            return;
        }

        if (!remoteFile) {
            // No remote file — save local
            saveStudentFileToDrive(studentId, localData, function(saveErr, fileId) {
                if (saveErr) { console.warn("[Merge] Could not save local student file after remote load failure for", studentId, ":", saveErr.message || saveErr); }
                if (callback) { callback(saveErr, localData); }
            });
            return;
        }

        // Get deletions
        var deletions = [];
        try { deletions = getDeletionsData ? getDeletionsData() : []; } catch (e) {}

        // Merge
        var merged = mergeStudentPortfolioFiles(localData, remoteFile, deletions);

        // Save merged
        saveStudentFileToDrive(studentId, merged, function(saveErr, fileId) {
            if (saveErr) { console.warn("[Merge] Could not save merged student file for", studentId, ":", saveErr.message || saveErr); }
            if (callback) { callback(saveErr, merged); }
        });
    });
}

// ── Rebuild index from student files ──

function rebuildIndexFromStudentFiles(studentFiles) {
    var index = {
        schemaVersion: 1,
        format: "portfolio-index-v1",
        updatedAt: new Date().toISOString(),
        source: "split-student-files",
        students: {}
    };

    if (!studentFiles) { return index; }

    var keys = Object.keys(studentFiles);
    for (var i = 0; i < keys.length; i++) {
        var file = studentFiles[keys[i]];
        if (!file || file.format !== "student-portfolio-v1") { continue; }

        var sessions = file.sessions || [];
        var latestSessionAt = "";
        var totalScore = 0;
        var scorableCount = 0;

        for (var j = 0; j < sessions.length; j++) {
            var s = sessions[j];
            if (s.createdAt && (!latestSessionAt || s.createdAt > latestSessionAt)) {
                latestSessionAt = s.createdAt;
            }
            if (typeof s.overallScore === "number" && !isNaN(s.overallScore)) {
                totalScore += s.overallScore;
                scorableCount += 1;
            }
        }

        var averageScore = scorableCount > 0 ? Math.round(totalScore / scorableCount) : 0;

        index.students[file.studentId] = {
            studentId: file.studentId,
            displayName: file.displayName,
            legacyNameKey: (file.legacyNameKeys && file.legacyNameKeys.length > 0) ? file.legacyNameKeys[0] : file.displayName,
            sessionCount: sessions.length,
            latestSessionAt: latestSessionAt,
            averageScore: averageScore,
            studentFileId: "",
            studentFileEtag: "",
            hasUnloadedDetails: true
        };
    }

    return index;
}

// ── Utility ──

function mergeStringArrays(arr1, arr2) {
    var seen = {};
    var result = [];
    for (var i = 0; i < arr1.length; i++) {
        if (!seen[arr1[i]]) {
            seen[arr1[i]] = true;
            result.push(arr1[i]);
        }
    }
    for (var j = 0; j < arr2.length; j++) {
        if (!seen[arr2[j]]) {
            seen[arr2[j]] = true;
            result.push(arr2[j]);
        }
    }
    return result;
}

function chooseOlderDate(a, b) {
    if (!a) { return b || new Date().toISOString(); }
    if (!b) { return a; }
    return (a < b) ? a : b;
}
