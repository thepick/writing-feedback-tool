/* =============================================================================
   Neatness assessment - handwriting quality scoring from image OCR/analysis.
   Extracted from 00-storage-sync-patches.js (decompose-20261016). Classic script;
   global names unchanged, loaded before 00-storage-sync-patches.js.
   ============================================================================= */

async function assessNeatnessFromImage(imageDataUrl, model) {
    // Use the active/cropped image that the user chose for this assessment.
    // Do not silently switch back to the uncropped original, because that can reintroduce
    // margins, clutter, or typed/printed material the user intentionally removed.
    var assessmentImageUrl = imageDataUrl;

    var prompt = `Look at the image of this student writing sample.

FIRST, classify the source before scoring. This is a required safety check.
Use exactly one source type:
- HANDWRITTEN = mostly handwritten student writing, with enough handwriting to judge fairly.
- TYPED_OR_PRINTED = mostly typed, computer-generated, printed, or worksheet text rather than student handwriting.
- MIXED = both typed/printed text and student handwriting are visible, and there is enough student handwriting to judge fairly.
- NOT_SCORABLE = too blurry, cropped, dark, blocked, or there is not enough student handwriting to judge fairly.

If the source type is TYPED_OR_PRINTED, do not score neatness. Handwriting neatness is not assessed for typed or printed work.
If the source type is NOT_SCORABLE, do not score neatness. Use Missing rather than guessing.
If the source type is MIXED, score only the student's handwriting. Ignore typed instructions, typed prompts, printed worksheets, and computer-generated text.
Do not give low handwriting scores to typed or printed text. Typed or printed work must be marked Missing for neatness, not 2/10.

If the source type is HANDWRITTEN or MIXED with enough student handwriting, score the neatness of the visible student handwriting using the exact 1-5 rubric below.

Score each sub-criterion using only these values: 5, 4, 3, 2, 1 (or "Missing" if you cannot tell from the image). Do not give a score based on effort, writing quality, spelling, punctuation, or story content. Only judge what is visible in the handwriting image.

RUBRIC LEVELS:
5 = Exceptional
4 = Proficient
3 = Developing
2 = Emerging
1 = Beginning

SUB-CRITERIA, WEIGHTS, AND SCORE DESCRIPTORS:

1. Letter Formation (20%)
5 - Letters are clear, complete, and easy to recognize. Most letters are formed carefully.
4 - Most letters are clear and easy to read, with only a few unclear or rushed letters.
3 - Some letters are clear, but several are hard to recognize or are not fully formed.
2 - Many letters are hard to read because they are incomplete, rushed, or poorly shaped.
1 - Most letters are very hard to recognize, making the writing difficult to read.

2. Spacing (15%)
5 - Spaces between words and letters are clear and consistent. The writing is easy to follow.
4 - Most spacing is clear, with only a few places where words or letters are too close together.
3 - Spacing is uneven. Some words are crowded or too far apart.
2 - Many words or letters are crowded together, making the writing harder to read.
1 - Spacing is very unclear, and it is hard to tell where words begin and end.

3. Staying on the Line (15%)
5 - Writing stays neatly on the lines throughout the page.
4 - Writing mostly stays on the lines, with only a few small slips.
3 - Writing sometimes drifts above or below the lines.
2 - Writing often moves off the lines, making the page look messy.
1 - Writing does not follow the lines well and is difficult to read.

4. Size Consistency (15%)
5 - Letter size is consistent and fits the notebook lines well.
4 - Letter size is mostly consistent, with only a few letters that are much bigger or smaller.
3 - Letter size changes noticeably in some places.
2 - Letter size changes often, making the writing harder to read.
1 - Letter size is very uneven and makes the writing difficult to follow.

5. Pen Control and Marks (15%)
5 - Lines are clean and controlled. There are no distracting smudges, scribbles, or messy marks.
4 - There are only a few small smudges, eraser marks, or stray marks.
3 - There are some smudges, cross-outs, or messy corrections that distract from the writing.
2 - There are many messy marks, heavy pressure marks, or corrections that make the page harder to read.
1 - Smudges, scribbles, tears, or messy marks make the writing very difficult to read.

6. Page Layout and Paragraphs (20%)
5 - The page is well organized. Paragraphs are clear, writing starts near the margin, and the student uses the lines and space neatly.
4 - The page is mostly organized. Paragraphs are mostly clear, writing usually lines up with the margin, and most lines are used well.
3 - Page layout is uneven. Paragraphs may be unclear, some writing may not line up with the margin, or some lines may leave awkward empty space.
2 - Page layout makes the writing harder to follow. Paragraphs are missing or confusing, many lines do not line up well, or the space on the page is not used well.
1 - The page is very disorganized. It is hard to tell where paragraphs start or end, the writing does not follow the margin or lines well, or the layout makes the story difficult to read.

After scoring the six sub-criteria, calculate the weighted final neatness score on a 1-5 scale:
Final 1-5 = (Letter Formation x 0.20) + (Spacing x 0.15) + (Staying on the Line x 0.15) + (Size Consistency x 0.15) + (Pen Control and Marks x 0.15) + (Page Layout and Paragraphs x 0.20)
Round the weighted 1-5 score to the nearest whole number, then convert it to the app's 10-point scale by multiplying by 2.
Examples: 5/5 = 10/10, 4/5 = 8/10, 3/5 = 6/10, 2/5 = 4/10, 1/5 = 2/10.

IMPORTANT - Write in plain, friendly words that a 10-12 year old student will understand.
Avoid technical handwriting terms. Use everyday words like: "your letters", "easy to read", "spaces between words", "staying on the line", "paragraphs", "margin", "using the space on each line", "cross-outs", "messy marks", "shaky lines", etc.
If the photo is blurry, cropped, too dark, or does not show enough handwriting to score fairly, use "Missing" rather than guessing.

Use exactly this format:
**Source Type:** [HANDWRITTEN, TYPED_OR_PRINTED, MIXED, or NOT_SCORABLE]
**Source Type Reason:** [one short sentence explaining the classification]

**Sub-scores:**
- Letter Formation: [score]/5 - [level name]
- Spacing: [score]/5 - [level name]
- Staying on the Line: [score]/5 - [level name]
- Size Consistency: [score]/5 - [level name]
- Pen Control and Marks: [score]/5 - [level name]
- Page Layout and Paragraphs: [score]/5 - [level name]

**Quick Rubric:**
- Neatness: [converted final score]/10 ([rounded final score]/5 - [level name]) - [one sentence describing the most noticeable thing you see in this student's handwriting overall]

**Neatness Growth Tip:** [one short, specific tip written directly to the student about the single most important thing to work on]

If the source type is TYPED_OR_PRINTED, use this exact scoring section:
**Sub-scores:**
- Letter Formation: Missing/5 - Not assessed
- Spacing: Missing/5 - Not assessed
- Staying on the Line: Missing/5 - Not assessed
- Size Consistency: Missing/5 - Not assessed
- Pen Control and Marks: Missing/5 - Not assessed
- Page Layout and Paragraphs: Missing/5 - Not assessed

**Quick Rubric:**
- Neatness: Missing/10 - Neatness was not assessed because this sample appears to be typed or printed.
**Neatness Growth Tip:** No handwriting score was added to the overall grade for this sample.

Example for handwritten work:
**Source Type:** HANDWRITTEN
**Source Type Reason:** The image shows enough student handwriting to judge fairly.

**Sub-scores:**
- Letter Formation: 4/5 - Proficient
- Spacing: 3/5 - Developing
- Staying on the Line: 4/5 - Proficient
- Size Consistency: 3/5 - Developing
- Pen Control and Marks: 4/5 - Proficient
- Page Layout and Paragraphs: 3/5 - Developing

**Quick Rubric:**
- Neatness: 8/10 (4/5 - Proficient) - Most of your letters are easy to read, but some words need clearer spaces between them.
**Neatness Growth Tip:** Try leaving a finger-width gap between each word so your writing is easier to read.`;

    try {
        var response = await callOpenRouterImage(model, prompt, assessmentImageUrl);
        return parseNeatnessAssessmentResponse(response);
    } catch (e) {
        wftDebugError('Neatness assessment failed:', e);
    }
    return null;
}

