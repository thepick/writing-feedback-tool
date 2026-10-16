/* =============================================================================
   Feedback wording and polish - convention detection, grammar/flow phrasing,
   notice tables, and diff-driven grammar analysis. Extracted from 10-main-app.js
   (decompose-20261016). Classic script; global names unchanged, loaded before
   10-main-app.js.
   ============================================================================= */

function softenOverclaim(text, score) {
    var str = String(text || "");
    if (!str || getNumericAssessmentScore(score) == null || Number(score) >= 10) return str;
    str = str.replace(/\bperfectly\b/gi, "clearly");
    str = str.replace(/\bperfect\b/gi, "very clear");
    str = str.replace(/\bflawless\b/gi, "strong");
    return str;
}


function toOneSentence(input) {
    var s = String(input || "").trim();
    if (!s) return s;
    // Keep the first sentence-ish chunk. This prevents multi-sentence rambles in the quick rubric.
    var m = s.match(/^([\s\S]*?[.!?])(\s+|$)/);
    if (m && m[1]) return m[1].trim();
    return s;
}

function teacherizeWording(input, category, score) {
    var s = String(input || "").trim();
    if (!s) return s;

    // Normalize common robotic patterns.
    s = s.replace(/\b[Tt]his writing\b/g, "Your writing");
    s = s.replace(/\b[Tt]he writing\b/g, "Your writing");
    s = s.replace(/\b[Tt]he piece\b/g, "your writing");
    s = s.replace(/\b[Tt]his piece\b/g, "your writing");
    s = s.replace(/\b[Tt]he reader\b/g, "your reader");

    s = s.replace(/\b[Tt]here is room to\b/g, "Next, you can");
    s = s.replace(/\b[Tt]here\s+is\s+room\s+to\b/g, "Next, you can");
    s = s.replace(/\b[Cc]ould\s+help\b/g, "will help");
    s = s.replace(/\b[Ww]ould\s+help\b/g, "will help");
    s = s.replace(/\b[Mm]ight\b/g, "can");

    s = s.replace(/\b[Ii]s developing\b/g, "is getting stronger");
    s = s.replace(/\b[Aa]re developing\b/g, "are getting stronger");

    // Remove extra filler.
    s = s.replace(/\b(even\s+more|overall|in\s+general)\b/gi, function(m) { return m.toLowerCase() === 'overall' ? '' : ''; });
    s = s.replace(/\s{2,}/g, " ").trim();

    // Category-specific nudges (keep it to one sentence for quick rubric).
    if (category === "Word Choice") {
        s = s.replace(/\bvocabulary\b/gi, "word choices");
        if (/works for the topic/i.test(s)) s = s.replace(/works for the topic/i, "fit your topic");
    }
    if (category === "Organization") {
        s = s.replace(/\bchronological\b/gi, "time order");
        s = s.replace(/\bsequence\b/gi, "order");
    }

    // If the sentence is very generic, gently make it more teacher-like.
    if (getNumericAssessmentScore(score) != null && category && (s.length < 28 || /^good\b/i.test(s) || /^nice\b/i.test(s))) {
        if (category === "Flow") s = "Your writing reads smoothly; next, add 1-2 transition words to connect ideas.";
        else if (category === "Organization") s = "Your ideas stay in a clear order; next, add a transition word like First, Next, or Finally.";
        else if (category === "Word Choice") s = "Your word choices fit your topic; next, swap 2 simple words for more specific ones.";
        else if (category === "Grammar") s = "Your sentences are mostly clear; next, proofread for complete sentences and verb tense.";
        else if (category === "Ideas & Details") s = "Your main idea is clear; next, add 2-3 specific details to help the reader picture it.";
        else if (category === "Spelling & Punctuation") s = "Your writing is easy to read; next, proofread for capitals and end punctuation.";
    }

    s = softenOverclaim(s, score);
    return s;
}

