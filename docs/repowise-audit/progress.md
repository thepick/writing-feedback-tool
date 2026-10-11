# Repowise audit progress

Updated 2026-10-11T15:58:38.060Z; timezone Asia/Bangkok. All 662 original finding IDs retained. Baseline outcomes: {"no_code_change":188,"pending":338,"confirmed_awaiting_fix":119,"behavior_fixed_metric_review_pending":10,"fixed_in_draft_pr":7}. Ledger contains 888 rows including additional issue surfaces and manually reproduced defects. Scanner absence is not resolution.

Reviewed draft repairs:

- [PR41 settings/deletion races](https://github.com/thepick/writing-feedback-tool/pull/41), cd35543: all 23 suites passed; coordinator independently verified focus cases.
- [PR42 analysis attribution](https://github.com/thepick/writing-feedback-tool/pull/42), ef41631: original 19/22 failures, repaired 22/22; all 24 suites passed. Four source-shape findings remain open. Legacy reset case is dormant; normal Google sign-out retains work.
- [PR43 portfolio union](https://github.com/thepick/writing-feedback-tool/pull/43), 9b8254: eight actual-browser sync cases and real merge source cases pass; all 24 suites passed. Distinct essays retained; separate same-photo conflict remains queued.
- [PR44 deletion durability](https://github.com/thepick/writing-feedback-tool/pull/44), 9c26ded: 59 browser cases pass, 51 failed originally. Worker all 26 suites pass. Coordinator reviewed production diff and independently reran all 59 cases. Required storage failure rolls back; failed rollback retains exact originals in the tab and Emergency Backup, blocks sync, and retries recovery first. Remaining shape metrics stay open. Multi-key browser writes are not crash-atomic; force-closing a recovery tab can lose its memory buffer.

Remaining confirmed repair queue, one chat writing at a time:

- STORAGE-002: Unreadable existing portfolio is overwritten as an empty portfolio. 
- FEEDBACK-001: Missing handwriting criterion is described as worst performance. 
- SECURITY-001: Student portfolio HTML export executes untrusted score and photo markup. 
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands. 
- PHOTO-001: Delayed crop callback changes another student/photo after cancellation. 
- SYNC-003: Same-image merge overwrites newer photo reference with older metadata. 
- SECURITY-002: Untrusted photo identity key mutates Object.prototype during sync. 
- ANALYSIS-002: In-flight grade change mixes original assessment metadata with current scoring policy. 
- SETTINGS-001: Failed preference save is acknowledged and schedules sync. Ordinary preference saving outside the repaired student operations, when no recovery buffer is active.
- ARCHIVE-001: Unused archive-removal helper writes a mismatched legacy session marker. The shipped auxiliary helper has no shipped caller; the current school-year archive UI uses clearCurrentClassAfterSuccessfulArchive instead.

Original no-change dispositions have individual source evidence and applicable checks: history signals, test callbacks/matrices, dependent sequential IO, bounded guides/rubrics/audit tables, compact genre/title helpers, score/flow rules, UI controls, optional cache/diagnostic catches and sync guards. Tests are not blanket exempt. 91 original stale-copy/unused-helper findings require concrete removal and retained shipped coverage. Other source groups, data-sized performance opportunities, derived refactoring plans and coverage action remain under review.

Refresh at 9c26ded: 678 current health findings, 142 refactoring plans, 23 full performance opportunities including investigate, 15 dead-code entries, scanner security/doc drift zero, two unique actions. Every current health row represented; canonical baseline IDs preserved across UUID/location churn. Manual HTML and prototype defects retained despite scanner zero. New post-repair warnings remain pending review.

Deletion repair writer has stopped. Coordinator owns this checkpoint; next writer will repair STORAGE-002 on a branch based on PR44. All reproductions use synthetic data and intercepted services. No merge/deployment, real student data, paid AI calls or live Drive writes.
