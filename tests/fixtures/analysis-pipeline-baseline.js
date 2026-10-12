async function analyzeWriting() {
    if (isAnalyzing) return;
    var text = document.getElementById("studentWriting").value.trim();
    var policy = captureAssessmentPolicy();
    var targetWords = policy.targetWords;
    var model = policy.model;
    var gradeProfile = policy.gradeProfile;
    if (!text && !(selectedImages && selectedImages.length)) {
        alert("Please paste student writing first.");
        return;
    }

    var btn = document.getElementById("analyzeBtn");
    var stopBtn = document.getElementById("stopAnalysisBtn");
    isAnalyzing = true;
    cancelAnalysis = false;
    analysisAbortController = new AbortController();
    syncSelectedImageState();
    var context = { input: captureCurrentWritingContext(), policy: policy, cancelled: false };
    activeAnalysisContext = context;
    btn.disabled = true;
    btn.classList.remove('pulse-ready');  // Stop pulse during analysis
    setLoadingButtonState(btn, true, "Analyzing...");
    setLoadingButtonState(stopBtn, false);
    stopBtn.textContent = 'Stop Analysis';
    stopBtn.disabled = false;

    try {
        if (!text) {
            text = String(await extractTextFromSelectedImage(true) || "").trim();
            assertCurrentAnalysisContext(context);
            if (!text) {
                alert("Please paste student writing first.");
                return;
            }
            document.getElementById("studentWriting").value = text;
            context.input.writingText = text;
        }
        assertCurrentAnalysisContext(context);
        originalTextForDiff = context.input.writingText;
        var actualWords = countWords(text);
        var writingGenreInfo = getWritingGenreInfoFromUi(text);
        currentWritingGenreInfo = writingGenreInfo;
        updateGenreReviewBox();
        var sampleStatus = getSampleStatusData(text, gradeProfile);

        if (sampleStatus.status !== "scorable") {
            var lowSample = buildLowSampleAnalysis(text, sampleStatus);
            latestAnalysisData = {
                inputContext: context.input,
                assessmentPolicy: policy,
                overall: null,
                gradeLevel: gradeProfile.grade,
                gradeLabel: gradeProfile.gradeLabel || gradeProfile.label,
                gradeTier: gradeProfile.tier,
                gradeProfileVersion: GRADE_PROFILE_VERSION,
                actualWords: actualWords,
                targetWords: targetWords,
                categoryScores: lowSample.categoryScores,
                quickRubric: lowSample.quickRubric,
                detailed: lowSample.detailed,
                correctedStory: text,
                writingGenre: writingGenreInfo,
                sampleStatus: sampleStatus,
                flowData: null,
                wordCountAdjustment: null,
                categoryEligibility: null
            };

            ensureNotebookGuide(latestAnalysisData, text);
        updateScoreDisplay(latestAnalysisData);
            setWftSanitizedInnerHtml("correctedStory", renderCorrected(text, text));
            // quickRubric display removed
            renderDetailedAssessment(lowSample.detailed);
            renderTeacherAuditView(latestAnalysisData);
            document.getElementById("step1Raw").textContent = "Low-sample coaching mode used. Full AI rubric scoring was skipped because the sample was too short for a fair score.";
            document.getElementById("step3Raw").textContent = JSON.stringify({ sampleStatus: sampleStatus, mode: "low-sample-coaching" }, null, 2);
            document.getElementById("grammarCalc").innerHTML = '<div class="assessment-item">Full grammar density scoring is hidden until there is enough writing to score fairly.</div>';
            document.getElementById("debugRaw").textContent =
                "Overview:\n" +
                "Sample status: " + sampleStatus.label + "\n" +
                "Reason: " + sampleStatus.reason + "\n" +
                "Target words: " + (targetWords > 0 ? targetWords : "Off") + " | Actual words: " + actualWords + "\n" +
                "Sentences: " + sampleStatus.sentenceCount + "\n\n" +
                "Low-sample analysis:\n" + JSON.stringify(lowSample, null, 2);
            try { saveCurrentSessionToPortfolio(latestAnalysisData); } catch (ePortfolioLowSample) {
                wftDebugError('Could not prepare low-sample portfolio sync:', ePortfolioLowSample);
                setDriveSyncStatus('error', 'Could not prepare portfolio sync');
                updateSyncPortfolioButtonState();
            }
            return;
        }

        var step1Prompt = buildStep1Prompt(text, gradeProfile);
        var step1 = await callOpenRouter(model, step1Prompt);
        assertCurrentAnalysisContext(context);
        var parsed1 = parseStep1(step1, text, targetWords);

        var correctedText = parsed1.correctedStory || text;
        parsed1.errorCounts.grammar = countBoldedSegments(correctedText);
        parsed1.errorCounts.punctuation = 0;
        parsed1.errorCounts.spelling = 0;
        var correctedPlainText = stripCorrectionMarkdown(correctedText);
        var correctedSentences = splitSentences(correctedPlainText);
        var flowData = analyzeSentenceVariety(getSentenceLengths(correctedPlainText), correctedSentences);
        parsed1.sentenceCount = flowData.sentenceCount;
        parsed1.wordsPerSentence = flowData.average ? flowData.average.toFixed(1) + " words each" : "";
        parsed1.varietyScore = flowData.varietyScore;
        parsed1.flowRating = flowData.flowRating;
        parsed1.flowTip = buildComputedFlowTip(flowData);

        var step2Prompt = buildStep2Prompt(text, correctedText, targetWords, actualWords, gradeProfile, writingGenreInfo);
        var step2 = await callOpenRouter(model, step2Prompt);
        assertCurrentAnalysisContext(context);
        parsed1.quickRubric = parseStep2QuickRubric(step2, text, targetWords);
        var eligibility = getCategoryEligibility(sampleStatus);
        applyEligibilityToQuickRubric(parsed1.quickRubric, eligibility);

        // If neatness is enabled and we have an image, do image-based neatness assessment.
        // Store it separately until after Step 3 parsing so the parser cannot overwrite the sub-scores.
        var pendingNeatnessDetail = null;
        if (shouldAssessNeatness() && selectedImageDataUrl) {
            var neatnessResult = await assessNeatnessFromImage(selectedImageDataUrl, model);
            assertCurrentAnalysisContext(context);
            if (neatnessResult) {
                parsed1.quickRubric["Neatness"] = neatnessResult.quickRubric;
                var nqr = neatnessResult.quickRubric || {};
                pendingNeatnessDetail = {
                    score: nqr.score,
                    evidence: nqr.reason || "",
                    growthTip: nqr.growthTip || "",
                    subScores: nqr.subScores || null,
                    sourceType: nqr.sourceType || "",
                    notAssessedReason: nqr.notAssessedReason || "",
                    scoreBasis: nqr.scoreBasis || "",
                    contentOrganization: "",
                    sentenceVariety: "",
                    rawBody: ""
                };
            }
        }

        var quickRubricText = buildQuickRubricText(parsed1.quickRubric);
        var notebookGuidePriorities = buildNotebookGuidePriorities({
            categoryScores: Object.fromEntries(Object.keys(parsed1.quickRubric).map(function(key) {
                return [key, parsed1.quickRubric[key].score];
            })),
            flowData: flowData
        });
        var step3Prompt = buildStep3Prompt(correctedText, quickRubricText, flowData, targetWords, actualWords, gradeProfile, writingGenreInfo, text, notebookGuidePriorities);
        var step3 = await callOpenRouter(model, step3Prompt);
        assertCurrentAnalysisContext(context);
        var detailed = parseDetailedAssessment(step3, text, writingGenreInfo);
        detailed.writingGenre = writingGenreInfo;
        if (detailed.keepWriting) detailed.keepWriting = sanitizeGenreReferenceInFeedback(detailed.keepWriting, writingGenreInfo);
        if (pendingNeatnessDetail) {
            detailed.categories["Neatness"] = pendingNeatnessDetail;
        }

        var adjustment = applyWordCountToIdeas(parsed1, detailed, actualWords, targetWords, gradeProfile);
        applyComputedFlowToFlow(parsed1, detailed, flowData);
        applyOrganizationFallback(parsed1, detailed, eligibility);

        var correctedWordCount = countWords((parsed1.correctedStory || "").replace(/\*\*/g, ""));
        if (!correctedWordCount) correctedWordCount = countWords(text);
        var totalErrors = parsed1.errorCounts.grammar + parsed1.errorCounts.punctuation + parsed1.errorCounts.spelling;
        var errorDensity = correctedWordCount ? (totalErrors / correctedWordCount) * 100 : 0;
        var grammarScore = grammarDensityBand(errorDensity, gradeProfile);

        parsed1.quickRubric["Grammar"] = parsed1.quickRubric["Grammar"] || { score: grammarScore, reason: softFallback("Grammar", actualWords, targetWords) };
        parsed1.quickRubric["Grammar"].score = eligibility["Grammar"] ? grammarScore : null;

        if (!detailed.categories["Grammar"]) {
            detailed.categories["Grammar"] = {
                score: eligibility["Grammar"] ? grammarScore : null,
                evidence: "Grammar patterns in the piece still need support.",
                growthTip: "Slow down and check verb tense and sentence correctness before you finish.",
                contentOrganization: "",
                sentenceVariety: ""
            };
        } else {
            detailed.categories["Grammar"].score = eligibility["Grammar"] ? grammarScore : null;
        }
        if (detailed.categories["Grammar"]) {
            detailed.categories["Grammar"].scoreBasis = buildGrammarScoreBasis(totalErrors, correctedWordCount, errorDensity);
            detailed.categories["Grammar"].totalErrors = totalErrors;
            detailed.categories["Grammar"].wordCount = correctedWordCount;
            detailed.categories["Grammar"].errorDensity = errorDensity;
            detailed.categories["Grammar"].patternNotes = buildGrammarPatternNotes(grammarScore, text, parsed1.correctedStory || correctedText || text);
        }

        // Use dynamic category keys to include Neatness if present
        var activeKeys = getActiveCategoryKeys();
        for (var inheritIndex = 0; inheritIndex < activeKeys.length; inheritIndex++) {
            var inheritKey = activeKeys[inheritIndex];
            if (!detailed.categories[inheritKey] && parsed1.quickRubric[inheritKey]) {
                var qr = parsed1.quickRubric[inheritKey];
                if (inheritKey === "Neatness") {
                    // For Neatness the quick rubric 'reason' is an observation (evidence),
                    // and 'growthTip' is the separate actionable tip from the image prompt.
                    detailed.categories[inheritKey] = {
                        score: qr.score,
                        evidence: qr.reason || "",
                        growthTip: qr.growthTip || "",
                        contentOrganization: "",
                        sentenceVariety: "",
                        rawBody: "",
                        subScores: qr.subScores || null,
                        sourceType: qr.sourceType || "",
                        notAssessedReason: qr.notAssessedReason || "",
                        scoreBasis: qr.scoreBasis || ""
                    };
                } else {
                    detailed.categories[inheritKey] = {
                        score: qr.score,
                        evidence: "",
                        growthTip: qr.reason || "",
                        contentOrganization: "",
                        sentenceVariety: "",
                        rawBody: ""
                    };
                }
            }
        }

        // Inherit absent categories before eligibility creates unscored display placeholders.
        applyEligibilityToDetailed(detailed, eligibility);
        polishFeedback(parsed1.quickRubric, detailed, text, parsed1.correctedStory, flowData);

        for (var i = 0; i < CATEGORY_KEYS.length; i++) {
            var key = CATEGORY_KEYS[i];
            if (!parsed1.quickRubric[key] || !parsed1.quickRubric[key].reason) {
                var dKey = detailed.categories[key];
                parsed1.quickRubric[key] = {
                    score: dKey ? dKey.score : null,
                    reason: dKey && dKey.growthTip ? dKey.growthTip : getEvidenceNote(key)
                };
            }
        }

        // Organization fallback (structure/sequencing - AI-driven, helper fills if missing)
        if (!detailed.categories["Organization"]) {
            var orgQuick = parsed1.quickRubric["Organization"] || { score: null, reason: getEvidenceNote("Organization") };
            detailed.categories["Organization"] = {
                score: eligibility["Organization"] ? orgQuick.score : null,
                evidence: "The writing presents ideas in a sequence the reader can follow.",
                growthTip: orgQuick.reason || "Try adding transition words to connect your ideas in a clearer order.",
                contentOrganization: "The events stay in a clear, logical order.",
                sentenceVariety: "",
                rawBody: ""
            };
        }

        // Spelling & Punctuation fallback (core category - always needs an entry)
        if (!detailed.categories["Spelling & Punctuation"]) {
            var spellQuick = parsed1.quickRubric["Spelling & Punctuation"] || { score: null, reason: getEvidenceNote("Spelling & Punctuation") };
            detailed.categories["Spelling & Punctuation"] = {
                score: eligibility["Spelling & Punctuation"] ? spellQuick.score : null,
                evidence: "Spelling and punctuation were reviewed in this piece.",
                growthTip: spellQuick.reason || "Check your spelling and punctuation carefully before finishing your work.",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }

        // Flow fallback (sentence rhythm - computed support applied above by applyComputedFlowToFlow)
        if (!detailed.categories["Flow"]) {
            var flowQuick = parsed1.quickRubric["Flow"] || { score: null, reason: getEvidenceNote("Flow") };
            detailed.categories["Flow"] = {
                score: eligibility["Flow"] ? flowQuick.score : null,
                evidence: "The sentence patterns in this writing contribute to the overall rhythm.",
                growthTip: parsed1.flowTip || "Try mixing short and longer sentences for smoother flow.",
                contentOrganization: "",
                sentenceVariety: "",
                flowPattern: buildFlowPatternSummary(flowData),
                patternNotes: buildFlowPatternNotes(flowData),
                rawBody: ""
            };
        } else {
            detailed.categories["Flow"].sentenceVariety = "";
            detailed.categories["Flow"].flowPattern = detailed.categories["Flow"].flowPattern || buildFlowPatternSummary(flowData);
            detailed.categories["Flow"].patternNotes = detailed.categories["Flow"].patternNotes || buildFlowPatternNotes(flowData);
            if (!detailed.categories["Flow"].growthTip) detailed.categories["Flow"].growthTip = parsed1.flowTip;
        }

        var categoryScores = {
            "Ideas & Details": eligibility["Ideas & Details"] ? (detailed.categories["Ideas & Details"] ? detailed.categories["Ideas & Details"].score : parsed1.quickRubric["Ideas & Details"].score) : null,
            "Grammar": eligibility["Grammar"] ? (detailed.categories["Grammar"] ? detailed.categories["Grammar"].score : grammarScore) : null,
            "Word Choice": eligibility["Word Choice"] ? (detailed.categories["Word Choice"] ? detailed.categories["Word Choice"].score : parsed1.quickRubric["Word Choice"].score) : null,
            "Organization": eligibility["Organization"] ? (detailed.categories["Organization"] ? detailed.categories["Organization"].score : parsed1.quickRubric["Organization"] ? parsed1.quickRubric["Organization"].score : null) : null,
            "Flow": eligibility["Flow"] ? (detailed.categories["Flow"] ? detailed.categories["Flow"].score : parsed1.quickRubric["Flow"] ? parsed1.quickRubric["Flow"].score : null) : null,
            "Spelling & Punctuation": eligibility["Spelling & Punctuation"] ? (detailed.categories["Spelling & Punctuation"] ? detailed.categories["Spelling & Punctuation"].score : parsed1.quickRubric["Spelling & Punctuation"] ? parsed1.quickRubric["Spelling & Punctuation"].score : null) : null
        };
        if (shouldAssessNeatness()) {
            categoryScores["Neatness"] = detailed.categories["Neatness"] ? detailed.categories["Neatness"].score : (parsed1.quickRubric["Neatness"] ? parsed1.quickRubric["Neatness"].score : null);
        }
        var overall = computeOverallScore(categoryScores, gradeProfile);
        var goalPlan = getGoalPlan({ categoryScores: categoryScores, detailed: detailed });
        detailed.growGoal = goalPlan.growGoal;
        detailed.nextTime = goalPlan.nextTime;

        assertCurrentAnalysisContext(context);
        latestAnalysisData = {
            inputContext: context.input,
            assessmentPolicy: policy,
            overall: overall,
            gradeLevel: gradeProfile.grade,
            gradeLabel: gradeProfile.gradeLabel || gradeProfile.label,
            gradeTier: gradeProfile.tier,
            gradeProfileVersion: GRADE_PROFILE_VERSION,
            actualWords: actualWords,
            targetWords: targetWords,
            categoryScores: categoryScores,
            quickRubric: parsed1.quickRubric,
            detailed: detailed,
            correctedStory: parsed1.correctedStory || text,
            writingGenre: writingGenreInfo,
            sampleStatus: sampleStatus,
            flowData: flowData,
            wordCountAdjustment: adjustment,
            categoryEligibility: eligibility,
            grammarAudit: {
                totalErrors: totalErrors,
                correctedWordCount: correctedWordCount,
                errorDensity: errorDensity,
                grammarScore: grammarScore
            }
        };

        ensureNotebookGuide(latestAnalysisData, text);
        updateScoreDisplay(latestAnalysisData);

        setWftSanitizedInnerHtml("correctedStory", renderCorrected(text, parsed1.correctedStory || text));
            // quickRubric display removed
        renderDetailedAssessment(detailed);
        renderTeacherAuditView(latestAnalysisData);
        try { saveCurrentSessionToPortfolio(latestAnalysisData); } catch (ePortfolio) {
            wftDebugError('Could not prepare portfolio sync:', ePortfolio);
            setDriveSyncStatus('error', 'Could not prepare portfolio sync');
            updateSyncPortfolioButtonState();
        }

        var bandText = "18.1 or higher = 1";
        if (grammarScore === 7) bandText = "0 - 2 = 7";
        else if (grammarScore === 6) bandText = "2.1 - 4 = 6";
        else if (grammarScore === 5) bandText = "4.1 - 6 = 5";
        else if (grammarScore === 4) bandText = "6.1 - 9 = 4";
        else if (grammarScore === 3) bandText = "9.1 - 13 = 3";
        else if (grammarScore === 2) bandText = "13.1 - 18 = 2";

        document.getElementById("step1Raw").textContent = step1 + "\n\n--- Step 2 (Quick Rubric) ---\n" + step2;
        document.getElementById("step3Raw").textContent = step3;
        document.getElementById("grammarCalc").innerHTML = formatGrammarCalc({
            grammarErrors: parsed1.errorCounts.grammar,
            punctuationErrors: parsed1.errorCounts.punctuation,
            spellingErrors: parsed1.errorCounts.spelling,
            totalErrors: totalErrors,
            wordCount: correctedWordCount,
            errorDensity: errorDensity,
            bandText: bandText,
            grammarScore: grammarScore,
            targetWords: targetWords,
            actualWords: actualWords,
            shortfallRatio: adjustment.shortfallRatio,
            multiplier: adjustment.multiplier,
            ideasNote: adjustment.note
        });
        var overviewLines = [];
        overviewLines.push("Sample status: " + sampleStatus.label + " | " + sampleStatus.reason);
        overviewLines.push("Target words: " + (targetWords > 0 ? targetWords : "Off") + " | Actual words: " + actualWords);
        if (parsed1.sentenceCount != null) overviewLines.push("Sentences: " + parsed1.sentenceCount + (parsed1.wordsPerSentence ? " | Avg length: " + parsed1.wordsPerSentence : ""));
        overviewLines.push("Errors found: " + totalErrors + " bolded correction segments");
        if (flowData && flowData.sentenceCount) {
            overviewLines.push("Flow: " + flowData.flowRating + " | Sentence Variety Pattern: " + flowData.varietyLabel + " (" + flowData.varietyScore + "/100)");
            overviewLines.push("Sentence pattern: " + flowData.bandSummary + " | Shortest: " + flowData.shortest + " | Longest: " + flowData.longest);
            overviewLines.push(flowData.starterSummary + " | Longest short-sentence run: " + flowData.shortRun);
        }

        document.getElementById("debugRaw").textContent =
            "Overview:\n" + overviewLines.join("\n") + "\n\n" +
            "Model: " + model + "\n\n" +
            "Parsed Step 1:\n" + JSON.stringify(parsed1, null, 2) + "\n\n" +
            "Raw Step 2:\n" + step2 + "\n\n" +
            "Parsed Step 3:\n" + JSON.stringify(detailed, null, 2) + "\n\n" +
            "Sample status data:\n" + JSON.stringify(sampleStatus, null, 2) + "\n\n" +
            "Category eligibility:\n" + JSON.stringify(eligibility, null, 2) + "\n\n" +
            "Category scores used for overall score:\n" + JSON.stringify(categoryScores, null, 2) + "\n\n" +
            "Overall score formula check:\n" +
            "10 = 100, 9 = 90, 8 = 80, 7 = 70, 6 = 60, 5 = 50, 4 = 40, then average only scored categories and round.\n\n" +
            "Word count adjustment:\n" + JSON.stringify(adjustment, null, 2);

    } catch (e) {
        if (activeAnalysisContext !== context) return;
        if (e.message === "Analysis cancelled by user.") {
            document.getElementById("debugRaw").textContent = "Analysis stopped by user.";
            showTeacherReview();
        } else if (!isCurrentWritingContext(context.input)) {
            document.getElementById("debugRaw").textContent = "Writing changed. Analyze the current writing again.";
            alert("Writing changed. Analyze the current writing again.");
            showTeacherReview();
        } else if (JSON.stringify(context.policy) !== JSON.stringify(captureAssessmentPolicy())) {
            document.getElementById("debugRaw").textContent = "Assessment settings changed. Analyze the current writing again.";
            alert("Assessment settings changed. Analyze the current writing again.");
            showTeacherReview();
        } else {
            document.getElementById("debugRaw").textContent = "Error:\n" + e.message;
            alert("Analysis failed. See Debug for details.");
            showTeacherReview();
        }
    } finally {
        if (activeAnalysisContext !== context) return;
        activeAnalysisContext = null;
        isAnalyzing = false;
        cancelAnalysis = false;
        analysisAbortController = null;
        var thinking = document.getElementById("thinking");
        if (thinking) thinking.classList.remove("show");
        setLoadingButtonState(btn, false);
        var stopBtnFinal = document.getElementById("stopAnalysisBtn");
        if (stopBtnFinal) {
            setLoadingButtonState(stopBtnFinal, false);
            stopBtnFinal.disabled = true;
        }
        syncUiState();
    }
}
