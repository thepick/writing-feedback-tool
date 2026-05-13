// =============================================================================
// WFT UPGRADE — Patch 11: Full Lazy Loading
// =============================================================================
// Startup loads only the lightweight index. Student files loaded on demand.

// ── Lazy-load student portfolio ──

function loadStudentPortfolioLazy(studentId, displayName, callback) {
    if (!WFT_LAZY_PORTFOLIO_LOAD_V1) {
        // Fallback: load full portfolio from localStorage
        try {
            var portfolio = getPortfolioData();
            var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
            callback(null, portfolio[resolvedKey] || { sessions: [] });
        } catch (e) {
            callback(e, null);
        }
        return;
    }

    // Check IndexedDB cache first
    var checkCache = WFT_INDEXEDDB_CACHE_V1 ? WftStorage.getStudentPortfolio(studentId) : Promise.resolve(null);

    checkCache.then(function(cached) {
        if (cached && cached.data) {
            console.log("[LazyLoad] Student found in local cache:", studentId);
            callback(null, cached.data);

            // Background refresh from Drive
            if (WFT_SPLIT_STUDENT_FILES_V1) {
                loadStudentFileFromDrive(studentId, function(err, remoteFile) {
                    if (!err && remoteFile) {
                        var localCacheTime = cached.cachedAt ? new Date(cached.cachedAt).getTime() : 0;
                        var remoteTime = remoteFile.updatedAt ? new Date(remoteFile.updatedAt).getTime() : 0;
                        if (remoteTime > localCacheTime) {
                            // Merge and update
                            WftStorage.saveStudentPortfolio(studentId, remoteFile);
                            syncStudentFileWithMerge(studentId, remoteFile, function() {});
                        }
                    }
                });
            }
            return;
        }

        // Not in cache — load from Drive or localStorage
        if (WFT_SPLIT_STUDENT_FILES_V1) {
            loadStudentFileFromDrive(studentId, function(err, remoteFile) {
                if (!err && remoteFile) {
                    // Cache it
                    if (WFT_INDEXEDDB_CACHE_V1) {
                        WftStorage.saveStudentPortfolio(studentId, remoteFile);
                    }
                    callback(null, remoteFile);
                } else {
                    // Fallback to legacy localStorage
                    try {
                        var portfolio = getPortfolioData();
                        var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
                        var legacyData = portfolio[resolvedKey] || { sessions: [] };
                        callback(null, { sessions: legacyData.sessions || [], displayName: displayName, studentId: studentId });
                    } catch (e) {
                        callback(e, null);
                    }
                }
            });
        } else {
            // No split files — use localStorage
            try {
                var portfolio = getPortfolioData();
                var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
                callback(null, portfolio[resolvedKey] || { sessions: [] });
            } catch (e) {
                callback(e, null);
            }
        }
    }).catch(function() {
        // IndexedDB failed — fallback
        try {
            var portfolio = getPortfolioData();
            var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
            callback(null, portfolio[resolvedKey] || { sessions: [] });
        } catch (e) {
            callback(e, null);
        }
    });
}

// ── Lazy image loader ──

function loadPortfolioImageLazy(image, callback) {
    if (!WFT_LAZY_PORTFOLIO_LOAD_V1) {
        // Use existing data URL or fetch from Drive
        if (image.dataUrl) { callback(null, image.dataUrl); return; }
        if (image.driveFileId && typeof dataUrlFromBlobForReassessment === "function") {
            dataUrlFromBlobForReassessment(null); // This needs the actual blob...
        }
        callback(null, null);
        return;
    }

    // Check thumbnail cache
    var imageId = image.imageId || image.driveFileId || "";
    if (imageId && WFT_INDEXEDDB_CACHE_V1) {
        WftStorage.getThumbnail(imageId).then(function(cached) {
            if (cached && cached.data) {
                callback(null, cached.data);
                return;
            }
            fetchImageFromDrive(image, callback);
        }).catch(function() {
            fetchImageFromDrive(image, callback);
        });
    } else {
        fetchImageFromDrive(image, callback);
    }
}

