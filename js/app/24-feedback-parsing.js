/* =============================================================================
   Feedback parsing and reconciliation - parse the three-step OpenRouter response
   (quick rubric, detailed assessment), then apply word-count and flow
   adjustments. Extracted from 10-main-app.js (decompose-20261016). Classic
   script; global names unchanged, loaded before 10-main-app.js.
   ============================================================================= */

function parseStep1(step1Text, originalText, targetWords) {
    var result = {
        correctedStory: "",
        errorCounts: { grammar: 0, punctuation: 0, spelling: 0 },
        sentenceCount: null,
        wordsPerSentence: "",
        varietyScore: null,
        flowRating: "",
        flowTip: "",
        quickRubric: {}
    };

    var correctedMatch = step1Text.match(/#\s*Corrected Story\s*([\s\S]*)$/i);
    if (correctedMatch) result.correctedStory = correctedMatch[1].trim();
    if (!result.correctedStory) {
        result.correctedStory = String(step1Text || "").replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
    }

    result.correctedStory = buildMinimalCorrectionMarkup(originalText || "", result.correctedStory || "");
    if (!result.correctedStory) {
        result.correctedStory = String(originalText || "").trim();
    }

    result.errorCounts.grammar = countBoldedSegments(result.correctedStory);
    var errorMatch = step1Text.match(/(\d+)\s*punctuation,\s*(\d+)\s*spelling/i);
    if (errorMatch) {
        result.errorCounts.punctuation = parseInt(errorMatch[1], 10);
        result.errorCounts.spelling = parseInt(errorMatch[2], 10);
    }

    return result;
}

function parseStep2QuickRubric(step2Text, originalText, targetWords) {
    var rubric = {};
    var rubricSectionMatch = step2Text.match(/\*\*Quick Rubric:?\*\*([\s\S]*)$/i);
    var rubricSection = rubricSectionMatch ? rubricSectionMatch[1] : step2Text;

    function parseQuickLine(category) {
        var safeLabel = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
        var regex = new RegExp("-\\s*" + safeLabel + "\\s*:\\s*((?:10|9|8|7|6|5|4)|Missing)\\s*(?:\\/\\s*" + RUBRIC_MAX + ")?\\s*-\\s*([^\\n]+)", "i");
        var m = rubricSection.match(regex);
        if (m) {
            return { score: /missing/i.test(m[1]) ? null : parseRubricScore(m[1]), reason: (m[2] || "").trim() };
        }
        return null;
    }

    // Step 2 only returns the 6 core categories (Neatness is handled separately via image)
    var coreLabels = [
        "Ideas & Details",
        "Grammar",
        "Word Choice",
        "Organization",
        "Flow",
        "Spelling & Punctuation"
    ];

    for (var i = 0; i < coreLabels.length; i++) {
        var item = parseQuickLine(coreLabels[i]);
        if (item) rubric[coreLabels[i]] = item;
    }

    for (var j = 0; j < coreLabels.length; j++) {
        var label = coreLabels[j];
        if (!rubric[label]) {
            rubric[label] = {
                score: null,
                reason: getEvidenceNote(label)
            };
        }
    }

    return rubric;
}

function extractScoreNearLabel(text, labelVariants) {
    var i;
    for (i = 0; i < labelVariants.length; i++) {
        var label = labelVariants[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Only the header's score slot (or its immediate Score line) is evidence of a score.
        var pattern = new RegExp("(?:^|\\n)[ \\t]*(?:[-#]+[ \\t]*)?(?:\\*\\*)?(?:\\d+\\.[ \\t]*)?" + label
            + "(?:\\*\\*)?[ \\t]*[:\\-]?[ \\t]*(?:\\*\\*)?[ \\t]*(?:\\r?\\n[ \\t]*)?(?:\\(?score[ \\t]*[:\\-]?[ \\t]*)?"
            + "((?:10|[4-9])|Missing)(?!\\w|\\.\\d)(?:[ \\t]*\\/[ \\t]*" + RUBRIC_MAX + "(?!\\d|\\.\\d))?(?![ \\t]*\\/)", "i");
        var m = text.match(pattern);
        if (m) return /missing/i.test(m[1]) ? null : parseRubricScore(m[1]);
    }
    return null;
}

function parseWhatINoticedRowsFromBody(body) {
    var rows = [];
    var text = String(body || "");
    var blockMatch = text.match(/-\s*(?:\*\*)?What I Noticed:?(?:\*\*)?\s*([\s\S]*?)(?=\n-\s*(?:\*\*)?Growth Tip:?|\n\*\*|$)/i);
    if (!blockMatch) return rows;
    var block = blockMatch[1] || "";
    var pairRegex = /-\s*Area:\s*([^\n]+)\n\s*Comment:\s*([^\n]+)/gi;
    var m;
    while ((m = pairRegex.exec(block)) !== null) {
        rows.push({ area: (m[1] || "").trim(), comment: (m[2] || "").trim() });
    }
    if (rows.length) return rows;
    var simpleRegex = /-\s*([^:\n]+):\s*([^\n]+)/g;
    while ((m = simpleRegex.exec(block)) !== null) {
        var area = (m[1] || "").trim();
        var comment = (m[2] || "").trim();
        if (area && comment && !/^comment$/i.test(area)) rows.push({ area: area, comment: comment });
    }
    return rows;
}

function parseDetailedAssessment(step3Text, originalText, optGenreInfo) {
    var result = {
        categories: {},
        strength: "",
        growGoal: "",
        nextTime: "",
        keepWriting: "",
        titleSuggestion: ""
    };

    function captureCategory(label) {
        var labelSafe = label.replace(/^\d+\. /, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/^Clear /, "(?:Clear )?").replace(/ & /g, " (?:&|and) ");
        // Any following category/section ends this body, including reordered or duplicate labels.
        var nextLabelRegex = "(?=\\r?\\n[ \\t]*(?:#{1,6}[ \\t]+|(?:-[ \\t]*)?(?:\\*\\*)?(?:\\d+\\.[ \\t]*)?"
            + "(?:(?:Clear )?Ideas (?:&|and) Details|Grammar|Word Choice|Organization|Flow|Spelling (?:&|and) Punctuation)(?:\\*\\*)?[ \\t]*[:\\-]"
            + "|(?:\\*\\*)?(?:Your Writing Strength:|Your Grow Goal:|Try This Next Time:|Keep Writing|Writing Title:)"
            + "|(?:Grow Goal Selection|Notebook Guide Candidate JSON|What I Noticed)[ \\t]*(?:\\r?\\n|$))|$)";
        var pattern = new RegExp("(?:^|\\n)[ \\t]*(?:[-#]+[ \\t]*)?(?:\\*\\*)?(?:\\d+\\.[ \\t]*)?" + labelSafe
            + "(?:\\*\\*)?[ \\t]*[:\\-][ \\t]*(?:\\*\\*)?[ \\t]*(?:\\r?\\n[ \\t]*)?(?:\\(?score[ \\t]*[:\\-]?[ \\t]*)?"
            + "((?:10|[4-9])|Missing)(?!\\w|\\.\\d)(?:[ \\t]*\\/[ \\t]*" + RUBRIC_MAX + "(?!\\d|\\.\\d))?(?![ \\t]*\\/)([\\s\\S]*?)" + nextLabelRegex, "i");
        var m = step3Text.match(pattern);
        if (!m) return null;
        var body = (m[2] || "").trim();

        var evidence = "";
        var growthTip = "";
        var contentOrg = "";
        var sentenceVariety = "";
        var teacherComment = "";
        var noticeRows = [];

        var t = body.match(/-\s*(?:\*\*)?Teacher Comment:?(?:\*\*)?\s*([^\n]+)\s*(?:\n|$)/i);
        if (t) teacherComment = t[1].trim();
        noticeRows = parseWhatINoticedRowsFromBody(body);
        var e = body.match(/-\s*Evidence:\s*"?([^\n]+?)"?\s*(?:\n|$)/i);
        if (e) evidence = e[1].trim();
        if (!evidence && noticeRows.length) evidence = noticeRows[0].comment || "";
        var g = body.match(/-\s*(?:\*\*)?Growth Tip:?(?:\*\*)?\s*([^\n]+)\s*(?:\n|$)/i);
        if (g) growthTip = g[1].trim();

        if (label === "4. Organization") {
            var c = body.match(/-\s*(?:\*\*)?Content Organization:?(?:\*\*)?\s*([^\n]+)/i);
            if (c) contentOrg = c[1].trim();
        }
        var flowPattern = "";
        if (label === "5. Flow") {
            var fp = body.match(/-\s*(?:\*\*)?Flow Pattern:?(?:\*\*)?\s*([^\n]+)/i);
            if (fp) flowPattern = fp[1].trim();
            var s = body.match(/-\s*(?:\*\*)?Sentence Variety:?(?:\*\*)?\s*([^\n]+)/i);
            if (s) sentenceVariety = s[1].trim();
        }

        return {
            score: parseRubricScore(m[1]),
            evidence: evidence,
            teacherComment: teacherComment,
            noticeRows: noticeRows,
            growthTip: growthTip,
            contentOrganization: contentOrg,
            sentenceVariety: sentenceVariety,
            flowPattern: flowPattern,
            rawBody: body
        };
    }

    function storeCapturedCategory(name, category) {
        if (category) result.categories[name] = category;
    }

    function fillMissingCategory(name, captured, aliases) {
        if (captured) return;
        var score = extractScoreNearLabel(step3Text, aliases);
        if (score != null) {
            result.categories[name] = {
                score: score,
                evidence: "",
                growthTip: "",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
    }

    var c1 = captureCategory("1. Clear Ideas & Details");
    var c2 = captureCategory("2. Grammar");
    var c3 = captureCategory("3. Word Choice");
    var c4 = captureCategory("4. Organization");
    var c5_flow = captureCategory("5. Flow");
    var c5 = captureCategory("6. Spelling & Punctuation");

    storeCapturedCategory("Ideas & Details", c1);
    storeCapturedCategory("Grammar", c2);
    storeCapturedCategory("Word Choice", c3);
    storeCapturedCategory("Organization", c4);
    storeCapturedCategory("Flow", c5_flow);
    storeCapturedCategory("Spelling & Punctuation", c5);

    // NOTE: Neatness is NOT parsed from Step 3 — it is assessed separately by assessNeatnessFromImage()
    // and injected into detailed.categories["Neatness"] via the inheritance loop in analyzeWriting().

    fillMissingCategory("Ideas & Details", c1, [
        "1. Clear Ideas & Details",
        "Clear Ideas & Details",
        "Ideas & Details",
        "Clear Ideas and Details"
    ]);

    fillMissingCategory("Grammar", c2, [
        "2. Grammar",
        "Grammar"
    ]);

    fillMissingCategory("Word Choice", c3, [
        "3. Word Choice",
        "Word Choice"
    ]);

    fillMissingCategory("Organization", c4, [
        "4. Organization",
        "Organization"
    ]);

    fillMissingCategory("Flow", c5_flow, [
        "5. Flow",
        "Flow"
    ]);

    fillMissingCategory("Spelling & Punctuation", c5, [
        "6. Spelling & Punctuation",
        "5. Spelling & Punctuation",
        "Spelling & Punctuation",
        "Spelling and Punctuation"
    ]);

    var s1 = step3Text.match(/\*\*Your Writing Strength:\*\*\s*([^\n]+)/i);
    if (s1) result.strength = s1[1].trim();

    var g1 = step3Text.match(/\*\*Your Grow Goal:\*\*\s*(?:\[.?\]\s*)?([^\n]+)/i);
    if (g1) result.growGoal = g1[1].trim();

    var n1 = step3Text.match(/\*\*Try This Next Time:\*\*\s*([^\n]+)/i);
    if (n1) result.nextTime = normalizeGrowGoalStrategyForSentence(n1[1].trim());

    var k1 = step3Text.match(/\*\*Keep Writing!?\*\*\s*([^\n]+)/i);
    if (k1) result.keepWriting = k1[1].trim();

    var t1 = step3Text.match(/\*\*Writing Title:\*\*\s*([^\n]+)/i);
    if (t1) result.titleSuggestion = t1[1].trim();

    result.notebookGuideCandidates = parseNotebookGuideCandidatesFromStep3Text(step3Text, originalText, optGenreInfo);
    return result;
}

function applyWordCountToIdeas(step1Parsed, detailedParsed, actualWords, targetWords, optGradeProfile) {
    var baseQuick = step1Parsed.quickRubric["Ideas & Details"] ? step1Parsed.quickRubric["Ideas & Details"].score : null;
    var baseDetailed = getNumericAssessmentScore(detailedParsed.categories["Ideas & Details"] ? detailedParsed.categories["Ideas & Details"].score : baseQuick);
    if (baseDetailed == null) {
        return {
            adjustedScore: null,
            shortfallRatio: 0,
            multiplier: 1,
            penaltyRubricPoints: 0,
            note: "Ideas & Details was left unscored because there was not enough clear evidence."
        };
    }
    var adjustment = calculateWordCountAdjustment(baseDetailed, actualWords, targetWords, optGradeProfile);

    if (!step1Parsed.quickRubric["Ideas & Details"]) {
        step1Parsed.quickRubric["Ideas & Details"] = {
            score: null,
            reason: getEvidenceNote("Ideas & Details")
        };
    }

    step1Parsed.quickRubric["Ideas & Details"].score = adjustment.adjustedScore;
    if (targetWords && actualWords < targetWords) {
        if (actualWords < targetWords * 0.8) {
            step1Parsed.quickRubric["Ideas & Details"].reason += " Since the piece is noticeably shorter than the target word count, adding more detail would help it feel fuller.";
        } else {
            step1Parsed.quickRubric["Ideas & Details"].reason += " Getting a little closer to the target word count would create more room for details.";
        }
    } else if (targetWords && adjustment.goingBeyond) {
        // Going Beyond feedback
        step1Parsed.quickRubric["Ideas & Details"].reason = adjustment.goingBeyondNote + " " + step1Parsed.quickRubric["Ideas & Details"].reason;
    }

    if (!detailedParsed.categories["Ideas & Details"]) {
        detailedParsed.categories["Ideas & Details"] = {
            score: adjustment.adjustedScore,
            evidence: "The writing shares a clear main idea.",
            growthTip: "Add one or two more specific details to help the reader picture the moment.",
            contentOrganization: "",
            sentenceVariety: ""
        };
    } else {
        detailedParsed.categories["Ideas & Details"].score = adjustment.adjustedScore;
        if (targetWords && actualWords < targetWords) {
            if (actualWords < targetWords * 0.8) {
                detailedParsed.categories["Ideas & Details"].growthTip += " Also, the piece is significantly shorter than the target word count, so adding more detail would strengthen this category.";
            } else {
                detailedParsed.categories["Ideas & Details"].growthTip += " Reaching the target word count would also give you more space to develop details.";
            }
        } else if (targetWords && adjustment.goingBeyond) {
            // Going Beyond feedback for detailed rubric
            detailedParsed.categories["Ideas & Details"].evidence = adjustment.goingBeyondNote + " " + detailedParsed.categories["Ideas & Details"].evidence;
        }
    }

    return adjustment;
}


function flowScoreCap(flowData) {
    if (!flowData || !flowData.flowRating) return 10;
    if (flowData.flowRating === "Very Good") return 10;
    if (flowData.flowRating === "Good") return 8;
    if (flowData.flowRating === "Developing") return 6;
    if (flowData.flowRating === "Needs Improvement") return 4;
    return 10;
}

function getDominantSentenceBand(flowData) {
    if (!flowData || !flowData.sentenceCount) return { label: "", count: 0, ratio: 0 };
    var total = flowData.sentenceCount || 1;
    var label = "short";
    var count = flowData.shortCount || 0;
    if ((flowData.mediumCount || 0) > count) {
        label = "medium";
        count = flowData.mediumCount || 0;
    }
    if ((flowData.longCount || 0) > count) {
        label = "long";
        count = flowData.longCount || 0;
    }
    return { label: label, count: count, ratio: count / total };
}

function flowCommentMentionsFalseShortProblem(text, flowData) {
    var s = String(text || "");
    if (!s || !flowData) return false;
    var mentionsShortSentences = /\bshort\s+sentences?\b/i.test(s) || /\bshorter\s+sentences?\b/i.test(s);
    var framesAsProblem = /\b(choppy|problem|issue|too\s+short|many|lots|several|most|relies|cluster|stack|stacked|row|balance\s+the\s+shorter)\b/i.test(s);
    if (!mentionsShortSentences || !framesAsProblem) return false;
    if ((flowData.shortCount || 0) === 0) return true;
    if ((flowData.shortRun || 0) < 3 && /\b(row|cluster|stack|stacked)\b/i.test(s)) return true;
    return false;
}

function sanitizeFlowCommentForData(text, flowData) {
    if (!text) return text;
    if (flowCommentMentionsFalseShortProblem(text, flowData)) return "";
    return text;
}

function buildComputedFlowQuickNote(flowData) {
    if (!flowData || !flowData.sentenceCount) {
        return "Try mixing short, medium, and longer sentences for smoother flow.";
    }
    var starterInfo = flowData.starterInfo || { ratio: 0, mostCommonStarter: "" };
    var starterPct = Math.round((starterInfo.ratio || 0) * 100);
    var starterWord = starterInfo.mostCommonStarter || "";
    var starterBad = starterInfo.ratio > 0.25 && starterWord;
    var shortRunBad = (flowData.shortRun || 0) >= 4 && (flowData.shortCount || 0) > 0;
    var dominant = getDominantSentenceBand(flowData);

    if (starterBad && shortRunBad) {
        return 'Try varying sentence starters and combining some short sentences - about ' + starterPct + '% of sentences start with "' + starterWord + '", and some short sentences sit close together.';
    }
    if (starterBad) {
        return 'Try varying sentence starters - about ' + starterPct + '% of sentences start with "' + starterWord + '", which can make the rhythm sound repetitive.';
    }
    if (shortRunBad) {
        return "Try combining some short sentences that are next to each other so the rhythm feels less choppy.";
    }
    return buildSentenceLengthQuickNote();

    function buildSentenceLengthQuickNote() {
        if ((flowData.shortCount || 0) === 0) {
            return "The writing uses mostly medium and long sentences, so adding a few shorter sentences could create more rhythm and contrast.";
        }
        if ((flowData.longCount || 0) === 0) {
            return "Adding one or two longer sentences would help balance the shorter sentences and make the rhythm smoother.";
        }
        if ((flowData.mediumCount || 0) === 0) {
            return "Adding some medium-length sentences would help the writing move more naturally between short and long sentences.";
        }
        if (dominant.label === "short" && dominant.ratio >= 0.60) {
            return "Many sentences are short, so combining a few ideas into longer sentences would help the rhythm feel smoother.";
        }
        if (dominant.label === "long" && dominant.ratio >= 0.60) {
            return "Many sentences are long, so adding a few shorter sentences would create clearer rhythm and contrast.";
        }
        if (dominant.label === "medium" && dominant.ratio >= 0.75) {
            return "Most sentences are medium length, so adding a few short and long sentences would create more variety.";
        }
        return "A bit more sentence variety would help the writing sound smoother and more polished.";
    }
}

function buildFlowPatternSummary(flowData) {
    if (!flowData || !flowData.sentenceCount) return "The writing needs more sentence evidence before a clear flow pattern can be described.";
    var starterInfo = flowData.starterInfo || { ratio: 0, mostCommonStarter: "" };
    var starterWord = starterInfo.mostCommonStarter || "";
    var starterBad = starterWord && starterInfo.ratio > 0.25;
    if (starterBad && (flowData.shortCount || 0) === 0) {
        return 'Your writing is easy to follow, but the rhythm feels repetitive because many sentences begin with "' + starterWord + '". Adding a few shorter sentences could also improve rhythm.';
    }
    if (starterBad) {
        return 'Your writing is easy to follow, but the rhythm feels repetitive because many sentences begin with "' + starterWord + '".';
    }
    if ((flowData.shortCount || 0) === 0) {
        return "Your writing uses mostly medium and long sentences, so adding a few shorter sentences could create more rhythm and contrast.";
    }
    if ((flowData.shortRun || 0) >= 4 && (flowData.shortCount || 0) > 0) {
        return "Some short sentences appear close together, so combining a few ideas could make the rhythm smoother.";
    }
    return "Your sentence rhythm is generally understandable. Keep varying sentence lengths and openings so the writing reads smoothly.";
}

function buildFlowPatternNotes(flowData) {
    if (!flowData || !flowData.sentenceCount) return [];
    var notes = [];
    var starterInfo = flowData.starterInfo || { ratio: 0, mostCommonStarter: "", count: 0 };
    var starterWord = starterInfo.mostCommonStarter || "";
    var starterBad = starterWord && starterInfo.ratio > 0.25;
    var lengthNote;
    if ((flowData.shortCount || 0) === 0) {
        lengthNote = "The writing uses mostly medium and long sentences. Adding a few shorter sentences could add contrast.";
    } else if ((flowData.longCount || 0) === 0) {
        lengthNote = "The writing uses shorter and medium sentences. Adding one or two longer sentences could smooth the rhythm.";
    } else if ((flowData.shortRun || 0) >= 4 && (flowData.shortCount || 0) > 0) {
        lengthNote = "Some short sentences appear close together. Combining a few ideas could make the rhythm smoother.";
    } else {
        lengthNote = "The writing uses a mix of sentence lengths. Keep varying the rhythm as you revise.";
    }
    notes.push({ area: "Sentence length", comment: lengthNote });

    var starterNote;
    if (starterBad) {
        starterNote = 'Many sentences begin with "' + starterWord + '", which can make the rhythm feel repetitive.';
    } else if (starterWord) {
        starterNote = "Sentence starters show some variety and do not create a major repeated pattern.";
    } else {
        starterNote = "Sentence starters do not show a clear repeated pattern.";
    }
    notes.push({ area: "Sentence starters", comment: starterNote });

    var connectionNote = "The events mostly connect from one moment to the next; transition words or stronger sentence openings could make the jumps even smoother.";
    notes.push({ area: "Connections", comment: connectionNote });
    return notes;
}



function applyComputedFlowToFlow(step1Parsed, detailedParsed, flowData) {
    var key = "Flow";
    var cap = flowScoreCap(flowData);
    var quickItem = step1Parsed.quickRubric[key] || { score: null, reason: getEvidenceNote(key) };
    var detailedItem = detailedParsed.categories[key];

    var quickScore = getNumericAssessmentScore(quickItem.score);
    quickItem.score = quickScore == null ? null : Math.min(quickScore, cap);
    if (flowData && flowData.flowRating && flowData.flowRating !== "Very Good") {
        var baseFlowReason = sanitizeFlowCommentForData(quickItem.reason.replace(/\s*Flow:.*$/i, "").trim(), flowData);
        var computedFlowNote = buildComputedFlowQuickNote(flowData);
        quickItem.reason = baseFlowReason ? baseFlowReason + " " + computedFlowNote : computedFlowNote;
    }
    step1Parsed.quickRubric[key] = quickItem;

    if (!detailedItem) {
        detailedItem = {
            score: quickItem.score,
            evidence: "The sentence patterns in this writing contribute to the overall rhythm.",
            growthTip: buildComputedFlowTip(flowData),
            contentOrganization: "",
            sentenceVariety: "",
            flowPattern: flowData ? buildFlowPatternSummary(flowData) : "",
            patternNotes: flowData ? buildFlowPatternNotes(flowData) : [],
            rawBody: ""
        };
        detailedParsed.categories[key] = detailedItem;
    }

    var detailedScore = getNumericAssessmentScore(detailedItem.score);
    detailedItem.score = detailedScore == null ? null : Math.min(detailedScore, cap);
    if (flowData) {
        detailedItem.evidence = sanitizeFlowCommentForData(detailedItem.evidence, flowData);
        detailedItem.growthTip = sanitizeFlowCommentForData(detailedItem.growthTip, flowData);
        detailedItem.sentenceVariety = "";
        detailedItem.flowPattern = buildFlowPatternSummary(flowData);
        detailedItem.patternNotes = buildFlowPatternNotes(flowData);
        if (!detailedItem.evidence) {
            detailedItem.evidence = buildFlowEvidenceFromData(detailedItem.score, flowData) || detailedItem.flowPattern;
        }
        if (!detailedItem.growthTip || detailedItem.growthTip === "No growth tip extracted.") {
            detailedItem.growthTip = buildComputedFlowTip(flowData);
        }
    }
}

function applyOrganizationFallback(step1Parsed, detailedParsed, eligibility) {
    var key = "Organization";
    if (!detailedParsed.categories[key]) {
        var quickItem = step1Parsed.quickRubric[key] || { score: null, reason: getEvidenceNote(key) };
        var score = eligibility[key] ? getNumericAssessmentScore(quickItem.score) : null;
        detailedParsed.categories[key] = {
            score: score,
            evidence: score == null ? getEvidenceNote(key) : "The writing presents ideas in a sequence the reader can follow.",
            growthTip: quickItem.reason || "Try adding transition words to connect your ideas in a clearer order.",
            contentOrganization: score == null ? "" : "The events stay in a clear, logical order.",
            sentenceVariety: "",
            rawBody: ""
        };
    }
}
