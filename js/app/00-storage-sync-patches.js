/* =============================================================================
   WRITING FEEDBACK TOOL — ARCHITECTURE OVERVIEW
   =============================================================================

   This is a single-page, client-side web application hosted on GitHub Pages.
   There is NO backend server. All processing happens in the browser, with
   external calls only to:
     1. OpenRouter API (AI text analysis and OCR)
     2. Google Drive API (cloud sync of settings and portfolio data)
     3. Google OAuth2 (user authentication)

   ┌─────────────────────────────────────────────────────────────────────────┐
   │                        APPLICATION LAYERS                                │
   ├─────────────────────────────────────────────────────────────────────────┤
   │                                                                         │
   │  ┌─────────────────────────────────────────────────────────────┐       │
   │  │                    PRESENTATION LAYER                        │       │
   │  │                                                             │       │
   │  │  • HTML structure (single file, inline)                     │       │
   │  │  • CSS styles (inline <style> block)                        │       │
   │  │  • DOM manipulation functions (render*, update*, show*)     │       │
   │  │  • Event handlers (click, input, drag/drop, visibility)     │       │
   │  │  • Print/export document generation                         │       │
   │  └─────────────────────────────────────────────────────────────┘       │
   │                              │                                          │
   │                              ▼                                          │
   │  ┌─────────────────────────────────────────────────────────────┐       │
   │  │                    APPLICATION LOGIC                         │       │
   │  │                                                             │       │
   │  │  • Analysis pipeline (buildStep1Prompt → callOpenRouter     │       │
   │  │    → parseStep1 → buildStep2Prompt → ... → computeOverall) │       │
   │  │  • Grammar density calculator                               │       │
   │  │  • Flow/sentence variety analyzer                           │       │
   │  │  • Word count adjustment engine                             │       │
   │  │  • Correction diff engine (LCS-based token comparison)      │       │
   │  │  • Neatness assessment (image-based, separate AI call)      │       │
   │  │  • Sample status evaluator (insufficient/limited/scorable)  │       │
   │  │  • Portfolio session management                             │       │
   │  │  • Student roster management                                │       │
   │  │  • Archive/export ZIP generation (JSZip)                    │       │
   │  └─────────────────────────────────────────────────────────────┘       │
   │                              │                                          │
   │                              ▼                                          │
   │  ┌─────────────────────────────────────────────────────────────┐       │
   │  │                    DATA / PERSISTENCE LAYER                  │       │
   │  │                                                             │       │
   │  │  LOCAL (browser):                                           │       │
   │  │    • localStorage: settings, students, portfolio,           │       │
   │  │      deletions, cached Drive file IDs, OAuth state          │       │
   │  │    • sessionStorage: OAuth access token (V2)                │       │
   │  │    • In-memory: selectedImages[], latestAnalysisData,       │       │
   │  │      wftSyncState{}, analysis abort controller              │       │
   │  │                                                             │       │
   │  │  REMOTE (Google Drive — drive.file scope):                  │       │
   │  │    • WritingFeedbackTool/ (app folder)                      │       │
   │  │      ├── wft-settings.json                                  │       │
   │  │      ├── wft-portfolio.json                                 │       │
   │  │      ├── wft-deletions.json                                 │       │
   │  │      ├── Archives/ (year-end ZIPs)                          │       │
   │  │      ├── Duplicate Backups/ (conflict resolution)           │       │
   │  │      └── [student]__[date]__[image].jpg (media files)       │       │
   │  └─────────────────────────────────────────────────────────────┘       │
   │                              │                                          │
   │                              ▼                                          │
   │  ┌─────────────────────────────────────────────────────────────┐       │
   │  │                    EXTERNAL SERVICES                         │       │
   │  │                                                             │       │
   │  │  • OpenRouter API (https://openrouter.ai/api/v1/...)        │       │
   │  │    - Text analysis (3-step prompt pipeline)                 │       │
   │  │    - Image OCR (handwriting transcription)                  │       │
   │  │    - Neatness assessment (handwriting quality scoring)      │       │
   │  │    - Model fallback chain with retry logic                  │       │
   │  │                                                             │       │
   │  │  • Google OAuth2 (implicit grant, redirect flow)            │       │
   │  │    - Scopes: drive.file, userinfo.profile, userinfo.email   │       │
   │  │                                                             │       │
   │  │  • Google Drive API v3                                      │       │
   │  │    - File CRUD (multipart upload)                           │       │
   │  │    - Folder management                                      │       │
   │  └─────────────────────────────────────────────────────────────┘       │
   │                                                                         │
   └─────────────────────────────────────────────────────────────────────────┘

   KEY DESIGN DECISIONS:
   • No backend — everything runs client-side for zero hosting cost.
   • Single HTML file — simplifies GitHub Pages deployment (no build step).
   • OAuth implicit grant — only option without a server (no client secret).
   • localStorage as primary store — portfolio/settings persist across sessions.
   • Google Drive as cloud backup — enables multi-device sync for teachers.
   • 3-step AI pipeline — separates correction, scoring, and detailed feedback
     so each prompt stays focused and parseable.
   • Deletion log (wft-deletions.json) — ensures deleted students/sessions
     stay deleted across devices without requiring a central authority.

   KNOWN LIMITATIONS:
   • localStorage has a ~5-10MB quota; large portfolios with embedded images
     can hit this limit (mitigated by stripping heavy fields on overflow).
   • OAuth tokens expire after ~1 hour; no refresh token is possible without
     a backend server, so users must re-sign-in after expiry.
   • Single-file architecture makes the codebase difficult to navigate and
     prevents tree-shaking or code-splitting optimizations.
   • No automated tests — correctness depends on manual QA.

   ============================================================================= */


/* =============================================================================
   WFT SYNC ENGINE V2 — DATA FLOW DIAGRAM
   =============================================================================

   The sync engine manages bidirectional synchronization between the browser's
   localStorage and Google Drive. It handles three independent data streams:
   settings, portfolio, and deletions.

   ┌──────────────────────────────────────────────────────────────────────────┐
   │                         SYNC TRIGGER SOURCES                              │
   ├──────────────────────────────────────────────────────────────────────────┤
   │                                                                          │
   │  LOCAL CHANGES (mark dirty → debounce → sync):                           │
   │    • Settings: model change, word count target, grammar strictness,      │
   │      neatness toggle, roster add/remove                                  │
   │    • Portfolio: new session saved, session deleted                        │
   │    • Deletions: student deleted, session deleted                          │
   │                                                                          │
   │  EXPLICIT TRIGGERS (immediate flush):                                    │
   │    • "Sync to Portfolio" button clicked                                  │
   │    • Sign-out (sync-before-disconnect)                                   │
   │    • Archive operation                                                   │
   │                                                                          │
   │  TIMED TRIGGERS:                                                         │
   │    • Poll interval (every 60s when idle and signed in)                   │
   │    • Visibility change (tab becomes visible after being hidden)          │
   │    • Online event (browser regains network connectivity)                 │
   │                                                                          │
   │  AUTH TRIGGERS:                                                          │
   │    • OAuth redirect completes (token received in URL hash)               │
   │    • Session restored from sessionStorage on page load                   │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                         DIRTY FLAG SYSTEM                                 │
   ├──────────────────────────────────────────────────────────────────────────┤
   │                                                                          │
   │  When local data changes:                                                │
   │    1. markWftSettingsDirty(reason) / markWftPortfolioDirty(reason)       │
   │       / markWftDeletionsDirty(reason)                                   │
   │    2. Increments localXxxCounter (monotonic version number)              │
   │    3. Sets pendingXxxPush = true                                        │
   │    4. scheduleWftCloudSync(reason) starts a 2500ms debounce timer       │
   │                                                                          │
   │  The debounce timer coalesces rapid successive changes into a single    │
   │  sync run (e.g., adding 5 students quickly → 1 sync, not 5).           │
   │                                                                          │
   │  wftSuppressDirtyMarks = true suppresses marking during cloud-merge     │
   │  application to prevent write-back loops.                               │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                      syncWftNow(reason, options)                          │
   │                      ─────────────────────────                           │
   │                      MAIN SYNC ORCHESTRATOR                              │
   ├──────────────────────────────────────────────────────────────────────────┤
   │                                                                          │
   │  GUARDS (skip sync if any are true):                                    │
   │    • Not signed in (no access token)                                    │
   │    • Browser is offline                                                 │
   │    • Blocked state (quota/permission/auth) — unless explicit trigger    │
   │    • Already syncing (queues behind current run instead)                │
   │                                                                          │
   │  EXECUTION ORDER (sequential, not parallel):                            │
   │    1. ensureDriveFolderPromise()  ← resolve/create app folder           │
   │    2. syncWftDeletionsIfNeeded()  ← always runs first                   │
   │    3. syncWftSettingsIfNeeded()   ← applies deletions to roster         │
   │    4. syncWftPortfolioIfNeeded()  ← applies deletions to sessions       │
   │                                                                          │
   │  QUEUING: If a sync is already running, needsSyncAfterCurrent = true    │
   │  is set, and the queued request shares the active Promise. When the     │
   │  active run finishes, it automatically starts a follow-up run.          │
   │                                                                          │
   │  CONCURRENCY LOCK: isSyncing = true prevents parallel runs.             │
   │  syncRunId increments each run for log correlation.                     │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                  PER-STREAM SYNC LOGIC (same pattern x3)                 │
   ├──────────────────────────────────────────────────────────────────────────┤
   │                                                                          │
   │  syncWftSettingsIfNeeded / syncWftPortfolioIfNeeded /                    │
   │  syncWftDeletionsIfNeeded all follow this decision tree:                │
   │                                                                          │
   │  ┌─────────────────────────────────────────┐                            │
   │  │ 1. Take local snapshot + fingerprint    │                            │
   │  └────────────────────┬────────────────────┘                            │
   │                       ▼                                                  │
   │  ┌─────────────────────────────────────────┐                            │
   │  │ 2. Find file(s) on Drive by name       │                            │
   │  │    (uses cached file ID first,          │                            │
   │  │     falls back to folder search)        │                            │
   │  └────────────────────┬────────────────────┘                            │
   │                       ▼                                                  │
   │           ┌───── File exists? ─────┐                                    │
   │           │                        │                                    │
   │          NO                       YES                                   │
   │           │                        │                                    │
   │           ▼                        ▼                                    │
   │  ┌────────────────┐    ┌─────────────────────────────┐                 │
   │  │ If pending:    │    │ 3. Download cloud copy       │                 │
   │  │  CREATE file   │    │ 4. Merge (local ∪ cloud)     │                 │
   │  │ Else: skip     │    │ 5. Compare fingerprints:     │                 │
   │  └────────────────┘    │                             │                 │
   │                        │  merged ≠ local?            │                 │
   │                        │    → Save merged locally    │                 │
   │                        │    → Refresh UI             │                 │
   │                        │                             │                 │
   │                        │  (pending OR duplicates)    │                 │
   │                        │  AND merged ≠ cloud?        │                 │
   │                        │    → Upload merged to Drive │                 │
   │                        │                             │                 │
   │                        │  Else: skip (no changes)    │                 │
   │                        └─────────────────────────────┘                 │
   │                                                                          │
   │  FINGERPRINTING:                                                        │
   │    • Uses a stable JSON serialization (sorted keys) + hash function     │
   │    • Strips volatile fields (updatedAt, syncMeta, apiKey) before hash   │
   │    • Allows the engine to detect "nothing actually changed" and skip    │
   │      unnecessary uploads/downloads                                      │
   │                                                                          │
   │  MERGE STRATEGIES:                                                      │
   │    • Settings: key-by-key overlay; students merged by normalized name   │
   │    • Portfolio: student-by-student, session-by-session (by session ID); │
   │      newer session wins on conflict; image refs are union-merged        │
   │    • Deletions: pure union (once deleted, stays deleted everywhere)     │
   │                                                                          │
   │  DUPLICATE FILE HANDLING:                                               │
   │    • If multiple files with the same name exist in the app folder,      │
   │      the newest is chosen as canonical                                  │
   │    • All others are merged INTO the canonical copy before upload        │
   │    • Conditional duplicate cleanup action moves extras to subfolder     │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                         DRIVE API LAYER                                   │
   ├──────────────────────────────────────────────────────────────────────────┤
   │                                                                          │
   │  wftDriveFetch(url, options)                                            │
   │    • All Drive requests flow through this single gateway                │
   │    • Validates token freshness before each request                      │
   │    • Blocks non-Google URLs (security guard)                            │
   │    • Checks navigator.onLine                                            │
   │    • Injects Authorization header                                       │
   │    • Parses error responses and sets block flags:                       │
   │        401 → authBlocked (session expired)                              │
   │        403 + quota/rate → quotaBlocked                                  │
   │        403 (other) → permissionBlocked                                  │
   │    • Updates sync status indicator in header                            │
   │                                                                          │
   │  FOLDER RESOLUTION:                                                     │
   │    1. Check cached folder ID (localStorage + memory)                    │
   │    2. Validate cached ID still exists and is not trashed                │
   │    3. If invalid: search Drive for folder by name                       │
   │    4. If multiple found: chooseCanonicalDriveFolderPromise()            │
   │       (picks the one with the most/newest sync files)                   │
   │    5. If none found: create new folder                                  │
   │    6. Cache resolved folder ID for future requests                      │
   │                                                                          │
   │  FILE UPLOAD (multipart/related):                                       │
   │    • PATCH existing file (if ID known) or POST new file                 │
   │    • Timeout protection (WFT_SAVE_FILE_TIMEOUT_MS = 30s)               │
   │    • On timeout: re-check if file was actually written successfully     │
   │      by downloading and comparing fingerprints                          │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                      ERROR RECOVERY & BLOCKING                           │
   ├──────────────────────────────────────────────────────────────────────────┤
   │                                                                          │
   │  BLOCK STATES (prevent automatic retries until cleared):                │
   │    • authBlocked: token expired/revoked → user must re-sign-in          │
   │    • quotaBlocked: Drive rate limit hit → wait for quota reset          │
   │    • permissionBlocked: scope/permission issue → user must reconnect    │
   │                                                                          │
   │  CLEARING BLOCKS:                                                       │
   │    • Explicit user action (click Sync, sign in) clears all blocks       │
   │    • "online" event clears all blocks                                   │
   │    • Blocks are NOT cleared by poll timer (prevents retry storms)       │
   │                                                                          │
   │  NETWORK RESILIENCE:                                                    │
   │    • Offline detection skips sync gracefully                            │
   │    • Online event triggers immediate sync                               │
   │    • All local changes are persisted to localStorage BEFORE sync        │
   │      attempt, so no data is lost if sync fails                          │
   │                                                                          │
   │  LOGGING:                                                               │
   │    • wftSyncLog/wftSyncWarn/wftSyncErrorLog (controlled by             │
   │      WFT_SYNC_DEBUG flag)                                               │
   │    • All log output is automatically redacted (tokens, keys stripped)   │
   │    • getWftSyncDiagnostics() available on window for live debugging     │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │                      MEDIA (IMAGE) SYNC FLOW                             │
   ├──────────────────────────────────────────────────────────────────────────┤
   │                                                                          │
   │  Images follow a separate path from JSON sync because they are large    │
   │  binary blobs that should not live inside the JSON portfolio file.       │
   │                                                                          │
   │  UPLOAD FLOW:                                                           │
   │    1. User takes/uploads photo → stored as data URL in memory           │
   │    2. On "Sync to Portfolio" click:                                     │
   │       a. uploadPendingPortfolioMediaBeforeCommit()                      │
   │       b. For each image with dataUrl and no driveFileId:                │
   │          - Convert data URL to Blob                                     │
   │          - Upload to Drive app folder as JPEG/PNG                       │
   │          - Store returned driveFileId in the session's image metadata   │
   │          - Clear the local dataUrl to free memory/storage               │
   │       c. Commit session to portfolio (now with Drive file references)   │
   │    3. Background: syncPendingPortfolioMedia() retries any images        │
   │       that failed during the initial upload                             │
   │                                                                          │
   │  DOWNLOAD FLOW (for portfolio display):                                 │
   │    1. hydratePortfolioDriveImages() finds <img data-drive-file-id="">   │
   │    2. Fetches binary via Drive API (alt=media)                          │
   │    3. Creates Object URL and sets img.src                               │
   │                                                                          │
   │  IDEMPOTENCY (WFT_IMAGE_IDEMPOTENCY_V2):                               │
   │    • Each image gets a stable imageId based on session + filename + idx │
   │    • If driveFileId already exists, skip re-upload                      │
   │    • Prevents duplicate uploads on retry/re-sync                        │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘


   STATE DIAGRAM — SYNC LIFECYCLE:

   ┌────────┐   sign-in    ┌──────────┐   trigger    ┌──────────┐
   │  IDLE  │ ───────────► │  READY   │ ──────────► │ SYNCING  │
   │(no auth)│              │(has token)│              │(isSyncing)│
   └────────┘              └──────────┘              └────┬─────┘
       ▲                        ▲                         │
       │                        │                         │ success
       │   sign-out             │    done                 ▼
       │◄───────────────────────┼─────────────────  ┌──────────┐
       │                        │                   │  SYNCED   │
       │                        │◄──────────────────│ (status)  │
       │                        │    poll/change    └──────────┘
       │                        │
       │                   ┌──────────┐
       │                   │ BLOCKED  │ (auth/quota/permission)
       │                   │          │
       │                   └────┬─────┘
       │                        │ explicit action clears
       │                        ▼
       └────────────────── (returns to READY or IDLE)


   FEATURE FLAGS (control progressive rollout):
     • WFT_SYNC_ENGINE_V2         — master switch for V2 sync
     • WFT_SYNC_DEBUG             — enable console logging
     • WFT_DUPLICATE_DETECTION_V2 — warn on duplicate Drive files
     • WFT_DUPLICATE_CLEANUP_V2   — auto-move duplicates (disabled)
     • WFT_IMAGE_IDEMPOTENCY_V2   — prevent duplicate image uploads
     • WFT_SESSION_TOKEN_STORAGE_V2 — session-only token mode
     • WFT_GIS_AUTH_V2            — future: Google Identity Services

   ============================================================================= */


/* =============================================
   SETTINGS DRAWER
============================================= */
function updateGrammarStrictnessDisplay(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) n = 3;
    if (n < 1) n = 1;
    if (n > 5) n = 5;
    var valEl = document.getElementById("grammarStrictnessVal");
    if (valEl) {
        var ratio = (n - 1) / 4;
        var percent = ratio * 100;
        var offset = 10 - (20 * ratio);
        valEl.textContent = String(n);
        valEl.style.left = "calc(" + percent + "% + " + offset + "px)";
    }
}

function openSettingsDrawer() {
    document.getElementById('settingsDrawer').classList.add('open');
    document.getElementById('settingsDrawerOverlay').classList.add('open');
}
function closeSettingsDrawer() {
    document.getElementById('settingsDrawer').classList.remove('open');
    document.getElementById('settingsDrawerOverlay').classList.remove('open');
    saveSettingsToLocalStorage();
}

var WFT_API_KEY_SESSION_STORAGE_KEY = "wft_api_key_session";
var WFT_API_KEY_LOCAL_STORAGE_KEY = "wft_api_key_remembered";
var WFT_API_KEY_REMEMBER_PREF_KEY = "wft_api_key_remember_on_device";

function getApiKeyInputValue() {
    var apiKeyInput = document.getElementById('apiKeyInput');
    return apiKeyInput ? String(apiKeyInput.value || '').trim() : '';
}

function migrateLegacyApiKeyStorage() {
    try {
        var raw = localStorage.getItem('wft_settings');
        if (!raw) { return; }
        var s = JSON.parse(raw) || {};
        if (s.apiKey) {
            try {
                if (!sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY)) {
                    sessionStorage.setItem(WFT_API_KEY_SESSION_STORAGE_KEY, String(s.apiKey).trim());
                }
            } catch (e1) {}
            delete s.apiKey;
            localStorage.setItem('wft_settings', JSON.stringify(s));
        }
    } catch (e) {}
}

function getRememberApiKeyStoredPreference() {
    try { return localStorage.getItem(WFT_API_KEY_REMEMBER_PREF_KEY) === 'true'; } catch (e) {}
    return false;
}

function isRememberApiKeyEnabled() {
    var rememberEl = document.getElementById('rememberApiKeyOnDevice');
    if (rememberEl && rememberEl.getAttribute('data-wft-api-key-pref-loaded') === 'true') {
        return rememberEl.checked === true;
    }
    return getRememberApiKeyStoredPreference();
}

function setRememberApiKeyEnabled(enabled) {
    try { localStorage.setItem(WFT_API_KEY_REMEMBER_PREF_KEY, enabled ? 'true' : 'false'); } catch (e) {}
}

function applyRememberApiKeyStoredPreferenceToUi() {
    var rememberEl = document.getElementById('rememberApiKeyOnDevice');
    if (!rememberEl) { return; }
    rememberEl.checked = getRememberApiKeyStoredPreference();
    rememberEl.setAttribute('data-wft-api-key-pref-loaded', 'true');
}

function getStoredApiKey() {
    migrateLegacyApiKeyStorage();
    try {
        var sessionKey = sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY) || '';
        if (sessionKey) { return String(sessionKey).trim(); }
    } catch (e1) {}
    try {
        if (isRememberApiKeyEnabled()) {
            return String(localStorage.getItem(WFT_API_KEY_LOCAL_STORAGE_KEY) || '').trim();
        }
    } catch (e2) {}
    return '';
}

function persistApiKeyStorageFromInput() {
    var key = getApiKeyInputValue();
    var remember = isRememberApiKeyEnabled();
    setRememberApiKeyEnabled(remember);
    try {
        if (key) { sessionStorage.setItem(WFT_API_KEY_SESSION_STORAGE_KEY, key); }
        else { sessionStorage.removeItem(WFT_API_KEY_SESSION_STORAGE_KEY); }
    } catch (e1) {}
    try {
        if (remember && key) { localStorage.setItem(WFT_API_KEY_LOCAL_STORAGE_KEY, key); }
        else { localStorage.removeItem(WFT_API_KEY_LOCAL_STORAGE_KEY); }
    } catch (e2) {}
}

function refreshApiKeyRuntimeValue() {
    API_KEY = getApiKeyInputValue() || getStoredApiKey() || EMBEDDED_API_KEY;
}

function saveSettingsToLocalStorage(settingsOverride) {
    var settings = {};
    var existing = {};
    try {
        var raw = localStorage.getItem('wft_settings');
        existing = raw ? JSON.parse(raw) : {};
    } catch (e) {
        existing = {};
    }

    settings = cloneWftJson(existing || {});
    if (settingsOverride && typeof settingsOverride === 'object') {
        if (settingsOverride.apiKey) { delete settingsOverride.apiKey; }
        var overrideKeys = Object.keys(settingsOverride);
        for (var oi = 0; oi < overrideKeys.length; oi++) {
            settings[overrideKeys[oi]] = settingsOverride[overrideKeys[oi]];
        }
    }

    try {
        var apiKeyInput = document.getElementById('apiKeyInput');
        var modelSelect = document.getElementById('modelSelect');
        var targetWordCountEl = document.getElementById('targetWordCount');
        var useWordCountTargetEl = document.getElementById('useWordCountTarget');
        var assessScriptQualityEl = document.getElementById('assessScriptQuality');

        if (apiKeyInput) { persistApiKeyStorageFromInput(); }
        delete settings.apiKey;
        if (modelSelect) settings.model = modelSelect.value || '';
        if (targetWordCountEl) settings.targetWordCount = targetWordCountEl.value || '200';
        if (useWordCountTargetEl) settings.useWordCountTarget = useWordCountTargetEl.checked;
        if (typeof getClassDefaultGrammarStrictness === 'function') settings.grammarStrictness = getClassDefaultGrammarStrictness();
        else if (typeof getGrammarStrictness === 'function') settings.grammarStrictness = getGrammarStrictness();
        if (assessScriptQualityEl) settings.assessScriptQuality = assessScriptQualityEl.checked;
        if (typeof getClassGradeLevel === 'function') settings.gradeLevel = getClassGradeLevel();
        else if (typeof getSelectedGradeLevel === 'function') settings.gradeLevel = getSelectedGradeLevel();
        if (typeof getClassGradeLevel === 'function') settings.classGradeLevel = getClassGradeLevel();
        if (typeof GRADE_PROFILE_VERSION !== 'undefined') settings.classDefaultsProfileVersion = GRADE_PROFILE_VERSION;
        if (typeof getClassGradeLevel === 'function') settings.classDefaultsGradeLevel = getClassGradeLevel();
        settings.studentGradeLevelOverride = false;

        if (typeof students !== "undefined" && Array.isArray(students)) {
            settings.students = applyDeletionsToStudents(students, getDeletionsData());
        }

        delete settings.apiKey;
        localStorage.setItem('wft_settings', JSON.stringify(settings));
        refreshApiKeyRuntimeValue();
    } catch(e) {}
    // ── WFT Sync V2: mark settings dirty for background sync ──
    if (WFT_SYNC_ENGINE_V2 && !wftSuppressDirtyMarks && !(typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
        markWftSettingsDirty("settings-change");
        scheduleWftCloudSync("settings-change");
    } else if (!WFT_SYNC_ENGINE_V2 && (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) && driveAccessToken && typeof saveSettingsToDrive === "function") {
        try { saveSettingsToDrive(); } catch (e) {}
    }
    return settings;
}

function loadSettingsFromLocalStorage() {
    try {
        migrateLegacyApiKeyStorage();
        applyRememberApiKeyStoredPreferenceToUi();
        if (document.getElementById('apiKeyInput')) {
            document.getElementById('apiKeyInput').value = getStoredApiKey();
        }
        var raw = localStorage.getItem('wft_settings');
        if (raw) {
            var s = JSON.parse(raw);
            if (s.model && document.getElementById('modelSelect')) {
                document.getElementById('modelSelect').value = s.model;
            }
            if (s.targetWordCount && document.getElementById('targetWordCount')) {
                document.getElementById('targetWordCount').value = s.targetWordCount;
            }
            if (s.useWordCountTarget != null && document.getElementById('useWordCountTarget')) {
                document.getElementById('useWordCountTarget').checked = s.useWordCountTarget;
                var twc = document.getElementById('targetWordCount');
                if (twc) twc.disabled = !s.useWordCountTarget;
            }
            if (s.grammarStrictness != null) {
                var slider = document.getElementById('grammarStrictness');
                var valEl = document.getElementById('grammarStrictnessVal');
                if (slider) slider.value = s.grammarStrictness;
                if (typeof updateGrammarStrictnessDisplay === "function") updateGrammarStrictnessDisplay(s.grammarStrictness);
                else if (valEl) valEl.textContent = s.grammarStrictness;
            }
            if (s.assessScriptQuality != null && document.getElementById('assessScriptQuality')) {
                document.getElementById('assessScriptQuality').checked = s.assessScriptQuality;
            }
            if (document.getElementById('classGradeLevelSelect')) {
                var savedClassGrade = parseGradeLevelValue(s.classGradeLevel) || 5;
                document.getElementById('classGradeLevelSelect').value = String(savedClassGrade);
            }
            wftStudentGradeLevelOverride = false;
            if (document.getElementById('gradeLevelSelect')) {
                document.getElementById('gradeLevelSelect').value = String(getClassGradeLevel() || 5);
            }
            maybeApplyClassDefaultsForLegacyGradeSettings(s);
            applyGradeWordCountRange();
            refreshGradeProfileDescription();
            if (typeof updateGradeLevelResultNote === 'function') updateGradeLevelResultNote();
            // Update script quality toggle visibility based on whether photos exist
            updateScriptQualityToggleVisibility();
        }
        refreshApiKeyRuntimeValue();
    } catch(e) {}
}

function maybeApplyClassDefaultsForLegacyGradeSettings(settings) {
    if (!settings || typeof getClassGradeLevel !== "function" || typeof getGradeProfile !== "function") return false;
    if (typeof GRADE_PROFILE_VERSION === "undefined" || typeof parseGradeLevelValue !== "function") return false;
    if (settings.classDefaultsProfileVersion === GRADE_PROFILE_VERSION && parseGradeLevelValue(settings.classDefaultsGradeLevel) === getClassGradeLevel()) return false;

    var classGrade = getClassGradeLevel();
    var profile = getGradeProfile(classGrade);
    var grade5Profile = getGradeProfile(5);
    var savedStrictness = parseInt(settings.grammarStrictness, 10);
    var savedTarget = parseInt(settings.targetWordCount, 10);
    var grade5Strictness = parseInt(grade5Profile.grammarStrictnessDefault, 10);
    var grade5Target = parseInt(grade5Profile.targetWordCountBase || grade5Profile.targetWordCount, 10);
    var looksLikeOldGrade5Defaults = savedStrictness === grade5Strictness && savedTarget === grade5Target;
    var missingDefaults = isNaN(savedStrictness) || isNaN(savedTarget);

    if (classGrade !== 5 && (looksLikeOldGrade5Defaults || missingDefaults)) {
        if (typeof applyGradeDefaultStrictness === "function") applyGradeDefaultStrictness(profile);
        if (typeof applyGradeDefaultTargetWordCount === "function") applyGradeDefaultTargetWordCount(profile);
        try {
            settings.grammarStrictness = profile.grammarStrictnessDefault;
            settings.targetWordCount = String(profile.targetWordCountBase || profile.targetWordCount || 200);
            settings.classDefaultsProfileVersion = GRADE_PROFILE_VERSION;
            settings.classDefaultsGradeLevel = classGrade;
            localStorage.setItem("wft_settings", JSON.stringify(settings));
        } catch (e) { }
        return true;
    }

    return false;
}

/* =============================================
   SCRIPT QUALITY ASSESSMENT HELPERS
============================================= */

// Get raw settings object (for internal use without DOM)
function getRawSettings() {
    try {
        var raw = localStorage.getItem('wft_settings');
        return raw ? JSON.parse(raw) : {};
    } catch(e) {
        return {};
    }
}

// Check if neatness should be assessed based on toggle + photo existence
function shouldAssessNeatness() {
    var settings = getRawSettings();
    var toggleOn = settings.assessScriptQuality === true;
    var hasPhotos = selectedImages && selectedImages.length > 0;
    return toggleOn && hasPhotos;
}

// Check if the neatness weighting note should be displayed in the report preview
function shouldShowNeatnessWeighting() {
    var checkbox = document.getElementById("assessScriptQuality");
    if (checkbox) return checkbox.checked === true;

    var settings = getRawSettings();
    return settings.assessScriptQuality === true;
}

// Script quality toggle is always visible in Manage Class
function updateScriptQualityToggleVisibility() {
    var row = document.getElementById('scriptQualityRow');
    if (row) {
        row.style.display = 'flex';
    }
}

// Get active category keys based on whether neatness is enabled
function getActiveCategoryKeys() {
    var keys = [
        "Ideas & Details",
        "Grammar",
        "Word Choice",
        "Organization",
        "Flow",
        "Spelling & Punctuation"
    ];

    // Add Neatness if enabled AND photos exist
    if (shouldAssessNeatness()) {
        keys.push("Neatness");
    }
    return keys;
}

// Get weight for a specific category
// FIX E6+O7+A4: getCategoryWeight now uses grade-aware weights.
// Optional optProfile parameter lets callers pass an explicit grade profile.
function getNeatnessWeight(optProfile) {
    var profile = optProfile || getGradeProfile();
    if (typeof profile.neatnessWeight === "number") return profile.neatnessWeight;
    return 0.05;
}
function formatPercentFromWeight(weight) {
    return Math.round(Number(weight || 0) * 100) + "%";
}
function getCategoryWeight(key, optProfile) {
    var profile = optProfile || getGradeProfile();
    var gradeWeights = profile.weights || GRADE_PROFILES[5].weights;
    if (key === "Neatness") return shouldAssessNeatness() ? getNeatnessWeight(profile) : 0;
    if (gradeWeights[key] == null) return 0;
    return gradeWeights[key];
}
function getWeightDescriptionText(optProfile) {
    var profile = optProfile || getGradeProfile();
    var weights = profile.weights || GRADE_PROFILES[5].weights;
    var neatnessActive = shouldShowNeatnessWeighting ? shouldShowNeatnessWeighting() : shouldAssessNeatness();
    var neatnessWeight = neatnessActive ? getNeatnessWeight(profile) : 0;
    var nonNeatScale = 1 - neatnessWeight;
    var order = ["Ideas & Details", "Organization", "Grammar", "Flow", "Word Choice", "Spelling & Punctuation"];
    var entries = [];
    var floorsTotal = 0;
    var i;

    for (i = 0; i < order.length; i += 1) {
        var k = order[i];
        if (weights[k] != null) {
            var pct = Number(weights[k] * nonNeatScale * 100) || 0;
            var floorPct = Math.floor(pct);
            entries.push({ label: k, pct: pct, rounded: floorPct, remainder: pct - floorPct });
            floorsTotal += floorPct;
        }
    }
    if (neatnessActive && neatnessWeight > 0) {
        var neatPct = Number(neatnessWeight * 100) || 0;
        var neatFloor = Math.floor(neatPct);
        entries.push({ label: "Neatness", pct: neatPct, rounded: neatFloor, remainder: neatPct - neatFloor });
        floorsTotal += neatFloor;
    }

    var pointsToAdd = Math.max(0, 100 - floorsTotal);
    entries.sort(function(a, b) { return b.remainder - a.remainder; });
    for (i = 0; i < entries.length && pointsToAdd > 0; i += 1) {
        entries[i].rounded += 1;
        pointsToAdd -= 1;
    }
    entries.sort(function(a, b) {
        var ai = order.indexOf(a.label);
        var bi = order.indexOf(b.label);
        if (a.label === "Neatness") ai = 999;
        if (b.label === "Neatness") bi = 999;
        return ai - bi;
    });

    var parts = [];
    for (i = 0; i < entries.length; i += 1) {
        parts.push(entries[i].label + " (" + entries[i].rounded + "%)");
    }
    return "Weighted by category importance: " + parts.join(", ") + ".";
}

// Assess handwriting neatness from an image
async function assessNeatnessFromImage(imageDataUrl, model) {
    // Use the original unprocessed image for best handwriting assessment
    var originalImageUrl = selectedImages && selectedImages[0] && selectedImages[0].originalDataUrl
        ? selectedImages[0].originalDataUrl
        : imageDataUrl;

    function parseNeatnessSubScore(label, responseText) {
        var rx = new RegExp('-\\s*' + label + '\\s*:\\s*((?:5|4|3|2|1)|Missing)\\s*\\/5', 'i');
        var m = responseText.match(rx);
        if (!m) return null;
        return /missing/i.test(m[1]) ? null : Number(m[1]);
    }

    function calculateWeightedNeatnessFive(subScores) {
        if (!subScores) return null;
        var values = [
            subScores.letterFormation,
            subScores.spacing,
            subScores.stayingOnLine,
            subScores.sizeConsistency,
            subScores.penControl,
            subScores.pageLayoutParagraphs
        ];
        for (var i = 0; i < values.length; i++) {
            if (!isFinite(Number(values[i]))) return null;
        }
        return (Number(subScores.letterFormation) * 0.20) +
               (Number(subScores.spacing) * 0.15) +
               (Number(subScores.stayingOnLine) * 0.15) +
               (Number(subScores.sizeConsistency) * 0.15) +
               (Number(subScores.penControl) * 0.15) +
               (Number(subScores.pageLayoutParagraphs) * 0.20);
    }

    function convertNeatnessFiveToTen(scoreFive) {
        var n = Number(scoreFive);
        if (!isFinite(n)) return null;
        if (n < 1) n = 1;
        if (n > 5) n = 5;
        return Math.round(n) * 2;
    }

    var prompt = `Look at the handwriting in this student writing sample and score the neatness of the writing using the exact 1-5 rubric below.

Score each sub-criterion using only these values: 5, 4, 3, 2, 1 (or "Missing" if you cannot tell from the image). Do not give a score based on effort, writing quality, spelling, punctuation, or story content. Only judge what is visible in the handwriting image.

RUBRIC LEVELS:
5 = Exceptional
4 = Proficient
3 = Developing
2 = Emerging
1 = Beginning

SUB-CRITERIA, WEIGHTS, AND SCORE DESCRIPTORS:

1. Letter Formation (20%)
5 - Letters are clear, complete, and easy to recognize. Most letters are formed carefully.
4 - Most letters are clear and easy to read, with only a few unclear or rushed letters.
3 - Some letters are clear, but several are hard to recognize or are not fully formed.
2 - Many letters are hard to read because they are incomplete, rushed, or poorly shaped.
1 - Most letters are very hard to recognize, making the writing difficult to read.

2. Spacing (15%)
5 - Spaces between words and letters are clear and consistent. The writing is easy to follow.
4 - Most spacing is clear, with only a few places where words or letters are too close together.
3 - Spacing is uneven. Some words are crowded or too far apart.
2 - Many words or letters are crowded together, making the writing harder to read.
1 - Spacing is very unclear, and it is hard to tell where words begin and end.

3. Staying on the Line (15%)
5 - Writing stays neatly on the lines throughout the page.
4 - Writing mostly stays on the lines, with only a few small slips.
3 - Writing sometimes drifts above or below the lines.
2 - Writing often moves off the lines, making the page look messy.
1 - Writing does not follow the lines well and is difficult to read.

4. Size Consistency (15%)
5 - Letter size is consistent and fits the notebook lines well.
4 - Letter size is mostly consistent, with only a few letters that are much bigger or smaller.
3 - Letter size changes noticeably in some places.
2 - Letter size changes often, making the writing harder to read.
1 - Letter size is very uneven and makes the writing difficult to follow.

5. Pen Control and Marks (15%)
5 - Lines are clean and controlled. There are no distracting smudges, scribbles, or messy marks.
4 - There are only a few small smudges, eraser marks, or stray marks.
3 - There are some smudges, cross-outs, or messy corrections that distract from the writing.
2 - There are many messy marks, heavy pressure marks, or corrections that make the page harder to read.
1 - Smudges, scribbles, tears, or messy marks make the writing very difficult to read.

6. Page Layout and Paragraphs (20%)
5 - The page is well organized. Paragraphs are clear, writing starts near the margin, and the student uses the lines and space neatly.
4 - The page is mostly organized. Paragraphs are mostly clear, writing usually lines up with the margin, and most lines are used well.
3 - Page layout is uneven. Paragraphs may be unclear, some writing may not line up with the margin, or some lines may leave awkward empty space.
2 - Page layout makes the writing harder to follow. Paragraphs are missing or confusing, many lines do not line up well, or the space on the page is not used well.
1 - The page is very disorganized. It is hard to tell where paragraphs start or end, the writing does not follow the margin or lines well, or the layout makes the story difficult to read.

After scoring the six sub-criteria, calculate the weighted final neatness score on a 1-5 scale:
Final 1-5 = (Letter Formation x 0.20) + (Spacing x 0.15) + (Staying on the Line x 0.15) + (Size Consistency x 0.15) + (Pen Control and Marks x 0.15) + (Page Layout and Paragraphs x 0.20)
Round the weighted 1-5 score to the nearest whole number, then convert it to the app's 10-point scale by multiplying by 2.
Examples: 5/5 = 10/10, 4/5 = 8/10, 3/5 = 6/10, 2/5 = 4/10, 1/5 = 2/10.

IMPORTANT - Write in plain, friendly words that a 10-12 year old student will understand.
Avoid technical handwriting terms. Use everyday words like: "your letters", "easy to read", "spaces between words", "staying on the line", "paragraphs", "margin", "using the space on each line", "cross-outs", "messy marks", "shaky lines", etc.
If the photo is blurry, cropped, too dark, or does not show enough handwriting to score fairly, use "Missing" rather than guessing.

Use exactly this format:
**Sub-scores:**
- Letter Formation: [score]/5 - [level name]
- Spacing: [score]/5 - [level name]
- Staying on the Line: [score]/5 - [level name]
- Size Consistency: [score]/5 - [level name]
- Pen Control and Marks: [score]/5 - [level name]
- Page Layout and Paragraphs: [score]/5 - [level name]

**Detailed Feedback Input Scores:**
- Neatness: [converted final score]/10 ([rounded final score]/5 - [level name]) - [one sentence describing the most noticeable thing you see in this student's handwriting overall]

**Neatness Growth Tip:** [one short, specific tip written directly to the student about the single most important thing to work on]

Example:
**Sub-scores:**
- Letter Formation: 4/5 - Proficient
- Spacing: 3/5 - Developing
- Staying on the Line: 4/5 - Proficient
- Size Consistency: 3/5 - Developing
- Pen Control and Marks: 4/5 - Proficient
- Page Layout and Paragraphs: 3/5 - Developing

**Detailed Feedback Input Scores:**
- Neatness: 8/10 (4/5 - Proficient) - Most of your letters are easy to read, but some words need clearer spaces between them.
**Neatness Growth Tip:** Try leaving a finger-width gap between each word so your writing is easier to read.`;

    try {
        var response = await callOpenRouterImage(model, prompt, originalImageUrl);
        var rubric = {};

        // Parse the 1-5 sub-scores from the image rubric.
        var subScores = {
            letterFormation:  parseNeatnessSubScore('Letter Formation', response),
            spacing:          parseNeatnessSubScore('Spacing', response),
            stayingOnLine:    parseNeatnessSubScore('Staying on the Line', response),
            sizeConsistency:  parseNeatnessSubScore('Size Consistency', response),
            penControl:       parseNeatnessSubScore('Pen Control and Marks', response),
            pageLayoutParagraphs: parseNeatnessSubScore('Page Layout and Paragraphs', response)
        };

        var weightedFive = calculateWeightedNeatnessFive(subScores);
        var roundedFive = weightedFive != null ? Math.round(weightedFive) : null;
        var computedTen = roundedFive != null ? convertNeatnessFiveToTen(roundedFive) : null;

        // Parse the response - expected pattern: - Neatness: [score]/10 ([score]/5 - [level]) - [observation]
        var match = response.match(/-\s*Neatness:\s*((?:10|8|6|4|2)|Missing)\s*\/10(?:\s*\([^)]*\))?\s*-\s*([^\n]+)/i);
        var growthTipMatch = response.match(/\*\*Neatness Growth Tip:\*\*\s*([^\n]+)/i);
        var parsedGrowthTip = growthTipMatch ? growthTipMatch[1].trim() : null;

        if (match) {
            var parsedTen = /missing/i.test(match[1]) ? null : Number(match[1]);
            rubric = {
                score: computedTen != null ? computedTen : parsedTen,
                reason: (match[2] || "").trim(),
                growthTip: parsedGrowthTip,
                subScores: subScores,
                neatnessScoreFive: roundedFive,
                neatnessWeightedFive: weightedFive
            };
        } else {
            // Fallback: score present but observation was not in the expected format.
            var scoreMatch = response.match(/(?:10|8|6|4|2)\s*\/10/i);
            if (scoreMatch || computedTen != null) {
                var score = computedTen != null ? computedTen : Number(scoreMatch[0].match(/(?:10|8|6|4|2)/)[0]);
                var sentenceMatch = response.match(/([^.\n]*(?:10|8|6|4|2)\s*\/10[^.\n]*\.?)/i);
                var extractedReason = sentenceMatch ? sentenceMatch[0].replace(/^\s*[-*\d.]+\s*/, "").trim() : "";
                var reason = extractedReason.length > 10 ? extractedReason : null;
                rubric = {
                    score: score,
                    reason: reason,
                    growthTip: parsedGrowthTip,
                    subScores: subScores,
                    neatnessScoreFive: roundedFive,
                    neatnessWeightedFive: weightedFive
                };
            }
        }

        if (rubric && (rubric.score !== undefined)) {
            return { quickRubric: rubric };
        }
    } catch (e) {
        wftDebugError("Neatness assessment failed:", e);
    }
    return null;
}

/* =============================================
   GOOGLE AUTH & DRIVE SYNC
============================================= */

// In a real deployment you would register an OAuth client ID
// at console.cloud.google.com and replace this placeholder.
/*
 * GITHUB PAGES STATIC HOSTING - SETUP CHECKLIST
 *
 * This file uses a browser-only OAuth implicit grant flow.
 * No backend server is required.
 *
 * Before Google Sign-In will work, configure the following
 * in Google Cloud Console > APIs & Services > Credentials
 * > your OAuth 2.0 Web Client ID:
 *
 * Authorized JavaScript origins:
 *   https://thepick.github.io
 *
 * Authorized redirect URIs:
 *   https://thepick.github.io/writing-feedback-tool/
 *
 * Also ensure these APIs are enabled in your Google Cloud project:
 *   - Google Drive API
 *   - Google People API (or Google OAuth2 API for userinfo)
 *
 * The Google OAuth Client ID is embedded below so users do not need
 * to enter it in the Settings panel.
 *
 * WFT_GIS_AUTH_V2:
 * Google Identity Services token client is used first. The older OAuth
 * implicit redirect flow remains as a fallback if GIS cannot open.
 */
var WFT_APP_VERSION = "v9";
var GOOGLE_CLIENT_ID = "546695859117-18drps6vl0l8u6pcp9mgfhcc972rebl0.apps.googleusercontent.com";
var DRIVE_FOLDER_NAME = "WritingFeedbackTool";
var GOOGLE_USER_CACHE_KEY = "wft_google_user";
var DRIVE_TOKEN_CACHE_KEY = "wft_drive_access_token";
var DRIVE_TOKEN_EXPIRY_CACHE_KEY = "wft_drive_access_token_expiry";
var GOOGLE_CONNECTED_CACHE_KEY = "wft_google_connected";

// ── WFT Sync Engine V2 feature flags ──
var WFT_SYNC_ENGINE_V2 = true;
var WFT_SYNC_ENGINE_V2_SAFE_MODE = false;
var WFT_SYNC_DEBUG = false;
var WFT_VISIBILITY_SYNC_COOLDOWN_MS = 2500;
var wftLastVisibilitySyncAt = 0;
var WFT_DEBUG = false;
var WFT_DUPLICATE_DETECTION_V2 = true;
var WFT_DUPLICATE_CLEANUP_V2 = false;
var WFT_IMAGE_IDEMPOTENCY_V2 = true;
var WFT_SESSION_TOKEN_STORAGE_V2 = true;
var WFT_GIS_AUTH_V2 = true;


function isWftDebugLoggingEnabled() {
    return WFT_DEBUG === true || WFT_SYNC_DEBUG === true;
}

function wftDebugLog() {
    if (!isWftDebugLoggingEnabled()) return;
    if (typeof window !== "undefined" && window.console && window.console.log) {
        window.console.log.apply(window.console, arguments);
    }
}

function wftDebugWarn() {
    if (!isWftDebugLoggingEnabled()) return;
    if (typeof window !== "undefined" && window.console && window.console.warn) {
        window.console.warn.apply(window.console, arguments);
    }
}

function wftDebugError() {
    if (!isWftDebugLoggingEnabled()) return;
    if (typeof window !== "undefined" && window.console && window.console.error) {
        window.console.error.apply(window.console, arguments);
    }
}


function normalizeWftAsyncErrorForLog(err) {
    if (!err) return { message: "Unknown async error" };
    return {
        name: err.name || "",
        message: err.message || String(err),
        status: err.status || 0,
        reason: err.reason || ""
    };
}

function isWftLikelyDriveOrSyncError(err) {
    var msg = String((err && err.message) || err || "");
    if (err && (err.status || err.reason || err.notFound)) return true;
    return /drive|google|fetch|network|token|oauth|sync|upload|timeout|offline/i.test(msg);
}

if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("unhandledrejection", function(event) {
        var reason = event && event.reason ? event.reason : null;
        wftDebugError("[WFT] Unhandled promise rejection", normalizeWftAsyncErrorForLog(reason));
        if (isWftLikelyDriveOrSyncError(reason)) {
            try {
                if (typeof setDriveSyncStatus === "function") {
                    setDriveSyncStatus("error", "Background action failed - please retry or reconnect Drive.");
                }
            } catch (e) { }
        }
    });
}

// ── Storage Upgrade V1 feature flags (Patch 0) ──
var WFT_STORAGE_SCHEMA_VERSION = 1;
var WFT_PROACTIVE_STRIP_V1 = false;
var WFT_IMAGE_COMPRESSION_V1 = false;
var WFT_ASYNC_PORTFOLIO_ACCESS_V1 = false;
var WFT_INDEXEDDB_CACHE_V1 = false;
var WFT_PORTFOLIO_INDEX_V1 = false;
var WFT_STUDENT_ID_MAP_V1 = false;
var WFT_SPLIT_STUDENT_FILES_V1 = false;
var WFT_LAZY_PORTFOLIO_LOAD_V1 = false;
var WFT_STORAGE_HEALTH_UI_V1 = false;

var WFT_SETTINGS_FILENAME = "wft-settings.json";
var WFT_PORTFOLIO_FILENAME = "wft-portfolio.json";
var WFT_DELETIONS_FILENAME = "wft-deletions.json";
var WFT_DELETIONS_STORAGE_KEY = "wft_deletions";
var WFT_DRIVE_FOLDER_ID_CACHE_KEY = "wft_drive_folder_id";
var WFT_SETTINGS_FILE_ID_CACHE_KEY = "wft_drive_settings_file_id";
var WFT_PORTFOLIO_FILE_ID_CACHE_KEY = "wft_drive_portfolio_file_id";
var WFT_DELETIONS_FILE_ID_CACHE_KEY = "wft_drive_deletions_file_id";
var WFT_PORTFOLIO_INDEX_FILE_ID_CACHE_KEY = "wft_drive_portfolio_index_file_id";  // Patch 6
var WFT_SYNC_DEBOUNCE_MS = 2500;
var WFT_POLL_INTERVAL_MS = 60000;
var WFT_SAVE_FILE_TIMEOUT_MS = 30000;
var DRIVE_TOKEN_SESSION_KEY = "wft_drive_token_session";
var WFT_LAST_DRIVE_SYNC_KEY = "wft_last_drive_sync_at";
var WFT_TOKEN_FRESHNESS_BUFFER_MS = 7 * 60 * 1000;
var WFT_TOKEN_EXPIRY_WARNING_MS = 5 * 60 * 1000;
var WFT_ALLOW_LEGACY_LOCAL_TOKEN_MIGRATION = false;
var WFT_GOOGLE_AUTH_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
var WFT_GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
var WFT_GIS_SILENT_RETRY_COOLDOWN_MS = 2 * 60 * 1000;
var WFT_GIS_FALLBACK_TO_REDIRECT = true;
var wftTokenExpiryWarningTimer = null;
var wftGisScriptLoadPromise = null;
var wftGisTokenClient = null;
var wftGisActiveTokenRequest = null;
var wftGisSilentRefreshInFlight = null;
var wftGisSilentBootstrapInFlight = null;
var wftLastSilentGisAttemptAt = 0;
var wftSuppressDirtyMarks = false;

// ═══════════════════════════════════════════════════════════════════════════
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
function generateWFTShortId(len) { return _wftGenShortId(len || 8); }

// ── Storage metadata helpers ──
function _wftDefaultStorageMeta() {
    return {
        schemaVersion: WFT_STORAGE_SCHEMA_VERSION,
        activePortfolioFormat: "legacy-name-keyed",
        migrationStartedAt: "",
        migrationCompletedAt: "",
        lastSuccessfulPatch: "",
        lastDriveSyncAt: "",
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
    } catch (e) {
        wftDebugWarn("[StorageMeta] Write failed:", e);
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

// ── Safe Mode ──
function enterWftStorageSafeMode(reason) {
    var meta = getWftStorageMeta();
    meta.safeMode = true;
    meta.safeModeReason = reason || "manual";
    setWftStorageMeta(meta);
    wftDebugWarn("[SafeMode] ENTERED — reason:", reason);
    // If a UI notification function exists, show a banner
    if (typeof setDriveSyncStatus === "function") {
        setDriveSyncStatus("warning", "Safe mode active — " + (reason || "manual override"));
    }
}

function exitWftStorageSafeMode() {
    var meta = getWftStorageMeta();
    meta.safeMode = false;
    meta.safeModeReason = "";
    setWftStorageMeta(meta);
    wftDebugLog("[SafeMode] EXITED");
}

function toggleWftSafeMode() {
    if (isWftStorageSafeMode()) {
        exitWftStorageSafeMode();
    } else {
        enterWftStorageSafeMode("manual-toggle");
    }
    refreshStorageHealthUI();
}

function isWftStorageSafeMode() {
    return getWftStorageMeta().safeMode === true;
}

// ── Emergency Backup ──
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
            WFT_SYNC_ENGINE_V2: WFT_SYNC_ENGINE_V2
        },
        contents: {}
    };

    var keysToBackup = [
        "wft_settings", "wft_students", "wft_portfolio",
        "wft_deletions", "wft_storage_meta", "wft_selectedStudent",
        "wft_drive_folder_id", "wft_drive_settings_file_id",
        "wft_drive_portfolio_file_id", "wft_drive_deletions_file_id",
        "wft_google_user", "wft_google_connected"
    ];

    for (var bi = 0; bi < keysToBackup.length; bi++) {
        var bk = keysToBackup[bi];
        try {
            var raw = localStorage.getItem(bk);
            if (raw !== null) {
                try { backup.contents[bk] = JSON.parse(raw); }
                catch (pe) { backup.contents[bk] = raw; }
            }
        } catch (e) { backup.contents[bk] = null; }
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
    wftDebugLog("[EmergencyBackup] Downloaded:", a.download);
    return a.download;
}

function saveWftPreMigrationBackupToDrive(callback) {
    var backup = buildWftEmergencyBackupObject();
    var json = JSON.stringify(backup, null, 2);
    var filename = "wft-pre-migration-" + backup.timestamp.replace(/[:.]/g, "-") + ".json";

    if (!isWftTokenValid || !isWftTokenValid()) {
        wftDebugWarn("[EmergencyBackup] Not signed in — local download only");
        downloadWftEmergencyBackup();
        if (callback) { callback(null, "local-only"); }
        return;
    }

    if (typeof saveFileToDrive === "function") {
        saveFileToDrive(filename, json, "application/json", function(err, fileId) {
            if (err) {
                wftDebugError("[EmergencyBackup] Drive upload failed:", err);
                downloadWftEmergencyBackup();
                if (callback) { callback(err, "fallback-local"); }
            } else {
                wftDebugLog("[EmergencyBackup] Saved to Drive:", filename, fileId);
                if (callback) { callback(null, fileId); }
            }
        });
    } else {
        downloadWftEmergencyBackup();
        if (callback) { callback(null, "local-only"); }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 0
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 1 — DATA MODEL PREPARATION (stable IDs + date normalization)
// ═══════════════════════════════════════════════════════════════════════════

function getWftShortIdPart(len) {
    if (typeof _wftGenShortId === "function") { return _wftGenShortId(len); }
    if (typeof generateWftShortId === "function") { return generateWftShortId(len); }
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    var count = len || 4;
    for (var i = 0; i < count; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
}

function createWftId(prefix) {
    var ts = Date.now().toString(36);
    var rand = getWftShortIdPart(4);
    return (prefix || "id") + "_" + ts + "_" + rand;
}

function sanitizeStudentIdPart(value) {
    if (!value) { return "unknown"; }
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .substring(0, 30) || "unknown";
}

function createStableStudentId(studentName, existingMap) {
    var safePart = sanitizeStudentIdPart(studentName);
    var d = new Date();
    var datePart = d.getFullYear().toString() +
        ("0" + (d.getMonth() + 1)).slice(-2) +
        ("0" + d.getDate()).slice(-2);
    var baseId = "stu_" + safePart + "_" + datePart;

    if (existingMap) {
        var existingKeys = Object.keys(existingMap);
        for (var ci = 0; ci < existingKeys.length; ci++) {
            if (existingMap[existingKeys[ci]] === baseId && existingKeys[ci] !== studentName) {
                baseId = baseId + "_" + getWftShortIdPart(4);
                break;
            }
        }
    }
    return baseId;
}

function getOrCreateStudentId(studentName) {
    var settings;
    try { settings = getRawSettings ? getRawSettings() : {}; }
    catch (e) { settings = {}; }

    if (!settings.studentIdMap) { settings.studentIdMap = {}; }
    if (settings.studentIdMap[studentName]) {
        return settings.studentIdMap[studentName];
    }

    var newId = createStableStudentId(studentName, settings.studentIdMap);
    settings.studentIdMap[studentName] = newId;

    if (!settings.studentRecords) { settings.studentRecords = []; }
    var found = false;
    for (var sri = 0; sri < settings.studentRecords.length; sri++) {
        if (settings.studentRecords[sri].displayName === studentName) {
            settings.studentRecords[sri].studentId = newId;
            settings.studentRecords[sri].updatedAt = new Date().toISOString();
            found = true;
            break;
        }
    }
    if (!found) {
        settings.studentRecords.push({
            studentId: newId,
            displayName: studentName,
            legacyNameKeys: [studentName],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    if (typeof saveSettingsToLocalStorage === "function") {
        try { saveSettingsToLocalStorage(settings); } catch (e) {}
    }
    return newId;
}

// ── Session Date Normalization ──

function normalizeWftSessionDate(session) {
    if (!session) { return; }

    if (!session.createdAt || isNaN(Date.parse(session.createdAt))) {
        if (session.timestamp && !isNaN(Date.parse(session.timestamp))) {
            session.createdAt = session.timestamp;
        } else if (session.date && !isNaN(Date.parse(session.date))) {
            session.createdAt = session.date;
        } else {
            session.createdAt = new Date().toISOString();
        }
    }

    // Do not refresh updatedAt during normalization.
    // Merge logic uses updatedAt to decide which version is newer, so
    // unchanged legacy sessions should keep their existing timestamp.
    if (!session.updatedAt || isNaN(Date.parse(session.updatedAt))) {
        session.updatedAt = session.createdAt || new Date().toISOString();
    }

    if (!session.normalizedAt || isNaN(Date.parse(session.normalizedAt))) {
        session.normalizedAt = new Date().toISOString();
    }

    if (!session.dateIso) {
        try { session.dateIso = new Date(session.createdAt).toISOString().substring(0, 10); }
        catch (e) { session.dateIso = new Date().toISOString().substring(0, 10); }
    }

    if (!session.displayDate) {
        if (session.date) {
            session.displayDate = session.date;
        } else {
            try {
                var dd = new Date(session.dateIso);
                var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                session.displayDate = months[dd.getMonth()] + " " + dd.getDate() + ", " + dd.getFullYear();
            } catch (e) {
                session.displayDate = session.dateIso;
            }
        }
    }

    if (!session.id) {
        session.id = createWftId("sess");
    }
}

function normalizeWftSessionForStorage(session) {
    normalizeWftSessionDate(session);
    return session;
}

function normalizeWftStudentRecord(studentName, sessions) {
    if (!sessions || !Array.isArray(sessions)) { sessions = []; }
    for (var nsi = 0; nsi < sessions.length; nsi++) {
        normalizeWftSessionForStorage(sessions[nsi]);
    }
    sessions.sort(function(a, b) {
        if (!a.createdAt) { return 1; }
        if (!b.createdAt) { return -1; }
        if (a.createdAt < b.createdAt) { return 1; }
        if (a.createdAt > b.createdAt) { return -1; }
        return 0;
    });
    return sessions;
}

function normalizeWftPortfolioForSchemaV1(portfolio) {
    if (!portfolio) { return {}; }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        return portfolio;
    }
    var normalized = {};
    var names = Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });

    for (var npi = 0; npi < names.length; npi++) {
        var name = names[npi];
        var studentData = portfolio[name];
        if (!studentData || typeof studentData !== "object") { continue; }

        var sessions = studentData.sessions || [];
        if (Array.isArray(studentData) && !studentData.sessions) {
            sessions = studentData;
        }

        normalized[name] = {
            sessions: normalizeWftStudentRecord(name, sessions)
        };

        if (WFT_STUDENT_ID_MAP_V1) {
            try { getOrCreateStudentId(name); } catch (e) {}
        }
    }

    if (portfolio._meta) { normalized._meta = portfolio._meta; }
    return normalized;
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 1
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 2 — PROACTIVE HEAVY-FIELD STRIPPING
// ═══════════════════════════════════════════════════════════════════════════

var WFT_STRIP_CORRECTED_HTML_MAX = 10000;
var WFT_STRIP_MARKUP_MAX = 20000;
var WFT_STRIP_ORIGINAL_TEXT_MAX = 20000;

function makeImageMetadataLocalStorageSafe(image, index) {
    if (!image) { return image; }
    var safe = {};
    var keys = Object.keys(image);
    for (var imk = 0; imk < keys.length; imk++) {
        var ik = keys[imk];
        var iv = image[ik];
        if (ik === "dataUrl" || ik === "originalDataUrl") {
            safe[ik] = "";
            safe.dataUrlRemovedForStorage = true;
        } else if (ik === "extractedText") {
            safe[ik] = "";
            safe.extractedTextRemovedForStorage = true;
        } else {
            safe[ik] = iv;
        }
    }
    return safe;
}

function makeSessionLocalStorageSafe(session) {
    if (!session) { return session; }
    var safe = {};
    var keys = Object.keys(session);
    for (var sk = 0; sk < keys.length; sk++) {
        var k = keys[sk];
        var v = session[k];
        if (k === "images" && Array.isArray(v)) {
            safe[k] = [];
            for (var imj = 0; imj < v.length; imj++) {
                safe[k].push(makeImageMetadataLocalStorageSafe(v[imj], imj));
            }
        } else if (k === "correctedHtml" && typeof v === "string" && v.length > WFT_STRIP_CORRECTED_HTML_MAX) {
            safe[k] = v.substring(0, WFT_STRIP_CORRECTED_HTML_MAX);
            safe.correctedHtmlRemovedForStorage = true;
        } else if (k === "correctedMarkup" && typeof v === "string" && v.length > WFT_STRIP_MARKUP_MAX) {
            safe[k] = v.substring(0, WFT_STRIP_MARKUP_MAX);
            safe.correctedMarkupTruncatedForStorage = true;
        } else if (k === "originalText" && typeof v === "string" && v.length > WFT_STRIP_ORIGINAL_TEXT_MAX) {
            safe[k] = v.substring(0, WFT_STRIP_ORIGINAL_TEXT_MAX);
            safe.originalTextTruncatedForStorage = true;
        } else {
            safe[k] = v;
        }
    }
    return safe;
}

function makePortfolioLocalStorageSafe(data) {
    if (!data) { return data; }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        return data;
    }
    var safe = {};
    var keys = Object.keys(data);
    for (var pk = 0; pk < keys.length; pk++) {
        var k = keys[pk];
        var v = data[k];
        if (k === "_meta") {
            safe[k] = v;
        } else if (v && typeof v === "object" && v.sessions) {
            safe[k] = { sessions: [] };
            for (var pj = 0; pj < v.sessions.length; pj++) {
                safe[k].sessions.push(makeSessionLocalStorageSafe(v.sessions[pj]));
            }
        } else {
            safe[k] = v;
        }
    }
    return safe;
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 2
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 3 — IMAGE COMPRESSION BEFORE DRIVE UPLOAD
// ═══════════════════════════════════════════════════════════════════════════

var WFT_IMAGE_FULL_MAX_WIDTH = 1600;
var WFT_IMAGE_FULL_JPEG_QUALITY = 0.78;
var WFT_THUMB_MAX_WIDTH = 300;
var WFT_THUMB_JPEG_QUALITY = 0.72;

function loadImageElementFromDataUrl(dataUrl, callback) {
    var img = new Image();
    img.onload = function() { callback(null, img); };
    img.onerror = function() { callback(new Error("Failed to load image from data URL"), null); };
    if (dataUrl && dataUrl.indexOf("data:") === 0) {
        img.src = dataUrl;
    } else {
        callback(new Error("Invalid data URL"), null);
    }
}

function resizeImageDataUrlToBlob(dataUrl, options, callback) {
    options = options || {};
    var maxWidth = options.maxWidth || WFT_IMAGE_FULL_MAX_WIDTH;
    var quality = options.quality || WFT_IMAGE_FULL_JPEG_QUALITY;
    var outputType = options.outputType || "image/jpeg";

    loadImageElementFromDataUrl(dataUrl, function(err, img) {
        if (err) {
            try { var fb = dataUrlToBlob(dataUrl); callback(null, fb); }
            catch (e2) { callback(err, null); }
            return;
        }
        try {
            var origW = img.naturalWidth || img.width;
            var origH = img.naturalHeight || img.height;
            var targetW = origW;
            var targetH = origH;
            if (origW > maxWidth) {
                var ratio = maxWidth / origW;
                targetW = maxWidth;
                targetH = Math.round(origH * ratio);
            }
            var canvas = document.createElement("canvas");
            canvas.width = targetW;
            canvas.height = targetH;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, targetW, targetH);
            canvas.toBlob(function(blob) {
                if (blob) { callback(null, blob); }
                else {
                    var dataUrlOut = canvas.toDataURL(outputType, quality);
                    try { callback(null, dataUrlToBlob(dataUrlOut)); }
                    catch (e3) { callback(new Error("canvas.toBlob failed"), null); }
                }
            }, outputType, quality);
        } catch (e) {
            try { callback(null, dataUrlToBlob(dataUrl)); }
            catch (e2) { callback(e, null); }
        }
    });
}

function compressPortfolioImageForDrive(image, callback) {
    if (!image || !image.dataUrl) { callback(new Error("No image data URL"), null); return; }
    resizeImageDataUrlToBlob(image.dataUrl, {
        maxWidth: WFT_IMAGE_FULL_MAX_WIDTH,
        quality: WFT_IMAGE_FULL_JPEG_QUALITY,
        outputType: "image/jpeg"
    }, callback);
}

function createPortfolioThumbnailBlob(image, callback) {
    if (!image || !image.dataUrl) { callback(new Error("No image data URL for thumbnail"), null); return; }
    resizeImageDataUrlToBlob(image.dataUrl, {
        maxWidth: WFT_THUMB_MAX_WIDTH,
        quality: WFT_THUMB_JPEG_QUALITY,
        outputType: "image/jpeg"
    }, callback);
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 3
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 6 — PORTFOLIO INDEX
// ═══════════════════════════════════════════════════════════════════════════

function markWftPortfolioIndexDirty(reason) {
    if (!WFT_PORTFOLIO_INDEX_V1 || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) { return; }
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
        wftDebugWarn("[PortfolioIndex] Failed to mark dirty:", e);
    }
}

function isWftPortfolioIndexDirty() {
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) { return false; }
    try {
        var raw = localStorage.getItem("wft_settings");
        if (raw) {
            return JSON.parse(raw)._indexDirty === true;
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

    for (var pi = 0; pi < names.length; pi++) {
        var name = names[pi];
        var studentData = portfolio[name];
        if (!studentData || (!studentData.sessions && !Array.isArray(studentData))) { continue; }

        var sessions = Array.isArray(studentData) ? studentData : (studentData.sessions || []);
        var studentId = "";

        if (WFT_STUDENT_ID_MAP_V1) {
            try {
                var settings = getRawSettings ? getRawSettings() : {};
                if (settings.studentIdMap && settings.studentIdMap[name]) {
                    studentId = settings.studentIdMap[name];
                }
            } catch (e) {}
        }

        var latestSessionAt = "";
        var totalScore = 0;
        var scorableCount = 0;

        for (var pj = 0; pj < sessions.length; pj++) {
            var s = sessions[pj];
            if (s.createdAt && (!latestSessionAt || s.createdAt > latestSessionAt)) {
                latestSessionAt = s.createdAt;
            }
            if (typeof s.overallScore === "number" && !isNaN(s.overallScore)) {
                totalScore += s.overallScore;
                scorableCount += 1;
            }
        }

        var averageScore = scorableCount > 0 ? Math.round(totalScore / scorableCount) : 0;

        var studentFileId = "";
        var cacheKey = "wft_drive_student_file_" + (studentId || sanitizeStudentIdPart(name));
        try { studentFileId = localStorage.getItem(cacheKey) || ""; } catch (e) {}

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
                setCachedWftDriveFileId(filename, fileId);
            }
            clearWftPortfolioIndexDirty();
            updateWftStorageMeta("patch-6-index", "saved");
            if (callback) { callback(null, fileId || "saved"); }
        }).catch(function(err) {
            wftDebugWarn("[PortfolioIndex] Drive save failed:", err);
            if (callback) { callback(err, null); }
        });
    } else if (typeof saveFileToDrive === "function" && typeof isWftTokenValid === "function" && isWftTokenValid()) {
        saveFileToDrive(filename, JSON.stringify(index, null, 2), "application/json", function(err, fileId) {
            if (!err && fileId) {
                setCachedWftDriveFileId(filename, fileId);
                clearWftPortfolioIndexDirty();
            }
            if (callback) { callback(err, fileId); }
        });
    } else {
        wftDebugWarn("[PortfolioIndex] Not signed in - index saved locally only");
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
    try { cachedFileId = getCachedWftDriveFileId("portfolio-index.json") || ""; } catch (e) {}

    if (cachedFileId && typeof downloadWftJsonFilePromise === "function") {
        downloadWftJsonFilePromise(cachedFileId)
            .then(function(data) {
                if (data && data.format === "portfolio-index-v1") {
                    wftDebugLog("[PortfolioIndex] Loaded from Drive");
                    callback(null, data);
                } else {
                    callback(null, null);
                }
            })
            .catch(function(err) {
                wftDebugWarn("[PortfolioIndex] Drive load failed, will rebuild:", err);
                callback(err, null);
            });
    } else {
        if (typeof findWftFilesByNamePromise === "function" && typeof isWftTokenValid === "function" && isWftTokenValid()) {
            findWftFilesByNamePromise("portfolio-index.json")
                .then(function(files) {
                    if (files && files.length > 0) {
                        var canonical = (typeof chooseCanonicalWftFile === "function") ? chooseCanonicalWftFile(files) : files[0];
                        var fileId = canonical && canonical.id ? canonical.id : "";
                        if (fileId) {
                            try { setCachedWftDriveFileId("portfolio-index.json", fileId); } catch (e) {}
                            if (typeof updateDuplicateSyncMaintenanceFromFiles === "function") {
                                try { updateDuplicateSyncMaintenanceFromFiles("portfolio-index.json", files); } catch (e2) {}
                            }
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
    try { portfolio = getPortfolioData(); }
    catch (e) {
        wftDebugError("[PortfolioIndex] Failed to get portfolio:", e);
        if (callback) { callback(e, null); }
        return;
    }

    var index = buildPortfolioIndexFromPortfolio(portfolio);

    if (WFT_STUDENT_ID_MAP_V1) {
        var indexNames = Object.keys(index.students);
        for (var ri = 0; ri < indexNames.length; ri++) {
            var entry = index.students[indexNames[ri]];
            if (!entry.studentId) {
                try { entry.studentId = getOrCreateStudentId(entry.displayName); } catch (e) {}
            }
        }
        index.updatedAt = new Date().toISOString();
    }

    savePortfolioIndexToDrive(index, function(err, fileId) {
        if (err) {
            wftDebugWarn("[PortfolioIndex] Rebuild — Drive save failed:", err);
        } else {
            updateWftStorageMeta("patch-6-index", "rebuilt");
            wftDebugLog("[PortfolioIndex] Rebuilt successfully, fileId:", fileId);
        }
        if (callback) { callback(err, index); }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 6
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
function recordWftDriveSyncSuccess(reason) {
    var nowIso = new Date().toISOString();
    try {
        wftSyncState.lastSyncAt = nowIso;
    } catch (e) { }
    try {
        localStorage.setItem(WFT_LAST_DRIVE_SYNC_KEY, nowIso);
    } catch (e2) { }
    try {
        var meta = getWftStorageMeta();
        meta.lastDriveSyncAt = nowIso;
        meta.lastDriveSyncReason = reason || "drive-sync";
        setWftStorageMeta(meta);
    } catch (e3) { }
}

function getWftLastDriveSyncAt() {
    var value = "";
    try {
        if (wftSyncState && wftSyncState.lastSyncAt) {
            value = wftSyncState.lastSyncAt;
        }
    } catch (e) { }
    if (value) { return value; }

    try {
        value = localStorage.getItem(WFT_LAST_DRIVE_SYNC_KEY) || "";
    } catch (e2) { }
    if (value) { return value; }

    try {
        var meta = getWftStorageMeta();
        value = meta.lastDriveSyncAt || "";
    } catch (e3) { }
    return value || "";
}

function formatWftTokenTimeRemaining(expiresAt) {
    var expiry = Number(expiresAt || 0);
    if (!expiry) { return "not connected"; }
    var diff = expiry - Date.now();
    if (diff <= 0) { return "expired"; }
    var minutes = Math.ceil(diff / 60000);
    if (minutes < 60) { return "active, about " + minutes + " min left"; }
    var hours = Math.floor(minutes / 60);
    var rem = minutes % 60;
    return "active, about " + hours + "h " + rem + "m left";
}

// ═══════════════════════════════════════════════════════════════════════════
function getWftStorageHealthHelpText(label) {
    var help = {
        "Storage mode": "How the app saves portfolio records. Name-based storage still works, but ID-based storage is safer long term.",
        "Safe mode": "Whether troubleshooting mode is active. Off means normal app loading.",
        "localStorage size": "Small browser storage used by the app. A few hundred KB is normal.",
        "IndexedDB": "Larger browser database used for heavier saved data, including portfolio records and images.",
        "Portfolio index": "The app's list of saved student writing sessions. Clean means no repair is needed.",
        "Active roster": "The students currently listed in Manage Class.",
        "Cached data": "Saved portfolio records that match students currently in Manage Class.",
        "Old cached data": "Saved portfolio records for students who are no longer in Manage Class. These can be removed if deleted students should stay deleted.",
        "Portfolio cache total": "All portfolio records currently stored in this browser, including any old off-roster records.",
        "Google session": "Whether the current Google Drive access token is still available in this browser.",
        "Last Drive sync": "The last successful Google Drive load or save from this browser. Never means no completed Drive activity has been recorded here yet.",
        "Last index rebuild": "The last time the portfolio index was repaired or rebuilt.",
        "Source of truth": "The saved-data source the app currently trusts most when loading portfolio information."
    };
    return help[label] || "";
}

function stripWftSimpleBoldTags(text) {
    return String(text || "").replace(/<\/?b>/g, "");
}

function renderStorageHealthSummaryLines(summaryEl, lines) {
    if (!summaryEl) { return; }
    summaryEl.textContent = "";
    for (var i = 0; i < lines.length; i++) {
        var line = String(lines[i] || "");
        var plainLine = stripWftSimpleBoldTags(line);
        var colonIndex = plainLine.indexOf(":");
        var label = colonIndex >= 0 ? plainLine.slice(0, colonIndex) : plainLine;
        var value = colonIndex >= 0 ? plainLine.slice(colonIndex + 1).replace(/^\s+/, "") : "";
        var helpText = getWftStorageHealthHelpText(label);

        var row = document.createElement("div");
        row.className = "storage-health-row";

        var main = document.createElement("div");
        main.className = "storage-health-main";

        var labelEl = document.createElement("div");
        labelEl.className = "storage-health-label";
        labelEl.textContent = label;
        main.appendChild(labelEl);

        var valueEl = document.createElement("div");
        valueEl.className = "storage-health-value";
        valueEl.textContent = value || "-";
        main.appendChild(valueEl);

        row.appendChild(main);

        if (helpText) {
            var helpEl = document.createElement("div");
            helpEl.className = "storage-health-explain";
            helpEl.textContent = helpText;
            row.appendChild(helpEl);
        }

        summaryEl.appendChild(row);
    }
}

// PATCH 13 — STORAGE & SYNC HEALTH UI
// ═══════════════════════════════════════════════════════════════════════════

function refreshStorageHealthUI() {
    if (!WFT_STORAGE_HEALTH_UI_V1) {
        var section = document.getElementById("storageHealthSection");
        if (section) { section.style.display = "none"; }
        return;
    }

    var section = document.getElementById("storageHealthSection");
    if (section) { section.style.display = "block"; }

    var safeMode = isWftStorageSafeMode();
    var meta = getWftStorageMeta();
    var lsSize = estimateLocalStorageSize();

    var lines = [];
    lines.push("Storage mode: <b>" + meta.activePortfolioFormat.replace(/-/g, " ") + "</b>");
    lines.push("Safe mode: <b>" + (safeMode ? "ON (" + meta.safeModeReason + ")" : "off") + "</b>");
    lines.push("localStorage size: <b>" + formatWftBytes(lsSize) + "</b>");
    lines.push("IndexedDB: <b>" + (checkIndexedDbAvailable() ? "available" : "unavailable") + "</b>");

    // Portfolio index status
    var indexDirty = isWftPortfolioIndexDirty();
    lines.push("Portfolio index: <b>" + (WFT_PORTFOLIO_INDEX_V1 ? (indexDirty ? "dirty" : "clean") : "disabled") + "</b>");

    // Cached data counts
    var cacheSummary = getWftPortfolioCacheSummary();
    lines.push("Active roster: <b>" + cacheSummary.rosterStudents + (cacheSummary.rosterStudents === 1 ? " student" : " students") + "</b>");
    lines.push("Cached data: <b>" + cacheSummary.activePortfolioStudents + " active " + (cacheSummary.activePortfolioStudents === 1 ? "student" : "students") + ", " + cacheSummary.activePortfolioSessions + " visible " + (cacheSummary.activePortfolioSessions === 1 ? "session" : "sessions") + "</b>");
    if (cacheSummary.offRosterStudents > 0) {
        lines.push("Old cached data: <b>" + cacheSummary.offRosterStudents + " deleted/off-roster " + (cacheSummary.offRosterStudents === 1 ? "student" : "students") + ", " + cacheSummary.offRosterSessions + " " + (cacheSummary.offRosterSessions === 1 ? "session" : "sessions") + "</b>");
    } else {
        lines.push("Old cached data: <b>none</b>");
    }
    lines.push("Portfolio cache total: <b>" + cacheSummary.portfolioStudents + " " + (cacheSummary.portfolioStudents === 1 ? "student" : "students") + ", " + cacheSummary.portfolioSessions + " " + (cacheSummary.portfolioSessions === 1 ? "session" : "sessions") + "</b>");

    // Google session and last sync info
    if (typeof wftSyncState !== "undefined" && wftSyncState) {
        var tokenExpiry = Number(wftSyncState.tokenExpiresAt || getWftSessionTokenExpiry() || 0);
        lines.push("Google session: <b>" + formatWftTokenTimeRemaining(tokenExpiry) + "</b>");
    }

    var lastDriveSyncAt = getWftLastDriveSyncAt();
    if (lastDriveSyncAt) {
        lines.push("Last Drive sync: <b>" + formatWftRelativeTime(lastDriveSyncAt) + "</b>");
    } else {
        lines.push("Last Drive sync: <b>never recorded</b>");
    }

    // Last index rebuild
    var lastPatch = meta.lastSuccessfulPatch || "";
    if (lastPatch.indexOf("patch-6") !== -1) {
        lines.push("Last index rebuild: <b>" + formatWftRelativeTime(meta.updatedAt) + "</b>");
    }

    lines.push("Source of truth: <b>" + meta.activePortfolioFormat.replace(/-/g, " ") + "</b>");

    var summaryEl = document.getElementById("storageHealthSummary");
    if (summaryEl) {
        renderStorageHealthSummaryLines(summaryEl, lines);
    }

    // Update safe mode button
    var btnSafe = document.getElementById("btnSafeMode");
    if (btnSafe) {
        btnSafe.textContent = safeMode ? "Exit Safe Mode" : "Enter Safe Mode";
    }
}

function estimateLocalStorageSize() {
    var total = 0;
    try {
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            var value = localStorage.getItem(key);
            total += (key ? key.length : 0) + (value ? value.length : 0);
        }
    } catch (e) {}
    return total * 2; // UTF-16 = ~2 bytes per char
}

function formatWftBytes(bytes) {
    if (bytes < 1024) { return bytes + " B"; }
    if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + " KB"; }
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function formatWftRelativeTime(isoString) {
    if (!isoString) { return "unknown"; }
    try {
        var diff = Date.now() - new Date(isoString).getTime();
        var seconds = Math.floor(diff / 1000);
        if (seconds < 60) { return seconds + "s ago"; }
        var minutes = Math.floor(seconds / 60);
        if (minutes < 60) { return minutes + "m ago"; }
        var hours = Math.floor(minutes / 60);
        if (hours < 24) { return hours + "h ago"; }
        var days = Math.floor(hours / 24);
        return days + "d ago";
    } catch (e) {
        return isoString;
    }
}

function checkIndexedDbAvailable() {
    try {
        return typeof indexedDB !== "undefined" && !!window.indexedDB;
    } catch (e) {
        return false;
    }
}

function clearWftLocalCache() {
    if (!confirm("Clear all local cache (IndexedDB and localStorage portfolio)?\n\nThis will NOT delete your Google Drive data. You can reload from Drive after clearing.")) {
        return;
    }

    // Clear IndexedDB if WftIndexedDb is available
    if (typeof WftIndexedDb !== "undefined" && WftIndexedDb.clearAll) {
        WftIndexedDb.clearAll();
    }

    // Clear localStorage portfolio (settings and deletions are preserved)
    try {
        localStorage.removeItem("wft_portfolio");
        localStorage.removeItem("wft_storage_meta");
        wftDebugLog("[StorageHealth] Local cache cleared");
    } catch (e) {
        wftDebugWarn("[StorageHealth] Failed to clear localStorage:", e);
    }

    refreshStorageHealthUI();
    alert("Local cache cleared. Sign in to Google Drive and reload portfolio index.");
}

// Hook into openSettingsDrawer to refresh health UI
var _origOpenSettingsDrawer = openSettingsDrawer;
openSettingsDrawer = function() {
    _origOpenSettingsDrawer();
    refreshStorageHealthUI();
};

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 13
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 4 — ASYNC PORTFOLIO ACCESS WRAPPERS
// ═══════════════════════════════════════════════════════════════════════════

function wftPromiseCallback(promise, callback) {
    if (!callback) { return promise; }
    promise.then(
        function(result) { callback(null, result); },
        function(err) { callback(err || new Error("Promise rejected"), null); }
    );
    return promise;
}

function loadPortfolioAsync() {
    return Promise.resolve(getPortfolioData());
}

function savePortfolioAsync(portfolio) {
    var result = savePortfolioData(portfolio);
    return Promise.resolve(result);
}

function loadStudentPortfolioAsync(studentNameOrId) {
    return loadPortfolioAsync().then(function(portfolio) {
        if (portfolio[studentNameOrId]) {
            return portfolio[studentNameOrId];
        }
        if (WFT_STUDENT_ID_MAP_V1) {
            try {
                var settings = getRawSettings ? getRawSettings() : {};
                if (settings.studentIdMap) {
                    var keys = Object.keys(settings.studentIdMap);
                    for (var lsi = 0; lsi < keys.length; lsi++) {
                        if (settings.studentIdMap[keys[lsi]] === studentNameOrId) {
                            return portfolio[keys[lsi]] || { sessions: [] };
                        }
                    }
                }
            } catch (e) {}
        }
        return { sessions: [] };
    });
}

function saveStudentPortfolioAsync(studentNameOrId, studentData) {
    return loadPortfolioAsync().then(function(portfolio) {
        var targetKey = studentNameOrId;
        if (WFT_STUDENT_ID_MAP_V1 && !portfolio[studentNameOrId]) {
            try {
                var settings = getRawSettings ? getRawSettings() : {};
                if (settings.studentIdMap) {
                    var keys = Object.keys(settings.studentIdMap);
                    for (var ssi = 0; ssi < keys.length; ssi++) {
                        if (settings.studentIdMap[keys[ssi]] === studentNameOrId) {
                            targetKey = keys[ssi];
                            break;
                        }
                    }
                }
            } catch (e) {}
        }
        portfolio[targetKey] = studentData;
        return savePortfolioAsync(portfolio);
    });
}

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
            wftDebugError("[AsyncPortfolio] renderStudentPortfolio failed:", e);
        } finally {
            renderStudentPortfolio._syncRender = false;
            renderStudentPortfolio._asyncStudentData = null;
        }
    });
}


// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 4
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 5 — INDEXEDDB LOCAL CACHE
// ═══════════════════════════════════════════════════════════════════════════

var WftIndexedDb = {
    dbName: "wft-cache",
    version: 1,
    db: null,
    _ready: false,

    open: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (self.db && self._ready) {
                resolve(self.db);
                return;
            }
            if (!window.indexedDB) {
                wftDebugWarn("[IndexedDB] Not available — using localStorage fallback");
                reject(new Error("IndexedDB not available"));
                return;
            }
            var request = indexedDB.open(self.dbName, self.version);
            request.onupgradeneeded = function(event) {
                var db = event.target.result;
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
            };
            request.onsuccess = function(event) {
                self.db = event.target.result;
                self._ready = true;
                wftDebugLog("[IndexedDB] Database opened");
                resolve(self.db);
            };
            request.onerror = function(event) {
                wftDebugError("[IndexedDB] Failed to open:", event.target.error);
                self._ready = false;
                reject(event.target.error);
            };
            request.onblocked = function() {
                wftDebugWarn("[IndexedDB] Database blocked");
                reject(new Error("Database blocked"));
            };
        });
    },

    get: function(storeName, key) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readonly");
                    var store = tx.objectStore(storeName);
                    var req = store.get(key);
                    req.onsuccess = function() { resolve(req.result); };
                    req.onerror = function() { reject(req.error); };
                } catch (e) { reject(e); }
            });
        });
    },

    put: function(storeName, value) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readwrite");
                    var store = tx.objectStore(storeName);
                    var req = store.put(value);
                    req.onsuccess = function() { resolve(req.result); };
                    req.onerror = function() { reject(req.error); };
                } catch (e) { reject(e); }
            });
        });
    },

    delete: function(storeName, key) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readwrite");
                    var store = tx.objectStore(storeName);
                    var req = store.delete(key);
                    req.onsuccess = function() { resolve(); };
                    req.onerror = function() { reject(req.error); };
                } catch (e) { reject(e); }
            });
        });
    },

    getAll: function(storeName) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readonly");
                    var store = tx.objectStore(storeName);
                    var req = store.getAll();
                    req.onsuccess = function() { resolve(req.result || []); };
                    req.onerror = function() { reject(req.error); };
                } catch (e) { reject(e); }
            });
        });
    },

    clear: function(storeName) {
        var self = this;
        return self.open().then(function(db) {
            return new Promise(function(resolve, reject) {
                try {
                    var tx = db.transaction(storeName, "readwrite");
                    var store = tx.objectStore(storeName);
                    var req = store.clear();
                    req.onsuccess = function() { resolve(); };
                    req.onerror = function() { reject(req.error); };
                } catch (e) { reject(e); }
            });
        });
    },

    clearAll: function() {
        var self = this;
        return self.open().then(function(db) {
            var storeNames = [];
            for (var sni = 0; sni < db.objectStoreNames.length; sni++) {
                storeNames.push(db.objectStoreNames[sni]);
            }
            var promises = [];
            for (var sn = 0; sn < storeNames.length; sn++) {
                promises.push(self.clear(storeNames[sn]));
            }
            return Promise.all(promises);
        });
    },

    isReady: function() {
        return this._ready && !!this.db;
    }
};

var WftStorage = {
    isReady: false,
    mode: "localStorage",

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
            wftDebugLog("[WftStorage] Initialized in indexeddb mode");
        }).catch(function(err) {
            self.mode = "localStorage";
            self.isReady = true;
            wftDebugWarn("[WftStorage] IndexedDB init failed, using localStorage fallback:", err);
        });
    },

    getPortfolioIndex: function() {
        if (this.mode === "indexeddb") {
            return WftIndexedDb.get("portfolioIndex", "current").catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    savePortfolioIndex: function(index) {
        if (this.mode === "indexeddb") {
            var record = { id: "current", data: index, updatedAt: new Date().toISOString() };
            return WftIndexedDb.put("portfolioIndex", record).catch(function() {});
        }
        return Promise.resolve();
    },

    getStudentPortfolio: function(studentId) {
        if (this.mode === "indexeddb") {
            return WftIndexedDb.get("studentPortfolios", studentId).catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    saveStudentPortfolio: function(studentId, data) {
        if (this.mode === "indexeddb") {
            var record = { studentId: studentId, data: data, cachedAt: new Date().toISOString() };
            return WftIndexedDb.put("studentPortfolios", record).catch(function() {});
        }
        return Promise.resolve();
    },

    getThumbnail: function(imageId) {
        if (this.mode === "indexeddb") {
            return WftIndexedDb.get("thumbnails", imageId).catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    saveThumbnail: function(imageId, blobOrDataUrl) {
        if (this.mode === "indexeddb") {
            var record = { imageId: imageId, data: blobOrDataUrl, cachedAt: new Date().toISOString() };
            return WftIndexedDb.put("thumbnails", record).catch(function() {});
        }
        return Promise.resolve();
    },

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

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 5
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 7 — STUDENT ID MAP
// ═══════════════════════════════════════════════════════════════════════════

function getStudentRecordByName(name) {
    try {
        var settings = getRawSettings ? getRawSettings() : {};
        if (!settings.studentRecords) { return null; }
        for (var sri = 0; sri < settings.studentRecords.length; sri++) {
            var rec = settings.studentRecords[sri];
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
        for (var sri = 0; sri < settings.studentRecords.length; sri++) {
            if (settings.studentRecords[sri].studentId === studentId) { return settings.studentRecords[sri]; }
        }
    } catch (e) {}
    return null;
}

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
        wftDebugWarn("[StudentIdMap] ensureStudentRecordsForRoster failed:", e.message);
    }
}
function resolveStudentPortfolioKey(studentNameOrId) {
    try {
        var portfolio = getPortfolioData();
        if (portfolio[studentNameOrId]) { return studentNameOrId; }
    } catch (e) {}

    if (WFT_STUDENT_ID_MAP_V1) {
        try {
            var settings = getRawSettings ? getRawSettings() : {};
            if (settings.studentIdMap) {
                var keys = Object.keys(settings.studentIdMap);
                for (var rk = 0; rk < keys.length; rk++) {
                    if (settings.studentIdMap[keys[rk]] === studentNameOrId) {
                        return keys[rk];
                    }
                }
            }
        } catch (e) {}
    }
    return studentNameOrId;
}

function updateStudentRecordOnRename(oldName, newName) {
    if (!WFT_STUDENT_ID_MAP_V1) { return; }
    try {
        var settings = getRawSettings ? getRawSettings() : {};
        if (!settings.studentIdMap) { settings.studentIdMap = {}; }
        if (!settings.studentRecords) { settings.studentRecords = []; }

        var studentId = settings.studentIdMap[oldName];
        if (!studentId) { studentId = getOrCreateStudentId(oldName); }
        settings.studentIdMap[newName] = studentId;

        var found = false;
        for (var rni = 0; rni < settings.studentRecords.length; rni++) {
            var rec = settings.studentRecords[rni];
            if (rec.studentId === studentId || rec.displayName === oldName) {
                rec.displayName = newName;
                if (!rec.legacyNameKeys) { rec.legacyNameKeys = []; }
                if (rec.legacyNameKeys.indexOf(oldName) === -1) { rec.legacyNameKeys.push(oldName); }
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

        try {
            var portfolio = getPortfolioData();
            if (portfolio[oldName] && !portfolio[newName]) {
                portfolio[newName] = portfolio[oldName];
                delete portfolio[oldName];
                savePortfolioData(portfolio);
            }
        } catch (e) {}

        if (typeof saveSettingsToLocalStorage === "function") {
            saveSettingsToLocalStorage(settings);
        }
    } catch (e) {
        wftDebugWarn("[StudentIdMap] rename failed:", e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 7
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 9 — PER-STUDENT DRIVE FILES
// ═══════════════════════════════════════════════════════════════════════════

var WFT_DRIVE_STUDENTS_FOLDER_ID_KEY = "wft_drive_students_folder_id";
var WFT_DRIVE_MEDIA_FOLDER_ID_KEY = "wft_drive_media_folder_id";

function getWftDriveFolderId() {
    if (driveFolderId) { return driveFolderId; }
    try { return localStorage.getItem("wft_drive_folder_id") || ""; } catch (e) {}
    return "";
}

function createWftSubfolder(folderName, parentFolderId) {
    return new Promise(function(resolve, reject) {
        if (!driveAccessToken) { reject(new Error("Not signed in")); return; }
        var metadata = { name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parentFolderId] };
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://www.googleapis.com/drive/v3/files", true);
        xhr.setRequestHeader("Authorization", "Bearer " + driveAccessToken);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText).id); }
                catch (e) { reject(new Error("Failed to parse folder response")); }
            } else { reject(new Error("Folder create failed: " + xhr.status)); }
        };
        xhr.onerror = function() { reject(new Error("Network error creating folder")); };
        xhr.send(JSON.stringify(metadata));
    });
}

function ensureWftSubfolderPromise(folderName, parentFolderId) {
    if (!parentFolderId) { return Promise.reject(new Error("No parent folder ID")); }
    return findWftFilesByNameInFolderPromise(folderName, parentFolderId).then(function(files) {
        for (var fi = 0; fi < files.length; fi++) {
            if (files[fi].mimeType === "application/vnd.google-apps.folder") {
                return files[fi].id;
            }
        }
        return createWftSubfolder(folderName, parentFolderId);
    });
}

function ensureWftStudentsFolderPromise() {
    var cachedId = "";
    try { cachedId = localStorage.getItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY) || ""; } catch (e) {}
    if (cachedId) { return Promise.resolve(cachedId); }
    return ensureWftSubfolderPromise("students", getWftDriveFolderId()).then(function(newId) {
        try { localStorage.setItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY, newId); } catch (e) {}
        return newId;
    });
}

function ensureWftMediaFolderPromise() {
    var cachedId = "";
    try { cachedId = localStorage.getItem(WFT_DRIVE_MEDIA_FOLDER_ID_KEY) || ""; } catch (e) {}
    if (cachedId) { return Promise.resolve(cachedId); }
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
        if (cachedId) { return cachedId; }
        return ensureWftSubfolderPromise("student-" + studentId, mediaFolderId).then(function(newId) {
            try { localStorage.setItem(cacheKey, newId); } catch (e) {}
            return newId;
        });
    });
}

function findWftFilesByNameInFolderPromise(filename, folderId) {
    if (!folderId) { return Promise.resolve([]); }
    var query = "name='" + escapeDriveQueryValue(filename) + "'"
        + " and '" + escapeDriveQueryValue(folderId) + "' in parents"
        + " and trashed=false";
    var url = "https://www.googleapis.com/drive/v3/files"
        + "?q=" + encodeURIComponent(query)
        + "&fields=files(id,name,modifiedTime,createdTime,size,mimeType)"
        + "&orderBy=modifiedTime desc";
    return wftDriveFetch(url).then(function(response) { return response.json(); }).then(function(data) {
        return data && data.files ? data.files : [];
    });
}

function saveJsonToDriveFolderPromise(filename, data, folderId) {
    return findWftFilesByNameInFolderPromise(filename, folderId).then(function(files) {
        var existing = chooseCanonicalWftFile(files);
        var url = existing && existing.id
            ? "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(existing.id) + "?uploadType=multipart&fields=id,name,modifiedTime"
            : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime";
        var method = existing && existing.id ? "PATCH" : "POST";
        var boundary = "----WFTStudentFileBoundary" + Date.now();
        var metadata = existing && existing.id ? {} : { name: filename, parents: [folderId], mimeType: "application/json" };
        var body = new Blob([
            "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n",
            "--" + boundary + "\r\nContent-Type: application/json\r\n\r\n",
            JSON.stringify(data || {}, null, 2),
            "\r\n--" + boundary + "--"
        ], { type: "multipart/related; boundary=" + boundary });
        return wftDriveFetch(url, {
            method: method,
            headers: { "Content-Type": "multipart/related; boundary=" + boundary },
            body: body
        }).then(function(response) { return response.json(); });
    }).then(function(fileData) {
        if (!fileData || !fileData.id) { throw new Error("Student file upload did not return a Drive file ID."); }
        return fileData;
    });
}

function buildStudentPortfolioFileName(studentId) {
    return "student-" + studentId + ".json";
}

function loadStudentFileFromDrive(studentId, callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) { if (callback) { callback(null, null); } return; }
    var filename = buildStudentPortfolioFileName(studentId);
    ensureDriveFolderPromise().then(function() {
        return ensureWftStudentsFolderPromise();
    }).then(function(studentsFolderId) {
        return findWftFilesByNameInFolderPromise(filename, studentsFolderId);
    }).then(function(files) {
        var canonical = chooseCanonicalWftFile(files);
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
    ensureDriveFolderPromise().then(function() {
        return ensureWftStudentsFolderPromise();
    }).then(function(studentsFolderId) {
        return saveJsonToDriveFolderPromise(filename, record, studentsFolderId);
    }).then(function(fileData) {
        if (fileData && fileData.id) {
            try { localStorage.setItem("wft_drive_student_file_" + studentId, fileData.id); } catch (e) {}
        }
        if (callback) { callback(null, fileData && fileData.id ? fileData.id : "saved"); }
    }).catch(function(err) {
        if (callback) { callback(err, null); }
    });
}

function migrateLegacyPortfolioToStudentFiles(callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) { if (callback) { callback(null, "feature-disabled"); } return; }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) { if (callback) { callback(null, "safe-mode"); } return; }
    wftDebugLog("[Migration] Starting legacy → per-student migration...");
    saveWftPreMigrationBackupToDrive(function() {
        ensureStudentRecordsForRoster();
        var portfolio = getPortfolioData();
        var names = Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });
        ensureWftStudentsFolderPromise().then(function() {
            var completed = 0, errors = [];
            function saveNext() {
                if (completed >= names.length) {
                    rebuildPortfolioIndex(function() {
                        var meta = getWftStorageMeta();
                        meta.activePortfolioFormat = "split-student-files";
                        meta.migrationCompletedAt = new Date().toISOString();
                        setWftStorageMeta(meta);
                        updateWftStorageMeta("patch-9-migration", "completed");
                        wftDebugLog("[Migration] Complete! " + names.length + " students, " + errors.length + " errors");
                        if (callback) { callback(errors.length ? errors : null, "completed"); }
                    });
                    return;
                }
                var name = names[completed];
                var sessions = (portfolio[name] && portfolio[name].sessions) ? portfolio[name].sessions : [];
                var studentId = "";
                try {
                    var settings = getRawSettings ? getRawSettings() : {};
                    if (settings.studentIdMap && settings.studentIdMap[name]) { studentId = settings.studentIdMap[name]; }
                } catch (e) {}
                if (!studentId) { studentId = createStableStudentId(name, settings.studentIdMap || {}); }
                saveStudentFileToDrive(studentId, { displayName: name, legacyNameKeys: [name], sessions: sessions }, function(err) {
                    if (err) { errors.push({ student: name, error: err }); }
                    completed += 1; saveNext();
                });
            }
            saveNext();
        }).catch(function(e) { wftDebugError("[Migration] Failed:", e); if (callback) { callback(e, null); } });
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 9
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 10 — SPLIT-FILE MERGE & DELETION HANDLING
// ═══════════════════════════════════════════════════════════════════════════

function mergeStudentPortfolioFiles(localFile, remoteFile, deletions) {
    if (!localFile && !remoteFile) { return null; }
    if (!localFile) { return applyDeletionsToFile(remoteFile, deletions); }
    if (!remoteFile) { return applyDeletionsToFile(localFile, deletions); }
    return {
        schemaVersion: 1, format: "student-portfolio-v1",
        studentId: localFile.studentId || remoteFile.studentId,
        displayName: remoteFile.displayName || localFile.displayName,
        legacyNameKeys: mergeWftStringArrays(localFile.legacyNameKeys || [], remoteFile.legacyNameKeys || []),
        createdAt: chooseWftOlderDate(localFile.createdAt, remoteFile.createdAt),
        updatedAt: new Date().toISOString(),
        sessions: mergeStudentSessions(localFile.sessions || [], remoteFile.sessions || [], deletions || {}, localFile.studentId || remoteFile.studentId || "")
    };
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
        if (isStudentSessionDeleted(sessionId, sessionStudentId, deletions, getSessionModifiedTimeMs(session))) { continue; }
        if (!merged[sessionId]) { merged[sessionId] = session; }
        else { merged[sessionId] = chooseNewerSession(merged[sessionId], session); }
    }
    var result = [];
    var keys = Object.keys(merged);
    for (var j = 0; j < keys.length; j++) { result.push(merged[keys[j]]); }
    result.sort(function(a, b) {
        if (!a.createdAt) { return 1; } if (!b.createdAt) { return -1; }
        if (a.createdAt < b.createdAt) { return 1; } if (a.createdAt > b.createdAt) { return -1; }
        return 0;
    });
    return result;
}

function getWftDeletionRecords(deletions) {
    var clean = normalizeDeletionsData(deletions || {});
    var records = Array.isArray(clean.records) ? clean.records.slice(0) : [];
    var keys = Object.keys(clean.deletedSessions || {});
    for (var i = 0; i < keys.length; i++) {
        var legacy = clean.deletedSessions[keys[i]] || {};
        records.push({
            id: legacy.id || keys[i],
            type: legacy.type || "session",
            studentId: legacy.studentId || "",
            studentName: legacy.studentName || "",
            sessionId: legacy.sessionId || "",
            deletedAt: legacy.deletedAt || clean.updatedAt || "",
            deviceId: legacy.deviceId || "",
            reason: legacy.reason || "teacher_delete"
        });
    }
    return records;
}

function isStudentSessionDeleted(sessionId, studentId, deletions, sessionUpdatedAt) {
    if (!deletions || !sessionId) { return false; }
    var records = getWftDeletionRecords(deletions);
    var sessionUpdateMs = typeof getTimeMs === "function" ? getTimeMs(sessionUpdatedAt) : (sessionUpdatedAt && !isNaN(Date.parse(sessionUpdatedAt)) ? Date.parse(sessionUpdatedAt) : 0);
    var normalizedStudentId = String(studentId || "");
    for (var i = 0; i < records.length; i++) {
        var rec = records[i] || {};
        var recType = rec.type || "session";
        if ((recType === "session" || recType === "archive-remove") && String(rec.sessionId || "") === String(sessionId)) {
            if (normalizedStudentId && rec.studentId && String(rec.studentId) !== normalizedStudentId) { continue; }
            var deletedMs = rec.deletedAt && !isNaN(Date.parse(rec.deletedAt)) ? Date.parse(rec.deletedAt) : 0;
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

function chooseNewerSessionLegacy(sessionA, sessionB) {
    // Legacy timestamp-only helper kept for compatibility with older split-file code.
    // Runtime portfolio sync uses the image-preserving chooseNewerSession() defined in the V2 merge section below.
    var timeA = sessionA && sessionA.updatedAt ? Date.parse(sessionA.updatedAt) : 0;
    var timeB = sessionB && sessionB.updatedAt ? Date.parse(sessionB.updatedAt) : 0;
    if (isNaN(timeA)) { timeA = 0; } if (isNaN(timeB)) { timeB = 0; }
    return (timeA >= timeB) ? sessionA : sessionB;
}

function applyDeletionsToFile(file, deletions) {
    if (!file) { return null; }
    var filtered = { schemaVersion: file.schemaVersion, format: file.format, studentId: file.studentId,
        displayName: file.displayName, legacyNameKeys: file.legacyNameKeys || [],
        createdAt: file.createdAt, updatedAt: new Date().toISOString(), sessions: [] };
    var sessions = file.sessions || [];
    for (var i = 0; i < sessions.length; i++) {
        if (!isSessionDeleted(sessions[i].id, file.studentId || "", deletions, getSessionModifiedTimeMs(sessions[i]))) { filtered.sessions.push(sessions[i]); }
    }
    return filtered;
}

function recordExtendedDeletion(type, studentId, sessionId, reason) {
    var deletions;
    try { deletions = (typeof getDeletionsData === "function") ? getDeletionsData() : getEmptyDeletionsData(); } catch (e) { deletions = getEmptyDeletionsData(); }
    deletions = normalizeDeletionsData(deletions || {});
    if (!Array.isArray(deletions.records)) { deletions.records = []; }
    var now = new Date().toISOString();
    var record = { id: createWftId("del"), type: type || "session", studentId: studentId || "",
        sessionId: sessionId || "", deletedAt: now, deviceId: getWftDeviceId(),
        reason: reason || "user-delete" };
    deletions.records.push(record);
    if ((record.type === "session" || record.type === "archive-remove") && record.sessionId) {
        deletions.deletedSessions["session:" + (record.studentId || "") + ":" + record.sessionId] = cloneWftJson(record);
    }
    try { if (typeof saveDeletionsData === "function") { saveDeletionsData(deletions); } } catch (e2) {}
    return record;
}

function syncStudentFileWithMerge(studentId, localData, callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) { if (callback) { callback(null, localData); } return; }
    loadStudentFileFromDrive(studentId, function(err, remoteFile) {
        if (err || !remoteFile) {
            saveStudentFileToDrive(studentId, localData, function(saveErr) {
                if (saveErr) { wftDebugWarn("[Merge] Could not save local student file for", studentId, ":", saveErr.message || saveErr); }
                if (callback) { callback(saveErr, localData); }
            });
            return;
        }
        var deletions = [];
        try { deletions = (typeof getDeletionsData === "function") ? getDeletionsData() : []; } catch (e) {}
        var merged = mergeStudentPortfolioFiles(localData, remoteFile, deletions);
        saveStudentFileToDrive(studentId, merged, function(saveErr) {
            if (saveErr) { wftDebugWarn("[Merge] Could not save merged student file for", studentId, ":", saveErr.message || saveErr); }
            if (callback) { callback(saveErr, merged); }
        });
    });
}

function rebuildIndexFromStudentFiles(studentFiles) {
    var index = { schemaVersion: 1, format: "portfolio-index-v1", updatedAt: new Date().toISOString(),
        source: "split-student-files", students: {} };
    if (!studentFiles) { return index; }
    var keys = Object.keys(studentFiles);
    for (var i = 0; i < keys.length; i++) {
        var file = studentFiles[keys[i]];
        if (!file || file.format !== "student-portfolio-v1") { continue; }
        var sessions = file.sessions || [], latest = "", totalScore = 0, scorable = 0;
        for (var j = 0; j < sessions.length; j++) {
            var s = sessions[j];
            if (s.createdAt && (!latest || s.createdAt > latest)) { latest = s.createdAt; }
            if (typeof s.overallScore === "number" && !isNaN(s.overallScore)) { totalScore += s.overallScore; scorable += 1; }
        }
        index.students[file.studentId] = { studentId: file.studentId, displayName: file.displayName,
            legacyNameKey: (file.legacyNameKeys && file.legacyNameKeys.length > 0) ? file.legacyNameKeys[0] : file.displayName,
            sessionCount: sessions.length, latestSessionAt: latest, averageScore: scorable > 0 ? Math.round(totalScore / scorable) : 0,
            studentFileId: "", studentFileEtag: "", hasUnloadedDetails: true };
    }
    return index;
}

function mergeWftStringArrays(arr1, arr2) {
    var seen = {}, result = [];
    for (var i = 0; i < arr1.length; i++) { if (!seen[arr1[i]]) { seen[arr1[i]] = true; result.push(arr1[i]); } }
    for (var j = 0; j < arr2.length; j++) { if (!seen[arr2[j]]) { seen[arr2[j]] = true; result.push(arr2[j]); } }
    return result;
}

function chooseWftOlderDate(a, b) {
    if (!a) { return b || new Date().toISOString(); }
    if (!b) { return a; }
    return (a < b) ? a : b;
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 10
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 11 — FULL LAZY LOADING
// ═══════════════════════════════════════════════════════════════════════════

function loadStudentPortfolioLazy(studentId, displayName, callback) {
    if (!WFT_LAZY_PORTFOLIO_LOAD_V1) {
        try {
            var portfolio = getPortfolioData();
            var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
            callback(null, portfolio[resolvedKey] || { sessions: [] });
        } catch (e) { callback(e, null); }
        return;
    }

    var checkCache = WFT_INDEXEDDB_CACHE_V1 ? WftStorage.getStudentPortfolio(studentId) : Promise.resolve(null);
    checkCache.then(function(cached) {
        if (cached && cached.data) {
            wftDebugLog("[LazyLoad] Cache hit:", studentId);
            callback(null, cached.data);
            if (WFT_SPLIT_STUDENT_FILES_V1) {
                loadStudentFileFromDrive(studentId, function(err, remoteFile) {
                    if (!err && remoteFile) {
                        var localTime = cached.cachedAt ? new Date(cached.cachedAt).getTime() : 0;
                        var remoteTime = remoteFile.updatedAt ? new Date(remoteFile.updatedAt).getTime() : 0;
                        if (remoteTime > localTime) {
                            WftStorage.saveStudentPortfolio(studentId, remoteFile);
                            syncStudentFileWithMerge(studentId, remoteFile, function() {});
                        }
                    }
                });
            }
            return;
        }
        if (WFT_SPLIT_STUDENT_FILES_V1) {
            loadStudentFileFromDrive(studentId, function(err, remoteFile) {
                if (!err && remoteFile) {
                    if (WFT_INDEXEDDB_CACHE_V1) { WftStorage.saveStudentPortfolio(studentId, remoteFile); }
                    callback(null, remoteFile);
                } else {
                    try {
                        var portfolio = getPortfolioData();
                        var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
                        callback(null, portfolio[resolvedKey] || { sessions: [], displayName: displayName, studentId: studentId });
                    } catch (e2) { callback(e2, null); }
                }
            });
        } else {
            try {
                var portfolio = getPortfolioData();
                var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
                callback(null, portfolio[resolvedKey] || { sessions: [] });
            } catch (e2) { callback(e2, null); }
        }
    }).catch(function() {
        try {
            var portfolio = getPortfolioData();
            var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
            callback(null, portfolio[resolvedKey] || { sessions: [] });
        } catch (e2) { callback(e2, null); }
    });
}

function loadPortfolioImageLazy(image, callback) {
    if (image && image.dataUrl) { callback(null, image.dataUrl); return; }
    if (!image || !image.driveFileId) { callback(null, null); return; }

    var imageId = image.imageId || image.driveFileId || "";
    if (imageId && WFT_INDEXEDDB_CACHE_V1) {
        WftStorage.getThumbnail(imageId).then(function(cached) {
            if (cached && cached.data) { callback(null, cached.data); return; }
            fetchWftImageFromDrive(image, callback);
        }).catch(function() { fetchWftImageFromDrive(image, callback); });
    } else {
        fetchWftImageFromDrive(image, callback);
    }
}

function fetchWftImageFromDrive(image, callback) {
    if (!driveAccessToken || !image.driveFileId) { callback(null, null); return; }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://www.googleapis.com/drive/v3/files/" + image.driveFileId + "?alt=media", true);
    xhr.setRequestHeader("Authorization", "Bearer " + driveAccessToken);
    xhr.responseType = "blob";
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            var reader = new FileReader();
            reader.onload = function() {
                var dataUrl = reader.result;
                if (WFT_INDEXEDDB_CACHE_V1 && image.imageId) {
                    try { createPortfolioThumbnailBlob({ dataUrl: dataUrl }, function(err, tb) {
                        if (!err && tb) { WftStorage.saveThumbnail(image.imageId, tb); }
                    }); } catch (e) {}
                }
                callback(null, dataUrl);
            };
            reader.readAsDataURL(xhr.response);
        } else { callback(new Error("Drive download failed: " + xhr.status), null); }
    };
    xhr.onerror = function() { callback(new Error("Network error"), null); };
    xhr.send();
}

function initLazyPortfolioStartup() {
    if (!WFT_LAZY_PORTFOLIO_LOAD_V1) { return; }
    wftDebugLog("[LazyLoad] Initializing lazy startup...");
    loadSettingsFromLocalStorage();
    if (WFT_INDEXEDDB_CACHE_V1) {
        WftStorage.init().then(function() { wftDebugLog("[LazyLoad] Storage:", WftStorage.mode); })
            .catch(function() { wftDebugWarn("[LazyLoad] Storage init failed"); });
    }
    if (WFT_PORTFOLIO_INDEX_V1) {
        loadPortfolioIndexFromDrive(function(err, index) {
            if (index) {
                populatePortfolioDropdownFromIndex(index);
            } else {
                try {
                    var portfolio = getPortfolioData();
                    populatePortfolioDropdownFromIndex(buildPortfolioIndexFromPortfolio(portfolio));
                } catch (e) { try { refreshPortfolioDropdown(); } catch (e2) {} }
            }
        });
    }
}

function populatePortfolioDropdownFromIndex(index) {
    if (!index || !index.students) { return; }
    var select = document.getElementById("portfolioStudentSelect");
    if (!select) { return; }
    var currentValue = select.value;
    select.innerHTML = "";
    var option = document.createElement("option");
    option.value = ""; option.textContent = "-- Select Student --"; select.appendChild(option);
    var studentIds = Object.keys(index.students);
    studentIds.sort(function(a, b) { return (index.students[a].displayName || a).localeCompare(index.students[b].displayName || b); });
    for (var i = 0; i < studentIds.length; i++) {
        var sid = studentIds[i];
        var entry = index.students[sid];
        var opt = document.createElement("option");
        opt.value = sid; opt.textContent = entry.displayName + " (" + entry.sessionCount + " sessions)";
        select.appendChild(opt);
    }
    if (currentValue) {
        for (var j = 0; j < select.options.length; j++) {
            if (select.options[j].value === currentValue) { select.selectedIndex = j; break; }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 11
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 12 — ARCHIVE UPGRADES
// ═══════════════════════════════════════════════════════════════════════════

var WFT_TERM_DATE_RANGES = {
    "Term 1 (Aug-Oct)": { start: "08-01", end: "10-31" },
    "Term 2 (Nov-Mar)": { start: "11-01", end: "03-31" },
    "Term 3 (Apr-Jun)": { start: "04-01", end: "06-30" }
};

function normalizeWftArchiveSessionDate(session) {
    if (!session) { return ""; }
    if (session.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(String(session.dateIso))) {
        return String(session.dateIso);
    }
    var source = session.createdAt || session.date || session.timestamp || "";
    if (source && !isNaN(Date.parse(source))) {
        return new Date(source).toISOString().substring(0, 10);
    }
    if (source && /^\d{4}-\d{2}-\d{2}/.test(String(source))) {
        return String(source).substring(0, 10);
    }
    wftDebugWarn("[Archive] Skipping session with no parseable date", session.id || "");
    return "";
}

function wftMonthDayToNumber(value) {
    var parts = String(value || "").split("-");
    var month = parseInt(parts[0], 10);
    var day = parseInt(parts[1], 10);
    if (isNaN(month)) { month = 0; }
    if (isNaN(day)) { day = 0; }
    return (month * 100) + day;
}

function archiveByDateRange(startDate, endDate, studentName, callback) {
    try {
        var portfolio = getPortfolioData();
        var names = studentName ? [studentName] : Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });
        var archiveSessions = {};
        for (var ni = 0; ni < names.length; ni++) {
            var name = names[ni];
            var studentData = portfolio[name];
            if (!studentData || !studentData.sessions) { continue; }
            var filtered = [];
            for (var si = 0; si < studentData.sessions.length; si++) {
                var session = studentData.sessions[si];
                var sessionDate = normalizeWftArchiveSessionDate(session);
                if (sessionDate && sessionDate >= startDate && sessionDate <= endDate) { filtered.push(session); }
            }
            if (filtered.length > 0) { archiveSessions[name] = { sessions: filtered }; }
        }
        var count = Object.keys(archiveSessions).length;
        if (callback) { callback(null, archiveSessions, count); }
        return archiveSessions;
    } catch (e) { if (callback) { callback(e, null, 0); } return null; }
}

function archiveByTerm(termKey, year, studentName, callback) {
    var range = WFT_TERM_DATE_RANGES[termKey];
    if (!range) { if (callback) { callback(new Error("Unknown term: " + termKey), null, 0); } return; }
    var startDate = year + "-" + range.start;
    var endDate = year + "-" + range.end;
    if (wftMonthDayToNumber(range.start) > wftMonthDayToNumber(range.end)) { endDate = (parseInt(year, 10) + 1) + "-" + range.end; }
    return archiveByDateRange(startDate, endDate, studentName, callback);
}

function buildEnhancedArchiveZip(archiveData, options, callback) {
    if (typeof JSZip === "undefined") { if (callback) { callback(new Error("JSZip not loaded"), null); } return; }
    options = options || {};
    var zip = new JSZip();
    var manifest = { archiveVersion: 2, createdAt: new Date().toISOString(), appVersion: "v9", studentCount: 0, sessionCount: 0, options: options };
    var names = Object.keys(archiveData);
    manifest.studentCount = names.length;
    var csvLines = ["Student,Sessions,Date Range"];
    var summaryHtml = ["<h2>Archive Summary</h2>", "<p>Generated: " + new Date().toLocaleString() + "</p>",
        "<table border='1' cellpadding='4' style='border-collapse:collapse'>",
        "<tr><th>Student</th><th>Sessions</th><th>Date Range</th></tr>"];
    for (var ni = 0; ni < names.length; ni++) {
        var name = names[ni];
        var sessions = (archiveData[name] && archiveData[name].sessions) ? archiveData[name].sessions : [];
        manifest.sessionCount += sessions.length;
        csvLines.push(name + "," + sessions.length + "," + (options.dateRange || "All"));
        summaryHtml.push("<tr><td>" + escapeWftHtml(name) + "</td><td>" + sessions.length + "</td><td>" + (options.dateRange || "All") + "</td></tr>");
        zip.file("student-" + sanitizeDriveName(name) + ".json", JSON.stringify(archiveData[name], null, 2));
    }
    summaryHtml.push("</table>");
    zip.file("archive-manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("summary.html", "<html><head><meta charset='UTF-8'><title>Archive Summary</title></head><body>" + summaryHtml.join("\n") + "</body></html>");
    zip.file("summary.csv", csvLines.join("\n"));
    try { zip.file("portfolio-index.json", JSON.stringify(buildPortfolioIndexFromPortfolio(archiveData), null, 2)); } catch (e) {}
    zip.generateAsync({ type: "blob" }).then(function(blob) { if (callback) { callback(null, blob, manifest); } })
        .catch(function(err) { if (callback) { callback(err, null); } });
}

function removeArchivedSessionsFromPortfolio(archiveData, callback) {
    try {
        var portfolio = getPortfolioData();
        var names = Object.keys(archiveData);
        var removedCount = 0;
        for (var ni = 0; ni < names.length; ni++) {
            var name = names[ni];
            var archived = archiveData[name];
            if (!archived || !archived.sessions) { continue; }
            var archivedIds = {};
            for (var ai = 0; ai < archived.sessions.length; ai++) {
                var sid = archived.sessions[ai].id;
                if (sid) {
                    archivedIds[sid] = true;
                    var studentId = "";
                    try { if (WFT_STUDENT_ID_MAP_V1) { var s = getRawSettings ? getRawSettings() : {}; studentId = (s.studentIdMap && s.studentIdMap[name]) || ""; } } catch (e) {}
                    recordExtendedDeletion("archive-remove", studentId, sid, "archived");
                }
            }
            if (portfolio[name] && portfolio[name].sessions) {
                var kept = [];
                for (var si = 0; si < portfolio[name].sessions.length; si++) {
                    if (!archivedIds[portfolio[name].sessions[si].id]) { kept.push(portfolio[name].sessions[si]); }
                    else { removedCount += 1; }
                }
                portfolio[name].sessions = kept;
            }
        }
        savePortfolioData(portfolio);
        wftDebugLog("[Archive] Removed", removedCount, "archived sessions");
        if (callback) { callback(null, removedCount); }
    } catch (e) { wftDebugError("[Archive] Removal failed:", e); if (callback) { callback(e, 0); } }
}

function escapeWftHtml(str) {
    if (!str) { return ""; }
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 12
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 14 — CLEANUP & DEFAULT ENABLEMENT
// ═══════════════════════════════════════════════════════════════════════════
// Enable stable flags in the recommended order.
// WARNING: WFT_SPLIT_STUDENT_FILES_V1 and WFT_LAZY_PORTFOLIO_LOAD_V1
// should ONLY be enabled after manual migration testing.

// Phase 1 — Low-risk immediate improvements (enabled by default)
WFT_PROACTIVE_STRIP_V1 = true;
WFT_IMAGE_COMPRESSION_V1 = true;
WFT_PORTFOLIO_INDEX_V1 = true;
WFT_STORAGE_HEALTH_UI_V1 = true;

// Phase 2 — Async + IndexedDB (DISABLED until manual Phase 2 testing)
WFT_ASYNC_PORTFOLIO_ACCESS_V1 = false;
WFT_INDEXEDDB_CACHE_V1 = false;
WFT_STUDENT_ID_MAP_V1 = false;

// Phase 3 — Cloud data split (DISABLED until manual migration testing)
// WFT_SPLIT_STUDENT_FILES_V1 = true;
// WFT_LAZY_PORTFOLIO_LOAD_V1 = true;

wftDebugLog("[WFT Upgrade] Patches 0-14 loaded. Active flags:",
    "proactive_strip=" + WFT_PROACTIVE_STRIP_V1,
    "image_compression=" + WFT_IMAGE_COMPRESSION_V1,
    "portfolio_index=" + WFT_PORTFOLIO_INDEX_V1,
    "storage_health=" + WFT_STORAGE_HEALTH_UI_V1,
    "async_access=" + WFT_ASYNC_PORTFOLIO_ACCESS_V1,
    "indexeddb=" + WFT_INDEXEDDB_CACHE_V1,
    "student_id_map=" + WFT_STUDENT_ID_MAP_V1,
    "split_files=" + WFT_SPLIT_STUDENT_FILES_V1,
    "lazy_load=" + WFT_LAZY_PORTFOLIO_LOAD_V1
);

// Initialize storage adapter if IndexedDB is enabled
if (WFT_INDEXEDDB_CACHE_V1 && !(typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
    WftStorage.init().then(function() {
        wftDebugLog("[WFT Upgrade] Storage adapter ready:", WftStorage.mode);
    }).catch(function() {
        wftDebugWarn("[WFT Upgrade] Storage adapter init failed — continuing with localStorage");
    });
}

// Initialize student records if ID map is enabled
if (WFT_STUDENT_ID_MAP_V1 && !(typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
    try { ensureStudentRecordsForRoster(); } catch (e) {}
}

updateWftStorageMeta("patch-14-cleanup", "enabled");

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 14
// ═══════════════════════════════════════════════════════════════════════════

function redactWftSyncLogValue(value, depth) {
    var key;
    var copy;

    depth = depth || 0;

    if (value == null) return value;

    if (typeof value === "string") {
        return value
            .replace(/access_token=([^&\s#]+)/g, "access_token=[REDACTED]")
            .replace(/Authorization:\s*Bearer\s+[A-Za-z0-9._\-]+/gi, "Authorization: Bearer [REDACTED]")
            .replace(/Bearer\s+ya29\.[A-Za-z0-9._\-]+/g, "Bearer [REDACTED]")
            .replace(/ya29\.[A-Za-z0-9._\-]+/g, "[REDACTED_TOKEN]");
    }

    if (typeof value !== "object") return value;

    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactWftSyncLogValue(value.message || "", depth + 1),
            status: value.status || null,
            reason: redactWftSyncLogValue(value.reason || "", depth + 1)
        };
    }

    if (depth > 2) return "[Object]";

    if (Array.isArray(value)) {
        return value.map(function (item) {
            return redactWftSyncLogValue(item, depth + 1);
        });
    }

    copy = {};
    for (key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (/token|authorization/i.test(key)) {
            copy[key] = value[key] ? "[REDACTED]" : value[key];
        } else {
            copy[key] = redactWftSyncLogValue(value[key], depth + 1);
        }
    }

    return copy;
}

function getRedactedWftSyncLogArgs(argsLike) {
    var args = Array.prototype.slice.call(argsLike);
    return args.map(function (arg) {
        return redactWftSyncLogValue(arg, 0);
    });
}

function wftSyncLog() {
    if (!WFT_SYNC_DEBUG) return;
    if (!window.console || !console.log) return;

    try {
        var args = getRedactedWftSyncLogArgs(arguments);
        args.unshift(new Date().toISOString());
        console.log.apply(console, args);
    } catch (e) { }
}

function wftSyncWarn() {
    if (!WFT_SYNC_DEBUG) return;
    if (!window.console || !console.warn) return;

    try {
        var args = getRedactedWftSyncLogArgs(arguments);
        args.unshift(new Date().toISOString());
        console.warn.apply(console, args);
    } catch (e) { }
}

function wftSyncErrorLog() {
    if (!WFT_SYNC_DEBUG) return;
    if (!window.console || !console.error) return;

    try {
        var args = getRedactedWftSyncLogArgs(arguments);
        args.unshift(new Date().toISOString());
        console.error.apply(console, args);
    } catch (e) { }
}

function getWftSyncDebugSnapshot() {
    return {
        signedIn: !!wftSyncState.signedIn,
        hasAccessToken: !!wftSyncState.accessToken,
        tokenExpiresAt: wftSyncState.tokenExpiresAt || 0,
        folderId: wftSyncState.folderId || driveFolderId || '',
        settingsFileId: wftSyncState.settingsFileId || getCachedWftDriveFileId(WFT_SETTINGS_FILENAME) || '',
        portfolioFileId: wftSyncState.portfolioFileId || getCachedWftDriveFileId(WFT_PORTFOLIO_FILENAME) || '',
        deletionsFileId: wftSyncState.deletionsFileId || getCachedWftDriveFileId(WFT_DELETIONS_FILENAME) || '',
        isSyncing: !!wftSyncState.isSyncing,
        explicitSaveInProgress: !!wftSyncState.explicitSaveInProgress,
        pendingSettingsPush: !!wftSyncState.pendingSettingsPush,
        pendingPortfolioPush: !!wftSyncState.pendingPortfolioPush,
        pendingDeletionsPush: !!wftSyncState.pendingDeletionsPush,
        needsSyncAfterCurrent: !!wftSyncState.needsSyncAfterCurrent,
        settingsCounter: wftSyncState.localSettingsCounter,
        portfolioCounter: wftSyncState.localPortfolioCounter,
        deletionsCounter: wftSyncState.localDeletionsCounter,
        quotaBlocked: !!wftSyncState.quotaBlocked,
        permissionBlocked: !!wftSyncState.permissionBlocked,
        authBlocked: !!wftSyncState.authBlocked,
        lastError: wftSyncState.lastError ? String(wftSyncState.lastError.message || wftSyncState.lastError) : null
    };
}

var googleUser = null;
var driveAccessToken = null;
var driveFolderId = null;
var driveAutoSyncInterval = null;

// ── WFT Sync Engine V2 central state ──
var wftSyncState = {
    signedIn: false,
    accessToken: null,
    tokenExpiresAt: 0,
    googleUser: null,

    folderId: null,
    settingsFileId: null,
    portfolioFileId: null,
    deletionsFileId: null,

    isSyncing: false,
    currentSyncPromise: null,
    folderResolutionPromise: null,
    folderResolutionRunId: 0,
    syncRunId: 0,
    explicitSaveInProgress: false,
    imageUploadInProgress: false,

    pendingSettingsPush: false,
    pendingPortfolioPush: false,
    pendingDeletionsPush: false,
    needsSyncAfterCurrent: false,

    lastSyncedSettingsHash: "",
    lastSyncedPortfolioHash: "",
    lastSyncedDeletionsHash: "",
    lastSyncAt: "",

    localSettingsCounter: 0,
    localPortfolioCounter: 0,
    localDeletionsCounter: 0,
    lastSyncedSettingsCounter: 0,
    lastSyncedPortfolioCounter: 0,
    lastSyncedDeletionsCounter: 0,

    syncDebounceTimer: null,
    pollTimer: null,
    lastPollAt: 0,

    quotaBlocked: false,
    permissionBlocked: false,
    authBlocked: false,
    lastError: null
};

function syncLegacyGoogleGlobalsFromState() {
    googleUser = wftSyncState.googleUser;
    driveAccessToken = wftSyncState.accessToken;
    driveFolderId = wftSyncState.folderId;
}

function syncStateFromLegacyGoogleGlobals() {
    wftSyncState.googleUser = googleUser;
    wftSyncState.accessToken = driveAccessToken;
    if (!driveFolderId) {
        driveFolderId = getCachedWftDriveFolderId();
    }
    wftSyncState.folderId = driveFolderId;
    if (!wftSyncState.settingsFileId) {
        wftSyncState.settingsFileId = getCachedWftDriveFileId(WFT_SETTINGS_FILENAME);
    }
    if (!wftSyncState.portfolioFileId) {
        wftSyncState.portfolioFileId = getCachedWftDriveFileId(WFT_PORTFOLIO_FILENAME);
    }
    if (!wftSyncState.deletionsFileId) {
        wftSyncState.deletionsFileId = getCachedWftDriveFileId(WFT_DELETIONS_FILENAME);
    }
    wftSyncState.signedIn = !!driveAccessToken;

    if (!wftSyncState.tokenExpiresAt) {
        try {
            wftSyncState.tokenExpiresAt = Number(getWftSessionTokenExpiry() || 0);
        } catch (e) { }
    }
}

function isWftTokenValid() {
    if (!wftSyncState.accessToken) return false;
    if (!wftSyncState.tokenExpiresAt) return !!wftSyncState.accessToken;
    return Date.now() < wftSyncState.tokenExpiresAt;
}

function getWftTokenMsRemaining() {
    var expiry = Number(wftSyncState.tokenExpiresAt || getWftSessionTokenExpiry() || 0);
    if (!expiry) return 0;
    return expiry - Date.now();
}

function isWftTokenExpiringSoon(bufferMs) {
    var msLeft = getWftTokenMsRemaining();
    if (msLeft <= 0) return true;
    return msLeft < (bufferMs || WFT_TOKEN_FRESHNESS_BUFFER_MS);
}

function clearWftTokenExpiryWarningTimer() {
    if (wftTokenExpiryWarningTimer) {
        clearTimeout(wftTokenExpiryWarningTimer);
        wftTokenExpiryWarningTimer = null;
    }
}

function scheduleWftTokenExpiryWarning() {
    clearWftTokenExpiryWarningTimer();

    if (!wftSyncState || !wftSyncState.accessToken || !wftSyncState.tokenExpiresAt) return;

    var msUntilWarning = Number(wftSyncState.tokenExpiresAt || 0) - Date.now() - WFT_TOKEN_EXPIRY_WARNING_MS;
    if (msUntilWarning <= 0) {
        handleWftTokenExpiringSoon();
        return;
    }

    wftTokenExpiryWarningTimer = setTimeout(function () {
        handleWftTokenExpiringSoon();
    }, msUntilWarning);
}

function handleWftTokenExpiringSoon() {
    if (!wftSyncState || !wftSyncState.accessToken) return;

    saveWftLocalSnapshotsBeforeHide();

    if (isWftGisAuthEnabled()) {
        if (!wftGisSilentRefreshInFlight) {
            setDriveSyncStatus("syncing", "Refreshing Google session...", 8, "Checking your previous Drive connection.");
            wftGisSilentRefreshInFlight = attemptSilentWftGisTokenRefresh("token-expiry-warning")
                .then(function () {
                    setDriveSyncStatus("success", "Google session refreshed.");
                    return true;
                })
                .catch(function (e) {
                    wftDebugWarn("[WFT Auth] Silent token refresh failed:", e);
                    if (!isWftTokenValid()) {
                        wftSyncState.authBlocked = true;
                        clearWftTokenSession();
                        setDriveSyncStatus("error", "Google session expired - click Sync to reconnect.");
                    } else {
                        setDriveSyncStatus("error", "Google session expires soon - click Sync to reconnect before saving to Drive.");
                    }
                    return false;
                })
                .then(function (result) {
                    wftGisSilentRefreshInFlight = null;
                    return result;
                });
        }
        return;
    }

    if (!isWftTokenValid()) {
        wftSyncState.authBlocked = true;
        clearWftTokenSession();
        setDriveSyncStatus("error", "Google session expired - click Sync to reconnect.");
        return;
    }

    setDriveSyncStatus("error", "Google session expires soon - click Sync to reconnect before saving to Drive.");
}

function requestWftDriveReconnect(reason) {
    saveWftLocalSnapshotsBeforeHide();
    setDriveSyncStatus("syncing", "Reconnecting to Google Drive...", 8, "Checking whether Drive access is still available.");
    requestDriveAccess(function () {
        if (reason === "explicit-sync-to-portfolio" || reason === "manual") {
            manualSaveToDrive();
        }
    });
}

function ensureFreshWftDriveTokenBeforeSync(reason) {
    syncStateFromLegacyGoogleGlobals();

    if (!wftSyncState.accessToken && !driveAccessToken) {
        requestWftDriveReconnect(reason || "manual");
        return false;
    }

    if (!isWftTokenValid()) {
        wftSyncState.authBlocked = true;
        clearWftTokenSession();
        requestWftDriveReconnect(reason || "manual");
        return false;
    }

    if (isWftTokenExpiringSoon(WFT_TOKEN_FRESHNESS_BUFFER_MS)) {
        requestWftDriveReconnect(reason || "manual");
        return false;
    }

    scheduleWftTokenExpiryWarning();
    return true;
}

function clearPersistedGoogleState() {
    localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
    localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
    localStorage.removeItem(GOOGLE_USER_CACHE_KEY);
    localStorage.removeItem(GOOGLE_CONNECTED_CACHE_KEY);
}

function getCachedGoogleUser() {
    var cachedUserRaw = localStorage.getItem(GOOGLE_USER_CACHE_KEY);
    if (!cachedUserRaw) return null;
    try {
        var cachedUser = JSON.parse(cachedUserRaw);
        if (cachedUser && (cachedUser.name || cachedUser.email)) {
            return cachedUser;
        }
    } catch (e) {}
    return null;
}

function hasPersistedGoogleConnection() {
    return localStorage.getItem(GOOGLE_CONNECTED_CACHE_KEY) === "1";
}

function isWftGisAuthEnabled() {
    return WFT_GIS_AUTH_V2 === true && typeof window !== "undefined";
}

function isWftGisLibraryReady() {
    return isWftGisAuthEnabled() &&
        !!(window.google && window.google.accounts && window.google.accounts.oauth2 &&
        typeof window.google.accounts.oauth2.initTokenClient === "function");
}

function loadWftGisClientLibrary() {
    if (!isWftGisAuthEnabled()) {
        return Promise.reject(new Error("GIS auth is disabled"));
    }

    if (isWftGisLibraryReady()) {
        return Promise.resolve(true);
    }

    if (wftGisScriptLoadPromise) {
        return wftGisScriptLoadPromise;
    }

    wftGisScriptLoadPromise = new Promise(function (resolve, reject) {
        var existing = null;
        var scripts = document.getElementsByTagName("script");
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i] && scripts[i].src && scripts[i].src.indexOf(WFT_GIS_SCRIPT_URL) === 0) {
                existing = scripts[i];
                break;
            }
        }

        function finishWhenReady() {
            var attempts = 0;
            var maxAttempts = 80;
            var timer = setInterval(function () {
                attempts += 1;
                if (isWftGisLibraryReady()) {
                    clearInterval(timer);
                    resolve(true);
                } else if (attempts >= maxAttempts) {
                    clearInterval(timer);
                    reject(new Error("Google Identity Services did not load"));
                }
            }, 100);
        }

        if (existing) {
            finishWhenReady();
            return;
        }

        var script = document.createElement("script");
        script.src = WFT_GIS_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = function () { finishWhenReady(); };
        script.onerror = function () { reject(new Error("Could not load Google Identity Services")); };
        document.head.appendChild(script);
    });

    return wftGisScriptLoadPromise;
}

function getWftGisLoginHint() {
    var cachedUser = getCachedGoogleUser();
    if (cachedUser && cachedUser.email) return cachedUser.email;
    if (googleUser && googleUser.email) return googleUser.email;
    return "";
}

function getWftGisTokenClient() {
    var loginHint;
    var config;

    if (!isWftGisLibraryReady()) return null;
    if (wftGisTokenClient) return wftGisTokenClient;

    config = {
        client_id: GOOGLE_CLIENT_ID,
        scope: WFT_GOOGLE_AUTH_SCOPE,
        include_granted_scopes: true,
        prompt: "",
        callback: handleWftGisTokenResponse,
        error_callback: handleWftGisTokenError
    };

    loginHint = getWftGisLoginHint();
    if (loginHint) {
        config.login_hint = loginHint;
    }

    wftGisTokenClient = window.google.accounts.oauth2.initTokenClient(config);
    return wftGisTokenClient;
}

function makeWftGisError(message, detail) {
    var err = new Error(message || "Google authorization failed");
    if (detail) {
        err.detail = detail;
        err.type = detail.type || detail.error || "";
        err.error = detail.error || "";
        err.error_description = detail.error_description || detail.message || "";
    }
    return err;
}

function completeWftGisTokenRequest(err, response) {
    var record = wftGisActiveTokenRequest;
    wftGisActiveTokenRequest = null;

    if (!record) return;

    if (err) {
        record.reject(err);
        return;
    }

    record.resolve(response);
}

function handleWftGisTokenError(err) {
    completeWftGisTokenRequest(makeWftGisError("Google authorization popup was cancelled or could not open.", err || {}), null);
}

function hasWftGisGrantedRequiredScopes(tokenResponse) {
    var requiredScopes;
    var grantedScopes;
    var args;
    var i;

    if (!tokenResponse || !tokenResponse.access_token) return false;

    if (window.google && window.google.accounts && window.google.accounts.oauth2 &&
        typeof window.google.accounts.oauth2.hasGrantedAllScopes === "function") {
        requiredScopes = WFT_GOOGLE_AUTH_SCOPE.split(/\s+/);
        args = [tokenResponse].concat(requiredScopes);
        try {
            return window.google.accounts.oauth2.hasGrantedAllScopes.apply(window.google.accounts.oauth2, args);
        } catch (e) { }
    }

    if (!tokenResponse.scope) return true;

    grantedScopes = String(tokenResponse.scope || "").split(/\s+/);
    requiredScopes = WFT_GOOGLE_AUTH_SCOPE.split(/\s+/);
    for (i = 0; i < requiredScopes.length; i++) {
        if (grantedScopes.indexOf(requiredScopes[i]) === -1) return false;
    }
    return true;
}

function handleWftGisTokenResponse(response) {
    var accessToken;
    var expiresIn;
    var expiresAt;
    var record = wftGisActiveTokenRequest;

    if (!response || response.error) {
        completeWftGisTokenRequest(makeWftGisError("Google authorization failed.", response || {}), null);
        return;
    }

    accessToken = response.access_token;
    if (!accessToken) {
        completeWftGisTokenRequest(makeWftGisError("Google did not return a Drive access token.", response || {}), null);
        return;
    }

    if (!hasWftGisGrantedRequiredScopes(response)) {
        completeWftGisTokenRequest(makeWftGisError("Google Drive permission was not granted.", response || {}), null);
        setDriveSyncStatus("error", "Google Drive permission was not granted. Please sign in again and allow Drive access.");
        return;
    }

    expiresIn = parseInt(response.expires_in || "3600", 10);
    if (!isFinite(expiresIn) || expiresIn <= 0) {
        expiresIn = 3600;
    }
    expiresAt = Date.now() + Math.max(60, expiresIn - 30) * 1000;

    saveWftTokenSession(accessToken, expiresAt);
    try { localStorage.setItem(GOOGLE_CONNECTED_CACHE_KEY, "1"); } catch (e) { }

    wftSyncState.accessToken = accessToken;
    wftSyncState.tokenExpiresAt = expiresAt;
    wftSyncState.signedIn = true;
    wftSyncState.authBlocked = false;
    driveAccessToken = accessToken;
    syncStateFromLegacyGoogleGlobals();
    clearWftSyncBlockState();
    scheduleWftTokenExpiryWarning();

    wftSyncLog("[WFT Sync][AUTH] GIS token received", { hasAccessToken: true, expiresIn: expiresIn, scope: response.scope || "" });

    fetchGoogleUserInfo(accessToken);

    if (record && typeof record.onSuccess === "function") {
        setTimeout(function () {
            try { record.onSuccess(); } catch (e2) { wftDebugError("[WFT Auth] post-auth callback failed:", e2); }
        }, 150);
    }

    completeWftGisTokenRequest(null, { accessToken: accessToken, expiresAt: expiresAt, response: response });
}

function requestWftGisAccessToken(promptValue, onSuccess, options) {
    var record;
    var promise;
    var externalResolve;
    var externalReject;

    options = options || {};
    promptValue = typeof promptValue === "string" ? promptValue : "";

    if (!isWftGisAuthEnabled()) {
        return Promise.reject(new Error("GIS auth is disabled"));
    }

    if (wftGisActiveTokenRequest && wftGisActiveTokenRequest.promise) {
        return wftGisActiveTokenRequest.promise.then(function (result) {
            if (typeof onSuccess === "function") {
                onSuccess();
            }
            return result;
        });
    }

    promise = new Promise(function (resolve, reject) {
        externalResolve = resolve;
        externalReject = reject;
    });

    record = {
        resolve: externalResolve,
        reject: externalReject,
        onSuccess: onSuccess,
        promptValue: promptValue,
        reason: options.reason || "",
        promise: promise
    };

    wftGisActiveTokenRequest = record;

    loadWftGisClientLibrary().then(function () {
        var client = getWftGisTokenClient();
        var requestConfig;
        if (!client) {
            throw new Error("Google Identity Services token client is unavailable");
        }

        requestConfig = {
            scope: WFT_GOOGLE_AUTH_SCOPE,
            include_granted_scopes: true,
            prompt: promptValue
        };

        client.requestAccessToken(requestConfig);
    }).catch(function (err) {
        if (wftGisActiveTokenRequest === record) {
            wftGisActiveTokenRequest = null;
        }
        externalReject(err);
    });

    return promise;
}

function attemptSilentWftGisTokenRefresh(reason) {
    var now = Date.now();

    if (!isWftGisAuthEnabled()) {
        return Promise.reject(new Error("GIS auth is disabled"));
    }

    if (now - wftLastSilentGisAttemptAt < WFT_GIS_SILENT_RETRY_COOLDOWN_MS) {
        return Promise.reject(new Error("Silent Google refresh is cooling down"));
    }

    wftLastSilentGisAttemptAt = now;
    return requestWftGisAccessToken("none", null, { reason: reason || "silent-refresh", silent: true });
}

function attemptWftGisSilentBootstrapIfConnected(reason) {
    if (!isWftGisAuthEnabled() || !hasPersistedGoogleConnection()) {
        return Promise.resolve(false);
    }

    if (wftGisSilentBootstrapInFlight) {
        return wftGisSilentBootstrapInFlight;
    }

    setDriveSyncStatus("syncing", "Reconnecting to Google Drive...", 8, "Checking whether Drive access is still available.");
    wftGisSilentBootstrapInFlight = attemptSilentWftGisTokenRefresh(reason || "startup")
        .then(function () {
            wftGisSilentBootstrapInFlight = null;
            return true;
        })
        .catch(function (e) {
            wftDebugWarn("[WFT Auth] Silent GIS bootstrap failed:", e);
            wftGisSilentBootstrapInFlight = null;
            setDriveSyncStatus("error", "Session expired - click Sync to reconnect.", null, "Local data is still available.");
            return false;
        });

    return wftGisSilentBootstrapInFlight;
}

// Read OAuth tokens delivered via the URL fragment (#) after Google redirects
// back to the GitHub Pages app using the implicit grant flow.
function checkHashForOAuthTokens() {
    var hash = window.location.hash;
    if (!hash) return false;

    try {
        var params = new URLSearchParams(hash.substring(1));
        var accessToken = params.get('access_token');
        var expiresIn = parseInt(params.get('expires_in') || '3600', 10);

        if (!accessToken) return false;

        var expiresAt = Date.now() + Math.max(60, (expiresIn - 30)) * 1000;
        saveWftTokenSession(accessToken, expiresAt);
        try {
            localStorage.setItem(GOOGLE_CONNECTED_CACHE_KEY, '1');
        } catch (storageErr) { }

        wftSyncState.accessToken = accessToken;
        wftSyncState.tokenExpiresAt = expiresAt;
        wftSyncState.signedIn = true;
        driveAccessToken = accessToken;
        scheduleWftTokenExpiryWarning();
        wftSyncLog("[WFT Sync][AUTH] OAuth token received", { hasAccessToken: true, expiresIn: expiresIn, scope: params.get("scope") || "" });

        history.replaceState(null, document.title || '', window.location.pathname + window.location.search);
        return true;
    } catch (e) {
        wftDebugError('[WFT Auth] Error reading OAuth tokens from hash:', e);
        return false;
    }
}

function restoreGoogleStateFromStorage() {
    if (WFT_SESSION_TOKEN_STORAGE_V2 && restoreWftTokenSession()) {
        var sessionUser = getCachedGoogleUser();
        if (sessionUser) {
            googleUser = sessionUser;
            showSignedInState(sessionUser);
        } else {
            showSignedInState({ name: "Connected" });
        }
        fetchGoogleUserInfo(wftSyncState.accessToken);
        return true;
    }

    if (migrateOldWftTokenToSessionStorage()) {
        var migratedUser = getCachedGoogleUser();
        if (migratedUser) {
            googleUser = migratedUser;
            showSignedInState(migratedUser);
        } else {
            showSignedInState({ name: "Connected" });
        }
        fetchGoogleUserInfo(wftSyncState.accessToken);
        return true;
    }

    var cachedUser = getCachedGoogleUser();
    var hasConnectionMarker = hasPersistedGoogleConnection();
    driveAccessToken = null;
    wftSyncState.accessToken = null;
    wftSyncState.tokenExpiresAt = 0;
    wftSyncState.signedIn = false;
    clearWftTokenExpiryWarningTimer();
    try {
        localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
        localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
    } catch (e) { }
    showSignedOutState();
    if (cachedUser || hasConnectionMarker) {
        if (isWftGisAuthEnabled()) {
            showDriveDisconnectedState("Reconnecting to Google Drive...");
            attemptWftGisSilentBootstrapIfConnected("restore-storage");
        } else {
            setDriveSyncStatus("error", "Session expired - please sign in again.", null, "Local data is still available.");
        }
    }
    return false;
}

var WFT_OAUTH_TEXTAREA_DRAFT_KEY = "wft_oauth_textarea_draft_v1";

function saveWftOAuthDraftBeforeRedirect(reason) {
    try {
        var ta = document.getElementById("studentWriting");
        var text = ta ? String(ta.value || "") : "";
        var genreSelect = document.getElementById("writingGenreSelect");
        var draft = {
            reason: reason || "google-oauth",
            savedAt: new Date().toISOString(),
            text: text,
            selectedStudent: selectedStudent || "",
            manualGenreOverrideValue: manualGenreOverrideValue || "__auto__",
            writingGenreSelectValue: genreSelect ? genreSelect.value : "__auto__"
        };
        if (text.trim() || draft.selectedStudent) {
            localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, JSON.stringify(draft));
        }
    } catch (e) { }
}

function restoreWftOAuthDraftAfterRedirect() {
    try {
        var raw = localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY);
        if (!raw) return;
        var draft = JSON.parse(raw);
        localStorage.removeItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY);
        if (!draft || typeof draft.text !== "string") return;

        var ta = document.getElementById("studentWriting");
        if (ta && !String(ta.value || "").trim() && draft.text.trim()) {
            ta.value = draft.text;
            ta.setAttribute("data-wft-oauth-draft-restored", "true");
        }
        if (draft.selectedStudent) {
            selectedStudent = draft.selectedStudent;
            try { localStorage.setItem("wft_selectedStudent", selectedStudent); } catch (e2) { }
            var studentSelect = document.getElementById("studentSelect");
            if (studentSelect) studentSelect.value = selectedStudent;
        }
        if (draft.manualGenreOverrideValue) {
            manualGenreOverrideValue = draft.manualGenreOverrideValue;
            var genreSelect = document.getElementById("writingGenreSelect");
            if (genreSelect) genreSelect.value = draft.writingGenreSelectValue || draft.manualGenreOverrideValue || "__auto__";
        }
        if (typeof syncUiState === "function") syncUiState();
        if (typeof setOcrStatus === "function" && draft.text && draft.text.trim()) {
            setOcrStatus("Restored unsaved writing after Google sign-in.", "success");
        }
    } catch (e) {
        try { localStorage.removeItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY); } catch (e2) { }
    }
}

function requestDriveAccessViaRedirect(onSuccess, options) {
    var scope = WFT_GOOGLE_AUTH_SCOPE;
    var redirectUri = "https://thepick.github.io/writing-feedback-tool/";
    var authUrl = "https://accounts.google.com/o/oauth2/auth"
        + "?client_id=" + encodeURIComponent(GOOGLE_CLIENT_ID)
        + "&redirect_uri=" + encodeURIComponent(redirectUri)
        + "&response_type=token"
        + "&scope=" + encodeURIComponent(scope);

    if (typeof onSuccess === "function") {
        localStorage.setItem("wft_oauth_pending_action", "sync");
    }

    saveWftOAuthDraftBeforeRedirect(typeof onSuccess === "function" ? "sync" : "sign-in");
    window.location.href = authUrl;
}

function requestDriveAccess(onSuccess, options) {
    var promptValue;
    var reason;

    options = options || {};

    if (isWftGisAuthEnabled()) {
        promptValue = typeof options.prompt === "string" ? options.prompt : "";
        reason = options.reason || (typeof onSuccess === "function" ? "sync" : "sign-in");
        saveWftLocalSnapshotsBeforeHide();
        setDriveSyncStatus(
            "syncing",
            promptValue === "none" ? "Refreshing Google session..." : "Connecting to Google Drive...",
            promptValue === "none" ? 8 : 5,
            promptValue === "none" ? "Checking your previous Drive connection." : "Local data remains saved on this device."
        );

        requestWftGisAccessToken(promptValue, onSuccess, { reason: reason, silent: promptValue === "none" })
            .catch(function (err) {
                var errType = String((err && (err.type || err.error || err.message)) || "");
                wftDebugWarn("[WFT Auth] GIS token request failed:", err);

                if (promptValue === "none" || options.noRedirectFallback || /popup_closed/i.test(errType)) {
                    setDriveSyncStatus("error", "Google Drive reconnect was not completed. Click Sync to try again.");
                    return;
                }

                if (WFT_GIS_FALLBACK_TO_REDIRECT) {
                    setDriveSyncStatus("syncing", "Opening Google sign-in...", 10, "Allow Drive access so the app can sync your class and portfolio data.");
                    requestDriveAccessViaRedirect(onSuccess, options);
                } else {
                    setDriveSyncStatus("error", "Google Drive reconnect failed. Please try again.");
                }
            });
        return;
    }

    requestDriveAccessViaRedirect(onSuccess, options);
}

function handleGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID) {
      alert("Google OAuth Client ID is missing from the app configuration.");
      return;
    }
    requestDriveAccess();
}

function showSignedOutState() {
    googleUser = null;
    driveAccessToken = null;
    driveFolderId = null;
    resetWftSyncStateAfterSignOut();
    var signInBtnHeader = document.getElementById("googleSignInBtnHeader");
    var userInfoHeader = document.getElementById("googleUserInfoHeader");
    if (signInBtnHeader) signInBtnHeader.style.display = "flex";
    if (userInfoHeader) userInfoHeader.style.display = "none";
    setDriveSyncStatus("", "Not synced");
    setDuplicateSyncMaintenanceStatus("Sign in with Google Drive to check for duplicate sync files.", 0, false);
}

function showDriveDisconnectedState(message) {
    driveAccessToken = null;
    driveFolderId = null;
    stopDriveAutoSync();

    var cachedUser = getCachedGoogleUser();
    if (!googleUser && cachedUser) {
        googleUser = cachedUser;
    }

    if (!googleUser && hasPersistedGoogleConnection()) {
        googleUser = { name: "Connected" };
    }

    var signInBtnHeader = document.getElementById("googleSignInBtnHeader");
    var userInfoHeader = document.getElementById("googleUserInfoHeader");

    if (googleUser) {
        if (signInBtnHeader) signInBtnHeader.style.display = "none";
        if (userInfoHeader) userInfoHeader.style.display = "flex";
        showSignedInState(googleUser);
    } else {
        if (signInBtnHeader) signInBtnHeader.style.display = "flex";
        if (userInfoHeader) userInfoHeader.style.display = "none";
    }

    setDriveSyncStatus("error", message || "Drive disconnected - click Sync to reconnect");
}

function restoreGoogleSessionOnce() {
    if (!driveAccessToken) {
        restoreGoogleStateFromStorage();
    }
}

function fetchGoogleUserInfo(token) {
    fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + token }
    }).then(function(r) { return r.json(); }).then(function(info) {
        googleUser = info;
        localStorage.setItem(GOOGLE_USER_CACHE_KEY, JSON.stringify(info));

        var expiry = Number(wftSyncState.tokenExpiresAt || getWftSessionTokenExpiry() || 0);
        if (token && expiry > Date.now()) {
            saveWftTokenSession(token, expiry);
            wftSyncState.accessToken = token;
            wftSyncState.tokenExpiresAt = expiry;
            wftSyncState.signedIn = true;
            syncStateFromLegacyGoogleGlobals();
            scheduleWftTokenExpiryWarning();
        }

        showSignedInState(info);

        // ── WFT Sync V2: use V2 merge/sync instead of old Drive loading ──
        if (WFT_SYNC_ENGINE_V2) {
            syncWftNow("sign-in", { immediate: true })
                .then(function() {
                    return new Promise(function(resolve) {
                        syncPendingPortfolioMedia(function() { resolve(); });
                    });
                })
                .then(function() {
                    return syncWftNow("sign-in-media-complete", { immediate: true });
                })
                .then(function() {
                    startWftSyncPolling();
                })
                .catch(function(e) {
                    wftSyncErrorLog("Sign-in sync failed", e);
                    setDriveSyncStatus("error", "Google Drive sync failed.", null, "Local data is still available.");
                    startWftSyncPolling();
                });
        } else {
            loadSettingsFromDrive();
            loadPortfolioFromDrive();
            syncPendingPortfolioMedia();
            startDriveAutoSync();
        }
    }).catch(function(e) {
        wftDebugError("Failed to fetch user info:", e);
        var cachedUser = getCachedGoogleUser();
        if (cachedUser) {
            googleUser = cachedUser;
            showSignedInState(cachedUser);
        } else if (driveAccessToken || hasPersistedGoogleConnection()) {
            googleUser = { name: "Connected" };
            showSignedInState(googleUser);
        }
        setDriveSyncStatus("error", "Reconnect may be needed", null, "Local data is still available.");
    });
}

function toWftTitleCaseNamePart(part) {
    part = String(part || "").trim();
    if (!part) return "";
    if (part.indexOf("@") !== -1) return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

function formatGoogleDisplayNameForHeader(displayName) {
    var raw = String(displayName || "").trim();
    var parts;
    var first;
    var last;
    var initials = [];
    var i;

    if (!raw) return "Connected";
    if (raw.indexOf("@") !== -1) return raw;

    parts = raw.split(/\s+/).filter(function(part) { return !!part; });
    if (parts.length === 1) return toWftTitleCaseNamePart(parts[0]);
    if (parts.length === 2) {
        return toWftTitleCaseNamePart(parts[0]) + " " + toWftTitleCaseNamePart(parts[1]);
    }

    first = toWftTitleCaseNamePart(parts[0]);
    last = toWftTitleCaseNamePart(parts[parts.length - 1]);
    for (i = 1; i < parts.length - 1; i++) {
        if (parts[i]) initials.push(parts[i].charAt(0).toUpperCase() + ".");
    }
    return first + " " + initials.join(" ") + (initials.length ? " " : "") + last;
}

function showSignedInState(info) {
    var signInBtnHeader = document.getElementById("googleSignInBtnHeader");
    var userInfoHeader = document.getElementById("googleUserInfoHeader");
    if (signInBtnHeader) signInBtnHeader.style.display = "none";
    if (userInfoHeader) userInfoHeader.style.display = "flex";
    var displayName = (info && (info.name || info.email)) ? (info.name || info.email) : "Connected";
    var compactDisplayName = formatGoogleDisplayNameForHeader(displayName);
    var photoUrl = (info && (info.picture || info.photoURL)) ? (info.picture || info.photoURL) : "";
    setDuplicateSyncMaintenanceStatus("Google Drive is connected. Use Check now if you want to look for older duplicate sync files.", 0, false);
    var nameElHeader = document.getElementById("googleUserNameHeader");
    if (nameElHeader) {
        nameElHeader.textContent = compactDisplayName;
        nameElHeader.title = displayName;
    }
    var avatarHeader = document.getElementById("googleUserAvatarHeader");
    if (avatarHeader) {
        if (photoUrl) {
            avatarHeader.src = photoUrl;
            avatarHeader.style.display = "inline-block";
        } else {
            avatarHeader.style.display = "none";
        }
    }
    setDriveSyncStatus("syncing", "Connecting to Google Drive...", 5, "Local data remains saved on this device.");
}

// ── WFT Sync V2: reset sync state on sign-out ──
function resetWftSyncStateAfterSignOut() {
    clearWftTokenExpiryWarningTimer();
    if (wftSyncState.syncDebounceTimer) {
        clearTimeout(wftSyncState.syncDebounceTimer);
        wftSyncState.syncDebounceTimer = null;
    }
    stopWftSyncPolling();
    wftSyncState.signedIn = false;
    wftSyncState.accessToken = null;
    wftSyncState.tokenExpiresAt = 0;
    wftSyncState.googleUser = null;
    wftSyncState.folderId = null;
    wftSyncState.settingsFileId = null;
    wftSyncState.portfolioFileId = null;
    wftSyncState.isSyncing = false;
    wftSyncState.currentSyncPromise = null;
    wftSyncState.syncRunId = 0;
    wftSyncState.explicitSaveInProgress = false;
    wftSyncState.imageUploadInProgress = false;
    wftSyncState.pendingSettingsPush = false;
    wftSyncState.pendingPortfolioPush = false;
    wftSyncState.pendingDeletionsPush = false;
    wftSyncState.needsSyncAfterCurrent = false;
    wftSyncState.lastSyncedSettingsHash = "";
    wftSyncState.lastSyncedPortfolioHash = "";
    wftSyncState.lastSyncedDeletionsHash = "";
    wftSyncState.localSettingsCounter = 0;
    wftSyncState.localPortfolioCounter = 0;
    wftSyncState.localDeletionsCounter = 0;
    wftSyncState.lastSyncedSettingsCounter = 0;
    wftSyncState.lastSyncedPortfolioCounter = 0;
    wftSyncState.lastSyncedDeletionsCounter = 0;
    wftSyncState.lastPollAt = 0;
    clearWftSyncBlockState();
}
function clearWftLocalStorageAfterSignOut() {
    // v5: signing out disconnects Google/Drive but keeps local app data on this device.
    // Do not remove wft_settings, wft_students, wft_selectedStudent, wft_portfolio,
    // wft_deletions, or pending local sync data here.
    var exactKeys = [
        "wft_oauth_pending_action",
        WFT_DRIVE_FOLDER_ID_CACHE_KEY,
        WFT_SETTINGS_FILE_ID_CACHE_KEY,
        WFT_PORTFOLIO_FILE_ID_CACHE_KEY,
        WFT_DELETIONS_FILE_ID_CACHE_KEY,
        WFT_PORTFOLIO_INDEX_FILE_ID_CACHE_KEY,
        (typeof WFT_DRIVE_STUDENTS_FOLDER_ID_KEY !== "undefined") ? WFT_DRIVE_STUDENTS_FOLDER_ID_KEY : "",
        (typeof WFT_DRIVE_MEDIA_FOLDER_ID_KEY !== "undefined") ? WFT_DRIVE_MEDIA_FOLDER_ID_KEY : ""
    ];
    var prefixes = [
        "wft_drive_student_file_",
        "wft_drive_media_folder_"
    ];
    var i;
    var p;
    var key;
    var keysToRemove = [];

    for (i = 0; i < exactKeys.length; i += 1) {
        if (exactKeys[i] && keysToRemove.indexOf(exactKeys[i]) === -1) {
            keysToRemove.push(exactKeys[i]);
        }
    }

    try {
        for (i = 0; i < localStorage.length; i += 1) {
            key = localStorage.key(i);
            if (!key) continue;
            for (p = 0; p < prefixes.length; p += 1) {
                if (key.indexOf(prefixes[p]) === 0 && keysToRemove.indexOf(key) === -1) {
                    keysToRemove.push(key);
                    break;
                }
            }
        }
    } catch (e) { }

    for (i = 0; i < keysToRemove.length; i += 1) {
        try {
            localStorage.removeItem(keysToRemove[i]);
        } catch (e2) { }
    }
}
function resetWftResultUiToFreshSlate() {
    var correctedStoryEl = document.getElementById("correctedStory");
    if (correctedStoryEl) correctedStoryEl.innerHTML = "No corrected story yet.";

    var detailedAssessmentEl = document.getElementById("detailedAssessment");
    if (detailedAssessmentEl) detailedAssessmentEl.innerHTML = '<div class="assessment-item">No detailed assessment data.</div>';

    var growGoalBoxEl = document.getElementById("growGoalBox");
    if (growGoalBoxEl) growGoalBoxEl.innerHTML = "No grow goal yet.";

    var diffControlsEl = document.getElementById("diffControls");
    if (diffControlsEl) diffControlsEl.style.display = "none";

    var debugTextIds = [
        "step1PromptRaw",
        "step1Raw",
        "step2PromptRaw",
        "step2Raw",
        "step3PromptRaw",
        "step3Raw",
        "detailedFeedbackInputRaw",
        "debugRaw"
    ];
    for (var debugTextIndex = 0; debugTextIndex < debugTextIds.length; debugTextIndex += 1) {
        var debugTextEl = document.getElementById(debugTextIds[debugTextIndex]);
        if (debugTextEl) debugTextEl.textContent = "";
    }

    var debugSummaryEl = document.getElementById("debugSummary");
    if (debugSummaryEl) debugSummaryEl.innerHTML = "No debug summary yet.";

    var grammarCalcEl = document.getElementById("grammarCalc");
    if (grammarCalcEl) grammarCalcEl.innerHTML = "";

    var teacherAuditViewEl = document.getElementById("teacherAuditView");
    if (teacherAuditViewEl) teacherAuditViewEl.innerHTML = "No teacher audit data yet.";

    var teacherReviewDetailsEl = document.getElementById("teacherReviewDetails");
    if (teacherReviewDetailsEl) teacherReviewDetailsEl.open = false;

    var notebookDefaults = {
        notebookTitle: "Untitled Writing",
        notebookOverallScore: "--%",
        notebookStudentName: "No student selected",
        notebookDate: "",
        notebookWordCount: "0 / 0",
        notebookStrength: "-",
        notebookGrowGoal: "-",
        notebookTeacherComment: "-",
        notebookPage2Title: "Untitled Writing",
        notebookPage2Date: ""
    };
    Object.keys(notebookDefaults).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = notebookDefaults[id];
    });

    var notebookDetailedAssessmentEl = document.getElementById("notebookDetailedAssessment");
    if (notebookDetailedAssessmentEl) notebookDetailedAssessmentEl.innerHTML = "";

    var notebookPage2ContentEl = document.getElementById("notebookPage2Content");
    if (notebookPage2ContentEl) notebookPage2ContentEl.innerHTML = '<div class="section-title">Next Time Writing Guide</div>';

    var portfolioContentEl = document.getElementById("portfolioContent");
    if (portfolioContentEl) portfolioContentEl.innerHTML = '<div class="portfolio-empty">Select a student above to view their progress charts and session history.</div>';
}

function resetWftInputUiToFreshSlate() {
    var ta = document.getElementById("studentWriting");
    if (ta) ta.value = "";

    var studentSelect = document.getElementById("studentSelect");
    if (studentSelect) studentSelect.value = "";

    var studentNameInput = document.getElementById("studentNameInput");
    if (studentNameInput) studentNameInput.value = "";

    var portfolioSelect = document.getElementById("portfolioStudentSelect");
    if (portfolioSelect) portfolioSelect.value = "";

    var importFileEl = document.getElementById("importFile");
    if (importFileEl) importFileEl.value = "";

    var cameraInputEl = document.getElementById("cameraInput");
    if (cameraInputEl) cameraInputEl.value = "";

    var imageUploadInputEl = document.getElementById("imageUploadInput");
    if (imageUploadInputEl) imageUploadInputEl.value = "";

    var modelSelectEl = document.getElementById("modelSelect");
    if (modelSelectEl) modelSelectEl.value = DEFAULT_MODEL;

    var targetWordCountEl = document.getElementById("targetWordCount");
    if (targetWordCountEl) targetWordCountEl.value = "200";

    var useWordCountTargetEl = document.getElementById("useWordCountTarget");
    if (useWordCountTargetEl) useWordCountTargetEl.checked = true;
    if (targetWordCountEl) targetWordCountEl.disabled = false;

    var grammarStrictnessEl = document.getElementById("grammarStrictness");
    if (grammarStrictnessEl) grammarStrictnessEl.value = "3";

    if (typeof updateGrammarStrictnessDisplay === "function") updateGrammarStrictnessDisplay("3");
    else {
        var grammarStrictnessValEl = document.getElementById("grammarStrictnessVal");
        if (grammarStrictnessValEl) grammarStrictnessValEl.textContent = "3";
    }

    var assessScriptQualityEl = document.getElementById("assessScriptQuality");
    if (assessScriptQualityEl) assessScriptQualityEl.checked = false;

    applyRememberApiKeyStoredPreferenceToUi();
    var apiKeyInputEl = document.getElementById("apiKeyInput");
    if (apiKeyInputEl) apiKeyInputEl.value = getStoredApiKey();

    var ocrPanelEl = document.getElementById("ocrPanel");
    if (ocrPanelEl) ocrPanelEl.open = false;

    var cropModalEl = document.getElementById("cropModal");
    if (cropModalEl) cropModalEl.style.display = "none";

    var imgLightboxEl = document.getElementById("imgLightbox");
    if (imgLightboxEl) imgLightboxEl.style.display = "none";

    var imgLightboxImgEl = document.getElementById("imgLightboxImg");
    if (imgLightboxImgEl) imgLightboxImgEl.removeAttribute("src");

    var imgLightboxCaptionEl = document.getElementById("imgLightboxCaption");
    if (imgLightboxCaptionEl) imgLightboxCaptionEl.textContent = "";
}

function resetWftRuntimeWorkAfterSignOut() {
    try {
        if (analysisAbortController) analysisAbortController.abort();
    } catch (e) { }
    students = [];
    selectedStudent = "";
    pendingPortfolioSync = null;
    selectedImages = [];
    selectedImageDataUrl = "";
    selectedImageName = "";
    selectedImageExtractedText = "";
    selectedImageExtractionPromise = null;
    latestAnalysisData = null;
    originalTextForDiff = "";
    correctedHtmlForDiff = "";
    manualSyncInProgress = false;
    cancelAnalysis = false;
    isAnalyzing = false;
    analysisAbortController = null;
    lastSyncedPortfolioSessionSignature = "";
}

function resetWftLocalWorkAfterSignOut() {
    var previousSuppress = typeof wftSuppressDirtyMarks !== "undefined" ? wftSuppressDirtyMarks : false;

    if (typeof wftSuppressDirtyMarks !== "undefined") {
        wftSuppressDirtyMarks = true;
    }

    clearWftLocalStorageAfterSignOut();
    resetWftRuntimeWorkAfterSignOut();
    resetWftInputUiToFreshSlate();
    refreshApiKeyRuntimeValue();
    resetWftResultUiToFreshSlate();

    try { renderStudentList(); } catch (e2) { }
    try { populateStudentDropdown(); } catch (e3) { }
    try { refreshPortfolioDropdown(); } catch (e4) { }
    try { renderStudentPortfolio(); } catch (e5) { }
    try { updateExportSelectedStudentButton(); } catch (e6) { }
    try { updateSelectedImagePreview(); } catch (e7) { }
    try { updateScoreDisplay(null); } catch (e8) { }
    try { syncUiState(); } catch (e9) { }
    try { updateSyncPortfolioButtonState(); } catch (e10) { }
    try { refreshScoreWeightingDescription(); } catch (e11) { }
    try { updateScriptQualityToggleVisibility(); } catch (e12) { }
    try {
        var settingsDrawerEl = document.getElementById("settingsDrawer");
        var settingsDrawerOverlayEl = document.getElementById("settingsDrawerOverlay");
        if (settingsDrawerEl) settingsDrawerEl.classList.remove("open");
        if (settingsDrawerOverlayEl) settingsDrawerOverlayEl.classList.remove("open");
    } catch (e13) { }
    try { switchTab("tool"); } catch (e14) { }

    if (typeof wftSuppressDirtyMarks !== "undefined") {
        wftSuppressDirtyMarks = previousSuppress;
    }
}



function handleGoogleSignOut() {
    function finishSignOut() {
        // Revoke the access token with Google
        if (driveAccessToken) {
            if (isWftGisLibraryReady() && window.google.accounts.oauth2 && typeof window.google.accounts.oauth2.revoke === "function") {
                try {
                    window.google.accounts.oauth2.revoke(driveAccessToken, function () {});
                } catch (revokeErr) {
                    fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(driveAccessToken), {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" }
                    }).catch(function() {});
                }
            } else {
                fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(driveAccessToken), {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }
                }).catch(function() {});
            }
        }
        clearPersistedGoogleState();
        clearWftTokenSession();
        clearWftLocalStorageAfterSignOut();
        stopDriveAutoSync();
        stopWftSyncPolling();
        showSignedOutState();
        setDriveSyncStatus("", "Signed out - local data kept on this device");
        try { updateSyncPortfolioButtonState(); } catch (e) { }
    }

    if (driveAccessToken && WFT_SYNC_ENGINE_V2 && !WFT_SYNC_ENGINE_V2_SAFE_MODE && !(typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) && hasWftDirtyChanges()) {
        setDriveSyncStatus('syncing', 'Saving changes before sign out...');
        syncPendingPortfolioMedia(function() {
            flushWftCloudSyncNow("signout").then(function() {
                finishSignOut();
            }).catch(function(e) {
                wftSyncErrorLog("Sign-out sync failed", e);
                setDriveSyncStatus("error", "Local changes may not be saved to Drive. Sign in again to retry.");
                finishSignOut();
            });
        });
        return;
    }

    if (driveAccessToken && !WFT_SYNC_ENGINE_V2) {
        setDriveSyncStatus('syncing', 'Syncing before sign out...');
        syncAllToDrive(function() {
            finishSignOut();
        });
        return;
    }

    finishSignOut();
}

var wftDriveSyncProgressHideTimer = null;

function clampWftSyncProgress(progress) {
    var numeric = Number(progress);
    if (!isFinite(numeric)) return null;
    if (numeric < 0) return 0;
    if (numeric > 100) return 100;
    return numeric;
}

function getCompactDriveSyncText(state, text) {
    var raw = String(text || "");
    var lower = raw.toLowerCase();

    if (state === "syncing") return "Syncing...";
    if (state === "synced" || state === "success") return "Synced";
    if (state === "paused") return "Paused";
    if (state === "error") {
        if (lower.indexOf("offline") !== -1) return "Offline";
        if (lower.indexOf("expired") !== -1 || lower.indexOf("reconnect") !== -1 || lower.indexOf("disconnected") !== -1) return "Reconnect";
        return "Sync issue";
    }

    return raw || "Not synced";
}

function shouldShowDriveSyncPanel(state, progress, detail) {
    if (state === "syncing") return true;
    if (state === "synced" && progress !== null) return true;
    if (state === "error" && (detail || progress !== null)) return true;
    if (state === "paused" && detail) return true;
    return false;
}

function updateWftSyncProgressDisplay(wrapId, barId, detailId, state, progress, detail) {
    var wrap = document.getElementById(wrapId);
    var bar = document.getElementById(barId);
    var detailEl = document.getElementById(detailId);
    var pct = clampWftSyncProgress(progress);
    var shouldShowProgress = state === "syncing" || pct !== null;

    if (wrap) {
        if (shouldShowProgress && pct !== null && state !== "error" && state !== "paused" && state !== "") {
            wrap.classList.add("is-visible");
            wrap.setAttribute("aria-hidden", "false");
            wrap.setAttribute("aria-valuenow", String(Math.round(pct)));
        } else {
            wrap.classList.remove("is-visible");
            wrap.setAttribute("aria-hidden", "true");
            wrap.setAttribute("aria-valuenow", "0");
        }
    }

    if (bar) {
        bar.style.width = (pct === null ? 0 : pct) + "%";
    }

    if (detailEl) {
        detailEl.textContent = detail || "";
        if (detail) {
            detailEl.classList.add("is-visible");
        } else {
            detailEl.classList.remove("is-visible");
        }
    }
}

function updateDriveSyncPanel(state, text, progress, detail) {
    var panel = document.getElementById("driveSyncPanel");
    var title = document.getElementById("driveSyncPanelTitle");
    var dot = document.getElementById("driveSyncDotPanel");
    var pct = clampWftSyncProgress(progress);
    var safeText = text || getCompactDriveSyncText(state, text);
    var shouldShow = shouldShowDriveSyncPanel(state, pct, detail);

    if (title) title.textContent = safeText;
    if (dot) dot.className = "drive-sync-dot" + (state ? " " + state : "");
    updateWftSyncProgressDisplay("driveSyncProgressWrapPanel", "driveSyncProgressBarPanel", "driveSyncDetailPanel", state, progress, detail || "");

    if (panel) {
        if (shouldShow) {
            panel.classList.add("is-visible");
            panel.setAttribute("aria-hidden", "false");
        } else {
            panel.classList.remove("is-visible");
            panel.setAttribute("aria-hidden", "true");
        }
    }
}

function hideDriveSyncProgressBars() {
    updateWftSyncProgressDisplay("driveSyncProgressWrap", "driveSyncProgressBar", "driveSyncDetail", "", null, "");
    updateWftSyncProgressDisplay("driveSyncProgressWrapPanel", "driveSyncProgressBarPanel", "driveSyncDetailPanel", "", null, "");
    updateDriveSyncPanel("", "", null, "");
}

function setDriveSyncStatus(state, text, progress, detail) {
    wftSyncLog("[WFT Sync] status", state || "", text || "", getWftSyncDebugSnapshot());
    if (wftDriveSyncProgressHideTimer) {
        clearTimeout(wftDriveSyncProgressHideTimer);
        wftDriveSyncProgressHideTimer = null;
    }

    var dot = document.getElementById("driveSyncDot");
    var txt = document.getElementById("driveSyncText");
    var dotHeader = document.getElementById("driveSyncDotHeader");
    var txtHeader = document.getElementById("driveSyncTextHeader");
    var dotClass = "drive-sync-dot" + (state ? " " + state : "");
    var compactText = getCompactDriveSyncText(state, text);

    if (state === "synced" && text !== "Ready") {
        recordWftDriveSyncSuccess(text || "drive-sync");
    }
    if (dot) { dot.className = dotClass; }
    if (dotHeader) { dotHeader.className = dotClass; }
    if (txt) txt.textContent = text || "";
    if (txtHeader) txtHeader.textContent = compactText;
    if (txtHeader) txtHeader.title = text || compactText;

    updateWftSyncProgressDisplay("driveSyncProgressWrap", "driveSyncProgressBar", "driveSyncDetail", state, progress, detail);
    updateDriveSyncPanel(state, text, progress, detail || "");
}

function setDriveSyncProgress(text, progress, detail) {
    setDriveSyncStatus("syncing", text, progress, detail || "");
}

function finishDriveSyncProgress(text, detail) {
    setDriveSyncStatus("synced", text || "Synced", 100, detail || "");
    wftDriveSyncProgressHideTimer = setTimeout(function () {
        wftDriveSyncProgressHideTimer = null;
        hideDriveSyncProgressBars();
    }, 450);
}


function getWftSyncProgressDetail(reason) {
    reason = String(reason || "");

    if (reason === "initial-load" || reason === "startup" || reason === "page-load") {
        return "Checking Drive data from your previous session.";
    }

    if (reason === "sign-in") {
        return "First sync may take a moment while saved records are checked.";
    }

    if (reason === "explicit-sync-to-portfolio") {
        return "Saving the current writing record to Drive.";
    }

    if (reason === "manual") {
        return "Running a manual Drive sync.";
    }

    if (reason === "queued-after-current") {
        return "Finishing a queued sync after recent changes.";
    }

    if (reason === "online") {
        return "Back online. Checking Drive for saved changes.";
    }

    return "Local data remains saved on this device.";
}


function showDriveSyncPausedForSafety() {
    setDriveSyncStatus("paused", "Drive sync paused", null, "Local changes are still saved on this device.");
}

function isDriveSyncAllowed() {
    if (!WFT_SYNC_ENGINE_V2) return false;
    if (WFT_SYNC_ENGINE_V2_SAFE_MODE) return false;
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) return false;

    // Compatible with both the V2 sync state and the legacy Drive token.
    // Do not require the legacy signedIn/driveAccessToken globals when V2 already has auth.
    var hasV2Auth = (typeof wftSyncState !== "undefined" && wftSyncState && (wftSyncState.signedIn || wftSyncState.accessToken));
    var hasLegacyAuth = (typeof driveAccessToken !== "undefined" && !!driveAccessToken);
    return !!(hasV2Auth || hasLegacyAuth) && isWftTokenValid();
}

function portfolioHasPendingDriveMedia(portfolio) {
    var data = normalizePortfolioShape(portfolio || {});
    var studentNames = Object.keys(data || {});
    for (var i = 0; i < studentNames.length; i += 1) {
        var student = data[studentNames[i]] || {};
        var sessions = Array.isArray(student.sessions) ? student.sessions : [];
        for (var j = 0; j < sessions.length; j += 1) {
            var images = Array.isArray(sessions[j].images) ? sessions[j].images : [];
            for (var k = 0; k < images.length; k += 1) {
                if (images[k] && images[k].pendingDriveUpload) return true;
            }
        }
    }
    return false;
}

function hasWftDirtyChanges() {
    if (typeof wftSyncState !== "undefined" && wftSyncState) {
        if (wftSyncState.pendingSettingsPush || wftSyncState.pendingPortfolioPush || wftSyncState.pendingDeletionsPush) return true;
    }
    try {
        if (typeof isWftPortfolioIndexDirty === "function" && isWftPortfolioIndexDirty()) return true;
    } catch (e) { }
    try {
        if (typeof getPendingPortfolioSync === "function" && getPendingPortfolioSync()) return true;
    } catch (e2) { }
    try {
        if (portfolioHasPendingDriveMedia(getPortfolioData())) return true;
    } catch (e3) { }
    return false;
}

// ── WFT Sync Engine V2 guarded Drive fetch ──
function parseWftGoogleApiErrorText(text) {
    var parsed = null;
    var error = {
        status: 0,
        message: text || "Google Drive error",
        reason: "",
        raw: text || ""
    };

    try {
        parsed = JSON.parse(text);
        if (parsed && parsed.error) {
            error.status = Number(parsed.error.code || 0);
            error.message = parsed.error.message || error.message;

            if (parsed.error.errors && parsed.error.errors.length) {
                error.reason = parsed.error.errors[0].reason || "";
            } else if (parsed.error.status) {
                error.reason = parsed.error.status;
            }
        }
    } catch (e) { }

    return error;
}

function wftDriveFetch(url, options) {
    options = options || {};
    wftSyncLog("[WFT Sync] Drive fetch start", (options.method || "GET"), url);

    if (url.indexOf("https://www.googleapis.com/") !== 0 &&
        url.indexOf("https://www.googleapis.com/upload/") !== 0) {
        return Promise.reject(new Error("Blocked non-Google API URL"));
    }

    if (!navigator.onLine) {
        setDriveSyncStatus("error", "Offline - will sync later", null, "Local changes are saved on this device.");
        return Promise.reject(new Error("OFFLINE"));
    }

    if (!isWftTokenValid()) {
        wftSyncState.authBlocked = true;
        clearWftTokenSession();
        setDriveSyncStatus("error", "Session expired - please sign in again.", null, "Local data is still available.");
        return Promise.reject(new Error("TOKEN_EXPIRED"));
    }

    options.headers = options.headers || {};
    options.headers.Authorization = "Bearer " + wftSyncState.accessToken;

    return fetch(url, options).then(function (response) {
        wftSyncLog("[WFT Sync] Drive fetch response", response.status, (options.method || "GET"), url);
        if (response.ok) return response;

        return response.text().then(function (text) {
            var parsed = parseWftGoogleApiErrorText(text);
            wftSyncErrorLog("[WFT Sync] Drive fetch error body", response.status, parsed);
            var err = new Error(parsed.message || "Google Drive error");
            err.status = response.status;
            err.reason = parsed.reason;
            err.raw = parsed.raw;

            if (response.status === 401) {
                wftSyncState.authBlocked = true;
                clearWftTokenSession();
                setDriveSyncStatus("error", "Session expired - please sign in again.", null, "Local data is still available.");
            } else if (response.status === 404) {
                err.notFound = true;
                setDriveSyncStatus("error", "Drive file not found - will recreate on next sync.");
            } else if (response.status === 403 && /quota|rate/i.test(parsed.reason + " " + parsed.message)) {
                wftSyncState.quotaBlocked = true;
                setDriveSyncStatus("error", "Drive quota or rate limit reached.");
            } else if (response.status === 403) {
                wftSyncState.permissionBlocked = true;
                setDriveSyncStatus("error", "Drive permission issue - please reconnect.", null, "Local data is still available.");
            } else {
                setDriveSyncStatus("error", "Drive sync needs attention.", null, "Local data is still saved. Try syncing again.");
            }

            throw err;
        });
    });
}

function clearWftSyncBlockState() {
    wftSyncState.quotaBlocked = false;
    wftSyncState.permissionBlocked = false;
    wftSyncState.authBlocked = false;
    wftSyncState.lastError = null;
}

/* --- Drive Folder Management --- */

function getCachedWftDriveFolderId() {
    try {
        return localStorage.getItem(WFT_DRIVE_FOLDER_ID_CACHE_KEY) || "";
    } catch (e) {
        return "";
    }
}

function setCachedWftDriveFolderId(folderId) {
    if (!folderId) return;
    driveFolderId = folderId;
    wftSyncState.folderId = folderId;
    try {
        localStorage.setItem(WFT_DRIVE_FOLDER_ID_CACHE_KEY, folderId);
    } catch (e) { }
    syncLegacyGoogleGlobalsFromState();
}

function getWftDriveFileCacheKey(filename) {
    if (filename === WFT_SETTINGS_FILENAME) return WFT_SETTINGS_FILE_ID_CACHE_KEY;
    if (filename === WFT_PORTFOLIO_FILENAME) return WFT_PORTFOLIO_FILE_ID_CACHE_KEY;
    if (filename === WFT_DELETIONS_FILENAME) return WFT_DELETIONS_FILE_ID_CACHE_KEY;
    if (filename === "portfolio-index.json") return WFT_PORTFOLIO_INDEX_FILE_ID_CACHE_KEY;
    return "";
}

function getCachedWftDriveFileId(filename) {
    var key = getWftDriveFileCacheKey(filename);
    if (!key) return "";
    try {
        return localStorage.getItem(key) || "";
    } catch (e) {
        return "";
    }
}

function setCachedWftDriveFileId(filename, fileId) {
    var key = getWftDriveFileCacheKey(filename);
    if (!fileId || !key) return;
    if (filename === WFT_SETTINGS_FILENAME) {
        wftSyncState.settingsFileId = fileId;
    } else if (filename === WFT_PORTFOLIO_FILENAME) {
        wftSyncState.portfolioFileId = fileId;
    } else if (filename === WFT_DELETIONS_FILENAME) {
        wftSyncState.deletionsFileId = fileId;
    }
    try {
        localStorage.setItem(key, fileId);
    } catch (e) { }
}

function clearCachedWftDriveFileId(filename) {
    var key = getWftDriveFileCacheKey(filename);
    if (filename === WFT_SETTINGS_FILENAME) {
        wftSyncState.settingsFileId = null;
    } else if (filename === WFT_PORTFOLIO_FILENAME) {
        wftSyncState.portfolioFileId = null;
    } else if (filename === WFT_DELETIONS_FILENAME) {
        wftSyncState.deletionsFileId = null;
    }
    if (!key) return;
    try {
        localStorage.removeItem(key);
    } catch (e) { }
}

function validateCachedDriveFolderPromise(folderId) {
    if (!folderId) return Promise.resolve(false);

    var url = "https://www.googleapis.com/drive/v3/files/"
        + encodeURIComponent(folderId)
        + "?fields=id,name,mimeType,trashed";

    if (!isWftTokenValid()) return Promise.resolve(false);

    wftSyncLog("[WFT Sync][FOLDER] cached folder validation start", folderId);
    return fetch(url, {
        headers: { Authorization: "Bearer " + wftSyncState.accessToken }
    }).then(function (response) {
        wftSyncLog("[WFT Sync][FOLDER] cached folder validation response", response.status, folderId);
        if (!response.ok) return false;
        return response.json();
    }).then(function (folder) {
        var valid = !!(folder &&
            folder.id === folderId &&
            folder.name === DRIVE_FOLDER_NAME &&
            folder.mimeType === "application/vnd.google-apps.folder" &&
            folder.trashed === false);

        wftSyncLog("[WFT Sync][FOLDER] cached folder validation", { folderId: folderId, valid: valid });
        return valid;
    }).catch(function (e) {
        wftSyncWarn("[WFT Sync][FOLDER] cached folder validation failed", { folderId: folderId, error: e });
        return false;
    });
}

function getWftFolderSyncFileSummary(folderId) {
    var query = "'" + escapeDriveQueryValue(folderId) + "' in parents"
        + " and trashed=false"
        + " and (name='" + escapeDriveQueryValue(WFT_SETTINGS_FILENAME) + "'"
        + " or name='" + escapeDriveQueryValue(WFT_PORTFOLIO_FILENAME) + "'"
        + " or name='" + escapeDriveQueryValue(WFT_DELETIONS_FILENAME) + "')";
    var url = "https://www.googleapis.com/drive/v3/files"
        + "?q=" + encodeURIComponent(query)
        + "&fields=files(id,name,modifiedTime,createdTime,size,mimeType)"
        + "&orderBy=modifiedTime desc";

    return wftDriveFetch(url).then(function (response) {
        return response.json();
    }).then(function (data) {
        var files = data && data.files ? data.files : [];
        var summary = {
            folderId: folderId,
            hasSettings: false,
            hasPortfolio: false,
            hasDeletions: false,
            newestTime: "",
            settingsFileId: "",
            portfolioFileId: "",
            deletionsFileId: "",
            fileCount: files.length
        };
        var i;
        var file;
        var time;

        for (i = 0; i < files.length; i += 1) {
            file = files[i];
            time = file.modifiedTime || file.createdTime || "";
            if (!summary.newestTime || time > summary.newestTime) {
                summary.newestTime = time;
            }
            if (file.name === WFT_SETTINGS_FILENAME && !summary.settingsFileId) {
                summary.hasSettings = true;
                summary.settingsFileId = file.id;
            }
            if (file.name === WFT_PORTFOLIO_FILENAME && !summary.portfolioFileId) {
                summary.hasPortfolio = true;
                summary.portfolioFileId = file.id;
            }
            if (file.name === WFT_DELETIONS_FILENAME && !summary.deletionsFileId) {
                summary.hasDeletions = true;
                summary.deletionsFileId = file.id;
            }
        }

        return summary;
    }).catch(function (e) {
        wftSyncWarn("[WFT Sync][FOLDER] sync file summary failed", { folderId: folderId, error: e });
        return { folderId: folderId, hasSettings: false, hasPortfolio: false, hasDeletions: false, newestTime: "", settingsFileId: "", portfolioFileId: "", deletionsFileId: "", fileCount: 0 };
    });
}

function chooseCanonicalDriveFolderPromise(folders) {
    if (!folders || !folders.length) return Promise.resolve(null);
    if (folders.length === 1) return Promise.resolve(folders[0]);

    wftSyncWarn("[WFT Sync][FOLDER] duplicate WritingFeedbackTool folders detected", { count: folders.length, folders: folders });

    var chain = Promise.resolve([]);
    folders.forEach(function (folder) {
        chain = chain.then(function (summaries) {
            return getWftFolderSyncFileSummary(folder.id).then(function (summary) {
                summary.folder = folder;
                summaries.push(summary);
                return summaries;
            });
        });
    });

    return chain.then(function (summaries) {
        var best = null;
        var i;
        var score;
        var bestScore = -1;

        for (i = 0; i < summaries.length; i += 1) {
            score = 0;
            if (summaries[i].hasSettings) score += 10;
            if (summaries[i].hasPortfolio) score += 10;
            if (summaries[i].hasDeletions) score += 5;
            if (summaries[i].newestTime) score += 1;

            if (!best || score > bestScore || (score === bestScore && String(summaries[i].newestTime || summaries[i].folder.modifiedTime || "") > String(best.newestTime || best.folder.modifiedTime || ""))) {
                best = summaries[i];
                bestScore = score;
            }
        }

        if (!best) return folders[0];

        if (best.settingsFileId) setCachedWftDriveFileId(WFT_SETTINGS_FILENAME, best.settingsFileId);
        if (best.portfolioFileId) setCachedWftDriveFileId(WFT_PORTFOLIO_FILENAME, best.portfolioFileId);
        if (best.deletionsFileId) setCachedWftDriveFileId(WFT_DELETIONS_FILENAME, best.deletionsFileId);

        wftSyncWarn("[WFT Sync][FOLDER] selected canonical folder", {
            selectedFolderId: best.folderId,
            duplicateCount: folders.length,
            reason: best.hasSettings && best.hasPortfolio ? "contains both sync files" : (best.hasSettings || best.hasPortfolio ? "contains one sync file" : "newest folder fallback"),
            hasSettings: best.hasSettings,
            hasPortfolio: best.hasPortfolio,
            hasDeletions: best.hasDeletions
        });

        return best.folder;
    });
}

function ensureDriveFolder(callback) {
    ensureDriveFolderPromise()
        .then(function (folderId) {
            callback(folderId);
        })
        .catch(function (e) {
            wftSyncErrorLog("[WFT Sync][FOLDER] legacy folder resolver failed", e);
            wftDebugError("Drive folder error:", e);
            setDriveSyncStatus("error", "Sync error");
        });
}

function saveFileToDrive(filename, content, mimeType, callback) {
    if (!driveAccessToken) return;
    setDriveSyncStatus("syncing", "Syncing...");
    ensureDriveFolder(function(folderId) {
        findWftFilesByNamePromise(filename).then(function(data) {
            var existing = data && data.length > 0 ? data[0].id : null;
            var url, method, body;
            if (existing) {
                url = "https://www.googleapis.com/upload/drive/v3/files/" + existing + "?uploadType=multipart&fields=id,name,modifiedTime";
                method = "PATCH";
            } else {
                url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime";
                method = "POST";
            }
            var boundary = "----WFTBoundary" + Date.now();
            var meta = existing ? "{}" : JSON.stringify({ name: filename, parents: [folderId] });
            body = "--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" + meta + "\r\n--" + boundary + "\r\nContent-Type: " + mimeType + "\r\n\r\n" + content + "\r\n--" + boundary + "--";
            return wftDriveFetch(url, {
                method: method,
                headers: { "Content-Type": "multipart/related; boundary=" + boundary },
                body: body
            }).then(function (r) {
                return r.json();
            }).then(function (fileData) {
                if (fileData && fileData.id) {
                    setCachedWftDriveFileId(filename, fileData.id);
                } else if (existing) {
                    setCachedWftDriveFileId(filename, existing);
                }
                return fileData;
            });
        }).then(function(fileData) {
            var now = new Date();
            var fileId = fileData && fileData.id ? fileData.id : getCachedWftDriveFileId(filename);
            setDriveSyncStatus("synced", "Synced " + now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));
            if (callback) callback(null, fileId, fileData || null);
        }).catch(function(e) {
            wftDebugError("Drive save error:", e);
            if (e && e.status === 404) {
                clearCachedWftDriveFileId(filename);
                setDriveSyncStatus("error", "Drive file not found - retrying will recreate it.");
            } else {
                setDriveSyncStatus("error", "Sync failed");
            }
            if (callback) callback(e, null, null);
        });
    });
}

// ── WFT Sync Engine V2 Promise wrappers ──
function ensureDriveFolderPromise() {
    syncStateFromLegacyGoogleGlobals();
    wftSyncLog("[WFT Sync][FOLDER] ensureDriveFolderPromise start", { memoryFolderId: driveFolderId || "", cachedFolderId: getCachedWftDriveFolderId() || "", runId: wftSyncState.syncRunId || 0 });

    if (wftSyncState.isSyncing &&
        wftSyncState.folderResolutionPromise &&
        wftSyncState.folderResolutionRunId === wftSyncState.syncRunId) {
        wftSyncLog("[WFT Sync][FOLDER] reusing run folder resolution", { runId: wftSyncState.syncRunId, folderId: wftSyncState.folderId || driveFolderId || "" });
        return wftSyncState.folderResolutionPromise;
    }

    var memoryFolderId = driveFolderId || wftSyncState.folderId || "";
    var cachedFolderId = memoryFolderId || getCachedWftDriveFolderId();

    var resolutionPromise = validateCachedDriveFolderPromise(cachedFolderId).then(function (valid) {
        if (valid) {
            setCachedWftDriveFolderId(cachedFolderId);
            return cachedFolderId;
        }

        var query = "name='" + escapeDriveQueryValue(DRIVE_FOLDER_NAME) + "'"
            + " and mimeType='application/vnd.google-apps.folder'"
            + " and trashed=false";
        var searchUrl = "https://www.googleapis.com/drive/v3/files"
            + "?q=" + encodeURIComponent(query)
            + "&fields=files(id,name,modifiedTime)"
            + "&orderBy=modifiedTime desc";

        return wftDriveFetch(searchUrl).then(function(response) {
            return response.json();
        }).then(function(data) {
            var files = data && data.files ? data.files : [];
            wftSyncLog("[WFT Sync][FOLDER] folder search result", files.length, files);

            return chooseCanonicalDriveFolderPromise(files).then(function (selected) {
                if (selected && selected.id) {
                    setCachedWftDriveFolderId(selected.id);
                    return selected.id;
                }

                return wftDriveFetch("https://www.googleapis.com/drive/v3/files", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: DRIVE_FOLDER_NAME,
                        mimeType: "application/vnd.google-apps.folder"
                    })
                }).then(function(createResponse) {
                    return createResponse.json();
                }).then(function(folder) {
                    if (!folder || !folder.id) {
                        throw new Error("NO_DRIVE_FOLDER");
                    }
                    wftSyncLog("[WFT Sync][FOLDER] created Drive folder", folder);
                    setCachedWftDriveFolderId(folder.id);
                    return folder.id;
                });
            });
        });
    }).then(function (folderId) {
        if (folderId) {
            setCachedWftDriveFolderId(folderId);
        }
        return folderId;
    }).catch(function (e) {
        if (wftSyncState.folderResolutionPromise === resolutionPromise) {
            wftSyncState.folderResolutionPromise = null;
            wftSyncState.folderResolutionRunId = 0;
        }
        throw e;
    });

    if (wftSyncState.isSyncing) {
        wftSyncState.folderResolutionRunId = wftSyncState.syncRunId;
        wftSyncState.folderResolutionPromise = resolutionPromise;
    }

    return resolutionPromise;
}

function saveFileToDriveOncePromise(filename, content, mimeType) {
    return new Promise(function (resolve, reject) {
        var settled = false;

        var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error("SAVE_FILE_TIMEOUT:" + filename));
        }, WFT_SAVE_FILE_TIMEOUT_MS);

        try {
            saveFileToDrive(filename, content, mimeType, function (err, fileId) {
                if (settled) return;
                if (err) {
                    settled = true;
                    clearTimeout(timer);
                    reject(err);
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(fileId || null);
            });
        } catch (e) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(e);
        }
    });
}

function isTransientWftDriveError(err) {
    if (!err) return false;
    var status = Number(err.status || 0);
    if (status === 0 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
    var msg = String(err.message || "");
    return /network|timeout|failed to fetch|SAVE_FILE_TIMEOUT/i.test(msg);
}

function saveFileToDrivePromise(filename, content, mimeType) {
    var maxAttempts = 3;
    function attempt(n) {
        return saveFileToDriveOncePromise(filename, content, mimeType).catch(function (err) {
            var retryNotFound = false;
            if (err && err.status === 404) {
                clearCachedWftDriveFileId(filename);
                retryNotFound = true;
            }
            if (n >= maxAttempts || (!retryNotFound && !isTransientWftDriveError(err))) {
                throw err;
            }
            var delay = retryNotFound ? 250 : (500 * Math.pow(2, n - 1));
            wftSyncWarn("[WFT Sync][FILE] Drive save error; retrying", { filename: filename, attempt: n + 1, error: err && (err.message || err.status) });
            return new Promise(function (resolve) {
                setTimeout(resolve, delay);
            }).then(function () {
                return attempt(n + 1);
            });
        });
    }
    return attempt(1);
}

// ── WFT Sync Engine V2 fingerprints ──
function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return "[" + value.map(function (item) {
            return stableStringify(item);
        }).join(",") + "]";
    }

    var keys = Object.keys(value).sort();

    return "{" + keys.map(function (key) {
        return JSON.stringify(key) + ":" + stableStringify(value[key]);
    }).join(",") + "}";
}

function getWftHash(value) {
    var json = "";
    var hash = 0;
    var i;
    var chr;

    try {
        json = typeof value === "string" ? value : stableStringify(value || {});
    } catch (e) {
        json = String(Date.now());
    }

    for (i = 0; i < json.length; i += 1) {
        chr = json.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash = hash | 0;
    }

    return String(hash);
}

function cloneWftJson(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        return value;
    }
}

function normalizeSettingsForFingerprint(settings) {
    var copy = cloneWftJson(settings || {});

    delete copy.lastSyncedAt;
    delete copy.lastSyncStatus;
    delete copy.syncMeta;
    delete copy.uiState;
    delete copy.updatedAt;
    delete copy.apiKey;

    return copy;
}

function normalizePortfolioForFingerprint(portfolio) {
    var copy = cloneWftJson(portfolio || {});

    delete copy.lastSyncedAt;
    delete copy.lastSyncStatus;
    delete copy.syncMeta;
    delete copy.uiState;
    delete copy.updatedAt;
    delete copy.__syncMeta;

    return copy;
}

function getSettingsFingerprint(settings) {
    return getWftHash(normalizeSettingsForFingerprint(settings || {}));
}

function getPortfolioFingerprint(portfolio) {
    return getWftHash(normalizePortfolioForFingerprint(portfolio || {}));
}

function normalizeDeletionsForFingerprint(deletions) {
    var copy = cloneWftJson(deletions || {});
    delete copy.updatedAt;
    delete copy.lastSyncedAt;
    delete copy.lastSyncStatus;
    delete copy.syncMeta;
    return copy;
}

function getDeletionsFingerprint(deletions) {
    return getWftHash(normalizeDeletionsForFingerprint(normalizeDeletionsData(deletions || {})));
}

// ── WFT Sync Engine V2 local snapshot helpers ──
function getLocalSettingsSnapshot() {
    var settings = {};
    try {
        var raw = localStorage.getItem("wft_settings");
        settings = raw ? JSON.parse(raw) : {};
    } catch (e) {
        settings = {};
    }

    try {
        var modelSelect = document.getElementById('modelSelect');
        var targetWordCountEl = document.getElementById('targetWordCount');
        var useWordCountTargetEl = document.getElementById('useWordCountTarget');
        var assessScriptQualityEl = document.getElementById('assessScriptQuality');

        if (modelSelect) settings.model = modelSelect.value || '';
        if (targetWordCountEl) settings.targetWordCount = targetWordCountEl.value || '200';
        if (useWordCountTargetEl) settings.useWordCountTarget = useWordCountTargetEl.checked;
        if (typeof getClassDefaultGrammarStrictness === 'function') settings.grammarStrictness = getClassDefaultGrammarStrictness();
        else if (typeof getGrammarStrictness === 'function') settings.grammarStrictness = getGrammarStrictness();
        if (assessScriptQualityEl) settings.assessScriptQuality = assessScriptQualityEl.checked;
        if (typeof getClassGradeLevel === 'function') settings.gradeLevel = getClassGradeLevel();
        else if (typeof getSelectedGradeLevel === 'function') settings.gradeLevel = getSelectedGradeLevel();
        if (typeof getClassGradeLevel === 'function') settings.classGradeLevel = getClassGradeLevel();
        if (typeof GRADE_PROFILE_VERSION !== 'undefined') settings.classDefaultsProfileVersion = GRADE_PROFILE_VERSION;
        if (typeof getClassGradeLevel === 'function') settings.classDefaultsGradeLevel = getClassGradeLevel();
        settings.studentGradeLevelOverride = false;
        if (typeof students !== "undefined" && Array.isArray(students)) {
            settings.students = applyDeletionsToStudents(students, getDeletionsData());
        }
    } catch (e2) {
        if (!settings.students && typeof students !== "undefined" && Array.isArray(students)) {
            settings.students = applyDeletionsToStudents(students, getDeletionsData());
        }
    }

    return settings;
}

function normalizePortfolioShape(portfolio) {
    if (!portfolio || typeof portfolio !== "object") {
        portfolio = {};
    }
    return normalizePortfolioData(portfolio);
}

function getLocalPortfolioSnapshot() {
    var raw;
    var portfolio;

    try {
        raw = localStorage.getItem("wft_portfolio");
        portfolio = raw ? JSON.parse(raw) : null;
    } catch (e) {
        portfolio = null;
    }

    return normalizePortfolioShape(portfolio);
}

// ── WFT Sync Engine V2 true-delete helpers ──
function getEmptyDeletionsData() {
    return {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        deletedStudents: {},
        deletedSessions: {},
        records: []
    };
}

function normalizeDeletionsData(data) {
    var clean = getEmptyDeletionsData();

    if (data && typeof data === "object") {
        clean.schemaVersion = data.schemaVersion || 1;
        clean.updatedAt = data.updatedAt || clean.updatedAt;
        clean.deletedStudents = data.deletedStudents && typeof data.deletedStudents === "object" ? data.deletedStudents : {};
        clean.deletedSessions = data.deletedSessions && typeof data.deletedSessions === "object" ? data.deletedSessions : {};
        clean.records = Array.isArray(data.records) ? data.records.slice(0) : [];
    }

    return clean;
}

function getDeletionsData() {
    try {
        var raw = localStorage.getItem(WFT_DELETIONS_STORAGE_KEY);
        if (!raw) return getEmptyDeletionsData();
        return normalizeDeletionsData(JSON.parse(raw));
    } catch (e) {
        wftDebugWarn("[WFT Deletions] Could not parse deletions data:", e);
        return getEmptyDeletionsData();
    }
}

function saveDeletionsData(data) {
    var clean = normalizeDeletionsData(data);
    clean.updatedAt = new Date().toISOString();

    try {
        localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
        wftDebugWarn("[WFT Deletions] Could not save deletions data:", e);
    }

    if (WFT_SYNC_ENGINE_V2 && !wftSuppressDirtyMarks) {
        markWftDeletionsDirty("deletions-change");
        scheduleWftCloudSync("deletions-change");
    }

    return clean;
}

function getDeletedStudentKey(studentName) {
    return "student:" + String(studentName || "").trim().toLowerCase();
}

function getDeletedSessionKey(studentName, sessionId) {
    return "session:" + String(studentName || "").trim().toLowerCase() + ":" + String(sessionId || "").trim();
}

function recordStudentDeletion(studentName) {
    var name = String(studentName || "").trim();
    if (!name) return;

    var deletions = getDeletionsData();
    deletions.deletedStudents[getDeletedStudentKey(name)] = {
        studentName: name,
        deletedAt: new Date().toISOString(),
        reason: "teacher_delete"
    };
    saveDeletionsData(deletions);
}

function clearStudentDeletion(studentName) {
    var name = String(studentName || "").trim();
    if (!name) return;

    var deletions = getDeletionsData();
    var key = getDeletedStudentKey(name);
    if (deletions.deletedStudents[key]) {
        delete deletions.deletedStudents[key];
        saveDeletionsData(deletions);
    }
}

function getWftStudentIdForDeletion(studentName) {
    var name = String(studentName || "").trim();
    var studentId = "";
    if (!name) return "";

    try {
        var settings = getRawSettings ? getRawSettings() : {};
        studentId = settings.studentIdMap && settings.studentIdMap[name] ? settings.studentIdMap[name] : "";
    } catch (e) {}

    return studentId;
}

function addSessionDeletionRecord(deletions, studentName, sessionId, deletedAt, studentId) {
    var name = String(studentName || "").trim();
    var id = String(sessionId || "").trim();
    var record;

    if (!name || !id || !deletions) return null;

    if (!deletions.deletedSessions || typeof deletions.deletedSessions !== "object") {
        deletions.deletedSessions = {};
    }
    if (!Array.isArray(deletions.records)) { deletions.records = []; }

    record = {
        id: createWftId("del"),
        type: "session",
        studentId: studentId || "",
        studentName: name,
        sessionId: id,
        deletedAt: deletedAt || new Date().toISOString(),
        deviceId: getWftDeviceId(),
        reason: "teacher_delete"
    };

    deletions.deletedSessions[getDeletedSessionKey(name, id)] = cloneWftJson(record);
    if (studentId) {
        deletions.deletedSessions["session:" + studentId + ":" + id] = cloneWftJson(record);
    }
    deletions.records.push(record);
    return record;
}

function recordSessionDeletion(studentName, sessionId) {
    var name = String(studentName || "").trim();
    var id = String(sessionId || "").trim();
    if (!name || !id) return;

    var deletions = getDeletionsData();
    addSessionDeletionRecord(deletions, name, id, new Date().toISOString(), getWftStudentIdForDeletion(name));
    saveDeletionsData(deletions);
}

function recordPortfolioSessionDeletion(studentName, sessionId, session) {
    var name = String(studentName || "").trim();
    var ids = [];
    var seen = {};
    var deletions;
    var now;
    var studentId;

    function addId(value) {
        var id = String(value || "").trim();
        if (!id || seen[id]) return;
        seen[id] = true;
        ids.push(id);
    }

    if (!name) return;

    addId(sessionId);
    if (session) {
        addId(session.id);
        addId(session.createdAt);
    }

    if (!ids.length) return;

    deletions = getDeletionsData();
    now = new Date().toISOString();
    studentId = getWftStudentIdForDeletion(name);

    for (var i = 0; i < ids.length; i += 1) {
        addSessionDeletionRecord(deletions, name, ids[i], now, studentId);
    }

    saveDeletionsData(deletions);
}

function applyDeletionsToStudents(studentList, deletions) {
    var cleanDeletions = normalizeDeletionsData(deletions || {});
    var source = Array.isArray(studentList) ? studentList : [];
    var result = [];
    var i;
    var name;

    for (i = 0; i < source.length; i += 1) {
        name = getWftStudentName(source[i]);
        if (!name) continue;
        if (cleanDeletions.deletedStudents[getDeletedStudentKey(name)]) continue;
        result.push(source[i]);
    }

    return result;
}

function applyDeletionsToPortfolio(portfolio, deletions) {
    var cleanPortfolio = normalizePortfolioShape(portfolio || {});
    var cleanDeletions = normalizeDeletionsData(deletions || {});
    var result = {};
    var studentName;

    for (studentName in cleanPortfolio) {
        if (!Object.prototype.hasOwnProperty.call(cleanPortfolio, studentName)) continue;

        if (cleanDeletions.deletedStudents[getDeletedStudentKey(studentName)]) {
            continue;
        }

        var studentData = cloneWftJson(cleanPortfolio[studentName]);
        var sessions = Array.isArray(studentData.sessions) ? studentData.sessions : [];
        var filteredSessions = [];
        var i;

        for (i = 0; i < sessions.length; i += 1) {
            var session = sessions[i];
            var sessionId = getSessionKey(session);
            var sessionStudentId = (session && session.studentId) || "";
            var sessionUpdatedAt = session ? getSessionModifiedTimeMs(session) : 0;

            if (!sessionId || !isStudentSessionDeleted(sessionId, sessionStudentId, cleanDeletions, sessionUpdatedAt)) {
                filteredSessions.push(session);
            }
        }

        studentData.sessions = filteredSessions;
        result[studentName] = studentData;
    }

    return rebuildWftPortfolioDerivedStats(result);
}


function isWftReservedPortfolioKey(key) {
    var k = String(key || "");
    return k === "_meta" || k === "updatedAt" || k === "__syncMeta" || k === "syncMeta" || k === "lastSyncedAt" || k === "lastSyncStatus";
}

function getWftRosterNameSet() {
    var source = [];
    var names = [];
    var set = {};
    var i;
    var name;

    try {
        if (typeof students !== "undefined" && Array.isArray(students)) {
            source = students.slice(0);
        }
    } catch (e) { }

    if (!source.length) {
        try {
            source = JSON.parse(localStorage.getItem("wft_students") || "[]");
            if (!Array.isArray(source)) { source = []; }
        } catch (e2) {
            source = [];
        }
    }

    for (i = 0; i < source.length; i += 1) {
        name = getWftStudentName(source[i]);
        if (!name) { continue; }
        names.push(name);
        set[name.toLowerCase()] = true;
    }

    return { names: names, set: set, count: names.length };
}

function getWftPortfolioStudentNames(portfolio) {
    var names = [];
    var key;
    var data = portfolio || {};

    for (key in data) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) { continue; }
        if (isWftReservedPortfolioKey(key)) { continue; }
        names.push(key);
    }

    names.sort(function(a, b) { return String(a).localeCompare(String(b)); });
    return names;
}

function getWftStudentSessionCount(studentData) {
    if (!studentData || !Array.isArray(studentData.sessions)) { return 0; }
    return studentData.sessions.length;
}

function getWftPortfolioCacheSummary() {
    var portfolio = {};
    var roster = getWftRosterNameSet();
    var names;
    var i;
    var name;
    var sessions;
    var summary = {
        rosterStudents: roster.count,
        portfolioStudents: 0,
        portfolioSessions: 0,
        activePortfolioStudents: 0,
        activePortfolioSessions: 0,
        offRosterStudents: 0,
        offRosterSessions: 0,
        offRosterNames: []
    };

    try { portfolio = getPortfolioData(); } catch (e) { portfolio = {}; }
    names = getWftPortfolioStudentNames(portfolio);
    summary.portfolioStudents = names.length;

    for (i = 0; i < names.length; i += 1) {
        name = names[i];
        sessions = getWftStudentSessionCount(portfolio[name]);
        summary.portfolioSessions += sessions;

        if (roster.set[String(name || "").toLowerCase()]) {
            summary.activePortfolioStudents += 1;
            summary.activePortfolioSessions += sessions;
        } else {
            summary.offRosterStudents += 1;
            summary.offRosterSessions += sessions;
            summary.offRosterNames.push(name);
        }
    }

    return summary;
}

function recordWftPortfolioDeletionForStudent(studentName, studentData) {
    var name = String(studentName || "").trim();
    var sessions;
    var sessionId;
    var count = 0;
    var i;

    if (!name) { return 0; }

    recordStudentDeletion(name);
    sessions = studentData && Array.isArray(studentData.sessions) ? studentData.sessions : [];

    for (i = 0; i < sessions.length; i += 1) {
        sessionId = getSessionKey(sessions[i]);
        if (sessionId) {
            recordSessionDeletion(name, sessionId);
            count += 1;
        }
    }

    return count;
}

function purgeWftOffRosterPortfolioData() {
    var roster = getWftRosterNameSet();
    var portfolio;
    var names;
    var removedStudents = 0;
    var removedSessions = 0;
    var i;
    var name;
    var lowerName;

    if (!window.confirm("Remove saved portfolio records for students who are not in the current Manage Class roster? This is intended for students you already deleted.")) {
        return;
    }
    if (!window.confirm("This will remove old off-roster portfolio data from this browser and mark it deleted so Drive sync should not restore it. Continue?")) {
        return;
    }

    try { portfolio = getPortfolioData(); } catch (e) { portfolio = {}; }
    names = getWftPortfolioStudentNames(portfolio);

    for (i = 0; i < names.length; i += 1) {
        name = names[i];
        lowerName = String(name || "").toLowerCase();
        if (roster.set[lowerName]) { continue; }
        removedSessions += recordWftPortfolioDeletionForStudent(name, portfolio[name]);
        delete portfolio[name];
        removedStudents += 1;
    }

    if (!removedStudents) {
        alert("No old off-roster portfolio records were found.");
        try { refreshStorageHealthUI(); } catch (e2) { }
        return;
    }

    savePortfolioData(portfolio);

    try { refreshPortfolioDropdown(); } catch (e3) { }
    try { renderStudentPortfolio(); } catch (e4) { }
    try { refreshStorageHealthUI(); } catch (e5) { }

    if (typeof rebuildPortfolioIndex === "function") {
        rebuildPortfolioIndex(function() {
            try { refreshStorageHealthUI(); } catch (e6) { }
        });
    }

    alert("Removed " + removedStudents + " old student record" + (removedStudents === 1 ? "" : "s") + " and " + removedSessions + " saved session" + (removedSessions === 1 ? "" : "s") + ".");
}

function mergeWftDeletions(localDeletions, cloudDeletions) {
    var localClean = normalizeDeletionsData(localDeletions || {});
    var cloudClean = normalizeDeletionsData(cloudDeletions || {});
    var merged = getEmptyDeletionsData();
    var key;

    for (key in cloudClean.deletedStudents) {
        if (Object.prototype.hasOwnProperty.call(cloudClean.deletedStudents, key)) {
            merged.deletedStudents[key] = cloneWftJson(cloudClean.deletedStudents[key]);
        }
    }
    for (key in localClean.deletedStudents) {
        if (Object.prototype.hasOwnProperty.call(localClean.deletedStudents, key)) {
            merged.deletedStudents[key] = cloneWftJson(localClean.deletedStudents[key]);
        }
    }
    for (key in cloudClean.deletedSessions) {
        if (Object.prototype.hasOwnProperty.call(cloudClean.deletedSessions, key)) {
            merged.deletedSessions[key] = cloneWftJson(cloudClean.deletedSessions[key]);
        }
    }
    for (key in localClean.deletedSessions) {
        if (Object.prototype.hasOwnProperty.call(localClean.deletedSessions, key)) {
            merged.deletedSessions[key] = cloneWftJson(localClean.deletedSessions[key]);
        }
    }

    merged.updatedAt = new Date().toISOString();
    return merged;
}

function saveDeletionsLocalOnly(deletions, reason) {
    try {
        localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify(normalizeDeletionsData(deletions || {})));
    } catch (e) {
        wftDebugWarn("[WFT Sync] Could not save merged deletions locally:", e);
    }
}

function getWftDeletionCounts(deletions) {
    var clean = normalizeDeletionsData(deletions || {});
    return {
        students: Object.keys(clean.deletedStudents || {}).length,
        sessions: Object.keys(clean.deletedSessions || {}).length
    };
}

// ── WFT Sync Engine V2 dirty flags and debounced queue ──
function markWftSettingsDirty(reason) {
    wftSyncState.pendingSettingsPush = true;
    wftSyncState.localSettingsCounter += 1;
    wftSyncLog("[WFT Sync] settings dirty", reason, wftSyncState.localSettingsCounter);
}

function markWftPortfolioDirty(reason) {
    wftSyncState.pendingPortfolioPush = true;
    wftSyncState.localPortfolioCounter += 1;
    wftSyncLog("[WFT Sync] portfolio dirty", reason, wftSyncState.localPortfolioCounter);
}

function markWftDeletionsDirty(reason) {
    wftSyncState.pendingDeletionsPush = true;
    wftSyncState.localDeletionsCounter += 1;
    wftSyncLog("[WFT Sync] deletions dirty", reason, wftSyncState.localDeletionsCounter);
}

function scheduleWftCloudSync(reason) {
    if (!WFT_SYNC_ENGINE_V2) return;
    if (WFT_SYNC_ENGINE_V2_SAFE_MODE || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) return;

    syncStateFromLegacyGoogleGlobals();

    if (!wftSyncState.signedIn && !driveAccessToken) return;

    if (wftSyncState.syncDebounceTimer) {
        clearTimeout(wftSyncState.syncDebounceTimer);
    }

    wftSyncState.syncDebounceTimer = setTimeout(function () {
        wftSyncState.syncDebounceTimer = null;
        syncWftNow(reason || "local-change", { immediate: false });
    }, WFT_SYNC_DEBOUNCE_MS);
}

function flushWftCloudSyncNow(reason) {
    if (wftSyncState.syncDebounceTimer) {
        clearTimeout(wftSyncState.syncDebounceTimer);
        wftSyncState.syncDebounceTimer = null;
    }

    return syncWftNow(reason || "manual", { immediate: true });
}

// ── WFT Sync Engine V2 Drive file helpers ──
function escapeDriveQueryValue(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function validateCachedDriveFilePromise(fileId, filename, folderId) {
    if (!fileId || !folderId) return Promise.resolve(false);

    var url = "https://www.googleapis.com/drive/v3/files/"
        + encodeURIComponent(fileId)
        + "?fields=id,name,parents,trashed,modifiedTime,createdTime,size,mimeType";

    if (!isWftTokenValid()) return Promise.resolve(false);

    wftSyncLog("[WFT Sync][FILE] cached file validation start", { filename: filename, fileId: fileId });
    return fetch(url, {
        headers: { Authorization: "Bearer " + wftSyncState.accessToken }
    }).then(function (response) {
        wftSyncLog("[WFT Sync][FILE] cached file validation response", response.status, { filename: filename, fileId: fileId });
        if (!response.ok) return false;
        return response.json();
    }).then(function (file) {
        var parents = file && file.parents ? file.parents : [];
        var valid = !!(file && file.id === fileId && file.name === filename && file.trashed === false && parents.indexOf(folderId) !== -1);
        wftSyncLog("[WFT Sync][FILE] cached file validation", { filename: filename, fileId: fileId, valid: valid });
        if (!valid) clearCachedWftDriveFileId(filename);
        return valid ? file : false;
    }).catch(function (e) {
        wftSyncWarn("[WFT Sync][FILE] cached file validation failed", { filename: filename, fileId: fileId, error: e });
        clearCachedWftDriveFileId(filename);
        return false;
    });
}

function findWftFilesByNamePromise(filename) {
    wftSyncLog("[WFT Sync][FILE] find files start", filename);
    return ensureDriveFolderPromise().then(function (folderId) {
        var cachedFileId = "";
        if (filename === WFT_SETTINGS_FILENAME) cachedFileId = wftSyncState.settingsFileId;
        else if (filename === WFT_PORTFOLIO_FILENAME) cachedFileId = wftSyncState.portfolioFileId;
        else if (filename === WFT_DELETIONS_FILENAME) cachedFileId = wftSyncState.deletionsFileId;
        cachedFileId = cachedFileId || getCachedWftDriveFileId(filename);

        return validateCachedDriveFilePromise(cachedFileId, filename, folderId).then(function (cachedFile) {
            var query;
            var url;

            if (cachedFile) {
                wftSyncLog("[WFT Sync][FILE] using cached file", filename, cachedFile.id);
                return [cachedFile];
            }

            query = "name='" + escapeDriveQueryValue(filename) + "'"
                + " and '" + escapeDriveQueryValue(folderId) + "' in parents"
                + " and trashed=false";

            url = "https://www.googleapis.com/drive/v3/files"
                + "?q=" + encodeURIComponent(query)
                + "&fields=files(id,name,modifiedTime,createdTime,size,mimeType)"
                + "&orderBy=modifiedTime desc";

            return wftDriveFetch(url).then(function (response) {
                return response.json();
            }).then(function (data) {
                var files = data && data.files ? data.files : [];
                wftSyncLog("[WFT Sync][FILE] find files result", filename, files.length, files);
                if (files.length) {
                    setCachedWftDriveFileId(filename, files[0].id);
                }
                return files;
            });
        });
    });
}

function chooseCanonicalWftFile(files) {
    if (!files || !files.length) return null;
    return files[0];
}

function downloadWftJsonFilePromise(fileId) {
    wftSyncLog("[WFT Sync][FILE] download JSON start", fileId);
    var url = "https://www.googleapis.com/drive/v3/files/"
        + encodeURIComponent(fileId)
        + "?alt=media";

    return wftDriveFetch(url).then(function (response) {
        return response.text();
    }).then(function (text) {
        if (!text) return null;

        try {
            var parsed = JSON.parse(text);
            wftSyncLog("[WFT Sync][FILE] download JSON parsed", fileId, getWftHash(parsed));
            return parsed;
        } catch (e) {
            wftSyncWarn("[WFT Sync] download JSON parse failed", fileId, e);
            return null;
        }
    });
}

function uploadWftJsonFilePromise(filename, data) {
    wftSyncLog("[WFT Sync][FILE] upload JSON start", filename);
    var content = JSON.stringify(data || {}, null, 2);
    var intendedHash = filename === WFT_SETTINGS_FILENAME
        ? getSettingsFingerprint(data)
        : (filename === WFT_DELETIONS_FILENAME ? getDeletionsFingerprint(data) : (filename === "portfolio-index.json" ? getWftHash(data || {}) : getPortfolioFingerprint(data)));

    return saveFileToDrivePromise(filename, content, "application/json")
        .then(function () {
            wftSyncLog("[WFT Sync][FILE] upload JSON saved", filename, intendedHash);
            return findWftFilesByNamePromise(filename).then(function (files) {
                var canonical = chooseCanonicalWftFile(files);
                if (canonical && canonical.id) {
                    setCachedWftDriveFileId(filename, canonical.id);
                }
                return canonical && canonical.id ? canonical.id : files;
            });
        })
        .catch(function (e) {
            if (String(e.message || "").indexOf("SAVE_FILE_TIMEOUT:") !== 0) {
                throw e;
            }

            return findWftFilesByNamePromise(filename).then(function (files) {
                var canonical = chooseCanonicalWftFile(files);

                if (!canonical) {
                    throw e;
                }

                return downloadWftJsonFilePromise(canonical.id).then(function (cloudData) {
                    var cloudHash = filename === WFT_SETTINGS_FILENAME
                        ? getSettingsFingerprint(cloudData || {})
                        : (filename === WFT_DELETIONS_FILENAME ? getDeletionsFingerprint(cloudData || {}) : (filename === "portfolio-index.json" ? getWftHash(cloudData || {}) : getPortfolioFingerprint(cloudData || {})));

                    if (cloudHash === intendedHash) {
                        if (canonical && canonical.id) {
                            setCachedWftDriveFileId(filename, canonical.id);
                            return canonical.id;
                        }
                        return files;
                    }

                    throw e;
                });
            });
        })
        .then(function (files) {
            var canonical;

            if (typeof files === "string") {
                return files;
            }

            canonical = chooseCanonicalWftFile(files);
            return canonical ? canonical.id : null;
        });
}

// ── WFT Sync Engine V2 duplicate detection ──
function noteDuplicateWftFiles(filename, files) {
    var duplicateCount = files && files.length > 1 ? files.length - 1 : 0;
    if (!duplicateCount) return;

    wftDebugWarn("[WFT Sync] Duplicate Drive files detected for " + filename, files);
    setDuplicateSyncMaintenanceStatus("Duplicate Google Drive sync files found. The tool is using the newest copy. Older duplicate files can be moved to Backup.", duplicateCount, false);

    if (WFT_DUPLICATE_DETECTION_V2) {
        setDriveSyncStatus("error", "Duplicate Drive files detected", null, "Using the newest copy safely.");
    }
}

function downloadAndMergeDuplicatePortfolios(files, localPortfolio) {
    var chain = Promise.resolve(normalizePortfolioShape(localPortfolio));

    files.forEach(function (file) {
        chain = chain.then(function (current) {
            return downloadWftJsonFilePromise(file.id).then(function (data) {
                return mergeWftPortfolios(current, data || {});
            });
        });
    });

    return chain;
}

function downloadAndMergeDuplicateSettings(files, localSettings) {
    var chain = Promise.resolve(localSettings || {});

    files.forEach(function (file) {
        chain = chain.then(function (current) {
            return downloadWftJsonFilePromise(file.id).then(function (data) {
                return mergeWftSettings(current, data || {}, true);
            });
        });
    });

    return chain;
}

// ── WFT Sync Engine V2 settings merge and sync ──
function getWftStudentName(student) {
    if (student == null) return "";
    if (typeof student === "string") return String(student).trim();
    if (typeof student === "object" && student.name != null) return String(student.name).trim();
    return String(student).trim();
}

function normalizeStudentKey(student) {
    var name;

    if (!student) return "";

    if (typeof student === "object" && student.id) {
        return "id:" + String(student.id);
    }

    name = getWftStudentName(student);
    if (name) return "name:" + name.toLowerCase();

    return "";
}

function mergeWftStudents(localStudents, cloudStudents) {
    var byKey = {};
    var result = [];
    var all = (cloudStudents || []).concat(localStudents || []);
    var deletions = getDeletionsData();
    var i;
    var key;
    var student;
    var name;

    for (i = 0; i < all.length; i += 1) {
        student = all[i];
        name = getWftStudentName(student);
        key = normalizeStudentKey(student);
        if (!key || !name) continue;

        // Keep the roster shape used by the rest of the app: an array of name strings.
        // Cloud entries are processed first, then local entries, so a just-added local
        // name is preserved and its casing wins during an in-flight Drive pull.
        byKey[key] = name;
    }

    for (key in byKey) {
        if (Object.prototype.hasOwnProperty.call(byKey, key)) {
            name = byKey[key];
            if (deletions.deletedStudents[getDeletedStudentKey(name)]) continue;
            result.push(name);
        }
    }

    result.sort(function(a, b) { return a.localeCompare(b); });
    return result;
}

function mergeWftSettings(localSettings, cloudSettings, preferLocal) {
    var localCopy = cloneWftJson(localSettings || {});
    var cloudCopy = cloneWftJson(cloudSettings || {});
    var merged = {};
    var key;

    if (preferLocal) {
        for (key in cloudCopy) {
            if (Object.prototype.hasOwnProperty.call(cloudCopy, key)) {
                merged[key] = cloudCopy[key];
            }
        }
        for (key in localCopy) {
            if (Object.prototype.hasOwnProperty.call(localCopy, key)) {
                merged[key] = localCopy[key];
            }
        }
    } else {
        for (key in localCopy) {
            if (Object.prototype.hasOwnProperty.call(localCopy, key)) {
                merged[key] = localCopy[key];
            }
        }
        for (key in cloudCopy) {
            if (Object.prototype.hasOwnProperty.call(cloudCopy, key)) {
                merged[key] = cloudCopy[key];
            }
        }
    }

    if (cloudCopy && cloudCopy.students && localCopy && localCopy.students) {
        merged.students = mergeWftStudents(localCopy.students, cloudCopy.students);
    }

    // Never upload apiKey to Drive — it is a per-device credential
    delete merged.apiKey;
    return merged;
}

function saveSettingsLocalOnly(settings, reason) {
    var previousSuppress = wftSuppressDirtyMarks;

    try {
        var existing = {};
        var raw = localStorage.getItem("wft_settings");
        if (raw) {
            try { existing = JSON.parse(raw) || {}; } catch (e) { existing = {}; }
        }

        var merged = cloneWftJson(settings || {});
        wftSuppressDirtyMarks = true;

        if (typeof applyLoadedSettings === "function") {
            applyLoadedSettings(merged);
        }

        if (merged && merged.apiKey) { delete merged.apiKey; }
        localStorage.setItem("wft_settings", JSON.stringify(merged || {}));
        refreshApiKeyRuntimeValue();
    } catch (e2) {
        wftDebugWarn("[WFT Sync] Could not save merged settings locally:", e2);
    } finally {
        wftSuppressDirtyMarks = previousSuppress;
    }
}

function syncWftSettingsIfNeeded(reason) {
    wftSyncLog("[WFT Sync] settings sync start", reason);
    var localSettings = getLocalSettingsSnapshot();
    var localHash = getSettingsFingerprint(localSettings);
    var counterSnapshot = wftSyncState.localSettingsCounter;
    var hadPending = wftSyncState.pendingSettingsPush;
    wftSyncLog("[WFT Sync] settings local snapshot", { hash: localHash, counter: counterSnapshot, hadPending: hadPending, studentCount: localSettings && localSettings.students ? localSettings.students.length : 0 });

    return findWftFilesByNamePromise(WFT_SETTINGS_FILENAME)
        .then(function (files) {
            var canonical;

            noteDuplicateWftFiles(WFT_SETTINGS_FILENAME, files);
            canonical = chooseCanonicalWftFile(files);

            if (canonical) {
                setCachedWftDriveFileId(WFT_SETTINGS_FILENAME, canonical.id);
            }

            if (!canonical) {
                if (!hadPending) {
                    wftSyncLog("[WFT Sync][SETTINGS] decision", "skip-no-cloud-no-local-pending", { localHash: localHash });
                    return false;
                }

                wftSyncLog("[WFT Sync][SETTINGS] decision", "create-remote", { localHash: localHash });
                return uploadWftJsonFilePromise(WFT_SETTINGS_FILENAME, localSettings).then(function (fileId) {
                    wftSyncState.settingsFileId = fileId || wftSyncState.settingsFileId;
                    wftSyncState.lastSyncedSettingsHash = localHash;
                    wftSyncState.lastSyncedSettingsCounter = counterSnapshot;
                    wftSyncState.pendingSettingsPush = false;
                    return true;
                });
            }

            return downloadAndMergeDuplicateSettings(files.filter(function(f) { return f.id !== canonical.id; }), localSettings).then(function (mergedFromDuplicates) {
                var cloudHash;
                var merged;
                var mergedHash;

                return downloadWftJsonFilePromise(canonical.id).then(function (cloudSettings) {
                    cloudHash = getSettingsFingerprint(cloudSettings || {});
                    merged = mergeWftSettings(mergedFromDuplicates || localSettings, cloudSettings || {}, !!hadPending);
                    merged.students = applyDeletionsToStudents(merged.students || [], getDeletionsData());

                    // If the roster/settings changed while this Drive read was in flight,
                    // refresh the local snapshot before applying anything from the cloud.
                    // This prevents an older cloud copy from briefly overwriting a just-added student.
                    if (wftSyncState.localSettingsCounter !== counterSnapshot) {
                        localSettings = getLocalSettingsSnapshot();
                        localHash = getSettingsFingerprint(localSettings);
                        counterSnapshot = wftSyncState.localSettingsCounter;
                        hadPending = true;
                        merged = mergeWftSettings(localSettings, merged, true);
                        merged.students = applyDeletionsToStudents(merged.students || [], getDeletionsData());
                    }

                    mergedHash = getSettingsFingerprint(merged);

                    if (mergedHash !== localHash) {
                        saveSettingsLocalOnly(merged, "cloud-merge");
                    }

                    if ((hadPending || files.length > 1) && mergedHash !== cloudHash) {
                        wftSyncLog("[WFT Sync][SETTINGS] decision", "push-local", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending, duplicateCount: files.length });
                        return uploadWftJsonFilePromise(WFT_SETTINGS_FILENAME, merged).then(function () {
                            wftSyncState.lastSyncedSettingsHash = mergedHash;
                            wftSyncState.lastSyncedSettingsCounter = counterSnapshot;
                            wftSyncState.pendingSettingsPush = false;
                            return true;
                        });
                    }

                    wftSyncLog("[WFT Sync][SETTINGS] decision", mergedHash !== localHash ? "pull-remote" : "skip-same-hash", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending });
                    wftSyncState.lastSyncedSettingsHash = mergedHash;
                    wftSyncState.lastSyncedSettingsCounter = counterSnapshot;
                    wftSyncState.pendingSettingsPush = false;
                    return false;
                });
            });
        });
}

// ── WFT Sync Engine V2 deletion-log sync ──
function syncWftDeletionsIfNeeded(reason) {
    wftSyncLog("[WFT Sync] deletions sync start", reason);
    var localDeletions = getDeletionsData();
    var localHash = getDeletionsFingerprint(localDeletions);
    var counterSnapshot = wftSyncState.localDeletionsCounter;
    var hadPending = wftSyncState.pendingDeletionsPush;
    var counts = getWftDeletionCounts(localDeletions);

    wftSyncLog("[WFT Sync] deletions local snapshot", { hash: localHash, counter: counterSnapshot, hadPending: hadPending, deletedStudents: counts.students, deletedSessions: counts.sessions });

    return findWftFilesByNamePromise(WFT_DELETIONS_FILENAME)
        .then(function (files) {
            var canonical;

            noteDuplicateWftFiles(WFT_DELETIONS_FILENAME, files);
            canonical = chooseCanonicalWftFile(files);

            if (canonical) {
                setCachedWftDriveFileId(WFT_DELETIONS_FILENAME, canonical.id);
            }

            if (!canonical) {
                if (!hadPending && counts.students === 0 && counts.sessions === 0) {
                    wftSyncLog("[WFT Sync][DELETIONS] decision", "skip-no-cloud-no-local-deletions", { localHash: localHash });
                    return false;
                }

                wftSyncLog("[WFT Sync][DELETIONS] decision", "create-remote", { localHash: localHash });
                return uploadWftJsonFilePromise(WFT_DELETIONS_FILENAME, localDeletions).then(function (fileId) {
                    wftSyncState.deletionsFileId = fileId || wftSyncState.deletionsFileId;
                    wftSyncState.lastSyncedDeletionsHash = localHash;
                    wftSyncState.lastSyncedDeletionsCounter = counterSnapshot;
                    wftSyncState.pendingDeletionsPush = false;
                    return true;
                });
            }

            return downloadWftJsonFilePromise(canonical.id).then(function (cloudDeletions) {
                var cloudHash = getDeletionsFingerprint(cloudDeletions || {});
                var merged = mergeWftDeletions(localDeletions, cloudDeletions || {});
                var mergedHash;

                if (wftSyncState.localDeletionsCounter !== counterSnapshot) {
                    localDeletions = getDeletionsData();
                    localHash = getDeletionsFingerprint(localDeletions);
                    counterSnapshot = wftSyncState.localDeletionsCounter;
                    hadPending = true;
                    merged = mergeWftDeletions(localDeletions, merged);
                }

                mergedHash = getDeletionsFingerprint(merged);

                if (mergedHash !== localHash) {
                    saveDeletionsLocalOnly(merged, "cloud-merge");
                    applyWftDeletionsToLocalPortfolio(merged, "deletions-cloud-merge");
                }

                if ((hadPending || files.length > 1) && mergedHash !== cloudHash) {
                    wftSyncLog("[WFT Sync][DELETIONS] decision", "push-local", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending, duplicateCount: files.length });
                    return uploadWftJsonFilePromise(WFT_DELETIONS_FILENAME, merged).then(function () {
                        wftSyncState.lastSyncedDeletionsHash = mergedHash;
                        wftSyncState.lastSyncedDeletionsCounter = counterSnapshot;
                        wftSyncState.pendingDeletionsPush = false;
                        return true;
                    });
                }

                wftSyncLog("[WFT Sync][DELETIONS] decision", mergedHash !== localHash ? "pull-remote" : "skip-same-hash", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending });
                wftSyncState.lastSyncedDeletionsHash = mergedHash;
                wftSyncState.lastSyncedDeletionsCounter = counterSnapshot;
                wftSyncState.pendingDeletionsPush = false;
                return false;
            });
        });
}

// ── WFT Sync Engine V2 portfolio merge and sync ──
function getSessionKey(session) {
    if (!session) return "";
    if (session.id) return String(session.id);
    if (session.createdAt) return String(session.createdAt);

    return [
        session.studentName || "",
        session.date || session.createdAt || "",
        session.title || ""
    ].join("|");
}

function getTimeMs(value) {
    if (typeof value === "number") return isNaN(value) ? 0 : value;
    var time = Date.parse(value || "");
    return isNaN(time) ? 0 : time;
}

function mergeSessionImageRefs(primary, secondary) {
    var merged = cloneWftJson(primary || {});
    var primaryImages = merged.images || merged.photos || [];
    var secondaryImages = secondary ? (secondary.images || secondary.photos || []) : [];
    var byKey = {};
    var result = [];
    var i;

    function addImage(img) {
        var key;

        if (!img) return;

        key = img.imageId || img.driveFileId || img.name || img.filename || "";

        if (!key) {
            key = stableStringify(img);
        }

        if (!byKey[key]) {
            byKey[key] = cloneWftJson(img);
            result.push(byKey[key]);
        } else {
            // Manual field merge (ES5 compat)
            for (var f in img) {
                if (Object.prototype.hasOwnProperty.call(img, f)) {
                    byKey[key][f] = img[f];
                }
            }
        }
    }

    for (i = 0; i < primaryImages.length; i += 1) addImage(primaryImages[i]);
    for (i = 0; i < secondaryImages.length; i += 1) addImage(secondaryImages[i]);

    if (merged.images) merged.images = result;
    if (merged.photos) merged.photos = result;

    return merged;
}

function getSessionModifiedTimeMs(session) {
    session = session || {};
    var fields = [session.updatedAt, session.lastReassessedAt, session.createdAt, session.date];
    var newest = 0;
    for (var i = 0; i < fields.length; i += 1) {
        var time = getTimeMs(fields[i]);
        if (time > newest) newest = time;
    }
    return newest;
}

function chooseNewerSession(a, b) {
    var aTime = getSessionModifiedTimeMs(a);
    var bTime = getSessionModifiedTimeMs(b);

    if (bTime > aTime) return mergeSessionImageRefs(b, a);
    if (aTime > bTime) return mergeSessionImageRefs(a, b);

    if (getWftHash(a || {}) !== getWftHash(b || {})) {
        wftSyncWarn("[WFT Sync][PORTFOLIO] Same session ID has different content with equal timestamps; preserving newer-looking copy plus image refs.");
        return mergeSessionImageRefs(b, a);
    }

    return mergeSessionImageRefs(a, b);
}

function rebuildWftPortfolioDerivedStats(portfolio) {
    // WFT doesn't have a separate stats rebuild; portfolio UI is refreshed via renderStudentPortfolio
    return portfolio;
}

function mergeWftPortfolios(localPortfolio, cloudPortfolio, localIsAuthoritative) {
    // Merge by student/session rather than replacing a whole student record.
    // localIsAuthoritative is kept for API compatibility, but it must not cause
    // a whole-student overwrite because that can drop newer sessions from Drive.
    var localNorm = normalizePortfolioShape(localPortfolio || {});
    var cloudNorm = normalizePortfolioShape(cloudPortfolio || {});
    var merged = {};
    var studentNames = {};

    Object.keys(cloudNorm || {}).forEach(function(studentName) {
        studentNames[studentName] = true;
    });
    Object.keys(localNorm || {}).forEach(function(studentName) {
        studentNames[studentName] = true;
    });

    Object.keys(studentNames).forEach(function(studentName) {
        var localStudent = localNorm[studentName] || {};
        var cloudStudent = cloudNorm[studentName] || {};
        var localSessions = Array.isArray(localStudent.sessions) ? localStudent.sessions : [];
        var cloudSessions = Array.isArray(cloudStudent.sessions) ? cloudStudent.sessions : [];
        var byKey = {};
        var ordered = [];

        function storeSession(session) {
            if (!session) return;
            var key = getSessionKey(session);

            if (!key) {
                ordered.push(cloneWftJson(session));
                return;
            }

            if (!byKey[key]) {
                byKey[key] = cloneWftJson(session);
                ordered.push(byKey[key]);
                return;
            }

            byKey[key] = chooseNewerSession(byKey[key], session);
            for (var i = 0; i < ordered.length; i += 1) {
                if (getSessionKey(ordered[i]) === key) {
                    ordered[i] = byKey[key];
                    break;
                }
            }
        }

        cloudSessions.forEach(storeSession);
        localSessions.forEach(storeSession);

        ordered.sort(function (a, b) {
            return getSessionModifiedTimeMs(b) - getSessionModifiedTimeMs(a);
        });

        merged[studentName] = cloneWftJson(cloudStudent);
        Object.keys(localStudent).forEach(function(key) {
            if (key === "sessions") return;
            if (typeof merged[studentName][key] === "undefined") {
                merged[studentName][key] = cloneWftJson(localStudent[key]);
            }
        });
        merged[studentName].sessions = ordered;
    });

    // DO NOT add root-level metadata keys (like updatedAt) - normalizePortfolioData
    // treats every top-level key as a student name, so metadata would become a fake student.
    return rebuildWftPortfolioDerivedStats(merged);
}

function savePortfolioLocalOnly(portfolio, reason) {
    try {
        localStorage.setItem("wft_portfolio", JSON.stringify(portfolio || {}));
    } catch (e) {
        wftDebugWarn("[WFT Sync] Could not save merged portfolio locally:", e);
    }
}

function applyWftDeletionsToLocalPortfolio(deletions, reason) {
    var rawPortfolio;
    var filteredPortfolio;
    var rawHash;
    var filteredHash;

    try {
        rawPortfolio = getLocalPortfolioSnapshot();
        filteredPortfolio = applyDeletionsToPortfolio(rawPortfolio, deletions || getDeletionsData());
        rawHash = getPortfolioFingerprint(rawPortfolio);
        filteredHash = getPortfolioFingerprint(filteredPortfolio);

        if (rawHash !== filteredHash) {
            savePortfolioLocalOnly(filteredPortfolio, reason || "apply-deletions");
            if (typeof markWftPortfolioIndexDirty === "function") {
                markWftPortfolioIndexDirty(reason || "apply-deletions");
            }
            refreshPortfolioUiAfterCloudMerge();
            wftSyncLog("[WFT Sync][PORTFOLIO] applied deletion cleanup", { reason: reason || "apply-deletions", rawHash: rawHash, filteredHash: filteredHash });
            return true;
        }
    } catch (e) {
        wftDebugWarn("[WFT Sync] Could not apply deletion cleanup to local portfolio:", e);
    }

    return false;
}

function refreshPortfolioUiAfterCloudMerge() {
    try {
        if (typeof renderStudentPortfolio === "function") renderStudentPortfolio();
        if (typeof refreshPortfolioDropdown === "function") refreshPortfolioDropdown();
    } catch (e) {
        wftDebugWarn("[WFT Sync] Could not refresh portfolio UI:", e);
    }
}

function syncWftPortfolioIfNeeded(reason) {
    wftSyncLog("[WFT Sync] portfolio sync start", reason);
    var deletions = getDeletionsData();
    var rawLocalPortfolio = getLocalPortfolioSnapshot();
    var rawLocalHash = getPortfolioFingerprint(rawLocalPortfolio);
    var localPortfolio = applyDeletionsToPortfolio(rawLocalPortfolio, deletions);
    var localHash = getPortfolioFingerprint(localPortfolio);
    var counterSnapshot = wftSyncState.localPortfolioCounter;
    var hadPending = wftSyncState.pendingPortfolioPush;

    if (rawLocalHash !== localHash) {
        savePortfolioLocalOnly(localPortfolio, "apply-deletions-before-sync");
        if (typeof markWftPortfolioIndexDirty === "function") {
            markWftPortfolioIndexDirty("apply-deletions-before-sync");
        }
        refreshPortfolioUiAfterCloudMerge();
        wftSyncLog("[WFT Sync][PORTFOLIO] local deletion cleanup before sync", { rawHash: rawLocalHash, filteredHash: localHash });
    }

    wftSyncLog("[WFT Sync] portfolio local snapshot", { hash: localHash, counter: counterSnapshot, hadPending: hadPending, studentCount: Object.keys(localPortfolio || {}).length });

    return findWftFilesByNamePromise(WFT_PORTFOLIO_FILENAME)
        .then(function (files) {
            var canonical;

            noteDuplicateWftFiles(WFT_PORTFOLIO_FILENAME, files);
            canonical = chooseCanonicalWftFile(files);

            if (canonical) {
                setCachedWftDriveFileId(WFT_PORTFOLIO_FILENAME, canonical.id);
            }

            if (!canonical) {
                if (!hadPending) {
                    wftSyncLog("[WFT Sync][PORTFOLIO] decision", "skip-no-cloud-no-local-pending", { localHash: localHash });
                    return false;
                }

                wftSyncLog("[WFT Sync][PORTFOLIO] decision", "create-remote", { localHash: localHash });
                return uploadWftJsonFilePromise(WFT_PORTFOLIO_FILENAME, applyDeletionsToPortfolio(localPortfolio, getDeletionsData())).then(function (fileId) {
                    wftSyncState.portfolioFileId = fileId || wftSyncState.portfolioFileId;
                    wftSyncState.lastSyncedPortfolioHash = localHash;
                    wftSyncState.lastSyncedPortfolioCounter = counterSnapshot;
                    wftSyncState.pendingPortfolioPush = false;
                    return true;
                });
            }

            return downloadAndMergeDuplicatePortfolios(files.filter(function(f) { return f.id !== canonical.id; }), localPortfolio).then(function (mergedFromDuplicates) {
                var cloudNormalized;
                var cloudHash;
                var merged;
                var mergedHash;

                return downloadWftJsonFilePromise(canonical.id).then(function (cloudPortfolio) {
                    cloudNormalized = applyDeletionsToPortfolio(cloudPortfolio || {}, getDeletionsData());
                    cloudHash = getPortfolioFingerprint(cloudNormalized);
                    merged = mergeWftPortfolios(applyDeletionsToPortfolio(mergedFromDuplicates || localPortfolio, getDeletionsData()), cloudNormalized, hadPending);
                    merged = applyDeletionsToPortfolio(merged, getDeletionsData());
                    mergedHash = getPortfolioFingerprint(merged);

                    if (mergedHash !== localHash) {
                        savePortfolioLocalOnly(merged, "cloud-merge");
                        refreshPortfolioUiAfterCloudMerge();
                    }

                    if ((hadPending || files.length > 1) && mergedHash !== cloudHash) {
                        wftSyncLog("[WFT Sync][PORTFOLIO] decision", "push-local", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending, duplicateCount: files.length });
                        return uploadWftJsonFilePromise(WFT_PORTFOLIO_FILENAME, merged).then(function () {
                            wftSyncState.lastSyncedPortfolioHash = mergedHash;
                            wftSyncState.lastSyncedPortfolioCounter = counterSnapshot;
                            wftSyncState.pendingPortfolioPush = false;
                            return true;
                        });
                    }

                    wftSyncLog("[WFT Sync][PORTFOLIO] decision", mergedHash !== localHash ? "pull-remote" : "skip-same-hash", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending });
                    wftSyncState.lastSyncedPortfolioHash = mergedHash;
                    wftSyncState.lastSyncedPortfolioCounter = counterSnapshot;
                    wftSyncState.pendingPortfolioPush = false;
                    return false;
                });
            });
        });
}

// ── WFT Sync Engine V2 portfolio index sync ──
function syncWftPortfolioIndexIfNeeded(reason) {
    if (!WFT_PORTFOLIO_INDEX_V1) return Promise.resolve(false);
    if (!isWftPortfolioIndexDirty()) return Promise.resolve(false);

    return new Promise(function(resolve) {
        try {
            var portfolio = getLocalPortfolioSnapshot();
            var index = buildPortfolioIndexFromPortfolio(portfolio);
            savePortfolioIndexToDrive(index, function(err) {
                if (err) {
                    wftSyncWarn("[WFT Sync][INDEX] save failed", reason, err);
                    resolve(false);
                    return;
                }
                clearWftPortfolioIndexDirty();
                wftSyncLog("[WFT Sync][INDEX] saved", reason);
                resolve(true);
            });
        } catch (e) {
            wftSyncWarn("[WFT Sync][INDEX] build failed", reason, e);
            resolve(false);
        }
    });
}

// ── WFT Sync Engine V2 main orchestrator ──
function handleWftSyncError(e) {
    wftSyncErrorLog("[WFT Sync] sync error", e && e.message ? e.message : e, e || null, getWftSyncDebugSnapshot());
    if (!e) {
        setDriveSyncStatus("error", "Drive sync needs attention.", null, "Local data is still saved. Try syncing again.");
        return;
    }

    if (e.message === "OFFLINE") {
        setDriveSyncStatus("error", "Offline - will sync later", null, "Local changes are saved on this device.");
        return;
    }

    if (e.message === "TOKEN_EXPIRED" || e.status === 401) {
        setDriveSyncStatus("error", "Session expired - please sign in again.", null, "Local data is still available.");
        return;
    }

    if (e.status === 403 && /quota|rate/i.test(String(e.reason || "") + " " + String(e.message || ""))) {
        setDriveSyncStatus("error", "Drive quota or rate limit reached.");
        return;
    }

    if (e.status === 403) {
        setDriveSyncStatus("error", "Drive permission issue - please reconnect.", null, "Local data is still available.");
        return;
    }

    setDriveSyncStatus("error", "Drive sync needs attention.", null, "Local data is still saved. Try syncing again.");
}

function syncWftNow(reason, options) {
    options = options || {};

    syncStateFromLegacyGoogleGlobals();

    wftSyncLog("[WFT Sync] syncWftNow requested", reason, options, getWftSyncDebugSnapshot());

    if (!WFT_SYNC_ENGINE_V2) {
        wftSyncLog("[WFT Sync] sync skipped - V2 disabled", reason);
        return Promise.resolve(false);
    }

    if (WFT_SYNC_ENGINE_V2_SAFE_MODE || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
        wftSyncLog("[WFT Sync] sync skipped - safe mode", reason);
        showDriveSyncPausedForSafety();
        return Promise.resolve(false);
    }

    if (!wftSyncState.signedIn && !wftSyncState.accessToken) {
        wftSyncLog("[WFT Sync] sync skipped - not signed in", reason);
        setDriveSyncStatus("", "Not synced");
        return Promise.resolve(false);
    }

    if (!isWftTokenValid()) {
        if (isWftGisAuthEnabled() && hasPersistedGoogleConnection() && !options.afterSilentAuthRetry) {
            var retryOptions = {};
            var retryKey;
            for (retryKey in options) {
                if (Object.prototype.hasOwnProperty.call(options, retryKey)) {
                    retryOptions[retryKey] = options[retryKey];
                }
            }
            retryOptions.afterSilentAuthRetry = true;
            wftSyncLog("[WFT Sync] token expired - attempting silent GIS refresh", reason);
            setDriveSyncStatus("syncing", "Refreshing Google session...", 8, "Checking your previous Drive connection.");
            return attemptSilentWftGisTokenRefresh("sync-" + (reason || "background"))
                .then(function () {
                    return syncWftNow(reason, retryOptions);
                })
                .catch(function (e) {
                    wftDebugWarn("[WFT Auth] Silent refresh before sync failed:", e);
                    wftSyncState.authBlocked = true;
                    clearWftTokenSession();
                    wftSyncLog("[WFT Sync] sync skipped - token expired", reason);
                    setDriveSyncStatus("error", "Session expired - click Sync to reconnect.", null, "Local data is still available.");
                    return false;
                });
        }

        wftSyncState.authBlocked = true;
        clearWftTokenSession();
        wftSyncLog("[WFT Sync] sync skipped - token expired", reason);
        setDriveSyncStatus("error", "Session expired - click Sync to reconnect.", null, "Local data is still available.");
        return Promise.resolve(false);
    }

    if (!navigator.onLine) {
        wftSyncLog("[WFT Sync] sync skipped - offline", reason);
        setDriveSyncStatus("error", "Offline - will sync later", null, "Local changes are saved on this device.");
        return Promise.resolve(false);
    }

    if (wftSyncState.quotaBlocked || wftSyncState.permissionBlocked || wftSyncState.authBlocked) {
        wftSyncWarn("[WFT Sync] sync blocked state", reason, getWftSyncDebugSnapshot());
        if (reason === "manual" || reason === "explicit-sync-to-portfolio" || options.immediate) {
            clearWftSyncBlockState();
            wftSyncLog("[WFT Sync] block state cleared for explicit sync", reason);
        } else {
            return Promise.resolve(false);
        }
    }

    if (wftSyncState.isSyncing) {
        wftSyncState.needsSyncAfterCurrent = true;
        wftSyncLog("[WFT Sync] sync already running - queued behind active run", reason, getWftSyncDebugSnapshot());

        if (wftSyncState.currentSyncPromise) {
            return wftSyncState.currentSyncPromise.then(function (result) {
                wftSyncLog("[WFT Sync] queued request completed after active run", reason, result, getWftSyncDebugSnapshot());
                return result !== false;
            }).catch(function (e) {
                wftSyncErrorLog("[WFT Sync] queued request saw active-run failure", reason, e);
                return false;
            });
        }

        return Promise.resolve(false);
    }

    wftSyncState.isSyncing = true;
    wftSyncState.syncRunId += 1;
    var runId = wftSyncState.syncRunId;
    wftSyncState.folderResolutionPromise = null;
    wftSyncState.folderResolutionRunId = 0;

    if (options.immediate) {
        wftSyncState.explicitSaveInProgress = true;
    }

    setDriveSyncProgress("Starting sync...", 5, getWftSyncProgressDetail(reason));
    wftSyncLog("[WFT Sync] run start", runId, reason, getWftSyncDebugSnapshot());

    setDriveSyncProgress("Checking Drive folder...", 20, "Making sure the app folder is ready.");
    wftSyncState.currentSyncPromise = ensureDriveFolderPromise()
        .then(function () {
            wftSyncLog("[WFT Sync] run folder ready", runId, wftSyncState.folderId || driveFolderId || "");
            setDriveSyncProgress("Checking deleted records...", 35, "Keeping removed records consistent.");
            return syncWftDeletionsIfNeeded(reason);
        })
        .then(function (deletionsChanged) {
            wftSyncLog("[WFT Sync] run deletions done", runId, deletionsChanged, getWftSyncDebugSnapshot());
            setDriveSyncProgress("Syncing class settings...", 50, "Updating roster, class defaults, and assessment settings.");
            return syncWftSettingsIfNeeded(reason);
        })
        .then(function (settingsChanged) {
            wftSyncLog("[WFT Sync] run settings done", runId, settingsChanged, getWftSyncDebugSnapshot());
            setDriveSyncProgress("Syncing portfolio records...", 70, "Merging local portfolio records with Drive.");
            return syncWftPortfolioIfNeeded(reason);
        })
        .then(function (portfolioChanged) {
            wftSyncLog("[WFT Sync] run portfolio done", runId, portfolioChanged, getWftSyncDebugSnapshot());
            setDriveSyncProgress("Updating portfolio index...", 85, "Preparing faster portfolio loading.");
            return syncWftPortfolioIndexIfNeeded(reason).then(function(indexChanged) {
                wftSyncLog("[WFT Sync] run portfolio index done", runId, indexChanged, getWftSyncDebugSnapshot());
                wftSyncState.lastPollAt = Date.now();
                setDriveSyncProgress("Finishing sync...", 95, "");
                return true;
            });
        })
        .catch(function (e) {
            wftSyncState.lastError = e;
            handleWftSyncError(e);
            return false;
        })
        .then(function (result) {
            var shouldRunAgain = wftSyncState.needsSyncAfterCurrent;

            wftSyncLog("[WFT Sync] run finishing", runId, { result: result, shouldRunAgain: shouldRunAgain }, getWftSyncDebugSnapshot());

            wftSyncState.isSyncing = false;
            wftSyncState.explicitSaveInProgress = false;
            wftSyncState.needsSyncAfterCurrent = false;
            wftSyncState.folderResolutionPromise = null;
            wftSyncState.folderResolutionRunId = 0;
            wftSyncState.currentSyncPromise = null;

            if (shouldRunAgain) {
                setDriveSyncProgress("Another sync is queued...", 96, "Recent changes will sync next.");
                wftSyncLog("[WFT Sync] starting queued follow-up run", runId, reason);
                return syncWftNow("queued-after-current", { immediate: false });
            }

            if (result) {
                finishDriveSyncProgress("Synced");
                checkDuplicateSyncFilesStatus();
            }

            return result;
        });

    return wftSyncState.currentSyncPromise;
}


function getWftSyncDiagnostics() {
    syncStateFromLegacyGoogleGlobals();
    return {
        signedIn: !!wftSyncState.signedIn,
        hasAccessToken: !!wftSyncState.accessToken,
        tokenExpiresAt: wftSyncState.tokenExpiresAt || 0,
        folderId: wftSyncState.folderId || driveFolderId || getCachedWftDriveFolderId() || "",
        settingsFileId: wftSyncState.settingsFileId || getCachedWftDriveFileId(WFT_SETTINGS_FILENAME) || "",
        portfolioFileId: wftSyncState.portfolioFileId || getCachedWftDriveFileId(WFT_PORTFOLIO_FILENAME) || "",
        deletionsFileId: wftSyncState.deletionsFileId || getCachedWftDriveFileId(WFT_DELETIONS_FILENAME) || "",
        isSyncing: !!wftSyncState.isSyncing,
        explicitSaveInProgress: !!wftSyncState.explicitSaveInProgress,
        pendingSettingsPush: !!wftSyncState.pendingSettingsPush,
        pendingPortfolioPush: !!wftSyncState.pendingPortfolioPush,
        pendingDeletionsPush: !!wftSyncState.pendingDeletionsPush,
        needsSyncAfterCurrent: !!wftSyncState.needsSyncAfterCurrent,
        lastSyncedSettingsHash: wftSyncState.lastSyncedSettingsHash || "",
        lastSyncedPortfolioHash: wftSyncState.lastSyncedPortfolioHash || "",
        lastSyncedDeletionsHash: wftSyncState.lastSyncedDeletionsHash || "",
        quotaBlocked: !!wftSyncState.quotaBlocked,
        permissionBlocked: !!wftSyncState.permissionBlocked,
        authBlocked: !!wftSyncState.authBlocked,
        lastError: wftSyncState.lastError ? String(wftSyncState.lastError.message || wftSyncState.lastError) : null
    };
}

try {
    window.WFT_SYNC_DIAGNOSTICS = getWftSyncDiagnostics;
} catch (e) { }

// ── WFT Sync Engine V2 polling and lifecycle ──
function shouldPollWftCloudNow() {
    var now = Date.now();

    syncStateFromLegacyGoogleGlobals();

    if (!WFT_SYNC_ENGINE_V2) return false;
    if (!wftSyncState.signedIn && !driveAccessToken) return false;
    if (!navigator.onLine) return false;
    if (wftSyncState.isSyncing) return false;
    if (wftSyncState.explicitSaveInProgress) return false;
    if (wftSyncState.imageUploadInProgress) return false;
    if (wftSyncState.quotaBlocked) return false;
    if (wftSyncState.permissionBlocked) return false;
    if (wftSyncState.authBlocked) return false;

    if (wftSyncState.pendingSettingsPush || wftSyncState.pendingPortfolioPush || wftSyncState.pendingDeletionsPush) {
        return true;
    }

    if (wftSyncState.lastPollAt && now - wftSyncState.lastPollAt < WFT_POLL_INTERVAL_MS) {
        return false;
    }

    return true;
}

function startWftSyncPolling() {
    stopWftSyncPolling();

    wftSyncState.pollTimer = setInterval(function () {
        if (shouldPollWftCloudNow()) {
            syncWftNow("poll", { immediate: false });
        }
    }, WFT_POLL_INTERVAL_MS);
}

function stopWftSyncPolling() {
    if (wftSyncState.pollTimer) {
        clearInterval(wftSyncState.pollTimer);
        wftSyncState.pollTimer = null;
    }
}

function saveWftLocalSnapshotsBeforeHide() {
    try {
        if (typeof saveSettingsToLocalStorage === "function") {
            wftSuppressDirtyMarks = true;
            saveSettingsToLocalStorage();
            wftSuppressDirtyMarks = false;
        }
    } catch (e) {
        wftSuppressDirtyMarks = false;
    }

    try {
        if (typeof getPortfolioData === "function") {
            var portfolio = getPortfolioData();
            localStorage.setItem("wft_portfolio", JSON.stringify(portfolio || {}));
        }
    } catch (e2) { }
}

function initWftSyncLifecycleHandlers() {
    window.addEventListener("pagehide", function () {
        if (WFT_SYNC_ENGINE_V2) {
            saveWftLocalSnapshotsBeforeHide();
        }
    });

    window.addEventListener("online", function () {
        clearWftSyncBlockState();
        if (!WFT_SYNC_ENGINE_V2) return;
        syncStateFromLegacyGoogleGlobals();
        if (!wftSyncState.signedIn && !driveAccessToken) return;
        if (!isWftTokenValid()) {
            if (isWftGisAuthEnabled() && hasPersistedGoogleConnection()) {
                setDriveSyncStatus("syncing", "Back online - refreshing Google session...", 8, "Checking your previous Drive connection.");
                syncWftNow("online", { immediate: false });
                return;
            }
            wftSyncState.authBlocked = true;
            clearWftTokenSession();
            setDriveSyncStatus("error", "Session expired - click Sync to reconnect.", null, "Local data is still available.");
            return;
        }
        setDriveSyncStatus("syncing", "Back online - syncing...", 5, "Checking Drive for saved changes.");
        syncWftNow("online", { immediate: false });
    });

    window.addEventListener("offline", function () {
        if (WFT_SYNC_ENGINE_V2 && (wftSyncState.signedIn || driveAccessToken)) {
            setDriveSyncStatus("error", "Offline - will sync later", null, "Local changes are saved on this device.");
        }
    });

    document.addEventListener("visibilitychange", function () {
        if (!WFT_SYNC_ENGINE_V2) return;
        if (document.visibilityState === "hidden") {
            saveWftLocalSnapshotsBeforeHide();
            return;
        }

        if (document.visibilityState === "visible" && shouldPollWftCloudNow()) {
            if (!isDriveSyncAllowed()) return;
            if (isWftTokenExpiringSoon(WFT_TOKEN_EXPIRY_WARNING_MS)) {
                handleWftTokenExpiringSoon();
                return;
            }
            var now = Date.now();
            if (now - wftLastVisibilitySyncAt < WFT_VISIBILITY_SYNC_COOLDOWN_MS) return;
            wftLastVisibilitySyncAt = now;
            syncWftNow("visible", { immediate: false });
        }
    });

    window.addEventListener("beforeunload", function () {
        if (WFT_SYNC_ENGINE_V2) {
            saveWftLocalSnapshotsBeforeHide();
        }
    });
}

// ── WFT Sync Engine V2 session token storage ──
function saveWftTokenSession(token, expiresAt) {
    try {
        sessionStorage.setItem(DRIVE_TOKEN_SESSION_KEY, JSON.stringify({
            accessToken: token,
            tokenExpiresAt: expiresAt
        }));
    } catch (e) { }

    // Access tokens stay in sessionStorage only. localStorage keeps only a
    // harmless connection marker so shared devices do not inherit another
    // user's Drive session after the tab/browser is closed.
    try {
        localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
        localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
        localStorage.setItem(GOOGLE_CONNECTED_CACHE_KEY, "1");
    } catch (e2) { }

    wftSyncState.accessToken = token;
    wftSyncState.tokenExpiresAt = Number(expiresAt || 0);
    wftSyncState.signedIn = !!token;
    driveAccessToken = token;
    scheduleWftTokenExpiryWarning();
}

function restoreWftTokenSession() {
    var raw;
    var saved;
    var token;
    var expiry;

    try {
        raw = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY);
        if (raw) {
            saved = JSON.parse(raw);
            if (saved && saved.accessToken && saved.tokenExpiresAt) {
                token = saved.accessToken;
                expiry = Number(saved.tokenExpiresAt);
            }
        }
    } catch (e) { }

    if (!token || !expiry) { return false; }

    if (Date.now() >= expiry) {
        try { sessionStorage.removeItem(DRIVE_TOKEN_SESSION_KEY); } catch (e3) { }
        try {
            localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
            localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
        } catch (e4) { }
        return false;
    }

    saveWftTokenSession(token, expiry);

    wftSyncState.accessToken = token;
    wftSyncState.tokenExpiresAt = expiry;
    wftSyncState.signedIn = true;

    driveAccessToken = token;

    return true;
}

function clearWftTokenSession() {
    clearWftTokenExpiryWarningTimer();
    try {
        sessionStorage.removeItem(DRIVE_TOKEN_SESSION_KEY);
    } catch (e) { }
    try {
        localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
        localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
    } catch (e2) { }
    try {
        wftSyncState.accessToken = null;
        wftSyncState.tokenExpiresAt = 0;
        wftSyncState.signedIn = false;
        driveAccessToken = null;
    } catch (e3) { }
}

function getWftSessionTokenExpiry() {
    try {
        var raw = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY);
        if (raw) {
            var saved = JSON.parse(raw);
            return Number(saved && saved.tokenExpiresAt ? saved.tokenExpiresAt : 0);
        }
    } catch (e) { }

    return 0;
}

function migrateOldWftTokenToSessionStorage() {
    var token;
    var expiry;

    try {
        token = localStorage.getItem(DRIVE_TOKEN_CACHE_KEY);
        expiry = Number(localStorage.getItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY) || 0);
    } catch (e) {
        return false;
    }

    if (!token || !expiry || expiry <= Date.now()) {
        try {
            localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
            localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
        } catch (e2) { }
        return false;
    }

    if (!WFT_ALLOW_LEGACY_LOCAL_TOKEN_MIGRATION) {
        try {
            localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
            localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
        } catch (e3) { }
        return false;
    }

    saveWftTokenSession(token, expiry);

    try {
        localStorage.removeItem(DRIVE_TOKEN_CACHE_KEY);
        localStorage.removeItem(DRIVE_TOKEN_EXPIRY_CACHE_KEY);
    } catch (e4) { }

    wftSyncState.accessToken = token;
    wftSyncState.tokenExpiresAt = expiry;
    wftSyncState.signedIn = true;
    driveAccessToken = token;
    scheduleWftTokenExpiryWarning();

    return true;
}

function readJsonFileFromDrive(filename, callback) {
    if (!driveAccessToken) return;
    ensureDriveFolder(function(folderId) {
        fetch("https://www.googleapis.com/drive/v3/files?q=name%3D%27" + encodeURIComponent(filename) + "%27+and+%27" + folderId + "%27+in+parents+and+trashed%3Dfalse&fields=files(id)", {
            headers: { Authorization: "Bearer " + driveAccessToken }
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (!(data.files && data.files.length)) {
                if (callback) callback(null);
                return;
            }
            return fetch("https://www.googleapis.com/drive/v3/files/" + data.files[0].id + "?alt=media", {
                headers: { Authorization: "Bearer " + driveAccessToken }
            }).then(function(r) { return r.json(); }).then(function(fileData) {
                if (callback) callback(fileData);
            });
        }).catch(function(e) {
            wftDebugError("Drive read error:", e);
            if (callback) callback(null);
        });
    });
}

function dataUrlToBlob(dataUrl) {
    if (!dataUrl || dataUrl.indexOf(',') === -1) return null;
    var parts = dataUrl.split(',');
    var meta = parts[0] || '';
    var base64 = parts.slice(1).join(',');
    var mimeMatch = meta.match(/data:([^;]+)/);
    var mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}

function sanitizeDriveName(value) {
    return String(value || 'item').replace(/[\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

function uploadBlobToDrive(filename, blob, mimeType, callback) {
    if (!driveAccessToken || !blob) {
        if (callback) callback(null);
        return;
    }
    var currentSyncText = "";
    try {
        var currentSyncEl = document.getElementById("driveSyncTextHeader") || document.getElementById("driveSyncText");
        currentSyncText = currentSyncEl ? currentSyncEl.textContent : "";
    } catch (e) {
        currentSyncText = "";
    }
    if (currentSyncText !== "Uploading portfolio images...") {
        setDriveSyncStatus('syncing', 'Uploading to Google Drive...', 90, 'Sending file to Drive.');
    }
    ensureDriveFolder(function(folderId) {
        var boundary = '----WFTBinaryBoundary' + Date.now();
        var metadata = JSON.stringify({ name: filename, parents: [folderId] });
        var preamble = '--' + boundary + '\r\n'
            + 'Content-Type: application/json\r\n\r\n'
            + metadata + '\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: ' + (mimeType || blob.type || 'application/octet-stream') + '\r\n\r\n';
        var closing = '\r\n--' + boundary + '--';
        var body = new Blob([preamble, blob, closing], { type: 'multipart/related; boundary=' + boundary });
        fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + driveAccessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
            body: body
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (callback) callback(data || null);
        }).catch(function(e) {
            wftDebugError('Drive binary upload error:', e);
            setDriveSyncStatus('error', 'Sync failed');
            if (callback) callback(null);
        });
    });
}

function loadSettingsFromDrive() {
    if (!driveAccessToken) return;
    ensureDriveFolder(function(folderId) {
        fetch("https://www.googleapis.com/drive/v3/files?q=name%3D%27wft-settings.json%27+and+%27" + folderId + "%27+in+parents+and+trashed%3Dfalse&fields=files(id)", {
            headers: { Authorization: "Bearer " + driveAccessToken }
        }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.files && data.files.length > 0) {
                return fetch("https://www.googleapis.com/drive/v3/files/" + data.files[0].id + "?alt=media", {
                    headers: { Authorization: "Bearer " + driveAccessToken }
                }).then(function(r) { return r.json(); }).then(function(settings) {
                    applyLoadedSettings(settings);
                    setDriveSyncStatus("synced", "Settings loaded");
                });
            } else {
                setDriveSyncStatus("synced", "Ready");
            }
        }).catch(function(e) { wftDebugError("Load settings error:", e); });
    });
}

function applyLoadedSettings(settings) {
    if (!settings) return;
    if (settings.model && document.getElementById("modelSelect")) document.getElementById("modelSelect").value = settings.model;
    if (settings.targetWordCount && document.getElementById("targetWordCount")) document.getElementById("targetWordCount").value = settings.targetWordCount;
    if (settings.useWordCountTarget != null && document.getElementById("useWordCountTarget")) document.getElementById("useWordCountTarget").checked = settings.useWordCountTarget;
    if (settings.grammarStrictness && document.getElementById("grammarStrictness")) {
        document.getElementById("grammarStrictness").value = settings.grammarStrictness;
        if (typeof updateGrammarStrictnessDisplay === "function") updateGrammarStrictnessDisplay(settings.grammarStrictness);
        else {
            var valEl = document.getElementById("grammarStrictnessVal");
            if (valEl) valEl.textContent = settings.grammarStrictness;
        }
    }
    if (settings.assessScriptQuality != null && document.getElementById("assessScriptQuality")) {
        document.getElementById("assessScriptQuality").checked = settings.assessScriptQuality;
    }
    if (document.getElementById("classGradeLevelSelect")) {
        var loadedClassGrade = parseGradeLevelValue(settings.classGradeLevel) || 5;
        document.getElementById("classGradeLevelSelect").value = String(loadedClassGrade);
    }
    wftStudentGradeLevelOverride = false;
    if (document.getElementById("gradeLevelSelect")) {
        document.getElementById("gradeLevelSelect").value = String(getClassGradeLevel() || 5);
    }
    maybeApplyClassDefaultsForLegacyGradeSettings(settings);
    applyGradeWordCountRange();
    refreshGradeProfileDescription();
    if (typeof updateGradeLevelResultNote === "function") updateGradeLevelResultNote();
    if (settings.students && Array.isArray(settings.students)) {
        var incomingStudents = cloneWftJson(settings.students);
        var localStudents = Array.isArray(students) ? cloneWftJson(students) : [];
        var mergedStudents = mergeWftStudents(localStudents, incomingStudents);
        var incomingHash = getSettingsFingerprint({ students: incomingStudents });
        var mergedHash = getSettingsFingerprint({ students: mergedStudents });
        var previousSuppress = wftSuppressDirtyMarks;

        students = mergedStudents;

        try {
            wftSuppressDirtyMarks = true;
            saveStudents();
        } catch (e) {
            wftDebugWarn("[WFT Sync] Could not save merged roster locally:", e);
        } finally {
            wftSuppressDirtyMarks = previousSuppress;
        }

        renderStudentList();
        populateStudentDropdown();
        refreshPortfolioDropdown();

        if (!previousSuppress && incomingHash !== mergedHash) {
            markWftSettingsDirty("roster-merge-preserved-local");
            scheduleWftCloudSync("roster-merge-preserved-local");
        }
    }
    refreshScoreWeightingDescription();
}

function saveSettingsToDrive() {
    if (!driveAccessToken) return;
    var settings = getLocalSettingsSnapshot();
    saveFileToDrive("wft-settings.json", JSON.stringify(settings, null, 2), "application/json");
}

function startDriveAutoSync() {
    stopDriveAutoSync();
    driveAutoSyncInterval = setInterval(function() {
        if (driveAccessToken) saveSettingsToDrive();
    }, 60000); // sync every 60 seconds
}

function stopDriveAutoSync() {
    if (driveAutoSyncInterval) {
        clearInterval(driveAutoSyncInterval);
        driveAutoSyncInterval = null;
    }
}

/* --- Student Portfolio Data --- */

function normalizePortfolioData(portfolio) {
    var source = portfolio && typeof portfolio === 'object' ? portfolio : {};
    var normalized = {};
    Object.keys(source).forEach(function(studentName) {
        if (studentName === 'updatedAt' || studentName === '__syncMeta' || studentName === 'syncMeta' || studentName === 'lastSyncedAt' || studentName === 'lastSyncStatus') {
            return;
        }
        var studentData = source[studentName];
        if (!studentData || !Array.isArray(studentData.sessions)) {
            normalized[studentName] = { sessions: [] };
            return;
        }
        normalized[studentName] = { sessions: studentData.sessions.map(function(session, index) {
            var safe = session && typeof session === 'object' ? cloneWftJson(session) : {};
            safe.id = safe.id || ('sess_' + studentName.replace(/\s+/g, '_') + '_' + index + '_' + Date.now());
            safe.date = safe.date || (safe.createdAt ? new Date(safe.createdAt).toLocaleDateString('en-GB') : 'Unknown date');
            safe.title = safe.title || 'Untitled';
            safe.categoryScores = safe.categoryScores || {};
            delete safe.ocrText;
            safe.images = Array.isArray(safe.images) ? safe.images : [];
            for (var i = 0; i < safe.images.length; i++) {
                if (safe.images[i]) {
                    safe.images[i] = cloneWftJson(safe.images[i]);
                    delete safe.images[i].extractedText;
                    safe.images[i].pendingDriveUpload = !safe.images[i].driveFileId;
                }
            }
            return safe;
        }) };
    });
    return normalized;
}

function getPortfolioData() {
    var raw = localStorage.getItem('wft_portfolio');
    if (!raw) return {};
    try { return normalizePortfolioData(JSON.parse(raw)); } catch (e) { return {}; }
}

function stripPortfolioHeavyFields(data) {
    var wftSafeModeActive = (typeof isWftStorageSafeMode === 'function' && isWftStorageSafeMode());
    var normalized = normalizePortfolioData((!wftSafeModeActive && WFT_STORAGE_SCHEMA_VERSION >= 1 && typeof normalizeWftPortfolioForSchemaV1 === 'function') ? normalizeWftPortfolioForSchemaV1(data || {}) : (data || {}));
    Object.keys(normalized).forEach(function(studentName) {
        var sessions = normalized[studentName] && normalized[studentName].sessions ? normalized[studentName].sessions : [];
        sessions.forEach(function(session) {
            if (!session) return;

            // Embedded image data URLs are the most common cause of localStorage quota failures.
            // Keep light metadata so the portfolio entry remains useful without storing megabytes locally.
            if (Array.isArray(session.images)) {
                session.images = session.images.map(function(image, index) {
                    image = image || {};
                    return {
                        id: image.id || ('img_' + (index + 1)),
                        name: image.name || ('image-' + (index + 1) + '.jpg'),
                        mimeType: image.mimeType || '',
                        driveFileId: image.driveFileId || '',
                        pendingDriveUpload: !!image.pendingDriveUpload,
                        dataUrlRemovedForStorage: !!(image.dataUrl || image.originalDataUrl || image.dataUrlRemovedForStorage)
                    };
                });
            }

            // These fields can also grow large. Preserve score/history data first.
            if (typeof session.correctedHtml === 'string' && session.correctedHtml.length > 50000) {
                session.correctedHtml = '';
                session.correctedHtmlRemovedForStorage = true;
            }
            if (typeof session.correctedMarkup === 'string' && session.correctedMarkup.length > 50000) {
                session.correctedMarkup = session.correctedMarkup.slice(0, 50000);
                session.correctedMarkupTruncatedForStorage = true;
            }
            if (typeof session.originalText === 'string' && session.originalText.length > 50000) {
                session.originalText = session.originalText.slice(0, 50000);
                session.originalTextTruncatedForStorage = true;
            }
        });
    });
    return normalized;
}

function stripPortfolioImageDataUrls(data) {
    // Backward-compatible name used by older save paths.
    return stripPortfolioHeavyFields(data);
}

function savePortfolioData(data) {
    var normalized;
    var savedData;
    var wftSafeModeActive = (typeof isWftStorageSafeMode === 'function' && isWftStorageSafeMode());
    try {
        normalized = normalizePortfolioData((!wftSafeModeActive && WFT_STORAGE_SCHEMA_VERSION >= 1 && typeof normalizeWftPortfolioForSchemaV1 === 'function') ? normalizeWftPortfolioForSchemaV1(data || {}) : (data || {}));
    } catch (e) {
        wftDebugError('normalizePortfolioData failed while saving portfolio:', e);
        normalized = {};
    }

    // ── PATCH 2: Proactive heavy-field stripping ──
    if (!wftSafeModeActive && WFT_PROACTIVE_STRIP_V1) {
        try {
            savedData = makePortfolioLocalStorageSafe(normalized);
            localStorage.setItem('wft_portfolio', JSON.stringify(savedData));
        } catch (e) {
            wftDebugWarn('Portfolio localStorage save failed (proactive strip active); retrying.', e);
            try {
                savedData = stripPortfolioHeavyFields(normalized);
                localStorage.setItem('wft_portfolio', JSON.stringify(savedData));
            } catch (e2) {
                wftDebugError('Portfolio save retry without heavy fields also failed:', e2);
                throw e2;
            }
        }
    } else {
        try {
            savedData = normalized;
            localStorage.setItem('wft_portfolio', JSON.stringify(savedData));
        } catch (e) {
            // Large photo data URLs can exceed the browser's localStorage quota.
            // Keep the portfolio session, scores, and notes by retrying without embedded image data.
            wftDebugWarn('Portfolio localStorage save failed; retrying without heavy embedded fields.', e);
            try {
                savedData = stripPortfolioHeavyFields(normalized);
                localStorage.setItem('wft_portfolio', JSON.stringify(savedData));
            } catch (e2) {
                wftDebugError('Portfolio save retry without heavy fields also failed:', e2);
                throw e2;
            }
        }
    }
    // ── WFT Sync V2: use dirty flags + debounced sync instead of direct upload ──
    if (WFT_SYNC_ENGINE_V2 && !wftSafeModeActive && !WFT_SYNC_ENGINE_V2_SAFE_MODE) {
        markWftPortfolioDirty("portfolio-change");
        if (typeof markWftPortfolioIndexDirty === "function") {
            markWftPortfolioIndexDirty("portfolio-change");  // Patch 6
        }
        scheduleWftCloudSync("portfolio-change");
    } else if (!WFT_SYNC_ENGINE_V2 && driveAccessToken) {
        saveFileToDrive('wft-portfolio.json', JSON.stringify(savedData, null, 2), 'application/json');
    }
    return savedData;
}

function loadPortfolioFromDrive() {
    if (WFT_SYNC_ENGINE_V2) return;
    if (!driveAccessToken) return;
    readJsonFileFromDrive('wft-portfolio.json', function(data) {
        if (!data) return;
        var incoming = normalizePortfolioData(data);
        var local = getPortfolioData();
        var merged = mergePortfolioData(local, incoming);
        localStorage.setItem('wft_portfolio', JSON.stringify(merged));
        refreshPortfolioDropdown();
        renderStudentPortfolio();
        setDriveSyncStatus('synced', 'Portfolio loaded');
    });
}

function mergePortfolioData(base, incoming) {
    return mergeWftPortfolios(base || {}, incoming || {}, false);
}

function scoreBadgeColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#2563eb';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
}

function getRubricScoreColorClass(score) {
    if (score == null || score === '-') return 'score-gray';
    var value = Number(score);
    if (isNaN(value)) return 'score-gray';
    if (value >= 9) return 'score-green';
    if (value >= 7) return 'score-blue';
    if (value >= 5) return 'score-amber';
    return 'score-red';
}

function getSessionPlainCorrectedText() {
    if (latestAnalysisData && latestAnalysisData.correctedStory) {
        return stripCorrectionMarkdown(latestAnalysisData.correctedStory).trim();
    }
    var corrected = document.getElementById('correctedStory');
    return corrected ? String(corrected.innerText || corrected.textContent || '').trim() : '';
}

function getSessionImagePayloads() {
    if (!selectedImages || !selectedImages.length) return [];
    return selectedImages.map(function(image, index) {
        return {
            id: 'img_' + (index + 1),
            name: image.name || ('image-' + (index + 1) + '.jpg'),
            mimeType: image.mimeType || 'image/jpeg',
            dataUrl: image.dataUrl || '',
            driveFileId: image.driveFileId || '',
            pendingDriveUpload: !image.driveFileId
        };
    });
}

function reflowCorrectedWritingText(text) {
    var normalized = normalizeCorrectionMarkup(text || "");
    if (!normalized) return "";
    var parts = splitStoryTitleAndBody(normalized);
    function reflowBody(body) {
        var value = String(body || "").replace(/\r\n?/g, "\n").trim();
        if (!value) return "";
        return value.split(/\n{2,}/).map(function(paragraph) {
            return paragraph.replace(/\n+/g, " ").replace(/[ \t]{2,}/g, " ").trim();
        }).filter(function(paragraph) {
            return paragraph.length > 0;
        }).join("\n\n");
    }
    var body = reflowBody(parts.body || (!parts.title ? normalized : ""));
    if (parts.title) return parts.title + (body ? "\n\n" + body : "");
    return body;
}


function isWftSafeInlineStyle(styleValue) {
    var value = String(styleValue || "");
    if (!value) return false;
    if (/expression\s*\(/i.test(value)) return false;
    if (/javascript\s*:/i.test(value)) return false;
    if (/url\s*\(/i.test(value)) return false;
    if (/behavior\s*:/i.test(value)) return false;
    if (/-moz-binding\s*:/i.test(value)) return false;
    return true;
}

function sanitizeWftHtmlFragment(html) {
    var value = String(html || "");
    if (!value) return "";
    if (typeof document === "undefined" || !document.createElement) {
        return escapeHtml(value);
    }

    var allowedTags = {
        "A": true, "B": true, "BR": true, "CODE": true, "DIV": true, "EM": true,
        "H1": true, "H2": true, "H3": true, "H4": true, "H5": true, "H6": true,
        "I": true, "LI": true, "OL": true, "P": true, "PRE": true, "SMALL": true,
        "SPAN": true, "STRONG": true, "TABLE": true, "TBODY": true, "TD": true,
        "TH": true, "THEAD": true, "TR": true, "U": true, "UL": true
    };
    var allowedAttrs = { "class": true, "title": true, "aria-label": true, "role": true, "colspan": true, "rowspan": true };
    var wrapper = document.createElement("div");
    wrapper.innerHTML = value;

    function cleanNode(node) {
        var child = node.firstChild;
        while (child) {
            var next = child.nextSibling;
            if (child.nodeType === 1) {
                var tag = child.tagName;
                if (!allowedTags[tag]) {
                    var textNode = document.createTextNode(child.textContent || "");
                    node.replaceChild(textNode, child);
                    child = next;
                    continue;
                }
                var attrs = Array.prototype.slice.call(child.attributes || []);
                for (var i = 0; i < attrs.length; i++) {
                    var attr = attrs[i];
                    var name = String(attr.name || "").toLowerCase();
                    var attrValue = String(attr.value || "");
                    if (name.indexOf("on") === 0) {
                        child.removeAttribute(attr.name);
                    } else if (name === "href") {
                        if (/^(https?:|mailto:|#)/i.test(attrValue)) child.setAttribute("href", attrValue);
                        else child.removeAttribute(attr.name);
                    } else if (name === "style") {
                        if (isWftSafeInlineStyle(attrValue)) child.setAttribute("style", attrValue);
                        else child.removeAttribute(attr.name);
                    } else if (!allowedAttrs[name] && name.indexOf("data-") !== 0) {
                        child.removeAttribute(attr.name);
                    }
                }
                cleanNode(child);
            } else if (child.nodeType === 8) {
                node.removeChild(child);
            }
            child = next;
        }
    }

    cleanNode(wrapper);
    return wrapper.innerHTML;
}


function setWftSanitizedInnerHtml(target, html, fallbackHtml) {
    var el = typeof target === "string" ? document.getElementById(target) : target;
    if (!el) return;
    var value = html;
    if ((value === null || value === undefined || value === "") && fallbackHtml !== undefined) {
        value = fallbackHtml;
    }
    el.innerHTML = sanitizeWftHtmlFragment(value || "");
}

function textToWftHtml(text) {
    return escapeHtml(text || "").replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
}

function stripInlineTextColorStyles(html) {
    var value = String(html || "");
    if (!value) return "";
    if (typeof document === "undefined" || !document.createElement) {
        return value.replace(/\sstyle=("|')[^"']*\bcolor\s*:[^"']*("|')/gi, "");
    }
    var wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    var nodes = wrapper.querySelectorAll("[style]");
    for (var i = 0; i < nodes.length; i++) {
        var style = nodes[i].getAttribute("style") || "";
        var kept = style.split(";").map(function(part) {
            return part.trim();
        }).filter(function(part) {
            return part && !/^color\s*:/i.test(part);
        });
        if (kept.length) nodes[i].setAttribute("style", kept.join("; "));
        else nodes[i].removeAttribute("style");
    }
    return wrapper.innerHTML;
}

function reflowCorrectedHtmlForDisplay(html) {
    var value = sanitizeWftHtmlFragment(stripInlineTextColorStyles(html || "")).trim();
    if (!value) return "";
    var paragraphMarker = "WFT_PARAGRAPH_MARKER_6E4C2";
    value = value.replace(/(?:\s*<br\s*\/?>(?:\s|&nbsp;)*){2,}/gi, paragraphMarker);
    value = value.replace(/\s*<br\s*\/?>(?:\s|&nbsp;)*/gi, " ");
    value = value.replace(/[ \t\r\n]+/g, " ");
    value = value.replace(new RegExp("\\s*" + paragraphMarker + "\\s*", "g"), "<br><br>");
    return value.trim();
}

function getPortfolioCorrectedHtml(sessionData) {
    if (!sessionData) return '';
    if (sessionData.correctedMarkup) {
        return reflowCorrectedHtmlForDisplay(renderCorrectionMarkdown(reflowCorrectedWritingText(sessionData.correctedMarkup)));
    }
    if (sessionData.correctedPlainText) {
        return reflowCorrectedHtmlForDisplay(buildStoryHtmlWithTitle(reflowCorrectedWritingText(sessionData.correctedPlainText)));
    }
    return reflowCorrectedHtmlForDisplay(sessionData.correctedHtml || '');
}

function buildSessionFeedbackSummary(analysisData) {
    var detailed = analysisData && analysisData.detailed ? analysisData.detailed : {};
    var genreInfo = normalizeWritingGenreInfo((analysisData && analysisData.writingGenre) || detailed.writingGenre || currentWritingGenreInfo || {});
    return {
        strength: sanitizeGenreReferenceInFeedback(detailed.strength || '', genreInfo),
        nextTime: sanitizeGenreReferenceInFeedback(normalizeGrowGoalStrategyForSentence(detailed.nextTime || ''), genreInfo),
        growGoal: sanitizeGenreReferenceInFeedback(detailed.growGoal || '', genreInfo),
        closing: sanitizeGenreReferenceInFeedback(buildEncouragingClosing(analysisData || { detailed: detailed, categoryScores: {} }), genreInfo),
        writingGenre: genreInfo
    };
}

function buildPortfolioDetailedFeedback(analysisData) {
    var detailed = analysisData && analysisData.detailed ? analysisData.detailed : {};
    var sourceCategories = detailed.categories || {};
    var categoryScores = analysisData && analysisData.categoryScores ? analysisData.categoryScores : {};
    var keys = getBasePortfolioCategoryKeys().slice();
    var genreInfo = normalizeWritingGenreInfo((analysisData && analysisData.writingGenre) || detailed.writingGenre || currentWritingGenreInfo || {});
    var output = {
        writingGenre: genreInfo,
        categories: {},
        growGoal: {
            strength: sanitizeGenreReferenceInFeedback(detailed.strength || '', genreInfo),
            strengthCategory: detailed.strengthCategory || '',
            growGoal: sanitizeGenreReferenceInFeedback(detailed.growGoal || '', genreInfo),
            nextTime: sanitizeGenreReferenceInFeedback(normalizeGrowGoalStrategyForSentence(detailed.nextTime || ''), genreInfo),
            closing: sanitizeGenreReferenceInFeedback(detailed.keepWriting || buildEncouragingClosing(analysisData || { detailed: detailed, categoryScores: categoryScores }), genreInfo)
        }
    };

    if (categoryScores && categoryScores["Neatness"] != null && keys.indexOf("Neatness") === -1) {
        keys.push("Neatness");
    }
    Object.keys(sourceCategories).forEach(function(key) {
        if (keys.indexOf(key) === -1) keys.push(key);
    });

    keys.forEach(function(key) {
        var source = sourceCategories[key] || {};
        var savedScore = source.score != null ? source.score : (categoryScores[key] != null ? categoryScores[key] : null);
        if (!sourceCategories[key] && savedScore == null) return;
        var displaySource = cloneWftJson(source);
        if (displaySource.score == null && savedScore != null) displaySource.score = savedScore;
        var feedback = null;
        try {
            if (typeof buildStudentFeedbackForCategory === 'function') {
                feedback = buildStudentFeedbackForCategory(key, displaySource);
            }
        } catch (e) {
            feedback = null;
        }
        output.categories[key] = {
            score: savedScore,
            teacherComment: sanitizeGenreReferenceInFeedback(feedback && feedback.teacherComment ? feedback.teacherComment : (source.teacherComment || source.evidence || ''), genreInfo),
            noticeRows: (feedback && feedback.noticeRows ? feedback.noticeRows.slice(0, 8) : (Array.isArray(source.noticeRows) ? source.noticeRows.slice(0, 8) : normalizeNoticeRows(source.noticeRows || source.patternNotes || []))).map(function(row) {
                row = row || {};
                return { area: row.area || '', comment: sanitizeGenreReferenceInFeedback(row.comment || '', genreInfo) };
            }),
            growthTip: sanitizeGenreReferenceInFeedback(feedback && feedback.growthTip ? feedback.growthTip : (source.growthTip || ''), genreInfo),
            evidence: sanitizeGenreReferenceInFeedback(source.evidence || '', genreInfo)
        };
    });

    return output;
}

function saveStudentSession(studentName, sessionData) {
    if (!studentName) return;
    try { if (typeof normalizeWftSessionForStorage === "function") normalizeWftSessionForStorage(sessionData); } catch (e) {}
    var portfolio = getPortfolioData();
    if (!portfolio[studentName]) portfolio[studentName] = { sessions: [] };
    portfolio[studentName].sessions.push(sessionData);
    if (portfolio[studentName].sessions.length > 50) {
        portfolio[studentName].sessions = portfolio[studentName].sessions.slice(-50);
    }
    savePortfolioData(portfolio);
    if (WFT_INDEXEDDB_CACHE_V1 && typeof WftStorage !== "undefined") {
        try {
            var sid = WFT_STUDENT_ID_MAP_V1 && typeof getOrCreateStudentId === "function" ? getOrCreateStudentId(studentName) : studentName;
            WftStorage.saveStudentPortfolio(sid, portfolio[studentName]);
        } catch (e) {}
    }
    if (document.getElementById('portfolioStudentSelect') && document.getElementById('portfolioStudentSelect').value === studentName) {
        try {
            renderStudentPortfolio();
        } catch (e) {
            wftDebugError('Portfolio saved, but portfolio rendering failed:', e);
        }
    }
}

function removeStudentSession(studentName, sessionId) {
    if (!studentName || sessionId === undefined || sessionId === null || String(sessionId).trim() === "") return;
    var portfolio = getPortfolioData();
    if (!portfolio[studentName] || !Array.isArray(portfolio[studentName].sessions)) return;
    var originalSessions = portfolio[studentName].sessions;
    var sessions = originalSessions;
    var originalLength = sessions.length;
    var targetSession = null;
    var sessionKey = String(sessionId);

    // Capture the session before removing it so deletion sync can record every stable identity.
    for (var t = 0; t < originalSessions.length; t += 1) {
        var candidate = originalSessions[t];
        if (candidate && (String(candidate.id || "") === sessionKey || String(candidate.createdAt || "") === sessionKey)) {
            targetSession = candidate;
            break;
        }
    }

    // Prefer removing by the unique id assigned to each session, with createdAt as a legacy fallback.
    sessions = originalSessions.filter(function(session) {
        return session && String(session.id || "") !== sessionKey && String(session.createdAt || "") !== sessionKey;
    });

    // If nothing was removed (perhaps legacy sessions without an id), fall back to removing by index.
    if (sessions.length === originalLength) {
        var idx = -1;
        for (var i = 0; i < sessions.length; i += 1) {
            if (String(i) === sessionKey) {
                idx = i;
                targetSession = sessions[i] || targetSession;
                break;
            }
        }
        if (idx >= 0) {
            sessions.splice(idx, 1);
        }
    }

    if (sessions.length !== originalLength) {
        recordPortfolioSessionDeletion(studentName, sessionId, targetSession);
    }
    portfolio[studentName].sessions = sessions;
    savePortfolioData(portfolio);
    if (document.getElementById('portfolioStudentSelect') && document.getElementById('portfolioStudentSelect').value === studentName) {
        renderStudentPortfolio();
    }
}

function deletePortfolioSession(studentName, sessionId) {
    if (!studentName || !sessionId) return;
    if (!window.confirm('Remove this piece of writing from the portfolio?')) return;
    removeStudentSession(studentName, sessionId);
}

/*
 * Toggle the visibility of the roster management section on the Teacher Admin page.  When the
 * roster is hidden, the button text will prompt the user to show it.  When the roster is
 * visible, the button text switches to allow hiding it again.  This helps keep the student
 * progress and portfolio section in view without requiring excessive scrolling.
 */
function toggleRosterVisibility() {
    try {
        var roster = document.getElementById('rosterSection');
        var btn = document.getElementById('toggleRosterBtn');
        if (!roster || !btn) return;
        // Determine current state based on computed style or inline display property
        var isHidden = roster.style.display === 'none' || window.getComputedStyle(roster).display === 'none';
        if (isHidden) {
            roster.style.display = '';
            btn.textContent = '🎓 Hide Class Roster';
        } else {
            roster.style.display = 'none';
            btn.textContent = '🎓 Show Class Roster';
        }
    } catch (e) {
        wftDebugError('toggleRosterVisibility error', e);
    }
}

function syncAllToDrive(callback) {
    if (!WFT_SYNC_ENGINE_V2) {
        if (!driveAccessToken) {
            if (callback) callback(false);
            return;
        }
        saveSettingsToDrive();
        savePortfolioData(getPortfolioData());
        syncPendingPortfolioMedia(function() {
            savePortfolioData(getPortfolioData());
            if (callback) callback(true);
        });
        return;
    }

    if (WFT_SYNC_ENGINE_V2_SAFE_MODE || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
        showDriveSyncPausedForSafety();
        if (callback) callback(false);
        return;
    }

    if (!driveAccessToken) {
        setDriveSyncStatus("error", "Please sign in to Google Drive first.", null, "Local data is still saved on this device.");
        if (callback) callback(false);
        return;
    }

    markWftSettingsDirty("sync-all");
    markWftDeletionsDirty("sync-all");
    markWftPortfolioDirty("sync-all");
    if (typeof markWftPortfolioIndexDirty === "function") {
        markWftPortfolioIndexDirty("sync-all");
    }

    syncPendingPortfolioMedia(function() {
        try {
            var normalized = normalizePortfolioData(getPortfolioData());
            localStorage.setItem('wft_portfolio', JSON.stringify(normalized));
        } catch (e) { }
        flushWftCloudSyncNow("sync-all").then(function(result) {
            if (callback) callback(!!result);
        }).catch(function(e) {
            wftDebugError("syncAllToDrive flush failed:", normalizeWftAsyncErrorForLog(e));
            setDriveSyncStatus("error", "Drive sync failed", null, "Local data is still saved. Try syncing again.");
            if (callback) callback(false);
        });
    });
}

// ── WFT Sync Engine V2 image idempotency ──
function ensureWftImageId(image, sessionId, index) {
    if (!image) return image;
    if (image.imageId) return image;

    image.imageId = [
        "img",
        sessionId || "session",
        image.name || image.filename || "image",
        image.size || "",
        index || 0
    ].join("_").replace(/[^a-zA-Z0-9_-]/g, "_");

    return image;
}

function uploadSessionImagesToDrive(studentName, sessionData, callback, skipPortfolioSave) {
    if (!driveAccessToken || !studentName || !sessionData || !sessionData.images || !sessionData.images.length) {
        if (callback) callback();
        return;
    }

    // ── WFT Sync V2 image idempotency ──
    var sessionId = sessionData.id || sessionData.createdAt || "";
    var i;
    for (i = 0; i < sessionData.images.length; i += 1) {
        var img = sessionData.images[i];
        if (img) {
            ensureWftImageId(img, sessionId, i);
            img.pendingDriveUpload = !img.driveFileId;
        }
    }

    var remaining = sessionData.images.filter(function(image) {
        return image && image.pendingDriveUpload && image.dataUrl &&
            !(WFT_IMAGE_IDEMPOTENCY_V2 && image.driveFileId);
    });
    if (!remaining.length) {
        if (callback) callback();
        return;
    }
    var index = 0;
    function nextUpload() {
        if (index >= remaining.length) {
            if (!skipPortfolioSave) savePortfolioData(getPortfolioData());
            if (callback) callback();
            return;
        }
        var imageNumber = index + 1;
        var imageProgress = 88 + Math.min(6, Math.floor(((imageNumber - 1) / remaining.length) * 6));
        setDriveSyncStatus("syncing", "Uploading portfolio images...", imageProgress, "Image " + imageNumber + " of " + remaining.length);
        var image = remaining[index++];
        // ── PATCH 3: Image compression before Drive upload ──
        if (WFT_IMAGE_COMPRESSION_V1) {
            compressPortfolioImageForDrive(image, function(compressErr, compressedBlob) {
                var blob = compressedBlob || dataUrlToBlob(image.dataUrl);
                doUploadImage(blob);
            });
        } else {
            var blob = dataUrlToBlob(image.dataUrl);
            doUploadImage(blob);
        }

        function doUploadImage(blob) {
            var uploadMimeType = blob && blob.type ? blob.type : (image.mimeType || 'application/octet-stream');
            var extension = uploadMimeType.indexOf('png') !== -1 ? '.png' : '.jpg';
            var filename = sanitizeDriveName(studentName) + '__' + sanitizeDriveName(sessionData.date || 'session') + '__' + sanitizeDriveName(image.name || ('image' + index)) + extension;
            uploadBlobToDrive(filename, blob, uploadMimeType, function(result) {
                if (result && result.id) {
                    image.driveFileId = result.id;
                    image.driveName = result.name || image.driveName || filename;
                    image.driveUploadedAt = new Date().toISOString();
                    image.pendingDriveUpload = false;
                    image.dataUrl = '';
                    image.dataUrlRemovedForStorage = true;
                    if (image.originalDataUrl) delete image.originalDataUrl;
                    if (image.extractedText) delete image.extractedText;
                    wftSyncLog("[WFT Media] image uploaded", { imageId: image.imageId || image.id || '', driveFileId: image.driveFileId });
                } else {
                    image.pendingDriveUpload = true;
                    wftSyncLog("[WFT Media] image upload skipped or failed", { imageId: image.imageId || image.id || '', name: image.name || '' });
                }
                nextUpload();
            });
        }
    }
    nextUpload();
}

function syncPendingPortfolioMedia(callback) {
    if (!driveAccessToken) {
        if (callback) callback();
        return;
    }
    var portfolio = getPortfolioData();
    var studentNames = Object.keys(portfolio);
    var i = 0;
    function nextStudent() {
        if (i >= studentNames.length) {
            savePortfolioData(portfolio);
            if (callback) callback();
            return;
        }
        var studentName = studentNames[i++];
        var sessions = portfolio[studentName] && portfolio[studentName].sessions ? portfolio[studentName].sessions : [];
        var j = 0;
        function nextSession() {
            if (j >= sessions.length) {
                nextStudent();
                return;
            }
            var session = sessions[j++];
            uploadSessionImagesToDrive(studentName, session, nextSession);
        }
        nextSession();
    }
    nextStudent();
}

function refreshPortfolioDropdown() {
    var sel = document.getElementById('portfolioStudentSelect');
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = '<option value="">-- Select a student to view progress --</option>';
    students.forEach(function(name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
    if (prev && students.indexOf(prev) !== -1) {
        sel.value = prev;
    }
    updateExportSelectedStudentButton();
}

function updateExportSelectedStudentButton() {
    var btn = document.getElementById('exportSelectedStudentBtn');
    var sel = document.getElementById('portfolioStudentSelect');
    if (!btn || !sel) return;
    btn.disabled = !sel.value;
}

function openStudentPortfolio(name) {
    if (!name) return;
    switchTab('admin');
    var sel = document.getElementById('portfolioStudentSelect');
    if (!sel) return;
    sel.value = name;
    renderStudentPortfolio();
    updateExportSelectedStudentButton();
    var section = document.getElementById('portfolioSection');
    if (section && section.scrollIntoView) {
        if (!window.matchMedia('(max-width: 900px)').matches) { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
}

function getBasePortfolioCategoryKeys() {
    return [
        "Ideas & Details",
        "Grammar",
        "Word Choice",
        "Organization",
        "Flow",
        "Spelling & Punctuation"
    ];
}

function getSessionCategoryKeys(session) {
    var keys = getBasePortfolioCategoryKeys();
    var scores = session && session.categoryScores ? session.categoryScores : {};
    if (scores["Neatness"] != null || (session && (session.neatnessAssessed || session.assessScriptQuality))) {
        if (keys.indexOf("Neatness") === -1) keys.push("Neatness");
    }
    Object.keys(scores).forEach(function(key) {
        if (keys.indexOf(key) === -1) keys.push(key);
    });
    return keys;
}

function getPortfolioCategoryKeys(sessions) {
    var keys = getBasePortfolioCategoryKeys();
    (sessions || []).forEach(function(session) {
        getSessionCategoryKeys(session).forEach(function(key) {
            if (keys.indexOf(key) === -1) keys.push(key);
        });
    });
    return keys;
}

function getCategoryAverageMap(sessions) {
    var averages = {};
    var keys = getPortfolioCategoryKeys(sessions);
    for (var c = 0; c < keys.length; c++) {
        var key = keys[c];
        var values = sessions.map(function(session) {
            return session.categoryScores && session.categoryScores[key] != null ? Number(session.categoryScores[key]) : null;
        }).filter(function(value) { return value != null && !isNaN(value); });
        averages[key] = values.length ? (values.reduce(function(a, b) { return a + b; }, 0) / values.length) : null;
    }
    return averages;
}


function hydratePortfolioDriveImages(root) {
    if (!root || !driveAccessToken) return;
    var imgs = root.querySelectorAll ? root.querySelectorAll('img[data-drive-file-id]') : [];
    for (var i = 0; i < imgs.length; i += 1) {
        (function(img) {
            var fileId = img.getAttribute('data-drive-file-id');
            if (!fileId) return;
            img.alt = img.getAttribute('alt') || 'Student work image';
            fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media', {
                headers: { Authorization: 'Bearer ' + driveAccessToken }
            }).then(function(r) {
                if (!r.ok) throw new Error('Drive image fetch failed: ' + r.status);
                return r.blob();
            }).then(function(blob) {
                var url = URL.createObjectURL(blob);
                img.src = url;
                img.removeAttribute('data-drive-file-id');
                img.setAttribute('data-drive-loaded', 'true');
                var status = img.parentNode ? img.parentNode.querySelector('.drive-image-status') : null;
                if (status) status.textContent = 'Loaded from Drive';
            }).catch(function(e) {
                wftDebugWarn('Could not load portfolio image from Drive:', e);
                var status = img.parentNode ? img.parentNode.querySelector('.drive-image-status') : null;
                if (status) status.textContent = 'Image stored in Drive, but preview could not load.';
            });
        })(imgs[i]);
    }
}

function escapeHtmlAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
}

function isSafeWftImageDataUrl(value) {
    var src = String(value || "").trim();
    if (!src) { return false; }
    var compactSrc = src.replace(/\s+/g, "");
    if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(compactSrc)) { return false; }
    return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(compactSrc);
}

function sanitizeWftDriveFileId(value) {
    var id = String(value || "").trim();
    return /^[A-Za-z0-9_-]+$/.test(id) ? id : "";
}

function renderPortfolioSessionImageHtml(image) {
    image = image || {};
    var name = escapeHtmlAttr(image.name || 'Student work image');
    if (image.dataUrl && isSafeWftImageDataUrl(image.dataUrl)) {
        return '<img src="' + escapeHtmlAttr(image.dataUrl) + '" alt="' + name + '" data-caption="' + name + '" onclick="openImageLightbox(this)" title="Click to enlarge" style="cursor: zoom-in;">';
    }
    if (image.driveFileId) {
        var safeDriveFileId = sanitizeWftDriveFileId(image.driveFileId);
        if (safeDriveFileId) {
            return '<img data-drive-file-id="' + escapeHtmlAttr(safeDriveFileId) + '" alt="' + name + '" data-caption="' + name + '" onclick="openImageLightbox(this)" title="Click to enlarge" style="cursor: zoom-in;"><div class="thumb-caption drive-image-status">Loading from Drive...</div>';
        }
    }
    return '<div class="thumb-caption">Image not available offline.</div>';
}


function getPortfolioDetailedFeedbackForSession(session) {
    if (!session) return null;
    if (session.detailedFeedback && session.detailedFeedback.categories) return session.detailedFeedback;
    return null;
}

function getPortfolioFeedbackCategoryOrder(detailedFeedback, session) {
    var keys = getSessionCategoryKeys(session || {});
    var categories = detailedFeedback && detailedFeedback.categories ? detailedFeedback.categories : {};
    Object.keys(categories).forEach(function(key) {
        if (keys.indexOf(key) === -1) keys.push(key);
    });
    return keys;
}

function renderPortfolioFeedbackRows(rows) {
    rows = normalizeNoticeRows(rows || []);
    if (!rows.length) return '<div class="portfolio-feedback-text">No detailed notes were saved for this part.</div>';
    var html = '<table class="portfolio-feedback-table"><thead><tr><th>Area</th><th>Comment</th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
        html += '<tr><td>' + escapeHtml(rows[i].area || 'Overall') + '</td><td>' + renderMarkdownBold(rows[i].comment || 'No detailed note available yet.') + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
}

function renderPortfolioFeedbackCategoryBlock(key, item, isOpen) {
    item = item || {};
    var scoreText = item.score != null && item.score !== '' ? String(item.score) + '/10' : 'Not scored';
    var teacherComment = item.teacherComment || item.evidence || 'No teacher comment was saved for this category.';
    var growthTip = item.growthTip || 'No growth tip was saved for this category.';
    return ''
        + '<details class="portfolio-feedback-category"' + (isOpen ? ' open' : '') + '>'
        + '<summary>' + escapeHtml(key) + ' - ' + escapeHtml(scoreText) + '</summary>'
        + '<div class="portfolio-feedback-category-body">'
        + '<div class="portfolio-feedback-section"><span class="portfolio-feedback-label">Teacher Comment</span><div class="portfolio-feedback-text">' + renderMarkdownBold(teacherComment) + '</div></div>'
        + '<div class="portfolio-feedback-section"><span class="portfolio-feedback-label">What I noticed</span>' + renderPortfolioFeedbackRows(item.noticeRows || []) + '</div>'
        + '<div class="portfolio-feedback-section"><span class="portfolio-feedback-label">Growth Tip</span><div class="portfolio-feedback-text">' + renderMarkdownBold(growthTip) + '</div></div>'
        + '</div>'
        + '</details>';
}

function renderPortfolioGrowGoalBlock(detailedFeedback, fallbackSummary) {
    var goal = detailedFeedback && detailedFeedback.growGoal ? detailedFeedback.growGoal : {};
    fallbackSummary = fallbackSummary || {};
    var strength = goal.strength || fallbackSummary.strength || '';
    var growGoal = goal.growGoal || fallbackSummary.growGoal || '';
    var nextTime = goal.nextTime || fallbackSummary.nextTime || '';
    var closing = goal.closing || fallbackSummary.closing || '';
    var parts = [];
    if (strength) parts.push('<div class="portfolio-feedback-section"><span class="portfolio-feedback-label">Writing Strength</span><div class="portfolio-feedback-text">' + renderMarkdownBold(strength) + '</div></div>');
    if (growGoal) parts.push('<div class="portfolio-feedback-section"><span class="portfolio-feedback-label">Grow Goal</span><div class="portfolio-feedback-text">' + renderMarkdownBold(growGoal) + '</div></div>');
    if (nextTime) parts.push('<div class="portfolio-feedback-section"><span class="portfolio-feedback-label">Try This Next Time</span><div class="portfolio-feedback-text">' + renderMarkdownBold(normalizeGrowGoalStrategyForSentence(nextTime)) + '</div></div>');
    if (closing) parts.push('<div class="portfolio-feedback-section"><span class="portfolio-feedback-label">Keep Writing</span><div class="portfolio-feedback-text">' + renderMarkdownBold(closing) + '</div></div>');
    if (!parts.length) return '';
    return '<div class="portfolio-feedback-goal"><h3 class="portfolio-feedback-title" style="font-size:1rem;margin-bottom:10px;">Grow Goal Selection</h3>' + parts.join('') + '</div>';
}

function buildPortfolioFeedbackModalShell(title, subtitle, bodyHtml) {
    return ''
        + '<div class="portfolio-feedback-modal" role="dialog" aria-modal="true" aria-label="Detailed writing feedback">'
        + '<div class="portfolio-feedback-header">'
        + '<div><h2 class="portfolio-feedback-title">' + escapeHtml(title || 'Detailed Writing Feedback') + '</h2><div class="portfolio-feedback-subtitle">' + escapeHtml(subtitle || '') + '</div></div>'
        + '<button type="button" class="portfolio-feedback-close" aria-label="Close detailed feedback" onclick="closePortfolioFeedbackModal()">&times;</button>'
        + '</div>'
        + '<div class="portfolio-feedback-body">' + bodyHtml + '</div>'
        + '</div>';
}

function showPortfolioFeedbackModal(html) {
    closePortfolioFeedbackModal();
    var backdrop = document.createElement('div');
    backdrop.id = 'portfolioFeedbackModalBackdrop';
    backdrop.className = 'portfolio-feedback-modal-backdrop';
    backdrop.innerHTML = html;
    backdrop.onclick = function(e) {
        if (e.target === backdrop) closePortfolioFeedbackModal();
    };
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
}

function closePortfolioFeedbackModal() {
    var existing = document.getElementById('portfolioFeedbackModalBackdrop');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var imageLightbox = document.getElementById('imgLightbox');
    if (!imageLightbox || !imageLightbox.classList || !imageLightbox.classList.contains('open')) {
        document.body.style.overflow = '';
    }
}


document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePortfolioFeedbackModal();
});

function openPortfolioDetailedFeedback(studentName, sessionId) {
    var session = findPortfolioSession(studentName, sessionId);
    var detailedFeedback = getPortfolioDetailedFeedbackForSession(session);
    var title = 'Detailed Writing Feedback';
    var subtitle = (session && session.title ? session.title : 'Saved writing') + (session && session.overall != null ? ' - ' + session.overall + '%' : '');
    var bodyHtml = '';
    if (!detailedFeedback) {
        bodyHtml = '<div class="portfolio-feedback-empty">Detailed feedback was not saved for this older portfolio entry.</div>';
        showPortfolioFeedbackModal(buildPortfolioFeedbackModalShell(title, subtitle, bodyHtml));
        return;
    }
    var keys = getPortfolioFeedbackCategoryOrder(detailedFeedback, session);
    var rendered = 0;
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var item = detailedFeedback.categories && detailedFeedback.categories[key];
        if (!item) continue;
        bodyHtml += renderPortfolioFeedbackCategoryBlock(key, item, rendered === 0);
        rendered += 1;
    }
    if (!rendered) bodyHtml += '<div class="portfolio-feedback-empty">No detailed category feedback was saved for this portfolio entry.</div>';
    bodyHtml += renderPortfolioGrowGoalBlock(detailedFeedback, session ? session.feedbackSummary : null);
    showPortfolioFeedbackModal(buildPortfolioFeedbackModalShell(title, subtitle, bodyHtml));
}

function openPortfolioCategoryFeedback(studentName, sessionId, categoryName) {
    var session = findPortfolioSession(studentName, sessionId);
    var detailedFeedback = getPortfolioDetailedFeedbackForSession(session);
    var title = categoryName || 'Category Feedback';
    var subtitle = (session && session.title ? session.title : 'Saved writing') + (session && session.overall != null ? ' - ' + session.overall + '%' : '');
    var bodyHtml = '';
    if (!detailedFeedback || !detailedFeedback.categories || !detailedFeedback.categories[categoryName]) {
        bodyHtml = '<div class="portfolio-feedback-empty">Detailed feedback was not saved for this category.</div>';
    } else {
        bodyHtml = renderPortfolioFeedbackCategoryBlock(categoryName, detailedFeedback.categories[categoryName], true);
    }
    bodyHtml += '<div class="session-feedback-actions" style="margin-top:12px;"><button type="button" class="btn-view-detailed-feedback" data-student="' + escapeHtml(studentName) + '" data-session="' + escapeHtml(sessionId) + '" onclick="openPortfolioDetailedFeedback(this.dataset.student, this.dataset.session)">View Detailed Feedback</button></div>';
    showPortfolioFeedbackModal(buildPortfolioFeedbackModalShell(title, subtitle, bodyHtml));
}

var wftPortfolioChartInstances = {};

function destroyWftPortfolioCharts() {
    var keys = Object.keys(wftPortfolioChartInstances || {});
    for (var i = 0; i < keys.length; i++) {
        var chart = wftPortfolioChartInstances[keys[i]];
        if (chart && typeof chart.destroy === "function") {
            try { chart.destroy(); } catch (e) { }
        }
        delete wftPortfolioChartInstances[keys[i]];
    }
}

function showWftChartUnavailableMessage(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.parentNode) return;
    var msg = document.createElement("div");
    msg.className = "portfolio-empty";
    msg.textContent = "Progress chart unavailable because the chart library did not load.";
    canvas.parentNode.replaceChild(msg, canvas);
}

function renderStudentPortfolio() {
    var sel = document.getElementById('portfolioStudentSelect');
    var contentEl = document.getElementById('portfolioContent');
    if (!sel || !contentEl) return;
    destroyWftPortfolioCharts();
    updateExportSelectedStudentButton();
    var name = sel.value;
    if (!name) {
        contentEl.innerHTML = '<div class="portfolio-empty">Select a student above to view their progress charts and session history.</div>';
        return;
    }
    if (WFT_ASYNC_PORTFOLIO_ACCESS_V1 && !renderStudentPortfolio._syncRender) {
        contentEl.innerHTML = '<div class="portfolio-empty">Loading student portfolio...</div>';
        loadStudentPortfolioAsync(name).then(function(studentData) {
            renderStudentPortfolio._asyncStudentData = studentData || { sessions: [] };
            renderStudentPortfolio._syncRender = true;
            try { renderStudentPortfolio(); }
            finally {
                renderStudentPortfolio._syncRender = false;
                renderStudentPortfolio._asyncStudentData = null;
            }
        }).catch(function(e) {
            wftDebugError('[AsyncPortfolio] Could not load student portfolio:', e);
            contentEl.innerHTML = '<div class="portfolio-empty">Could not load this student portfolio. Using local data if available.</div>';
            renderStudentPortfolio._syncRender = true;
            try { renderStudentPortfolio(); }
            finally { renderStudentPortfolio._syncRender = false; }
        });
        return;
    }
    var portfolio = renderStudentPortfolio._asyncStudentData ? null : getPortfolioData();
    var studentData = renderStudentPortfolio._asyncStudentData || (portfolio ? portfolio[name] : null);
    if (!studentData || !studentData.sessions || studentData.sessions.length === 0) {
        contentEl.innerHTML = '<div class="portfolio-empty">No sessions recorded yet for ' + escapeHtml(name) + '. Analyze a piece of their writing, then press Sync to Portfolio to save it here.</div>';
        return;
    }
    var sessions = studentData.sessions.slice().sort(function(a, b) {
        var aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        var bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return aTime - bTime;
    });
    var latestSession = sessions[sessions.length - 1];
    var prevSession = sessions.length >= 2 ? sessions[sessions.length - 2] : null;
    var overalls = sessions.map(function(session) { return session.overall != null ? Number(session.overall) : null; }).filter(function(value) { return value != null && !isNaN(value); });
    var avgOverall = overalls.length ? Math.round(overalls.reduce(function(a, b) { return a + b; }, 0) / overalls.length) : null;
    var latestOverall = latestSession.overall != null ? Number(latestSession.overall) : null;
    var prevOverall = prevSession && prevSession.overall != null ? Number(prevSession.overall) : null;
    var trend = latestOverall != null && prevOverall != null ? latestOverall - prevOverall : null;
    var bestOverall = overalls.length ? Math.max.apply(null, overalls) : null;
    var categoryAverages = getCategoryAverageMap(sessions);
    var weakestCategory = null;
    var strongestCategory = null;
    var portfolioCategoryKeys = getPortfolioCategoryKeys(sessions);
    portfolioCategoryKeys.forEach(function(key) {
        if (categoryAverages[key] == null) return;
        if (strongestCategory == null || categoryAverages[key] > categoryAverages[strongestCategory]) strongestCategory = key;
        if (weakestCategory == null || categoryAverages[key] < categoryAverages[weakestCategory]) weakestCategory = key;
    });
    var trendHtml = '';
    if (trend != null) {
        if (trend > 0) trendHtml = '<div class="stat-trend trend-up">+' + trend + '% vs last</div>';
        else if (trend < 0) trendHtml = '<div class="stat-trend trend-down">' + trend + '% vs last</div>';
        else trendHtml = '<div class="stat-trend trend-flat">Same as last</div>';
    }
    var statsHtml = '<div class="portfolio-stats-grid">'
        + '<div class="portfolio-stat-card"><div class="stat-label">Latest Score</div><div class="stat-value">' + (latestOverall != null ? latestOverall + '%' : '-') + '</div>' + trendHtml + '</div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Average Score</div><div class="stat-value">' + (avgOverall != null ? avgOverall + '%' : '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Best Score</div><div class="stat-value">' + (bestOverall != null ? bestOverall + '%' : '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Submissions</div><div class="stat-value">' + sessions.length + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Strongest Area</div><div class="stat-value" style="font-size:0.85rem;">' + escapeHtml(strongestCategory || '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Focus Area</div><div class="stat-value" style="font-size:0.85rem;">' + escapeHtml(weakestCategory || '-') + '</div></div>'
        + '</div>';

    var labels = sessions.map(function(session, i) {
        return session.date || ('Session ' + (i + 1));
    });
    var overallData = sessions.map(function(session) { return session.overall != null ? Number(session.overall) : null; });
    var chartId = 'portfolioOverallChart_' + Date.now();
    var catChartId = 'portfolioCatChart_' + Date.now();
    var colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b', '#db2777'];
    var catDatasets = portfolioCategoryKeys.map(function(key, idx) {
        var color = colors[idx % colors.length];
        return {
            label: key,
            data: sessions.map(function(session) {
                return session.categoryScores && session.categoryScores[key] != null ? Number(session.categoryScores[key]) : null;
            }),
            borderColor: color,
            backgroundColor: color + '22',
            tension: 0.35,
            fill: false,
            pointRadius: 3
        };
    });

    var sessionCardsHtml = '';
    for (var si = sessions.length - 1; si >= 0; si--) {
        var sess = sessions[si];
        var scoreColor = scoreBadgeColor(sess.overall);
        var chipsHtml = '';
        var sessionId = sess.id || sess.createdAt || String(si);
        getSessionCategoryKeys(sess).forEach(function(key) {
            var value = sess.categoryScores && sess.categoryScores[key] != null ? sess.categoryScores[key] : '-';
            var chipClass = getRubricScoreColorClass(value);
            chipsHtml += '<button type="button" class="session-chip session-chip-btn ' + chipClass + '" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sessionId) + '" data-category="' + escapeHtml(key) + '" onclick="openPortfolioCategoryFeedback(this.dataset.student, this.dataset.session, this.dataset.category)"><strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(String(value)) + (value !== '-' ? '/10' : '') + '</button>';
        });
        var detailedFeedbackButtonHtml = '<div class="session-feedback-actions"><button type="button" class="btn-view-detailed-feedback" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sessionId) + '" onclick="openPortfolioDetailedFeedback(this.dataset.student, this.dataset.session)">View Detailed Feedback</button></div>';
        var feedback = sess.feedbackSummary || {};
        var imageStripHtml = '';
        if (sess.images && sess.images.length) {
            imageStripHtml = '<div class="session-photo-strip">' + sess.images.map(function(image) {
                return '<div class="session-photo-thumb">'
                    + renderPortfolioSessionImageHtml(image)
                    + '<div class="thumb-caption">' + escapeHtml(image.name || 'Image') + (image.pendingDriveUpload ? '<br>Waiting to sync to Drive' : (image.driveFileId ? '<br>Stored in Drive' : '')) + '</div>'
                    + '</div>';
            }).join('') + '</div>';
        }
        var sessClassGradeLabel = sess.classGradeLabel || (sess.assessmentSettings && sess.assessmentSettings.classGradeLabel) || sess.gradeLabel || ('Grade ' + (sess.gradeLevel || 5));
        var sessGrammarValue = sess.grammarStrictness || (sess.assessmentSettings && sess.assessmentSettings.grammarStrictness) || 3;
        var sessGrammarLabel = (sess.assessmentSettings && sess.assessmentSettings.grammarStrictnessLabel) || (typeof formatGrammarStrictnessLabel === 'function' ? formatGrammarStrictnessLabel(sessGrammarValue) : ('Level ' + sessGrammarValue));
        var sessTargetValue = sess.targetWords != null ? sess.targetWords : (sess.assessmentSettings && sess.assessmentSettings.targetWordCount);
        var sessTargetLabel = typeof formatTargetWordCountLabel === 'function' ? formatTargetWordCountLabel(sessTargetValue, sessTargetValue > 0) : (sessTargetValue > 0 ? (sessTargetValue + ' words') : 'Not used');
        sessionCardsHtml += '<div class="session-card">'
            + '<div class="session-card-header">'
            + '<div class="session-card-title-wrap"><div class="session-date">' + escapeHtml(sess.date || 'Unknown date') + '</div><span class="session-title">' + escapeHtml(sess.title || 'Untitled') + '</span></div>'
            + '<div class="session-score" style="color:' + scoreColor + ';border-color:' + scoreColor + '33;">' + (sess.overall != null ? sess.overall + '%' : 'N/A') + '</div>'
            + '</div>'
            + '<div class="session-meta">Class grade: ' + escapeHtml(sessClassGradeLabel) + ' - Grammar: ' + escapeHtml(sessGrammarLabel) + ' - Target: ' + escapeHtml(sessTargetLabel) + ' - ' + escapeHtml((sess.sourceType || 'typed').replace('+', ' + ')) + ' submission' + (sess.createdAt ? ' - ' + escapeHtml(new Date(sess.createdAt).toLocaleString()) : '') + ' - Writing type: ' + escapeHtml(getWritingGenreInfoFromSession(sess).mainGenre) + '</div>'
            + '<div class="session-chip-row">' + chipsHtml + '</div>'
            + detailedFeedbackButtonHtml
            + '<div class="session-artifact-grid">'
            + '<div class="session-artifact-box"><h5>Original Writing</h5><pre>' + escapeHtml(sess.originalText || '') + '</pre></div>'
            + '<div class="session-artifact-box"><h5>Corrected Writing</h5><div class="session-rich-html corrected-writing-html">' + getPortfolioCorrectedHtml(sess) + '</div></div>'
            + '<div class="session-artifact-box"><h5>Teacher Notes</h5><div class="session-rich-html">' + renderSimpleMarkdown([feedback.strength ? ('Strength: ' + feedback.strength) : '', feedback.nextTime ? ('Next step: ' + feedback.nextTime) : '', feedback.growGoal ? ('Goal: ' + feedback.growGoal) : '', feedback.closing ? ('Encouragement: ' + feedback.closing) : ''].filter(function(line) { return line; }).join('\n\n') || 'No notes saved.') + '</div></div>'
            + '</div>'
            + imageStripHtml
            + '<div class="session-card-actions">'
            + '<button type="button" class="btn-reprint" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sess.id || sess.createdAt || String(si)) + '" onclick="printPortfolioNotebookSummary(this.dataset.student, this.dataset.session)">Re-print Notebook Summary</button>'
            + '<button type="button" class="btn-reassess" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sess.id || sess.createdAt || String(si)) + '" onclick="reassessPortfolioSession(this.dataset.student, this.dataset.session)">Reassess Writing</button>'
            + '<button type="button" class="btn-delete" data-student="' + escapeHtml(name) + '" data-session="' + escapeHtml(sess.id || sess.createdAt || String(si)) + '" onclick="deletePortfolioSession(this.dataset.student, this.dataset.session)">Remove from Portfolio</button>'
            + '</div>'
            + '</div>';
    }

    contentEl.innerHTML = statsHtml
        + '<div class="portfolio-charts-row">'
        + '<div class="portfolio-chart-wrap"><h4>Overall Score Over Time</h4><canvas id="' + chartId + '" class="portfolio-chart-canvas"></canvas></div>'
        + '<div class="portfolio-chart-wrap"><h4>Category Scores Over Time</h4><canvas id="' + catChartId + '" class="portfolio-chart-canvas"></canvas></div>'
        + '</div>'
        + '<div class="portfolio-sessions-list"><h4>Saved Work</h4>' + sessionCardsHtml + '</div>';

    hydratePortfolioDriveImages(contentEl);

    setTimeout(function() {
        if (typeof Chart === 'undefined') {
            showWftChartUnavailableMessage(chartId);
            showWftChartUnavailableMessage(catChartId);
            return;
        }
        var validOverall = overallData.filter(function(v) { return v != null; });
        var overallMin = validOverall.length ? Math.max(0, Math.floor((Math.min.apply(null, validOverall) - 10) / 10) * 10) : 0;
        var overallMax = validOverall.length ? Math.min(100, Math.ceil((Math.max.apply(null, validOverall) + 10) / 10) * 10) : 100;
        var allCatValues = catDatasets.reduce(function(acc, ds) {
            return acc.concat(ds.data.filter(function(v) { return v != null; }));
        }, []);
        var catMin = allCatValues.length ? Math.max(0, Math.floor(Math.min.apply(null, allCatValues) - 1)) : 0;
        var catMax = allCatValues.length ? Math.min(10, Math.ceil(Math.max.apply(null, allCatValues) + 0.5)) : 10;
        var ctxOverall = document.getElementById(chartId);
        if (ctxOverall) {
            wftPortfolioChartInstances.overall = new Chart(ctxOverall, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Overall %',
                        data: overallData,
                        borderColor: '#2563eb',
                        backgroundColor: '#2563eb22',
                        tension: 0.35,
                        fill: true,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    scales: { y: { min: overallMin, max: overallMax, ticks: { callback: function(v) { return v + '%'; } } } },
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(c) { return c.parsed.y + '%'; } } } }
                }
            });
        }
        var ctxCat = document.getElementById(catChartId);
        if (ctxCat) {
            wftPortfolioChartInstances.categories = new Chart(ctxCat, {
                type: 'line',
                data: { labels: labels, datasets: catDatasets },
                options: {
                    responsive: true,
                    scales: { y: { min: catMin, max: catMax, ticks: { callback: function(v) { return v + '/10'; }, stepSize: 1 } } },
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                }
            });
        }
    }, 50);
}

function saveCurrentSessionToPortfolio(analysisData) {
    if (!analysisData) return;
    var student = getActivePortfolioStudentName() || null;
    if (!student) {
        clearPendingPortfolioSync();
        if (driveAccessToken) {
            setDriveSyncStatus('error', 'Select a student before syncing');
        }
        return;
    }
    var now = new Date();
    var savedCategoryScores = analysisData.categoryScores || {};
    var neatnessAssessed = !!(savedCategoryScores["Neatness"] != null);
    var notebookDecisions = analysisData._notebookDecisions;
    if (!(typeof isNotebookDecisionsV1 === "function" && isNotebookDecisionsV1(notebookDecisions))) {
        notebookDecisions = typeof buildNotebookDecisions === "function" ? buildNotebookDecisions(analysisData) : null;
        if (notebookDecisions) analysisData._notebookDecisions = notebookDecisions;
    }
    var sessionData = {
        id: 'sess_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 8),
        createdAt: now.toISOString(),
        date: now.toLocaleDateString('en-GB'),
        title: getPreferredWritingTitle(
            (document.getElementById('studentWriting') || {}).value || '',
            analysisData.detailed && analysisData.detailed.titleSuggestion
        ) || 'Untitled',
        overall: analysisData.overall,
        gradeLevel: analysisData.gradeLevel || getActiveGradeLevel(),
        gradeLabel: analysisData.gradeLabel || (getGradeProfile().gradeLabel || getGradeProfile().label),
        gradeTier: analysisData.gradeTier || getGradeProfile().tier,
        gradeProfileVersion: analysisData.gradeProfileVersion || GRADE_PROFILE_VERSION,
        classGradeLevel: analysisData.classGradeLevel || (analysisData.assessmentSettings && analysisData.assessmentSettings.classGradeLevel) || (typeof getClassGradeLevel === "function" ? getClassGradeLevel() : analysisData.gradeLevel),
        classGradeLabel: analysisData.classGradeLabel || (analysisData.assessmentSettings && analysisData.assessmentSettings.classGradeLabel) || (typeof formatGradeLevelLabel === "function" ? formatGradeLevelLabel(analysisData.classGradeLevel || analysisData.gradeLevel || 5) : (analysisData.gradeLabel || "Grade 5")),
        grammarStrictness: analysisData.grammarStrictness || (analysisData.assessmentSettings && analysisData.assessmentSettings.grammarStrictness) || (typeof getGrammarStrictness === "function" ? getGrammarStrictness() : 3),
        targetWords: analysisData.targetWords || 0,
        actualWords: analysisData.actualWords || countWords(String((document.getElementById('studentWriting') || {}).value || '')),
        assessmentSettings: cloneWftJson(analysisData.assessmentSettings || {}),
        categoryScores: savedCategoryScores,
        assessScriptQuality: neatnessAssessed,
        neatnessAssessed: neatnessAssessed,
        originalText: String((document.getElementById('studentWriting') || {}).value || ''),
        correctedHtml: correctedHtmlForDiff || '',
        correctedMarkup: analysisData.correctedStory || '',
        correctedPlainText: getSessionPlainCorrectedText(),
        writingGenreInfo: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || detectWritingGenreInfo(String((document.getElementById('studentWriting') || {}).value || ''))),
        writingGenre: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).mainGenre,
        writingSubtype: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).subtype,
        writingSafeReference: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).safeReference,
        genreConfidence: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).confidence,
        feedbackSummary: buildSessionFeedbackSummary(analysisData),
        detailedFeedback: buildPortfolioDetailedFeedback(analysisData),
        notebookDecisions: notebookDecisions ? cloneWftJson(notebookDecisions) : null,
        notebookGuide: cloneWftJson(analysisData.notebookGuide || null),
        notebookGuideVersion: analysisData.notebookGuideVersion || (typeof NOTEBOOK_GUIDE_VERSION !== "undefined" ? NOTEBOOK_GUIDE_VERSION : 2),
        sourceType: selectedImages && selectedImages.length ? 'typed+photo' : 'typed',
        images: getSessionImagePayloads(),
        notebookPrintHtml: captureNotebookPrintSnapshotForCurrentAnalysis()
    };
    var replaceSource = activePortfolioReassessmentSource ? cloneWftJson(activePortfolioReassessmentSource) : null;
    if (replaceSource) {
        var sourceStudentName = replaceSource.sourceStudentName || replaceSource.studentName || "";
        var sourceSessionId = replaceSource.sourceSessionId || replaceSource.sessionId || "";
        if (sourceStudentName && sourceStudentName !== student) {
            clearActivePortfolioReassessmentState("student-changed-before-save");
            setDriveSyncStatus('error', 'Reassessment was not saved because the selected student changed');
            alert('The reassessment was not saved because the selected student changed. This prevents creating a duplicate portfolio entry.');
            return;
        }
        var sourcePortfolio = getPortfolioData();
        var sourceMatch = getPortfolioSessionMatchFromData(sourcePortfolio, sourceStudentName, sourceSessionId, replaceSource.sourceCreatedAt);
        if (!sourceMatch) {
            clearActivePortfolioReassessmentState("source-missing-before-save");
            setDriveSyncStatus('error', 'Original portfolio entry not found');
            alert('The original portfolio entry could not be found, so the reassessment was not saved. This prevents creating a duplicate entry.');
            return;
        }
        replaceSource.sourceOriginalId = sourceMatch.session.id || replaceSource.sourceOriginalId || "";
        replaceSource.sourceCreatedAt = sourceMatch.session.createdAt || replaceSource.sourceCreatedAt || "";
        replaceSource.sourceOriginalText = Object.prototype.hasOwnProperty.call(replaceSource, 'sourceOriginalText') ? replaceSource.sourceOriginalText : (sourceMatch.session.originalText || "");
        replaceSource.sourceTargetWords = sourceMatch.session.targetWords != null ? sourceMatch.session.targetWords : replaceSource.sourceTargetWords;
        replaceSource.sourceAssessmentSettings = cloneWftJson(sourceMatch.session.assessmentSettings || replaceSource.sourceAssessmentSettings || {});
    }

    pendingPortfolioSync = {
        studentName: student,
        sessionData: sessionData,
        signature: getCurrentPortfolioSessionSignature(),
        replaceSource: replaceSource
    };
    clearActivePortfolioReassessmentState("pending-sync-created");
    persistPendingPortfolioSync();
    updateSyncPortfolioButtonState();
    setDriveSyncStatus('syncing', replaceSource ? 'Ready to replace portfolio entry' : 'Ready to sync to portfolio');
}

var manualSyncInProgress = false;

function setSyncButtonsBusy(isBusy, busyLabel) {
    var ids = ['syncPortfolioBtnTop', 'syncPortfolioBtnBottom'];
    var thinkingIds = [];
    for (var i = 0; i < ids.length; i++) {
        var btn = document.getElementById(ids[i]);
        if (!btn) continue;
        btn.classList.remove('btn-ready');
        var label = btn.querySelector('.sync-label');
        if (isBusy) {
            btn.classList.add('is-syncing');
            btn.classList.remove('synced-done');
            btn.disabled = true;
            if (label) label.textContent = busyLabel || 'Syncing...';
        } else {
            btn.classList.remove('is-syncing');
            btn.classList.add('synced-done');
            btn.disabled = true;
            if (label) label.textContent = 'Synced';
        }
    }
    for (var j = 0; j < thinkingIds.length; j++) {
        var el = document.getElementById(thinkingIds[j]);
        if (el) { if (isBusy) el.classList.add('show'); else el.classList.remove('show'); }
    }
    if (!isBusy) {
        updateSyncPortfolioButtonState();
    }
}

function setSyncButtonsFailure(failureLabel) {
    var pending = getPendingPortfolioSync();
    var ids = ['syncPortfolioBtnTop', 'syncPortfolioBtnBottom'];
    var thinkingIds = [];
    for (var i = 0; i < ids.length; i++) {
        var btn = document.getElementById(ids[i]);
        if (!btn) continue;
        var label = btn.querySelector('.sync-label');
        btn.classList.remove('is-syncing', 'synced-done');
        if (pending) {
            btn.classList.add('btn-ready');
            btn.disabled = false;
            if (label) label.textContent = failureLabel || 'Retry Sync to Portfolio';
        } else {
            btn.classList.remove('btn-ready');
            btn.disabled = true;
            if (label) label.textContent = failureLabel || 'Sync failed';
        }
    }
    for (var j = 0; j < thinkingIds.length; j++) {
        var el = document.getElementById(thinkingIds[j]);
        if (el) el.classList.remove('show');
    }
}


function pendingPortfolioSessionHasUploadableImages(pending) {
    var images = pending && pending.sessionData && pending.sessionData.images;
    if (!images || !images.length) return false;
    for (var i = 0; i < images.length; i += 1) {
        if (images[i] && images[i].dataUrl && !images[i].driveFileId) return true;
    }
    return false;
}

function uploadPendingPortfolioMediaBeforeCommit(callback) {
    var pending = getPendingPortfolioSync();
    if (!pending || !pending.studentName || !pending.sessionData) {
        if (callback) callback(false);
        return;
    }
    if (!driveAccessToken) {
        if (callback) callback(false);
        return;
    }
    if (!pendingPortfolioSessionHasUploadableImages(pending)) {
        if (callback) callback(false);
        return;
    }

    wftSyncLog("[WFT Media] pending image upload before portfolio commit", {
        studentName: pending.studentName,
        sessionId: pending.sessionData.id || pending.sessionData.createdAt || '',
        imageCount: pending.sessionData.images ? pending.sessionData.images.length : 0
    });
    setDriveSyncStatus('syncing', 'Preparing portfolio images...', 88, 'Images are being saved to Drive before the portfolio record is synced.');
    uploadSessionImagesToDrive(pending.studentName, pending.sessionData, function() {
        // Persist the updated pending session after successful media upload metadata is added.
        // At this point uploaded images have driveFileId values and their dataUrl values have been cleared.
        try {
            persistPendingPortfolioSync();
        } catch (e) {
            wftDebugWarn('Could not persist pending portfolio after media upload; continuing with in-memory data.', e);
        }
        if (callback) callback(true);
    }, true);
}

function manualSaveToDrive() {
    wftSyncLog("[WFT Sync] manualSaveToDrive requested", getWftSyncDebugSnapshot());
    if (manualSyncInProgress) {
        wftSyncLog("[WFT Sync] manualSaveToDrive ignored - already in progress");
        return;
    }
    try {
        prepareCurrentAnalysisForPortfolioSync();
    } catch (ePrepareBeforeDrive) {
        wftDebugError('Could not prepare portfolio sync:', ePrepareBeforeDrive);
        setSyncButtonsFailure('Retry Sync to Portfolio');
        setDriveSyncStatus('error', 'Could not prepare portfolio sync');
        return;
    }
    if (WFT_SYNC_ENGINE_V2 && (WFT_SYNC_ENGINE_V2_SAFE_MODE || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()))) {
        showDriveSyncPausedForSafety();
        return;
    }

    if (!ensureFreshWftDriveTokenBeforeSync("explicit-sync-to-portfolio")) {
        wftSyncLog("[WFT Sync] manualSaveToDrive waiting for fresh Drive access");
        return;
    }

    manualSyncInProgress = true;
    setSyncButtonsBusy(true, 'Syncing...');
    setDriveSyncStatus('syncing', 'Syncing saved work...', 5, 'Saving the current writing record to Drive.');

    var hadPendingBeforeCommit = !!getPendingPortfolioSync();
    var committedPending = false;

    function finishManualSaveToDrive() {
        try {
            committedPending = commitPendingPortfolioSync();
            wftSyncLog("[WFT Sync] manualSaveToDrive committed pending portfolio", committedPending);
        } catch (e) {
            wftDebugError('Portfolio commit failed before Drive sync:', e);
            wftSyncLog("[WFT Sync] portfolio commit failed before Drive sync", {
                name: e && e.name ? e.name : '',
                message: e && e.message ? e.message : String(e),
                stack: e && e.stack ? e.stack : ''
            });
            manualSyncInProgress = false;
            setSyncButtonsFailure('Retry Sync to Portfolio');
            setDriveSyncStatus('error', 'Portfolio save failed before Drive sync');
            return;
        }

        if (hadPendingBeforeCommit && !committedPending) {
            manualSyncInProgress = false;
            setSyncButtonsFailure('Retry Sync to Portfolio');
            setDriveSyncStatus('error', 'Portfolio save failed before Drive sync');
            return;
        }

        // ── WFT Sync V2: use immediate flush for explicit Sync to Portfolio ──
        if (WFT_SYNC_ENGINE_V2) {
            if (WFT_SYNC_ENGINE_V2_SAFE_MODE || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) {
                manualSyncInProgress = false;
                setSyncButtonsFailure('Retry Sync to Portfolio');
                showDriveSyncPausedForSafety();
                return;
            }
            markWftSettingsDirty("explicit-sync-to-portfolio");
            markWftDeletionsDirty("explicit-sync-to-portfolio");
            markWftPortfolioDirty("explicit-sync-to-portfolio");
            if (typeof markWftPortfolioIndexDirty === "function") {
                markWftPortfolioIndexDirty("explicit-sync-to-portfolio");
            }
            syncPendingPortfolioMedia(function() {
                flushWftCloudSyncNow("explicit-sync-to-portfolio").then(function (result) {
                    wftSyncLog("[WFT Sync] manualSaveToDrive flush result", result, getWftSyncDebugSnapshot());
                    manualSyncInProgress = false;
                    if (!result) {
                        setSyncButtonsFailure('Retry Sync to Portfolio');
                        setDriveSyncStatus('error', committedPending ? 'Saved locally - Drive sync failed' : 'Manual sync failed', null, 'Local data is still saved. Try syncing again.');
                    } else {
                        setSyncButtonsBusy(false);
                        finishDriveSyncProgress(committedPending ? 'Portfolio synced' : 'Manual sync complete');
                    }
                }).catch(function (e) {
                    wftDebugError('Manual Drive flush failed:', e);
                    wftSyncLog("[WFT Sync] manualSaveToDrive flush threw", {
                        name: e && e.name ? e.name : '',
                        message: e && e.message ? e.message : String(e),
                        stack: e && e.stack ? e.stack : ''
                    }, getWftSyncDebugSnapshot());
                    manualSyncInProgress = false;
                    setSyncButtonsFailure('Retry Sync to Portfolio');
                    setDriveSyncStatus('error', committedPending ? 'Saved locally - Drive sync failed' : 'Manual sync failed', null, 'Local data is still saved. Try syncing again.');
                });
            });
            return;
        }

        syncAllToDrive(function(success) {
            manualSyncInProgress = false;
            if (success === false) {
                setSyncButtonsFailure('Retry Sync to Portfolio');
                setDriveSyncStatus('error', committedPending ? 'Saved locally - Drive sync failed' : 'Manual sync failed', null, 'Local data is still saved. Try syncing again.');
                return;
            }
            setSyncButtonsBusy(false);
            finishDriveSyncProgress(committedPending ? 'Portfolio synced' : 'Manual sync complete');
        });
    }

    if (hadPendingBeforeCommit && pendingPortfolioSessionHasUploadableImages(getPendingPortfolioSync())) {
        uploadPendingPortfolioMediaBeforeCommit(function() {
            finishManualSaveToDrive();
        });
    } else {
        finishManualSaveToDrive();
    }
}

/* =============================================
   ZEN MODE TOGGLE
============================================= */
var zenModeActive = false;
function toggleZenMode() {
    var ta = document.getElementById('studentWriting');
    var btn = document.getElementById('expandTextBtn');
    zenModeActive = !zenModeActive;
    if (zenModeActive) {
        ta.classList.add('zen-mode');
        if (btn) { btn.textContent = 'Collapse'; btn.style.display = 'block'; }
    } else {
        ta.classList.remove('zen-mode');
        if (btn) { btn.textContent = 'Expand'; }
        checkExpandBtnVisibility();
    }
    if (typeof autoResizeStudentWriting === 'function') {
        autoResizeStudentWriting();
    }
}
function checkExpandBtnVisibility() {
    var ta = document.getElementById('studentWriting');
    var btn = document.getElementById('expandTextBtn');
    if (!ta || !btn) return;
    if (zenModeActive) { btn.style.display = 'block'; return; }
    btn.style.display = (ta.scrollHeight > ta.clientHeight + 8) ? 'block' : 'none';
}

/* =============================================
   STATUS BAR UPDATE
   Called from the patched updateMeter
============================================= */
function updateStatusBar(words, target, targetEnabled, fillWidth, fillBackground, badgeText) {
    var sbWordCount = document.getElementById('statusBarWordCount');
    var sbStatus    = document.getElementById('statusBarStatus');
    var sbFill      = document.getElementById('statusBarMeterFill');
    if (sbWordCount) sbWordCount.textContent = words + ' words';
    if (sbStatus)    sbStatus.textContent    = badgeText || 'Start typing...';
    if (sbFill) {
        sbFill.style.width = fillWidth || '0%';
        sbFill.style.background = fillBackground || 'linear-gradient(90deg,#d29922,#3fb950)';
    }
}

/* =============================================
   DIFF VIEW TOGGLE
============================================= */
var originalTextForDiff   = '';
var correctedHtmlForDiff  = '';
var _diffSwitching = false; // guard: prevents observer from overwriting correctedHtmlForDiff during view switch

function showDiffView(mode) {
    var box    = document.getElementById('correctedStory');
    var btnC   = document.getElementById('diffBtnCorrected');
    var btnO   = document.getElementById('diffBtnOriginal');
    if (!box) return;
    _diffSwitching = true; // lock observer
    if (mode === 'original') {
        setWftSanitizedInnerHtml(box, originalTextForDiff
            ? textToWftHtml(originalTextForDiff)
            : '<em>No original text stored.</em>');
        if (btnC) btnC.classList.remove('active');
        if (btnO) btnO.classList.add('active');
    } else {
        setWftSanitizedInnerHtml(box, correctedHtmlForDiff || '<em>No corrected text yet.</em>');
        if (btnC) btnC.classList.add('active');
        if (btnO) btnO.classList.remove('active');
    }
    // Small timeout to re-enable observer after DOM settles
    setTimeout(function() { _diffSwitching = false; }, 50);
}

/* =============================================
   ANALYZE BUTTON PULSE STATE
============================================= */
function updateAnalyzeBtnState() {
    var ta  = document.getElementById('studentWriting');
    var btn = document.getElementById('analyzeBtn');
    if (!ta || !btn) return;
    var hasText = ta.value.trim().length > 0;
    if (hasText && !btn.disabled) {
        btn.classList.add('btn-ready');
        btn.classList.add('pulse-ready');
    } else {
        btn.classList.remove('btn-ready');
        btn.classList.remove('pulse-ready');
    }
}

/* =============================================
   RESULTS SLIDE-IN ANIMATION
============================================= */
function triggerResultsSlideIn() {
    var panel = document.getElementById('studentPanel');
    if (!panel) return;
    panel.classList.remove('slide-in');
    // Force reflow
    void panel.offsetWidth;
    panel.classList.add('slide-in');
}


var PENDING_PORTFOLIO_SYNC_KEY = 'wft_pending_portfolio_sync_v1';
var pendingPortfolioSync = null;
var activePortfolioReassessmentSource = null;
var lastSyncedPortfolioSessionSignature = "";

function clearActivePortfolioReassessmentState(reason) {
    activePortfolioReassessmentSource = null;
}

function normalizePortfolioReassessmentText(text) {
    return String(text || "").replace(/\r\n?/g, "\n");
}

function getPortfolioSessionMatchFromData(portfolio, studentName, sessionId, sourceCreatedAt) {
    if (!portfolio || !studentName) return null;
    var studentData = portfolio[studentName];
    var sessions = studentData && Array.isArray(studentData.sessions) ? studentData.sessions : [];
    for (var i = 0; i < sessions.length; i++) {
        var session = sessions[i] || {};
        if (String(session.id || "") === String(sessionId) || String(session.createdAt || "") === String(sessionId) || String(i) === String(sessionId) || (sourceCreatedAt && String(session.createdAt || "") === String(sourceCreatedAt))) {
            return { session: session, index: i, sessions: sessions };
        }
    }
    return null;
}

function getPreservedPortfolioTargetWords(oldSession, source, newSession) {
    if (oldSession && oldSession.targetWords != null) return oldSession.targetWords;
    if (source && source.sourceTargetWords != null) return source.sourceTargetWords;
    if (oldSession && oldSession.assessmentSettings && oldSession.assessmentSettings.targetWordCount != null) return oldSession.assessmentSettings.targetWordCount;
    if (source && source.sourceAssessmentSettings && source.sourceAssessmentSettings.targetWordCount != null) return source.sourceAssessmentSettings.targetWordCount;
    return newSession && newSession.targetWords != null ? newSession.targetWords : 0;
}

function buildPortfolioReassessmentReplacementSession(oldSession, newSession, source) {
    oldSession = oldSession || {};
    newSession = newSession || {};
    source = source || {};
    var replacement = cloneWftJson(oldSession);
    var overwriteFields = [
        'title', 'overall', 'gradeLevel', 'gradeLabel', 'gradeTier', 'gradeProfileVersion',
        'classGradeLevel', 'classGradeLabel', 'grammarStrictness', 'actualWords',
        'categoryScores', 'assessScriptQuality', 'neatnessAssessed', 'correctedHtml',
        'correctedMarkup', 'correctedPlainText', 'writingGenreInfo', 'writingGenre',
        'writingSubtype', 'writingSafeReference', 'genreConfidence', 'feedbackSummary',
        'detailedFeedback', 'notebookDecisions', 'notebookGuide', 'notebookGuideVersion', 'sourceType', 'notebookPrintHtml'
    ];
    for (var i = 0; i < overwriteFields.length; i++) {
        var field = overwriteFields[i];
        if (Object.prototype.hasOwnProperty.call(newSession, field)) replacement[field] = cloneWftJson(newSession[field]);
    }

    if (Array.isArray(newSession.images) && newSession.images.length) {
        replacement.images = cloneWftJson(newSession.images);
    } else if (Array.isArray(oldSession.images)) {
        replacement.images = cloneWftJson(oldSession.images);
    } else {
        replacement.images = [];
    }

    replacement.id = oldSession.id || source.sourceOriginalId || source.sourceSessionId || newSession.id;
    replacement.createdAt = oldSession.createdAt || source.sourceCreatedAt || newSession.createdAt;
    replacement.date = oldSession.date || newSession.date;

    var preservedTargetWords = getPreservedPortfolioTargetWords(oldSession, source, newSession);
    replacement.targetWords = preservedTargetWords;

    var settings = cloneWftJson(newSession.assessmentSettings || oldSession.assessmentSettings || {});
    if (!settings || typeof settings !== 'object') settings = {};
    if (oldSession.assessmentSettings && oldSession.assessmentSettings.targetWordCount != null) {
        settings.targetWordCount = oldSession.assessmentSettings.targetWordCount;
    } else if (source.sourceAssessmentSettings && source.sourceAssessmentSettings.targetWordCount != null) {
        settings.targetWordCount = source.sourceAssessmentSettings.targetWordCount;
    } else if (preservedTargetWords != null) {
        settings.targetWordCount = preservedTargetWords;
    }
    replacement.assessmentSettings = settings;

    var sourceOriginalText = Object.prototype.hasOwnProperty.call(source, 'sourceOriginalText') ? source.sourceOriginalText : oldSession.originalText;
    var newOriginalText = Object.prototype.hasOwnProperty.call(newSession, 'originalText') ? newSession.originalText : '';
    var textEdited = normalizePortfolioReassessmentText(sourceOriginalText) !== normalizePortfolioReassessmentText(newOriginalText);
    replacement.originalText = textEdited ? String(newOriginalText || '') : String(oldSession.originalText || sourceOriginalText || newOriginalText || '');
    replacement.reassessmentTextEdited = !!textEdited;

    replacement.lastReassessedAt = new Date().toISOString();
    replacement.updatedAt = replacement.lastReassessedAt;
    replacement.reassessmentCount = (Number(oldSession.reassessmentCount) || 0) + 1;
    replacement.reassessedFromSessionId = oldSession.id || source.sourceSessionId || '';
    return replacement;
}

function getActivePortfolioStudentName() {
    var select = document.getElementById("studentSelect");
    var selectValue = select ? String(select.value || "").trim() : "";
    var storedValue = String(selectedStudent || "").trim();
    if (selectValue) {
        selectedStudent = selectValue;
        try { localStorage.setItem("wft_selectedStudent", selectedStudent); } catch (e) {}
        return selectValue;
    }
    return storedValue;
}

function getCurrentPortfolioSessionSignature() {
    var student = getActivePortfolioStudentName();
    if (!latestAnalysisData || !student) return "";
    var writingEl = document.getElementById("studentWriting");
    var writingText = writingEl ? String(writingEl.value || "") : "";
    var createdFrom = {
        studentName: student,
        writingText: writingText,
        overall: latestAnalysisData.overall,
        categoryScores: latestAnalysisData.categoryScores || {},
        correctedStory: latestAnalysisData.correctedStory || ""
    };
    return getWftHash(createdFrom);
}

function prepareCurrentAnalysisForPortfolioSync() {
    if (getPendingPortfolioSync()) return true;
    if (!latestAnalysisData) return false;
    var signature = getCurrentPortfolioSessionSignature();
    if (signature && lastSyncedPortfolioSessionSignature === signature) return false;
    saveCurrentSessionToPortfolio(latestAnalysisData);
    return !!getPendingPortfolioSync();
}

function loadPendingPortfolioSyncFromStorage() {
    var raw = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY);
    if (!raw) return null;
    try {
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.studentName || !parsed.sessionData) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function stripPendingPortfolioImageDataUrls(pending) {
    if (!pending || !pending.sessionData) return pending;
    var cleaned = cloneWftJson(pending);
    if (cleaned.sessionData && Array.isArray(cleaned.sessionData.images)) {
        cleaned.sessionData.images.forEach(function(image) {
            if (!image) return;
            if (image.dataUrl) {
                image.dataUrl = '';
                image.dataUrlRemovedForStorage = true;
            }
            if (image.originalDataUrl) delete image.originalDataUrl;
            if (image.extractedText) delete image.extractedText;
        });
    }
    return cleaned;
}

function persistPendingPortfolioSync() {
    if (pendingPortfolioSync && pendingPortfolioSync.studentName && pendingPortfolioSync.sessionData) {
        try {
            localStorage.setItem(PENDING_PORTFOLIO_SYNC_KEY, JSON.stringify(pendingPortfolioSync));
        } catch (e) {
            wftDebugWarn('Pending portfolio save exceeded localStorage; saving without embedded image data.', e);
            try {
                pendingPortfolioSync = stripPendingPortfolioImageDataUrls(pendingPortfolioSync);
                localStorage.setItem(PENDING_PORTFOLIO_SYNC_KEY, JSON.stringify(pendingPortfolioSync));
            } catch (e2) {
                wftDebugError('Pending portfolio save retry also failed:', e2);
                throw e2;
            }
        }
    } else {
        localStorage.removeItem(PENDING_PORTFOLIO_SYNC_KEY);
    }
}

function getPendingPortfolioSync() {
    if (!pendingPortfolioSync) {
        pendingPortfolioSync = loadPendingPortfolioSyncFromStorage();
    }
    return pendingPortfolioSync;
}

function clearPendingPortfolioSync() {
    pendingPortfolioSync = null;
    localStorage.removeItem(PENDING_PORTFOLIO_SYNC_KEY);
    updateSyncPortfolioButtonState();
}

function updateSyncPortfolioButtonState() {
    var pending = getPendingPortfolioSync();
    var hasAnalysis = !!latestAnalysisData;
    var activeStudent = getActivePortfolioStudentName();
    var currentSignature = getCurrentPortfolioSessionSignature();
    var ids = ['syncPortfolioBtnTop', 'syncPortfolioBtnBottom'];
    for (var i = 0; i < ids.length; i++) {
        var btn = document.getElementById(ids[i]);
        if (!btn) continue;
        var label = btn.querySelector('.sync-label');
        if (pending && !manualSyncInProgress) {
            btn.classList.remove('synced-done', 'is-syncing');
            btn.classList.add('btn-ready');
            btn.disabled = false;
            if (label) label.textContent = 'Sync to Portfolio';
        } else if (manualSyncInProgress) {
            btn.classList.remove('btn-ready', 'synced-done');
            btn.classList.add('is-syncing');
            btn.disabled = true;
            if (label) label.textContent = 'Syncing...';
        } else if (hasAnalysis && activeStudent && currentSignature && lastSyncedPortfolioSessionSignature !== currentSignature) {
            btn.classList.remove('synced-done', 'is-syncing');
            btn.classList.add('btn-ready');
            btn.disabled = false;
            if (label) label.textContent = 'Sync to Portfolio';
        } else if (hasAnalysis && !activeStudent) {
            btn.classList.remove('btn-ready', 'is-syncing', 'synced-done');
            btn.disabled = true;
            if (label) label.textContent = 'Select Student First';
        } else if (hasAnalysis && currentSignature && lastSyncedPortfolioSessionSignature === currentSignature) {
            btn.classList.remove('btn-ready', 'is-syncing');
            btn.classList.add('synced-done');
            btn.disabled = true;
            if (label) label.textContent = 'Synced';
        } else {
            btn.classList.remove('btn-ready', 'is-syncing', 'synced-done');
            btn.disabled = true;
            if (label) label.textContent = 'Analyze First';
        }
    }
}

function commitPendingPortfolioReplacement(pending) {
    if (!pending || !pending.studentName || !pending.sessionData || !pending.replaceSource) return false;
    var source = pending.replaceSource || {};
    var sourceStudent = source.sourceStudentName || source.studentName || "";
    var sourceSessionId = source.sourceSessionId || source.sessionId || "";
    var targetStudent = pending.studentName;
    var newSession = pending.sessionData;
    if (!sourceStudent || !sourceSessionId || !targetStudent || !newSession) return false;

    if (sourceStudent !== targetStudent) {
        wftDebugWarn('[Portfolio] Reassessment replacement aborted because the target student changed.', { sourceStudent: sourceStudent, targetStudent: targetStudent });
        if (driveAccessToken) setDriveSyncStatus('error', 'Reassessment was not saved because the selected student changed');
        return false;
    }

    var portfolio = getPortfolioData();
    if (!portfolio[sourceStudent]) portfolio[sourceStudent] = { sessions: [] };
    var match = getPortfolioSessionMatchFromData(portfolio, sourceStudent, sourceSessionId, source.sourceCreatedAt);
    if (!match) {
        wftDebugWarn('[Portfolio] Reassessment replacement aborted because the source session was not found.', { sourceStudent: sourceStudent, sourceSessionId: sourceSessionId });
        if (driveAccessToken) setDriveSyncStatus('error', 'Original portfolio entry not found');
        return false;
    }

    var replacement = buildPortfolioReassessmentReplacementSession(match.session, newSession, source);
    match.sessions[match.index] = replacement;

    savePortfolioData(portfolio);
    try { renderStudentPortfolio(); } catch (e) { wftDebugError('Portfolio saved, but portfolio rendering failed:', e); }
    return true;
}

function commitPendingPortfolioSync() {
    var pending = getPendingPortfolioSync();
    if (!pending || !pending.studentName || !pending.sessionData) return false;
    try {
        if (pending.replaceSource) {
            if (!commitPendingPortfolioReplacement(pending)) return false;
        } else {
            saveStudentSession(pending.studentName, pending.sessionData);
        }
        lastSyncedPortfolioSessionSignature = pending.signature || getCurrentPortfolioSessionSignature();
        clearPendingPortfolioSync();
        return true;
    } catch (e) {
        wftDebugError('saveStudentSession failed during pending portfolio commit:', e);
        wftSyncLog("[WFT Sync] pending portfolio commit failed", {
            name: e && e.name ? e.name : '',
            message: e && e.message ? e.message : String(e),
            stack: e && e.stack ? e.stack : ''
        });
        return false;
    }
}