function fetchImageFromDrive(image, callback) {
    if (image.dataUrl) { callback(null, image.dataUrl); return; }
    if (!image.driveFileId) { callback(null, null); return; }

    // Use Google Drive API to download
    if (!driveAccessToken) { callback(null, null); return; }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://www.googleapis.com/drive/v3/files/" + image.driveFileId + "?alt=media", true);
    xhr.setRequestHeader("Authorization", "Bearer " + driveAccessToken);
    xhr.responseType = "blob";

    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            var blob = xhr.response;
            var reader = new FileReader();
            reader.onload = function() {
                var dataUrl = reader.result;
                // Cache thumbnail if available
                if (WFT_INDEXEDDB_CACHE_V1 && image.imageId) {
                    try {
                        createPortfolioThumbnailBlob({ dataUrl: dataUrl }, function(err, thumbBlob) {
                            if (!err && thumbBlob) {
                                WftStorage.saveThumbnail(image.imageId, thumbBlob);
                            }
                        });
                    } catch (e) {}
                }
                callback(null, dataUrl);
            };
            reader.readAsDataURL(blob);
        } else {
            callback(new Error("Drive download failed: " + xhr.status), null);
        }
    };
    xhr.onerror = function() { callback(new Error("Network error"), null); };
    xhr.send();
}

// ── Lazy portfolio startup ──

function initLazyPortfolioStartup() {
    if (!WFT_LAZY_PORTFOLIO_LOAD_V1) { return; }

    console.log("[LazyLoad] Initializing lazy portfolio startup...");

    // Load settings
    loadSettingsFromLocalStorage();

    // Init IndexedDB if enabled
    if (WFT_INDEXEDDB_CACHE_V1) {
        WftStorage.init().then(function() {
            console.log("[LazyLoad] Storage adapter:", WftStorage.mode);
        }).catch(function() {
            console.warn("[LazyLoad] Storage init failed — using localStorage");
        });
    }

    // Load portfolio index
    if (WFT_PORTFOLIO_INDEX_V1) {
        loadPortfolioIndexFromDrive(function(err, index) {
            if (index) {
                console.log("[LazyLoad] Index loaded:", Object.keys(index.students).length, "students");
                // Populate student dropdown from index
                populatePortfolioDropdownFromIndex(index);
            } else {
                // Build index from localStorage
                try {
                    var portfolio = getPortfolioData();
                    var localIndex = buildPortfolioIndexFromPortfolio(portfolio);
                    populatePortfolioDropdownFromIndex(localIndex);
                } catch (e) {
                    // Fall back to existing dropdown population
                    try { refreshPortfolioDropdown(); } catch (e2) {}
                }
            }
        });
    }
}

function populatePortfolioDropdownFromIndex(index) {
    if (!index || !index.students) { return; }

    var select = document.getElementById("portfolioStudentSelect");
    if (!select) { return; }

    // Preserve current selection
    var currentValue = select.value;

    // Clear and rebuild
    select.innerHTML = "";

    var option = document.createElement("option");
    option.value = "";
    option.textContent = "-- Select Student --";
    select.appendChild(option);

    var studentIds = Object.keys(index.students);
    studentIds.sort(function(a, b) {
        var nameA = index.students[a].displayName || a;
        var nameB = index.students[b].displayName || b;
        return nameA.localeCompare(nameB);
    });

    for (var i = 0; i < studentIds.length; i++) {
        var sid = studentIds[i];
        var entry = index.students[sid];
        var opt = document.createElement("option");
        opt.value = sid;
        opt.textContent = entry.displayName + " (" + entry.sessionCount + " sessions)";
        select.appendChild(opt);
    }

    // Restore selection
    if (currentValue) {
        for (var j = 0; j < select.options.length; j++) {
            if (select.options[j].value === currentValue) {
                select.selectedIndex = j;
                break;
            }
        }
    }
}
