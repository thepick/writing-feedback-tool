// =============================================================================
// WFT UPGRADE — Feature Flags (Patch 0)
// =============================================================================
// Storage schema version — bump when storage format changes
var WFT_STORAGE_SCHEMA_VERSION = 1;

// ── Storage Upgrade V1 feature flags ──
// All start as false; enabled one-by-one after validation
var WFT_PROACTIVE_STRIP_V1 = false;
var WFT_IMAGE_COMPRESSION_V1 = false;
var WFT_ASYNC_PORTFOLIO_ACCESS_V1 = false;
var WFT_INDEXEDDB_CACHE_V1 = false;
var WFT_PORTFOLIO_INDEX_V1 = false;
var WFT_STUDENT_ID_MAP_V1 = false;
// Phase 3 — Split student files ENABLED (permanent commitment)
// Legacy single-portfolio (wft-portfolio.json) support is deprecated
var WFT_SPLIT_STUDENT_FILES_V1 = true;
var WFT_LAZY_PORTFOLIO_LOAD_V1 = false;
var WFT_STORAGE_HEALTH_UI_V1 = false;
var WFT_LAMPORT_V1 = false;
// Phase B — Tombstone compaction (90-day window, disabled pending validation)
var WFT_TOMBSTONE_COMPACTION_V1 = false;
// Phase D — BroadcastChannel coordination for multi-tab sync (low risk, improves behavior)
var WFT_BROADCAST_CHANNEL_V1 = true;
