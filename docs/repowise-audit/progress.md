# Repowise audit progress

Updated 2026-10-11T16:17:55.539Z; timezone Asia/Bangkok. All662 original IDs retained. Baseline outcomes: {"no_code_change":229,"confirmed_awaiting_fix":124,"behavior_fixed_metric_review_pending":9,"pending":276,"fixed_in_draft_pr":24}. Ledger rows904. Source metrics, behavioral defects, derived suggestions and scanner UUID aliases retain individual evidence; absence alone never means fixed.

Reviewed draft repairs:

- [SYNC-001](https://github.com/thepick/writing-feedback-tool/pull/41), cd35543: Older settings/deletion uploads clear newer pending changes. Worker all23 suites pass; coordinator independently reviewed and reran focus evidence.
- [ANALYSIS-001](https://github.com/thepick/writing-feedback-tool/pull/42), ef41631: Async analysis reads changed student and writing at completion. Worker all24 suites pass; coordinator independently reviewed and reran focus evidence.
- [SYNC-002](https://github.com/thepick/writing-feedback-tool/pull/43), 9b8254f: Pending portfolio push overwrites distinct remote sessions for the same student. Worker all24 suites pass; coordinator independently reviewed and reran focus evidence.
- [STORAGE-001](https://github.com/thepick/writing-feedback-tool/pull/44), 9c26ded: Failed deletion marker write reports a successful student removal. Worker all26 suites pass; coordinator independently reviewed and reran focus evidence.
- [STORAGE-002](https://github.com/thepick/writing-feedback-tool/pull/45), 882e045: Unreadable existing portfolio is overwritten as an empty portfolio. Worker all27 suites pass; coordinator independently reviewed and reran focus evidence.

PR44 failed rollback keeps exact originals in the open tab and Emergency Backup; multi-key browser storage is not crash-atomic, and closing a recovery tab can lose its memory buffer. PR45 preserves unreadable portfolio bytes and pending work, blocks save/cloud overwrite, and supports valid empty data; damaged data still needs manual recovery. Existing valid-JSON backup convention is retained; inaccessible storage bytes cannot be exported until reads recover. PR42 legacy reset test is dormant; normal Google sign-out retains local work.

Remaining confirmed repair queue, one repository writer at a time:

- FEEDBACK-001: Missing handwriting criterion is described as worst performance.
- SECURITY-001: Student portfolio HTML export executes untrusted score and photo markup.
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands.
- PHOTO-001: Delayed crop callback changes another student/photo after cancellation.
- SYNC-003: Same-image merge overwrites newer photo reference with older metadata.
- SECURITY-002: Untrusted photo identity key mutates Object.prototype during sync.
- ANALYSIS-002: In-flight grade change mixes original assessment metadata with current scoring policy.
- SETTINGS-001: Failed preference save is acknowledged and schedules sync. Ordinary preference saving outside the repaired student operations, when no recovery buffer is active.
- ARCHIVE-001: Unused archive-removal helper writes a mismatched legacy session marker. The shipped auxiliary helper has no shipped caller; the current school-year archive UI uses clearCurrentClassAfterSuccessfulArchive instead.
- INDEX-001: Portfolio summary reads wrong score field and acknowledges stale or offline saves.
- OAUTH-001: OAuth redirect proceeds after failing to preserve unsaved writing.
- AUTH-001: Sign-out reports success while a retained session token can restore sign-in.
- PERF-001: Correction comparison blocks the UI with a full repeated token matrix.
- API-001: Missing API key triggers futile fallback retries and delayed error.
- STUDENT-001: Rename confirmation writes a stale portfolio and loses intervening saved writing.
- SYNC-004: Photo sync writes a stale portfolio snapshot and loses newer saved writing.

No-change source reviews include history signals, focused tests, dependent sequential IO, bounded guides/rubrics/audit tables, compact genre/title helpers, score/flow rules, UI/coordinate controls, date/state/wording helpers, optional cache/diagnostic/lookups and sync guards. Each has source-specific evidence and applicable checks. Test helpers are not blanket exempt. Concrete cleanup is required for91 original unused-copy/helper findings. Remaining source shapes, data-sized performance work, derived plans and coverage action are pending.

Refresh882e045:688 current health findings;143 refactoring plans;23 performance opportunities including investigate;15 dead-code entries; scanner security/doc drift zero;2 unique actions. Every current health row represented with baseline IDs preserved. Manual security bugs remain despite zero scanner security rows. New repair regression matrices were fully read and independently rerun.

STORAGE-002 writer stopped. Coordinator owns this checkpoint; next chat will be sole writer for SECURITY-001. All tests use synthetic data and intercepted services. No merge, deployment, real student data, paid AI calls or live Drive writes.