function detectConventionIssues(text) {
    var issues = [];
    var source = String(text || "");
    var trimmed = source.trim();
    if (!trimmed) return issues;

    var lowerI = source.match(/(^|[^A-Za-z])i(?=[^A-Za-z]|$)/);
    if (lowerI) {
        issues.push({ type: "lowercase-i", message: 'change "i" to "I" when referring to yourself' });
    }

    if (/[A-Za-z0-9"')\]]$/.test(trimmed)) {
        issues.push({ type: "end-punctuation", message: "add ending punctuation to the last sentence" });
    }

    var sentenceStartMatch = source.match(/[.!?]\s+([a-z][a-zA-Z]{3,})/);
    if (sentenceStartMatch) {
        var _precedingIdx = source.indexOf(sentenceStartMatch[0]);
        var _precedingChar = _precedingIdx > 0 ? source.charAt(_precedingIdx - 1) : "";
        var _isInsideQuote = (_precedingChar === '"' || _precedingChar === "'" || _precedingChar === '\u201d');
        if (!_isInsideQuote) {
            issues.push({ type: "sentence-capital", message: 'capitalize the sentence that starts with "' + sentenceStartMatch[1] + '"' });
        }
    }

    var spaceBefore = source.match(/\s+[,.!?]/);
    if (spaceBefore) {
        issues.push({ type: "space-before-punctuation", message: "remove spaces before punctuation marks" });
    }

    return issues;
}

function buildConventionReason(score, issues) {
    var scoreNum = getNumericAssessmentScore(score);
    if (scoreNum == null && (!issues || !issues.length)) return getEvidenceNote("Spelling & Punctuation");
    if (scoreNum == null) return "One convention detail to check is to " + issues[0].message + ".";
    if (!issues || !issues.length) {
        if (scoreNum >= 9) return "Spelling, capitals, and punctuation are strong overall, and a final proofread would help catch any small mistakes.";
        if (scoreNum >= 7) return "Most spelling and punctuation choices work, and a quick proofread would help clean up small mistakes.";
        return "Some spelling, capitalization, or punctuation details still need attention, and a careful proofread would help.";
    }
    var first = issues[0].message;
    if (scoreNum >= 9) return "Spelling and punctuation are strong overall, and it would help to " + first + ".";
    if (scoreNum >= 7) return "Most conventions are working, but it would help to " + first + ".";
    return "A few conventions need attention. Start by trying to " + first + ".";
}

function buildConventionEvidence(score, issues) {
    var scoreNum = getNumericAssessmentScore(score);
    if (scoreNum == null && (!issues || !issues.length)) return getEvidenceNote("Spelling & Punctuation");
    if (!issues || !issues.length) {
        if (scoreNum >= 9) return "Most words are easy to read, and capitals and punctuation are mostly used correctly throughout the piece.";
        return "There are some correct capitals and punctuation marks, but a few places still need a closer proofread.";
    }
    return "One convention detail to fix is to " + issues[0].message + ".";
}

function buildConventionGrowthTip(issues) {
    if (issues && issues.length) {
        return "Read the piece one sentence at a time and check that each sentence begins and ends correctly.";
    }
    return "Read the piece aloud slowly and pause at the end of each sentence to check capitals, punctuation, and spelling.";
}


function getDiffOperations(originalText, correctedText) {
    var a = tokenizeForDiff(stripCorrectionMarkdown(originalText || ""));
    var b = tokenizeForDiff(stripCorrectionMarkdown(correctedText || ""));
    var dp = buildLcsMatrix(a, b);
    var i = 0;
    var j = 0;
    var ops = [];
    while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && normalizeDiffToken(a[i]) === normalizeDiffToken(b[j])) {
            i++;
            j++;
            continue;
        }
        var removed = [];
        var added = [];
        while (i < a.length && j < b.length && normalizeDiffToken(a[i]) !== normalizeDiffToken(b[j])) {
            if (dp[i + 1][j] >= dp[i][j + 1]) {
                removed.push(a[i]);
                i++;
            } else {
                added.push(b[j]);
                j++;
            }
        }
        while (i < a.length && j >= b.length) {
            removed.push(a[i]);
            i++;
        }
        while (j < b.length && i >= a.length) {
            added.push(b[j]);
            j++;
        }
        if (removed.length || added.length) ops.push({ removed: removed, added: added });
    }
    return ops;
}

