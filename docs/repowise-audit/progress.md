# Repowise audit progress

Updated 2026-10-12T10:35:57.517Z; timezone Asia/Bangkok. All662 original IDs retained; 1139 total tracked rows. Original outcomes: {"no_code_change":468,"fixed_and_deployed":194}. Scanner absence does not imply resolution. Historical disposition names remain; publication fields record current live status.

Storage coverage follow-up: in_progress. Prior audit dispositions remain preserved; these additional paths are being checked in sequential repair chats.

- STORAGE-COVERAGE-001: Split student save, folder lifecycle and index reads — reviewed_awaiting_publication ([PR](https://github.com/thepick/writing-feedback-tool/pull/65)).
- STORAGE-COVERAGE-002: Recovery backup, safe mode and local cache clearing — pending.
- STORAGE-COVERAGE-003: Drive errors, manual save and polling lifecycle — pending.
- STORAGE-COVERAGE-004: Optional cache and async student portfolio paths — pending.
- STORAGE-COVERAGE-005: Remaining storage UI and final measured coverage — pending.

Current follow-up source: a9d42d37afa7b2c2a337f0e20173698c706828b8. fresh final-source coverage pending until stable final phase Coverage numbers from the prior audit below remain historical until replaced by verified final-source evidence.

Latest live release: [https://wft.mtomlinson.ca/](https://wft.mtomlinson.ca/), built 2026-10-12T09:57:20Z, commit 6e2c166a0c41d76d85ebb21db9eb9e950906645b. All five shipped files match reviewed Git source byte for byte. Publication history records exact hashes and rollback backup.

Confirmed remaining repairs; one repair chat and repository writer at a time:

No confirmed behavioral repair remains in this queue.

Final validation: complete. All baseline, manual, new and derived findings individually reviewed; all confirmed repairs deployed; final stable-source suites, honest measured coverage, native migration/lightbox validation, refreshed reconciliation and residual risk dispositions complete.

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
- STORAGE-016: Split student upload accepts unusable parent folder IDs. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/65)

Measured native coverage: 81.51% (8833/10837 executable lines). All49 suites and8 supplemental native cases passed. The exact source hashes, executable locations, exclusions, test provenance and uncovered lines are recorded with the validation report.

| Shipped file | Native coverage |
| --- | --- |
| google-drive-migration.js | 85.93% (116/135) |
| js/app/00-storage-sync-patches.js | 77.88% (3841/4932) |
| js/app/10-main-app.js | 84.46% (4852/5745) |
| js/app/99-lightbox.js | 96% (24/25) |

Storage remains below its historical80% suggestion. The supported folder-migration dialog/copy/corrupt-upload/retry paths now have native evidence; appData recovery still has VM-only evidence. Print popup/chooser, successful split-save wrappers, polling and several service/error paths remain incompletely exercised. These are explicit reviewed residual risks, not a claim that every path is tested.

Known limits: multi-key localStorage writes are not crash-atomic. Failed rollback recovery buffers and unuploaded photo bytes can be lost if the tab is forcibly closed. Corrupt protected primary bytes still require recovery. Normal Google signout retains local writing. Split student files are enabled by default; ID mapping, lazy loading, IndexedDB and deletion compaction remain disabled by default and are tested explicitly where relevant. Browser checks use synthetic records and intercepted services, with no real student records, live Drive writes or paid AI checks. LCS comparison still uses quadratic time and memory. Source-specific metric and proposal dispositions are deliberate reviewed choices, not a claim that every scanner metric has disappeared.

Access: editing and HTTPS networking verified at 2026-10-12T05:07:10.042Z. Logs show an app restart resumed this chat using a read-only fallback; the following turn supplied full access. The coordinator did not edit app configuration. The initiating reason for that fallback is unknown; exact evidence is retained in access_events.

Platform restrictions are recorded for the specific affected check. Other authorized work continues without bypassing restrictions.
