// =============================================================================
// WFT UPGRADE — Patch 9: Per-Student Drive Files
// =============================================================================
// Stops relying on one huge wft-portfolio.json as the active cloud portfolio.
// Creates students/ folder and one JSON file per student in Google Drive.
// wft-portfolio.json is left untouched as legacy backup.

// ── Cached folder IDs ──
var WFT_DRIVE_STUDENTS_FOLDER_ID_KEY = "wft_drive_students_folder_id";
var WFT_DRIVE_MEDIA_FOLDER_ID_KEY = "wft_drive_media_folder_id";

// ── Folder ensure functions ──

function ensureWftSubfolderPromise(folderName, parentFolderId) {
    if (!parentFolderId) { return Promise.reject(new Error("No parent folder ID")); }
    return findWftFilesByNameInFolderPromise(folderName, parentFolderId).then(function(files) {
        for (var fi = 0; fi < files.length; fi++) {
            if (files[fi].mimeType === "application/vnd.google-apps.folder") { return files[fi].id; }
        }
        return createWftSubfolder(folderName, parentFolderId);
    });
}

function createWftSubfolder(folderName, parentFolderId) {
    return new Promise(function(resolve, reject) {
        if (!driveAccessToken) {
            reject(new Error("Not signed in"));
            return;
        }

        var metadata = {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentFolderId]
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://www.googleapis.com/drive/v3/files", true);
        xhr.setRequestHeader("Authorization", "Bearer " + driveAccessToken);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var result = JSON.parse(xhr.responseText);
                    console.log("[DriveFolders] Created folder:", folderName, result.id);
                    resolve(result.id);
                } catch (e) {
                    reject(new Error("Failed to parse folder creation response"));
                }
            } else {
                reject(new Error("Failed to create folder: " + xhr.status));
            }
        };

        xhr.onerror = function() {
            reject(new Error("Network error creating folder"));
        };

        xhr.send(JSON.stringify(metadata));
    });
}

function ensureWftStudentsFolderPromise() {
    var cachedId = "";
    try { cachedId = localStorage.getItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY) || ""; } catch (e) {}

    if (cachedId) {
        // Verify it still exists
        if (typeof validateCachedDriveFilePromise === "function") {
            return validateCachedDriveFilePromise(cachedId, "students", getWftDriveFolderId())
                .then(function(validId) {
                    if (validId) {
                        try { localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, validId); } catch (e) {}
                        return validId;
                    }
                    // Create fresh
                    return ensureWftSubfolderPromise("students", getWftDriveFolderId()).then(function(newId) {
                        try { localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, newId); } catch (e) {}
                        return newId;
                    });
                });
        }
    }

    return ensureWftSubfolderPromise("students", getWftDriveFolderId()).then(function(newId) {
        try { localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, newId); } catch (e) {}
        return newId;
    });
}

function ensureWftMediaFolderPromise() {
    var cachedId = "";
    try { cachedId = localStorage.getItem(WFT_DRIVE_MEDIA_FOLDER_ID_KEY) || ""; } catch (e) {}

    if (cachedId) {
        if (typeof validateCachedDriveFilePromise === "function") {
            return validateCachedDriveFilePromise(cachedId, "media", getWftDriveFolderId())
                .then(function(validId) {
                    if (validId) {
                        try { localStorage.setItem(WFT_DRIVE_MEDIA_FOLDER_ID_KEY, validId); } catch (e) {}
                        return validId;
                    }
                    return ensureWftSubfolderPromise("media", getWftDriveFolderId()).then(function(newId) {
                        try { localStorage.setItem(WFT_DRIVE_MEDIA_FOLDER_ID_KEY, newId); } catch (e) {}
                        return newId;
                    });
                });
        }
    }

    return ensureWftSubfolderPromise("media", getWftDriveFolderId()).then(function(newId) {
        try { localStorage.setItem(WFT_DRIVE_MEDIA_FOLDER_ID_KEY, newId); } catch (e) {}
        return newId;
    });
}

