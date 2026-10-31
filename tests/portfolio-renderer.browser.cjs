const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');
// The reference is the unmodified renderer at 35bf15ee8533; shared helpers stay shipped code.
const reference = fs.readFileSync(path.join(__dirname, 'fixtures/portfolio-renderer-baseline.js'), 'utf8').replace(/\r\n/g, '\n');
assert.equal(crypto.createHash('sha256').update(reference).digest('hex'), 'c89a135a46be7f6f80574dbd1daab3f80640246879116181470305df79450cfe');
const cases = [
    'missing-select', 'missing-content', 'no-selection', 'missing-student', 'empty', 'one',
    'mixed', 'all-missing', 'trend-up', 'trend-down', 'trend-flat', 'unscored-latest',
    'odd-dates', 'legacy-ids', 'unsafe-markup', 'missing-chart', 'missing-one-canvas',
    'rerender-before-charts', 'empty-before-charts', 'throwing-destroy',
    'drive-success', 'drive-failure', 'safe-mode', 'async-success', 'async-error',
    'adapter-success', 'adapter-error', 'adapter-fallback', 'feedback-actions'
];

async function exercise(page, scenario) {
    return page.evaluate(async scenario => {
        stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear(); pendingPortfolioSync = null;
        wftSuppressDirtyMarks = true; driveAccessToken = ''; students = ['Alice', 'Bob']; selectedStudent = 'Alice';
        const payload = '<img src="/injected" onerror="window.injected=true">';
        const name = scenario === 'unsafe-markup' ? 'Alice " & \' ' + payload : 'Alice';
        const base = { id: 'first', createdAt: '2026-01-01T00:00:00Z', date: 'First', title: 'First work', overall: 60,
            categoryScores: { Grammar: 6, Flow: 7 }, originalText: 'Protected original.', correctedHtml: '<strong>Corrected</strong>',
            feedbackSummary: { strength: 'Good detail', growGoal: 'Use full stops' } };
        const second = { ...base, id: 'second', createdAt: '2026-01-02T00:00:00Z', date: 'Second', title: 'Second work', overall: 80 };
        let sessions = [{ ...base }];
        if (['missing-student', 'empty'].includes(scenario)) sessions = [];
        if (scenario === 'mixed') sessions = [{ ...second, overall: '85', categoryScores: { Grammar: '8', Neatness: 0, Extra: '9' } },
            { ...base, overall: 0, categoryScores: { Grammar: 0, Flow: null } },
            { ...base, id: 'third', createdAt: '2026-01-03T00:00:00Z', date: '', overall: null, categoryScores: { Grammar: 'bad', Extra: null }, neatnessAssessed: true }];
        if (scenario === 'all-missing') sessions = [{ ...base, overall: null, categoryScores: {} }, { ...second, overall: undefined, categoryScores: { Grammar: null } }];
        if (scenario.startsWith('trend-')) sessions = [base, { ...second, overall: scenario === 'trend-up' ? 80 : scenario === 'trend-down' ? 40 : 60 }];
        if (scenario === 'unscored-latest') sessions = [base, { ...second, overall: null }];
        if (scenario === 'odd-dates') sessions = [{ ...base, id: 'missing-date', createdAt: '', overall: '' }, { ...base, id: 'invalid-date', createdAt: 'invalid', overall: 'bad' },
            { ...second, id: 'equal-a' }, { ...second, id: 'equal-b', categoryScores: { Grammar: 6, Flow: 6 } }];
        if (scenario === 'legacy-ids') sessions = [{ ...second, id: '', createdAt: '' }, { ...base, id: '' }, { ...base, id: '1', createdAt: '2026-01-03T00:00:00Z' }];
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2; canvas.getContext('2d').fillRect(0, 0, 2, 2);
        const png = canvas.toDataURL('image/png');
        if (scenario === 'unsafe-markup') sessions = [{ ...base, id: 'id " & \'', date: payload, title: payload, overall: payload, gradeLabel: payload,
            categoryScores: { [payload]: payload, Grammar: null }, originalText: payload, correctedHtml: '<strong>Keep formatting</strong>' + payload,
            feedbackSummary: { strength: '**Safe bold** ' + payload }, images: [{ name: 'Local " & \' photo', dataUrl: png, pendingDriveUpload: true },
                { name: payload, dataUrl: 'data:image/png;base64,bad" onerror="window.injected=true' },
                { name: 'SVG', dataUrl: 'data:image/svg+xml,<svg onload="window.injected=true"/>' },
                { name: 'External', dataUrl: 'https://invalid.example/photo.png' }, { name: 'Invalid Drive', driveFileId: 'bad/id' }] }];
        if (scenario.startsWith('drive-')) {
            sessions[0].images = [{ name: 'Drive work', driveFileId: 'synthetic_drive-id' }]; driveAccessToken = 'synthetic';
        }
        if (scenario === 'feedback-actions') sessions[0].detailedFeedback = { categories: { Grammar: { score: 6, feedback: 'Synthetic saved feedback.', strengths: ['Full sentences'], improvements: ['Use full stops'] } } };
        const data = { [name]: { sessions }, Bob: { sessions: [{ ...second, id: 'bob', title: 'Bob only' }] } };
        if (scenario === 'missing-student') delete data[name];
        localStorage.setItem('wft_portfolio', JSON.stringify(data));
        localStorage.setItem('wft_students', JSON.stringify([name, 'Bob']));
        localStorage.setItem('wft_settings', JSON.stringify({ students: [name, 'Bob'] }));
        const select = document.getElementById('portfolioStudentSelect'), content = document.getElementById('portfolioContent');
        select.innerHTML = ''; select.appendChild(new Option('Select', '')); select.appendChild(new Option(name, name)); select.appendChild(new Option('Bob', 'Bob')); select.value = name;
        if (scenario === 'no-selection') select.value = '';
        if (scenario === 'missing-select') select.remove();
        if (scenario === 'missing-content') content.remove();
        // Finding 09 adds chart alternatives; compare the original surface separately from its focused UX assertions.
        function originalPortfolioHtml() {
            const original = content.cloneNode(true);
            original.querySelectorAll('.portfolio-chart-summary, .portfolio-chart-table-hint, .portfolio-chart-data, .portfolio-chart-legend, .portfolio-chart-loading').forEach(node => node.remove());
            original.querySelectorAll('canvas').forEach(canvas => ['role', 'aria-label', 'aria-describedby'].forEach(attribute => canvas.removeAttribute(attribute)));
            // Finding 14 wraps the original saved work in a disclosure and moves removal below its expanded content.
            original.querySelectorAll('.session-card').forEach(card => {
                const details = card.querySelector('details.portfolio-session-details');
                if (!details) return;
                const header = details.querySelector('.session-card-header');
                const body = details.querySelector('.portfolio-session-body');
                const actions = card.querySelector(':scope > .session-card-actions');
                const removal = body.querySelector('.session-remove-action');
                actions.append(...removal.childNodes); removal.remove();
                for (const selector of ['.session-card-title-wrap', '.session-date', '.session-score']) {
                    const node = header.querySelector(selector), replacement = document.createElement('div');
                    [...node.attributes].forEach(attribute => replacement.setAttribute(attribute.name, attribute.value));
                    replacement.append(...node.childNodes); node.replaceWith(replacement);
                }
                const originalHeader = document.createElement('div'); originalHeader.className = header.className;
                originalHeader.append(...header.childNodes);
                card.replaceChildren(originalHeader, ...body.childNodes, actions);
            });
            return original.innerHTML.replace(/blob:[^"\s]+/g, '[object-url]');
        }
        const before = { ...localStorage }, timers = [], created = [], destroyed = [], loads = [], requests = [], logs = [];
        const originalTimeout = window.setTimeout;
        window.setTimeout = (fn, delay, ...args) => delay === 50 ? (timers.push(() => fn(...args)), timers.length) : originalTimeout(fn, delay, ...args);
        let clock = 1700000000000; Date.now = () => clock++;
        window.Chart = function(element, config) {
            this.destroy = () => destroyed.push(element.id);
            created.push({ canvas: element.id, config: JSON.parse(JSON.stringify(config, (key, value) => typeof value === 'function' ? '[callback]' : value)),
                tick: config.options.scales.y.ticks.callback(42), tooltip: config.options.plugins.tooltip?.callbacks.label({ parsed: { y: 57 } }) || null });
        };
        wftPortfolioChartInstances = { old: { destroy() { destroyed.push('old'); if (scenario === 'throwing-destroy') throw Error('Synthetic destroy failure'); } } };
        wftDebugError = (...args) => logs.push(String(args[0])); wftDebugWarn = (...args) => logs.push(String(args[0]));
        window.fetch = async url => {
            requests.push(String(url));
            assertSyntheticMediaUrl(url);
            if (scenario === 'drive-failure') return new Response('', { status: 503 });
            return new Response(Uint8Array.from(atob(png.split(',')[1]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png' } });
        };
        function assertSyntheticMediaUrl(url) { if (!String(url).includes('/synthetic_drive-id?alt=media')) throw Error('Unexpected synthetic request'); }
        if (scenario === 'missing-chart') delete window.Chart;
        if (scenario.startsWith('async-') || scenario.startsWith('adapter-') || ['safe-mode', 'legacy-ids'].includes(scenario)) {
            WFT_ASYNC_PORTFOLIO_ACCESS_V1 = scenario !== 'adapter-fallback';
            if (scenario === 'safe-mode') localStorage.setItem(WFT_STORAGE_META_KEY, JSON.stringify({ safeMode: true }));
            loadStudentPortfolioAsync = async value => {
                loads.push(value);
                if (scenario.endsWith('-error')) throw Error('Synthetic read failure');
                return data[value];
            };
        }
        // Safe-mode storage is part of this scenario's initial state, not a render write.
        const renderBefore = { ...localStorage };
        let error = null, immediate = null;
        try {
            if (scenario.startsWith('adapter-')) { select.value = 'Bob'; await renderStudentPortfolioAsync(name); }
            else renderStudentPortfolio();
            immediate = originalPortfolioHtml();
            await new Promise(resolve => originalTimeout(resolve, 20));
        } catch (e) { error = e.message; }
        if (scenario === 'missing-one-canvas') content.querySelector('canvas').remove();
        if (scenario === 'rerender-before-charts') { select.value = 'Bob'; renderStudentPortfolio(); }
        if (scenario === 'empty-before-charts') { select.value = ''; renderStudentPortfolio(); }
        const queued = timers.length;
        while (timers.length) timers.shift()();
        if (scenario === 'throwing-destroy') { select.value = ''; renderStudentPortfolio(); }
        const dialogs = [];
        if (scenario === 'feedback-actions') {
            content.querySelector('[data-category="Grammar"]').click(); dialogs.push(document.getElementById('portfolioFeedbackModalBackdrop').textContent);
            closePortfolioFeedbackModal(); content.querySelector('.btn-view-detailed-feedback').click(); dialogs.push(document.getElementById('portfolioFeedbackModalBackdrop').textContent); closePortfolioFeedbackModal();
        }
        await new Promise(resolve => originalTimeout(resolve, 20));
        const html = originalPortfolioHtml();
        return { html, immediate, created, destroyed, queued, error, loads, requests, logs, dialogs,
            selected: select.value, flags: { async: WFT_ASYNC_PORTFOLIO_ACCESS_V1, safe: isWftStorageSafeMode() },
            clearedAdapterState: !renderStudentPortfolio._syncRender && !renderStudentPortfolio._asyncStudentData,
            unchangedStorage: JSON.stringify(renderBefore) === JSON.stringify({ ...localStorage }), originalSessions: JSON.stringify(sessions),
            injected: window.injected === true, exportDisabled: document.getElementById('exportSelectedStudentBtn').disabled,
            stats: [...content.querySelectorAll('.stat-value')].map(node => node.textContent),
            cards: [...content.querySelectorAll('.session-card')].map(node => ({ title: node.querySelector('.session-title').textContent, score: node.querySelector('.session-score').textContent,
                actions: [...node.querySelectorAll('button')].map(button => ({ student: button.dataset.student, session: button.dataset.session, category: button.dataset.category || null, handler: button.getAttribute('onclick') })) })),
            images: [...content.querySelectorAll('img')].map(img => ({ src: (img.getAttribute('src') || '').startsWith('blob:') ? '[object-url]' : img.getAttribute('src'), loaded: img.getAttribute('data-drive-loaded'), alt: img.alt })),
            registry: Object.keys(wftPortfolioChartInstances).sort(), setupStorage: !!before.wft_portfolio };
    }, scenario);
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
    try {
        for (const scenario of cases) {
            const observations = [];
            for (const baseline of [true, false]) {
                const context = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Bangkok' }), page = await context.newPage(), errors = [];
                page.on('pageerror', e => errors.push(e.message));
                await context.route('**/*', route => localAppRoute(route, root));
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                if (baseline) await page.addScriptTag({ content: reference });
                try { observations.push(await exercise(page, scenario)); assert.deepEqual(errors, []); }
                finally { await context.close(); }
            }
            const [expected, actual] = observations;
            // Ignore only the added non-color series styles; portfolio-ux asserts those exact behaviors.
            actual.created.forEach(chart => {
                chart.config.data.datasets.forEach(dataset => { delete dataset.borderDash; delete dataset.pointStyle; });
                delete chart.config.options.plugins.legend.labels?.usePointStyle;
                if (chart.canvas.startsWith('portfolioCatChart_')) delete chart.config.options.plugins.legend.display;
            });
            // Invalid imported overall values must remain unscored, including blanks; real zero stays covered by mixed.
            if (scenario === 'odd-dates') {
                expected.created[0].config.data.datasets[0].data = [null, null, 80, 80];
                expected.created[0].config.options.scales.y.min = 70;
                expected.created[0].config.options.scales.y.max = 90;
            }
            if (scenario === 'unsafe-markup') {
                expected.created[0].config.options.scales.y.min = 0;
                expected.created[0].config.options.scales.y.max = 100;
            }
            // Approved score presentation: missing means Not scored; blank/nonfinite imports never become a numeric score.
            function normalizedScore(text) {
                return text === 'N/A' || (scenario === 'odd-dates' && ['%', 'bad%'].includes(text)) || scenario === 'unsafe-markup' ? 'Not scored' : text;
            }
            function normalizedStats(text, index) {
                if (index >= 3) return text;
                if (scenario === 'unsafe-markup' || text === '-') return 'Not scored';
                return scenario === 'odd-dates' && index === 1 ? '80%' : text;
            }
            expected.stats = expected.stats.map(normalizedStats);
            expected.cards.forEach(card => { card.score = normalizedScore(card.score); });
            actual.cards.forEach(card => {
                const removalIndex = card.actions.findIndex(action => action.handler.startsWith('deletePortfolioSession('));
                if (removalIndex >= 0) card.actions.push(...card.actions.splice(removalIndex, 1));
            });
            for (const field of ['html', 'immediate']) {
                if (typeof expected[field] !== 'string') continue;
                let statIndex = 0;
                if (expected[field] === '<div class="portfolio-empty">Select a student above to view their progress charts and session history.</div>') expected[field] = '<div class="portfolio-empty">Select a student above to view saved writing and progress.</div>';
                expected[field] = expected[field].replace('then press Sync to Portfolio to save it here.', 'then press Save portfolio &amp; sync Drive to save it here.');
                expected[field] = expected[field].replace(/(<div class="stat-trend trend-(?:up|down|flat)">)([^<]*)(<\/div>)/g,
                    (whole, open, text, close) => {
                        if (text === 'Same as last') return open + 'No change from previous writing' + close;
                        const points = Number(text.replace('% vs last', ''));
                        return open + (points > 0 ? 'Up ' : 'Down ') + Math.abs(points) + ' percentage points from previous writing' + close;
                    });
                expected[field] = expected[field].replace(/(<div class="stat-value">)([^<]*)(<\/div>)/g,
                    (whole, open, text, close) => open + normalizedStats(text, statIndex++) + close);
                expected[field] = expected[field].replace(/(<div class="session-score" style=")([^"]*)(">)([^<]*)(<\/div>)/g,
                    (whole, open, style, middle, text, close) => {
                        const score = normalizedScore(text);
                        return open + (score === 'Not scored' ? 'color:#94a3b8;border-color:#94a3b833;' : style) + middle + score + close;
                    });
            }
            if (scenario === 'missing-chart') expected.queued = 0;
            if (scenario === 'missing-one-canvas') { expected.created = []; expected.registry = []; }
            assert.deepEqual(actual, expected, scenario + ': changed renderer behavior');
            assert.equal(actual.unchangedStorage, true, scenario + ': render wrote storage');
            assert.equal(actual.injected, false, scenario + ': imported markup executed');
            assert.equal(actual.clearedAdapterState, true, scenario + ': adapter state leaked');
            if (scenario === 'one') { assert.deepEqual(actual.stats.slice(0, 4), ['60%', '60%', '60%', '1']); assert.equal(actual.created.length, 2); assert.deepEqual(actual.registry, ['categories', 'overall']); }
            if (scenario === 'mixed') { assert.deepEqual(actual.stats.slice(0, 4), ['Not scored', '43%', '85%', '3']); assert.deepEqual(actual.created[0].config.data.datasets[0].data, [0, 85, null]); assert.deepEqual(actual.cards.map(card => card.score), ['Not scored', '85%', '0%']); }
            if (scenario === 'all-missing') { assert.deepEqual(actual.stats.slice(0, 3), ['Not scored', 'Not scored', 'Not scored']); assert.deepEqual(actual.created[0].config.options.scales.y.min, 0); assert.equal(actual.created[0].config.options.scales.y.max, 100); }
            if (scenario === 'legacy-ids') assert.deepEqual(actual.cards.map(card => card.actions.at(-1).session), ['1', '2026-01-01T00:00:00Z', '0']);
            if (scenario === 'missing-chart') { assert.equal(actual.created.length, 0); assert.equal((actual.html.match(/chart library did not load/g) || []).length, 2); }
            if (scenario === 'missing-one-canvas') { assert.equal(actual.created.length, 0); assert.deepEqual(actual.registry, []); }
            if (scenario === 'rerender-before-charts') { assert.equal(actual.queued, 2); assert.equal(actual.created.length, 2); assert.equal(actual.cards[0].title, 'Bob only'); }
            if (scenario === 'empty-before-charts') { assert.equal(actual.created.length, 0); assert.deepEqual(actual.registry, []); }
            if (scenario === 'throwing-destroy') { assert.equal(actual.destroyed.length, 3); assert.deepEqual(actual.registry, []); }
            if (scenario === 'drive-success') { assert.equal(actual.images[0].loaded, 'true'); assert.ok(actual.html.includes('Loaded from Drive')); }
            if (scenario === 'drive-failure') assert.ok(actual.html.includes('preview could not load'));
            if (scenario === 'async-success') { assert.ok(actual.immediate.includes('Loading')); assert.deepEqual(actual.loads, ['Alice']); assert.equal(actual.cards.length, 1); }
            if (scenario === 'async-error') assert.ok(actual.html.includes('Could not load this student portfolio'));
            if (scenario === 'safe-mode') { assert.equal(actual.flags.safe, true); assert.deepEqual(actual.loads, []); assert.equal(actual.cards.length, 1); }
            if (scenario === 'adapter-success') { assert.equal(actual.selected, 'Alice'); assert.deepEqual(actual.loads, ['Alice']); }
            if (scenario === 'adapter-error') assert.equal(actual.error, 'Synthetic read failure');
            if (scenario === 'adapter-fallback') { assert.equal(actual.selected, 'Bob'); assert.deepEqual(actual.loads, []); }
            if (scenario === 'feedback-actions') { assert.equal(actual.dialogs.length, 2); assert.ok(actual.dialogs.every(text => text.includes('Grammar'))); }
            results.push({ scenario, passed: true, candidate: actual });
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, referenceCommit: '35bf15ee8533db5b518a873eb5e0401878ca1627', cases: results }, null, 2));
    console.log('Portfolio renderer parity passed: ' + results.length + ' original/candidate scenarios, chart ownership, safe markup, adapters and storage preservation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
