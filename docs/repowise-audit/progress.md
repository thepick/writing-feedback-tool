# Repowise audit progress

Updated 2026-10-12T04:23:15.622Z; timezone Asia/Bangkok. All 662 original IDs retained, 1095 total tracked rows. Original outcomes: {"no_code_change":449,"confirmed_awaiting_fix":147,"pending":21,"fixed_and_deployed":44,"fixed_in_draft_pr":1}. Scanner absence does not imply resolution. Ledger review dispositions retain their historical names; publication fields record current live status.

Latest live release: [https://wft.mtomlinson.ca/](https://wft.mtomlinson.ca/), built 2026-10-12T04:13:10Z, commit 372916470c11cc2c25242484abde1d6c6eb7a181. All five shipped files match the reviewed source byte for byte. Rollback backup and file hashes are recorded in the ledger.

- SYNC-001: Older settings/deletion uploads clear newer pending changes. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/41)
- ANALYSIS-001: Async analysis reads changed student and writing at completion. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/42)
- SYNC-002: Pending portfolio push overwrites distinct remote sessions for the same student. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/43)
- STORAGE-001: Failed deletion marker write reports a successful student removal. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/44)
- STORAGE-002: Unreadable existing portfolio is overwritten as an empty portfolio. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/45)
- SECURITY-001: Student portfolio HTML export executes untrusted score and photo markup. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/46)
- PHOTO-001: Delayed crop callback changes another student/photo after cancellation. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/47)
- SYNC-003: Same-image merge overwrites newer photo reference with older metadata. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/49)
- SECURITY-002: Inherited identity keys drop records and mutate shared object properties. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/49)
- ANALYSIS-002: In-flight grade change mixes original assessment metadata with current scoring policy. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/56)
- SETTINGS-001: Failed preference save is acknowledged and schedules sync. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/53)
- OAUTH-001: OAuth redirect proceeds after failing to preserve unsaved writing. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/55)
- AUTH-001: Sign-out reports success while a retained session token can restore sign-in. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/55)
- STUDENT-001: Rename confirmation writes a stale portfolio and loses intervening saved writing. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/50)
- SYNC-004: Photo sync writes a stale portfolio snapshot and loses newer saved writing. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/48)
- STORAGE-003: Corrupt deletion history is overwritten as empty. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/51)
- DELETIONS-001: Enabled experimental deletion compaction recurses indefinitely. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/51)
- FLOW-001: Inherited token names break repetition, grammar and title keyword lookups. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/49)
- PENDING-001: Photo completion commits and clears a newer pending assessment. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/48)
- PHOTO-002: Cropped uploaded photo keeps the original Drive reference and loses its changed bytes. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/48)
- KEY-001: Credential persistence failures mishandle keys and legacy settings uploads. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/53)
- SETTINGS-002: Unreadable existing preferences are replaced with current defaults. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/51)
- STORAGE-004: Adding a student overwrites unreadable existing roster history. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/51)
- EXPORT-001: Same-day photos with the same name share one export filename. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/52)
- DELETIONS-002: Main portfolio removes newer writing with an older session deletion marker. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/51)
- EXPORT-002: Failed photo downloads are acknowledged as included before the class is cleared. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/52)
- ARCHIVE-002: Archive completion clears writing saved after its snapshot. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/52)
- EXPORT-003: Single-student export ignores the request to include available photos. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/52)
- SETTINGS-003: Settings merge drops valid own metadata fields. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/53)
- STORAGE-005: Session retention discards the newest existing essay. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/54)
- ARCHIVE-003: A delayed archive upload follows a changed Google connection. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/52)
- EXPORT-004: Windows-equivalent student archive folders overwrite on extraction. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/52)
- AUTH-002: Delayed Google sign-in or profile response republishes a signed-out or replaced connection. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/55)
- AUTH-003: Malformed session payload is accepted as a valid Drive connection. [Merged PR � live](https://github.com/thepick/writing-feedback-tool/pull/55)

Confirmed remaining queue; one repair chat and repository writer at a time:

- FEEDBACK-001: Missing scores are described as poor performance
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands
- ARCHIVE-001: Unused archive-removal helper writes a mismatched legacy session marker
- INDEX-001: Portfolio summary reads wrong score field and acknowledges stale or offline saves
- PERF-001: Correction comparison blocks the UI with a full repeated token matrix
- API-001: Missing API key triggers futile fallback retries and delayed error
- PARSER-001: Detailed assessment terminator creates empty categories and suppresses valid scores
- GUIDE-001: Notebook punctuation and spelling changes receive incorrect teaching labels
- GUIDE-002: Notebook paragraph revisions lose their separation before display
- FEEDBACK-002: Flow adjustment converts an explicitly missing detailed score to zero
- GUIDE-003: Separate notebook action lines are collapsed into one checklist item

Current indexed source 41fedd02b978200b925536ab36167a3007fddcc7: 752 health rows, 155 refactoring plans, 24 performance opportunities; dead-code, security, documentation and action surfaces individually reconciled in audit-ledger.json. Coverage report ingestion remains open; native executable-location collection has passed a source-hashed four-script self-check, including uncovered unused function bodies, first-page-only execution before reload, and Windows line endings. No coverage was ingested from the preparation run.

No repair chat is writing; coordinator is checkpointing the ledger before the next sequential repair.

Source-specific reviews and validation scopes are recorded per finding. Recent independent checks include crop38/38, safe portfolio/export HTML25/25, analysis identity22/22, feedback rendering19 checks, flow/grammar10 checks, export output equality and buffer/join timings at10/100/500 sessions, native keyboard/word-count/selection display, handwriting13 outcomes, photo eligibility5, archive dates7, and pending/replacement storage/Sync failure tests. These checks support individual dispositions, not universal correctness or teaching calibration. Confirmed remaining assessment, feedback, parser, index, performance, API validation and cleanup work appears in the queue above; the ledger records the evidence for each. Cleanup covers113 original findings; derived extraction suggestions are assessed using their linked source evidence.

Known limits: localStorage writes across multiple keys are not crash-atomic. A failed rollback keeps recovery bytes in the open tab; forced closing can lose that buffer. Quota fallback preserves in-memory unuploaded photos but cannot restore those bytes after reload. Corrupt primary bytes are protected by reviewed strict readers where repaired and still require recovery; remaining required-reader defects are queued. Normal Google sign-out retains local writing. Split student files are enabled by default; ID mapping, lazy loading, IndexedDB caching and deletion compaction remain disabled by default and are tested explicitly where relevant. Browser checks use synthetic data and intercepted services. No live Drive writes, real student records or paid AI checks. Reviewed repairs have been merged and published under the user�s explicit deployment instruction; unfinished repairs remain in the queue.

Platform restrictions, if encountered, are recorded for the specific check. Other authorized repairs continue without bypassing restrictions.