function analyzeGrammarChanges(originalText, correctedText) {
    var ops = getDiffOperations(originalText, correctedText);
    var summary = {
        totalEdits: 0,
        verbIssues: 0,
        helperVerbIssues: 0,
        articleIssues: 0,
        punctuationIssues: 0,
        capitalizationIssues: 0,
        contractionIssues: 0
    };
    var verbSet = {
        am:1,is:1,are:1,was:1,were:1,be:1,been:1,being:1,
        do:1,does:1,did:1,done:1,has:1,have:1,had:1,
        go:1,goes:1,went:1,forget:1,forgot:1,forgive:1,forgave:1,
        watch:1,watched:1,write:1,writes:1,wrote:1,writing:1,
        call:1,called:1,feel:1,felt:1,stay:1,stayed:1
    };
    for (var k = 0; k < ops.length; k++) {
        var op = ops[k];
        summary.totalEdits += 1;
        var removedWords = op.removed.join(" ").toLowerCase();
        var addedWords = op.added.join(" ").toLowerCase();
        if (/\b(a|an|the)\b/.test(removedWords + " " + addedWords)) summary.articleIssues += 1;
        if (/[.,!?;:"]/.test(op.removed.join("")) || /[.,!?;:"]/.test(op.added.join(""))) summary.punctuationIssues += 1;
        if (/[A-Z]/.test(op.removed.join("")) || /[A-Z]/.test(op.added.join(""))) summary.capitalizationIssues += 1;
        if (/'/.test(op.removed.join("")) || /'/.test(op.added.join(""))) summary.contractionIssues += 1;
        var rw = tokenizeForDiff(removedWords);
        var aw = tokenizeForDiff(addedWords);
        var combined = rw.concat(aw);
        for (var i = 0; i < combined.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(verbSet, combined[i])) continue;
            summary.verbIssues += 1;
            if (/^(had|have|has|would|will|did|does|do|am|is|are|was|were)$/.test(combined[i])) summary.helperVerbIssues += 1;
            break;
        }
    }
    return summary;
}

function buildGrammarReasonFromData(score, originalText, correctedText) {
    var n = getNumericAssessmentScore(score);
    if (n == null || n > 8) return "";
    var summary = analyzeGrammarChanges(originalText, correctedText);
    if (n <= 6) {
        if (summary.verbIssues > 0 && summary.helperVerbIssues > 0) {
            return "Your ideas are clear, though many sentences need verb form fixes. Try reading each sentence aloud and check that every verb matches its subject.";
        }
        if (summary.verbIssues > 0) {
            return "Your message makes sense, but verb tense shifts throughout. Pick one tense (past or present) and use it consistently all the way through.";
        }
        if (summary.totalEdits >= 4) {
            return "Your writing is easy to follow, but several grammar issues need attention. Do a line-by-line proofread focusing on subject-verb agreement and complete sentences.";
        }
        return "Your ideas come through clearly. A few grammar fixes are still needed - check that each sentence has a clear subject and the right verb form.";
    }
    if (n <= 8) {
        if (summary.verbIssues > 0) {
            return "Your grammar is mostly clear, and your ideas come through well. Before you finish, reread each sentence and make sure every verb stays in the right tense.";
        }
        if (summary.totalEdits >= 3) {
            return "Your grammar is mostly strong. Do one more careful reread and look for any missing words, small verb changes, or sentences that sound incomplete.";
        }
    }
    return "";
}

function buildGrammarEvidenceFromData(score, originalText, correctedText) {
    var n = getNumericAssessmentScore(score);
    if (n == null || n > 8) return "";
    var summary = analyzeGrammarChanges(originalText, correctedText);
    if (n <= 6) {
        if (summary.verbIssues > 0 && summary.helperVerbIssues > 0) {
            return "Several grammar edits were needed, especially with verb forms and helping words in some sentences.";
        }
        if (summary.verbIssues > 0) {
            return "Several grammar edits were needed, especially to keep verb tense steady across the story.";
        }
        return "Several sentences needed grammar corrections before the meaning was fully clear.";
    }
    if (n <= 8 && summary.totalEdits >= 3) {
        return "Only a few grammar edits were needed, mostly small fixes that will make your sentences sound smoother and more correct.";
    }
    return "";
}

