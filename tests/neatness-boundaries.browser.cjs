const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), cases = [];
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            return fs.existsSync(file) ? route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'application/javascript' : 'text/html' }) : route.fulfill({ status: 404, body: '' });
        });
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const inputs = [];
        for (const malformed of ['18/10', '12/10', '7.8/10', '7,8/10', '-8/10', '+8/10', '8/100', '8/10.5', '8/10,5', '8/10oops']) {
            inputs.push({ name: 'labeled-' + malformed, text: '- Neatness: ' + malformed + ' - Synthetic observation.', score: null });
            inputs.push({ name: 'legacy-' + malformed, text: 'Neatness result: ' + malformed + '.', score: null });
        }
        for (const score of [2, 4, 6, 8, 10]) {
            inputs.push({ name: 'labeled-valid-' + score, text: '- Neatness: ' + score + '/10 - Synthetic observation.', score });
            inputs.push({ name: 'legacy-valid-' + score, text: 'Neatness result: ' + score + '/10.', score });
        }
        const labels = ['Letter Formation', 'Spacing', 'Staying on the Line', 'Size Consistency', 'Pen Control and Marks', 'Page Layout and Paragraphs'];
        for (const denominator of ['50', '5.5', '5,5', '5oops']) inputs.push({ name: 'subscore-denominator-' + denominator, text: labels.map(label => '- ' + label + ': 4/' + denominator).join('\n') + '\n- Neatness: Missing/10 - No valid score.', score: null });
        inputs.push({ name: 'legacy-sentence-comma-space', text: 'Neatness result: 8/10, with clear spacing.', score: 8 });
        inputs.push({ name: 'legacy-sentence-comma-text', text: 'Neatness result: 8/10,with clear spacing.', score: 8 });
        inputs.push({ name: 'valid-subscore-comma-prose', text: labels.map(label => '- ' + label + ': 4/5, with clear marks.').join('\n') + '\n- Neatness: Missing/10 - Complete criteria.', score: 8 });
        inputs.push({ name: 'valid-subscore-sentence-punctuation', text: labels.map(label => '- ' + label + ': 4/5.').join('\n') + '\n- Neatness: Missing/10 - Complete criteria.', score: 8 });
        inputs.push({ name: 'complete-criteria-survive-malformed-overall', text: labels.map(label => '- ' + label + ': 4/5').join('\n') + '\n- Neatness: 18/10 - Complete criteria.', score: 8 });
        const observed = await page.evaluate(inputs => {
            stopWftSyncPolling(); stopDriveAutoSync();
            return inputs.map(input => {
                const result = parseNeatnessAssessmentResponse(input.text);
                return { name: input.name, score: result && result.quickRubric ? result.quickRubric.score : null };
            });
        }, inputs);
        observed.forEach((row, index) => cases.push({ ...row, expected: inputs[index].score, passed: row.score === inputs[index].score }));
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
    const report = { root, cases, count: cases.length, failed: cases.filter(row => !row.passed).length };
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ count: report.count, failed: report.failed, failures: cases.filter(row => !row.passed) }, null, 2));
    assert.equal(report.failed, 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
