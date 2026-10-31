const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const localAppRoute = require('./support/local-app-route');
const root = path.resolve(__dirname, '..');
const results = [];
const scenarios = process.env.WFT_PORTFOLIO_CASES ? process.env.WFT_PORTFOLIO_CASES.split(',') : ['chronological', 'one', 'down', 'flat', 'missing', 'unscored-latest', 'unscored-previous', 'undated', 'blank-vs-zero', 'unsafe', 'no-library', 'no-api', 'switch', 'compact', 'points-up', 'points-down', 'points-flat', 'points-zero', 'points-missing', 'points-decimal', 'points-one', 'points-tiny', 'context-grade', 'context-genre', 'context-guide', 'policy-grammar', 'policy-target-enabled', 'policy-target-words', 'policy-neatness', 'policy-model', 'policy-missing-previous', 'policy-missing-both', 'policy-partial', 'policy-identical', 'policy-disabled-target', 'policy-numeric-strings', 'policy-invalid-boolean', 'policy-invalid-number', 'policy-invalid-model', 'policy-missing-latest', 'policy-mixed'];

async function render(page, scenario) {
    return page.evaluate(async scenario => {
        stopWftSyncPolling(); stopDriveAutoSync(); localStorage.clear(); pendingPortfolioSync = null;
        wftSuppressDirtyMarks = true; driveAccessToken = ''; WFT_ASYNC_PORTFOLIO_ACCESS_V1 = false;
        switchTab('portfolio');
        const unsafe = '<img src="/injected" onerror="window.chartInjected=true">';
        const name = scenario === 'unsafe' ? 'Alice " & ' + unsafe : scenario === 'compact' ? 'Alexandria Elizabeth Montgomery '.repeat(5).trim() : 'Alice';
        students = [name, 'Bob']; selectedStudent = name;
        const first = { id: 'first', createdAt: '2026-01-01T00:00:00Z', date: 'January 1, 2026', title: 'First writing', overall: 0,
            categoryScores: { Grammar: 0, Flow: null }, originalText: 'Original first writing.', gradeLevel: 5,
            feedbackSummary: { growGoal: 'Add specific details to each paragraph.' },
            writingGenreInfo: { mainGenre: 'Narrative / Story', subtype: 'Story', safeReference: 'story' } };
        const second = { ...first, id: 'second', createdAt: '2026-01-02T00:00:00Z', date: 'January 2, 2026', title: 'Second writing', overall: '60',
            categoryScores: { Grammar: '6', Flow: 7, Neatness: 0 } };
        const third = { ...first, id: 'third', createdAt: '2026-01-03T00:00:00Z', date: 'January 3, 2026', title: 'Third writing', overall: 80,
            categoryScores: { Grammar: 8, Flow: 9, Extra: '4' } };
        let sessions = [third, first, second];
        if (scenario === 'compact') {
            third.title = 'A named writing project with a long title and clear saved identity '.repeat(3).trim();
            third.feedbackSummary = { growGoal: 'Keep the reader informed with clear examples and a connected explanation. '.repeat(12).trim() };
        }
        if (scenario.startsWith('points-') || scenario.startsWith('context-')) {
            sessions = [{ ...second, overall: 72 }, { ...third, overall: 78 }];
            if (scenario === 'points-down') sessions = [{ ...second, overall: 78 }, { ...third, overall: 72 }];
            if (scenario === 'points-flat') sessions[1].overall = 72;
            if (scenario === 'points-one') sessions[1].overall = 73;
            if (scenario === 'points-tiny') sessions[1].overall = 72.001;
            if (scenario === 'points-zero') { sessions[0].overall = 0; sessions[1].overall = 6; }
            if (scenario === 'points-missing') sessions[1].overall = null;
            if (scenario === 'points-decimal') { sessions[0].overall = 72.5; sessions[1].overall = 78.2; }
            if (scenario === 'context-grade') sessions[1].gradeLevel = 6;
            if (scenario === 'context-genre') sessions[1].writingGenreInfo = { mainGenre: 'Opinion / Argument', subtype: 'Opinion Writing', safeReference: 'opinion piece' };
            if (scenario === 'context-guide') { sessions[0].gradeProfileVersion = 'saved-v1'; sessions[1].gradeProfileVersion = 'saved-v2'; }
        }
        if (scenario.startsWith('policy-')) {
            const policy = { grammarStrictness: 3, targetEnabled: true, targetWords: 200, neatnessActive: false, model: 'saved-model-a' };
            sessions = [{ ...second, overall: 72, gradeProfileVersion: 'same-guide', assessmentPolicy: { ...policy } },
                { ...third, overall: 78, gradeProfileVersion: 'same-guide', assessmentPolicy: { ...policy } }];
            if (scenario === 'policy-grammar') { sessions[0].assessmentPolicy.grammarStrictness = 1; sessions[1].assessmentPolicy.grammarStrictness = 5; }
            if (scenario === 'policy-target-enabled') sessions[1].assessmentPolicy.targetEnabled = false;
            if (scenario === 'policy-target-words') sessions[1].assessmentPolicy.targetWords = 300;
            if (scenario === 'policy-neatness') sessions[1].assessmentPolicy.neatnessActive = true;
            if (scenario === 'policy-model') sessions[1].assessmentPolicy.model = 'saved-model-b';
            if (scenario === 'policy-missing-previous' || scenario === 'policy-missing-both') delete sessions[0].assessmentPolicy;
            if (scenario === 'policy-missing-both' || scenario === 'policy-missing-latest') delete sessions[1].assessmentPolicy;
            if (scenario === 'policy-mixed') { sessions[1].assessmentPolicy.grammarStrictness = 5; delete sessions[1].assessmentPolicy.model; }
            if (scenario === 'policy-partial') delete sessions[1].assessmentPolicy.grammarStrictness;
            if (scenario === 'policy-invalid-boolean') sessions[1].assessmentPolicy.neatnessActive = 'false';
            if (scenario === 'policy-invalid-number') sessions[1].assessmentPolicy.grammarStrictness = 'Infinity';
            if (scenario === 'policy-invalid-model') sessions[1].assessmentPolicy.model = '   ';
            if (scenario === 'policy-disabled-target') { sessions[0].assessmentPolicy.targetEnabled = false; sessions[1].assessmentPolicy.targetEnabled = false; sessions[1].assessmentPolicy.targetWords = 300; }
            if (scenario === 'policy-numeric-strings') { sessions[1].assessmentPolicy.grammarStrictness = '3'; sessions[1].assessmentPolicy.targetWords = '200'; }
        }
        if (scenario === 'one') sessions = [second];
        if (scenario === 'down') sessions = [{ ...second, overall: 80 }, { ...third, overall: 60 }];
        if (scenario === 'flat') sessions = [second, { ...third, overall: 60 }];
        if (scenario === 'unscored-previous') sessions = [{ ...second, overall: null }, third];
        if (scenario === 'undated') sessions = [{ ...first, date: '', createdAt: '' }];
        if (scenario === 'blank-vs-zero') sessions = [first, { ...second, overall: '   ' }, { ...third, overall: 'Infinity' }];
        if (scenario === 'missing') sessions = [{ ...first, overall: null, categoryScores: { Grammar: 'bad' } }];
        if (scenario === 'unscored-latest') sessions = [second, { ...third, overall: null }];
        if (scenario === 'unsafe') sessions = [{ ...first, date: unsafe, title: unsafe, categoryScores: { [unsafe]: 4, Grammar: 5 } }];
        const data = { [name]: { sessions }, Bob: { sessions: [{ ...second, id: 'bob', title: 'Bob only', overall: 75 }] } };
        localStorage.setItem('wft_portfolio', JSON.stringify(data));
        localStorage.setItem('wft_students', JSON.stringify([name, 'Bob']));
        localStorage.setItem('wft_settings', JSON.stringify({ students: [name, 'Bob'] }));
        const select = document.getElementById('portfolioStudentSelect');
        select.replaceChildren(new Option(name, name), new Option('Bob', 'Bob')); select.value = name;
        const before = JSON.stringify({ ...localStorage });
        const configs = [], destroyed = [];
        window.chartVisibilityCalls = []; window.chartUpdateCalls = 0;
        window.Chart = function(element, config) {
            configs.push({ canvas: element.id, data: config.data, options: config.options });
            this.destroy = () => destroyed.push(element.id);
            this.setDatasetVisibility = (index, visible) => window.chartVisibilityCalls.push({ canvas: element.id, index, visible });
            this.update = () => window.chartUpdateCalls++;
        };
        if (scenario === 'no-api') window.Chart = function(element, config) { configs.push({ canvas: element.id, data: config.data, options: config.options }); this.destroy = () => destroyed.push(element.id); };
        if (scenario === 'no-library') delete window.Chart;
        renderStudentPortfolio();
        await new Promise(resolve => setTimeout(resolve, 100));
        if (scenario === 'switch') {
            select.value = 'Bob'; renderStudentPortfolio();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const content = document.getElementById('portfolioContent');
        const table = content.querySelector('table');
        return {
            name, unchangedStorage: before === JSON.stringify({ ...localStorage }), injected: window.chartInjected === true,
            canvases: [...content.querySelectorAll('canvas')].map(canvas => ({ role: canvas.getAttribute('role'), name: canvas.getAttribute('aria-label'),
                description: (canvas.getAttribute('aria-describedby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') })),
            stats: [...content.querySelectorAll('.stat-value')].slice(0, 3).map(node => node.textContent),
            trend: content.querySelector('.stat-trend')?.textContent || '',
            scoreLabels: [...content.querySelectorAll('.session-score')].map(node => node.textContent),
            summary: content.querySelector('.portfolio-chart-summary')?.textContent || '',
            caption: table?.caption?.textContent || '', headers: table ? [...table.querySelectorAll('thead th')].map(node => ({ text: node.textContent, scope: node.scope })) : [],
            rows: table ? [...table.querySelectorAll('tbody tr')].map(row => [...row.children].map(cell => cell.textContent)) : [],
            rowHeaders: table ? [...table.querySelectorAll('tbody tr')].every(row => row.querySelector('th[scope="row"]')) : false,
            unsafeElements: content.querySelectorAll('.portfolio-chart-data img, .portfolio-chart-summary img').length,
            unavailable: [...content.querySelectorAll('.portfolio-chart-wrap .portfolio-empty')].map(node => node.textContent),
            cards: [...content.querySelectorAll('.session-card')].map(node => ({ title: node.querySelector('.session-title').textContent,
                nextGoal: node.querySelector('.session-next-goal')?.textContent || '',
                student: node.querySelector('.btn-reassess').dataset.student, session: node.querySelector('.btn-reassess').dataset.session })),
            configs, destroyed
        };
    }, scenario);
}

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const scenario of scenarios) {
            const context = await browser.newContext({ locale: 'en-US', timezoneId: 'Asia/Bangkok' });
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await context.route('**/*', route => localAppRoute(route, root));
            try {
                await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                const actual = await render(page, scenario);
                assert.deepEqual(errors, [], scenario + ': browser error');
                assert.equal(await page.getByRole('table', { name: 'Score history for ' + (scenario === 'switch' ? 'Bob' : actual.name), exact: true }).count(), 1, scenario + ': score history is not exposed as a named table');
                assert.equal(actual.unchangedStorage, true, scenario + ': rendering changed saved records');
                assert.equal(actual.injected, false, scenario + ': imported markup executed');
                assert.equal(actual.unsafeElements, 0, scenario + ': imported markup entered chart alternative');
                if (scenario === 'blank-vs-zero') {
                    assert.deepEqual(actual.stats, ['Not scored', '0%', '0%'], 'Imported blanks/nonfinite values must not become zero or infinity in stats');
                    assert.deepEqual(actual.scoreLabels, ['Not scored', 'Not scored', '0%']);
                    assert.equal(actual.trend, '');
                    const dialogs = await page.evaluate(() => {
                        const before = localStorage.getItem('wft_portfolio');
                        openPortfolioDetailedFeedback('Alice', 'third');
                        const detail = document.querySelector('.portfolio-feedback-subtitle').textContent;
                        closePortfolioFeedbackModal();
                        openPortfolioCategoryFeedback('Alice', 'second', 'Grammar');
                        const category = document.querySelector('.portfolio-feedback-subtitle').textContent;
                        closePortfolioFeedbackModal();
                        return { detail, category, unchanged: before === localStorage.getItem('wft_portfolio') };
                    });
                    assert.deepEqual(dialogs, { detail: 'Third writing - Not scored', category: 'Second writing - Not scored', unchanged: true });
                }
                assert.equal(actual.caption, 'Score history for ' + (scenario === 'switch' ? 'Bob' : actual.name), scenario + ': accessible score-history table missing');
                assert.ok(actual.headers.every(header => header.scope === 'col'), scenario + ': missing table column scope');
                assert.equal(actual.rowHeaders, true, scenario + ': missing table row headers');
                assert.deepEqual(actual.headers.slice(0, 4).map(header => header.text), ['Date', 'Writing', 'Overall (%)', 'Ideas & Details (/10)']);
                assert.match(actual.summary, /oldest to newest/i);
                if (scenario !== 'no-library') {
                    assert.equal(actual.canvases.length, 2);
                    for (const canvas of actual.canvases) {
                        assert.equal(canvas.role, 'img');
                        assert.ok(canvas.name.includes(scenario === 'switch' ? 'Bob' : actual.name));
                        assert.match(canvas.name, /overall.*percent|category.*out of 10/i);
                        assert.match(canvas.description, /oldest to newest/i);
                        assert.match(canvas.description, /score history table/i);
                    }
                    const datasets = actual.configs.at(-1).data.datasets;
                    const styles = datasets.map(dataset => JSON.stringify([dataset.borderDash, dataset.pointStyle]));
                    assert.equal(new Set(styles).size, datasets.length, scenario + ': categories still depend on color alone');
                    assert.equal(actual.configs.at(-1).options.plugins.legend.labels.usePointStyle, true);
                    assert.equal(actual.configs.at(-1).options.plugins.legend.onClick, undefined);
                    // The built-in legend is display-only; native controls preserve hide/show access.
                    assert.equal(actual.configs.at(-1).options.plugins.legend.display, false);
                }
                if (scenario === 'chronological' || scenario === 'no-library') {
                    assert.deepEqual(actual.rows.map(row => row.slice(0, 3)), [
                        ['January 1, 2026', 'First writing', '0%'], ['January 2, 2026', 'Second writing', '60%'], ['January 3, 2026', 'Third writing', '80%']
                    ]);
                    const column = label => actual.headers.findIndex(header => header.text === label);
                    assert.deepEqual(actual.rows.map(row => row[column('Grammar (/10)')]), ['0/10', '6/10', '8/10']);
                    assert.deepEqual(actual.rows.map(row => row[column('Flow (/10)')]), ['Not scored', '7/10', '9/10']);
                    assert.deepEqual(actual.rows.map(row => row[column('Neatness (/10)')]), ['Not scored', '0/10', 'Not scored']);
                    assert.deepEqual(actual.rows.map(row => row[column('Extra (/10)')]), ['Not scored', 'Not scored', '4/10']);
                    assert.match(actual.summary, /increased from 60%.*January 2, 2026.*80%.*January 3, 2026/);
                    assert.deepEqual(actual.cards.map(card => card.session), ['third', 'second', 'first']);
                }
                if (scenario === 'chronological') {
                    const grammar = page.getByRole('checkbox', { name: 'Show Grammar', exact: true });
                    assert.equal(await grammar.count(), 1, 'Category hide/show needs a native keyboard control');
                    assert.equal(await grammar.isEnabled(), true);
                    await grammar.focus(); await page.keyboard.press('Space');
                    assert.equal(await grammar.isChecked(), false);
                    assert.deepEqual(await page.evaluate(() => chartVisibilityCalls.at(-1)), { canvas: actual.configs[1].canvas, index: actual.configs[1].data.datasets.findIndex(dataset => dataset.label === 'Grammar'), visible: false });
                    await page.keyboard.press('Space');
                    assert.equal(await grammar.isChecked(), true);
                    assert.equal(await page.evaluate(() => chartVisibilityCalls.at(-1).visible), true);
                    assert.equal(await page.evaluate(() => chartUpdateCalls), 2);
                    assert.equal(await page.evaluate(() => document.querySelectorAll('.portfolio-chart-data tbody tr').length), actual.rows.length, 'Chart filtering must retain the full table');
                    assert.deepEqual(actual.configs[0].data.datasets[0].data, [0, 60, 80]);
                    assert.deepEqual(actual.configs[1].data.labels, ['January 1, 2026', 'January 2, 2026', 'January 3, 2026']);
                }
                if (scenario === 'one') assert.match(actual.summary, /60%.*another session.*compare/i);
                if (scenario === 'down') assert.match(actual.summary, /decreased from 80%.*60%/i);
                if (scenario === 'flat') assert.match(actual.summary, /unchanged at 60%/i);
                if (scenario === 'unscored-previous') assert.match(actual.summary, /80%.*previous.*not scored/i);
                if (scenario === 'undated') assert.equal(actual.rows[0][0], 'Unknown date');
                if (scenario === 'blank-vs-zero') {
                    assert.deepEqual(actual.rows.map(row => row[2]), ['0%', 'Not scored', 'Not scored']);
                    assert.deepEqual(actual.configs[0].data.datasets[0].data, [0, null, null]);
                    assert.match(actual.summary, /latest overall score.*not scored/i);
                }
                if (scenario === 'missing') {
                    assert.equal(actual.rows[0][2], 'Not scored');
                    assert.ok(actual.rows[0].slice(3).every(value => value === 'Not scored'));
                    assert.match(actual.summary, /latest overall score.*not scored/i);
                }
                if (scenario === 'unscored-latest') assert.match(actual.summary, /latest overall score.*not scored/i);
                if (scenario === 'unsafe') {
                    assert.equal(actual.rows[0][0], '<img src="/injected" onerror="window.chartInjected=true">');
                    assert.ok(actual.headers.some(header => header.text.includes('<img src=')));
                }
                if (scenario === 'no-library') { assert.equal(actual.canvases.length, 0); assert.equal(actual.unavailable.length, 2); }
                if (scenario === 'compact') {
                    const entries = page.locator('.session-card');
                    assert.deepEqual(actual.cards.map(card => card.session), ['third', 'second', 'first']);
                    assert.equal(await entries.locator('details.portfolio-session-details').count(), 3, 'Saved work needs native entry disclosures');
                    assert.ok(await entries.locator('details.portfolio-session-details').evaluateAll(items => items.every(item => !item.open)), 'Entries default to compact');
                    assert.ok(actual.cards.every(card => card.nextGoal.includes('Next goal:')));
                    for (const entry of await entries.all()) {
                        assert.equal(await entry.locator('.btn-reprint').isVisible(), true, 'Reprint stays visible while collapsed');
                        assert.equal(await entry.locator('.btn-reassess').isVisible(), true, 'Reassess stays visible while collapsed');
                        assert.equal(await entry.locator('.btn-delete').isVisible(), false, 'Removal is subordinate to the selected saved work');
                        assert.equal(await entry.locator('.session-artifact-grid').isVisible(), false);
                    }
                    const selected = entries.filter({ has: page.locator('.btn-reassess[data-session="third"]') });
                    const summary = selected.locator('summary.portfolio-session-summary');
                    assert.ok((await summary.textContent()).includes(actual.cards[0].title));
                    assert.match(await summary.textContent(), /January 3, 2026.*80%.*Next goal:/s);
                    await summary.focus(); await page.keyboard.press('Enter');
                    assert.equal(await selected.locator('details').evaluate(node => node.open), true);
                    assert.equal(await selected.locator('.session-artifact-grid').isVisible(), true);
                    assert.equal(await selected.locator('.btn-delete').isVisible(), true);
                    await page.evaluate(() => { window.portfolioEntryActions = []; window.printPortfolioNotebookSummary = (...args) => portfolioEntryActions.push(['print', ...args]); window.reassessPortfolioSession = (...args) => portfolioEntryActions.push(['reassess', ...args]); });
                    await selected.locator('.btn-reprint').click();
                    await selected.locator('.btn-reassess').click();
                    assert.deepEqual(await page.evaluate(() => portfolioEntryActions), [['print', actual.name, 'third'], ['reassess', actual.name, 'third']]);
                    assert.equal(await selected.locator('details').evaluate(node => node.open), true, 'Entry actions preserve the selected place');
                    assert.equal(await page.evaluate(() => document.querySelector('.portfolio-chart-data tbody tr').children[1].textContent), 'First writing', 'Compact history must not reverse chart chronology');
                }
                if (scenario === 'points-up' || scenario === 'points-zero') assert.equal(actual.trend, 'Up 6 percentage points from previous writing');
                if (scenario === 'points-one') assert.equal(actual.trend, 'Up 1 percentage point from previous writing');
                if (scenario === 'points-tiny') assert.equal(actual.trend, 'Up less than 0.01 percentage point from previous writing');
                if (scenario === 'points-down') assert.equal(actual.trend, 'Down 6 percentage points from previous writing');
                if (scenario === 'points-flat') assert.equal(actual.trend, 'No change from previous writing');
                if (scenario === 'points-missing') { assert.equal(actual.trend, ''); assert.equal(actual.stats[0], 'Not scored'); }
                if (scenario === 'points-decimal') assert.equal(actual.trend, 'Up 5.7 percentage points from previous writing');
                if (scenario.startsWith('context-')) {
                    assert.match(actual.summary, /context changed|scoring guide changed/i);
                    assert.match(actual.summary, /not directly comparable/i);
                    if (scenario === 'context-grade') assert.match(actual.summary, /Grade 5.*Grade 6/);
                    if (scenario === 'context-genre') assert.match(actual.summary, /Narrative \/ Story.*Opinion \/ Argument/);
                }
                if (['policy-grammar', 'policy-target-enabled', 'policy-target-words', 'policy-neatness', 'policy-model'].includes(scenario)) {
                    assert.match(actual.summary, /assessment context changed/i, scenario + ': saved scoring-setting change is undisclosed');
                    assert.match(actual.summary, /not directly comparable/i);
                    const expectedSetting = { 'policy-grammar': /grammar strictness.*1.*5/i, 'policy-target-enabled': /word-count target/i,
                        'policy-target-words': /word-count target.*200.*300/i, 'policy-neatness': /neatness/i, 'policy-model': /assessment model.*saved-model-a.*saved-model-b/i };
                    assert.match(actual.summary, expectedSetting[scenario]);
                    assert.equal(actual.trend, 'Up 6 percentage points from previous writing');
                }
                if (['policy-missing-previous', 'policy-missing-both', 'policy-partial', 'policy-invalid-boolean', 'policy-invalid-number', 'policy-invalid-model', 'policy-missing-latest', 'policy-mixed'].includes(scenario)) {
                    assert.match(actual.summary, /saved scoring settings.*(?:missing|unknown)|scoring settings.*not saved/i);
                    assert.match(actual.summary, /unknown/i, 'Missing saved policy must not inherit current Settings');
                    assert.match(actual.summary, /not directly comparable/i);
                    if (scenario === 'policy-partial') assert.match(actual.summary, /grammar strictness/i);
                    if (scenario === 'policy-mixed') { assert.match(actual.summary, /assessment context changed.*grammar strictness/i); assert.match(actual.summary, /unknown.*assessment model/i); }
                }
                if (['policy-identical', 'policy-disabled-target', 'policy-numeric-strings'].includes(scenario)) {
                    assert.doesNotMatch(actual.summary, /assessment context changed|scoring settings.*unknown|not directly comparable/i);
                    assert.match(actual.summary, /task difficulty may differ/i);
                }
                if (scenario === 'no-library' || scenario === 'no-api') {
                    const controls = page.locator('.portfolio-chart-legend input');
                    assert.ok(await controls.count() > 0);
                    assert.ok(await controls.evaluateAll(inputs => inputs.every(input => input.disabled)), 'Unavailable chart API must not advertise working filters');
                }
                if (scenario === 'switch') {
                    assert.equal(actual.rows.length, 1); assert.equal(actual.rows[0][1], 'Bob only');
                    assert.ok(actual.cards.every(card => card.student === 'Bob' && card.session === 'bob'));
                    assert.equal(actual.destroyed.length, 2);
                }
                results.push({ scenario, passed: true });
            } finally { await context.close(); }
        }
    } finally { await browser.close(); }
    if (process.env.WFT_TEST_REPORT) fs.writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify({ root, cases: results }, null, 2));
    console.log('Portfolio UX passed: accessible chart names/descriptions, exact chronological score table, missing values, non-color series, fallback, sanitization and student ownership.');
})().catch(error => { console.error(error); process.exitCode = 1; });
