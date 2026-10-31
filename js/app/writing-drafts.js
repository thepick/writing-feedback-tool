// Raw drafts never enter the portfolio or cloud settings payload.
var WFT_WRITING_DRAFT_PREFIX = 'wft_writing_draft_v1:';
var WFT_WRITING_DRAFT_ACTIVE_KEY = 'wft_writing_draft_active_v1';
var wftWritingDraft = null;
var wftDraftJournalWarnings = Object.create(null);
var wftWritingDraftStatusMessage = '';

function wftWritingDraftKey(owner) { return WFT_WRITING_DRAFT_PREFIX + encodeURIComponent(owner || ''); }
function wftDraftSnapshot() {
    return { text: document.getElementById('studentWriting').value,
        genre: document.getElementById('writingGenreSelect').value || '__auto__',
        source: activePortfolioReassessmentSource ? cloneWftJson(activePortfolioReassessmentSource) : null };
}
function wftValidateDraft(value) {
    return value && typeof value.text === 'string' && typeof value.genre === 'string'
        && (value.genre === '__auto__' || !!getGenreChoiceByValue(value.genre))
        && (value.source === null || (value.source && typeof value.source.sourceStudentName === 'string' && typeof value.source.sourceSessionId === 'string'));
}
function wftReadDraft(owner) {
    var raw = localStorage.getItem(wftWritingDraftKey(owner));
    var record = raw === null ? null : JSON.parse(raw);
    if (raw !== null && (!record || typeof record !== 'object' || Array.isArray(record) || record.version !== 1
        || typeof record.generation !== 'string' || typeof record.revision !== 'string' || !wftValidateDraft(record.current)
        || (record.unresolvedConflict !== undefined && typeof record.unresolvedConflict !== 'boolean')
        || (record.recovery !== undefined && record.recovery !== null && !wftValidateDraft(record.recovery)))) throw new Error('Unreadable draft');
    return { raw: raw, record: record };
}
function wftReadDraftJournal(owner) {
    var raw = sessionStorage.getItem(wftWritingDraftKey(owner));
    if (raw === null) return null;
    var journal = JSON.parse(raw);
    if (!journal || typeof journal !== 'object' || Array.isArray(journal) || !wftValidateDraft(journal.current)
        || typeof journal.generation !== 'string'
        || (journal.recovery !== undefined && journal.recovery !== null && !wftValidateDraft(journal.recovery))
        || (journal.writer !== undefined && typeof journal.writer !== 'string')
        || (journal.baseRevision !== undefined && typeof journal.baseRevision !== 'string')) throw new Error('Unreadable tab draft');
    return journal;
}
function getWritingDraftStartupOwner(fallback) {
    try {
        var hint = JSON.parse(sessionStorage.getItem(WFT_WRITING_DRAFT_ACTIVE_KEY) || 'null');
        if (!hint || typeof hint.owner !== 'string' || typeof hint.generation !== 'string') return fallback;
        var stored = wftReadDraft(hint.owner);
        if ((stored.record ? stored.record.generation : '') === hint.generation && !(stored.record && stored.record.deleted)) return hint.owner;
    } catch (e) { }
    return fallback;
}
function refreshWritingDraftJournalWarning(owner) {
    delete wftDraftJournalWarnings[owner];
    try {
        var journal = wftReadDraftJournal(owner);
        if (!journal) return;
        var stored = wftReadDraft(owner).record;
        if (journal.generation !== (stored ? stored.generation : '') || stored && stored.deleted) return;
        var committed = stored ? [stored.current, stored.recovery] : [{ text: '', genre: '__auto__', source: null }];
        if ([journal.current, journal.recovery].some(function(version) {
            return version && !committed.some(function(saved) { return JSON.stringify(version) === JSON.stringify(saved); });
        })) wftDraftJournalWarnings[owner] = true;
    } catch (e) { wftDraftJournalWarnings[owner] = true; }
}
function wftDraftStatus(message) {
    wftWritingDraftStatusMessage = message;
    var warningOwners = Object.keys(wftDraftJournalWarnings).sort().map(function(owner) { return owner || 'Unassigned writing'; });
    var status = document.getElementById('writingDraftStatus');
    if (status) status.textContent = (wftWritingDraft && !wftWritingDraft.owner ? 'Unassigned writing. ' : '')
        + (wftWritingDraft && wftWritingDraft.ownerHintFailed ? 'Tab selection could not be remembered. ' : '') + message
        + (warningOwners.length ? ' Draft recovery needs attention for: ' + warningOwners.join(', ') + '. Keep this tab open. Select each named student to review or copy writing before closing.' : '');
    var undo = document.getElementById('undoWritingBtn');
    if (undo) undo.hidden = !(wftWritingDraft && wftWritingDraft.undo);
    var recover = document.getElementById('recoverWritingBtn');
    if (recover) recover.hidden = !(wftWritingDraft && wftWritingDraft.recovery);
    var oauth = document.getElementById('restoreSignInDraftBtn');
    try { if (oauth) oauth.hidden = !localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY); } catch (e) { }
}
function wftApplyDraft(snapshot, clearPhotos) {
    document.getElementById('studentWriting').value = snapshot.text;
    manualGenreOverrideValue = snapshot.genre;
    document.getElementById('writingGenreSelect').value = snapshot.genre;
    activePortfolioReassessmentSource = snapshot.source ? cloneWftJson(snapshot.source) : null;
    if (clearPhotos) {
        if (typeof closeCropModal === 'function') closeCropModal();
        selectedImages = []; syncSelectedImageState(); updateSelectedImagePreview();
    }
    syncUiState(); updateGenreReviewBox(); checkExpandBtnVisibility();
}
function wftLoadWritingDraft(owner, clearPhotos) {
    var empty = { text: '', genre: '__auto__', source: null };
    var state = { owner: owner || '', undo: null, recovery: null, blocked: false, serial: 0, writer: createWftId('draft-tab') };
    wftWritingDraft = state;
    try {
        var stored = wftReadDraft(state.owner);
        state.raw = stored.raw;
        state.generation = stored.record ? stored.record.generation : '';
        state.allowMissingOwner = !!(stored.record && stored.record.recoveredOwner);
        state.deleted = !!(stored.record && stored.record.deleted);
        state.conflicted = !!(stored.record && stored.record.unresolvedConflict);
        var snapshot = stored.record && !stored.record.deleted ? stored.record.current : empty;
        state.recovery = stored.record && !stored.record.deleted ? stored.record.recovery : null;
        // A synchronous tab journal also survives a reload before the shared write lock runs.
        var journal = wftReadDraftJournal(state.owner);
        if (journal) {
            if (journal.generation === state.generation && !state.deleted) {
                var sameCurrent = JSON.stringify(journal.current) === JSON.stringify(snapshot);
                if (stored.record && journal.baseRevision !== stored.record.revision && journal.writer !== stored.record.writer
                    && (!sameCurrent || JSON.stringify(journal.recovery || null) !== JSON.stringify(stored.record.recovery || null))) state.conflicted = true;
                state.recovery = journal.recovery || state.recovery;
                if (!stored.record || JSON.stringify(journal.current) !== JSON.stringify(snapshot)) {
                    state.recovery = journal.recovery || (snapshot.text !== '' ? snapshot : state.recovery);
                    snapshot = journal.current;
                }
            }
        }
        wftApplyDraft(snapshot, clearPhotos);
        state.last = JSON.stringify(snapshot);
        try { sessionStorage.setItem(WFT_WRITING_DRAFT_ACTIVE_KEY, JSON.stringify({ owner: state.owner, generation: state.generation })); }
        catch (e) { state.ownerHintFailed = true; }
        refreshWritingDraftJournalWarning(state.owner);
        wftDraftStatus(state.conflicted ? 'Competing draft versions are kept. Review the previous draft before replacing the shared copy; new edits stay in this tab.'
            : !navigator.locks ? 'Text draft saved for this browser tab only. Keep or copy this tab; photos need reattaching after reload or student changes.'
            : state.recovery ? 'Draft restored in this browser. Another version is available. Photos need reattaching after reload or student changes.'
            : 'Text draft saved in this browser. Photos need reattaching after reload or student changes.');
    } catch (e) {
        state.blocked = true;
        wftApplyDraft(empty, clearPhotos);
        state.last = JSON.stringify(empty);
        wftDraftStatus('Saved draft could not be read. Its bytes were kept. Copy new writing before leaving this tab.');
    }
}
function wftSaveWritingDraft(force, ownerTransition, resolveConflict) {
    var state = wftWritingDraft;
    if (!state) return false;
    if (!ownerTransition && state.owner !== (selectedStudent || '')) {
        wftDraftStatus('Draft not saved. Writing ownership changed; current text was kept.');
        return false;
    }
    var snapshot = wftDraftSnapshot(), serialized = JSON.stringify(snapshot);
    if (!force && serialized === state.last) return !state.blocked;
    if (state.blocked) { wftDraftStatus('Draft not saved. Kept recovery bytes are protected; copy your current writing before leaving.'); return false; }
    var serial = ++state.serial;
    try {
        if (typeof wftStudentChangeRecovery !== 'undefined' && wftStudentChangeRecovery) throw getWftStudentChangeRecoveryError();
        var current = wftReadDraft(state.owner);
        if ((current.record ? current.record.generation : '') !== state.generation) throw new Error('Draft owner changed');
        if (current.record && current.record.unresolvedConflict && !resolveConflict) state.conflicted = true;
        var rosterRaw = localStorage.getItem('wft_students');
        if (state.owner && rosterRaw !== null && JSON.parse(rosterRaw).indexOf(state.owner) === -1
            && !state.allowMissingOwner && !(current.record && current.record.recoveredOwner)) throw new Error('Draft owner removed');
        var baseline = state.raw ? JSON.parse(state.raw) : null;
        sessionStorage.setItem(wftWritingDraftKey(state.owner), JSON.stringify({ generation: state.generation, writer: state.writer,
            baseRevision: baseline ? baseline.revision : '', current: snapshot, recovery: state.recovery }));
    } catch (e) {
        wftDraftStatus('Draft not saved. Keep this tab open or copy the writing; its owner or browser storage changed.');
        return false;
    }
    state.last = serialized;
    refreshWritingDraftJournalWarning(state.owner);
    wftDraftStatus('Saving text draft in this browser… Photos are only kept for the current student in this tab.');
    if (!navigator.locks) {
        wftDraftStatus('Text draft saved for this browser tab only. Shared draft saving is unavailable; keep or copy this tab.');
        return true;
    }
    var expected = state.raw, generation = state.generation;
    navigator.locks.request(wftWritingDraftKey(state.owner), function() {
        var stored = wftReadDraft(state.owner), record = stored.record;
        if ((record ? record.generation : '') !== generation) throw new Error('Draft owner changed');
        if (record && record.unresolvedConflict && !resolveConflict) state.conflicted = true;
        if (state.conflicted && !resolveConflict) throw new Error('Competing draft needs review');
        if (resolveConflict) state.conflicted = false;
        var recovery = state.recovery || record && record.recovery || null;
        if (stored.raw !== expected && record && record.writer !== state.writer && JSON.stringify(record.current) !== serialized) {
            // One competing version is retained; additional conflicts stay in each tab's journal.
            if (recovery && JSON.stringify(recovery) !== serialized) throw new Error('Multiple competing drafts');
            recovery = snapshot;
            state.conflicted = true;
            record.unresolvedConflict = true;
            record.writer = state.writer;
            record.revision = createWftId('draft');
        } else {
            record = { version: 1, generation: generation, revision: createWftId('draft'), writer: state.writer, recoveredOwner: !!state.allowMissingOwner, current: snapshot, recovery: recovery };
        }
        record.recovery = recovery;
        var nextRaw = JSON.stringify(record);
        localStorage.setItem(wftWritingDraftKey(state.owner), nextRaw);
        state.raw = nextRaw;
        state.recovery = state.conflicted ? record.current : recovery;
        refreshWritingDraftJournalWarning(state.owner);
        if (wftWritingDraft === state && serial === state.serial) wftDraftStatus(state.conflicted
            ? 'Competing draft versions kept in this browser. Use Recover previous draft to review.'
            : recovery ? 'Text draft saved in this browser. A previous draft is available. Photos need reattaching after reload or student changes.'
            : 'Text draft saved in this browser. Photos need reattaching after reload or student changes.');
        else wftDraftStatus(wftWritingDraftStatusMessage);
    }).catch(function() {
        refreshWritingDraftJournalWarning(state.owner);
        if (wftWritingDraft === state && serial === state.serial) wftDraftStatus('Shared draft not saved. Text is in this tab’s recovery journal; keep this tab open or copy it.');
        else wftDraftStatus(wftWritingDraftStatusMessage);
    });
    return true;
}
function wftSwitchWritingOwner(owner) {
    if (!wftWritingDraft || wftWritingDraft.owner === (owner || '')) return true;
    try {
        var source = wftReadDraft(wftWritingDraft.owner);
        if ((source.record ? source.record.generation : '') !== wftWritingDraft.generation) throw new Error('Owner changed');
        wftReadDraft(owner);
    } catch (e) { wftDraftStatus('Draft not saved. Browser drafts could not be checked; current writing was kept.'); return false; }
    if (!wftSaveWritingDraft(false, true)) return false;
    selectedStudent = owner || '';
    var select = document.getElementById('studentSelect');
    if (select) select.value = selectedStudent;
    wftLoadWritingDraft(owner, true);
    return true;
}
function wftRememberWritingReplacement() {
    if (!wftWritingDraft || !wftSaveWritingDraft(true)) return false;
    wftWritingDraft.undo = { before: wftDraftSnapshot(), photos: selectedImages.slice(), after: null };
    if (wftWritingDraft.undo.before.text !== '') wftWritingDraft.recovery = wftWritingDraft.undo.before;
    return true;
}
function wftFinishWritingReplacement() {
    if (!wftWritingDraft) return;
    if (wftWritingDraft.undo) wftWritingDraft.undo.after = JSON.stringify([wftDraftSnapshot(), captureCurrentWritingContext()]);
    wftSaveWritingDraft(true);
}
function undoWritingReplacement() {
    var state = wftWritingDraft, undo = state && state.undo;
    if (!undo) return;
    try {
        var stored = wftReadDraft(state.owner);
        if ((stored.record ? stored.record.generation : '') !== state.generation) throw new Error('Owner changed');
    } catch (e) { state.undo = null; wftDraftStatus('The draft owner changed. Your current writing was kept.'); return; }
    if (undo.after !== JSON.stringify([wftDraftSnapshot(), captureCurrentWritingContext()])) {
        wftDraftStatus('New writing was kept. Copy it before recovering the previous draft.');
        state.recovery = undo.before; wftSaveWritingDraft(true); wftDraftStatus('New writing was kept. Recover previous draft is available.');
        return;
    }
    wftApplyDraft(undo.before, false);
    if (undo.photos) { selectedImages = undo.photos.slice(); syncSelectedImageState(); updateSelectedImagePreview(); }
    state.undo = null; wftSaveWritingDraft(true);
}
async function recoverPreviousWritingDraft() {
    var state = wftWritingDraft;
    if (!state || !state.recovery) return;
    var before = JSON.stringify([wftDraftSnapshot(), captureCurrentWritingContext()]), recovery = state.recovery;
    if ((document.getElementById('studentWriting').value !== '' || selectedImages.length) && !(await wftConfirm('Recover the previous draft? Your current text will become the recoverable previous version. Selected photos will be cleared; reattach the matching photos afterward.', { title: 'Recover Draft', confirmText: 'Recover Draft' }))) return;
    if (state !== wftWritingDraft || before !== JSON.stringify([wftDraftSnapshot(), captureCurrentWritingContext()])) return;
    var current = wftDraftSnapshot();
    var photos = selectedImages.slice();
    try {
        var stored = wftReadDraft(state.owner);
        if ((stored.record ? stored.record.generation : '') !== state.generation) throw new Error('Owner changed');
        if (stored.raw !== state.raw) throw new Error('Another tab changed the draft');
        var previous = current;
        if (state.conflicted && stored.record) {
            var versions = [recovery];
            [current, stored.record.current, stored.record.recovery].forEach(function(version) {
                if (version && (version.text !== '' || version.genre !== '__auto__' || version.source)
                    && !versions.some(function(existing) { return JSON.stringify(existing) === JSON.stringify(version); })) versions.push(version);
            });
            if (versions.length > 2) throw new Error('Copy competing drafts before recovery');
            previous = versions[1] || current;
        }
        if (!wftSaveWritingDraft(true)) return;
        state.recovery = previous; state.conflicted = false;
        wftApplyDraft(recovery, true);
        if (!wftSaveWritingDraft(true, false, true)) {
            wftApplyDraft(current, false); selectedImages = photos; syncSelectedImageState(); updateSelectedImagePreview();
            state.recovery = recovery;
            wftDraftStatus('Draft recovery could not be saved. Current writing and photos were kept.');
            return;
        }
        state.undo = null;
    } catch (e) { wftDraftStatus('Draft recovery could not be saved. Current writing and stored bytes were kept.'); }
}
async function chooseExtractedWritingText(context, text) {
    if (!text) return false;
    var current = document.getElementById('studentWriting').value;
    if (current !== '') {
        var replace = await wftConfirm('Replace the current writing, or append the extracted text after a blank line? Cancel keeps your writing and photos.', { title: 'Use Extracted Text', confirmText: 'Replace Writing', alternativeText: 'Append Text' });
        assertCurrentAnalysisContext(context);
        if (!replace) return false;
        if (replace === 'alternative') text = current + '\n\n' + text;
    }
    if (!wftRememberWritingReplacement()) return false;
    document.getElementById('studentWriting').value = text;
    context.input.writingText = text;
    wftFinishWritingReplacement();
    return true;
}
function initializeWritingDrafts() {
    // Rebuild once from existing journals; subsequent saves refresh only their own owner.
    try {
        for (var i = 0; i < sessionStorage.length; i++) {
            var key = sessionStorage.key(i);
            if (key.indexOf(WFT_WRITING_DRAFT_PREFIX) === 0) refreshWritingDraftJournalWarning(decodeURIComponent(key.slice(WFT_WRITING_DRAFT_PREFIX.length)));
        }
    } catch (e) { }
    wftLoadWritingDraft(selectedStudent, false);
    document.getElementById('studentWriting').addEventListener('input', function() { wftSaveWritingDraft(); });
    document.getElementById('writingGenreSelect').addEventListener('change', function() { wftSaveWritingDraft(); });
    window.addEventListener('pagehide', function() { wftSaveWritingDraft(); });
    document.addEventListener('visibilitychange', function() { if (document.hidden) wftSaveWritingDraft(); });
    window.addEventListener('storage', function(event) {
        if (!event.key || event.key.indexOf(WFT_WRITING_DRAFT_PREFIX) !== 0) return;
        refreshWritingDraftJournalWarning(decodeURIComponent(event.key.slice(WFT_WRITING_DRAFT_PREFIX.length)));
        if (wftWritingDraft && event.key === wftWritingDraftKey(wftWritingDraft.owner)) {
            wftDraftStatus('This browser has another draft update. Your current writing was kept; new edits will preserve a competing version.');
        } else wftDraftStatus(wftWritingDraftStatusMessage);
    });
}