function buildFlowReasonFromData(score, flowData) {
    var n = getNumericAssessmentScore(score);
    if (n == null) return "";
    if (!flowData) return "";
    var starterPct = flowData.starterInfo ? Math.round(flowData.starterInfo.ratio * 100) : 0;
    var starterWord = flowData.starterInfo ? flowData.starterInfo.mostCommonStarter : "";
    var starterBad = flowData.starterInfo && flowData.starterInfo.ratio > 0.25;
    var starterSerious = flowData.starterInfo && flowData.starterInfo.ratio > 0.33;
    var shortRunBad = flowData.shortRun >= 4;
    var shortRunMild = flowData.shortRun >= 3;

    if (n <= 6) {
        if (starterSerious && shortRunBad) {
            return 'Your ideas are easy to understand, but ' + starterPct + '% of sentences start with "' + starterWord + '" and several short sentences stack up in a row, which makes the rhythm feel choppy and repetitive.';
        }
        if (starterSerious) {
            return starterPct + '% of sentences start with "' + starterWord + '", which makes the rhythm sound repetitive - try opening some sentences differently.';
        }
        if (shortRunBad) {
            return "Your ideas are easy to understand, but many short sentences in a row make parts of the writing sound choppy.";
        }
        if (starterBad) {
            return 'Your story stays clear, but about ' + starterPct + '% of sentences begin with "' + starterWord + '", so varying the sentence starters would help the flow.';
        }
        if (flowData.varietyScore < 55) {
            return "Your writing makes sense, but the sentence rhythm feels uneven, so mixing short and longer sentences will help it flow better.";
        }
    }
    if (n <= 8) {
        if (starterBad && shortRunMild) {
            return 'Your writing flows fairly well, but ' + starterPct + '% of sentences open with "' + starterWord + '" and some short sentences cluster together - both are worth fixing for a smoother read.';
        }
        if (starterBad) {
            return 'Your ideas connect well, but starting ' + starterPct + '% of sentences with "' + starterWord + '" makes the rhythm feel a little repetitive - try varying some sentence openers.';
        }
        if (shortRunMild) {
            return "Your story moves along clearly, and adding a few longer sentences will help the rhythm feel smoother.";
        }
        if (flowData.varietyScore >= 80) {
            return "Your sentence variety is strong - keep mixing lengths and openings to maintain that smooth flow.";
        }
    }
    return "";
}

function buildFlowEvidenceFromData(score, flowData) {
    var n = getNumericAssessmentScore(score);
    if (n == null) return "";
    if (!flowData) return "";
    var starterPct = flowData.starterInfo ? Math.round(flowData.starterInfo.ratio * 100) : 0;
    var starterWord = flowData.starterInfo ? flowData.starterInfo.mostCommonStarter : "";
    var starterBad = flowData.starterInfo && flowData.starterInfo.ratio > 0.25;
    var shortRunBad = flowData.shortRun >= 4;

    if (n <= 6) {
        if (starterBad && shortRunBad) {
            return '"' + starterWord + '" opens ' + starterPct + '% of sentences, and there are also several very short sentences stacked in a row, both of which disrupt the rhythm.';
        }
        if (starterBad) {
            return '"' + starterWord + '" is used to open ' + starterPct + '% of sentences, which makes the rhythm feel repetitive in places.';
        }
        if (shortRunBad) {
            return "There are several very short sentences in a row, which makes the rhythm feel jumpy in places.";
        }
        return "The writing stays understandable, but the sentence rhythm is not very varied yet.";
    }
    if (n <= 8) {
        if (starterBad) {
            return '"' + starterWord + '" opens ' + starterPct + '% of sentences, which creates a slightly repetitive rhythm even though the sentence lengths are varied.';
        }
        if (flowData.varietyScore < 65) {
            return "Some sentence variety is present, but the rhythm would be smoother with a wider mix of sentence lengths.";
        }
        if (flowData.varietyScore >= 80) {
            return "Sentence lengths are well varied (short: " + flowData.shortCount + ", medium: " + flowData.mediumCount + ", long: " + flowData.longCount + "), which gives the writing a natural rhythm.";
        }
    }
    return "";
}


function buildGrammarScoreBasis(totalErrors, wordCount, errorDensity) {
    var words = Number(wordCount) || 0;
    var errors = Number(totalErrors) || 0;
    var density = Number(errorDensity) || 0;
    return "Grammar score is based mainly on error density: " + errors + " grammar issue" + (errors === 1 ? "" : "s") + " in " + words + " words, about " + density.toFixed(1) + " issue" + (Math.abs(density - 1) < 0.05 ? "" : "s") + " per 100 words.";
}