function parseNeatnessSubScore(label, responseText) {
    var rx = new RegExp('-\\s*' + label + '\\s*:\\s*((?:5|4|3|2|1)|Missing)\\s*\\/5(?![\\w]|[.,]\\d)', 'i');
    var m = responseText.match(rx);
    if (!m) return null;
    return /missing/i.test(m[1]) ? null : Number(m[1]);
}

function parseNeatnessSourceType(responseText) {
    var text = String(responseText || '').replace(/\*\*/g, '');
    var sourceMatch = text.match(/(?:\*\*)?Source\s*Type(?:\*\*)?\s*:\s*(HANDWRITTEN|TYPED_OR_PRINTED|MIXED|NOT_SCORABLE)/i);
    if (sourceMatch) return sourceMatch[1].toUpperCase();
    if (/\b(TYPED_OR_PRINTED|typed\s+or\s+printed|typed\s+work|printed\s+work|appears\s+to\s+be\s+typed|mostly\s+typed|computer\s+typed)\b/i.test(text)) return 'TYPED_OR_PRINTED';
    if (/\b(NOT_SCORABLE|not\s+scorable|cannot\s+score|not\s+enough\s+handwriting|does\s+not\s+show\s+enough\s+handwriting)\b/i.test(text)) return 'NOT_SCORABLE';
    return '';
}

