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
function openSettingsDrawer() {
    document.getElementById('settingsDrawer').classList.add('open');
    document.getElementById('settingsDrawerOverlay').classList.add('open');
    refreshStorageHealthUI();
}
function closeSettingsDrawer() {
    if (!saveWftPreferencesFromForm()) return;
    document.getElementById('settingsDrawer').classList.remove('open');
    document.getElementById('settingsDrawerOverlay').classList.remove('open');
}

var WFT_API_KEY_SESSION_STORAGE_KEY = "wft_api_key_session";
var WFT_API_KEY_LOCAL_STORAGE_KEY = "wft_api_key_remembered";
var WFT_API_KEY_REMEMBER_PREF_KEY = "wft_api_key_remember_on_device";

function getApiKeyInputValue() {
    var apiKeyInput = document.getElementById('apiKeyInput');
    return apiKeyInput ? String(apiKeyInput.value || '').trim() : '';
}

// Key before-images stay separate from settings and Emergency Backup.
var wftApiKeyStorageRecovery = null;
var wftCommittedApiKeyInput = { key: '', remember: false };

function restoreWftApiKeyStorage(entries) {
    var pending = [];
    entries.slice().reverse().forEach(function(entry) {
        try {
            if (entry.storage.getItem(entry.key) !== entry.value) {
                if (entry.value === null) entry.storage.removeItem(entry.key);
                else entry.storage.setItem(entry.key, entry.value);
            }
            if (entry.storage.getItem(entry.key) !== entry.value) pending.push(entry);
        } catch (e) { pending.push(entry); }
    });
    // Retry only unresolved keys so later preference/class saves cannot be reverted.
    entries.splice.apply(entries, [0, entries.length].concat(pending.reverse()));
    return entries.length === 0;
}

function getWftApiKeyStorageError() {
    return new Error(wftApiKeyStorageRecovery
        ? 'The API key change could not be saved or fully restored. The original key is retained in this tab. Keep this tab open and retry when browser storage is working.'
        : 'The API key change could not be saved. The previous key and remember setting were kept. Check browser storage and retry.');
}

function applyWftApiKeyInputState(state) {
    var input = document.getElementById('apiKeyInput');
    var remember = document.getElementById('rememberApiKeyOnDevice');
    if (input) input.value = state.key;
    if (remember) remember.checked = state.remember;
    API_KEY = state.key || EMBEDDED_API_KEY;
}

function saveWftApiKeyFromForm() {
    try { persistApiKeyStorageFromInput(); return true; }
    catch (e) { alert(e.message); return false; }
}

function migrateLegacyApiKeyStorage() {
    function copyLegacyApiKey(key) {
        var sessionKey = sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY);
        if (sessionKey && String(sessionKey).trim() !== key) {
            // A different active key must not erase the only legacy copy.
            if (String(localStorage.getItem(WFT_API_KEY_LOCAL_STORAGE_KEY) || '').trim() !== key) throw getWftApiKeyStorageError();
        } else if (!sessionKey) {
            sessionStorage.setItem(WFT_API_KEY_SESSION_STORAGE_KEY, key);
        }
        var copied = String(sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY) || '').trim() === key
            || String(localStorage.getItem(WFT_API_KEY_LOCAL_STORAGE_KEY) || '').trim() === key;
        if (!copied) throw getWftApiKeyStorageError();
    }
    try {
        if (wftApiKeyStorageRecovery) throw getWftApiKeyStorageError();
        if (wftStudentChangeRecovery && Object.prototype.hasOwnProperty.call(wftStudentChangeRecovery, 'wft_settings')) throw getWftApiKeyStorageError();
        var raw = localStorage.getItem('wft_settings');
        if (!raw) return;
        var settings = JSON.parse(raw);
        if (!Object.prototype.hasOwnProperty.call(settings, 'apiKey')) return;
        var key = String(settings.apiKey || '').trim();
        if (key) copyLegacyApiKey(key);
        delete settings.apiKey;
        localStorage.setItem('wft_settings', JSON.stringify(settings));
    } catch (e) { throw getWftApiKeyStorageError(); }
}

function isRememberApiKeyEnabled() {
    var rememberEl = document.getElementById('rememberApiKeyOnDevice');
    return rememberEl ? rememberEl.checked === true : localStorage.getItem(WFT_API_KEY_REMEMBER_PREF_KEY) === 'true';
}

function setRememberApiKeyEnabled(enabled) {
    localStorage.setItem(WFT_API_KEY_REMEMBER_PREF_KEY, enabled ? 'true' : 'false');
}

function getStoredApiKey() {
    try {
        if (wftApiKeyStorageRecovery) throw getWftApiKeyStorageError();
        migrateLegacyApiKeyStorage();
        var sessionKey = sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY) || '';
        if (sessionKey) return String(sessionKey).trim();
        if (localStorage.getItem(WFT_API_KEY_REMEMBER_PREF_KEY) === 'true') {
            return String(localStorage.getItem(WFT_API_KEY_LOCAL_STORAGE_KEY) || '').trim();
        }
        return '';
    } catch (e) { throw getWftApiKeyStorageError(); }
}

function persistApiKeyStorageFromInput() {
    var key = getApiKeyInputValue(), remember, previous;
    function verifyApiKeyStorage() {
        if (sessionStorage.getItem(WFT_API_KEY_SESSION_STORAGE_KEY) !== (key || null)
            || localStorage.getItem(WFT_API_KEY_LOCAL_STORAGE_KEY) !== (remember && key ? key : null)
            || localStorage.getItem(WFT_API_KEY_REMEMBER_PREF_KEY) !== (remember ? 'true' : 'false')) throw getWftApiKeyStorageError();
    }
    try {
        remember = isRememberApiKeyEnabled();
        if (wftStudentChangeRecovery && Object.prototype.hasOwnProperty.call(wftStudentChangeRecovery, 'wft_settings')) throw getWftApiKeyStorageError();
        if (wftApiKeyStorageRecovery) {
            if (!restoreWftApiKeyStorage(wftApiKeyStorageRecovery)) throw getWftApiKeyStorageError();
            wftApiKeyStorageRecovery = null;
        }
        previous = [
            { storage: sessionStorage, key: WFT_API_KEY_SESSION_STORAGE_KEY },
            { storage: localStorage, key: WFT_API_KEY_LOCAL_STORAGE_KEY },
            { storage: localStorage, key: WFT_API_KEY_REMEMBER_PREF_KEY },
            { storage: localStorage, key: 'wft_settings' }
        ];
        previous.forEach(function(entry) { entry.value = entry.storage.getItem(entry.key); });
        var settings = previous[3].value === null ? {} : JSON.parse(previous[3].value);
        validateWftRequiredStorage('wft_settings', settings);
        var oldRemember = previous[2].value === 'true';
        var oldKey = previous[0].value || (oldRemember ? previous[1].value : '') || settings.apiKey || '';
        wftCommittedApiKeyInput = { key: String(oldKey).trim(), remember: oldRemember };
        if (key) sessionStorage.setItem(WFT_API_KEY_SESSION_STORAGE_KEY, key);
        else sessionStorage.removeItem(WFT_API_KEY_SESSION_STORAGE_KEY);
        if (remember && key) localStorage.setItem(WFT_API_KEY_LOCAL_STORAGE_KEY, key);
        else localStorage.removeItem(WFT_API_KEY_LOCAL_STORAGE_KEY);
        setRememberApiKeyEnabled(remember);
        verifyApiKeyStorage();
        if (Object.prototype.hasOwnProperty.call(settings, 'apiKey')) {
            delete settings.apiKey;
            localStorage.setItem('wft_settings', JSON.stringify(settings));
        }
        wftCommittedApiKeyInput = { key: key, remember: remember };
        applyWftApiKeyInputState(wftCommittedApiKeyInput);
        return true;
    } catch (e) {
        if (previous && previous.every(function(entry) { return Object.prototype.hasOwnProperty.call(entry, 'value'); })
            && !restoreWftApiKeyStorage(previous)) wftApiKeyStorageRecovery = previous;
        applyWftApiKeyInputState(wftCommittedApiKeyInput);
        throw getWftApiKeyStorageError();
    }
}

function refreshApiKeyRuntimeValue() {
    try {
        if (wftApiKeyStorageRecovery) throw getWftApiKeyStorageError();
        API_KEY = getApiKeyInputValue() || getStoredApiKey() || EMBEDDED_API_KEY;
        return true;
    } catch (e) {
        API_KEY = '';
        alert(e.message);
        return false;
    }
}

function saveSettingsToLocalStorage(settingsOverride) {
    var existing = readWftRequiredStorage('wft_settings');
    var settings = Object.assign(Object.create(null), cloneWftJson(existing));
    if (settingsOverride && typeof settingsOverride === 'object') {
        Object.keys(settingsOverride).forEach(function(key) {
            if (key !== 'apiKey') settings[key] = cloneWftJson(settingsOverride[key]);
        });
    }
    function updateSettingsFromForm() {
        var modelSelect = document.getElementById('modelSelect');
        var targetWordCountEl = document.getElementById('targetWordCount');
        var useWordCountTargetEl = document.getElementById('useWordCountTarget');
        var assessScriptQualityEl = document.getElementById('assessScriptQuality');
        if (modelSelect) settings.model = modelSelect.value || '';
        if (targetWordCountEl) settings.targetWordCount = targetWordCountEl.value || '200';
        if (useWordCountTargetEl) settings.useWordCountTarget = useWordCountTargetEl.checked;
        if (typeof getGrammarStrictness === 'function') settings.grammarStrictness = getGrammarStrictness();
        if (assessScriptQualityEl) settings.assessScriptQuality = assessScriptQualityEl.checked;
        if (typeof getSelectedGradeLevel === 'function') settings.gradeLevel = getSelectedGradeLevel();
        if (typeof getClassGradeLevel === 'function') settings.classGradeLevel = getClassGradeLevel();
        settings.studentGradeLevelOverride = wftStudentGradeLevelOverride === true;
    }
    try {
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        preflightWftRequiredStorage();
        updateSettingsFromForm();
        if (typeof students !== 'undefined' && Array.isArray(students)) settings.students = applyDeletionsToStudents(students, getDeletionsData());
        validateWftRequiredStorage('wft_settings', settings);
        localStorage.setItem('wft_settings', JSON.stringify(settings));
    } catch (e) {
        applyWftPreferenceForm(existing);
        throw e;
    }
    if (WFT_SYNC_ENGINE_V2 && !wftSuppressDirtyMarks && !(typeof isWftStorageSafeMode === 'function' && isWftStorageSafeMode())) {
        markWftSettingsDirty('settings-change');
        scheduleWftCloudSync('settings-change');
    } else if ((typeof isWftStorageSafeMode === 'function' && isWftStorageSafeMode()) && driveAccessToken && typeof saveSettingsToDrive === 'function') {
        saveSettingsToDrive();
    }
    delete settings.apiKey;
    return settings;
}

function saveWftPreferencesFromForm() {
    try { saveSettingsToLocalStorage(); return true; }
    catch (e) {
        alert(e.wftStudentChangeRecovery ? e.message : 'Settings could not be saved. The saved preferences were kept. Check browser storage and retry.');
        return false;
    }
}

function loadSettingsFromLocalStorage() {
    try {
        var key = getStoredApiKey();
        var remember = localStorage.getItem(WFT_API_KEY_REMEMBER_PREF_KEY) === 'true';
        wftCommittedApiKeyInput = { key: key, remember: remember };
        applyWftApiKeyInputState(wftCommittedApiKeyInput);
    } catch (e) { alert(e.message); }
    try { applyWftPreferenceForm(readWftRequiredStorage('wft_settings')); }
    catch (e) { alert('Saved settings could not be read. Download Emergency Backup before repairing browser storage.'); }
}

/* =============================================
   SCRIPT QUALITY ASSESSMENT HELPERS
============================================= */

