# UI/UX Repairs Implementation Plan

> Execute with Superpowers subagent-driven-development for independent domains and inline execution for coupled shared files. Each finding gets regression verification and independent review before release.

Goal: Fix all 20 approved P1-P3 audit findings and deploy the reviewed result.
Architecture: Existing classic JavaScript modules and native HTML/CSS. Small shared draft/dialog/loading helpers only where repeated callers need them. No new dependencies.
Tech stack: Browser JavaScript, HTML/CSS, existing Node/Playwright assertion suites.
Spec: docs/superpowers/specs/2026-10-31-ui-ux-repairs-design.md

Global constraints: American English; preserve rubric and identity semantics; retain save-failure guards; synthetic tests; no real student/paid AI/cloud writes; no framework rewrite; each finding independently reviewed; merge/deploy authorized by current user.
Review focus: stale student/source/async owners; raw draft storage failure and multi-tab conflict; keyboard focus after close and nested dialogs; narrow/tall images, zoom and interrupted touch; real print and lazy-library failure states.

For each task: read traced callers, add a failing behavior regression, run RED, implement minimum complete repair, run focused GREEN/regressions, independent review, correct confirmed findings, then commit. Run the broad baseline against unchanged snapshot concurrently; run full final suite after integration. Record each finding separately even when shared code fixes several.

- [x] Task 1 / finding 01: Drafts and Undo. Files: new js/app/writing-drafts.js if warranted; main/storage/portfolio-export ownership and mutation paths; index script/UI; tests/draft-preservation.browser.cjs. Exact-text reload, owner switching, replacement/Undo, reassessment/OAuth, failures/deletions/multi-tab.
- [x] Task 2 / finding 02: Settings focus lifecycle. Files: dialogs.js, storage drawer functions, index markup; tests/ui-dialogs.browser.cjs. Hidden closed state, entry/contain/return/Escape, save-failure guard.
- [x] Task 3 / finding 03: Portrait crop fit and interrupted gestures. Files: photo-crop.js, crop CSS; tests/crop-accessibility.browser.cjs. All bounds reachable at 1280x720, mobile/rotation, cancel/blur.
- [x] Task 4 / finding 04: Image keyboard operation. Files: main/storage thumbnail renderers, photo-crop.js/index bounds controls; same crop tests. Keyboard enlarge/select/apply/cancel.
- [x] Task 5 / finding 05: Every dialog uses consistent focus behavior. Files: dialogs.js, lightbox, crop, feedback modal; ui-dialogs tests. Nested/safe cancellation and return.
- [x] Task 6 / finding 06: Names/state. Files: index and view/disclosure/diff handlers; tests/ui-accessibility.browser.cjs. Stable names, current/pressed/expanded updates, clickable checkbox label.
- [x] Task 7 / finding 07: Contrast. Files: semantic CSS/dialog tokens; accessibility tests compute actual enabled-state colors and compositing. Normal text>=4.5:1; disabled excluded.
- [x] Task 8 / finding 08: OCR feedback. Files: index status markup, main setter/errors; accessibility tests for persistent status/alert semantics and field association.
- [x] Task 9 / finding 09: Chart alternatives. Files: portfolio renderer; tests/portfolio-ux.browser.cjs. Named canvas, chronological accessible values/summary, non-color series differentiation.
- [x] Task 10 / finding 10: Setup/privacy/help. Files: index/main readiness state/privacy.html links; tests/teacher-flow.browser.cjs. Empty/mobile/actionable setup, optional Drive.
- [x] Task 11 / finding 11: Task hierarchy. Files: index/main UI state/CSS; teacher-flow tests and browser screenshots at phone/desktop/zoom. Quiet empty output; useful action availability.
- [x] Task 12 / finding 12: Local/cloud state and recovery. Files: main/storage/index; teacher-flow tests for signed out/offline/pending/error/success. No false synced claims.
- [x] Task 13 / finding 13: Roster/admin empty states and destructive scope labels. Files: index/main/portfolio renderer; teacher-flow tests for no roster/no selection/no sessions/loading/unavailable.
- [x] Task 14 / finding 14: Compact portfolio and next student. Files: portfolio renderer/main; portfolio-ux tests for open/reprint/reassess/next student/context preservation; no unnecessary search system.
- [x] Task 15 / finding 15: Percentage-point units. Files: portfolio stats; portfolio-ux tests for positive/negative/zero/missing scores and changed assessment context.
- [x] Task 16 / finding 16: Reduced motion. Files: CSS and attention state handlers; tests/ui-responsive.browser.cjs for reduced-motion ready/busy/completion cues.
- [x] Task 17 / finding 17: Effective context/settings state. Files: index/main/settings UI; teacher-flow tests for inheritance/overrides/switch/save failure/fixed-model text.
- [x] Task 18 / finding 18: Scoped typography/tokens. Files: CSS/dialog styles; responsive tests with long copy/200% zoom and named controls; DESIGN.md incumbent documentation.
- [x] Task 19 / finding 19: Performance. Files: feature-library loader/index/diff/input only as profiles justify; tests/ui-performance.browser.cjs with before/after measurements, cancellation and loading failure. Preserve safe fallback.
- [x] Task 20 / finding 20: Notebook preview. Files: print flow; tests/notebook-preview.browser.cjs with short/long/photos, stored-vs-current identity, close/return, rendered pages.
- [x] Task 21: Independently validate and apply bounded shared trial reference adoption. No upstream runtime or global planning skill.
- [ ] Task 22: Full-suite gate, independent whole-branch review, browser QA, final documentation, PR, merge, Pages deployment and live-asset verification.

Review ledger and evidence: C:/Users/Michael/Documents/Codex/2026-10-31/eva/work/implementation. Keep completion, RED/GREEN evidence, review resolution, commits and release status current there. Primary owns index/UI integration and commits; independent draft implementer owns draft paths while active. Avoid concurrent shared-file writes.