function ensureWftStudentMediaFolderPromise(studentId) {
    var cacheKey = "wft_drive_media_folder_" + studentId;
    var cachedId = "";
    try { cachedId = localStorage.getItem(cacheKey) || ""; } catch (e) {}

    return ensureWftMediaFolderPromise().then(function(mediaFolderId) {
        if (cachedId) {
            if (typeof validateCachedDriveFilePromise === "function") {
                return validateCachedDriveFilePromise(cachedId, "student-" + studentId, mediaFolderId)
                    .then(function(validId) {
                        if (validId) { return validId; }
                        return ensureWftSubfolderPromise("student-" + studentId, mediaFolderId).then(function(newId) {
                            try { localStorage.setItem(cacheKey, newId); } catch (e) {}
                            return newId;
                        });
                    });
            }
        }
        return ensureWftSubfolderPromise("student-" + studentId, mediaFolderId).then(function(newId) {
            try { localStorage.setItem(cacheKey, newId); } catch (e) {}
            return newId;
        });
    });
}

// ── Helper to get root Drive folder ID ──

function getWftDriveFolderId() {
    if (driveFolderId) { return driveFolderId; }
    try { return localStorage.getItem("wft_drive_folder_id") || ""; } catch (e) {}
    return "";
}


function findWftFilesByNameInFolderPromise(filename, folderId) {
    if (!folderId) { return Promise.resolve([]); }
    var query = "name='" + escapeDriveQueryValue(filename) + "'" + " and '" + escapeDriveQueryValue(folderId) + "' in parents" + " and trashed=false";
    var url = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id,name,modifiedTime,createdTime,size,mimeType)&orderBy=modifiedTime desc";
    return wftDriveFetch(url).then(function(response) { return response.json(); }).then(function(data) { return data && data.files ? data.files : []; });
}

function saveJsonToDriveFolderPromise(filename, data, folderId) {
    return findWftFilesByNameInFolderPromise(filename, folderId).then(function(files) {
        var existing = typeof chooseCanonicalWftFile === "function" ? chooseCanonicalWftFile(files) : (files && files[0]);
        var url = existing && existing.id ? "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(existing.id) + "?uploadType=multipart&fields=id,name,modifiedTime" : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime";
        var method = existing && existing.id ? "PATCH" : "POST";
        var boundary = "----WFTStudentFileBoundary" + Date.now();
        var metadata = existing && existing.id ? {} : { name: filename, parents: [folderId], mimeType: "application/json" };
        var body = new Blob(["--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n", "--" + boundary + "\r\nContent-Type: application/json\r\n\r\n", JSON.stringify(data || {}, null, 2), "\r\n--" + boundary + "--"], { type: "multipart/related; boundary=" + boundary });
        return wftDriveFetch(url, { method: method, headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body: body }).then(function(response) { return response.json(); });
    }).then(function(fileData) {
        if (!fileData || !fileData.id) { throw new Error("Student file upload did not return a Drive file ID."); }
        return fileData;
    });
}

// ── Student file name builder ──

function buildStudentPortfolioFileName(studentId) {
    return "student-" + studentId + ".json";
}

// ── Student file load/save ──

function loadStudentFileFromDrive(studentId, callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) { if (callback) { callback(null, null); } return; }
    var filename = buildStudentPortfolioFileName(studentId);
    ensureDriveFolderPromise().then(function() { return ensureWftStudentsFolderPromise(); }).then(function(studentsFolderId) {
        return findWftFilesByNameInFolderPromise(filename, studentsFolderId);
    }).then(function(files) {
        var canonical = typeof chooseCanonicalWftFile === "function" ? chooseCanonicalWftFile(files) : (files && files[0]);
        if (canonical && canonical.id) {
            try { localStorage.setItem("wft_drive_student_file_" + studentId, canonical.id); } catch (e) {}
            return downloadWftJsonFilePromise(canonical.id);
        }
        return null;
    }).then(function(data) {
        if (data && data.format === "student-portfolio-v1") { callback(null, data); }
        else { callback(null, null); }
    }).catch(function(err) { if (callback) { callback(err, null); } });
}