// Get raw settings object (for internal use without DOM)
function getRawSettings() {
    try {
        var raw = readWftStudentChangeStorage('wft_settings');
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

// Script quality toggle is always visible in settings
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
function getWeightDescriptionText(optProfile, optNeatnessActive) {
    var profile = optProfile || getGradeProfile();
    var weights = profile.weights || GRADE_PROFILES[5].weights;
    var neatnessActive = typeof optNeatnessActive === "boolean" ? optNeatnessActive : (shouldShowNeatnessWeighting ? shouldShowNeatnessWeighting() : shouldAssessNeatness());
    var neatnessWeight = neatnessActive ? getNeatnessWeight(profile) : 0;
    var nonNeatScale = 1 - neatnessWeight;
    var order = ["Ideas & Details", "Organization", "Grammar", "Flow", "Word Choice", "Spelling & Punctuation"];
    var parts = [];
    for (var i = 0; i < order.length; i++) {
        var k = order[i];
        if (weights[k] != null) parts.push(k + " (" + formatPercentFromWeight(weights[k] * nonNeatScale) + ")");
    }
    if (neatnessActive && neatnessWeight > 0) parts.push("Neatness (" + formatPercentFromWeight(neatnessWeight) + ")");
    return "Weighted by category importance: " + parts.join(", ") + ".";
}

// Assess handwriting neatness from an image
async function assessNeatnessFromImage(imageDataUrl, model) {
    // Use the active/cropped image that the user chose for this assessment.
    // Do not silently switch back to the uncropped original, because that can reintroduce
    // margins, clutter, or typed/printed material the user intentionally removed.
    var assessmentImageUrl = imageDataUrl;

    var prompt = `Look at the image of this student writing sample.

FIRST, classify the source before scoring. This is a required safety check.
Use exactly one source type:
- HANDWRITTEN = mostly handwritten student writing, with enough handwriting to judge fairly.
- TYPED_OR_PRINTED = mostly typed, computer-generated, printed, or worksheet text rather than student handwriting.
- MIXED = both typed/printed text and student handwriting are visible, and there is enough student handwriting to judge fairly.
- NOT_SCORABLE = too blurry, cropped, dark, blocked, or there is not enough student handwriting to judge fairly.

If the source type is TYPED_OR_PRINTED, do not score neatness. Handwriting neatness is not assessed for typed or printed work.
If the source type is NOT_SCORABLE, do not score neatness. Use Missing rather than guessing.
If the source type is MIXED, score only the student's handwriting. Ignore typed instructions, typed prompts, printed worksheets, and computer-generated text.
Do not give low handwriting scores to typed or printed text. Typed or printed work must be marked Missing for neatness, not 2/10.

If the source type is HANDWRITTEN or MIXED with enough student handwriting, score the neatness of the visible student handwriting using the exact 1-5 rubric below.

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
**Source Type:** [HANDWRITTEN, TYPED_OR_PRINTED, MIXED, or NOT_SCORABLE]
**Source Type Reason:** [one short sentence explaining the classification]

**Sub-scores:**
- Letter Formation: [score]/5 - [level name]
- Spacing: [score]/5 - [level name]
- Staying on the Line: [score]/5 - [level name]
- Size Consistency: [score]/5 - [level name]
- Pen Control and Marks: [score]/5 - [level name]
- Page Layout and Paragraphs: [score]/5 - [level name]

**Quick Rubric:**
- Neatness: [converted final score]/10 ([rounded final score]/5 - [level name]) - [one sentence describing the most noticeable thing you see in this student's handwriting overall]

**Neatness Growth Tip:** [one short, specific tip written directly to the student about the single most important thing to work on]

If the source type is TYPED_OR_PRINTED, use this exact scoring section:
**Sub-scores:**
- Letter Formation: Missing/5 - Not assessed
- Spacing: Missing/5 - Not assessed
- Staying on the Line: Missing/5 - Not assessed
- Size Consistency: Missing/5 - Not assessed
- Pen Control and Marks: Missing/5 - Not assessed
- Page Layout and Paragraphs: Missing/5 - Not assessed

**Quick Rubric:**
- Neatness: Missing/10 - Neatness was not assessed because this sample appears to be typed or printed.
**Neatness Growth Tip:** No handwriting score was added to the overall grade for this sample.

Example for handwritten work:
**Source Type:** HANDWRITTEN
**Source Type Reason:** The image shows enough student handwriting to judge fairly.

**Sub-scores:**
- Letter Formation: 4/5 - Proficient
- Spacing: 3/5 - Developing
- Staying on the Line: 4/5 - Proficient
- Size Consistency: 3/5 - Developing
- Pen Control and Marks: 4/5 - Proficient
- Page Layout and Paragraphs: 3/5 - Developing

**Quick Rubric:**
- Neatness: 8/10 (4/5 - Proficient) - Most of your letters are easy to read, but some words need clearer spaces between them.
**Neatness Growth Tip:** Try leaving a finger-width gap between each word so your writing is easier to read.`;

    try {
        var response = await callOpenRouterImage(model, prompt, assessmentImageUrl);
        return parseNeatnessAssessmentResponse(response);
    } catch (e) {
        wftDebugError('Neatness assessment failed:', e);
    }
    return null;
}

function parseNeatnessAssessmentResponse(response) {
    function parseNeatnessSubScore(label, responseText) {
        var rx = new RegExp('-\\s*' + label + '\\s*:\\s*((?:5|4|3|2|1)|Missing)\\s*\\/5', 'i');
        var m = responseText.match(rx);
        if (!m) return null;
        return /missing/i.test(m[1]) ? null : Number(m[1]);
    }

    function parseNeatnessSourceType(responseText) {
        var text = String(responseText || '').replace(/\*\*/g, '');
        var sourceMatch = text.match(/(?:\*\*)?Source\s*Type(?:\*\*)?\s*:\s*(HANDWRITTEN|TYPED_OR_PRINTED|MIXED|NOT_SCORABLE)/i);
        if (sourceMatch) return sourceMatch[1].toUpperCase();
        if (/\b(TYPED_OR_PRINTED|typed\s+or\s+printed|typed\s+work|printed\s+work|appears\s+to\s+be\s+typed|mostly\s+typed|computer\s+typed)\b/i.test(text)) return 'TYPED_OR_PRINTED';
        if (/\b(NOT_SCORABLE|not\s+scorable|cannot\s+score|not\s+enough\s+handwriting|does\s+not\s+show\s+enough\s+handwriting)\b/i.test(text)) return 'NOT_SCORABLE';
        return '';
    }

    function parseNeatnessSourceReason(responseText) {
        var text = String(responseText || '').replace(/\*\*/g, '');
        var reasonMatch = text.match(/(?:\*\*)?Source\s*Type\s*Reason(?:\*\*)?\s*:\s*([^\n]+)/i);
        return reasonMatch ? reasonMatch[1].trim() : '';
    }

    function buildUnscoredNeatnessResult(sourceType, reason) {
        sourceType = sourceType || 'NOT_SCORABLE';
        reason = String(reason || '').trim();
        if (!reason) {
            if (sourceType === 'TYPED_OR_PRINTED') {
                reason = 'Neatness was not assessed because this sample appears to be typed or printed.';
            } else {
                reason = 'Neatness was not assessed because there was not enough clear handwriting to score fairly.';
            }
        }
        return {
            quickRubric: {
                score: null,
                reason: reason,
                growthTip: 'No handwriting score was added to the overall grade for this sample.',
                subScores: {
                    letterFormation: null,
                    spacing: null,
                    stayingOnLine: null,
                    sizeConsistency: null,
                    penControl: null,
                    pageLayoutParagraphs: null
                },
                neatnessScoreFive: null,
                neatnessWeightedFive: null,
                sourceType: sourceType,
                notAssessedReason: reason,
                scoreBasis: 'Skipped before scoring because the image source type was ' + sourceType + '.'
            }
        };
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
            if (!Number.isFinite(values[i])) return null;
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

    var rubric = {};
    var sourceType = parseNeatnessSourceType(response);
    var sourceReason = parseNeatnessSourceReason(response);

    if (sourceType === 'TYPED_OR_PRINTED' || sourceType === 'NOT_SCORABLE') {
        return buildUnscoredNeatnessResult(sourceType, sourceReason);
    }

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

    // If the model did not provide a usable score, preserve the unscored state instead of guessing.
    if (computedTen == null && /Missing\s*\/10/i.test(response)) {
        return buildUnscoredNeatnessResult(sourceType || 'NOT_SCORABLE', sourceReason || 'Neatness was not assessed because there was not enough clear handwriting to score fairly.');
    }

    // Parse the response - expected pattern: - Neatness: [score]/10 ([score]/5 - [level]) - [observation]
    var match = response.match(/-\s*Neatness:\s*((?:10|8|6|4|2)|Missing)\s*\/10(?:\s*\([^)]*\))?\s*-\s*([^\n]+)/i);
    var growthTipMatch = response.match(/\*\*Neatness Growth Tip:\*\*\s*([^\n]+)/i);
    var parsedGrowthTip = growthTipMatch ? growthTipMatch[1].trim() : null;

    function parseNeatnessFallback() {
        // Fallback: score present but observation was not in the expected format.
        var scoreMatch = response.match(/(?:10|8|6|4|2)\s*\/10/i);
        if (scoreMatch || computedTen != null) {
            var score = computedTen != null ? computedTen : Number(scoreMatch[0].match(/(?:10|8|6|4|2)/)[0]);
            var sentenceMatch = response.match(/([^.\n]*(?:10|8|6|4|2)\s*\/10[^.\n]*\.?)/i);
            var extractedReason = sentenceMatch ? sentenceMatch[0].replace(/^\s*[-*\d.]+\s*/, '').trim() : '';
            var reason = extractedReason.length > 10 ? extractedReason : null;
            rubric = {
                score: score,
                reason: reason,
                growthTip: parsedGrowthTip,
                subScores: subScores,
                neatnessScoreFive: roundedFive,
                neatnessWeightedFive: weightedFive,
                sourceType: sourceType || 'HANDWRITTEN',
                scoreBasis: computedTen != null ? 'Computed from handwriting sub-scores.' : 'Parsed from neatness response fallback.'
            };
        }
    }

    if (match) {
        var parsedTen = /missing/i.test(match[1]) ? null : Number(match[1]);
        rubric = {
            score: computedTen != null ? computedTen : parsedTen,
            reason: (match[2] || '').trim(),
            growthTip: parsedGrowthTip,
            subScores: subScores,
            neatnessScoreFive: roundedFive,
            neatnessWeightedFive: weightedFive,
            sourceType: sourceType || 'HANDWRITTEN',
            scoreBasis: computedTen != null ? 'Computed from handwriting sub-scores.' : 'Parsed from neatness response.'
        };
    } else {
        parseNeatnessFallback();
    }

    if (rubric && (rubric.score !== undefined)) {
        return { quickRubric: rubric };
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
 * Google sign-in uses Google Identity Services token client when available.
 * The older OAuth implicit redirect flow remains as a fallback for browsers
 * where the GIS script is blocked or unavailable.
 */
var WFT_APP_VERSION = "v9";
var GOOGLE_CLIENT_ID = "828630395554-8b5k5lbpjfekr8bhvk090ckm71klq0n2.apps.googleusercontent.com";
var DRIVE_FOLDER_NAME = "WritingFeedbackTool";
var GOOGLE_USER_CACHE_KEY = "wft_google_user";
var DRIVE_TOKEN_CACHE_KEY = "wft_drive_access_token";
var DRIVE_TOKEN_EXPIRY_CACHE_KEY = "wft_drive_access_token_expiry";
var GOOGLE_CONNECTED_CACHE_KEY = "wft_google_connected";

// ── WFT Sync Engine V2 feature flags ──
var WFT_SYNC_ENGINE_V2 = true;
var WFT_SYNC_DEBUG = false;
var WFT_DEBUG = false;
var WFT_DUPLICATE_DETECTION_V2 = true;
var WFT_DUPLICATE_CLEANUP_V2 = false;
var WFT_IMAGE_IDEMPOTENCY_V2 = true;
var WFT_SESSION_TOKEN_STORAGE_V2 = true;
var WFT_GIS_AUTH_V2 = true;

// Sync lifecycle feature flags used by this runtime bundle.
// Keep these declared here because index.html loads this bundle directly;
// This bundle owns the runtime configuration.
var WFT_LAMPORT_V1 = true;
var WFT_BROADCAST_CHANNEL_V1 = true;


function isWftDebugLoggingEnabled() {
    return WFT_DEBUG === true || WFT_SYNC_DEBUG === true;
}

function wftDebugLog() {
    if (!isWftDebugLoggingEnabled()) return;
    if (typeof window !== "undefined" && window.console && window.console.log) {
        window.console.log.apply(window.console, getRedactedWftSyncLogArgs(arguments));
    }
}

function wftDebugWarn() {
    if (!isWftDebugLoggingEnabled()) return;
    if (typeof window !== "undefined" && window.console && window.console.warn) {
        window.console.warn.apply(window.console, getRedactedWftSyncLogArgs(arguments));
    }
}

function wftDebugError() {
    if (!isWftDebugLoggingEnabled()) return;
    if (typeof window !== "undefined" && window.console && window.console.error) {
        window.console.error.apply(window.console, getRedactedWftSyncLogArgs(arguments));
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
// Phase 3 — Split student files ENABLED (permanent commitment)
// Legacy single-portfolio (wft-portfolio.json) support is deprecated
// The flag below controls the shipped split-file path.
var WFT_SPLIT_STUDENT_FILES_V1 = true;
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
var DRIVE_TOKEN_SESSION_KEY = "wft_drive_token_session_gmail_v1";
var wftSuppressDirtyMarks = false;

// WFT_TOMBSTONE_V1 — compaction flag (disabled by default)
var WFT_TOMBSTONE_COMPACTION_V1 = false;

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
    var settings = readWftRequiredStorage('wft_settings');

    settings.studentIdMap = Object.assign(Object.create(null), settings.studentIdMap || {});
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

    if (typeof saveSettingsToLocalStorage !== 'function') throw new Error('Student identity could not be saved.');
    saveSettingsToLocalStorage(settings);
    return newId;
}

// ── Session Date Normalization ──

function normalizeWftSessionDate(session, fallbackCreatedAt) {
    if (!session) { return; }

    function setDisplayDateFromIso() {
        try {
            var dd = new Date(session.dateIso);
            var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            session.displayDate = months[dd.getMonth()] + " " + dd.getDate() + ", " + dd.getFullYear();
        } catch (e) {
            session.displayDate = session.dateIso;
        }
    }

    if (!session.createdAt || isNaN(Date.parse(session.createdAt))) {
        if (session.timestamp && !isNaN(Date.parse(session.timestamp))) {
            session.createdAt = session.timestamp;
        } else if (session.date && !isNaN(Date.parse(session.date))) {
            session.createdAt = session.date;
        } else {
            session.createdAt = fallbackCreatedAt || new Date().toISOString();
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

    // WFT_LAMPORT_V1 — preserve existing lamportClock from Drive-synced sessions.
    // Sessions imported from another device may carry a remote lamport value that
    // merge logic relies on; normalization must not clobber it.
    // (No-op if the field is absent — new sessions get stamped in saveStudentSession.)

    if (!session.dateIso) {
        try { session.dateIso = new Date(session.createdAt).toISOString().substring(0, 10); }
        catch (e) { session.dateIso = new Date().toISOString().substring(0, 10); }
    }

    if (!session.displayDate) {
        if (session.date) {
            session.displayDate = session.date;
        } else {
            setDisplayDateFromIso();
        }
    }

    if (!session.id) {
        session.id = createWftId("sess");
    }
}

function normalizeWftSessionForStorage(session, fallbackCreatedAt) {
    normalizeWftSessionDate(session, fallbackCreatedAt);
    return session;
}

function normalizeWftStudentRecord(studentName, sessions) {
    if (!sessions || !Array.isArray(sessions)) { sessions = []; }
    // Undated records share one fallback so normalization keeps their existing order.
    var fallbackCreatedAt = new Date().toISOString();
    for (var nsi = 0; nsi < sessions.length; nsi++) {
        normalizeWftSessionForStorage(sessions[nsi], fallbackCreatedAt);
    }
    sessions.sort(function(a, b) {
        if (!a.createdAt) { return 1; }
        if (!b.createdAt) { return -1; }
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    return sessions;
}

function normalizeWftPortfolioForSchemaV1(portfolio, skipStudentIds) {
    if (!portfolio) { return {}; }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        return portfolio;
    }
    var normalized = Object.create(null);
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

        if (WFT_STUDENT_ID_MAP_V1 && !skipStudentIds) {
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
    var safe = Object.create(null);
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

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 3
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PATCH 6 — PORTFOLIO INDEX
// ═══════════════════════════════════════════════════════════════════════════

var wftPortfolioIndexRevision = 0;
var wftPortfolioIndexDirty = false;

function markWftPortfolioIndexDirty(reason) {
    if (!WFT_PORTFOLIO_INDEX_V1 || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) { return; }
    wftPortfolioIndexRevision += 1;
    // shortcut: failed hint writes retry in this tab; add durable revision storage if reload retry is required.
    wftPortfolioIndexDirty = true;
    try {
        var settings = readWftRequiredStorage("wft_settings");
        settings._indexDirty = true;
        settings._indexDirtyReason = reason || "portfolio-change";
        settings._indexDirtyAt = new Date().toISOString();
        localStorage.setItem("wft_settings", JSON.stringify(settings));
    } catch (e) {
        wftDebugWarn("[PortfolioIndex] Failed to mark dirty:", e);
    }
}

function isWftPortfolioIndexDirty() {
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) { return false; }
    if (wftPortfolioIndexDirty) { return true; }
    try {
        return readWftRequiredStorage("wft_settings")._indexDirty === true;
    } catch (e) {
        wftDebugWarn("[PortfolioIndex] Could not read dirty hint; retry required:", e);
        return true;
    }
}

function clearWftPortfolioIndexDirty(snapshot) {
    if (!snapshot || (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode())) { return false; }
    // An old upload cannot acknowledge writing changed while it was in flight.
    wftPortfolioIndexDirty = true;
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
    preflightWftRequiredStorage();
    var settings = readWftRequiredStorage("wft_settings");
    if (snapshot.revision !== wftPortfolioIndexRevision || snapshot.dirtyAt !== settings._indexDirtyAt ||
        snapshot.portfolioHash !== getPortfolioFingerprint(getLocalPortfolioSnapshot())) {
        wftSyncState.needsSyncAfterCurrent = true;
        return false;
    }
    delete settings._indexDirty;
    delete settings._indexDirtyReason;
    delete settings._indexDirtyAt;
    localStorage.setItem("wft_settings", JSON.stringify(settings));
    wftPortfolioIndexDirty = false;
    return true;
}

function buildPortfolioIndexFromPortfolio(portfolio) {
    var index = {
        schemaVersion: 1,
        format: "portfolio-index-v1",
        updatedAt: new Date().toISOString(),
        source: "legacy-wft-portfolio",
        students: Object.create(null)
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
                if (settings.studentIdMap && Object.prototype.hasOwnProperty.call(settings.studentIdMap, name)) {
                    studentId = settings.studentIdMap[name];
                }
            } catch (e) {}
        }

        var summary = summarizeSessions(sessions);

        var studentFileId = "";
        var cacheKey = "wft_drive_student_file_" + (studentId || sanitizeStudentIdPart(name));
        try { studentFileId = localStorage.getItem(cacheKey) || ""; } catch (e) {}

        index.students[studentId || name] = {
            studentId: studentId || "",
            displayName: name,
            legacyNameKey: name,
            sessionCount: sessions.length,
            latestSessionAt: summary.latestSessionAt,
            averageScore: summary.averageScore,
            studentFileId: studentFileId,
            studentFileEtag: "",
            hasUnloadedDetails: true
        };
    }

    return index;

    function summarizeSessions(sessions) {
        var latestSessionAt = "";
        var totalScore = 0;
        var scorableCount = 0;
        for (var pj = 0; pj < sessions.length; pj++) {
            var s = sessions[pj];
            if (s.createdAt && (!latestSessionAt || Date.parse(s.createdAt) > Date.parse(latestSessionAt))) {
                latestSessionAt = s.createdAt;
            }
            var score = Object.prototype.hasOwnProperty.call(s, "overall") ? s.overall : s.overallScore;
            if (typeof score === "string" && score.trim()) { score = Number(score); }
            if (typeof score === "number" && isFinite(score)) {
                totalScore += score;
                scorableCount += 1;
            }
        }
        return { latestSessionAt: latestSessionAt, averageScore: scorableCount > 0 ? Math.round(totalScore / scorableCount) : null };
    }
}

function savePortfolioIndexToDrive(index, callback) {
    var filename = "portfolio-index.json";
    var snapshot, connection;
    function finish(err, fileId) {
        try {
            if (err) { throw err; }
            if (typeof fileId !== "string" || !fileId) { throw new Error("Portfolio index upload did not return a Drive file ID."); }
            if (!isCurrentWftGoogleAuthOperation(connection)) { throw new Error("Google connection changed during portfolio index upload; retry required."); }
            setCachedWftDriveFileId(filename, fileId);
            clearWftPortfolioIndexDirty(snapshot);
            updateWftStorageMeta("patch-6-index", "saved");
        } catch (e) {
            wftDebugWarn("[PortfolioIndex] Drive save failed:", e);
            if (callback) { callback(e, null); }
            return;
        }
        if (callback) { callback(null, fileId); }
    }
    try {
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        if (!WFT_PORTFOLIO_INDEX_V1 || isWftStorageSafeMode() || !navigator.onLine || !driveAccessToken || !isWftTokenValid()) {
            throw new Error("Portfolio index was not uploaded; reconnect and retry when online.");
        }
        preflightWftRequiredStorage();
        var portfolio = getLocalPortfolioSnapshot();
        if (stableStringify(index.students) !== stableStringify(buildPortfolioIndexFromPortfolio(portfolio).students)) {
            throw new Error("Portfolio index snapshot is out of date; rebuild and retry.");
        }
        snapshot = { revision: wftPortfolioIndexRevision, portfolioHash: getPortfolioFingerprint(portfolio), dirtyAt: readWftRequiredStorage("wft_settings")._indexDirtyAt };
        connection = captureWftGoogleAuthOperation();
        if (typeof uploadWftJsonFilePromise === "function") {
            uploadWftJsonFilePromise(filename, index).then(function(fileId) { finish(null, fileId); }, function(err) { finish(err, null); });
        } else if (typeof saveFileToDrive === "function") {
            saveFileToDrive(filename, JSON.stringify(index, null, 2), "application/json", finish);
        } else { throw new Error("Portfolio index upload is unavailable; retry required."); }
    } catch (e) {
        finish(e, null);
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
        downloadWftJsonFilePromise(cachedFileId, 'index')
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
                                return downloadWftJsonFilePromise(fileId, 'index');
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

function assignMissingPortfolioIndexStudentIds(index) {
    var indexNames = Object.keys(index.students);
    for (var ri = 0; ri < indexNames.length; ri++) {
        var entry = index.students[indexNames[ri]];
        if (!entry.studentId) {
            try { entry.studentId = getOrCreateStudentId(entry.displayName); } catch (e) {}
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
    try { portfolio = getLocalPortfolioSnapshot(); }
    catch (e) {
        wftDebugError("[PortfolioIndex] Failed to get portfolio:", e);
        if (callback) { callback(e, null); }
        return;
    }

    var index = buildPortfolioIndexFromPortfolio(portfolio);

    if (WFT_STUDENT_ID_MAP_V1) {
        assignMissingPortfolioIndexStudentIds(index);
        index = buildPortfolioIndexFromPortfolio(portfolio);
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
function renderStorageHealthSummaryLines(summaryEl, lines) {
    if (!summaryEl) { return; }
    summaryEl.textContent = "";
    for (var i = 0; i < lines.length; i++) {
        if (i > 0) { summaryEl.appendChild(document.createElement("br")); }
        var line = String(lines[i] || "");
        var parts = line.split(/<b>|<\/b>/);
        for (var p = 0; p < parts.length; p++) {
            if (!parts[p]) { continue; }
            if (p % 2 === 1) {
                var strong = document.createElement("strong");
                strong.textContent = parts[p];
                summaryEl.appendChild(strong);
            } else {
                summaryEl.appendChild(document.createTextNode(parts[p]));
            }
        }
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
    lines.push("localStorage est. size: <b>" + formatWftBytes(lsSize) + "</b>");
    lines.push("IndexedDB: <b>" + (checkIndexedDbAvailable() ? "available" : "unavailable") + "</b>");

    // Portfolio index status
    var indexDirty = isWftPortfolioIndexDirty();
    lines.push("Portfolio index: <b>" + (WFT_PORTFOLIO_INDEX_V1 ? (indexDirty ? "dirty" : "clean") : "disabled") + "</b>");

    // Cached data counts
    var portfolio = null;
    try { portfolio = getPortfolioData(); } catch (e) {}
    if (portfolio) {
        var names = Object.keys(portfolio).filter(function(k) { return k !== "_meta" && k !== "updatedAt" && k !== "__syncMeta" && k !== "syncMeta" && k !== "lastSyncedAt" && k !== "lastSyncStatus"; });
        var totalSessions = 0;
        for (var hi = 0; hi < names.length; hi++) {
            var sd = portfolio[names[hi]];
            if (sd && sd.sessions) { totalSessions += sd.sessions.length; }
        }
        lines.push("Cached students: <b>" + names.length + "</b>, sessions: <b>" + totalSessions + "</b>");
    }

    // Last sync info
    if (typeof wftSyncState !== "undefined" && wftSyncState) {
        if (wftSyncState.lastSyncAt) {
            lines.push("Last Drive sync: <b>" + formatWftRelativeTime(wftSyncState.lastSyncAt) + "</b>");
        } else {
            lines.push("Last Drive sync: <b>never</b>");
        }
    }

    // Last index rebuild
    var lastPatch = meta.lastSuccessfulPatch || "";
    if (lastPatch.indexOf("patch-6") !== -1) {
        lines.push("Last index rebuild: <b>" + formatWftRelativeTime(meta.updatedAt) + "</b>");
    }

    lines.push("Active source of truth: <b>" + meta.activePortfolioFormat.replace(/-/g, " ") + "</b>");

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

async function clearWftLocalCache() {
    if (!(await wftConfirm("Clear all local cache (IndexedDB and localStorage portfolio)?\n\nLocal-only writing and photos that have not been synced to Drive will be deleted. Download Emergency Backup and verify it contains what you need before clearing.\n\nThis will NOT delete your Google Drive data. You can reload synced data from Drive after clearing. Pending writing awaiting upload is kept.", {
        title: "Clear Local Cache",
        confirmText: "Clear Cache",
        danger: true
    }))) {
        return;
    }

    var previous, localMutationStarted = false;
    try {
        if (wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        preflightWftRequiredStorage();
        getLocalPortfolioSnapshot();
        previous = { wft_portfolio: localStorage.getItem("wft_portfolio"), wft_storage_meta: localStorage.getItem("wft_storage_meta") };
        if (typeof WftIndexedDb !== "undefined" && WftIndexedDb.clearAll) await WftIndexedDb.clearAll();
        if (wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        if (Object.keys(previous).some(function(key) { return localStorage.getItem(key) !== previous[key]; })) {
            throw new Error("Local writing or storage state changed while clearing. Review it before retrying.");
        }
        localMutationStarted = true;
        localStorage.removeItem("wft_portfolio");
        localStorage.removeItem("wft_storage_meta");
        wftDebugLog("[StorageHealth] Local cache cleared");
    } catch (e) {
        if (localMutationStarted && !restoreWftStudentChangeStorage(previous)) {
            wftStudentChangeRecovery = previous;
            e = getWftStudentChangeRecoveryError();
        }
        wftDebugWarn("[StorageHealth] Failed to clear localStorage:", e);
        alert("Local cache could not be completely cleared. Some cache data may already have been removed. " + e.message + " Keep this tab open and retry when browser storage is working.");
        return false;
    }

    refreshStorageHealthUI();
    alert("Local cache cleared. Sign in to Google Drive and reload portfolio index.");
    return true;
}


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
    return Promise.resolve().then(function() { return getLocalPortfolioSnapshot(); });
}

function savePortfolioAsync(portfolio) {
    return Promise.resolve().then(function() { return savePortfolioData(portfolio); });
}

function loadStudentPortfolioAsync(studentNameOrId) {
    return loadPortfolioAsync().then(function(portfolio) {
        if (portfolio[studentNameOrId]) {
            return portfolio[studentNameOrId];
        }
        if (WFT_STUDENT_ID_MAP_V1) {
            var settings = readWftRequiredStorage('wft_settings');
            if (settings.studentIdMap) {
                var keys = Object.keys(settings.studentIdMap);
                for (var lsi = 0; lsi < keys.length; lsi++) {
                    if (settings.studentIdMap[keys[lsi]] === studentNameOrId) {
                        return portfolio[keys[lsi]] || { sessions: [] };
                    }
                }
            }
        }
        return { sessions: [] };
    });
}

function saveStudentPortfolioAsync(studentNameOrId, studentData) {
    return Promise.resolve().then(function() {
        // Keep the local read and write together so concurrent student saves retain each other.
        var portfolio = getLocalPortfolioSnapshot();
        var targetKey = studentNameOrId;
        if (WFT_STUDENT_ID_MAP_V1 && !portfolio[studentNameOrId]) {
            var settings = readWftRequiredStorage('wft_settings');
            if (settings.studentIdMap) {
                var keys = Object.keys(settings.studentIdMap);
                for (var ssi = 0; ssi < keys.length; ssi++) {
                    if (settings.studentIdMap[keys[ssi]] === studentNameOrId) {
                        targetKey = keys[ssi];
                        break;
                    }
                }
            }
        }
        portfolio[targetKey] = studentData;
        return savePortfolioData(portfolio);
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
                    tx.oncomplete = function() { resolve(req.result); };
                    tx.onabort = function() { reject(tx.error || new Error("IndexedDB read aborted")); };
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
                    tx.oncomplete = function() { resolve(req.result); };
                    tx.onabort = function() { reject(tx.error || new Error("IndexedDB write aborted")); };
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
                    tx.oncomplete = function() { resolve(); };
                    tx.onabort = function() { reject(tx.error || new Error("IndexedDB delete aborted")); };
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
                    tx.oncomplete = function() { resolve(req.result || []); };
                    tx.onabort = function() { reject(tx.error || new Error("IndexedDB read aborted")); };
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
                    tx.oncomplete = function() { resolve(); };
                    tx.onabort = function() { reject(tx.error || new Error("IndexedDB clear aborted")); };
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
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(storeNames, "readwrite");
                tx.oncomplete = function() { resolve(); };
                tx.onabort = function() { reject(tx.error || new Error("IndexedDB cache clear aborted")); };
                try {
                    for (var sn = 0; sn < storeNames.length; sn++) tx.objectStore(storeNames[sn]).clear();
                } catch (e) {
                    tx.abort();
                    reject(e);
                }
            });
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
        if (this.mode === "indexeddb" && WFT_INDEXEDDB_CACHE_V1 && !isWftStorageSafeMode()) {
            return WftIndexedDb.get("portfolioIndex", "current").catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    savePortfolioIndex: function(index) {
        if (this.mode === "indexeddb" && WFT_INDEXEDDB_CACHE_V1 && !isWftStorageSafeMode()) {
            var record = { id: "current", data: index, updatedAt: new Date().toISOString() };
            return WftIndexedDb.put("portfolioIndex", record).catch(function() {});
        }
        return Promise.resolve();
    },

    getStudentPortfolio: function(studentId) {
        if (this.mode === "indexeddb" && WFT_INDEXEDDB_CACHE_V1 && !isWftStorageSafeMode()) {
            return WftIndexedDb.get("studentPortfolios", studentId).catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    saveStudentPortfolio: function(studentId, data) {
        if (this.mode === "indexeddb" && WFT_INDEXEDDB_CACHE_V1 && !isWftStorageSafeMode()) {
            var record = { studentId: studentId, data: data, cachedAt: new Date().toISOString() };
            return WftIndexedDb.put("studentPortfolios", record).catch(function() {});
        }
        return Promise.resolve();
    },

    getMetadata: function(key) {
        if (this.mode === "indexeddb" && WFT_INDEXEDDB_CACHE_V1 && !isWftStorageSafeMode()) {
            return WftIndexedDb.get("metadata", key).then(function(record) {
                return record ? record.value : null;
            }).catch(function() { return null; });
        }
        return Promise.resolve(null);
    },

    setMetadata: function(key, value) {
        if (this.mode === "indexeddb" && WFT_INDEXEDDB_CACHE_V1 && !isWftStorageSafeMode()) {
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
        settings.studentIdMap = Object.assign(Object.create(null), settings.studentIdMap || {});

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
    var portfolio = getLocalPortfolioSnapshot();
    if (portfolio[studentNameOrId]) { return studentNameOrId; }

    if (WFT_STUDENT_ID_MAP_V1) {
        var settings = readWftRequiredStorage('wft_settings');
        if (settings.studentIdMap) {
            var keys = Object.keys(settings.studentIdMap);
            for (var rk = 0; rk < keys.length; rk++) {
                if (settings.studentIdMap[keys[rk]] === studentNameOrId) {
                    return keys[rk];
                }
            }
        }
    }
    return studentNameOrId;
}

function updateStudentRecordOnRename(oldName, newName, settings) {
    if (!WFT_STUDENT_ID_MAP_V1) return;
    settings.studentIdMap = Object.assign(Object.create(null), settings.studentIdMap || {});
    if (!settings.studentRecords) settings.studentRecords = [];
    var studentId = settings.studentIdMap[oldName] || createStableStudentId(oldName, settings.studentIdMap);
    settings.studentIdMap[oldName] = studentId;
    settings.studentIdMap[newName] = studentId;

    var found = false;
    for (var rni = 0; rni < settings.studentRecords.length; rni++) {
        var rec = settings.studentRecords[rni];
        if (rec.studentId === studentId || rec.displayName === oldName) {
            rec.studentId = studentId;
            rec.displayName = newName;
            if (!rec.legacyNameKeys) rec.legacyNameKeys = [];
            if (rec.legacyNameKeys.indexOf(oldName) === -1) rec.legacyNameKeys.push(oldName);
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
        if (typeof parentFolderId !== "string" || !parentFolderId.trim()) { reject(new Error("No parent folder ID")); return; }
        if (!driveAccessToken) { reject(new Error("Not signed in")); return; }
        var metadata = { name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parentFolderId] };
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://www.googleapis.com/drive/v3/files", true);
        xhr.setRequestHeader("Authorization", "Bearer " + driveAccessToken);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var folder = JSON.parse(xhr.responseText);
                    if (!folder || typeof folder.id !== "string" || !folder.id.trim()) { reject(new Error("Folder create did not return a Drive folder ID.")); return; }
                    resolve(folder.id);
                }
                catch (e) { reject(new Error("Failed to parse folder response")); }
            } else {
                var parsed = parseWftGoogleApiErrorText(xhr.responseText);
                var error = new Error(parsed.message || "Folder create failed: " + xhr.status);
                error.status = xhr.status; error.reason = parsed.reason; error.raw = parsed.raw;
                reject(error);
            }
        };
        xhr.onerror = function() { reject(new Error("Network error creating folder")); };
        xhr.send(JSON.stringify(metadata));
    });
}

function ensureWftSubfolderPromise(folderName, parentFolderId) {
    if (typeof parentFolderId !== "string" || !parentFolderId.trim()) { return Promise.reject(new Error("No parent folder ID")); }
    return findWftFilesByNameInFolderPromise(folderName, parentFolderId).then(function(files) {
        for (var fi = 0; fi < files.length; fi++) {
            if (files[fi].mimeType === "application/vnd.google-apps.folder") {
                if (typeof files[fi].id !== "string" || !files[fi].id.trim()) { throw new Error("Folder search did not return a Drive folder ID."); }
                return files[fi].id;
            }
        }
        return createWftSubfolder(folderName, parentFolderId);
    });
}

function ensureWftStudentsFolderPromise(connection) {
    connection = connection || captureWftArchiveConnection();
    var cachedId = "";
    try { cachedId = localStorage.getItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY) || ""; } catch (e) {}
    var parentId = getWftDriveFolderId();
    var validation = typeof cachedId === 'string' && cachedId.trim()
        ? wftDriveFetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(cachedId) + "?fields=id,name,mimeType,trashed,parents", undefined, connection)
            .then(function(response) { return response.json(); })
            .then(function(folder) { return !!(folder && folder.id === cachedId && folder.name === 'students' && folder.mimeType === 'application/vnd.google-apps.folder' && folder.trashed === false && Array.isArray(folder.parents) && folder.parents.indexOf(parentId) !== -1); })
            .catch(function(e) { if (e.notFound) return false; throw e; })
        : Promise.resolve(false);
    return validation.then(function(valid) {
        assertWftArchiveConnection(connection);
        if (valid) return cachedId;
        try { localStorage.removeItem(WFT_DRIVE_STUDENTS_FOLDER_ID_KEY); } catch (e) {}
        return ensureWftSubfolderPromise("students", parentId);
    }).then(function(newId) {
        assertWftArchiveConnection(connection);
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
    if (typeof folderId !== "string" || !folderId.trim()) { return Promise.reject(new Error("No parent folder ID")); }
    preflightWftRequiredStorage();
    var connection = captureWftArchiveConnection();
    return findWftFilesByNameInFolderPromise(filename, folderId).then(function(files) {
        assertWftArchiveConnection(connection);
        preflightWftRequiredStorage();
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
        assertWftArchiveConnection(connection);
        if (!fileData || typeof fileData.id !== 'string' || !fileData.id.trim()) { throw new Error("Student file upload did not return a Drive file ID."); }
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
            return downloadWftJsonFilePromise(canonical.id, 'student');
        }
        return null;
    }).then(function(data) {
        if (data && data.studentId !== studentId) throw new Error("Student portfolio file belongs to a different student.");
        if (data && data.format === "student-portfolio-v1") { callback(null, data); }
        else { callback(null, null); }
    }).catch(function(err) { if (callback) { callback(err, null); } });
}

function saveStudentFileToDrive(studentId, data, callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) { if (callback) { callback(null, "feature-disabled"); } return; }
    var connection = captureWftArchiveConnection();
    var record = {
        schemaVersion: 1, format: "student-portfolio-v1", studentId: studentId,
        displayName: data.displayName || "", legacyNameKeys: data.legacyNameKeys || [],
        createdAt: data.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
        sessions: data.sessions || []
    };
    var filename = buildStudentPortfolioFileName(studentId);
    ensureDriveFolderPromise(connection).then(function() {
        assertWftArchiveConnection(connection);
        return ensureWftStudentsFolderPromise(connection);
    }).then(function(studentsFolderId) {
        assertWftArchiveConnection(connection);
        return saveJsonToDriveFolderPromise(filename, record, studentsFolderId);
    }).then(function(fileData) {
        assertWftArchiveConnection(connection);
        if (fileData && fileData.id) {
            try { localStorage.setItem("wft_drive_student_file_" + studentId, fileData.id); } catch (e) {}
        }
        if (callback) { callback(null, fileData && fileData.id ? fileData.id : "saved"); }
    }).catch(function(err) {
        if (callback) { callback(err, null); }
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
        sessions: mergeStudentSessions(localFile.sessions || [], remoteFile.sessions || [], deletions || {}, localFile.studentId || remoteFile.studentId || "", localFile.displayName || remoteFile.displayName || "")
    };
}

function mergeStudentSessions(localSessions, remoteSessions, deletions, studentId, studentName) {
    var merged = Object.create(null);
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
        if (isStudentSessionDeleted(sessionId, sessionStudentId, deletions, session.updatedAt || session.createdAt, session.lamportClock, studentName)) { continue; }
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
        var legacyRecord = {
            id: legacy.id || keys[i],
            type: legacy.type || "session",
            studentId: legacy.studentId || "",
            studentName: legacy.studentName || "",
            sessionId: legacy.sessionId || "",
            legacyKey: keys[i],
            deletedAt: legacy.deletedAt || clean.updatedAt || "",
            deviceId: legacy.deviceId || "",
            reason: legacy.reason || "teacher_delete"
        };
        if (typeof legacy.lamportClock === "number") { legacyRecord.lamportClock = legacy.lamportClock; }
        records.push(legacyRecord);
    }
    return records;
}

function isStudentSessionDeleted(sessionId, studentId, deletions, sessionUpdatedAt, sessionLamportClock, studentName) {
    if (!deletions || !sessionId) { return false; }
    var records = getWftDeletionRecords(deletions);
    var sessionUpdateMs = (sessionUpdatedAt && !isNaN(Date.parse(sessionUpdatedAt))) ? Date.parse(sessionUpdatedAt) : 0;
    var normalizedStudentId = String(studentId || "");
    function matchesStudentOwner(d, legacyKey, keyedSession, suffix) {
        if (keyedSession && !d.studentId && !d.studentName) {
            var owner = legacyKey.slice(8, -suffix.length);
            if (owner && owner !== normalizedStudentId && owner.toLowerCase() !== String(studentName || '').trim().toLowerCase()) return false;
        }
        if (studentName && d.studentId && !normalizedStudentId && !d.studentName) return false;
        if (normalizedStudentId && d.studentId && String(d.studentId) !== normalizedStudentId) { return false; }
        if (studentName && d.studentName && !(normalizedStudentId && d.studentId) && String(d.studentName).trim().toLowerCase() !== String(studentName).trim().toLowerCase()) return false;
        return true;
    }

    function deletionIsNewer(d) {
        var useLamport = WFT_LAMPORT_V1 && typeof d.lamportClock === "number" && !isNaN(d.lamportClock);
        if (useLamport) {
            var sessLam = (typeof sessionLamportClock === "number" && !isNaN(sessionLamportClock)) ? sessionLamportClock : -1;
            // Deletion wins only if its Lamport clock is strictly higher than the session's.
            // If they are equal or the session is higher, the session survives.
            if (d.lamportClock > sessLam) { return true; }
            return false;
        }
        var deletedMs = (d.deletedAt && !isNaN(Date.parse(d.deletedAt))) ? Date.parse(d.deletedAt) : 0;
        if (!deletedMs) { return false; }
        if (!sessionUpdateMs || deletedMs > sessionUpdateMs) { return true; }
        return false;
    }

    for (var i = 0; i < records.length; i++) {
        var d = records[i] || {};
        var type = d.type || "session";
        if (type !== "session" && type !== "archive-remove") { continue; }
        var suffix = ':' + String(sessionId);
        var legacyKey = String(d.legacyKey || '');
        var keyedSession = legacyKey.indexOf('session:') === 0 && legacyKey.slice(-suffix.length) === suffix;
        if (String(d.sessionId || "") !== String(sessionId) && (d.sessionId || !keyedSession)) continue;
        if (!matchesStudentOwner(d, legacyKey, keyedSession, suffix)) { continue; }
        if (deletionIsNewer(d)) { return true; }
    }
    return false;
}

function applyDeletionsToFile(file, deletions) {
    if (!file) { return null; }
    var filtered = { schemaVersion: file.schemaVersion, format: file.format, studentId: file.studentId,
        displayName: file.displayName, legacyNameKeys: file.legacyNameKeys || [],
        createdAt: file.createdAt, updatedAt: new Date().toISOString(), sessions: [] };
    var sessions = file.sessions || [];
    for (var i = 0; i < sessions.length; i++) {
        if (!isStudentSessionDeleted(sessions[i].id, file.studentId || "", deletions, sessions[i].updatedAt || sessions[i].createdAt, sessions[i].lamportClock, file.displayName)) { filtered.sessions.push(sessions[i]); }
    }
    return filtered;
}

function syncStudentFileWithMerge(studentId, localData, callback) {
    if (!WFT_SPLIT_STUDENT_FILES_V1) { if (callback) { callback(null, localData); } return; }
    loadStudentFileFromDrive(studentId, function(err, remoteFile) {
        if (err) { if (callback) callback(err, null); return; }
        if (!remoteFile) {
            saveStudentFileToDrive(studentId, localData, function(saveErr) {
                if (saveErr) { wftDebugWarn("[Merge] Could not save local student file for", studentId, ":", saveErr.message || saveErr); }
                if (callback) { callback(saveErr, localData); }
            });
            return;
        }
        var deletions;
        try { preflightWftRequiredStorage(); deletions = normalizeDeletionsData(readWftRequiredStorage(WFT_DELETIONS_STORAGE_KEY)); }
        catch (e) { if (callback) callback(e, null); return; }
        var merged = mergeStudentPortfolioFiles(localData, remoteFile, deletions);
        saveStudentFileToDrive(studentId, merged, function(saveErr) {
            if (saveErr) { wftDebugWarn("[Merge] Could not save merged student file for", studentId, ":", saveErr.message || saveErr); }
            if (callback) { callback(saveErr, merged); }
        });
    });
}

function rebuildIndexFromStudentFiles(studentFiles) {
    var index = { schemaVersion: 1, format: "portfolio-index-v1", updatedAt: new Date().toISOString(),
        source: "split-student-files", students: Object.create(null) };
    if (!studentFiles) { return index; }
    var keys = Object.keys(studentFiles);
    for (var i = 0; i < keys.length; i++) {
        var file = studentFiles[keys[i]];
        if (!file || file.format !== "student-portfolio-v1") { continue; }
        var sessions = file.sessions || [], latest = "", totalScore = 0, scorable = 0;
        for (var j = 0; j < sessions.length; j++) {
            var s = sessions[j];
            if (s.createdAt && (!latest || s.createdAt > latest)) { latest = s.createdAt; }
            var score = Object.prototype.hasOwnProperty.call(s, "overall") ? s.overall : s.overallScore;
            if (typeof score === "string" && score.trim()) { score = Number(score); }
            if (typeof score === "number" && isFinite(score)) { totalScore += score; scorable += 1; }
        }
        index.students[file.studentId] = { studentId: file.studentId, displayName: file.displayName,
            legacyNameKey: (file.legacyNameKeys && file.legacyNameKeys.length > 0) ? file.legacyNameKeys[0] : file.displayName,
            sessionCount: sessions.length, latestSessionAt: latest, averageScore: scorable > 0 ? Math.round(totalScore / scorable) : null,
            studentFileId: "", studentFileEtag: "", hasUnloadedDetails: true };
    }
    return index;
}

function mergeWftStringArrays(arr1, arr2) {
    var seen = Object.create(null), result = [];
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
    function loadLocal(error) {
        try {
            var portfolio = getLocalPortfolioSnapshot();
            var resolvedKey = resolveStudentPortfolioKey(displayName || studentId);
            if (!portfolio[resolvedKey] && error) { callback(error, null); return; }
            callback(null, portfolio[resolvedKey] || { sessions: [] });
        } catch (e) { callback(e, null); }
    }
    if (!WFT_LAZY_PORTFOLIO_LOAD_V1 || isWftStorageSafeMode()) {
        loadLocal();
        return;
    }

    var checkCache = WFT_INDEXEDDB_CACHE_V1 ? WftStorage.getStudentPortfolio(studentId) : Promise.resolve(null);
    checkCache.then(function(cached) {
        if (cached && cached.data && Array.isArray(cached.data.sessions) && (!cached.data.studentId || cached.data.studentId === studentId)) {
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
                    loadLocal(err || new Error("Student portfolio file is unavailable."));
                }
            });
        } else {
            loadLocal();
        }
    }).catch(function(error) {
        loadLocal(error);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// END PATCH 11
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

// Phase 3 — Cloud data split ENABLED (permanent commitment)
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
    return isWftTokenPayloadValid(wftSyncState.accessToken, wftSyncState.tokenExpiresAt);
}

var wftGoogleAuthOperationId = 0;
var wftTokenSessionBlocked = false;
var wftTokenPersistenceWarning = '';

function captureWftGoogleAuthOperation() {
    return { id: wftGoogleAuthOperationId, token: wftSyncState.accessToken, legacyToken: driveAccessToken };
}

function isCurrentWftGoogleAuthOperation(operation) {
    return operation.id === wftGoogleAuthOperationId && operation.token === wftSyncState.accessToken && operation.legacyToken === driveAccessToken;
}

function clearWftLegacyTokenCache() {
    var cleared = true;
    [DRIVE_TOKEN_CACHE_KEY, DRIVE_TOKEN_EXPIRY_CACHE_KEY].forEach(function(key) {
        try { localStorage.removeItem(key); } catch (e) { cleared = false; }
    });
    return cleared;
}

function clearPersistedGoogleState() {
    var cleared = clearWftLegacyTokenCache();
    // Identity hints cannot authorize Drive; their removal is optional after token removal.
    [GOOGLE_USER_CACHE_KEY, GOOGLE_CONNECTED_CACHE_KEY].forEach(function(key) {
        try { localStorage.removeItem(key); } catch (e) { }
    });
    return cleared;
}

function getCachedGoogleUser() {
    try {
        var cachedUserRaw = localStorage.getItem(GOOGLE_USER_CACHE_KEY);
        if (!cachedUserRaw) return null;
        var cachedUser = JSON.parse(cachedUserRaw);
        if (cachedUser && (cachedUser.name || cachedUser.email)) {
            return cachedUser;
        }
    } catch (e) {}
    return null;
}

function hasPersistedGoogleConnection() {
    try { return localStorage.getItem(GOOGLE_CONNECTED_CACHE_KEY) === "1"; } catch (e) { return false; }
}

function finishWftGoogleSignInWithAccessToken(accessToken, expiresIn, scope, source, onSuccess) {
    if (!isWftTokenPayloadValid(accessToken, getWftOAuthTokenExpiry(expiresIn))) {
        setDriveSyncStatus('error', 'Google sign-in returned an invalid token or expiration. Please retry.');
        return false;
    }
    wftGoogleAuthOperationId += 1;
    var operation = captureWftGoogleAuthOperation();
    setDriveSyncStatus('syncing', 'Checking saved Google work...');
    window.GoogleDriveMigration.ensure({
        oldClient: '546695859117-18drps6vl0l8u6pcp9mgfhcc972rebl0.apps.googleusercontent.com',
        newClient: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        folderName: 'WritingFeedbackTool'
    }, accessToken).then(async function(result) {
        if (!isCurrentWftGoogleAuthOperation(operation)) return;
        // Retire inaccessible old file IDs while keeping drafts, portfolios and settings.
        var keys = Object.keys(localStorage).filter(function(key) {return /^wft_drive_.*(?:file_id|folder_id|folder_)/.test(key);});
        keys.forEach(function(key) {localStorage.removeItem(key);});
        if (result.ids) {
            Object.keys(localStorage).filter(function(key) {return key.indexOf('wft_') === 0;}).forEach(function(key) {
                var raw = localStorage.getItem(key);
                if (raw && /^[\[{]/.test(raw)) localStorage.setItem(key, JSON.stringify(window.GoogleDriveMigration.remap(JSON.parse(raw), result.ids)));
            });
            if (typeof pendingPortfolioSync !== 'undefined') pendingPortfolioSync = window.GoogleDriveMigration.remap(pendingPortfolioSync, result.ids);
            if (window.indexedDB) {
                var db = await WftIndexedDb.open();
                if (!isCurrentWftGoogleAuthOperation(operation)) return;
                var stores = Array.from(db.objectStoreNames);
                if (stores.length) await new Promise(function(resolve, reject) {
                    var tx = db.transaction(stores, 'readwrite');
                    tx.oncomplete = resolve;
                    tx.onerror = tx.onabort = function() {reject(tx.error || new Error('Local portfolio recovery failed.'));};
                    stores.forEach(function(store) {
                        var cursor = tx.objectStore(store).openCursor();
                        cursor.onsuccess = function() {
                            if (!isCurrentWftGoogleAuthOperation(operation)) { tx.abort(); return; }
                            var record = cursor.result;
                            if (!record) return;
                            record.update(window.GoogleDriveMigration.remap(record.value, result.ids));
                            record.continue();
                        };
                    });
                });
            }
        }
        if (!isCurrentWftGoogleAuthOperation(operation)) return;
        driveFolderId = null;
        wftSyncState.folderId = null;
        wftSyncState.settingsFileId = null;
        wftSyncState.portfolioFileId = null;
        wftSyncState.deletionsFileId = null;
        googleUser = result.user;
        try { localStorage.setItem(GOOGLE_USER_CACHE_KEY, JSON.stringify(result.user)); } catch (e) { }
        completeWftGoogleSignInWithAccessToken(accessToken, expiresIn, scope, source, onSuccess);
    }).catch(function(error) { if (isCurrentWftGoogleAuthOperation(operation)) setDriveSyncStatus('error', error.message); });
    return true;
}

function completeWftGoogleSignInWithAccessToken(accessToken, expiresIn, scope, source, onSuccess) {
    var expiresAt = getWftOAuthTokenExpiry(expiresIn);
    if (!isWftTokenPayloadValid(accessToken, expiresAt)) {
        setDriveSyncStatus('error', 'Google sign-in returned an invalid token or expiration. Please retry.');
        return false;
    }
    wftGoogleAuthOperationId += 1;
    var persisted = saveWftTokenSession(accessToken, expiresAt);
    var legacyCleared = clearWftLegacyTokenCache();
    wftTokenPersistenceWarning = !persisted ? 'Connected in this tab, but the session could not be saved. Sign out and retry before reloading.'
        : (!legacyCleared ? 'Connected, but an old token could not be removed. Sign out and retry before reloading.' : '');
    try {
        localStorage.setItem(GOOGLE_CONNECTED_CACHE_KEY, '1');
    } catch (storageErr) { }

    wftSyncState.accessToken = accessToken;
    wftSyncState.tokenExpiresAt = expiresAt;
    wftSyncState.signedIn = true;
    wftSyncState.authBlocked = false;
    wftSyncState.permissionBlocked = false;
    wftSyncState.lastError = null;
    driveAccessToken = accessToken;
    var operation = captureWftGoogleAuthOperation();
    try { localStorage.removeItem("wft_oauth_pending_action"); } catch (e0) { }
    syncStateFromLegacyGoogleGlobals();

    // Give immediate visible feedback. User info fetch may take a moment or fail
    // independently, but a valid token means the app is connected.
    googleUser = googleUser || getCachedGoogleUser() || { name: "Connected" };
    showSignedInState(googleUser);

    wftSyncLog("[WFT Sync][AUTH] OAuth token received", {
        hasAccessToken: true,
        expiresIn: expiresIn == null ? 3600 : Number(expiresIn),
        scope: scope || "",
        source: source || "unknown"
    });

    fetchGoogleUserInfo(accessToken);

    if (typeof onSuccess === "function") {
        setTimeout(function() {
            if (!isCurrentWftGoogleAuthOperation(operation)) return;
            try { onSuccess(); } catch (e) { wftDebugError("Google sign-in success callback failed:", e); }
        }, 0);
    }

    return true;
}

function getWftOAuthRedirectUri() {
    try {
        var path = window.location.pathname || "/";
        if (!/\/$/.test(path)) {
            path = path.replace(/\/[^\/]*$/, "/");
            if (!path) path = "/";
        }
        return window.location.origin + path;
    } catch (e) {
        return "https://thepick.github.io/writing-feedback-tool/";
    }
}

function isWftGisTokenClientAvailable() {
    return !!(typeof window !== "undefined"
        && window.google
        && window.google.accounts
        && window.google.accounts.oauth2
        && typeof window.google.accounts.oauth2.initTokenClient === "function");
}

// Read OAuth tokens delivered via the URL fragment (#) after Google redirects
// back to the app using the implicit grant fallback flow.
function checkHashForOAuthTokens() {
    var hash = window.location.hash;
    if (!hash) return false;

    try {
        var params = new URLSearchParams(hash.substring(1));
        var authError = params.get('error');
        if (authError) {
            var errorDescription = params.get('error_description') || authError;
            setDriveSyncStatus("error", "Google sign-in did not complete: " + errorDescription);
            try { history.replaceState(null, document.title || '', window.location.pathname + window.location.search); } catch (e1) { }
            return false;
        }

        var accessToken = params.get('access_token');
        var expiresIn = params.get('expires_in');

        if (!accessToken) return false;

        var handled = finishWftGoogleSignInWithAccessToken(accessToken, expiresIn, params.get("scope") || "", "oauth-redirect", function() { manualSaveToDrive(); });
        try { history.replaceState(null, document.title || '', window.location.pathname + window.location.search); } catch (e2) { }
        return handled;
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
    var legacyCleared = clearWftLegacyTokenCache();
    showSignedOutState();
    if (!legacyCleared) {
        setDriveSyncStatus('error', 'An old Google token could not be removed. Retry Sign Out before reloading.');
    } else if (cachedUser || hasConnectionMarker) {
        setDriveSyncStatus("error", "Session expired - please sign in again.");
    }
    return false;
}

var WFT_OAUTH_TEXTAREA_DRAFT_KEY = "wft_oauth_textarea_draft_v1";

function saveWftOAuthDraftBeforeRedirect(reason) {
    try {
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        // A redirect destroys this tab; the text draft does not contain pending work or selected photos.
        if (getPendingPortfolioSync() && !persistPendingPortfolioSync()) {
            setDriveSyncStatus('error', 'Writing or photos cannot be fully recovered after redirect sign-in. Keep this tab open and retry Sign In when the Google popup is available, or download Emergency Backup.');
            return false;
        }
        if (selectedImages.some(function(image) { return image && !image.driveFileId && (image.dataUrl || image.originalDataUrl); })) {
            setDriveSyncStatus('error', 'Google redirect sign-in cannot restore selected photos. Keep this tab open and retry Sign In when the Google popup is available.');
            return false;
        }
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
        var previousRaw = localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY);
        if (previousRaw) {
            var previous = JSON.parse(previousRaw);
            if (!isPreviousDraftCompatible()) {
                setDriveSyncStatus('error', 'A previous writing draft is kept for recovery. Restore or copy it before starting another redirect sign-in. Your current writing is still here.');
                return false;
            }
        }
        localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, JSON.stringify(draft));
        return true;
    } catch (e) {
        setDriveSyncStatus('error', 'Unsaved writing or photos could not be preserved for Google sign-in. Keep this tab open; retry or copy your work before leaving.');
        return false;
    }

    function isPreviousDraftCompatible() {
        if (!previous) return false;
        if (previous.text !== draft.text) return false;
        if ((previous.selectedStudent || '') !== draft.selectedStudent) return false;
        if ((previous.manualGenreOverrideValue || '__auto__') !== draft.manualGenreOverrideValue) return false;
        if ((previous.writingGenreSelectValue || '__auto__') !== draft.writingGenreSelectValue) return false;
        return true;
    }
}

function restoreWftOAuthDraftAfterRedirect() {
    try {
        var raw = localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY);
        if (!raw) return false;
        var draft = JSON.parse(raw);
        if (!draft || typeof draft.text !== 'string' || ['selectedStudent', 'manualGenreOverrideValue', 'writingGenreSelectValue'].some(function(key) {
            return draft[key] !== undefined && typeof draft[key] !== 'string';
        })) throw new Error('Unreadable writing draft');

        var ta = document.getElementById("studentWriting");
        if (!ta) throw new Error('Writing field unavailable');
        // A removal retry may find the exact writing already restored; other writing must stay coherent.
        var alreadyRestored = ta.value === draft.text && selectedStudent === (draft.selectedStudent || '')
            && manualGenreOverrideValue === (draft.manualGenreOverrideValue || '__auto__')
            && document.getElementById('writingGenreSelect').value === (draft.writingGenreSelectValue || draft.manualGenreOverrideValue || '__auto__');
        if (ta.value !== '' && !alreadyRestored) {
            setOcrStatus('Saved writing is kept for recovery. Clear the current writing and retry restoration when ready.', 'error');
            return false;
        }
        ta.value = draft.text;
        selectedStudent = draft.selectedStudent || '';
        try { localStorage.setItem("wft_selectedStudent", selectedStudent); } catch (e2) { }
        var studentSelect = document.getElementById("studentSelect");
        if (studentSelect) {
            if (selectedStudent && !Array.from(studentSelect.options).some(function(option) { return option.value === selectedStudent; })) {
                var recoveredOption = document.createElement('option');
                recoveredOption.value = selectedStudent;
                recoveredOption.textContent = selectedStudent + ' (recovered draft)';
                studentSelect.appendChild(recoveredOption);
            }
            studentSelect.value = selectedStudent;
        }
        manualGenreOverrideValue = draft.manualGenreOverrideValue || '__auto__';
        var genreSelect = document.getElementById("writingGenreSelect");
        if (genreSelect) genreSelect.value = draft.writingGenreSelectValue || manualGenreOverrideValue;
        if (typeof syncUiState === "function") syncUiState();
        if (ta.value !== draft.text) throw new Error('Writing could not be fully restored');
        localStorage.removeItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY);
        if (typeof setOcrStatus === "function" && draft.text && draft.text.trim()) {
            setOcrStatus("Restored unsaved writing after Google sign-in.", "success");
        }
        return true;
    } catch (e) {
        setOcrStatus('Saved writing could not be fully restored or consumed. Its bytes are kept for recovery; retry when storage is available.', 'error');
        return false;
    }
}

function requestDriveAccess(onSuccess, options) {
    wftGoogleAuthOperationId += 1;
    var operation = captureWftGoogleAuthOperation();
    var scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
    var opts = options || {};

    if (typeof onSuccess === "function") {
        try { localStorage.setItem("wft_oauth_pending_action", "sync"); } catch (e1) { }
    }

    if (WFT_GIS_AUTH_V2 && isWftGisTokenClientAvailable()) {
        try {
            setDriveSyncStatus("syncing", "Opening Google sign-in...");
            var tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: scope,
                include_granted_scopes: true,
                callback: function(response) {
                    if (!isCurrentWftGoogleAuthOperation(operation)) return;
                    if (!response || response.error) {
                        var msg = response && (response.error_description || response.error) ? (response.error_description || response.error) : "Google sign-in was cancelled or blocked.";
                        setDriveSyncStatus("error", msg);
                        return;
                    }
                    finishWftGoogleSignInWithAccessToken(response.access_token, response.expires_in, response.scope || scope, "gis-popup", onSuccess);
                },
                error_callback: function(error) {
                    if (!isCurrentWftGoogleAuthOperation(operation)) return;
                    var errMsg = error && (error.message || error.type) ? (error.message || error.type) : "Google sign-in popup could not open.";
                    setDriveSyncStatus("error", errMsg);
                }
            });
            tokenClient.requestAccessToken({ prompt: opts.prompt || "select_account" });
            return;
        } catch (gisErr) {
            wftDebugError("[WFT Auth] GIS sign-in failed; falling back to redirect:", gisErr);
        }
    }

    // Fallback: older implicit redirect flow. Use the current deployed URL
    // instead of a hardcoded GitHub URL so custom domains can complete auth.
    var redirectUri = getWftOAuthRedirectUri();
    var authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
        + "?client_id=" + encodeURIComponent(GOOGLE_CLIENT_ID)
        + "&redirect_uri=" + encodeURIComponent(redirectUri)
        + "&response_type=token"
        + "&include_granted_scopes=true"
        + "&prompt=" + encodeURIComponent(opts.prompt || "select_account")
        + "&scope=" + encodeURIComponent(scope);

    if (!saveWftOAuthDraftBeforeRedirect(typeof onSuccess === "function" ? "sync" : "sign-in")) return;
    window.location.href = authUrl;
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
    var operation = captureWftGoogleAuthOperation();
    fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + token }
    }).then(function(r) { return r.json(); }).then(function(info) {
        if (!isCurrentWftGoogleAuthOperation(operation) || token !== driveAccessToken || !isWftTokenValid()) return;
        googleUser = info;
        wftSyncState.googleUser = info;
        try { localStorage.setItem(GOOGLE_USER_CACHE_KEY, JSON.stringify(info)); } catch (e) { }

        showSignedInState(info);

        // ── WFT Sync V2: use V2 merge/sync instead of old Drive loading ──
        if (WFT_SYNC_ENGINE_V2) {
            startWftSyncPolling();
            syncWftNow("sign-in", { immediate: false });
        } else {
            loadSettingsFromDrive();
            loadPortfolioFromDrive();
            syncPendingPortfolioMedia();
            startDriveAutoSync();
        }
    }).catch(function(e) {
        if (!isCurrentWftGoogleAuthOperation(operation) || token !== driveAccessToken || !isWftTokenValid()) return;
        wftDebugError("Failed to fetch user info:", e);
        var cachedUser = getCachedGoogleUser();
        if (cachedUser) {
            googleUser = cachedUser;
            showSignedInState(cachedUser);
        } else if (driveAccessToken || hasPersistedGoogleConnection()) {
            googleUser = { name: "Connected" };
            showSignedInState(googleUser);
        }
        setDriveSyncStatus("error", "Reconnect may be needed");
    });
}

function showSignedInState(info) {
    var signInBtnHeader = document.getElementById("googleSignInBtnHeader");
    var userInfoHeader = document.getElementById("googleUserInfoHeader");
    if (signInBtnHeader) signInBtnHeader.style.display = "none";
    if (userInfoHeader) userInfoHeader.style.display = "flex";
    var displayName = (info && (info.name || info.email)) ? (info.name || info.email) : "Connected";
    var photoUrl = (info && (info.picture || info.photoURL)) ? (info.picture || info.photoURL) : "";
    setDuplicateSyncMaintenanceStatus("Checking for duplicate sync files after Drive connects...", 0, true);
    var nameElHeader = document.getElementById("googleUserNameHeader");
    if (nameElHeader) nameElHeader.textContent = displayName;
    var avatarHeader = document.getElementById("googleUserAvatarHeader");
    if (avatarHeader) {
        if (photoUrl) {
            avatarHeader.src = photoUrl;
            avatarHeader.style.display = "inline-block";
        } else {
            avatarHeader.style.display = "none";
        }
    }
    setDriveSyncStatus("syncing", "Connecting...");
}

// ── WFT Sync V2: reset sync state on sign-out ──
function resetWftSyncStateAfterSignOut() {
    wftGoogleAuthOperationId += 1;
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
    // The channel belongs to this page; keep it for a later sign-in and close on unload.
}
// ── WFT_BROADCAST_CHANNEL_V1: BroadcastChannel for multi-tab sync coordination ──
// ES5 compatible; creation is guarded so it fails gracefully in older browsers.
var wftSyncChannel = null;

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
function handleGoogleSignOut() {
    wftGoogleAuthOperationId += 1;
    var operation = captureWftGoogleAuthOperation();
    function finishSignOut() {
        if (!isCurrentWftGoogleAuthOperation(operation)) return;
        // Revoke the access token with Google
        if (driveAccessToken) {
            fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(driveAccessToken), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            }).catch(function() {});
        }
        var legacyCleared = clearPersistedGoogleState();
        var sessionCleared = clearWftTokenSession();
        wftTokenPersistenceWarning = '';
        clearWftLocalStorageAfterSignOut();
        stopDriveAutoSync();
        stopWftSyncPolling();
        showSignedOutState();
        setDriveSyncStatus(sessionCleared && legacyCleared ? '' : 'error', sessionCleared && legacyCleared
            ? 'Signed out - local data kept on this device'
            : 'Disconnected in this tab, but saved Google tokens could not be removed. Retry Sign Out before reloading; local data is kept.');
        try { updateSyncPortfolioButtonState(); } catch (e) { }
    }

    if (driveAccessToken) {
        setDriveSyncStatus('syncing', 'Syncing before sign out...');
        syncAllToDrive(function() {
            finishSignOut();
        });
        return;
    }

    finishSignOut();
}

function setDriveSyncStatus(state, text) {
    if (wftTokenPersistenceWarning && state !== 'error') { state = 'error'; text = wftTokenPersistenceWarning; }
    wftSyncLog("[WFT Sync] status", state || "", text || "", getWftSyncDebugSnapshot());
    var dot = document.getElementById("driveSyncDot");
    var txt = document.getElementById("driveSyncText");
    var dotHeader = document.getElementById("driveSyncDotHeader");
    var txtHeader = document.getElementById("driveSyncTextHeader");
    var dotClass = "drive-sync-dot" + (state ? " " + state : "");
    if (dot) { dot.className = dotClass; }
    if (dotHeader) { dotHeader.className = dotClass; }
    if (txt) txt.textContent = text || "";
    if (txtHeader) txtHeader.textContent = text || "";
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

function captureWftArchiveConnection() {
    return { token: wftSyncState.accessToken, legacyToken: driveAccessToken };
}

function assertWftArchiveConnection(connection) {
    // A refreshed token cannot prove the same account; require a fresh archive attempt.
    if (connection && (connection.token !== wftSyncState.accessToken || connection.legacyToken !== driveAccessToken)) {
        throw new Error('Drive connection changed during the archive. The current class was retained. Please retry with the intended account.');
    }
}

function wftDriveFetch(url, options, archiveConnection, isCurrentRequest) {
    options = options || {};
    wftSyncLog("[WFT Sync] Drive fetch start", (options.method || "GET"), url);

    if (url.indexOf("https://www.googleapis.com/") !== 0 &&
        url.indexOf("https://www.googleapis.com/upload/") !== 0) {
        return Promise.reject(new Error("Blocked non-Google API URL"));
    }

    if (!navigator.onLine) {
        setDriveSyncStatus("error", "Offline - will sync later");
        return Promise.reject(new Error("OFFLINE"));
    }

    if (!isWftTokenValid()) {
        wftSyncState.authBlocked = true;
        setDriveSyncStatus("error", "Session expired - please sign in again.");
        return Promise.reject(new Error("TOKEN_EXPIRED"));
    }

    options.headers = options.headers || {};
    options.headers.Authorization = "Bearer " + wftSyncState.accessToken;

    try { assertWftArchiveConnection(archiveConnection); }
    catch (e) { return Promise.reject(e); }
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

            if (isCurrentRequest && !isCurrentRequest()) throw err;

            if (response.status === 401) {
                wftSyncState.authBlocked = true;
                setDriveSyncStatus("error", "Session expired - please sign in again.");
            } else if (response.status === 404) {
                err.notFound = true;
                setDriveSyncStatus("error", "Drive file not found - will recreate on next sync.");
            } else if (response.status === 403 && /quota|rate/i.test(parsed.reason + " " + parsed.message)) {
                wftSyncState.quotaBlocked = true;
                setDriveSyncStatus("error", "Drive quota or rate limit reached.");
            } else if (response.status === 403) {
                wftSyncState.permissionBlocked = true;
                setDriveSyncStatus("error", "Drive permission issue - please reconnect.");
            } else {
                setDriveSyncStatus("error", "Drive sync needs attention.");
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

function validateCachedDriveFolderPromise(folderId, archiveConnection) {
    if (!folderId) return Promise.resolve(false);

    var url = "https://www.googleapis.com/drive/v3/files/"
        + encodeURIComponent(folderId)
        + "?fields=id,name,mimeType,trashed";

    if (!isWftTokenValid()) return Promise.resolve(false);

    wftSyncLog("[WFT Sync][FOLDER] cached folder validation start", folderId);
    assertWftArchiveConnection(archiveConnection);
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

function getWftFolderSyncFileSummary(folderId, archiveConnection) {
    var query = "'" + escapeDriveQueryValue(folderId) + "' in parents"
        + " and trashed=false"
        + " and (name='" + escapeDriveQueryValue(WFT_SETTINGS_FILENAME) + "'"
        + " or name='" + escapeDriveQueryValue(WFT_PORTFOLIO_FILENAME) + "'"
        + " or name='" + escapeDriveQueryValue(WFT_DELETIONS_FILENAME) + "')";
    var url = "https://www.googleapis.com/drive/v3/files"
        + "?q=" + encodeURIComponent(query)
        + "&fields=files(id,name,modifiedTime,createdTime,size,mimeType)"
        + "&orderBy=modifiedTime desc";

    return wftDriveFetch(url, undefined, archiveConnection).then(function (response) {
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
        assertWftArchiveConnection(archiveConnection);
        wftSyncWarn("[WFT Sync][FOLDER] sync file summary failed", { folderId: folderId, error: e });
        return { folderId: folderId, hasSettings: false, hasPortfolio: false, hasDeletions: false, newestTime: "", settingsFileId: "", portfolioFileId: "", deletionsFileId: "", fileCount: 0 };
    });
}

function chooseCanonicalDriveFolderPromise(folders, archiveConnection) {
    if (!folders || !folders.length) return Promise.resolve(null);
    if (folders.length === 1) return Promise.resolve(folders[0]);

    wftSyncWarn("[WFT Sync][FOLDER] duplicate WritingFeedbackTool folders detected", { count: folders.length, folders: folders });

    var chain = Promise.resolve([]);
    folders.forEach(function (folder) {
        chain = chain.then(function (summaries) {
            return getWftFolderSyncFileSummary(folder.id, archiveConnection).then(function (summary) {
                summary.folder = folder;
                summaries.push(summary);
                return summaries;
            });
        });
    });

    return chain.then(function (summaries) {
        assertWftArchiveConnection(archiveConnection);
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

function ensureDriveFolder(callback, onError) {
    ensureDriveFolderPromise()
        .then(function (folderId) {
            callback(folderId);
        }, function (e) {
            wftSyncErrorLog("[WFT Sync][FOLDER] legacy folder resolver failed", e);
            wftDebugError("Drive folder error:", e);
            setDriveSyncStatus("error", "Sync error");
            if (onError) onError(e);
        });
}

function saveFileToDrive(filename, content, mimeType, callback, isCurrentSave) {
    if (!driveAccessToken) { if (callback) callback(new Error("Not signed in"), null, null); return; }
    var connection = captureWftArchiveConnection();
    try {
        preflightWftRequiredStorage();
        if (filename === WFT_SETTINGS_FILENAME) {
            var settings = JSON.parse(content);
            validateWftRequiredStorage('wft_settings', settings);
            delete settings.apiKey;
            content = JSON.stringify(settings);
        }
    }
    catch (e) { if (callback) callback(e, null, null); return; }
    if (!isCurrentSave) setDriveSyncStatus("syncing", "Syncing...");
    ensureDriveFolder(function(folderId) {
        findWftFilesByNamePromise(filename).then(function(data) {
            assertWftArchiveConnection(connection);
            preflightWftRequiredStorage();
            if (filename === WFT_PORTFOLIO_FILENAME) {
                if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
                getLocalPortfolioSnapshot();
                validateWftPortfolioShape(JSON.parse(content));
            }
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
            }, connection, isCurrentSave).then(function (r) {
                return r.json();
            }).then(function (fileData) {
                assertWftArchiveConnection(connection);
                if (!fileData || typeof fileData.id !== 'string' || !fileData.id.trim()) throw new Error("Drive upload did not return a Drive file ID.");
                if (fileData && fileData.id) {
                    setCachedWftDriveFileId(filename, fileData.id);
                }
                return fileData;
            });
        }).then(function(fileData) {
            preflightWftRequiredStorage();
            var now = new Date();
            var fileId = fileData && fileData.id ? fileData.id : getCachedWftDriveFileId(filename);
            if (!isCurrentSave) setDriveSyncStatus("synced", "Synced " + now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));
            if (callback) callback(null, fileId, fileData || null);
        }).catch(function(e) {
            wftDebugError("Drive save error:", e);
            if (isCurrentSave && !isCurrentSave()) { if (callback) callback(e, null, null); return; }
            if (e && e.status === 404) {
                clearCachedWftDriveFileId(filename);
                if (!isCurrentSave) setDriveSyncStatus("error", "Drive file not found - retrying will recreate it.");
            } else {
                if (!isCurrentSave) setDriveSyncStatus("error", "Sync failed");
            }
            if (callback) callback(e, null, null);
        });
    }, function(e) { if (callback) callback(e, null, null); });
}

// ── WFT Sync Engine V2 Promise wrappers ──
function ensureDriveFolderPromise(archiveConnection) {
    archiveConnection = archiveConnection || captureWftArchiveConnection();
    assertWftArchiveConnection(archiveConnection);
    syncStateFromLegacyGoogleGlobals();
    assertWftArchiveConnection(archiveConnection);
    wftSyncLog("[WFT Sync][FOLDER] ensureDriveFolderPromise start", { memoryFolderId: driveFolderId || "", cachedFolderId: getCachedWftDriveFolderId() || "", runId: wftSyncState.syncRunId || 0 });

    if (wftSyncState.isSyncing &&
        wftSyncState.folderResolutionPromise &&
        wftSyncState.folderResolutionRunId === wftSyncState.syncRunId) {
        wftSyncLog("[WFT Sync][FOLDER] reusing run folder resolution", { runId: wftSyncState.syncRunId, folderId: wftSyncState.folderId || driveFolderId || "" });
        return wftSyncState.folderResolutionPromise;
    }

    var memoryFolderId = driveFolderId || wftSyncState.folderId || "";
    var cachedFolderId = memoryFolderId || getCachedWftDriveFolderId();

    var resolutionPromise = validateCachedDriveFolderPromise(cachedFolderId, archiveConnection).then(function (valid) {
        assertWftArchiveConnection(archiveConnection);
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

        return wftDriveFetch(searchUrl, undefined, archiveConnection).then(function(response) {
            return response.json();
        }).then(function(data) {
            var files = data && data.files ? data.files : [];
            wftSyncLog("[WFT Sync][FOLDER] folder search result", files.length, files);

            assertWftArchiveConnection(archiveConnection);
            return chooseCanonicalDriveFolderPromise(files, archiveConnection).then(function (selected) {
                assertWftArchiveConnection(archiveConnection);
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
                }, archiveConnection).then(function(createResponse) {
                    return createResponse.json();
                }).then(function(folder) {
                    assertWftArchiveConnection(archiveConnection);
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
        assertWftArchiveConnection(archiveConnection);
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
            }, function () { return !settled; }); // The V2 caller owns status, including after timeout.
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
    if ([0, 408, 429, 500, 502, 503, 504].includes(status)) return true;
    var msg = String(err.message || "");
    return /network|timeout|failed to fetch|SAVE_FILE_TIMEOUT/i.test(msg);
}

function saveFileToDrivePromise(filename, content, mimeType) {
    var maxAttempts = 3;
    var connection = captureWftArchiveConnection();
    function attempt(n) {
        try { assertWftArchiveConnection(connection); } catch (e) { return Promise.reject(e); }
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
    preflightWftRequiredStorage();
    var settings = readWftRequiredStorage('wft_settings');

    try {
        var modelSelect = document.getElementById('modelSelect');
        var targetWordCountEl = document.getElementById('targetWordCount');
        var useWordCountTargetEl = document.getElementById('useWordCountTarget');
        var assessScriptQualityEl = document.getElementById('assessScriptQuality');

        if (modelSelect) settings.model = modelSelect.value || '';
        if (targetWordCountEl) settings.targetWordCount = targetWordCountEl.value || '200';
        if (useWordCountTargetEl) settings.useWordCountTarget = useWordCountTargetEl.checked;
        if (typeof getGrammarStrictness === 'function') settings.grammarStrictness = getGrammarStrictness();
        if (assessScriptQualityEl) settings.assessScriptQuality = assessScriptQualityEl.checked;
        if (typeof getSelectedGradeLevel === 'function') settings.gradeLevel = getSelectedGradeLevel();
        if (typeof getClassGradeLevel === 'function') settings.classGradeLevel = getClassGradeLevel();
        settings.studentGradeLevelOverride = wftStudentGradeLevelOverride === true;
        if (typeof students !== "undefined" && Array.isArray(students)) {
            settings.students = applyDeletionsToStudents(students, getDeletionsData());
        }
    } catch (e2) {
        if (!settings.students && typeof students !== "undefined" && Array.isArray(students)) {
            settings.students = applyDeletionsToStudents(students, getDeletionsData());
        }
    }

    delete settings.apiKey;
    return settings;
}

function normalizePortfolioShape(portfolio) {
    validateWftPortfolioShape(portfolio);
    return normalizePortfolioData(portfolio);
}

function getLocalPortfolioSnapshot() {
    var raw = readWftStudentChangeStorage("wft_portfolio");
    return normalizePortfolioShape(raw === null ? {} : JSON.parse(raw));
}

// ── WFT Sync Engine V2 true-delete helpers ──
function getEmptyDeletionsData() {
    return {
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
        deletedStudents: {},
        restoredStudents: {},
        deletedSessions: {},
        records: []
    };
}

// WFT_TOMBSTONE_V1 — 90-day compaction for tombstone records (ES5-safe)
function compactDeletions(deletions) {
    if (!WFT_TOMBSTONE_COMPACTION_V1) { return deletions; }
    var clean = normalizeDeletionsData(deletions || {}, true);
    var nowMs = Date.now();
    var NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

    // Compact records array (primary storage)
    if (Array.isArray(clean.records)) {
        clean.records = clean.records.filter(function(rec) {
            if (!rec || !rec.deletedAt) { return true; }
            var delMs = Date.parse(rec.deletedAt);
            if (isNaN(delMs)) { return true; }
            return (nowMs - delMs) < NINETY_DAYS_MS;
        });
    }

    // Also trim legacy deletedSessions map entries older than 90 days
    if (clean.deletedSessions && typeof clean.deletedSessions === "object") {
        var keys = Object.keys(clean.deletedSessions);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var entry = clean.deletedSessions[key];
            if (entry && entry.deletedAt) {
                var ems = Date.parse(entry.deletedAt);
                if (!isNaN(ems) && (nowMs - ems) >= NINETY_DAYS_MS) {
                    delete clean.deletedSessions[key];
                }
            }
        }
    }

    // Preserve optional deletionLog if present and keep bounded (drop oldest beyond 200)
    if (Array.isArray(clean.deletionLog)) {
        clean.deletionLog = clean.deletionLog.filter(function(logEntry) {
            if (!logEntry || !logEntry.deletedAt) { return true; }
            var lms = Date.parse(logEntry.deletedAt);
            if (isNaN(lms)) { return true; }
            return (nowMs - lms) < NINETY_DAYS_MS;
        });
        if (clean.deletionLog.length > 200) {
            clean.deletionLog = clean.deletionLog.slice(clean.deletionLog.length - 200);
        }
    }

    clean.updatedAt = new Date().toISOString();
    return clean;
}

function normalizeDeletionsData(data, skipCompaction) {
    var clean = getEmptyDeletionsData();

    if (data && typeof data === "object") {
        clean = Object.assign(Object.create(null), clean, cloneWftJson(data));
        clean.schemaVersion = data.schemaVersion || 1;
        if (clean.schemaVersion < 2) { clean.schemaVersion = 2; }
        clean.updatedAt = data.updatedAt || clean.updatedAt;
        clean.deletedStudents = clean.deletedStudents && typeof clean.deletedStudents === "object" ? clean.deletedStudents : {};
        clean.restoredStudents = clean.restoredStudents && typeof clean.restoredStudents === "object" ? clean.restoredStudents : {};
        clean.deletedSessions = clean.deletedSessions && typeof clean.deletedSessions === "object" ? clean.deletedSessions : {};
        clean.records = Array.isArray(data.records) ? data.records.slice(0) : [];
    }

    // WFT_TOMBSTONE_V1 — run on every normalize/load
    return skipCompaction ? clean : compactDeletions(clean);
}

function getDeletionsData() {
    try {
        var raw = readWftStudentChangeStorage(WFT_DELETIONS_STORAGE_KEY);
        if (!raw) return getEmptyDeletionsData();
        return normalizeDeletionsData(JSON.parse(raw));
    } catch (e) {
        wftDebugWarn("[WFT Deletions] Could not parse deletions data:", e);
        return getEmptyDeletionsData();
    }
}

function saveDeletionsData(data, localOnly) {
    preflightWftRequiredStorage();
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
    validateWftRequiredStorage(WFT_DELETIONS_STORAGE_KEY, data);
    var clean = normalizeDeletionsData(data);
    clean.updatedAt = new Date().toISOString();

    try {
        localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
        wftDebugWarn("[WFT Deletions] Could not save deletions data:", e);
        throw e;
    }

    if (!localOnly && WFT_SYNC_ENGINE_V2 && !wftSuppressDirtyMarks) {
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

function recordStudentDeletion(studentName, deletions) {
    var name = String(studentName || "").trim();
    if (!name) return;

    var staged = !!deletions;
    deletions = deletions || getDeletionsData();
    deletions.deletedStudents[getDeletedStudentKey(name)] = {
        studentName: name,
        deletedAt: new Date().toISOString(),
        reason: "teacher_delete"
    };
    if (!staged) saveDeletionsData(deletions);
}

function getWftTombstoneTimeMs(record, fieldName) {
    var parsed;
    if (!record || !record[fieldName]) return 0;
    parsed = Date.parse(record[fieldName]);
    return isNaN(parsed) ? 0 : parsed;
}

function isStudentDeletedByTombstone(studentName, deletions) {
    var name = String(studentName || "").trim();
    var clean;
    var key;
    var deletedEntry;
    var restoredEntry;
    var deletedMs;
    var restoredMs;

    if (!name) return false;
    clean = normalizeDeletionsData(deletions || {});
    key = getDeletedStudentKey(name);
    deletedEntry = Object.prototype.hasOwnProperty.call(clean.deletedStudents, key) ? clean.deletedStudents[key] : null;
    if (!deletedEntry) return false;

    restoredEntry = Object.prototype.hasOwnProperty.call(clean.restoredStudents, key) ? clean.restoredStudents[key] : null;
    if (!restoredEntry) return true;

    deletedMs = getWftTombstoneTimeMs(deletedEntry, "deletedAt");
    restoredMs = getWftTombstoneTimeMs(restoredEntry, "restoredAt");

    if (!deletedMs && restoredMs) return false;
    if (deletedMs && !restoredMs) return true;

    // A restore at the same time or after a deletion means the teacher intentionally
    // re-added the student, usually through import after a mistaken reset/clear.
    return deletedMs > restoredMs;
}

function restoreStudentDeletion(studentName, reason, deletions) {
    var name = String(studentName || "").trim();
    var staged = !!deletions;
    var key;
    var now;

    if (!name) return;

    deletions = deletions || getDeletionsData();
    key = getDeletedStudentKey(name);
    now = new Date().toISOString();

    if (deletions.deletedStudents[key]) {
        delete deletions.deletedStudents[key];
    }

    if (!deletions.restoredStudents || typeof deletions.restoredStudents !== "object") {
        deletions.restoredStudents = {};
    }

    deletions.restoredStudents[key] = {
        studentName: name,
        restoredAt: now,
        reason: reason || "teacher_restore"
    };

    if (!staged) saveDeletionsData(deletions);
}

function clearStudentDeletion(studentName, deletions) {
    restoreStudentDeletion(studentName, "teacher_readd", deletions);
}

function recordSessionDeletion(studentName, sessionId, deletions) {
    var name = String(studentName || "").trim();
    var id = String(sessionId || "").trim();
    if (!name || !id) return;

    var staged = !!deletions;
    deletions = deletions || getDeletionsData();
    var now = new Date().toISOString();
    var studentId = "";
    try {
        var settings = getRawSettings ? getRawSettings() : {};
        studentId = settings.studentIdMap && Object.prototype.hasOwnProperty.call(settings.studentIdMap, name) ? settings.studentIdMap[name] : "";
    } catch (e) {}
    var record = {
        id: createWftId("del"),
        type: "session",
        studentId: studentId,
        studentName: name,
        sessionId: id,
        deletedAt: now,
        deviceId: getWftDeviceId(),
        reason: "teacher_delete"
    };
    deletions.deletedSessions[getDeletedSessionKey(name, id)] = cloneWftJson(record);
    if (studentId) {
        deletions.deletedSessions["session:" + studentId + ":" + id] = cloneWftJson(record);
    }
    if (!Array.isArray(deletions.records)) { deletions.records = []; }
    deletions.records.push(record);
    if (!staged) saveDeletionsData(deletions);
}

function saveWftStudentChange(change) {
    change.committed = false;
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) {
        if (!restoreWftStudentChangeStorage(wftStudentChangeRecovery)) throw getWftStudentChangeRecoveryError();
        wftStudentChangeRecovery = null;
    }
    preflightWftRequiredStorage();
    var keys = ['wft_portfolio', WFT_DELETIONS_STORAGE_KEY];
    var rosterChanged = Array.isArray(change.students);
    var settings;
    if (rosterChanged) {
        keys.push('wft_students', 'wft_selectedStudent', 'wft_settings');
        settings = cloneWftJson(change.settings || readWftRequiredStorage('wft_settings'));
        settings.students = change.students;
        var storedSettings = readWftRequiredStorage('wft_settings');
        if (Object.prototype.hasOwnProperty.call(storedSettings, 'apiKey')) settings.apiKey = storedSettings.apiKey;
        else delete settings.apiKey;
    }
    var previous = {};
    keys.forEach(function(key) { previous[key] = localStorage.getItem(key); });
    var savedPortfolio;
    try {
        // Save writing before markers; publish sync changes only after every required write succeeds.
        if (change.portfolio !== undefined) savedPortfolio = savePortfolioData(change.portfolio, true);
        if (change.deletions !== undefined) saveDeletionsData(change.deletions, true);
        if (rosterChanged) {
            localStorage.setItem('wft_students', JSON.stringify(change.students));
            localStorage.setItem('wft_selectedStudent', change.selectedStudent);
            localStorage.setItem('wft_settings', JSON.stringify(settings));
        }
    } catch (e) {
        if (!restoreWftStudentChangeStorage(previous)) {
            wftStudentChangeRecovery = previous;
            throw getWftStudentChangeRecoveryError();
        }
        throw e;
    }
    // Publication/refresh errors after this point cannot roll back the committed class change.
    change.committed = true;
    if (rosterChanged) {
        students = change.students;
        try {
            if (selectedStudent !== change.selectedStudent && typeof closeCropModal === "function") closeCropModal();
        } catch (e) {
            wftDebugWarn('Class change saved; crop UI could not close:', e);
        }
        selectedStudent = change.selectedStudent;
    }
    if (!wftSuppressDirtyMarks) {
        if (WFT_SYNC_ENGINE_V2) {
            if (rosterChanged) markWftSettingsDirty('roster-change');
            if (change.deletions !== undefined) markWftDeletionsDirty('deletions-change');
        }
        if (savedPortfolio !== undefined) syncSavedPortfolioData(savedPortfolio);
        if (WFT_SYNC_ENGINE_V2) {
            scheduleWftCloudSync('student-change');
        }
    }
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
        if (isStudentDeletedByTombstone(name, cleanDeletions)) continue;
        result.push(source[i]);
    }

    return result;
}

function applyDeletionsToPortfolio(portfolio, deletions) {
    var cleanPortfolio = normalizePortfolioShape(portfolio || {});
    var cleanDeletions = normalizeDeletionsData(deletions || {});
    var result = Object.create(null);
    var settings = getRawSettings() || {};
    var studentName;

    for (studentName in cleanPortfolio) {
        if (!Object.prototype.hasOwnProperty.call(cleanPortfolio, studentName)) continue;

        if (isStudentDeletedByTombstone(studentName, cleanDeletions)) {
            continue;
        }

        var studentData = cloneWftJson(cleanPortfolio[studentName]);
        var sessions = Array.isArray(studentData.sessions) ? studentData.sessions : [];
        var filteredSessions = [];
        var i;

        for (i = 0; i < sessions.length; i += 1) {
            var session = sessions[i];
            var sessionId = getSessionKey(session);

            var studentId = session.studentId || portfolio[studentName].studentId || (settings.studentIdMap && Object.prototype.hasOwnProperty.call(settings.studentIdMap, studentName) ? settings.studentIdMap[studentName] : '');
            if (!isStudentSessionDeleted(sessionId, studentId, cleanDeletions, session.updatedAt || session.createdAt, session.lamportClock, studentName)) {
                filteredSessions.push(session);
            }
        }

        studentData.sessions = filteredSessions;
        result[studentName] = studentData;
    }

    return rebuildWftPortfolioDerivedStats(result);
}

function mergeWftDeletions(localDeletions, cloudDeletions) {
    var localClean = normalizeDeletionsData(localDeletions || {});
    var cloudClean = normalizeDeletionsData(cloudDeletions || {});
    var merged = Object.assign(Object.create(null), cloneWftJson(cloudClean), cloneWftJson(localClean), getEmptyDeletionsData());
    var recordsByKey = {};

    ['deletedStudents', 'restoredStudents', 'deletedSessions'].forEach(function (collection) {
        var timeField = collection === 'restoredStudents' ? 'restoredAt' : 'deletedAt';
        [cloudClean, localClean].forEach(function (source) {
            Object.keys(source[collection]).forEach(function (key) {
                var incoming = source[collection][key];
                var current = merged[collection][key];
                if (!current || getWftTombstoneTimeMs(incoming, timeField) >= getWftTombstoneTimeMs(current, timeField)) {
                    merged[collection][key] = cloneWftJson(incoming);
                }
            });
        });
    });

    cloudClean.records.concat(localClean.records).forEach(function (record) {
        if (!record || typeof record !== 'object') return;
        var key = record.id ? 'id:' + record.id : 'content:' + stableStringify(record);
        var current = recordsByKey[key];
        if (!current || getWftTombstoneTimeMs(record, 'deletedAt') >= getWftTombstoneTimeMs(current, 'deletedAt')) {
            recordsByKey[key] = cloneWftJson(record);
        }
    });
    merged.records = Object.keys(recordsByKey).map(function (key) { return recordsByKey[key]; });

    merged.updatedAt = new Date().toISOString();
    return merged;
}

function saveDeletionsLocalOnly(deletions, reason) {
    preflightWftRequiredStorage();
    validateWftRequiredStorage(WFT_DELETIONS_STORAGE_KEY, deletions);
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
    try {
        localStorage.setItem(WFT_DELETIONS_STORAGE_KEY, JSON.stringify(normalizeDeletionsData(deletions || {})));
    } catch (e) {
        wftDebugWarn("[WFT Sync] Could not save merged deletions locally:", e);
        throw e;
    }
}

function getWftDeletionCounts(deletions) {
    var clean = normalizeDeletionsData(deletions || {});
    return {
        students: Object.keys(clean.deletedStudents || {}).length,
        restores: Object.keys(clean.restoredStudents || {}).length,
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

function downloadWftJsonFilePromise(fileId, requiredShape) {
    wftSyncLog("[WFT Sync][FILE] download JSON start", fileId);
    var url = "https://www.googleapis.com/drive/v3/files/"
        + encodeURIComponent(fileId)
        + "?alt=media";

    return wftDriveFetch(url).then(function (response) {
        return response.text();
    }).then(function (text) {
        if (!text && !requiredShape) return null;

        try {
            var parsed = JSON.parse(text);
            if (requiredShape === 'settings') validateWftRequiredStorage('wft_settings', parsed);
            else if (requiredShape === 'deletions') validateWftRequiredStorage(WFT_DELETIONS_STORAGE_KEY, parsed);
            else if (requiredShape === 'student') {
                if (!parsed || parsed.format !== 'student-portfolio-v1') throw new TypeError('Invalid student portfolio file');
                validateWftPortfolioShape({ student: parsed });
            } else if (requiredShape === 'index') {
                if (parsed && parsed.format === 'portfolio-index-v1' && (!parsed.students || typeof parsed.students !== 'object' || Array.isArray(parsed.students))) throw new TypeError('Invalid portfolio index students');
            } else if (requiredShape) validateWftPortfolioShape(parsed);
            wftSyncLog("[WFT Sync][FILE] download JSON parsed", fileId, getWftHash(parsed));
            return parsed;
        } catch (e) {
            wftSyncWarn("[WFT Sync] download JSON parse failed", fileId, e);
            if (requiredShape) throw e;
            return null;
        }
    });
}

function uploadWftJsonFilePromise(filename, data) {
    preflightWftRequiredStorage();
    if (filename === WFT_SETTINGS_FILENAME) {
        data = cloneWftJson(data);
        delete data.apiKey;
    }
    if (filename === WFT_SETTINGS_FILENAME) validateWftRequiredStorage('wft_settings', data);
    if (filename === WFT_DELETIONS_FILENAME) validateWftRequiredStorage(WFT_DELETIONS_STORAGE_KEY, data);
    if (filename === WFT_PORTFOLIO_FILENAME) {
        getLocalPortfolioSnapshot();
        validateWftPortfolioShape(data);
    }
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

                return downloadWftJsonFilePromise(canonical.id, filename === WFT_SETTINGS_FILENAME ? 'settings' : (filename === WFT_DELETIONS_FILENAME ? 'deletions' : filename === WFT_PORTFOLIO_FILENAME)).then(function (cloudData) {
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
        setDriveSyncStatus("error", "Duplicate Drive files detected - using newest copy safely.");
    }
}

function downloadAndMergeDuplicatePortfolios(files, localPortfolio) {
    var chain = Promise.resolve(normalizePortfolioShape(localPortfolio));

    files.forEach(function (file) {
        chain = chain.then(function (current) {
            return downloadWftJsonFilePromise(file.id, true).then(function (data) {
                return mergeWftPortfolios(current, data);
            });
        });
    });

    return chain;
}

function downloadAndMergeDuplicateSettings(files, localSettings) {
    var chain = Promise.resolve(localSettings || {});

    files.forEach(function (file) {
        chain = chain.then(function (current) {
            return downloadWftJsonFilePromise(file.id, 'settings').then(function (data) {
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
            if (isStudentDeletedByTombstone(name, deletions)) continue;
            result.push(name);
        }
    }

    result.sort(function(a, b) { return a.localeCompare(b); });
    return result;
}

function mergeWftSettings(localSettings, cloudSettings, preferLocal) {
    var localCopy = cloneWftJson(localSettings || {});
    var cloudCopy = cloneWftJson(cloudSettings || {});
    var merged = Object.create(null);
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
        wftSuppressDirtyMarks = true;
        return applyLoadedSettings(settings);
    } finally { wftSuppressDirtyMarks = previousSuppress; }
}

function syncWftSettingsIfNeeded(reason) {
    preflightWftRequiredStorage();
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) return Promise.reject(getWftStudentChangeRecoveryError());
    wftSyncLog("[WFT Sync] settings sync start", reason);
    var localSettings = getLocalSettingsSnapshot();
    var localHash = getSettingsFingerprint(localSettings);
    var counterSnapshot = wftSyncState.localSettingsCounter;
    var hadPending = wftSyncState.pendingSettingsPush;
    wftSyncLog("[WFT Sync] settings local snapshot", { hash: localHash, counter: counterSnapshot, hadPending: hadPending, studentCount: localSettings && localSettings.students ? localSettings.students.length : 0 });

    function recordSettingsSync(hash) {
        preflightWftRequiredStorage();
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        wftSyncState.lastSyncedSettingsHash = hash;
        wftSyncState.lastSyncedSettingsCounter = counterSnapshot;
        wftSyncState.pendingSettingsPush = wftSyncState.localSettingsCounter !== counterSnapshot;
        if (wftSyncState.pendingSettingsPush) wftSyncState.needsSyncAfterCurrent = true;
    }

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
                    recordSettingsSync(localHash);
                    return true;
                });
            }

            return downloadAndMergeDuplicateSettings(files.filter(function(f) { return f.id !== canonical.id; }), localSettings).then(function (mergedFromDuplicates) {
                var cloudHash;
                var merged;
                var mergedHash;

                return downloadWftJsonFilePromise(canonical.id, 'settings').then(function (cloudSettings) {
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
                        merged = saveSettingsLocalOnly(merged, "cloud-merge");
                        mergedHash = getSettingsFingerprint(merged);
                    }

                    if ((hadPending || files.length > 1) && mergedHash !== cloudHash) {
                        wftSyncLog("[WFT Sync][SETTINGS] decision", "push-local", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending, duplicateCount: files.length });
                        return uploadWftJsonFilePromise(WFT_SETTINGS_FILENAME, merged).then(function () {
                            recordSettingsSync(mergedHash);
                            return true;
                        });
                    }

                    wftSyncLog("[WFT Sync][SETTINGS] decision", mergedHash !== localHash ? "pull-remote" : "skip-same-hash", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending });
                    recordSettingsSync(mergedHash);
                    return false;
                });
            });
        });
}

// ── WFT Sync Engine V2 deletion-log sync ──
function syncWftDeletionsIfNeeded(reason) {
    preflightWftRequiredStorage();
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) return Promise.reject(getWftStudentChangeRecoveryError());
    wftSyncLog("[WFT Sync] deletions sync start", reason);
    var localDeletions = getDeletionsData();
    var localHash = getDeletionsFingerprint(localDeletions);
    var counterSnapshot = wftSyncState.localDeletionsCounter;
    var hadPending = wftSyncState.pendingDeletionsPush;
    var counts = getWftDeletionCounts(localDeletions);

    wftSyncLog("[WFT Sync] deletions local snapshot", { hash: localHash, counter: counterSnapshot, hadPending: hadPending, deletedStudents: counts.students, restoredStudents: counts.restores, deletedSessions: counts.sessions });

    function recordDeletionsSync(hash) {
        preflightWftRequiredStorage();
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        wftSyncState.lastSyncedDeletionsHash = hash;
        wftSyncState.lastSyncedDeletionsCounter = counterSnapshot;
        wftSyncState.pendingDeletionsPush = wftSyncState.localDeletionsCounter !== counterSnapshot;
        if (wftSyncState.pendingDeletionsPush) wftSyncState.needsSyncAfterCurrent = true;
    }

    return findWftFilesByNamePromise(WFT_DELETIONS_FILENAME)
        .then(function (files) {
            var canonical;

            noteDuplicateWftFiles(WFT_DELETIONS_FILENAME, files);
            canonical = chooseCanonicalWftFile(files);

            if (canonical) {
                setCachedWftDriveFileId(WFT_DELETIONS_FILENAME, canonical.id);
            }

            if (!canonical) {
                if (!hadPending && counts.students === 0 && counts.restores === 0 && counts.sessions === 0) {
                    wftSyncLog("[WFT Sync][DELETIONS] decision", "skip-no-cloud-no-local-deletions", { localHash: localHash });
                    return false;
                }

                wftSyncLog("[WFT Sync][DELETIONS] decision", "create-remote", { localHash: localHash });
                return uploadWftJsonFilePromise(WFT_DELETIONS_FILENAME, localDeletions).then(function (fileId) {
                    wftSyncState.deletionsFileId = fileId || wftSyncState.deletionsFileId;
                    recordDeletionsSync(localHash);
                    return true;
                });
            }

            return downloadWftJsonFilePromise(canonical.id, 'deletions').then(function (cloudDeletions) {
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
                }

                if ((hadPending || files.length > 1) && mergedHash !== cloudHash) {
                    wftSyncLog("[WFT Sync][DELETIONS] decision", "push-local", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending, duplicateCount: files.length });
                    return uploadWftJsonFilePromise(WFT_DELETIONS_FILENAME, merged).then(function () {
                        recordDeletionsSync(mergedHash);
                        return true;
                    });
                }

                wftSyncLog("[WFT Sync][DELETIONS] decision", mergedHash !== localHash ? "pull-remote" : "skip-same-hash", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending });
                recordDeletionsSync(mergedHash);
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
    var time = Date.parse(value || "");
    return isNaN(time) ? 0 : time;
}

function mergeSessionImageRefs(primary, secondary) {
    var merged = cloneWftJson(primary || {});
    var primaryImages = merged.images || merged.photos || [];
    var secondaryImages = secondary ? (secondary.images || secondary.photos || []) : [];
    var byKey = Object.create(null);
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
            // A crop/reset revision belongs to the newer session; old media must not replace it.
            if ((byKey[key].imageRevision || img.imageRevision) && byKey[key].imageRevision !== img.imageRevision) return;
            if (byKey[key].driveFileId && img.driveFileId && byKey[key].driveFileId !== img.driveFileId) return;
            if (byKey[key].dataUrl && img.dataUrl && byKey[key].dataUrl !== img.dataUrl) return;
            // Older copies can fill missing media references, but cannot replace newer metadata.
            var refs = ["driveFileId", "dataUrl", "originalDataUrl"];
            for (var r = 0; r < refs.length; r += 1) {
                var ref = refs[r];
                if (!byKey[key][ref] && Object.prototype.hasOwnProperty.call(img, ref) && img[ref]) byKey[key][ref] = img[ref];
            }
            if (byKey[key].driveFileId) byKey[key].pendingDriveUpload = false;
        }
    }

    for (i = 0; i < primaryImages.length; i += 1) addImage(primaryImages[i]);
    for (i = 0; i < secondaryImages.length; i += 1) addImage(secondaryImages[i]);

    if (merged.images) merged.images = result;
    if (merged.photos) merged.photos = result;

    return merged;
}

function chooseNewerSession(a, b) {
    var aTime = getTimeMs(a && (a.updatedAt || a.createdAt || a.date));
    var bTime = getTimeMs(b && (b.updatedAt || b.createdAt || b.date));

    if (bTime > aTime) return mergeSessionImageRefs(b, a);
    return mergeSessionImageRefs(a, b);
}

function rebuildWftPortfolioDerivedStats(portfolio) {
    // WFT doesn't have a separate stats rebuild; portfolio UI is refreshed via renderStudentPortfolio
    return portfolio;
}

function mergeWftPortfolios(localPortfolio, cloudPortfolio) {
    // WFT portfolio is keyed by student name; use WFT's existing merge logic as base
    var localNorm = normalizePortfolioShape(localPortfolio);
    var cloudNorm = normalizePortfolioShape(cloudPortfolio);

    // Start with cloud, overlay local
    var merged = Object.create(null);
    var studentName;

    // Copy all cloud students
    for (studentName in cloudNorm) {
        if (Object.prototype.hasOwnProperty.call(cloudNorm, studentName)) {
            merged[studentName] = cloneWftJson(cloudNorm[studentName]);
        }
    }

    // Merge local students
    for (studentName in localNorm) {
        if (!Object.prototype.hasOwnProperty.call(localNorm, studentName)) continue;

        if (!merged[studentName]) {
            merged[studentName] = cloneWftJson(localNorm[studentName]);
            continue;
        }

        // Merge sessions for this student
        var byKey = Object.create(null);
        var cloudSessions = merged[studentName].sessions || [];
        var localSessions = localNorm[studentName].sessions || [];
        var i;
        var key;

        for (i = 0; i < cloudSessions.length; i += 1) {
            key = getSessionKey(cloudSessions[i]);
            if (key) byKey[key] = cloudSessions[i];
        }

        for (i = 0; i < localSessions.length; i += 1) {
            key = getSessionKey(localSessions[i]);
            if (!key) continue;

            if (!byKey[key]) {
                byKey[key] = localSessions[i];
            } else {
                byKey[key] = chooseNewerSession(byKey[key], localSessions[i]);
            }
        }

        var resultSessions = [];
        for (key in byKey) {
            if (Object.prototype.hasOwnProperty.call(byKey, key)) {
                resultSessions.push(byKey[key]);
            }
        }

        resultSessions.sort(function (a, b) {
            return getTimeMs(b.date || b.createdAt || b.updatedAt) - getTimeMs(a.date || a.createdAt || a.updatedAt);
        });

        merged[studentName].sessions = resultSessions;
    }

    // DO NOT add root-level metadata keys (like updatedAt) - normalizePortfolioData
    // treats every top-level key as a student name, so metadata would become a fake student.
    return rebuildWftPortfolioDerivedStats(merged);
}

function savePortfolioLocalOnly(portfolio, reason) {
    preflightWftRequiredStorage();
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
    getLocalPortfolioSnapshot();
    validateWftPortfolioShape(portfolio);
    try {
        localStorage.setItem("wft_portfolio", JSON.stringify(portfolio || {}));
    } catch (e) {
        wftDebugWarn("[WFT Sync] Could not save merged portfolio locally:", e);
        throw e;
    }
    markWftPortfolioIndexDirty(reason || "cloud-merge");
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
    preflightWftRequiredStorage();
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) return Promise.reject(getWftStudentChangeRecoveryError());
    wftSyncLog("[WFT Sync] portfolio sync start", reason);
    var deletions = getDeletionsData();
    var localPortfolio = applyDeletionsToPortfolio(getLocalPortfolioSnapshot(), deletions);
    var localHash = getPortfolioFingerprint(localPortfolio);
    var counterSnapshot = wftSyncState.localPortfolioCounter;
    var hadPending = wftSyncState.pendingPortfolioPush;
    wftSyncLog("[WFT Sync] portfolio local snapshot", { hash: localHash, counter: counterSnapshot, hadPending: hadPending, studentCount: Object.keys(localPortfolio || {}).length });

    function hasNewerLocalPortfolio() {
        preflightWftRequiredStorage();
        getLocalPortfolioSnapshot();
        if (wftSyncState.localPortfolioCounter === counterSnapshot) return false;
        // A slow Drive response must not overwrite or acknowledge a newer local save.
        wftSyncState.needsSyncAfterCurrent = true;
        return true;
    }

    function recordPortfolioSync(hash) {
        preflightWftRequiredStorage();
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        getLocalPortfolioSnapshot();
        wftSyncState.lastSyncedPortfolioHash = hash;
        wftSyncState.lastSyncedPortfolioCounter = counterSnapshot;
        wftSyncState.pendingPortfolioPush = hasNewerLocalPortfolio();
    }

    return findWftFilesByNamePromise(WFT_PORTFOLIO_FILENAME)
        .then(function (files) {
            if (hasNewerLocalPortfolio()) return false;
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
                    recordPortfolioSync(localHash);
                    return true;
                });
            }

            return downloadAndMergeDuplicatePortfolios(files.filter(function(f) { return f.id !== canonical.id; }), localPortfolio).then(function (mergedFromDuplicates) {
                var cloudNormalized;
                var cloudHash;
                var merged;
                var mergedHash;

                return downloadWftJsonFilePromise(canonical.id, true).then(function (cloudPortfolio) {
                    if (hasNewerLocalPortfolio()) return false;
                    validateWftPortfolioShape(cloudPortfolio);
                    cloudNormalized = applyDeletionsToPortfolio(cloudPortfolio, getDeletionsData());
                    cloudHash = getPortfolioFingerprint(cloudNormalized);
                    merged = mergeWftPortfolios(applyDeletionsToPortfolio(mergedFromDuplicates || localPortfolio, getDeletionsData()), cloudNormalized);
                    merged = applyDeletionsToPortfolio(merged, getDeletionsData());
                    mergedHash = getPortfolioFingerprint(merged);

                    if (mergedHash !== localHash) {
                        savePortfolioLocalOnly(merged, "cloud-merge");
                        refreshPortfolioUiAfterCloudMerge();
                    }

                    if ((hadPending || files.length > 1) && mergedHash !== cloudHash) {
                        wftSyncLog("[WFT Sync][PORTFOLIO] decision", "push-local", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending, duplicateCount: files.length });
                        return uploadWftJsonFilePromise(WFT_PORTFOLIO_FILENAME, merged).then(function () {
                            recordPortfolioSync(mergedHash);
                            return true;
                        });
                    }

                    wftSyncLog("[WFT Sync][PORTFOLIO] decision", mergedHash !== localHash ? "pull-remote" : "skip-same-hash", { localHash: localHash, cloudHash: cloudHash, mergedHash: mergedHash, hadPending: hadPending });
                    recordPortfolioSync(mergedHash);
                    return false;
                });
            });
        });
}

// ── WFT Sync Engine V2 portfolio index sync ──
function syncWftPortfolioIndexIfNeeded(reason) {
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) return Promise.reject(getWftStudentChangeRecoveryError());
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
        setDriveSyncStatus("error", "Drive sync needs attention.");
        return;
    }

    if (e.wftStudentChangeRecovery) {
        setDriveSyncStatus('error', 'Drive sync needs attention: recovery needed. Download Emergency Backup and keep this tab open.');
        return;
    }
    if (e.wftSettingsApply) {
        setDriveSyncStatus('error', 'Drive sync needs attention: settings could not be saved locally. Check browser storage and retry.');
        return;
    }

    if (e.message === "OFFLINE") {
        setDriveSyncStatus("error", "Offline - will sync later");
        return;
    }

    if (e.message === "TOKEN_EXPIRED" || e.status === 401) {
        setDriveSyncStatus("error", "Session expired - please sign in again.");
        return;
    }

    if (e.status === 403 && /quota|rate/i.test(String(e.reason || "") + " " + String(e.message || ""))) {
        setDriveSyncStatus("error", "Drive quota or rate limit reached.");
        return;
    }

    if (e.status === 403) {
        setDriveSyncStatus("error", "Drive permission issue - please reconnect.");
        return;
    }

    setDriveSyncStatus("error", "Drive sync needs attention.");
}

function syncWftNow(reason, options) {
    options = options || {};
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) {
        setDriveSyncStatus('error', 'Recovery needed — download Emergency Backup and retry');
        return Promise.resolve(false);
    }

    syncStateFromLegacyGoogleGlobals();
    var connection = captureWftArchiveConnection();

    wftSyncLog("[WFT Sync] syncWftNow requested", reason, options, getWftSyncDebugSnapshot());

    if (!WFT_SYNC_ENGINE_V2) {
        wftSyncLog("[WFT Sync] sync skipped - V2 disabled", reason);
        return Promise.resolve(false);
    }

    if (!wftSyncState.signedIn && !wftSyncState.accessToken) {
        wftSyncLog("[WFT Sync] sync skipped - not signed in", reason);
        setDriveSyncStatus("", "Not synced");
        return Promise.resolve(false);
    }

    if (!navigator.onLine) {
        wftSyncLog("[WFT Sync] sync skipped - offline", reason);
        setDriveSyncStatus("error", "Offline - will sync later");
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

    setDriveSyncStatus("syncing", "Syncing...");
    wftSyncLog("[WFT Sync] run start", runId, reason, getWftSyncDebugSnapshot());

    wftSyncState.currentSyncPromise = ensureDriveFolderPromise(connection)
        .then(function () {
            assertWftArchiveConnection(connection);
            wftSyncLog("[WFT Sync] run folder ready", runId, wftSyncState.folderId || driveFolderId || "");
            return syncWftDeletionsIfNeeded(reason);
        })
        .then(function (deletionsChanged) {
            assertWftArchiveConnection(connection);
            wftSyncLog("[WFT Sync] run deletions done", runId, deletionsChanged, getWftSyncDebugSnapshot());
            return syncWftSettingsIfNeeded(reason);
        })
        .then(function (settingsChanged) {
            assertWftArchiveConnection(connection);
            wftSyncLog("[WFT Sync] run settings done", runId, settingsChanged, getWftSyncDebugSnapshot());
            return syncWftPortfolioIfNeeded(reason);
        })
        .then(function (portfolioChanged) {
            assertWftArchiveConnection(connection);
            wftSyncLog("[WFT Sync] run portfolio done", runId, portfolioChanged, getWftSyncDebugSnapshot());
            return syncWftPortfolioIndexIfNeeded(reason).then(function(indexChanged) {
                assertWftArchiveConnection(connection);
                preflightWftRequiredStorage();
                if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
                if (WFT_PORTFOLIO_INDEX_V1 && !indexChanged && isWftPortfolioIndexDirty()) throw new Error("Portfolio index is still pending; retry required.");
                wftSyncLog("[WFT Sync] run portfolio index done", runId, indexChanged, getWftSyncDebugSnapshot());
                wftSyncState.lastPollAt = Date.now();
                // ── WFT_BROADCAST_CHANNEL_V1: notify other tabs that a sync completed ──
                if (WFT_BROADCAST_CHANNEL_V1 && wftSyncChannel && typeof wftSyncChannel.postMessage === "function") {
                    try {
                        wftSyncChannel.postMessage({ type: "sync-complete", ts: Date.now() });
                    } catch (e) { /* non-fatal */ }
                }
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
                wftSyncLog("[WFT Sync] starting queued follow-up run", runId, reason);
                return syncWftNow("queued-after-current", { immediate: false });
            }

            if (result) {
                if (getPendingPortfolioSync()) setDriveSyncStatus("syncing", "New writing is ready to sync to portfolio");
                else setDriveSyncStatus("synced", "Synced");
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
    if (!isWftTokenValid()) return false;
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
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) return;
    try { preflightWftRequiredStorage(); }
    catch (e) { wftDebugWarn('[WFT Storage] Page-hide save stopped; saved bytes were preserved:', e); return; }
    var previousSuppress = wftSuppressDirtyMarks;
    try {
        if (typeof saveSettingsToLocalStorage === "function") {
            wftSuppressDirtyMarks = true;
            saveSettingsToLocalStorage();
        }
    } catch (e) { wftDebugWarn('[WFT Storage] Page-hide preferences could not be saved; saved preferences kept.'); }
    finally { wftSuppressDirtyMarks = previousSuppress; }

    try {
        if (typeof getLocalPortfolioSnapshot === "function") {
            savePortfolioLocalOnly(getLocalPortfolioSnapshot(), "page-hide");
        }
    } catch (e2) { }
}

function initWftSyncLifecycleHandlers() {
    window.addEventListener("online", function () {
        clearWftSyncBlockState();
        if (!WFT_SYNC_ENGINE_V2) return;
        syncStateFromLegacyGoogleGlobals();
        if (!wftSyncState.signedIn && !driveAccessToken) return;
        setDriveSyncStatus("syncing", "Back online - syncing...");
        syncWftNow("online", { immediate: false });
    });

    window.addEventListener("offline", function () {
        if (WFT_SYNC_ENGINE_V2 && (wftSyncState.signedIn || driveAccessToken)) {
            setDriveSyncStatus("error", "Offline - will sync later");
        }
    });

    document.addEventListener("visibilitychange", function () {
        if (!WFT_SYNC_ENGINE_V2) return;
        if (document.visibilityState === "hidden") {
            saveWftLocalSnapshotsBeforeHide();
            return;
        }

        if (document.visibilityState === "visible" && shouldPollWftCloudNow()) {
            syncWftNow("visible", { immediate: false });
        }
    });

    // ── WFT_BROADCAST_CHANNEL_V1: initialize channel and message listener ──
    // Creates 'wft-sync' channel; guarded so it fails gracefully if unsupported.
    if (WFT_BROADCAST_CHANNEL_V1 && typeof BroadcastChannel === "function") {
        try {
            wftSyncChannel = new BroadcastChannel("wft-sync");
            // Dedup guard: ignore sync-complete messages if this tab synced within
            // the last 10 seconds — prevents rapid re-sync cascades from closely-
            // spaced broadcasts.
            var _lastLocalSyncTs = 0;
            wftSyncChannel.onmessage = function (ev) {
                try {
                    var data = ev && ev.data;
                    if (data && data.type === "sync-complete" && typeof data.ts === "number") {
                        // If this tab just completed its own sync within 10s, ignore the broadcast
                        if (_lastLocalSyncTs && (data.ts - _lastLocalSyncTs) < 10000) { return; }
                        // Treat a received sync-complete as if this tab just synced
                        wftSyncState.lastPollAt = data.ts;
                    }
                } catch (e) { /* defensive */ }
            };
            // Stash current local sync ts so onmessage can debounce
            var _origSyncFn = syncWftNow;
            syncWftNow = function(reason, options) {
                _lastLocalSyncTs = Date.now();
                return _origSyncFn(reason, options);
            };
        } catch (e) {
            // Older browsers or security contexts may throw; treat as unavailable
            wftSyncChannel = null;
        }
    }

    window.addEventListener("beforeunload", function (event) {
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) {
            event.preventDefault();
            event.returnValue = '';
            return;
        }
        if (WFT_SYNC_ENGINE_V2) {
            saveWftLocalSnapshotsBeforeHide();
        }
        // ── WFT_BROADCAST_CHANNEL_V1: close channel on unload ──
        if (WFT_BROADCAST_CHANNEL_V1 && wftSyncChannel && typeof wftSyncChannel.close === "function") {
            try { wftSyncChannel.close(); } catch (e) {}
        }
    });
}

// ── WFT Sync Engine V2 session token storage ──
function isWftTokenPayloadValid(token, expiresAt) {
    return typeof token === 'string' && token.trim().length > 0 && typeof expiresAt === 'number'
        && Number.isFinite(expiresAt) && Number.isFinite(new Date(expiresAt).getTime()) && expiresAt > Date.now();
}

function getWftOAuthTokenExpiry(expiresIn) {
    if (expiresIn == null) expiresIn = 3600;
    if (typeof expiresIn !== 'number' && typeof expiresIn !== 'string') return 0;
    var seconds = Number(expiresIn);
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Date.now() + Math.max(60, seconds - 30) * 1000;
}

function saveWftTokenSession(token, expiresAt) {
    if (!isWftTokenPayloadValid(token, expiresAt)) return false;
    try {
        sessionStorage.setItem(DRIVE_TOKEN_SESSION_KEY, JSON.stringify({
            accessToken: token,
            tokenExpiresAt: expiresAt
        }));
        wftTokenSessionBlocked = false;
        return true;
    } catch (e) {
        // A failed replacement must not silently restore an older connection in this tab.
        clearWftTokenSession();
        return false;
    }
}

function restoreWftTokenSession() {
    if (wftTokenSessionBlocked) return false;
    var raw;
    var saved;

    try {
        raw = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY);
        if (!raw) return false;

        saved = JSON.parse(raw);
        if (!saved || !isWftTokenPayloadValid(saved.accessToken, saved.tokenExpiresAt)) {
            clearWftTokenSession();
            return false;
        }

        wftGoogleAuthOperationId += 1;
        wftSyncState.accessToken = saved.accessToken;
        wftSyncState.tokenExpiresAt = saved.tokenExpiresAt;
        wftSyncState.signedIn = true;

        driveAccessToken = saved.accessToken;

        return true;
    } catch (e) {
        return false;
    }
}

function clearWftTokenSession() {
    wftTokenSessionBlocked = true;
    try {
        sessionStorage.removeItem(DRIVE_TOKEN_SESSION_KEY);
        return true;
    } catch (e) { return false; }
}

function getWftSessionTokenExpiry() {
    if (wftTokenSessionBlocked) return 0;
    try {
        var raw = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY);
        if (!raw) return 0;
        var saved = JSON.parse(raw);
        return saved && isWftTokenPayloadValid(saved.accessToken, saved.tokenExpiresAt) ? saved.tokenExpiresAt : 0;
    } catch (e) {
        return 0;
    }
}

function migrateOldWftTokenToSessionStorage() {
    // Old-client tokens must not be labelled as the replacement client.
    return false;
}

function readJsonFileFromDrive(filename, callback) {
    if (!driveAccessToken) { if (callback) callback(null); return; }
    var connection = captureWftArchiveConnection();
    ensureDriveFolder(function(folderId) {
        wftDriveFetch("https://www.googleapis.com/drive/v3/files?q=name%3D%27" + encodeURIComponent(filename) + "%27+and+%27" + folderId + "%27+in+parents+and+trashed%3Dfalse&fields=files(id)", undefined, connection).then(function(r) { return r.json(); }).then(function(data) {
            assertWftArchiveConnection(connection);
            if (!(data.files && data.files.length)) {
                if (callback) callback(null);
                return;
            }
            return wftDriveFetch("https://www.googleapis.com/drive/v3/files/" + data.files[0].id + "?alt=media", undefined, connection).then(function(r) { return r.json(); }).then(function(fileData) {
                assertWftArchiveConnection(connection);
                if (callback) callback(fileData);
            });
        }).catch(function(e) {
            wftDebugError("Drive read error:", e);
            if (callback) callback(null);
        });
    }, function() { if (callback) callback(null); });
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

function uploadBlobToDrive(filename, blob, mimeType, callback, validateOwner) {
    if (!driveAccessToken || !blob) {
        if (callback) callback(null);
        return;
    }
    var uploadToken = driveAccessToken;
    setDriveSyncStatus('syncing', 'Syncing...');
    ensureDriveFolderPromise().then(function(folderId) {
        if (driveAccessToken !== uploadToken) throw new Error('Drive access changed before photo upload. Please retry.');
        if (validateOwner) validateOwner();
        var boundary = '----WFTBinaryBoundary' + Date.now();
        var metadata = JSON.stringify({ name: filename, parents: [folderId] });
        var preamble = '--' + boundary + '\r\n'
            + 'Content-Type: application/json\r\n\r\n'
            + metadata + '\r\n'
            + '--' + boundary + '\r\n'
            + 'Content-Type: ' + (mimeType || blob.type || 'application/octet-stream') + '\r\n\r\n';
        var closing = '\r\n--' + boundary + '--';
        var body = new Blob([preamble, blob, closing], { type: 'multipart/related; boundary=' + boundary });
        return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + uploadToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
            body: body
        });
    }).then(function(r) { return r.json(); }).then(function(data) {
            if (callback) callback(data || null);
        }).catch(function(e) {
            wftDebugError('Drive binary upload error:', e);
            setDriveSyncStatus('error', 'Sync failed');
            if (callback) callback(null, e);
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
        }).catch(function(e) {
            setDriveSyncStatus('error', 'Settings could not be saved locally');
            alert(e.wftStudentChangeRecovery ? e.message : 'Cloud settings could not be saved locally. The saved preferences and roster were kept. Retry when browser storage is working.');
        });
    }, function() { setDriveSyncStatus('error', 'Cloud settings could not be loaded; retry when connected.'); });
}

