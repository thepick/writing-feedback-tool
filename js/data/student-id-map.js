// =============================================================================
// WFT UPGRADE — Patch 7: Student ID Map
// =============================================================================
// Creates stable student identities with a map stored in settings.
// Does NOT break the legacy name-keyed portfolio.

// ── Student record lookup ──

function getStudentRecordByName(name) {
    try {
        var settings = getRawSettings ? getRawSettings() : {};
        if (!settings.studentRecords) { return null; }
        for (var i = 0; i < settings.studentRecords.length; i++) {
            var rec = settings.studentRecords[i];
            if (rec.displayName === name) { return rec; }
            if (rec.legacyNameKeys && rec.legacyNameKeys.indexOf(name) !== -1) { return rec; }
        }
    } catch (e) {}
    return null;
}

function getStudentRecordById(studentId) {
    try {
        var settings = getRawSettings ? getRawSettings() : {};
        if (!settings.studentRecords) { return null; }
        for (var i = 0; i < settings.studentRecords.length; i++) {
            if (settings.studentRecords[i].studentId === studentId) { return settings.studentRecords[i]; }
        }
    } catch (e) {}
    return null;
}

// ── Ensure all roster students have records ──

function ensureStudentRecordsForRoster() {
    if (!WFT_STUDENT_ID_MAP_V1) { return; }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) { return; }

    try {
        var settings = getRawSettings ? getRawSettings() : {};
        if (!settings.studentRecords) { settings.studentRecords = []; }
        if (!settings.studentIdMap) { settings.studentIdMap = {}; }

        var rosterStudents = [];
        try {
            if (typeof loadStudents === "function") { loadStudents(); }
            if (typeof students !== "undefined" && Array.isArray(students)) {
                rosterStudents = students.slice(0);
            }
        } catch (e) {
            rosterStudents = [];
        }

        try {
            var portfolio = getPortfolioData();
            var pNames = Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });
            for (var pni = 0; pni < pNames.length; pni++) {
                if (rosterStudents.indexOf(pNames[pni]) === -1) { rosterStudents.push(pNames[pni]); }
            }
        } catch (e) {}

        for (var i = 0; i < rosterStudents.length; i++) {
            var name = rosterStudents[i];
            if (!settings.studentIdMap[name]) {
                settings.studentIdMap[name] = createStableStudentId(name, settings.studentIdMap);
            }
            var rec = getStudentRecordByName(name);
            if (!rec) {
                settings.studentRecords.push({
                    studentId: settings.studentIdMap[name],
                    displayName: name,
                    legacyNameKeys: [name],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }

        if (typeof saveSettingsToLocalStorage === "function") {
            saveSettingsToLocalStorage(settings);
        }
    } catch (e) {
        console.warn("[StudentIdMap] ensureStudentRecordsForRoster failed:", e.message);
    }
}
function resolveStudentPortfolioKey(studentNameOrId) {
    // First try direct match
    try {
        var portfolio = getPortfolioData();
        if (portfolio[studentNameOrId]) { return studentNameOrId; }
    } catch (e) {}

    // Try ID map lookup
    if (WFT_STUDENT_ID_MAP_V1) {
        try {
            var settings = getRawSettings ? getRawSettings() : {};
            if (settings.studentIdMap) {
                var keys = Object.keys(settings.studentIdMap);
                for (var i = 0; i < keys.length; i++) {
                    if (settings.studentIdMap[keys[i]] === studentNameOrId) {
                        return keys[i];
                    }
                }
            }
        } catch (e) {}
    }

    // Not found, return as-is
    return studentNameOrId;
}

// ── Rename handler ──

function updateStudentRecordOnRename(oldName, newName) {
    if (!WFT_STUDENT_ID_MAP_V1) { return; }

    try {
        var settings = getRawSettings ? getRawSettings() : {};
        if (!settings.studentIdMap) { settings.studentIdMap = {}; }
        if (!settings.studentRecords) { settings.studentRecords = []; }

        // Keep or create student ID
        var studentId = settings.studentIdMap[oldName];
        if (!studentId) {
            studentId = getOrCreateStudentId(oldName);
        }

        // Add new name mapping
        settings.studentIdMap[newName] = studentId;

        // Update student record
        var found = false;
        for (var i = 0; i < settings.studentRecords.length; i++) {
            var rec = settings.studentRecords[i];
            if (rec.studentId === studentId || rec.displayName === oldName) {
                rec.displayName = newName;
                if (!rec.legacyNameKeys) { rec.legacyNameKeys = []; }
                if (rec.legacyNameKeys.indexOf(oldName) === -1) {
                    rec.legacyNameKeys.push(oldName);
                }
                rec.updatedAt = new Date().toISOString();
                found = true;
                break;
            }
        }

        if (!found) {
            settings.studentRecords.push({
                studentId: studentId,
                displayName: newName,
                legacyNameKeys: [oldName, newName],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        // Move portfolio data from old name to new name
        try {
            var portfolio = getPortfolioData();
            if (portfolio[oldName] && !portfolio[newName]) {
                portfolio[newName] = portfolio[oldName];
                delete portfolio[oldName];
                savePortfolioData(portfolio);
            }
        } catch (e) {
            console.warn("[StudentIdMap] Portfolio rename failed:", e);
        }

        if (typeof saveSettingsToLocalStorage === "function") {
            saveSettingsToLocalStorage(settings);
        }
    } catch (e) {
        console.warn("[StudentIdMap] updateStudentRecordOnRename failed:", e);
    }
}