function parseNeatnessSourceReason(responseText) {
    var text = String(responseText || '').replace(/\*\*/g, '');
    var reasonMatch = text.match(/(?:\*\*)?Source\s*Type\s*Reason(?:\*\*)?\s*:\s*([^\n]+)/i);
    return reasonMatch ? reasonMatch[1].trim() : '';
}

function buildUnscoredNeatnessResult(sourceType, reason) {
    sourceType = sourceType || 'NOT_SCORABLE';
    reason = String(reason || '').trim();
    if (!reason) {
        if (sourceType === 'TYPED_OR_PRINTED') {
            reason = 'Neatness was not assessed because this sample appears to be typed or printed.';
        } else {
            reason = 'Neatness was not assessed because there was not enough clear handwriting to score fairly.';
        }
    }
    return {
        quickRubric: {
            score: null,
            reason: reason,
            growthTip: 'No handwriting score was added to the overall grade for this sample.',
            subScores: {
                letterFormation: null,
                spacing: null,
                stayingOnLine: null,
                sizeConsistency: null,
                penControl: null,
                pageLayoutParagraphs: null
            },
            neatnessScoreFive: null,
            neatnessWeightedFive: null,
            sourceType: sourceType,
            notAssessedReason: reason,
            scoreBasis: 'Skipped before scoring because the image source type was ' + sourceType + '.'
        }
    };
}

function calculateWeightedNeatnessFive(subScores) {
    if (!subScores) return null;
    var values = [
        subScores.letterFormation,
        subScores.spacing,
        subScores.stayingOnLine,
        subScores.sizeConsistency,
        subScores.penControl,
        subScores.pageLayoutParagraphs
    ];
    for (var i = 0; i < values.length; i++) {
        if (!Number.isFinite(values[i])) return null;
    }
    return (Number(subScores.letterFormation) * 0.20) +
           (Number(subScores.spacing) * 0.15) +
           (Number(subScores.stayingOnLine) * 0.15) +
           (Number(subScores.sizeConsistency) * 0.15) +
           (Number(subScores.penControl) * 0.15) +
           (Number(subScores.pageLayoutParagraphs) * 0.20);
}

function convertNeatnessFiveToTen(scoreFive) {
    var n = Number(scoreFive);
    if (!isFinite(n)) return null;
    if (n < 1) n = 1;
    if (n > 5) n = 5;
    return Math.round(n) * 2;
}

function buildNeatnessScoreMetrics(subScores) {
    var weightedFive = calculateWeightedNeatnessFive(subScores);
    var roundedFive = weightedFive != null ? Math.round(weightedFive) : null;
    var computedTen = roundedFive != null ? convertNeatnessFiveToTen(roundedFive) : null;
    return { subScores: subScores, weightedFive: weightedFive, roundedFive: roundedFive, computedTen: computedTen };
}

function buildMissingNeatnessResult(metrics, response, sourceType, sourceReason) {
    if (metrics.computedTen == null && /Missing\s*\/10/i.test(response)) {
        return buildUnscoredNeatnessResult(sourceType || 'NOT_SCORABLE', sourceReason || 'Neatness was not assessed because there was not enough clear handwriting to score fairly.');
    }
    return null;
}