function applyWftPreferenceForm(settings) {
    var defaults = { model: document.getElementById('modelSelect') ? document.getElementById('modelSelect').options[0].value : '', targetWordCount: '200', useWordCountTarget: true, grammarStrictness: 3, assessScriptQuality: false };
    settings = Object.assign(Object.create(null), defaults, settings || {});
    if (settings.model && document.getElementById("modelSelect")) document.getElementById("modelSelect").value = settings.model;
    if (settings.targetWordCount && document.getElementById("targetWordCount")) document.getElementById("targetWordCount").value = settings.targetWordCount;
    if (settings.useWordCountTarget != null && document.getElementById("useWordCountTarget")) document.getElementById("useWordCountTarget").checked = settings.useWordCountTarget;
    if (settings.grammarStrictness && document.getElementById("grammarStrictness")) {
        document.getElementById("grammarStrictness").value = settings.grammarStrictness;
        var valEl = document.getElementById("grammarStrictnessVal");
        if (valEl) valEl.textContent = settings.grammarStrictness;
    }
    if (settings.assessScriptQuality != null && document.getElementById("assessScriptQuality")) {
        document.getElementById("assessScriptQuality").checked = settings.assessScriptQuality;
    }
    if (document.getElementById("classGradeLevelSelect")) {
        var loadedClassGrade = parseGradeLevelValue(settings.classGradeLevel) || 5;
        document.getElementById("classGradeLevelSelect").value = String(loadedClassGrade);
    }
    wftStudentGradeLevelOverride = settings.studentGradeLevelOverride === true;
    if (settings.studentGradeLevelOverride == null && settings.gradeLevel != null && settings.classGradeLevel != null) {
        wftStudentGradeLevelOverride = (parseGradeLevelValue(settings.gradeLevel) !== (parseGradeLevelValue(settings.classGradeLevel) || 5));
    }
    if (document.getElementById("gradeLevelSelect")) {
        var loadedStudentGrade = parseGradeLevelValue(settings.gradeLevel);
        var effectiveLoadedStudentGrade = wftStudentGradeLevelOverride && loadedStudentGrade ? loadedStudentGrade : getClassGradeLevel();
        document.getElementById("gradeLevelSelect").value = String(effectiveLoadedStudentGrade || 5);
    }
    applyGradeWordCountRange();
    refreshGradeProfileDescription();
    if (typeof updateGradeLevelResultNote === "function") updateGradeLevelResultNote();
    var target = document.getElementById('targetWordCount');
    if (target) target.disabled = !settings.useWordCountTarget;
    refreshScoreWeightingDescription();
    updateScriptQualityToggleVisibility();
    updateMeter();
}

