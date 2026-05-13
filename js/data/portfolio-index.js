// =============================================================================
// WFT UPGRADE — Patch 6: Portfolio Index
// =============================================================================
// A lightweight summary (portfolio-index.json) that can load quickly.
// The full wft-portfolio.json remains the source of truth during this patch;
// portfolio-index.json is derived from it.

// ── Cached Drive file ID and dirty flag ──
// These are declared inline in index.html near other Drive cache keys

// ── Index helpers ──

function markWftPortfolioIndexDirty(reason) {
    if (!WFT_PORTFOLIO_INDEX_V1 || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) { return; }
    // Store dirty flag in wftSyncState or settings
    try {
        var raw = localStorage.getItem("wft_settings");
        if (raw) {
            var settings = JSON.parse(raw);
            settings._indexDirty = true;
            settings._indexDirtyReason = reason || "portfolio-change";
            settings._indexDirtyAt = new Date().toISOString();
            localStorage.setItem("wft_settings", JSON.stringify(settings));
        }
    } catch (e) {
        console.warn("[PortfolioIndex] Failed to mark dirty:", e);
    }
}

function isWftPortfolioIndexDirty() {
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) { return false; }
    try {
        var raw = localStorage.getItem("wft_settings");
        if (raw) {
            var settings = JSON.parse(raw);
            return settings._indexDirty === true;
        }
    } catch (e) {}
    return false;
}

function clearWftPortfolioIndexDirty() {
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) { return; }
    try {
        var raw = localStorage.getItem("wft_settings");
        if (raw) {
            var settings = JSON.parse(raw);
            delete settings._indexDirty;
            delete settings._indexDirtyReason;
            delete settings._indexDirtyAt;
            localStorage.setItem("wft_settings", JSON.stringify(settings));
        }
    } catch (e) {}
}

// ── Build portfolio index ──

function buildPortfolioIndexFromPortfolio(portfolio) {
    var index = {
        schemaVersion: 1,
        format: "portfolio-index-v1",
        updatedAt: new Date().toISOString(),
        source: "legacy-wft-portfolio",
        students: {}
    };

    if (!portfolio) { return index; }

    var names = Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });

    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var studentData = portfolio[name];
        if (!studentData || (!studentData.sessions && !Array.isArray(studentData))) { continue; }

        var sessions = Array.isArray(studentData) ? studentData : (studentData.sessions || []);
        var studentId = "";

        // Use stable ID if available
        if (WFT_STUDENT_ID_MAP_V1) {
            try {
                var settings = getRawSettings ? getRawSettings() : {};
                if (settings.studentIdMap && settings.studentIdMap[name]) {
                    studentId = settings.studentIdMap[name];
                }
            } catch (e) {}
        }

        // Compute session stats
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

        // Check for cached student file ID
        var studentFileId = "";
        var cacheKey = "wft_drive_student_file_" + (studentId || sanitizeStudentIdPart(name));
        try {
            studentFileId = localStorage.getItem(cacheKey) || "";
        } catch (e) {}

        index.students[studentId || name] = {
            studentId: studentId || "",
            displayName: name,
            legacyNameKey: name,
            sessionCount: sessions.length,
            latestSessionAt: latestSessionAt,
            averageScore: averageScore,
            studentFileId: studentFileId,
            studentFileEtag: "",
            hasUnloadedDetails: true
        };
    }

    return index;
}

// ── Save/Load index to/from Drive ──

function savePortfolioIndexToDrive(index, callback) {
    if (!WFT_PORTFOLIO_INDEX_V1) {
        if (callback) { callback(null, "feature-disabled"); }
        return;
    }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        if (callback) { callback(null, "safe-mode"); }
        return;
    }

    var filename = "portfolio-index.json";
    if (typeof uploadWftJsonFilePromise === "function" && typeof isWftTokenValid === "function" && isWftTokenValid()) {
        uploadWftJsonFilePromise(filename, index).then(function(fileId) {
            if (fileId) {
                try {
                    if (typeof setCachedWftDriveFileId === "function") { setCachedWftDriveFileId(filename, fileId); }
                    else { localStorage.setItem("wft_drive_portfolio_index_file_id", fileId); }
                } catch (e) {}
            }
            clearWftPortfolioIndexDirty();
            if (callback) { callback(null, fileId || "saved"); }
        }).catch(function(err) {
            if (callback) { callback(err, null); }
        });
    } else if (typeof saveFileToDrive === "function" && typeof isWftTokenValid === "function" && isWftTokenValid()) {
        saveFileToDrive(filename, JSON.stringify(index, null, 2), "application/json", function(err, fileId) {
            if (!err && fileId) {
                try {
                    if (typeof setCachedWftDriveFileId === "function") { setCachedWftDriveFileId(filename, fileId); }
                    else { localStorage.setItem("wft_drive_portfolio_index_file_id", fileId); }
                } catch (e) {}
                clearWftPortfolioIndexDirty();
            }
            if (callback) { callback(err, fileId); }
        });
    } else {
        if (callback) { callback(null, "local-only"); }
    }
}

