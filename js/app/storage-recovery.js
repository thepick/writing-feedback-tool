// PATCH 0 — STORAGE METADATA, SAFE MODE & EMERGENCY BACKUP
// ═══════════════════════════════════════════════════════════════════════════

var WFT_STORAGE_META_KEY = "wft_storage_meta";

// ── Short ID generator ──
function _wftGenShortId(len) {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var result = "";
    for (var i = 0; i < len; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
function generateWftShortId(len) { return _wftGenShortId(len || 8); }

// ── Storage metadata helpers ──
function _wftDefaultStorageMeta() {
    return {
        schemaVersion: WFT_STORAGE_SCHEMA_VERSION,
        activePortfolioFormat: "legacy-name-keyed",
        migrationStartedAt: "",
        migrationCompletedAt: "",
        lastSuccessfulPatch: "",
        deviceId: "",
        safeMode: false,
        safeModeReason: "",
        patchHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function getWftStorageMeta() {
    try {
        var raw = localStorage.getItem(WFT_STORAGE_META_KEY);
        if (!raw) { return _wftDefaultStorageMeta(); }
        var meta = JSON.parse(raw);
        // Merge defaults for any missing keys
        var defaults = _wftDefaultStorageMeta();
        var keys = Object.keys(defaults);
        for (var mi = 0; mi < keys.length; mi++) {
            var mk = keys[mi];
            if (!(mk in meta)) { meta[mk] = defaults[mk]; }
        }
        meta.schemaVersion = WFT_STORAGE_SCHEMA_VERSION;
        return meta;
    } catch (e) {
        wftDebugWarn("[StorageMeta] Read failed:", e);
        return _wftDefaultStorageMeta();
    }
}

function setWftStorageMeta(meta) {
    try {
        meta.updatedAt = new Date().toISOString();
        meta.schemaVersion = WFT_STORAGE_SCHEMA_VERSION;
        localStorage.setItem(WFT_STORAGE_META_KEY, JSON.stringify(meta));
        return true;
    } catch (e) {
        wftDebugWarn("[StorageMeta] Write failed:", e);
        return false;
    }
}

function updateWftStorageMeta(patchName, status) {
    var meta = getWftStorageMeta();
    meta.lastSuccessfulPatch = patchName;
    if (!meta.patchHistory) { meta.patchHistory = []; }
    meta.patchHistory.push({
        patch: patchName,
        status: status,
        timestamp: new Date().toISOString()
    });
    setWftStorageMeta(meta);
}

function getWftDeviceId() {
    var meta = getWftStorageMeta();
    if (!meta.deviceId) {
        meta.deviceId = "dev_" + _wftGenShortId(10);
        setWftStorageMeta(meta);
    }
    return meta.deviceId;
}

// ── Lamport clock helpers ──
// Persistent per-device counter used to order deletes and edits across devices.
function getDeviceLamport() {
    var meta = getWftStorageMeta();
    if (typeof meta.deviceLamport !== "number" || isNaN(meta.deviceLamport)) {
        meta.deviceLamport = 0;
        setWftStorageMeta(meta);
    }
    return meta.deviceLamport;
}

function incrementDeviceLamport() {
    var meta = getWftStorageMeta();
    var current = (typeof meta.deviceLamport === "number" && !isNaN(meta.deviceLamport)) ? meta.deviceLamport : 0;
    meta.deviceLamport = current + 1;
    setWftStorageMeta(meta);
    return meta.deviceLamport;
}

// ── Safe Mode ──
function enterWftStorageSafeMode(reason) {
    var meta = readWftRequiredStorage(WFT_STORAGE_META_KEY);
    meta.safeMode = true;
    meta.safeModeReason = reason || "manual";
    if (!setWftStorageMeta(meta)) return false;
    wftDebugWarn("[SafeMode] ENTERED — reason:", reason);
    // If a UI notification function exists, show a banner
    if (typeof setDriveSyncStatus === "function") {
        setDriveSyncStatus("warning", "Safe mode active — " + (reason || "manual override"));
    }
    return true;
}

function exitWftStorageSafeMode() {
    var meta = readWftRequiredStorage(WFT_STORAGE_META_KEY);
    meta.safeMode = false;
    meta.safeModeReason = "";
    if (!setWftStorageMeta(meta)) return false;
    wftDebugLog("[SafeMode] EXITED");
    return true;
}

function toggleWftSafeMode() {
    try {
        var changed = isWftStorageSafeMode() ? exitWftStorageSafeMode() : enterWftStorageSafeMode("manual-toggle");
        if (!changed) throw new Error("Browser storage write failed.");
    } catch (e) {
        alert("Safe mode could not be changed. Check browser storage and retry. " + e.message);
    }
    refreshStorageHealthUI();
}

function isWftStorageSafeMode() {
    return getWftStorageMeta().safeMode === true;
}

// ── Emergency Backup ──
var wftStudentChangeRecovery = null;

function readWftStudentChangeStorage(key) {
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery && Object.prototype.hasOwnProperty.call(wftStudentChangeRecovery, key)) {
        return wftStudentChangeRecovery[key];
    }
    return localStorage.getItem(key);
}

function readWftRequiredStorage(key) {
    var raw = readWftStudentChangeStorage(key);
    var data = raw === null ? (key === 'wft_students' ? [] : {}) : JSON.parse(raw);
    validateWftRequiredStorage(key, data);
    return data;
}

function validateWftRequiredStorage(key, data) {
    var object = data && typeof data === 'object' && !Array.isArray(data);
    var valid = key === 'wft_students' ? Array.isArray(data) : object;
    if (valid && key === WFT_DELETIONS_STORAGE_KEY) {
        ['deletedStudents', 'restoredStudents', 'deletedSessions'].forEach(function(field) {
            if (!Object.prototype.hasOwnProperty.call(data, field)) return;
            var map = data[field];
            if (!map || typeof map !== 'object' || Array.isArray(map)) { valid = false; return; }
            Object.keys(map).forEach(function(id) {
                if (!map[id] || typeof map[id] !== 'object' || Array.isArray(map[id])) valid = false;
            });
        });
        ['records', 'deletionLog'].forEach(function(field) {
            if (Object.prototype.hasOwnProperty.call(data, field) && !Array.isArray(data[field])) valid = false;
        });
    }
    var checkSettings = valid && key === 'wft_settings';
    if (checkSettings && Object.prototype.hasOwnProperty.call(data, 'students') && !Array.isArray(data.students)) valid = false;
    if (!valid) throw new Error('Saved ' + key + ' data could not be read. Download Emergency Backup and repair the saved data before retrying.');
}

function preflightWftRequiredStorage() {
    if (wftApiKeyStorageRecovery && wftApiKeyStorageRecovery.some(function(entry) { return entry.key === 'wft_settings'; })) throw getWftApiKeyStorageError();
    readWftRequiredStorage('wft_settings');
    readWftRequiredStorage('wft_students');
    normalizeDeletionsData(readWftRequiredStorage(WFT_DELETIONS_STORAGE_KEY));
}

function getWftStudentChangeRecoveryError() {
    var error = new Error('The changes could not be saved, and browser storage could not restore all of the original data. The original data is available in this tab. Download Emergency Backup and keep this tab open, then retry when browser storage is working. Cloud sync is paused.');
    error.wftStudentChangeRecovery = true;
    return error;
}

function restoreWftStudentChangeStorage(previous) {
    var restored = true;
    Object.keys(previous).reverse().forEach(function(key) {
        try {
            if (localStorage.getItem(key) === previous[key]) return;
            if (previous[key] === null) localStorage.removeItem(key);
            else localStorage.setItem(key, previous[key]);
        } catch (e) {
            restored = false;
            wftDebugError('Student change could not restore ' + key + ':', e);
        }
    });
    return restored;
}

function parseWftBackupValue(raw) {
    try { return JSON.parse(raw); }
    catch (e) { return raw; }
}

function buildWftEmergencyBackupObject() {
    var backup = {
        timestamp: new Date().toISOString(),
        appVersion: "v9",
        schemaVersion: WFT_STORAGE_SCHEMA_VERSION,
        featureFlags: {
            WFT_PROACTIVE_STRIP_V1: WFT_PROACTIVE_STRIP_V1,
            WFT_IMAGE_COMPRESSION_V1: WFT_IMAGE_COMPRESSION_V1,
            WFT_ASYNC_PORTFOLIO_ACCESS_V1: WFT_ASYNC_PORTFOLIO_ACCESS_V1,
            WFT_INDEXEDDB_CACHE_V1: WFT_INDEXEDDB_CACHE_V1,
            WFT_PORTFOLIO_INDEX_V1: WFT_PORTFOLIO_INDEX_V1,
            WFT_STUDENT_ID_MAP_V1: WFT_STUDENT_ID_MAP_V1,
            WFT_SPLIT_STUDENT_FILES_V1: WFT_SPLIT_STUDENT_FILES_V1,
            WFT_LAZY_PORTFOLIO_LOAD_V1: WFT_LAZY_PORTFOLIO_LOAD_V1,
            WFT_STORAGE_HEALTH_UI_V1: WFT_STORAGE_HEALTH_UI_V1,
            WFT_SYNC_ENGINE_V2: WFT_SYNC_ENGINE_V2,
            WFT_GIS_AUTH_V2: WFT_GIS_AUTH_V2,
            WFT_LAMPORT_V1: WFT_LAMPORT_V1,
            WFT_BROADCAST_CHANNEL_V1: WFT_BROADCAST_CHANNEL_V1
        },
        contents: {}
    };

    var keysToBackup = [
        "wft_settings", "wft_students", "wft_portfolio",
        "wft_deletions", "wft_storage_meta", "wft_selectedStudent",
        "wft_drive_folder_id", "wft_drive_settings_file_id",
        "wft_drive_portfolio_file_id", "wft_drive_deletions_file_id",
        "wft_google_user", "wft_google_connected", "wft_pending_portfolio_sync_v1",
        "wft_oauth_textarea_draft_v1"
    ];

    for (var bi = 0; bi < keysToBackup.length; bi++) {
        var bk = keysToBackup[bi];
        try {
            var raw = readWftStudentChangeStorage(bk);
            if (raw === null) continue;
            var value = bk === 'wft_settings' ? JSON.parse(raw) : parseWftBackupValue(raw);
            if (bk === 'wft_settings') {
                // Raw or invalid settings cannot be safely exported with credentials removed.
                validateWftRequiredStorage(bk, value);
                delete value.apiKey;
            }
            backup.contents[bk] = value;
        } catch (e) {
            backup.contents[bk] = null;
            backup.readErrors = backup.readErrors || [];
            backup.readErrors.push(bk);
        }
    }

    // The quota fallback may have removed photos from the persisted pending record.
    if (typeof pendingPortfolioSync !== 'undefined' && pendingPortfolioSync) backup.pendingPortfolioSync = cloneWftJson(pendingPortfolioSync);

    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) {
        backup.studentChangeRecovery = Object.assign({}, wftStudentChangeRecovery);
        if (Object.prototype.hasOwnProperty.call(wftStudentChangeRecovery, 'wft_settings')) {
            var recoveredSettings = backup.contents.wft_settings;
            backup.studentChangeRecovery.wft_settings = recoveredSettings == null ? null : JSON.stringify(recoveredSettings);
        }
    }

    // Add student/session counts from portfolio
    try {
        var pf = getPortfolioData();
        var names = Object.keys(pf).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });
        backup.studentNames = names;
        backup.sessionCount = 0;
        for (var sn = 0; sn < names.length; sn++) {
            var sd = pf[names[sn]];
            if (sd && sd.sessions) { backup.sessionCount += sd.sessions.length; }
        }
    } catch (e) {
        backup.studentNames = [];
        backup.sessionCount = 0;
    }

    return backup;
}

