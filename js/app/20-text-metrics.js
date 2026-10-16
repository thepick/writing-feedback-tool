/* =============================================================================
   Text metrics cluster - word count, sentence variety, grammar density, overall
   score. Extracted from 10-main-app.js (decompose-20261016). Classic script;
   global function names unchanged, loaded before 10-main-app.js.
   ============================================================================= */
function countWords(text) {
    var cleaned = (text || "").trim();
    if (!cleaned) return 0;
    var parts = cleaned.match(/\b[\w'-]+\b/g);
    return parts ? parts.length : 0;
}


function countBoldedSegments(text) {
    var matches = String(text || "").match(/\*\*[^*\n]+\*\*/g);
    return matches ? matches.length : 0;
}

function stripCorrectionMarkdown(text) {
    if (!text) return "";
    var cleaned = String(text).replace(/\*\*/g, "");
    cleaned = cleaned.replace(/[`_~]/g, "");
    cleaned = cleaned.replace(/[\u2018\u2019]/g, "'");
    cleaned = cleaned.replace(/[\u201C\u201D]/g, '"');
    return cleaned;
}

function splitSentences(text) {
    var cleaned = stripCorrectionMarkdown(text || "").replace(/\r\n?|\n/g, " ").trim();
    if (!cleaned) return [];
    return cleaned
    .replace(/([.!?]["']?)\s+/g, "$1|")
        .split("|")
        .map(function(s) { return s.trim(); })
        .filter(function(s) { return s.length > 0; });
}

function getSentenceLengths(text) {
    var sentences = splitSentences(text);
    var lengths = [];
    for (var i = 0; i < sentences.length; i++) {
        var words = sentences[i].match(/\b[\w'-]+\b/g);
        if (words && words.length) lengths.push(words.length);
    }
    return lengths;
}

function analyzeSentenceStarters(sentences) {
    var counts = Object.create(null);
    for (var i = 0; i < sentences.length; i++) {
        var words = sentences[i].match(/\b[\w'-]+\b/g);
        if (!words || !words.length) continue;
        var starter = words[0].toLowerCase();
        counts[starter] = (counts[starter] || 0) + 1;
    }

    var maxStarter = 0;
    var mostCommon = "";
    for (var key in counts) {
        if (Object.prototype.hasOwnProperty.call(counts, key) && counts[key] > maxStarter) {
            maxStarter = counts[key];
            mostCommon = key;
        }
    }

    return {
        mostCommonStarter: mostCommon,
        count: maxStarter,
        ratio: sentences.length ? maxStarter / sentences.length : 0
    };
}

function getShortSentenceRun(lengths) {
    var longest = 0;
    var current = 0;
    for (var i = 0; i < lengths.length; i++) {
        current = lengths[i] <= 7 ? current + 1 : 0;
        if (current > longest) longest = current;
    }
    return longest;
}

function analyzeSentenceVariety(lengths, sentences) {
    var total = lengths.length;
    if (!total) {
        return {
            sentenceCount: 0,
            average: 0,
            shortest: 0,
            longest: 0,
            shortCount: 0,
            mediumCount: 0,
            longCount: 0,
            varietyScore: 0,
            varietyLabel: "No data",
            bandSummary: "No sentence data",
            starterSummary: "No sentence data",
            starterInfo: { mostCommonStarter: "", count: 0, ratio: 0 },
            shortRun: 0,
            flowRating: "No data"
        };
    }

    var shortCount = 0;
    var mediumCount = 0;
    var longCount = 0;
    var sum = 0;
    var minLen = Infinity;
    var maxLen = 0;

    for (var i = 0; i < total; i++) {
        var len = lengths[i];
        sum += len;
        if (len < minLen) minLen = len;
        if (len > maxLen) maxLen = len;
        if (len <= 7) shortCount += 1;
        else if (len <= 14) mediumCount += 1;
        else longCount += 1;
    }

    var average = sum / total;
    var starterInfo;
    var shortRun;
    var score = getSentenceVarietyScore();

    var varietyLabel = "Limited";
    if (score >= 85) varietyLabel = "Strong";
    else if (score >= 65) varietyLabel = "Good";
    else if (score >= 45) varietyLabel = "Developing";

    var flowRating = "Needs Improvement";
    if (average >= 12 && score >= 65) flowRating = "Very Good";
    else if (average >= 9 && score >= 65) flowRating = "Good";
    else if (average >= 9 || score >= 45) flowRating = "Developing";

    if (starterInfo.ratio > 0.5 && flowRating === "Good") flowRating = "Developing";
    if (starterInfo.ratio > 0.6) flowRating = "Needs Improvement";
    if (shortRun >= 4 && flowRating === "Good") flowRating = "Developing";
    if (shortRun >= 6) flowRating = "Needs Improvement";

    var starterSummary = "Starter variety looks balanced.";
    if (starterInfo.count > 0) {
        starterSummary = 'Most common starter "' + starterInfo.mostCommonStarter + '" appears ' + starterInfo.count + ' time';
        if (starterInfo.count !== 1) starterSummary += 's';
        starterSummary += ' (' + Math.round(starterInfo.ratio * 100) + '%).';
    }

    return {
        sentenceCount: total,
        average: average,
        shortest: minLen,
        longest: maxLen,
        shortCount: shortCount,
        mediumCount: mediumCount,
        longCount: longCount,
        varietyScore: Math.round(score),
        varietyLabel: varietyLabel,
        bandSummary: 'Short: ' + shortCount + ' | Medium: ' + mediumCount + ' | Long: ' + longCount,
        starterSummary: starterSummary,
        starterInfo: starterInfo,
        shortRun: shortRun,
        flowRating: flowRating
    };

    function getSentenceVarietyScore() {
        var score = getDistributionScore();
        score += getLengthRangeScore();

        starterInfo = analyzeSentenceStarters(sentences || []);
        if (starterInfo.ratio > 0.6) score -= 20;
        else if (starterInfo.ratio > 0.5) score -= 10;

        shortRun = getShortSentenceRun(lengths);
        if (shortRun >= 6) score -= 20;
        else if (shortRun >= 4) score -= 10;

        if (score < 0) score = 0;
        if (score > 100) score = 100;
        return score;

        function getDistributionScore() {
            var bandsPresent = 0;
            if (shortCount > 0) bandsPresent += 1;
            if (mediumCount > 0) bandsPresent += 1;
            if (longCount > 0) bandsPresent += 1;

            var dominant = Math.max(shortCount, mediumCount, longCount);
            var dominantRatio = dominant / total;
            var score = 0;

            if (bandsPresent === 3) score += 35;
            else if (bandsPresent === 2) score += 22;
            else score += 8;

            if (dominantRatio <= 0.60) score += 35;
            else if (dominantRatio <= 0.75) score += 22;
            else score += 10;
            return score;
        }

        function getLengthRangeScore() {
            if (maxLen >= Math.max(1, minLen * 2)) return 30;
            else if (maxLen - minLen >= 5) return 20;
            else return 10;
        }
    }
}

function buildComputedFlowTip(flowData) {
    if (!flowData || !flowData.sentenceCount) {
        return "Try mixing short, medium, and longer sentences for smoother flow.";
    }
    var tips = [];
    if (flowData.starterInfo && flowData.starterInfo.ratio > 0.25) {
        var pct = Math.round(flowData.starterInfo.ratio * 100);
        tips.push('About ' + pct + '% of sentences start with "' + flowData.starterInfo.mostCommonStarter + '" - try starting some sentences with a time word, a detail, or a different subject instead.');
    }
    if (flowData.shortRun >= 4) {
        tips.push("Try combining some of the short sentences that are next to each other into one longer sentence.");
    }
    if (!tips.length && flowData.longCount === 0) {
        tips.push("Add one or two longer sentences to create a smoother rhythm.");
    } else if (!tips.length && flowData.shortCount === 0) {
        tips.push("Add a few shorter sentences to create contrast and rhythm.");
    }
    if (!tips.length && flowData.varietyScore < 65) {
        tips.push("Mix short, medium, and longer sentences to make the writing sound smoother.");
    }
    if (!tips.length) {
        tips.push("Keep mixing sentence lengths and openings to maintain smooth flow.");
    }
    return tips.slice(0, 2).join(" ");
}


function roundToNearestRubric(value) {
    var best = RUBRIC_OPTIONS[0];
    var smallest = Infinity;
    for (var i = 0; i < RUBRIC_OPTIONS.length; i++) {
        var diff = Math.abs(RUBRIC_OPTIONS[i] - value);
        if (diff < smallest) {
            smallest = diff;
            best = RUBRIC_OPTIONS[i];
        }
    }
    return clampRubricScore(best);
}

function calculateWordCountAdjustment(baseScore, actualWords, targetWords, optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile();
    var slightExceedRatio = typeof profile.slightExceedRatio === "number" ? profile.slightExceedRatio : 1.05;
    var meaningfulExceedRatio = typeof profile.meaningfulExceedRatio === "number" ? profile.meaningfulExceedRatio : 1.15;
    var slightBonus = 1.03;
    var meaningfulBonus = typeof profile.goingBeyondMultiplier === "number" ? profile.goingBeyondMultiplier : 1.08;
    var shortfallPenaltyFactor = typeof profile.shortfallPenaltyFactor === "number" ? profile.shortfallPenaltyFactor : 0.7;
    var shortfallFloor = typeof profile.shortfallFloor === "number" ? profile.shortfallFloor : 0.45;

    if (!targetWords || targetWords <= 0) {
        return { adjustedScore: baseScore, shortfallRatio: 0, multiplier: 1, bonusMultiplier: 1, goingBeyond: false, goingBeyondNote: "", penaltyRubricPoints: 0, note: "No target word count was set." };
    }
    if (actualWords >= targetWords) {
        var exceedRatio = actualWords / targetWords;
        var goingBeyond = exceedRatio >= slightExceedRatio;
        var goingBeyondMeaningful = exceedRatio >= meaningfulExceedRatio;
        var bonusMultiplier = 1;
        var goingBeyondNote = "";
        if (goingBeyondMeaningful) { bonusMultiplier = meaningfulBonus; goingBeyondNote = "You went well beyond the target word count - real dedication!"; }
        else if (goingBeyond) { bonusMultiplier = slightBonus; goingBeyondNote = "You exceeded the target word count - nice extra effort."; }
        var adjustedRaw = baseScore * bonusMultiplier;
        var adjustedScore = clampRubricScore(roundToNearestRubric(adjustedRaw));
        return { adjustedScore: adjustedScore, shortfallRatio: 0, multiplier: 1, bonusMultiplier: bonusMultiplier, goingBeyond: goingBeyond, goingBeyondNote: goingBeyondNote, penaltyRubricPoints: 0, note: goingBeyond ? "Target word count exceeded. Going Beyond bonus applied." : "Target word count met. No adjustments applied." };
    }
    var shortfallRatio = (targetWords - actualWords) / targetWords;
    var multiplier = 1 - (shortfallPenaltyFactor * Math.pow(shortfallRatio, 0.9));
    if (multiplier < shortfallFloor) multiplier = shortfallFloor;
    var adjustedRaw2 = baseScore * multiplier;
    var adjustedScore2 = clampRubricScore(roundToNearestRubric(adjustedRaw2));
    var penaltyRubricPoints = Math.max(0, baseScore - adjustedScore2);
    var note = "Writing is under the target word count, so Ideas and Details was softened by a grade-aware multiplier.";
    if (shortfallRatio < 0.1) note = "Writing is very close to the target word count, so the Ideas and Details adjustment is very small.";
    else if (shortfallRatio < 0.25) note = "Writing is somewhat below the target word count, so Ideas and Details received a small adjustment.";
    else if (shortfallRatio < 0.4) note = "Writing is clearly below the target word count, so Ideas and Details received a moderate adjustment.";
    else note = "Writing is far below the target word count, so Ideas and Details received a stronger adjustment.";
    return { adjustedScore: adjustedScore2, shortfallRatio: shortfallRatio, multiplier: multiplier, bonusMultiplier: 1, goingBeyond: false, goingBeyondNote: "", penaltyRubricPoints: penaltyRubricPoints, note: note };
}

function grammarDensityBand(density, optGradeProfile) {
    var s = parseInt(getGrammarStrictness(), 10) || 3;
    var profile = optGradeProfile || getGradeProfile();
    var fallbackTables = GRADE_PROFILES[5].grammarDensityTables;
    var tables = profile.grammarDensityTables || fallbackTables;
    var t = tables[s] || tables[3] || fallbackTables[3];
    if (density <= t[0]) return 10;
    if (density <= t[1]) return 9;
    if (density <= t[2]) return 8;
    if (density <= t[3]) return 7;
    if (density <= t[4]) return 6;
    if (density <= t[5]) return 5;
    return 4;
}

function computeOverallScore(categoryScores, optGradeProfile) {
    var weightedSum = 0;
    var totalWeight = 0;
    var gradeProfile = optGradeProfile || getGradeProfile();
    var neatnessActive = categoryScores && categoryScores["Neatness"] != null && shouldAssessNeatness();
    var neatnessWeight = neatnessActive ? getNeatnessWeight(gradeProfile) : 0;
    var nonNeatScale = 1 - neatnessWeight;
    for (var key in categoryScores) {
        if (!Object.prototype.hasOwnProperty.call(categoryScores, key)) continue;
        var rubric = String(categoryScores[key]);
        if (!SCORE_MAP.hasOwnProperty(rubric)) continue;
        var weight = key === "Neatness" ? neatnessWeight : getCategoryWeight(key, gradeProfile) * nonNeatScale;
        weightedSum += SCORE_MAP[rubric] * weight;
        totalWeight += weight;
    }
    if (!totalWeight) return null;
    return Math.round(weightedSum / totalWeight);
}
