const { chromium } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const localAppRoute = require('./support/local-app-route');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => localAppRoute(route, root));
        await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
        const cases = await page.evaluate(() => {
            stopWftSyncPolling(); scheduleWftCloudSync = () => {};
            const cases = [], check = (name, passed) => cases.push({ name, passed: !!passed });
            const nativeSet = Storage.prototype.setItem, writing = 'Alice writes about a dog.';
            for (const fault of [false, true]) {
                students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown();
                const select = document.getElementById('studentSelect'); select.value = 'Alice';
                document.getElementById('studentWriting').value = writing;
                latestAnalysisData = { inputContext: captureCurrentWritingContext(), marker: 'Alice-only result' };
                document.getElementById('correctedStory').textContent = 'Alice-only result';
                document.getElementById('detailedAssessment').textContent = 'Alice-only feedback';
                pendingPortfolioSync = { studentName: 'Alice', signature: 'retained', sessionData: { id: 'retained', originalText: writing, images: [] } };
                persistPendingPortfolioSync();
                const pending = localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY), portfolio = localStorage.getItem('wft_portfolio');
                Storage.prototype.setItem = function(key, value) {
                    if (fault && this === localStorage && key === 'wft_selectedStudent') throw new DOMException('Synthetic selection quota', 'QuotaExceededError');
                    return nativeSet.call(this, key, value);
                };
                try { select.value = 'Bob'; select.dispatchEvent(new Event('change')); }
                finally { Storage.prototype.setItem = nativeSet; }
                const label = fault ? 'quota failure' : 'normal write';
                check(label + ': active student switches', select.value === 'Bob' && selectedStudent === 'Bob');
                check(label + ': previous student feedback invalidates', latestAnalysisData === null && document.getElementById('correctedStory').textContent === 'No corrected story yet.' && document.getElementById('detailedAssessment').textContent === 'Analyze the current writing for feedback.');
                check(label + ': typed writing remains available', document.getElementById('studentWriting').value === writing);
                check(label + ': selection persistence is truthful', localStorage.getItem('wft_selectedStudent') === (fault ? 'Alice' : 'Bob'));
                check(label + ': pending result remains owned by Alice', localStorage.getItem(PENDING_PORTFOLIO_SYNC_KEY) === pending && getPendingPortfolioSync().studentName === 'Alice');
                check(label + ': saved portfolio bytes remain unchanged', localStorage.getItem('wft_portfolio') === portfolio);
            }
            return cases;
        });
        console.log(JSON.stringify({ suite: 'student-selection-storage', cases, errors }));
        assert.deepEqual(errors, []); assert.deepEqual(cases.filter(row => !row.passed), []);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
