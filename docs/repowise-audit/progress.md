# Repowise audit progress

Updated 2026-10-12T08:46:19.254Z; timezone Asia/Bangkok. All662 original IDs retained; 1132 total tracked rows. Original outcomes: {"no_code_change":468,"fixed_and_deployed":79,"fixed_in_draft_pr":115}. Scanner absence does not imply resolution. Historical disposition names remain; publication fields record current live status.

Latest live release: [https://wft.mtomlinson.ca/](https://wft.mtomlinson.ca/), built 2026-10-12T07:30:59Z, commit 94853fd56e6886e16ff992d6e0abd6286e2e7d28. All five shipped files match reviewed Git source byte for byte. Publication history records exact hashes and rollback backup.

Confirmed remaining repairs; one repair chat and repository writer at a time:

No confirmed behavioral repair remains in this queue.

Final validation: pending. Stable-source full validation, measured coverage, individual remaining derived recipes/actions and final refreshed ledger reconciliation.

Remaining ledger obligations: 13.

- 453856bb5736474fa8609c49fa1802a8: refactoring_plan, js/app/10-main-app.js::10-main-app.js -> 14 files; pending.
- d25fe5e4381c4352a9be6d995405e35c: refactoring_plan, js/app/00-storage-sync-patches.js::00-storage-sync-patches.js -> 13 files; pending.
- act_d86f215f2b04492c: action, repository; pending.
- 170d5540d7584774bc349d0ee808e7d5: refactoring_plan, js/app/00-storage-sync-patches.js::00-storage-sync-patches.js -> 15 files; pending.
- a6d0554ffc8a4e80a72bc87de8b96163: refactoring_plan, js/app/00-storage-sync-patches.js::00-storage-sync-patches.js -> 11 files; pending.
- 8f8ce44705aa4797be6c0f8a1dbb8879: refactoring_plan, js/app/00-storage-sync-patches.js::00-storage-sync-patches.js -> 12 files; pending.
- 6263c42b8e084ec1aa8ff5735adf47bd: refactoring_plan, js/app/10-main-app.js::10-main-app.js -> 12 files; pending.
- f75d1840674e42b9857a0d59c449550a: refactoring_plan, js/app/00-storage-sync-patches.js::00-storage-sync-patches.js -> 9 files; pending.
- act_127dc08e1fe29e1c: action, repository; confirmed_awaiting_fix.
- act_c6b02ea32387adb3: action, js/app/00-storage-sync-patches.js; confirmed_awaiting_fix.
- 0b893d150d3e45b7aa5efc437b98528c: refactoring_plan, js/app/10-main-app.js::10-main-app.js -> 13 files; pending.
- 6b43dbeb13f8495fbfbaf326f150ad4b: refactoring_plan, js/app/00-storage-sync-patches.js::00-storage-sync-patches.js -> 10 files; pending.
- 34c3214c754d42bba35e730189729c1f: refactoring_plan, js/app/10-main-app.js::10-main-app.js -> 11 files; pending.

Current indexed source: 7fa3b87a4959f9013391c8d52fcbde4b7722e9b7.

| Surface | Count |
| --- | --- |
| code_health | 629 |
| dead_code | 1 |
| security | 0 |
| refactoring_plans | 152 |
| performance_opportunities | 24 |
| doc_drift | 0 |
| actions | 2 |

No repair chat is writing. The coordinator is reviewing and checkpointing the ledger before the next sequential step.

Reviewed repairs:

- SYNC-001: Older settings/deletion uploads clear newer pending changes. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/41)
- ANALYSIS-001: Async analysis reads changed student and writing at completion. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/42)
- SYNC-002: Pending portfolio push overwrites distinct remote sessions for the same student. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/43)
- STORAGE-001: Failed deletion marker write reports a successful student removal. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/44)
- STORAGE-002: Unreadable existing portfolio is overwritten as an empty portfolio. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/45)
- FEEDBACK-001: Missing scores are described as poor performance. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/57)
- SECURITY-001: Student portfolio HTML export executes untrusted score and photo markup. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/46)
- CLEANUP-001: Remove unshipped helper copies and unused bundled helper islands. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/63)
- PHOTO-001: Delayed crop callback changes another student/photo after cancellation. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/47)
- SYNC-003: Same-image merge overwrites newer photo reference with older metadata. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/49)
- SECURITY-002: Inherited identity keys drop records and mutate shared object properties. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/49)
- ANALYSIS-002: In-flight grade change mixes original assessment metadata with current scoring policy. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/56)
- SETTINGS-001: Failed preference save is acknowledged and schedules sync. [Merged PR — live](https://github.com/thepick/writing-feedback-tool/pull/53)
- ARCHIVE-001: Unused archive-removal helper writes a mismatched legacy session marker. [Draft PR](https://github.com/thepick/writing-feedback-tool/pull/63)
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

Measured coverage ingestion remains open. Collection self-checks validate source hashing, uncovered executable positions, first-page execution before navigation and Windows line endings; preparation runs were not ingested as final coverage.

Known limits: multi-key localStorage writes are not crash-atomic. Failed rollback recovery buffers and unuploaded photo bytes can be lost if the tab is forcibly closed. Corrupt protected primary bytes still require recovery. Normal Google signout retains local writing. Split student files are enabled by default; ID mapping, lazy loading, IndexedDB and deletion compaction remain disabled by default and are tested explicitly where relevant. Browser checks use synthetic records and intercepted services, with no real student records, live Drive writes or paid AI checks. LCS comparison still uses quadratic time and memory. Source-specific metric and proposal dispositions are deliberate reviewed choices, not a claim that every scanner metric has disappeared.

Access: editing and HTTPS networking verified at 2026-10-12T05:07:10.042Z. Logs show an app restart resumed this chat using a read-only fallback; the following turn supplied full access. The coordinator did not edit app configuration. The initiating reason for that fallback is unknown; exact evidence is retained in access_events.

Platform restrictions are recorded for the specific affected check. Other authorized work continues without bypassing restrictions.
