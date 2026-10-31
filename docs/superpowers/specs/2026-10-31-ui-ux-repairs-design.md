# UI/UX repairs design

Approved source: Michael's instruction to fix every P1-P3 finding in the October 31 audit, starting with P1 and draft preservation; test and independently review each fix, then merge and deploy. The full approved findings and acceptance checks are in the audit artifact at C:/Users/Michael/Documents/Codex/2026-10-31/eva/outputs/writing-feedback-ui-ux-audit.html.

Approach: retain plain browser JavaScript, existing public handlers, teacher workflows, rubric/scoring semantics, light identity, and notebook print design. Small shared behaviors for drafts, dialogs, and feature loading are justified by repeated callers. Do not introduce a framework or a new dependency. Native worktree setup failed to return and was canceled; a manual isolated worktree on codex/ui-ux-repairs is used instead. User explicitly authorized work, review, merge and deployment; no further approval gate is needed.

1. Preserve ordinary raw drafts before all destructive replacements and ownership changes. Restore exact text and genre after reload. Keep draft identity separate from analyzed portfolio records and OAuth recovery. Support Undo without deleting newer typing or crossing students. Preserve unreadable/failed-write data and competing tab versions. Destructive class operations must not resurrect old drafts. State text-versus-photo persistence honestly.
2. Complete keyboard and focus behavior for every modal. Hide closed Settings from focus/AX, name dialogs, contain focus, inert background, Escape, restore opener, retain save-failure and ownership guards.
3. Fit portrait crops to both dimensions; preserve all image bounds, cancellation and crop ownership. Keyboard-operable crop bounds and focusable image enlargement.
4. Label controls and expose state, correct active-text contrast, announce OCR errors/progress, supply accessible chart equivalents.
5. Simplify first-run, input/results/next actions, empty roster/admin/portfolio states and routine settings. Show student/effective grade, local/Drive persistence and recovery in plain language. Compact saved work while keeping next actions findable. Use percentage points for absolute score differences.
6. Reduced-motion alternatives, scoped typography/tokens, measured targeted performance work, integrated notebook preview. Preserve actual scoring, portfolio identity, source/session references and print output.

Per-finding regression and independent review records are mandatory. Synthetic data and blocked/stubbed external services only for automated tests. No paid AI or real student operations are needed. Release gate: all findings implemented and reviewed, broad suite green, browser visual/keyboard/mobile checks, PR review, merge with expected HEAD, successful Pages deployment and published-asset verification.

Trial adoption: keep project-local checkpoints as a limited planning trial. Fold only a small verified interaction/chart checklist and provenance into canonical shared Impeccable, independently validate and back up per-file; preserve aliases, hooks and caches. No full upstream package, runtime, installer, or separate global planning skill.
