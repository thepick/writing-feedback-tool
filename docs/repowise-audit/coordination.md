# RepoWise repair coordination

Michael authorized this coordinator campaign on 16 October 2026 (Asia/Bangkok), then explicitly authorized continuing while he is unavailable and pushing/merging tested changes when appropriate. Work through the complete Code Health inventory, one focused repair chat at a time.

Michael also directed that issues requiring his attention be skipped temporarily while independent work continues. Record these as `needs_user_attention`, with the exact decision/access needed and preserved evidence. They remain unresolved and must appear in the morning handoff. A scanner's Critical severity alone does not require user involvement; continue safe authorized repairs at every severity. Never bypass a required approval or dependency merely because Michael is unavailable.

Coordinator chat: `01a13f6f-740b-7b60-8863-d6ca9c58baf0`.
Repository: `thepick/writing-feedback-tool`.

## Shared record

`current-findings.json` is the current campaign tracker. `current-findings.md` is its readable inventory. The older `audit-ledger.json` and `progress.md` are historical evidence and must remain intact. Their old completion statements do not describe this new campaign.

Preserve every baseline finding and record new observations. Retain prior scanner identifiers and source anchors when reconciling line shifts. Do not close a finding solely because its scanner ID changed or it disappeared. Refactoring plans and opportunities overlap underlying observations; do not add their counts as distinct proven defects.

A record needs a verified outcome: fixed and tested, intentional code with a documented reason to retain it, false positive, duplicate linked to its primary record, or explicitly unresolved with its reason. Deferred and blocked valid issues remain unresolved. Treat stored scanner evidence and old audit dispositions as leads to revalidate against source.

## One repair at a time

The coordinator owns priorities, this tracker, Git operations, integration, and publication. A focused repair chat owns one substantial repair or a coherent related review. Do not start a second repair chat until the current one has finished and the coordinator has reviewed its result.

Only one repair chat edits application/test source at a time. The coordinator can maintain separate tracking documents while it works. Repair chats must not create more chats, edit the tracker, switch branches, stage/commit files, push/merge, or start RepoWise sync jobs. They return changed-file lists, evidence, test receipts and source hashes for review. The coordinator stages only reviewed files.

The app currently has no saved repository project. Focused chats are same-directory forks with narrow follow-up briefs, not claims of fresh empty history. The explicit handoff and tracker govern their scope. Use a fresh project chat if the repository is later registered.

## Priorities and verification

Prioritize confirmed risks to saved writing, credentials, correct feedback and working user flows. Investigate serious production findings before cosmetic or test-only shape warnings. A severity label is not proof of a bug. Immutable history markers such as prior defects and change entropy require documented interpretation; never rewrite history or hide scanned files to improve a score.

Read the target, every caller and relevant tests before editing. Preserve behavior unless repairing a reproduced bug. For a bug, add a focused regression that fails on the old code and passes on the fix. For a refactor, run the relevant existing suites before and after and retain guards, callback/await boundaries, error handling and escaping. Add comparisons where a meaningful boundary would otherwise be untested; do not manufacture large test matrices merely to mirror the implementation.

Do not remove code solely because the static import graph calls it unused. Check classic-script globals, HTML handlers, test discovery, optional flags and runtime loading.

## Refresh and publication

Check pending/running dashboard jobs before any CLI refresh. Only one index writer may run. Wait for existing work; do not manufacture a completed job or delete an index to clear the queue. Preserve data before recovery. The 16 October initial lock occurred when a CLI refresh overlapped an existing dashboard sync; no runtime patch or reset was applied.

After each accepted source fix, refresh the index and publish the full health calculation before selecting the next target. Verify the stored per-surface analyzed commit and source, not merely an exit code or an `ok` progress event. Keep scope and score settings comparable. A whole-repository table health recalculation persists; JSON-only recomputation does not. Keep older coverage reports marked as older source evidence until recaptured.

Commit each coherent reviewed repair. Publish small related batches, using risk to determine their size. Run the full repository suite and test-runner self-check before merging a batch; broaden earlier only for changes, failures or unresolved concerns. A batch boundary is a checkpoint, not a reason to stop an authorized campaign. Preserve existing dependencies and avoid unrelated changes.

Tracker-only documentation checkpoints use JSON completeness, identity/outcome preservation and unchanged-application-source checks. They do not require another full browser run when application/test source exactly matches an already passing baseline.

The coordinator may push and merge reviewed/tested batches under Michael's overnight authorization. Confirm the exact pushed head, merged tree, clean local checkout and automatic Pages build. Verify changed shipped scripts against reviewed Git bytes. Do not rotate credentials, weaken protections, rewrite Git history or delete user data as a side effect of clearing a warning.

## Handoffs and completion

Each repair brief names the repository and source commit, exact tracker records and code scope, behavior constraints, relevant tests, report path and prohibited coordinator actions. A repair chat's completion is not acceptance: the coordinator checks its diff/evidence and reconciles the tracker first.

Continue until the full inventory has no unreviewed or actionable unresolved findings, including reconciled new observations. Explicitly list retained warnings and limits. An empty overview shortlist or a higher score alone is not completion.