function buildGrammarPatternNotes(score, originalText, correctedText) {
    var summary = analyzeGrammarChanges(originalText, correctedText);
    var n = getNumericAssessmentScore(score);
    var notes = [];
    var total = summary.totalEdits || 0;
    var sentenceLevel = total >= 8 ? "Main issue" : (total >= 4 ? "Moderate issue" : "Minor issue");
    var verbLevel = summary.verbIssues >= 4 ? "Main issue" : (summary.verbIssues > 0 ? "Minor to moderate issue" : "Mostly correct");
    var wordOrderLevel = total >= 6 ? "Moderate issue" : (total >= 3 ? "Minor issue" : "Mostly clear");
    var pronounLevel = /\b(he|she|they|it|him|her|them)\b/i.test(originalText || "") ? "Mostly clear" : "Not a major issue";
    var clarityLevel = n == null ? "Not assessed" : (n >= 7 ? "Mostly clear" : (n >= 5 ? "Developing" : "Needs support"));
    notes.push({ pattern: "Sentence boundaries / run-ons", level: sentenceLevel, comment: total >= 4 ? "Some sentences need clearer breaks or punctuation." : "Sentence boundaries are mostly manageable." });
    notes.push({ pattern: "Verb tense and agreement", level: verbLevel, comment: summary.verbIssues > 0 ? "Some verb forms or tense choices need checking." : "Verb tense is not the main issue." });
    notes.push({ pattern: "Word order / phrasing", level: wordOrderLevel, comment: total >= 3 ? "A few phrases could be clearer or more natural." : "Word order is mostly clear." });
    notes.push({ pattern: "Pronouns and references", level: pronounLevel, comment: "Pronouns do not appear to be the main reason for the grammar score." });
    notes.push({ pattern: "Grammar clarity", level: clarityLevel, comment: n == null ? getEvidenceNote("Grammar") : (n >= 7 ? "The reader can understand the writing most of the time." : "Grammar sometimes interrupts the reader's understanding.") });
    return notes;
}

function renderNoticeTable(rows) {
    if (!rows || !rows.length) return "";
    var html = '<div class="assessment-sub"><strong>What I noticed:</strong></div>';
    html += '<table class="notice-table"><thead><tr><th>Area</th><th>Comment</th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
        html += '<tr><td>' + escapeHtml(rows[i].area || "Overall") + '</td><td>' + renderMarkdownBold(rows[i].comment || "No detailed note available yet.") + '</td></tr>';
    }
    html += '</tbody></table>';
    return html;
}

function normalizeNoticeRows(rows) {
    var output = [];
    if (!rows || !rows.length) return output;
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || {};
        var area = row.area || row.pattern || row.criterion || row.label || "Overall";
        var comment = row.comment || row.note || row.evidence || row.reason || "";
        if (!comment && row.level) comment = row.level;
        if (area || comment) output.push({ area: area || "Overall", comment: comment || "No detailed note available yet." });
    }
    return output;
}



