# Decompose the two god files (10-main-app.js + 00-storage-sync-patches.js)

> **For agentic workers:** execute task-by-task with `superpowers:subagent-driven-development` or `executing-plans`. Checkboxes (`- [ ]`) track progress.

**Goal:** Split `js/app/10-main-app.js` (~8,450 lines, 382 functions) and `js/app/00-storage-sync-patches.js` (~8,365 lines, 339 functions) into focused classic scripts by continuing the pattern this repo already uses (dialogs.js, storage-recovery.js, portfolio-export.js, photo-crop.js, 99-lightbox.js are each "one source file"), with zero behavior change.

**Architecture:** Mechanical extraction, not a rewrite. Each new file is a classic browser script of global `function` declarations loaded via an extra `<script>` tag in `index.html`, in an order that keeps every function defined before its first call. No ES modules, no bundler, no new runtime dependency, no rename, no edit to function bodies.

**Tech Stack:** Plain browser JS (globals), `index.html` script tags with `?v=` cache-busting, Playwright/Edge test runner (`scripts/run-tests.cjs`), JSZip.

## Global Constraints

- **No behavior change.** Function bodies move verbatim; only their file and load position change. `git diff` on each moved function must be pure relocation (identical source lines, different location).
- **No renames.** Global function/state names are referenced by `index.html` inline `onclick` handlers and by the 77 test suites. Names are part of the contract.
- **No modules / no build step.** The app is a static site (GitHub Pages); `index.html` loads classic scripts. Do not introduce `type="module"`, imports, or a bundler.
- **Load order is the only real risk.** Within a script, `function` declarations hoist; across scripts, a function called at load time must live in a script loaded *before* its call site. Known init-time callers live at the bottom of `10-main-app.js` (`updateAnalyzeBtnState()`, `updateSyncPortfolioButtonState()`, `updateMeter()`, `GRADE_PROFILES[n] = makeGradeProfile(...)`). Rule: **every extracted file is loaded before `10-main-app.js`.**
- **Node VM suites extract functions by name from one file.** Non-browser `tests/*.cjs` suites `read('js/app/10-main-app.js')` and pull each function via `lastIndexOf('function ' + name + '(')` — they bypass `index.html`, so a moved function breaks them even when the browser suites stay green. Every extraction must update any `tests/*.cjs` that reads the file a function moved out of: add `read('<new-file>')` and a `load(ctx, <new-source>, [...])` for the moved names (see `record-identity.cjs` as the reference example).
- **Every step is gated by the full suite.** `node scripts/run-tests.cjs --out ./test-results` must exit 0 with 77/77 suites passing, before and after every extraction. A load-order or relocation mistake fails suites immediately (the browser harness asserts `pageerror` is empty).
- **One PR per extraction**, squash merge, branch name `codex/<topic>-<date>` (matches the repo's own `GITHUB_UPDATE_GUIDE.md`).
- **Update `docs/script-locations.md`** on every extraction — the repo treats it as the source of truth for script locations (per README).
- **Version query string:** each new `<script src="...">` gets `?v=decompose-20261016`; bump the version tag of any file whose *contents* changed to force cache refresh.

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

## Phase 3 — Two sub-phases, sequenced by risk (revised after audit)

The original Task 6-9 list assumed Drive plumbing was one contiguous cut; it is not. The sync region is five contiguous blocks, and the notebook work is feature-scoped (lower risk) while the sync/Drive work is the churn center (high blast radius). Sequence them separately.

### Gating rules (run before every cut)

- **Churn gate:** `git log --since="30 days" --oneline -- <file> | wc -l`. If >= ~40 commits/30 days, skip the file — you are cutting a moving target. This rule forced the original deferral and stays in force.
- **Blast-radius scan:** `grep -rln <each moved fn> tests/*.cjs | grep -v '\.browser'`. Distinct non-browser suites referencing the cluster's functions = rewiring cost. If > 2, do it as its own dedicated PR, never stacked.
- **Pure-relocation check** (`git diff --numstat` = `0 N`) and **full 77/77 gate** after every cut — unchanged from Phases 1-2.

### Corrected cluster map (`00-storage-sync-patches.js`)

| cluster | lines | functions | blast radius |
|---|---|---|---|
| Drive JSON I/O | 4626-4847 | 9 (download/upload/merge/duplicate) | low (to confirm) |
| Drive transport | 3520-4053 | 19 (fetch/cache/folder/save) | medium |
| Fingerprint/snapshot | 4054-4178 | 12 (hash/clone/snapshot) | high — 9 suites |
| Deletions/tombstones | 4179-4570 | 14 | high |
| Sync orchestration | 4581+ | mark*/schedule/flush/sync*IfNeeded | highest — do NOT extract |

Line numbers are from the post-Phase-2 tree and drift as churn continues; re-derive them with the function inventory before every cut.

### Phase 3a — Notebook (do first, lowest risk, from `10-main-app.js`)

Split the ~2,100-line notebook feature into 2-3 coherent cuts (title/genre detection → guide building → guide rendering/printing), each its own PR. `record-identity.cjs` pulls `titleCaseGeneratedWritingTitle`, so expect one harness update.

### Phase 3b — Sync/Drive/portfolio (gated, from `00-storage-sync-patches.js`)

In risk order, only after the churn gate passes:

1. Drive JSON I/O.
2. Drive transport.
3. Fingerprint/snapshot — one dedicated PR, all 9 harness updates together.
4. Deletions/tombstones — only if churn has genuinely settled.
5. Portfolio render (UI-focused, last).

**Never extract** the sync orchestration core (`mergeWft*`, `syncWft*IfNeeded`, `flushWftCloudSyncNow`, `scheduleWftCloudSync`).

### Per-step procedure (unchanged)

audit boundary + top-level vars → byte-exact cut (`extract_range.py`) → `numstat 0 N` → update any VM harness by name/range → full suite → squash-merge. One PR per cluster, `codex/<topic>-<date>` branch.

### Stop conditions

- Churn gate fails → stop the whole phase, not just the cluster.
- Any cut needs > 2 harness rewires → halt and reconsider whether the navigability gain is worth it.

---

## Acceptance criteria (whole plan done)

- [ ] Both files are each < ~3,000 lines, with no function remaining that belongs to an extracted cluster.
- [ ] `node scripts/run-tests.cjs --out ./test-results` = 77/77 pass, exit 0, identical to the Phase-0 baseline pass set.
- [ ] `index.html` loads every new file before `10-main-app.js`; `docs/script-locations.md` lists all of them.
- [ ] `repowise update` shows the two files' `at_risk` band has shifted toward the tail — per-file health up, no new open findings from the moves (findings must not increase on a pure relocation).
- [ ] No new runtime dependency; `package.json` unchanged.

## Self-review

- **Spec coverage:** every cluster in the two inventories is assigned a target file (Tasks 1-9). Load-order risk is covered by the Phase-0 rule + Task-1 Step-1 grep + the full-suite gate on every task.
- **Placeholder scan:** no TBDs; every task names exact files, functions, and commands. Function boundaries within a cluster are intentionally resolved by the Step-1 caller grep (the suite is the backstop), not left vague.
- **Type/name consistency:** moved names are copied verbatim from the inventories; no renames anywhere, so cross-task references cannot drift.

## Execution handoff

Recommended: execute **Phase 1 only** first (2 low-risk extractions, ~4-6 hours total including suite runs), reassess against the churn rate, then continue. Do not batch Phases 2-3 until Phase 1 proves the mechanism and the file churn has settled — the sync/auth/portfolio cluster is the busiest code in the repo and is where a botched extraction would cost the most.
