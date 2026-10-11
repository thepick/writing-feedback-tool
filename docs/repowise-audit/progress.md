# Repowise audit progress

Updated 2026-10-11T17:12:25.654Z; timezone Asia/Bangkok. All662 original IDs retained, 933 total individually tracked rows. Original outcomes: {"no_code_change":267,"confirmed_awaiting_fix":146,"behavior_fixed_metric_review_pending":14,"pending":211,"fixed_in_draft_pr":24}. Scanner absence never implies resolution.

- [SYNC-001](https://github.com/thepick/writing-feedback-tool/pull/41), cd35543: Older settings/deletion uploads clear newer pending changes. Worker all23 suites; coordinator focused independent review/verification.
- [ANALYSIS-001](https://github.com/thepick/writing-feedback-tool/pull/42), ef41631: Async analysis reads changed student and writing at completion. Worker all24 suites; coordinator focused independent review/verification.
- [SYNC-002](https://github.com/thepick/writing-feedback-tool/pull/43), 9b8254f: Pending portfolio push overwrites distinct remote sessions for the same student. Worker all24 suites; coordinator focused independent review/verification.
- [STORAGE-001](https://github.com/thepick/writing-feedback-tool/pull/44), 9c26ded: Failed deletion marker write reports a successful student removal. Worker all26 suites; coordinator focused independent review/verification.
- [STORAGE-002](https://github.com/thepick/writing-feedback-tool/pull/45), 882e045: Unreadable existing portfolio is overwritten as an empty portfolio. Worker all27 suites; coordinator focused independent review/verification.
- [SECURITY-001](https://github.com/thepick/writing-feedback-tool/pull/46), 842ec61: Student portfolio HTML export executes untrusted score and photo markup. Worker all28 suites; coordinator focused independent review/verification.
- [PHOTO-001](https://github.com/thepick/writing-feedback-tool/pull/47), a4e8ba6: Delayed crop callback changes another student/photo after cancellation. Worker all29 suites; coordinator focused independent review/verification.

Confirmed remaining queue; one repair chat and repository writer at a time:

- FEEDBACK-001: Missing scores are described as poor performance
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands
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
- FEEDBACK-002: Flow adjustment converts an explicitly missing detailed score to zero
- FLOW-001: Inherited token name breaks sentence-starter repetition counting
- PENDING-001: Photo completion commits and clears a newer pending assessment
- GUIDE-003: Separate notebook action lines are collapsed into one checklist item
- PHOTO-002: Cropped uploaded photo keeps the original Drive reference and loses its changed bytes

Current indexed commit a4e8ba6:696 health rows,147 refactoring plans,24 performance opportunities including explicit investigate,15 dead-code entries; scanner security/doc drift0. Two derived actions tracked, including coverage report ingestion still pending. All source shapes and derived suggestions require concrete individual evidence; repaired behavior does not automatically close shape metrics. CLEANUP-001 now covers103 original findings, including unreachable helper copies/islands and exact redundant parser fallback.

Coordinator source reviews include actual bounded sample/feedback/notebook/record dependencies, optional UI/cache boundaries and independent regression matrices. Individual details and scope limits are in audit-ledger.json. PHOTO-001 complete:38 crop cases pass independently,33 fail on base. PHOTO-002 reproduced separately: changed uploaded photo bytes skipped by uploader and stripped from storage while old Drive ID survives. Next related repair is SYNC-004/PENDING-001/PHOTO-002.

Known limits: localStorage multi-key writes are not crash-atomic; if rollback writes fail, preserved bytes remain in the open tab until exported/recovered. Forced closing can lose that buffer. Corrupt portfolio bytes are protected but require manual recovery. Normal Google sign-out retains local writing. Experimental deletion compaction defaults false and its enabled recursion is separately queued. Browser checks use synthetic data and intercepted services; no live Drive writes, real student records, paid AI, merge or deployment. Coverage ingestion and remaining source reviews are open.

Platform restrictions will be recorded for the particular blocked check; other authorized work continues without bypassing restrictions. PHOTO-001 writer stopped; coordinator checkpoint before next sole writer.