function downloadWftEmergencyBackup(backup) {
    var url, a;
    try {
        backup = backup || buildWftEmergencyBackupObject();
        var json = JSON.stringify(backup, null, 2);
        var blob = new Blob([json], { type: "application/json" });
        url = URL.createObjectURL(blob);
        a = document.createElement("a");
        a.href = url;
        var ts = backup.timestamp.replace(/[:.]/g, "-");
        a.download = "wft-emergency-backup-" + ts + ".json";
        document.body.appendChild(a);
        a.click();
        alert("Backup download started. Keep this tab open until you verify the file." + (backup.readErrors ? " Backup is incomplete: some local data could not be read. Verify the file and retry when browser storage is working." : ""));
        return a.download;
    } catch (e) {
        wftDebugError("[EmergencyBackup] Download failed:", e);
        alert("Emergency backup download failed. Keep this tab open and retry. " + e.message);
        return false;
    } finally {
        if (a && a.parentNode) a.parentNode.removeChild(a);
        if (url) URL.revokeObjectURL(url);
    }
}

function saveWftPreMigrationBackupToDrive(callback) {
    var backup, completed = false;
    function finish(err, result) {
        if (completed) return;
        completed = true;
        if (callback) callback(err, result);
    }
    function fallback(err) {
        if (completed) return;
        if (err && typeof setDriveSyncStatus === "function") setDriveSyncStatus("error", "Drive backup failed; local download attempted.");
        var downloaded = downloadWftEmergencyBackup(backup);
        finish(downloaded ? err : new Error("Emergency backup download failed. Keep this tab open and retry."), downloaded ? (err ? "fallback-local" : "local-only") : null);
    }
    try {
        backup = buildWftEmergencyBackupObject();
        var json = JSON.stringify(backup, null, 2);
        var filename = "wft-pre-migration-" + backup.timestamp.replace(/[:.]/g, "-") + ".json";
        if (typeof isWftTokenValid !== "function" || !isWftTokenValid() || typeof saveFileToDrive !== "function") { fallback(null); return; }
        saveFileToDrive(filename, json, "application/json", function(err, fileId) {
            if (completed) return;
            if (!err && (typeof fileId !== "string" || !fileId.trim())) err = new Error("Drive did not acknowledge the backup file.");
            if (err) {
                wftDebugError("[EmergencyBackup] Drive upload failed:", err);
                fallback(err);
            } else {
                wftDebugLog("[EmergencyBackup] Saved to Drive:", filename, fileId);
                alert("Backup saved to Google Drive." + (backup.readErrors ? " Backup is incomplete: some local data could not be read. Keep this tab open, verify the file and retry when browser storage is working." : ""));
                finish(null, fileId);
            }
        });
    } catch (e) {
        wftDebugError("[EmergencyBackup] Drive backup failed:", e);
        fallback(e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 0
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
