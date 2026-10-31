const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const cases = [];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const tests = {
        'closed-settings-does-not-take-focus': async page => {
            await page.evaluate(() => document.getElementById('apiKeyInput').focus());
            assert.notEqual(await page.evaluate(() => document.activeElement.id), 'apiKeyInput');
        },
        'settings-entry-trap-escape-return': async page => {
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            assert(await page.evaluate(() => document.getElementById('settingsDrawer').contains(document.activeElement)), 'Focus enters Settings');
            await page.keyboard.press('Shift+Tab');
            assert(await page.evaluate(() => document.getElementById('settingsDrawer').contains(document.activeElement)), 'Reverse Tab stays in Settings');
            await page.keyboard.press('Escape');
            assert(await page.locator('#settingsDrawer').isHidden(), 'Escape closes Settings');
            assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Open settings');
        },
        'settings-save-failure-keeps-dialog': async page => {
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            await page.evaluate(() => { saveWftPreferencesFromForm = () => false; });
            await page.keyboard.press('Escape');
            assert(await page.locator('#settingsDrawer').isVisible());
            assert(await page.evaluate(() => document.getElementById('settingsDrawer').contains(document.activeElement)));
        },
        'confirm-traps-tab-and-restores-focus': async page => {
            await page.locator('#studentWriting').focus();
            await page.evaluate(() => { window.dialogResult = undefined; wftConfirm('Synthetic confirmation').then(value => { window.dialogResult = value; }); });
            await page.locator('.wft-confirm-cancel').waitFor({ state: 'visible' });
            await page.locator('.wft-confirm-cancel').focus();
            await page.keyboard.press('Shift+Tab');
            assert.equal(await page.evaluate(() => document.activeElement.className), 'wft-confirm-ok');
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.activeElement.className), 'wft-confirm-cancel');
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => window.dialogResult), false);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'studentWriting');
            assert.equal(await page.locator('#mainApp').evaluate(element => element.inert), false);
        },
        'text-input-keeps-enter-and-return': async page => {
            await page.locator('#studentWriting').focus();
            await page.evaluate(() => { wftTextInput('Synthetic name', { label: 'Name' }).then(value => { window.dialogResult = value; }); });
            await page.getByLabel('Name', { exact: true }).fill('จันทร์ & Renée');
            await page.getByLabel('Name', { exact: true }).press('Enter');
            assert.equal(await page.evaluate(() => window.dialogResult), 'จันทร์ & Renée');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'studentWriting');
        },
        'feedback-focus-trap-and-return': async page => {
            await page.locator('#studentWriting').focus();
            await page.evaluate(() => showPortfolioFeedbackModal(buildPortfolioFeedbackModalShell('Synthetic feedback', '', '<p>Saved feedback.</p>')));
            assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close detailed feedback');
            await page.keyboard.press('Tab');
            assert(await page.evaluate(() => document.querySelector('.portfolio-feedback-modal').contains(document.activeElement)));
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#portfolioFeedbackModalBackdrop').count(), 0);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'studentWriting');
        },
        'review-confirmation-ime-escape-keeps-editing': async page => {
            await page.evaluate(() => { wftConfirm('Synthetic confirmation').then(value => { window.dialogResult = value; }); });
            await page.locator('.wft-confirm-cancel').waitFor();
            await page.locator('.wft-confirm-cancel').evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true })));
            assert(await page.locator('.wft-confirm-dialog').isVisible());
            assert.equal(await page.evaluate(() => window.dialogResult), undefined);
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => window.dialogResult), false);
        },
        'review-manage-student-uses-modal-lifecycle': async page => {
            await page.locator('#studentWriting').focus();
            await page.evaluate(() => { students = ['Synthetic']; chooseStudentToManage('Synthetic').then(value => { window.dialogResult = value; }); });
            await page.getByRole('dialog', { name: 'Manage Student', exact: true }).waitFor();
            assert(await page.locator('#mainApp').evaluate(element => element.inert));
            await page.locator('.wft-confirm-ok').focus();
            await page.keyboard.press('Tab');
            assert(await page.evaluate(() => document.querySelector('.wft-confirm-dialog').contains(document.activeElement)));
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => window.dialogResult), '');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'studentWriting');
        },
        'review-parent-close-cleans-up-nested-preview': async page => {
            await page.locator('#studentWriting').focus();
            await page.evaluate(() => {
                const photo = document.createElement('canvas').toDataURL();
                showPortfolioFeedbackModal(buildPortfolioFeedbackModalShell('Synthetic feedback', '', '<button id="syntheticPreview" onclick="openImageLightbox(this.firstElementChild)"><img alt="Synthetic writing" src="' + photo + '">View photo</button>'));
            });
            await page.locator('#syntheticPreview').click();
            await page.evaluate(() => closePortfolioFeedbackModal());
            assert.equal(await page.locator('#portfolioFeedbackModalBackdrop').count(), 0);
            assert(!(await page.locator('#imgLightbox').evaluate(element => element.classList.contains('open'))));
            assert.equal(await page.locator('#mainApp').evaluate(element => element.inert), false);
            assert.equal(await page.evaluate(() => document.body.style.overflow), '');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'studentWriting');
        },
        'review-nested-confirmations-have-distinct-names': async page => {
            await page.evaluate(() => { wftConfirm('Outer action', { title: 'Outer confirmation' }); wftConfirm('Inner action', { title: 'Inner confirmation' }); });
            assert.equal(await page.getByRole('dialog', { name: 'Inner confirmation', exact: true }).count(), 1);
            await page.keyboard.press('Escape');
            assert.equal(await page.getByRole('dialog', { name: 'Outer confirmation', exact: true }).count(), 1);
        },
        'review-confirmation-alternative-preserves-boolean-callers': async page => {
            await page.evaluate(() => { wftConfirm('Replace the existing text?', { alternativeText: 'Append Text' }).then(value => { window.dialogResult = value; }); });
            await page.getByRole('button', { name: 'Append Text', exact: true }).click({ timeout: 1500 });
            assert.equal(await page.evaluate(() => window.dialogResult), 'alternative');
            await page.evaluate(() => { wftConfirm('Continue?').then(value => { window.dialogResult = value; }); });
            await page.getByRole('button', { name: 'Continue', exact: true }).click();
            assert.equal(await page.evaluate(() => window.dialogResult), true);
        },
        'review-crop-apply-returns-to-rebuilt-button': async page => {
            await page.evaluate(() => {
                const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 1200;
                selectedImages = [{ name: 'Synthetic', dataUrl: canvas.toDataURL() }];
                syncSelectedImageState(); updateSelectedImagePreview(); document.getElementById('ocrPanel').open = true;
            });
            await page.locator('.ocr-preview-crop').click();
            await page.waitForFunction(() => _cropSession && _cropSession.ready);
            await page.getByLabel('Left (%)', { exact: true }).fill('10');
            await page.getByRole('button', { name: 'Apply Crop', exact: true }).click();
            await page.waitForFunction(() => !document.getElementById('cropModal').classList.contains('open'));
            assert(await page.evaluate(() => document.activeElement.matches('.ocr-preview-crop[data-index="0"]')));
        },
        'review-crop-reset-cancel-returns-to-rebuilt-button': async page => {
            await page.evaluate(() => {
                const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 1200;
                selectedImages = [{ name: 'Synthetic', dataUrl: canvas.toDataURL(), originalDataUrl: canvas.toDataURL() }];
                syncSelectedImageState(); updateSelectedImagePreview(); document.getElementById('ocrPanel').open = true;
            });
            await page.locator('.ocr-preview-crop').click();
            await page.waitForFunction(() => _cropSession && _cropSession.ready);
            await page.getByRole('button', { name: 'Reset', exact: true }).click();
            await page.keyboard.press('Escape');
            assert(await page.evaluate(() => document.activeElement.matches('.ocr-preview-crop[data-index="0"]')));
        },
        'review-settings-backdrop-remains-clickable': async page => {
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            await page.mouse.click(page.viewportSize().width - 20, 20);
            await page.waitForFunction(() => document.getElementById('settingsDrawer').hidden, null, { timeout: 1500 });
            assert(await page.getByRole('button', { name: 'Open settings', exact: true }).evaluate(el => el === document.activeElement));
            assert.equal(await page.locator('#mainApp').evaluate(el => el.inert), false);
        },
        'review-feedback-summary-is-reachable-by-keyboard': async page => {
            await page.evaluate(() => showPortfolioFeedbackModal(buildPortfolioFeedbackModalShell('Category feedback', '', renderPortfolioFeedbackCategoryBlock('Ideas & Details', { score: 7, evidence: 'Synthetic evidence.', growthTip: 'Add a detail.' }))));
            await page.keyboard.press('Tab');
            assert(await page.evaluate(() => document.activeElement.tagName === 'SUMMARY'), 'Tab reaches the real category disclosure');
            await page.keyboard.press('Enter');
            assert(await page.locator('.portfolio-feedback-modal details').first().evaluate(el => el.open));
        },
        'nested-lightbox-preserves-parent-modality': async page => {
            await page.locator('#studentWriting').focus();
            await page.evaluate(() => {
                const photo = document.createElement('canvas').toDataURL();
                showPortfolioFeedbackModal(buildPortfolioFeedbackModalShell('Synthetic feedback', '', '<button id="syntheticPreview" onclick="openImageLightbox(this.querySelector(\'img\'))"><img alt="Synthetic writing" src="' + photo + '">View photo</button>'));
            });
            await page.locator('#syntheticPreview').click();
            assert.equal(await page.evaluate(() => document.activeElement.id), 'imgLightboxClose');
            await page.keyboard.press('Escape');
            assert(await page.locator('.portfolio-feedback-modal').isVisible(), 'Only the top dialog closes');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'syntheticPreview');
            assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
            assert(await page.locator('#mainApp').evaluate(element => element.inert));
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'studentWriting');
            assert.equal(await page.evaluate(() => document.body.style.overflow), '');
            assert.equal(await page.locator('#mainApp').evaluate(element => element.inert), false);
        }
    };
    try {
        for (const [name, test] of Object.entries(tests)) {
            if (process.argv[2] && !name.includes(process.argv[2])) continue;
            const context = await browser.newContext(), page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await context.route('**/*', route => localAppRoute(route, root));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await test(page);
                assert.deepEqual(errors, []);
                cases.push({ name, passed: true });
            } catch (error) { cases.push({ name, passed: false, error: error.message }); }
            finally { await context.close(); }
        }
    } finally { await browser.close(); }
    assert(cases.length > 0, 'No selected dialog cases');
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ cases }, null, 2));
    console.log(JSON.stringify(cases, null, 2));
    assert(cases.every(test => test.passed), 'Dialog behavior failed');
})().catch(error => { console.error(error); process.exitCode = 1; });
