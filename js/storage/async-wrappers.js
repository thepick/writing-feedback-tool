// =============================================================================
// WFT UPGRADE — Patch 4: Async Portfolio Access Wrappers
// =============================================================================
// Provides Promise-based wrappers around sync localStorage portfolio access.
// Essential groundwork before IndexedDB (which is async).

// ── Promise/callback bridge ──

function wftPromiseCallback(promise, callback) {
    if (!callback) { return promise; }
    promise.then(
        function(result) { callback(null, result); },
        function(err) { callback(err || new Error("Promise rejected"), null); }
    );
    return promise;
}

// ── Async wrappers (initially pass-through to localStorage) ──

function loadPortfolioAsync() {
    return Promise.resolve().then(function() { return getPortfolioData(); });
}

function savePortfolioAsync(portfolio) {
    return Promise.resolve().then(function() { return savePortfolioData(portfolio); });
}

function loadStudentPortfolioAsync(studentNameOrId) {
    return loadPortfolioAsync().then(function(portfolio) {
        // Try direct name match first
        if (portfolio[studentNameOrId]) {
            return portfolio[studentNameOrId];
        }
        // Try legacy name key lookup via studentIdMap
        if (WFT_STUDENT_ID_MAP_V1) {
            var settings = getRawSettings ? getRawSettings() : {};
            if (settings.studentIdMap) {
                var keys = Object.keys(settings.studentIdMap);
                for (var i = 0; i < keys.length; i++) {
                    if (settings.studentIdMap[keys[i]] === studentNameOrId) {
                        return portfolio[keys[i]] || { sessions: [] };
                    }
                }
            }
        }
        return { sessions: [] };
    });
}

function saveStudentPortfolioAsync(studentNameOrId, studentData) {
    return loadPortfolioAsync().then(function(portfolio) {
        // Resolve actual name key
        var targetKey = studentNameOrId;
        if (WFT_STUDENT_ID_MAP_V1 && !portfolio[studentNameOrId]) {
            var settings = getRawSettings ? getRawSettings() : {};
            if (settings.studentIdMap) {
                var keys = Object.keys(settings.studentIdMap);
                for (var i = 0; i < keys.length; i++) {
                    if (settings.studentIdMap[keys[i]] === studentNameOrId) {
                        targetKey = keys[i];
                        break;
                    }
                }
            }
        }
        portfolio[targetKey] = studentData;
        return savePortfolioAsync(portfolio);
    });
}

// ── Async version of renderStudentPortfolio ──

function renderStudentPortfolioAsync(studentName) {
    if (!WFT_ASYNC_PORTFOLIO_ACCESS_V1 || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
        renderStudentPortfolio();
        return Promise.resolve();
    }

    var name = studentName || (typeof getActivePortfolioStudentName === "function" ? getActivePortfolioStudentName() : "");

    return loadStudentPortfolioAsync(name).then(function(studentData) {
        try {
            var sel = document.getElementById("portfolioStudentSelect");
            if (sel && name && sel.value !== name) { sel.value = name; }
            renderStudentPortfolio._asyncStudentData = studentData || { sessions: [] };
            renderStudentPortfolio._syncRender = true;
            renderStudentPortfolio();
        } catch (e) {
            console.error("[AsyncPortfolio] renderStudentPortfolio failed:", e);
        } finally {
            renderStudentPortfolio._syncRender = false;
            renderStudentPortfolio._asyncStudentData = null;
        }
    });
}
