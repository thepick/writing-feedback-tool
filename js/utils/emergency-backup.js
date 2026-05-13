// =============================================================================
// WFT UPGRADE — Emergency Backup (Patch 0)
// =============================================================================
// Provides emergency backup/restore functionality for the entire app state.

// ── Build a comprehensive backup object ──

function buildWftEmergencyBackupObject() {
    var backup = {
        timestamp: new Date().toISOString(),
        appVersion: (typeof WFT_APP_VERSION !== "undefined") ? WFT_APP_VERSION : "unknown",
        schemaVersion: WFT_STORAGE_SCHEMA_VERSION,
        contents: {}
    };

    // Gather all relevant localStorage keys
    var keysToBackup = [
        "wft_settings",
        "wft_students",
        "wft_portfolio",
        "wft_deletions",
        "wft_storage_meta",
        "wft_selectedStudent",
        "wft_drive_folder_id",
        "wft_drive_settings_file_id",
        "wft_drive_portfolio_file_id",
        "wft_drive_deletions_file_id",
        "wft_google_user",
        "wft_google_connected"
    ];

    for (var i = 0; i < keysToBackup.length; i++) {
        var key = keysToBackup[i];
        try {
            var raw = localStorage.getItem(key);
            if (raw !== null && raw !== undefined) {
                try {
                    backup.contents[key] = JSON.parse(raw);
                } catch (parseErr) {
                    backup.contents[key] = raw;
                }
            }
        } catch (e) {
            backup.contents[key] = null;
        }
    }

    // Feature flag snapshot
    backup.featureFlags = {
        WFT_PROACTIVE_STRIP_V1: WFT_PROACTIVE_STRIP_V1,
        WFT_IMAGE_COMPRESSION_V1: WFT_IMAGE_COMPRESSION_V1,
        WFT_ASYNC_PORTFOLIO_ACCESS_V1: WFT_ASYNC_PORTFOLIO_ACCESS_V1,
        WFT_INDEXEDDB_CACHE_V1: WFT_INDEXEDDB_CACHE_V1,
        WFT_PORTFOLIO_INDEX_V1: WFT_PORTFOLIO_INDEX_V1,
        WFT_STUDENT_ID_MAP_V1: WFT_STUDENT_ID_MAP_V1,
        WFT_SPLIT_STUDENT_FILES_V1: WFT_SPLIT_STUDENT_FILES_V1,
        WFT_LAZY_PORTFOLIO_LOAD_V1: WFT_LAZY_PORTFOLIO_LOAD_V1,
        WFT_STORAGE_HEALTH_UI_V1: WFT_STORAGE_HEALTH_UI_V1,
        WFT_SYNC_ENGINE_V2: (typeof WFT_SYNC_ENGINE_V2 !== "undefined") ? WFT_SYNC_ENGINE_V2 : null
    };

    // Student list (from getPortfolioData if available)
    try {
        if (typeof getPortfolioData === "function") {
            var portfolio = getPortfolioData();
            backup.studentNames = Object.keys(portfolio).filter(function(k) {
                return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus";
            });
            backup.sessionCount = 0;
            for (var s = 0; s < backup.studentNames.length; s++) {
                var name = backup.studentNames[s];
                var studentData = portfolio[name];
                if (studentData && studentData.sessions) {
                    backup.sessionCount += studentData.sessions.length;
                }
            }
        }
    } catch (e) {
        backup.studentNames = [];
        backup.sessionCount = 0;
    }

    return backup;
}

// ── Download backup as a file ──

function downloadWftEmergencyBackup() {
    var backup = buildWftEmergencyBackupObject();
    var json = JSON.stringify(backup, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var ts = backup.timestamp.replace(/[:.]/g, "-");
    a.download = "wft-emergency-backup-" + ts + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("[EmergencyBackup] Downloaded:", a.download);
    return a.download;
}

// ── Save backup to Google Drive ──

function saveWftPreMigrationBackupToDrive(callback) {
    var backup = buildWftEmergencyBackupObject();
    var json = JSON.stringify(backup, null, 2);
    var filename = "wft-pre-migration-backup-" + backup.timestamp.replace(/[:.]/g, "-") + ".json";

    // Check if we have Drive access
    if (typeof isWftTokenValid !== "function" || !isWftTokenValid()) {
        console.warn("[EmergencyBackup] Not signed in to Drive — backup saved locally only");
        downloadWftEmergencyBackup();
        if (callback) { callback(null, "local-only"); }
        return;
    }

    // Use existing Drive upload function if available
    if (typeof saveFileToDrive === "function") {
        saveFileToDrive(filename, json, "application/json", function(err, fileId) {
            if (err) {
                console.error("[EmergencyBackup] Drive upload failed:", err);
                // Fall back to local download
                downloadWftEmergencyBackup();
                if (callback) { callback(err, "fallback-local"); }
            } else {
                console.log("[EmergencyBackup] Saved to Drive:", filename, fileId);
                if (callback) { callback(null, fileId); }
            }
        });
    } else {
        downloadWftEmergencyBackup();
        if (callback) { callback(null, "local-only"); }
    }
}
