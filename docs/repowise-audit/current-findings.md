# RepoWise findings tracker

Updated 2026-10-16T12:16:44.813204+07:00.

Source: 69a996eb4463d9734030b8439b0d1851776cd86b. Coordinator: 01a13f6f-740b-7b60-8863-d6ca9c58baf0.

One source editor and two parallel read-only reviewers. Test and commit each fix; refresh RepoWise at batch boundaries and run the full gate before merging. Findings are leads, not proven bugs.

## Progress

| Surface | Present observations |
| --- | ---: |
| code_health | 930 |
| security | 29 |
| dead_code | 14 |
| documentation | 0 |
| performance | 30 |

**Current focus:** Reproduce and fix user-facing bugs. The maintenance queue is optional; scanner counts below are not bug counts.

Confirmed unresolved bugs: 1. Application leads awaiting reproduction: 0. Test-oracle leads: 0.


Statuses: {"candidate_needs_regression": 17, "confirmed_repair_candidate": 52, "needs_revalidation": 303, "reviewed_no_change": 599, "unreviewed": 32}.

All tracked rows, including findings absent on the latest scan: {"candidate_needs_regression": 17, "confirmed_repair_candidate": 53, "fixed_verified": 32, "needs_revalidation": 303, "not_detected_unverified": 1, "reviewed_no_change": 605, "unreviewed": 32}.

Findings confirmed cleared: 32. Reviewed no-change outcomes retain their individual rationale; they do not mean scanner clearance.

Behavior repairs with regression evidence: 15.

Supporting refactoring plans: 121; grouped refactoring opportunities: 35.

These plans and opportunities can overlap findings; their counts are not added as distinct bugs.

## Repair chats

- repair-002: Portfolio save preparation - reviewed_complete.
- repair-003: OAuth draft recovery - reviewed_complete.
- history-context-review: Interpret git-only risk signals - reviewed_complete.
- repair-004: Historical security signals - reviewed_complete.
- repair-005: Remove verified unused helpers - reviewed_complete.
- repair-006: Storage failure safeguards - reviewed_complete.
- history-context-review-4c39f16: Revalidate history after cleanup - reviewed_complete.
- history-context-review-1402503: Revalidate history on published main - reviewed_complete.
- repair-007: Preserve student identity metadata on read failure - reviewed_complete.
- history-context-review-abfcec3: Revalidate history after identity repair - reviewed_complete.
- repair-008: Handle failed OAuth URL cleanup - fixed_verified.
- repair-008b: Flatten OAuth cleanup notice sequence - fixed_verified.
- repair-005b: Remove two orphaned token predicates - fixed_verified.
- repair-009: Review remaining failure guards - reviewed_complete.
- repair-010: Review notebook guide validation and assembly - reviewed_complete.
- repair-011: Review preference and portfolio commit safeguards - reviewed_complete.
- repair-012: Review feedback goal and action checklist policy - reviewed_complete.
- repair-013: Preserve settings when renaming students - behavior_fixed_verified.
- repair-014: Correct notebook text dictionary lookups - behavior_fixed_verified.
- repair-015: Keep the word-target control consistent after settings load - behavior_fixed_verified.
- repair-016: Correct first-person checklist contractions - behavior_fixed_verified.
- repair-017: Verify print popup isolation failures - behavior_fixed_verified.
- repair-018: Review test assertions and critical harness warnings - reviewed_complete.
- repair-019: Review production loop and performance warnings - reviewed_complete.
- repair-020: Review recovery guards and coverage gaps - reviewed_complete.
- repair-021: Flatten emergency-backup guards - refactor_fixed_verified.
- repair-021b: Remove obsolete single-file backup test loops - refactor_fixed_verified.
- repair-022: Restore native migration test discovery - test_integration_verified.
- repair-022b: Flatten native migration case flow - refactor_fixed_verified.
- repair-023: Index existing migration recovery copies once - refactor_fixed_verified.
- repair-024: Exercise dialog safe-cancel fallback without a page body - test_integration_verified.
- repair-025: Reuse existing local asset route in six browser harnesses - refactor_fixed_verified.
- repair-027: Read-only upload-and-save-shapes review - reviewed_complete.
- repair-028: Read-only analysis-pipeline-shapes review - reviewed_complete.
- repair-029: Read-only portfolio-normalization-and-index-shapes review - reviewed_complete.
- repair-030: Read-only feedback-language-shapes review - reviewed_complete.
- repair-031: Read-only sync-controller-and-status review - reviewed_complete.
- repair-032: Read-only roster-and-image-ui-lifecycle review - reviewed_complete.
- repair-026: Verify and correct blank-EOF coverage locations - measurement_correction_verified.
- repair-033: settings-auth-drive-boundaries - reviewed_complete.
- repair-034: assessment-parsing-reconciliation - reviewed_complete.
- repair-035: portfolio-session-merge-deletions - reviewed_complete.
- repair-036: deterministic-scoring-language-evidence - reviewed_complete.
- repair-037: Verify route-reuse warning identities and remaining test shapes - reviewed_complete.
- repair-038: Review archive, crop and lightbox boundaries - reviewed_complete.
- repair-039: Protect current writing from stale reassessment confirmation - behavior_fixed_verified.
- repair-040: Independently review reassessment safety contract - baseline_review_complete_awaiting_preview.
- repair-041: Independently review native reassessment regression - baseline_review_complete_awaiting_preview.
- repair-042: Review compact score,token,notice andmeter presentation - read_only_review_complete.
- repair-045: Validate photo reorder indices before changing the queue - behavior_fixed_verified.
- repair-043: Review remaining storage callbacks - read_only_review_complete.
- repair-044: Portfolio rendering and feedback static review - read_only_review_complete.
- repair-046: Open the selected student portfolio from the roster - behavior_fixed_verified.
- repair-047: Review authentication and photo ownership harnesses - read_only_review_complete.
- repair-048: Review preference and Drive lifecycle harnesses - read_only_review_complete.
- repair-051: Review compact unit scaffolds and runner fixture I/O - read_only_review_complete.
- repair-052: Review storage integrity, public controls and held-upload harnesses - read_only_review_complete.
- repair-049: Review correction rendering, audit and genre policies - read_only_review_complete.
- repair-050: Review notebook guide and summary policies - read_only_review_complete.
- batch-005-safety-review: Independent batch005 navigation and reorder safety review - read_only_review_complete.
- batch-005-regression-review: Independent batch005 regression-oracle review - read_only_review_complete.
- repair-056: Review archive, startup and CSV security harnesses - read_only_review_complete.
- repair-053: Prepare feedback display regressions and verify producer reachability - read_only_preparation_complete_pending_explicit_release.
- repair-054: Review saved portfolio, index and split-storage native harnesses - read_only_review_complete.
- repair-055: Review analysis, provider admission and feedback native harnesses - read_only_review_complete.
- repair-057: Review remaining deletion, publication and dialog harnesses - read_only_review_complete.
- repair-058: Review remaining media, portfolio and recovery harnesses - read_only_review_complete.
- repair-059: Keep the target-off status when writing matches a disabled target - fixed_verified.
- repair-060: Require literal own evidence tokens in teacher feedback - fixed_verified.
- repair-061: Recognize ordinary Dear Diary writing as a reflection - fixed_verified.
- repair-062: Prevent overlapping image preparations from silently dropping a selection - fixed_verified.
- repair-063: Recover valid later notebook examples after an unusable first candidate - fixed_verified.
- repair-064: Make Grammar calculation explanation agree with the captured grade result - fixed_verified.
- repair-001: Verify security signals - reviewed_complete.
- repair-065-storage-safety-oracles: Prove redirect recovery, cleared pending state, upload execution and commit refresh in native tests - reviewed_focused_tests_passed_pending_batch_validation.
- repair-066-settings-merge: Remove mirrored settings merge copy loops while preserving precedence and credentials - reviewed_focused_tests_passed_pending_batch_validation.
- repair-067-mobile-header: Separate mobile Sign Out and Settings controls and let sync status fit - candidate_tested_reviewed_committed_pending_integration.

## Additional source leads

These are review leads, separate from scanner observations. They require their own verification.

- rename-transient-settings-read: renameStudent in js/app/10-main-app.js — fixed_verified. renameStudent obtains settings from getRawSettings, which returns {} after any read/parse failure, then passes that truthy empty object to saveWftStudentChange. A transient failure limited to that read can end before the transaction preflight and subsequent strict reads. The transaction prefers supplied change.settings and carries only apiKey from the later storedSettings snapshot, so a successful rename could replace other saved preferences/unknown fields/student metadata with the sparse staged object. With the shipped ID-map flag false, metadata can simply be omitted; enabling the flag can instead create replacement metadata. Persistent/corrupt reads are already stopped by later strict checks; the uncovered lead is a one-time failure followed by readable storage.
- notebook-prototype-key-collision: assembleNotebookGuideFromCandidates; shared getNotebookGuideContentWords in js/app/10-main-app.js — fixed_verified. The arbitrary quote-key map seen starts as {} and checks seen[key] before an example is added. A first quote key __proto__ therefore appears previously seen through Object.prototype and is rejected on ordinary required/general passes. Separately, getNotebookGuideContentWords uses a {} stopWords table with !stopWords[word]; the lower-case English word constructor is inherited and silently excluded although it is not in the declared stop-word list. Both are source-supported dictionary membership leads, not reproduced failures in this read-only review.
- preference-null-word-target-toggle: applyWftPreferenceForm in js/app/00-storage-sync-patches.js — fixed_verified. The defaults are overwritten by supplied null values. With useWordCountTarget:null, line6260 deliberately leaves the existing checkbox unchanged, but line6286 disables the numeric field from !settings.useWordCountTarget. If the checkbox is currently true, the UI can therefore retain an enabled target policy while disabling its editable target field. The normal change listener derives disabled state from the actual checkbox instead. Settings root validation does not reject this nullable field, and mergeWftSettings preserves it, so local saved or loaded settings can reach this path. This is source-supported, not reproduced in this read-only review.
- checklist-second-person-contraction: buildNotebookActionChecklist -> extractNotebookActionItems -> compressChecklistItem -> toFirstPersonChecklist in js/app/10-main-app.js — fixed_verified. toFirstPersonChecklist converts the full phrase you are to I am, then replaces remaining whole-word you with I. A valid supplied action beginning with straight- or typographic-apostrophe You are contraction is not handled by the full-phrase rule; the later whole-word replacement can leave the grammatically invalid first-person forms I're or Iâ€™re. Upstream strategy normalization and checklist compression do not normalize those contractions before this helper. This is a source-supported text transformation lead, not an executed or observed student failure.
- migration-recovery-copy-lookup: recoverFolder in google-drive-migration.js — fixed_verified. For every one of N scanned source nodes, copied.filter tests all M previously copied metadata records. Source proves N*M predicate visits, with no node/copy cap. Build a native Map from oauthOriginal to matching copied records once, then use one lookup per node; keep duplicate-match rejection at the same node encounter, preserve first-match order, ignore unrelated duplicate groups exactly as before, and keep parent-before-child writes plus all readback/source guards. This is a CPU/clarity refactor lead, not evidence that the required network calls are redundant and not a measured end-to-end speedup.
- native-coverage-terminal-breakpoint-denominator: native executable-line export in work/do-next-05/export-coverage.cjs — fixed_verified. Exclude only type:return points at column0 on the final empty EOF line from the effective coverage denominator. Full raw native line-set validation and every covered-line check remain enforced. Historical003 control verified; current004capture/import still pending. No scanner clearance claimed.
- review027-manual-save-rejection-status: finishManualSaveToDrive in js/app/00-storage-sync-patches.js — reviewed_no_change. Resolved flush and legacy completion protect a newly staged pending essay before applying old completion UI. The V2 rejection branch checks token only, then applies old failure UI even when new pending writing exists. Current pending data is retained; a misleading retry/status message is a plausible UI issue, not a demonstrated data-loss bug.
- review028-reassessment-confirmation-freshness: reassessPortfolioSession in js/app/10-main-app.js — fixed_verified. The held reassessment regression now covers16 cases/79 check blocks. Old source fails nine cases/27 blocks; the integrated guard preserves changed source/deletion state and newly completed pending writing. Targeted tests pass on the fix; full batch005 gate and publication are still pending.
- review029-invalid-dateiso-display: normalizeWftSessionDate in js/app/00-storage-sync-patches.js — reviewed_no_change. A truthy invalid dateIso is retained because only missing dateIso is filled. With no existing date/displayDate, setDisplayDateFromIso reads an invalid Date with getMonth/getDate/getFullYear; invalid Date getters return NaN rather than throwing, so the catch does not provide a useful display fallback. This is a source-supported malformed display lead, not a reproduced saved-data defect.
- review030-fallback-first-unusable-example: buildFallbackExampleForPriority in js/app/10-main-app.js — fixed_verified. Search branches immediately return the first factory result. The factory may return null or an example whose truncated originalQuote contains an added ellipsis; the caller later rejects that quote as not present in the source. The search then never reaches a later sentence that might yield a valid grounded example. Concrete source-based scenario to test: an over-180-character first sentence eligible for an opener-comma Grammar fallback followed by a short eligible sentence. This is not reproduced and should not be merged with the behavior-preserving branch-coalescence repair.
- review030-diary-letter-precedence: detectWritingGenreInfo in js/app/10-main-app.js — fixed_verified. For ordinary multi-line Dear Diary, followed by reflection prose, hasLetterFeatures can count the salutation as both hasGreeting and directRecipient and meet its two-feature threshold. detectWritingGenreInfo returns Letter/Email before reaching its explicit dear-diary Journal/Reflection rule. The overlap is directly visible in source; intended diary precedence and actual native behavior still need a test. Do not silently alter genre calibration during structural cleanup.
- review032-preview-drop-index-range: bindPreviewReorderHandlers/drop callback in js/app/10-main-app.js — fixed_verified. Five new invalid/stale-index cases fail against the old actual drop handlers, including two expected native TypeErrors. Four added bounds checks reject them before queue/geometry/OCR mutation; all51 crop cases pass on the fix. In-range stale identity remains a separate scope. Full batch005 gate/publication pending.
- review032-overlapping-image-preparation: handleSelectedImages in js/app/10-main-app.js — fixed_verified. Each acquisition captures the entire current image queue before awaiting optimization. Two overlapping camera/upload additions for unchanged owner/text can start from the same context; when one commits its prepared image, the second context becomes stale because images/primaryImage changed, so the second addition silently returns at3312. Camera/upload controls are relabeled but not disabled during preparation, and independent async change handlers are not serialized. This may lose an intended same-owner page addition. Intent and actual native behavior require a held-optimization regression; do not weaken stale-owner protection merely to append everything.
- review034-grammar-band-debug-label: renderScoredAnalysisDebug in js/app/10-main-app.js — fixed_verified. The Grammar band text is hardcoded for a legacy1-7 scale while grammarDensityBand returns4-10 from the selected grade table and strictness. Scores8/9/10 hit the default label18.1-or-higher=1; lower scores map to legacy intervals unrelated to current profile thresholds. formatGrammarCalc renders that label beside the actual final Grammar score. This is a source-supported misleading calculation display, not a reproduced grading-score change. Frozen old/new parity includes the same stale text and cannot establish its correctness.
- review044-roster-portfolio-panel: openStudentPortfolio in js/app/00-storage-sync-patches.js — fixed_verified. Actual roster buttons reproduced hidden/wrong portfolio navigation. The integrated fix preselects the requested student and switches to the portfolio tab; eight new desktop/mobile/optional-control/storage-failure scenarios pass within58 checks. Existing26 checks are preserved. Full batch005 gate/publication pending.
- review044-async-portfolio-stale-owner: renderStudentPortfolio in js/app/00-storage-sync-patches.js — reviewed_no_change. With the optional async path enabled, the completion for captured student A puts A data in _asyncStudentData then recursively renders using the current selector value. If the selector changed to B while A was loading, B can label/action A sessions; a late rejection can also overwrite the current view. There is no selector/generation check before either write. The flag is false by default, so this lead concerns the opt-in path; source supported and not reproduced.
- 047-L1: checkRedirectRecovery in tests/auth-integrity.browser.cjs — fixed_verified. For full/retry/drive-backed,297 checks exactly one intercepted navigation and298 skips the rest of the state oracle. The production redirect guard relies on full recoverability of pending work before leaving the tab. Current assertions do not directly prove those allowed cases stored the draft and complete/recoverable pending content.
- 047-L2: assertRetainedPendingMedia (called by assertPendingMediaScenario) in tests/media-ownership.browser.cjs — fixed_verified. pending-clear invokes clearPendingPortfolioSync before releasing the old upload. The retained-work oracle explicitly skips pending existence at255 for this case but does not require null; it also never checks storedPending. Restoring old pending in memory/storage while keeping portfolio empty and synced false is not rejected by this scenario oracle.
- 049-L1: getEvidenceTokens / commentOverlapsEvidence in js/app/10-main-app.js — fixed_verified. The evidence bag and stop-word set are ordinary objects. commentOverlapsEvidence uses bag[word] without an own-key check, so constructor is truthy through Object.prototype even when no evidence row contains it. The stop-word lookup also suppresses an actual constructor token through inheritance. This can mark an unsupported teacher comment as evidence-supported; no runtime reproduction was performed.
- 049-L2: renderCorrected in js/app/10-main-app.js — reviewed_no_change. For unmarked corrected text with a detected title, buildStoryHtmlWithTitle separates the title into its own span. The later replacement searches for the escaped complete plain title+body string, which is no longer contiguous in storyHtml. The rendered title/body can therefore be returned without the previously built corrected-highlight spans. parseStep1 often supplies already-marked text, so affected production reachability needs confirmation. Existing parity includes a title input but compares the same renderer on both sides; the explicit DOM highlight oracle is untitled.
- 049-L3: getAuditRawRows in js/app/10-main-app.js — reviewed_no_change. Numeric rows call isFinite(Number(value)) before formatting. null, empty string and whitespace coerce to0, unlike addAuditRawRow which deliberately omits null/undefined/empty values. Missing errorDensity, Flow average/varietyScore or Ideas multiplier supplied as null can therefore become a displayed measured zero in the teacher audit. Whether current producers emit each form was not established.
- review050-disabled-target-status-badge: updateMeter wrapper in js/app/10-main-app.js — fixed_verified. getTargetWordCountValue retains a positive configured target even when its checkbox is off. The wrapper first chooses Target off, but the unconditional words===target override at8606 then assigns On target. updateStatusBar publishes that badge to visible #statusBarStatus. Thus an off target with exactly the stored word count appears able to display an enabled-target success message. Original updateMeter returns early for target-off, so its own meter text does not prevent the wrapper override. Source supported only; no application run here.
- 054-L1: photo-conflict-sync checker inside <anonymous@135> in tests/record-identity.browser.cjs — fixed_verified. At 183 the checker validates returned local newer metadata, then loops over uploads without requiring an upload. In the local-newer=true case, local data is already correct and omitting the required cloud push leaves an empty loop that cannot fail. Git7558 syncWftPortfolioIfNeeded:5685-5689 requires a push for pending local content differing from cloud. The cloud-newer case may legitimately need no push, so do not require an upload indiscriminately.
- 057-L1: refresh publication case inside <anonymous@7> in tests/pending-commit-publication.browser.cjs — fixed_verified. The refresh case replaces updateSyncPortfolioButtonState with a throwing callback that increments refreshes at 44, returns refreshes at 52, but no assertion uses it at 59-87. If a change stops invoking that callback, the case can retain correct committed data without exercising its named refresh-failure boundary. Current Git7558 clearPendingPortfolioSync does call the callback at 8263; this is a regression-oracle gap, not evidence that the present production path fails.
- manual-mobile-header-overlap: mobile header account/status/action layout in index.html — confirmed_bug_fix_reviewed_pending_publication. Current code reproduced actual SignOut/Settings rectangle overlap in9normal sync geometry states and a blocked real360px SignOutclick. IsolatedCSScandidate passes143geometry states/11nativeactionsequences and111auth+2startup cases before/after; bothindependentreviewsaccepted. Primaryruntimeunchangeduntil007gatefinishes.

## Coverage evidence

92.6% native executable-line coverage from 60 browser suites. 7/8 shipped source files still match that capture. Ingestion: verified_merged_source.

Per-file gaps and excluded reference/mutated contexts are recorded in reviews/batch-006-validation.json. This is line coverage, not branch coverage.


## Complete inventory

The JSON beside this document contains full evidence, scanner metadata, prior-review links and outcomes.

