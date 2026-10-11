const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext();
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== 'http://127.0.0.1:8765') return route.abort();
            const file = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
            if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
            return route.fulfill({ status: 200, contentType: file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream', body: fs.readFileSync(file) });
        });
        for (const [action, selector] of [
            ['reset', 'button[onclick="resetCurrentClassData()"]'],
            ['clear', 'button[onclick="clearAllStudents()"]'],
            ['delete', '#studentList .student-item:first-child .btn-delete']
        ]) {
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto('http://127.0.0.1:8765', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => typeof resetCurrentClassData === 'function');
            await page.evaluate(() => {
                scheduleWftCloudSync = () => {};
                stopWftSyncPolling();
                window.classFlushes = 0;
                flushWftCloudSyncNow = () => { classFlushes++; };
                wftConfirm = async () => true;
                window.classAlerts = [];
                window.alert = message => classAlerts.push(message);
                const entry = id => ({ id, originalText: 'Writing to keep', images: [] });
                window.classOriginal = JSON.stringify({ Alice: { sessions: [entry('a')] }, Bob: { sessions: [entry('b')] }, Carol: { sessions: [entry('c')] } });
                localStorage.setItem('wft_portfolio', classOriginal);
                localStorage.setItem('wft_students', JSON.stringify(['Alice', 'Bob']));
                localStorage.setItem('wft_selectedStudent', 'Alice');
                localStorage.removeItem(WFT_DELETIONS_STORAGE_KEY);
                students = ['Alice', 'Bob']; selectedStudent = 'Alice';
                renderStudentList(); populateStudentDropdown();
                window.classCounters = [wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter];
                window.classSetItem = Storage.prototype.setItem;
                window.classWrites = 0;
                Storage.prototype.setItem = function(key, value) {
                    if (key === 'wft_portfolio') { classWrites++; throw new DOMException('Storage full', 'QuotaExceededError'); }
                    return classSetItem.call(this, key, value);
                };
            });
            const button = page.locator(selector);
            await button.evaluate(element => element.click());
            await page.waitForFunction(() => classAlerts.length === 1);
            const failed = await page.evaluate(() => {
                Storage.prototype.setItem = classSetItem;
                return { bytesKept: localStorage.getItem('wft_portfolio') === classOriginal,
                    roster: JSON.parse(localStorage.getItem('wft_students')), memoryRoster: students,
                    selected: localStorage.getItem('wft_selectedStudent'), memorySelected: selectedStudent,
                    uiSelected: document.getElementById('studentSelect').value,
                    markers: localStorage.getItem(WFT_DELETIONS_STORAGE_KEY), writes: classWrites, flushes: classFlushes,
                    countersKept: JSON.stringify(classCounters) === JSON.stringify([wftSyncState.localPortfolioCounter, wftSyncState.localSettingsCounter, wftSyncState.localDeletionsCounter]),
                    visibleToSync: Object.keys(applyDeletionsToPortfolio(getPortfolioData(), getDeletionsData())), alert: classAlerts[0] };
            });
            assert.equal(failed.bytesKept, true, action);
            assert.deepEqual(failed.roster, ['Alice', 'Bob']);
            assert.deepEqual(failed.memoryRoster, ['Alice', 'Bob']);
            assert.equal(failed.selected, 'Alice');
            assert.equal(failed.memorySelected, 'Alice');
            assert.equal(failed.uiSelected, 'Alice');
            assert.equal(failed.markers, null);
            assert.equal(failed.writes, 2);
            assert.equal(failed.flushes, 0);
            assert.equal(failed.countersKept, true);
            assert.deepEqual(failed.visibleToSync, ['Alice', 'Bob', 'Carol']);
            assert.match(failed.alert, /could not/i);
            await button.evaluate(element => element.click());
            await page.waitForFunction(() => !getPortfolioData().Alice);
            const success = await page.evaluate(() => ({ portfolio: getPortfolioData(),
                roster: JSON.parse(localStorage.getItem('wft_students')), selected: localStorage.getItem('wft_selectedStudent'),
                deletedStudents: Object.values(getDeletionsData().deletedStudents).map(record => record.studentName),
                deletedSessions: Object.values(getDeletionsData().deletedSessions).map(record => record.sessionId),
                visibleToSync: Object.keys(applyDeletionsToPortfolio(JSON.parse(classOriginal), getDeletionsData())),
                flushes: classFlushes, alerts: classAlerts.length }));
            assert.equal(success.selected, '');
            assert.equal(success.alerts, 1);
            if (action === 'delete') {
                assert.deepEqual(Object.keys(success.portfolio), ['Bob', 'Carol']);
                assert.deepEqual(success.roster, ['Bob']);
                assert.deepEqual(success.visibleToSync, ['Bob', 'Carol']);
            } else {
                assert.deepEqual(success.portfolio, {});
                assert.deepEqual(success.roster, []);
                assert.ok(success.deletedStudents.includes('Alice') && success.deletedStudents.includes('Bob'));
            }
            if (action === 'reset') {
                assert.ok(success.deletedStudents.includes('Carol'));
                assert.deepEqual([...new Set(success.deletedSessions)].sort(), ['a', 'b', 'c']);
                assert.deepEqual(success.visibleToSync, []);
                assert.equal(success.flushes, 1);
            }
            assert.deepEqual(errors, []);
            await page.close();
        }
        console.log('Browser class deletion tests passed: actual reset, clear and Delete buttons preserve saved writing, roster, selection and sync visibility on failed writes; recovery retries succeed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
