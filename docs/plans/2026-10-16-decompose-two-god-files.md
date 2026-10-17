# Decompose the two god files (10-main-app.js + 00-storage-sync-patches.js)

> **Status, 17 October 2026 (Asia/Bangkok):** Phases 1-2 are complete. Their original procedures below are historical; do not rerun them. Phase 3 and the constraints/acceptance criteria are revised after the independent audit. Michael requested this documentation update only; implementation has not been authorized in this chat.

**Goal:** Improve navigation and ownership through a small number of coherent classic scripts, with zero behavior change. Phases 1-2 relocated 85 functions into six scripts. The remaining Phase 3 proposal is one bounded title-handling extraction from `js/app/10-main-app.js`, followed by reassessment. Further sync/Drive decomposition and file-length targets are outside its scope.

**Architecture:** Mechanical extraction, not a rewrite. Each new file is a classic browser script of global `function` declarations loaded via an extra `<script>` tag in `index.html`, in an order that keeps every function defined before its first call. No ES modules, no bundler, no new runtime dependency, no rename, no edit to function bodies.

**Tech Stack:** Plain browser JS (globals), `index.html` script tags with `?v=` cache-busting, Playwright/Edge test runner (`scripts/run-tests.cjs`), JSZip.

## Global Constraints

- **No behavior change.** Function bodies move verbatim; only their file and load position change. `git diff` on each moved function must be pure relocation (identical source lines, different location).
- **No renames.** Global function/state names are referenced by `index.html` inline `onclick` handlers and by the 77 test suites. Names are part of the contract.
- **No modules / no build step.** The app is a static site (GitHub Pages); `index.html` loads classic scripts. Do not introduce `type="module"`, imports, or a bundler.
- **Preserve declaration availability and execution order.** Function declarations hoist within their own script, not across scripts. Load each extracted script before its earliest caller, ordinarily before its original owner; being before `10-main-app.js` alone is insufficient for a storage-file extraction. Separately inventory top-level declarations, assignments, wrappers and initialization-time calls. Keep state initialization at its original execution point unless a separately reviewed change proves parity. Browser tests help detect mistakes but cannot prove every path is covered.
- **Measure actual source dependencies in test harnesses.** Some VM suites extract named functions, others slice ranges or evaluate a whole file. Search references, then inspect loaders and slice delimiters across tests and scripts, including browser-labelled files. Count only harnesses whose source loading must change; a stub or runtime call is not a rewire. Update affected loaders without replacing real implementations with new stubs or weakening assertions. See `tests/record-identity.cjs` as a named-extraction example.
- **Every extraction is gated by the full current suite.** `node scripts/run-tests.cjs --out ./test-results` must exit 0 before and after the move. Compare suite identities and required case reports against a baseline captured on the exact implementation base. The audit snapshot had 77 suites and 91 syntax inputs; extra scripts increase the syntax inventory, so require zero syntax failures rather than freezing its count. Preserve browser `pageerror` assertions.
- **One PR per extraction**, squash merge, branch name `codex/<topic>-<date>` (matches the repo's own `GITHUB_UPDATE_GUIDE.md`).
- **Update `docs/script-locations.md`** on every extraction — the repo treats it as the source of truth for script locations (per README).
- **Version query string:** use a fresh extraction-specific `?v=` value for the new script and every changed existing script. The `decompose-20261016` values in the historical procedures record earlier work; do not reuse an existing value for newly changed contents.

---

## Phase 0 — Baseline and safety

### Task 0: Golden baseline

**Files:**
- Read: `index.html:3762-3796` (script order), `docs/script-locations.md`

- [ ] **Step 1: Record the golden pass**

```bash
node scripts/run-tests.cjs --out ./test-results
```

Expected: exit 0, `77/77` suites pass, `0` syntax failures. Save the checksum of the report:

```bash
sha256sum ./test-results/suite-results.json > /tmp/wft-baseline.sha256
```

- [ ] **Step 2: Confirm the load order you must preserve** (from `index.html`):

```
google-drive-migration.js
js/app/dialogs.js
js/app/storage-recovery.js
js/app/00-storage-sync-patches.js   ← storage/sync/auth/portfolio (file A)
js/app/portfolio-export.js
js/app/10-main-app.js               ← analysis/UI/notebook (file B)
js/app/photo-crop.js
js/app/99-lightbox.js
```

- [ ] **Step 3: Commit nothing yet.** Phase 0 produces no diff; it is the safety reference.

---

## Phase 1 — Leaf extractions (pure functions, lowest risk)

Do these two first. They prove the mechanics cheaply before touching the churn center.

### Task 1: Extract the text-metrics cluster from `10-main-app.js`

**Files:**
- Create: `js/app/20-text-metrics.js`
- Modify: `js/app/10-main-app.js` (delete the moved block)
- Modify: `index.html` (add one `<script>` tag before line 3767)
- Modify: `docs/script-locations.md`

**Functions to move** (top-level `function` declarations, contiguous blocks; verify each with the caller check in Step 1):
- `countWords`, `countBoldedSegments`, `stripCorrectionMarkdown`, `splitSentences`, `getSentenceLengths`, `analyzeSentenceStarters`, `getShortSentenceRun`, `analyzeSentenceVariety`, `buildComputedFlowTip`, `roundToNearestRubric`, `calculateWordCountAdjustment`, `grammarDensityBand`, `computeOverallScore` (lines ~1362-1660).

- [ ] **Step 1: Verify no load-time caller (the only hard rule)**

```bash
# None of these names may appear in a top-level call statement or the init block:
grep -nE 'updateMeter\(|updateAnalyzeBtnState\(|updateSyncPortfolioButtonState\(' js/app/10-main-app.js
# Confirm the moved functions are only called from *function bodies*, not at top level:
for f in countWords splitSentences analyzeSentenceVariety computeOverallScore grammarDensityBand calculateWordCountAdjustment; do
  echo "== $f =="; grep -nE "(^|[^.])$f\(" js/app/10-main-app.js js/app/00-storage-sync-patches.js js/app/portfolio-export.js
done
```

Expected: every hit is inside another function or an event handler, never a bare top-level statement.

- [ ] **Step 2: Move the functions** (cut from `10-main-app.js`, paste into `20-text-metrics.js`, bodies byte-identical — no reformatting, no renames).

- [ ] **Step 3: Add the script tag** in `index.html`, immediately before `js/app/10-main-app.js`:

```html
<script src="js/app/20-text-metrics.js?v=decompose-20261016"></script>
```

- [ ] **Step 4: Run the full suite**

```bash
node scripts/run-tests.cjs --out ./test-results
```

Expected: exit 0, 77/77 pass — identical to baseline. If anything fails, `git checkout -- js/app/10-main-app.js js/app/20-text-metrics.js index.html` and re-check Step 1.

- [ ] **Step 5: Verify the move was pure relocation**

```bash
git diff --stat js/app/10-main-app.js     # deletions only
git diff js/app/10-main-app.js | grep '^-[^-]' | grep -vE '^\-\s*//'   # removed lines should equal the moved functions, nothing else
```

- [ ] **Step 6: Commit and open PR**

```bash
git checkout -b codex/text-metrics-extract-20261016
git add js/app/20-text-metrics.js js/app/10-main-app.js index.html docs/script-locations.md
git commit -m "Extract text-metrics cluster into 20-text-metrics.js"
git push -u origin HEAD && gh pr create --base main --title "Extract text-metrics into its own script" --body "..."
gh pr merge --squash --delete-branch
```

### Task 2: Extract the diff/correction engine from `10-main-app.js`

Same five steps as Task 1, with:

**Create:** `js/app/21-diff-engine.js`

**Functions to move** (lines ~1145-1361): `normalizeDiffToken`, `tokenizeForDiff`, `buildLcsMatrix`, `markChangedTokens`, `shouldHighlightCorrectionToken`, `hasCorrectionMarkdown`, `normalizeCorrectionMarkup`, `plainTextToStoryHtml`, `splitStoryTitleAndBody`, `buildStoryHtmlWithTitle`, `renderSimpleMarkdown`, `renderCorrectionInline`, `renderCorrectionMarkdown`, `buildMinimalCorrectionMarkup`, `tokenNeedsLeadingSpace`, `renderCorrected`.

**Script tag** before `10-main-app.js` (and after `20-text-metrics.js` if Task 1 already landed):

```html
<script src="js/app/21-diff-engine.js?v=decompose-20261016"></script>
```

Gate: full suite 77/77. PR branch `codex/diff-engine-extract-20261016`.

---

## Phase 2 — Medium coupling (clusters with external-service or parsing logic)

### Task 3: Extract the OpenRouter client from `10-main-app.js`

**Create:** `js/app/22-openrouter-client.js` — `sleepMs`, `buildFallbackModelList`, `isRetryableOpenRouterStatus`, `summarizeOpenRouterFailure`, `normalizeOpenRouterError`, `parseOpenRouterResponse`, `requestOpenRouterWithFallback`, `callOpenRouter`, `callOpenRouterImage` (lines ~2675-2890).

Note: these call nothing at init time; they are only invoked by `analyzeWriting` and OCR, both event-time. Still gate on the full suite.

### Task 4: Extract feedback parsing + wording from `10-main-app.js`

**Create:** `js/app/23-feedback-wording.js` — `softenOverclaim`, `toOneSentence`, `teacherizeWording`, `detectConventionIssues`, `buildConventionReason`, `buildConventionEvidence`, `buildConventionGrowthTip`, `getDiffOperations`, `analyzeGrammarChanges`, `buildGrammarReasonFromData`, `buildGrammarEvidenceFromData`, `buildFlowReasonFromData`, `buildFlowEvidenceFromData`, `buildGrammarScoreBasis`, `buildGrammarPatternNotes`, `renderNoticeTable`, `normalizeNoticeRows`, `polishFeedback`, `softFallback`, `parseStep1`, `parseStep2QuickRubric`, `extractScoreNearLabel`, `parseWhatINoticedRowsFromBody`, `parseDetailedAssessment`, `applyWordCountToIdeas`, `flowScoreCap`, `getDominantSentenceBand`, `flowCommentMentionsFalseShortProblem`, `sanitizeFlowCommentForData`, `buildComputedFlowQuickNote`, `buildFlowPatternSummary`, `buildFlowPatternNotes`, `applyComputedFlowToFlow`, `applyOrganizationFallback` (lines ~1677-2690 minus Task 3's range).

### Task 5: Extract neatness scoring from `00-storage-sync-patches.js`

**Create:** `js/app/10-neatness.js` — `assessNeatnessFromImage`, `parseNeatnessSubScore`, `parseNeatnessSourceType`, `parseNeatnessSourceReason`, `buildUnscoredNeatnessResult`, `calculateWeightedNeatnessFive`, `convertNeatnessFiveToTen`, `buildNeatnessScoreMetrics`, `buildMissingNeatnessResult`, `parseNeatnessFallback`, `parseMatchedNeatnessRubric`, `parseNeatnessAssessmentResponse` (lines ~705-1077).

**Script tag** must load **before** `00-storage-sync-patches.js` (it came from that file and may be called by it), i.e. insert before line 3765.

---

## Phase 3 — One optional title-handling extraction, then reassess

### Audit basis and current status

Revised on 17 October 2026 (Asia/Bangkok) at Michael's request, following the independent audit in this Codex chat. Source and git history were checked at committed HEAD `3382b2e`; Repowise's stored analysis was at `53bb1fb`, with semantic search disabled. Repowise scores and relationship counts are historical evidence, not fresh verification of the working tree.

The checkout contained unrelated edits to `js/app/00-storage-sync-patches.js` and `tests/record-identity.cjs`. This plan update leaves them untouched. Before later implementation, establish an isolated working copy at the intended base and resolve overlap with their owner; do not reset or absorb another task's work.

The audit ran the main-app browser health suite (171 checks), browser neatness integration, and neatness parser/scoring tests successfully. It did not rerun the full 77-suite gate or exercise live Drive/OpenRouter services. These focused passes are not an implementation baseline for a future extraction.

### Proposed scope

One PR to move the title-handling block from `js/app/10-main-app.js` into a proposed `js/app/25-writing-titles.js`. At the audited HEAD it is approximately 171 physical lines, bounded by `normalizeSuggestedTitle` and the end of `getWritingTitle`, before `cleanNotebookSentence`.

Move exactly these nine declarations, with byte-identical function source:

- `normalizeSuggestedTitle`
- `titleCaseGeneratedWritingTitle`
- `looksLikeProseLine`
- `isTitleCaseish`
- `isLikelyStandaloneTitle`
- `extractWritingTitleParts`
- `getObviousWritingTitle`
- `getPreferredWritingTitle`
- `getWritingTitle`

Leave `latestAnalysisData` and all other state initializers in their current execution positions. Load the new declaration-only classic script immediately before `10-main-app.js`, after verifying all callers. Preserve global names and signatures.

Expected future file changes: the new script, `js/app/10-main-app.js`, `index.html`, `docs/script-locations.md`, and `tests/record-identity.cjs`. The one expected harness rewire is its extraction of `titleCaseGeneratedWritingTitle`; recheck the complete source-consumer inventory on the implementation base.

After that PR is validated and reviewed, reassess whether navigation actually improved. Do not automatically proceed to genre handling, guide construction, printing, portfolio rendering, or another extraction. Completing this one cut, or deciding from its preflight that it is not worthwhile, closes this Phase 3 scope without a file-length target.

### Unified preflight and stop rules

- **Authorization:** this revision is documentation only. Do not execute any extraction until Michael requests implementation.
- **Overlap:** pause this candidate if another task is changing its functions, callers, initialization dependencies, or required harness. Isolate the work; never discard unrelated edits.
- **Churn:** measure the source file's last 30 days and compare recent weekly activity, then inspect history of the actual cluster. At audit time storage had 70 commits/30 days and main had 60. The former absolute threshold of about 40 would block both; it is removed. Mechanical campaign commits and unrelated file changes are not evidence that a particular cluster is unsafe. A falling trend is useful context, not proof of safety.
- **Dependency cost:** search references, then inspect named extraction lists, range delimiters and whole-file evaluators. Do not equate stubs with rewires or exclude browser-labelled consumers blindly. The current proposal expects one rewire. If there are more than two actual harness rewires, pause and revise this candidate's cost/benefit before implementation; a dedicated PR alone is not an exception. Pausing one candidate does not create a whole-project stop.
- **Boundary and state:** verify all nine functions remain a coherent declaration-only block. Pause if preserving behavior requires moving state initializers, changing bodies, introducing helpers, or widening the cut.
- **Baseline:** a failing full-suite baseline blocks this extraction until its failure is understood. A regression after the move blocks publication; a passing suite does not replace exact-source and initialization review.

### Future implementation procedure

1. Record the exact base revision, clean isolated working-copy status, cluster inventory, callers and actual harness dependencies. Capture a full-suite baseline on that base.
2. Move only the nine declarations; preserve their exact source bytes. Review top-level declaration/assignment order separately. Add the script tag and fresh cache-busters for both new and changed script contents.
3. Update the affected VM loader and `docs/script-locations.md`. Retain existing assertions and use the shipped implementation rather than new stubs.
4. Compare every moved function's source before and after, including its signature and body. Check for missing or duplicate declarations and unintended changes in the original file. Include new/untracked destination files in the review. `git diff --numstat` is a summary only: deletions in the old file do not prove an exact move.
5. Run the full current suite and require exit 0, no failed required case reports, no lost baseline suites, and zero syntax failures. Inspect startup/browser errors and title behavior. Record results against the exact final diff.
6. Review one PR using `codex/<topic>-<date>` naming. Do not bundle cleanup or begin another extraction. Publishing or merging follows the user's authorization and repository workflow; this document is not an instruction to do either now.

### Storage/sync inventory — reference only, outside the proposed scope

These ranges refer to committed `3382b2e`, not the dirty working tree. Names and source boundaries must be reverified if revisiting them.

| Block | Committed lines | Actual membership | Audit disposition |
|---|---|---|---|
| Drive transport | 3520-4053 | 19 functions, `captureWftArchiveConnection` through `saveFileToDrivePromise` | Contiguous; outside scope. One direct source-extraction harness identified (`drive-folder-selection.cjs`), not every reference-bearing suite. |
| Fingerprints/snapshots | 4054-4178 | 12 functions, `stableStringify` through `getLocalPortfolioSnapshot` | Drop from this phase: four actual VM harness rewires for a small block. |
| Deletions/tombstones | 4179-4570 | 18 functions, `getEmptyDeletionsData` through `saveDeletionsLocalOnly` | Not a safe generic deletion cut: contains transaction/recovery coordination and a merge function. |
| Deletion counts | 4571-4578 | `getWftDeletionCounts` | Immediately adjacent; including it makes 19 deletion-region functions, not 14. |
| Dirty flags/queue | 4581-4625 | Five functions, `markWftSettingsDirty` through `flushWftCloudSyncNow` | Contiguous small seam; retain with sync because its navigation benefit is marginal. |
| Drive JSON/duplicates | 4626-4847 | Nine functions, `escapeDriveQueryValue` through `downloadAndMergeDuplicateSettings` | Contiguous; outside scope. Three non-browser suites reference it, but only `portfolio-sync.cjs` extracts a moved implementation. |

The four fingerprint source consumers are `tests/deletion-merge.cjs`, `tests/portfolio-sync.cjs`, `tests/record-identity.cjs`, and `tests/settings-deletions-sync.cjs`. The former count of nine included five suites supplying stubs. These are audit-time counts, not substitutes for a new loader review.

There is no single contiguous "orchestration starts at 4581+" region: queue helpers, Drive JSON functions and later merge/sync logic are interleaved. The deletion block includes `saveWftStudentChange` (writes, rollback, recovery and postcommit publication) and `mergeWftDeletions`. A blanket deletion cut would move code the old retention rule said to keep.

For this phase, retain `saveWftStudentChange`, `mergeWft*`, `syncWft*IfNeeded`, `syncWftNow`, `scheduleWftCloudSync`, and `flushWftCloudSyncNow`, along with their state initialization and wrappers. This is a scope decision, not a claim that no future seam can exist. The three `markWft*Dirty` functions could move mechanically, but about 18 lines do not justify an extra script now.

### Other candidates — require separate planning, not automatic follow-on work

- **Teacher-audit display:** 14 functions, about 215 lines, `getAuditScoreBandLabel` through `renderTeacherAuditView`; no direct VM extraction rewires identified. A coherent alternative if navigation there becomes a real problem.
- **Notebook guide rendering:** eight functions, `getNotebookGuideIntro` through `renderNotebookGuideHtml`; no direct VM extraction rewires identified. Keep fallback-builder/global dependencies explicit; a small file is not itself a benefit.
- **Genre handling:** no direct VM extraction rewires identified, but shared with analysis, reassessment and OAuth draft restoration. Inventory `currentWritingGenreInfo` and `manualGenreOverrideValue`; do not label it notebook-only or move their initializers casually.
- **Image compression:** three functions plus two configuration initializers form a small region, but it handles fallback/error paths and remains outside this phase.
- **Small reuse cleanup:** emergency backup's six-key metadata exclusion duplicates `isWftPortfolioStudentKey`. Reusing the existing helper with its VM fixture updated is a separate behavior-preserving cleanup candidate, not part of a relocation PR.

Keep guide building, printing/reassessment orchestration, portfolio rendering, Drive transport/JSON, deletions and fingerprints outside the proposed extraction. Revisit only for a concrete maintenance need with a separately reviewed scope.

### Corrected remaining-repair record

The handoff's repair list was stale relative to its own HEAD. Git history between Repowise's indexed `53bb1fb` and audited `3382b2e` contains:

| Handoff item | Verified state at audit |
|---|---|
| `teacherizeWording` | Changed in PR #201 (`516533e`); do not repeat the old recommendation. |
| `buildWftEmergencyBackupObject` | Changed in PR #202 (`776646a`), introducing `parseWftBackupKey`. |
| `summarizeOpenRouterFailure` | Changed in PR #203 (`19ed8ac`). |
| Anonymous preview reorder condition | Changed in PR #204 (`7813ded`), introducing `isInvalidPreviewReorderIndex`. |
| Claimed `normalizeWftPortfolioForSchemaV1` finding | Misidentified: Repowise's fifth stored item targets the anonymous image-compression callback inside `resizeImageDataUrlToBlob`, not normalization. |

The image callback includes real fallback and error handling; leave it unless a separate proposal makes those paths clearer without losing their behavior. Do not act on the normalization recommendation using this finding's identity. Existing normalization edits belong to other work and are not adjudicated or included by this plan.

Repowise's "71 changes" and "10 importers" describe the storage file, not that function. File-level coverage does not prove coverage of an individual change, and estimated health gains are not confirmed bugs or guaranteed improvements. These five entries are not an exhaustive backlog. Before comparing health after any future source change, refresh the index against the intended committed revision when no competing refresh is running, verify the analyzed revision, and match findings by function identity rather than disappearing paths.

### Load-order result retained from the audit

`index.html` correctly loads `10-neatness.js` before `00-storage-sync-patches.js`. The extracted neatness file contains declarations, and no missed initialization-time caller was found; its main entry runs during analysis. Preserve that order. Future script moves still require an explicit earliest-caller and state-initialization review.

---

## Acceptance criteria (revised remaining scope)

- [ ] The title candidate's preflight records a concrete navigation benefit, exact base, callers, state constraints and actual harness cost; overlapping work is isolated. If preflight rejects the candidate, record the reason and close this phase without inventing a replacement extraction.
- [ ] If implemented, exactly the nine listed title functions move once, with byte-identical function source, unchanged names/signatures and unchanged state-initialization order. No cleanup or behavior change is bundled.
- [ ] The full current test gate passes before and after implementation on the recorded revisions, with no missing baseline suites or failed required case reports, zero syntax failures, and retained browser error assertions.
- [ ] `index.html` places the new script before its earliest caller; fresh cache-busters cover changed script contents; `docs/script-locations.md` and the affected harness match the final locations.
- [ ] No runtime dependency, module system, build step or data-format change is introduced; dependency manifests remain unchanged.
- [ ] The reviewed result documents the navigation benefit and then stops. Neither file length nor a higher Repowise score is a completion requirement. Source relocation does not resolve retained complexity findings by itself.

## Execution handoff

This revision changes the plan only. Phases 1-2 remain complete; do not replay their historical commands. If Michael later requests implementation, begin with the title candidate's preflight and one bounded PR, then reassess. There is no queued Phase 3b sync campaign, automatic merge instruction, or requirement to shrink either owner file below 3,000 lines.
