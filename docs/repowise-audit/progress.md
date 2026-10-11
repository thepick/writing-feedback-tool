# Repowise audit progress

Updated 2026-10-11T16:40:47.733Z; timezone Asia/Bangkok. All 662 original IDs retained. Baseline outcomes: {"no_code_change":244,"confirmed_awaiting_fix":129,"behavior_fixed_metric_review_pending":14,"pending":251,"fixed_in_draft_pr":24}. Ledger rows 914. Each disposition carries source evidence; missing scanner rows never imply resolution.

Reviewed draft repairs:

- [SYNC-001](https://github.com/thepick/writing-feedback-tool/pull/41), cd35543: Older settings/deletion uploads clear newer pending changes. Worker all 23 suites pass; coordinator independently reviewed and reran focused evidence.
- [ANALYSIS-001](https://github.com/thepick/writing-feedback-tool/pull/42), ef41631: Async analysis reads changed student and writing at completion. Worker all 24 suites pass; coordinator independently reviewed and reran focused evidence.
- [SYNC-002](https://github.com/thepick/writing-feedback-tool/pull/43), 9b8254f: Pending portfolio push overwrites distinct remote sessions for the same student. Worker all 24 suites pass; coordinator independently reviewed and reran focused evidence.
- [STORAGE-001](https://github.com/thepick/writing-feedback-tool/pull/44), 9c26ded: Failed deletion marker write reports a successful student removal. Worker all 26 suites pass; coordinator independently reviewed and reran focused evidence.
- [STORAGE-002](https://github.com/thepick/writing-feedback-tool/pull/45), 882e045: Unreadable existing portfolio is overwritten as an empty portfolio. Worker all 27 suites pass; coordinator independently reviewed and reran focused evidence.
- [SECURITY-001](https://github.com/thepick/writing-feedback-tool/pull/46), 842ec61: Student portfolio HTML export executes untrusted score and photo markup. Worker all 28 suites pass; coordinator independently reviewed and reran focused evidence.

Confirmed queue, one repository writer at a time:

- FEEDBACK-001: Missing handwriting criterion is described as worst performance
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands
- PHOTO-001: Delayed crop callback changes another student/photo after cancellation
- SYNC-003: Same-image merge overwrites newer photo reference with older metadata
- SECURITY-002: Untrusted photo identity key mutates Object.prototype during sync
- ANALYSIS-002: In-flight grade change mixes original assessment metadata with current scoring policy
- SETTINGS-001: Failed preference save is acknowledged and schedules sync
- ARCHIVE-001: Unused archive-removal helper writes a mismatched legacy session marker
- INDEX-001: Portfolio summary reads wrong score field and acknowledges stale or offline saves
- OAUTH-001: OAuth redirect proceeds after failing to preserve unsaved writing
- AUTH-001: Sign-out reports success while a retained session token can restore sign-in
- PERF-001: Correction comparison blocks the UI with a full repeated token matrix
- API-001: Missing API key triggers futile fallback retries and delayed error
- STUDENT-001: Rename confirmation writes a stale portfolio and loses intervening saved writing
- SYNC-004: Photo sync writes a stale portfolio snapshot and loses newer saved writing
- PARSER-001: Detailed assessment terminator creates empty categories and suppresses valid scores
- GUIDE-001: Notebook punctuation and spelling changes receive incorrect teaching labels
- GUIDE-002: Notebook paragraph revisions lose their separation before display
- STORAGE-003: Corrupt deletion history is overwritten as empty
- DELETIONS-001: Enabled experimental deletion compaction recurses indefinitely

Source reviews cover bounded UI/parser/guide helpers, optional diagnostics/cache/lookups, historical signals and focused regression matrices with individual checks. Remaining large data paths, source shapes, derived plans and coverage action stay open. Concrete cleanup covers 91 original unused-copy/helper findings.

Current refresh842ec61:689 health findings;144 refactoring plans;23 performance opportunities (including investigate);15 dead-code entries; scanner security/doc drift zero; derived actions reconciled. Manual defects remain despite empty scanner security results.

PR44 browser multi-key writes are not crash-atomic; rollback failure keeps bytes in the open tab and Emergency Backup until storage recovers. Closing a recovery tab can lose that buffer. PR45 protects damaged portfolio bytes; manual recovery still required. Normal Google sign-out retains local work. PR46 rejects unsafe exported/displayed imports and preserves tested formatting/photos; performance and shape metrics remain open. Experimental deletion compaction flag defaults false.

All checks use synthetic data and intercepted services. No merge, deployment, real student data, paid AI or live Drive writes. Individual platform restrictions will be recorded; other authorized work continues without attempting bypass.

SECURITY-001 writer stopped. Coordinator refresh/checkpoint complete; next sole writer is PHOTO-001.
