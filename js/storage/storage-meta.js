// =============================================================================
// WFT UPGRADE — Storage Metadata Helpers (Patch 0)
// =============================================================================
// Manages wft_storage_meta in localStorage. This single metadata object
// tracks migration state, safe mode, and device identity.

var WFT_STORAGE_META_KEY = "wft_storage_meta";

// ── Core metadata accessors ──

function getWftStorageMeta() {
    try {
        var raw = localStorage.getItem(WFT_STORAGE_META_KEY);
        if (!raw) { return getDefaultWftStorageMeta(); }
        var parsed = JSON.parse(raw);
        return mergeWftStorageMetaDefaults(parsed);
    } catch (e) {
        console.warn("[StorageMeta] Failed to read metadata, using defaults:", e);
        return getDefaultWftStorageMeta();
    }
}

function setWftStorageMeta(meta) {
    try {
        var safeMeta = mergeWftStorageMetaDefaults(meta);
        safeMeta.updatedAt = new Date().toISOString();
        localStorage.setItem(WFT_STORAGE_META_KEY, JSON.stringify(safeMeta));
    } catch (e) {
        console.warn("[StorageMeta] Failed to write metadata:", e);
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

// ── Device ID ──

function getWftDeviceId() {
    var meta = getWftStorageMeta();
    if (!meta.deviceId) {
        meta.deviceId = "dev_" + generateWftShortId(8);
        setWftStorageMeta(meta);
    }
    return meta.deviceId;
}

// ── Lamport clock (deviceLamport) for WFT_LAMPORT_V1 ──
// Persistent counter stored in wft_storage_meta. ES5 compatible.
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

// ── Default metadata ──

function getDefaultWftStorageMeta() {
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

function mergeWftStorageMetaDefaults(meta) {
    var defaults = getDefaultWftStorageMeta();
    var keys = Object.keys(defaults);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!(k in meta)) { meta[k] = defaults[k]; }
    }
    // Ensure schemaVersion stays current
    meta.schemaVersion = WFT_STORAGE_SCHEMA_VERSION;
    return meta;
}

// ── Short ID generator (used for deviceId) ──

function generateWftShortId(len) {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var result = "";
    for (var i = 0; i < len; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Compatibility aliases for older/newer patch files.
if (typeof window !== "undefined") {
    if (typeof window._wftGenShortId !== "function") { window._wftGenShortId = generateWftShortId; }
    if (typeof window.generateWFTShortId !== "function") { window.generateWFTShortId = generateWftShortId; }
}

// ── Safe Mode ──

function enterWftStorageSafeMode(reason) {
    var meta = getWftStorageMeta();
    meta.safeMode = true;
    meta.safeModeReason = reason || "manual";
    setWftStorageMeta(meta);
    console.warn("[StorageSafeMode] ENTERED — reason:", reason);
}

function exitWftStorageSafeMode() {
    var meta = getWftStorageMeta();
    meta.safeMode = false;
    meta.safeModeReason = "";
    setWftStorageMeta(meta);
    console.log("[StorageSafeMode] EXITED");
}

function isWftStorageSafeMode() {
    var meta = getWftStorageMeta();
    return meta.safeMode === true;
}
