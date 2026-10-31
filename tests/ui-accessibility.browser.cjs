const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));

function ratio(foreground, background) {
    const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => x - y);
    return (b + .05) / (a + .05);
}
assert.equal(ratio([0, 0, 0], [255, 255, 255]), 21);

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const cases = [];
    const tests = {
        'finding06-persistent-control-names-and-clickable-label': async page => {
            await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
            assert.equal(await page.getByRole('combobox', { name: 'Student portfolio', exact: true }).count(), 1);
            await page.getByRole('button', { name: 'Teacher Admin', exact: true }).click();
            assert.equal(await page.getByLabel('Student name', { exact: true }).count(), 1);
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            const checkbox = page.getByRole('checkbox', { name: 'Use word count target', exact: true });
            assert.equal(await checkbox.count(), 1);
            const before = await checkbox.isChecked();
            await page.locator('label[for="useWordCountTarget"]').click();
            assert.equal(await checkbox.isChecked(), !before);
            assert((await page.locator('label[for="useWordCountTarget"]').boundingBox()).height >= 44, 'The checkbox row is a full touch target');
        },
        'finding06-selected-and-disclosed-state': async page => {
            await page.getByRole('button', { name: 'Portfolio', exact: true }).click();
            assert.equal(await page.locator('#portfolioTabBtn').getAttribute('aria-current'), 'page');
            assert.equal(await page.locator('nav [aria-current="page"]').count(), 1);
            await page.getByRole('button', { name: 'Teacher Admin', exact: true }).click();
            const expanded = await page.locator('#rosterSection').isVisible();
            assert.equal(await page.locator('#toggleRosterBtn').getAttribute('aria-expanded'), String(expanded));
            await page.locator('#toggleRosterBtn').click();
            assert.equal(await page.locator('#toggleRosterBtn').getAttribute('aria-expanded'), String(!expanded));
            await page.getByRole('button', { name: 'Writing Tool', exact: true }).click();
            await page.locator('#studentWriting').fill('Original sample.');
            await page.evaluate(() => { latestAnalysisData = { inputContext: captureCurrentWritingContext(), overall: 70, categoryScores: {}, detailed: {} }; syncUiState(); document.getElementById('diffControls').style.display = 'flex'; originalTextForDiff = 'Original sample.'; correctedHtmlForDiff = 'Corrected sample.'; });
            await page.getByRole('button', { name: 'Original', exact: true }).click();
            assert.equal(await page.locator('#diffBtnOriginal').getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('#diffBtnCorrected').getAttribute('aria-pressed'), 'false');
            assert.equal(await page.locator('#correctedStory').innerText(), 'Original sample.');
            await page.waitForFunction(() => !_diffSwitching);
            await page.evaluate(() => { document.getElementById('correctedStory').textContent = 'Fresh corrected writing.'; });
            await page.waitForFunction(() => document.getElementById('diffBtnCorrected').classList.contains('active'));
            assert.equal(await page.locator('#diffBtnCorrected').getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('#diffBtnOriginal').getAttribute('aria-pressed'), 'false');
        },
        'finding07-active-red-action-contrast': async page => {
            await page.getByRole('button', { name: 'Teacher Admin', exact: true }).click();
            await page.evaluate(() => { students = ['Synthetic']; renderStudentList(); document.getElementById('rosterSection').style.display = ''; });
            const colors = await page.locator('button[onclick="clearAllStudents()"]').evaluate(element => {
                const style = getComputedStyle(element);
                return { color: style.color.match(/[\d.]+/g).slice(0, 3).map(Number), background: style.backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number), disabled: element.disabled };
            });
            assert.equal(colors.disabled, false);
            assert(ratio(colors.color, colors.background) >= 4.5, 'Enabled destructive action must be readable');
        },
        'finding07-enabled-extract-and-hover-contrast': async page => {
            await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                selectedImages = [{ name: 'Synthetic', dataUrl: canvas.toDataURL() }];
                syncSelectedImageState(); updateSelectedImagePreview(); document.getElementById('ocrPanel').open = true;
            });
            for (const hover of [false, true]) {
                if (hover) await page.locator('#extractTextBtn').hover();
                const colors = await page.locator('#extractTextBtn').evaluate(element => {
                    const style = getComputedStyle(element);
                    const parse = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
                    const stops = [...style.backgroundImage.matchAll(/rgba?\(([^)]+)\)/g)].map(match => parse(match[1]));
                    return { color: parse(style.color), backgrounds: stops.length ? stops : [parse(style.backgroundColor)], disabled: element.disabled };
                });
                assert.equal(colors.disabled, false);
                assert(colors.backgrounds.every(background => ratio(colors.color, background) >= 4.5), 'Enabled Extract must be readable across its actual background');
            }
        },
        'finding07-close-delete-and-textarea-composited-contrast': async page => {
            await page.getByRole('button', { name: 'Teacher Admin', exact: true }).click();
            await page.evaluate(() => { students = ['Synthetic']; renderStudentList(); document.getElementById('rosterSection').style.display = ''; });
            async function readable(selector) {
                for (const hover of [false, true]) {
                    if (hover) await page.locator(selector).hover();
                    const colors = await page.locator(selector).evaluate(element => {
                        const parse = value => (value.match(/[\d.]+/g) || []).map(Number);
                        let background = [255, 255, 255];
                        const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
                        for (const node of ancestors) {
                            const rgba = parse(getComputedStyle(node).backgroundColor), alpha = rgba.length === 4 ? rgba[3] : 1;
                            if (rgba.length >= 3) background = background.map((value, i) => rgba[i] * alpha + value * (1 - alpha));
                        }
                        const style = getComputedStyle(element), foreground = parse(style.color), alpha = (foreground.length === 4 ? foreground[3] : 1) * Number(style.opacity);
                        return { foreground: background.map((value, i) => foreground[i] * alpha + value * (1 - alpha)), background };
                    });
                    assert(ratio(colors.foreground, colors.background) >= 4.5, selector + ' readable with actual alpha/background');
                }
            }
            await readable('.btn-delete');
            await page.getByRole('button', { name: 'Writing Tool', exact: true }).click();
            await page.locator('#studentWriting').fill('Synthetic text.');
            await readable('#clearTextBtn');
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            await readable('.settings-drawer-close');
        },
        'finding08-extraction-status-error-and-success-semantics': async page => {
            await page.evaluate(() => setOcrStatus('Extraction failed. Check the photo and retry.', 'error'));
            assert.equal(await page.locator('#ocrStatus').getAttribute('role'), 'alert');
            assert.equal(await page.locator('#ocrStatus').getAttribute('aria-live'), 'assertive');
            assert((await page.locator('#ocrStatus').innerText()).includes('retry'));
            await page.evaluate(() => setOcrStatus('Text extracted. Check the transcription.', 'success'));
            assert.equal(await page.locator('#ocrStatus').getAttribute('role'), 'status');
            assert.equal(await page.locator('#ocrStatus').getAttribute('aria-live'), 'polite');
        },
        'finding08-missing-key-identifies-field-and-retry-clears-error': async page => {
            await page.evaluate(() => {
                const canvas = document.createElement('canvas');
                selectedImages = [{ name: 'Synthetic', dataUrl: canvas.toDataURL() }];
                syncSelectedImageState(); updateSelectedImagePreview(); document.getElementById('ocrPanel').open = true;
            });
            await page.locator('#extractTextBtn').click();
            await page.waitForFunction(() => document.getElementById('ocrStatus').getAttribute('role') === 'alert');
            await page.getByRole('button', { name: 'Open settings', exact: true }).click();
            assert.equal(await page.locator('#apiKeyInput').getAttribute('aria-invalid'), 'true');
            assert((await page.locator('#apiKeyInput').getAttribute('aria-describedby')).includes('apiKeyError'));
            assert(await page.locator('#apiKeyError').isVisible());
            await page.locator('#apiKeyInput').fill('synthetic-no-network-key');
            assert.notEqual(await page.locator('#apiKeyInput').getAttribute('aria-invalid'), 'true');
            assert(await page.locator('#apiKeyError').isHidden());
            assert.equal(await page.locator('#apiKeyError').textContent(), '', 'A cleared error must leave the accessible description');
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
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ cases }, null, 2));
    console.log(JSON.stringify(cases, null, 2));
    assert(cases.length && cases.every(test => test.passed), 'Accessibility regression failed');
})().catch(error => { console.error(error); process.exitCode = 1; });
