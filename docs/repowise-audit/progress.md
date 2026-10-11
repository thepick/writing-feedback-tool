# Repowise audit progress

Updated 2026-10-11T15:06:19.834Z; timezone Asia/Bangkok. All 662 original finding IDs retained. Current baseline outcomes: {"no_code_change":104,"pending":535,"behavior_fixed_metric_review_pending":4,"confirmed_awaiting_fix":16,"fixed_in_draft_pr":3}. Behavioral fixes do not close remaining metric review. Ledger rows: 843.

Reviewed draft repairs:

- [PR41 settings/deletion sync races](https://github.com/thepick/writing-feedback-tool/pull/41), cd35543: 14 Node cases, eight browser cases, all 23 suites pass.
- [PR42 analysis attribution](https://github.com/thepick/writing-feedback-tool/pull/42), ef41631: baseline fails 19/22 focused cases; repaired 22/22 and all 24 suites pass. Coordinator reviewed the production diff and independently reran attribution plus notebook reconstruction/print layout. Shape review on four original complexity/length markers remains open.

Confirmed next repair queue: SYNC-002 (same-student distinct cloud essays overwritten during pending local push); STORAGE-001 (silent failed deletion markers, with rename callers to investigate); STORAGE-002 (unreadable raw portfolio overwritten by save/lifecycle snapshots); FEEDBACK-001 (missing handwriting criterion produces worst-band feedback). All use synthetic data and intercepted services.

No-change decisions include historical metrics, false assertion-free callbacks, sequential dependent IO, focused test matrices, short ordered category dispatch, sixteen optional UI/parser catches and 45 findings in explicitly bounded guide/category renderers. Every original row retains its individual evidence; no blanket helper/test exclusion. Unshipped helper copies, data-sized loops, other source groups, derived plans and coverage action remain under review.

All issue surfaces are inventoried: Code Health including zero-impact/all-scope; dead code 15; security 0; documentation drift 0; refactoring plans 135; full performance queue 23 including investigate; coverage action 1. Refresh aliases are reconciled by stable identity, never treated as fixes.

One repair chat writes the repository at a time. Coordinator checkpoints between writers; PRs stack on reviewed previous repairs. No merge/deployment, real student data, paid AI or live Drive writes. Scores are not regression evidence.

Refresh at ef41631: 662 current health rows; 658 canonical matches, seven absent (five history-score omissions and two previously simplified settings markers), four new warnings reviewed. Refactoring plans 136: 25 aliases and 3 new semantic plan. Full performance 23, dead code 15, security/doc drift zero and coverage action one verified again. All originals retained.
