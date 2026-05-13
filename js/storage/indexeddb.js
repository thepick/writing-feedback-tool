// =============================================================================
// WFT UPGRADE — Patch 5: IndexedDB Local Cache
// =============================================================================
// Moves large cache data out of localStorage and into IndexedDB.
// localStorage fallback is always maintained — IndexedDB failures never block the app.

var WftIndexedDb = {
    dbName: "wft-cache",
    version: 1,
    db: null,
    _ready: false,

    // ── Open database ──
    open: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (self.db && self._ready) {
                resolve(self.db);
                return;
            }

            if (!window.indexedDB) {
                console.warn("[IndexedDB] Not available — using localStorage fallback");
                reject(new Error("IndexedDB not available"));
                return;
            }

            var request = indexedDB.open(self.dbName, self.version);

            request.onupgradeneeded = function(event) {
                var db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains("metadata")) {
                    db.createObjectStore("metadata", { keyPath: "key" });
                }
                if (!db.objectStoreNames.contains("portfolioIndex")) {
                    db.createObjectStore("portfolioIndex", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("studentPortfolios")) {
                    db.createObjectStore("studentPortfolios", { keyPath: "studentId" });
                }
                if (!db.objectStoreNames.contains("thumbnails")) {
                    db.createObjectStore("thumbnails", { keyPath: "imageId" });
                }
                if (!db.objectStoreNames.contains("syncQueue")) {
                    db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
                }
                console.log("[IndexedDB] Object stores created/upgraded");
            };

            request.onsuccess = function(event) {
                self.db = event.target.result;
                self._ready = true;
                console.log("[IndexedDB] Database opened successfully");
                resolve(self.db);
            };

            request.onerror = function(event) {
                console.error("[IndexedDB] Failed to open:", event.target.error);
                self._ready = false;
                reject(event.target.error);
            };

            request.onblocked = function() {
                console.warn("[IndexedDB] Database blocked — close other tabs using this DB");
                reject(new Error("Database blocked"));
            };
        });
    },

    // ── Generic get ──
    get: function(storeName, key) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readonly");
                    var store = tx.objectStore(storeName);
                    var request = store.get(key);
                    request.onsuccess = function() { resolve(request.result); };
                    request.onerror = function() { reject(request.error); };
                } catch (e) {
                    reject(e);
                }
            });
        });
    },

    // ── Generic put ──
    put: function(storeName, value) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readwrite");
                    var store = tx.objectStore(storeName);
                    var request = store.put(value);
                    request.onsuccess = function() { resolve(request.result); };
                    request.onerror = function() { reject(request.error); };
                } catch (e) {
                    reject(e);
                }
            });
        });
    },

    // ── Generic delete ──
    delete: function(storeName, key) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readwrite");
                    var store = tx.objectStore(storeName);
                    var request = store.delete(key);
                    request.onsuccess = function() { resolve(); };
                    request.onerror = function() { reject(request.error); };
                } catch (e) {
                    reject(e);
                }
            });
        });
    },

    // ── Get all from store ──
    getAll: function(storeName) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readonly");
                    var store = tx.objectStore(storeName);
                    var request = store.getAll();
                    request.onsuccess = function() { resolve(request.result || []); };
                    request.onerror = function() { reject(request.error); };
                } catch (e) {
                    reject(e);
                }
            });
        });
    },

    // ── Clear store ──
    clear: function(storeName) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readwrite");
                    var store = tx.objectStore(storeName);
                    var request = store.clear();
                    request.onsuccess = function() { resolve(); };
                    request.onerror = function() { reject(request.error); };
                } catch (e) {
                    reject(e);
                }
            });
        });
    },

    // ── Clear all stores ──
    clearAll: function() {
        var self = this;
        return self.open().then(function(db) {
            var storeNames = [];
            for (var sni = 0; sni < db.objectStoreNames.length; sni++) {
                storeNames.push(db.objectStoreNames[sni]);
            }
            var promises = [];
            for (var i = 0; i < storeNames.length; i++) {
                promises.push(self.clear(storeNames[i]));
            }
            return Promise.all(promises);
        });
    },

    // ── Check if ready ──
    isReady: function() {
        return this._ready && !!this.db;
    }
};

// ── Storage Adapter ──
// Abstraction that wraps both IndexedDB and localStorage, falling back gracefully.

var WftStorage = {
    isReady: false,
    mode: "localStorage", // "indexeddb" or "localStorage"

    init: function() {
        var self = this;
        if (!WFT_INDEXEDDB_CACHE_V1 || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
            self.mode = "localStorage";
            self.isReady = false;
            return Promise.resolve(self);
        }

        return WftIndexedDb.open().then(function() {
            self.mode = "indexeddb";
            self.isReady = true;
            console.log("[WftStorage] Initialized in indexeddb mode");
        }).catch(function(err) {
            self.mode = "localStorage";
            self.isReady = true;
            console.warn("[WftStorage] IndexedDB init failed, using localStorage fallback:", err);
        });
    },

    // ── Portfolio index ──
    getPortfolioIndex: function() {
        if (this.mode === "indexeddb") {
            return WftIndexedDb.get("portfolioIndex", "current")
                .catch(function() { return null; });
        }
        // Fallback: no local index cache, return null
        return Promise.resolve(null);
    },

    savePortfolioIndex: function(index) {
        if (this.mode === "indexeddb") {
            var record = { id: "current", data: index, updatedAt: new Date().toISOString() };
            return WftIndexedDb.put("portfolioIndex", record).catch(function() {});
        }
        return Promise.resolve();
    },

    // ── Student portfolio ──
    getStudentPortfolio: function(studentId) {
        if (this.mode === "indexeddb") {
            return WftIndexedDb.get("studentPortfolios", studentId)
                .catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    saveStudentPortfolio: function(studentId, data) {
        if (this.mode === "indexeddb") {
            var record = {
                studentId: studentId,
                data: data,
                cachedAt: new Date().toISOString()
            };
            return WftIndexedDb.put("studentPortfolios", record).catch(function() {});
        }
        return Promise.resolve();
    },

    // ── Thumbnails ──
    getThumbnail: function(imageId) {
        if (this.mode === "indexeddb") {
            return WftIndexedDb.get("thumbnails", imageId).catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    saveThumbnail: function(imageId, blobOrDataUrl) {
        if (this.mode === "indexeddb") {
            var record = {
                imageId: imageId,
                data: blobOrDataUrl,
                cachedAt: new Date().toISOString()
            };
            return WftIndexedDb.put("thumbnails", record).catch(function() {});
        }
        return Promise.resolve();
    },

    // ── Metadata ──
    getMetadata: function(key) {
        if (this.mode === "indexeddb") {
            return WftIndexedDb.get("metadata", key).then(function(record) {
                return record ? record.value : null;
            }).catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    setMetadata: function(key, value) {
        if (this.mode === "indexeddb") {
            var record = { key: key, value: value, updatedAt: new Date().toISOString() };
            return WftIndexedDb.put("metadata", record).catch(function() {});
        }
        return Promise.resolve();
    }
};