function saveStudentFileToDrive(studentId, data, callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) { if (callback) { callback(null, "feature-disabled"); } return; }
    var record = {
        schemaVersion: 1, format: "student-portfolio-v1", studentId: studentId,
        displayName: data.displayName || "", legacyNameKeys: data.legacyNameKeys || [],
        createdAt: data.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
        sessions: data.sessions || []
    };
    var filename = buildStudentPortfolioFileName(studentId);
    ensureDriveFolderPromise().then(function() { return ensureWftStudentsFolderPromise(); }).then(function(studentsFolderId) {
        return saveJsonToDriveFolderPromise(filename, record, studentsFolderId);
    }).then(function(fileData) {
        if (fileData && fileData.id) { try { localStorage.setItem("wft_drive_student_file_" + studentId, fileData.id); } catch (e) {} }
        if (callback) { callback(null, fileData && fileData.id ? fileData.id : "saved"); }
    }).catch(function(err) { if (callback) { callback(err, null); } });
}

// ── Migration: legacy portfolio → per-student files ──

function migrateLegacyPortfolioToStudentFiles(callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) {
        if (callback) { callback(null, "feature-disabled"); }
        return;
    }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        if (callback) { callback(null, "safe-mode"); }
        return;
    }

    // Step 1: emergency backup
    console.log("[Migration] Step 1: Creating emergency backup...");
    saveWftPreMigrationBackupToDrive(function(backupErr) {
        if (backupErr) {
            console.warn("[Migration] Backup warning:", backupErr);
        }

        // Step 2: build student ID map
        console.log("[Migration] Step 2: Building student ID map...");
        ensureStudentRecordsForRoster();

        // Step 3: get portfolio
        var portfolio = getPortfolioData();
        var names = Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });

        // Step 4: ensure folders
        console.log("[Migration] Step 3: Ensuring Drive folders...");
        ensureWftStudentsFolderPromise().then(function() {
            // Step 5: create one file per student
            console.log("[Migration] Step 4: Creating " + names.length + " student files...");
            var completed = 0;
            var errors = [];

            function saveNext() {
                if (completed >= names.length) {
                    // Step 6: rebuild index
                    console.log("[Migration] Step 5: Rebuilding portfolio index...");
                    rebuildPortfolioIndex(function() {
                        // Step 7: update metadata
                        var meta = getWftStorageMeta();
                        meta.activePortfolioFormat = "split-student-files";
                        meta.migrationCompletedAt = new Date().toISOString();
                        setWftStorageMeta(meta);
                        updateWftStorageMeta("patch-9-migration", "completed");

                        console.log("[Migration] Complete! " + names.length + " students, " + errors.length + " errors");
                        if (callback) { callback(errors.length ? errors : null, "completed"); }
                    });
                    return;
                }

                var name = names[completed];
                var studentData = portfolio[name];
                var sessions = (studentData && studentData.sessions) ? studentData.sessions : [];
                var studentId = "";

                try {
                    var settings = getRawSettings ? getRawSettings() : {};
                    if (settings.studentIdMap && settings.studentIdMap[name]) {
                        studentId = settings.studentIdMap[name];
                    }
                } catch (e) {}

                if (!studentId) {
                    studentId = createStableStudentId(name, settings.studentIdMap || {});
                }

                saveStudentFileToDrive(studentId, {
                    displayName: name,
                    legacyNameKeys: [name],
                    sessions: sessions
                }, function(err) {
                    if (err) { errors.push({ student: name, error: err }); }
                    completed += 1;
                    saveNext();
                });
            }

            saveNext();
        }).catch(function(folderErr) {
            console.error("[Migration] Folder setup failed:", folderErr);
            if (callback) { callback(folderErr, null); }
        });
    });
}