function parseNeatnessFallback(response, metrics, sourceType, parsedGrowthTip) {
    var rubric = {};
    // Fallback: score present but observation was not in the expected format.
    var scoreMatch = response.match(/(?:^|[^\w.,+-])((?:10|8|6|4|2))\s*\/10(?![\w]|[.,]\d)/i);
    if (scoreMatch || metrics.computedTen != null) {
        var score = metrics.computedTen != null ? metrics.computedTen : Number(scoreMatch[1]);
        var sentenceMatch = response.match(/([^.\n]*(?:^|[^\w.,+-])(?:10|8|6|4|2)\s*\/10(?![\w]|[.,]\d)[^.\n]*\.?)/i);
        var extractedReason = sentenceMatch ? sentenceMatch[0].replace(/^\s*[-*\d.]+\s*/, '').trim() : '';
        var reason = extractedReason.length > 10 ? extractedReason : null;
        rubric = {
            score: score,
            reason: reason,
            growthTip: parsedGrowthTip,
            subScores: metrics.subScores,
            neatnessScoreFive: metrics.roundedFive,
            neatnessWeightedFive: metrics.weightedFive,
            sourceType: sourceType || 'HANDWRITTEN',
            scoreBasis: metrics.computedTen != null ? 'Computed from handwriting sub-scores.' : 'Parsed from neatness response fallback.'
        };
    }
    return rubric;
}

function parseMatchedNeatnessRubric(match, metrics, sourceType, parsedGrowthTip) {
    var parsedTen = /missing/i.test(match[1]) ? null : Number(match[1]);
    return {
        score: metrics.computedTen != null ? metrics.computedTen : parsedTen,
        reason: (match[2] || '').trim(),
        growthTip: parsedGrowthTip,
        subScores: metrics.subScores,
        neatnessScoreFive: metrics.roundedFive,
        neatnessWeightedFive: metrics.weightedFive,
        sourceType: sourceType || 'HANDWRITTEN',
        scoreBasis: metrics.computedTen != null ? 'Computed from handwriting sub-scores.' : 'Parsed from neatness response.'
    };
}

function parseNeatnessAssessmentResponse(response) {
    var rubric = {};
    var sourceType = parseNeatnessSourceType(response);
    var sourceReason = parseNeatnessSourceReason(response);

    if (sourceType === 'TYPED_OR_PRINTED' || sourceType === 'NOT_SCORABLE') {
        return buildUnscoredNeatnessResult(sourceType, sourceReason);
    }

    // Parse the 1-5 sub-scores from the image rubric.
    var subScores = {
        letterFormation:  parseNeatnessSubScore('Letter Formation', response),
        spacing:          parseNeatnessSubScore('Spacing', response),
        stayingOnLine:    parseNeatnessSubScore('Staying on the Line', response),
        sizeConsistency:  parseNeatnessSubScore('Size Consistency', response),
        penControl:       parseNeatnessSubScore('Pen Control and Marks', response),
        pageLayoutParagraphs: parseNeatnessSubScore('Page Layout and Paragraphs', response)
    };

    var metrics = buildNeatnessScoreMetrics(subScores);

    // If the model did not provide a usable score, preserve the unscored state instead of guessing.
    var missingResult = buildMissingNeatnessResult(metrics, response, sourceType, sourceReason);
    if (missingResult) return missingResult;

    // Parse the response - expected pattern: - Neatness: [score]/10 ([score]/5 - [level]) - [observation]
    var match = response.match(/-\s*Neatness:\s*((?:10|8|6|4|2)|Missing)\s*\/10(?![\w]|[.,]\d)(?:\s*\([^)]*\))?\s*-\s*([^\n]+)/i);
    var growthTipMatch = response.match(/\*\*Neatness Growth Tip:\*\*\s*([^\n]+)/i);
    var parsedGrowthTip = growthTipMatch ? growthTipMatch[1].trim() : null;

    if (match) {
        rubric = parseMatchedNeatnessRubric(match, metrics, sourceType, parsedGrowthTip);
    } else {
        rubric = parseNeatnessFallback(response, metrics, sourceType, parsedGrowthTip);
    }

    if (rubric && (rubric.score !== undefined)) {
        return { quickRubric: rubric };
    }
    return null;
}