| ID | Severity | Surface | Location | Symbol / marker | Present on latest scan | Status |
| --- | --- | --- | --- | --- | --- | --- |
| code_health:finding_8900a9c008833aefb538 | critical | code_health | js/app/00-storage-sync-patches.js | change_entropy | yes | needs_revalidation |
| code_health:finding_bdb66e3d75f9a2c6eef0 | critical | code_health | js/app/00-storage-sync-patches.js | prior_defect | yes | reviewed_no_change |
| code_health:finding_4ff0c4251265ee529750 | critical | code_health | js/app/00-storage-sync-patches.js:3476 | restoreWftOAuthDraftAfterRedirect / complex_method | yes | reviewed_no_change |
| code_health:finding_ab36eacc023d669202f4 | critical | code_health | js/app/00-storage-sync-patches.js:6255 | applyWftPreferenceForm / complex_method | yes | reviewed_no_change |
| code_health:finding_e877852414106a9c7183 | critical | code_health | js/app/00-storage-sync-patches.js:7695 | saveCurrentSessionToPortfolio / complex_method | yes | reviewed_no_change |
| code_health:finding_4f159d3281c1bca6dd40 | critical | code_health | js/app/00-storage-sync-patches.js:8310 | commitPendingPortfolioReplacement / complex_method | yes | reviewed_no_change |
| code_health:finding_f505e8ce9087ba531b4a | critical | code_health | js/app/10-main-app.js | change_entropy | yes | needs_revalidation |
| code_health:finding_da2a6cf442a22fa0e95f | critical | code_health | js/app/10-main-app.js | prior_defect | yes | reviewed_no_change |
| code_health:finding_58a8b9f1eed6f92f7106 | critical | code_health | js/app/10-main-app.js:3557 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_360e96c0bf7e43661286 | critical | code_health | js/app/10-main-app.js:5914 | getGoalPlan / complex_method | yes | reviewed_no_change |
| code_health:finding_30846f5c87e3f081cd02 | critical | code_health | js/app/10-main-app.js:6292 | buildNotebookGuidePrioritiesFromRawInput / complex_method | yes | reviewed_no_change |
| code_health:finding_0be1d750101405d79892 | critical | code_health | js/app/10-main-app.js:6371 | sanitizeNotebookGuideCandidate / complex_method | yes | reviewed_no_change |
| code_health:finding_462e05bcd837b7e85209 | critical | code_health | js/app/10-main-app.js:6930 | assembleNotebookGuideFromCandidates / complex_method | yes | reviewed_no_change |
| code_health:finding_c9cb059592b435e51d58 | critical | code_health | js/app/10-main-app.js:7136 | buildNotebookReconstructionDataFromSession / complex_method | yes | reviewed_no_change |
| code_health:finding_2f3ed327ca58291a143e | critical | code_health | tests/analysis-identity.browser.cjs:8 | evaluateAnalysisIdentity / large_method | yes | reviewed_no_change |
| code_health:finding_615d19856374d52a4a9b | critical | code_health | tests/archive-integrity.browser.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_b4dbf5c38542dee01117 | critical | code_health | tests/detailed-parser.browser.cjs:172 | checkGrammarCalculation / complex_method | yes | unreviewed |
| code_health:finding_87f04aaa94b52da45bb0 | critical | code_health | tests/google-drive-migration.browser.cjs:17 | migrationRoute / complex_method | yes | reviewed_no_change |
| code_health:finding_1680dfdc2c2903f2af21 | critical | code_health | tests/image-preparation.browser.cjs:7 | <anonymous@7> / complex_method | yes | needs_revalidation |
| code_health:finding_3dffc42c2f6cdecd5764 | critical | code_health | tests/missing-feedback.browser.cjs:8 | <anonymous@8> / complex_method | yes | reviewed_no_change |
| code_health:finding_b3ea0e675e7c1c2fdb28 | critical | code_health | tests/notebook-guidance-repair.browser.cjs:8 | runNotebookGuidanceCases / large_method | yes | needs_revalidation |
| code_health:finding_a001373d7f0bddeeaba0 | critical | code_health | tests/notebook-guidance-repair.browser.cjs:140 | checkLaterFallbackExample / complex_method | yes | unreviewed |
| code_health:finding_886ef320a4749424aed4 | critical | code_health | tests/notebook-print-failure.browser.cjs:4 | <anonymous@4> / complex_method | yes | reviewed_no_change |
| code_health:finding_bdf61850d95084548fb6 | critical | code_health | tests/pending-portfolio.browser.cjs:9 | <anonymous@9> / complex_method | yes | reviewed_no_change |
| code_health:finding_a554608bfccad8663d8b | critical | code_health | tests/portfolio-reassessment.browser.cjs:70 | <anonymous@70> / complex_method | yes | unreviewed |
| code_health:finding_b2de67a26dc3c9307c23 | critical | code_health | tests/portfolio-renderer.browser.cjs:17 | exercise / complex_method | yes | reviewed_no_change |
| code_health:finding_14ac99ade4516a264416 | critical | code_health | tests/recovery-cache.browser.cjs:18 | checkBackupScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_2cc014e33a4adfabcf8e | critical | code_health | tests/student-read-ownership.browser.cjs:7 | <anonymous@7> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_d972d4b21d11f1043309 | critical | code_health | tests/student-read-ownership.browser.cjs:7 | <anonymous@7> / complex_method | yes | reviewed_no_change |
| code_health:finding_c9064893d7223bb4ffd1 | high | code_health | google-drive-migration.js | coverage_gap | no | fixed_verified |
| code_health:finding_2f5974a3771db462a175 | high | code_health | google-drive-migration.js:83 | recoverFolder / complex_method | yes | reviewed_no_change |
| code_health:finding_b820d2d24da772091e34 | high | code_health | js/app/00-storage-sync-patches.js | co_change_scatter | yes | needs_revalidation |
| code_health:finding_9b4aa07ab42ab6350d8c | high | code_health | js/app/00-storage-sync-patches.js:491 | persistApiKeyStorageFromInput / complex_method | yes | reviewed_no_change |
| code_health:finding_bce2bd1af6dae6674398 | high | code_health | js/app/00-storage-sync-patches.js:550 | saveSettingsToLocalStorage / complex_method | yes | reviewed_no_change |
| code_health:finding_eff9d54f723d8d0e218d | high | code_health | js/app/00-storage-sync-patches.js:1256 | normalizeWftSessionDate / complex_method | yes | reviewed_no_change |
| code_health:finding_73853e063ab1f2054c82 | high | code_health | js/app/00-storage-sync-patches.js:1579 | buildPortfolioIndexFromPortfolio / complex_method | yes | reviewed_no_change |
| code_health:finding_d0ca54c8b8826e302a40 | high | code_health | js/app/00-storage-sync-patches.js:1823 | refreshStorageHealthUI / complex_method | yes | reviewed_no_change |
| code_health:finding_ba1ecff48ab5d7bc7fe4 | high | code_health | js/app/00-storage-sync-patches.js:1823 | refreshStorageHealthUI / bumpy_road | yes | reviewed_no_change |
| code_health:finding_e07c780e97aad39804ee | high | code_health | js/app/00-storage-sync-patches.js:2326 | ensureStudentRecordsForRoster / complex_method | yes | reviewed_no_change |
| code_health:finding_f6e9e73c6aeca2e2f8a4 | high | code_health | js/app/00-storage-sync-patches.js:2644 | mergeStudentPortfolioFiles / complex_method | yes | reviewed_no_change |
| code_health:finding_bec451339b56de3055de | high | code_health | js/app/00-storage-sync-patches.js:2689 | getWftDeletionRecords / complex_method | yes | reviewed_no_change |
| code_health:finding_c5754b3008cce04a947d | high | code_health | js/app/00-storage-sync-patches.js:2712 | isStudentSessionDeleted / complex_method | yes | reviewed_no_change |
| code_health:finding_327ffe7802bf5064d920 | high | code_health | js/app/00-storage-sync-patches.js:2799 | rebuildIndexFromStudentFiles / complex_method | yes | candidate_needs_regression |
| code_health:finding_8daa013c7519c2c2d6a5 | high | code_health | js/app/00-storage-sync-patches.js:2953 | redactWftSyncLogValue / complex_method | yes | reviewed_no_change |
| code_health:finding_d3148a775cf7154fe106 | high | code_health | js/app/00-storage-sync-patches.js:4083 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_d00b9d5502398c47c254 | high | code_health | js/app/00-storage-sync-patches.js:4209 | ensureDriveFolderPromise / brain_method | yes | reviewed_no_change |
| code_health:finding_cb937b1294bc411abc3f | high | code_health | js/app/00-storage-sync-patches.js:4459 | getLocalSettingsSnapshot / complex_method | yes | reviewed_no_change |
| code_health:finding_b7d345bc52fe3457ba20 | high | code_health | js/app/00-storage-sync-patches.js:4735 | saveWftStudentChange / complex_method | yes | reviewed_no_change |
| code_health:finding_0438f4d267deb61d65f1 | high | code_health | js/app/00-storage-sync-patches.js:4735 | saveWftStudentChange / bumpy_road | yes | reviewed_no_change |
| code_health:finding_57bf7e0e594ad2aeb062 | high | code_health | js/app/00-storage-sync-patches.js:4812 | applyDeletionsToPortfolio / complex_method | yes | reviewed_no_change |
| code_health:finding_ea31773c37d0074f31d2 | high | code_health | js/app/00-storage-sync-patches.js:5035 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_4db26584b9741348c94f | high | code_health | js/app/00-storage-sync-patches.js:5226 | mergeWftSettings / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_02c704b94cb1a85a55ef | high | code_health | js/app/00-storage-sync-patches.js:5469 | addImage / complex_method | yes | reviewed_no_change |
| code_health:finding_cbe86c69e41718143128 | high | code_health | js/app/00-storage-sync-patches.js:5520 | mergeWftPortfolios / complex_method | yes | reviewed_no_change |
| code_health:finding_c3f2f127bb0b956fafd1 | high | code_health | js/app/00-storage-sync-patches.js:5728 | handleWftSyncError / complex_method | yes | reviewed_no_change |
| code_health:finding_8439ac91fb299207a6e9 | high | code_health | js/app/00-storage-sync-patches.js:5767 | syncWftNow / brain_method | yes | reviewed_no_change |
| code_health:finding_ead34325951527c35fd0 | high | code_health | js/app/00-storage-sync-patches.js:5767 | syncWftNow / complex_method | yes | reviewed_no_change |
| code_health:finding_ab0a8010627d9e203fec | high | code_health | js/app/00-storage-sync-patches.js:5906 | getWftSyncDiagnostics / complex_method | yes | reviewed_no_change |
| code_health:finding_193eef374799108f654b | high | code_health | js/app/00-storage-sync-patches.js:5937 | shouldPollWftCloudNow / complex_method | yes | reviewed_no_change |
| code_health:finding_316c9c90c39eb353ff7e | high | code_health | js/app/00-storage-sync-patches.js:6458 | savePortfolioData / complex_method | yes | reviewed_no_change |
| code_health:finding_d2e17a6f2a3c946cdf22 | high | code_health | js/app/00-storage-sync-patches.js:6751 | buildPortfolioDetailedFeedback / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_5b685ceb1955a261c1eb | high | code_health | js/app/00-storage-sync-patches.js:6776 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_92d392954c103b46d657 | high | code_health | js/app/00-storage-sync-patches.js:6811 | saveStudentSession / complex_method | yes | reviewed_no_change |
| code_health:finding_28e616ea3e52a8bb7d01 | high | code_health | js/app/00-storage-sync-patches.js:6968 | uploadSessionImagesToDrive / brain_method | yes | reviewed_no_change |
| code_health:finding_302dbc0b60d9c7879a9d | high | code_health | js/app/00-storage-sync-patches.js:6968 | uploadSessionImagesToDrive / large_method | yes | reviewed_no_change |
| code_health:finding_e96067246b2b35f12f3f | high | code_health | js/app/00-storage-sync-patches.js:7019 | nextUpload / brain_method | yes | reviewed_no_change |
| code_health:finding_208c5411ec68f45b4ab0 | high | code_health | js/app/00-storage-sync-patches.js:7019 | nextUpload / complex_method | yes | candidate_needs_regression |
| code_health:finding_73bec908e177949698d7 | high | code_health | js/app/00-storage-sync-patches.js:7068 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_c7032b60a83d25295aed | high | code_health | js/app/00-storage-sync-patches.js:7340 | renderPortfolioGrowGoalBlock / complex_method | yes | reviewed_no_change |
| code_health:finding_1582cf75d826c8ccf5f4 | high | code_health | js/app/00-storage-sync-patches.js:7615 | renderStudentPortfolio / brain_method | yes | needs_revalidation |
| code_health:finding_419468d595b912adfb7d | high | code_health | js/app/00-storage-sync-patches.js:8267 | updateSyncPortfolioButtonState / complex_method | yes | candidate_needs_regression |
| code_health:finding_96179f2cb386a54e873f | high | code_health | js/app/00-storage-sync-patches.js:8345 | commitPendingPortfolioSync / complex_method | yes | reviewed_no_change |
| code_health:finding_2ddd6e095fd9837509d1 | high | code_health | js/app/10-main-app.js | co_change_scatter | yes | needs_revalidation |
| code_health:finding_f1a85ebe6badc0db9024 | high | code_health | js/app/10-main-app.js:333 | renameStudent / brain_method | yes | reviewed_no_change |
| code_health:finding_0e39cb918814ab53819c | high | code_health | js/app/10-main-app.js:333 | renameStudent / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_31c686c7b1d48ddf441b | high | code_health | js/app/10-main-app.js:922 | getSampleStatusData / complex_method | yes | needs_revalidation |
| code_health:finding_1cec729b60c0910038a8 | high | code_health | js/app/10-main-app.js:1019 | <anonymous> / complex_method | yes | needs_revalidation |
| code_health:finding_145a0781f727e8563613 | high | code_health | js/app/10-main-app.js:1112 | updateScoreDisplay / complex_method | yes | needs_revalidation |
| code_health:finding_a6967871bb410dcb0e40 | high | code_health | js/app/10-main-app.js:1311 | tokenNeedsLeadingSpace / complex_method | yes | needs_revalidation |
| code_health:finding_188a9a7004d426cc48df | high | code_health | js/app/10-main-app.js:1439 | analyzeSentenceVariety / brain_method | yes | needs_revalidation |
| code_health:finding_5bf728a3e3dc8811e436 | high | code_health | js/app/10-main-app.js:1439 | analyzeSentenceVariety / complex_method | yes | needs_revalidation |
| code_health:finding_ee1a994e15011c910493 | high | code_health | js/app/10-main-app.js:1605 | calculateWordCountAdjustment / complex_method | yes | needs_revalidation |
| code_health:finding_da71eb8351ac6076820a | high | code_health | js/app/10-main-app.js:1696 | teacherizeWording / complex_method | yes | needs_revalidation |
| code_health:finding_7b8b4488e4ea626cee14 | high | code_health | js/app/10-main-app.js:1810 | getDiffOperations / complex_method | yes | needs_revalidation |
| code_health:finding_da709d52b659e28345f7 | high | code_health | js/app/10-main-app.js:1933 | buildFlowReasonFromData / complex_method | yes | needs_revalidation |
| code_health:finding_b081ee300825a09eabdc | high | code_health | js/app/10-main-app.js:1978 | buildFlowEvidenceFromData / complex_method | yes | needs_revalidation |
| code_health:finding_0ea916c0ea8d320c671f | high | code_health | js/app/10-main-app.js:2021 | buildGrammarPatternNotes / complex_method | yes | needs_revalidation |
| code_health:finding_aab0b3084854dc5c7686 | high | code_health | js/app/10-main-app.js:2050 | normalizeNoticeRows / complex_method | yes | needs_revalidation |
| code_health:finding_388712b85a162a306869 | high | code_health | js/app/10-main-app.js:2065 | polishFeedback / complex_method | yes | needs_revalidation |
| code_health:finding_b5d8eafd6a4bd0367d8d | high | code_health | js/app/10-main-app.js:2065 | polishFeedback / bumpy_road | yes | needs_revalidation |
| code_health:finding_8a378ce2e4aa25c3c760 | high | code_health | js/app/10-main-app.js:2258 | parseDetailedAssessment / large_method | yes | needs_revalidation |
| code_health:finding_c646e256c7bae6ac93e0 | high | code_health | js/app/10-main-app.js:2412 | applyWordCountToIdeas / complex_method | yes | needs_revalidation |
| code_health:finding_831b9c9992d43fcc64c9 | high | code_health | js/app/10-main-app.js:2558 | buildFlowPatternSummary / complex_method | yes | needs_revalidation |
| code_health:finding_e9fabed7ada8fc27ebc3 | high | code_health | js/app/10-main-app.js:2578 | buildFlowPatternNotes / complex_method | yes | needs_revalidation |
| code_health:finding_935cafeb9b03bf1e6d7e | high | code_health | js/app/10-main-app.js:2613 | applyComputedFlowToFlow / complex_method | yes | needs_revalidation |
| code_health:finding_db4e7c9b1ab45d742573 | high | code_health | js/app/10-main-app.js:2754 | requestOpenRouterWithFallback / brain_method | yes | needs_revalidation |
| code_health:finding_accfd50defd9b707a8cb | high | code_health | js/app/10-main-app.js:2754 | requestOpenRouterWithFallback / complex_method | yes | needs_revalidation |
| code_health:finding_3e3fe17b6405143e08e9 | high | code_health | js/app/10-main-app.js:3127 | resetCurrentClassData / complex_method | yes | needs_revalidation |
| code_health:finding_45b725ac14e6b01af784 | high | code_health | js/app/10-main-app.js:3202 | updateSelectedImagePreview / complex_method | yes | needs_revalidation |
| code_health:finding_923f8b26e74d245f0060 | high | code_health | js/app/10-main-app.js:3290 | handleSelectedImages / complex_method | yes | needs_revalidation |
| code_health:finding_e2af21eb0f97cffb7a98 | high | code_health | js/app/10-main-app.js:3435 | bindPreviewReorderHandlers / large_method | yes | needs_revalidation |
| code_health:finding_ad7c01937836a1871672 | high | code_health | js/app/10-main-app.js:3537 | <anonymous> / complex_method | yes | unreviewed |
| code_health:finding_c265a3a523c583f74560 | high | code_health | js/app/10-main-app.js:3686 | <anonymous> / complex_method | yes | needs_revalidation |
| code_health:finding_3ccac7951387eba2bc17 | high | code_health | js/app/10-main-app.js:3906 | buildStep3Prompt / brain_method | yes | needs_revalidation |
| code_health:finding_57b4e6dc07e078be7f9a | high | code_health | js/app/10-main-app.js:3906 | buildStep3Prompt / complex_method | yes | needs_revalidation |
| code_health:finding_e80e6459cb0f8eec82fd | high | code_health | js/app/10-main-app.js:3906 | buildStep3Prompt / large_method | yes | needs_revalidation |
| code_health:finding_c2c09734de489bfe0c43 | high | code_health | js/app/10-main-app.js:3906 | buildStep3Prompt / primitive_obsession | yes | needs_revalidation |
| code_health:finding_8518ceb3be5bf2c125b1 | high | code_health | js/app/10-main-app.js:4248 | buildEvidenceBasedTeacherComment / complex_method | yes | needs_revalidation |
| code_health:finding_1807aa3acdf28aad29d0 | high | code_health | js/app/10-main-app.js:4344 | buildActionGrowthTip / bumpy_road | yes | needs_revalidation |
| code_health:finding_709433cd9c383145550f | high | code_health | js/app/10-main-app.js:4478 | getNeatnessComment / bumpy_road | yes | needs_revalidation |
| code_health:finding_fc2d511f3416246213eb | high | code_health | js/app/10-main-app.js:4665 | renderDetailedAssessment / complex_method | yes | needs_revalidation |
| code_health:finding_d0f1ba0563e806953c38 | high | code_health | js/app/10-main-app.js:4960 | updateMeter / complex_method | yes | needs_revalidation |
| code_health:finding_1c0079bb97b26cbf34ea | high | code_health | js/app/10-main-app.js:5147 | extractWritingTitleParts / complex_method | yes | needs_revalidation |
| code_health:finding_7bac15813de051bb7ed9 | high | code_health | js/app/10-main-app.js:5408 | detectWritingGenreInfo / complex_method | yes | needs_revalidation |
| code_health:finding_6ab2c53b3fdff625ecb9 | high | code_health | js/app/10-main-app.js:5591 | buildEncouragingClosing / complex_method | yes | needs_revalidation |
| code_health:finding_c10a692a806495a7c968 | high | code_health | js/app/10-main-app.js:5711 | pickTeacherComment / complex_method | yes | needs_revalidation |
| code_health:finding_2e009e93a06fee79a31d | high | code_health | js/app/10-main-app.js:5802 | buildNotebookActionChecklist / complex_method | yes | needs_revalidation |
| code_health:finding_c8995c9fef2bc75e5f0b | high | code_health | js/app/10-main-app.js:6710 | buildFallbackExampleForPriority / brain_method | yes | needs_revalidation |
| code_health:finding_d41a46dccd3be770d913 | high | code_health | js/app/10-main-app.js:6710 | buildFallbackExampleForPriority / complex_method | yes | needs_revalidation |
| code_health:finding_e6c13bd33f14c45f3bd2 | high | code_health | js/app/10-main-app.js:6710 | buildFallbackExampleForPriority / large_method | yes | needs_revalidation |
| code_health:finding_72946e150a8efed522fa | high | code_health | js/app/10-main-app.js:6894 | buildNotebookGuideFallback / complex_method | yes | needs_revalidation |
| code_health:finding_2e922e3c247099d7d561 | high | code_health | js/app/10-main-app.js:6930 | assembleNotebookGuideFromCandidates / brain_method | yes | needs_revalidation |
| code_health:finding_a0bc5269056689b0f926 | high | code_health | js/app/10-main-app.js:7105 | ensureNotebookGuide / complex_method | yes | needs_revalidation |
| code_health:finding_388125686d54705ffbee | high | code_health | js/app/10-main-app.js:7168 | fillNotebookSummary / complex_method | yes | needs_revalidation |
| code_health:finding_46523b22d5ed554a99ea | high | code_health | js/app/10-main-app.js:7502 | buildNotebookPrintHtmlFromPortfolioSession / complex_method | yes | needs_revalidation |
| code_health:finding_6abe7cc396ba01536e50 | high | code_health | js/app/10-main-app.js:7649 | reassessPortfolioSession / brain_method | yes | needs_revalidation |
| code_health:finding_cb05a47a890f2d721e5f | high | code_health | js/app/10-main-app.js:7649 | reassessPortfolioSession / complex_method | yes | needs_revalidation |
| code_health:finding_701d382f4514d56049a6 | high | code_health | js/app/10-main-app.js:7649 | reassessPortfolioSession / large_method | yes | needs_revalidation |
| code_health:finding_ed8b27684e0a7efb7dfa | high | code_health | js/app/10-main-app.js:7677 | <anonymous> / complex_conditional | yes | unreviewed |
| code_health:finding_1951a20d00b3e70a4c87 | high | code_health | js/app/10-main-app.js:7756 | <anonymous> / complex_method | yes | unreviewed |
| code_health:finding_0d7c6ff5f039bc409ce8 | high | code_health | js/app/10-main-app.js:8267 | analyzeWriting / complex_method | yes | needs_revalidation |
| code_health:finding_0b15a07e6a17aa631487 | high | code_health | js/app/storage-recovery.js:214 | buildWftEmergencyBackupObject / complex_method | yes | reviewed_no_change |
| code_health:finding_da551e170029b179c512 | high | code_health | scripts/check-test-runner.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_0f637d1b3003eea4a93c | high | code_health | scripts/run-tests.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_85a5756fff7bda0b1490 | high | code_health | tests/analysis-identity.browser.cjs | churn_risk | yes | needs_revalidation |
| code_health:finding_76d928a3e5e7dc43f8da | high | code_health | tests/analysis-pipeline.browser.cjs:23 | exercise / large_method | yes | reviewed_no_change |
| code_health:finding_38aaaf154679c0fea42f | high | code_health | tests/analysis-policy.browser.cjs:18 | runPolicyScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_71b92201355099acf458 | high | code_health | tests/analysis-policy.browser.cjs:18 | runPolicyScenario / large_method | yes | reviewed_no_change |
| code_health:finding_fa6408b6a784d14b37e2 | high | code_health | tests/analysis-policy.browser.cjs:19 | runControlledPolicyAnalysis / complex_method | yes | reviewed_no_change |
| code_health:finding_11afb690652ff9e5bc9f | high | code_health | tests/analysis-policy.browser.cjs:200 | assertRejectedPolicyResult / complex_method | yes | reviewed_no_change |
| code_health:finding_41424acaaa71fa628e81 | high | code_health | tests/archive-connection.browser.cjs:8 | runArchiveConnectionScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_f215a3da5418d44ab994 | high | code_health | tests/archive-connection.browser.cjs:34 | respondToArchiveConnectionRequest / complex_method | yes | reviewed_no_change |
| code_health:finding_42bfe284bb0b87e01389 | high | code_health | tests/archive-integrity.browser.cjs | churn_risk | yes | needs_revalidation |
| code_health:finding_9ed9ee996a2e3ba97e2e | high | code_health | tests/auth-integrity.browser.cjs:82 | checkDraftOccupancy / complex_method | yes | reviewed_no_change |
| code_health:finding_97506bb4c786936411e9 | high | code_health | tests/auth-integrity.browser.cjs:257 | checkRedirectRecovery / complex_method | yes | candidate_needs_regression |
| code_health:finding_873694a833229c403503 | high | code_health | tests/correction-performance.browser.cjs:4 | <anonymous@4> / complex_method | yes | reviewed_no_change |
| code_health:finding_3251f9ac3bc3f1b15073 | high | code_health | tests/crop-ownership.browser.cjs:23 | evaluateCropScenario / complex_method | yes | unreviewed |
| code_health:finding_1fc065ce84d5a0964ae5 | high | code_health | tests/crop-ownership.browser.cjs:23 | evaluateCropScenario / large_method | yes | unreviewed |
| code_health:finding_bc168823d8b8c1bda66c | high | code_health | tests/crop-ownership.browser.cjs:222 | evaluateReorderDrop / complex_method | yes | unreviewed |
| code_health:finding_c67b19acce629039408a | high | code_health | tests/crop-transparency.browser.cjs:6 | <anonymous@6> / complex_method | yes | reviewed_no_change |
| code_health:finding_255499b1e0ee14708a58 | high | code_health | tests/deletion-durability.browser.cjs | churn_risk | yes | needs_revalidation |
| code_health:finding_a50e80e97edcd6e6becf | high | code_health | tests/drive-lifecycle.browser.cjs:137 | runDriveScenario / large_method | yes | candidate_needs_regression |
| code_health:finding_500c4166d1ca157a5541 | high | code_health | tests/drive-lifecycle.browser.cjs:145 | installDriveRoute / complex_method | yes | candidate_needs_regression |
| code_health:finding_e7d9bc21d5bd55cdff4b | high | code_health | tests/drive-lifecycle.browser.cjs:166 | replyToUpload / complex_method | yes | reviewed_no_change |
| code_health:finding_34d155a11ae12094772a | high | code_health | tests/drive-lifecycle.browser.cjs:214 | installDriveRoute / complex_conditional | yes | reviewed_no_change |
| code_health:finding_6e57e46cfd771706f50b | high | code_health | tests/feedback-compatibility.browser.cjs:13 | <anonymous@13> / complex_method | yes | reviewed_no_change |
| code_health:finding_d763af2881aa6ebe85e9 | high | code_health | tests/google-drive-migration.browser.cjs:6 | runNativeMigrationCases / nested_complexity | no | fixed_verified |
| code_health:finding_d4d64fb9c9c0bde5f3cd | high | code_health | tests/image-preparation.browser.cjs:7 | <anonymous@7> / nested_complexity | yes | unreviewed |
| code_health:finding_c12bceffea7618fdd8b8 | high | code_health | tests/image-preparation.browser.cjs:7 | <anonymous@7> / large_method | yes | needs_revalidation |
| code_health:finding_3a510389b4b1a431469d | high | code_health | tests/main-app-health.browser.cjs:102 | checkVisibility / nested_complexity | yes | reviewed_no_change |
| code_health:finding_11a556def902a383e11c | high | code_health | tests/main-app-health.browser.cjs:102 | checkVisibility / complex_method | yes | reviewed_no_change |
| code_health:finding_b1b9f4fbf4ed7111bf83 | high | code_health | tests/media-ownership.browser.cjs:17 | evaluateMediaOwnershipScenario / large_method | yes | reviewed_no_change |
| code_health:finding_6b4d070b6bd4a357369e | high | code_health | tests/media-ownership.browser.cjs:52 | runSavedMediaScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_50998bdcd4425c8109be | high | code_health | tests/media-ownership.browser.cjs:147 | runPhotoScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_22d1f5de4bf7e22b8cca | high | code_health | tests/media-upload-boundary.browser.cjs:12 | exerciseOwnershipBoundary / complex_method | yes | reviewed_no_change |
| code_health:finding_ed57c83e3c13fa85d009 | high | code_health | tests/media-upload-boundary.browser.cjs:46 | changeStoredWriting / complex_method | yes | reviewed_no_change |
| code_health:finding_3d6e5336abe11651954f | high | code_health | tests/missing-feedback.browser.cjs:8 | <anonymous@8> / large_method | yes | reviewed_no_change |
| code_health:finding_243db0fbfb8a96a7c724 | high | code_health | tests/notebook-guide.browser.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_9283e3747b5135c2a7fc | high | code_health | tests/notebook-print-failure.browser.cjs:4 | <anonymous@4> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_41bebd95e154dbeb1101 | high | code_health | tests/openrouter-admission.browser.cjs:14 | runAdmissionScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_f832cc5b27c3d52f19ac | high | code_health | tests/openrouter-admission.browser.cjs:122 | checkDelayedOutcome / complex_method | yes | reviewed_no_change |
| code_health:finding_a9aec3d32ff745fb44e3 | high | code_health | tests/optional-storage.browser.cjs:131 | runLazyPortfolioScenarios / complex_method | yes | reviewed_no_change |
| code_health:finding_a610c7bc1c616cfe053f | high | code_health | tests/optional-storage.browser.cjs:198 | run / complex_method | yes | candidate_needs_regression |
| code_health:finding_ae453a360bd95fa61daa | high | code_health | tests/pending-commit-publication.browser.cjs:7 | <anonymous@7> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_7036a9b6124e67da4c4d | high | code_health | tests/pending-portfolio.browser.cjs:9 | <anonymous@9> / large_method | yes | reviewed_no_change |
| code_health:finding_2ae7b251e6000adae8f6 | high | code_health | tests/portfolio-image-slots.browser.cjs:6 | <anonymous@6> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_a1444930a28a90e830ee | high | code_health | tests/portfolio-index.browser.cjs | churn_risk | yes | needs_revalidation |
| code_health:finding_de2a45ef8496cb5def8b | high | code_health | tests/portfolio-index.browser.cjs:44 | verifyScoreSummaries / complex_method | yes | reviewed_no_change |
| code_health:finding_e2c56e95f50025c0801d | high | code_health | tests/portfolio-index.browser.cjs:104 | verifyRebuiltIdentity / complex_method | yes | reviewed_no_change |
| code_health:finding_85ffbca8e7a0cc8a34fc | high | code_health | tests/portfolio-index.browser.cjs:242 | verifyStorageFailure / complex_method | yes | reviewed_no_change |
| code_health:finding_f053d8396d67490241fb | high | code_health | tests/portfolio-reassessment.browser.cjs:70 | <anonymous@70> / nested_complexity | yes | unreviewed |
| code_health:finding_cfd1ad9b6d28ad62a61b | high | code_health | tests/portfolio-reassessment.browser.cjs:70 | <anonymous@70> / large_method | yes | unreviewed |
| code_health:finding_369be36bd12db4390f78 | high | code_health | tests/portfolio-removal.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_e6aa12e550a273e0c1d0 | high | code_health | tests/portfolio-replacement.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_a740bcc836201e83c5ce | high | code_health | tests/preference-integrity-scenarios.js:131 | checkSuccessfulPreferenceSaves / complex_method | yes | reviewed_no_change |
| code_health:finding_43881671adf95bb4b43c | high | code_health | tests/preference-integrity-scenarios.js:276 | checkCloudSettingsTransport / complex_method | yes | reviewed_no_change |
| code_health:finding_f2a785c9259d4530ddc5 | high | code_health | tests/preference-integrity-scenarios.js:355 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_d71333b5f8e26e1a7718 | high | code_health | tests/preference-integrity-scenarios.js:386 | checkKeyPersistenceAndHandlers / complex_method | yes | reviewed_no_change |
| code_health:finding_541a0914ff6d42267451 | high | code_health | tests/preference-integrity-scenarios.js:444 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_532b474a093fc3ebb820 | high | code_health | tests/preference-integrity-scenarios.js:542 | checkOutgoingCredentialRedaction / complex_method | yes | reviewed_no_change |
| code_health:finding_aa964992afa4814d7c64 | high | code_health | tests/record-identity.browser.cjs:8 | runStudentIdentityCases / large_method | yes | reviewed_no_change |
| code_health:finding_78862c658763199794b0 | high | code_health | tests/record-identity.browser.cjs:135 | <anonymous@135> / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_41d0abbe064ca79a7dcc | high | code_health | tests/recovery-cache.browser.cjs | churn_risk | yes | needs_revalidation |
| code_health:finding_308c12524a7013521290 | high | code_health | tests/recovery-cache.browser.cjs:45 | checkCacheScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_d6d201d5eca456e8aaac | high | code_health | tests/recovery-cache.browser.cjs:102 | runRecoveryScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_fefff15de578d7225bee | high | code_health | tests/recovery-cache.browser.cjs:102 | runRecoveryScenario / large_method | yes | reviewed_no_change |
| code_health:finding_aaf383178b76f56da2be | high | code_health | tests/rename-confirmation.browser.cjs:20 | setupRenameFixture / complex_method | yes | reviewed_no_change |
| code_health:finding_b04caf15b6931492d5ea | high | code_health | tests/rename-confirmation.browser.cjs:123 | assertRenamedData / complex_method | yes | reviewed_no_change |
| code_health:finding_53cd03ddef0fff61c0fa | high | code_health | tests/script-loading.browser.cjs:5 | <anonymous@5> / complex_method | yes | reviewed_no_change |
| code_health:finding_dffe523407bccdaa39b7 | high | code_health | tests/session-retention.browser.cjs:5 | exerciseSessionRetention / large_method | yes | reviewed_no_change |
| code_health:finding_a6e8de9e2a9b5306df36 | high | code_health | tests/session-retention.browser.cjs:63 | checkRetentionModes / complex_method | yes | reviewed_no_change |
| code_health:finding_b732c9ff348ddfb246a2 | high | code_health | tests/storage-held-request.browser.cjs:5 | <anonymous@5> / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_e468e4d675f32bce5d17 | high | code_health | tests/storage-integrity.browser.cjs:124 | runDeletionPolicyCases / complex_method | yes | reviewed_no_change |
| code_health:finding_859af07b8b5b8bc2527d | high | code_health | tests/storage-public-ui.browser.cjs:5 | runStorageScenario / large_method | yes | reviewed_no_change |
| code_health:finding_db0cea056752bd0b5b4c | high | code_health | tests/storage-upload-ownership.browser.cjs:33 | handleServiceRequest / complex_method | yes | candidate_needs_regression |
| code_health:finding_edf631be2ad1ae7ed2d9 | high | code_health | tests/student-rename.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_84eb5d6cbcffb14965cd | medium | code_health | google-drive-migration.js:18 | list / io_in_loop | yes | reviewed_no_change |
| code_health:finding_d1312245e1de5804a1b9 | medium | code_health | google-drive-migration.js:30 | upload / complex_method | yes | reviewed_no_change |
| code_health:finding_d5fa83a509181f5f704e | medium | code_health | google-drive-migration.js:57 | recoverAppData / complex_method | yes | reviewed_no_change |
| code_health:finding_89bf1a01f14a82e136da | medium | code_health | google-drive-migration.js:109 | recoverFolder / io_in_loop | yes | reviewed_no_change |
| code_health:finding_c72146652f87125846f3 | medium | code_health | google-drive-migration.js:117 | recoverFolder / io_in_loop | yes | reviewed_no_change |
| code_health:finding_aec09199a40a7f63d703 | medium | code_health | google-drive-migration.js:118 | recoverFolder / io_in_loop | yes | reviewed_no_change |
| code_health:finding_38e69186fd53b008e2cc | medium | code_health | google-drive-migration.js:132 | ensure / io_in_loop | yes | reviewed_no_change |
| code_health:finding_b4b35b3f12976f4da859 | medium | code_health | js/app/00-storage-sync-patches.js:442 | migrateLegacyApiKeyStorage / complex_method | yes | reviewed_no_change |
| code_health:finding_b8929aea0f5d35e99e78 | medium | code_health | js/app/00-storage-sync-patches.js:443 | copyLegacyApiKey / complex_method | yes | reviewed_no_change |
| code_health:finding_28e9907a3784b89751de | medium | code_health | js/app/00-storage-sync-patches.js:494 | verifyApiKeyStorage / complex_conditional | yes | reviewed_no_change |
| code_health:finding_2d394d4a42f8699016a8 | medium | code_health | js/app/00-storage-sync-patches.js:558 | updateSettingsFromForm / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_086b03609864337ff67d | medium | code_health | js/app/00-storage-sync-patches.js:687 | getWeightDescriptionText / complex_method | yes | reviewed_no_change |
| code_health:finding_e12eb3ad598aa6782566 | medium | code_health | js/app/00-storage-sync-patches.js:1333 | normalizeWftPortfolioForSchemaV1 / nested_complexity | yes | reviewed_no_change |
| code_health:finding_9599830c23cff6c9eeab | medium | code_health | js/app/00-storage-sync-patches.js:1333 | normalizeWftPortfolioForSchemaV1 / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_39ca4412539ee0ed0e83 | medium | code_health | js/app/00-storage-sync-patches.js:1424 | makePortfolioLocalStorageSafe / complex_method | yes | reviewed_no_change |
| code_health:finding_55691a30eadb5aba5f9f | medium | code_health | js/app/00-storage-sync-patches.js:1476 | <anonymous> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_8689bb25c6ac23adebbc | medium | code_health | js/app/00-storage-sync-patches.js:1559 | clearWftPortfolioIndexDirty / complex_method | yes | reviewed_no_change |
| code_health:finding_1395e7bc92e44d166e50 | medium | code_health | js/app/00-storage-sync-patches.js:1579 | buildPortfolioIndexFromPortfolio / nested_complexity | yes | reviewed_no_change |
| code_health:finding_46dab514cb3065e4b42f | medium | code_health | js/app/00-storage-sync-patches.js:1629 | summarizeSessions / complex_method | yes | reviewed_no_change |
| code_health:finding_f2b8ca75bb4ed5364679 | medium | code_health | js/app/00-storage-sync-patches.js:1649 | savePortfolioIndexToDrive / complex_method | yes | reviewed_no_change |
| code_health:finding_0ae3fcd2fb53acfcaad0 | medium | code_health | js/app/00-storage-sync-patches.js:1669 | savePortfolioIndexToDrive / complex_conditional | yes | reviewed_no_change |
| code_health:finding_d3a504b4c70a26a0deb0 | medium | code_health | js/app/00-storage-sync-patches.js:1689 | loadPortfolioIndexFromDrive / complex_method | yes | reviewed_no_change |
| code_health:finding_12a6c35ba840a7b4a46a | medium | code_health | js/app/00-storage-sync-patches.js:1689 | loadPortfolioIndexFromDrive / bumpy_road | yes | reviewed_no_change |
| code_health:finding_8b2aec4428c8aeb31578 | medium | code_health | js/app/00-storage-sync-patches.js:1719 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_1d84979baa4895e8b298 | medium | code_health | js/app/00-storage-sync-patches.js:1749 | assignMissingPortfolioIndexStudentIds / nested_complexity | yes | reviewed_no_change |
| code_health:finding_b68bf41e40df886f4980 | medium | code_health | js/app/00-storage-sync-patches.js:1759 | rebuildPortfolioIndex / complex_method | yes | reviewed_no_change |
| code_health:finding_41f1c98f03d5ab70b068 | medium | code_health | js/app/00-storage-sync-patches.js:1932 | clearWftLocalCache / complex_method | yes | reviewed_no_change |
| code_health:finding_d6fe9a1e2d9c86e011a9 | medium | code_health | js/app/00-storage-sync-patches.js:1989 | <anonymous> / nested_complexity | yes | confirmed_repair_candidate |
| code_health:finding_2063be3138b94708785b | medium | code_health | js/app/00-storage-sync-patches.js:2009 | <anonymous> / nested_complexity | yes | confirmed_repair_candidate |
| code_health:finding_4acf83c3283ca556effe | medium | code_health | js/app/00-storage-sync-patches.js:2302 | getStudentRecordByName / complex_method | yes | reviewed_no_change |
| code_health:finding_0d58c6763761293e9a6e | medium | code_health | js/app/00-storage-sync-patches.js:2326 | ensureStudentRecordsForRoster / nested_complexity | yes | reviewed_no_change |
| code_health:finding_0ff88595b09107caf0b3 | medium | code_health | js/app/00-storage-sync-patches.js:2377 | resolveStudentPortfolioKey / nested_complexity | yes | reviewed_no_change |
| code_health:finding_91f79ffa71c58cd99db3 | medium | code_health | js/app/00-storage-sync-patches.js:2395 | updateStudentRecordOnRename / complex_method | yes | reviewed_no_change |
| code_health:finding_e8fe607851364edb4a90 | medium | code_health | js/app/00-storage-sync-patches.js:2659 | mergeStudentSessions / complex_method | yes | reviewed_no_change |
| code_health:finding_3e59867d333d8fc36c2e | medium | code_health | js/app/00-storage-sync-patches.js:2736 | deletionIsNewer / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_7df1adb8c891ab2a8721 | medium | code_health | js/app/00-storage-sync-patches.js:2860 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_e6a8dcdcd8e8e8e77ae3 | medium | code_health | js/app/00-storage-sync-patches.js:3041 | getWftSyncDebugSnapshot / complex_method | yes | reviewed_no_change |
| code_health:finding_f2f5fc196d1368f6353f | medium | code_health | js/app/00-storage-sync-patches.js:3210 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_f0ffb4d38fa5294004d9 | medium | code_health | js/app/00-storage-sync-patches.js:3255 | completeWftGoogleSignInWithAccessToken / complex_method | yes | reviewed_no_change |
| code_health:finding_fc5abed9bdccdfa7d549 | medium | code_health | js/app/00-storage-sync-patches.js:3326 | clearWftOAuthFragment / nested_complexity | no | fixed_verified |
| code_health:finding_366568245ad14b8654ad | medium | code_health | js/app/00-storage-sync-patches.js:3328 | checkHashForOAuthTokens / nested_complexity | no | fixed_verified |
| code_health:finding_ca1f9972c2cf6daa75a9 | medium | code_health | js/app/00-storage-sync-patches.js:3328 | checkHashForOAuthTokens / complex_method | no | fixed_verified |
| code_health:finding_dc5417fc9d643005862c | medium | code_health | js/app/00-storage-sync-patches.js:3376 | restoreGoogleStateFromStorage / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_d3be814e187dbe8a1464 | medium | code_health | js/app/00-storage-sync-patches.js:3466 | isPreviousDraftCompatible / complex_method | yes | reviewed_no_change |
| code_health:finding_31894d13c79e9cd5f5de | medium | code_health | js/app/00-storage-sync-patches.js:3524 | requestDriveAccess / complex_method | yes | reviewed_no_change |
| code_health:finding_1f4b2c0b0071ee3639a2 | medium | code_health | js/app/00-storage-sync-patches.js:3541 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_0c9b8fe38c8f10880db3 | medium | code_health | js/app/00-storage-sync-patches.js:3588 | showDriveDisconnectedState / complex_method | no | fixed_verified |
| code_health:finding_8c30481081ed05ba172a | medium | code_health | js/app/00-storage-sync-patches.js:3642 | showSignedInState / complex_method | yes | reviewed_no_change |
| code_health:finding_73631653667bec4679f6 | medium | code_health | js/app/00-storage-sync-patches.js:3705 | clearWftLocalStorageAfterSignOut / nested_complexity | yes | reviewed_no_change |
| code_health:finding_dd8fb02464ca2f8542d6 | medium | code_health | js/app/00-storage-sync-patches.js:3705 | clearWftLocalStorageAfterSignOut / complex_method | yes | reviewed_no_change |
| code_health:finding_f5063b8834d488cbffac | medium | code_health | js/app/00-storage-sync-patches.js:3789 | setDriveSyncStatus / complex_method | yes | reviewed_no_change |
| code_health:finding_68f7ee0e0b913e2c6dca | medium | code_health | js/app/00-storage-sync-patches.js:3804 | parseWftGoogleApiErrorText / complex_method | yes | reviewed_no_change |
| code_health:finding_f947131d17a6a38f1ee7 | medium | code_health | js/app/00-storage-sync-patches.js:3841 | wftDriveFetch / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_0968a631eb7c5f5e1d95 | medium | code_health | js/app/00-storage-sync-patches.js:4021 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_463c90fd2de6356ae2db | medium | code_health | js/app/00-storage-sync-patches.js:4194 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_368b80509a8e9d4eae46 | medium | code_health | js/app/00-storage-sync-patches.js:4209 | ensureDriveFolderPromise / complex_method | yes | reviewed_no_change |
| code_health:finding_3c7e058b65c8ca9a24a2 | medium | code_health | js/app/00-storage-sync-patches.js:4342 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_dda353f9f59e6a52421c | medium | code_health | js/app/00-storage-sync-patches.js:4513 | compactDeletions / nested_complexity | yes | reviewed_no_change |
| code_health:finding_5b9479addfbfe7efc78a | medium | code_health | js/app/00-storage-sync-patches.js:4513 | compactDeletions / complex_method | yes | candidate_needs_regression |
| code_health:finding_a5802959d4da1cf79531 | medium | code_health | js/app/00-storage-sync-patches.js:4561 | normalizeDeletionsData / complex_method | yes | reviewed_no_change |
| code_health:finding_4bf6ae89b4dd80f1f147 | medium | code_health | js/app/00-storage-sync-patches.js:4641 | isStudentDeletedByTombstone / complex_method | yes | reviewed_no_change |
| code_health:finding_b1942152e23eceee7be9 | medium | code_health | js/app/00-storage-sync-patches.js:4670 | restoreStudentDeletion / complex_method | yes | reviewed_no_change |
| code_health:finding_2152c2f19d3ffe71e9c4 | medium | code_health | js/app/00-storage-sync-patches.js:4703 | recordSessionDeletion / complex_method | yes | reviewed_no_change |
| code_health:finding_990e0395dd7d82aaac43 | medium | code_health | js/app/00-storage-sync-patches.js:4968 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_95da106900a2c477e281 | medium | code_health | js/app/00-storage-sync-patches.js:5046 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_ca33c20e174a2bfda950 | medium | code_health | js/app/00-storage-sync-patches.js:5058 | uploadWftJsonFilePromise / complex_method | yes | candidate_needs_regression |
| code_health:finding_7cf232b061699f0ff1c4 | medium | code_health | js/app/00-storage-sync-patches.js:5099 | <anonymous> / complex_method | yes | candidate_needs_regression |
| code_health:finding_671540889fa536be2e31 | medium | code_health | js/app/00-storage-sync-patches.js:5192 | mergeWftStudents / complex_method | yes | reviewed_no_change |
| code_health:finding_2ff46a2378726dc81a97 | medium | code_health | js/app/00-storage-sync-patches.js:5322 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_2f138c7deab593679403 | medium | code_health | js/app/00-storage-sync-patches.js:5409 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_ad0ca082ca47da651418 | medium | code_health | js/app/00-storage-sync-patches.js:5461 | mergeSessionImageRefs / complex_method | yes | reviewed_no_change |
| code_health:finding_450dd0c9bb941a47e1a7 | medium | code_health | js/app/00-storage-sync-patches.js:5767 | syncWftNow / large_method | yes | reviewed_no_change |
| code_health:finding_1a34a0bbf46ddefab5e7 | medium | code_health | js/app/00-storage-sync-patches.js:5855 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_d8efee12893b85aa3963 | medium | code_health | js/app/00-storage-sync-patches.js:6293 | applyLoadedSettings / complex_method | yes | reviewed_no_change |
| code_health:finding_750d0054ac70a8565c25 | medium | code_health | js/app/00-storage-sync-patches.js:6358 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_659258563fb64c05b01b | medium | code_health | js/app/00-storage-sync-patches.js:6366 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_9fbb8c985399646392b7 | medium | code_health | js/app/00-storage-sync-patches.js:6414 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_aa72763e7f980e196e85 | medium | code_health | js/app/00-storage-sync-patches.js:6420 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_c07b722b69fa2e172071 | medium | code_health | js/app/00-storage-sync-patches.js:6458 | savePortfolioData / nested_complexity | yes | reviewed_no_change |
| code_health:finding_70c2709f24f09b856658 | medium | code_health | js/app/00-storage-sync-patches.js:6739 | buildSessionFeedbackSummary / complex_method | yes | reviewed_no_change |
| code_health:finding_2d208e4c30ee82fb58d1 | medium | code_health | js/app/00-storage-sync-patches.js:6811 | saveStudentSession / nested_complexity | yes | reviewed_no_change |
| code_health:finding_b772cb0e474a867c6a0b | medium | code_health | js/app/00-storage-sync-patches.js:6811 | saveStudentSession / bumpy_road | yes | reviewed_no_change |
| code_health:finding_c1810fefa912af17bacb | medium | code_health | js/app/00-storage-sync-patches.js:6844 | removeStudentSession / complex_method | yes | reviewed_no_change |
| code_health:finding_c10259400e5c0857bbc5 | medium | code_health | js/app/00-storage-sync-patches.js:6968 | uploadSessionImagesToDrive / complex_method | yes | reviewed_no_change |
| code_health:finding_a1105537f3efefcc76dc | medium | code_health | js/app/00-storage-sync-patches.js:6969 | uploadSessionImagesToDrive / complex_conditional | yes | reviewed_no_change |
| code_health:finding_b355d7e617534febc944 | medium | code_health | js/app/00-storage-sync-patches.js:6998 | findCurrentImage / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_add44f6ffde542978602 | medium | code_health | js/app/00-storage-sync-patches.js:7019 | nextUpload / nested_complexity | yes | reviewed_no_change |
| code_health:finding_b9ce9226d15ad39d7611 | medium | code_health | js/app/00-storage-sync-patches.js:7019 | nextUpload / bumpy_road | yes | reviewed_no_change |
| code_health:finding_db81152159f3182b6759 | medium | code_health | js/app/00-storage-sync-patches.js:7052 | validateCurrentUpload / complex_method | yes | reviewed_no_change |
| code_health:finding_a785a09dfafbeb9573d0 | medium | code_health | js/app/00-storage-sync-patches.js:7068 | <anonymous> / bumpy_road | yes | reviewed_no_change |
| code_health:finding_cecbe8636e3d91233515 | medium | code_health | js/app/00-storage-sync-patches.js:7120 | nextStudent / nested_complexity | yes | confirmed_repair_candidate |
| code_health:finding_aeeba123d237efa7f611 | medium | code_health | js/app/00-storage-sync-patches.js:7168 | openStudentPortfolio / complex_method | yes | needs_revalidation |
| code_health:finding_1eb81af14115d6558a96 | medium | code_health | js/app/00-storage-sync-patches.js:7394 | openPortfolioDetailedFeedback / complex_method | yes | reviewed_no_change |
| code_health:finding_c99e888f784b0bc76750 | medium | code_health | js/app/00-storage-sync-patches.js:7419 | openPortfolioCategoryFeedback / complex_method | yes | reviewed_no_change |
| code_health:finding_2869a3657f251ae42502 | medium | code_health | js/app/00-storage-sync-patches.js:7436 | destroyWftPortfolioCharts / nested_complexity | yes | reviewed_no_change |
| code_health:finding_08148a5fbe3130655bba | medium | code_health | js/app/00-storage-sync-patches.js:7615 | renderStudentPortfolio / complex_method | yes | reviewed_no_change |
| code_health:finding_d4954938b0245dea0b84 | medium | code_health | js/app/00-storage-sync-patches.js:7760 | setSyncButtonsBusy / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_3a1b9b63082ed59d733c | medium | code_health | js/app/00-storage-sync-patches.js:7789 | setSyncButtonsFailure / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_b2a0b905ca7c2f210685 | medium | code_health | js/app/00-storage-sync-patches.js:7815 | pendingPortfolioSessionHasUploadableImages / complex_method | yes | reviewed_no_change |
| code_health:finding_6ab7dd261477cb43f4e7 | medium | code_health | js/app/00-storage-sync-patches.js:7835 | uploadPendingPortfolioMediaBeforeCommit / complex_method | yes | reviewed_no_change |
| code_health:finding_c41bba6fd11258d23e87 | medium | code_health | js/app/00-storage-sync-patches.js:7872 | manualSaveToDrive / large_method | yes | reviewed_no_change |
| code_health:finding_ee563f008ccb5e1394f5 | medium | code_health | js/app/00-storage-sync-patches.js:7907 | finishManualSaveToDrive / brain_method | yes | needs_revalidation |
| code_health:finding_d6815d339003e60e0a6b | medium | code_health | js/app/00-storage-sync-patches.js:7907 | finishManualSaveToDrive / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_7e5e160a165282d1b84f | medium | code_health | js/app/00-storage-sync-patches.js:7951 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_6c622b0a80727a851775 | medium | code_health | js/app/00-storage-sync-patches.js:8047 | showDiffView / complex_method | yes | reviewed_no_change |
| code_health:finding_f6834b9c5e4e8fceaddc | medium | code_health | js/app/10-main-app.js:27 | switchTab / complex_method | yes | reviewed_no_change |
| code_health:finding_55123223b3537cb6beee | medium | code_health | js/app/10-main-app.js:150 | removeStudent / complex_method | yes | reviewed_no_change |
| code_health:finding_10e7dca06a9c039721b2 | medium | code_health | js/app/10-main-app.js:180 | getPreferredStudentForManagement / complex_method | yes | reviewed_no_change |
| code_health:finding_102dbeaf242ff2b1e0f6 | medium | code_health | js/app/10-main-app.js:199 | <anonymous> / large_method | yes | reviewed_no_change |
| code_health:finding_43bbb77b41c8510afc27 | medium | code_health | js/app/10-main-app.js:333 | renameStudent / bumpy_road | yes | reviewed_no_change |
| code_health:finding_6a9480ab8c8e7c4017ef | medium | code_health | js/app/10-main-app.js:634 | mergeObjects / complex_method | yes | needs_revalidation |
| code_health:finding_8b960c3b7bf0dfc662db | medium | code_health | js/app/10-main-app.js:909 | hasCompleteClause / complex_method | yes | needs_revalidation |
| code_health:finding_b37fbb90b7c90f70de7c | medium | code_health | js/app/10-main-app.js:942 | getSampleStatusData / complex_conditional | yes | needs_revalidation |
| code_health:finding_add1570706440ac5d6c3 | medium | code_health | js/app/10-main-app.js:986 | buildLowSampleAnalysis / brain_method | yes | needs_revalidation |
| code_health:finding_cb53739209c1f71bdb7a | medium | code_health | js/app/10-main-app.js:986 | buildLowSampleAnalysis / complex_method | yes | needs_revalidation |
| code_health:finding_91b9a8251ba0cff648ab | medium | code_health | js/app/10-main-app.js:1284 | buildMinimalCorrectionMarkup / complex_method | yes | needs_revalidation |
| code_health:finding_71b8c35d5c1cce2bdb4e | medium | code_health | js/app/10-main-app.js:1324 | renderCorrected / complex_method | yes | needs_revalidation |
| code_health:finding_ebb204a5868a15946e25 | medium | code_health | js/app/10-main-app.js:1404 | analyzeSentenceStarters / complex_method | yes | needs_revalidation |
| code_health:finding_2bdd007e9f7d0211503b | medium | code_health | js/app/10-main-app.js:1439 | analyzeSentenceVariety / large_method | yes | needs_revalidation |
| code_health:finding_d8b64c85428c74a85bc3 | medium | code_health | js/app/10-main-app.js:1565 | buildComputedFlowTip / complex_method | yes | needs_revalidation |
| code_health:finding_9652bf583d3a536c3ce6 | medium | code_health | js/app/10-main-app.js:1643 | grammarDensityBand / complex_method | yes | needs_revalidation |
| code_health:finding_c77269488091be9c398f | medium | code_health | js/app/10-main-app.js:1658 | computeOverallScore / complex_method | yes | needs_revalidation |
| code_health:finding_093a5b89338891a83bb9 | medium | code_health | js/app/10-main-app.js:1731 | teacherizeWording / complex_conditional | yes | needs_revalidation |
| code_health:finding_f940e3f053441fc31563 | medium | code_health | js/app/10-main-app.js:1744 | detectConventionIssues / complex_method | yes | needs_revalidation |
| code_health:finding_8142e2f50ce57c01cca8 | medium | code_health | js/app/10-main-app.js:1777 | buildConventionReason / complex_method | yes | needs_revalidation |
| code_health:finding_e0017e08473e350a01ab | medium | code_health | js/app/10-main-app.js:1847 | analyzeGrammarChanges / complex_method | yes | needs_revalidation |
| code_health:finding_d101f599d7efdce35b73 | medium | code_health | js/app/10-main-app.js:1887 | buildGrammarReasonFromData / complex_method | yes | needs_revalidation |
| code_health:finding_612b7a712640a912fac4 | medium | code_health | js/app/10-main-app.js:2104 | polishCategoryWording / complex_method | yes | needs_revalidation |
| code_health:finding_c72ee67ef2d568b7cc3b | medium | code_health | js/app/10-main-app.js:2147 | parseStep1 / complex_method | yes | needs_revalidation |
| code_health:finding_2027f723da8a822bca97 | medium | code_health | js/app/10-main-app.js:2237 | parseWhatINoticedRowsFromBody / complex_method | yes | needs_revalidation |
| code_health:finding_61ae3487dee679ba3273 | medium | code_health | js/app/10-main-app.js:2268 | captureCategory / complex_method | yes | needs_revalidation |
| code_health:finding_add6b1fe2e80774a4452 | medium | code_health | js/app/10-main-app.js:2480 | getDominantSentenceBand / complex_method | yes | needs_revalidation |
| code_health:finding_1951be36963b01b65962 | medium | code_health | js/app/10-main-app.js:2496 | flowCommentMentionsFalseShortProblem / complex_method | yes | needs_revalidation |
| code_health:finding_dd31592202f5c0bf9100 | medium | code_health | js/app/10-main-app.js:2513 | buildComputedFlowQuickNote / complex_method | yes | needs_revalidation |
| code_health:finding_69e53eede398fea73a81 | medium | code_health | js/app/10-main-app.js:2535 | buildSentenceLengthQuickNote / complex_method | yes | needs_revalidation |
| code_health:finding_df9b7907f423db937055 | medium | code_health | js/app/10-main-app.js:2717 | parseOpenRouterResponse / complex_method | yes | needs_revalidation |
| code_health:finding_ea199b21114b3bb88a9d | medium | code_health | js/app/10-main-app.js:2789 | checkOpenRouterRetry / complex_method | yes | needs_revalidation |
| code_health:finding_04d3d1b24822e961163f | medium | code_health | js/app/10-main-app.js:2822 | requestOpenRouterWithFallback / io_in_loop | yes | needs_revalidation |
| code_health:finding_e8cc8c120b2d5102edee | medium | code_health | js/app/10-main-app.js:2911 | updateOcrControls / complex_method | yes | needs_revalidation |
| code_health:finding_1f5c8ffa1136e017d383 | medium | code_health | js/app/10-main-app.js:3127 | resetCurrentClassData / bumpy_road | yes | needs_revalidation |
| code_health:finding_212f64bf7e0d299b02c0 | medium | code_health | js/app/10-main-app.js:3347 | getDroppedImageFiles / complex_method | yes | needs_revalidation |
| code_health:finding_fa1d91a12c1ab82ba63e | medium | code_health | js/app/10-main-app.js:3502 | <anonymous> / complex_method | yes | needs_revalidation |
| code_health:finding_fcbf91717c7b0b330799 | medium | code_health | js/app/10-main-app.js:3637 | extractTextFromSelectedImage / brain_method | yes | needs_revalidation |
| code_health:finding_691819b607d0c2ab6370 | medium | code_health | js/app/10-main-app.js:3637 | extractTextFromSelectedImage / complex_method | yes | needs_revalidation |
| code_health:finding_1a5454e6e63026044dbb | medium | code_health | js/app/10-main-app.js:3637 | extractTextFromSelectedImage / large_method | yes | needs_revalidation |
| code_health:finding_355f2c8c145443a2c91f | medium | code_health | js/app/10-main-app.js:3686 | <anonymous> / nested_complexity | yes | needs_revalidation |
| code_health:finding_b069b026d6e2c6735605 | medium | code_health | js/app/10-main-app.js:3751 | getGrammarStrictness / complex_method | yes | needs_revalidation |
| code_health:finding_5d620393555ff50afc4c | medium | code_health | js/app/10-main-app.js:4149 | getEvidenceTokens / complex_method | yes | needs_revalidation |
| code_health:finding_a12d8ec9390f76b1aaad | medium | code_health | js/app/10-main-app.js:4180 | isValidTeacherComment / complex_method | yes | needs_revalidation |
| code_health:finding_5954cec915712fef2661 | medium | code_health | js/app/10-main-app.js:4222 | pickNoticeComment / complex_method | yes | needs_revalidation |
| code_health:finding_5656ce3ea2f986ff0085 | medium | code_health | js/app/10-main-app.js:4308 | isGenericGrowthTip / complex_method | yes | needs_revalidation |
| code_health:finding_ac0528d81066bb73b342 | medium | code_health | js/app/10-main-app.js:4555 | addNoticeRowIfNew / complex_method | yes | needs_revalidation |
| code_health:finding_0ca073a7f0bb73202d1b | medium | code_health | js/app/10-main-app.js:4644 | alignGrammarWordingWithErrorData / complex_method | yes | needs_revalidation |
| code_health:finding_029e6991171b7c743b8d | medium | code_health | js/app/10-main-app.js:4733 | getAuditRawRows / complex_method | yes | needs_revalidation |
| code_health:finding_d97607b9caf7c718fee8 | medium | code_health | js/app/10-main-app.js:4811 | buildAuditValidationRows / complex_method | yes | needs_revalidation |
| code_health:finding_3fe12dd27aa07dcffadb | medium | code_health | js/app/10-main-app.js:4831 | getAuditBuilderRows / complex_method | yes | needs_revalidation |
| code_health:finding_797243d7fc1eee66e607 | medium | code_health | js/app/10-main-app.js:5077 | formatToken / complex_method | yes | needs_revalidation |
| code_health:finding_30c5b963c3cbba9327b0 | medium | code_health | js/app/10-main-app.js:5120 | isTitleCaseish / complex_method | yes | needs_revalidation |
| code_health:finding_cee752fc5633ce157f49 | medium | code_health | js/app/10-main-app.js:5136 | isLikelyStandaloneTitle / complex_method | yes | needs_revalidation |
| code_health:finding_6cc23b99db537ad525a4 | medium | code_health | js/app/10-main-app.js:5300 | normalizeWritingGenreInfo / complex_method | yes | needs_revalidation |
| code_health:finding_af328843a23eda60d8e8 | medium | code_health | js/app/10-main-app.js:5327 | getWritingGenreInfoFromSession / complex_method | yes | needs_revalidation |
| code_health:finding_be7169774d0b3e171f27 | medium | code_health | js/app/10-main-app.js:5350 | hasLetterFeatures / complex_method | yes | needs_revalidation |
| code_health:finding_108b576ddc9a4fbc4f04 | medium | code_health | js/app/10-main-app.js:5380 | looksLikePoem / complex_method | yes | needs_revalidation |
| code_health:finding_e0ba9c50da01859bca21 | medium | code_health | js/app/10-main-app.js:5511 | sanitizeGenreReferenceInFeedback / complex_method | yes | needs_revalidation |
| code_health:finding_6aa8dd9c0ba6b9ece072 | medium | code_health | js/app/10-main-app.js:5542 | updateGenreReviewBox / complex_method | yes | needs_revalidation |
| code_health:finding_94f366547c7c0bde19f4 | medium | code_health | js/app/10-main-app.js:5765 | extractNotebookActionItems / complex_method | yes | needs_revalidation |
| code_health:finding_7a4eb428dcd144100e52 | medium | code_health | js/app/10-main-app.js:5989 | renderNotebookDetailedAssessment / complex_method | yes | needs_revalidation |
| code_health:finding_63e6a4380bc461fc83e1 | medium | code_health | js/app/10-main-app.js:6071 | normalizeNotebookGuideCategoryName / complex_method | yes | needs_revalidation |
| code_health:finding_e733e20899c9ec8001a8 | medium | code_health | js/app/10-main-app.js:6169 | isGenericNotebookNextTimeExample / complex_method | yes | needs_revalidation |
| code_health:finding_076f946c496a4a85483d | medium | code_health | js/app/10-main-app.js:6272 | getNotebookGuideCategoryFocusSource / complex_method | yes | needs_revalidation |
| code_health:finding_08b13adf7c4b98cebed0 | medium | code_health | js/app/10-main-app.js:6301 | addPriority / complex_method | yes | needs_revalidation |
| code_health:finding_88d56b7b2769df774320 | medium | code_health | js/app/10-main-app.js:6427 | notebookGuideExampleMatchesPriority / complex_method | yes | needs_revalidation |
| code_health:finding_b6db1589f4e852efbdf4 | medium | code_health | js/app/10-main-app.js:6520 | getNotebookGuideRequiredCategories / complex_method | yes | needs_revalidation |
| code_health:finding_f88d29b4ba219e82b036 | medium | code_health | js/app/10-main-app.js:6662 | inferConventionSkill / complex_method | yes | needs_revalidation |
| code_health:finding_1c5b8851a55d1dda3282 | medium | code_health | js/app/10-main-app.js:6853 | addNotebookGuideFallbackExample / complex_method | yes | needs_revalidation |
| code_health:finding_906c639a49387285cfa4 | medium | code_health | js/app/10-main-app.js:6873 | buildNotebookGuideFocusItemsFromExamples / complex_method | yes | needs_revalidation |
| code_health:finding_954463e2c9a968745031 | medium | code_health | js/app/10-main-app.js:6948 | addExample / complex_method | yes | needs_revalidation |
| code_health:finding_864bef6e21e94b0d1bbf | medium | code_health | js/app/10-main-app.js:7053 | renderNotebookGuideExamples / complex_method | yes | needs_revalidation |
| code_health:finding_37b332334d7b4a4edc50 | medium | code_health | js/app/10-main-app.js:7406 | printNotebookSummary / complex_method | yes | needs_revalidation |
| code_health:finding_e890cbbd9e7f4daf0522 | medium | code_health | js/app/10-main-app.js:7464 | renderNotebookDetailedAssessmentFromSavedSession / complex_method | yes | needs_revalidation |
| code_health:finding_b3313ac8bbb7938fdc52 | medium | code_health | js/app/10-main-app.js:7538 | setActiveStudentForPortfolioReassessment / complex_method | yes | needs_revalidation |
| code_health:finding_1cdab62e523ba3c26976 | medium | code_health | js/app/10-main-app.js:7617 | <anonymous> / complex_conditional | yes | needs_revalidation |
| code_health:finding_c27d53fe6a0a339c37c2 | medium | code_health | js/app/10-main-app.js:7620 | <anonymous> / complex_method | yes | needs_revalidation |
| code_health:finding_e9b9e167c0cfe58a5dca | medium | code_health | js/app/10-main-app.js:7649 | reassessPortfolioSession / bumpy_road | yes | unreviewed |
| code_health:finding_fa1b31a336377742bafa | medium | code_health | js/app/10-main-app.js:7673 | <anonymous> / complex_method | yes | needs_revalidation |
| code_health:finding_0f615577a20e82dd9090 | medium | code_health | js/app/10-main-app.js:7838 | syncUiState / complex_method | yes | needs_revalidation |
| code_health:finding_af12c52b65a991a95ba6 | medium | code_health | js/app/10-main-app.js:7894 | applyComputedGrammarAssessment / complex_method | yes | needs_revalidation |
| code_health:finding_766147c5eccb9857e907 | medium | code_health | js/app/10-main-app.js:7894 | applyComputedGrammarAssessment / primitive_obsession | yes | needs_revalidation |
| code_health:finding_b869cb483502e197316b | medium | code_health | js/app/10-main-app.js:7994 | buildAnalysisCategoryScores / complex_method | yes | needs_revalidation |
| code_health:finding_c2c599be4dc619dfd33b | medium | code_health | js/app/10-main-app.js:8015 | reconcileScoredAssessment / primitive_obsession | yes | needs_revalidation |
| code_health:finding_64d289cb54e8a515f0f4 | medium | code_health | js/app/10-main-app.js:8067 | renderScoredAnalysisDebug / complex_method | no | fixed_verified |
| code_health:finding_5d743917e463897a3133 | medium | code_health | js/app/10-main-app.js:8592 | <anonymous> / complex_method | yes | needs_revalidation |
| code_health:finding_4057876aba2cd2a0cf7b | medium | code_health | js/app/99-lightbox.js | coverage_gradient | yes | candidate_needs_regression |
| code_health:finding_5d6d32a8f92f3d71f53b | medium | code_health | js/app/99-lightbox.js:2 | openImageLightbox / complex_method | yes | reviewed_no_change |
| code_health:finding_c4ec7ba6b31459fd0ccb | medium | code_health | js/app/dialogs.js:116 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_bae51d347f9911061cfa | medium | code_health | js/app/dialogs.js:116 | <anonymous> / large_method | yes | reviewed_no_change |
| code_health:finding_ba4c6a8dce8c62086d20 | medium | code_health | js/app/photo-crop.js:10 | openCropModal / complex_method | yes | reviewed_no_change |
| code_health:finding_abdcd845e719ac63843b | medium | code_health | js/app/photo-crop.js:96 | getCropPos / complex_method | yes | reviewed_no_change |
| code_health:finding_d81f99467fdb06a8d36e | medium | code_health | js/app/photo-crop.js:129 | applyCrop / complex_method | yes | reviewed_no_change |
| code_health:finding_becc6cad0dd7863a6b9b | medium | code_health | js/app/portfolio-export.js:119 | appendStructuredFeedback / complex_method | yes | reviewed_no_change |
| code_health:finding_481a4a617b0134a3a219 | medium | code_health | js/app/portfolio-export.js:629 | addImageExport / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_52dd694654409f08a520 | medium | code_health | js/app/storage-recovery.js | change_entropy | yes | needs_revalidation |
| code_health:finding_109a87742e8c5d101e06 | medium | code_health | js/app/storage-recovery.js | co_change_scatter | yes | needs_revalidation |
| code_health:finding_aed41adf814ee93f00d0 | medium | code_health | js/app/storage-recovery.js:160 | validateWftRequiredStorage / complex_method | yes | reviewed_no_change |
| code_health:finding_28ab15e0abd57a32278e | medium | code_health | js/app/storage-recovery.js:214 | buildWftEmergencyBackupObject / nested_complexity | no | fixed_verified |
| code_health:finding_c488fbf48a69c6dcaa4b | medium | code_health | scripts/check-test-runner.cjs | co_change_scatter | yes | needs_revalidation |
| code_health:finding_db029d1060192426b222 | medium | code_health | scripts/check-test-runner.cjs:13 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_b2267d45e0c328b33cd3 | medium | code_health | scripts/run-tests.cjs | co_change_scatter | yes | needs_revalidation |
| code_health:finding_9a7c8ce0699343322ae5 | medium | code_health | test-google-drive-migration.cjs:4 | setup / complex_method | yes | reviewed_no_change |
| code_health:finding_ee98c466e8ec65cd1b44 | medium | code_health | test-google-drive-migration.cjs:11 | fileResponse / complex_method | yes | reviewed_no_change |
| code_health:finding_8c23a5e088578203ac81 | medium | code_health | tests/analysis-identity.browser.cjs | change_entropy | no | reviewed_no_change |
| code_health:finding_e175c7fa27aa56528269 | medium | code_health | tests/analysis-identity.browser.cjs:8 | evaluateAnalysisIdentity / complex_method | yes | reviewed_no_change |
| code_health:finding_2cebaec28f1e3464244b | medium | code_health | tests/analysis-identity.browser.cjs:182 | runInterruptedAnalysisCase / complex_method | yes | reviewed_no_change |
| code_health:finding_a56e02cc5c89d2eb6e9e | medium | code_health | tests/analysis-pipeline.browser.cjs:51 | prepareWriting / complex_method | yes | reviewed_no_change |
| code_health:finding_bfb4902f382649ef8306 | medium | code_health | tests/analysis-pipeline.browser.cjs:66 | prepareImages / complex_method | yes | reviewed_no_change |
| code_health:finding_5e09ee8dca0ad0327ab1 | medium | code_health | tests/analysis-pipeline.browser.cjs:262 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_2a2f19c7aa24339c754c | medium | code_health | tests/analysis-policy.browser.cjs:123 | imageResponse / complex_method | yes | reviewed_no_change |
| code_health:finding_33ae5b7c5ae2fbe3f497 | medium | code_health | tests/analysis-policy.browser.cjs:227 | assertPolicyScores / complex_method | yes | reviewed_no_change |
| code_health:finding_bc05e1f85a0cea31af89 | medium | code_health | tests/analysis-policy.browser.cjs:243 | assertSuccessfulPolicyResult / complex_method | yes | reviewed_no_change |
| code_health:finding_64fc231abf55dad4b2a3 | medium | code_health | tests/analysis-policy.browser.cjs:278 | <anonymous@278> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_38c411f4b93eac2e69b1 | medium | code_health | tests/archive-connection.browser.cjs:76 | checkArchiveConnectionOutcome / complex_method | yes | reviewed_no_change |
| code_health:finding_845a81c24bb25fdf5436 | medium | code_health | tests/archive-failures.browser.cjs:15 | runArchiveScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_02a68868618be3f1e02c | medium | code_health | tests/archive-failures.browser.cjs:38 | archiveFetch / complex_method | yes | reviewed_no_change |
| code_health:finding_a313e6a0b2a02488bdd8 | medium | code_health | tests/archive-failures.browser.cjs:60 | checkFailureBoundary / complex_method | yes | reviewed_no_change |
| code_health:finding_eb23143f973d0b6f92ec | medium | code_health | tests/archive-integrity.browser.cjs:113 | observePhotoExport / complex_method | yes | reviewed_no_change |
| code_health:finding_6d67cb0b1d9803f92f47 | medium | code_health | tests/archive-integrity.browser.cjs:128 | checkPhotoExportSources / complex_method | yes | reviewed_no_change |
| code_health:finding_b6389b9811aeedd4ac00 | medium | code_health | tests/archive-integrity.browser.cjs:140 | observeArchiveChange / complex_method | yes | reviewed_no_change |
| code_health:finding_4fac48e803a52200e11a | medium | code_health | tests/auth-integrity.browser.cjs | churn_risk | yes | reviewed_no_change |
| code_health:finding_07852add7f2c9cf7efbc | medium | code_health | tests/auth-integrity.browser.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_e673407f389e26d90ad5 | medium | code_health | tests/auth-integrity.browser.cjs:47 | checkDraftRestoration / complex_method | yes | reviewed_no_change |
| code_health:finding_d70b311c8cef34ed959d | medium | code_health | tests/auth-integrity.browser.cjs:65 | checkDraftStorageFailures / complex_method | yes | reviewed_no_change |
| code_health:finding_bf74a4880d990f5c83c7 | medium | code_health | tests/auth-integrity.browser.cjs:108 | checkDraftPreservation / complex_method | yes | reviewed_no_change |
| code_health:finding_a4fcf0b1e3303769475c | medium | code_health | tests/auth-integrity.browser.cjs:164 | checkFragmentCleanupFailures / complex_method | yes | reviewed_no_change |
| code_health:finding_73792a574b42e8236c19 | medium | code_health | tests/auth-integrity.browser.cjs:257 | checkRedirectRecovery / nested_complexity | yes | reviewed_no_change |
| code_health:finding_fa1e3f3fce82ffa1cfd4 | medium | code_health | tests/auth-integrity.browser.cjs:323 | checkTokenValidation / complex_method | yes | reviewed_no_change |
| code_health:finding_0870c25d4075e0357488 | medium | code_health | tests/auth-integrity.browser.cjs:339 | checkSignOutRetention / complex_method | yes | reviewed_no_change |
| code_health:finding_a0776e0bdddefccee43d | medium | code_health | tests/auth-integrity.browser.cjs:414 | observeOwnership / complex_method | yes | reviewed_no_change |
| code_health:finding_39972fb07ea171d91fde | medium | code_health | tests/class-deletion.browser.cjs:7 | <anonymous@7> / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_717f58b2083cafd32ed4 | medium | code_health | tests/class-deletion.browser.cjs:7 | <anonymous@7> / large_method | yes | confirmed_repair_candidate |
| code_health:finding_1d843be7f50439511641 | medium | code_health | tests/class-deletion.browser.cjs:44 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_f9f2c6b5c37b83e8d423 | medium | code_health | tests/class-deletion.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_98bad080ba873a305de4 | medium | code_health | tests/class-deletion.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_3515e0fc6ceb77656ea4 | medium | code_health | tests/correction-performance.browser.cjs:4 | <anonymous@4> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_c028bb03063849984a60 | medium | code_health | tests/correction-performance.browser.cjs:4 | <anonymous@4> / large_method | yes | reviewed_no_change |
| code_health:finding_4ac8491954ec6fcd130d | medium | code_health | tests/corrupt-portfolio.browser.cjs:88 | exerciseCloudCorruption / complex_method | yes | reviewed_no_change |
| code_health:finding_c0e356fbf188b37be38c | medium | code_health | tests/corrupt-portfolio.browser.cjs:88 | exerciseCloudCorruption / large_method | yes | reviewed_no_change |
| code_health:finding_7d00cba948ac805a2fb4 | medium | code_health | tests/crop-ownership.browser.cjs:178 | assertCropScenario / complex_method | yes | unreviewed |
| code_health:finding_d938920f457f9eb2d4c7 | medium | code_health | tests/crop-ownership.browser.cjs:207 | <anonymous@207> / nested_complexity | no | not_detected_unverified |
| code_health:finding_497a3e9c6bfe87f7c58e | medium | code_health | tests/crop-ownership.browser.cjs:282 | <anonymous@282> / nested_complexity | yes | unreviewed |
| code_health:finding_88cab154abd2f5be01d7 | medium | code_health | tests/csv-formula.browser.cjs:3 | dry_violation | yes | reviewed_no_change |
| code_health:finding_942b10662480a46ec8a1 | medium | code_health | tests/deletion-merge.browser.cjs:1 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_341a107a9fd3d840b37c | medium | code_health | tests/deletion-recovery.browser.cjs:35 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_887a8ae401645401acd2 | medium | code_health | tests/detailed-parser.browser.cjs:21 | checkCompleteCategories / complex_method | yes | reviewed_no_change |
| code_health:finding_1c0c0ee54d1cd1d54d8b | medium | code_health | tests/detailed-parser.browser.cjs:93 | checkCategoryBounds / complex_method | yes | reviewed_no_change |
| code_health:finding_ecf2fa117e79b21b7feb | medium | code_health | tests/detailed-parser.browser.cjs:123 | checkAnalysisPipeline / complex_method | yes | needs_revalidation |
| code_health:finding_dc51e1fb00f1a85234c3 | medium | code_health | tests/detailed-parser.browser.cjs:123 | checkAnalysisPipeline / large_method | yes | unreviewed |
| code_health:finding_28419b21daeeea84383d | medium | code_health | tests/detailed-parser.browser.cjs:143 | checkAnalysisPersistence / complex_method | yes | reviewed_no_change |
| code_health:finding_0031d0f63452bdba310b | medium | code_health | tests/drive-lifecycle.browser.cjs:35 | checkFetchScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_e98a1eb74db943150fcb | medium | code_health | tests/drive-lifecycle.browser.cjs:129 | checkRetainedState / complex_method | yes | reviewed_no_change |
| code_health:finding_96910a3a1fb70bb0a175 | medium | code_health | tests/drive-lifecycle.browser.cjs:154 | replyToProbe / complex_method | yes | reviewed_no_change |
| code_health:finding_0f425b4b82357b6157a1 | medium | code_health | tests/drive-lifecycle.browser.cjs:194 | replyToFolderMetadata / complex_method | yes | reviewed_no_change |
| code_health:finding_a342a0ef30b71cae9eb3 | medium | code_health | tests/drive-lifecycle.browser.cjs:244 | checkManualScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_998220186c13aa82abd3 | medium | code_health | tests/drive-lifecycle.browser.cjs:261 | checkSplitScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_248573c51c1521f8340e | medium | code_health | tests/drive-lifecycle.browser.cjs:302 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_e26914b4ed0a7d2677ed | medium | code_health | tests/google-drive-migration.browser.cjs:6 | runNativeMigrationCases / complex_method | yes | reviewed_no_change |
| code_health:finding_a5f739ff7b13bd2bccf0 | medium | code_health | tests/main-app-health.browser.cjs:152 | checkEvidenceTokens / complex_method | yes | unreviewed |
| code_health:finding_187baaab1e2d4cce5c76 | medium | code_health | tests/main-app-health.browser.cjs:194 | checkDiaryGenre / nested_complexity | yes | unreviewed |
| code_health:finding_9fb4c1ea2a9ca9ea5ac3 | medium | code_health | tests/main-app-health.browser.cjs:199 | expectGenre / complex_method | yes | unreviewed |
| code_health:finding_d56e623610c171ece3bd | medium | code_health | tests/media-ownership.browser.cjs:97 | runPendingMediaScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_f1363ca369412b5bc505 | medium | code_health | tests/media-ownership.browser.cjs:208 | assertPendingMediaScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_5434c3357e16481b0da7 | medium | code_health | tests/media-ownership.browser.cjs:273 | runMediaOwnershipCase / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_90441d787da9c922c417 | medium | code_health | tests/media-ownership.browser.cjs:307 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_610b93475e328f905a6c | medium | code_health | tests/media-upload-boundary.browser.cjs:81 | assertOwnershipOutcome / complex_method | yes | reviewed_no_change |
| code_health:finding_bb483c9c40cb5b8453ab | medium | code_health | tests/media-upload-boundary.browser.cjs:99 | <anonymous@99> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_c3978aff4543b6851d31 | medium | code_health | tests/media-upload-boundary.browser.cjs:99 | <anonymous@99> / complex_method | yes | reviewed_no_change |
| code_health:finding_039bf6f4e90b92d0d600 | medium | code_health | tests/neatness-boundaries.browser.cjs:1 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_e130e9384515730f3349 | medium | code_health | tests/neatness-boundaries.browser.cjs:4 | <anonymous@4> / complex_method | yes | reviewed_no_change |
| code_health:finding_334957713e49cc25a47b | medium | code_health | tests/neatness-scoring.browser.cjs:1 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_3e06106d467f48269878 | medium | code_health | tests/neatness-scoring.browser.cjs:7 | <anonymous@7> / complex_method | yes | reviewed_no_change |
| code_health:finding_d0678036801b08d91445 | medium | code_health | tests/notebook-guidance-repair.browser.cjs | churn_risk | yes | needs_revalidation |
| code_health:finding_782b98d52eb223e30e23 | medium | code_health | tests/notebook-guidance-repair.browser.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_023e9357755094e56ba3 | medium | code_health | tests/notebook-guidance-repair.browser.cjs:252 | <anonymous@252> / complex_method | no | fixed_verified |
| code_health:finding_86491e87c4892f377fed | medium | code_health | tests/notebook-guide.browser.cjs | prior_defect | yes | reviewed_no_change |
| code_health:finding_ac3dbb7c835d1db56e3a | medium | code_health | tests/openrouter-admission.browser.cjs:14 | runAdmissionScenario / large_method | yes | reviewed_no_change |
| code_health:finding_67ef791c85e9c929ff70 | medium | code_health | tests/openrouter-admission.browser.cjs:66 | configureAdmissionKey / complex_method | yes | reviewed_no_change |
| code_health:finding_89608ebb8544f121b620 | medium | code_health | tests/openrouter-admission.browser.cjs:74 | fetchSyntheticProvider / complex_method | yes | reviewed_no_change |
| code_health:finding_cee983103af818acd1ab | medium | code_health | tests/openrouter-admission.browser.cjs:104 | checkAdmissionOutcome / complex_method | yes | reviewed_no_change |
| code_health:finding_e5b1b00ec32579307428 | medium | code_health | tests/openrouter-failures.browser.cjs:28 | createFailureResponse / complex_method | yes | reviewed_no_change |
| code_health:finding_1d28d7d4d96b11c9fde1 | medium | code_health | tests/openrouter-failures.browser.cjs:41 | checkTerminalFailure / complex_method | yes | reviewed_no_change |
| code_health:finding_e43a7acacea5728367d2 | medium | code_health | tests/openrouter-request.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_cd72665a4e7d4b713d24 | medium | code_health | tests/optional-storage.browser.cjs:5 | runNativeStorageScenarios / complex_method | yes | reviewed_no_change |
| code_health:finding_d3a20ba993962aa7d807 | medium | code_health | tests/optional-storage.browser.cjs:5 | runNativeStorageScenarios / bumpy_road | yes | reviewed_no_change |
| code_health:finding_1532a4324157c282bf5e | medium | code_health | tests/optional-storage.browser.cjs:76 | runAsyncPortfolioScenarios / complex_method | yes | reviewed_no_change |
| code_health:finding_6e1080aa83faa6dfdfaf | medium | code_health | tests/optional-storage.browser.cjs:131 | runLazyPortfolioScenarios / nested_complexity | yes | reviewed_no_change |
| code_health:finding_462dcc351c71e400ee3d | medium | code_health | tests/pending-commit-publication.browser.cjs:7 | <anonymous@7> / complex_method | yes | reviewed_no_change |
| code_health:finding_ec7738b69467039d6bb0 | medium | code_health | tests/pending-portfolio.browser.cjs:9 | <anonymous@9> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_226c16da583bda4e7cca | medium | code_health | tests/pending-portfolio.browser.cjs:98 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_56be0b4f9090fab49615 | medium | code_health | tests/portfolio-html.browser.cjs:155 | setupRosterNavigation / complex_method | yes | unreviewed |
| code_health:finding_9ab410fbc41005bb5256 | medium | code_health | tests/portfolio-html.browser.cjs:205 | checkRosterNavigation / complex_method | yes | unreviewed |
| code_health:finding_d9e3aa8549d422bd8ba6 | medium | code_health | tests/portfolio-image-slots.browser.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_bc14e931dfc214b31489 | medium | code_health | tests/portfolio-image-slots.browser.cjs:6 | <anonymous@6> / complex_method | yes | reviewed_no_change |
| code_health:finding_f6620a424e2963dccb69 | medium | code_health | tests/portfolio-index.browser.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_0f253ac6e38e7de051fd | medium | code_health | tests/portfolio-index.browser.cjs:84 | verifyNativeCommits / complex_method | yes | reviewed_no_change |
| code_health:finding_47518767dfd74fe99a5d | medium | code_health | tests/portfolio-index.browser.cjs:173 | verifyDirtyHintReads / complex_method | yes | reviewed_no_change |
| code_health:finding_a7e57e07b1ce3ae4c3db | medium | code_health | tests/portfolio-index.browser.cjs:196 | verifySnapshotOwnership / complex_method | yes | reviewed_no_change |
| code_health:finding_b037ca650ba9936373c6 | medium | code_health | tests/portfolio-index.browser.cjs:221 | verifyDirectGuardsAndRebuildRetry / complex_method | yes | reviewed_no_change |
| code_health:finding_de10672cfd74b3ab0eb7 | medium | code_health | tests/portfolio-index.browser.cjs:280 | verifyLocalAndIndexedDbCaches / complex_method | yes | reviewed_no_change |
| code_health:finding_48a882cb94eb3a511587 | medium | code_health | tests/portfolio-reassessment.browser.cjs:8 | seed / complex_method | yes | unreviewed |
| code_health:finding_791c108409dace585495 | medium | code_health | tests/portfolio-reassessment.browser.cjs:208 | <anonymous@70> / complex_conditional | yes | unreviewed |
| code_health:finding_fd5616187b5342041dc1 | medium | code_health | tests/portfolio-removal.browser.cjs:1 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_6621240af0e5e4025e77 | medium | code_health | tests/portfolio-render-failures.browser.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_eb2b04694e8a4d4925c6 | medium | code_health | tests/portfolio-render-failures.browser.cjs:5 | <anonymous@5> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_2525154954dd418e946c | medium | code_health | tests/portfolio-renderer.browser.cjs:17 | exercise / large_method | yes | reviewed_no_change |
| code_health:finding_9fbf241d03b2343c1d00 | medium | code_health | tests/portfolio-renderer.browser.cjs:122 | <anonymous@122> / complex_method | no | fixed_verified |
| code_health:finding_921b5f601d9bf89f7151 | medium | code_health | tests/portfolio-replacement.browser.cjs:1 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_68014df55b55b1e6b5c6 | medium | code_health | tests/portfolio-replacement.browser.cjs:7 | <anonymous@7> / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_069f504cc8d1622d62b8 | medium | code_health | tests/portfolio-replacement.browser.cjs:7 | <anonymous@7> / large_method | yes | confirmed_repair_candidate |
| code_health:finding_45452081cff3b65e3631 | medium | code_health | tests/portfolio-replacement.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_85bb94a51527f7c5f1e2 | medium | code_health | tests/portfolio-sync.browser.cjs:125 | preparePortfolioFixtures / complex_method | yes | reviewed_no_change |
| code_health:finding_dd499f31fc7eb92a6266 | medium | code_health | tests/portfolio-sync.browser.cjs:170 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_e3086671fe04a7875905 | medium | code_health | tests/portfolio-sync.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_d0e737c875554facd17c | medium | code_health | tests/preference-integrity-scenarios.js:58 | checkRequiredPreferenceSaves / complex_method | yes | reviewed_no_change |
| code_health:finding_0936878f9d4d502c6b66 | medium | code_health | tests/preference-integrity-scenarios.js:161 | checkMetadataMerge / complex_method | yes | reviewed_no_change |
| code_health:finding_cd2035047a3147bd9357 | medium | code_health | tests/preference-integrity-scenarios.js:175 | checkSettingsApply / complex_method | yes | reviewed_no_change |
| code_health:finding_2444ef38d170f9e459d0 | medium | code_health | tests/preference-integrity-scenarios.js:180 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_069477ffb241b2be8345 | medium | code_health | tests/preference-integrity-scenarios.js:220 | checkNullableWordTarget / complex_method | yes | reviewed_no_change |
| code_health:finding_a0a176f446cbb821d487 | medium | code_health | tests/preference-integrity-scenarios.js:291 | <anonymous> / complex_method | yes | reviewed_no_change |
| code_health:finding_c70d17d30550958c4d95 | medium | code_health | tests/preference-integrity-scenarios.js:360 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_d5756f8057e6210e77d4 | medium | code_health | tests/preference-integrity-scenarios.js:436 | checkKeyRecovery / complex_method | yes | reviewed_no_change |
| code_health:finding_50f759c7ce8caf72ba0f | medium | code_health | tests/preference-integrity-scenarios.js:505 | checkKeyReadsAndRetainedLegacy / complex_method | yes | reviewed_no_change |
| code_health:finding_f91d9ed74c28e5ef0ee7 | medium | code_health | tests/preference-integrity-scenarios.js:548 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_7041aa95c1ab7c98200b | medium | code_health | tests/preference-integrity.browser.cjs:10 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_922daa780754711de593 | medium | code_health | tests/record-identity.browser.cjs:8 | runStudentIdentityCases / complex_method | yes | reviewed_no_change |
| code_health:finding_92d6531aeae640c31cf2 | medium | code_health | tests/recovery-cache.browser.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_a3c658d1d9476710ffd9 | medium | code_health | tests/recovery-cache.browser.cjs:10 | checkBackupCallback / complex_method | yes | reviewed_no_change |
| code_health:finding_14213736db7f2152b9ad | medium | code_health | tests/recovery-cache.browser.cjs:45 | checkCacheScenario / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_1d84136c5f403c3c95a2 | medium | code_health | tests/recovery-cache.browser.cjs:68 | performRecoveryAction / complex_method | yes | reviewed_no_change |
| code_health:finding_d8c235f3f911a0b79d0f | medium | code_health | tests/recovery-cache.browser.cjs:228 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_67e0cd1b6a8c92f79e5c | medium | code_health | tests/rename-confirmation.browser.cjs:91 | exerciseRenameDialogs / complex_method | yes | reviewed_no_change |
| code_health:finding_ca57037d27555320805f | medium | code_health | tests/rename-confirmation.browser.cjs:143 | <anonymous@143> / nested_complexity | yes | confirmed_repair_candidate |
| code_health:finding_5d1eb75cd297ec384b50 | medium | code_health | tests/rename-confirmation.browser.cjs:143 | <anonymous@143> / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_2a1382c40c21517b7c37 | medium | code_health | tests/script-loading.browser.cjs:5 | <anonymous@5> / nested_complexity | yes | reviewed_no_change |
| code_health:finding_9dc817c0443cf17b94cf | medium | code_health | tests/session-retention.browser.cjs:63 | checkRetentionModes / nested_complexity | yes | reviewed_no_change |
| code_health:finding_c23168ca6063f958c85e | medium | code_health | tests/session-retention.browser.cjs:121 | checkPendingFailureRecovery / complex_method | yes | reviewed_no_change |
| code_health:finding_8b18d3effd9cb43c28e2 | medium | code_health | tests/settings-deletions-sync.browser.cjs:51 | runScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_aaf3e41cb85232d6ad7f | medium | code_health | tests/split-storage.browser.cjs:53 | replySearch / complex_method | yes | reviewed_no_change |
| code_health:finding_3aa6fa417f0ed2ab046c | medium | code_health | tests/split-storage.browser.cjs:67 | routeSplitRequest / complex_method | yes | candidate_needs_regression |
| code_health:finding_562114464320b22afa93 | medium | code_health | tests/split-storage.browser.cjs:155 | checkUpload / complex_method | yes | reviewed_no_change |
| code_health:finding_93e4866b7c6511aa7410 | medium | code_health | tests/split-storage.browser.cjs:170 | runScenario / complex_method | yes | reviewed_no_change |
| code_health:finding_b3b1206783e48f8fad98 | medium | code_health | tests/split-storage.browser.cjs:208 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_6f76ca4ed548a3b45a97 | medium | code_health | tests/storage-dialog-keyboard.browser.cjs:66 | runRenameWorkflow / complex_method | yes | reviewed_no_change |
| code_health:finding_16c64c2a184431b16205 | medium | code_health | tests/storage-dialog-keyboard.browser.cjs:105 | runKeyboardScenario / complex_method | yes | confirmed_repair_candidate |
| code_health:finding_accd5aba18f79b2d9999 | medium | code_health | tests/storage-dialog-keyboard.browser.cjs:167 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_bd2f800fbe50490cc6fb | medium | code_health | tests/storage-health.cjs | change_entropy | yes | needs_revalidation |
| code_health:finding_64343803d3bcb7a25471 | medium | code_health | tests/storage-health.cjs:17 | <anonymous@17> / large_method | yes | reviewed_no_change |
| code_health:finding_8af0d42678ef30e65221 | medium | code_health | tests/storage-health.cjs:17 | <anonymous@17> / function_hotspot | yes | reviewed_no_change |
| code_health:finding_e3735602ceb02f6eae10 | medium | code_health | tests/storage-health.cjs:17 | <anonymous@17> / nested_complexity | no | fixed_verified |
| code_health:finding_4b72d43cb1506626012e | medium | code_health | tests/storage-health.cjs:17 | <anonymous@17> / complex_method | no | fixed_verified |
| code_health:finding_bfcf3ebf003b174fd360 | medium | code_health | tests/storage-held-request.browser.cjs:5 | <anonymous@5> / nested_complexity | yes | confirmed_repair_candidate |
| code_health:finding_98485cb8749defada08b | medium | code_health | tests/storage-held-request.browser.cjs:9 | checkHeldRequestInvariants / complex_method | yes | reviewed_no_change |
| code_health:finding_166b844f89a7e3ce09bc | medium | code_health | tests/storage-integrity.browser.cjs:15 | runRequiredCase / complex_method | yes | reviewed_no_change |
| code_health:finding_b59505b3a3453bdfaba9 | medium | code_health | tests/storage-integrity.browser.cjs:68 | runCloudRequiredCases / nested_complexity | yes | reviewed_no_change |
| code_health:finding_4096b367dcecf86feed0 | medium | code_health | tests/storage-integrity.browser.cjs:124 | runDeletionPolicyCases / nested_complexity | yes | reviewed_no_change |
| code_health:finding_efae386de7cfa965585f | medium | code_health | tests/storage-integrity.browser.cjs:185 | runCompactionCases / complex_method | yes | reviewed_no_change |
| code_health:finding_77f3be269471aa661c48 | medium | code_health | tests/storage-public-ui.browser.cjs:13 | routeStorageRequest / complex_method | yes | candidate_needs_regression |
| code_health:finding_1c4203340f5c8a9b5485 | medium | code_health | tests/storage-public-ui.browser.cjs:22 | replyDriveRequest / complex_method | yes | reviewed_no_change |
| code_health:finding_917aab5fd7aed8eed17d | medium | code_health | tests/storage-public-ui.browser.cjs:28 | replyDriveQuery / complex_method | yes | reviewed_no_change |
| code_health:finding_374742b549826bee0456 | medium | code_health | tests/storage-public-ui.browser.cjs:28 | replyDriveQuery / bumpy_road | yes | reviewed_no_change |
| code_health:finding_3111371d66b2ca8235c4 | medium | code_health | tests/storage-public-ui.browser.cjs:41 | checkPortfolioViews / complex_method | yes | reviewed_no_change |
| code_health:finding_1697a4b8d259bb0fd00f | medium | code_health | tests/storage-public-ui.browser.cjs:142 | io_in_loop | yes | reviewed_no_change |
| code_health:finding_230b478afcad973c3531 | medium | code_health | tests/storage-upload-ownership.browser.cjs:26 | <anonymous@26> / complex_method | yes | reviewed_no_change |
| code_health:finding_1a90d8292e073ccf9903 | medium | code_health | tests/storage-upload-ownership.browser.cjs:26 | <anonymous@26> / large_method | yes | reviewed_no_change |
| code_health:finding_5ca6f0b1b222bdb367fd | medium | code_health | tests/storage-upload-ownership.browser.cjs:26 | <anonymous@26> / function_hotspot | yes | reviewed_no_change |
| code_health:finding_d5e98f1e37090946ce89 | medium | code_health | tests/storage-upload-ownership.browser.cjs:48 | replyToReadRequest / complex_method | yes | reviewed_no_change |
| code_health:finding_11407a1d7000887c6dfa | medium | code_health | tests/storage-upload-ownership.browser.cjs:90 | finishSignoutReconnect / complex_method | yes | reviewed_no_change |
| code_health:finding_e983ea11ce3a5dcb7e9c | medium | code_health | tests/student-read-ownership.browser.cjs:21 | <anonymous@7> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_5fbb3828d0e444afeb09 | medium | code_health | tests/student-rename.browser.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_330fa358c73a174eaf04 | medium | code_health | tests/student-rename.browser.cjs:52 | <anonymous@8> / large_assertion_block | yes | reviewed_no_change |
| code_health:finding_e3971bd30d47501900db | medium | code_health | tests/student-rename.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_466fd884621dd6f44353 | medium | code_health | tests/student-selection-storage.browser.cjs:2 | dry_violation | yes | reviewed_no_change |
| code_health:finding_64ff2d358644bea8f3f2 | medium | code_health | tests/support/local-app-route.js:5 | localAppRoute / complex_method | yes | reviewed_no_change |
| code_health:finding_ac236ee8c53f6b06a02a | low | code_health | google-drive-migration.js | coverage_gradient | yes | reviewed_no_change |
| code_health:finding_d79dad53c408f6977aaa | low | code_health | google-drive-migration.js:83 | recoverFolder / bumpy_road | yes | reviewed_no_change |
| code_health:finding_a47a0eb3889a392c07a4 | low | code_health | js/app/00-storage-sync-patches.js | coverage_gradient | yes | unreviewed |
| code_health:finding_50d9e7d39f28106a6a3f | low | code_health | js/app/00-storage-sync-patches.js:583 | saveSettingsToLocalStorage / complex_conditional | yes | reviewed_no_change |
| code_health:finding_b77d5a59154a4da066cc | low | code_health | js/app/00-storage-sync-patches.js:586 | saveSettingsToLocalStorage / complex_conditional | yes | reviewed_no_change |
| code_health:finding_f9de7f79d6d6f74e74ae | low | code_health | js/app/00-storage-sync-patches.js:1115 | isWftLikelyDriveOrSyncError / complex_conditional | yes | reviewed_no_change |
| code_health:finding_9e5285cbf5a78d3654d0 | low | code_health | js/app/00-storage-sync-patches.js:1128 | error_handling | yes | reviewed_no_change |
| code_health:finding_144a97f8282d9b7f029e | low | code_health | js/app/00-storage-sync-patches.js:1256 | normalizeWftSessionDate / bumpy_road | yes | reviewed_no_change |
| code_health:finding_38ba295af9ce6d8d26f1 | low | code_health | js/app/00-storage-sync-patches.js:1356 | error_handling | yes | reviewed_no_change |
| code_health:finding_5b7863fdcbef269b3b17 | low | code_health | js/app/00-storage-sync-patches.js:1579 | buildPortfolioIndexFromPortfolio / large_method | yes | reviewed_no_change |
| code_health:finding_14dbd4d545c3fb9fcfab | low | code_health | js/app/00-storage-sync-patches.js:1605 | error_handling | yes | reviewed_no_change |
| code_health:finding_f06a20d0aff8afc84bef | low | code_health | js/app/00-storage-sync-patches.js:1612 | error_handling | yes | reviewed_no_change |
| code_health:finding_6cc91c4c90a49de2b695 | low | code_health | js/app/00-storage-sync-patches.js:1700 | error_handling | yes | reviewed_no_change |
| code_health:finding_2069a110e097ff0c385c | low | code_health | js/app/00-storage-sync-patches.js:1724 | error_handling | yes | reviewed_no_change |
| code_health:finding_f15f0dc71767cee077c6 | low | code_health | js/app/00-storage-sync-patches.js:1726 | error_handling | yes | reviewed_no_change |
| code_health:finding_380693af42e0fcc5aa4b | low | code_health | js/app/00-storage-sync-patches.js:1754 | error_handling | yes | reviewed_no_change |
| code_health:finding_bc84d26d5eac20ff69b6 | low | code_health | js/app/00-storage-sync-patches.js:1759 | rebuildPortfolioIndex / bumpy_road | yes | reviewed_no_change |
| code_health:finding_334b8bc581310ce17f48 | low | code_health | js/app/00-storage-sync-patches.js:1849 | error_handling | yes | reviewed_no_change |
| code_health:finding_37c2ddecfa1ce89e3871 | low | code_health | js/app/00-storage-sync-patches.js:1897 | error_handling | yes | reviewed_no_change |
| code_health:finding_5e1517d62b1781066e9b | low | code_health | js/app/00-storage-sync-patches.js:2311 | error_handling | yes | reviewed_no_change |
| code_health:finding_73b80266603d7896f995 | low | code_health | js/app/00-storage-sync-patches.js:2322 | error_handling | yes | reviewed_no_change |
| code_health:finding_cfe4655da07db0e031ca | low | code_health | js/app/00-storage-sync-patches.js:2351 | error_handling | yes | reviewed_no_change |
| code_health:finding_a676bd99b260bc23f13f | low | code_health | js/app/00-storage-sync-patches.js:2440 | error_handling | yes | reviewed_no_change |
| code_health:finding_45b70249c4ffc6443fe5 | low | code_health | js/app/00-storage-sync-patches.js:2489 | error_handling | yes | reviewed_no_change |
| code_health:finding_0c4bc10b50af7687ccba | low | code_health | js/app/00-storage-sync-patches.js:2500 | error_handling | yes | reviewed_no_change |
| code_health:finding_38fc04fbc968b93d0391 | low | code_health | js/app/00-storage-sync-patches.js:2504 | error_handling | yes | reviewed_no_change |
| code_health:finding_4a8e629c288c372da189 | low | code_health | js/app/00-storage-sync-patches.js:2511 | error_handling | yes | reviewed_no_change |
| code_health:finding_10f61d35f1aa42a6e1fa | low | code_health | js/app/00-storage-sync-patches.js:2514 | error_handling | yes | reviewed_no_change |
| code_health:finding_db3372678b3e62a8c2c7 | low | code_health | js/app/00-storage-sync-patches.js:2522 | error_handling | yes | reviewed_no_change |
| code_health:finding_eec9e3971aba9df7e472 | low | code_health | js/app/00-storage-sync-patches.js:2527 | error_handling | yes | reviewed_no_change |
| code_health:finding_e128e7f8aa5527a937b4 | low | code_health | js/app/00-storage-sync-patches.js:2597 | error_handling | yes | reviewed_no_change |
| code_health:finding_d6058db028bbc3ef0568 | low | code_health | js/app/00-storage-sync-patches.js:2628 | error_handling | yes | reviewed_no_change |
| code_health:finding_d1472251b3841d77f04e | low | code_health | js/app/00-storage-sync-patches.js:2659 | mergeStudentSessions / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_11fe6a9227d4a69bd361 | low | code_health | js/app/00-storage-sync-patches.js:2712 | isStudentSessionDeleted / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_e8d941d37700f399ba87 | low | code_health | js/app/00-storage-sync-patches.js:2758 | isStudentSessionDeleted / complex_conditional | yes | reviewed_no_change |
| code_health:finding_c9981aa381c390ebb755 | low | code_health | js/app/00-storage-sync-patches.js:2944 | error_handling | yes | reviewed_no_change |
| code_health:finding_eee33d14b85f755b849b | low | code_health | js/app/00-storage-sync-patches.js:3016 | error_handling | yes | reviewed_no_change |
| code_health:finding_e181390bac7f21e963d8 | low | code_health | js/app/00-storage-sync-patches.js:3027 | error_handling | yes | reviewed_no_change |
| code_health:finding_e3efdc4af519461794d0 | low | code_health | js/app/00-storage-sync-patches.js:3038 | error_handling | yes | reviewed_no_change |
| code_health:finding_5bf74f394c8a838a9668 | low | code_health | js/app/00-storage-sync-patches.js:3144 | error_handling | yes | reviewed_no_change |
| code_health:finding_a8fbe9fa3ab024ef52dc | low | code_health | js/app/00-storage-sync-patches.js:3176 | error_handling | yes | reviewed_no_change |
| code_health:finding_316818f9b20b33331b71 | low | code_health | js/app/00-storage-sync-patches.js:3189 | error_handling | yes | reviewed_no_change |
| code_health:finding_44bdc87f8713f0fe0b34 | low | code_health | js/app/00-storage-sync-patches.js:3197 | finishWftGoogleSignInWithAccessToken / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_92281015b6558a25ccf4 | low | code_health | js/app/00-storage-sync-patches.js:3249 | error_handling | yes | reviewed_no_change |
| code_health:finding_879a20d0d0bc9e7a59ac | low | code_health | js/app/00-storage-sync-patches.js:3255 | completeWftGoogleSignInWithAccessToken / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_82a1305c8c6ea7f18054 | low | code_health | js/app/00-storage-sync-patches.js:3268 | error_handling | yes | reviewed_no_change |
| code_health:finding_9b637db612c321b9d935 | low | code_health | js/app/00-storage-sync-patches.js:3278 | error_handling | yes | reviewed_no_change |
| code_health:finding_066e0fdf8ed72188e4bb | low | code_health | js/app/00-storage-sync-patches.js:3326 | clearWftOAuthFragment / bumpy_road | yes | reviewed_no_change |
| code_health:finding_48ecc6ce9ca0e204604a | low | code_health | js/app/00-storage-sync-patches.js:3338 | error_handling | no | fixed_verified |
| code_health:finding_05b33b2d236e13ab956c | low | code_health | js/app/00-storage-sync-patches.js:3348 | error_handling | no | fixed_verified |
| code_health:finding_1eb82956f0c43b5c3eca | low | code_health | js/app/00-storage-sync-patches.js:3497 | error_handling | yes | reviewed_no_change |
| code_health:finding_a8a87935472a58468993 | low | code_health | js/app/00-storage-sync-patches.js:3524 | requestDriveAccess / bumpy_road | yes | reviewed_no_change |
| code_health:finding_3d17096d3720efd5988e | low | code_health | js/app/00-storage-sync-patches.js:3531 | error_handling | yes | reviewed_no_change |
| code_health:finding_c6c437a3f5d906220e7e | low | code_health | js/app/00-storage-sync-patches.js:3613 | error_handling | yes | reviewed_no_change |
| code_health:finding_8f9b29415e86e102be0c | low | code_health | js/app/00-storage-sync-patches.js:3705 | clearWftLocalStorageAfterSignOut / bumpy_road | yes | reviewed_no_change |
| code_health:finding_29a6dc1f54e5f6712827 | low | code_health | js/app/00-storage-sync-patches.js:3745 | error_handling | yes | reviewed_no_change |
| code_health:finding_9b5c010df5cc52cd6ceb | low | code_health | js/app/00-storage-sync-patches.js:3750 | error_handling | yes | reviewed_no_change |
| code_health:finding_ff2fa11f62abe960d003 | low | code_health | js/app/00-storage-sync-patches.js:3775 | error_handling | yes | reviewed_no_change |
| code_health:finding_d5c9f34e1f0076814706 | low | code_health | js/app/00-storage-sync-patches.js:3825 | error_handling | yes | reviewed_no_change |
| code_health:finding_002942509f9f668c5bf1 | low | code_health | js/app/00-storage-sync-patches.js:3924 | error_handling | yes | reviewed_no_change |
| code_health:finding_c8b13530cfcd50f78b70 | low | code_health | js/app/00-storage-sync-patches.js:3958 | error_handling | yes | reviewed_no_change |
| code_health:finding_12c7f03482c92310bf6d | low | code_health | js/app/00-storage-sync-patches.js:3973 | error_handling | yes | reviewed_no_change |
| code_health:finding_e7551d61caac0aa4e1e6 | low | code_health | js/app/00-storage-sync-patches.js:4139 | saveFileToDrive / large_method | yes | reviewed_no_change |
| code_health:finding_a84beffd019dbbae5cda | low | code_health | js/app/00-storage-sync-patches.js:4139 | saveFileToDrive / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_b7be92ac9d86ce17b33e | low | code_health | js/app/00-storage-sync-patches.js:4209 | ensureDriveFolderPromise / large_method | yes | reviewed_no_change |
| code_health:finding_25f9c687f74bb140cca7 | low | code_health | js/app/00-storage-sync-patches.js:4715 | error_handling | yes | reviewed_no_change |
| code_health:finding_a1d3edb67f1235db4b52 | low | code_health | js/app/00-storage-sync-patches.js:5058 | uploadWftJsonFilePromise / large_method | yes | reviewed_no_change |
| code_health:finding_f68f0f8e1f2e30f76ee5 | low | code_health | js/app/00-storage-sync-patches.js:5256 | mergeWftSettings / complex_conditional | yes | reviewed_no_change |
| code_health:finding_dffec2060f1195e595db | low | code_health | js/app/00-storage-sync-patches.js:5273 | syncWftSettingsIfNeeded / large_method | yes | reviewed_no_change |
| code_health:finding_c7eaf07e563a1b77b630 | low | code_health | js/app/00-storage-sync-patches.js:5363 | syncWftDeletionsIfNeeded / large_method | yes | reviewed_no_change |
| code_health:finding_9ae6fddb1587d38c6426 | low | code_health | js/app/00-storage-sync-patches.js:5396 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_83aadb338a812a5c1310 | low | code_health | js/app/00-storage-sync-patches.js:5610 | syncWftPortfolioIfNeeded / large_method | yes | reviewed_no_change |
| code_health:finding_72bb568aecd724a691c3 | low | code_health | js/app/00-storage-sync-patches.js:5754 | handleWftSyncError / complex_conditional | yes | reviewed_no_change |
| code_health:finding_e0eb4bd9894d70ec8a28 | low | code_health | js/app/00-storage-sync-patches.js:5866 | error_handling | yes | reviewed_no_change |
| code_health:finding_567c2c3fe1148fb6204e | low | code_health | js/app/00-storage-sync-patches.js:5934 | error_handling | yes | reviewed_no_change |
| code_health:finding_d523b84a45d044f4c0f5 | low | code_health | js/app/00-storage-sync-patches.js:5981 | saveWftLocalSnapshotsBeforeHide / bumpy_road | yes | reviewed_no_change |
| code_health:finding_40506fc89c1b3ae5d0e0 | low | code_health | js/app/00-storage-sync-patches.js:5998 | error_handling | yes | reviewed_no_change |
| code_health:finding_38c0855f7dc3861622c9 | low | code_health | js/app/00-storage-sync-patches.js:6001 | initWftSyncLifecycleHandlers / large_method | yes | reviewed_no_change |
| code_health:finding_156db6ee1ab11f402cfe | low | code_health | js/app/00-storage-sync-patches.js:6047 | error_handling | yes | reviewed_no_change |
| code_health:finding_dba32f79d863b2dbc216 | low | code_health | js/app/00-storage-sync-patches.js:6072 | error_handling | yes | reviewed_no_change |
| code_health:finding_8c1e5a2b0423614dea4b | low | code_health | js/app/00-storage-sync-patches.js:6199 | uploadBlobToDrive / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_8a315c9bf2d55c9f63de | low | code_health | js/app/00-storage-sync-patches.js:6255 | applyWftPreferenceForm / bumpy_road | yes | reviewed_no_change |
| code_health:finding_eba7f088a4fab7fddea3 | low | code_health | js/app/00-storage-sync-patches.js:6392 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_9594f4eb52ffbcf09db0 | low | code_health | js/app/00-storage-sync-patches.js:6685 | setWftSanitizedInnerHtml / complex_conditional | yes | reviewed_no_change |
| code_health:finding_6ba8692dd09e4d1554ac | low | code_health | js/app/00-storage-sync-patches.js:6813 | error_handling | yes | reviewed_no_change |
| code_health:finding_22fc6fec08d1b93873e2 | low | code_health | js/app/00-storage-sync-patches.js:6821 | error_handling | yes | reviewed_no_change |
| code_health:finding_d342aecb83e0282c5fd2 | low | code_health | js/app/00-storage-sync-patches.js:6833 | error_handling | yes | reviewed_no_change |
| code_health:finding_44a8d8bf9c9caf35a45e | low | code_health | js/app/00-storage-sync-patches.js:6904 | syncAllToDrive / bumpy_road | yes | reviewed_no_change |
| code_health:finding_20894b7df80971e6e886 | low | code_health | js/app/00-storage-sync-patches.js:6968 | uploadSessionImagesToDrive / bumpy_road | yes | reviewed_no_change |
| code_health:finding_8db10553c83e85be9dd7 | low | code_health | js/app/00-storage-sync-patches.js:6968 | uploadSessionImagesToDrive / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_0dd0b44ef3cf9a917f4b | low | code_health | js/app/00-storage-sync-patches.js:7019 | nextUpload / large_method | yes | reviewed_no_change |
| code_health:finding_0ebf1243a621949a6e83 | low | code_health | js/app/00-storage-sync-patches.js:7053 | validateCurrentUpload / complex_conditional | yes | reviewed_no_change |
| code_health:finding_e6856bfa0d603fa582a2 | low | code_health | js/app/00-storage-sync-patches.js:7172 | error_handling | yes | reviewed_no_change |
| code_health:finding_07c825055cecc7b49cbc | low | code_health | js/app/00-storage-sync-patches.js:7203 | getSessionCategoryKeys / complex_conditional | yes | confirmed_repair_candidate |
| code_health:finding_321f99e606cfd1e7915e | low | code_health | js/app/00-storage-sync-patches.js:7318 | renderPortfolioFeedbackRows / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_5fcc9daff01d66f13e80 | low | code_health | js/app/00-storage-sync-patches.js:7441 | error_handling | yes | needs_revalidation |
| code_health:finding_7e9e3bd687e666b878c1 | low | code_health | js/app/00-storage-sync-patches.js:7562 | setupWftPortfolioCharts / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_bd262137e5d6d346dc75 | low | code_health | js/app/00-storage-sync-patches.js:7615 | renderStudentPortfolio / large_method | yes | reviewed_no_change |
| code_health:finding_4cc8d496bdb9e7a9baaf | low | code_health | js/app/00-storage-sync-patches.js:7695 | saveCurrentSessionToPortfolio / large_method | yes | reviewed_no_change |
| code_health:finding_011d338cf5eaa80b7fbe | low | code_health | js/app/00-storage-sync-patches.js:7835 | uploadPendingPortfolioMediaBeforeCommit / bumpy_road | yes | reviewed_no_change |
| code_health:finding_dda7cb8583c1ac2b8c1b | low | code_health | js/app/00-storage-sync-patches.js:7907 | finishManualSaveToDrive / large_method | yes | reviewed_no_change |
| code_health:finding_0956f3c90bb76c36955b | low | code_health | js/app/00-storage-sync-patches.js:8028 | updateStatusBar / primitive_obsession | yes | confirmed_repair_candidate |
| code_health:finding_4f4a40401b66f5644289 | low | code_health | js/app/00-storage-sync-patches.js:8110 | error_handling | yes | needs_revalidation |
| code_health:finding_a2f159e8a65910389542 | low | code_health | js/app/00-storage-sync-patches.js:8288 | updateSyncPortfolioButtonState / complex_conditional | yes | reviewed_no_change |
| code_health:finding_ce0ef519180cad77d766 | low | code_health | js/app/00-storage-sync-patches.js:8311 | commitPendingPortfolioReplacement / complex_conditional | yes | reviewed_no_change |
| code_health:finding_f761b8085338ef63b4df | low | code_health | js/app/00-storage-sync-patches.js:8317 | commitPendingPortfolioReplacement / complex_conditional | yes | reviewed_no_change |
| code_health:finding_f61621b5ff2044276dae | low | code_health | js/app/00-storage-sync-patches.js:8336 | commitPendingPortfolioReplacement / complex_conditional | yes | reviewed_no_change |
| code_health:finding_ed8d28d0b9704fee151c | low | code_health | js/app/10-main-app.js | coverage_gradient | yes | unreviewed |
| code_health:finding_6c2ec360fa4b7b1de8aa | low | code_health | js/app/10-main-app.js:89 | error_handling | yes | reviewed_no_change |
| code_health:finding_35fae69e8e4211472329 | low | code_health | js/app/10-main-app.js:116 | error_handling | yes | reviewed_no_change |
| code_health:finding_d0630a1456fd1926a3a9 | low | code_health | js/app/10-main-app.js:150 | removeStudent / bumpy_road | yes | reviewed_no_change |
| code_health:finding_05ff7605620e26c0197d | low | code_health | js/app/10-main-app.js:175 | error_handling | yes | reviewed_no_change |
| code_health:finding_01d263f0dbac65941392 | low | code_health | js/app/10-main-app.js:176 | error_handling | yes | reviewed_no_change |
| code_health:finding_015f337771eb382208b7 | low | code_health | js/app/10-main-app.js:317 | error_handling | yes | reviewed_no_change |
| code_health:finding_43c4f37218a3d7d78f2b | low | code_health | js/app/10-main-app.js:333 | renameStudent / large_method | yes | reviewed_no_change |
| code_health:finding_0660813ea9b9cd681a3e | low | code_health | js/app/10-main-app.js:421 | error_handling | yes | reviewed_no_change |
| code_health:finding_97817cb0739e6ae0d0ca | low | code_health | js/app/10-main-app.js:428 | error_handling | yes | reviewed_no_change |
| code_health:finding_d6b3bf73992d07195bd2 | low | code_health | js/app/10-main-app.js:429 | error_handling | yes | reviewed_no_change |
| code_health:finding_79e1b20adb32b9182b1b | low | code_health | js/app/10-main-app.js:931 | getSampleStatusData / complex_conditional | yes | needs_revalidation |
| code_health:finding_3b7008f933f118f15ac3 | low | code_health | js/app/10-main-app.js:986 | buildLowSampleAnalysis / large_method | yes | needs_revalidation |
| code_health:finding_14c98c45fd927d16130a | low | code_health | js/app/10-main-app.js:1021 | <anonymous> / complex_conditional | yes | needs_revalidation |
| code_health:finding_f61b81e17239b007f947 | low | code_health | js/app/10-main-app.js:1022 | <anonymous> / complex_conditional | yes | needs_revalidation |
| code_health:finding_cf938a3cb775f4a9762b | low | code_health | js/app/10-main-app.js:1026 | <anonymous> / complex_conditional | yes | needs_revalidation |
| code_health:finding_47fc675f46a03662abad | low | code_health | js/app/10-main-app.js:1345 | renderCorrected / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_632d120e20b45e7d610c | low | code_health | js/app/10-main-app.js:1346 | renderCorrected / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_a7ff4e2cacfbde3a3b06 | low | code_health | js/app/10-main-app.js:2044 | renderNoticeTable / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_da2b2ef9a672b56e85c4 | low | code_health | js/app/10-main-app.js:2065 | polishFeedback / primitive_obsession | yes | needs_revalidation |
| code_health:finding_c0f9bb7da8550f66432a | low | code_health | js/app/10-main-app.js:2070 | polishFeedback / complex_conditional | yes | needs_revalidation |
| code_health:finding_3856a4f577518ea32781 | low | code_health | js/app/10-main-app.js:2412 | applyWordCountToIdeas / primitive_obsession | yes | needs_revalidation |
| code_health:finding_3d107669bd8eaedca599 | low | code_health | js/app/10-main-app.js:2572 | buildFlowPatternSummary / complex_conditional | yes | needs_revalidation |
| code_health:finding_4908307b68a52238a52f | low | code_health | js/app/10-main-app.js:2589 | buildFlowPatternNotes / complex_conditional | yes | needs_revalidation |
| code_health:finding_415557c855bfd3dd897c | low | code_health | js/app/10-main-app.js:2613 | applyComputedFlowToFlow / bumpy_road | yes | needs_revalidation |
| code_health:finding_817cc8a555d69214a026 | low | code_health | js/app/10-main-app.js:2699 | summarizeOpenRouterFailure / complex_conditional | yes | needs_revalidation |
| code_health:finding_686cbca1ed33c485434a | low | code_health | js/app/10-main-app.js:2754 | requestOpenRouterWithFallback / large_method | yes | needs_revalidation |
| code_health:finding_25cfcad7b6b9aeda0afd | low | code_health | js/app/10-main-app.js:3127 | resetCurrentClassData / large_method | yes | needs_revalidation |
| code_health:finding_6a5e541f0cde455874c4 | low | code_health | js/app/10-main-app.js:3211 | updateSelectedImagePreview / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_fe492c49b9e78bfdb45b | low | code_health | js/app/10-main-app.js:3349 | getDroppedImageFiles / complex_conditional | yes | needs_revalidation |
| code_health:finding_73f08f5a32f57a488037 | low | code_health | js/app/10-main-app.js:3490 | error_handling | yes | needs_revalidation |
| code_health:finding_c4999a76f9166ab1a7d5 | low | code_health | js/app/10-main-app.js:3759 | error_handling | yes | needs_revalidation |
| code_health:finding_c1ab54e79ed097c54312 | low | code_health | js/app/10-main-app.js:3776 | error_handling | yes | needs_revalidation |
| code_health:finding_4324376bb7f15d887a99 | low | code_health | js/app/10-main-app.js:3844 | buildStep2Prompt / primitive_obsession | yes | needs_revalidation |
| code_health:finding_3d4ce77d3c9108a187ad | low | code_health | js/app/10-main-app.js:4248 | buildEvidenceBasedTeacherComment / bumpy_road | yes | needs_revalidation |
| code_health:finding_422849494d832f75eae6 | low | code_health | js/app/10-main-app.js:4560 | addNoticeRowIfNew / complex_conditional | yes | needs_revalidation |
| code_health:finding_351ee22dd4a7d9655bbe | low | code_health | js/app/10-main-app.js:4684 | renderDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_f12b4d2969f91e0f4849 | low | code_health | js/app/10-main-app.js:4685 | renderDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_3de6c1ab9ae09d51df53 | low | code_health | js/app/10-main-app.js:4686 | renderDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_4db352f80d6d5c7a19eb | low | code_health | js/app/10-main-app.js:4688 | renderDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_c8ebce4520d250e6f25c | low | code_health | js/app/10-main-app.js:4689 | renderDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_59891f8809ca49ea5883 | low | code_health | js/app/10-main-app.js:4811 | buildAuditValidationRows / primitive_obsession | yes | needs_revalidation |
| code_health:finding_00cf7f5f7763c29eedcf | low | code_health | js/app/10-main-app.js:4847 | renderAuditRowsTable / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_db08e25c416f8a1cb0fa | low | code_health | js/app/10-main-app.js:4856 | renderAuditValidationTable / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_21a1f8b7493375e4702a | low | code_health | js/app/10-main-app.js:4857 | renderAuditValidationTable / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_d1d6ed8840d18d9a3a31 | low | code_health | js/app/10-main-app.js:4858 | renderAuditValidationTable / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_706e0058345dbe436134 | low | code_health | js/app/10-main-app.js:4868 | renderAuditEvidenceList / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_8438b285c6cd5ae740c2 | low | code_health | js/app/10-main-app.js:4883 | getTeacherAuditOrder / complex_conditional | yes | needs_revalidation |
| code_health:finding_481e80ea101b4f6b1a46 | low | code_health | js/app/10-main-app.js:4908 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_188cccdbfb50c3248a5c | low | code_health | js/app/10-main-app.js:4909 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_cadc28a9f002e3a72495 | low | code_health | js/app/10-main-app.js:4910 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_bb494461e3c095cfa0de | low | code_health | js/app/10-main-app.js:4911 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_c14f5de85f3b8e281e75 | low | code_health | js/app/10-main-app.js:4912 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_f490f9c869d69bd05518 | low | code_health | js/app/10-main-app.js:4913 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_a32e86743cd8f1aa0125 | low | code_health | js/app/10-main-app.js:4914 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_933a9fb59741a0e3042b | low | code_health | js/app/10-main-app.js:4915 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_2ecd60586fbebb0b64a6 | low | code_health | js/app/10-main-app.js:4916 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_e7d8f5c49e1a40ee1cf8 | low | code_health | js/app/10-main-app.js:4917 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_86f2716705aebc009c07 | low | code_health | js/app/10-main-app.js:4918 | renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_42034da6d555de0625e3 | low | code_health | js/app/10-main-app.js:5037 | titleCaseGeneratedWritingTitle / large_method | yes | needs_revalidation |
| code_health:finding_116b62f2c6940da9dded | low | code_health | js/app/10-main-app.js:5290 | makeWritingGenreInfo / primitive_obsession | yes | needs_revalidation |
| code_health:finding_860035c4a626f17c5d07 | low | code_health | js/app/10-main-app.js:5408 | detectWritingGenreInfo / large_method | yes | needs_revalidation |
| code_health:finding_29f0311595e8d8ff7770 | low | code_health | js/app/10-main-app.js:5547 | updateGenreReviewBox / complex_conditional | yes | needs_revalidation |
| code_health:finding_8500ae12a975ea5b7683 | low | code_health | js/app/10-main-app.js:5597 | buildEncouragingClosing / complex_conditional | yes | needs_revalidation |
| code_health:finding_ab05ea1a9ee32eb3296d | low | code_health | js/app/10-main-app.js:5802 | buildNotebookActionChecklist / bumpy_road | yes | needs_revalidation |
| code_health:finding_f78ccd93ab136f279585 | low | code_health | js/app/10-main-app.js:6017 | renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_7116df66eec9c8fc4acd | low | code_health | js/app/10-main-app.js:6018 | renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_ed219546d0477a86fffd | low | code_health | js/app/10-main-app.js:6019 | renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_653129774356a3195d7d | low | code_health | js/app/10-main-app.js:6020 | renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_2da05b675c1b335ace65 | low | code_health | js/app/10-main-app.js:6021 | renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_fb792c60b32a4966f14c | low | code_health | js/app/10-main-app.js:6022 | renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_7a89da6c3ecbed3cd3b3 | low | code_health | js/app/10-main-app.js:6023 | renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_c9050b12d552d2835ae6 | low | code_health | js/app/10-main-app.js:6042 | error_handling | yes | needs_revalidation |
| code_health:finding_504afd2a07fe51d8e8b3 | low | code_health | js/app/10-main-app.js:6046 | error_handling | yes | needs_revalidation |
| code_health:finding_845f971e196e18607fe6 | low | code_health | js/app/10-main-app.js:6235 | originalTextContainsNotebookQuote / complex_conditional | yes | needs_revalidation |
| code_health:finding_aff95dd9e196478bf792 | low | code_health | js/app/10-main-app.js:6248 | getNotebookGuideDefaultFocus / bumpy_road | yes | needs_revalidation |
| code_health:finding_600fd69a4a17836d4be1 | low | code_health | js/app/10-main-app.js:6292 | buildNotebookGuidePrioritiesFromRawInput / bumpy_road | yes | needs_revalidation |
| code_health:finding_f06389d3d183b5b7fa65 | low | code_health | js/app/10-main-app.js:6698 | makeNotebookGuideExample / primitive_obsession | yes | needs_revalidation |
| code_health:finding_1b54f65228745086620d | low | code_health | js/app/10-main-app.js:6710 | buildFallbackExampleForPriority / bumpy_road | yes | needs_revalidation |
| code_health:finding_a868a94954804e2bff54 | low | code_health | js/app/10-main-app.js:6853 | addNotebookGuideFallbackExample / primitive_obsession | yes | needs_revalidation |
| code_health:finding_ce819733bea699e05190 | low | code_health | js/app/10-main-app.js:6894 | buildNotebookGuideFallback / primitive_obsession | yes | needs_revalidation |
| code_health:finding_0e7b44e9f3055d01febe | low | code_health | js/app/10-main-app.js:6930 | assembleNotebookGuideFromCandidates / bumpy_road | yes | needs_revalidation |
| code_health:finding_19451019efc2d01c7332 | low | code_health | js/app/10-main-app.js:6930 | assembleNotebookGuideFromCandidates / large_method | yes | needs_revalidation |
| code_health:finding_8533ebb93bfd8fa4850c | low | code_health | js/app/10-main-app.js:6930 | assembleNotebookGuideFromCandidates / primitive_obsession | yes | needs_revalidation |
| code_health:finding_5140626fb0ae2120defa | low | code_health | js/app/10-main-app.js:7048 | renderNotebookGuideFocusList / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_55e3e7b0a65983157130 | low | code_health | js/app/10-main-app.js:7059 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_e7c1a6c3daeef1e5b31f | low | code_health | js/app/10-main-app.js:7060 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_bb4e85b2531da176296e | low | code_health | js/app/10-main-app.js:7061 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_7f9d145151ea2de2578b | low | code_health | js/app/10-main-app.js:7062 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_32b689e2f4f668a925d0 | low | code_health | js/app/10-main-app.js:7063 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_84fed470e5cd1474663a | low | code_health | js/app/10-main-app.js:7064 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_b1d9c46289a2cb313ffa | low | code_health | js/app/10-main-app.js:7065 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_ee6dd3ede28b6377f740 | low | code_health | js/app/10-main-app.js:7066 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_3e50ed60460f1941461e | low | code_health | js/app/10-main-app.js:7067 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_73b86080f023ca22b853 | low | code_health | js/app/10-main-app.js:7068 | renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_1e428f32ae6e9f768e81 | low | code_health | js/app/10-main-app.js:7082 | renderNotebookQuickCheckList / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_524a0b39a71fa1f643f8 | low | code_health | js/app/10-main-app.js:7336 | error_handling | no | fixed_verified |
| code_health:finding_c08ab1d20e2d87bde007 | low | code_health | js/app/10-main-app.js:7374 | error_handling | yes | needs_revalidation |
| code_health:finding_c0289b8facadeca0647f | low | code_health | js/app/10-main-app.js:7380 | error_handling | yes | needs_revalidation |
| code_health:finding_0276419a105c6242f13d | low | code_health | js/app/10-main-app.js:7385 | error_handling | yes | needs_revalidation |
| code_health:finding_ccdce65fd75cb30112a0 | low | code_health | js/app/10-main-app.js:7486 | renderNotebookDetailedAssessmentFromSavedSession / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_5c339e38023b4cc71478 | low | code_health | js/app/10-main-app.js:7487 | renderNotebookDetailedAssessmentFromSavedSession / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_1ab5e0d4d435d307009c | low | code_health | js/app/10-main-app.js:7488 | renderNotebookDetailedAssessmentFromSavedSession / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_5d7e16fcf8dd26f060cc | low | code_health | js/app/10-main-app.js:7489 | renderNotebookDetailedAssessmentFromSavedSession / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_cacae3136160a8d497aa | low | code_health | js/app/10-main-app.js:7490 | renderNotebookDetailedAssessmentFromSavedSession / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_560f2e42892b746b439d | low | code_health | js/app/10-main-app.js:7491 | renderNotebookDetailedAssessmentFromSavedSession / string_concat_in_loop | yes | needs_revalidation |
| code_health:finding_782b6ad5a140a0fde7e2 | low | code_health | js/app/10-main-app.js:7541 | error_handling | yes | needs_revalidation |
| code_health:finding_8044bd2dfe671b84ae02 | low | code_health | js/app/10-main-app.js:7574 | error_handling | yes | needs_revalidation |
| code_health:finding_f950a77aba91ce1f3c19 | low | code_health | js/app/10-main-app.js:7926 | reconcileDetailedAnalysis / primitive_obsession | yes | needs_revalidation |
| code_health:finding_aa040416ab14e29024fa | low | code_health | js/app/10-main-app.js:8039 | buildAnalysisResult / primitive_obsession | yes | needs_revalidation |
| code_health:finding_7c122b322da6ef3fb555 | low | code_health | js/app/10-main-app.js:8067 | renderScoredAnalysisDebug / large_method | no | fixed_verified |
| code_health:finding_eb37461abdf66043fb60 | low | code_health | js/app/10-main-app.js:8090 | renderScoredAnalysisDebug / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_a588ab315453a61edf9d | low | code_health | js/app/10-main-app.js:8267 | analyzeWriting / large_method | yes | needs_revalidation |
| code_health:finding_cb75b06f17c7ca01125c | low | code_health | js/app/10-main-app.js:8398 | <anonymous> / complex_conditional | yes | needs_revalidation |
| code_health:finding_bb01f5e2cea645103864 | low | code_health | js/app/10-main-app.js:8485 | error_handling | no | reviewed_no_change |
| code_health:finding_59b9470c43c933b96fb5 | low | code_health | js/app/10-main-app.js:8493 | error_handling | no | reviewed_no_change |
| code_health:finding_ada488f36dc2a7d66ff8 | low | code_health | js/app/10-main-app.js:8500 | error_handling | no | reviewed_no_change |
| code_health:finding_9bd5f85768cebd1be3fd | low | code_health | js/app/10-main-app.js:8509 | error_handling | no | reviewed_no_change |
| code_health:finding_e8948681e0b2a9493e98 | low | code_health | js/app/10-main-app.js:8523 | error_handling | yes | needs_revalidation |
| code_health:finding_87305a727729ced01817 | low | code_health | js/app/10-main-app.js:8525 | error_handling | yes | needs_revalidation |
| code_health:finding_c25d0e7c6711f996d0ec | low | code_health | js/app/10-main-app.js:8556 | error_handling | yes | unreviewed |
| code_health:finding_3f19bbf58ac3a6254f7c | low | code_health | js/app/10-main-app.js:8564 | error_handling | yes | unreviewed |
| code_health:finding_d0a29fc7d94027468ce3 | low | code_health | js/app/10-main-app.js:8571 | error_handling | yes | unreviewed |
| code_health:finding_69d1bc385dda23bbfa08 | low | code_health | js/app/10-main-app.js:8580 | error_handling | yes | unreviewed |
| code_health:finding_7cafeb9e1b470fe325be | low | code_health | js/app/dialogs.js | coverage_gradient | no | fixed_verified |
| code_health:finding_44e764606a039a6b13e8 | low | code_health | js/app/dialogs.js:32 | <anonymous> / large_method | yes | reviewed_no_change |
| code_health:finding_74656979868084cda402 | low | code_health | js/app/dialogs.js:108 | error_handling | yes | reviewed_no_change |
| code_health:finding_b056139b0d0c461e7869 | low | code_health | js/app/dialogs.js:227 | error_handling | yes | reviewed_no_change |
| code_health:finding_e8fa786727ce7172a436 | low | code_health | js/app/photo-crop.js | coverage_gradient | yes | candidate_needs_regression |
| code_health:finding_67272701e9295673aac2 | low | code_health | js/app/portfolio-export.js | coverage_gradient | yes | candidate_needs_regression |
| code_health:finding_e0e2c68f45d9cbfb0853 | low | code_health | js/app/portfolio-export.js | churn_risk | yes | needs_revalidation |
| code_health:finding_0368fd46318f3d32ea01 | low | code_health | js/app/portfolio-export.js:175 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_3a42e744c595cd5ca562 | low | code_health | js/app/portfolio-export.js:176 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_e3abaf354252d387d5ee | low | code_health | js/app/portfolio-export.js:177 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_3a67d4cf25a1bfd26a1f | low | code_health | js/app/portfolio-export.js:178 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_2ff9e217d561aa315970 | low | code_health | js/app/portfolio-export.js:179 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_c4380b5a9b18fea72528 | low | code_health | js/app/portfolio-export.js:180 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_9905f1affcc958c66094 | low | code_health | js/app/portfolio-export.js:181 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_7721c54a47ebf9bb81f4 | low | code_health | js/app/portfolio-export.js:182 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_64a5a88b83ef8a22606d | low | code_health | js/app/portfolio-export.js:183 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_c38a72e4ac318ae35a94 | low | code_health | js/app/portfolio-export.js:184 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_9d555c95968b0dbe2686 | low | code_health | js/app/portfolio-export.js:185 | buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_21fce8bacad6db145f2c | low | code_health | js/app/portfolio-export.js:338 | buildStudentPortfolioPhotosHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_933c6ad35e306b1d8867 | low | code_health | js/app/portfolio-export.js:340 | buildStudentPortfolioPhotosHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_149f7a9b86df65316d03 | low | code_health | js/app/portfolio-export.js:527 | buildClassSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| code_health:finding_b7040d9769dc0e552c9b | low | code_health | js/app/portfolio-export.js:615 | addAvailableImagesToStudentFolder / large_method | yes | reviewed_no_change |
| code_health:finding_9dec7bceb68525f6eebb | low | code_health | js/app/portfolio-export.js:699 | addStudentExportFiles / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_a9056855bed4a463c583 | low | code_health | js/app/portfolio-export.js:900 | uploadBlobToDrivePromise / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_1b2de011e29675ee61ed | low | code_health | js/app/portfolio-export.js:959 | clearCurrentClassAfterSuccessfulArchive / bumpy_road | yes | reviewed_no_change |
| code_health:finding_062f9ed0d9b06b8516cc | low | code_health | js/app/portfolio-export.js:991 | archiveCurrentSchoolYear / large_method | yes | reviewed_no_change |
| code_health:finding_339bc8c333e9ec258402 | low | code_health | js/app/storage-recovery.js | coverage_gradient | yes | reviewed_no_change |
| code_health:finding_609609e5993a72b3c225 | low | code_health | js/app/storage-recovery.js:214 | buildWftEmergencyBackupObject / bumpy_road | yes | reviewed_no_change |
| code_health:finding_1c20ca1bd8c2259efb2a | low | code_health | js/app/storage-recovery.js:214 | buildWftEmergencyBackupObject / large_method | yes | reviewed_no_change |
| code_health:finding_04ce1dd1854346b9cfe8 | low | code_health | test-google-drive-migration.cjs:6 | file / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_04486662f265863bfee5 | low | code_health | tests/analysis-identity.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_0f7b96782dc7eb4598cd | low | code_health | tests/analysis-pipeline.browser.cjs:252 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_ecf09ab8445f7108ec24 | low | code_health | tests/archive-connection.browser.cjs:8 | runArchiveConnectionScenario / large_method | yes | reviewed_no_change |
| code_health:finding_d5174fb3feb40c31672b | low | code_health | tests/archive-connection.browser.cjs:85 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_eba234f172007837bb09 | low | code_health | tests/archive-failures.browser.cjs:15 | runArchiveScenario / large_method | yes | reviewed_no_change |
| code_health:finding_a3e6b3a5c6fa0e0e9a5c | low | code_health | tests/archive-failures.browser.cjs:103 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_c0f0e57ae1b6bd084044 | low | code_health | tests/archive-integrity.browser.cjs:271 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_5306a999694aea8b140a | low | code_health | tests/auth-integrity.browser.cjs:275 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_d9c4a8589183add6d1da | low | code_health | tests/auth-integrity.browser.cjs:279 | error_handling | yes | reviewed_no_change |
| code_health:finding_e127d96b7167f455505c | low | code_health | tests/correction-performance.browser.cjs:3 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_3950fcf55e93d82f8063 | low | code_health | tests/corrupt-portfolio.browser.cjs:88 | exerciseCloudCorruption / bumpy_road | yes | reviewed_no_change |
| code_health:finding_c4b9d1280f5f8806538e | low | code_health | tests/crop-ownership.browser.cjs:13 | dry_violation | yes | unreviewed |
| code_health:finding_99d9a3ebb52218fcabc6 | low | code_health | tests/crop-ownership.browser.cjs:222 | evaluateReorderDrop / bumpy_road | yes | unreviewed |
| code_health:finding_4a4191a6c326f518d7f9 | low | code_health | tests/crop-transparency.browser.cjs:4 | dry_violation | yes | reviewed_no_change |
| code_health:finding_eaebebe81e5cd3e15235 | low | code_health | tests/deletion-durability.browser.cjs:1 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_d2b18d43cdb6cc9e91aa | low | code_health | tests/deletion-durability.browser.cjs:28 | exerciseStorageFailure / large_method | yes | reviewed_no_change |
| code_health:finding_47086b374bcafe376e31 | low | code_health | tests/deletion-merge.browser.cjs:7 | <anonymous@7> / large_method | yes | reviewed_no_change |
| code_health:finding_b1dcffd38f5b717a7e0f | low | code_health | tests/deletion-merge.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_2c97f89ef33b930e177b | low | code_health | tests/deletion-recovery.browser.cjs:1 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_58dcdb6608145bd5ed26 | low | code_health | tests/deletion-recovery.browser.cjs:37 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_f4e8432758c40a946bbd | low | code_health | tests/deletion-recovery.browser.cjs:38 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_5e96838eb294be21f089 | low | code_health | tests/detailed-parser.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_005af86642206a3f69cb | low | code_health | tests/detailed-parser.browser.cjs:177 | dry_violation | no | confirmed_repair_candidate |
| code_health:finding_7ab9c4252d5ca5a30579 | low | code_health | tests/drive-folder-selection.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_21a0bbf20192af2be592 | low | code_health | tests/drive-lifecycle.browser.cjs:35 | checkFetchScenario / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_5be9ea529bf82cdfbbf3 | low | code_health | tests/drive-lifecycle.browser.cjs:98 | checkPollingScenario / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_b5d688594926455874d4 | low | code_health | tests/drive-lifecycle.browser.cjs:145 | installDriveRoute / large_method | yes | candidate_needs_regression |
| code_health:finding_61ea1e71eb770a77989a | low | code_health | tests/drive-lifecycle.browser.cjs:176 | replyToUpload / complex_conditional | yes | reviewed_no_change |
| code_health:finding_1be4afa8ded3013ac8e7 | low | code_health | tests/drive-lifecycle.browser.cjs:294 | dry_violation | no | fixed_verified |
| code_health:finding_a837428ede3cbf0c9096 | low | code_health | tests/feedback-compatibility.browser.cjs:12 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_6656c8d7f5732c8fe3f8 | low | code_health | tests/google-drive-migration.browser.cjs:6 | runNativeMigrationCases / large_method | yes | reviewed_no_change |
| code_health:finding_2bd454722e654474e601 | low | code_health | tests/google-drive-migration.browser.cjs:17 | migrationRoute / bumpy_road | yes | reviewed_no_change |
| code_health:finding_200b7f89bb709f880329 | low | code_health | tests/image-preparation.browser.cjs:3 | dry_violation | yes | needs_revalidation |
| code_health:finding_a92539ef8099a6e377ad | low | code_health | tests/main-app-health.browser.cjs:199 | expectGenre / primitive_obsession | yes | unreviewed |
| code_health:finding_5b6315b17f8803c7e046 | low | code_health | tests/media-ownership.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_9c5c31a2ca73143c40fc | low | code_health | tests/media-ownership.browser.cjs:212 | assertPendingMediaScenario / complex_conditional | yes | reviewed_no_change |
| code_health:finding_8b0f5d04e40a276ec8b4 | low | code_health | tests/media-ownership.browser.cjs:275 | dry_violation | yes | needs_revalidation |
| code_health:finding_ba559d6dc72385ac8e8b | low | code_health | tests/media-upload-boundary.browser.cjs:12 | exerciseOwnershipBoundary / bumpy_road | yes | reviewed_no_change |
| code_health:finding_40d1a80c7dd317811846 | low | code_health | tests/media-upload-boundary.browser.cjs:12 | exerciseOwnershipBoundary / large_method | yes | reviewed_no_change |
| code_health:finding_112b8b7c85259f7e792f | low | code_health | tests/media-upload-boundary.browser.cjs:104 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_9708f175ae4a6033ae11 | low | code_health | tests/missing-feedback.browser.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_7f05dea449294f08bb0f | low | code_health | tests/neatness-scoring.browser.cjs:7 | <anonymous@7> / large_method | yes | reviewed_no_change |
| code_health:finding_17a77e2184d06c5924b5 | low | code_health | tests/neatness-scoring.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_a412eb95ad4f534d502e | low | code_health | tests/notebook-guidance-repair.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_898530e97870b376ca26 | low | code_health | tests/notebook-guide.browser.cjs:29 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_e23a276513588c43ca30 | low | code_health | tests/notebook-print-failure.browser.cjs:54 | dry_violation | yes | reviewed_no_change |
| code_health:finding_4ef2ddbf4e328909aa45 | low | code_health | tests/openrouter-admission.browser.cjs:144 | dry_violation | yes | reviewed_no_change |
| code_health:finding_066a2edc5c549df655fa | low | code_health | tests/openrouter-failures.browser.cjs:8 | runFailureScenario / large_method | yes | reviewed_no_change |
| code_health:finding_6d349b0d589e2b547c8e | low | code_health | tests/openrouter-failures.browser.cjs:90 | dry_violation | yes | reviewed_no_change |
| code_health:finding_213d9f8b3e19418bec05 | low | code_health | tests/optional-storage.browser.cjs:5 | runNativeStorageScenarios / large_method | yes | reviewed_no_change |
| code_health:finding_cdb8be83656852c7ab1c | low | code_health | tests/optional-storage.browser.cjs:131 | runLazyPortfolioScenarios / bumpy_road | yes | reviewed_no_change |
| code_health:finding_1e0a39c50c6ccb76ba44 | low | code_health | tests/optional-storage.browser.cjs:131 | runLazyPortfolioScenarios / large_method | yes | reviewed_no_change |
| code_health:finding_96c00aeeb88b86b3a25d | low | code_health | tests/optional-storage.browser.cjs:198 | run / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_4893cf08bb5ae166eb8e | low | code_health | tests/pending-commit-publication.browser.cjs:7 | <anonymous@7> / large_method | yes | reviewed_no_change |
| code_health:finding_489183df2dd8d8744d1c | low | code_health | tests/pending-commit-publication.browser.cjs:41 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_c0f177fd0c19241ff17d | low | code_health | tests/pending-commit-publication.browser.cjs:88 | dry_violation | yes | reviewed_no_change |
| code_health:finding_5301ae7f99d89050d43c | low | code_health | tests/pending-portfolio.browser.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_25e178330cbedd7e9342 | low | code_health | tests/pending-portfolio.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_9713ff13edfc8d5c00bf | low | code_health | tests/portfolio-index-load.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_d76a47a3866d90b8049c | low | code_health | tests/portfolio-index.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_11f605dd287d9c2e0c11 | low | code_health | tests/portfolio-removal.browser.cjs:7 | <anonymous@7> / large_method | yes | reviewed_no_change |
| code_health:finding_72201b9397b729113a68 | low | code_health | tests/portfolio-removal.cjs:84 | test.setup.test.app.deletePortfolioSession.assert.deepEqual.assert.deepEqual.console.log.catch callback / assertion_free_test | yes | reviewed_no_change |
| code_health:finding_ced969c11ee33e523e58 | low | code_health | tests/portfolio-renderer.browser.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_e3cf5bad6653d6e04b9c | low | code_health | tests/portfolio-replacement.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_fb8f8767e70a3a59a405 | low | code_health | tests/portfolio-replacement.cjs:48 | test.stored.Alice.sessions.map callback / assertion_free_test | yes | reviewed_no_change |
| code_health:finding_1b2896d1d7a3c6e41154 | low | code_health | tests/portfolio-replacement.cjs:72 | test.stored.Alice.sessions.map callback / assertion_free_test | yes | reviewed_no_change |
| code_health:finding_f845f314bee6056eb32b | low | code_health | tests/portfolio-replacement.cjs:73 | test.stored.Bob.sessions.map callback / assertion_free_test | yes | reviewed_no_change |
| code_health:finding_fdab77d90fdbc32562d9 | low | code_health | tests/portfolio-replacement.cjs:80 | test.stored.Alice.sessions.map callback / assertion_free_test | yes | reviewed_no_change |
| code_health:finding_a69c3001d92a09c58bf1 | low | code_health | tests/portfolio-replacement.cjs:100 | test.stored.Bob.sessions.map callback / assertion_free_test | yes | reviewed_no_change |
| code_health:finding_dba893bb0998191932a2 | low | code_health | tests/portfolio-replacement.cjs:108 | test.stored.Bob.sessions.slice.map callback / assertion_free_test | yes | reviewed_no_change |
| code_health:finding_d571f3e0e8dc34723374 | low | code_health | tests/portfolio-save.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_9a857800e4e4a5efaaf4 | low | code_health | tests/portfolio-sync.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_b24caf94ce286264a74d | low | code_health | tests/portfolio-sync.browser.cjs:108 | runPortfolioSyncScenario / large_method | yes | reviewed_no_change |
| code_health:finding_215719be8ce517d54698 | low | code_health | tests/portfolio-sync.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_ae857b3e841bd8464b5b | low | code_health | tests/portfolio-sync.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_7d7006df9ec6314480bd | low | code_health | tests/preference-integrity-scenarios.js:386 | checkKeyPersistenceAndHandlers / bumpy_road | yes | reviewed_no_change |
| code_health:finding_d85646f671cd92e5433a | low | code_health | tests/preference-integrity-scenarios.js:436 | checkKeyRecovery / large_method | yes | reviewed_no_change |
| code_health:finding_7abfbf4a2f826653796d | low | code_health | tests/preference-integrity-scenarios.js:536 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_1a6100f7f36b934266e6 | low | code_health | tests/record-identity.browser.cjs | prior_defect | no | reviewed_no_change |
| code_health:finding_e1cab3eb1c1950913fb5 | low | code_health | tests/record-identity.browser.cjs:132 | dry_violation | yes | needs_revalidation |
| code_health:finding_9dfe63deb01f1eb80636 | low | code_health | tests/record-identity.browser.cjs:135 | <anonymous@135> / large_method | yes | confirmed_repair_candidate |
| code_health:finding_ab3e620dca9faaf23458 | low | code_health | tests/recovery-cache.browser.cjs:10 | checkBackupCallback / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_4cf99259c01d5a05625d | low | code_health | tests/recovery-cache.browser.cjs:18 | checkBackupScenario / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_35edf9740e8a2fa057b5 | low | code_health | tests/recovery-cache.browser.cjs:57 | checkCacheScenario / complex_conditional | yes | reviewed_no_change |
| code_health:finding_1c43466359debf8ce43c | low | code_health | tests/recovery-cache.browser.cjs:102 | runRecoveryScenario / bumpy_road | yes | reviewed_no_change |
| code_health:finding_8fdb4f9986350503ab5b | low | code_health | tests/recovery-cache.browser.cjs:220 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_17ce0cce1930c0bc5070 | low | code_health | tests/rename-confirmation.browser.cjs:20 | setupRenameFixture / large_method | yes | reviewed_no_change |
| code_health:finding_241aec90374475ff57a6 | low | code_health | tests/rename-confirmation.browser.cjs:140 | dry_violation | yes | needs_revalidation |
| code_health:finding_bc5b71332347bd24eed1 | low | code_health | tests/script-loading.browser.cjs:5 | <anonymous@5> / large_method | yes | reviewed_no_change |
| code_health:finding_16db8cc9c2b3d4382f78 | low | code_health | tests/script-loading.browser.cjs:28 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_c44eb8fdd08311d35209 | low | code_health | tests/session-retention.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_d7654f18e4ed451483c2 | low | code_health | tests/session-retention.browser.cjs:133 | <anonymous> / complex_conditional | yes | reviewed_no_change |
| code_health:finding_5cab96fffb598278e69c | low | code_health | tests/session-retention.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_06063294410689530866 | low | code_health | tests/settings-deletions-sync.browser.cjs | prior_defect | yes | needs_revalidation |
| code_health:finding_7e310eb3c5642cd8f8bd | low | code_health | tests/settings-deletions-sync.browser.cjs:15 | runSettingsDeletionScenarios / large_method | yes | reviewed_no_change |
| code_health:finding_ba7fe4ab642953d3d46e | low | code_health | tests/settings-deletions-sync.browser.cjs:150 | dry_violation | yes | confirmed_repair_candidate |
| code_health:finding_eccc654a22ebb1108ff3 | low | code_health | tests/settings-deletions-sync.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_cd13f605cdef84dd5e3f | low | code_health | tests/split-storage.browser.cjs:53 | replySearch / bumpy_road | yes | reviewed_no_change |
| code_health:finding_1211ef84f5feb095204b | low | code_health | tests/storage-dialog-keyboard.browser.cjs:66 | runRenameWorkflow / primitive_obsession | yes | reviewed_no_change |
| code_health:finding_9934b52e0c0db9b89709 | low | code_health | tests/storage-health.cjs:1 | dry_violation | yes | reviewed_no_change |
| code_health:finding_229cb91cb1ac685a58c4 | low | code_health | tests/storage-held-request.browser.cjs:5 | <anonymous@5> / large_method | yes | confirmed_repair_candidate |
| code_health:finding_73b0629d0342f5021c60 | low | code_health | tests/storage-held-request.browser.cjs:37 | dry_violation | yes | reviewed_no_change |
| code_health:finding_eac0d63c55f858b16f57 | low | code_health | tests/storage-integrity.browser.cjs:124 | runDeletionPolicyCases / large_method | yes | reviewed_no_change |
| code_health:finding_9f733e328960b7279b3b | low | code_health | tests/storage-integrity.browser.cjs:224 | initializeIntegrityFixture / large_method | yes | reviewed_no_change |
| code_health:finding_1e16b4f451761fdb4f18 | low | code_health | tests/storage-public-ui.browser.cjs:22 | replyDriveRequest / bumpy_road | yes | reviewed_no_change |
| code_health:finding_7afcbd5ba99da91ccf4f | low | code_health | tests/storage-public-ui.browser.cjs:135 | dry_violation | yes | reviewed_no_change |
| code_health:finding_116f23f684db12591de4 | low | code_health | tests/storage-upload-ownership.browser.cjs:6 | dry_violation | yes | reviewed_no_change |
| code_health:finding_a3a48728c81ea506c461 | low | code_health | tests/student-read-ownership.browser.cjs:7 | <anonymous@7> / large_method | yes | reviewed_no_change |
| code_health:finding_29be0fb5517d3f81826a | low | code_health | tests/student-read-ownership.browser.cjs:15 | dry_violation | no | fixed_verified |
| code_health:finding_5f6e3b7c0c1ace61a1cb | low | code_health | tests/student-rename.browser.cjs:7 | <anonymous@7> / large_method | no | fixed_verified |
| security:c5c61743b4554d8505685b66 | low | security | tests/analysis-pipeline.browser.cjs:249 | eval_call | yes | reviewed_no_change |
| security:a198a9d488291adf619fec44 | low | security | tests/archive-connection.browser.cjs:18 | hardcoded_secret | yes | reviewed_no_change |
| security:ca8b522f9699985e30e28036 | low | security | tests/archive-connection.browser.cjs:18 | hardcoded_secret | yes | reviewed_no_change |
| security:bc48d0bc30483923ca2b0627 | low | security | tests/archive-connection.browser.cjs:30 | hardcoded_secret | yes | reviewed_no_change |
| security:bfc72ca167afa1b3143bbefc | low | security | tests/auth-integrity.browser.cjs:181 | hardcoded_secret | yes | reviewed_no_change |
| security:1c8343a610e2d1038308bf3e | low | security | tests/auth-integrity.browser.cjs:181 | hardcoded_secret | yes | reviewed_no_change |
| security:2cfb2e20a67eb2459bee96ae | low | security | tests/auth-integrity.browser.cjs:205 | hardcoded_secret | yes | reviewed_no_change |
| security:b94c83f6bf871aafc5143b88 | low | security | tests/auth-integrity.browser.cjs:263 | hardcoded_secret | yes | reviewed_no_change |
| security:b18d3a0708852936037b27f5 | low | security | tests/auth-integrity.browser.cjs:321 | hardcoded_secret | yes | reviewed_no_change |
| security:85fae45534526a62396933f9 | low | security | tests/media-upload-boundary.browser.cjs:14 | hardcoded_secret | yes | reviewed_no_change |
| security:52e9c08a45fe446382066f0f | low | security | tests/media-upload-boundary.browser.cjs:14 | hardcoded_secret | yes | reviewed_no_change |
| security:667f3fd9f5bcb2b534f0f38c | low | security | tests/media-upload-boundary.browser.cjs:14 | hardcoded_secret | yes | reviewed_no_change |
| security:ce1d49bcb1a9d95efc75f470 | low | security | tests/media-upload-boundary.browser.cjs:30 | hardcoded_secret | yes | reviewed_no_change |
| security:47520e350ae85bddd1624004 | low | security | tests/media-upload-boundary.browser.cjs:48 | hardcoded_secret | yes | reviewed_no_change |
| security:b369ae361180166cba124184 | low | security | tests/media-upload-boundary.browser.cjs:48 | hardcoded_secret | yes | reviewed_no_change |
| security:3cf392171f171b02d49ac025 | low | security | tests/media-upload-boundary.browser.cjs:48 | hardcoded_secret | yes | reviewed_no_change |
| security:825d54c5f90e6260cf37a637 | low | security | tests/media-upload-boundary.browser.cjs:63 | hardcoded_secret | yes | reviewed_no_change |
| security:971c453312549e98434b3ab3 | low | security | tests/optional-storage.browser.cjs:238 | eval_call | yes | reviewed_no_change |
| security:673b162570d924cb66fcc015 | low | security | tests/record-identity.browser.cjs:157 | eval_call | yes | reviewed_no_change |
| security:80412ff6c2285dd7e9d6ba53 | low | security | tests/storage-upload-ownership.browser.cjs:11 | hardcoded_secret | yes | reviewed_no_change |
| security:2c255b9986626c01c4310695 | low | security | tests/storage-upload-ownership.browser.cjs:11 | hardcoded_secret | yes | reviewed_no_change |
| security:102e2163c0c86a7d4463e542 | low | security | tests/storage-upload-ownership.browser.cjs:11 | hardcoded_secret | yes | reviewed_no_change |
| security:1f380d22b29e6aee90c2176c | low | security | tests/storage-upload-ownership.browser.cjs:43 | hardcoded_secret | yes | reviewed_no_change |
| security:ea7c0d7d33c0b03267fb963c | low | security | tests/storage-upload-ownership.browser.cjs:43 | hardcoded_secret | yes | reviewed_no_change |
| security:bea16f88d42691a26c98cec7 | low | security | tests/storage-upload-ownership.browser.cjs:46 | hardcoded_secret | yes | reviewed_no_change |
| security:c9c6ceed56584b0d0f74a14a | low | security | tests/student-read-ownership.browser.cjs:23 | hardcoded_secret | yes | reviewed_no_change |
| security:0aa5e6ed95f04b0ee1433e90 | low | security | tests/student-read-ownership.browser.cjs:25 | hardcoded_secret | yes | reviewed_no_change |
| security:d2163c49fae3c31e3809a566 | low | security | tests/student-read-ownership.browser.cjs:39 | hardcoded_secret | yes | reviewed_no_change |
| security:5ca789d5fa40b70bdced4d78 | low | security | tests/student-read-ownership.browser.cjs:41 | hardcoded_secret | yes | reviewed_no_change |
| dead_code:96bb904c466709ce59c99bf9 | unrated | dead_code | js/app/00-storage-sync-patches.js:388 | closeSettingsDrawer / unused_internal | yes | reviewed_no_change |
| dead_code:d4ef341211b3f20b52044da4 | unrated | dead_code | js/app/00-storage-sync-patches.js:1932 | clearWftLocalCache / unused_internal | yes | reviewed_no_change |
| dead_code:bbaf4fa0b4887da4c6353791 | unrated | dead_code | js/app/00-storage-sync-patches.js:1980 | wftPromiseCallback / unused_internal | no | fixed_verified |
| dead_code:a996a3bd24f5f52a11a88cf8 | unrated | dead_code | js/app/00-storage-sync-patches.js:1984 | savePortfolioAsync / unused_internal | yes | reviewed_no_change |
| dead_code:b1056e3a6024464b5dd96865 | unrated | dead_code | js/app/00-storage-sync-patches.js:3588 | showDriveDisconnectedState / unused_internal | no | fixed_verified |
| dead_code:9ed1c00c05745426c83402f2 | unrated | dead_code | js/app/00-storage-sync-patches.js:6453 | stripPortfolioImageDataUrls / unused_internal | yes | reviewed_no_change |
| dead_code:29b3767245d590cc9c0aff38 | unrated | dead_code | js/app/00-storage-sync-patches.js:6586 | getSessionPlainCorrectedText / unused_internal | no | fixed_verified |
| dead_code:6fd854b95a9a8e1fb09452b8 | unrated | dead_code | js/app/00-storage-sync-patches.js:6885 | toggleRosterVisibility / unused_internal | yes | reviewed_no_change |
| dead_code:8c4649f3df792f5b02d0edf8 | unrated | dead_code | js/app/00-storage-sync-patches.js:8047 | showDiffView / unused_internal | yes | reviewed_no_change |
| dead_code:81444af29b2c7901d4e2f997 | unrated | dead_code | js/app/10-main-app.js:110 | updateSelectedStudent / unused_internal | yes | reviewed_no_change |
| dead_code:81f6015ac175b6d3bcec9434 | unrated | dead_code | js/app/10-main-app.js:322 | manageSelectedStudent / unused_internal | yes | reviewed_no_change |
| dead_code:fed5a743e627ead83760517c | unrated | dead_code | js/app/10-main-app.js:453 | exportStudents / unused_internal | yes | reviewed_no_change |
| dead_code:9d75931b1c8bab4f0aa65bca | unrated | dead_code | js/app/10-main-app.js:1159 | isWordToken / unused_internal | no | fixed_verified |
| dead_code:f421a2898f25969c27f3ebe9 | unrated | dead_code | js/app/10-main-app.js:1163 | isNewlineToken / unused_internal | no | fixed_verified |
| dead_code:9ff2290b78ea0c845fb65bbc | unrated | dead_code | js/app/10-main-app.js:1167 | isPunctuationToken / unused_internal | no | fixed_verified |
| dead_code:ffa5118598342feda92f942a | unrated | dead_code | js/app/10-main-app.js:1171 | levenshteinDistance / unused_internal | no | fixed_verified |
| dead_code:9e9991881b9480a1139c8285 | unrated | dead_code | js/app/10-main-app.js:3086 | moveDuplicateSyncFilesToBackup / unused_internal | yes | reviewed_no_change |
| dead_code:5157e2be2f285b3fe0d88970 | unrated | dead_code | js/app/10-main-app.js:5550 | inferWritingGenre / unused_internal | no | fixed_verified |
| dead_code:f9f6e9cbbd9b4c29526c67ba | unrated | dead_code | js/app/10-main-app.js:6054 | wrapCorrectedHtmlForNotebookPrint / unused_internal | no | fixed_verified |
| dead_code:78e142a25a36d5a12768970a | unrated | dead_code | js/app/10-main-app.js:6321 | getNotebookDecisionFocusText / unused_internal | no | fixed_verified |
| dead_code:40d6aafd4be5f1d995bbeb06 | unrated | dead_code | js/app/10-main-app.js:6623 | getNotebookGuideSentenceStarter / unused_internal | no | fixed_verified |
| dead_code:5e39a7b5baa3b7f5b489d741 | unrated | dead_code | js/app/10-main-app.js:8366 | clearWritingArea / unused_internal | yes | reviewed_no_change |
| dead_code:fac391cf5eae4325c6a8fe33 | unrated | dead_code | js/app/99-lightbox.js:2 | openImageLightbox / unused_internal | yes | reviewed_no_change |
| dead_code:23339cdb528915be789a74e4 | unrated | dead_code | js/app/storage-recovery.js:16 | generateWFTShortId / unused_internal | no | fixed_verified |
| dead_code:5ebe6bb7152d3166eef9f0e3 | unrated | dead_code | js/app/storage-recovery.js:129 | toggleWftSafeMode / unused_internal | yes | reviewed_no_change |
| dead_code:8fdd2d90552f9bcdd818b083 | unrated | dead_code | test-google-drive-migration.cjs | unreachable_file | yes | reviewed_no_change |
| performance:perf3_dd259a208bc4451f767c | unrated | performance | google-drive-migration.js | google-drive-migration.js::read / io_in_loop | yes | reviewed_no_change |
| performance:perf3_6c4aaefa84bb482f1ec3 | unrated | performance | google-drive-migration.js | google-drive-migration.js::recoverFolder / io_in_loop | yes | reviewed_no_change |
| performance:perf3_6e6ddf87f62d29bfa493 | unrated | performance | google-drive-migration.js | google-drive-migration.js::list / io_in_loop | yes | reviewed_no_change |
| performance:perf3_8ebd9ff3c127370c15cc | unrated | performance | google-drive-migration.js | google-drive-migration.js::upload / io_in_loop | yes | reviewed_no_change |
| performance:perf3_49529186b645c93019e8 | unrated | performance | js/app/00-storage-sync-patches.js | js/app/00-storage-sync-patches.js::renderPortfolioFeedbackRows / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_a4d2be4d77ece65e1e3b | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderTeacherAuditView / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_52e43eaf91397530b3f3 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::requestOpenRouterWithFallback / io_in_loop | yes | reviewed_no_change |
| performance:perf3_a3899f23a54b2f8db3a3 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderNotebookGuideExamples / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_737e6ae4d9da581782aa | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderNotebookDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_7c34c5498fe86c4a0f92 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderNotebookDetailedAssessmentFromSavedSession / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_764b74f7c90d89041f6a | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderDetailedAssessment / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_d8add35aa897ceb31f08 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderAuditValidationTable / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_a3fea29a55745adcea59 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderCorrected / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_2b3d7f9c271c220a6bea | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderAuditRowsTable / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_303d764763b0a47b561e | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::updateSelectedImagePreview / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_4958b860ea5de8b32328 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderAuditEvidenceList / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_670a5f688496691f5779 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderNotebookGuideFocusList / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_a95593e6708c46f8ac7a | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderNoticeTable / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_bc5512071d79fa7535c1 | unrated | performance | js/app/10-main-app.js | js/app/10-main-app.js::renderNotebookQuickCheckList / string_concat_in_loop | yes | needs_revalidation |
| performance:perf3_c6b5d160bd81092a4603 | unrated | performance | js/app/portfolio-export.js | js/app/portfolio-export.js::buildStudentSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| performance:perf3_4c17c1d0875c2be80d49 | unrated | performance | js/app/portfolio-export.js | js/app/portfolio-export.js::buildStudentPortfolioPhotosHtml / string_concat_in_loop | yes | reviewed_no_change |
| performance:perf3_e1174f2f7d96ea75461d | unrated | performance | js/app/portfolio-export.js | js/app/portfolio-export.js::buildClassSummaryHtml / string_concat_in_loop | yes | reviewed_no_change |
| performance:perf3_7eb9a5dfed5a434878d4 | unrated | performance | scripts/check-test-runner.cjs | scripts/check-test-runner.cjs::__module__ / io_in_loop | yes | reviewed_no_change |
| performance:perf3_84dba4db32722c23655b | unrated | performance | tests/analysis-pipeline.browser.cjs | tests/analysis-pipeline.browser.cjs::__module__ / io_in_loop | yes | reviewed_no_change |
| performance:perf3_68900cb25de5c2f8b778 | unrated | performance | tests/drive-lifecycle.browser.cjs | tests/drive-lifecycle.browser.cjs::__module__ / io_in_loop | yes | reviewed_no_change |
| performance:perf3_769dc30b84623e2d7139 | unrated | performance | tests/media-ownership.browser.cjs | tests/media-ownership.browser.cjs::__module__ / io_in_loop | yes | reviewed_no_change |
| performance:perf3_2afd767f06d0783c97ee | unrated | performance | tests/recovery-cache.browser.cjs | tests/recovery-cache.browser.cjs::__module__ / io_in_loop | yes | reviewed_no_change |
| performance:perf3_39b5fabbe5976788df09 | unrated | performance | tests/split-storage.browser.cjs | tests/split-storage.browser.cjs::runScenario / io_in_loop | yes | reviewed_no_change |
| performance:perf3_33039e5829a7d1318880 | unrated | performance | tests/storage-dialog-keyboard.browser.cjs | tests/storage-dialog-keyboard.browser.cjs::__module__ / io_in_loop | yes | reviewed_no_change |
| performance:perf3_514fa14bb37103b12e44 | unrated | performance | tests/storage-public-ui.browser.cjs | tests/storage-public-ui.browser.cjs::__module__ / io_in_loop | yes | reviewed_no_change |

## Limits

- Scanner metadata is not verification of a defect. Source and callers must be checked.
- Disappearance from a scan is not accepted as proof of resolution.
- Immutable history metrics require documented interpretation; never rewrite history to improve a score.
- Security snippets are excluded to avoid copying potential credentials.
- Full-history security scan completed; see security_history_scan and individual security outcomes.
- Coverage provenance is recorded separately; changed source files need a fresh capture. Source validation is recorded per repair/publication; live model/Drive calls were not tested.
