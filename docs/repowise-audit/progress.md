# Repowise audit progress

Updated 2026-10-12T02:33:05.955Z; timezone Asia/Bangkok. All 662 original IDs retained, 1062 total tracked rows. Original outcomes: {"no_code_change":426,"confirmed_awaiting_fix":159,"pending":39,"fixed_in_draft_pr":38}. Scanner absence does not imply resolution.

- SYNC-001: Older settings/deletion uploads clear newer pending changes. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/41)
- ANALYSIS-001: Async analysis reads changed student and writing at completion. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/42)
- SYNC-002: Pending portfolio push overwrites distinct remote sessions for the same student. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/43)
- STORAGE-001: Failed deletion marker write reports a successful student removal. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/44)
- STORAGE-002: Unreadable existing portfolio is overwritten as an empty portfolio. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/45)
- SECURITY-001: Student portfolio HTML export executes untrusted score and photo markup. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/46)
- PHOTO-001: Delayed crop callback changes another student/photo after cancellation. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/47)
- SYNC-003: Same-image merge overwrites newer photo reference with older metadata. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/49)
- SECURITY-002: Inherited identity keys drop records and mutate shared object properties. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/49)
- SETTINGS-001: Failed preference save is acknowledged and schedules sync. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/53)
- STUDENT-001: Rename confirmation writes a stale portfolio and loses intervening saved writing. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/50)
- SYNC-004: Photo sync writes a stale portfolio snapshot and loses newer saved writing. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/48)
- STORAGE-003: Corrupt deletion history is overwritten as empty. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/51)
- DELETIONS-001: Enabled experimental deletion compaction recurses indefinitely. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/51)
- FLOW-001: Inherited token names break repetition, grammar and title keyword lookups. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/49)
- PENDING-001: Photo completion commits and clears a newer pending assessment. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/48)
- PHOTO-002: Cropped uploaded photo keeps the original Drive reference and loses its changed bytes. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/48)
- KEY-001: Credential persistence failures mishandle keys and legacy settings uploads. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/53)
- SETTINGS-002: Unreadable existing preferences are replaced with current defaults. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/51)
- STORAGE-004: Adding a student overwrites unreadable existing roster history. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/51)
- EXPORT-001: Same-day photos with the same name share one export filename. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/52)
- DELETIONS-002: Main portfolio removes newer writing with an older session deletion marker. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/51)
- EXPORT-002: Failed photo downloads are acknowledged as included before the class is cleared. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/52)
- ARCHIVE-002: Archive completion clears writing saved after its snapshot. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/52)
- EXPORT-003: Single-student export ignores the request to include available photos. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/52)
- SETTINGS-003: Settings merge drops valid own metadata fields. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/53)
- STORAGE-005: Session retention discards the newest existing essay. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/54)
- ARCHIVE-003: A delayed archive upload follows a changed Google connection. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/52)
- EXPORT-004: Windows-equivalent student archive folders overwrite on extraction. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/52)

Confirmed remaining queue; one repair chat and repository writer at a time:

- FEEDBACK-001: Missing scores are described as poor performance
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands
- ANALYSIS-002: In-flight grade change mixes original assessment metadata with current scoring policy
- ARCHIVE-001: Unused archive-removal helper writes a mismatched legacy session marker
- INDEX-001: Portfolio summary reads wrong score field and acknowledges stale or offline saves
- OAUTH-001: OAuth redirect proceeds after failing to preserve unsaved writing
- AUTH-001: Sign-out reports success while a retained session token can restore sign-in
- PERF-001: Correction comparison blocks the UI with a full repeated token matrix
- API-001: Missing API key triggers futile fallback retries and delayed error
- PARSER-001: Detailed assessment terminator creates empty categories and suppresses valid scores
- GUIDE-001: Notebook punctuation and spelling changes receive incorrect teaching labels
- GUIDE-002: Notebook paragraph revisions lose their separation before display
- FEEDBACK-002: Flow adjustment converts an explicitly missing detailed score to zero
- GUIDE-003: Separate notebook action lines are collapsed into one checklist item
- AUTH-002: Delayed Google sign-in or profile response republishes a signed-out or replaced connection
- AUTH-003: Malformed session payload is accepted as a valid Drive connection

Current indexed source b630911a210483a52d1f7a6d4dc064eacae38fca: 739 health rows, 154 refactoring plans, 24 performance opportunities; dead-code, security, documentation and action surfaces individually reconciled in audit-ledger.json. Coverage report ingestion remains open; native executable-location collection has passed a source-hashed four-script self-check, including uncovered unused function bodies, first-page-only execution before reload, and Windows line endings. No coverage was ingested from the preparation run.

No repair chat is writing; coordinator is checkpointing the ledger before the next sequential repair.

Source-specific reviews and validation scopes are recorded per finding. Recent independent checks include crop38/38, safe portfolio/export HTML25/25, analysis identity22/22, feedback rendering19 checks, flow/grammar10 checks, export output equality and buffer/join timings at10/100/500 sessions, native keyboard/word-count/selection display, handwriting13 outcomes, photo eligibility5, archive dates7, and pending/replacement storage/Sync failure tests. These checks support individual dispositions, not universal correctness or teaching calibration. Confirmed archive/export, settings acknowledgements, authentication, assessment, parser and cleanup work remains in the queue above; the ledger records the evidence for each. Cleanup covers113 original findings; derived extraction suggestions are assessed using their linked source evidence.

Known limits: localStorage writes across multiple keys are not crash-atomic. A failed rollback keeps recovery bytes in the open tab; forced closing can lose that buffer. Quota fallback preserves in-memory unuploaded photos but cannot restore those bytes after reload. Corrupt primary bytes are protected by reviewed strict readers where repaired and still require recovery; remaining required-reader defects are queued. Normal Google sign-out retains local writing. Split student files are enabled by default; ID mapping, lazy loading, IndexedDB caching and deletion compaction remain disabled by default and are tested explicitly where relevant. Browser checks use synthetic data and intercepted services. No live Drive writes, real student records, paid AI, merge or deployment.

Platform restrictions, if encountered, are recorded for the specific check. Other authorized repairs continue without bypassing restrictions.