function loadPortfolioIndexFromDrive(callback) {
    if (!WFT_PORTFOLIO_INDEX_V1) {
        if (callback) { callback(null, null); }
        return;
    }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        if (callback) { callback(null, null); }
        return;
    }

    var cachedFileId = "";
    try { cachedFileId = (typeof getCachedWftDriveFileId === "function" ? getCachedWftDriveFileId("portfolio-index.json") : localStorage.getItem("wft_drive_portfolio_index_file_id")) || ""; } catch (e) {}

    if (cachedFileId && typeof downloadWftJsonFilePromise === "function") {
        downloadWftJsonFilePromise(cachedFileId)
            .then(function(data) {
                if (data && data.format === "portfolio-index-v1") {
                    console.log("[PortfolioIndex] Loaded from Drive");
                    callback(null, data);
                } else {
                    callback(null, null);
                }
            })
            .catch(function(err) {
                console.warn("[PortfolioIndex] Drive load failed, will rebuild:", err);
                callback(err, null);
            });
    } else {
        // Try finding by name
        if (typeof findWftFilesByNamePromise === "function" && typeof isWftTokenValid === "function" && isWftTokenValid()) {
            findWftFilesByNamePromise("portfolio-index.json")
                .then(function(files) {
                    if (files && files.length > 0) {
                        var canonical = (typeof chooseCanonicalWftFile === "function") ? chooseCanonicalWftFile(files) : files[0];
                        var fileId = canonical && canonical.id ? canonical.id : "";
                        if (fileId) {
                            try { if (typeof setCachedWftDriveFileId === "function") { setCachedWftDriveFileId("portfolio-index.json", fileId); } else { localStorage.setItem("wft_drive_portfolio_index_file_id", fileId); } } catch (e) {}
                            if (typeof downloadWftJsonFilePromise === "function") {
                                return downloadWftJsonFilePromise(fileId);
                            }
                        }
                    }
                    return null;
                })
                .then(function(data) {
                    if (data && data.format === "portfolio-index-v1") {
                        callback(null, data);
                    } else {
                        callback(null, null);
                    }
                })
                .catch(function(err) {
                    callback(err, null);
                });
        } else {
            callback(null, null);
        }
    }
}

// ── Rebuild index ──

function rebuildPortfolioIndex(callback) {
    if (!WFT_PORTFOLIO_INDEX_V1) {
        if (callback) { callback(null, null); }
        return;
    }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        if (callback) { callback(null, null); }
        return;
    }

    var portfolio;
    try {
        portfolio = getPortfolioData();
    } catch (e) {
        console.error("[PortfolioIndex] Failed to get portfolio:", e);
        if (callback) { callback(e, null); }
        return;
    }

    var index = buildPortfolioIndexFromPortfolio(portfolio);

    // Also ensure stable IDs for all students
    if (WFT_STUDENT_ID_MAP_V1) {
        var names = Object.keys(index.students);
        for (var i = 0; i < names.length; i++) {
            var entry = index.students[names[i]];
            if (!entry.studentId) {
                try { entry.studentId = getOrCreateStudentId(entry.displayName); } catch (e) {}
            }
        }
        index.updatedAt = new Date().toISOString();
    }

    savePortfolioIndexToDrive(index, function(err, fileId) {
        if (err) {
            console.warn("[PortfolioIndex] Rebuild — Drive save failed:", err);
        } else {
            updateWftStorageMeta("patch-6-index", "rebuilt");
            console.log("[PortfolioIndex] Rebuilt successfully, fileId:", fileId);
        }
        if (callback) { callback(err, index); }
    });
}
