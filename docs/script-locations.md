# Current browser script locations

Stage 3 follows accepted source `4fc43d8e4df08feb6d63de579adc1ea6ba5085dc` (13 October 2026, Asia/Bangkok). These are classic scripts sharing the existing globals. This table maps source moves; it does not replace historical audit outcomes or claim moved complexity warnings are resolved.

| Original source block | Current owner | Contracts retained |
| --- | --- | --- |
| `00-storage-sync-patches.js`, APP CONFIRMATION DIALOG, `ensureWftConfirmStyles` through `wftTextInput` | `js/app/dialogs.js` | Promise results, focus, keyboard cancellation and IME handling |
| `00-storage-sync-patches.js`, PATCH 0, metadata through `saveWftPreMigrationBackupToDrive` | `js/app/storage-recovery.js` | Required reads/validation, rollback recovery, safe mode, Lamport/device metadata and emergency backups |
| `10-main-app.js`, Version 2 archive/export helpers, `setWftArchiveStatus` through `exportSelectedStudentPortfolio` | `js/app/portfolio-export.js` | Export formats/sanitization, photo manifests, archive ownership and acknowledgement before class clearing |
| `10-main-app.js`, `isCurrentCropSession` through crop DOMContentLoaded wiring | `js/app/photo-crop.js` | Delayed callback identity, photo revisions, apply/reset/close, focus and mouse/touch wiring |
| `10-main-app.js`, Text metrics cluster, `countWords` through `computeOverallScore` | `js/app/20-text-metrics.js` | Word count, sentence variety, grammar density band, overall score; global names unchanged |
| `10-main-app.js`, Diff/correction engine, `renderMarkdownBold` through `renderCorrected` | `js/app/21-diff-engine.js` | Tokenization, LCS diff, markdown helpers, corrected-writing render; global names unchanged |

The four crop-state declarations and assignments remain at the original main-tail execution point. Main startup can read its hoisted state before crop functions load; interactive crop callbacks execute after the next blocking script loads. Recovery definitions load before storage PATCH 14 performs its original metadata update. Export declarations load before main; they use main collaborators only when invoked. `escapeHtml`, configuration/flags and the coupled auth/sync engine retain their existing homes.

`openSettingsDrawer` now directly refreshes storage health after opening both drawer elements. Its former `_origOpenSettingsDrawer` wrapper was removed. The captured `updateMeter` and broadcast `syncWftNow` wrappers remain because listener identity and closure lifetime affect their behavior.

Historical `docs/repowise-audit` rows, original IDs, public IDs, scanner histories, classifications, source locations and publication records are unchanged. For example, `buildStudentPortfolioHtml` public finding `finding_d808623185241f9634e9` now follows the same function into `portfolio-export.js`; its existing shape/performance disposition remains historical. Stage 1 renderer and Stage 2 analysis mappings remain separate. New scanner observations must be mapped by unchanged function/source identity, not treated as resolutions because an old path disappeared.