function polishFeedback(quickRubric, detailed, originalText, correctedText, flowData) {
    var conventionSource = (correctedText && correctedText.trim()) ? correctedText : originalText;
    var issues = detectConventionIssues(conventionSource);
    polishCategoryWording();

    if (quickRubric["Spelling & Punctuation"] && (getNumericAssessmentScore(quickRubric["Spelling & Punctuation"].score) != null || issues.length || !quickRubric["Spelling & Punctuation"].reason)) {
        quickRubric["Spelling & Punctuation"].reason = toOneSentence(teacherizeWording(buildConventionReason(quickRubric["Spelling & Punctuation"].score, issues), "Spelling & Punctuation", quickRubric["Spelling & Punctuation"].score));
    }
    if (detailed.categories["Spelling & Punctuation"]) {
        if (getNumericAssessmentScore(detailed.categories["Spelling & Punctuation"].score) != null || issues.length || !detailed.categories["Spelling & Punctuation"].evidence) {
            detailed.categories["Spelling & Punctuation"].evidence = buildConventionEvidence(detailed.categories["Spelling & Punctuation"].score, issues);
        }
        detailed.categories["Spelling & Punctuation"].growthTip = buildConventionGrowthTip(issues);
    }

    var grammarQuick = quickRubric["Grammar"];
    if (grammarQuick && getNumericAssessmentScore(grammarQuick.score) != null) {
        var grammarReason = buildGrammarReasonFromData(grammarQuick.score, originalText, correctedText);
        if (grammarReason) grammarQuick.reason = toOneSentence(teacherizeWording(grammarReason, "Grammar", grammarQuick.score));
    }
    if (detailed.categories["Grammar"] && getNumericAssessmentScore(detailed.categories["Grammar"].score) != null) {
        var grammarEvidence = buildGrammarEvidenceFromData(detailed.categories["Grammar"].score, originalText, correctedText);
        if (grammarEvidence) detailed.categories["Grammar"].evidence = toOneSentence(teacherizeWording(grammarEvidence, "Grammar", detailed.categories["Grammar"].score));
        detailed.categories["Grammar"].evidence = alignGrammarWordingWithErrorData(detailed.categories["Grammar"].evidence, detailed.categories["Grammar"]);
        if (detailed.categories["Grammar"].teacherComment) {
            detailed.categories["Grammar"].teacherComment = alignGrammarWordingWithErrorData(detailed.categories["Grammar"].teacherComment, detailed.categories["Grammar"]);
        }
    }

    var flowQuick = quickRubric["Flow"];
    if (flowQuick && getNumericAssessmentScore(flowQuick.score) != null) {
        var flowReason = buildFlowReasonFromData(flowQuick.score, flowData);
        if (flowReason) flowQuick.reason = toOneSentence(teacherizeWording(flowReason, "Flow", flowQuick.score));
    }
    if (detailed.categories["Flow"] && getNumericAssessmentScore(detailed.categories["Flow"].score) != null) {
        var flowEvidence = buildFlowEvidenceFromData(detailed.categories["Flow"].score, flowData);
        if (flowEvidence) detailed.categories["Flow"].evidence = toOneSentence(teacherizeWording(flowEvidence, "Flow", detailed.categories["Flow"].score));
    }

    function polishCategoryWording() {
        var i;
        for (i = 0; i < CATEGORY_KEYS.length; i++) {
            var key = CATEGORY_KEYS[i];
            if (quickRubric[key] && quickRubric[key].reason) {
                quickRubric[key].reason = toOneSentence(teacherizeWording(softenOverclaim(quickRubric[key].reason, quickRubric[key].score), key, quickRubric[key].score));
            }
            if (detailed.categories[key]) {
                var item = detailed.categories[key];
                if (item.evidence) item.evidence = toOneSentence(teacherizeWording(softenOverclaim(item.evidence, item.score), key, item.score));
                if (item.growthTip) item.growthTip = teacherizeWording(softenOverclaim(item.growthTip, item.score), key, item.score);
                if (item.contentOrganization) item.contentOrganization = toOneSentence(teacherizeWording(softenOverclaim(item.contentOrganization, item.score), key, item.score));
                if (item.sentenceVariety) item.sentenceVariety = toOneSentence(teacherizeWording(softenOverclaim(item.sentenceVariety, item.score), key, item.score));
            }
        }
    }
}

function softFallback(category, actualWords, targetWords) {
    if (category === "Ideas & Details") {
        var msg = "The writing shares a clear main idea and gives the reader a sense of what is happening.";
        if (targetWords && actualWords < targetWords * 0.8) {
            msg += " Adding a bit more detail would help the piece feel fuller and better meet the target length.";
        } else {
            msg += " A few more specific details could make the scene even easier to picture.";
        }
        return msg;
    }
    if (category === "Grammar") {
        return "Grammar patterns are developing, and a careful edit can help make the writing even clearer.";
    }
    if (category === "Word Choice") {
        return "The vocabulary works for the topic, and there is room to strengthen it with a few more precise or vivid words.";
    }
    if (category === "Organization") {
        return "The ideas mostly stay in a clear order, and a few transition words could make the structure even easier to follow.";
    }
    if (category === "Flow") {
        return "The writing moves along fairly smoothly, and mixing short and longer sentences could help the rhythm feel more natural.";
    }
    return "Spelling and punctuation are developing, and a quick proofread could help catch small mistakes.";
}