// These writes participate in the existing roster transaction and rollback.
function prepareWritingDraftStudentChange(change) {
    if (!Array.isArray(change.students) || !wftWritingDraft) return {};
    if (!wftSaveWritingDraft()) throw new Error('Current draft could not be preserved');
    var writes = {}, removed = students.filter(function(name) { return change.students.indexOf(name) === -1; });
    if (!change.students.length) {
        removed.push('');
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key.indexOf(WFT_WRITING_DRAFT_PREFIX) !== 0) continue;
            var owner = decodeURIComponent(key.slice(WFT_WRITING_DRAFT_PREFIX.length));
            if (removed.indexOf(owner) === -1) removed.push(owner);
        }
        if (removed.indexOf(wftWritingDraft.owner) === -1) removed.push(wftWritingDraft.owner);
    }
    if (change.draftRename) {
        var oldName = change.draftRename[0], newName = change.draftRename[1];
        var original = wftReadDraft(oldName).record;
        var oldJournal = wftReadDraftJournal(oldName);
        var storedCurrent = original ? original.current : { text: '', genre: '__auto__', source: null };
        if (oldName !== wftWritingDraft.owner && oldJournal && oldJournal.generation === (original ? original.generation : '')
            && (JSON.stringify(oldJournal.current) !== JSON.stringify(storedCurrent)
                || JSON.stringify(oldJournal.recovery || null) !== JSON.stringify(original && original.recovery || null))) {
            wftDraftStatus('This student has a draft waiting to save. Return to that student, wait for the browser save, and retry the rename. All writing was kept.');
            throw new Error('Student draft publication is pending');
        }
        var source = oldName === wftWritingDraft.owner ? wftDraftSnapshot() : original && original.current;
        var candidates = [source, original && original.current, original && original.recovery];
        if (oldName === wftWritingDraft.owner) candidates.push(wftWritingDraft.recovery);
        var versions = [];
        candidates.forEach(function(candidate) { if (candidate && !versions.some(function(version) { return JSON.stringify(version) === JSON.stringify(candidate); })) versions.push(cloneWftJson(candidate)); });
        if (versions.length > 2) {
            wftDraftStatus('Competing drafts must be reviewed or copied before renaming this student. All versions were kept.');
            throw new Error('Competing drafts need review');
        }
        versions.forEach(function(version) { if (version.source && version.source.sourceStudentName === oldName) version.source.sourceStudentName = newName; });
        if (oldName === wftWritingDraft.owner && wftWritingDraft.undo) {
            change.draftUndo = cloneWftJson(wftWritingDraft.undo);
            change.draftUndo.photos = wftWritingDraft.undo.photos ? wftWritingDraft.undo.photos.slice() : null;
            change.draftUndo.valid = wftWritingDraft.undo.after === JSON.stringify([wftDraftSnapshot(), captureCurrentWritingContext()]);
            if (change.draftUndo.before.source && change.draftUndo.before.source.sourceStudentName === oldName) change.draftUndo.before.source.sourceStudentName = newName;
        }
        var target = wftReadDraft(newName);
        var targetJournal = wftReadDraftJournal(newName);
        if (targetJournal && targetJournal.generation === (target.record ? target.record.generation : '')
            && (targetJournal.current.text !== '' || targetJournal.current.genre !== '__auto__' || targetJournal.current.source || targetJournal.recovery)) throw new Error('Target tab draft already exists');
        if (target.record && !target.record.deleted && (target.record.current.text !== '' || target.record.recovery)) throw new Error('Target draft already exists');
        writes[wftWritingDraftKey(newName)] = JSON.stringify({ version: 1, generation: createWftId('draft-owner'), revision: createWftId('draft'), unresolvedConflict: !!(original && original.unresolvedConflict || oldName === wftWritingDraft.owner && wftWritingDraft.conflicted), current: versions[0] || { text: '', genre: '__auto__', source: null }, recovery: versions[1] || null });
    }
    removed.forEach(function(owner) {
        var stored = wftReadDraft(owner);
        writes[wftWritingDraftKey(owner)] = JSON.stringify({ version: 1, generation: createWftId('draft-owner'), revision: createWftId('draft'), deleted: true, current: { text: '', genre: '__auto__', source: null }, recovery: null });
        var raw = localStorage.getItem(WFT_OAUTH_TEXTAREA_DRAFT_KEY);
        if (raw && (JSON.parse(raw).selectedStudent || '') === owner) writes[WFT_OAUTH_TEXTAREA_DRAFT_KEY] = null;
    });
    // Preserve direct programmatic writing changes in the same transaction before switching owner.
    if (removed.indexOf(wftWritingDraft.owner) === -1 && !change.draftRename) {
        var stored = wftReadDraft(wftWritingDraft.owner);
        // Unresolved shared versions must survive roster edits; this tab's newer writing is already journaled.
        if (stored.raw === wftWritingDraft.raw && !wftWritingDraft.conflicted && !(stored.record && stored.record.unresolvedConflict)) writes[wftWritingDraftKey(wftWritingDraft.owner)] = JSON.stringify({ version: 1, generation: wftWritingDraft.generation, revision: createWftId('draft'), writer: wftWritingDraft.writer, recoveredOwner: !!wftWritingDraft.allowMissingOwner, unresolvedConflict: !!wftWritingDraft.conflicted, current: wftDraftSnapshot(), recovery: wftWritingDraft.recovery });
    }
    return writes;
}
function finishWritingDraftStudentChange(change, writes) {
    if (!wftWritingDraft) return;
    Object.keys(writes || {}).forEach(function(key) {
        if (key.indexOf(WFT_WRITING_DRAFT_PREFIX) === 0) refreshWritingDraftJournalWarning(decodeURIComponent(key.slice(WFT_WRITING_DRAFT_PREFIX.length)));
    });
    var nextOwner = change.selectedStudent || '';
    var select = document.getElementById('studentSelect');
    // Add/rename targets do not exist in the old dropdown yet.
    var previousState = wftWritingDraft;
    wftWritingDraft = null;
    if (select) select.innerHTML = '';
    selectedStudent = nextOwner;
    try { populateStudentDropdown(); }
    finally { wftWritingDraft = previousState; }
    var renamedCurrentOwner = change.draftRename && change.draftRename[0] === previousState.owner;
    if (wftWritingDraft.owner !== nextOwner || !change.students.length || renamedCurrentOwner) {
        wftLoadWritingDraft(nextOwner, !renamedCurrentOwner);
        if (renamedCurrentOwner && change.draftUndo) {
            wftWritingDraft.undo = { before: change.draftUndo.before, photos: change.draftUndo.photos, after: change.draftUndo.valid ? JSON.stringify([wftDraftSnapshot(), captureCurrentWritingContext()]) : null };
            wftDraftStatus('Student renamed. Text draft saved in this browser; the previous draft is available. Photos need reattaching after reload or student changes.');
        }
    } else if (writes && Object.prototype.hasOwnProperty.call(writes, wftWritingDraftKey(nextOwner))) {
        wftWritingDraft.raw = writes[wftWritingDraftKey(nextOwner)];
    }
    wftDraftStatus(wftWritingDraftStatusMessage);
}
