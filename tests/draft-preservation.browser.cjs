const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.WFT_TEST_ROOT || path.resolve(__dirname, '..');
const localAppRoute = require('./support/local-app-route');
const cases = [];
const text = '  A draft 🐕 café\n\nKeep this spacing.  ';
async function seed(page) {
    await page.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
    await page.evaluate(() => {
        stopWftSyncPolling(); scheduleWftCloudSync = () => {}; window.alert = () => {};
        localStorage.setItem('wft_students', JSON.stringify(['Alice', 'Bob']));
        localStorage.setItem('wft_selectedStudent', 'Alice');
        students = ['Alice', 'Bob']; selectedStudent = 'Alice'; populateStudentDropdown();
        document.getElementById('studentSelect').value = 'Alice';
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => { stopWftSyncPolling(); scheduleWftCloudSync = () => {}; window.alert = () => {}; });
}
async function writing(page) { return page.locator('#studentWriting').inputValue(); }
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const [name, run] of [
            ['reload preserves exact text and genre', async page => {
                await page.locator('#studentWriting').fill(text);
                const genre = await page.locator('#writingGenreSelect option').nth(1).getAttribute('value');
                await page.locator('#writingGenreSelect').selectOption(genre);
                await page.reload({ waitUntil: 'load' });
                assert.equal(await writing(page), text);
                assert.equal(await page.locator('#writingGenreSelect').inputValue(), genre);
                assert.match(await page.locator('#writingDraftStatus').textContent(), /browser/i);
            }],
            ['switch isolates drafts and roster navigation', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.locator('#studentSelect').selectOption('Bob');
                assert.equal(await writing(page), '');
                await page.locator('#studentWriting').fill('Bob draft');
                await page.evaluate(() => openStudentPortfolio('Alice'));
                assert.equal(await writing(page), text);
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), text);
            }],
            ['clear persists and Undo preserves newer typing', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.locator('#clearTextBtn').click(); assert.equal(await writing(page), '');
                await page.locator('#undoWritingBtn').click(); assert.equal(await writing(page), text);
                await page.locator('#clearTextBtn').click();
                await page.locator('#studentWriting').fill('New writing');
                await page.locator('#undoWritingBtn').click();
                assert.equal(await writing(page), 'New writing');
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), 'New writing');
            }],
            ['competing tabs retain both versions without lifecycle overwrite', async (page, context) => {
                await page.locator('#studentWriting').fill('Initial');
                const second = await context.newPage(); await second.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.locator('#studentWriting').fill('First tab');
                await second.locator('#studentWriting').fill('Second tab');
                await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                await second.reload({ waitUntil: 'load' });
                assert.equal(await writing(second), 'Second tab');
                await second.evaluate(() => { wftConfirm = async () => true; });
                await second.locator('#recoverWritingBtn').click();
                assert.equal(await writing(second), 'First tab');
                await page.close();
            }],
            ['accepted conflict survives author close and other-tab reload Clear reload', async (page, context) => {
                await page.locator('#studentWriting').fill('Starting version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const second = await context.newPage(); await second.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.locator('#studentWriting').fill('First author version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await second.locator('#studentWriting').fill('Second author version');
                await second.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.close();
                await second.reload({ waitUntil: 'load' }); assert.equal(await writing(second), 'Second author version');
                await second.locator('#clearTextBtn').click();
                await second.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await second.reload({ waitUntil: 'load' }); assert.equal(await writing(second), '');
                const texts = await second.evaluate(() => {
                    const shared = JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice')));
                    const journal = JSON.parse(sessionStorage.getItem(wftWritingDraftKey('Alice')));
                    return [shared.current, shared.recovery, journal.current, journal.recovery].filter(Boolean).map(version => version.text);
                });
                assert.ok(texts.includes('First author version'), 'First author remains recoverable after the other tab clears');
                assert.ok(texts.includes('Second author version'), 'Second author remains recoverable after Clear');
                await second.locator('#recoverWritingBtn').click();
                await second.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const resolved = await second.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice'))));
                assert.equal(resolved.current.text, 'Second author version');
                assert.equal(resolved.recovery.text, 'First author version');
                assert.notEqual(resolved.unresolvedConflict, true, 'Deliberate recovery resolves the shared conflict');
            }],
            ['unrelated roster commit preserves unresolved authors after Clear and reload', async (page, context) => {
                await page.locator('#studentWriting').fill('Starting version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const second = await context.newPage(); await second.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.locator('#studentWriting').fill('First author version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await second.locator('#studentWriting').fill('Second author version');
                await second.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.close();
                await second.reload({ waitUntil: 'load' });
                await second.locator('#clearTextBtn').click();
                await second.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const before = await second.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice')));
                await second.evaluate(async () => { wftConfirm = async () => true; await removeStudent('Bob'); });
                assert.deepEqual(await second.evaluate(() => students), ['Alice'], 'The unrelated roster deletion commits');
                assert.equal(await second.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice'))), before, 'Unresolved shared versions remain untouched by the roster transaction');
                await second.reload({ waitUntil: 'load' });
                assert.equal(await writing(second), '', 'The cleared journal remains the active draft');
                assert.deepEqual(await second.evaluate(() => students), ['Alice']);
                const texts = await second.evaluate(() => {
                    const shared = JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice')));
                    const journal = JSON.parse(sessionStorage.getItem(wftWritingDraftKey('Alice')));
                    return [shared.current, shared.recovery, journal.current, journal.recovery].filter(Boolean).map(version => version.text);
                });
                assert.ok(texts.includes('First author version'), 'The closed author remains recoverable after a roster commit');
                assert.ok(texts.includes('Second author version'), 'The surviving author remains recoverable after a roster commit');
            }],
            ['failed writes retain text and report unsaved state', async page => {
                await page.locator('#studentWriting').fill('Saved');
                await page.evaluate(() => {
                    const set = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) {
                        if (key.startsWith('wft_writing_draft_')) throw new DOMException('Synthetic quota', 'QuotaExceededError');
                        return set.call(this, key, value);
                    };
                });
                await page.locator('#studentWriting').fill('Still here');
                assert.equal(await writing(page), 'Still here');
                assert.match(await page.locator('#writingDraftStatus').textContent(), /not saved|could not|unsaved/i);
            }],
            ['rename another student keeps separate owners', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(async () => { wftTextInput = async () => 'Bobby'; wftConfirm = async () => true; await renameStudent('Bob'); });
                assert.equal(await writing(page), '');
                await page.locator('#studentSelect').selectOption('Alice'); assert.equal(await writing(page), text);
            }],
            ['delete and same-name readd cannot resurrect draft or Undo', async (page, context) => {
                await page.locator('#studentWriting').fill(text);
                await page.locator('#clearTextBtn').click();
                const stale = await context.newPage(); await stale.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.evaluate(async () => { wftConfirm = async () => true; await removeStudent('Alice'); document.getElementById('studentNameInput').value = 'Alice'; addStudent(); });
                assert.equal(await writing(page), '');
                await stale.locator('#studentWriting').fill('Stale deleted class');
                await stale.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), '');
                assert.equal(await page.locator('#undoWritingBtn').isVisible(), false);
            }],
            ['whitespace-only text is restored without trimming', async page => {
                await page.locator('#studentWriting').fill(' \n  \t ');
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), ' \n  \t ');
            }],
            ['unassigned text remains recoverable when adding a student', async page => {
                await page.locator('#studentSelect').selectOption('');
                await page.locator('#studentWriting').fill('Unassigned draft');
                await page.evaluate(() => { document.getElementById('studentNameInput').value = 'Carol'; addStudent(); });
                assert.equal(await writing(page), '');
                await page.locator('#studentSelect').selectOption(''); assert.equal(await writing(page), 'Unassigned draft');
                assert.match(await page.locator('#writingDraftStatus').textContent(), /Unassigned/);
            }],
            ['case-only rename moves only its intended draft', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(async () => { wftTextInput = async () => 'ALICE'; wftConfirm = async () => true; await renameStudent('Alice'); });
                assert.equal(await writing(page), text);
                assert.equal(await page.locator('#studentSelect').inputValue(), 'ALICE');
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), text);
            }],
            ['rename after Clear preserves recovery Undo and same-student photos', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => { selectedImages = [{ imageId: 'alice-photo', imageRevision: 'r1', dataUrl: 'data:image/png;base64,AA==' }]; syncSelectedImageState(); });
                await page.locator('#clearTextBtn').click();
                await page.evaluate(async () => { wftTextInput = async () => 'ALICE'; wftConfirm = async () => true; await renameStudent('Alice'); });
                assert.equal(await writing(page), '');
                assert.equal(await page.locator('#recoverWritingBtn').isVisible(), true);
                assert.equal(await page.evaluate(() => selectedImages[0]?.imageId), 'alice-photo');
                await page.locator('#undoWritingBtn').click(); assert.equal(await writing(page), text);
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), text);
            }],
            ['deleting another student does not create a false competing draft', async page => {
                await page.locator('#studentWriting').fill('Alice before deletion');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.evaluate(async () => { wftConfirm = async () => true; await removeStudent('Bob'); });
                await page.locator('#studentWriting').fill('Alice after deletion');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const record = await page.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice'))));
                assert.equal(record.current.text, 'Alice after deletion');
                assert.equal(record.recovery, null);
                assert.doesNotMatch(await page.locator('#writingDraftStatus').textContent(), /competing|not saved/i);
            }],
            ['competing tab versions remain recoverable through a rename', async (page, context) => {
                await page.locator('#studentWriting').fill('Initial Alice');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const other = await context.newPage(); await other.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.locator('#studentWriting').fill('First Alice version');
                await other.locator('#studentWriting').fill('Other Alice version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.evaluate(async () => { wftTextInput = async () => 'Alicia'; wftConfirm = async () => true; await renameStudent('Alice'); });
                const record = await page.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Alicia'))));
                assert.equal(record.current.text, 'First Alice version');
                assert.equal(record.recovery.text, 'Other Alice version');
                await page.reload({ waitUntil: 'load' });
                await page.evaluate(() => { wftConfirm = async () => true; });
                await page.locator('#recoverWritingBtn').click(); assert.equal(await writing(page), 'Other Alice version');
            }],
            ['renaming an inactive owner waits for that owner’s queued journal', async (page, context) => {
                await page.locator('#studentWriting').fill('Alice current text');
                await page.locator('#studentSelect').selectOption('Bob');
                await page.locator('#studentWriting').fill('Bob committed text');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Bob'), () => {}));
                const blocker = await context.newPage(); await blocker.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await blocker.evaluate(() => { window.__entered = false; navigator.locks.request(wftWritingDraftKey('Bob'), () => new Promise(resolve => { window.__release = resolve; window.__entered = true; })); });
                await blocker.waitForFunction(() => __entered);
                await page.locator('#studentWriting').fill('Bob newer queued text');
                await page.locator('#studentSelect').selectOption('Alice');
                await page.evaluate(async () => { wftTextInput = async () => 'Bobby'; wftConfirm = async () => true; await renameStudent('Bob'); });
                assert.deepEqual(await page.evaluate(() => students), ['Alice', 'Bob']);
                assert.equal(await writing(page), 'Alice current text');
                await blocker.evaluate(() => __release());
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Bob'), () => {}));
                await page.evaluate(() => renameStudent('Bob'));
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Bobby');
                assert.equal(await writing(page), 'Bob newer queued text');
            }],
            ['rename cannot overwrite a same-generation target journal', async page => {
                await page.locator('#studentWriting').fill('Alice current text');
                await page.evaluate(async () => {
                    sessionStorage.setItem(wftWritingDraftKey('Bobby'), JSON.stringify({ generation: '', current: { text: 'Protected target journal', genre: '__auto__', source: null }, recovery: null }));
                    wftTextInput = async () => 'Bobby'; wftConfirm = async () => true; await renameStudent('Bob');
                });
                assert.deepEqual(await page.evaluate(() => students), ['Alice', 'Bob']);
                assert.equal(await writing(page), 'Alice current text');
                assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem(wftWritingDraftKey('Bobby'))).current.text), 'Protected target journal');
            }],
            ['no-lock fallback stays truthful across reload and owner changes', async page => {
                await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true }));
                await page.reload({ waitUntil: 'load' });
                await page.locator('#studentWriting').fill('Tab-only Alice');
                assert.match(await page.locator('#writingDraftStatus').textContent(), /tab only/i);
                await page.locator('#studentSelect').selectOption('Bob');
                await page.locator('#studentWriting').fill('Tab-only Bob');
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), 'Tab-only Bob');
                assert.match(await page.locator('#writingDraftStatus').textContent(), /tab only/i);
                await page.locator('#studentSelect').selectOption('Alice'); assert.equal(await writing(page), 'Tab-only Alice');
            }],
            ['failed recovery journal write keeps current writing and photos', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.locator('#clearTextBtn').click();
                await page.locator('#studentWriting').fill('New current writing');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.evaluate(() => {
                    selectedImages = [{ imageId: 'keep-photo', imageRevision: 'r1', dataUrl: 'data:image/png;base64,AA==' }]; syncSelectedImageState();
                    wftConfirm = async () => true;
                    const set = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) { if (this === sessionStorage && key.startsWith(WFT_WRITING_DRAFT_PREFIX)) throw Error('Synthetic journal failure'); return set.call(this, key, value); };
                });
                await page.locator('#recoverWritingBtn').click();
                assert.equal(await writing(page), 'New current writing');
                assert.equal(await page.evaluate(() => selectedImages[0]?.imageId), 'keep-photo');
                assert.match(await page.locator('#writingDraftStatus').textContent(), /not saved|could not/i);
            }],
            ['drafts and emergency backup exclude credential canaries', async page => {
                await page.evaluate(() => {
                    const settings = getRawSettings(); settings.apiKey = 'SYNTHETIC-CREDENTIAL-CANARY'; localStorage.setItem('wft_settings', JSON.stringify(settings));
                    sessionStorage.setItem('synthetic_private_key', 'SYNTHETIC-SESSION-CANARY');
                });
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const payload = await page.evaluate(() => JSON.stringify({ record: localStorage.getItem(wftWritingDraftKey('Alice')), journal: sessionStorage.getItem(wftWritingDraftKey('Alice')), backup: buildWftEmergencyBackupObject() }));
                assert.doesNotMatch(payload, /SYNTHETIC-CREDENTIAL-CANARY|SYNTHETIC-SESSION-CANARY/);
            }],
            ['Clear recovery survives reload while a shared draft lock is held', async (page, context) => {
                const blocker = await context.newPage(); await blocker.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await blocker.evaluate(() => { window.__entered = false; navigator.locks.request(wftWritingDraftKey('Alice'), () => new Promise(resolve => { window.__release = resolve; window.__entered = true; })); });
                await blocker.waitForFunction(() => __entered);
                await page.locator('#studentWriting').fill(text);
                await page.locator('#clearTextBtn').click();
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), '');
                assert.equal(await page.locator('#recoverWritingBtn').isVisible(), true);
                await page.locator('#recoverWritingBtn').click(); assert.equal(await writing(page), text);
                await blocker.evaluate(() => __release());
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice'))).current.text), text);
            }],
            ['held Clear recovery preserves a competing committed version', async (page, context) => {
                await page.locator('#studentWriting').fill('Initial shared draft');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const blocker = await context.newPage(); await blocker.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await blocker.evaluate(() => { window.__entered = false; navigator.locks.request(wftWritingDraftKey('Alice'), () => new Promise(resolve => { window.__release = resolve; window.__entered = true; })); });
                await blocker.waitForFunction(() => __entered);
                await page.locator('#studentWriting').fill('Latest text before Clear');
                await page.locator('#clearTextBtn').click();
                await blocker.evaluate(() => {
                    const record = JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice')));
                    record.current.text = 'Competing committed draft'; record.writer = 'synthetic-other-writer'; record.revision = 'synthetic-other-revision';
                    localStorage.setItem(wftWritingDraftKey('Alice'), JSON.stringify(record));
                });
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), '');
                await page.locator('#recoverWritingBtn').click();
                assert.equal(await writing(page), 'Latest text before Clear');
                await blocker.evaluate(() => __release());
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const record = await page.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice'))));
                assert.equal(record.current.text, 'Latest text before Clear');
                assert.equal(record.recovery.text, 'Competing committed draft');
            }],
            ['failed roster transaction retains queued writing after a held lock releases', async (page, context) => {
                const blocker = await context.newPage(); await blocker.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await blocker.evaluate(() => { window.__entered = false; navigator.locks.request(wftWritingDraftKey('Alice'), () => new Promise(resolve => { window.__release = resolve; window.__entered = true; })); });
                await blocker.waitForFunction(() => __entered);
                await page.locator('#studentWriting').fill('Queued Alice writing');
                await page.evaluate(async () => {
                    wftConfirm = async () => true;
                    const set = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) { if (key === 'wft_students' && value === '["Alice"]') throw Error('Synthetic roster failure'); return set.call(this, key, value); };
                    try { await removeStudent('Bob'); } finally { Storage.prototype.setItem = set; }
                });
                assert.deepEqual(await page.evaluate(() => students), ['Alice', 'Bob']);
                assert.equal(await writing(page), 'Queued Alice writing');
                await blocker.evaluate(() => __release());
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice'))).current.text), 'Queued Alice writing');
                assert.doesNotMatch(await page.locator('#writingDraftStatus').textContent(), /competing|not saved/i);
            }],
            ['rename refuses to discard a third distinct competing version', async (page, context) => {
                await page.locator('#studentWriting').fill('First shared version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const other = await context.newPage(); await other.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.locator('#studentWriting').fill('Second shared version');
                await other.locator('#studentWriting').fill('Competing recovery version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await other.evaluate(() => { window.__entered = false; navigator.locks.request(wftWritingDraftKey('Alice'), () => new Promise(resolve => { window.__release = resolve; window.__entered = true; })); });
                await other.waitForFunction(() => __entered);
                await page.locator('#studentWriting').fill('Third live version');
                await page.evaluate(async () => { wftTextInput = async () => 'Alicia'; wftConfirm = async () => true; await renameStudent('Alice'); });
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Alice');
                assert.equal(await writing(page), 'Third live version');
                const record = await page.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Alice'))));
                assert.equal(record.current.text, 'Second shared version');
                assert.equal(record.recovery.text, 'Competing recovery version');
                await other.evaluate(() => __release());
            }],
            ['failed roster transaction preserves roster owner and draft bytes', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const before = await page.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice')));
                await page.evaluate(async () => {
                    wftConfirm = async () => true;
                    const set = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) { if (key === 'wft_students' && value === '["Bob"]') throw Error('Synthetic roster failure'); return set.call(this, key, value); };
                    try { await removeStudent('Alice'); } finally { Storage.prototype.setItem = set; }
                });
                assert.equal(await writing(page), text);
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Alice');
                assert.equal(await page.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice'))), before);
            }],
            ['malformed saved draft bytes survive input and Emergency Backup', async page => {
                await page.evaluate(() => localStorage.setItem(wftWritingDraftKey('Alice'), '{damaged draft'));
                await page.reload({ waitUntil: 'load' });
                await page.locator('#studentWriting').fill('New live text');
                assert.equal(await page.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice'))), '{damaged draft');
                const backup = await page.evaluate(() => buildWftEmergencyBackupObject());
                assert.equal(backup.contents['wft_writing_draft_v1:Alice'], '{damaged draft');
                assert.equal(backup.currentWritingDraft.current.text, 'New live text');
            }],
            ['present falsy JSON draft records are protected as malformed data', async page => {
                const current = { text: 'Protected saved writing', genre: '__auto__', source: null };
                const valid = { version: 1, generation: '', revision: 'synthetic', current, recovery: null };
                for (const storage of ['localStorage', 'sessionStorage']) for (const raw of ['false', '0', 'null', '""', ...[false, 0, ''].map(recovery => JSON.stringify({ ...valid, recovery }))]) {
                    await page.evaluate(({ storage, raw, valid }) => {
                        localStorage.setItem(wftWritingDraftKey('Alice'), JSON.stringify(valid));
                        sessionStorage.removeItem(wftWritingDraftKey('Alice'));
                        window[storage].setItem(wftWritingDraftKey('Alice'), raw);
                    }, { storage, raw, valid });
                    await page.reload({ waitUntil: 'load' });
                    await page.locator('#studentWriting').fill('New live text');
                    await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                    assert.equal(await page.evaluate(storage => window[storage].getItem(wftWritingDraftKey('Alice')), storage), raw);
                    assert.match(await page.locator('#writingDraftStatus').textContent(), /not saved|could not/i);
                }
            }],
            ['unknown draft schema or genre stays protected from normalization', async page => {
                for (const [version, genre] of [[2, '__auto__'], [1, 'future-genre']]) {
                    const raw = JSON.stringify({ version, generation: '', revision: 'synthetic', current: { text: 'Protected future writing', genre, source: null }, recovery: null });
                    await page.evaluate(raw => localStorage.setItem(wftWritingDraftKey('Alice'), raw), raw);
                    await page.reload({ waitUntil: 'load' });
                    await page.locator('#studentWriting').fill('New live writing');
                    await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                    assert.equal(await page.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice'))), raw);
                }
            }],
            ['local write failure preserves the old record and reloads tab journal', async page => {
                await page.locator('#studentWriting').fill('Old local');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const before = await page.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice')));
                await page.evaluate(() => {
                    const set = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) { if (this === localStorage && key.startsWith(WFT_WRITING_DRAFT_PREFIX)) throw Error('Synthetic local failure'); return set.call(this, key, value); };
                });
                await page.locator('#studentWriting').fill('Tab journal text');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                assert.equal(await page.evaluate(() => localStorage.getItem(wftWritingDraftKey('Alice'))), before);
                assert.match(await page.locator('#writingDraftStatus').textContent(), /not saved/);
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), 'Tab journal text');
            }],
            ['inactive owner failed shared save stays visible through switch and reload', async (page, context) => {
                await page.locator('#studentWriting').fill('Alice shared before failure');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const blocker = await context.newPage(); await blocker.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await blocker.evaluate(() => { window.__entered = false; navigator.locks.request(wftWritingDraftKey('Alice'), () => new Promise(resolve => { window.__release = resolve; window.__entered = true; })); });
                await blocker.waitForFunction(() => __entered);
                await page.evaluate(() => {
                    const set = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) { if (this === localStorage && key === wftWritingDraftKey('Alice')) throw Error('Synthetic late Alice shared failure'); return set.call(this, key, value); };
                });
                await page.locator('#studentWriting').fill('Alice only in this tab');
                await page.locator('#studentSelect').selectOption('Bob');
                await blocker.evaluate(() => __release());
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Bob');
                assert.equal(await writing(page), '');
                let status = await page.locator('#writingDraftStatus').textContent();
                assert.match(status, /Alice/, 'The outgoing owner with unpublished writing remains named');
                assert.match(status, /tab.*copy|copy.*tab/i, 'The warning explains how to retain the tab-only writing');
                await page.reload({ waitUntil: 'load' });
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Bob');
                status = await page.locator('#writingDraftStatus').textContent();
                assert.match(status, /Alice/, 'The warning is reconstructed from journals after reload');
                assert.match(status, /tab.*copy|copy.*tab/i);
                await page.locator('#studentSelect').selectOption('Alice');
                assert.equal(await writing(page), 'Alice only in this tab');
                await page.locator('#studentWriting').fill('Alice recovered and published');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.locator('#studentSelect').selectOption('Bob');
                assert.doesNotMatch(await page.locator('#writingDraftStatus').textContent(), /Alice/, 'A settled shared save clears the outgoing warning');
            }],
            ['deleted generation does not keep a stale journal warning', async page => {
                await page.locator('#studentWriting').fill('Alice shared version');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.evaluate(() => {
                    const set = Storage.prototype.setItem;
                    Storage.prototype.setItem = function(key, value) { if (this === localStorage && key === wftWritingDraftKey('Alice')) throw Error('Synthetic Alice shared failure'); return set.call(this, key, value); };
                    window.__restoreDraftStorage = () => { Storage.prototype.setItem = set; };
                });
                await page.locator('#studentWriting').fill('Alice unpublished journal');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                await page.locator('#studentSelect').selectOption('Bob');
                await page.evaluate(async () => { __restoreDraftStorage(); wftConfirm = async () => true; await removeStudent('Alice'); });
                assert.deepEqual(await page.evaluate(() => students), ['Bob']);
                assert.doesNotMatch(await page.locator('#writingDraftStatus').textContent(), /Alice/);
                await page.reload({ waitUntil: 'load' });
                assert.doesNotMatch(await page.locator('#writingDraftStatus').textContent(), /Alice/);
                assert.equal(await writing(page), '');
            }],
            ['OCR cancel keeps writing and Replace can be undone', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => {
                    refreshApiKeyRuntimeValue = () => { API_KEY = 'synthetic-not-a-key'; };
                    selectedImages = [{ imageId: 'synthetic-image', imageRevision: 'r1', extractedText: 'OCR text', dataUrl: 'data:image/png;base64,AA==' }];
                    syncSelectedImageState();
                    window.__ocrPending = extractTextFromSelectedImage(false);
                });
                await page.getByRole('button', { name: 'Cancel', exact: true }).click();
                await page.evaluate(() => __ocrPending);
                assert.equal(await writing(page), text);
                await page.evaluate(() => { window.__ocrPending = extractTextFromSelectedImage(false); });
                await page.getByRole('button', { name: 'Replace Writing', exact: true }).click();
                await page.evaluate(() => __ocrPending);
                assert.equal(await writing(page), 'OCR text');
                await page.locator('#undoWritingBtn').click(); assert.equal(await writing(page), text);
            }],
            ['OCR Append retains existing raw bytes and can be undone', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => {
                    refreshApiKeyRuntimeValue = () => { API_KEY = 'synthetic-not-a-key'; };
                    selectedImages = [{ imageId: 'synthetic-image', imageRevision: 'r1', extractedText: 'Added OCR text', dataUrl: 'data:image/png;base64,AA==' }]; syncSelectedImageState();
                    window.__ocrPending = extractTextFromSelectedImage(false);
                });
                await page.getByRole('button', { name: 'Append Text', exact: true }).click();
                await page.evaluate(() => __ocrPending);
                assert.equal(await writing(page), text + '\n\nAdded OCR text');
                await page.locator('#undoWritingBtn').click(); assert.equal(await writing(page), text);
            }],
            ['stale OCR response cannot replace another student draft', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => {
                    refreshApiKeyRuntimeValue = () => { API_KEY = 'synthetic-not-a-key'; };
                    selectedImages = [{ imageId: 'synthetic-image', imageRevision: 'r1', dataUrl: 'data:image/png;base64,AA==' }]; syncSelectedImageState();
                    callOpenRouterImage = () => new Promise(resolve => { window.__releaseOcr = resolve; });
                    window.__ocrPending = extractTextFromSelectedImage(false).catch(() => 'stale');
                });
                await page.locator('#studentSelect').selectOption('Bob');
                await page.evaluate(() => __releaseOcr('Stale OCR text'));
                await page.evaluate(() => __ocrPending);
                assert.equal(await writing(page), '');
                await page.locator('#studentSelect').selectOption('Alice'); assert.equal(await writing(page), text);
            }],
            ['ordinary and incompatible OAuth drafts both remain recoverable', async page => {
                await page.locator('#studentWriting').fill(text);
                const oauth = JSON.stringify({ text: 'Bob OAuth writing', selectedStudent: 'Bob', manualGenreOverrideValue: '__auto__', writingGenreSelectValue: '__auto__' });
                await page.evaluate(raw => localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, raw), oauth);
                await page.reload({ waitUntil: 'load' });
                assert.equal(await writing(page), text);
                assert.equal(await page.evaluate(() => localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY)), oauth);
                assert.equal(await page.locator('#restoreSignInDraftBtn').isVisible(), true);
                await page.locator('#studentSelect').selectOption('Bob');
                await page.locator('#restoreSignInDraftBtn').click(); assert.equal(await writing(page), 'Bob OAuth writing');
                await page.locator('#studentSelect').selectOption('Alice'); assert.equal(await writing(page), text);
            }],
            ['OAuth cannot overwrite a different target tab journal', async page => {
                await page.locator('#studentSelect').selectOption('Bob');
                await page.locator('#studentWriting').fill('Bob journal draft');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Bob'), () => {}));
                await page.locator('#studentSelect').selectOption('Alice');
                await page.evaluate(() => {
                    localStorage.removeItem(wftWritingDraftKey('Bob'));
                    localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, JSON.stringify({ text: 'Other Bob OAuth draft', selectedStudent: 'Bob', manualGenreOverrideValue: '__auto__', writingGenreSelectValue: '__auto__' }));
                    restoreWftOAuthDraftAfterRedirect();
                });
                assert.equal(await writing(page), '');
                assert.notEqual(await page.evaluate(() => localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY)), null);
                await page.locator('#studentSelect').selectOption('Bob'); assert.equal(await writing(page), 'Bob journal draft');
            }],
            ['reassessment preserves outgoing draft and exact saved-session source', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => {
                    localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 'saved-a', originalText: 'Saved Alice essay', gradeLevel: 5 }] } }));
                    wftConfirm = async () => true;
                });
                await page.evaluate(() => reassessPortfolioSession('Alice', 'saved-a'));
                assert.equal(await writing(page), 'Saved Alice essay');
                await page.reload({ waitUntil: 'load' });
                assert.equal(await writing(page), 'Saved Alice essay');
                assert.deepEqual(await page.evaluate(() => activePortfolioReassessmentSource), { sourceStudentName: 'Alice', sourceSessionId: 'saved-a' });
                await page.evaluate(() => { wftConfirm = async () => true; });
                await page.locator('#recoverWritingBtn').click(); assert.equal(await writing(page), text);
            }],
            ...[false, true].map(savedPhoto => ['reassessment Undo restores prior same-owner writing and photos after ' + (savedPhoto ? 'saved photo' : 'typed-only') + ' restoration', async page => {
                await page.locator('#studentWriting').fill(text);
                const genre = await page.locator('#writingGenreSelect option').nth(1).getAttribute('value');
                await page.locator('#writingGenreSelect').selectOption(genre);
                const prior = await page.evaluate(savedPhoto => {
                    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
                    canvas.getContext('2d').fillRect(0, 0, 8, 8); const png = canvas.toDataURL('image/png');
                    selectedImages = [{ name: 'prior-alice.png', dataUrl: png, originalDataUrl: png, imageId: 'prior-alice-photo', imageRevision: 'prior-revision' }];
                    syncSelectedImageState(); updateSelectedImagePreview();
                    activePortfolioReassessmentSource = { sourceStudentName: 'Alice', sourceSessionId: 'prior-source' };
                    wftSaveWritingDraft(true);
                    localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 'saved-a', originalText: 'Saved Alice essay', gradeLevel: 5,
                        images: savedPhoto ? [{ name: 'saved-alice.png', dataUrl: png, imageId: 'saved-alice-photo', imageRevision: 'saved-revision' }] : [] }] } }));
                    wftConfirm = async () => true;
                    return { photos: getSessionImagePayloads(), primary: selectedImageDataUrl };
                }, savedPhoto);
                await page.evaluate(() => reassessPortfolioSession('Alice', 'saved-a'));
                await page.waitForFunction(() => /Press Analyze Writing/.test(document.getElementById('ocrStatus').textContent));
                assert.equal(await writing(page), 'Saved Alice essay');
                assert.deepEqual(await page.evaluate(() => selectedImages.map(image => image.imageId)), savedPhoto ? ['saved-alice-photo'] : []);
                await page.locator('#undoWritingBtn').click();
                assert.equal(await writing(page), text, 'Completed automatic media restoration must not invalidate Undo');
                assert.equal(await page.locator('#writingGenreSelect').inputValue(), genre);
                assert.deepEqual(await page.evaluate(() => activePortfolioReassessmentSource), { sourceStudentName: 'Alice', sourceSessionId: 'prior-source' });
                assert.deepEqual(await page.evaluate(() => getSessionImagePayloads()), prior.photos, 'Undo restores only the prior same-owner photos');
                assert.equal(await page.evaluate(() => selectedImageDataUrl), prior.primary);
            }]),
            ...['writing', 'photo', 'owner', 'genre'].map(change => ['pending reassessment photo restore preserves newer ' + change, async page => {
                await page.locator('#studentWriting').fill('Alice prior text');
                await page.evaluate(() => {
                    const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
                    window.__savedPng = canvas.toDataURL('image/png');
                    selectedImages = [{ name: 'prior.png', dataUrl: __savedPng, imageId: 'prior-photo', imageRevision: 'prior' }]; syncSelectedImageState();
                    localStorage.setItem('wft_portfolio', JSON.stringify({ Alice: { sessions: [{ id: 'saved-a', originalText: 'Saved Alice essay', gradeLevel: 5,
                        images: [{ name: 'saved.png', dataUrl: __savedPng, imageId: 'saved-photo', imageRevision: 'saved' }] }] } }));
                    getPortfolioImageDataUrlForReassessment = () => new Promise(resolve => { window.__releaseSavedPhoto = resolve; });
                    const restore = restorePortfolioSessionImagesForReassessment;
                    restorePortfolioSessionImagesForReassessment = session => (window.__pendingPhotoRestore = restore(session));
                    wftConfirm = async () => true;
                });
                await page.evaluate(() => reassessPortfolioSession('Alice', 'saved-a'));
                await page.waitForFunction(() => typeof __releaseSavedPhoto === 'function');
                if (change === 'writing') await page.locator('#studentWriting').fill('Newer Alice writing');
                if (change === 'photo') await page.evaluate(() => { selectedImages = [{ name: 'new.png', dataUrl: __savedPng, imageId: 'new-photo', imageRevision: 'new' }]; syncSelectedImageState(); updateSelectedImagePreview(); });
                if (change === 'owner') await page.locator('#studentSelect').selectOption('Bob');
                const newGenre = change === 'genre' ? await page.locator('#writingGenreSelect option').nth(1).getAttribute('value') : null;
                if (change === 'genre') await page.locator('#writingGenreSelect').selectOption(newGenre);
                await page.evaluate(async () => { __releaseSavedPhoto(__savedPng); await __pendingPhotoRestore; });
                if (change !== 'owner') await page.locator('#undoWritingBtn').click();
                assert.equal(await writing(page), change === 'writing' ? 'Newer Alice writing' : change === 'owner' ? '' : 'Saved Alice essay');
                assert.deepEqual(await page.evaluate(() => selectedImages.map(image => image.imageId)), change === 'photo' ? ['new-photo'] : change === 'genre' ? ['saved-photo'] : []);
                assert.equal(await page.locator('#studentSelect').inputValue(), change === 'owner' ? 'Bob' : 'Alice');
                if (change === 'genre') assert.equal(await page.locator('#writingGenreSelect').inputValue(), newGenre);
            }]),
            ['class reset rejects a stale tab and a same-name replacement class', async (page, context) => {
                await page.locator('#studentWriting').fill(text);
                const stale = await context.newPage(); await stale.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await page.evaluate(async () => { wftConfirm = async () => true; await resetCurrentClassData(); document.getElementById('studentNameInput').value = 'Alice'; addStudent(); });
                await stale.locator('#studentWriting').fill('Old class draft');
                await stale.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), '');
            }],
            ['roster refresh keeps unavailable owner explicit without reattribution', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => { students = ['Bob']; localStorage.setItem('wft_students', '["Bob"]'); populateStudentDropdown(); syncUiState(); });
                assert.equal(await writing(page), text);
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Alice');
                await page.locator('#studentWriting').fill('Still Alice');
                assert.match(await page.locator('#writingDraftStatus').textContent(), /not saved|owner/);
                assert.equal(await page.evaluate(() => selectedStudent), 'Alice');
            }],
            ['draft read failure blocks switching without losing live text', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => {
                    const get = Storage.prototype.getItem;
                    Storage.prototype.getItem = function(key) { if (key.startsWith(WFT_WRITING_DRAFT_PREFIX)) throw Error('Synthetic draft read failure'); return get.call(this, key); };
                });
                await page.locator('#studentSelect').selectOption('Bob');
                assert.equal(await writing(page), text);
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Alice');
                assert.match(await page.locator('#writingDraftStatus').textContent(), /not saved/);
            }],
            ['photo changes after Clear block an unsafe Undo source restore', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.locator('#clearTextBtn').click();
                await page.evaluate(() => { selectedImages = [{ imageId: 'new-photo', imageRevision: 'new-revision', dataUrl: 'data:image/png;base64,AA==' }]; syncSelectedImageState(); });
                await page.locator('#undoWritingBtn').click();
                assert.equal(await writing(page), '');
                assert.equal(await page.evaluate(() => selectedImages[0].imageId), 'new-photo');
            }],
            ['automatic cached OCR and edited output survive reload', async page => {
                await page.evaluate(async () => {
                    refreshApiKeyRuntimeValue = () => { API_KEY = 'synthetic-not-a-key'; };
                    selectedImages = [{ imageId: 'synthetic-image', imageRevision: 'r1', extractedText: 'Automatic OCR text', dataUrl: 'data:image/png;base64,AA==' }]; syncSelectedImageState();
                    activeAnalysisContext = { input: captureCurrentWritingContext(), cancelled: false };
                    await extractTextFromSelectedImage(true);
                });
                assert.equal(await writing(page), 'Automatic OCR text');
                await page.locator('#studentWriting').fill('  Edited OCR text\n\n');
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), '  Edited OCR text\n\n');
            }],
            ['archive clearing removes drafts and stale OAuth ownership', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => {
                    localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, JSON.stringify({ text: 'Old class OAuth', selectedStudent: 'Alice' }));
                    clearCurrentClassAfterSuccessfulArchive();
                    document.getElementById('studentNameInput').value = 'Alice'; addStudent();
                });
                await page.reload({ waitUntil: 'load' });
                assert.equal(await writing(page), '');
                assert.equal(await page.evaluate(() => localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY)), null);
            }],
            ['archive clear refuses a writing genre changed during archiving', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const snapshot = await page.evaluate(() => captureWftArchiveClassState());
                const genre = await page.locator('#writingGenreSelect option').nth(1).getAttribute('value');
                await page.locator('#writingGenreSelect').selectOption(genre);
                assert.equal(await page.evaluate(snapshot => clearCurrentClassAfterSuccessfulArchive(snapshot), snapshot), false);
                assert.equal(await writing(page), text);
                assert.deepEqual(await page.evaluate(() => students), ['Alice', 'Bob']);
            }],
            ['archive clear refuses another owner’s late shared draft publication', async (page, context) => {
                await page.locator('#studentWriting').fill('Alice unchanged writing');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const other = await context.newPage(); await other.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await other.locator('#studentSelect').selectOption('Bob');
                await other.locator('#studentWriting').fill('Bob before archive');
                await other.evaluate(() => navigator.locks.request(wftWritingDraftKey('Bob'), () => {}));
                await page.evaluate(() => syncUiState());
                const snapshot = await page.evaluate(() => captureWftArchiveClassState());
                await other.locator('#studentWriting').fill('Bob writing published after archive snapshot');
                await other.evaluate(() => navigator.locks.request(wftWritingDraftKey('Bob'), () => {}));
                await page.evaluate(() => syncUiState());
                assert.equal(await page.evaluate(snapshot => clearCurrentClassAfterSuccessfulArchive(snapshot), snapshot), false);
                assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(wftWritingDraftKey('Bob'))).current.text), 'Bob writing published after archive snapshot');
                assert.deepEqual(await page.evaluate(() => students), ['Alice', 'Bob']);
            }],
            ['class clearing also removes recovered owners outside the roster', async page => {
                await page.evaluate(() => {
                    localStorage.setItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY, JSON.stringify({ text: 'Recovered Eve draft', selectedStudent: 'Eve', manualGenreOverrideValue: '__auto__', writingGenreSelectValue: '__auto__' }));
                    restoreWftOAuthDraftAfterRedirect();
                });
                assert.equal(await writing(page), 'Recovered Eve draft');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Eve'), () => {}));
                await page.evaluate(() => { clearCurrentClassAfterSuccessfulArchive(); document.getElementById('studentNameInput').value = 'Eve'; addStudent(); });
                await page.reload({ waitUntil: 'load' }); assert.equal(await writing(page), '');
            }],
            ['different-student reassessment never exposes outgoing text as target recovery', async page => {
                await page.locator('#studentWriting').fill(text);
                await page.evaluate(async () => {
                    localStorage.setItem('wft_portfolio', JSON.stringify({ Bob: { sessions: [{ id: 'saved-b', originalText: 'Saved Bob essay', gradeLevel: 5 }] } }));
                    wftConfirm = async () => true; await reassessPortfolioSession('Bob', 'saved-b');
                });
                assert.equal(await writing(page), 'Saved Bob essay');
                assert.equal(await page.locator('#recoverWritingBtn').isVisible(), false);
                await page.locator('#studentSelect').selectOption('Alice'); assert.equal(await writing(page), text);
                assert.equal(await page.evaluate(() => activePortfolioReassessmentSource), null);
            }],
            ['simultaneous same-student tabs retain distinct text in local or tab recovery', async (page, context) => {
                await page.locator('#studentWriting').fill('Starting text');
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                const second = await context.newPage(), third = await context.newPage();
                await second.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await third.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                const edits = [[page, 'First concurrent text'], [second, 'Second concurrent text'], [third, 'Third concurrent text']];
                await Promise.all(edits.map(([tab, value]) => tab.evaluate(value => { const input = document.getElementById('studentWriting'); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, value)));
                await page.evaluate(() => navigator.locks.request(wftWritingDraftKey('Alice'), () => {}));
                for (const [tab, value] of edits) {
                    await tab.reload({ waitUntil: 'load' });
                    assert.equal(await writing(tab), value);
                }
            }],
            ['different-student tabs restore their own selected owner after reload', async (page, context) => {
                await page.locator('#studentWriting').fill('Alice tab text');
                const second = await context.newPage(); await second.goto('http://127.0.0.1:8765', { waitUntil: 'load' });
                await second.locator('#studentSelect').selectOption('Bob');
                await second.locator('#studentWriting').fill('Bob tab text');
                await page.reload({ waitUntil: 'load' });
                assert.equal(await page.locator('#studentSelect').inputValue(), 'Alice');
                assert.equal(await writing(page), 'Alice tab text');
                await second.reload({ waitUntil: 'load' });
                assert.equal(await second.locator('#studentSelect').inputValue(), 'Bob');
                assert.equal(await writing(second), 'Bob tab text');
            }]
        ]) {
            if (process.env.WFT_DRAFT_CASES && !new RegExp(process.env.WFT_DRAFT_CASES).test(name)) continue;
            const context = await browser.newContext(), page = await context.newPage(), errors = [];
            context.setDefaultTimeout(10000);
            context.setDefaultNavigationTimeout(30000);
            page.on('pageerror', e => errors.push(e.message));
            await context.route('**/*', route => localAppRoute(route, root));
            try { await seed(page); await run(page, context); assert.deepEqual(errors, []); cases.push({ name, passed: true }); }
            catch (e) { cases.push({ name, passed: false, error: e.message }); }
            finally { await context.close(); }
            console.log((cases.at(-1).passed ? 'PASS ' : 'FAIL ') + name);
        }
    } finally { await browser.close(); }
    const report = { suite: 'draft-preservation', cases };
    if (process.env.WFT_TEST_REPORT) require('node:fs').writeFileSync(process.env.WFT_TEST_REPORT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    assert(cases.length, 'No selected draft cases');
    assert.deepEqual(cases.filter(row => !row.passed), []);
})().catch(error => { console.error(error); process.exitCode = 1; });
