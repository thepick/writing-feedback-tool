# Repowise audit progress

Updated: 2026-10-11T14:34:39.621Z (display timezone Asia/Bangkok).

Baseline: 662 Code Health findings (37 critical, 85 high, 201 medium, 339 low). Every original ID is retained in audit-ledger.json. Current scan has the same IDs. Additional surfaces: 15 open dead-code findings, 0 security findings; one manually discovered deletion-sync bug tracked.

Status: 1 baseline finding tied to a confirmed behavioral bug, 661 baseline findings still awaiting evidence-based assessment. No final dispositions yet. Similar markers are grouped by file and symbol; grouping never removes IDs.

First batch SYNC-001: confirmed settings/deletion upload race in four create/update cases. Also investigate failed local merge writes in these same paths; do not mark that concern fixed without a reproduction.

Boundaries: no merge, deployment, real student data, paid AI calls or live Drive writes. One repair writer at a time. Repowise scores are not regression evidence.

Next: dispatch the first repair chat; review its diff/tests and update this ledger before the next writer. All remaining findings stay explicitly unreviewed.
