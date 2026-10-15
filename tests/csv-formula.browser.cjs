const { chromium } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path');
const root = path.resolve(process.env.WFT_TEST_ROOT || path.join(__dirname, '..'));
const localAppRoute = require('./support/local-app-route');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => localAppRoute(route, root));
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const cases = await page.evaluate(() => {
            const cases = [], check = (name, passed, observed) => cases.push({ name, passed: !!passed, observed });
            for (const value of ['=1+1', '+1+1', '-1+1', '@SUM(1,1)', ' =1+1', '\t=1+1', '\r=1+1', '=1+1",=2+2']) {
                const expected = '"\t' + value.replace(/"/g, '""') + '"';
                check('formula-like text is a quoted text cell: ' + JSON.stringify(value), csvEscape(value) === expected, csvEscape(value));
            }
            for (const [value, expected] of [[null, ''], [0, '0'], [-1, '-1'], [false, 'false'], ['ordinary writing', 'ordinary writing'], ['line 1\nline 2', '"line 1\nline 2"'], ['a,"b"', '"a,""b"""']]) {
                check('ordinary CSV encoding preserved: ' + JSON.stringify(value), csvEscape(value) === expected, csvEscape(value));
            }
            const name = '=1+1', session = { id: 'synthetic', title: '+1+1', date: '2026-10-15', originalText: 'Exact original writing.', correctedText: 'Exact corrected writing.',
                feedback: { strength: '@SUM(1,1)', nextTime: '-1+1', growGoal: ' =1+1' } };
            const data = { sessions: [session] }, snapshot = JSON.stringify(data);
            const sessionsCsv = buildStudentSessionsCsv(name, data), classCsv = buildClassSummaryCsv({ [name]: data }, '2026-2027');
            check('session exporter neutralizes student, title and feedback cells', sessionsCsv.includes('"\t=1+1"') && sessionsCsv.includes('"\t+1+1"') && sessionsCsv.includes('"\t@SUM(1,1)"') && sessionsCsv.includes('"\t-1+1"') && sessionsCsv.includes('"\t =1+1"'), sessionsCsv);
            check('class exporter neutralizes student names', classCsv.includes('"\t=1+1"'), classCsv);
            check('export leaves source records and plain writing untouched', JSON.stringify(data) === snapshot && buildCorrectedWritingText(name, data).includes(session.correctedText));
            return cases;
        });
        console.log(JSON.stringify({ suite: 'csv-formula', cases, errors }, null, 2));
        assert.deepEqual(errors, []); assert.deepEqual(cases.filter(row => !row.passed), []);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
