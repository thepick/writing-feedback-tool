# Repowise audit progress

Updated 2026-10-12T13:28:52.673Z; timezone Asia/Bangkok. All662 original IDs retained; 1164 total tracked rows. Original outcomes: {"no_code_change":468,"fixed_and_deployed":194}. Scanner absence does not imply resolution. Historical disposition names remain; publication fields record current live status.

Storage coverage follow-up: in_progress. Prior audit dispositions remain preserved; these additional paths are being checked in sequential repair chats.

- STORAGE-COVERAGE-001: Split student save, folder lifecycle and index reads — complete ([PR](https://github.com/thepick/writing-feedback-tool/pull/65)).
- STORAGE-COVERAGE-002: Recovery backup, safe mode and local cache clearing — complete ([PR](https://github.com/thepick/writing-feedback-tool/pull/66)).
- STORAGE-COVERAGE-003: Drive errors, manual save and polling lifecycle — complete ([PR](https://github.com/thepick/writing-feedback-tool/pull/67)).
- STORAGE-COVERAGE-004: Optional cache and async student portfolio paths — complete ([PR](https://github.com/thepick/writing-feedback-tool/pull/68)).
- STORAGE-COVERAGE-006: Repair late upload sync acknowledgements — complete ([PR](https://github.com/thepick/writing-feedback-tool/pull/70)).
- STORAGE-COVERAGE-007: Repair keyboard cancellation in student dialogs — reviewed_awaiting_publication ([PR](https://github.com/thepick/writing-feedback-tool/pull/72)).
- STORAGE-COVERAGE-005: Remaining storage UI and final measured coverage — pending.

Current follow-up source: b706bb7f3ad3dc8d3203299a6cc8a1f6df3b8ae6. fresh final-source coverage pending until stable final phase Coverage numbers from the prior audit below remain historical until replaced by verified final-source evidence.

Latest live release: [https://wft.mtomlinson.ca/](https://wft.mtomlinson.ca/), built 2026-10-12T12:59:16Z, commit 469cc25c4699a603faac859a8a4c45d86fe594d7. All five shipped files match reviewed Git source byte for byte. Publication history records exact hashes and rollback backup.

Confirmed remaining repairs; one repair chat and repository writer at a time:

No confirmed behavioral repair remains in this queue.

Current storage follow-up validation: in_progress. Stable-source complete fresh suite/native corpus, remaining meaningful storage UI checks, independent raw Git/coverage verification, strict coverage ingestion, refreshed current-source reconciliation and reviewed residual risks.

Remaining ledger obligations: 0.


Current indexed source: 3c99bf6c62447c3a2325314f70905ff2738cda34.

| Surface | Count |
| --- | --- |
| code_health | 637 |
| dead_code | 1 |
| security | 0 |
| refactoring_plans | 152 |
| performance_opportunities | 24 |
| doc_drift | 0 |
| actions | 2 |

No repair chat is writing. The coordinator is reviewing and checkpointing before the next storage follow-up.

Reviewed repairs:

- SYNC-001: Older settings/deletion uploads clear newer pending changes. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/41)
- ANALYSIS-001: Async analysis reads changed student and writing at completion. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/42)
- SYNC-002: Pending portfolio push overwrites distinct remote sessions for the same student. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/43)
- STORAGE-001: Failed deletion marker write reports a successful student removal. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/44)
- STORAGE-002: Unreadable existing portfolio is overwritten as an empty portfolio. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/45)
- FEEDBACK-001: Missing scores are described as poor performance. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/57)
- SECURITY-001: Student portfolio HTML export executes untrusted score and photo markup. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/46)
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/63)
- PHOTO-001: Delayed crop callback changes another student/photo after cancellation. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/47)
- SYNC-003: Same-image merge overwrites newer photo reference with older metadata. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/49)
- SECURITY-002: Inherited identity keys drop records and mutate shared object properties. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/49)
- ANALYSIS-002: In-flight grade change mixes original assessment metadata with current scoring policy. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/56)
- SETTINGS-001: Failed preference save is acknowledged and schedules sync. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/53)
- ARCHIVE-001: Unused archive-removal helper writes a mismatched legacy session marker. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/63)
- INDEX-001: Portfolio summary reads wrong score field and acknowledges stale or offline saves. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/60)
- OAUTH-001: OAuth redirect proceeds after failing to preserve unsaved writing. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/55)
- AUTH-001: Sign-out reports success while a retained session token can restore sign-in. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/55)
- PERF-001: Correction comparison blocks the UI with a full repeated token matrix. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/61)
- API-001: Missing API key triggers futile fallback retries and delayed error. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/62)
- STUDENT-001: Rename confirmation writes a stale portfolio and loses intervening saved writing. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/50)
- SYNC-004: Photo sync writes a stale portfolio snapshot and loses newer saved writing. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/48)
- PARSER-001: Detailed assessment terminator creates empty categories and suppresses valid scores. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/59)
- GUIDE-001: Notebook punctuation and spelling changes receive incorrect teaching labels. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/58)
- GUIDE-002: Notebook paragraph revisions lose their separation before display. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/58)
- STORAGE-003: Corrupt deletion history is overwritten as empty. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/51)
- DELETIONS-001: Enabled experimental deletion compaction recurses indefinitely. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/51)
- FEEDBACK-002: Flow adjustment converts an explicitly missing detailed score to zero. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/57)
- FLOW-001: Inherited token names break repetition, grammar and title keyword lookups. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/49)
- PENDING-001: Photo completion commits and clears a newer pending assessment. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/48)
- GUIDE-003: Separate notebook action lines are collapsed into one checklist item. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/58)
- PHOTO-002: Cropped uploaded photo keeps the original Drive reference and loses its changed bytes. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/48)
- KEY-001: Credential persistence failures mishandle keys and legacy settings uploads. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/53)
- SETTINGS-002: Unreadable existing preferences are replaced with current defaults. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/51)
- STORAGE-004: Adding a student overwrites unreadable existing roster history. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/51)
- EXPORT-001: Same-day photos with the same name share one export filename. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/52)
- DELETIONS-002: Main portfolio removes newer writing with an older session deletion marker. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/51)
- EXPORT-002: Failed photo downloads are acknowledged as included before the class is cleared. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/52)
- ARCHIVE-002: Archive completion clears writing saved after its snapshot. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/52)
- EXPORT-003: Single-student export ignores the request to include available photos. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/52)
- SETTINGS-003: Settings merge drops valid own metadata fields. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/53)
- STORAGE-005: Session retention discards the newest existing essay. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/54)
- ARCHIVE-003: A delayed archive upload follows a changed Google connection. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/52)
- EXPORT-004: Windows-equivalent student archive folders overwrite on extraction. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/52)
- AUTH-002: Delayed Google sign-in or profile response republishes a signed-out or replaced connection. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/55)
- AUTH-003: Malformed session payload is accepted as a valid Drive connection. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/55)
- STORAGE-016: Split student upload accepts unusable parent folder IDs. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/65)
- STORAGE-017: Emergency backup omits pending writing and in-memory photos. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/66)
- STORAGE-018: Safe-mode controls hide failed persistence. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/66)
- STORAGE-019: Cache clearing reports success before or after failed storage deletion. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/66)
- STORAGE-020: Backup controls leave download and synchronous Drive exceptions uncaught. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/66)
- STORAGE-021: Legacy folder rejection strands backup callback and fallback. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-022: Signed-out legacy read never settles its callback. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-023: Legacy read accepts a Google error object as downloaded data. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-024: Failed manual cloud save disables retry after local commit. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-025: Empty upload acknowledgement reports manual save success. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-026: Students folder cache bypasses remote validation and recovery. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-027: Split save accepts completion after account token changes. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-028: Index reload hides service and malformed JSON failures. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-029: Index reload crashes when students is absent or malformed. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-030: Signed-out startup closes the page broadcast channel. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-031: Debug error logger exposes synthetic token text. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-032: XHR folder errors discard Google status and reason. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/67)
- STORAGE-033: IndexedDB operations acknowledge aborted transactions. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/68)
- STORAGE-034: Async portfolio reads hide unavailable primary data. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/68)
- STORAGE-035: Student ID lookup hides unreadable settings. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/68)
- STORAGE-036: Safe mode and disabled flags keep using initialized caches. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/68)
- STORAGE-037: Lazy reads report unavailable cloud and local writing as empty success. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/68)
- STORAGE-038: Split reads accept mismatched student ownership. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/68)
- STORAGE-039: Concurrent async student saves lose a different student update. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/68)
- STORAGE-040: Late timed-out upload advertises Synced while newer writing remains dirty. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/70)
- STORAGE-041: Enter on focused Cancel submits student chooser and text input. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/72)

Measured coverage ingestion remains open. Collection self-checks validate source hashing, uncovered executable positions, first-page execution before navigation and Windows line endings; preparation runs were not ingested as final coverage.

Known limits: multi-key localStorage writes are not crash-atomic. Failed rollback recovery buffers and unuploaded photo bytes can be lost if the tab is forcibly closed. Corrupt protected primary bytes still require recovery. Normal Google signout retains local writing. Split student files are enabled by default; ID mapping, lazy loading, IndexedDB and deletion compaction remain disabled by default and are tested explicitly where relevant. Browser checks use synthetic records and intercepted services, with no real student records, live Drive writes or paid AI checks. LCS comparison still uses quadratic time and memory. Source-specific metric and proposal dispositions are deliberate reviewed choices, not a claim that every scanner metric has disappeared.

Access: editing and HTTPS networking verified at 2026-10-12T05:07:10.042Z. Logs show an app restart resumed this chat using a read-only fallback; the following turn supplied full access. The coordinator did not edit app configuration. The initiating reason for that fallback is unknown; exact evidence is retained in access_events.

Platform restrictions are recorded for the specific affected check. Other authorized work continues without bypassing restrictions.