function applyLoadedSettings(settings) {
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
    preflightWftRequiredStorage();
    validateWftRequiredStorage('wft_settings', settings);
    var existing = readWftRequiredStorage('wft_settings');
    var merged = mergeWftSettings(existing, settings, false);
    var rosterChanged = Array.isArray(merged.students);
    var incomingHash = getSettingsFingerprint({ students: merged.students || [] });
    if (rosterChanged) merged.students = mergeWftStudents(mergeWftStudents(readWftRequiredStorage('wft_students'), students), merged.students);
    var previous = { wft_settings: localStorage.getItem('wft_settings') };
    if (rosterChanged) previous.wft_students = localStorage.getItem('wft_students');
    try {
        var durableSettings = cloneWftJson(merged);
        if (Object.prototype.hasOwnProperty.call(existing, 'apiKey')) durableSettings.apiKey = existing.apiKey;
        localStorage.setItem('wft_settings', JSON.stringify(durableSettings));
        if (rosterChanged) localStorage.setItem('wft_students', JSON.stringify(merged.students));
    } catch (e) {
        e.wftSettingsApply = true;
        if (!restoreWftStudentChangeStorage(previous)) {
            wftStudentChangeRecovery = previous;
            throw getWftStudentChangeRecoveryError();
        }
        throw e;
    }
    // Required writes are committed before any runtime/form publication.
    if (rosterChanged) students = merged.students;
    applyWftPreferenceForm(merged);
    if (rosterChanged) {
        renderStudentList();
        populateStudentDropdown();
        refreshPortfolioDropdown();
        if (!wftSuppressDirtyMarks && incomingHash !== getSettingsFingerprint({ students: merged.students })) {
            markWftSettingsDirty('roster-merge-preserved-local');
            scheduleWftCloudSync('roster-merge-preserved-local');
        }
    }
    return merged;
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
    var normalized = Object.create(null);
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

function validateWftPortfolioShape(portfolio) {
    if (!portfolio || typeof portfolio !== 'object' || Array.isArray(portfolio)) throw new TypeError('Portfolio data is unreadable. Download Emergency Backup before repairing browser storage.');
    Object.keys(portfolio).forEach(function(studentName) {
        if (['_meta', 'updatedAt', '__syncMeta', 'syncMeta', 'lastSyncedAt', 'lastSyncStatus'].indexOf(studentName) !== -1) return;
        var student = portfolio[studentName];
        if (!student || typeof student !== 'object' || Array.isArray(student) || !Array.isArray(student.sessions)) throw new TypeError('Invalid portfolio student: ' + studentName);
        student.sessions.forEach(function(session) {
            if (!session || typeof session !== 'object' || Array.isArray(session)) throw new TypeError('Invalid portfolio session for: ' + studentName);
        });
    });
}

function getPortfolioData() {
    // Display can remain usable; persistence and sync must use the strict snapshot reader.
    try { return getLocalPortfolioSnapshot(); }
    catch (e) {
        wftDebugWarn('Portfolio unavailable; saved bytes were preserved:', e);
        setDriveSyncStatus('error', 'Portfolio unreadable — download Emergency Backup before repairing');
        return {};
    }
}

function stripPortfolioHeavyFields(data, localOnly) {
    var wftSafeModeActive = (typeof isWftStorageSafeMode === 'function' && isWftStorageSafeMode());
    var normalized = normalizePortfolioData((!wftSafeModeActive && WFT_STORAGE_SCHEMA_VERSION >= 1 && typeof normalizeWftPortfolioForSchemaV1 === 'function') ? normalizeWftPortfolioForSchemaV1(data || {}, localOnly) : (data || {}));
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
                        imageId: image.imageId || '',
                        imageRevision: image.imageRevision || '',
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

function savePortfolioData(data, localOnly) {
    preflightWftRequiredStorage();
    if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
    getLocalPortfolioSnapshot();
    validateWftPortfolioShape(data);
    var normalized;
    var savedData;
    var wftSafeModeActive = (typeof isWftStorageSafeMode === 'function' && isWftStorageSafeMode());
    try {
        normalized = normalizePortfolioData((!wftSafeModeActive && WFT_STORAGE_SCHEMA_VERSION >= 1 && typeof normalizeWftPortfolioForSchemaV1 === 'function') ? normalizeWftPortfolioForSchemaV1(data || {}, localOnly) : (data || {}));
    } catch (e) {
        wftDebugError('normalizePortfolioData failed while saving portfolio:', e);
        throw e;
    }

    // ── PATCH 2: Proactive heavy-field stripping ──
    try {
        savedData = (!wftSafeModeActive && WFT_PROACTIVE_STRIP_V1) ? makePortfolioLocalStorageSafe(normalized) : normalized;
        localStorage.setItem('wft_portfolio', JSON.stringify(savedData));
    } catch (e) {
        // Large photo data URLs can exceed the browser's localStorage quota.
        // Keep the portfolio session, scores, and notes by retrying without embedded image data.
        wftDebugWarn('Portfolio localStorage save failed; retrying without heavy embedded fields.', e);
        try {
            savedData = stripPortfolioHeavyFields(normalized, localOnly);
            localStorage.setItem('wft_portfolio', JSON.stringify(savedData));
        } catch (e2) {
            wftDebugError('Portfolio save retry without heavy fields also failed:', e2);
            throw e2;
        }
    }
    if (!localOnly) syncSavedPortfolioData(savedData);
    return savedData;
}

function syncSavedPortfolioData(savedData) {
    getLocalPortfolioSnapshot();
    var wftSafeModeActive = (typeof isWftStorageSafeMode === 'function' && isWftStorageSafeMode());
    // ── WFT Sync V2: use dirty flags + debounced sync instead of direct upload ──
    if (WFT_SYNC_ENGINE_V2 && !wftSafeModeActive) {
        markWftPortfolioDirty("portfolio-change");
        markWftPortfolioIndexDirty("portfolio-change");  // Patch 6
        scheduleWftCloudSync("portfolio-change");
    } else if (driveAccessToken) {
        saveFileToDrive('wft-portfolio.json', JSON.stringify(savedData, null, 2), 'application/json');
    }
}

function loadPortfolioFromDrive() {
    if (WFT_SYNC_ENGINE_V2) return;
    if (!driveAccessToken) return;
    readJsonFileFromDrive('wft-portfolio.json', function(data) {
        if (!data) return;
        try {
            var incoming = normalizePortfolioShape(data);
            var local = getLocalPortfolioSnapshot();
            var merged = mergePortfolioData(local, incoming);
            savePortfolioLocalOnly(merged, 'legacy-cloud-merge');
            refreshPortfolioDropdown();
            renderStudentPortfolio();
            setDriveSyncStatus('synced', 'Portfolio loaded');
        } catch (e) {
            wftDebugWarn('Portfolio load failed; saved bytes were preserved:', e);
            setDriveSyncStatus('error', 'Portfolio load failed — download Emergency Backup and retry');
        }
    });
}

function mergePortfolioData(base, incoming) {
    var merged = normalizePortfolioData(base || {});
    var next = normalizePortfolioData(incoming || {});
    Object.keys(next).forEach(function(studentName) {
        if (!merged[studentName]) {
            merged[studentName] = next[studentName];
            return;
        }
        var byId = Object.create(null);
        merged[studentName].sessions.forEach(function(session) {
            byId[session.id] = session;
        });
        next[studentName].sessions.forEach(function(session) {
            if (!byId[session.id]) {
                merged[studentName].sessions.push(session);
            }
        });
        merged[studentName].sessions.sort(function(a, b) {
            var aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
            var bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
            return aTime - bTime;
        });
    });
    return merged;
}

function scoreBadgeColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#2563eb';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
}

function getRubricScoreColorClass(score) {
    var value = getNumericAssessmentScore(score);
    if (value == null) return 'score-gray';
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
            imageId: image.imageId || '',
            imageRevision: image.imageRevision || '',
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
    // Parse imported HTML inertly before removing unsafe elements and attributes.
    var wrapper = document.createElement("template");
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

    cleanNode(wrapper.content);
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
    var wrapper = document.createElement("template");
    wrapper.innerHTML = value;
    var nodes = wrapper.content.querySelectorAll("[style]");
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
        var savedScore = getNumericAssessmentScore(source.score);
        if (savedScore == null) savedScore = getNumericAssessmentScore(categoryScores[key]);
        if (!sourceCategories[key] && savedScore == null) return;
        var displaySource = cloneWftJson(source);
        displaySource.score = savedScore;
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

function retainWftStudentSessions(studentName, sessions, newSession) {
    // Reserve a place for committed writing even when reassessment keeps an older date.
    return normalizeWftStudentRecord(studentName, sessions).slice(0, 49).concat([newSession]);
}

function saveStudentSession(studentName, sessionData) {
    if (!studentName) return;
    try { if (typeof normalizeWftSessionForStorage === "function") normalizeWftSessionForStorage(sessionData); } catch (e) {}
    // WFT_LAMPORT_V1 — stamp every new/changed session with the device lamport clock
    // so merge logic can resolve conflicts deterministically across devices.
    if (WFT_LAMPORT_V1) {
        try {
            sessionData.lamportClock = (typeof incrementDeviceLamport === "function")
                ? incrementDeviceLamport()
                : ((typeof getDeviceLamport === "function" ? getDeviceLamport() : 0) + 1);
        } catch (eLam) {
            // Non-fatal — fall back to timestamp-only merge
        }
    }
    var portfolio = getPortfolioData();
    if (!Object.prototype.hasOwnProperty.call(portfolio, studentName)) portfolio[studentName] = { sessions: [] };
    portfolio[studentName].sessions = retainWftStudentSessions(studentName, portfolio[studentName].sessions, sessionData);
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
    if (!studentName || !sessionId) return false;
    var portfolio = getPortfolioData();
    if (!portfolio[studentName] || !Array.isArray(portfolio[studentName].sessions)) return false;
    var sessions = portfolio[studentName].sessions;
    var index = findPortfolioSessionIndex(sessions, sessionId);
    if (index < 0) return false;
    var removedSession = sessions.splice(index, 1)[0];
    var deletions = getDeletionsData();
    recordSessionDeletion(studentName, getSessionKey(removedSession), deletions);
    saveWftStudentChange({ portfolio: portfolio, deletions: deletions });
    try {
        var select = document.getElementById('portfolioStudentSelect');
        if (select && select.value === studentName) renderStudentPortfolio();
    } catch (e) { wftDebugError('Portfolio entry removed, but portfolio rendering failed:', e); }
    return true;
}

async function deletePortfolioSession(studentName, sessionId) {
    if (!studentName || !sessionId) return;
    if (!(await wftConfirm('Remove this piece of writing from the portfolio?', {
        title: 'Delete Portfolio Entry',
        confirmText: 'Remove Entry',
        danger: true
    }))) return;
    try {
        if (!removeStudentSession(studentName, sessionId)) {
            alert('This portfolio entry could not be found. Please refresh the portfolio before trying again.');
        }
    } catch (e) {
        wftDebugError('Portfolio entry removal failed:', e);
        alert(e.wftStudentChangeRecovery ? e.message : 'The writing could not be removed. Please try again.');
    }
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
    if (!driveAccessToken) {
        if (callback) callback(false);
        return;
    }

    function failPortfolioSync(e) {
        wftDebugWarn('Portfolio sync failed; saved bytes were preserved:', e);
        setDriveSyncStatus('error', 'Portfolio sync failed — download Emergency Backup and retry');
        if (callback) callback(false);
    }
    try { getLocalPortfolioSnapshot(); }
    catch (e) { failPortfolioSync(e); return; }

    // ── WFT Sync V2: use immediate flush ──
    if (WFT_SYNC_ENGINE_V2) {
        markWftSettingsDirty("sync-all");
        markWftDeletionsDirty("sync-all");
        markWftPortfolioDirty("sync-all");
        syncPendingPortfolioMedia(function(mediaError) {
            if (mediaError) { failPortfolioSync(mediaError); return; }
            try {
                savePortfolioLocalOnly(getLocalPortfolioSnapshot(), 'sync-all');
            } catch (e) { failPortfolioSync(e); return; }
            flushWftCloudSyncNow("sync-all").then(function(result) {
                if (callback) callback(!!result);
            }).catch(function(e) {
                wftDebugError("syncAllToDrive flush failed:", normalizeWftAsyncErrorForLog(e));
                setDriveSyncStatus("error", "Drive sync failed - please retry");
                if (callback) callback(false);
            });
        });
        return;
    }

    try {
        saveSettingsToDrive();
        savePortfolioData(getLocalPortfolioSnapshot());
        syncPendingPortfolioMedia(function(mediaError) {
            if (mediaError) { failPortfolioSync(mediaError); return; }
            try {
                savePortfolioData(getLocalPortfolioSnapshot());
                if (callback) callback(true);
            } catch (e) { failPortfolioSync(e); }
        });
    } catch (e) { failPortfolioSync(e); }
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

function uploadSessionImagesToDrive(studentName, sessionData, callback, skipPortfolioSave, pendingOwner) {
    if (!driveAccessToken || !studentName || !sessionData || !sessionData.images || !sessionData.images.length) {
        if (callback) callback();
        return;
    }

    var uploadToken = driveAccessToken;
    var pendingOwnerSignature = pendingOwner ? getPendingPortfolioOwnerSignature(pendingOwner) : '';
    var sourceImages = sessionData.images.slice();
    var expectedImages = cloneWftJson(sessionData.images);
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
    function findCurrentImage(portfolio, image) {
        var sessions = portfolio[studentName] ? portfolio[studentName].sessions : [];
        var session = sessions.filter(function(entry) { return getSessionKey(entry) === getSessionKey(sessionData); })[0];
        if (!session) return null;
        var imageIndex = sessionData.images.indexOf(image);
        var current = image.imageId ? session.images.filter(function(entry) { return entry && entry.imageId === image.imageId; })[0] : null;
        current = current || session.images[imageIndex];
        if (!current) return null;
        var expected = cloneWftJson(expectedImages[imageIndex]);
        var actual = cloneWftJson(current);
        // An unrelated save may trim these same bytes for storage while the upload is held.
        if (!actual.dataUrl && actual.dataUrlRemovedForStorage) {
            delete actual.dataUrl;
            delete actual.originalDataUrl;
            delete actual.dataUrlRemovedForStorage;
            delete expected.dataUrl;
            delete expected.originalDataUrl;
            delete expected.dataUrlRemovedForStorage;
        }
        return stableStringify(actual) === stableStringify(expected) ? current : null;
    }
    function nextUpload() {
        if (driveAccessToken !== uploadToken || sessionData.images.length !== sourceImages.length || sourceImages.some(function(image, index) { return sessionData.images[index] !== image; })) {
            if (callback) callback(new Error('Photo or Drive access changed during upload. Please retry.'));
            return;
        }
        if (!skipPortfolioSave) {
            try {
                if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
                getLocalPortfolioSnapshot();
            }
            catch (e) { if (callback) callback(e); return; }
        }
        if (index >= remaining.length) {
            if (callback) callback();
            return;
        }
        var image = remaining[index++];
        var expectedSource = stableStringify(image);
        var uploadImage = cloneWftJson(image);
        if (!skipPortfolioSave && !findCurrentImage(getLocalPortfolioSnapshot(), image)) { nextUpload(); return; }
        // ── PATCH 3: Image compression before Drive upload ──
        try {
            if (WFT_IMAGE_COMPRESSION_V1) {
                compressPortfolioImageForDrive(uploadImage, function(compressErr, compressedBlob) {
                    try { doUploadImage(compressedBlob || dataUrlToBlob(uploadImage.dataUrl)); }
                    catch (e) { if (callback) callback(e); }
                });
            } else {
                doUploadImage(dataUrlToBlob(uploadImage.dataUrl));
            }
        } catch (e) { if (callback) callback(e); }

        function doUploadImage(blob) {
            function validateCurrentUpload() {
                if (driveAccessToken !== uploadToken || sessionData.images.length !== sourceImages.length ||
                    sourceImages.some(function(entry, index) { return sessionData.images[index] !== entry; }) || stableStringify(image) !== expectedSource) {
                    throw new Error('Photo or Drive access changed before upload. Please retry.');
                }
                if (pendingOwner && (getPendingPortfolioSync() !== pendingOwner || getPendingPortfolioOwnerSignature(pendingOwner) !== pendingOwnerSignature)) {
                    throw new Error('Pending writing changed before photo upload. Please sync the current writing.');
                }
                if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
                var portfolio = getLocalPortfolioSnapshot();
                if (!skipPortfolioSave && !findCurrentImage(portfolio, image)) throw new Error('Saved photo changed or was deleted before upload. Please retry.');
            }
            validateCurrentUpload();
            var uploadMimeType = blob && blob.type ? blob.type : (image.mimeType || 'application/octet-stream');
            var extension = uploadMimeType.indexOf('png') !== -1 ? '.png' : '.jpg';
            var filename = sanitizeDriveName(studentName) + '__' + sanitizeDriveName(sessionData.date || 'session') + '__' + sanitizeDriveName(image.name || ('image' + index)) + extension;
            uploadBlobToDrive(filename, blob, uploadMimeType, function(result, uploadError) {
                if (uploadError) { if (callback) callback(uploadError); return; }
                if (driveAccessToken !== uploadToken || sessionData.images.indexOf(image) < 0 || stableStringify(image) !== expectedSource) {
                    if (callback) callback(new Error('Photo or Drive access changed during upload. Please retry.'));
                    return;
                }
                if (!result || !result.id) { if (callback) callback(new Error('Photo upload failed. Please retry.')); return; }
                try {
                    var portfolio = !skipPortfolioSave ? getLocalPortfolioSnapshot() : null;
                    var current = portfolio ? findCurrentImage(portfolio, image) : image;
                    if (current) {
                        current.imageId = image.imageId;
                        current.driveFileId = result.id;
                        current.driveName = result.name || filename;
                        current.driveUploadedAt = new Date().toISOString();
                        current.pendingDriveUpload = false;
                        current.dataUrl = '';
                        current.dataUrlRemovedForStorage = true;
                        delete current.originalDataUrl;
                        delete current.extractedText;
                        if (portfolio) {
                            savePortfolioLocalOnly(portfolio, 'media-upload');
                            syncSavedPortfolioData(portfolio);
                        }
                    }
                } catch (e) { if (callback) callback(e); return; }
                nextUpload();
            }, validateCurrentUpload);
        }
    }
    nextUpload();
}

function syncPendingPortfolioMedia(callback) {
    callback = callback || function(error) {
        if (error) {
            wftDebugWarn('Portfolio photo sync failed:', error);
            setDriveSyncStatus('error', 'Photo sync failed - please retry');
        }
    };
    if (!driveAccessToken) {
        if (callback) callback();
        return;
    }
    var portfolio;
    try {
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        portfolio = getLocalPortfolioSnapshot();
    }
    catch (e) { if (callback) callback(e); return; }
    var studentNames = Object.keys(portfolio);
    var i = 0;
    function nextStudent() {
        if (i >= studentNames.length) {
            try { getLocalPortfolioSnapshot(); }
            catch (e) { if (callback) callback(e); return; }
            if (callback) callback();
            return;
        }
        var studentName = studentNames[i++];
        var sessions = portfolio[studentName] && portfolio[studentName].sessions ? portfolio[studentName].sessions : [];
        var j = 0;
        function nextSession(error) {
            if (error) { if (callback) callback(error); return; }
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
    if (selectedStudent !== name) closeCropModal();
    selectedStudent = name;
    try { localStorage.setItem("wft_selectedStudent", selectedStudent); } catch (e) { }
    var studentSelect = document.getElementById('studentSelect');
    if (studentSelect) studentSelect.value = name;
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
            return getNumericAssessmentScore(session.categoryScores && session.categoryScores[key]);
        }).filter(function(value) { return value != null; });
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
    var scoreText = getNumericAssessmentScore(item.score) != null ? String(item.score) + '/10' : 'Not scored';
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

function renderWftPortfolioStatsHtml(sessions, portfolioCategoryKeys) {
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
    return '<div class="portfolio-stats-grid">'
        + '<div class="portfolio-stat-card"><div class="stat-label">Latest Score</div><div class="stat-value">' + (latestOverall != null ? latestOverall + '%' : '-') + '</div>' + trendHtml + '</div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Average Score</div><div class="stat-value">' + (avgOverall != null ? avgOverall + '%' : '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Best Score</div><div class="stat-value">' + (bestOverall != null ? bestOverall + '%' : '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Submissions</div><div class="stat-value">' + sessions.length + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Strongest Area</div><div class="stat-value" style="font-size:0.85rem;">' + escapeHtml(strongestCategory || '-') + '</div></div>'
        + '<div class="portfolio-stat-card"><div class="stat-label">Focus Area</div><div class="stat-value" style="font-size:0.85rem;">' + escapeHtml(weakestCategory || '-') + '</div></div>'
        + '</div>';
}

function renderWftPortfolioSessionCardHtml(name, sess, si) {
    var scoreColor = scoreBadgeColor(sess.overall);
    var chipsHtml = '';
    var sessionId = sess.id || sess.createdAt || String(si);
    getSessionCategoryKeys(sess).forEach(function(key) {
        var value = getNumericAssessmentScore(sess.categoryScores && sess.categoryScores[key]);
        if (value == null) value = '-';
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
    return '<div class="session-card">'
        + '<div class="session-card-header">'
        + '<div class="session-card-title-wrap"><div class="session-date">' + escapeHtml(sess.date || 'Unknown date') + '</div><span class="session-title">' + escapeHtml(sess.title || 'Untitled') + '</span></div>'
        + '<div class="session-score" style="color:' + scoreColor + ';border-color:' + scoreColor + '33;">' + (sess.overall != null ? escapeHtml(sess.overall + '%') : 'N/A') + '</div>'
        + '</div>'
        + '<div class="session-meta">Grade level: ' + escapeHtml(sess.gradeLabel || ('Grade ' + (sess.gradeLevel || 5))) + ' - ' + escapeHtml((sess.sourceType || 'typed').replace('+', ' + ')) + ' submission' + (sess.createdAt ? ' - ' + escapeHtml(new Date(sess.createdAt).toLocaleString()) : '') + ' - Writing type: ' + escapeHtml(getWritingGenreInfoFromSession(sess).mainGenre) + '</div>'
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

function setupWftPortfolioCharts(chartId, catChartId, labels, overallData, catDatasets) {
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
    if (WFT_ASYNC_PORTFOLIO_ACCESS_V1 && !isWftStorageSafeMode() && !renderStudentPortfolio._syncRender) {
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
            contentEl.innerHTML = '<div class="portfolio-empty">Could not load this student portfolio. Download Emergency Backup before repairing browser storage.</div>';
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
    var portfolioCategoryKeys = getPortfolioCategoryKeys(sessions);
    var statsHtml = renderWftPortfolioStatsHtml(sessions, portfolioCategoryKeys);

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
                return getNumericAssessmentScore(session.categoryScores && session.categoryScores[key]);
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
        sessionCardsHtml += renderWftPortfolioSessionCardHtml(name, sessions[si], si);
    }

    contentEl.innerHTML = statsHtml
        + '<div class="portfolio-charts-row">'
        + '<div class="portfolio-chart-wrap"><h4>Overall Score Over Time</h4><canvas id="' + chartId + '" class="portfolio-chart-canvas"></canvas></div>'
        + '<div class="portfolio-chart-wrap"><h4>Category Scores Over Time</h4><canvas id="' + catChartId + '" class="portfolio-chart-canvas"></canvas></div>'
        + '</div>'
        + '<div class="portfolio-sessions-list"><h4>Saved Work</h4>' + sessionCardsHtml + '</div>';

    hydratePortfolioDriveImages(contentEl);

    setupWftPortfolioCharts(chartId, catChartId, labels, overallData, catDatasets);
}

function saveCurrentSessionToPortfolio(analysisData) {
    if (!analysisData || !isCurrentWritingContext(analysisData.inputContext)) return;
    var input = analysisData.inputContext;
    var student = input.studentName || null;
    if (!student) {
        if (driveAccessToken) {
            setDriveSyncStatus('error', 'Select a student before syncing');
        }
        return;
    }
    var now = new Date();
    var savedCategoryScores = analysisData.categoryScores || {};
    var neatnessAssessed = !!(savedCategoryScores["Neatness"] != null);
    var sessionData = {
        id: 'sess_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 8),
        createdAt: now.toISOString(),
        date: now.toLocaleDateString('en-GB'),
        title: getPreferredWritingTitle(
            input.writingText,
            analysisData.detailed && analysisData.detailed.titleSuggestion
        ) || 'Untitled',
        overall: analysisData.overall,
        gradeLevel: analysisData.gradeLevel || getActiveGradeLevel(),
        gradeLabel: analysisData.gradeLabel || (getGradeProfile().gradeLabel || getGradeProfile().label),
        gradeTier: analysisData.gradeTier || getGradeProfile().tier,
        gradeProfileVersion: analysisData.gradeProfileVersion || GRADE_PROFILE_VERSION,
        assessmentPolicy: analysisData.assessmentPolicy ? cloneWftJson(analysisData.assessmentPolicy) : null,
        actualWords: analysisData.actualWords,
        targetWords: analysisData.targetWords,
        categoryScores: savedCategoryScores,
        assessScriptQuality: neatnessAssessed,
        neatnessAssessed: neatnessAssessed,
        originalText: input.writingText,
        correctedHtml: sanitizeWftHtmlFragment(renderCorrected(input.writingText, analysisData.correctedStory || '')),
        correctedMarkup: analysisData.correctedStory || '',
        correctedPlainText: stripCorrectionMarkdown(analysisData.correctedStory || '').trim(),
        writingGenreInfo: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || detectWritingGenreInfo(String((document.getElementById('studentWriting') || {}).value || ''))),
        writingGenre: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).mainGenre,
        writingSubtype: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).subtype,
        writingSafeReference: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).safeReference,
        genreConfidence: normalizeWritingGenreInfo(analysisData.writingGenre || currentWritingGenreInfo || {}).confidence,
        feedbackSummary: buildSessionFeedbackSummary(analysisData),
        detailedFeedback: buildPortfolioDetailedFeedback(analysisData),
        notebookGuide: ensureNotebookGuide(analysisData, input.writingText),
        notebookGuideVersion: NOTEBOOK_GUIDE_VERSION,
        sourceType: input.images.length ? 'typed+photo' : 'typed',
        images: cloneWftJson(input.images),
        notebookPrintHtml: analysisData === latestAnalysisData ? captureNotebookPrintSnapshotForCurrentAnalysis() : ''
    };
    pendingPortfolioSync = {
        studentName: student,
        sessionData: sessionData,
        signature: getCurrentPortfolioSessionSignature(),
        replaceSource: input.reassessmentSource ? cloneWftJson(input.reassessmentSource) : null
    };
    activePortfolioReassessmentSource = null;
    analysisData.inputContext.reassessmentSource = null;
    var draftPersisted = persistPendingPortfolioSync();
    updateSyncPortfolioButtonState();
    setDriveSyncStatus(draftPersisted ? 'syncing' : 'warning', draftPersisted
        ? 'Ready to sync to portfolio' : 'Photos are only in this tab. Sync before closing or reloading.');
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
        if (pending || wftSyncState.pendingPortfolioPush) {
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

function getPendingPortfolioOwnerSignature(pending) {
    var owner = cloneWftJson(pending);
    if (owner && owner.sessionData) delete owner.sessionData.images;
    if (owner && owner.studentName) {
        var deletions = getDeletionsData();
        if (isStudentDeletedByTombstone(owner.studentName, deletions)) throw new Error('This student was deleted. Pending writing has been kept for recovery.');
        owner.studentDeletion = deletions.deletedStudents[getDeletedStudentKey(owner.studentName)] || null;
    }
    return stableStringify(owner);
}

function uploadPendingPortfolioMediaBeforeCommit(callback) {
    var pending = getPendingPortfolioSync();
    var ownerSignature = getPendingPortfolioOwnerSignature(pending);
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
    setDriveSyncStatus('syncing', 'Uploading portfolio image...');
    uploadSessionImagesToDrive(pending.studentName, pending.sessionData, function(error) {
        if (error) { if (callback) callback(false, error); return; }
        // Persist the updated pending session after successful media upload metadata is added.
        // At this point uploaded images have driveFileId values and their dataUrl values have been cleared.
        try {
            if (getPendingPortfolioSync() !== pending || getPendingPortfolioOwnerSignature(pending) !== ownerSignature) throw new Error('Pending writing changed during photo upload. Please sync the current writing.');
            persistPendingPortfolioSync();
        } catch (e) {
            if (callback) callback(false, e);
            return;
        }
        if (callback) callback(true);
    }, true, pending);
}

function manualSaveToDrive() {
    wftSyncLog("[WFT Sync] manualSaveToDrive requested", getWftSyncDebugSnapshot());
    if (manualSyncInProgress) {
        wftSyncLog("[WFT Sync] manualSaveToDrive ignored - already in progress");
        return;
    }
    var pendingBeforeCommit;
    var pendingOwnerSignature;
    try {
        prepareCurrentAnalysisForPortfolioSync();
        pendingBeforeCommit = getPendingPortfolioSync();
        pendingOwnerSignature = getPendingPortfolioOwnerSignature(pendingBeforeCommit);
    } catch (ePrepareBeforeDrive) {
        wftDebugError('Could not prepare portfolio sync:', ePrepareBeforeDrive);
        setSyncButtonsFailure('Retry Sync to Portfolio');
        setDriveSyncStatus('error', 'Could not prepare portfolio sync');
        return;
    }
    if (!driveAccessToken) {
        wftSyncLog("[WFT Sync] manualSaveToDrive needs Drive access");
        setDriveSyncStatus('syncing', 'Connecting to Drive...');
        requestDriveAccess(function() {
            manualSaveToDrive();
        });
        return;
    }

    manualSyncInProgress = true;
    setSyncButtonsBusy(true, 'Syncing...');
    setDriveSyncStatus('syncing', 'Syncing saved work...');

    var hadPendingBeforeCommit = !!pendingBeforeCommit;
    var manualDriveToken = driveAccessToken;
    var committedPending = false;

    function finishManualSaveToDrive() {
        try {
            if (getPendingPortfolioSync() !== pendingBeforeCommit || getPendingPortfolioOwnerSignature(pendingBeforeCommit) !== pendingOwnerSignature) throw new Error('Pending writing changed. Please sync the current writing.');
            committedPending = commitPendingPortfolioSync(pendingBeforeCommit);
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
            markWftPortfolioDirty("explicit-sync-to-portfolio");
            flushWftCloudSyncNow("explicit-sync-to-portfolio").then(function (result) {
                wftSyncLog("[WFT Sync] manualSaveToDrive flush result", result, getWftSyncDebugSnapshot());
                manualSyncInProgress = false;
                if (driveAccessToken !== manualDriveToken) { updateSyncPortfolioButtonState(); return; }
                if (getPendingPortfolioSync()) {
                    updateSyncPortfolioButtonState();
                    setDriveSyncStatus('syncing', 'New writing is ready to sync to portfolio');
                    return;
                }
                if (!result) {
                    setSyncButtonsFailure('Retry Sync to Portfolio');
                    setDriveSyncStatus('error', committedPending ? 'Saved locally - Drive sync failed' : 'Manual sync failed');
                } else {
                    setSyncButtonsBusy(false);
                    setDriveSyncStatus('synced', committedPending ? 'Portfolio synced' : 'Manual sync complete');
                }
            }).catch(function (e) {
                wftDebugError('Manual Drive flush failed:', e);
                wftSyncLog("[WFT Sync] manualSaveToDrive flush threw", {
                    name: e && e.name ? e.name : '',
                    message: e && e.message ? e.message : String(e),
                    stack: e && e.stack ? e.stack : ''
                }, getWftSyncDebugSnapshot());
                manualSyncInProgress = false;
                if (driveAccessToken !== manualDriveToken) { updateSyncPortfolioButtonState(); return; }
                setSyncButtonsFailure('Retry Sync to Portfolio');
                setDriveSyncStatus('error', committedPending ? 'Saved locally - Drive sync failed' : 'Manual sync failed');
            });
            return;
        }

        syncAllToDrive(function(success) {
            manualSyncInProgress = false;
            if (driveAccessToken !== manualDriveToken) { updateSyncPortfolioButtonState(); return; }
            if (getPendingPortfolioSync()) {
                updateSyncPortfolioButtonState();
                setDriveSyncStatus('syncing', 'New writing is ready to sync to portfolio');
                return;
            }
            if (success === false) {
                setSyncButtonsFailure('Retry Sync to Portfolio');
                setDriveSyncStatus('error', committedPending ? 'Saved locally - Drive sync failed' : 'Manual sync failed');
                return;
            }
            setSyncButtonsBusy(false);
            setDriveSyncStatus('synced', committedPending ? 'Portfolio synced' : 'Manual sync complete');
        });
    }

    if (hadPendingBeforeCommit && pendingPortfolioSessionHasUploadableImages(getPendingPortfolioSync())) {
        uploadPendingPortfolioMediaBeforeCommit(function(uploaded, error) {
            if (error) {
                manualSyncInProgress = false;
                setSyncButtonsFailure('Retry Sync to Portfolio');
                setDriveSyncStatus('error', error.message || 'Portfolio photo upload failed');
                return;
            }
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
}
function checkExpandBtnVisibility() {
    var ta = document.getElementById('studentWriting');
    var btn = document.getElementById('expandTextBtn');
    if (!ta || !btn) return;
    if (zenModeActive) { btn.style.display = 'block'; return; }
    btn.style.display = (ta.scrollHeight > ta.clientHeight + 2) ? 'block' : 'none';
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
var pendingPortfolioSyncPersistence = '';
var activePortfolioReassessmentSource = null;
var lastSyncedPortfolioSessionSignature = "";

function getActivePortfolioStudentName() {
    var select = document.getElementById("studentSelect");
    var selectValue = select ? String(select.value || "").trim() : "";
    var storedValue = String(selectedStudent || "").trim();
    if (select) {
        selectedStudent = selectValue;
        try { localStorage.setItem("wft_selectedStudent", selectedStudent); } catch (e) {}
        return selectValue;
    }
    return storedValue;
}

function captureCurrentWritingContext() {
    var studentName = getActivePortfolioStudentName();
    if (activePortfolioReassessmentSource && activePortfolioReassessmentSource.sourceStudentName !== studentName) {
        activePortfolioReassessmentSource = null;
    }
    return {
        studentName: studentName,
        writingText: String((document.getElementById("studentWriting") || {}).value || ""),
        images: getSessionImagePayloads(),
        primaryImage: selectedImageDataUrl || "",
        reassessmentSource: activePortfolioReassessmentSource ? cloneWftJson(activePortfolioReassessmentSource) : null
    };
}

function isCurrentWritingContext(context) {
    return !!context && JSON.stringify(context) === JSON.stringify(captureCurrentWritingContext());
}

function getCurrentPortfolioSessionSignature() {
    var student = getActivePortfolioStudentName();
    if (!latestAnalysisData || !student || !isCurrentWritingContext(latestAnalysisData.inputContext)) return "";
    var writingEl = document.getElementById("studentWriting");
    var writingText = writingEl ? String(writingEl.value || "") : "";
    var createdFrom = {
        studentName: student,
        writingText: writingText,
        images: latestAnalysisData.inputContext.images,
        overall: latestAnalysisData.overall,
        categoryScores: latestAnalysisData.categoryScores || {},
        correctedStory: latestAnalysisData.correctedStory || ""
    };
    return getWftHash(createdFrom);
}

function prepareCurrentAnalysisForPortfolioSync() {
    if (getPendingPortfolioSync()) return true;
    if (!latestAnalysisData || !isCurrentWritingContext(latestAnalysisData.inputContext)) return false;
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
        pendingPortfolioSyncPersistence = hasMissingPendingPortfolioPhotos(parsed) ? 'missing-photos' : 'full';
        return parsed;
    } catch (e) {
        return null;
    }
}

function hasMissingPendingPortfolioPhotos(pending) {
    var images = pending && pending.sessionData && pending.sessionData.images;
    return Array.isArray(images) && images.some(function(image) {
        return image && image.dataUrlRemovedForStorage && !image.driveFileId && !image.dataUrl;
    });
}

function updatePendingPortfolioPersistenceNotice(pending) {
    var message = '';
    if (pending) {
        if (hasMissingPendingPortfolioPhotos(pending)) {
            message = 'Some photos could not be recovered. Reattach the photos and analyze again before syncing. Your writing is still available.';
        } else if (pendingPortfolioSyncPersistence === 'photos-in-tab') {
            message = 'Writing saved in this browser. Photos are only in this tab. Sync to Portfolio before closing or reloading.';
        } else if (pendingPortfolioSyncPersistence === 'memory') {
            message = 'Writing and photos are only in this tab. Keep it open and retry Sync to Portfolio, or download Emergency Backup.';
        }
    }
    ['syncPortfolioBtnTop', 'syncPortfolioBtnBottom'].forEach(function(id) {
        var button = document.getElementById(id);
        var notice = document.getElementById(id + 'PersistenceNotice');
        if (!notice && message && button) {
            notice = document.createElement('p');
            notice.id = id + 'PersistenceNotice';
            notice.setAttribute('role', 'alert');
            button.parentNode.insertAdjacentElement('afterend', notice);
        }
        if (notice) { notice.textContent = message; notice.hidden = !message; }
    });
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
        pendingPortfolioSyncPersistence = 'memory';
        try {
            localStorage.setItem(PENDING_PORTFOLIO_SYNC_KEY, JSON.stringify(pendingPortfolioSync));
            pendingPortfolioSyncPersistence = hasMissingPendingPortfolioPhotos(pendingPortfolioSync) ? 'missing-photos' : 'full';
        } catch (e) {
            wftDebugWarn('Pending portfolio save exceeded localStorage; saving without embedded image data.', e);
            try {
                // Keep the full in-memory photos available for the pending Drive upload.
                // shortcut: quota fallback cannot restore unuploaded photos after reload; add durable media storage if reload recovery is needed.
                var cleaned = stripPendingPortfolioImageDataUrls(pendingPortfolioSync);
                localStorage.setItem(PENDING_PORTFOLIO_SYNC_KEY, JSON.stringify(cleaned));
                pendingPortfolioSyncPersistence = hasMissingPendingPortfolioPhotos(cleaned) ? 'photos-in-tab' : 'full';
            } catch (e2) {
                wftDebugError('Pending portfolio save retry also failed:', e2);
                updatePendingPortfolioPersistenceNotice(pendingPortfolioSync);
                throw e2;
            }
        }
    } else {
        localStorage.removeItem(PENDING_PORTFOLIO_SYNC_KEY);
        pendingPortfolioSyncPersistence = '';
    }
    updatePendingPortfolioPersistenceNotice(pendingPortfolioSync);
    return pendingPortfolioSyncPersistence === 'full';
}

function getPendingPortfolioSync() {
    if (!pendingPortfolioSync) {
        pendingPortfolioSync = loadPendingPortfolioSyncFromStorage();
    }
    return pendingPortfolioSync;
}

function clearPendingPortfolioSync() {
    localStorage.removeItem(PENDING_PORTFOLIO_SYNC_KEY);
    pendingPortfolioSync = null;
    pendingPortfolioSyncPersistence = '';
    try { updateSyncPortfolioButtonState(); }
    catch (e) { wftDebugError('Pending writing cleared, but sync button refresh failed:', e); }
}

function updateSyncPortfolioButtonState() {
    var pending = getPendingPortfolioSync();
    updatePendingPortfolioPersistenceNotice(pending);
    var hasAnalysis = !!latestAnalysisData;
    var activeStudent = getActivePortfolioStudentName();
    var currentSignature = getCurrentPortfolioSessionSignature();
    var ids = ['syncPortfolioBtnTop', 'syncPortfolioBtnBottom'];
    for (var i = 0; i < ids.length; i++) {
        var btn = document.getElementById(ids[i]);
        if (!btn) continue;
        var label = btn.querySelector('.sync-label');
        if ((pending || wftSyncState.pendingPortfolioPush) && !manualSyncInProgress) {
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

    var portfolio = getPortfolioData();
    var sourceData = portfolio[sourceStudent];
    var sourceSessions = sourceData && Array.isArray(sourceData.sessions) ? sourceData.sessions : [];
    var replaceIndex = findPortfolioSessionIndex(sourceSessions, sourceSessionId);
    if (replaceIndex < 0) return false;
    var oldSession = sourceSessions[replaceIndex];

    if (sourceStudent === targetStudent) {
        sourceSessions[replaceIndex] = newSession;
    } else {
        if (!portfolio[targetStudent]) portfolio[targetStudent] = { sessions: [] };
        sourceSessions.splice(replaceIndex, 1);
        portfolio[targetStudent].sessions = retainWftStudentSessions(targetStudent, portfolio[targetStudent].sessions, newSession);
    }

    var deletions;
    var oldSessionId = oldSession.id || oldSession.createdAt || sourceSessionId;
    if (sourceStudent !== targetStudent || String(oldSessionId) !== String(newSession.id || newSession.createdAt || "")) {
        deletions = getDeletionsData();
        recordSessionDeletion(sourceStudent, oldSessionId, deletions);
    }
    saveWftStudentChange({ portfolio: portfolio, deletions: deletions });
    try { renderStudentPortfolio(); } catch (e) { wftDebugError('Portfolio saved, but portfolio rendering failed:', e); }
    return true;
}

function commitPendingPortfolioSync(expectedPending) {
    var pending = getPendingPortfolioSync();
    if (arguments.length && pending !== expectedPending) return false;
    if (!pending || !pending.studentName || !pending.sessionData) return false;
    var previous;
    try {
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        preflightWftRequiredStorage();
        if (hasMissingPendingPortfolioPhotos(pending)) {
            updatePendingPortfolioPersistenceNotice(pending);
            return false;
        }
        previous = { wft_portfolio: localStorage.getItem('wft_portfolio'), wft_deletions: localStorage.getItem(WFT_DELETIONS_STORAGE_KEY) };
        if (pending.replaceSource) {
            if (!commitPendingPortfolioReplacement(pending)) return false;
        } else {
            saveStudentSession(pending.studentName, pending.sessionData);
        }
        if (getPendingPortfolioSync() !== pending) return false;
        var signature = pending.signature || getCurrentPortfolioSessionSignature();
        clearPendingPortfolioSync();
        lastSyncedPortfolioSessionSignature = signature;
        return true;
    } catch (e) {
        // A failed pending clear must not leave a saved copy that would be appended again on retry.
        if (previous && !restoreWftStudentChangeStorage(previous)) {
            wftStudentChangeRecovery = previous;
            e = getWftStudentChangeRecoveryError();
        }
        wftDebugError('saveStudentSession failed during pending portfolio commit:', e);
        if (e.wftStudentChangeRecovery) alert(e.message);
        wftSyncLog("[WFT Sync] pending portfolio commit failed", {
            name: e && e.name ? e.name : '',
            message: e && e.message ? e.message : String(e),
            stack: e && e.stack ? e.stack : ''
        });
        return false;
    }
}
