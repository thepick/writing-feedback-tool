var students = [];
var selectedStudent = "";

function loadStudents() {
    try {
        students = JSON.parse(localStorage.getItem("wft_students") || "[]");
        if (!Array.isArray(students)) students = [];
    } catch (e) {
        students = [];
    }
    selectedStudent = localStorage.getItem("wft_selectedStudent") || "";
}

function saveStudents() {
    students = applyDeletionsToStudents(students, getDeletionsData());
    localStorage.setItem("wft_students", JSON.stringify(students));
    // ── WFT Sync V2: roster change marks settings dirty unless we are applying cloud data locally ──
    if (WFT_SYNC_ENGINE_V2 && !wftSuppressDirtyMarks) {
        markWftSettingsDirty("roster-change");
        scheduleWftCloudSync("roster-change");
    }
}

function switchTab(tab) {
    var toolShell = document.getElementById("toolShell");
    var adminPanel = document.getElementById("adminPanel");
    var portfolioPanel = document.getElementById("portfolioPanel");
    var toolBtn = document.getElementById("toolTabBtn");
    var portfolioBtn = document.getElementById("portfolioTabBtn");
    var adminBtn = document.getElementById("adminTabBtn");
    if (!toolShell || !adminPanel || !portfolioPanel || !toolBtn || !portfolioBtn || !adminBtn) return;
    if (tab !== "tool" && typeof clearActivePortfolioReassessmentState === "function") {
        clearActivePortfolioReassessmentState("navigated-away-from-tool");
    }

    adminPanel.classList.remove("active");
    portfolioPanel.classList.remove("active");
    toolShell.classList.remove("active");
    toolShell.classList.add("hidden");

    toolBtn.classList.remove("active");
    portfolioBtn.classList.remove("active");
    adminBtn.classList.remove("active");

    if (tab === "admin") {
        adminPanel.classList.add("active");
        adminBtn.classList.add("active");
    } else if (tab === "portfolio") {
        portfolioPanel.classList.add("active");
        portfolioBtn.classList.add("active");
        refreshPortfolioDropdown();
        renderStudentPortfolio();
    } else {
        toolShell.classList.remove("hidden");
        toolShell.classList.add("active");
        toolBtn.classList.add("active");
    }
}

function restoreActiveTab() {
    switchTab("tool");
}

function renderStudentList() {
    var list = document.getElementById('studentList');
    var count = document.getElementById('studentCount');
    if (!list || !count) return;
    list.innerHTML = '';
    students.forEach(function(name) {
        var li = document.createElement('li');
        li.className = 'student-item';
        li.innerHTML = '<button type="button" class="student-name-btn">' + escapeHtml(name) + '</button><button type="button" class="btn-delete">Delete</button>';
        var nameBtn = li.querySelector('.student-name-btn');
        var deleteBtn = li.querySelector('.btn-delete');
        if (nameBtn) {
            nameBtn.addEventListener('click', function() {
                openStudentPortfolio(name);
            });
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                removeStudent(name);
            });
        }
        list.appendChild(li);
    });
    count.textContent = students.length + (students.length === 1 ? ' student' : ' students');
    try { refreshPortfolioDropdown(); } catch (e) {}
}

function populateStudentDropdown() {
    var select = document.getElementById("studentSelect");
    if (!select) return;
    var currentValue = select.value || selectedStudent || "";
    select.innerHTML = '<option value="">-- Choose a student --</option>';
    students.forEach(function(name) {
        var option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
    if (currentValue && students.indexOf(currentValue) !== -1) {
        select.value = currentValue;
        selectedStudent = currentValue;
    }
}

function updateSelectedStudent() {
    var select = document.getElementById("studentSelect");
    selectedStudent = select ? select.value : "";
    localStorage.setItem("wft_selectedStudent", selectedStudent);
    try { updateSyncPortfolioButtonState(); } catch (e) {}
}

function addStudent() {
    var input = document.getElementById("studentNameInput");
    if (!input) return;
    var name = String(input.value || "").trim();
    if (!name) {
        alert("Please enter a student name.");
        return;
    }
    var exists = students.some(function(s) { return s.toLowerCase() === name.toLowerCase(); });
    if (exists) {
        alert("That student is already in the list.");
        return;
    }
    clearStudentDeletion(name);
    students.push(name);
    students.sort(function(a, b) { return a.localeCompare(b); });
    saveStudents();
    renderStudentList();
    populateStudentDropdown();
    selectedStudent = name;
    localStorage.setItem("wft_selectedStudent", selectedStudent);
    var select = document.getElementById("studentSelect");
    if (select) select.value = name;
    input.value = "";
    input.focus();
}

function removeStudent(name) {
    if (!name) return;
    if (!window.confirm("Delete this student from the current class and portfolio? This student will not be restored from backups.")) return;

    recordStudentDeletion(name);

    students = students.filter(function(s) { return s !== name; });
    if (selectedStudent === name) {
        selectedStudent = "";
        localStorage.setItem("wft_selectedStudent", "");
    }

    var portfolio = getPortfolioData();
    if (portfolio && Object.prototype.hasOwnProperty.call(portfolio, name)) {
        delete portfolio[name];
    }

    savePortfolioData(portfolio);
    saveStudents();
    renderStudentList();
    populateStudentDropdown();
    try { refreshPortfolioDropdown(); } catch (e) { }
    try { renderStudentPortfolio(); } catch (e2) { }
}

function clearAllStudents() {
    if (!students.length) return;
    if (!window.confirm("Clear the entire student list?")) return;
    for (var i = 0; i < students.length; i += 1) {
        recordStudentDeletion(students[i]);
    }
    savePortfolioData({});
    students = [];
    selectedStudent = "";
    saveStudents();
    localStorage.setItem("wft_selectedStudent", "");
    renderStudentList();
    populateStudentDropdown();
}

function exportStudents() {
    if (!students.length) {
        alert("No students to export.");
        return;
    }
    var blob = new Blob([students.join("\n")], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "student-list.txt";
    a.click();
    URL.revokeObjectURL(url);
}

function importStudents(event) {
    var file = event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = String(e.target.result || "");
        var names = content.split(/\r?\n|,/).map(function(n) { return n.trim(); }).filter(function(n) { return n.length > 0; });
        var added = 0;
        names.forEach(function(name) {
            var exists = students.some(function(s) { return s.toLowerCase() === name.toLowerCase(); });
            if (!exists) {
                clearStudentDeletion(name);
                students.push(name);
                added += 1;
            }
        });
        students.sort(function(a, b) { return a.localeCompare(b); });
        saveStudents();
        renderStudentList();
        populateStudentDropdown();
        alert(added > 0 ? ("Added " + added + " new student(s).") : "No new students found in the file.");
    };
    reader.readAsText(file);
    event.target.value = "";
}

var EMBEDDED_API_KEY = "";
var API_KEY = EMBEDDED_API_KEY;
var DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";
var OCR_MODEL = "google/gemini-3.1-flash-lite-preview";
var selectedImages = [];
var selectedImageDataUrl = "";
var selectedImageName = "";
var selectedImageExtractedText = "";
var selectedImageExtractionPromise = null;
var previewDragIndex = -1;

var RUBRIC_MAX = 10;
var RUBRIC_MIN = 4;
var RUBRIC_OPTIONS = [10, 9, 8, 7, 6, 5, 4];
var SCORE_MAP = {
    "10": 100,
    "9": 90,
    "8": 80,
    "7": 70,
    "6": 60,
    "5": 50,
    "4": 40,
    "2": 20
};
var CATEGORY_KEYS = [
    "Ideas & Details",
    "Grammar",
    "Word Choice",
    "Organization",
    "Flow",
    "Spelling & Punctuation"
];

function clampRubricScore(score) {
    var n = Number(score);
    if (!isFinite(n)) return null;
    if (n > RUBRIC_MAX) return RUBRIC_MAX;
    if (n < RUBRIC_MIN) return RUBRIC_MIN;
    return n;
}

function parseRubricScore(raw) {
    var n = Number(raw);
    if (!isFinite(n)) return null;
    return RUBRIC_OPTIONS.indexOf(n) !== -1 ? n : null;
}

var isAnalyzing = false;
var cancelAnalysis = false;
var analysisAbortController = null;

var SAMPLE_STATUS_CONFIG = {
    insufficient: {
        label: "No scorable sample",
        minWords: 0
    },
    limited: {
        label: "Limited sample",
        minWords: 8
    },
    scorable: {
        label: "Scorable sample",
        minWords: 30
    }
};

// ── GRADE PROFILES ───────────────────────────────────────────────
// Grades 4-5 are defined directly. Grades 6-12 are built via makeGradeProfile()
// using tiered base blocks (Middle School 6-8, High School 9-12).

function parseGradeLevelValue(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n) || n < 4 || n > 12) return null;
    return n;
}

function mergeObjects(base, override) {
    var out = {};
    var k;
    base = base || {};
    override = override || {};
    for (k in base) {
        if (Object.prototype.hasOwnProperty.call(base, k)) {
            if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
                out[k] = mergeObjects(base[k], {});
            } else if (Array.isArray(base[k])) {
                out[k] = base[k].slice();
            } else {
                out[k] = base[k];
            }
        }
    }
    for (k in override) {
        if (Object.prototype.hasOwnProperty.call(override, k)) {
            if (override[k] && typeof override[k] === "object" && !Array.isArray(override[k]) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
                out[k] = mergeObjects(out[k], override[k]);
            } else if (Array.isArray(override[k])) {
                out[k] = override[k].slice();
            } else {
                out[k] = override[k];
            }
        }
    }
    return out;
}

var GRADE_PROFILE_VERSION = "2026-05-07-v1";
var GRADE_PROFILES = {};

GRADE_PROFILES[4] = {
    grade: 4,
    label: "Grade 4",
    gradeLabel: "Grade 4",
    audience: "4th-grade student",
    tier: "upper-elementary",
    feedbackTone: "simple, warm, concrete, and encouraging",
    expectedWriting: "short paragraphs with a clear topic, basic details, and mostly complete sentences",
    bilingualGuidance: "The student may be learning in a bilingual school. Correct unclear grammar, spelling, punctuation, and word choice, but do not over-penalize minor second-language phrasing if the meaning is clear. Do not translate the student's writing.",
    grammarStrictnessDefault: 2,
    grammarDensityTables: {1:[8,14,20,27,34,42],2:[6,11,17,23,29,36],3:[4,8,13,18,24,30],4:[3,6,10,14,19,24],5:[2,4,7,10,14,18]},
    targetWordCountBase: 120,
    targetWordCount: 120,
    targetWordCountRange: [40,500],
    sampleStatusMinWords: {limited:8, scorable:30},
    sampleStatusMinSentences: {scorable:2},
    wordRules: {insufficient:8, limited:8, scorable:30},
    strongWordFallbackMultiplier: 1.5,
    shortfallPenaltyFactor: 0.85,
    shortfallFloor: 0.50,
    goingBeyondMultiplier: 1.05,
    slightExceedRatio: 1.10,
    meaningfulExceedRatio: 1.20,
    neatnessWeight: 0.10,
    neatnessDefaultEnabled: true,
    weights: {"Ideas & Details":0.25,"Grammar":0.15,"Word Choice":0.10,"Organization":0.15,"Flow":0.10,"Spelling & Punctuation":0.25},
    categoryExpectations: {
        "Ideas & Details":"Look for a clear main idea and a few simple supporting details.",
        "Grammar":"Expect mostly complete sentences, but be lenient with developing sentence control.",
        "Word Choice":"Reward clear and specific words more than advanced vocabulary.",
        "Organization":"Look for a beginning, middle, and ending or a clear order of ideas.",
        "Flow":"Expect some repeated sentence starters; only lower the score if the writing is hard to follow.",
        "Spelling & Punctuation":"Focus on capitals, ending punctuation, and common grade-level spelling."
    },
    growGoalOptions:["Add More Details","Check My Verbs","Use Stronger Words","Mix Up My Sentences","Add Transition Words","Proofread for Spelling & Punctuation","Practice Handwriting"]
};

GRADE_PROFILES[5] = {
    grade: 5,
    label: "Grade 5",
    gradeLabel: "Grade 5",
    audience: "5th-grade student",
    tier: "upper-elementary",
    feedbackTone: "clear, warm, specific, and encouraging",
    expectedWriting: "a developed paragraph or short multi-paragraph response with clear details",
    bilingualGuidance: "The student may be learning in a bilingual school. Be supportive with English-language development. Correct unclear grammar, spelling, punctuation, and word choice, but do not over-penalize minor second-language phrasing if the meaning is clear. Do not translate the student's writing.",
    grammarStrictnessDefault: 3,
    grammarDensityTables: {1:[6,11,17,23,28,35],2:[4,8,13,18,22,27],3:[3,6,10,14,17,20],4:[2,4,7,10,13,16],5:[1,3,5,7,9,12]},
    targetWordCountBase: 200,
    targetWordCount: 200,
    targetWordCountRange: [50,800],
    sampleStatusMinWords: {limited:10, scorable:40},
    sampleStatusMinSentences: {scorable:3},
    wordRules: {insufficient:10, limited:10, scorable:40},
    strongWordFallbackMultiplier: 1.5,
    shortfallPenaltyFactor: 0.80,
    shortfallFloor: 0.48,
    goingBeyondMultiplier: 1.06,
    slightExceedRatio: 1.08,
    meaningfulExceedRatio: 1.18,
    neatnessWeight: 0.075,
    neatnessDefaultEnabled: true,
    weights: {"Ideas & Details":0.25,"Grammar":0.15,"Word Choice":0.12,"Organization":0.18,"Flow":0.10,"Spelling & Punctuation":0.20},
    categoryExpectations: {
        "Ideas & Details":"Look for a clear topic, relevant details, and enough development.",
        "Grammar":"Expect mostly correct sentences with reasonable control of verb tense and sentence structure.",
        "Word Choice":"Reward precise words and topic-specific vocabulary.",
        "Organization":"Look for logical order, grouping of ideas, and a clear beginning, middle, and end when appropriate.",
        "Flow":"Look for sentence variety, transitions, and smooth rhythm.",
        "Spelling & Punctuation":"Expect grade-appropriate spelling, capitals, commas when needed, and ending punctuation."
    },
    growGoalOptions:["Add More Details","Check My Verbs","Use Stronger Words","Mix Up My Sentences","Add Transition Words","Proofread for Spelling & Punctuation","Practice Handwriting"]
};

function makeGradeProfile(override) {
    if (!override || !override.grade) throw new Error("makeGradeProfile requires an override object with a grade value.");
    var grade = parseGradeLevelValue(override.grade);
    if (!grade) throw new Error("Invalid grade level for grade profile: " + override.grade);
    if (grade < 6) throw new Error("Grades 4 and 5 must be defined directly, not with makeGradeProfile.");
    var base;
    if (grade <= 8) {
        base = {
            grade: grade, label: "Grade " + grade, gradeLabel: "Grade " + grade, audience: grade + "th-grade student", tier: "middle-school",
            feedbackTone: "supportive, specific, and slightly more academic",
            expectedWriting: "organized paragraphs with clear development, logical structure, and more precise language",
            bilingualGuidance: "The student may be learning in a bilingual school. Correct grammar, spelling, punctuation, and word choice that affect clarity, but distinguish serious errors from minor second-language phrasing. Do not translate the student's writing.",
            grammarStrictnessDefault: 3,
            grammarDensityTables: {1:[5,10,15,20,25,31],2:[4,7,12,16,20,25],3:[3,5,8,12,15,18],4:[2,4,6,9,12,15],5:[1,2,4,6,8,11]},
            targetWordCountBase: 300, targetWordCount: 300, targetWordCountRange: [80,1200],
            sampleStatusMinWords: {limited:12, scorable:55}, sampleStatusMinSentences: {scorable:4}, wordRules: {insufficient:12, limited:12, scorable:55}, strongWordFallbackMultiplier: 1.5,
            shortfallPenaltyFactor: 0.70, shortfallFloor: 0.45, goingBeyondMultiplier: 1.08, slightExceedRatio: 1.05, meaningfulExceedRatio: 1.15,
            neatnessWeight: 0.05, neatnessDefaultEnabled: false,
            weights: {"Ideas & Details":0.25,"Grammar":0.15,"Word Choice":0.15,"Organization":0.20,"Flow":0.10,"Spelling & Punctuation":0.15},
            categoryExpectations: {"Ideas & Details":"Look for developed ideas with relevant examples or evidence.","Grammar":"Expect sentence boundaries, consistent tense, and mostly accurate sentence structure.","Word Choice":"Reward precise vocabulary and reduce credit for vague or repeated wording.","Organization":"Look for paragraph structure, logical sequencing, and transitions.","Flow":"Expect varied sentence openings and lengths.","Spelling & Punctuation":"Expect control of common punctuation and grade-level spelling."},
            growGoalOptions:["Add More Specific Evidence","Strengthen Topic Sentences","Improve Paragraph Organization","Use More Precise Vocabulary","Vary Sentence Openings","Add Stronger Transitions","Proofread for Grammar and Punctuation"]
        };
    } else {
        base = {
            grade: grade, label: "Grade " + grade, gradeLabel: "Grade " + grade, audience: grade + "th-grade student", tier: "high-school",
            feedbackTone: "constructive, direct, academic, and respectful",
            expectedWriting: "clear, organized writing with developed claims, relevant evidence, precise language, and control of conventions",
            bilingualGuidance: "The student may be learning in a bilingual school. Hold the student to grade-appropriate clarity and academic English expectations, but avoid punishing harmless second-language phrasing when meaning and structure are clear. Do not translate the student's writing.",
            grammarStrictnessDefault: 4,
            grammarDensityTables: {1:[4,8,12,16,20,25],2:[3,6,10,13,17,21],3:[2,5,8,11,14,17],4:[1,3,6,8,11,14],5:[1,2,4,6,8,11]},
            targetWordCountBase: 500, targetWordCount: 500, targetWordCountRange: [120,2000],
            sampleStatusMinWords: {limited:15, scorable:75}, sampleStatusMinSentences: {scorable:5}, wordRules: {insufficient:15, limited:15, scorable:75}, strongWordFallbackMultiplier: 1.4,
            shortfallPenaltyFactor: 0.55, shortfallFloor: 0.40, goingBeyondMultiplier: 1.10, slightExceedRatio: 1.03, meaningfulExceedRatio: 1.10,
            neatnessWeight: 0.00, neatnessDefaultEnabled: false,
            weights: {"Ideas & Details":0.30,"Grammar":0.15,"Word Choice":0.15,"Organization":0.20,"Flow":0.10,"Spelling & Punctuation":0.10},
            categoryExpectations: {"Ideas & Details":"Look for a clear claim or central idea, developed support, and relevant evidence.","Grammar":"Expect control of sentence structure, tense, agreement, and sentence boundaries.","Word Choice":"Reward precise, academic, and context-appropriate language.","Organization":"Look for strong paragraphing, logical progression, and effective transitions.","Flow":"Expect sentence variety, cohesion, and mature rhythm.","Spelling & Punctuation":"Expect accurate spelling, punctuation, and formatting suitable for academic writing."},
            growGoalOptions:["Strengthen Thesis / Central Claim","Integrate Text Evidence","Improve Paragraph Cohesion","Refine Tone & Voice","Develop Counterarguments","Use More Precise Academic Vocabulary","Improve Sentence Variety","Proofread for Grammar and Mechanics"]
        };
    }
    return mergeObjects(base, override || {});
}

GRADE_PROFILES[6] = makeGradeProfile({grade:6,label:"Grade 6",gradeLabel:"Grade 6",audience:"6th-grade student",targetWordCountBase:250,targetWordCount:250,targetWordCountRange:[80,1000],sampleStatusMinWords:{limited:10,scorable:50},sampleStatusMinSentences:{scorable:3},wordRules:{insufficient:10,limited:10,scorable:50}});
GRADE_PROFILES[7] = makeGradeProfile({grade:7,label:"Grade 7",gradeLabel:"Grade 7",audience:"7th-grade student",targetWordCountBase:300,targetWordCount:300,targetWordCountRange:[100,1200],sampleStatusMinWords:{limited:12,scorable:55},sampleStatusMinSentences:{scorable:4},wordRules:{insufficient:12,limited:12,scorable:55}});
GRADE_PROFILES[8] = makeGradeProfile({grade:8,label:"Grade 8",gradeLabel:"Grade 8",audience:"8th-grade student",targetWordCountBase:350,targetWordCount:350,targetWordCountRange:[100,1400],sampleStatusMinWords:{limited:12,scorable:60},sampleStatusMinSentences:{scorable:4},wordRules:{insufficient:12,limited:12,scorable:60}});
GRADE_PROFILES[9] = makeGradeProfile({grade:9,label:"Grade 9",gradeLabel:"Grade 9",audience:"9th-grade student",targetWordCountBase:400,targetWordCount:400,targetWordCountRange:[120,1600],sampleStatusMinWords:{limited:15,scorable:70},sampleStatusMinSentences:{scorable:5},wordRules:{insufficient:15,limited:15,scorable:70}});
GRADE_PROFILES[10] = makeGradeProfile({grade:10,label:"Grade 10",gradeLabel:"Grade 10",audience:"10th-grade student",targetWordCountBase:500,targetWordCount:500,targetWordCountRange:[150,1800],sampleStatusMinWords:{limited:15,scorable:75},sampleStatusMinSentences:{scorable:5},wordRules:{insufficient:15,limited:15,scorable:75}});
GRADE_PROFILES[11] = makeGradeProfile({grade:11,label:"Grade 11",gradeLabel:"Grade 11",audience:"11th-grade student",targetWordCountBase:600,targetWordCount:600,targetWordCountRange:[150,2200],sampleStatusMinWords:{limited:18,scorable:85},sampleStatusMinSentences:{scorable:6},wordRules:{insufficient:18,limited:18,scorable:85}});
GRADE_PROFILES[12] = makeGradeProfile({grade:12,label:"Grade 12",gradeLabel:"Grade 12",audience:"12th-grade student",targetWordCountBase:700,targetWordCount:700,targetWordCountRange:[150,2500],sampleStatusMinWords:{limited:18,scorable:90},sampleStatusMinSentences:{scorable:6},wordRules:{insufficient:18,limited:18,scorable:90}});

var wftStudentGradeLevelOverride = false;
var wftAssessmentSettingsOverrideActive = false;
var wftAssessmentOverrideGrammarStrictness = null;
var wftAssessmentOverrideTargetWordCount = null;

function getClassGradeLevel() {
    var el = document.getElementById("classGradeLevelSelect");
    var n = el ? parseGradeLevelValue(el.value) : null;
    return n || 5;
}
function formatGradeLevelLabel(value) {
    var n = parseGradeLevelValue(value) || 5;
    return "Grade " + n;
}
function getClassGradeLabel() {
    return formatGradeLevelLabel(getClassGradeLevel());
}
function getSelectedGradeLevel() {
    var classGrade = getClassGradeLevel() || 5;
    var el = document.getElementById("gradeLevelSelect");
    if (el && String(el.value) !== String(classGrade)) el.value = String(classGrade);
    return classGrade;
}
function syncStudentGradeToClassIfNeeded() {
    var studentSelect = document.getElementById("gradeLevelSelect");
    if (studentSelect) studentSelect.value = String(getClassGradeLevel());
    wftStudentGradeLevelOverride = false;
}
function getActiveGradeLevel() { return getClassGradeLevel() || 5; }
function getGradeProfile(optGrade) {
    var grade = optGrade != null ? parseGradeLevelValue(optGrade) : getActiveGradeLevel();
    return GRADE_PROFILES[grade] || GRADE_PROFILES[5];
}
function getGradeCategoryExpectation(category, optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile();
    if (profile.categoryExpectations && profile.categoryExpectations[category]) return profile.categoryExpectations[category];
    return "Score based on grade-level expectations for " + (profile.gradeLabel || profile.label || "Grade 5") + ".";
}
function getGradeGrowGoalListText(optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile();
    var goals = profile.growGoalOptions || GRADE_PROFILES[5].growGoalOptions;
    return goals.map(function(goal) { return "- " + goal; }).join("\n");
}
function getGradeProfileDescriptionText(profile) {
    return (profile.gradeLabel || profile.label) + " defaults: Grammar Strictness Level " + profile.grammarStrictnessDefault + ", Target word count " + (profile.targetWordCountBase || profile.targetWordCount) + " words.";
}
function refreshGradeProfileDescription() {
    var classProfile = getGradeProfile(getClassGradeLevel());
    var classDesc = document.getElementById("classGradeProfileDescription");
    if (classDesc) classDesc.textContent = getGradeProfileDescriptionText(classProfile);
    refreshAssessmentSettingsSummary();
}

function escapeAssessmentSummaryText(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function(ch) {
        return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch] || ch;
    });
}
function clampGrammarStrictness(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) n = 3;
    if (n < 1) n = 1;
    if (n > 5) n = 5;
    return n;
}
function formatGrammarStrictnessLabel(value) {
    return "Level " + clampGrammarStrictness(value);
}
function formatTargetWordCountLabel(value, enabled) {
    var n = parseInt(value, 10);
    if (enabled === false || isNaN(n) || n <= 0) return "Not used";
    return n + " words";
}
function getClassDefaultGrammarStrictness() {
    var fallback = 3;
    try {
        var profile = getGradeProfile(getClassGradeLevel());
        if (profile && profile.grammarStrictnessDefault != null) fallback = parseInt(profile.grammarStrictnessDefault, 10) || fallback;
    } catch (e) { }
    var el = document.getElementById("grammarStrictness");
    if (el && el.value !== "") return clampGrammarStrictness(el.value);
    return clampGrammarStrictness(fallback);
}
function getClassDefaultTargetWordCountValue() {
    var input = document.getElementById("targetWordCount");
    var value = input ? parseInt(input.value, 10) : 200;
    if (!isFinite(value) || value <= 0) value = 200;
    return value;
}
function isClassDefaultWordCountTargetEnabled() {
    var checkbox = document.getElementById("useWordCountTarget");
    return checkbox ? checkbox.checked !== false : true;
}
function getAssessmentOverrideTargetWordCountValue() {
    var value = parseInt(wftAssessmentOverrideTargetWordCount, 10);
    if (!isFinite(value) || value <= 0) value = getClassDefaultTargetWordCountValue();
    return value;
}
function isAssessmentOverrideActive() {
    return wftAssessmentSettingsOverrideActive === true;
}
function getEffectiveGrammarStrictnessValue() {
    if (isAssessmentOverrideActive() && wftAssessmentOverrideGrammarStrictness != null) {
        return clampGrammarStrictness(wftAssessmentOverrideGrammarStrictness);
    }
    return getClassDefaultGrammarStrictness();
}
function isEffectiveWordCountTargetEnabled() {
    if (isAssessmentOverrideActive()) return getAssessmentOverrideTargetWordCountValue() > 0;
    return isClassDefaultWordCountTargetEnabled();
}
function getEffectiveTargetWordCountValueForSettings() {
    if (isAssessmentOverrideActive()) return getAssessmentOverrideTargetWordCountValue();
    return getClassDefaultTargetWordCountValue();
}
function getCurrentAssessmentSettingsSnapshot() {
    var classGrade = getClassGradeLevel();
    var targetEnabled = isEffectiveWordCountTargetEnabled();
    var target = targetEnabled ? getEffectiveTargetWordCountValueForSettings() : 0;
    var strictness = getEffectiveGrammarStrictnessValue();
    return {
        classGradeLevel: classGrade,
        classGradeLabel: formatGradeLevelLabel(classGrade),
        gradeLevel: getActiveGradeLevel(),
        gradeLabel: formatGradeLevelLabel(getActiveGradeLevel()),
        grammarStrictness: strictness,
        grammarStrictnessLabel: formatGrammarStrictnessLabel(strictness),
        targetWordCount: target,
        targetWordCountLabel: formatTargetWordCountLabel(target, targetEnabled),
        useWordCountTarget: targetEnabled,
        assessmentOverrideActive: isAssessmentOverrideActive()
    };
}
function updateAssessmentOverrideDraftLabels() {
    var strictnessEl = document.getElementById("assessmentGrammarStrictnessOverride");
    var strictnessValEl = document.getElementById("assessmentGrammarStrictnessOverrideVal");
    if (strictnessEl && strictnessValEl) strictnessValEl.textContent = formatGrammarStrictnessLabel(strictnessEl.value);
}
function populateAssessmentOverrideControls() {
    var strictnessEl = document.getElementById("assessmentGrammarStrictnessOverride");
    var targetEl = document.getElementById("assessmentTargetWordCountOverride");
    var strictness = isAssessmentOverrideActive() && wftAssessmentOverrideGrammarStrictness != null ? wftAssessmentOverrideGrammarStrictness : getEffectiveGrammarStrictnessValue();
    var target = isAssessmentOverrideActive() && wftAssessmentOverrideTargetWordCount != null ? wftAssessmentOverrideTargetWordCount : getEffectiveTargetWordCountValueForSettings();
    if (strictnessEl) strictnessEl.value = String(clampGrammarStrictness(strictness));
    if (targetEl) targetEl.value = String(parseInt(target, 10) || getClassDefaultTargetWordCountValue());
    updateAssessmentOverrideDraftLabels();
}
function toggleAssessmentOverridePanel(forceOpen) {
    var panel = document.getElementById("assessmentOverridePanel");
    if (!panel) return;
    var shouldOpen = forceOpen === true ? true : (forceOpen === false ? false : panel.hidden);
    if (shouldOpen) populateAssessmentOverrideControls();
    panel.hidden = !shouldOpen;
}
function applyAssessmentOverrideSettings() {
    var strictnessEl = document.getElementById("assessmentGrammarStrictnessOverride");
    var targetEl = document.getElementById("assessmentTargetWordCountOverride");
    wftAssessmentOverrideGrammarStrictness = clampGrammarStrictness(strictnessEl ? strictnessEl.value : getClassDefaultGrammarStrictness());
    var target = targetEl ? parseInt(targetEl.value, 10) : getClassDefaultTargetWordCountValue();
    if (!isFinite(target) || target <= 0) target = getClassDefaultTargetWordCountValue();
    wftAssessmentOverrideTargetWordCount = target;
    wftAssessmentSettingsOverrideActive = true;
    toggleAssessmentOverridePanel(false);
    refreshAssessmentSettingsSummary();
    if (typeof updateMeter === "function") updateMeter();
    if (typeof syncUiState === "function") syncUiState();
}
function cancelAssessmentOverrideEdit() {
    toggleAssessmentOverridePanel(false);
}
function clearAssessmentOverrideSettings() {
    wftAssessmentSettingsOverrideActive = false;
    wftAssessmentOverrideGrammarStrictness = null;
    wftAssessmentOverrideTargetWordCount = null;
    toggleAssessmentOverridePanel(false);
    refreshAssessmentSettingsSummary();
    if (typeof updateMeter === "function") updateMeter();
    if (typeof syncUiState === "function") syncUiState();
}
function refreshAssessmentSettingsSummary() {
    var summary = document.getElementById("assessmentSettingsSummary");
    if (!summary) return;
    var settings = getCurrentAssessmentSettingsSnapshot();
    var intro = document.getElementById("assessmentSettingsIntro");
    if (intro) {
        intro.textContent = settings.assessmentOverrideActive
            ? "Using an individual adjustment for this assessment."
            : "Using class defaults from Manage Class.";
    }
    var toggleBtn = document.getElementById("assessmentOverrideToggleBtn");
    if (toggleBtn) toggleBtn.textContent = settings.assessmentOverrideActive ? "Edit adjustment" : "Adjust for this assessment";
    var clearBtn = document.getElementById("assessmentOverrideClearBtn");
    if (clearBtn) clearBtn.style.display = settings.assessmentOverrideActive ? "inline-flex" : "none";

    summary.innerHTML = ""
        + '<div class="assessment-default-item"><span class="assessment-default-label">Class Grade Level</span><span class="assessment-default-value">' + escapeAssessmentSummaryText(settings.classGradeLabel) + '</span></div>'
        + '<div class="assessment-default-item"><span class="assessment-default-label">Grammar Strictness</span><span class="assessment-default-value">' + escapeAssessmentSummaryText(settings.grammarStrictnessLabel) + '</span></div>'
        + '<div class="assessment-default-item"><span class="assessment-default-label">Target Word Count</span><span class="assessment-default-value">' + escapeAssessmentSummaryText(settings.targetWordCountLabel) + '</span></div>';
}
function applyGradeWordCountRange(optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile(getClassGradeLevel());
    if (!profile.targetWordCountRange) return;
    var input = document.getElementById("targetWordCount");
    if (input) {
        input.min = String(profile.targetWordCountRange[0]);
        input.max = String(profile.targetWordCountRange[1]);
    }
    var overrideInput = document.getElementById("assessmentTargetWordCountOverride");
    if (overrideInput) {
        overrideInput.min = String(profile.targetWordCountRange[0]);
        overrideInput.max = String(profile.targetWordCountRange[1]);
    }
}
function applyGradeDefaultTargetWordCount(optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile(getClassGradeLevel());
    var input = document.getElementById("targetWordCount");
    if (input) input.value = String(profile.targetWordCountBase || profile.targetWordCount || 200);
    applyGradeWordCountRange(profile);
}
function applyGradeDefaultStrictness(optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile(getClassGradeLevel());
    var el = document.getElementById("grammarStrictness");
    var valEl = document.getElementById("grammarStrictnessVal");
    if (el && profile.grammarStrictnessDefault) {
        el.value = String(profile.grammarStrictnessDefault);
        if (valEl) valEl.textContent = String(profile.grammarStrictnessDefault);
    }
}
function applyGradeDefaults() {
    var classProfile = getGradeProfile(getClassGradeLevel());
    clearAssessmentOverrideSettings();
    applyGradeDefaultStrictness(classProfile);
    applyGradeDefaultTargetWordCount(classProfile);
    refreshGradeProfileDescription();
    if (typeof updateGradeLevelResultNote === "function") updateGradeLevelResultNote();
    if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
    if (typeof syncUiState === "function") syncUiState();
    if (typeof markWftSettingsDirty === "function") markWftSettingsDirty("grade-defaults");
}
function onGradeLevelChanged(source) {
    syncStudentGradeToClassIfNeeded();
    if (source === "class") {
        var classProfile = getGradeProfile(getClassGradeLevel());
        clearAssessmentOverrideSettings();
        applyGradeDefaultStrictness(classProfile);
        applyGradeDefaultTargetWordCount(classProfile);
    }
    applyGradeWordCountRange();
    refreshGradeProfileDescription();
    if (typeof updateGradeLevelResultNote === "function") updateGradeLevelResultNote();
    if (typeof saveSettingsToLocalStorage === "function") saveSettingsToLocalStorage();
    if (typeof syncUiState === "function") syncUiState();
    if (typeof markWftSettingsDirty === "function") markWftSettingsDirty("grade-change-" + source);
}
function initializeGradeLevelFeature() {
    syncStudentGradeToClassIfNeeded();
    applyGradeWordCountRange();
    refreshGradeProfileDescription();
    populateAssessmentOverrideControls();
    if (typeof updateGradeLevelResultNote === "function") updateGradeLevelResultNote();
    if (typeof syncUiState === "function") syncUiState();
}



function hasSentenceEndingPunctuation(text) {
    var cleaned = stripCorrectionMarkdown(text || "").trim();
    if (!cleaned) return false;
    cleaned = cleaned.replace(/[\s"')\]}]+$/g, "");
    return /[.!?]$/.test(cleaned);
}

function hasCompleteClause(text) {
    var cleaned = stripCorrectionMarkdown(text || "").replace(/\r\n?|\n/g, " ").trim().toLowerCase();
    if (!cleaned) return false;
    var words = cleaned.match(/\b[a-z][a-z'\-]*\b/g);
    if (!words || words.length < 4) return false;

    var subjectPattern = /\b(i|you|he|she|it|we|they|my|our|the|a|an|this|that|these|those|there|students?|children|child|teacher|person|people|friend|family|boy|girl|dog|cat|animal|character|story)\b/;
    var verbPattern = /\b(am|is|are|was|were|be|being|been|have|has|had|do|does|did|can|could|will|would|shall|should|may|might|must|go|goes|went|make|makes|made|get|gets|got|see|sees|saw|look|looks|looked|think|thinks|thought|feel|feels|felt|say|says|said|write|writes|wrote|read|reads|run|runs|ran|walk|walks|walked|play|plays|played|learn|learns|learned|use|uses|used|want|wants|wanted|need|needs|needed|like|likes|liked|know|knows|knew)\b/;
    if (subjectPattern.test(cleaned) && verbPattern.test(cleaned)) return true;
    if (subjectPattern.test(cleaned) && /\b[a-z]+(ed|ing|s)\b/.test(cleaned)) return true;
    return words.length >= 12 && /\b[a-z]+(ed|ing)\b/.test(cleaned);
}

function getSampleStatusData(text, optGradeProfile) {
    var raw = String(text || "").trim();
    var profile = optGradeProfile || getGradeProfile();
    var wordRules = profile.sampleStatusMinWords || GRADE_PROFILES[5].sampleStatusMinWords;
    var sentenceRules = profile.sampleStatusMinSentences || GRADE_PROFILES[5].sampleStatusMinSentences;
    var wordCount = countWords(raw);
    var lines = raw ? raw.split(/\r?\n/).map(function(line) { return line.trim(); }).filter(function(line) { return line.length > 0; }) : [];
    var sentences = splitSentences(raw);
    var sentenceCount = sentences.length;
    if (sentenceCount === 0 && wordCount >= 8 && hasCompleteClause(raw) && hasSentenceEndingPunctuation(raw)) sentenceCount = 1;
    var hasEnding = hasSentenceEndingPunctuation(raw);
    var completeClause = hasCompleteClause(raw);
    var isListLike = /^[^.!?]*[,;:\-][^.!?]*$/.test(raw) && sentenceCount <= 1;
    var limitedMinWords = typeof wordRules.limited === "number" ? wordRules.limited : 10;
    var scorableMinWords = typeof wordRules.scorable === "number" ? wordRules.scorable : 40;
    var scorableMinSentences = typeof sentenceRules.scorable === "number" ? sentenceRules.scorable : 3;
    var strongFallbackMultiplier = typeof profile.strongWordFallbackMultiplier === "number" ? profile.strongWordFallbackMultiplier : 1.5;
    var strongWordFallback = wordCount >= Math.round(scorableMinWords * strongFallbackMultiplier);
    var status = "scorable";
    var reason = "Enough writing is present for a normal rubric score.";
    if (!raw || wordCount < limitedMinWords || (!hasEnding && !completeClause) || isListLike) {
        status = "insufficient";
        reason = "There is not enough connected writing yet for a fair full-rubric score.";
    } else if (wordCount < scorableMinWords || (sentenceCount < scorableMinSentences && !strongWordFallback)) {
        status = "limited";
        reason = "This sample shows a writing attempt, but there is still limited evidence for several rubric categories.";
    }
    return { status: status, label: SAMPLE_STATUS_CONFIG[status].label, reason: reason, wordCount: wordCount, sentenceCount: sentenceCount, hasSentenceEnding: hasEnding, hasCompleteClause: completeClause, lines: lines };
}

function getCategoryEligibility(statusData) {
    statusData = statusData || { status: "scorable", wordCount: 0, sentenceCount: 0, hasCompleteClause: false };
    var wordCount = statusData.wordCount || 0;
    var sentenceCount = statusData.sentenceCount || 0;
    var hasClause = !!statusData.hasCompleteClause;
    return {
        "Ideas & Details": wordCount >= 8,
        "Grammar": hasClause || sentenceCount >= 1,
        "Word Choice": wordCount >= 3,
        "Organization": sentenceCount >= 2 || wordCount >= 30,
        "Flow": sentenceCount >= 2 || wordCount >= 30,
        "Spelling & Punctuation": wordCount >= 1
    };
}


function getEvidenceLabel(score) {
    if (score == null || score === "") return "Missing";
    return String(score) + "/" + RUBRIC_MAX;
}





function getEvidenceNote(category) {
    if (category === "Organization") return "Not enough evidence yet to judge organization fairly.";
    if (category === "Flow") return "Not enough evidence yet to judge sentence flow fairly.";
    if (category === "Ideas & Details") return "Not enough writing yet to judge idea development fairly.";
    if (category === "Grammar") return "Not enough complete sentence evidence yet to judge grammar fairly.";
    if (category === "Word Choice") return "Not enough writing yet to judge word choice fairly.";
    return "Not enough evidence yet to score this category fairly.";
}

function buildLowSampleAnalysis(text, statusData) {
    var topicWords = String(text || "").trim().split(/\s+/).filter(function(word) {
        return word;
    });
    var topic = topicWords.slice(0, 4).join(" ");
    if (!topic) topic = "your topic";
    var eligibility = getCategoryEligibility(statusData);
    var quickRubric = {};
    var detailedCategories = {};
    var categoryScores = {};
    var coachingStart = statusData.status === "insufficient" ? "You started your idea." : "You have the start of a writing idea here.";

    var reasonMap = {
        "Ideas & Details": statusData.status === "insufficient"
            ? "I can tell your topic is " + topic + ". Add a complete sentence and one more detail so I can score your ideas fairly."
            : "I can tell this writing is about " + topic + ". Add another sentence with a detail so your ideas are easier to score fairly.",
        "Grammar": statusData.status === "insufficient"
            ? "Turn your idea into a full sentence with a subject and an action."
            : "Write complete sentences so the grammar can be judged more fairly.",
        "Word Choice": statusData.status === "insufficient"
            ? "Use the clearest word you can for what you want to say."
            : "Keep your key topic words, then add one or two more precise words.",
        "Organization": statusData.status === "insufficient"
            ? "Write at least two connected sentences before this category is scored."
            : "Add a second sentence so the order and structure can be judged fairly.",
        "Flow": statusData.status === "insufficient"
            ? "Write at least two connected sentences before this category is scored."
            : "Add a second sentence so the sentence rhythm and flow can be judged fairly.",
        "Spelling & Punctuation": statusData.status === "insufficient"
            ? "Check the spelling of important words and end your sentence with punctuation."
            : "Proofread for capitals, spelling, and ending punctuation."
    };

    CATEGORY_KEYS.forEach(function(key) {
        quickRubric[key] = {
            score: eligibility[key] && statusData.status === "limited" && key !== "Organization" && key !== "Flow" ? RUBRIC_MIN : null,
            reason: eligibility[key] && statusData.status === "limited" && key !== "Organization" && key !== "Flow"
                ? reasonMap[key]
                : getEvidenceNote(key)
        };
        if (eligibility[key] && statusData.status === "limited" && key !== "Organization" && key !== "Flow") {
            categoryScores[key] = RUBRIC_MIN;
        } else {
            categoryScores[key] = null;
        }
        detailedCategories[key] = {
            score: categoryScores[key],
            evidence: key === "Ideas & Details" ? coachingStart + " I can tell it connects to " + topic + "." : "",
            growthTip: reasonMap[key],
            contentOrganization: key === "Organization" ? "Need at least two connected sentences before this category can be scored fairly." : "",
            sentenceVariety: key === "Flow" ? "Not enough evidence yet." : "",
            rawBody: ""
        };
    });

    var detailed = {
        categories: detailedCategories,
        strength: "You got started with an idea about " + topic + ".",
        growGoal: statusData.status === "insufficient" ? "Turn my idea into a full sentence." : "Add another complete sentence with one more detail.",
        nextTime: statusData.status === "insufficient"
            ? "Write one full sentence that tells who, what, or where."
            : "Add a second sentence that explains one more detail about " + topic + ".",
        keepWriting: statusData.status === "insufficient"
            ? "You have started your idea. Keep going by turning it into a full sentence."
            : "You have a beginning here. Keep going by adding another sentence with one clear detail.",
        titleSuggestion: getWritingTitle(text)
    };

    return {
        quickRubric: quickRubric,
        detailed: detailed,
        categoryScores: categoryScores,
        overall: null
    };
}

function applyEligibilityToQuickRubric(quickRubric, eligibility) {
    for (var i = 0; i < CATEGORY_KEYS.length; i++) {
        var key = CATEGORY_KEYS[i];
        if (!quickRubric[key]) quickRubric[key] = { score: null, reason: getEvidenceNote(key) };
        if (!eligibility[key]) {
            quickRubric[key].score = null;
            quickRubric[key].reason = getEvidenceNote(key);
        }
    }
}

function applyEligibilityToDetailed(detailed, eligibility) {
    detailed = detailed || { categories: {} };
    if (!detailed.categories) detailed.categories = {};
    for (var i = 0; i < CATEGORY_KEYS.length; i++) {
        var key = CATEGORY_KEYS[i];
        if (!detailed.categories[key]) {
            detailed.categories[key] = {
                score: null,
                evidence: "",
                growthTip: getEvidenceNote(key),
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
        if (!eligibility[key]) {
            detailed.categories[key].score = null;
            detailed.categories[key].growthTip = getEvidenceNote(key);
            if (key === "Organization") {
                detailed.categories[key].contentOrganization = "Need at least two connected sentences before this category can be scored fairly.";
            }
            if (key === "Flow") {
                detailed.categories[key].sentenceVariety = "Not enough evidence yet.";
            }
        }
    }
}


// ── Grade level result note ──
// FIX O5: Display "Grade X" not "Grade: Grade X"
function updateGradeLevelResultNote() {
    var el = document.getElementById("gradeLevelResultNote");
    if (!el) return;
    var profile = getGradeProfile();
    var label = profile.gradeLabel || profile.label || "Grade 5";
    if (!latestAnalysisData) {
        el.textContent = "Analyze writing to confirm the scoring basis.";
        return;
    }
    el.textContent = "Scoring basis: " + label + " expectations.";
}

function updateScoreDisplay(data) {
    var overallScoreEl = document.getElementById("overallScore");
    var noteEl = document.getElementById("overallScoreNote");
    var statusEl = document.getElementById("sampleStatusLine");
    var statusData = data && data.sampleStatus ? data.sampleStatus : null;
    if (!overallScoreEl || !noteEl || !statusEl) return;

    var profile = getGradeProfile();
    var weightingText = getWeightDescriptionText(profile);

    if (!data) {
        overallScoreEl.textContent = "--";
        noteEl.textContent = "Category weights will appear after analysis.";
        statusEl.textContent = "Sample status: No analysis yet.";
        // FIX O1: updateGradeLevelResultNote() guard
        if (typeof updateGradeLevelResultNote === 'function') updateGradeLevelResultNote();
        return;
    }
    if (data.overall == null) {
        overallScoreEl.textContent = statusData ? statusData.label : "Not scored";
        noteEl.textContent = "A full percentage is hidden until there is enough writing to score fairly.";
    } else {
        overallScoreEl.textContent = data.overall + "%";
        noteEl.textContent = "Category weights: " + weightingText.replace(/^Weighted by category importance:\s*/i, "");
    }
    statusEl.textContent = "Sample status: " + (statusData ? statusData.label + ". " + statusData.reason : "Scorable sample.");
    if (typeof updateGradeLevelResultNote === 'function') updateGradeLevelResultNote();
}
function refreshScoreWeightingDescription() {
    updateScoreDisplay(latestAnalysisData || null);
}

function renderMarkdownBold(s) {
    // Convert **text** into <strong>text</strong> after escaping HTML
    var escaped = escapeHtml(s);
    return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function normalizeDiffToken(token) {
    return String(token || "").toLowerCase();
}

function tokenizeForDiff(text) {
    var matches = String(text || "").match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*|[^A-Za-z0-9\s]|\n+/g);
    return matches || [];
}

function isWordToken(token) {
    return /[A-Za-z0-9]/.test(token || "") && !/^[^A-Za-z0-9\s]+$/.test(token || "");
}

function isNewlineToken(token) {
    return /^\n+$/.test(token || "");
}

function isPunctuationToken(token) {
    return !!token && !isWordToken(token) && !isNewlineToken(token);
}

function levenshteinDistance(a, b) {
    var s = String(a || "").toLowerCase();
    var t = String(b || "").toLowerCase();
    var rows = s.length + 1;
    var cols = t.length + 1;
    var dp = [];
    var i;
    var j;
    for (i = 0; i < rows; i++) {
        dp[i] = [];
        dp[i][0] = i;
    }
    for (j = 0; j < cols; j++) dp[0][j] = j;
    for (i = 1; i < rows; i++) {
        for (j = 1; j < cols; j++) {
            var cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[s.length][t.length];
}

var HELPER_WORD_SET = {
    "had": true, "have": true, "has": true,
    "would": true, "will": true,
    "did": true, "do": true, "does": true,
    "am": true, "is": true, "are": true, "was": true, "were": true,
    "could": true, "should": true,
    "not": true, "don't": true, "doesn't": true, "didn't": true,
    "can't": true, "cannot": true
};

var SAFE_INSERT_WORD_SET = {
    "a": true, "an": true, "the": true,
    "is": true, "are": true, "am": true, "was": true, "were": true,
    "do": true, "does": true, "did": true,
    "to": true
};

var PAST_TO_BASE_WORD_MAP = {
    "was": "is",
    "were": "are",
    "had": "have",
    "did": "do",
    "felt": "feel",
    "went": "go",
    "saw": "see",
    "gave": "give",
    "made": "make",
    "said": "say",
    "ran": "run",
    "sat": "sit",
    "woke": "wake",
    "ate": "eat",
    "forgot": "forget",
    "forgave": "forgive",
    "thought": "think",
    "brought": "bring",
    "found": "find",
    "told": "tell",
    "came": "come",
    "left": "leave",
    "wrote": "write",
    "took": "take",
    "stayed": "stay",
    "shared": "share",
    "looked": "look",
    "called": "call",
    "tried": "try",
    "realized": "realize",
    "burned": "burn",
    "watched": "watch"
};

function isRiskyBackwardTenseShift(originalWord, correctedWord, prevOriginalWord, prevPrevOriginalWord) {
    var o = String(originalWord || "").toLowerCase();
    var c = String(correctedWord || "").toLowerCase();
    var prev = String(prevOriginalWord || "").toLowerCase();
    var prevPrev = String(prevPrevOriginalWord || "").toLowerCase();
    if (!o || !c || o === c) return false;
    if (PAST_TO_BASE_WORD_MAP[o] === c) return true;
    if (/ied$/.test(o) && c === o.replace(/ied$/, "y")) return true;
    if (/ed$/.test(o) && (c === o.slice(0, -2) || c === o.slice(0, -1) || c === (o.slice(0, -2) + "e"))) return true;
    if (/^(did|does|do)$/.test(prev) || /^(did|does|do)$/.test(prevPrev)) {
        if (/^(forgot|felt|went|saw|gave|made|said|ran|sat|woke|ate|wrote|took|left|came|thought|found|told|burned|looked|called|shared|stayed|tried|realized|watched)$/.test(c)) return true;
        if (/ied$/.test(c) || /ed$/.test(c)) return true;
    }
    if (HELPER_WORD_SET[o] && HELPER_WORD_SET[c] && o !== c) {
        if (/^(had|did|was|were|would|could|should|didn't)$/.test(o) && /^(have|do|is|are|will|can|don't)$/.test(c)) return true;
    }
    return false;
}

function isSafeWordReplacement(originalWord, correctedWord, prevOriginalWord, prevPrevOriginalWord) {
    var o = String(originalWord || "");
    var c = String(correctedWord || "");
    var lo = o.toLowerCase();
    var lc = c.toLowerCase();
    if (!lo || !lc) return false;
    if (lo === lc) return true;
    if (isRiskyBackwardTenseShift(lo, lc, prevOriginalWord, prevPrevOriginalWord)) return false;
    if (HELPER_WORD_SET[lo] && HELPER_WORD_SET[lc] && lo !== lc) return false;
    if (lo.replace(/'/g, "") === lc.replace(/'/g, "")) return true;
    if (levenshteinDistance(lo.replace(/'/g, ""), lc.replace(/'/g, "")) <= 1) return true;
    if (lo.length > 3 && lc.length > 3 && levenshteinDistance(lo, lc) <= 2 && !isRiskyBackwardTenseShift(lo, lc, prevOriginalWord, prevPrevOriginalWord)) return true;
    return false;
}

function buildLcsMatrix(a, b) {
    var rows = a.length + 1;
    var cols = b.length + 1;
    var dp = [];
    for (var i = 0; i < rows; i++) {
        dp[i] = [];
        for (var j = 0; j < cols; j++) dp[i][j] = 0;
    }
    for (var ai = a.length - 1; ai >= 0; ai--) {
        for (var bi = b.length - 1; bi >= 0; bi--) {
            if (normalizeDiffToken(a[ai]) === normalizeDiffToken(b[bi])) dp[ai][bi] = dp[ai + 1][bi + 1] + 1;
            else dp[ai][bi] = Math.max(dp[ai + 1][bi], dp[ai][bi + 1]);
        }
    }
    return dp;
}

function markChangedTokens(originalText, correctedText) {
    var a = tokenizeForDiff(originalText);
    var b = tokenizeForDiff(correctedText);
    var dp = buildLcsMatrix(a, b);
    var i = 0;
    var j = 0;
    var result = [];
    while (i < a.length && j < b.length) {
        if (normalizeDiffToken(a[i]) === normalizeDiffToken(b[j])) {
            result.push({ token: b[j], changed: false });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            i++;
        } else {
            result.push({ token: b[j], changed: true });
            j++;
        }
    }
    while (j < b.length) {
        result.push({ token: b[j], changed: true });
        j++;
    }
    return result;
}

function shouldHighlightCorrectionToken(token) {
    if (!token) return false;
    if (/^\n+$/.test(token)) return false;
    if (/^["']$/.test(token)) return false;
    if (/^[.,!?;:%]+$/.test(token)) return false;
    return /[A-Za-z0-9]/.test(token);
}

function isOpeningQuoteToken(prevPrevToken, prevToken, nextToken) {
    if (!(prevToken === '"' || prevToken === "'")) return false;
    if (!/^[A-Za-z0-9]/.test(nextToken || "")) return false;
    if (!prevPrevToken) return true;
    if (/^[\(\[\{]$/.test(prevPrevToken)) return true;
    if (/^[,;:]$/.test(prevPrevToken)) return true;
    return false;
}

function needsSpaceBeforeToken(prevPrevToken, prevToken, token, nextToken) {
    if (!prevToken) return false;
    if (isNewlineToken(token) || isNewlineToken(prevToken)) return false;
    if (/^[.,!?;:%\)\]\}]/.test(token)) return false;
    if (token === "'" && /[A-Za-z0-9]$/.test(prevToken) && /^[A-Za-z0-9]/.test(nextToken || "")) return false;

    if (token === '"' || token === "'") {
        var nextIsWord = /^[A-Za-z0-9]/.test(nextToken || "");
        var openingQuote = nextIsWord && (!prevToken || /^[\(\[\{,;:]$/.test(prevToken));
        return openingQuote;
    }

    if ((prevToken === '"' || prevToken === "'")) {
        if (isOpeningQuoteToken(prevPrevToken, prevToken, token)) return false;
        return true;
    }

    if (/^[\(\[\{]/.test(token)) return true;
    return true;
}

function hasCorrectionMarkdown(text) {
    return /\*\*[\s\S]+?\*\*/.test(String(text || ""));
}

function normalizeCorrectionMarkup(text) {
    return String(text || "")
        .replace(/\r\n?/g, "\n")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .trim();
}

function plainTextToStoryHtml(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
}

function splitStoryTitleAndBody(text) {
    var normalized = normalizeCorrectionMarkup(text || "");
    if (!normalized) return { title: "", body: "" };
    return extractWritingTitleParts(normalized);
}

function buildStoryHtmlWithTitle(text) {
    var parts = splitStoryTitleAndBody(text);
    if (!parts.title && !parts.body) return "";
    if (!parts.title) return plainTextToStoryHtml(parts.body);
    return '<span class="story-title-line">' + escapeHtml(parts.title) + '</span>' + plainTextToStoryHtml(parts.body);
}

function renderSimpleMarkdown(text) {
    var normalized = String(text || "").replace(/\r\n?/g, "\n");
    if (!normalized) return "";
    var safe = escapeHtml(normalized);
    safe = safe.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\n\n+/g, '<br><br>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
}

function renderCorrectionInline(text) {
    var segments = String(text || "").split(/(\*\*[\s\S]+?\*\*)/g);
    var html = [];
    for (var i = 0; i < segments.length; i++) {
        var segment = segments[i];
        if (!segment) continue;
        if (/^\*\*[\s\S]+\*\*$/.test(segment)) {
            html.push('<span class="corrected-highlight" title="Grammar correction">' + escapeHtml(segment.slice(2, -2)) + '</span>');
        } else {
            html.push(escapeHtml(segment));
        }
    }
    return html.join("");
}

function renderCorrectionMarkdown(text) {
    var normalized = normalizeCorrectionMarkup(text);
    if (!normalized) return "";
    var parts = splitStoryTitleAndBody(normalized);
    var bodyHtml = renderCorrectionInline(String(parts.body || "")).replace(/\n/g, "<br>");
    if (!parts.title) return bodyHtml;
    return '<span class="story-title-line">' + renderCorrectionInline(parts.title) + '</span>' + bodyHtml;
}

function buildMinimalCorrectionMarkup(originalText, correctedText) {
    var normalizedCorrected = normalizeCorrectionMarkup(correctedText || "");
    var cleanOriginal = stripCorrectionMarkdown(originalText || "");
    var cleanCorrected = stripCorrectionMarkdown(normalizedCorrected || "");
    if (!cleanCorrected.trim()) return "";
    if (hasCorrectionMarkdown(normalizedCorrected)) return normalizedCorrected;
    var tokens = markChangedTokens(cleanOriginal, cleanCorrected);
    var parts = [];
    var prevToken = "";
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i].token;
        if (/^\n+$/.test(token)) {
            parts.push(token);
            prevToken = "";
            continue;
        }
        if (tokenNeedsLeadingSpace(prevToken, token)) parts.push(" ");
        if (tokens[i].changed && shouldHighlightCorrectionToken(token)) {
            parts.push("**" + token + "**");
        } else {
            parts.push(token);
        }
        prevToken = token;
    }
    return parts.join("");
}

function tokenNeedsLeadingSpace(prevToken, token) {
    if (!prevToken) return false;
    if (/^\n+$/.test(token) || /^\n+$/.test(prevToken)) return false;
    if (/^[.,!?;:%\)\]\}]/.test(token)) return false;
    if (/^["']/.test(token) && /[.,!?;:)]$/.test(prevToken)) return false;
    if (token === "'" && /[A-Za-z0-9]$/.test(prevToken)) return false;
    if (/^[A-Za-z0-9]/.test(token) && prevToken === "'") return false;
    if (/^["']/.test(token) && /[A-Za-z0-9]$/.test(prevToken)) return false;
    if (/^[\(\[\{]/.test(token)) return true;
    if (/^["']/.test(prevToken)) return false;
    return true;
}

function renderCorrected(originalText, correctedText) {
    var normalizedCorrected = normalizeCorrectionMarkup(correctedText || "");
    if (hasCorrectionMarkdown(normalizedCorrected)) {
        return renderCorrectionMarkdown(normalizedCorrected);
    }

    var cleanOriginal = stripCorrectionMarkdown(originalText || "");
    var cleanCorrected = stripCorrectionMarkdown(normalizedCorrected || "");
    var tokens = markChangedTokens(cleanOriginal, cleanCorrected);
    var html = "";
    var plain = "";
    var prevToken = "";
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i].token;
        if (/^\n+$/.test(token)) {
            html += token.length >= 2 ? '<br><br>' : '<br>';
            plain += token.length >= 2 ? '\n\n' : '\n';
            prevToken = "";
            continue;
        }
        if (tokenNeedsLeadingSpace(prevToken, token)) {
            html += ' ';
            plain += ' ';
        }
        var safe = escapeHtml(token);
        html += tokens[i].changed && shouldHighlightCorrectionToken(token)
            ? '<span class="corrected-highlight" title="Grammar correction">' + safe + '</span>'
            : safe;
        plain += token;
        prevToken = token;
    }

    var storyHtml = buildStoryHtmlWithTitle(plain);
    if (!storyHtml) return html;
    if (storyHtml.indexOf('<span class="story-title-line">') === -1) return html;
    return storyHtml.replace(escapeHtml(stripCorrectionMarkdown(plain)).replace(/\n/g, '<br>'), html);
}

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

function normalizeSentenceStarterWord(word) {
    var cleaned = String(word || "")
        .replace(/^[\s"'`“”‘’([{<.,;:!?-]+/, "")
        .replace(/[\s"'`“”‘’)]}>.,;:!?-]+$/, "")
        .toLowerCase();
    return cleaned;
}

function displaySentenceStarterWord(word) {
    var cleaned = String(word || "")
        .replace(/^[\s"'`“”‘’([{<.,;:!?-]+/, "")
        .replace(/[\s"'`“”‘’)]}>.,;:!?-]+$/, "");
    if (!cleaned) return "";
    if (/^[a-z]+$/.test(cleaned)) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return cleaned;
}

function isRepeatedSentenceStarterConcern(starterInfo) {
    if (!starterInfo) return false;
    return (starterInfo.count || 0) >= 3 && (starterInfo.ratio || 0) > 0.25;
}

function getRepeatedSentenceStarterFeedback(starterInfo) {
    if (!isRepeatedSentenceStarterConcern(starterInfo)) return "";
    var word = starterInfo.displayStarter || starterInfo.mostCommonStarter || "";
    var count = starterInfo.count || 0;
    var pct = Math.round((starterInfo.ratio || 0) * 100);
    return 'You started ' + count + ' sentences with the word "' + word + '", which is ' + pct + '% of your sentences.';
}

function analyzeSentenceStarters(sentences) {
    var counts = {};
    var displays = {};
    var total = sentences ? sentences.length : 0;
    for (var i = 0; i < total; i++) {
        var rawSentence = String(sentences[i] || "");
        var m = rawSentence.match(/^[\s"'`“”‘’([{<.,;:!?-]*([A-Za-z][A-Za-z'-]*)/);
        if (!m) continue;
        var starter = normalizeSentenceStarterWord(m[1]);
        if (!starter) continue;
        counts[starter] = (counts[starter] || 0) + 1;
        if (!displays[starter]) displays[starter] = displaySentenceStarterWord(m[1]);
    }

    var maxStarter = 0;
    var mostCommon = "";
    for (var key in counts) {
        if (counts.hasOwnProperty(key) && counts[key] > maxStarter) {
            maxStarter = counts[key];
            mostCommon = key;
        }
    }

    var ratio = total ? maxStarter / total : 0;
    var info = {
        mostCommonStarter: mostCommon,
        displayStarter: displays[mostCommon] || displaySentenceStarterWord(mostCommon),
        count: maxStarter,
        sentenceCount: total,
        ratio: ratio,
        isRepeatedStarterConcern: false
    };
    info.isRepeatedStarterConcern = isRepeatedSentenceStarterConcern(info);
    return info;
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
            starterInfo: { mostCommonStarter: "", displayStarter: "", count: 0, ratio: 0 },
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

    if (maxLen >= Math.max(1, minLen * 2)) score += 30;
    else if (maxLen - minLen >= 5) score += 20;
    else score += 10;

    var starterInfo = analyzeSentenceStarters(sentences || []);
    if (starterInfo.isRepeatedStarterConcern && starterInfo.ratio > 0.6) score -= 20;
    else if (starterInfo.isRepeatedStarterConcern && starterInfo.ratio > 0.5) score -= 10;

    var shortRun = getShortSentenceRun(lengths);
    if (shortRun >= 6) score -= 20;
    else if (shortRun >= 4) score -= 10;

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    var varietyLabel = "Limited";
    if (score >= 85) varietyLabel = "Strong";
    else if (score >= 65) varietyLabel = "Good";
    else if (score >= 45) varietyLabel = "Developing";

    var flowRating = "Needs Improvement";
    if (average >= 12 && score >= 65) flowRating = "Very Good";
    else if (average >= 9 && score >= 65) flowRating = "Good";
    else if (average >= 9 || score >= 45) flowRating = "Developing";

    if (starterInfo.isRepeatedStarterConcern && starterInfo.ratio > 0.5 && flowRating === "Good") flowRating = "Developing";
    if (starterInfo.isRepeatedStarterConcern && starterInfo.ratio > 0.6) flowRating = "Needs Improvement";
    if (shortRun >= 4 && flowRating === "Good") flowRating = "Developing";
    if (shortRun >= 6) flowRating = "Needs Improvement";

    var starterSummary = "Starter variety looks balanced.";
    if (starterInfo.count > 0) {
        starterSummary = 'Most common starter "' + (starterInfo.displayStarter || starterInfo.mostCommonStarter) + '" appears ' + starterInfo.count + ' time';
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
}

function buildComputedFlowTip(flowData) {
    if (!flowData || !flowData.sentenceCount) {
        return "Try mixing short, medium, and longer sentences for smoother flow.";
    }
    var tips = [];
    if (flowData.starterInfo && isRepeatedSentenceStarterConcern(flowData.starterInfo)) {
        tips.push(getRepeatedSentenceStarterFeedback(flowData.starterInfo) + ' Try starting some sentences with a time word, a detail, or a different subject instead.');
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
        if (Object.prototype.hasOwnProperty.call(categoryScores, key)) {
            var rubric = String(categoryScores[key]);
            if (SCORE_MAP.hasOwnProperty(rubric)) {
                var weight = key === "Neatness" ? neatnessWeight : getCategoryWeight(key, gradeProfile) * nonNeatScale;
                weightedSum += SCORE_MAP[rubric] * weight;
                totalWeight += weight;
            }
        }
    }
    if (!totalWeight) return null;
    return Math.round(weightedSum / totalWeight);
}

function softenOverclaim(text, score) {
    var str = String(text || "");
    if (!str || score == null || Number(score) >= 10) return str;
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
    var n = Number(score);
    if (category === "Word Choice") {
        s = s.replace(/\bvocabulary\b/gi, "word choices");
        if (/works for the topic/i.test(s)) s = s.replace(/works for the topic/i, "fit your topic");
    }
    if (category === "Organization") {
        s = s.replace(/\bchronological\b/gi, "time order");
        s = s.replace(/\bsequence\b/gi, "order");
    }

    // If the sentence is very generic, gently make it more teacher-like.
    if (category && (s.length < 28 || /^good\b/i.test(s) || /^nice\b/i.test(s))) {
        if (category === "Flow") s = "Your writing reads smoothly; next, add 1-2 transition words to connect ideas.";
        else if (category === "Organization") s = "Your ideas stay in a clear order; next, add a transition word like First, Next, or Finally.";
        else if (category === "Word Choice") s = "Your word choices fit your topic; next, swap 2 simple words for more specific ones.";
        else if (category === "Grammar") s = "Your sentences are mostly clear; next, proofread for complete sentences and verb tense.";
        else if (category === "Ideas & Details") s = "Your main idea is clear; next, add 2-3 specific details to help the reader picture it.";
        else if (category === "Spelling & Punctuation") s = "Your writing is easy to read; next, proofread for capitals and end punctuation.";
    }

    s = softenOverclaim(s, n);
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
    var scoreNum = Number(score);
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
    var scoreNum = Number(score);
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
            if (verbSet[combined[i]]) {
                summary.verbIssues += 1;
                if (/^(had|have|has|would|will|did|does|do|am|is|are|was|were)$/.test(combined[i])) summary.helperVerbIssues += 1;
                break;
            }
        }
    }
    return summary;
}

function buildGrammarReasonFromData(score, originalText, correctedText) {
    var n = Number(score);
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
    var n = Number(score);
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
    var n = Number(score);
    if (!flowData) return "";
    var starterPct = flowData.starterInfo ? Math.round(flowData.starterInfo.ratio * 100) : 0;
    var starterWord = flowData.starterInfo ? (flowData.starterInfo.displayStarter || flowData.starterInfo.mostCommonStarter) : "";
    var starterCount = flowData.starterInfo ? (flowData.starterInfo.count || 0) : 0;
    var starterBad = isRepeatedSentenceStarterConcern(flowData.starterInfo);
    var starterSerious = starterBad && flowData.starterInfo && flowData.starterInfo.ratio > 0.33;
    var shortRunBad = flowData.shortRun >= 4;
    var shortRunMild = flowData.shortRun >= 3;

    if (n <= 6) {
        if (starterSerious && shortRunBad) {
            return 'Your ideas are easy to understand, but you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), and several short sentences stack up in a row, which makes the rhythm feel choppy and repetitive.';
        }
        if (starterSerious) {
            return 'You started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), which makes the rhythm sound repetitive - try opening some sentences differently.';
        }
        if (shortRunBad) {
            return "Your ideas are easy to understand, but many short sentences in a row make parts of the writing sound choppy.";
        }
        if (starterBad) {
            return 'Your story stays clear, but you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), so varying the sentence starters would help the flow.';
        }
        if (flowData.varietyScore < 55) {
            return "Your writing makes sense, but the sentence rhythm feels uneven, so mixing short and longer sentences will help it flow better.";
        }
    }
    if (n <= 8) {
        if (starterBad && shortRunMild) {
            return 'Your writing flows fairly well, but you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), and some short sentences cluster together - both are worth fixing for a smoother read.';
        }
        if (starterBad) {
            return 'Your ideas connect well, but starting ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%) makes the rhythm feel a little repetitive - try varying some sentence openers.';
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
    var n = Number(score);
    if (!flowData) return "";
    var starterPct = flowData.starterInfo ? Math.round(flowData.starterInfo.ratio * 100) : 0;
    var starterWord = flowData.starterInfo ? (flowData.starterInfo.displayStarter || flowData.starterInfo.mostCommonStarter) : "";
    var starterCount = flowData.starterInfo ? (flowData.starterInfo.count || 0) : 0;
    var starterBad = isRepeatedSentenceStarterConcern(flowData.starterInfo);
    var shortRunBad = flowData.shortRun >= 4;

    if (n <= 6) {
        if (starterBad && shortRunBad) {
            return 'You started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), and there are also several very short sentences stacked in a row, both of which disrupt the rhythm.';
        }
        if (starterBad) {
            return 'You started ' + starterCount + ' sentences with the word "' + starterWord + '", which is ' + starterPct + '% of your sentences and makes the rhythm feel repetitive in places.';
        }
        if (shortRunBad) {
            return "There are several very short sentences in a row, which makes the rhythm feel jumpy in places.";
        }
        return "The writing stays understandable, but the sentence rhythm is not very varied yet.";
    }
    if (n <= 8) {
        if (starterBad) {
            return 'You started ' + starterCount + ' sentences with the word "' + starterWord + '", which is ' + starterPct + '% of your sentences and creates a slightly repetitive rhythm even though the sentence lengths are varied.';
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
    var notes = [];
    var total = summary.totalEdits || 0;
    var sentenceLevel = total >= 8 ? "Main issue" : (total >= 4 ? "Moderate issue" : "Minor issue");
    var verbLevel = summary.verbIssues >= 4 ? "Main issue" : (summary.verbIssues > 0 ? "Minor to moderate issue" : "Mostly correct");
    var wordOrderLevel = total >= 6 ? "Moderate issue" : (total >= 3 ? "Minor issue" : "Mostly clear");
    var pronounLevel = /\b(he|she|they|it|him|her|them)\b/i.test(originalText || "") ? "Mostly clear" : "Not a major issue";
    var clarityLevel = Number(score) >= 7 ? "Mostly clear" : (Number(score) >= 5 ? "Developing" : "Needs support");
    notes.push({ pattern: "Sentence boundaries / run-ons", level: sentenceLevel, comment: total >= 4 ? "Some sentences need clearer breaks or punctuation." : "Sentence boundaries are mostly manageable." });
    notes.push({ pattern: "Verb tense and agreement", level: verbLevel, comment: summary.verbIssues > 0 ? "Some verb forms or tense choices need checking." : "Verb tense is not the main issue." });
    notes.push({ pattern: "Word order / phrasing", level: wordOrderLevel, comment: total >= 3 ? "A few phrases could be clearer or more natural." : "Word order is mostly clear." });
    notes.push({ pattern: "Pronouns and references", level: pronounLevel, comment: "Pronouns do not appear to be the main reason for the grammar score." });
    notes.push({ pattern: "Grammar clarity", level: clarityLevel, comment: Number(score) >= 7 ? "The reader can understand the writing most of the time." : "Grammar sometimes interrupts the reader's understanding." });
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

    if (quickRubric["Spelling & Punctuation"]) {
        quickRubric["Spelling & Punctuation"].reason = toOneSentence(teacherizeWording(buildConventionReason(quickRubric["Spelling & Punctuation"].score, issues), "Spelling & Punctuation", quickRubric["Spelling & Punctuation"].score));
    }
    if (detailed.categories["Spelling & Punctuation"]) {
        detailed.categories["Spelling & Punctuation"].evidence = buildConventionEvidence(detailed.categories["Spelling & Punctuation"].score, issues);
        detailed.categories["Spelling & Punctuation"].growthTip = buildConventionGrowthTip(issues);
    }

    var grammarQuick = quickRubric["Grammar"];
    if (grammarQuick && grammarQuick.score != null) {
        var grammarReason = buildGrammarReasonFromData(grammarQuick.score, originalText, correctedText);
        if (grammarReason) grammarQuick.reason = toOneSentence(teacherizeWording(grammarReason, "Grammar", grammarQuick.score));
    }
    if (detailed.categories["Grammar"] && detailed.categories["Grammar"].score != null) {
        var grammarEvidence = buildGrammarEvidenceFromData(detailed.categories["Grammar"].score, originalText, correctedText);
        if (grammarEvidence) detailed.categories["Grammar"].evidence = toOneSentence(teacherizeWording(grammarEvidence, "Grammar", detailed.categories["Grammar"].score));
        detailed.categories["Grammar"].evidence = alignGrammarWordingWithErrorData(detailed.categories["Grammar"].evidence, detailed.categories["Grammar"]);
        if (detailed.categories["Grammar"].teacherComment) {
            detailed.categories["Grammar"].teacherComment = alignGrammarWordingWithErrorData(detailed.categories["Grammar"].teacherComment, detailed.categories["Grammar"]);
        }
    }

    var flowQuick = quickRubric["Flow"];
    if (flowQuick && flowQuick.score != null) {
        var flowReason = buildFlowReasonFromData(flowQuick.score, flowData);
        if (flowReason) flowQuick.reason = toOneSentence(teacherizeWording(flowReason, "Flow", flowQuick.score));
    }
    if (detailed.categories["Flow"] && detailed.categories["Flow"].score != null) {
        var flowEvidence = buildFlowEvidenceFromData(detailed.categories["Flow"].score, flowData);
        if (flowEvidence) detailed.categories["Flow"].evidence = toOneSentence(teacherizeWording(flowEvidence, "Flow", detailed.categories["Flow"].score));
    }
}

function softFallback(category, score, text, actualWords, targetWords) {
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
        var patterns = [
            new RegExp(label + "\\s*[:\\-]\\s*((?:10|9|8|7|6|5|4)|Missing)\\s*(?:\\/\\s*" + RUBRIC_MAX + ")?", "i"),
            new RegExp(label + "[\\s\\S]{0,40}?((?:10|9|8|7|6|5|4)|Missing)\\s*(?:\\/\\s*" + RUBRIC_MAX + ")?", "i"),
            new RegExp(label + "[\\s\\S]{0,40}?score\\s*[:\\-]?\\s*((?:10|9|8|7|6|5|4)|Missing)", "i")
        ];
        var j;
        for (j = 0; j < patterns.length; j++) {
            var m = text.match(patterns[j]);
            if (m) return /missing/i.test(m[1]) ? null : parseRubricScore(m[1]);
        }
    }
    return null;
}

function parseWhatINoticedRowsFromBody(body) {
    var rows = [];
    var text = String(body || "");
    var blockMatch = text.match(/-\s*(?:\*\*)?What I Noticed:?(?:\*\*)?\s*([\s\S]*?)(?=\n-\s*(?:\*\*)?Growth Tip:?|\n\*\*|$)/i);
    if (!blockMatch) blockMatch = text.match(/-\s*(?:\*\*)?What I noticed:?(?:\*\*)?\s*([\s\S]*?)(?=\n-\s*(?:\*\*)?Growth Tip:?|\n\*\*|$)/i);
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

function parseDetailedAssessment(step3Text) {
    var result = {
        categories: {},
        strength: "",
        growGoal: "",
        nextTime: "",
        keepWriting: "",
        titleSuggestion: ""
    };

    function captureCategoryByPattern(label, labelPattern, nextLabelRegex) {
        var pattern = new RegExp("(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*" + labelPattern + "\\s*(?:\\*\\*)?\\s*(?::|-)\\s*(?:\\*\\*)?\\s*((?:10|9|8|7|6|5|4)|Missing)\\s*(?:\\/\\s*" + RUBRIC_MAX + ")?(?:\\s*(?:\\*\\*)?)?([\\s\\S]*?)(?=" + nextLabelRegex + "|$)", "i");
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

    function captureCategory(label, nextLabelRegex) {
        var labelSafe = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return captureCategoryByPattern(label, labelSafe, nextLabelRegex);
    }

    function categoryHeadingTerminator(labelPattern) {
        return "(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*" + labelPattern + "\\s*(?:\\*\\*)?\\s*(?::|-|\\n)";
    }

    var c1 = captureCategory("1. Clear Ideas & Details", "\\*\\*2\\. Grammar:|##\\s*Grow Goal Selection");
    var c2 = captureCategory("2. Grammar", "\\*\\*3\\. Word Choice:|##\\s*Grow Goal Selection");
    var c3 = captureCategory("3. Word Choice", "\\*\\*4\\. Organization:|##\\s*Grow Goal Selection");
    var c4 = captureCategory("4. Organization", "\\*\\*5\\. Flow:|##\\s*Grow Goal Selection");

    // Flow terminates at Spelling & Punctuation or the Grow Goal section.
    // NOTE: Neatness never appears in the Step 3 response (it is assessed separately via image),
    // so it must NOT be used as a terminator here — doing so caused Flow and Spelling &
    // Punctuation to always fall through to their extractScoreNearLabel fallbacks.
    var spellingLabelPattern = "(?:6\\.\\s*)?Spelling\\s*(?:and|&)\\s*Punctuation";
    var flowNextLabel = categoryHeadingTerminator(spellingLabelPattern) + "|(?:^|\\n)\\s*##\\s*Grow Goal Selection";
    var c5_flow = captureCategory("5. Flow", flowNextLabel);

    // Spelling & Punctuation terminates at the Grow Goal section.
    var spellNextLabel = "(?:^|\\n)\\s*##\\s*Grow Goal Selection|(?:^|\\n)\\s*(?:\\*\\*)?Your Writing Strength:";
    var c5 = captureCategoryByPattern("6. Spelling & Punctuation", spellingLabelPattern, spellNextLabel);

    if (c1) result.categories["Ideas & Details"] = c1;
    if (c2) result.categories["Grammar"] = c2;
    if (c3) result.categories["Word Choice"] = c3;
    if (c4) result.categories["Organization"] = c4;
    if (c5_flow) result.categories["Flow"] = c5_flow;
    if (c5) result.categories["Spelling & Punctuation"] = c5;

    // NOTE: Neatness is NOT parsed from Step 3 — it is assessed separately by assessNeatnessFromImage()
    // and injected into detailed.categories["Neatness"] via the inheritance loop in analyzeWriting().
    // A captureCategory("7. Neatness", ...) call was previously here but caused a regex alternation
    // bug: the terminator pattern's | split made \*\*Your Writing Strength: a second top-level
    // alternative, which always matched — producing a null-score ghost entry that blocked the
    // inheritance loop from ever writing the real score. Removed entirely.

    if (!c1) {
        var sIdeas = extractScoreNearLabel(step3Text, [
            "1. Clear Ideas & Details",
            "Clear Ideas & Details",
            "Ideas & Details",
            "Clear Ideas and Details"
        ]);
        if (sIdeas != null) {
            result.categories["Ideas & Details"] = {
                score: sIdeas,
                evidence: "",
                growthTip: "",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
    }

    if (!c2) {
        var sGrammar = extractScoreNearLabel(step3Text, [
            "2. Grammar",
            "Grammar"
        ]);
        if (sGrammar != null) {
            result.categories["Grammar"] = {
                score: sGrammar,
                evidence: "",
                growthTip: "",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
    }

    if (!c3) {
        var sWordChoice = extractScoreNearLabel(step3Text, [
            "3. Word Choice",
            "Word Choice"
        ]);
        if (sWordChoice != null) {
            result.categories["Word Choice"] = {
                score: sWordChoice,
                evidence: "",
                growthTip: "",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
    }

    if (!c4) {
        var sOrg = extractScoreNearLabel(step3Text, [
            "4. Organization",
            "Organization"
        ]);
        if (sOrg != null) {
            result.categories["Organization"] = {
                score: sOrg,
                evidence: "",
                growthTip: "",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
    }

    if (!c5_flow) {
        var sFlow = extractScoreNearLabel(step3Text, [
            "5. Flow",
            "Flow"
        ]);
        if (sFlow != null) {
            result.categories["Flow"] = {
                score: sFlow,
                evidence: "",
                growthTip: "",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
    }

    if (!c5) {
        var sSpellingPunctuation = extractScoreNearLabel(step3Text, [
            "6. Spelling & Punctuation",
            "6. Spelling and Punctuation",
            "5. Spelling & Punctuation",
            "5. Spelling and Punctuation",
            "Spelling & Punctuation",
            "Spelling and Punctuation"
        ]);
        if (sSpellingPunctuation != null) {
            result.categories["Spelling & Punctuation"] = {
                score: sSpellingPunctuation,
                evidence: "",
                growthTip: "",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        }
    }

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

    return result;
}

function applyWordCountToIdeas(step1Parsed, detailedParsed, actualWords, targetWords) {
    var baseQuick = step1Parsed.quickRubric["Ideas & Details"] ? step1Parsed.quickRubric["Ideas & Details"].score : null;
    var baseDetailed = detailedParsed.categories["Ideas & Details"] ? detailedParsed.categories["Ideas & Details"].score : baseQuick;
    if (baseDetailed == null) {
        return {
            adjustedScore: null,
            shortfallRatio: 0,
            multiplier: 1,
            penaltyRubricPoints: 0,
            note: "Ideas & Details was left unscored because there was not enough clear evidence."
        };
    }
    var adjustment = calculateWordCountAdjustment(baseDetailed, actualWords, targetWords);

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
    var starterInfo = flowData.starterInfo || { ratio: 0, mostCommonStarter: "", displayStarter: "" };
    var starterPct = Math.round((starterInfo.ratio || 0) * 100);
    var starterWord = starterInfo.displayStarter || starterInfo.mostCommonStarter || "";
    var starterCount = starterInfo.count || 0;
    var starterBad = isRepeatedSentenceStarterConcern(starterInfo) && starterWord;
    var shortRunBad = (flowData.shortRun || 0) >= 4 && (flowData.shortCount || 0) > 0;
    var dominant = getDominantSentenceBand(flowData);

    if (starterBad && shortRunBad) {
        return 'Try varying sentence starters and combining some short sentences - you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), and some short sentences sit close together.';
    }
    if (starterBad) {
        return 'Try varying sentence starters - you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), which can make the rhythm sound repetitive.';
    }
    if (shortRunBad) {
        return "Try combining some short sentences that are next to each other so the rhythm feels less choppy.";
    }
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

function buildFlowSentenceVarietyLabel(flowData) {
    if (!flowData) return "";
    var counts = "(short: " + flowData.shortCount + ", medium: " + flowData.mediumCount + ", long: " + flowData.longCount + ")";
    var starterInfo = flowData.starterInfo || { ratio: 0, mostCommonStarter: "", displayStarter: "" };
    var starterPct = Math.round((starterInfo.ratio || 0) * 100);
    var starterWord = starterInfo.displayStarter || starterInfo.mostCommonStarter || "";
    var starterCount = starterInfo.count || 0;
    var starterBad = isRepeatedSentenceStarterConcern(starterInfo) && starterWord;
    var starterNote = starterBad ? ' Also, you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%), which creates some repetition.' : "";
    var shortRunBad = (flowData.shortRun || 0) >= 4 && (flowData.shortCount || 0) > 0;
    var dominant = getDominantSentenceBand(flowData);

    if (flowData.flowRating === "Very Good") {
        return "Sentence lengths are well varied " + counts + ", which gives the writing a natural rhythm." + starterNote;
    }
    if ((flowData.shortCount || 0) === 0) {
        return "The writing uses medium and long sentences " + counts + ". Adding a few shorter sentences would create more rhythm and contrast." + starterNote;
    }
    if ((flowData.longCount || 0) === 0) {
        return "The writing uses short and medium sentences " + counts + ". Adding one or two longer sentences would make the rhythm smoother." + starterNote;
    }
    if ((flowData.mediumCount || 0) === 0) {
        return "The writing jumps between short and long sentences " + counts + ". Adding some medium-length sentences would make the rhythm more natural." + starterNote;
    }
    if (shortRunBad) {
        return "Several short sentences occur in a row " + counts + ", which can make the rhythm choppy. Combining a few of them would help." + starterNote;
    }
    if (dominant.label === "short" && dominant.ratio >= 0.60) {
        return "Many sentences are short " + counts + ", which can make the rhythm feel choppy. Combining a few ideas into longer sentences would help." + starterNote;
    }
    if (dominant.label === "long" && dominant.ratio >= 0.60) {
        return "Many sentences are long " + counts + ", so adding a few shorter sentences would create clearer rhythm and contrast." + starterNote;
    }
    if (dominant.label === "medium" && dominant.ratio >= 0.75) {
        return "Most sentences are medium length " + counts + ", so adding a few short and long sentences would create more variety." + starterNote;
    }
    if (starterBad) {
        return "Sentence lengths have some variety " + counts + ", but repeated sentence starters make the rhythm sound repetitive." + starterNote;
    }
    if (flowData.flowRating === "Good") {
        return "There is a reasonable mix of sentence lengths " + counts + ". A little more variety would make the rhythm even smoother." + starterNote;
    }
    return "The writing has some sentence variety " + counts + ", but the rhythm would be smoother with a wider mix of sentence lengths." + starterNote;
}



function buildFlowPatternSummary(flowData) {
    if (!flowData || !flowData.sentenceCount) return "The writing needs more sentence evidence before a clear flow pattern can be described.";
    var starterInfo = flowData.starterInfo || { ratio: 0, mostCommonStarter: "", displayStarter: "" };
    var starterWord = starterInfo.displayStarter || starterInfo.mostCommonStarter || "";
    var starterCount = starterInfo.count || 0;
    var starterPct = Math.round((starterInfo.ratio || 0) * 100);
    var starterBad = starterWord && isRepeatedSentenceStarterConcern(starterInfo);
    if (starterBad && (flowData.shortCount || 0) === 0) {
        return 'Your writing is easy to follow, but the rhythm feels repetitive because you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%). Adding a few shorter sentences could also improve rhythm.';
    }
    if (starterBad) {
        return 'Your writing is easy to follow, but the rhythm feels repetitive because you started ' + starterCount + ' sentences with the word "' + starterWord + '" (' + starterPct + '%).';
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
    var starterInfo = flowData.starterInfo || { ratio: 0, mostCommonStarter: "", displayStarter: "", count: 0 };
    var starterWord = starterInfo.displayStarter || starterInfo.mostCommonStarter || "";
    var starterCount = starterInfo.count || 0;
    var starterPct = Math.round((starterInfo.ratio || 0) * 100);
    var starterBad = starterWord && isRepeatedSentenceStarterConcern(starterInfo);
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
        starterNote = 'You started ' + starterCount + ' sentences with the word "' + starterWord + '", which is ' + starterPct + '% of your sentences and can make the rhythm feel repetitive.';
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

    if (quickItem.score != null) quickItem.score = Math.max(RUBRIC_MIN, Math.min(Number(quickItem.score), cap));
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

    detailedItem.score = Math.min(Number(detailedItem.score) || quickItem.score, cap);
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
        detailedParsed.categories[key] = {
            score: eligibility[key] ? quickItem.score : null,
            evidence: "The writing presents ideas in a sequence the reader can follow.",
            growthTip: quickItem.reason || "Try adding transition words to connect your ideas in a clearer order.",
            contentOrganization: "The events stay in a clear, logical order.",
            sentenceVariety: "",
            rawBody: ""
        };
    }
}

function sleepMs(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function buildFallbackModelList(primaryModel, isImageRequest) {
    var candidates = isImageRequest
        ? [primaryModel, OCR_MODEL, "openai/gpt-5.4-nano"]
        : [primaryModel, "openai/gpt-5.4-nano", "x-ai/grok-4.1-fast", "xiaomi/mimo-v2-flash", "xiaomi/mimo-v2-omni"];
    var seen = {};
    return candidates.filter(function(item) {
        if (!item || seen[item]) return false;
        seen[item] = true;
        return true;
    });
}

function isRetryableOpenRouterStatus(status) {
    return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function summarizeOpenRouterFailure(status, rawText) {
    var text = String(rawText || "");
    if (status === 401) return "Authentication failed. The API key may be invalid, expired, revoked, or rejected by the selected provider.";
    if (status === 402) return "The account or API key may not have enough credits.";
    if (status === 502 || status === 503 || status === 504 || /Upstream Response Error|Provider returned error|Decode transfer failed|KVTransferError/i.test(text)) {
        return "The model provider had a temporary upstream failure.";
    }
    if (status === 429) return "The request was rate-limited by the provider.";
    if (status === 408) return "The request timed out.";
    if (!status && /Failed to fetch|NetworkError|network/i.test(text)) return "A network error interrupted the request.";
    return "The provider returned an unexpected error.";
}

function normalizeOpenRouterError(prefix, err, attempts) {
    var message = err && err.message ? String(err.message) : String(err || "Unknown error");
    var summary = summarizeOpenRouterFailure(0, message);
    var attemptsText = attempts && attempts.length ? " Attempts: " + attempts.join(" | ") : "";
    if (/Analysis cancelled by user\./.test(message)) return new Error(message);
    if (/OpenRouter request failed after retries:/i.test(message)) return new Error(prefix + ": " + message + attemptsText);
    return new Error(prefix + ": " + summary + " " + message + attemptsText);
}

async function requestOpenRouterWithFallback(primaryModel, payloadBuilder, options) {
    if (cancelAnalysis) throw new Error("Analysis cancelled by user.");
    if (!analysisAbortController) analysisAbortController = new AbortController();

    options = options || {};
    var models = buildFallbackModelList(primaryModel, !!options.isImageRequest);
    var attempts = [];
    var lastError = null;
    var maxRetriesPerModel = options.maxRetriesPerModel == null ? 2 : options.maxRetriesPerModel;

    for (var m = 0; m < models.length; m++) {
        var model = models[m];
        for (var attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
            if (cancelAnalysis) throw new Error("Analysis cancelled by user.");
            var timeoutId = setTimeout(function() {
                if (analysisAbortController) analysisAbortController.abort();
            }, 90000);
            try {
                var payload = payloadBuilder(model);
                refreshApiKeyRuntimeValue();
                if (!API_KEY) {
                    throw new Error('No API key found. Open System Settings and paste your OpenRouter API key.');
                }
                var res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + API_KEY,
                        "Content-Type": "application/json",
                        "HTTP-Referer": window.location.href,
                        "X-OpenRouter-Title": "Writing Feedback Tool"
                    },
                    body: JSON.stringify(payload),
                    signal: analysisAbortController.signal
                });
                clearTimeout(timeoutId);

                var rawText = await res.text();
                var data;
                try {
                    data = JSON.parse(rawText);
                } catch (e) {
                    throw new Error("OpenRouter returned non-JSON: " + rawText);
                }

                if (!res.ok) {
                    var statusMessage = summarizeOpenRouterFailure(res.status, rawText);
                    var err = new Error("OpenRouter error " + res.status + ": " + statusMessage + " Raw: " + rawText);
                    err.status = res.status;
                    err.rawText = rawText;
                    throw err;
                }

                if (data.error) {
                    var payloadErr = new Error("OpenRouter payload error: " + JSON.stringify(data.error));
                    payloadErr.status = data.error.code ? Number(data.error.code) : 0;
                    payloadErr.rawText = JSON.stringify(data.error);
                    throw payloadErr;
                }

                if (!data.choices || !data.choices.length) {
                    throw new Error("OpenRouter returned no choices: " + rawText);
                }

                if (!data.choices[0].message || typeof data.choices[0].message.content !== "string") {
                    throw new Error("Unexpected OpenRouter response shape: " + rawText);
                }

                return data.choices[0].message.content;
            } catch (e) {
                clearTimeout(timeoutId);
                if (e && e.name === "AbortError") {
                    if (cancelAnalysis) {
                        throw new Error("Analysis cancelled by user.");
                    }
                    // Timeout-based abort uses the same controller. Recreate it so retries are possible.
                    analysisAbortController = new AbortController();
                    lastError = new Error("OpenRouter request timed out after 90 seconds.");
                } else {
                    lastError = e;
                }

                if (cancelAnalysis) throw new Error("Analysis cancelled by user.");

                var status = lastError && lastError.status ? Number(lastError.status) : 0;
                var summary = summarizeOpenRouterFailure(status, lastError && lastError.message ? lastError.message : "");
                attempts.push(model + " attempt " + (attempt + 1) + ": " + summary);

                var retryable = !status || isRetryableOpenRouterStatus(status) || /timed out|Failed to fetch|network|Upstream Response Error|Provider returned error|Decode transfer failed|KVTransferError/i.test(lastError && lastError.message ? lastError.message : "");
                var hasAnotherAttemptSameModel = attempt < maxRetriesPerModel;
                var hasAnotherModel = m < models.length - 1;

                if (!(retryable && (hasAnotherAttemptSameModel || hasAnotherModel))) {
                    throw new Error("OpenRouter request failed after retries: " + (lastError && lastError.message ? lastError.message : String(lastError)));
                }

                await sleepMs(Math.min(1200 * (attempt + 1), 3000));
            }
        }
    }

    throw new Error("OpenRouter request failed after retries: " + (lastError && lastError.message ? lastError.message : "Unknown error") + (attempts.length ? " Attempts: " + attempts.join(" | ") : ""));
}

async function callOpenRouter(model, prompt) {
    try {
        return await requestOpenRouterWithFallback(model, function(activeModel) {
            return {
                model: activeModel,
                temperature: 0.2,
                messages: [
                    { role: "user", content: prompt }
                ]
            };
        }, { isImageRequest: false, maxRetriesPerModel: 1 });
    } catch (e) {
        throw normalizeOpenRouterError("Writing analysis failed", e);
    }
}


async function callOpenRouterImage(model, prompt, imageDataUrl) {
    try {
        return await requestOpenRouterWithFallback(model, function(activeModel) {
            return {
                model: activeModel,
                temperature: 0,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: imageDataUrl } }
                        ]
                    }
                ]
            };
        }, { isImageRequest: true, maxRetriesPerModel: 1 });
    } catch (e) {
        throw normalizeOpenRouterError("Image extraction failed", e);
    }
}

function setOcrStatus(message, state) {
    var el = document.getElementById("ocrStatus");
    el.textContent = message;
    el.className = "ocr-status" + (state ? " " + state : "");
}

function isMobileLayout() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
}

function syncMobileOcrPanelState() {
    var panel = document.getElementById("ocrPanel");
    if (!panel) return;
    if (isMobileLayout()) {
        panel.open = true;
    }
}

function syncOcrPanelTitle() {
    var el = document.getElementById("ocrPanelTitle");
    if (!el) return;
    el.textContent = isMobileLayout() ? "Scan or Upload Writing" : "Upload Writing";
}


function updateOcrControls() {
    var extractBtn = document.getElementById("extractTextBtn");
    var takePhotoBtn = document.getElementById("takePhotoBtn");
    var uploadImageBtn = document.getElementById("uploadImageBtn");
    var studentWriting = document.getElementById("studentWriting");
    if (!extractBtn) return;
    var hasImages = selectedImages && selectedImages.length > 0;
    var hasText = studentWriting && studentWriting.value.trim().length > 0;
    extractBtn.disabled = isAnalyzing || !hasImages;

    // Keep the photo/upload controls useful after the first page is queued.
    // On mobile, users usually take one page at a time, so the buttons must remain visible.
    if (takePhotoBtn) {
        takePhotoBtn.innerHTML = hasImages
            ? '<span aria-hidden="true" style="font-size:18px;vertical-align:text-bottom;margin-right:6px;">📷</span>Add Another Photo'
            : '<span aria-hidden="true" style="font-size:18px;vertical-align:text-bottom;margin-right:6px;">📷</span>Take Photo';
    }
    if (uploadImageBtn) {
        uploadImageBtn.textContent = hasImages ? '⬆️ Add More Images' : '⬆️ Upload Image';
    }

    // Add pulse animation when button becomes ready but text hasn't been extracted yet
    // Pulse when: has images, not analyzing, AND no text in the box yet
    if (hasImages && !isAnalyzing && !hasText) {
        extractBtn.classList.add('pulse-ready');
    } else {
        extractBtn.classList.remove('pulse-ready');
    }
}

function syncSelectedImageState() {
    if (selectedImages.length) {
        selectedImageDataUrl = selectedImages[0].dataUrl || "";
        selectedImageName = selectedImages[0].name || "";
        selectedImageExtractedText = selectedImages[0].extractedText || "";
        selectedImageExtractionPromise = selectedImages[0].extractionPromise || null;
    } else {
        selectedImageDataUrl = "";
        selectedImageName = "";
        selectedImageExtractedText = "";
        selectedImageExtractionPromise = null;
    }
}

function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}


// ── WFT Version 2 archive and export helpers ──
function setWftArchiveStatus(message) {
    var el = document.getElementById("archiveStatus");
    if (el) {
        el.textContent = message || "";
    }
}

function sanitizeFileName(name) {
    var safe = String(name || "Untitled")
        .replace(/[\\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    if (!safe) safe = "Untitled";
    return safe.substring(0, 120);
}

function getUniqueFolderName(baseName, usedNames) {
    var safeBase = sanitizeFileName(baseName);
    var candidate = safeBase;
    var counter = 2;

    while (usedNames[candidate]) {
        candidate = safeBase + " (" + counter + ")";
        counter += 1;
    }

    usedNames[candidate] = true;
    return candidate;
}

function csvEscape(value) {
    var text = String(value == null ? "" : value);
    if (/[",\r\n]/.test(text)) {
        return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
}

function stripHtmlToText(html) {
    var tmp;
    if (!html) return "";
    try {
        tmp = document.createElement("div");
        tmp.innerHTML = String(html || "");
        return tmp.textContent || tmp.innerText || "";
    } catch (e) {
        return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
}

function getNestedValue(source, path) {
    var value = source;
    var i;
    for (i = 0; i < path.length; i += 1) {
        if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, path[i])) {
            return "";
        }
        value = value[path[i]];
    }
    return value == null ? "" : value;
}

function buildExportHtmlDocument(title, bodyHtml) {
    return '<!DOCTYPE html>' +
        '<html lang="en">' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + escapeHtml(title) + '</title>' +
        '<style>' +
        'body{font-family:Arial,sans-serif;line-height:1.5;margin:24px;color:#111;}' +
        'h1,h2,h3{margin-top:1.2em;}' +
        'table{border-collapse:collapse;width:100%;margin:12px 0;}' +
        'th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top;}' +
        '.session{border:1px solid #ddd;padding:12px;margin:16px 0;border-radius:8px;}' +
        '.muted{color:#666;}' +
        'pre{white-space:pre-wrap;background:#f7f7f7;padding:12px;border-radius:6px;}' +
        '</style>' +
        '</head>' +
        '<body>' + bodyHtml + '</body></html>';
}

function getStudentSessions(studentData) {
    return studentData && Array.isArray(studentData.sessions) ? studentData.sessions : [];
}

function getSessionDate(session) {
    return session && (session.date || session.createdAt || session.updatedAt || session.timestamp) ? String(session.date || session.createdAt || session.updatedAt || session.timestamp) : "";
}

function getSessionTitle(session) {
    if (!session) return "";
    return session.title || session.prompt || session.assignment || "Untitled";
}

function getSessionOriginalText(session) {
    if (!session) return "";
    return session.originalText || session.originalPlainText || session.studentWriting || session.text || "";
}

function getSessionCorrectedText(session) {
    if (!session) return "";
    return session.correctedPlainText || session.correctedStory || stripHtmlToText(session.correctedHtml || session.correctedMarkup || session.correctedText || "");
}

function buildSessionExportFeedbackText(session) {
    var parts = [];
    var scores;
    if (!session) return "";

    if (session.feedbackSummary && typeof session.feedbackSummary === "object") {
        if (session.feedbackSummary.strength) parts.push("Strength: " + session.feedbackSummary.strength);
        if (session.feedbackSummary.nextTime) parts.push("Next step: " + session.feedbackSummary.nextTime);
        if (session.feedbackSummary.growGoal) parts.push("Growth goal: " + session.feedbackSummary.growGoal);
        if (session.feedbackSummary.closing) parts.push("Encouragement: " + session.feedbackSummary.closing);
    }

    if (session.feedback && typeof session.feedback === "object") {
        if (session.feedback.strength) parts.push("Strength: " + session.feedback.strength);
        if (session.feedback.nextTime) parts.push("Next step: " + session.feedback.nextTime);
        if (session.feedback.growGoal) parts.push("Growth goal: " + session.feedback.growGoal);
        if (session.feedback.comment) parts.push("Comment: " + session.feedback.comment);
    }

    if (session.teacherComment) parts.push("Teacher comment: " + session.teacherComment);
    if (session.notes) parts.push("Notes: " + session.notes);

    scores = session.categoryScores || session.scores || null;
    if (scores && typeof scores === "object") {
        parts.push("Scores: " + JSON.stringify(scores));
    }

    return parts.join("\r\n");
}

function getFirstAndLastSessionDates(sessions) {
    var dates = [];
    var i;
    var value;
    for (i = 0; i < sessions.length; i += 1) {
        value = getSessionDate(sessions[i]);
        if (value) dates.push(value);
    }
    dates.sort();
    return {
        first: dates.length ? dates[0] : "",
        last: dates.length ? dates[dates.length - 1] : ""
    };
}

function buildStudentSummaryHtml(studentName, studentData, schoolYear) {
    var sessions = getStudentSessions(studentData);
    var html = "";
    var i;
    var session;

    html += '<h1>' + escapeHtml(studentName) + ' - Writing Portfolio</h1>';
    html += '<p class="muted">School Year: ' + escapeHtml(schoolYear) + '</p>';
    html += '<p>Total writing sessions: ' + sessions.length + '</p>';

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        html += '<div class="session">';
        html += '<h2>Session ' + (i + 1) + '</h2>';
        html += '<p><strong>Date:</strong> ' + escapeHtml(getSessionDate(session)) + '</p>';
        html += '<p><strong>Title/Prompt:</strong> ' + escapeHtml(getSessionTitle(session)) + '</p>';
        html += '<h3>Original Writing</h3>';
        html += '<pre>' + escapeHtml(getSessionOriginalText(session)) + '</pre>';
        html += '<h3>Corrected Writing</h3>';
        html += '<pre>' + escapeHtml(getSessionCorrectedText(session)) + '</pre>';
        html += '<h3>Feedback</h3>';
        html += '<pre>' + escapeHtml(buildSessionExportFeedbackText(session)) + '</pre>';
        html += '</div>';
    }

    return buildExportHtmlDocument(studentName + " - Portfolio Summary", html);
}

function buildStudentPortfolioHtml(studentName, studentData, schoolYear) {
    var sessions = getStudentSessions(studentData).slice().sort(function(a, b) {
        var aTime = a && a.createdAt ? Date.parse(a.createdAt) : 0;
        var bTime = b && b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
    });
    if (!sessions.length) {
        return buildExportHtmlDocument(studentName + " - Portfolio", '<div class="empty">No writing sessions recorded yet.</div>');
    }

    var latestSession = sessions[0];
    var prevSession = sessions.length >= 2 ? sessions[1] : null;
    var overalls = sessions.map(function(s) { return s.overall != null ? Number(s.overall) : null; }).filter(function(v) { return v != null && !isNaN(v); });
    var avgOverall = overalls.length ? Math.round(overalls.reduce(function(a, b) { return a + b; }, 0) / overalls.length) : null;
    var latestOverall = latestSession.overall != null ? Number(latestSession.overall) : null;
    var prevOverall = prevSession && prevSession.overall != null ? Number(prevSession.overall) : null;
    var trend = latestOverall != null && prevOverall != null ? latestOverall - prevOverall : null;
    var bestOverall = overalls.length ? Math.max.apply(null, overalls) : null;
    var categoryAverages = getCategoryAverageMap(sessions);
    var portfolioCategoryKeys = getPortfolioCategoryKeys(sessions);
    var weakestCategory = null;
    var strongestCategory = null;
    portfolioCategoryKeys.forEach(function(key) {
        if (categoryAverages[key] == null) return;
        if (strongestCategory == null || categoryAverages[key] > categoryAverages[strongestCategory]) strongestCategory = key;
        if (weakestCategory == null || categoryAverages[key] < categoryAverages[weakestCategory]) weakestCategory = key;
    });

    var trendText = '';
    if (trend != null) {
        if (trend > 0) trendText = '&#9650; +' + trend + '% vs previous';
        else if (trend < 0) trendText = '&#9660; ' + trend + '% vs previous';
        else trendText = 'Same as previous';
    }

    var html = '';
    html += '<div class="portfolio-page">';

    // Header
    html += '<div class="portfolio-header">';
    html += '<h1>' + escapeHtml(studentName) + ' &mdash; Writing Portfolio</h1>';
    html += '<p class="muted">School Year: ' + escapeHtml(schoolYear) + ' &bull; ' + sessions.length + ' submission' + (sessions.length !== 1 ? 's' : '') + '</p>';
    html += '</div>';

    // Stats grid
    html += '<div class="stats-grid">';
    html += '<div class="stat-card"><div class="stat-label">Latest Score</div><div class="stat-value">' + (latestOverall != null ? latestOverall + '%' : '-') + '</div><div class="stat-trend">' + trendText + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Average Score</div><div class="stat-value">' + (avgOverall != null ? avgOverall + '%' : '-') + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Best Score</div><div class="stat-value">' + (bestOverall != null ? bestOverall + '%' : '-') + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Submissions</div><div class="stat-value">' + sessions.length + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Strongest Area</div><div class="stat-value area-name">' + escapeHtml(strongestCategory || '-') + '</div></div>';
    html += '<div class="stat-card"><div class="stat-label">Focus Area</div><div class="stat-value area-name">' + escapeHtml(weakestCategory || '-') + '</div></div>';
    html += '</div>';

    // Session cards (newest first)
    html += '<h2 class="section-title">Saved Work</h2>';
    for (var si = 0; si < sessions.length; si += 1) {
        var sess = sessions[si];
        var scoreColor = scoreBadgeColor(sess.overall);

        // Category chips
        var chipsHtml = '';
        var sessCategoryKeys = typeof getSessionCategoryKeys === 'function' ? getSessionCategoryKeys(sess) : Object.keys(sess.categoryScores || {});
        sessCategoryKeys.forEach(function(key) {
            var value = sess.categoryScores && sess.categoryScores[key] != null ? sess.categoryScores[key] : '-';
            var chipClass = getRubricScoreColorClass(value);
            chipsHtml += '<span class="chip ' + chipClass + '"><strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(String(value)) + (value !== '-' ? '/10' : '') + '</span>';
        });

        // Feedback notes
        var feedbackText = buildSessionExportFeedbackText(sess);
        var notesContent = feedbackText ? renderSimpleMarkdown(feedbackText) : '<em>No notes saved.</em>';

        // Corrected HTML (use the same helper as the in-app portfolio when available)
        var correctedDisplayHtml = '';
        if (typeof getPortfolioCorrectedHtml === 'function') {
            correctedDisplayHtml = getPortfolioCorrectedHtml(sess);
        } else if (sess.correctedMarkup) {
            correctedDisplayHtml = renderCorrectionMarkdown(sess.correctedMarkup);
        } else if (sess.correctedHtml) {
            correctedDisplayHtml = sess.correctedHtml;
        } else {
            correctedDisplayHtml = '<pre>' + escapeHtml(getSessionCorrectedText(sess)) + '</pre>';
        }

        html += '<div class="session-card">';
        // Header row
        html += '<div class="session-card-header">';
        html += '<div class="session-card-title-wrap"><div class="session-date">' + escapeHtml(getSessionDate(sess) || 'Unknown date') + '</div><span class="session-title">' + escapeHtml(getSessionTitle(sess) || 'Untitled') + '</span></div>';
        html += '<div class="session-score" style="color:' + scoreColor + ';border-color:' + scoreColor + '33;">' + (sess.overall != null ? sess.overall + '%' : 'N/A') + '</div>';
        html += '</div>';
        // Meta
        html += '<div class="session-meta">Grade level: ' + escapeHtml(sess.gradeLabel || ('Grade ' + (sess.gradeLevel || 5))) + ' - ' + escapeHtml((sess.sourceType || 'typed').replace('+', ' + ')) + ' submission' + (sess.createdAt ? ' &mdash; ' + escapeHtml(new Date(sess.createdAt).toLocaleString()) : '') + ' - Writing type: ' + escapeHtml(getWritingGenreInfoFromSession(sess).mainGenre) + '</div>';
        // Chips
        html += '<div class="chip-row">' + chipsHtml + '</div>';
        // Artifact grid: Original | Corrected | Notes
        html += '<div class="artifact-grid">';
        html += '<div class="artifact-box"><h5>Original Writing</h5><pre>' + escapeHtml(getSessionOriginalText(sess)) + '</pre></div>';
        html += '<div class="artifact-box"><h5>Corrected Writing</h5><div class="rich-html corrected-writing-html">' + correctedDisplayHtml + '</div></div>';
        html += '<div class="artifact-box"><h5>Teacher Notes</h5><div class="rich-html">' + notesContent + '</div></div>';
        html += '</div>';

        // Image strip
        if (sess.images && sess.images.length) {
            html += '<div class="photo-strip">';
            for (var imi = 0; imi < sess.images.length; imi++) {
                var img = sess.images[imi];
                if (img.dataUrl) {
                    html += '<div class="photo-thumb"><img src="' + img.dataUrl + '" alt="' + escapeHtml(img.name || 'Image') + '" class="export-image"><div class="thumb-caption">' + escapeHtml(img.name || 'Image') + '</div></div>';
                } else {
                    html += '<div class="photo-thumb"><div class="photo-placeholder">&#128247; Image not available in export</div><div class="thumb-caption">' + escapeHtml(img.name || 'Image') + '</div></div>';
                }
            }
            html += '</div>';
        }

        html += '</div>'; // .session-card
    }

    html += '</div>'; // .portfolio-page

    // Inline CSS matching in-app portfolio look
    var css = ''
        + '*{box-sizing:border-box;margin:0;padding:0;}'
        + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#1e293b;background:#f1f5f9;padding:24px;}'
        + '.portfolio-page{max-width:960px;margin:0 auto;}'
        + '.portfolio-header{margin-bottom:24px;}'
        + '.portfolio-header h1{font-size:1.6rem;color:#0f172a;margin-bottom:4px;}'
        + '.muted{color:#64748b;font-size:0.9rem;}'
        + '.empty{text-align:center;color:#94a3b8;padding:60px 0;}'

        // Stats grid
        + '.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px;}'
        + '.stat-card{background:white;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;}'
        + '.stat-card .stat-label{font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;margin-bottom:6px;}'
        + '.stat-card .stat-value{font-size:1.5rem;font-weight:700;color:#0f172a;}'
        + '.stat-card .stat-value.area-name{font-size:0.85rem;}'
        + '.stat-card .stat-trend{font-size:12px;color:#64748b;margin-top:4px;}'

        // Section title
        + '.section-title{font-size:1.1rem;color:#334155;margin-bottom:14px;}'

        // Session cards
        + '.session-card{border:1px solid #e2e8f0;border-radius:10px;background:white;padding:18px;margin-bottom:16px;}'
        + '.session-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px;}'
        + '.session-card-title-wrap{flex:1;min-width:180px;}'
        + '.session-date{color:#64748b;font-size:12px;}'
        + '.session-title{font-weight:700;color:#0f172a;display:block;margin-top:2px;}'
        + '.session-score{font-weight:700;font-size:1rem;padding:6px 12px;border-radius:999px;background:#f8fafc;border:1px solid;white-space:nowrap;}'
        + '.session-meta{font-size:12px;color:#64748b;margin-bottom:10px;}'

        // Chips
        + '.chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}'
        + '.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 10px;font-size:12px;background:#f8fafc;border:1px solid #cbd5e1;color:#475569;}'
        + '.chip strong{color:inherit;}'
        + '.chip.score-green{background:#ecfdf5;border-color:#86efac;color:#166534;}'
        + '.chip.score-blue{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8;}'
        + '.chip.score-amber{background:#fffbeb;border-color:#fcd34d;color:#b45309;}'
        + '.chip.score-red{background:#fef2f2;border-color:#fca5a5;color:#b91c1c;}'
        + '.chip.score-gray{background:#f8fafc;border-color:#cbd5e1;color:#475569;}'

        // Artifact grid
        + '.artifact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:4px;}'
        + '.artifact-box{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fafafa;}'
        + '.artifact-box h5{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;}'
        + '.artifact-box pre,.artifact-box .rich-html{margin:0;white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:13px;line-height:1.5;color:#111111;}'

        // Rich HTML (for corrected text with highlights)
        + '.corrected-writing-html,.corrected-writing-html *{color:#111111!important;} .rich-html .corrected-highlight{background:#fde68a;color:#111111!important;font-weight:700;padding:0 2px;border-radius:3px;}'
        + '.rich-html .story-title-line{display:block;font-weight:700;margin-bottom:10px;color:#111111;}'
        + '.rich-html strong{font-weight:700;}'
        + '.rich-html br{display:block;content:"";margin-top:4px;}'

        // Photo strip
        + '.photo-strip{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;}'
        + '.photo-thumb{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:white;max-width:200px;}'
        + '.photo-thumb .export-image{width:100%;height:auto;display:block;}'
        + '.photo-placeholder{width:200px;height:100px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#94a3b8;font-size:12px;text-align:center;padding:12px;}'
        + '.thumb-caption{font-size:11px;color:#64748b;padding:6px 8px;text-align:center;background:#f8fafc;}'

        // Print styles
        + '@media print{body{background:white;padding:0;}.session-card{break-inside:avoid;border:1px solid #ddd;}.artifact-grid{grid-template-columns:repeat(3,1fr);}}'
        + '@media(max-width:640px){.artifact-grid{grid-template-columns:1fr;}.stats-grid{grid-template-columns:repeat(2,1fr);}}'
        ;

    return '<!DOCTYPE html>'
        + '<html lang="en">'
        + '<head>'
        + '<meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        + '<title>' + escapeHtml(studentName) + ' - Writing Portfolio</title>'
        + '<style>' + css + '</style>'
        + '</head>'
        + '<body>' + html + '</body></html>';
}

function buildStudentSessionsCsv(studentName, studentData) {
    var sessions = getStudentSessions(studentData);
    var rows = [];
    var i;
    var session;

    rows.push([
        "Student Name",
        "Session Date",
        "Title/Prompt",
        "Original Word Count",
        "Corrected Word Count",
        "Strength",
        "Next Step",
        "Growth Goal",
        "Scores JSON"
    ]);

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        rows.push([
            studentName,
            getSessionDate(session),
            getSessionTitle(session),
            countWords(getSessionOriginalText(session)),
            countWords(getSessionCorrectedText(session)),
            getNestedValue(session, ["feedback", "strength"]),
            getNestedValue(session, ["feedback", "nextTime"]),
            getNestedValue(session, ["feedback", "growGoal"]),
            JSON.stringify(session.categoryScores || session.scores || {})
        ]);
    }

    return rows.map(function(row) {
        return row.map(csvEscape).join(",");
    }).join("\r\n");
}

function buildCorrectedWritingText(studentName, studentData) {
    var sessions = getStudentSessions(studentData);
    var parts = [];
    var i;
    var session;

    parts.push(studentName + " - Corrected Writing");
    parts.push("");

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        parts.push("Session " + (i + 1));
        parts.push("Date: " + getSessionDate(session));
        parts.push("Title/Prompt: " + getSessionTitle(session));
        parts.push("");
        parts.push(getSessionCorrectedText(session));
        parts.push("");
        parts.push("----------------------------------------");
        parts.push("");
    }

    return parts.join("\r\n");
}

function buildClassSummaryRows(portfolio) {
    var studentNames = Object.keys(portfolio || {}).sort(function(a, b) { return a.localeCompare(b); });
    var rows = [];
    var i;
    var studentName;
    var sessions;
    var dates;

    for (i = 0; i < studentNames.length; i += 1) {
        studentName = studentNames[i];
        sessions = getStudentSessions(portfolio[studentName]);
        dates = getFirstAndLastSessionDates(sessions);
        rows.push({
            studentName: studentName,
            sessionCount: sessions.length,
            firstDate: dates.first,
            lastDate: dates.last
        });
    }

    return rows;
}

function buildClassSummaryHtml(portfolio, schoolYear) {
    var rows = buildClassSummaryRows(portfolio);
    var totalSessions = 0;
    var html = "";
    var i;

    for (i = 0; i < rows.length; i += 1) {
        totalSessions += rows[i].sessionCount;
    }

    html += '<h1>Class Writing Summary</h1>';
    html += '<p class="muted">School Year: ' + escapeHtml(schoolYear) + '</p>';
    html += '<p>Student count: ' + rows.length + '</p>';
    html += '<p>Total writing sessions: ' + totalSessions + '</p>';
    html += '<table><thead><tr><th>Student Name</th><th>Number of Sessions</th><th>First Session Date</th><th>Last Session Date</th></tr></thead><tbody>';

    for (i = 0; i < rows.length; i += 1) {
        html += '<tr><td>' + escapeHtml(rows[i].studentName) + '</td><td>' + rows[i].sessionCount + '</td><td>' + escapeHtml(rows[i].firstDate) + '</td><td>' + escapeHtml(rows[i].lastDate) + '</td></tr>';
    }

    html += '</tbody></table>';
    return buildExportHtmlDocument("Class Summary", html);
}

function buildClassSummaryCsv(portfolio, schoolYear) {
    var rows = buildClassSummaryRows(portfolio);
    var csvRows = [];
    var i;

    csvRows.push(["School Year", schoolYear]);
    csvRows.push([]);
    csvRows.push(["Student Name", "Number of Sessions", "First Session Date", "Last Session Date"]);

    for (i = 0; i < rows.length; i += 1) {
        csvRows.push([rows[i].studentName, rows[i].sessionCount, rows[i].firstDate, rows[i].lastDate]);
    }

    return csvRows.map(function(row) {
        return row.map(csvEscape).join(",");
    }).join("\r\n");
}

function dataUrlToBlobPromise(dataUrl) {
    return fetch(dataUrl).then(function(response) {
        return response.blob();
    });
}

function downloadDriveFileAsBlobPromise(fileId) {
    var url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media";
    return wftDriveFetch(url).then(function(response) {
        return response.blob();
    });
}

function runTasksWithConcurrency(tasks, limit, progressCallback) {
    return new Promise(function(resolve, reject) {
        var index = 0;
        var active = 0;
        var completed = 0;
        var results = [];

        function next() {
            if (completed >= tasks.length) {
                resolve(results);
                return;
            }

            while (active < limit && index < tasks.length) {
                (function(taskIndex) {
                    active += 1;
                    tasks[taskIndex]().then(function(result) {
                        results[taskIndex] = result;
                    }).catch(function(e) {
                        results[taskIndex] = { error: String(e && e.message ? e.message : e) };
                    }).then(function() {
                        active -= 1;
                        completed += 1;
                        if (progressCallback) progressCallback(completed, tasks.length);
                        next();
                    });
                }(index));
                index += 1;
            }
        }

        try {
            next();
        } catch (e) {
            reject(e);
        }
    });
}

function addAvailableImagesToStudentFolder(folder, studentName, studentData, options) {
    var sessions = getStudentSessions(studentData);
    var imageFolder = folder.folder("Photos");
    var manifest = [];
    var tasks = [];
    var includeImages = options && options.includeImages;
    var i;
    var j;
    var session;
    var images;
    var image;
    var fileName;

    if (!includeImages) {
        imageFolder.file("Photos not included.txt", "Images/photos were not included in this export. Re-run the export with the image option checked if needed.");
        return Promise.resolve();
    }

    for (i = 0; i < sessions.length; i += 1) {
        session = sessions[i] || {};
        images = session.images || session.photos || [];
        if (!Array.isArray(images)) images = [];

        for (j = 0; j < images.length; j += 1) {
            image = images[j] || {};
            fileName = sanitizeFileName((getSessionDate(session) || ("Session " + (i + 1))) + " - " + (image.name || ("Image " + (j + 1))));
            if (fileName.indexOf(".") === -1) {
                fileName += image.mimeType === "image/png" ? ".png" : ".jpg";
            }

            manifest.push({
                sessionIndex: i + 1,
                sessionDate: getSessionDate(session),
                originalName: image.name || "",
                exportedName: fileName,
                driveFileId: image.driveFileId || "",
                included: !!(image.dataUrl || image.originalDataUrl || image.driveFileId)
            });

            if (image.dataUrl || image.originalDataUrl || image.driveFileId) {
                (function(img, exportName) {
                    tasks.push(function() {
                        var blobPromise;
                        if (img.dataUrl || img.originalDataUrl) {
                            blobPromise = dataUrlToBlobPromise(img.dataUrl || img.originalDataUrl);
                        } else {
                            blobPromise = downloadDriveFileAsBlobPromise(img.driveFileId);
                        }
                        return blobPromise.then(function(blob) {
                            imageFolder.file(exportName, blob);
                            return true;
                        });
                    });
                }(image, fileName));
            }
        }
    }

    if (!tasks.length) {
        imageFolder.file("No available photos.txt", "No locally available images or downloadable Drive image IDs were found for this student.");
        imageFolder.file("photos-manifest.json", JSON.stringify(manifest, null, 2));
        return Promise.resolve();
    }

    return runTasksWithConcurrency(tasks, 3, function(done, total) {
        setWftArchiveStatus("Downloading images for " + studentName + " (" + done + " of " + total + ")...");
    }).then(function() {
        imageFolder.file("photos-manifest.json", JSON.stringify(manifest, null, 2));
    });
}

function addStudentExportFiles(folder, studentName, studentData, schoolYear, options) {
    var safeStudentName = sanitizeFileName(studentName);
    var richPortfolioHtml = buildStudentPortfolioHtml(studentName, studentData, schoolYear);
    folder.file("Portfolio.html", richPortfolioHtml);
    folder.file(safeStudentName + " - Portfolio.html", richPortfolioHtml);
    folder.file(safeStudentName + " - Portfolio Summary.html", buildStudentSummaryHtml(studentName, studentData, schoolYear));
    folder.file(safeStudentName + " - All Writing.json", JSON.stringify(studentData || { sessions: [] }, null, 2));
    folder.file(safeStudentName + " - Writing Sessions.csv", buildStudentSessionsCsv(studentName, studentData));
    folder.file(safeStudentName + " - Corrected Writing.txt", buildCorrectedWritingText(studentName, studentData));
    return addAvailableImagesToStudentFolder(folder, studentName, studentData, options || {});
}

function suggestSchoolYear() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    if (month >= 6) {
        return String(year) + "-" + String(year + 1);
    }
    return String(year - 1) + "-" + String(year);
}

function getActivePortfolioForExport() {
    var deletions = typeof getDeletionsData === "function" ? getDeletionsData() : {};
    var portfolio = getPortfolioData();
    if (typeof applyDeletionsToPortfolio === "function") {
        portfolio = applyDeletionsToPortfolio(portfolio, deletions);
    }
    return normalizePortfolioData(portfolio || {});
}

function createSchoolYearArchiveZip(schoolYear, options) {
    return new Promise(function(resolve, reject) {
        try {
            if (typeof JSZip === "undefined") {
                reject(new Error("JSZip is not loaded."));
                return;
            }

            var portfolio = getActivePortfolioForExport();
            var studentNames = Object.keys(portfolio || {}).sort(function(a, b) { return a.localeCompare(b); });
            var zip = new JSZip();
            var root = zip.folder(sanitizeFileName(schoolYear));
            var studentsFolder = root.folder("Students");
            var usedFolderNames = {};
            var archiveInfo = {
                schemaVersion: 1,
                archiveType: "WritingFeedbackToolYearEndArchive",
                schoolYear: schoolYear,
                createdAt: new Date().toISOString(),
                studentCount: studentNames.length,
                appVersion: (typeof WFT_APP_VERSION !== "undefined" ? WFT_APP_VERSION : "v9"),
                imagesIncluded: !!(options && options.includeImages)
            };
            var chain = Promise.resolve();
            var i;

            root.file("archive-info.json", JSON.stringify(archiveInfo, null, 2));
            root.file("Complete Portfolio.json", JSON.stringify(portfolio, null, 2));
            root.file("Class Summary.html", buildClassSummaryHtml(portfolio, schoolYear));
            root.file("Class Summary.csv", buildClassSummaryCsv(portfolio, schoolYear));

            for (i = 0; i < studentNames.length; i += 1) {
                (function(studentName, studentIndex) {
                    chain = chain.then(function() {
                        var studentData = portfolio[studentName] || { sessions: [] };
                        var folderName = getUniqueFolderName(studentName, usedFolderNames);
                        var folder = studentsFolder.folder(folderName);
                        setWftArchiveStatus("Adding " + studentName + " (" + (studentIndex + 1) + " of " + studentNames.length + ")...");
                        return addStudentExportFiles(folder, studentName, studentData, schoolYear, options || {});
                    });
                }(studentNames[i], i));
            }

            chain.then(function() {
                setWftArchiveStatus("Generating zip file...");
                return zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 }
                });
            }).then(function(blob) {
                resolve({
                    blob: blob,
                    fileName: "WritingFeedbackTool-Archive-" + sanitizeFileName(schoolYear) + ".zip",
                    studentCount: studentNames.length
                });
            }).catch(function(e) {
                reject(e);
            });
        } catch (e) {
            reject(e);
        }
    });
}

function createSingleStudentArchiveZip(studentName, options) {
    return new Promise(function(resolve, reject) {
        try {
            if (typeof JSZip === "undefined") {
                reject(new Error("JSZip is not loaded."));
                return;
            }

            var portfolio = getActivePortfolioForExport();
            var studentData = portfolio[studentName];
            var zip = new JSZip();
            var safeStudentName = sanitizeFileName(studentName);
            var portfolioFileName = safeStudentName + " - Portfolio.html";
            var fileName;

            if (!studentData) {
                reject(new Error("No portfolio data was found for " + studentName + "."));
                return;
            }

            setWftArchiveStatus("Creating portfolio export for " + studentName + "...");

            zip.file(portfolioFileName, buildStudentPortfolioHtml(studentName, studentData, suggestSchoolYear()));

            zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 6 }
            }).then(function(blob) {
                fileName = safeStudentName + " - Writing Portfolio.zip";
                resolve({ blob: blob, fileName: fileName, portfolioFileName: portfolioFileName });
            }).catch(function(e) {
                reject(e);
            });
        } catch (e) {
            reject(e);
        }
    });
}

function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

function ensureDriveSubfolderPromise(parentFolderId, folderName) {
    var query = "name='" + escapeDriveQueryValue(folderName) + "'"
        + " and mimeType='application/vnd.google-apps.folder'"
        + " and '" + escapeDriveQueryValue(parentFolderId) + "' in parents"
        + " and trashed=false";
    var searchUrl = "https://www.googleapis.com/drive/v3/files"
        + "?q=" + encodeURIComponent(query)
        + "&fields=files(id,name,modifiedTime)"
        + "&orderBy=modifiedTime desc";

    return wftDriveFetch(searchUrl).then(function(response) {
        return response.json();
    }).then(function(data) {
        var files = data && data.files ? data.files : [];
        if (files.length && files[0].id) {
            return files[0].id;
        }
        return wftDriveFetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: folderName,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentFolderId]
            })
        }).then(function(createResponse) {
            return createResponse.json();
        }).then(function(folder) {
            if (!folder || !folder.id) {
                throw new Error("Could not create Drive folder: " + folderName);
            }
            return folder.id;
        });
    });
}

function ensureArchiveYearFolderPromise(schoolYear) {
    return ensureDriveFolderPromise().then(function(rootFolderId) {
        return ensureDriveSubfolderPromise(rootFolderId, "Archives");
    }).then(function(archivesFolderId) {
        return ensureDriveSubfolderPromise(archivesFolderId, sanitizeFileName(schoolYear));
    });
}

function uploadBlobToDrivePromise(fileName, blob, mimeType, folderId) {
    var boundary = "----WFTArchiveBoundary" + Date.now();
    var metadata = JSON.stringify({
        name: fileName,
        parents: [folderId],
        mimeType: mimeType
    });
    var body = new Blob([
        "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + metadata + "\r\n",
        "--" + boundary + "\r\nContent-Type: " + mimeType + "\r\n\r\n",
        blob,
        "\r\n--" + boundary + "--"
    ], { type: "multipart/related; boundary=" + boundary });

    return wftDriveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size", {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=" + boundary },
        body: body
    }).then(function(response) {
        return response.json();
    }).then(function(fileData) {
        if (!fileData || !fileData.id) {
            throw new Error("Archive upload did not return a Drive file ID.");
        }
        return fileData;
    });
}

function saveArchiveZipToDrive(fileName, blob, schoolYear) {
    if (!driveAccessToken) {
        return Promise.reject(new Error("Please sign in with Google before saving an archive to Drive."));
    }
    return ensureArchiveYearFolderPromise(schoolYear).then(function(folderId) {
        return uploadBlobToDrivePromise(fileName, blob, "application/zip", folderId);
    });
}

function clearCurrentClassAfterSuccessfulArchive() {
    students = [];
    selectedStudent = "";
    localStorage.setItem("wft_selectedStudent", "");
    saveStudents();
    savePortfolioData({});

    if (typeof saveDeletionsData === "function" && typeof getEmptyDeletionsData === "function") {
        saveDeletionsData(getEmptyDeletionsData());
    }

    renderStudentList();
    populateStudentDropdown();

    try {
        refreshPortfolioDropdown();
        renderStudentPortfolio();
    } catch (e) {
        wftDebugWarn("[WFT Archive] Could not refresh UI after clearing class:", e);
    }

    if (typeof scheduleWftDriveSync === "function") {
        scheduleWftDriveSync("archive-clear-current-class");
    }
}

function archiveCurrentSchoolYear() {
    var defaultYear = suggestSchoolYear();
    var schoolYear = window.prompt("Enter the school year for this archive:", defaultYear);
    var includeImagesEl = document.getElementById("archiveIncludeImages");
    var includeImages = !!(includeImagesEl && includeImagesEl.checked);

    if (!schoolYear) return;
    schoolYear = String(schoolYear).trim();
    if (!schoolYear) {
        alert("Please enter a school year.");
        return;
    }

    if (!window.confirm("Archive current school year? The app will create a zip organized by student name, save it to Google Drive, download a copy, and then clear the active class list and portfolio after the archive is saved.")) {
        return;
    }

    setWftArchiveStatus("Starting archive...");

    createSchoolYearArchiveZip(schoolYear, { includeImages: includeImages })
        .then(function(result) {
            if (!result.blob || result.blob.size < 1000) {
                throw new Error("Archive file appears to be empty or invalid.");
            }
            setWftArchiveStatus("Saving archive to Google Drive...");
            return saveArchiveZipToDrive(result.fileName, result.blob, schoolYear).then(function() {
                return result;
            });
        })
        .then(function(result) {
            downloadBlob(result.blob, result.fileName);
            clearCurrentClassAfterSuccessfulArchive();
            setWftArchiveStatus("Archive complete. Current class was cleared.");
            alert("Archive created, saved to Drive, downloaded, and current class cleared.");
        })
        .catch(function(e) {
            wftDebugError("[WFT Archive] Archive failed:", e);
            setWftArchiveStatus("Archive failed. Current class was not cleared.");
            alert("The archive could not be completed. The current class was not cleared. " + (e && e.message ? e.message : e));
        });
}

function exportSelectedStudentPortfolio() {
    var select = document.getElementById("portfolioStudentSelect");
    var studentName = select && select.value ? select.value : "";
    var includeImagesEl = document.getElementById("archiveIncludeImages");
    var includeImages = !!(includeImagesEl && includeImagesEl.checked);

    if (!studentName) {
        alert("Please select a student above first, then click Export This Student.");
        updateExportSelectedStudentButton();
        return;
    }

    createSingleStudentArchiveZip(studentName, { includeImages: includeImages })
        .then(function(result) {
            if (!result.blob || result.blob.size < 500) {
                throw new Error("Student export appears to be empty or invalid.");
            }
            downloadBlob(result.blob, result.fileName);
            setWftArchiveStatus("Student export complete: " + studentName + ". Open the downloaded zip, then open " + (result.portfolioFileName || (studentName + " - Portfolio.html")) + ".");
        })
        .catch(function(e) {
            wftDebugError("[WFT Archive] Student export failed:", e);
            setWftArchiveStatus("Student export failed.");
            alert("The student export could not be completed. " + (e && e.message ? e.message : e));
        });
}



function setDuplicateSyncMaintenanceStatus(message, duplicateCount, checking) {
    var status = document.getElementById("duplicateSyncStatus");
    var cleanupButton = document.getElementById("duplicateSyncCleanupBtn");
    var checkButton = document.getElementById("duplicateSyncCheckBtn");
    var count = Number(duplicateCount || 0);

    if (status) {
        status.textContent = message || "Google Drive sync file status is not available.";
    }

    if (cleanupButton) {
        cleanupButton.style.display = count > 0 ? "inline-block" : "none";
        cleanupButton.disabled = !!checking;
    }

    if (checkButton) {
        checkButton.disabled = !!checking || !driveAccessToken;
        checkButton.textContent = checking ? "Checking..." : "Check now";
    }
}

function summarizeDuplicateSyncFilesPromise() {
    return findAllWftFilesByNameInRootPromise(WFT_SETTINGS_FILENAME).then(function(settingsFiles) {
        return findAllWftFilesByNameInRootPromise(WFT_PORTFOLIO_FILENAME).then(function(portfolioFiles) {
            return findAllWftFilesByNameInRootPromise(WFT_DELETIONS_FILENAME).then(function(deletionsFiles) {
                var details = [];
                var totalDuplicates = 0;

                function addDetail(label, files) {
                    var count = files && files.length ? files.length : 0;
                    var duplicates = count > 1 ? count - 1 : 0;
                    if (duplicates > 0) {
                        details.push(label + ": " + duplicates);
                        totalDuplicates += duplicates;
                    }
                }

                addDetail("settings", settingsFiles);
                addDetail("portfolio", portfolioFiles);
                addDetail("deletions", deletionsFiles);

                return {
                    totalDuplicates: totalDuplicates,
                    details: details
                };
            });
        });
    });
}

function withWftDuplicateCheckTimeout(promise, timeoutMs) {
    var timeoutHandle = null;
    var timeoutPromise = new Promise(function(resolve, reject) {
        timeoutHandle = setTimeout(function() {
            reject(new Error("Duplicate sync file check timed out."));
        }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).then(function(result) {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
        return result;
    }).catch(function(e) {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
        throw e;
    });
}

function checkDuplicateSyncFilesStatus() {
    if (!driveAccessToken) {
        setDuplicateSyncMaintenanceStatus("Sign in with Google Drive to check for duplicate sync files.", 0, false);
        return Promise.resolve(null);
    }

    setDuplicateSyncMaintenanceStatus("Checking Google Drive sync files...", 0, true);

    return withWftDuplicateCheckTimeout(summarizeDuplicateSyncFilesPromise(), 15000).then(function(summary) {
        if (summary.totalDuplicates > 0) {
            setDuplicateSyncMaintenanceStatus("Duplicate sync files found. The app is using the newest copy. You can move older duplicate files to Backup. Details: " + summary.details.join(", ") + ".", summary.totalDuplicates, false);
        } else {
            setDuplicateSyncMaintenanceStatus("No duplicate sync files found. Google Drive sync looks tidy.", 0, false);
        }
        return summary;
    }).catch(function(e) {
        wftDebugError("[WFT Duplicate Check] Failed:", e);
        if (e && e.message && e.message.indexOf("timed out") !== -1) {
            setDuplicateSyncMaintenanceStatus("Google Drive is connected, but the duplicate-file check took too long. This does not mean sync failed. Try Check now again later if needed.", 0, false);
        } else {
            setDuplicateSyncMaintenanceStatus("Google Drive is connected, but duplicate sync files could not be checked right now.", 0, false);
        }
        return null;
    });
}

function findAllWftFilesByNameInRootPromise(filename) {
    return ensureDriveFolderPromise().then(function(folderId) {
        var query = "name='" + escapeDriveQueryValue(filename) + "'"
            + " and '" + escapeDriveQueryValue(folderId) + "' in parents"
            + " and trashed=false";
        var url = "https://www.googleapis.com/drive/v3/files"
            + "?q=" + encodeURIComponent(query)
            + "&fields=files(id,name,modifiedTime,createdTime,size,mimeType,parents)"
            + "&orderBy=modifiedTime desc";
        return wftDriveFetch(url).then(function(response) {
            return response.json();
        }).then(function(data) {
            return data && data.files ? data.files : [];
        });
    });
}

function moveDriveFileToFolderPromise(fileId, fromFolderId, toFolderId) {
    var url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId)
        + "?addParents=" + encodeURIComponent(toFolderId)
        + "&removeParents=" + encodeURIComponent(fromFolderId)
        + "&fields=id,parents";
    return wftDriveFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
    }).then(function(response) {
        return response.json();
    });
}

function backupDuplicateFilesForNamePromise(filename, backupFolderId, rootFolderId) {
    return findAllWftFilesByNameInRootPromise(filename).then(function(files) {
        var chain = Promise.resolve(0);
        var i;
        if (!files || files.length <= 1) {
            return 0;
        }
        setCachedWftDriveFileId(filename, files[0].id);
        for (i = 1; i < files.length; i += 1) {
            (function(file) {
                chain = chain.then(function(count) {
                    setWftArchiveStatus("Moving duplicate " + filename + " to Duplicate Backups...");
                    return moveDriveFileToFolderPromise(file.id, rootFolderId, backupFolderId).then(function() {
                        return count + 1;
                    });
                });
            }(files[i]));
        }
        return chain;
    });
}

function moveDuplicateSyncFilesToBackup() {
    if (!driveAccessToken) {
        alert("Please sign in with Google before cleaning up duplicate sync files.");
        return;
    }

    if (!window.confirm("Move duplicate sync files to a 'Duplicate Backups' folder? The newest file for each sync type will remain active. This is safer than deleting duplicates.")) {
        return;
    }

    setWftArchiveStatus("Checking for duplicate sync files...");

    ensureDriveFolderPromise().then(function(rootFolderId) {
        return ensureDriveSubfolderPromise(rootFolderId, "Duplicate Backups").then(function(backupFolderId) {
            return backupDuplicateFilesForNamePromise(WFT_SETTINGS_FILENAME, backupFolderId, rootFolderId)
                .then(function(count1) {
                    return backupDuplicateFilesForNamePromise(WFT_PORTFOLIO_FILENAME, backupFolderId, rootFolderId).then(function(count2) {
                        return count1 + count2;
                    });
                })
                .then(function(count12) {
                    return backupDuplicateFilesForNamePromise(WFT_DELETIONS_FILENAME, backupFolderId, rootFolderId).then(function(count3) {
                        return count12 + count3;
                    });
                });
        });
    }).then(function(totalMoved) {
        setWftArchiveStatus("Duplicate cleanup complete. Moved " + totalMoved + " duplicate file(s) to Duplicate Backups.");
        checkDuplicateSyncFilesStatus();
        alert("Duplicate cleanup complete. Moved " + totalMoved + " duplicate file(s) to Duplicate Backups.");
    }).catch(function(e) {
        wftDebugError("[WFT Duplicate Cleanup] Failed:", e);
        setWftArchiveStatus("Duplicate cleanup failed.");
        alert("Duplicate cleanup failed. " + (e && e.message ? e.message : e));
    });
}

function resetCurrentClassData() {
    if (!window.confirm("Reset the current class? This will clear the student list and active portfolio. Use this only if you already have an archive or backup.")) {
        return;
    }
    if (!window.confirm("Are you sure? This does not create an archive.")) {
        return;
    }

    var portfolio = getPortfolioData();
    var currentStudents = Array.isArray(students) ? students.slice() : [];
    var studentNames = Object.keys(portfolio || {});
    var i;
    var s;
    var name;
    var sessions;
    var sessionId;

    // Record the reset as intentional deletions before clearing local data.
    // This prevents old class data from being union-merged back from Google Drive.
    for (i = 0; i < currentStudents.length; i += 1) {
        recordStudentDeletion(currentStudents[i]);
    }

    // Also protect portfolio-only entries and each saved writing session.
    // If the same student name is intentionally re-added later, add/import clears
    // only the student-level deletion. Session-level deletion records remain so old
    // portfolio sessions do not silently come back from Drive.
    for (s = 0; s < studentNames.length; s += 1) {
        name = studentNames[s];
        recordStudentDeletion(name);
        sessions = portfolio[name] && Array.isArray(portfolio[name].sessions) ? portfolio[name].sessions : [];
        for (i = 0; i < sessions.length; i += 1) {
            sessionId = getSessionKey(sessions[i]);
            if (sessionId) {
                recordSessionDeletion(name, sessionId);
            }
        }
    }

    students = [];
    selectedStudent = "";
    localStorage.setItem("wft_selectedStudent", "");
    saveStudents();
    savePortfolioData({});

    renderStudentList();
    populateStudentDropdown();

    try {
        refreshPortfolioDropdown();
        renderStudentPortfolio();
    } catch (e) {
        wftDebugWarn("[WFT Reset] Could not refresh UI:", e);
    }

    if (typeof WFT_SYNC_ENGINE_V2 !== "undefined" && WFT_SYNC_ENGINE_V2) {
        if (typeof markWftSettingsDirty === "function") {
            markWftSettingsDirty("reset-class");
        }
        if (typeof markWftPortfolioDirty === "function") {
            markWftPortfolioDirty("reset-class");
        }
        if (typeof markWftDeletionsDirty === "function") {
            markWftDeletionsDirty("reset-class");
        }
        if (typeof flushWftCloudSyncNow === "function") {
            flushWftCloudSyncNow("reset-class");
        }
    }

    setWftArchiveStatus("Current class reset. Students and sessions were recorded as deleted so old class data stays deleted.");
}

function updateSelectedImagePreview() {
    var wrap = document.getElementById("ocrPreviewWrap");
    var list = document.getElementById("ocrPreviewList");
    if (!wrap || !list) return;

    if (selectedImages.length) {
        var html = "";
        for (var i = 0; i < selectedImages.length; i++) {
            var item = selectedImages[i];
            html += '<div class="ocr-preview-card' + (i === 0 ? ' primary' : '') + '" draggable="true" data-index="' + i + '">' +
                '<img class="ocr-preview" draggable="false" src="' + item.dataUrl + '" alt="' + escapeHtml((i === 0 ? "First selected writing sample preview" : "Selected writing sample preview " + (i + 1))) + '" data-caption="' + escapeHtml(item.name || ("Image " + (i + 1))) + '" onclick="openImageLightbox(this)" title="Click to enlarge">' +
                '<div class="ocr-preview-details">' +
                '<div class="ocr-preview-meta"><div class="ocr-preview-order">Image ' + (i + 1) + ' of ' + selectedImages.length + '</div>' +
                '<div>' + escapeHtml(item.name || ("image " + (i + 1))) + '</div></div>' +
                '<div class="ocr-preview-grip">Drag to reorder</div>' +
                '<div class="ocr-preview-actions">' +
                '<button type="button" class="ocr-preview-move" data-direction="earlier" data-index="' + i + '"' + (i === 0 ? ' disabled="disabled"' : '') + '>Move Earlier</button>' +
                '<button type="button" class="ocr-preview-move" data-direction="later" data-index="' + i + '"' + (i === selectedImages.length - 1 ? ' disabled="disabled"' : '') + '>Move Later</button>' +
                '<button type="button" class="ocr-preview-crop" data-index="' + i + '">&#x2702; Crop</button>' +
                '<button type="button" class="ocr-preview-reset" data-index="' + i + '"' + (!selectedImages[i].originalDataUrl ? ' disabled="disabled"' : '') + '>&#x21BA; Reset Crop</button>' +
                '</div>' +
                '<button type="button" class="ocr-preview-remove" data-index="' + i + '">Remove</button>' +
                '</div>' +
                '</div>';
        }
        list.innerHTML = html;
        wrap.classList.add("show");
        var panelBody = wrap.closest(".ocr-panel-body");
        if (panelBody) panelBody.classList.add("has-photos");
        bindPreviewReorderHandlers();
        if (selectedImages.length === 1) {
            setOcrStatus('1 image ready. Click Extract Text for Analysis to run OCR with ' + OCR_MODEL + '.', '');
        } else {
            setOcrStatus(String(selectedImages.length) + ' images ready. They will be extracted in the order shown when you click Extract Text for Analysis.', '');
        }
    } else {
        list.innerHTML = "";
        wrap.classList.remove("show");
        var panelBody = wrap.closest(".ocr-panel-body");
        if (panelBody) panelBody.classList.remove("has-photos");
        setOcrStatus("Upload or drag an image, then extract the text.", "");
    }
    updateOcrControls();
}

function fileToDataUrl(file) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = function() { reject(new Error("Could not read the selected image.")); };
        reader.readAsDataURL(file);
    });
}

function loadImageElement(src) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        img.onload = function() { resolve(img); };
        img.onerror = function() { reject(new Error("Could not load the selected image.")); };
        img.src = src;
    });
}

async function optimizeImageForOcr(file) {
    var originalDataUrl = await fileToDataUrl(file);
    var img = await loadImageElement(originalDataUrl);
    var maxSide = 2200;
    var width = img.naturalWidth || img.width;
    var height = img.naturalHeight || img.height;
    if (!width || !height) return originalDataUrl;

    var scale = Math.min(1, maxSide / Math.max(width, height));
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    var output = canvas.toDataURL("image/jpeg", 0.92);
    if (output.length > originalDataUrl.length && originalDataUrl.indexOf("data:image/") === 0) {
        return originalDataUrl;
    }
    return output;
}

async function handleSelectedImages(files) {
    if (!files || !files.length) return;
    var imageFiles = [];
    for (var i = 0; i < files.length; i++) {
        if (files[i] && files[i].type && files[i].type.indexOf("image/") === 0) imageFiles.push(files[i]);
    }
    if (!imageFiles.length) {
        setOcrStatus("Please choose one or more image files.", "error");
        return;
    }

    var existingCount = selectedImages.length;
    setOcrStatus(imageFiles.length === 1 ? "Preparing image..." : "Preparing " + imageFiles.length + " images...", "");
    updateOcrControls();

    var prepared = [];
    try {
        for (var j = 0; j < imageFiles.length; j++) {
            var optimizedDataUrl = await optimizeImageForOcr(imageFiles[j]);
            prepared.push({
                dataUrl: optimizedDataUrl,
                name: imageFiles[j].name || ('image ' + (existingCount + j + 1)),
                mimeType: imageFiles[j].type || 'image/jpeg',
                extractedText: '',
                extractionPromise: null,
                driveFileId: ''
            });
        }
        selectedImages = selectedImages.concat(prepared);
        syncSelectedImageState();
        updateSelectedImagePreview();
        syncUiState();
        refreshScoreWeightingDescription();
        if (prepared.length === 1) {
            setOcrStatus("Image added. Review the queue, then click Extract Text for Analysis when you are ready.", "");
        } else {
            setOcrStatus(String(prepared.length) + " images added. " + String(selectedImages.length) + " images are now queued in the order shown.", "");
        }
    } catch (e) {
        syncSelectedImageState();
        updateSelectedImagePreview();
        syncUiState();
        setOcrStatus(e.message || "Could not prepare the selected images.", "error");
    }
}

function getDroppedImageFiles(event) {
    var results = [];
    if (!event || !event.dataTransfer || !event.dataTransfer.files || !event.dataTransfer.files.length) {
        return results;
    }
    var files = event.dataTransfer.files;
    for (var i = 0; i < files.length; i++) {
        if (files[i] && files[i].type && files[i].type.indexOf("image/") === 0) {
            results.push(files[i]);
        }
    }
    return results;
}

function preventDragDefaults(event) {
    if (!event) return;
    event.preventDefault();
    event.stopPropagation();
}

function isPreviewReorderDrag(event) {
    if (previewDragIndex >= 0) return true;
    if (!event || !event.dataTransfer || !event.dataTransfer.types) return false;
    var types = event.dataTransfer.types;
    for (var i = 0; i < types.length; i++) {
        if (types[i] === "application/x-ocr-preview-index") return true;
    }
    return false;
}

function setDropActiveState(isActive) {
    var panel = document.querySelector(".ocr-panel");
    var app = document.querySelector(".app");
    if (isActive) {
        if (panel) panel.classList.add("drag-active");
        if (app) app.classList.add("drag-active-global");
    } else {
        if (panel) panel.classList.remove("drag-active");
        if (app) app.classList.remove("drag-active-global");
    }
}

function removeSelectedImageAt(index) {
    if (typeof index !== "number" || index < 0 || index >= selectedImages.length) return;
    selectedImages.splice(index, 1);
    syncSelectedImageState();
    updateSelectedImagePreview();
    syncUiState();
    refreshScoreWeightingDescription();
    if (selectedImages.length) {
        setOcrStatus(String(selectedImages.length) + ' images remain in the queue. They will be extracted in the order shown.', '');
    } else {
        setOcrStatus("No images are currently queued.", "");
    }
}

function moveSelectedImage(index, direction) {
    if (typeof index !== "number" || index < 0 || index >= selectedImages.length) return;
    var targetIndex = direction === "earlier" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedImages.length) return;
    var moved = selectedImages.splice(index, 1)[0];
    selectedImages.splice(targetIndex, 0, moved);
    for (var i = 0; i < selectedImages.length; i++) {
      selectedImages[i].extractedText = '';
      selectedImages[i].extractionPromise = null;
    }
    syncSelectedImageState();
    updateSelectedImagePreview();
    refreshScoreWeightingDescription();
    setOcrStatus('Queue order updated. Images will be extracted in the order shown.', '');
}

function clearPreviewDragClasses() {
    var cards = document.querySelectorAll(".ocr-preview-card");
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove("dragging");
        cards[i].classList.remove("drag-over");
        cards[i].classList.remove("drag-over-left");
        cards[i].classList.remove("drag-over-right");
        cards[i].classList.remove("drag-over-top");
        cards[i].classList.remove("drag-over-bottom");
    }
}

function isMobilePreviewLayout() {
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
}

function bindPreviewReorderHandlers() {
    var list = document.getElementById("ocrPreviewList");
    if (!list) return;

    if (list._handlersAttached) return;
    list._handlersAttached = true;

    list.addEventListener("click", function(event) {
        var btn = event.target.closest(".ocr-preview-move");
        if (!btn) return;
        var index = parseInt(btn.getAttribute("data-index"), 10);
        var direction = btn.getAttribute("data-direction");
        moveSelectedImage(index, direction);
    });

    list.addEventListener("click", function(event) {
        var cropBtn2 = event.target.closest(".ocr-preview-crop");
        if (cropBtn2) {
            var cidx = parseInt(cropBtn2.getAttribute("data-index"), 10);
            if (!isNaN(cidx)) openCropModal(cidx);
            return;
        }
        var resetBtn2 = event.target.closest(".ocr-preview-reset");
        if (resetBtn2) {
            var ridx = parseInt(resetBtn2.getAttribute("data-index"), 10);
            if (!isNaN(ridx) && selectedImages[ridx] && selectedImages[ridx].originalDataUrl) {
                selectedImages[ridx].dataUrl = selectedImages[ridx].originalDataUrl;
                selectedImages[ridx].originalDataUrl = null;
                selectedImages[ridx].extractedText = "";
                selectedImages[ridx].extractionPromise = null;
                updateSelectedImagePreview();
                setOcrStatus("Crop reset for image " + (ridx + 1) + ". Click \"Extract Text for Analysis\" to re-run OCR.", "success");
            }
            return;
        }
        var btn = event.target.closest(".ocr-preview-remove");
        if (!btn) return;
        var index = parseInt(btn.getAttribute("data-index"), 10);
        removeSelectedImageAt(index);
    });

    list.addEventListener("dragstart", function(event) {
        var card = event.target.closest(".ocr-preview-card");
        if (!card) return;
        previewDragIndex = parseInt(card.getAttribute("data-index"), 10);
        clearPreviewDragClasses();
        card.classList.add("dragging");
        list.classList.add("is-dragging");
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            var dragIndexValue = card.getAttribute("data-index") || "";
            event.dataTransfer.setData("text/plain", dragIndexValue);
            try {
                event.dataTransfer.setData("application/x-ocr-preview-index", dragIndexValue);
            } catch (e) {
                // Some browsers may block custom MIME types; text/plain remains the fallback.
            }
        }
    });

    list.addEventListener("dragend", function() {
        clearPreviewDragClasses();
        list.classList.remove("is-dragging");
        previewDragIndex = -1;
    });

    list.addEventListener("dragover", function(event) {
        if (!isPreviewReorderDrag(event)) return;
        event.preventDefault();
        var card = event.target.closest(".ocr-preview-card");
        if (!card) return;
        var draggingCard = list.querySelector(".ocr-preview-card.dragging");
        if (!draggingCard || draggingCard === card) return;
        var rect = card.getBoundingClientRect();
        var allCards = list.querySelectorAll(".ocr-preview-card");
        var useVerticalDropZones = isMobilePreviewLayout();
        for (var i = 0; i < allCards.length; i++) {
            allCards[i].classList.remove("drag-over-left", "drag-over-right", "drag-over-top", "drag-over-bottom");
        }
        if (useVerticalDropZones) {
            if (event.clientY < rect.top + rect.height / 2) {
                card.classList.add("drag-over-top");
            } else {
                card.classList.add("drag-over-bottom");
            }
        } else {
            if (event.clientX < rect.left + rect.width / 2) {
                card.classList.add("drag-over-left");
            } else {
                card.classList.add("drag-over-right");
            }
        }
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });

    list.addEventListener("dragleave", function(event) {
        if (!list.contains(event.relatedTarget)) {
            clearPreviewDragClasses();
        }
    });

    list.addEventListener("drop", function(event) {
        if (!isPreviewReorderDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        var card = event.target.closest(".ocr-preview-card");
        if (!card) {
            clearPreviewDragClasses();
            list.classList.remove("is-dragging");
            previewDragIndex = -1;
            return;
        }
        var toIndex = parseInt(card.getAttribute("data-index"), 10);
        var fromValue = "";
        if (event.dataTransfer) {
            fromValue = event.dataTransfer.getData("application/x-ocr-preview-index") || event.dataTransfer.getData("text/plain");
        }
        var fromIndex = parseInt(fromValue, 10);
        if (isNaN(fromIndex) && previewDragIndex >= 0) {
            fromIndex = previewDragIndex;
        }
        if (isNaN(fromIndex) || isNaN(toIndex) || fromIndex === toIndex) {
            clearPreviewDragClasses();
            list.classList.remove("is-dragging");
            previewDragIndex = -1;
            return;
        }
        var rect = card.getBoundingClientRect();
        var insertBeforeTarget = isMobilePreviewLayout()
            ? event.clientY < (rect.top + rect.height / 2)
            : event.clientX < (rect.left + rect.width / 2);
        var items = selectedImages.slice();
        var moved = items.splice(fromIndex, 1)[0];
        var adjustedTo = toIndex > fromIndex ? toIndex - 1 : toIndex;
        var insertAt = insertBeforeTarget ? adjustedTo : adjustedTo + 1;
        if (insertAt < 0) insertAt = 0;
        if (insertAt > items.length) insertAt = items.length;
        items.splice(insertAt, 0, moved);
        selectedImages.length = 0;
        for (var k = 0; k < items.length; k++) {
            selectedImages.push(items[k]);
        }
        for (var m = 0; m < selectedImages.length; m++) {
            selectedImages[m].extractedText = "";
            selectedImages[m].extractionPromise = null;
        }
        clearPreviewDragClasses();
        list.classList.remove("is-dragging");
        previewDragIndex = -1;
        syncSelectedImageState();
        updateSelectedImagePreview();
        refreshScoreWeightingDescription();
        setOcrStatus("Queue order updated. Images will be extracted in the order shown.", "");
    });
}

function bindDesktopImageDrop() {
    var app = document.querySelector(".app");
    if (!app) return;

    ["dragenter", "dragover"].forEach(function(type) {
        app.addEventListener(type, function(event) {
            if (isPreviewReorderDrag(event)) return;
            preventDragDefaults(event);
            setDropActiveState(true);
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        });
    });

    ["dragleave", "dragend"].forEach(function(type) {
        app.addEventListener(type, function(event) {
            if (isPreviewReorderDrag(event)) return;
            preventDragDefaults(event);
            if (!app.contains(event.relatedTarget)) {
                setDropActiveState(false);
            }
        });
    });

    app.addEventListener("drop", async function(event) {
        if (isPreviewReorderDrag(event)) {
            preventDragDefaults(event);
            setDropActiveState(false);
            return;
        }
        preventDragDefaults(event);
        setDropActiveState(false);
        var files = getDroppedImageFiles(event);
        if (!files.length) {
            setOcrStatus("Please drop one or more image files.", "error");
            return;
        }
        var panel = document.getElementById("ocrPanel");
        if (panel) panel.open = true;
        await handleSelectedImages(files);
        refreshScoreWeightingDescription();
    });
}


function getMedianNumber(values) {
    var nums = Array.isArray(values) ? values.slice().filter(function(v) {
        return typeof v === "number" && !isNaN(v);
    }) : [];
    if (!nums.length) return 0;
    nums.sort(function(a, b) { return a - b; });
    var mid = Math.floor(nums.length / 2);
    if (nums.length % 2) return nums[mid];
    return (nums[mid - 1] + nums[mid]) / 2;
}

function analyzeOcrPageMetrics(text) {
    var lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    var lengths = [];
    for (var i = 0; i < lines.length; i++) {
        var trimmed = lines[i].trim();
        if (trimmed.length >= 12) lengths.push(trimmed.length);
    }
    var median = getMedianNumber(lengths);
    var maxLen = 0;
    for (var j = 0; j < lengths.length; j++) {
        if (lengths[j] > maxLen) maxLen = lengths[j];
    }
    return {
        lines: lines,
        typicalLineLength: median || maxLen || 0,
        maxLineLength: maxLen || median || 0
    };
}

function startsWithContinuationWord(line) {
    return /^(and|but|so|because|then|or|yet|for|when|while|after|before|if|although|though|as|until|since|therefore|however)\b/i.test(String(line || "").trim());
}

function endsWithStrongSentencePunctuation(line) {
    return /[.!?]["')\]]*$/.test(String(line || "").trim());
}

function lineStartsLowercase(line) {
    var trimmed = String(line || "").trim();
    return /^[a-z]/.test(trimmed);
}

function lineHasIndent(line) {
    return /^[ \t]{2,}\S/.test(String(line || ""));
}

function looksLikeLikelyTitleLine(line) {
    var trimmed = String(line || "").trim();
    if (!trimmed) return false;
    var words = trimmed.split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 8 || trimmed.length > 60) return false;
    if (/[.!?,:;]$/.test(trimmed)) return false;
    if (!/^[A-Z0-9"']/.test(trimmed)) return false;
    return /^[A-Za-z0-9'" -]+$/.test(trimmed);
}

function joinOcrParagraphLines(lines) {
    var result = "";
    for (var i = 0; i < lines.length; i++) {
        var part = String(lines[i] || "").trim();
        if (!part) continue;
        if (!result) {
            result = part;
        } else if (/-$/.test(result)) {
            result += part;
        } else {
            result += " " + part;
        }
    }
    return result.trim();
}

function makeOcrLineInfo(rawLine, pageIndex, lineIndex, metrics) {
    var trimmed = String(rawLine || "").trim();
    var typical = metrics && metrics.typicalLineLength ? metrics.typicalLineLength : 0;
    return {
        raw: String(rawLine || ""),
        text: trimmed,
        pageIndex: pageIndex,
        lineIndex: lineIndex,
        hasIndent: lineHasIndent(rawLine),
        endsSentence: endsWithStrongSentencePunctuation(trimmed),
        endsSoftPunctuation: /[,;:]$/.test(trimmed),
        startsLowercase: lineStartsLowercase(trimmed),
        startsContinuationWord: startsWithContinuationWord(trimmed),
        startsWithQuote: /^["']/.test(trimmed),
        wordCount: countWords(trimmed),
        isLikelyTitle: looksLikeLikelyTitleLine(trimmed),
        isFullLine: typical ? (trimmed.length >= Math.max(18, Math.round(typical * 0.85))) : false
    };
}

function shouldBreakOcrParagraph(prevInfo, nextInfo, state) {
    if (!prevInfo || !nextInfo) return false;
    if (state && state.forceBreakAfterPrevious) return true;

    var isPageBoundary = !!(state && state.isPageBoundary);

    if (isPageBoundary) {
        if (!prevInfo.endsSentence) return false;
        if (prevInfo.isFullLine && !nextInfo.hasIndent) return false;
    }

    var score = 0;

    if (nextInfo.hasIndent) score += 4;
    else score -= 1;

    if (prevInfo.endsSentence) score += 1;
    else score -= 4;

    if (prevInfo.isFullLine) score -= 2;
    else if (prevInfo.endsSentence) score += 2;

    if (prevInfo.endsSoftPunctuation) score -= 1;
    if (nextInfo.startsLowercase) score -= 3;
    if (nextInfo.startsContinuationWord) score -= 2;

    if (nextInfo.startsWithQuote && prevInfo.endsSentence) score += 2;
    if (prevInfo.startsWithQuote && nextInfo.startsWithQuote) score += 1;
    if (nextInfo.isLikelyTitle) score += 3;

    if (isPageBoundary) score -= 1;

    return score >= 3;
}

function reconstructParagraphsFromOcrPages(pageTexts) {
    var pages = Array.isArray(pageTexts) ? pageTexts : [String(pageTexts || "")];
    if (!pages.length) return "";

    var pageData = [];
    for (var p = 0; p < pages.length; p++) {
        pageData.push(analyzeOcrPageMetrics(pages[p]));
    }

    var paragraphs = [];
    var currentParagraph = [];
    var previousInfo = null;
    var forceBreakAfterPrevious = false;

    function flushParagraph() {
        if (!currentParagraph.length) return;
        var joined = joinOcrParagraphLines(currentParagraph);
        if (joined) paragraphs.push(joined);
        currentParagraph = [];
    }

    for (var pageIndex = 0; pageIndex < pageData.length; pageIndex++) {
        var page = pageData[pageIndex];
        for (var lineIndex = 0; lineIndex < page.lines.length; lineIndex++) {
            var rawLine = page.lines[lineIndex];
            var trimmed = String(rawLine || "").trim();

            if (!trimmed) {
                flushParagraph();
                previousInfo = null;
                forceBreakAfterPrevious = false;
                continue;
            }

            var info = makeOcrLineInfo(rawLine, pageIndex, lineIndex, page);

            if (!previousInfo) {
                currentParagraph.push(info.text);
                previousInfo = info;
                forceBreakAfterPrevious = (paragraphs.length === 0 && currentParagraph.length === 1 && info.isLikelyTitle);
                continue;
            }

            var shouldBreak = shouldBreakOcrParagraph(previousInfo, info, {
                isPageBoundary: previousInfo.pageIndex !== info.pageIndex,
                forceBreakAfterPrevious: forceBreakAfterPrevious
            });

            if (shouldBreak) flushParagraph();
            currentParagraph.push(info.text);
            previousInfo = info;
            forceBreakAfterPrevious = (paragraphs.length === 0 && currentParagraph.length === 1 && info.isLikelyTitle);
        }
    }

    flushParagraph();
    return paragraphs.join("\n\n").trim();
}

function stripAiCodeFence(text) {
    var value = String(text || "").trim();
    value = value.replace(/^```[a-zA-Z]*\s*/i, "");
    value = value.replace(/```$/i, "");
    return value.trim();
}

function parseFirstJsonObject(text) {
    var value = stripAiCodeFence(text);
    try {
        return JSON.parse(value);
    } catch (e) { }

    var start = value.indexOf("{");
    var end = value.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
        try {
            return JSON.parse(value.slice(start, end + 1));
        } catch (e2) { }
    }
    return null;
}

function buildOcrPageMarkedText(pageTexts) {
    var pages = Array.isArray(pageTexts) ? pageTexts : [String(pageTexts || "")];
    var parts = [];
    for (var i = 0; i < pages.length; i++) {
        var pageText = String(pages[i] || "").trim();
        if (pageText) {
            parts.push("[PAGE " + (i + 1) + "]\n" + pageText);
        }
    }
    return parts.join("\n\n");
}

async function reconstructStudentWritingFromOcrPages(pageTexts, model) {
    var fallback = reconstructParagraphsFromOcrPages(pageTexts);
    var markedText = buildOcrPageMarkedText(pageTexts);
    if (!markedText || countWords(markedText) < 20) return fallback;

    try {
        var prompt = [
            "You are reconstructing student writing after OCR from one or more photos.",
            "The OCR text below includes page markers such as [PAGE 1].",
            "Your job is only to reconstruct the student's intended spacing, line wrapping, and paragraph breaks.",
            "Do not correct spelling, grammar, punctuation, capitalization, word choice, or sentence structure.",
            "Do not rewrite the student's wording.",
            "Do not add new words or remove student words unless they are only page markers.",
            "Do not treat a new page or new photo as a paragraph break by itself.",
            "Join across page breaks when the previous page ends mid-sentence, mid-phrase, or on a full line that continues on the next page.",
            "Join ordinary wrapped handwriting lines into sentences and paragraphs.",
            "Preserve a paragraph break only when there is strong evidence, such as a blank line, clear indentation, a completed thought followed by a new thought, a new speaker, or a heading/title.",
            "If unsure, keep the text in the same paragraph instead of inventing a new paragraph.",
            "Return only the reconstructed student writing. Do not include explanations, markdown, labels, or page markers.",
            "",
            markedText
        ].join("\n");
        var response = await callOpenRouter(model || OCR_MODEL, prompt);
        var cleaned = stripAiCodeFence(response).replace(/^Reconstructed student writing:\s*/i, "").trim();
        if (countWords(cleaned) >= Math.max(10, Math.round(countWords(fallback) * 0.75))) {
            return cleaned;
        }
    } catch (e) {
        wftDebugWarn("AI paragraph reconstruction failed; using local OCR reconstruction.", e);
    }

    return fallback;
}


async function extractTextFromSelectedImage(isAutomatic) {
    // When this function is used directly as a click handler, the browser passes
    // a MouseEvent as the first argument. Treat only a literal true as automatic.
    // This keeps the OCR path independent from button events and Google Drive sign-in.
    isAutomatic = isAutomatic === true;

    if (!selectedImages.length) {
        setOcrStatus("Choose an image first.", "error");
        return "";
    }

    refreshApiKeyRuntimeValue();
    if (!API_KEY) {
        setOcrStatus("Open System Settings and paste your OpenRouter API key before extracting text.", "error");
        return "";
    }

    if (selectedImages.length === 1) {
        syncSelectedImageState();
        if (selectedImageExtractionPromise) return selectedImageExtractionPromise;
        if (selectedImageExtractedText) return selectedImageExtractedText;
    }

    isAnalyzing = true;
    syncUiState();
    var extractBtn = document.getElementById("extractTextBtn");
    setLoadingButtonState(extractBtn, true, "Extracting...");
    setOcrStatus(isAutomatic ? "Extracting text from image automatically..." : (selectedImages.length > 1 ? "Extracting text from " + selectedImages.length + " images..." : "Extracting text from image..."), "");

    var prompt = [
        "Transcribe only the student writing from the main page in focus. If parts of neighboring pages are visible on the left or right side of the photo, ignore those partial pages completely. Do not include stray words, sentence fragments, or handwriting from outside the main page being photographed.",
        "Important rules:",
        "1. Preserve spelling, capitalization, punctuation, paragraph breaks, and line breaks as closely as possible.",
        "2. Do not correct grammar or rewrite anything.",
        "3. Do not add labels, explanations, quotation marks, markdown, or extra text.",
        "4. If part of one word is truly unreadable, use [unclear] only for that unreadable part.",
        "5. Return only the transcription.",
        "6. If the page contains a fill-in-the-blank or sentence-completion worksheet, transcribe the full sentence as written, including any pre-printed prompt words and the student's handwritten answer together as one complete line. Do not list only the answers. Do not skip the printed parts of each sentence.",
        "7. Focus only on the main page centered in the image. Ignore partial pages, page edges, or neighboring writing visible to the left or right of the page in focus."
    ].join("\n");

    selectedImageExtractionPromise = (async function() {
        try {
            var combinedParts = [];
            for (var i = 0; i < selectedImages.length; i++) {
                var item = selectedImages[i];
                var extracted = "";
                if (item.extractedText) {
                    extracted = item.extractedText;
                } else {
                    setOcrStatus(
                        selectedImages.length > 1
                            ? "Extracting text from image " + (i + 1) + " of " + selectedImages.length + "..."
                            : (isAutomatic ? "Extracting text from image automatically..." : "Extracting text from image..."),
                        ""
                    );
                    extracted = await callOpenRouterImage(OCR_MODEL, prompt, item.dataUrl || "");
                    extracted = String(extracted || "").replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
                    item.extractedText = extracted;
                }
                if (extracted) {
                    combinedParts.push(extracted);
                }
            }

            setOcrStatus(
                selectedImages.length > 1
                    ? "Reconstructing paragraphs across " + selectedImages.length + " pages..."
                    : "Reconstructing paragraphs...",
                ""
            );
            var combinedText = await reconstructStudentWritingFromOcrPages(combinedParts, OCR_MODEL);
            syncSelectedImageState();
            selectedImageExtractedText = selectedImages.length === 1 ? combinedText : "";
            document.getElementById("studentWriting").value = combinedText;
            syncUiState();

            if (isAutoGenreSelected()) {
                setOcrStatus("Checking writing type from the whole passage...", "");
                try {
                    await classifyWritingGenreWithAi(combinedText, OCR_MODEL, { updateUi: true, reason: "ocr" });
                } catch (eGenre) {
                    wftDebugWarn("AI writing type check after OCR failed; using local fallback.", eGenre);
                    updateGenreReviewBox();
                }
            }

            setOcrStatus(
                selectedImages.length > 1
                    ? "Text from " + selectedImages.length + " images was extracted, reconstructed, and inserted into the writing box using " + OCR_MODEL + "."
                    : "Text extracted, reconstructed, and inserted into the writing box using " + OCR_MODEL + ".",
                "success"
            );
            document.getElementById("studentWriting").focus();
            return combinedText;
        } catch (e) {
            setOcrStatus(e.message || "Text extraction failed.", "error");
            throw e;
        } finally {
            selectedImageExtractionPromise = null;
            isAnalyzing = false;
            setLoadingButtonState(document.getElementById("extractTextBtn"), false);
            syncUiState();
        }
    })();

    return selectedImageExtractionPromise;
}




function getGrammarStrictness() {
    return getEffectiveGrammarStrictnessValue();
}


function getStrictnessRuleForPrompt(strictness, optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile();
    var base;
    if (strictness <= 1) base = "Be very lenient. Focus only on errors that make the writing confusing or clearly incorrect.";
    else if (strictness === 2) base = "Be somewhat lenient. Focus on important grammar problems, not every awkward phrase.";
    else if (strictness === 3) base = "Use balanced grammar checking. Correct clear errors while allowing age-appropriate developing style.";
    else if (strictness === 4) base = "Be fairly strict. Mark most grammar and sentence structure errors.";
    else base = "Be very strict. Mark grammar, sentence structure, punctuation, and usage issues carefully.";
    return base;
}

function buildStep1Prompt(text, optGradeProfile) {
    var profile = optGradeProfile || getGradeProfile();
    var strictness = getGrammarStrictness();
    var strictnessRule = getStrictnessRuleForPrompt(strictness, profile);
    return [
        "You are checking a " + profile.audience + "'s writing for grammar accuracy.",
        "",
        "Student grade level: " + (profile.gradeLabel || profile.label),
        "Grade-level expectation: " + profile.expectedWriting,
        "Bilingual-school guidance: " + profile.bilingualGuidance,
        "",
        strictnessRule,
        "",
        "Act as a careful grammar checker, not a creative editor.",
        "",
        "1. Correct the writing by making only the smallest grammatical changes needed. Do not change the meaning, reword sentences, translate the writing, or add punctuation unless the correction requires it.",
        "2. Bold every changed or added word in full.",
        "3. When a single correction includes two or more adjacent changed or added words, bold them together as one continuous bold span.",
        "4. Do not split one correction into multiple adjacent bold spans.",
        "5. Do not bold unchanged words just because they are next to a correction.",
        "",
        "**--- RULES FOR DIRECT QUOTATIONS (CRITICAL FORMATTING) ---**",
        "6. If you change indirect or incorrect speech into a direct quotation, you MUST bold the ENTIRE quotation phrase as ONE single, continuous bold span.",
        "7. The single bold span MUST start before the reporting verb and end exactly after the closing quotation mark.",
        "   - It MUST include: the reporting word (e.g., said), the comma, the opening quote, ALL words inside the quote (whether they changed or not), ALL punctuation inside the quote, and the closing quote.",
        "8. **DO THIS:** Original: She say I forget.",
        '   Corrected: She **said, "I forgot."**',
        "9. **NEVER DO THIS:**",
        '   - She **said**, "**I forgot**." (Never split the span)',
        '   - I **said, "I watched** a movie late." (Never stop the bold span in the middle of a quote)',
        '   - She said, "**I forgot**." (Never leave the reporting verb outside the bold span)',
        "",
        "**--- SPACING RULES (CRITICAL) ---**",
        "10. You MUST insert exactly ONE space after a closing quotation mark before starting the next word or sentence.",
        '    - **DO THIS:** late for school." I ate',
        '    - **DO NOT DO THIS:** late for school."I ate',
        "",
        "**--- GENERAL RULES ---**",
        "11. Do not leave a sentence partially corrected. Fix all grammatical errors in a sentence so the whole sentence is correct.",
        "12. Keep verb tense, pronouns, and sentence structure consistent.",
        "13. Return ONLY the corrected writing. Do not add headings, explanations, notes, labels, commentary, or translations.",
        "",
        "Student writing:",
        text,
        ""
    ].join("\n");
}

function buildStep2Prompt(originalText, correctedText, targetWords, actualWords, optGradeProfile, optGenreInfo) {
    // Note: Neatness is assessed separately via image-based call in assessNeatnessFromImage()
    // so step 2 only needs to handle the 6 core writing categories
    //
    // FIX E5: Accept optional gradeProfile parameter for explicit grade control.

    var profile = optGradeProfile || getGradeProfile();
    var audience = profile.audience || "a 5th grader";
    var bilingualGuide = profile.bilingualGuidance || "";

    // FIX O6: bilingualGuidance is injected ONCE here (not duplicated in buildStep3Prompt).
    var gradeContext = "Important: " + audience + " writing. " + bilingualGuide;
    var genreInfo = normalizeWritingGenreInfo(optGenreInfo || detectWritingGenreInfo(originalText || correctedText || ""));

    return [
        "Analyze this writing and provide a quick rubric snapshot with one kind, supportive feedback sentence per category. Write like a real teacher talking to " + audience + ": clear, warm, specific, and not robotic.",
        "",
        gradeContext,
        "",
        "Writing genre for feedback:",
        buildWritingGenrePromptText(genreInfo),
        "",
        "Grade-level expectations for scoring:",
        "- Ideas & Details: " + getGradeCategoryExpectation("Ideas & Details", profile),
        "- Organization: " + getGradeCategoryExpectation("Organization", profile),
        "- Grammar: " + getGradeCategoryExpectation("Grammar", profile),
        "- Flow: " + getGradeCategoryExpectation("Flow", profile),
        "- Word Choice: " + getGradeCategoryExpectation("Word Choice", profile),
        "- Spelling & Punctuation: " + getGradeCategoryExpectation("Spelling & Punctuation", profile),
        "",
        "Original student writing:",
        originalText,
        "",
        "Corrected writing (for reference):",
        correctedText,
        "",
        "Target word count: " + targetWords,
        "Actual word count: " + actualWords,
        "",
        "Important rules:",
        "1. Use only these rubric scores: 10, 9, 8, 7, 6, 5, 4.",
        "2. Include ALL SIX categories exactly as listed.",
        "3. Keep feedback honest, specific, and supportive (not harsh).",
        "3a. Only mention mistakes that actually appear in the original student writing. Do not tell the student to fix a capital, name, punctuation mark, or spelling that is already correct.",
        "3b. If the score is below 10, do not use words like perfect, perfectly, flawless, or always correct.",
        "3c. Avoid generic phrases like there is room to improve. Use natural teacher wording. Prefer 'your writing' instead of 'the piece'.",
        "3d. Use the genre information above. Never call this work a letter unless the writing type is Letter / Email. Never call it a poem unless the subtype is Poem. If unsure, use piece of writing.",
        "4. Mention target word count only if the actual word count is below target.",
        "5. If a category does not have enough clear evidence, write Missing instead of guessing a score.",
        "6. Return only the quick rubric in the exact format below.",
        "",
        "Provide exactly this format:",
        "**Quick Rubric:**",
        "- Ideas & Details: [score]/10 - [kind, supportive one-sentence reason]",
        "- Grammar: [score]/10 - [kind, supportive one-sentence reason]",
        "- Word Choice: [score]/10 - [kind, supportive one-sentence reason]",
        "- Organization: [score]/10 - [kind, supportive one-sentence reason about structure and sequencing only]",
        "- Flow: [score]/10 - [kind, supportive one-sentence reason about sentence rhythm and transitions only]",
        "- Spelling & Punctuation: [score]/10 - [kind, supportive one-sentence reason]"
    ].join("\n");
}

function buildStep3Prompt(correctedText, quickRubricText, flowData, targetWords, actualWords, optGradeProfile, optGenreInfo) {
    var profile = optGradeProfile || getGradeProfile();
    var audience = profile.audience || "5th-grade student";
    var bilingualGuide = profile.bilingualGuidance || "";
    var genreInfo = normalizeWritingGenreInfo(optGenreInfo || detectWritingGenreInfo(correctedText || ""));
    // Note: Neatness is assessed separately via image-based call in assessNeatnessFromImage()
    // so step 3 only needs to handle the 6 core writing categories

    return [
        "Explain the scores from the Quick Rubric Snapshot and expand them into a detailed writing assessment for this student.",
        "",
        "Student grade level: " + (profile.gradeLabel || profile.label),
        "Write the detailed assessment for a " + audience + ".",
        "Feedback tone: " + profile.feedbackTone,
        "Grade-level expectation: " + profile.expectedWriting,
        "Bilingual-school guidance: " + bilingualGuide,
        "",
        "Writing genre for feedback:",
        buildWritingGenrePromptText(genreInfo),
        "",
        "Input text:",
        correctedText,
        "",
        "Quick Rubric Snapshot:",
        quickRubricText,
        "",
        "Computed sentence count: " + (flowData && flowData.sentenceCount ? flowData.sentenceCount : "unknown"),
        "Computed average sentence length: " + (flowData && flowData.average ? flowData.average.toFixed(1) + " words" : "unknown"),
        "Computed sentence variety: " + (flowData ? flowData.varietyLabel + " (" + flowData.varietyScore + "/100)" : "unknown"),
        "Sentence-length pattern: " + (flowData && flowData.bandSummary ? flowData.bandSummary : "unknown"),
        "Computed flow rating: " + (flowData && flowData.flowRating ? flowData.flowRating : "unknown"),
        "Target word count: " + targetWords,
        "Actual word count: " + actualWords,
        "",
        "Rules:",
        "1. Use only these rubric scores: 10, 9, 8, 7, 6, 5, 4.",
        "2. Keep feedback honest but warm and encouraging.",
        "3. Make the What I noticed rows actually match the category. For Spelling & Punctuation, comments must focus on spelling, punctuation, and capitalization accuracy - not content.",
        "4. For Grammar, focus on grammar patterns such as verb tense, subject-verb agreement, sentence correctness, or punctuation affecting grammar.",
        "5. For Word Choice, focus on repeated or precise vocabulary choices.",
        "6. For Organization, focus only on content order: structure, beginning/middle/end, and logical sequencing of ideas.",
        "7. For Flow, focus only on sentence rhythm: transitions, sentence starters, sentence variety, and smoothness of reading. Make the What I noticed rows match the computed flow data. Do NOT say short sentences are a problem unless the sentence counts show many short sentences or a run of short sentences. Do NOT blend Organization and Flow into the same section.",
        "8. Mention the target word count only if the actual word count is below the target word count.",
        "9. Choose ONE grow goal only.",
        "10. Keep the same rubric scores from the Quick Rubric Snapshot unless there is a very clear reason to change them. In most cases the scores should remain the same so the detailed assessment matches the quick rubric.",
        "11. If a category does not have enough clear evidence, leave it as Missing instead of guessing a score.",
        "12. Make the final encouragement line sound like a real teacher speaking to the student. It must be specific to the submitted writing and use the safe reference word from the genre information above. Do not use letter, poem, story, or another genre word unless that genre is clearly identified above.",
        "12a. Only point out errors that truly exist in the original student writing. Do not use a correct word or capital as your correction example.",
        "12b. If a category score is below 10, avoid overclaiming with words like perfect, perfectly, flawless, or always correct.",
        "12c. Use teacher-natural language (warm and specific). Avoid robotic phrasing like there is room to improve. Prefer 'your writing' over 'the piece'.",
        "12d. Teacher Comment rules: write exactly one student-friendly sentence, use the score and the What I Noticed evidence, and do not introduce new evidence that is not supported by the row comments.",
        "12e. Teacher Comment rules: do not mention percentages, issue counts, word counts, sentence counts, weights, calculations, score basis, or internal scoring rules.",
        "12f. Teacher Comment score bands: 10 = excellent with a small refinement if needed; 8-9 = strong or good with one improvement area; 6-7 = developing and encouraging; 4-5 = needs support with one clear priority.",
        "12g. If the score is below 10, the Teacher Comment should mention a strength first and then one improvement area when evidence supports it.",
        "12h. Growth Tips must be specific actions the student can do during revision. Avoid generic tips like improve your writing, add more details, or check your work unless the action says exactly what to check or add.",
        "12i. Use category-specific evidence: Ideas = topic/detail/development; Grammar = sentence correctness/verb tense/agreement; Word Choice = vocabulary precision/variety; Organization = beginning/middle/end/sequence/paragraphing; Flow = rhythm/starters/transitions/sentence variety; Spelling & Punctuation = spelling/capitalization/punctuation.",
        "12j. For Try This Next Time, write strategy names as natural sentence text, not title-style labels. For example, write 'Mix up your sentences by...' instead of 'Mix Up My Sentences by...'.",
        "12k. In each category, the Teacher Comment, What I Noticed row, and Growth Tip must focus on the same main skill or issue. Do not mention verb tense in the Teacher Comment, sentence boundaries in What I Noticed, and then verb tense again in the Growth Tip.",
        "12l. When possible, make the What I Noticed comment include direct evidence from the writing, such as quoted words, named details, repeated sentence starters, or a specific part of the student's text. Do not invent examples that are not in the writing.",
        "13. Keep the final encouragement line to one warm sentence.",
        "",
        "Grow Goal options:",
        getGradeGrowGoalListText(profile),
        "",
        "Use exactly this format:",
        "## Detailed Writing Assessment",
        "",
        "**1. Clear Ideas & Details:** [score]/10",
        "- Teacher Comment: [one student-friendly sentence explaining the score]",
        "- What I Noticed:",
        "  - Area: Details",
        "    Comment: [specific comment based on the rubric and writing]",
        "- Growth Tip: [age-appropriate suggestion]",
        "",
        "**2. Grammar:** [score]/10",
        "- Teacher Comment: [one student-friendly sentence explaining the score]",
        "- What I Noticed:",
        "  - Area: Grammar patterns",
        "    Comment: [specific comment about grammar patterns]",
        "- Growth Tip: [suggestion]",
        "",
        "**3. Word Choice:** [score]/10",
        "- Teacher Comment: [one student-friendly sentence explaining the score]",
        "- What I Noticed:",
        "  - Area: Vocabulary",
        "    Comment: [specific comment about word choice]",
        "- Growth Tip: [suggestion]",
        "",
        "**4. Organization:** [score]/10",
        "- Teacher Comment: [one student-friendly sentence explaining the score]",
        "- What I Noticed:",
        "  - Area: Content organization",
        "    Comment: [how well the writing is structured and sequenced]",
        "  - Area: Story structure",
        "    Comment: [matching example from the writing]",
        "- Growth Tip: [one suggestion about structure, order, or sequencing]",
        "",
        "**5. Flow:** [score]/10",
        "- Teacher Comment: [one student-friendly sentence explaining the score]",
        "- What I Noticed:",
        "  - Area: Sentence rhythm",
        "    Comment: [comment that matches the computed flow data]",
        "  - Area: Sentence starters",
        "    Comment: [comment that matches the computed flow data]",
        "- Growth Tip: [one suggestion that targets the main flow issue first]",
        "",
        "**6. Spelling & Punctuation:** [score]/10",
        "- Teacher Comment: [one student-friendly sentence explaining the score]",
        "- What I Noticed:",
        "  - Area: Conventions",
        "    Comment: [specific comment about spelling, punctuation, or capitalization]",
        "- Growth Tip: [suggestion]",
        "",
        "## Grow Goal Selection",
        "",
        "**Your Writing Strength:** [highest category and why]",
        "**Your Grow Goal:** [one goal]",
        "**Try This Next Time:** [one specific tip written as a natural sentence, not a title-cased strategy label]",
        "",
        "**Keep Writing!** [one warm, natural, specific sentence tied to this student's writing and genre]",
        "",
        "**Writing Title:** [2-5 word title capturing the topic or theme of this writing, suitable as a notebook label]"
    ].join("\n");
}

function getAssessmentScorePill(score) {
    var n = Number(score);
    var cls = "score-missing";
    if (isFinite(n)) {
        if (n >= 9) cls = "score-" + Math.round(n);
        else if (n >= 7) cls = "score-8";
        else if (n >= 5) cls = "score-6";
        else cls = "score-4";
    }
    return '<span class="assessment-score-pill ' + cls + '">' + escapeHtml(getEvidenceLabel(score)) + '</span>';
}

function getStudentFriendlyAreaName(key) {
    if (key === "Ideas & Details") return "Details";
    if (key === "Word Choice") return "Vocabulary";
    if (key === "Spelling & Punctuation") return "Conventions";
    if (key === "Organization") return "Story structure";
    if (key === "Grammar") return "Grammar patterns";
    if (key === "Flow") return "Sentence rhythm";
    if (key === "Neatness") return "Handwriting";
    return "Overall";
}



function countWordsInComment(text) {
    var value = String(text || "").trim();
    if (!value) return 0;
    var parts = value.split(/\s+/);
    return parts.length;
}

function cleanTeacherCommentText(text, key, score) {
    var value = toOneSentence(teacherizeWording(String(text || "").trim(), key, score));
    value = value.replace(/\s+/g, " ").trim();
    value = value.replace(/\bthe piece\b/gi, "your writing");
    value = value.replace(/\bthere is room to improve\b/gi, "you can keep improving");
    value = value.replace(/\s+([,.!?])/g, "$1");
    return value;
}

function commentHasRawScoringData(text) {
    var value = String(text || "");
    if (/\d+\s*(%|\/|out of|issues?|errors?|words?|sentences?|points?|percent|edits?)/i.test(value)) return true;
    if (/\b(score|rubric|density|weighted|weight|calculation|calculated)\b/i.test(value)) return true;
    if (/\(\s*short\s*:/i.test(value)) return true;
    return false;
}

function categoryMismatchInTeacherComment(key, text) {
    var value = String(text || "");
    if (key === "Grammar") {
        return /\b(spelling|capitalization|handwriting|letter formation|spacing|vocabulary|word choice)\b/i.test(value);
    }
    if (key === "Flow") {
        return /\b(beginning,? middle,? and end|story structure|spelling|capitalization|handwriting|grammar errors?)\b/i.test(value);
    }
    if (key === "Organization") {
        return /\b(sentence rhythm|sentence starters|sentence length|spelling|capitalization|handwriting|grammar errors?)\b/i.test(value);
    }
    if (key === "Word Choice") {
        return /\b(spelling|punctuation|capitalization|handwriting|sentence boundaries|verb tense)\b/i.test(value);
    }
    if (key === "Spelling & Punctuation") {
        return /\b(story structure|sentence rhythm|sentence starters|word choice|vocabulary|handwriting)\b/i.test(value);
    }
    if (key === "Neatness") {
        return /\b(grammar|verb tense|sentence rhythm|story structure|vocabulary|word choice)\b/i.test(value);
    }
    return false;
}

function getEvidenceTokens(rows) {
    var bag = {};
    var stop = {
        your: true, writing: true, the: true, and: true, but: true, with: true, that: true,
        this: true, from: true, into: true, some: true, most: true, more: true, could: true,
        would: true, should: true, need: true, needs: true, clear: true, mostly: true,
        area: true, comment: true, reader: true, makes: true, make: true, time: true
    };
    rows = rows || [];
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || {};
        var text = String((row.area || "") + " " + (row.comment || "")).toLowerCase();
        var words = text.match(/[a-z]{4,}/g) || [];
        for (var j = 0; j < words.length; j++) {
            if (!stop[words[j]]) bag[words[j]] = true;
        }
    }
    return bag;
}

function commentOverlapsEvidence(text, rows) {
    if (!rows || !rows.length) return true;
    var bag = getEvidenceTokens(rows);
    var value = String(text || "").toLowerCase();
    var words = value.match(/[a-z]{4,}/g) || [];
    for (var i = 0; i < words.length; i++) {
        if (bag[words[i]]) return true;
    }
    return false;
}

function isValidTeacherComment(candidate, key, item, rows) {
    var text = String(candidate || "").trim();
    if (!text) return false;
    if (countWordsInComment(text) > 38) return false;
    if (commentHasRawScoringData(text)) return false;
    if (/\b(perfect|perfectly|flawless|always correct)\b/i.test(text) && Number(item.score) < 10) return false;
    if (Number(item.score) <= 6 && /^your\s+[^.]{0,35}\s+(is|are)\s+(excellent|strong|very strong|polished|very clear)/i.test(text)) return false;
    if (Number(item.score) >= 8 && /\b(needs support|hard to understand|difficult to follow|very difficult)\b/i.test(text)) return false;
    if (/\bthere is room to improve\b/i.test(text)) return false;
    if (categoryMismatchInTeacherComment(key, text)) return false;
    if (!commentOverlapsEvidence(text, rows)) return false;
    return true;
}

function getCategorySkillMeta(key) {
    if (key === "Ideas & Details") return { subject: "your ideas and details", verb: "are" };
    if (key === "Grammar") return { subject: "your grammar", verb: "is" };
    if (key === "Word Choice") return { subject: "your word choice", verb: "is" };
    if (key === "Organization") return { subject: "your organization", verb: "is" };
    if (key === "Flow") return { subject: "your sentence flow", verb: "is" };
    if (key === "Spelling & Punctuation") return { subject: "your spelling and punctuation", verb: "are" };
    if (key === "Neatness") return { subject: "your handwriting", verb: "is" };
    return { subject: "your writing", verb: "is" };
}

function capitalizeFirst(text) {
    var value = String(text || "");
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function isNeutralNoticeComment(text) {
    var value = String(text || "");
    if (/\b(not the main issue|not a major issue|not the main reason|do not appear to be the main|does not appear to be the main)\b/i.test(value)) return true;
    if (/\b(mostly manageable|mostly clear|mostly consistent|mostly organized|mostly stays|only a few small|only a few)\b/i.test(value)) return true;
    return false;
}

function isNeedNoticeComment(text) {
    var value = String(text || "");
    if (!value || isNeutralNoticeComment(value)) return false;
    return /\b(need|needs|could|try|add|adding|check|checking|proofread|repetitive|crowded|uneven|harder|difficult|drifts|improve|stronger|clearer|smoother|polish|developing|support|several|many|interrupts|hard|messy|rushed|incomplete|combine|combining|repeat|repeated)\b/i.test(value);
}

function pickNoticeComment(rows, wantNeed) {
    rows = rows || [];
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || {};
        var comment = String(row.comment || "").trim();
        if (!comment) continue;
        if (wantNeed && isNeedNoticeComment(comment)) return comment;
        if (!wantNeed && !isNeedNoticeComment(comment)) return comment;
    }
    return "";
}

function lowerFirstForJoin(text) {
    var value = String(text || "").trim();
    if (!value) return value;
    value = value.replace(/[.?!]+$/g, "");
    return value.charAt(0).toLowerCase() + value.slice(1);
}

function makeSentence(text) {
    var value = String(text || "").replace(/\s+/g, " ").trim();
    value = value.replace(/\s+([,.!?])/g, "$1");
    if (!/[.?!]$/.test(value)) value += ".";
    return value;
}

function buildEvidenceBasedTeacherComment(key, item, rows) {
    item = item || {};
    rows = rows || [];
    var score = Number(item.score);
    var hasScore = isFinite(score);
    var meta = getCategorySkillMeta(key);
    var subject = meta.subject;
    var verb = meta.verb;
    var subjectStart = capitalizeFirst(subject);
    var need = pickNoticeComment(rows, true);
    var strength = pickNoticeComment(rows, false);
    var detail = need || strength || item.evidence || "this area shows developing skill";

    if (hasScore && score >= 9) {
        if (strength) return makeSentence(subjectStart + " " + verb + " strong, and " + lowerFirstForJoin(strength));
        return makeSentence(subjectStart + " " + verb + " strong, with one small area to polish next time");
    }
    if (hasScore && score >= 7) {
        if (need) return makeSentence(subjectStart + " " + verb + " mostly clear, but " + lowerFirstForJoin(need));
        return makeSentence(subjectStart + " " + verb + " mostly clear, and " + lowerFirstForJoin(detail));
    }
    if (hasScore) {
        if (need) return makeSentence(subjectStart + " " + verb + " developing, and " + lowerFirstForJoin(need));
        return makeSentence(subjectStart + " " + verb + " developing, and this area needs more attention during revision");
    }
    return makeSentence("There is not enough evidence to score " + subject + " accurately yet");
}

function getScoreBandKey(score) {
    var n = Number(score);
    if (!isFinite(n)) return "missing";
    if (n >= 10) return "excellent";
    if (n >= 8) return "strong";
    if (n >= 6) return "developing";
    return "support";
}

function getFeedbackBuilderName(key) {
    if (key === "Ideas & Details") return "buildIdeasNoticeRows + buildGrowthTip";
    if (key === "Grammar") return "buildGrammarNoticeRows + buildGrowthTip";
    if (key === "Word Choice") return "buildVocabularyNoticeRows + buildGrowthTip";
    if (key === "Organization") return "buildOrganizationNoticeRows + buildGrowthTip";
    if (key === "Flow") return "buildFlowNoticeRows + buildGrowthTip";
    if (key === "Spelling & Punctuation") return "buildConventionsNoticeRows + buildGrowthTip";
    if (key === "Neatness") return "buildNeatnessNoticeRows + buildGrowthTip";
    return "buildGeneralFeedback";
}

function buildTeacherComment(key, item, rows) {
    item = item || {};
    rows = rows || buildNoticeRowsForCategory(key, item);
    if (item.teacherComment) {
        var candidate = cleanTeacherCommentText(item.teacherComment, key, item.score);
        if (isValidTeacherComment(candidate, key, item, rows)) return candidate;
    }
    return cleanTeacherCommentText(buildEvidenceBasedTeacherComment(key, item, rows), key, item.score);
}

function isGenericGrowthTip(text) {
    var value = String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!value) return true;
    if (value === "check your work" || value === "check my work" || value === "improve your writing") return true;
    if (value === "add more details" || value === "use better words" || value === "fix your grammar") return true;
    if (/^(try to )?(improve|work on|practice)\s+(it|this|this area|your writing)\.?$/i.test(value)) return true;
    if (/^(keep )?(checking|working|practicing)\.?$/i.test(value)) return true;
    return false;
}

function growthTipLooksActionable(text) {
    var value = String(text || "");
    if (!value) return false;
    return /\b(add|choose|check|circle|underline|reread|rewrite|revise|replace|plan|use|try|combine|split|start|look|leave|space|write|pick|read)\b/i.test(value);
}

function cleanGrowthTipText(text, key, score) {
    var raw = normalizeGrowGoalStrategyForSentence(String(text || ""));
    var value = teacherizeWording(softenOverclaim(raw, score), key, score);
    value = toOneSentence(value).replace(/\s+/g, " ").trim();
    value = value.replace(/\bthe piece\b/gi, "your writing");
    value = value.replace(/\s+([,.!?])/g, "$1");
    return value;
}

function isValidGrowthTip(candidate, key, item, rows) {
    var text = String(candidate || "").trim();
    if (!text) return false;
    if (countWordsInComment(text) > 34) return false;
    if (commentHasRawScoringData(text)) return false;
    if (categoryMismatchInTeacherComment(key, text)) return false;
    if (isGenericGrowthTip(text)) return false;
    if (!growthTipLooksActionable(text)) return false;
    return true;
}

function buildActionGrowthTip(key, item, rows) {
    item = item || {};
    rows = rows || [];
    var score = Number(item.score);
    var band = getScoreBandKey(score);
    var need = pickNoticeComment(rows, true);

    if (key === "Ideas & Details") {
        if (band === "excellent" || band === "strong") return "Choose one important moment and add one extra detail that shows what the character saw, heard, or felt.";
        return "Pick the most important part and add two clear details so the reader can picture it.";
    }
    if (key === "Grammar") {
        if (/tense|verb/i.test(need)) return "When you revise, underline the action verbs and check that they stay in the same tense.";
        if (/sentence|break|punctuation|run/i.test(need)) return "Reread each sentence aloud and add a period where one complete idea ends.";
        return "Reread one paragraph slowly and check each sentence for a clear subject, verb, and ending mark.";
    }
    if (key === "Word Choice") {
        return "Choose two common words and replace them with more exact words that help the reader picture the scene.";
    }
    if (key === "Organization") {
        if (/paragraph/i.test(need)) return "Mark where the beginning, middle, and ending change, then start a new paragraph for one new part.";
        return "Before revising, number the events in order and add one transition word where the order feels unclear.";
    }
    if (key === "Flow") {
        if (/starter|begin|open|same way/i.test(need)) return "Rewrite three sentence beginnings so they start with a time word, place detail, or different subject.";
        if (/short|choppy|combine/i.test(need)) return "Choose two short sentences that belong together and combine them into one smoother sentence.";
        return "Read your writing aloud and revise one sentence that sounds bumpy or too much like the sentence before it.";
    }
    if (key === "Spelling & Punctuation") {
        return "Reread one sentence at a time and check capitals, spelling, commas, and ending punctuation before moving on.";
    }
    if (key === "Neatness") {
        if (/spacing|crowded/i.test(need)) return "Leave a finger-width space between words so each word is easier to read.";
        if (/line|drifts/i.test(need)) return "Slow down and keep the bottoms of your letters sitting on the notebook line.";
        if (/formation|letter/i.test(need)) return "Slow down on tricky letters and make each letter shape complete before moving to the next word.";
        return "Choose one handwriting focus, such as spacing or line use, and check it after each sentence.";
    }
    return "Choose one sentence to revise carefully so this part of your writing becomes clearer for the reader.";
}

function buildGrowthTip(key, item, rows) {
    item = item || {};
    rows = rows || [];
    if (item.growthTip) {
        var candidate = cleanGrowthTipText(item.growthTip, key, item.score);
        if (isValidGrowthTip(candidate, key, item, rows)) return candidate;
    }
    return cleanGrowthTipText(buildActionGrowthTip(key, item, rows), key, item.score);
}

function getGrowthTipSource(key, item, rows) {
    item = item || {};
    if (item.growthTip) {
        var candidate = cleanGrowthTipText(item.growthTip, key, item.score);
        if (isValidGrowthTip(candidate, key, item, rows)) return "AI growth tip passed validation.";
        return "Fallback action-based growth tip used because the AI growth tip was generic, unsupported, or not actionable.";
    }
    return "Fallback action-based growth tip used because no AI growth tip was available.";
}

function getMainEvidenceSummary(rows) {
    rows = rows || [];
    var need = pickNoticeComment(rows, true);
    if (need) return need;
    if (rows.length) return (rows[0].area ? rows[0].area + ": " : "") + (rows[0].comment || "Evidence row selected.");
    return "No main evidence row was available.";
}

function copyFeedbackItemForDisplay(key, item) {
    var source = item || {};
    var copy = {};
    var prop;
    for (prop in source) {
        if (Object.prototype.hasOwnProperty.call(source, prop)) copy[prop] = source[prop];
    }
    if (key === "Grammar") {
        if (copy.evidence) copy.evidence = alignGrammarWordingWithErrorData(copy.evidence, copy);
        if (copy.teacherComment) copy.teacherComment = alignGrammarWordingWithErrorData(copy.teacherComment, copy);
    }
    return copy;
}

function cleanNoticeRowsForDisplay(key, item, rows) {
    var output = [];
    rows = rows || [];
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i] || {};
        var comment = row.comment || "";
        if (key === "Grammar") comment = alignGrammarWordingWithErrorData(comment, item);
        output.push({ area: row.area || "Overall", comment: comment || "No detailed note available yet." });
    }
    return output;
}

function buildStudentFeedbackForCategory(key, item) {
    var displayItem = copyFeedbackItemForDisplay(key, item || {});
    var rows = buildNoticeRowsForCategory(key, displayItem);
    rows = cleanNoticeRowsForDisplay(key, displayItem, rows);
    if (!rows.length) rows.push({ area: getStudentFriendlyAreaName(key), comment: "No detailed note available yet." });
    var teacherComment = buildTeacherComment(key, displayItem, rows);
    var growthTip = buildGrowthTip(key, displayItem, rows);
    var audit = {
        builderName: getFeedbackBuilderName(key),
        scoreBand: getAuditScoreBandLabel(displayItem.score),
        mainEvidence: getMainEvidenceSummary(rows),
        teacherCommentSource: getAuditTeacherCommentSource(key, displayItem, rows),
        growthTipSource: getGrowthTipSource(key, displayItem, rows)
    };
    return {
        teacherComment: teacherComment,
        noticeRows: rows,
        growthTip: growthTip,
        audit: audit
    };
}

function getNeatnessComment(kind, score) {
    var n = Number(score);
    if (!isFinite(n)) return "There is not enough clear handwriting evidence to comment on this area.";
    if (kind === "letterFormation") {
        if (n >= 5) return "Letters are clear, complete, and easy to recognize.";
        if (n >= 4) return "Most letters are clear and easy to read.";
        if (n >= 3) return "Some letters are clear, but several need more careful shaping.";
        if (n >= 2) return "Many letters are hard to read because they look rushed or incomplete.";
        return "Letter shapes need much more care so the writing is easier to read.";
    }
    if (kind === "spacing") {
        if (n >= 5) return "Spaces between words are clear and consistent.";
        if (n >= 4) return "Most spacing is clear, with only a few crowded places.";
        if (n >= 3) return "Some words are crowded together or spaced unevenly.";
        if (n >= 2) return "Many words are crowded together, which makes the writing harder to read.";
        return "Spacing needs much more care so the reader can tell where words begin and end.";
    }
    if (kind === "stayingOnLine") {
        if (n >= 5) return "The writing stays neatly on the lines throughout the page.";
        if (n >= 4) return "The writing mostly stays on the lines, with only a few small slips.";
        if (n >= 3) return "The writing sometimes drifts above or below the lines.";
        if (n >= 2) return "The writing often moves off the lines, which makes the page look less neat.";
        return "Staying on the lines needs much more attention.";
    }
    if (kind === "sizeConsistency") {
        if (n >= 5) return "Letter size is consistent and fits the notebook lines well.";
        if (n >= 4) return "Letter size is mostly consistent, with only a few letters that change size.";
        if (n >= 3) return "Letter size changes noticeably in some places.";
        if (n >= 2) return "Letter size changes often, making the writing harder to read.";
        return "Letter size is very uneven and needs more control.";
    }
    if (kind === "penControl") {
        if (n >= 5) return "Lines are clean and controlled, with no distracting marks.";
        if (n >= 4) return "There are only a few small marks or corrections.";
        if (n >= 3) return "Some smudges, cross-outs, or messy corrections distract from the writing.";
        if (n >= 2) return "Many messy marks or heavy corrections make the page harder to read.";
        return "Marks and corrections make the writing very difficult to read.";
    }
    if (kind === "pageLayoutParagraphs") {
        if (n >= 5) return "The page is well organized, with clear paragraphs and neat use of space.";
        if (n >= 4) return "The page is mostly organized, and the writing usually lines up well.";
        if (n >= 3) return "The page layout is uneven in some places.";
        if (n >= 2) return "The page layout makes the writing harder to follow.";
        return "The page needs much clearer organization.";
    }
    return "This handwriting area was reviewed.";
}

function buildNeatnessNoticeRows(item) {
    var rows = [];
    item = item || {};
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var ss = item.subScores || {};
    rows.push({ area: "Letter formation", comment: getNeatnessComment("letterFormation", ss.letterFormation) });
    rows.push({ area: "Spacing", comment: getNeatnessComment("spacing", ss.spacing) });
    rows.push({ area: "Staying on the line", comment: getNeatnessComment("stayingOnLine", ss.stayingOnLine) });
    rows.push({ area: "Size consistency", comment: getNeatnessComment("sizeConsistency", ss.sizeConsistency) });
    rows.push({ area: "Pen control and marks", comment: getNeatnessComment("penControl", ss.penControl) });
    rows.push({ area: "Page layout and paragraphs", comment: getNeatnessComment("pageLayoutParagraphs", ss.pageLayoutParagraphs) });
    return rows;
}

function addNoticeRowIfNew(rows, area, comment) {
    area = String(area || "Overall").trim();
    comment = String(comment || "").trim();
    if (!comment) return;
    for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].area || "") === area && String(rows[i].comment || "") === comment) return;
    }
    rows.push({ area: area, comment: comment });
}

function buildIdeasNoticeRows(item) {
    item = item || {};
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var rows = [];
    if (item.evidence) {
        addNoticeRowIfNew(rows, "Main idea and details", item.evidence);
    }
    if (item.score != null && Number(item.score) >= 9 && !rows.length) {
        addNoticeRowIfNew(rows, "Development", "The writing gives the reader clear ideas and useful details.");
    }
    return rows;
}

function buildGrammarNoticeRows(item) {
    item = item || {};
    if (item.patternNotes && item.patternNotes.length) return normalizeNoticeRows(item.patternNotes);
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var rows = [];
    addNoticeRowIfNew(rows, "Grammar patterns", item.evidence);
    return rows;
}

function buildVocabularyNoticeRows(item) {
    item = item || {};
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var rows = [];
    addNoticeRowIfNew(rows, "Vocabulary", item.evidence);
    if (item.score != null && Number(item.score) < 8 && rows.length === 1) {
        addNoticeRowIfNew(rows, "Word variety", "A few more specific words could make the writing easier to picture.");
    }
    return rows;
}

function buildOrganizationNoticeRows(item) {
    item = item || {};
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var rows = [];
    addNoticeRowIfNew(rows, "Content organization", item.contentOrganization);
    addNoticeRowIfNew(rows, "Beginning, middle, and ending", item.evidence);
    if (item.score != null && Number(item.score) < 8 && rows.length === 1) {
        addNoticeRowIfNew(rows, "Sequence", "The order of events or ideas could be made clearer for the reader.");
    }
    return rows;
}

function buildFlowNoticeRows(item) {
    item = item || {};
    if (item.patternNotes && item.patternNotes.length) return normalizeNoticeRows(item.patternNotes);
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var rows = [];
    addNoticeRowIfNew(rows, "Sentence rhythm", item.flowPattern);
    addNoticeRowIfNew(rows, "Sentence variety", item.sentenceVariety);
    addNoticeRowIfNew(rows, "Flow", item.evidence);
    return rows;
}

function buildConventionsNoticeRows(item) {
    item = item || {};
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var rows = [];
    addNoticeRowIfNew(rows, "Spelling, capitals, and punctuation", item.evidence);
    return rows;
}

function buildNoticeRowsForCategory(key, item) {
    if (key === "Ideas & Details") return buildIdeasNoticeRows(item);
    if (key === "Grammar") return buildGrammarNoticeRows(item);
    if (key === "Word Choice") return buildVocabularyNoticeRows(item);
    if (key === "Organization") return buildOrganizationNoticeRows(item);
    if (key === "Flow") return buildFlowNoticeRows(item);
    if (key === "Spelling & Punctuation") return buildConventionsNoticeRows(item);
    if (key === "Neatness") return buildNeatnessNoticeRows(item);
    item = item || {};
    if (item.noticeRows && item.noticeRows.length) return normalizeNoticeRows(item.noticeRows);
    var rows = [];
    addNoticeRowIfNew(rows, getStudentFriendlyAreaName(key), item.evidence);
    return rows;
}

function alignGrammarWordingWithErrorData(text, item) {
    if (!text) return text;
    item = item || {};
    var errors = Number(item.totalErrors);
    var density = Number(item.errorDensity);
    if (!isFinite(errors)) errors = 0;
    if (!isFinite(density)) density = 0;
    var output = String(text);
    if (errors >= 25 || density >= 8) {
        output = output.replace(/\bonly a few\b/gi, "several");
        output = output.replace(/\ba few grammar edits\b/gi, "several grammar edits");
        output = output.replace(/\ba few fixes\b/gi, "several fixes");
    }
    if (errors >= 40 || density >= 10) {
        output = output.replace(/\bseveral small fixes\b/gi, "a number of fixes");
        output = output.replace(/\bseveral grammar edits\b/gi, "a number of grammar edits");
        output = output.replace(/\bmostly small fixes\b/gi, "important fixes");
    }
    return output;
}

function renderDetailedAssessment(detailed) {
    var baseOrder = [
        ["Ideas & Details", "1. Clear Ideas & Details"],
        ["Grammar", "2. Grammar"],
        ["Word Choice", "3. Vocabulary"],
        ["Organization", "4. Organization"],
        ["Flow", "5. Flow"],
        ["Spelling & Punctuation", "6. Spelling & Punctuation"]
    ];
    if (shouldAssessNeatness()) {
        baseOrder.push(["Neatness", "7. Neatness"]);
    }
    var html = "";
    for (var i = 0; i < baseOrder.length; i++) {
        var key = baseOrder[i][0];
        var title = baseOrder[i][1];
        var item = detailed.categories[key];
        if (!item) continue;
        var feedback = buildStudentFeedbackForCategory(key, item);
        html += '<div class="assessment-item">';
        html += '<div class="assessment-head">' + escapeHtml(title) + ': ' + getAssessmentScorePill(item.score) + '</div>';
        html += '<div class="assessment-sub"><strong>Teacher Comment:</strong> ' + renderMarkdownBold(feedback.teacherComment) + '</div>';
        html += renderNoticeTable(feedback.noticeRows);
        html += '<div class="assessment-sub"><strong>Growth Tip:</strong> ' + renderMarkdownBold(feedback.growthTip) + '</div>';
        html += '</div>';
    }
    setWftSanitizedInnerHtml("detailedAssessment", html, '<div class="assessment-item">No detailed assessment data.</div>');

    var goalHtml = "";
    if (detailed.strength) goalHtml += '<div style="margin-bottom: 10px;"><strong>Your Writing Strength:</strong> ' + renderMarkdownBold(detailed.strength) + '</div>';
    if (detailed.growGoal) goalHtml += '<div style="margin-bottom: 10px;"><strong>Your Grow Goal:</strong> ' + renderMarkdownBold(detailed.growGoal) + '</div>';
    if (detailed.nextTime) goalHtml += '<div style="margin-bottom: 10px;"><strong>Try This Next Time:</strong> ' + renderMarkdownBold(normalizeGrowGoalStrategyForSentence(detailed.nextTime)) + '</div>';
    var closingText = detailed.keepWriting;
    var renderGenreInfo = normalizeWritingGenreInfo((latestAnalysisData && latestAnalysisData.writingGenre) || detailed.writingGenre || currentWritingGenreInfo || {});
    if (closingText) closingText = sanitizeGenreReferenceInFeedback(toOneSentence(teacherizeWording(closingText, "Keep Writing", 10)), renderGenreInfo);
    if (isGenericKeepWriting(closingText)) {
        closingText = buildEncouragingClosing(latestAnalysisData || { detailed: detailed, categoryScores: {} });
    }
    goalHtml += '<div><strong>Keep Writing!</strong> ' + renderMarkdownBold(closingText || buildEncouragingClosing(latestAnalysisData || { detailed: detailed, categoryScores: {} })) + '</div>';
    setWftSanitizedInnerHtml("growGoalBox", goalHtml);
}


function getAuditScoreBandLabel(score) {
    var n = Number(score);
    if (!isFinite(n)) return "Missing or not scorable";
    if (n >= 10) return "10 - excellent";
    if (n >= 8) return "8-9 - strong/good with one improvement area";
    if (n >= 6) return "6-7 - developing and encouraging";
    return "4-5 - needs support with one clear priority";
}

function getAuditScoreSource(key, item, data) {
    if (key === "Grammar") return "Computed error density plus grammar pattern analysis.";
    if (key === "Flow") return "Computed sentence variety, repeated starters, sentence length pattern, and rhythm notes.";
    if (key === "Neatness") return "Image-based handwriting sub-scores converted into student-friendly comments.";
    if (key === "Ideas & Details") return "Rubric evidence plus word-count adjustment when the target is enabled.";
    if (key === "Organization") return "Rubric evidence for beginning/middle/end, sequencing, and content order.";
    if (key === "Word Choice") return "Rubric evidence for vocabulary precision, variety, and descriptive language.";
    if (key === "Spelling & Punctuation") return "Rubric evidence for spelling, punctuation, and capitalization conventions.";
    return "Rubric evidence and detailed assessment comments.";
}

function addAuditRawRow(rows, label, value) {
    if (value === null || value === undefined || value === "") return;
    rows.push({ label: label, value: String(value) });
}

function getAuditRawRows(key, item, data) {
    var rows = [];
    item = item || {};
    data = data || {};
    if (key === "Grammar") {
        addAuditRawRow(rows, "Score basis", item.scoreBasis);
        addAuditRawRow(rows, "Grammar issue count", item.totalErrors);
        addAuditRawRow(rows, "Word count used", item.wordCount);
        if (isFinite(Number(item.errorDensity))) addAuditRawRow(rows, "Error density", Number(item.errorDensity).toFixed(2) + " per 100 words");
    } else if (key === "Flow") {
        var flowData = data.flowData || {};
        addAuditRawRow(rows, "Computed flow rating", flowData.flowRating || item.flowRating);
        addAuditRawRow(rows, "Sentence count", flowData.sentenceCount);
        if (isFinite(Number(flowData.average))) addAuditRawRow(rows, "Average sentence length", Number(flowData.average).toFixed(1) + " words");
        if (flowData.varietyLabel || isFinite(Number(flowData.varietyScore))) {
            addAuditRawRow(rows, "Sentence variety", (flowData.varietyLabel || "") + (isFinite(Number(flowData.varietyScore)) ? " (" + flowData.varietyScore + "/100)" : ""));
        }
        addAuditRawRow(rows, "Sentence pattern", flowData.bandSummary);
        addAuditRawRow(rows, "Starter pattern", flowData.starterSummary);
        addAuditRawRow(rows, "Longest short-sentence run", flowData.shortRun);
        addAuditRawRow(rows, "Shortest sentence", flowData.shortest);
        addAuditRawRow(rows, "Longest sentence", flowData.longest);
    } else if (key === "Neatness") {
        var ss = item.subScores || {};
        addAuditRawRow(rows, "Letter formation", ss.letterFormation);
        addAuditRawRow(rows, "Spacing", ss.spacing);
        addAuditRawRow(rows, "Staying on the line", ss.stayingOnLine);
        addAuditRawRow(rows, "Size consistency", ss.sizeConsistency);
        addAuditRawRow(rows, "Pen control and marks", ss.penControl);
        addAuditRawRow(rows, "Page layout and paragraphs", ss.pageLayoutParagraphs);
    } else if (key === "Ideas & Details") {
        addAuditRawRow(rows, "Target word count", data.targetWords > 0 ? data.targetWords : "Off");
        addAuditRawRow(rows, "Actual word count", data.actualWords);
        if (data.wordCountAdjustment) {
            addAuditRawRow(rows, "Ideas adjustment note", data.wordCountAdjustment.note);
            if (isFinite(Number(data.wordCountAdjustment.multiplier))) addAuditRawRow(rows, "Ideas multiplier", Number(data.wordCountAdjustment.multiplier).toFixed(3));
        }
    } else {
        if (data.quickRubric && data.quickRubric[key]) {
            addAuditRawRow(rows, "Quick rubric score", data.quickRubric[key].score);
            addAuditRawRow(rows, "Quick rubric reason", data.quickRubric[key].reason);
        }
        if (data.categoryEligibility && data.categoryEligibility[key] !== undefined) {
            addAuditRawRow(rows, "Category eligibility", data.categoryEligibility[key] ? "Scored" : "Not scored");
        }
    }
    return rows;
}

function getAuditTeacherCommentSource(key, item, rows) {
    item = item || {};
    rows = rows || [];
    if (item.teacherComment) {
        var candidate = cleanTeacherCommentText(item.teacherComment, key, item.score);
        if (isValidTeacherComment(candidate, key, item, rows)) return "AI teacher comment passed validation.";
        return "Fallback evidence-based comment used because the AI teacher comment did not pass validation.";
    }
    return "Fallback evidence-based comment used because no AI teacher comment was available.";
}

function addAuditValidation(checks, label, passed, note) {
    checks.push({ label: label, passed: !!passed, note: note || "" });
}

function scoreBandLanguageOk(text, score) {
    var n = Number(score);
    var value = String(text || "");
    if (!isFinite(n)) return true;
    if (n < 10 && /\b(perfect|perfectly|flawless|always correct)\b/i.test(value)) return false;
    if (n <= 6 && /^your\s+[^.]{0,35}\s+(is|are)\s+(excellent|strong|very strong|polished|very clear)/i.test(value)) return false;
    if (n >= 8 && /\b(needs support|hard to understand|difficult to follow|very difficult)\b/i.test(value)) return false;
    return true;
}

function buildAuditValidationRows(key, item, rows, teacherComment, growthTip, feedback) {
    var checks = [];
    addAuditValidation(checks, "Category-specific builder used", feedback && feedback.audit && feedback.audit.builderName === getFeedbackBuilderName(key), "Expected builder: " + getFeedbackBuilderName(key) + ".");
    addAuditValidation(checks, "Notice rows present", rows && rows.length > 0, "Each student-facing category should have at least one Area/Comment row.");
    addAuditValidation(checks, "No raw scoring data in Teacher Comment", !commentHasRawScoringData(teacherComment), "Student view should not show percentages, counts, weights, or formulas.");
    addAuditValidation(checks, "Teacher Comment matches category", !categoryMismatchInTeacherComment(key, teacherComment), "Comment should stay inside " + key + ".");
    addAuditValidation(checks, "Teacher Comment matches score band", scoreBandLanguageOk(teacherComment, item ? item.score : null), getAuditScoreBandLabel(item ? item.score : null));
    addAuditValidation(checks, "Teacher Comment matches evidence rows", commentOverlapsEvidence(teacherComment, rows), "Comment should be supported by the What I noticed rows.");
    addAuditValidation(checks, "Growth Tip present", !!String(growthTip || "").trim(), "Growth Tip should give one next step.");
    addAuditValidation(checks, "Growth Tip is actionable", growthTipLooksActionable(growthTip) && !isGenericGrowthTip(growthTip), "Growth tip should tell the student exactly what to do during revision.");
    addAuditValidation(checks, "Growth Tip matches category", !categoryMismatchInTeacherComment(key, growthTip), "Growth tip should stay inside " + key + ".");
    if (key === "Grammar") {
        addAuditValidation(checks, "Grammar wording aligned with error data", !/\bonly a few\b/i.test(teacherComment) || Number(item.totalErrors) < 25, "Avoid saying 'only a few' when the error count is high.");
    }
    if (key === "Flow") {
        addAuditValidation(checks, "Flow comment avoids unsupported category mixing", !categoryMismatchInTeacherComment("Flow", teacherComment), "Flow should focus on rhythm, starters, transitions, and sentence variety.");
    }
    return checks;
}

function getAuditBuilderRows(key, item, feedback) {
    var rows = [];
    feedback = feedback || {};
    var audit = feedback.audit || {};
    addAuditRawRow(rows, "Builder used", audit.builderName || getFeedbackBuilderName(key));
    addAuditRawRow(rows, "Score band", audit.scoreBand || getAuditScoreBandLabel(item ? item.score : null));
    addAuditRawRow(rows, "Main evidence selected", audit.mainEvidence || getMainEvidenceSummary(feedback.noticeRows || []));
    addAuditRawRow(rows, "Teacher Comment source", audit.teacherCommentSource || "Not recorded.");
    addAuditRawRow(rows, "Growth Tip source", audit.growthTipSource || "Not recorded.");
    return rows;
}

function renderAuditRowsTable(rows) {
    if (!rows || !rows.length) return '<div class="teacher-audit-intro">No raw data was available for this category.</div>';
    var html = '<table class="calc-table">';
    for (var i = 0; i < rows.length; i++) {
        html += '<tr><td>' + escapeHtml(rows[i].label || "Data") + '</td><td>' + escapeHtml(rows[i].value || "") + '</td></tr>';
    }
    html += '</table>';
    return html;
}

function renderAuditValidationTable(checks) {
    var html = '<table class="calc-table">';
    for (var i = 0; i < checks.length; i++) {
        html += '<tr><td>' + escapeHtml(checks[i].label || "Check") + '</td><td><span class="' + (checks[i].passed ? "audit-pass" : "audit-warn") + '">' + (checks[i].passed ? "Passed" : "Needs review") + '</span>';
        if (checks[i].note) html += '<br>' + escapeHtml(checks[i].note);
        html += '</td></tr>';
    }
    html += '</table>';
    return html;
}

function renderAuditEvidenceList(rows) {
    if (!rows || !rows.length) return '<div class="teacher-audit-intro">No evidence rows were available.</div>';
    var html = '<ul class="teacher-audit-list">';
    for (var i = 0; i < rows.length; i++) {
        html += '<li><strong>' + escapeHtml(rows[i].area || "Evidence") + ':</strong> ' + escapeHtml(rows[i].comment || "No comment available.") + '</li>';
    }
    html += '</ul>';
    return html;
}

function getTeacherAuditOrder(data) {
    var order = [
        ["Ideas & Details", "1. Clear Ideas & Details"],
        ["Grammar", "2. Grammar"],
        ["Word Choice", "3. Vocabulary"],
        ["Organization", "4. Organization"],
        ["Flow", "5. Flow"],
        ["Spelling & Punctuation", "6. Spelling & Punctuation"]
    ];
    if (data && data.detailed && data.detailed.categories && data.detailed.categories["Neatness"]) {
        order.push(["Neatness", "7. Neatness"]);
    }
    return order;
}

function renderTeacherAuditView(data) {
    var container = document.getElementById("teacherAuditView");
    if (!container) return;
    if (!data || !data.detailed || !data.detailed.categories) {
        container.innerHTML = "No teacher audit data yet.";
        return;
    }
    var order = getTeacherAuditOrder(data);
    var html = '<div class="teacher-audit-intro">Teacher-only check of score source, category-specific builder, score calibration, evidence used, displayed feedback, and validation results. This does not appear in the student report.</div>';
    for (var i = 0; i < order.length; i++) {
        var key = order[i][0];
        var title = order[i][1];
        var item = data.detailed.categories[key];
        if (!item) continue;
        var feedback = buildStudentFeedbackForCategory(key, item);
        var rows = feedback.noticeRows;
        var teacherComment = feedback.teacherComment;
        var growthTip = feedback.growthTip;
        var checks = buildAuditValidationRows(key, item, rows, teacherComment, growthTip, feedback);
        html += '<div class="teacher-audit-category">';
        html += '<h4>' + escapeHtml(title) + '</h4>';
        html += '<div><strong>Final Score:</strong> ' + escapeHtml(getEvidenceLabel(item.score)) + ' (' + escapeHtml(getAuditScoreBandLabel(item.score)) + ')</div>';
        html += '<div><strong>Score Source:</strong> ' + escapeHtml(getAuditScoreSource(key, item, data)) + '</div>';
        html += '<div class="teacher-audit-label">Feedback Builder</div>' + renderAuditRowsTable(getAuditBuilderRows(key, item, feedback));
        html += '<div class="teacher-audit-label">Evidence Rows Used</div>' + renderAuditEvidenceList(rows);
        html += '<div class="teacher-audit-label">Scoring Data</div>' + renderAuditRowsTable(getAuditRawRows(key, item, data));
        html += '<div class="teacher-audit-label">Displayed Teacher Comment</div><div>' + escapeHtml(teacherComment) + '</div>';
        html += '<div class="teacher-audit-label">Displayed Growth Tip</div><div>' + escapeHtml(growthTip) + '</div>';
        html += '<div class="teacher-audit-label">Validation</div>' + renderAuditValidationTable(checks);
        html += '</div>';
    }
    setWftSanitizedInnerHtml(container, html);
}

function formatGrammarCalc(calc) {
    var densityClass = calc.errorDensity > 20 ? "error" : (calc.errorDensity > 10 ? "warn" : "success");
    return '' +
        '<table class="calc-table">' +
            '<tr><td>Bolded correction segments</td><td>' + calc.totalErrors + '</td></tr>' +
            '<tr><td>Error counting method</td><td>Count the bolded correction segments in the corrected story.</td></tr>' +
            '<tr><td>Corrected story word count</td><td>' + calc.wordCount + '</td></tr>' +
            '<tr><td>Error density formula</td><td>(total errors / word count) x 100</td></tr>' +
            '<tr><td>Error density</td><td class="' + densityClass + '">' + calc.errorDensity.toFixed(2) + '</td></tr>' +
            '<tr><td>Grammar band</td><td>' + calc.bandText + '</td></tr>' +
            '<tr><td>Final Grammar rubric score</td><td><strong>' + calc.grammarScore + '/' + RUBRIC_MAX + '</strong></td></tr>' +
            '<tr><td>Overall score conversion check</td><td>10 = 100, 9 = 90, 8 = 80, 7 = 70, 6 = 60, 5 = 50, 4 = 40, then average only scored categories</td></tr>' +
            '<tr><td>Target word count</td><td>' + calc.targetWords + '</td></tr>' +
            '<tr><td>Actual word count</td><td>' + calc.actualWords + '</td></tr>' +
            '<tr><td>Ideas shortfall ratio</td><td>' + (calc.shortfallRatio * 100).toFixed(1) + '%</td></tr>' +
            '<tr><td>Ideas decaying multiplier</td><td>' + calc.multiplier.toFixed(3) + '</td></tr>' +
            '<tr><td>Ideas adjustment note</td><td>' + escapeHtml(calc.ideasNote) + '</td></tr>' +
        '</table>';
}


function isWordCountTargetEnabled() {
    return isEffectiveWordCountTargetEnabled();
}

function getTargetWordCountValue() {
    return getEffectiveTargetWordCountValueForSettings();
}

function getEffectiveTargetWordCount() {
    return isWordCountTargetEnabled() ? getTargetWordCountValue() : 0;
}

function updateMeter() {
    var text = document.getElementById("studentWriting").value;
    var words = countWords(text);
    var targetEnabled = isWordCountTargetEnabled();
    var target = getTargetWordCountValue();
    var ratio = targetEnabled && target > 0 ? words / target : 0;
    var percent = Math.max(0, Math.min(150, ratio * 100));
    var fillWidth = Math.min(percent, 100) + "%";
    var fillBackground = targetEnabled && words >= target ? "#3fb950" : "linear-gradient(90deg, #d29922, #3fb950)";
    var meterCard = document.getElementById("meterCard");
    var wordCountCard = document.getElementById("wordCountCard");
    var meterStatus = document.getElementById("studentPanelMeterStatus");
    var meterTarget = document.getElementById("studentPanelMeterTarget");
    var meterFill = document.getElementById("studentPanelMeterFill");
    var liveWordCount = document.getElementById("studentPanelLiveWordCount");
    var wordCountBig = document.getElementById("studentPanelWordCountBig");

    if (liveWordCount) liveWordCount.textContent = words + " words";
    if (wordCountBig) wordCountBig.textContent = words;

    if (meterCard) meterCard.style.display = "none";
    if (wordCountCard) wordCountCard.style.display = "none";

    if (!targetEnabled) {
        if (meterTarget) meterTarget.textContent = "Target: Off";
        if (meterFill) {
            meterFill.style.width = "0%";
            meterFill.style.background = "#d0d7de";
        }
        if (meterStatus) meterStatus.textContent = words === 0 ? "Paste student writing to begin." : "Word count target is turned off for this piece.";
        return;
    }

    if (meterTarget) meterTarget.textContent = "Target: " + target;
    if (meterFill) {
        meterFill.style.width = fillWidth;
        meterFill.style.background = fillBackground;
    }

    var status = "Below target";
    var badgeText = "Below target";
    if (words === 0) {
        status = "Paste student writing to begin.";
        badgeText = "Start typing...";
    } else if (words < target * 0.75) {
        status = "Below target - there is still room to add more detail.";
        badgeText = "Need more detail";
    } else if (words < target * 0.95) {
        status = "Getting close - just a little more could help.";
        badgeText = "Getting close";
    } else if (words <= target * 1.05) {
        status = "Very close to target.";
        badgeText = "Near target";
    }
    if (words === target) {
        status = "Right on target.";
        badgeText = "On target";
    }
    if (words > target * 1.05) {
        status = "Above target - plenty of room for developed ideas.";
        badgeText = "Above target";
    }

    if (meterStatus) meterStatus.textContent = status;
}

var latestAnalysisData = null;

function normalizeSuggestedTitle(title) {
    var value = String(title || "").replace(/\r\n?/g, "\n").trim();
    if (!value) return "";
    var inlineMatch = value.match(/^\s*Title\s*:\s*(.+)$/i);
    if (inlineMatch && inlineMatch[1]) value = inlineMatch[1].trim();
    value = value.replace(/^["']+|["']+$/g, "").trim();
    return value;
}

function titleCaseGeneratedWritingTitle(title) {
    var value = String(title || "").replace(/\s+/g, " ").trim();
    if (!value) return "";

    var lowercaseWords = {
        a: true,
        an: true,
        and: true,
        as: true,
        at: true,
        but: true,
        by: true,
        for: true,
        from: true,
        in: true,
        into: true,
        nor: true,
        of: true,
        on: true,
        or: true,
        so: true,
        the: true,
        to: true,
        up: true,
        via: true,
        with: true,
        yet: true
    };
    var hasLowercase = /[a-z]/.test(value);
    var words = value.split(/\s+/);

    function formatSegment(segment, shouldCapitalize) {
        var lower = segment.toLowerCase();
        if (hasLowercase && /^[A-Z0-9]{2,}$/.test(segment) && /[A-Z]/.test(segment)) {
            return segment;
        }
        if (!shouldCapitalize) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }

    function formatToken(token, wordIndex) {
        var matches = [];
        var re = /[A-Za-z0-9][A-Za-z0-9']*/g;
        var match;
        while ((match = re.exec(token)) !== null) {
            matches.push({ text: match[0], index: match.index });
        }
        if (!matches.length) return token;

        var forceCapitalize = wordIndex === 0 || wordIndex === words.length - 1;
        if (!forceCapitalize && wordIndex > 0 && /[:?!]$/.test(words[wordIndex - 1])) {
            forceCapitalize = true;
        }

        var output = "";
        var lastIndex = 0;
        for (var i = 0; i < matches.length; i++) {
            var part = matches[i];
            var partText = part.text;
            var lower = partText.toLowerCase();
            var isFirstSegment = i === 0;
            var isLastSegment = i === matches.length - 1;
            var shouldCapitalize = forceCapitalize || !lowercaseWords[lower] || (!isFirstSegment && isLastSegment);
            output += token.slice(lastIndex, part.index);
            output += formatSegment(partText, shouldCapitalize);
            lastIndex = part.index + partText.length;
        }
        output += token.slice(lastIndex);
        return output;
    }

    for (var i = 0; i < words.length; i++) {
        words[i] = formatToken(words[i], i);
    }
    return words.join(" ");
}

function looksLikeProseLine(line) {
    var value = String(line || "").trim();
    if (!value) return false;
    return /[.!?]$/.test(value) || countWords(value) >= 6 || value.length >= 40 || /,/.test(value);
}

function isTitleCaseish(line) {
    var words = String(line || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    var total = 0;
    var score = 0;
    for (var i = 0; i < words.length; i++) {
        var clean = words[i].replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
        if (!clean) continue;
        total += 1;
        if (/^[A-Z0-9]/.test(clean) || /^[IVX]+$/i.test(clean) || /^(a|an|and|at|for|from|in|into|my|of|on|or|the|to|with)$/i.test(clean)) {
            score += 1;
        }
    }
    return total > 0 && (score / total) >= 0.6;
}

function isLikelyStandaloneTitle(line, nextLine) {
    var value = String(line || "").trim();
    var bodyLine = String(nextLine || "").trim();
    if (!value || !bodyLine) return false;
    if (/[.!?]$/.test(value)) return false;
    if (countWords(value) > 8 || value.length > 60) return false;
    if (/^[0-9]+$/.test(value)) return false;
    if (isTitleCaseish(value)) return true;
    return value.length <= 40 && looksLikeProseLine(bodyLine) && bodyLine.length >= value.length + 15;
}

function extractWritingTitleParts(text) {
    var normalized = normalizeCorrectionMarkup(text || "");
    if (!normalized) return { title: "", body: "" };

    var lines = normalized.split("\n");
    var nonEmpty = [];
    for (var i = 0; i < lines.length; i++) {
        var trimmed = String(lines[i] || "").trim();
        if (trimmed) nonEmpty.push({ index: i, text: trimmed });
    }
    if (!nonEmpty.length) return { title: "", body: "" };

    var first = nonEmpty[0];
    var second = nonEmpty.length > 1 ? nonEmpty[1] : null;
    var inlineTitleMatch = first.text.match(/^Title\s*:\s*(.+)$/i);
    if (inlineTitleMatch && inlineTitleMatch[1] && inlineTitleMatch[1].trim()) {
        return {
            title: inlineTitleMatch[1].trim(),
            body: lines.slice(first.index + 1).join("\n").replace(/^\n+/, "")
        };
    }
    if (/^Title\s*:\s*$/i.test(first.text) && second && second.text) {
        return {
            title: second.text,
            body: lines.slice(second.index + 1).join("\n").replace(/^\n+/, "")
        };
    }
    if (second && isLikelyStandaloneTitle(first.text, second.text)) {
        return {
            title: first.text,
            body: lines.slice(first.index + 1).join("\n").replace(/^\n+/, "")
        };
    }
    return { title: "", body: normalized };
}

function getObviousWritingTitle(text) {
    return extractWritingTitleParts(text).title || "";
}

function getPreferredWritingTitle(text, suggestedTitle) {
    var originalTitle = getObviousWritingTitle(text);
    if (originalTitle) return originalTitle;
    var cleanedSuggestion = normalizeSuggestedTitle(suggestedTitle);
    if (cleanedSuggestion) return titleCaseGeneratedWritingTitle(cleanedSuggestion);
    return "Untitled Writing";
}

function getWritingTitle(text) {
    return getObviousWritingTitle(text) || "Untitled Writing";
}

function cleanNotebookSentence(text) {
    var value = String(text || "").trim();
    value = value.replace(/\s+/g, " ");
    value = value.replace(/^[\-:,\s]+/, "");
    return value;
}


function capitalizeFirstLetter(text) {
    var value = String(text || "");
    return value.replace(/^(\s*)([a-z])/, function(match, lead, letter) {
        return lead + letter.toUpperCase();
    });
}

function normalizeGrowGoalStrategyForSentence(text) {
    var value = String(text || "").trim();
    if (!value) return value;

    var replacements = [
        { pattern: /\bAdd\s+More\s+Details\b/gi, replacement: "add more details" },
        { pattern: /\bCheck\s+My\s+Verbs\b/gi, replacement: "check your verbs" },
        { pattern: /\bUse\s+Stronger\s+Words\b/gi, replacement: "use stronger words" },
        { pattern: /\bMix\s+Up\s+My\s+Sentences\b/gi, replacement: "mix up your sentences" },
        { pattern: /\bAdd\s+Transition\s+Words\b/gi, replacement: "add transition words" },
        { pattern: /\bProofread\s+for\s+Spelling\s*(?:&|and)\s*Punctuation\b/gi, replacement: "proofread for spelling and punctuation" },
        { pattern: /\bPractice\s+Handwriting\b/gi, replacement: "practice handwriting" },
        { pattern: /\bAdd\s+More\s+Specific\s+Evidence\b/gi, replacement: "add more specific evidence" },
        { pattern: /\bStrengthen\s+Topic\s+Sentences\b/gi, replacement: "strengthen your topic sentences" },
        { pattern: /\bImprove\s+Paragraph\s+Organization\b/gi, replacement: "improve paragraph organization" },
        { pattern: /\bUse\s+More\s+Precise\s+Vocabulary\b/gi, replacement: "use more precise vocabulary" },
        { pattern: /\bVary\s+Sentence\s+Openings\b/gi, replacement: "vary your sentence openings" },
        { pattern: /\bAdd\s+Stronger\s+Transitions\b/gi, replacement: "add stronger transitions" },
        { pattern: /\bProofread\s+for\s+Grammar\s+and\s+Punctuation\b/gi, replacement: "proofread for grammar and punctuation" },
        { pattern: /\bStrengthen\s+Thesis\s*\/\s*Central\s+Claim\b/gi, replacement: "strengthen your thesis or central claim" },
        { pattern: /\bIntegrate\s+Text\s+Evidence\b/gi, replacement: "integrate text evidence" },
        { pattern: /\bImprove\s+Paragraph\s+Cohesion\b/gi, replacement: "improve paragraph cohesion" },
        { pattern: /\bRefine\s+Tone\s*(?:&|and)\s*Voice\b/gi, replacement: "refine your tone and voice" },
        { pattern: /\bDevelop\s+Counterarguments\b/gi, replacement: "develop counterarguments" },
        { pattern: /\bUse\s+More\s+Precise\s+Academic\s+Vocabulary\b/gi, replacement: "use more precise academic vocabulary" },
        { pattern: /\bImprove\s+Sentence\s+Variety\b/gi, replacement: "improve sentence variety" },
        { pattern: /\bProofread\s+for\s+Grammar\s+and\s+Mechanics\b/gi, replacement: "proofread for grammar and mechanics" }
    ];

    for (var i = 0; i < replacements.length; i++) {
        value = value.replace(replacements[i].pattern, replacements[i].replacement);
    }

    value = value.replace(/\bby\s+by\b/gi, "by");
    value = value.replace(/\s+([,.!?])/g, "$1");
    value = value.replace(/\s+/g, " ").trim();
    return capitalizeFirstLetter(value);
}

function cleanPrintedStrength(text) {
    var value = cleanNotebookSentence(text);
    value = value.replace(/^Your Writing Strength:\s*/i, "");
    value = value.replace(/^[A-Za-z &]+\s*-\s*/, "");
    value = value.replace(/^[A-Za-z &]+\s*\([^)]*\)\.\s*/, "");
    value = value.replace(/^[A-Za-z &]+\s*\([^)]*\)\s*-\s*/, "");
    value = value.replace(/^[-:,.\s]+/, "");
    return value || "-";
}

var currentWritingGenreInfo = null;
var manualGenreOverrideValue = "__auto__";
var aiWritingGenreCacheText = "";
var aiWritingGenreCacheInfo = null;
var aiWritingGenrePendingText = "";
var aiWritingGenrePendingPromise = null;
var aiWritingGenreStatus = "";

function getWritingGenreChoices() {
    return [
        { value: "narrative", mainGenre: "Narrative / Story", defaultSubtype: "Story", safeReference: "story" },
        { value: "informational", mainGenre: "Informational / Explanatory", defaultSubtype: "Informational Writing", safeReference: "explanation" },
        { value: "opinion", mainGenre: "Opinion / Argument", defaultSubtype: "Opinion Writing", safeReference: "opinion piece" },
        { value: "literary", mainGenre: "Literary Analysis / Text Response", defaultSubtype: "Text Response", safeReference: "response" },
        { value: "creative", mainGenre: "Poem / Creative Writing", defaultSubtype: "Creative Piece", safeReference: "creative piece" },
        { value: "letter", mainGenre: "Letter / Email", defaultSubtype: "Letter", safeReference: "letter" },
        { value: "journal", mainGenre: "Journal / Reflection", defaultSubtype: "Reflection", safeReference: "reflection" },
        { value: "procedural", mainGenre: "Procedural / How-To", defaultSubtype: "How-To", safeReference: "how-to piece" },
        { value: "academic", mainGenre: "Academic Short Response", defaultSubtype: "Short Response", safeReference: "response" },
        { value: "speech", mainGenre: "Speech / Presentation", defaultSubtype: "Speech", safeReference: "speech" },
        { value: "other", mainGenre: "Other / Unsure", defaultSubtype: "Writing", safeReference: "piece of writing" }
    ];
}

function getGenreChoiceByValue(value) {
    var choices = getWritingGenreChoices();
    for (var i = 0; i < choices.length; i++) {
        if (choices[i].value === value) return choices[i];
    }
    return null;
}

function makeWritingGenreInfo(mainGenre, subtype, safeReference, confidence, source) {
    return normalizeWritingGenreInfo({
        mainGenre: mainGenre,
        subtype: subtype,
        safeReference: safeReference,
        confidence: confidence,
        source: source || "auto"
    });
}

function normalizeWritingGenreInfo(info) {
    info = info || {};
    var mainGenre = info.mainGenre || info.genre || info.writingType || "Other / Unsure";
    var subtype = info.subtype || info.subGenre || "Writing";
    var safeReference = info.safeReference || info.referenceWord || info.safeRef || "piece of writing";
    var confidence = info.confidence || "low";
    var source = info.source || "auto";
    var summary = info.oneSentenceSummary || info.summary || "";
    var reason = info.reason || "";
    var notProceduralReason = info.notProceduralReason || "";

    if (mainGenre === "Narrative" || mainGenre === "Story" || mainGenre === "Narrative / Story") mainGenre = "Narrative / Story";
    else if (mainGenre === "Informational" || mainGenre === "Explanatory" || mainGenre === "Informational / Explanatory") mainGenre = "Informational / Explanatory";
    else if (mainGenre === "Opinion" || mainGenre === "Argument" || mainGenre === "Opinion / Argument") mainGenre = "Opinion / Argument";
    else if (mainGenre === "Letter" || mainGenre === "Email" || mainGenre === "Letter / Email") mainGenre = "Letter / Email";
    else if (mainGenre === "Procedural" || mainGenre === "How-To" || mainGenre === "How To" || mainGenre === "Procedural / How-To") mainGenre = "Procedural / How-To";
    else if (mainGenre === "Poem" || mainGenre === "Creative Writing" || mainGenre === "Poem / Creative Writing") mainGenre = "Poem / Creative Writing";
    else if (mainGenre === "Text Response" || mainGenre === "Literary Analysis" || mainGenre === "Literary Analysis / Text Response") mainGenre = "Literary Analysis / Text Response";
    else if (mainGenre === "Academic Short Response" || mainGenre === "Short Response") mainGenre = "Academic Short Response";
    else if (mainGenre === "Journal" || mainGenre === "Reflection" || mainGenre === "Journal / Reflection") mainGenre = "Journal / Reflection";
    else if (mainGenre === "Speech" || mainGenre === "Presentation" || mainGenre === "Speech / Presentation") mainGenre = "Speech / Presentation";
    else mainGenre = "Other / Unsure";

    if (mainGenre === "Narrative / Story") safeReference = "story";
    else if (mainGenre === "Informational / Explanatory") safeReference = "explanation";
    else if (mainGenre === "Opinion / Argument") safeReference = "opinion piece";
    else if (mainGenre === "Letter / Email") safeReference = "letter";
    else if (mainGenre === "Procedural / How-To") safeReference = "how-to piece";
    else if (mainGenre === "Poem / Creative Writing") safeReference = /poem/i.test(subtype) ? "poem" : "creative piece";
    else if (mainGenre === "Literary Analysis / Text Response") safeReference = "response";
    else if (mainGenre === "Academic Short Response") safeReference = "response";
    else if (mainGenre === "Journal / Reflection") safeReference = "reflection";
    else if (mainGenre === "Speech / Presentation") safeReference = "speech";
    else safeReference = "piece of writing";

    return {
        mainGenre: mainGenre,
        subtype: subtype,
        safeReference: safeReference,
        confidence: confidence,
        source: source,
        oneSentenceSummary: summary,
        reason: reason,
        notProceduralReason: notProceduralReason
    };
}

function getWritingGenreInfoFromSession(session) {
    session = session || {};
    if (session.writingGenreInfo) return normalizeWritingGenreInfo(session.writingGenreInfo);
    if (session.writingGenre || session.writingSubtype || session.writingSafeReference) {
        return normalizeWritingGenreInfo({
            mainGenre: session.writingGenre || session.writingGenreMain || "Other / Unsure",
            subtype: session.writingSubtype || "Writing",
            safeReference: session.writingSafeReference || "piece of writing",
            confidence: session.genreConfidence || "low",
            source: "saved"
        });
    }
    return detectWritingGenreInfo(session.originalText || session.correctedPlainText || session.correctedMarkup || "");
}

function countGenreRegexMatches(value, patterns) {
    var count = 0;
    for (var i = 0; i < patterns.length; i++) {
        if (patterns[i].test(value)) count += 1;
    }
    return count;
}

function hasLetterFeatures(text) {
    var raw = String(text || "");
    var lines = raw.replace(/\r\n?/g, "\n").split("\n").map(function(line) {
        return line.trim();
    }).filter(function(line) {
        return line.length > 0;
    });
    if (!lines.length) return false;

    var firstFive = lines.slice(0, 5).join("\n");
    var lastFive = lines.slice(Math.max(0, lines.length - 5)).join("\n");
    var hasGreeting = /^\s*(dear|hello|hi|to)\s+[^\n,;:.!?]{1,60}[,:]?\s*$/im.test(firstFive);
    var hasClosing = /^\s*(sincerely|from|love|your friend|best|regards|thank you|thanks)[,\s]*$/im.test(lastFive);
    var hasSignatureAfterClosing = false;
    for (var i = Math.max(0, lines.length - 6); i < lines.length - 1; i++) {
        if (/^(sincerely|from|love|your friend|best|regards|thank you|thanks)[,\s]*$/i.test(lines[i]) && /^[A-Z][A-Za-z .'-]{1,40}$/.test(lines[i + 1])) {
            hasSignatureAfterClosing = true;
            break;
        }
    }
    var directRecipient = /^\s*(dear|to)\s+/im.test(firstFive);
    var emailClues = /^\s*(subject|to|from|cc):\s+/im.test(firstFive) || /@/.test(firstFive);
    var featureCount = 0;
    if (hasGreeting) featureCount += 1;
    if (hasClosing) featureCount += 1;
    if (hasSignatureAfterClosing) featureCount += 1;
    if (directRecipient || emailClues) featureCount += 1;
    return featureCount >= 2;
}

function looksLikePoem(text) {
    var parts = extractWritingTitleParts(text || "");
    var body = String(parts.body || text || "").replace(/\r\n?/g, "\n").trim();
    var lines = body.split("\n").map(function(line) { return line.trim(); }).filter(function(line) { return line.length > 0; });
    if (lines.length < 4) return false;
    var shortLines = 0;
    var noEndPunct = 0;
    var totalWords = 0;
    for (var i = 0; i < lines.length; i++) {
        var wc = countWords(lines[i]);
        totalWords += wc;
        if (wc > 0 && wc <= 8) shortLines += 1;
        if (!/[.!?]$/.test(lines[i])) noEndPunct += 1;
    }
    var avgWords = totalWords / lines.length;
    var hasStanzaBreak = /\n\s*\n/.test(body);
    return (shortLines >= Math.ceil(lines.length * 0.65) && avgWords <= 9 && noEndPunct >= Math.ceil(lines.length * 0.45)) || (hasStanzaBreak && avgWords <= 10);
}

function detectNarrativeSubtype(value) {
    if (/\b(magic|magical|dragon|dragons|dimension|portal|kingdom|castle|witch|wizard|fairy|monster|mysterious|galaxy|galasteria|superpower|spell)\b/i.test(value)) return "Fantasy";
    if (/\bspaceship|alien|robot|future|time machine|time travel|planet|laser\b/i.test(value)) return "Science Fiction";
    if (/\bmystery|detective|clue|suspect|secret|missing|case\b/i.test(value)) return "Mystery";
    if (/\badventure|quest|journey|explore|treasure|escaped?\b/i.test(value)) return "Adventure";
    if (/\bi remember\b|\bwhen i was\b|\bmy family\b|\bmy friend\b/i.test(value)) return "Personal Narrative";
    return "Story";
}

function startsWithCommandVerbForProcedural(line) {
    var value = String(line || "").trim().toLowerCase();
    if (!value) return false;
    return /^(add|attach|bake|boil|build|choose|click|collect|connect|cook|cover|cut|draw|fold|get|glue|insert|label|make|measure|mix|open|place|plug|pour|press|put|remove|repeat|select|set|stir|take|turn|use|wait|wash|write)\b/.test(value);
}

function getProceduralSignalData(text) {
    var raw = String(text || "").replace(/\r\n?/g, "\n").trim();
    var parts = extractWritingTitleParts(raw);
    var title = String(parts.title || "").trim();
    var body = String(parts.body || raw).trim();
    var bodyLower = body.toLowerCase();
    var lines = body.split("\n").map(function(line) {
        return line.trim();
    }).filter(function(line) {
        return line.length > 0;
    });
    var firstLines = lines.slice(0, 8).join("\n");
    var sentences = splitSentences(body);
    var imperativeCount = 0;
    var numberedOrBulletedInstructionCount = 0;

    for (var i = 0; i < lines.length; i++) {
        if (/^(\d+[.)]|[-*])\s+/.test(lines[i])) {
            numberedOrBulletedInstructionCount += 1;
            if (startsWithCommandVerbForProcedural(lines[i].replace(/^(\d+[.)]|[-*])\s+/, ""))) imperativeCount += 1;
        }
    }
    for (var j = 0; j < sentences.length; j++) {
        var sentence = String(sentences[j] || "").trim();
        sentence = sentence.replace(/^(first|next|then|after that|finally|last)\s*[,;]?\s+/i, "");
        if (startsWithCommandVerbForProcedural(sentence)) imperativeCount += 1;
    }

    var sequenceCount = countGenreRegexMatches(bodyLower, [
        /(^|[.!?]\s+)first\b\s*[,;]?/i,
        /(^|[.!?]\s+)next\b\s*[,;]?/i,
        /(^|[.!?]\s+)then\b\s*[,;]?/i,
        /(^|[.!?]\s+)after\s+that\b\s*[,;]?/i,
        /(^|[.!?]\s+)finally\b\s*[,;]?/i,
        /(^|[.!?]\s+)last\b\s*[,;]?/i
    ]);

    return {
        title: title,
        body: body,
        hasHowToTitle: /^\s*how\s+to\s+\w+/i.test(title) || /^\s*how\s+to\s+\w+/i.test(lines[0] || ""),
        hasProcedureHeading: /(^|\n)\s*(materials|ingredients|supplies|tools|directions|instructions|procedure|method|steps)\s*:?\s*($|\n)/i.test("\n" + firstLines + "\n"),
        hasMaterialsWithDirections: /(^|\n)\s*(materials|ingredients|supplies|tools)\s*:/i.test("\n" + body + "\n") && /(^|\n)\s*(directions|instructions|procedure|method|steps)\s*:/i.test("\n" + body + "\n"),
        hasTeacherHowToPhrase: /\b(i will explain|i will show|this will show|this explains|this tells)\s+you\s+how\s+to\b/i.test(bodyLower),
        hasNeedList: /\byou\s+(will\s+)?need\b|\bwhat\s+you\s+need\b/i.test(bodyLower),
        hasDirectReaderInstruction: /\byou\s+(should|must|need to|have to|will|can)\s+(add|attach|bake|boil|build|choose|click|collect|connect|cook|cover|cut|draw|fold|get|glue|insert|label|make|measure|mix|open|place|plug|pour|press|put|remove|repeat|select|set|stir|take|turn|use|wait|wash|write)\b/i.test(bodyLower),
        sequenceCount: sequenceCount,
        imperativeCount: imperativeCount,
        numberedOrBulletedInstructionCount: numberedOrBulletedInstructionCount
    };
}

function hasClearProceduralTeachingPurpose(text) {
    var signals = getProceduralSignalData(text);
    if (signals.hasHowToTitle || signals.hasMaterialsWithDirections) return true;
    if (signals.hasProcedureHeading && (signals.hasNeedList || signals.hasDirectReaderInstruction || signals.imperativeCount >= 1 || signals.numberedOrBulletedInstructionCount >= 2)) return true;
    if (signals.hasTeacherHowToPhrase && (signals.sequenceCount >= 1 || signals.imperativeCount >= 1 || signals.hasDirectReaderInstruction)) return true;
    if (signals.hasNeedList && (signals.imperativeCount >= 2 || signals.numberedOrBulletedInstructionCount >= 2)) return true;
    if (signals.hasDirectReaderInstruction && (signals.sequenceCount >= 2 || signals.imperativeCount >= 2)) return true;
    if (signals.numberedOrBulletedInstructionCount >= 3 && signals.imperativeCount >= 2) return true;
    return false;
}

function hasStrongNarrativeSignals(text) {
    var raw = String(text || "");
    var value = raw.toLowerCase();
    var score = 0;
    if (/\b(i|he|she|they|we)\s+(went|saw|looked|walked|ran|opened|felt|heard|woke|jumped|wanted|tried|knew|asked|realized|realised|laid|lay|closed|entered|found)\b/i.test(value)) score += 2;
    if (/\b(door|dimension|world|city|school|room|house|bed|window|sky)\b/i.test(value)) score += 1;
    if (/\b(magic|magical|dragon|dragons|dimension|portal|kingdom|castle|witch|wizard|fairy|monster|mysterious|galasteria|superpower|spell|bunny|bunnies|foxes)\b/i.test(value)) score += 2;
    if (/\b(once|one day|suddenly|finally|after|then|when|while)\b/i.test(value)) score += 1;
    if (/\b(said|asked|told|waking me up|woke up|dream|dreaming)\b/i.test(value)) score += 1;
    if (/\b(myself|my mom|teacher|teachers|kids|guard|bunny|mom|children|student)\b/i.test(value)) score += 1;
    if (/\b(how to|materials|ingredients|directions|instructions|procedure)\b/i.test(value)) score -= 2;
    return score >= 4;
}

function getLocalNarrativeGenreInfo(text) {
    var nSubtype = detectNarrativeSubtype(text);
    return makeWritingGenreInfo("Narrative / Story", nSubtype, "story", hasStrongNarrativeSignals(text) ? "high" : "medium", "auto");
}

function looksLikeProceduralWriting(text) {
    var raw = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!raw) return false;

    var signals = getProceduralSignalData(raw);

    if (hasStrongNarrativeSignals(raw) && !signals.hasHowToTitle && !signals.hasMaterialsWithDirections && !signals.hasTeacherHowToPhrase) {
        return false;
    }

    return hasClearProceduralTeachingPurpose(raw);
}

function detectWritingGenreInfo(text) {
    var raw = String(text || "").trim();
    var value = raw.toLowerCase();
    if (!value) return makeWritingGenreInfo("Other / Unsure", "Writing", "piece of writing", "low", "auto");

    if (hasLetterFeatures(raw)) {
        return makeWritingGenreInfo("Letter / Email", "Letter", "letter", "high", "auto");
    }

    if (hasStrongNarrativeSignals(raw)) {
        return getLocalNarrativeGenreInfo(raw);
    }

    if (looksLikeProceduralWriting(raw)) {
        return makeWritingGenreInfo("Procedural / How-To", "How-To", "how-to piece", "medium", "auto");
    }

    if (/\b(good morning|today i will|my presentation|i am here to talk|ladies and gentlemen|fellow students)\b/i.test(value)) {
        return makeWritingGenreInfo("Speech / Presentation", "Speech", "speech", "medium", "auto");
    }

    if (/\bdear diary\b|\btoday i learned\b|\bi learned that\b|\bthis taught me\b|\bmy goal is\b|\bnext time i will\b|\bi realized that\b|\bi learned from\b/i.test(value)) {
        return makeWritingGenreInfo("Journal / Reflection", "Reflection", "reflection", "medium", "auto");
    }

    var opinionScore = countGenreRegexMatches(value, [
        /\bi think\b/i,
        /\bi believe\b/i,
        /\bin my opinion\b/i,
        /\bshould\b/i,
        /\bmust\b/i,
        /\bbetter than\b/i,
        /\bbest\b/i,
        /\breason\b/i,
        /\bconvince\b/i
    ]);
    if (opinionScore >= 2 || (/\bshould\b/i.test(value) && /\bbecause\b/i.test(value))) {
        return makeWritingGenreInfo("Opinion / Argument", "Opinion Writing", "opinion piece", opinionScore >= 3 ? "high" : "medium", "auto");
    }

    if (/\b(theme|character|author|text evidence|quote|chapter|book|poem shows|story shows|the passage|according to the text)\b/i.test(value)) {
        return makeWritingGenreInfo("Literary Analysis / Text Response", "Text Response", "response", "medium", "auto");
    }

    if (looksLikePoem(raw)) {
        return makeWritingGenreInfo("Poem / Creative Writing", "Poem", "poem", "high", "auto");
    }

    var narrativeScore = countGenreRegexMatches(value, [
        /\bonce\b/i,
        /\bone day\b/i,
        /\bsuddenly\b/i,
        /\bfinally\b/i,
        /\bafter\b/i,
        /\bthen\b/i,
        /\bsaid\b/i,
        /\basked\b/i,
        /\blooked\b/i,
        /\bwalked\b/i,
        /\bran\b/i,
        /\bopened\b/i,
        /\bdoor\b/i,
        /\bcharacter\b/i
    ]);
    if (narrativeScore >= 2 || /\b(i|he|she|they)\s+(went|saw|looked|walked|ran|opened|felt|heard|woke|jumped|wanted|tried|knew|asked|realized|realised)\b/i.test(value)) {
        return getLocalNarrativeGenreInfo(raw);
    }

    if (/\bfacts?\b|\bfor example\b|\baccording to\b|\bexplains?\b|\bis called\b|\bare called\b|\bbecause\b|\bthis means\b|\breport\b|\bresearch\b/i.test(value)) {
        return makeWritingGenreInfo("Informational / Explanatory", "Informational Writing", "explanation", "medium", "auto");
    }

    if (looksLikeProseLine(raw) && countWords(raw) < 140) {
        return makeWritingGenreInfo("Academic Short Response", "Short Response", "response", "low", "auto");
    }

    return makeWritingGenreInfo("Other / Unsure", "Writing", "piece of writing", "low", "auto");
}

function isAutoGenreSelected() {
    var select = typeof document !== "undefined" ? document.getElementById("writingGenreSelect") : null;
    var selected = select ? select.value : manualGenreOverrideValue;
    return !selected || selected === "__auto__";
}

function getGenreClassificationModel(fallbackModel) {
    if (fallbackModel) return fallbackModel;
    var modelEl = typeof document !== "undefined" ? document.getElementById("modelSelect") : null;
    if (modelEl && modelEl.value) return modelEl.value;
    return DEFAULT_MODEL;
}

function getCachedAiGenreInfo(text) {
    var raw = String(text || "").trim();
    if (raw && aiWritingGenreCacheInfo && aiWritingGenreCacheText === raw) {
        return aiWritingGenreCacheInfo;
    }
    return null;
}

function getAutoWritingGenreInfo(text) {
    var cached = getCachedAiGenreInfo(text);
    if (cached) return cached;
    return detectWritingGenreInfo(text);
}

function buildWritingGenreClassificationPrompt(text) {
    return [
        "Classify the student's writing type by understanding the whole passage, not by matching isolated keywords.",
        "First make a one-sentence summary of what the passage is about. Then classify the genre from that summary and the overall purpose.",
        "Return JSON only, with no markdown.",
        "Allowed mainGenre values: Narrative / Story, Informational / Explanatory, Opinion / Argument, Literary Analysis / Text Response, Poem / Creative Writing, Letter / Email, Journal / Reflection, Procedural / How-To, Academic Short Response, Speech / Presentation, Other / Unsure.",
        "Use Procedural / How-To only if the main purpose is to teach the reader how to do, make, cook, build, use, play, or complete something with instructions.",
        "Do not classify a story as Procedural / How-To just because it contains sequence words such as first, next, after, finally, steps, open, or turn.",
        "Narrative / Story should be used when the passage has a narrator or characters, setting, events over time, a problem/discovery/adventure, dialogue, thoughts, or fictional/fantasy elements.",
        "If the passage enters another world, has magic, dragons, animals acting like people, a portal, a mystery door, or a fictional place, it is probably Narrative / Story with subtype Fantasy.",
        "JSON schema:",
        "{",
        "  \"oneSentenceSummary\": \"short summary of the passage\",",
        "  \"mainGenre\": \"one allowed value\",",
        "  \"subtype\": \"specific subtype, such as Fantasy, Personal Narrative, How-To, Opinion Writing, Informational Writing, Poem, Letter, or Short Response\",",
        "  \"safeReference\": \"story, explanation, opinion piece, response, creative piece, letter, reflection, how-to piece, speech, poem, or piece of writing\",",
        "  \"confidence\": \"high, medium, or low\",",
        "  \"reason\": \"brief reason based on the whole passage\",",
        "  \"notProceduralReason\": \"briefly explain why it is or is not a how-to piece\"",
        "}",
        "",
        "Student writing:",
        String(text || "").trim()
    ].join("\n");
}

function sanitizeAiGenreAgainstText(info, text) {
    var normalized = normalizeWritingGenreInfo(info);
    var raw = String(text || "");

    if (normalized.mainGenre === "Procedural / How-To" && !hasClearProceduralTeachingPurpose(raw)) {
        if (hasStrongNarrativeSignals(raw)) {
            return normalizeWritingGenreInfo({
                mainGenre: "Narrative / Story",
                subtype: detectNarrativeSubtype(raw),
                safeReference: "story",
                confidence: "high",
                source: "ai-safety",
                oneSentenceSummary: normalized.oneSentenceSummary,
                reason: "The passage has story features, so it should not be treated as a how-to piece.",
                notProceduralReason: "It follows a narrator through events instead of teaching the reader a procedure."
            });
        }
        return normalizeWritingGenreInfo({
            mainGenre: "Other / Unsure",
            subtype: "Writing",
            safeReference: "piece of writing",
            confidence: "low",
            source: "ai-safety",
            oneSentenceSummary: normalized.oneSentenceSummary,
            reason: "The AI suggested procedural, but the writing does not clearly teach a process.",
            notProceduralReason: "Procedural labels require clear reader instructions, not just sequence words."
        });
    }

    if (hasStrongNarrativeSignals(raw) && normalized.mainGenre !== "Narrative / Story" && normalized.mainGenre !== "Letter / Email" && normalized.mainGenre !== "Poem / Creative Writing") {
        var localNarrative = getLocalNarrativeGenreInfo(raw);
        localNarrative.source = normalized.source === "ai" ? "ai-safety" : localNarrative.source;
        localNarrative.oneSentenceSummary = normalized.oneSentenceSummary;
        localNarrative.reason = "Strong story signals were detected in the whole passage.";
        localNarrative.notProceduralReason = "The passage follows events in a story rather than giving directions.";
        return normalizeWritingGenreInfo(localNarrative);
    }

    normalized.source = normalized.source || "ai";
    return normalized;
}

async function classifyWritingGenreWithAi(text, model, options) {
    options = options || {};
    var raw = String(text || "").trim();
    if (!raw) return makeWritingGenreInfo("Other / Unsure", "Writing", "piece of writing", "low", "auto");

    var cached = getCachedAiGenreInfo(raw);
    if (cached) return cached;

    if (aiWritingGenrePendingPromise && aiWritingGenrePendingText === raw) {
        return aiWritingGenrePendingPromise;
    }

    aiWritingGenreStatus = "checking";
    if (options.updateUi) updateGenreReviewBox();

    aiWritingGenrePendingText = raw;
    aiWritingGenrePendingPromise = (async function() {
        try {
            var prompt = buildWritingGenreClassificationPrompt(raw);
            var response = await callOpenRouter(getGenreClassificationModel(model), prompt);
            var parsed = parseFirstJsonObject(response);
            if (!parsed) throw new Error("The writing type classifier did not return valid JSON.");
            parsed.source = "ai";
            var info = sanitizeAiGenreAgainstText(parsed, raw);
            aiWritingGenreCacheText = raw;
            aiWritingGenreCacheInfo = info;
            aiWritingGenreStatus = "ready";
            if (options.updateUi && isAutoGenreSelected()) {
                currentWritingGenreInfo = info;
                updateGenreReviewBox();
            }
            return info;
        } catch (e) {
            aiWritingGenreStatus = "failed";
            throw e;
        } finally {
            aiWritingGenrePendingText = "";
            aiWritingGenrePendingPromise = null;
        }
    })();

    return aiWritingGenrePendingPromise;
}

function getManualGenreInfo(value) {
    var choice = getGenreChoiceByValue(value);
    if (!choice) return null;
    return makeWritingGenreInfo(choice.mainGenre, choice.defaultSubtype, choice.safeReference, "teacher-selected", "manual");
}

function getWritingGenreInfoFromUi(text) {
    var select = typeof document !== "undefined" ? document.getElementById("writingGenreSelect") : null;
    var selected = select ? select.value : manualGenreOverrideValue;
    if (selected && selected !== "__auto__") return getManualGenreInfo(selected) || getAutoWritingGenreInfo(text);
    return getAutoWritingGenreInfo(text);
}

function buildWritingGenrePromptText(genreInfo) {
    var info = normalizeWritingGenreInfo(genreInfo);
    return [
        "Writing Type: " + info.mainGenre,
        "Subtype: " + info.subtype,
        "Safe reference word: " + info.safeReference,
        "Confidence: " + info.confidence,
        "Use the safe reference word when referring to the student's work.",
        "Do not call the writing a letter unless the writing type is Letter / Email.",
        "Do not call the writing a poem unless the subtype is Poem.",
        "If the genre is uncertain, use piece of writing."
    ].join("\n");
}

function sanitizeGenreReferenceInFeedback(text, genreInfo) {
    var value = String(text || "");
    if (!value) return value;
    var info = normalizeWritingGenreInfo(genreInfo || currentWritingGenreInfo || {});
    var ref = info.safeReference || "piece of writing";
    function replaceNoun(noun) {
        var escaped = noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        value = value.replace(new RegExp("\\byour\\s+next\\s+" + escaped + "\\b", "gi"), "your next " + ref);
        value = value.replace(new RegExp("\\bthis\\s+" + escaped + "\\b", "gi"), "this " + ref);
        value = value.replace(new RegExp("\\byour\\s+" + escaped + "\\b", "gi"), "your " + ref);
        value = value.replace(new RegExp("\\bthe\\s+" + escaped + "\\b", "gi"), "the " + ref);
    }
    if (info.mainGenre !== "Letter / Email") replaceNoun("letter");
    if (info.mainGenre !== "Narrative / Story") replaceNoun("story");
    if (!(info.mainGenre === "Poem / Creative Writing" && /poem/i.test(info.subtype))) replaceNoun("poem");
    return value.replace(/\s+/g, " ").trim();
}

function inferWritingGenre(text) {
    return detectWritingGenreInfo(text).safeReference;
}

function populateWritingGenreSelect() {
    var select = document.getElementById("writingGenreSelect");
    if (!select || select.getAttribute("data-populated") === "true") return;
    var choices = getWritingGenreChoices();
    for (var i = 0; i < choices.length; i++) {
        var opt = document.createElement("option");
        opt.value = choices[i].value;
        opt.textContent = choices[i].mainGenre;
        select.appendChild(opt);
    }
    select.setAttribute("data-populated", "true");
}

function updateGenreReviewBox() {
    var box = document.getElementById("genreReviewBox");
    var summary = document.getElementById("genreReviewSummary");
    var select = document.getElementById("writingGenreSelect");
    var ta = document.getElementById("studentWriting");
    if (!box || !summary || !select || !ta) return;
    populateWritingGenreSelect();
    var text = ta.value || "";
    if (!text.trim()) {
        box.classList.remove("active");
        currentWritingGenreInfo = null;
        return;
    }
    box.classList.add("active");
    var autoInfo = getAutoWritingGenreInfo(text);
    var activeInfo = getWritingGenreInfoFromUi(text);
    currentWritingGenreInfo = activeInfo;
    var sourceText = select.value === "__auto__" ? (activeInfo.source === "ai" || activeInfo.source === "ai-safety" ? "AI-detected" : "Auto-detected") : "Teacher-selected";
    var extraText = "";
    if (select.value === "__auto__" && aiWritingGenreStatus === "checking" && !getCachedAiGenreInfo(text)) {
        extraText = " Checking with AI...";
    } else if (select.value === "__auto__" && autoInfo.confidence) {
        extraText = " Confidence: " + escapeHtml(autoInfo.confidence) + ".";
    }
    if (select.value === "__auto__" && activeInfo.oneSentenceSummary) {
        extraText += " Summary: " + escapeHtml(activeInfo.oneSentenceSummary);
    }
    setWftSanitizedInnerHtml(summary, sourceText + ": <strong>" + escapeHtml(activeInfo.mainGenre) + "</strong>"
        + (activeInfo.subtype ? " - " + escapeHtml(activeInfo.subtype) : "")
        + " | Feedback will call it: <strong>" + escapeHtml(activeInfo.safeReference) + "</strong>."
        + extraText);
}

function isGenericKeepWriting(text) {
    var value = cleanNotebookSentence(text).toLowerCase();
    if (!value) return true;
    return value === "every story makes you a better writer." ||
        value === "every story makes you a better writer" ||
        value === "keep writing and keep trying your best." ||
        value === "keep writing";
}

function summarizeStrengthForClosing(text) {
    var value = cleanNotebookSentence(text || "");
    if (!value) return "";
    var categories = ["Ideas & Details", "Grammar", "Word Choice", "Organization", "Flow", "Spelling & Punctuation"];
    for (var i = 0; i < categories.length; i++) {
        var safeCategory = categories[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(safeCategory, "i").test(value)) return categories[i];
    }
    value = value.replace(/^Your\s+/i, "");
    value = value.replace(/\s+(?:is|are)\s+your\s+greatest\s+strength[\s\S]*$/i, "");
    value = value.replace(/[.!?][\s\S]*$/, "");
    value = value.replace(/\s+/g, " ").trim();
    if (value.length > 40) return "";
    return value;
}

function buildEncouragingClosing(data) {
    var text = document.getElementById("studentWriting") ? (document.getElementById("studentWriting").value || "") : "";
    var genreInfo = normalizeWritingGenreInfo((data && data.writingGenre) || (data && data.detailed && data.detailed.writingGenre) || currentWritingGenreInfo || detectWritingGenreInfo(text));
    var genre = genreInfo.safeReference || "piece of writing";
    var plan = getGoalPlan(data || {});
    var lowest = getLowestNotebookCategory(data ? data.categoryScores : null);
    var strength = cleanPrintedStrength(data && data.detailed ? data.detailed.strength || "" : "");
    var nextStep = cleanNotebookSentence(plan.nextTime || "revise one part carefully").replace(/[.!?]+$/, "");
    var closing = "You are building strong writing habits, and your next " + genre + " will be even better when you " + nextStep.toLowerCase() + ".";

    if (genreInfo.mainGenre === "Narrative / Story") {
        closing = "You have the start of an engaging story here, and it will be even stronger next time when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Opinion / Argument") {
        closing = "You shared your opinion clearly, and your next opinion piece will be even stronger when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Informational / Explanatory") {
        closing = "You are teaching the reader about your topic, and this explanation will become even clearer when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Procedural / How-To") {
        closing = "Your how-to piece already helps the reader follow your thinking, and it will be even clearer when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Letter / Email") {
        closing = "Your letter already has a clear message, and it will sound even stronger when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Poem / Creative Writing") {
        closing = "Your " + genre + " shows creative thinking, and it will be even stronger when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Literary Analysis / Text Response" || genreInfo.mainGenre === "Academic Short Response") {
        closing = "Your response shows your thinking, and it will be even stronger when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Journal / Reflection") {
        closing = "Your reflection shares your thinking clearly, and it will be even stronger when you " + nextStep.toLowerCase() + ".";
    } else if (genreInfo.mainGenre === "Speech / Presentation") {
        closing = "Your speech has a clear message, and it will be even stronger when you " + nextStep.toLowerCase() + ".";
    }

    if (lowest === "Grammar") {
        closing = "You shared your ideas well, and this " + genre + " will sound even smoother when you check each sentence carefully for grammar as you revise.";
    } else if (lowest === "Spelling & Punctuation") {
        closing = "Your message is coming through clearly, and this " + genre + " will feel even more polished when you proofread for capitals, punctuation, and spelling.";
    } else if (lowest === "Organization") {
        closing = "You have good ideas in this " + genre + ", and it will be even easier to read when you organize them in a clear, logical order.";
    } else if (lowest === "Flow") {
        closing = "You have good ideas in this " + genre + ", and it will be even easier to read when you vary your sentence lengths for a smoother rhythm.";
    } else if (lowest === "Ideas & Details") {
        closing = "You have a solid start here, and this " + genre + " will become even more interesting when you add a few more specific details.";
    } else if (lowest === "Word Choice") {
        closing = "You are communicating your ideas clearly, and this " + genre + " will stand out even more when you choose a few stronger words.";
    }

    if (strength && strength !== "-") {
        var strengthShort = summarizeStrengthForClosing(strength);
        if (strengthShort) {
            closing = "You did a nice job with " + strengthShort.charAt(0).toLowerCase() + strengthShort.slice(1) + ", and your next " + genre + " will be even stronger when you keep working on your grow goal.";
        }
    }

    return sanitizeGenreReferenceInFeedback(closing.replace(/\s+/g, " ").trim(), genreInfo);
}

function trimToWholeWords(text, maxLength) {
    var value = cleanNotebookSentence(text);
    if (value.length <= maxLength) return value;
    var cutoff = value.lastIndexOf(" ", maxLength);
    if (cutoff < Math.floor(maxLength * 0.65)) cutoff = maxLength;
    return value.slice(0, cutoff).replace(/[,:;\-\s]+$/, "");
}

function toFirstPersonChecklist(text) {
    var value = cleanNotebookSentence(text);
    value = value.replace(/\byour story\b/ig, "my writing");
    value = value.replace(/\byour piece\b/ig, "my writing");
    value = value.replace(/\byour work\b/ig, "my work");
    value = value.replace(/\byour writing\b/ig, "my writing");
    value = value.replace(/\byour\b/ig, "my");
    value = value.replace(/\byou are\b/ig, "I am");
    value = value.replace(/\byou\b/ig, "I");
    value = value.replace(/\bme work\b/ig, "my work");
    return value;
}

function compressChecklistItem(text) {
    var value = cleanNotebookSentence(text);
    value = value.replace(/^In your next piece of writing,\s*/i, "");
    value = value.replace(/^Next time,\s*/i, "");
    value = value.replace(/^After you write,\s*/i, "");
    value = value.replace(/^For each [^.]*?,\s*/i, "");
    // Strip conditional preamble - these are teacher-voice explanations that
    // read as nonsense when dropped into a student-facing checkbox without context
    value = value.replace(/^If\s+[^,]{0,80},\s*/i, "");
    value = value.replace(/^When\s+[^,]{0,80},\s*/i, "");
    value = value.replace(/^Before you [^,]{0,60},\s*/i, "");
    value = value.replace(/^As you [^,]{0,60},\s*/i, "");
    value = value.replace(/\([^)]*\)/g, "");
    value = value.replace(/For example:?.*$/i, "");
    value = value.replace(/For example,.*$/i, "");
    value = value.replace(/ask yourself:?.*$/i, "");
    value = value.replace(/one sentence at a time/ig, "sentence by sentence");
    value = value.replace(/read your work aloud/ig, "read my work aloud");
    value = value.replace(/read your story aloud/ig, "read my writing aloud");
    value = value.replace(/challenge yourself to /ig, "");
    value = value.replace(/try to /ig, "");
    value = value.replace(/^use\s+/i, "Use ");
    value = value.replace(/^check\s+/i, "Check ");
    value = value.replace(/^read\s+/i, "Read ");
    value = value.replace(/^add\s+/i, "Add ");
    value = value.replace(/^fix\s+/i, "Fix ");
    value = value.replace(/^make sure\s+/i, "Make sure ");
    value = toFirstPersonChecklist(value);
    value = value.replace(/\s+/g, " ").trim();
    value = value.replace(/[,:;]+$/g, "");
    if (!value) return "Check my work carefully.";
    value = value.charAt(0).toUpperCase() + value.slice(1);
    return trimToWholeWords(value, 160).replace(/[,:;]+$/g, "");
}

function pickTeacherComment(data) {
    if (!data || !data.detailed || !data.detailed.categories) return "-";
    if (data.sampleStatus && data.sampleStatus.status !== "scorable") {
        return data.sampleStatus.status === "insufficient"
            ? "This is a beginning attempt. I can see the topic, and the next step is to turn it into one full sentence."
            : "This piece has a clear start. The next step is to add another complete sentence with one more detail.";
    }

    var text = document.getElementById("studentWriting").value || "";
    var genreInfo = normalizeWritingGenreInfo((data && data.writingGenre) || (data && data.detailed && data.detailed.writingGenre) || currentWritingGenreInfo || detectWritingGenreInfo(text));
    var genre = genreInfo.safeReference;
    var categories = data.detailed.categories;
    var lowest = getLowestNotebookCategory(data.categoryScores);
    var highest = getHighestNotebookCategory(data.categoryScores);
    var overall = Number(data.overall || 0);
    var goalPlan = getGoalPlan(data);

    var opening = "This is a strong start to your " + genre + ".";
    if (overall >= 90) opening = "I enjoyed reading this " + genre + ".";
    else if (overall >= 75) opening = "You did a nice job on this " + genre + ".";

    var topEvidence = cleanNotebookSentence(categories[highest] && categories[highest].evidence ? categories[highest].evidence : "");
    var praise = topEvidence
        ? "You especially showed strength in " + categoryDisplayLabel(highest) + ". " + topEvidence
        : "Your effort really shows in this piece.";

    var lowestGrowthTip = cleanNotebookSentence(categories[lowest] && categories[lowest].growthTip ? categories[lowest].growthTip : "");
    var coaching = "Keep revising carefully to make your writing even stronger.";
    if (lowestGrowthTip) {
        var firstSentenceMatch = lowestGrowthTip.match(/^[^.!?]+[.!?]?/);
        coaching = firstSentenceMatch && firstSentenceMatch[0] ? cleanNotebookSentence(firstSentenceMatch[0]) : lowestGrowthTip;
    } else if (goalPlan.nextTime) {
        coaching = cleanNotebookSentence(goalPlan.nextTime);
    }

    return sanitizeGenreReferenceInFeedback((opening + " " + praise + " " + coaching).replace(/\s+/g, " ").trim(), genreInfo);
}

function isGenericNotebookGuidance(text) {
    var value = cleanNotebookSentence(text).toLowerCase();
    if (!value) return true;
    return value === "check my writing carefully before i submit it" ||
        value === "read my work carefully and fix one thing before i hand it in" ||
        value === "read my work carefully before i submit it" ||
        value === "fix one thing that i notice during proofreading" ||
        value === "revise one part carefully" ||
        value === "check my work carefully";
}

function extractNotebookActionItems(text) {
    var items = [];
    var nextText = cleanNotebookSentence(text);
    if (!nextText) return items;

    var normalized = nextText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n+/g, "\n")
        .replace(/\s+-\s+/g, "\n")
        .replace(/\s*(?:\u2022|\u00C3\u00A2\u00E2\u201A\u00AC\u00C2\u00A2|\u00E2\u20AC\u00A2)\s*/g, "\n")
        .replace(/\s*(?:\u2022|\u00E2\u20AC\u00A2)\s*/g, "\n")
        .replace(/\s*\d+[\.)]\s+/g, "\n")
        .replace(/,\s*after each sentence\b/ig, ". After each sentence")
        .replace(/,\s*then\b/ig, ". Then")
        .replace(/\.\s+(After each sentence|Then|Next|Finally)\b/g, "\n$1");

    var rawParts = normalized.split(/\n+/);
    for (var i = 0; i < rawParts.length; i++) {
        var rawPart = cleanNotebookSentence(rawParts[i]);
        if (!rawPart) continue;
        var part = compressChecklistItem(rawPart);
        if (part && items.indexOf(part) === -1) {
            items.push(part);
        }
        if (items.length >= 2) break;
    }

    if (!items.length) {
        var fallbackItem = compressChecklistItem(nextText);
        if (fallbackItem) items.push(fallbackItem);
    }

    return items.slice(0, 2);
}

function buildNotebookActionChecklist(data, fallbackChecklist, fallbackNextTime, fallbackGrowGoal) {
    var items = [];
    var labels = [
        "Ideas & Details",
        "Grammar",
        "Word Choice",
        "Organization",
        "Flow",
        "Spelling & Punctuation"
    ];
    var categories = data && data.detailed && data.detailed.categories ? data.detailed.categories : {};
    var categoryScores = data && data.categoryScores ? data.categoryScores : {};

    function pushItemsFromText(text) {
        if (!text) return;
        text = normalizeGrowGoalStrategyForSentence(text);
        var extracted = extractNotebookActionItems(text);
        for (var i = 0; i < extracted.length; i++) {
            var item = extracted[i];
            if (!item || isGenericNotebookGuidance(item) || items.indexOf(item) !== -1) continue;
            items.push(item);
            if (items.length >= 2) return;
        }
    }

    var rankedLabels = labels.slice().sort(function(a, b) {
        var aScore = categoryScores[a] != null ? Number(categoryScores[a]) : 999;
        var bScore = categoryScores[b] != null ? Number(categoryScores[b]) : 999;
        if (aScore !== bScore) return aScore - bScore;
        return labels.indexOf(a) - labels.indexOf(b);
    });

    for (var i = 0; i < rankedLabels.length && items.length < 2; i++) {
        var label = rankedLabels[i];
        var score = categoryScores[label] != null ? Number(categoryScores[label]) : 999;
        // Only pull growth tips from categories that genuinely need work.
        // A score of 8+ means the category is performing well - its minor tip
        // should not displace feedback about categories with real problems.
        if (score >= 8) continue;
        var category = categories[label];
        if (!category) continue;
        pushItemsFromText(category.growthTip || "");
    }

    if (items.length < 2) pushItemsFromText(data && data.detailed ? data.detailed.nextTime || "" : "");
    if (items.length < 2) pushItemsFromText(fallbackNextTime || "");
    if (items.length < 2) pushItemsFromText(fallbackGrowGoal || "");

    if (items.length < 2 && fallbackChecklist && fallbackChecklist.length) {
        for (var j = 0; j < fallbackChecklist.length; j++) {
            var fallbackItem = compressChecklistItem(fallbackChecklist[j]);
            if (!fallbackItem || items.indexOf(fallbackItem) !== -1) continue;
            items.push(fallbackItem);
            if (items.length >= 2) break;
        }
    }

    while (items.length < 2) {
        items.push(items.length === 0 ? "Read my work carefully before I submit it." : "Fix one thing that I notice during proofreading.");
    }

    return items.slice(0, 2);
}

function getLowestNotebookCategory(categoryScores) {
    var labels = getActiveCategoryKeys();  // Dynamic based on settings + photos
    var lowest = labels[0];
    var lowestScore = 999;
    for (var i = 0; i < labels.length; i++) {
        var key = labels[i];
        var score = categoryScores && categoryScores[key] != null ? Number(categoryScores[key]) : 999;
        if (score < lowestScore) {
            lowest = key;
            lowestScore = score;
        }
    }
    return lowest;
}

function getHighestNotebookCategory(categoryScores) {
    var labels = getActiveCategoryKeys();  // Dynamic based on settings + photos
    var highest = labels[0];
    var highestScore = -1;
    for (var i = 0; i < labels.length; i++) {
        var key = labels[i];
        var score = categoryScores && categoryScores[key] != null ? Number(categoryScores[key]) : -1;
        if (score > highestScore) {
            highest = key;
            highestScore = score;
        }
    }
    return highest;
}

function categoryDisplayLabel(category) {
    return category === "Word Choice" ? "Vocabulary" : category;
}

function buildStrengthTextFromCategory(category, categories) {
    if (!category || !categories || !categories[category]) return "";
    var evidence = cleanNotebookSentence(categories[category].evidence || "");
    if (!evidence) return "";
    return categoryDisplayLabel(category) + ". " + evidence;
}

function textMentionsCategory(text, category) {
    var value = cleanNotebookSentence(text).toLowerCase();
    if (!value || !category) return false;
    var names = [category.toLowerCase()];
    if (category === "Word Choice") names.push("vocabulary");
    if (category === "Ideas & Details") names.push("ideas and details");
    for (var i = 0; i < names.length; i++) {
        if (value.indexOf(names[i]) !== -1) return true;
    }
    return false;
}

function getGoalPlan(data) {
    if (data && data.sampleStatus && data.sampleStatus.status !== "scorable") {
        return {
            growGoal: data.sampleStatus.status === "insufficient" ? "Turn my idea into a full sentence." : "Add another complete sentence with one more detail.",
            nextTime: data.sampleStatus.status === "insufficient" ? "Write one full sentence that tells who, what, or where." : "Add a second sentence that explains one more detail.",
            checklist: data.sampleStatus.status === "insufficient" ? [
                "Write one complete sentence.",
                "Add an ending mark when I finish."
            ] : [
                "Add a second complete sentence.",
                "Tell one more detail about my topic."
            ]
        };
    }
    var lowest = getLowestNotebookCategory(data ? data.categoryScores : null);
    var detailed = data && data.detailed ? data.detailed : null;
    var categories = data && data.detailed && data.detailed.categories ? data.detailed.categories : {};
    var lowestCategory = categories[lowest] || {};
    var growthTip = normalizeGrowGoalStrategyForSentence(cleanNotebookSentence(lowestCategory.growthTip || ""));
    var plan = {
        growGoal: "Check my writing carefully before I submit it.",
        nextTime: growthTip || "Read my work carefully and fix one thing before I hand it in.",
        checklist: [
            "Read my work carefully before I submit it.",
            "Fix one thing that I notice during proofreading."
        ]
    };

    if (lowest === "Grammar") {
        plan.growGoal = "Check my grammar carefully before I submit my work.";
    } else if (lowest === "Spelling & Punctuation") {
        plan.growGoal = "Double-check my spelling and punctuation before I hand in my work.";
    } else if (lowest === "Organization") {
        plan.growGoal = "Organize my ideas so my writing has a clear beginning, middle, and end.";
    } else if (lowest === "Flow") {
        plan.growGoal = "Connect some of my ideas so my writing flows more smoothly.";
    } else if (lowest === "Ideas & Details") {
        plan.growGoal = "Add a few more details to explain my ideas clearly.";
    } else if (lowest === "Word Choice") {
        plan.growGoal = "Choose a few stronger words to make my writing clearer.";
    }

    if (detailed) {
        var detailedGrowGoal = cleanNotebookSentence(detailed.growGoal || "");
        if (detailedGrowGoal && !isGenericNotebookGuidance(detailedGrowGoal) && textMentionsCategory(detailedGrowGoal, lowest)) {
            plan.growGoal = detailedGrowGoal;
        }
        plan.checklist = buildNotebookActionChecklist(data, plan.checklist, plan.nextTime, plan.growGoal);
    }

    plan.nextTime = normalizeGrowGoalStrategyForSentence(plan.nextTime);
    return plan;
}


function normalizeNotebookMatchText(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasNotebookKeyword(text, keywords) {
    var value = normalizeNotebookMatchText(text);
    if (!value) return false;
    for (var i = 0; i < keywords.length; i++) {
        var word = normalizeNotebookMatchText(keywords[i]);
        if (!word) continue;
        var pattern = new RegExp("(^|\\s)" + word.replace(/\s+/g, "\\s+") + "($|\\s)", "i");
        if (pattern.test(value)) return true;
    }
    return false;
}

function getNotebookIssueFamilies(key) {
    if (key === "Grammar") {
        return [
            { name: "verb tense", keywords: ["verb", "verbs", "tense", "tenses", "agreement", "past tense", "present tense"] },
            { name: "sentence boundaries", keywords: ["sentence boundary", "sentence boundaries", "run on", "run ons", "run-on", "run-ons", "break", "breaks", "period", "ending mark", "punctuation"] },
            { name: "word order", keywords: ["word order", "phrasing", "phrase", "phrases", "natural", "clearer"] },
            { name: "pronouns", keywords: ["pronoun", "pronouns", "reference", "references"] }
        ];
    }
    if (key === "Flow") {
        return [
            { name: "sentence starters", keywords: ["starter", "starters", "started", "begin", "begins", "beginning", "beginnings", "same word", "repeated", "repetitive"] },
            { name: "short sentences", keywords: ["short", "choppy", "jumpy", "combine", "combining"] },
            { name: "sentence variety", keywords: ["variety", "length", "lengths", "rhythm", "smooth", "smoother", "flows"] },
            { name: "transitions", keywords: ["transition", "transitions", "connect", "connection"] }
        ];
    }
    if (key === "Spelling & Punctuation") {
        return [
            { name: "spelling", keywords: ["spell", "spelling", "misspelled", "word choice", "should be", "versus"] },
            { name: "capitalization", keywords: ["capital", "capitalization", "uppercase", "lowercase"] },
            { name: "punctuation", keywords: ["punctuation", "period", "comma", "commas", "ending", "end mark", "question mark", "quotation", "apostrophe"] }
        ];
    }
    if (key === "Organization") {
        return [
            { name: "sequence", keywords: ["sequence", "order", "events", "event", "logical", "timeline"] },
            { name: "structure", keywords: ["beginning", "middle", "ending", "start", "end", "structure"] },
            { name: "paragraphs", keywords: ["paragraph", "paragraphs", "section", "sections"] },
            { name: "transitions", keywords: ["transition", "transitions", "connect", "connection"] }
        ];
    }
    if (key === "Ideas & Details") {
        return [
            { name: "details", keywords: ["detail", "details", "description", "descriptions", "sensory", "specific", "picture"] },
            { name: "development", keywords: ["develop", "development", "explain", "fuller", "target", "word count"] },
            { name: "main idea", keywords: ["main idea", "topic", "focus", "clear idea"] }
        ];
    }
    if (key === "Word Choice") {
        return [
            { name: "specific words", keywords: ["specific", "precise", "exact", "vivid", "descriptive"] },
            { name: "repeated words", keywords: ["repeated", "repeat", "common", "same word", "word variety"] },
            { name: "action words", keywords: ["verb", "verbs", "action", "stronger word"] }
        ];
    }
    if (key === "Neatness") {
        return [
            { name: "spacing", keywords: ["spacing", "space", "spaces", "crowded", "gap"] },
            { name: "letter formation", keywords: ["letter", "letters", "formation", "shape", "shaping"] },
            { name: "line use", keywords: ["line", "lines", "drifts", "above", "below"] },
            { name: "size", keywords: ["size", "consistent", "uneven"] },
            { name: "marks", keywords: ["smudge", "smudges", "cross out", "correction", "marks"] }
        ];
    }
    return [];
}

function getMatchingNotebookIssueFamilies(key, text) {
    var families = getNotebookIssueFamilies(key);
    var matches = [];
    for (var i = 0; i < families.length; i++) {
        if (hasNotebookKeyword(text, families[i].keywords)) matches.push(families[i]);
    }
    return matches;
}

function notebookRowText(row) {
    row = row || {};
    return String(row.area || "") + " " + String(row.comment || "");
}

function notebookRowHasDirectEvidence(row) {
    var text = String(row && row.comment ? row.comment : "");
    if (!text) return false;
    if (/["']([^"']{2,})["']/.test(text)) return true;
    if (/\b(such as|like|for example|including|you used|you started|you wrote|from .* to|between|versus|should be)\b/i.test(text)) return true;
    return false;
}

function notebookTokenOverlapScore(a, b) {
    var left = normalizeNotebookMatchText(a).split(" ");
    var rightText = " " + normalizeNotebookMatchText(b) + " ";
    var seen = {};
    var score = 0;
    for (var i = 0; i < left.length; i++) {
        var token = left[i];
        if (!token || token.length < 4 || seen[token]) continue;
        seen[token] = true;
        if (rightText.indexOf(" " + token + " ") !== -1) score += 1;
    }
    return score;
}

function rowMatchesAnyNotebookFamily(key, rowText, families) {
    families = families || [];
    for (var i = 0; i < families.length; i++) {
        if (hasNotebookKeyword(rowText, families[i].keywords)) return true;
    }
    return false;
}

function isHighEvidenceNotebookRow(key, row) {
    row = row || {};
    var text = notebookRowText(row);
    if (notebookRowHasDirectEvidence(row)) return true;
    if (key === "Flow" && /\byou started\s+\d+\s+sentences?\b/i.test(text)) return true;
    if (key === "Spelling & Punctuation" && /\b(should be|instead of|versus|spelling errors? like|commas?)\b/i.test(text)) return true;
    if (/\b\d+%\b/.test(text)) return true;
    return false;
}

function scoreNotebookFocusRow(key, row, context, index) {
    row = row || {};
    context = context || {};
    var rowText = notebookRowText(row);
    var score = Math.max(0, 3 - index);
    var comment = String(row.comment || "");
    var teacherText = context.teacherText || "";
    var growthText = context.growthText || "";
    var itemText = context.itemText || "";
    var combinedText = [teacherText, growthText, itemText, context.growGoalText || "", context.nextTimeText || ""].join(" ");
    var teacherFamilies = getMatchingNotebookIssueFamilies(key, teacherText);
    var growthFamilies = getMatchingNotebookIssueFamilies(key, growthText);
    var combinedFamilies = getMatchingNotebookIssueFamilies(key, combinedText);
    var rowMatched = false;

    if (rowMatchesAnyNotebookFamily(key, rowText, teacherFamilies)) {
        score += 90;
        rowMatched = true;
    }
    if (rowMatchesAnyNotebookFamily(key, rowText, growthFamilies)) {
        score += 70;
        rowMatched = true;
    }
    if (rowMatchesAnyNotebookFamily(key, rowText, combinedFamilies)) {
        score += 20;
        rowMatched = true;
    }

    score += notebookTokenOverlapScore(rowText, teacherText) * 6;
    score += notebookTokenOverlapScore(rowText, growthText) * 5;
    score += notebookTokenOverlapScore(rowText, itemText) * 2;

    if (isNeedNoticeComment(comment)) score += context.isGrowGoalCategory ? 22 : 10;
    if (isHighEvidenceNotebookRow(key, row)) score += context.isGrowGoalCategory ? 34 : 22;
    if (key === "Flow" && /\byou started\s+\d+\s+sentences?\s+with\s+the\s+word\b/i.test(comment)) score += context.isGrowGoalCategory ? 120 : 90;
    if (key === "Grammar" && /\bverb\b|\btense\b|\bagreement\b/i.test(rowText) && /\bverb\b|\btense\b|\bagreement\b/i.test(teacherText + " " + growthText)) score += 80;
    if (key === "Grammar" && /\bsentence boundaries\b|\brun[- ]?ons?\b/i.test(rowText) && !/\bsentence boundaries\b|\brun[- ]?ons?\b|\bclearer breaks\b|\bending mark\b|\bperiod\b/i.test(teacherText + " " + growthText)) score -= 25;
    if (key === "Neatness" && /\b(spacing|crowded|space)\b/i.test(rowText) && /\b(spacing|crowded|space)\b/i.test(teacherText + " " + growthText)) score += 60;
    if (isNeutralNoticeComment(comment)) score -= rowMatched ? 8 : 22;
    if (!String(comment || "").trim()) score -= 40;
    return score;
}

function selectNotebookFocusRow(key, item, feedback, context) {
    feedback = feedback || {};
    context = context || {};
    var rows = feedback.noticeRows || [];
    if (!rows.length) return { area: getStudentFriendlyAreaName(key), comment: "No detailed note available yet." };
    var itemText = [item && item.evidence ? item.evidence : "", item && item.growthTip ? item.growthTip : "", item && item.teacherComment ? item.teacherComment : ""].join(" ");
    var scoringContext = {
        teacherText: feedback.teacherComment || item && item.teacherComment || "",
        growthText: feedback.growthTip || item && item.growthTip || "",
        itemText: itemText,
        growGoalText: context.growGoalText || "",
        nextTimeText: context.nextTimeText || "",
        isGrowGoalCategory: !!context.isGrowGoalCategory
    };
    var best = rows[0];
    var bestScore = -9999;
    for (var i = 0; i < rows.length; i++) {
        var currentScore = scoreNotebookFocusRow(key, rows[i], scoringContext, i);
        if (currentScore > bestScore) {
            best = rows[i];
            bestScore = currentScore;
        }
    }
    return best || rows[0];
}

function notebookTextMatchesFocus(key, text, focusRow) {
    var value = String(text || "");
    if (!value || !focusRow) return false;
    var rowText = notebookRowText(focusRow);
    var textFamilies = getMatchingNotebookIssueFamilies(key, value);
    for (var i = 0; i < textFamilies.length; i++) {
        if (hasNotebookKeyword(rowText, textFamilies[i].keywords)) return true;
    }
    if (isHighEvidenceNotebookRow(key, focusRow) && notebookTokenOverlapScore(rowText, value) >= 1) return true;
    return notebookTokenOverlapScore(rowText, value) >= 2;
}

function buildNotebookTeacherComment(key, item, focusRow, fallback) {
    item = item || {};
    var candidate = cleanTeacherCommentText(fallback || "", key, item.score);
    if (candidate && isValidTeacherComment(candidate, key, item, [focusRow]) && notebookTextMatchesFocus(key, candidate, focusRow)) return candidate;
    return cleanTeacherCommentText(buildEvidenceBasedTeacherComment(key, item, [focusRow]), key, item.score);
}

function buildNotebookGrowthTip(key, item, focusRow, fallback) {
    item = item || {};
    var candidate = cleanGrowthTipText(fallback || "", key, item.score);
    if (candidate && isValidGrowthTip(candidate, key, item, [focusRow]) && notebookTextMatchesFocus(key, candidate, focusRow)) return candidate;
    return cleanGrowthTipText(buildActionGrowthTip(key, item, [focusRow]), key, item.score);
}

function buildNotebookNoticedLine(focusRow) {
    focusRow = focusRow || {};
    var area = String(focusRow.area || "").trim();
    var comment = String(focusRow.comment || "").trim() || "No assessment note available yet.";
    return (area ? area + ": " : "") + comment;
}

function getNotebookCategoryPrintData(key, item, context) {
    item = item || {};
    context = context || {};
    var feedback = buildStudentFeedbackForCategory(key, item);
    var focusRow = selectNotebookFocusRow(key, item, feedback, context);
    var teacherComment = buildNotebookTeacherComment(key, item, focusRow, feedback.teacherComment);
    var tip = buildNotebookGrowthTip(key, item, focusRow, feedback.growthTip);
    return {
        teacherComment: teacherComment,
        noticed: buildNotebookNoticedLine(focusRow),
        tip: tip || "Choose one part to revise carefully in your next piece of writing.",
        focusArea: focusRow.area || "",
        source: "detailed-feedback"
    };
}
function getNotebookScoreClass(score, maxScore) {
    var n = Number(score);
    var max = Number(maxScore) || 100;
    if (!isFinite(n)) return "score-missing";
    var percent = max > 0 ? (n / max) * 100 : n;
    if (percent >= 90) return "score-excellent";
    if (percent >= 80) return "score-good";
    if (percent >= 70) return "score-developing";
    return "score-needs-support";
}

function toNotebookTitleCase(value) {
    value = String(value || "piece of writing").replace(/\s+/g, " ").trim();
    if (!value) return "Piece of Writing";
    return value.split(" ").map(function(word) {
        if (!word) return word;
        if (/^how-to$/i.test(word)) return "How-to";
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(" ");
}

function getNotebookWritingTypeLabel(genreInfo) {
    var info = normalizeWritingGenreInfo(genreInfo || currentWritingGenreInfo || {});
    return toNotebookTitleCase(info.safeReference || "piece of writing");
}

function getNotebookWordsTargetLabel(settings) {
    settings = settings || {};
    var actual = settings.actualWords != null ? parseInt(settings.actualWords, 10) : parseInt(settings.actualWordsLabel, 10);
    if (!isFinite(actual) || actual < 0) actual = 0;
    var target = settings.targetWords != null ? parseInt(settings.targetWords, 10) : 0;
    if (isFinite(target) && target > 0) return actual + " / " + target + "-word target";
    return actual + " words";
}


function getNotebookDetailedAssessmentSource(dataOrDetailed) {
    var data = dataOrDetailed || {};
    if (data.detailed && data.detailed.categories) {
        return {
            detailed: data.detailed,
            categoryScores: data.categoryScores || {},
            growGoalText: data.detailed.growGoal || "",
            nextTimeText: data.detailed.nextTime || ""
        };
    }
    return {
        detailed: data,
        categoryScores: data.categoryScores || {},
        growGoalText: data.growGoal || "",
        nextTimeText: data.nextTime || ""
    };
}

function getNotebookAlignedCategoryScore(key, item, categoryScores) {
    item = item || {};
    categoryScores = categoryScores || {};
    if (item.score != null && item.score !== "" && !isNaN(Number(item.score))) return Number(item.score);
    if (categoryScores[key] != null && categoryScores[key] !== "" && !isNaN(Number(categoryScores[key]))) return Number(categoryScores[key]);
    return null;
}

function notebookCategoryIsGrowGoal(key, growGoalText, nextTimeText) {
    var combined = String(growGoalText || "") + " " + String(nextTimeText || "");
    if (!combined.replace(/\s+/g, "").length) return false;
    return textMentionsCategory(combined, key);
}

function renderNotebookDetailedAssessment(dataOrDetailed) {
    var source = getNotebookDetailedAssessmentSource(dataOrDetailed);
    var detailed = source.detailed;
    if (!detailed || !detailed.categories) {
        return '<div class="category"><div class="category-header"><span class="category-name">Detailed Assessment</span><span class="score-badge">--</span></div><div class="evidence-block"><strong>Teacher Comment:</strong> No assessment data.</div><div class="tip-block"><strong>Tip:</strong> Analyze the writing first to create a notebook summary.</div></div>';
    }
    var baseOrder = [
        ["Ideas & Details", "Ideas & Details"],
        ["Grammar", "Grammar"],
        ["Word Choice", "Vocabulary"],
        ["Organization", "Organization"],
        ["Flow", "Flow"],
        ["Spelling & Punctuation", "Spelling & Punctuation"]
    ];
    if (shouldAssessNeatness() || (detailed.categories && detailed.categories["Neatness"])) {
        baseOrder.push(["Neatness", "Neatness"]);
    }

    var html = "";
    var renderedCount = 0;
    for (var i = 0; i < baseOrder.length; i++) {
        var key = baseOrder[i][0];
        var label = baseOrder[i][1];
        var item = detailed.categories[key];
        if (!item) continue;
        var score = getNotebookAlignedCategoryScore(key, item, source.categoryScores);
        var hasNumericScore = score != null && !isNaN(Number(score));
        var scoreLabel = hasNumericScore ? (escapeHtml(String(score)) + " / " + RUBRIC_MAX) : "Missing";
        var width = score != null ? Math.max(0, Math.min(100, Math.round((score / RUBRIC_MAX) * 100))) : 0;
        var context = {
            growGoalText: source.growGoalText,
            nextTimeText: source.nextTimeText,
            isGrowGoalCategory: notebookCategoryIsGrowGoal(key, source.growGoalText, source.nextTimeText)
        };
        var itemForPrint = item;
        if (score != null && item.score !== score) {
            itemForPrint = cloneWftJson(item);
            itemForPrint.score = score;
        }
        var printData = getNotebookCategoryPrintData(key, itemForPrint, context);
        html += '<div class="category ' + getNotebookScoreClass(score, RUBRIC_MAX) + '">';
        html += '<div class="category-header"><span class="category-name">' + escapeHtml(label) + '</span><span class="score-badge">' + scoreLabel + '</span></div>';
        html += '<div class="score-bar-track"><div class="score-bar-fill" style="width:' + width + '%"></div></div>';
        html += '<div class="evidence-block"><strong>Teacher Comment:</strong> ' + escapeHtml(printData.teacherComment) + '</div>';
        html += '<div class="evidence-block"><strong>What I noticed:</strong> ' + escapeHtml(printData.noticed) + '</div>';
        html += '<div class="tip-block"><strong>Tip:</strong> ' + escapeHtml(printData.tip) + '</div>';
        html += '</div>';
        renderedCount += 1;
    }
    if (renderedCount % 2 === 1) html += '<div></div>';
    return html;
}

function wrapCorrectedHtmlForNotebookPrint(html) {
    var value = reflowCorrectedHtmlForDisplay(html || "").trim();
    if (!value) return '<p>-</p>';
    value = value.replace(/(?:\s*<br\s*\/?>(?:\s|&nbsp;)*){2,}/gi, '</p><p>');
    value = value.replace(/\s*<br\s*\/?>(?:\s|&nbsp;)*/gi, ' ');
    if (!/^\s*<p[\s>]/i.test(value)) value = '<p>' + value + '</p>';
    return sanitizeWftHtmlFragment(value);
}

function getNotebookAssessmentSettings(data) {
    data = data || {};
    var settings = data.assessmentSettings || {};
    var classGradeLabel = settings.classGradeLabel || data.classGradeLabel || formatGradeLevelLabel(settings.classGradeLevel || data.classGradeLevel || data.gradeLevel || getClassGradeLevel());
    var strictness = settings.grammarStrictness != null ? settings.grammarStrictness : (data.grammarStrictness != null ? data.grammarStrictness : getEffectiveGrammarStrictnessValue());
    var target = data.targetWords != null ? data.targetWords : (settings.targetWordCount != null ? settings.targetWordCount : getEffectiveTargetWordCount());
    var actual = data.actualWords != null ? parseInt(data.actualWords, 10) : 0;
    if (!isFinite(actual) || actual < 0) actual = 0;
    target = parseInt(target, 10);
    if (!isFinite(target) || target < 0) target = 0;
    return {
        classGradeLabel: classGradeLabel,
        grammarStrictnessLabel: settings.grammarStrictnessLabel || formatGrammarStrictnessLabel(strictness),
        targetWordCountLabel: settings.targetWordCountLabel || formatTargetWordCountLabel(target, target > 0),
        actualWords: actual,
        targetWords: target,
        actualWordsLabel: String(actual),
        wordTargetLabel: getNotebookWordsTargetLabel({ actualWords: actual, targetWords: target })
    };
}


function getNotebookRevisionFocusItems(data) {
    data = data || {};
    var scoreMap = data.categoryScores || {};
    var labels = typeof getActiveCategoryKeys === "function" ? getActiveCategoryKeys() : CATEGORY_KEYS.slice();
    var focusLabels = {
        "Grammar": "Verb tense and sentence breaks",
        "Flow": "Sentence flow",
        "Spelling & Punctuation": "Spelling and punctuation",
        "Organization": "Paragraph organization and transitions",
        "Ideas & Details": "Specific details",
        "Word Choice": "Precise word choices",
        "Neatness": "Spacing and handwriting"
    };
    var ranked = [];
    for (var i = 0; i < labels.length; i += 1) {
        var key = labels[i];
        var score = scoreMap && scoreMap[key] != null ? Number(scoreMap[key]) : null;
        if (!isFinite(score)) continue;
        ranked.push({ key: key, score: score });
    }
    ranked.sort(function(a, b) {
        if (a.score !== b.score) return a.score - b.score;
        return labels.indexOf(a.key) - labels.indexOf(b.key);
    });

    var items = [];
    function addItem(text) {
        text = String(text || "").replace(/\s+/g, " ").trim();
        if (!text || items.indexOf(text) !== -1) return;
        items.push(text);
    }

    for (var j = 0; j < ranked.length && items.length < 3; j += 1) {
        if (ranked[j].score >= 9 && items.length >= 2) continue;
        addItem(focusLabels[ranked[j].key] || categoryDisplayLabel(ranked[j].key));
    }

    var plan = getGoalPlan(data);
    if (items.length < 2 && plan && plan.growGoal) addItem(cleanNotebookSentence(plan.growGoal));
    if (items.length < 2) addItem("Read the corrected version aloud");
    if (items.length < 2) addItem("Notice one change you can use next time");
    return items.slice(0, 3);
}

function renderNotebookRevisionFocusList(data) {
    var items = getNotebookRevisionFocusItems(data);
    var html = "";
    for (var i = 0; i < items.length; i += 1) {
        html += "<li>" + escapeHtml(items[i]) + "</li>";
    }
    return html || "<li>Read the corrected version aloud.</li>";
}

function fillNotebookSummary() {
    if (!latestAnalysisData) {
        alert("Please analyze the writing first.");
        return false;
    }

    var text = document.getElementById("studentWriting").value || "";
    var title = getPreferredWritingTitle(text, latestAnalysisData.detailed && latestAnalysisData.detailed.titleSuggestion);
    var today = new Date();
    var dateText = today.toLocaleDateString("en-GB");
    var notebookSettings = getNotebookAssessmentSettings(latestAnalysisData);

    document.getElementById("notebookTitle").textContent = title;
    var notebookPage2Title = document.getElementById("notebookPage2Title");
    if (notebookPage2Title) notebookPage2Title.textContent = title;
    var notebookOverallScore = document.getElementById("notebookOverallScore");
    if (notebookOverallScore) {
        notebookOverallScore.textContent = latestAnalysisData.overall == null ? (latestAnalysisData.sampleStatus ? latestAnalysisData.sampleStatus.label : "Not scored") : (latestAnalysisData.overall + "%");
        notebookOverallScore.className = "overall-value " + getNotebookScoreClass(latestAnalysisData.overall, 100);
    }
    document.getElementById("notebookDate").textContent = dateText;
    var notebookPage2Date = document.getElementById("notebookPage2Date");
    if (notebookPage2Date) notebookPage2Date.textContent = dateText;
    var notebookStudentName = document.getElementById("notebookStudentName");
    if (notebookStudentName) notebookStudentName.textContent = selectedStudent || "No student selected";
    var notebookWritingType = document.getElementById("notebookWritingType");
    if (notebookWritingType) notebookWritingType.textContent = getNotebookWritingTypeLabel((latestAnalysisData && latestAnalysisData.writingGenre) || (latestAnalysisData.detailed && latestAnalysisData.detailed.writingGenre) || currentWritingGenreInfo);
    var notebookWordsTarget = document.getElementById("notebookWordsTarget");
    if (notebookWordsTarget) notebookWordsTarget.textContent = notebookSettings.wordTargetLabel;

    var goalPlan = getGoalPlan(latestAnalysisData);
    var notebookGrowGoal = goalPlan.growGoal;
    var highestCategory = getHighestNotebookCategory(latestAnalysisData.categoryScores);
    var evidenceStrength = buildStrengthTextFromCategory(highestCategory, latestAnalysisData.detailed && latestAnalysisData.detailed.categories);
    var aiStrength = cleanPrintedStrength(latestAnalysisData.detailed.strength || "");
    var notebookStrength = "-";
    if (aiStrength && aiStrength !== "-" && textMentionsCategory(aiStrength, highestCategory)) {
        notebookStrength = aiStrength;
    } else if (evidenceStrength) {
        notebookStrength = evidenceStrength;
    }

    document.getElementById("notebookStrength").textContent = notebookStrength;
    document.getElementById("notebookGrowGoal").textContent = notebookGrowGoal;

    var nbDetailed = document.getElementById("notebookDetailedAssessment");
    if (nbDetailed) {
        setWftSanitizedInnerHtml(nbDetailed, renderNotebookDetailedAssessment(latestAnalysisData));
    }
    document.getElementById("notebookTeacherComment").textContent = pickTeacherComment(latestAnalysisData);
    setWftSanitizedInnerHtml("notebookRevisionFocusList", renderNotebookRevisionFocusList(latestAnalysisData));
    setWftSanitizedInnerHtml("notebookCorrectedText", wrapCorrectedHtmlForNotebookPrint(renderCorrected(text, latestAnalysisData.correctedStory || text)));
    return true;
}

function getNotebookPrintCss() {
    return [
        "@page { size: A5 portrait; margin: 0; }",
        "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
        "html { -webkit-font-smoothing: antialiased; }",
        "body { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; font-size: 12.4px; color: #111111; background: #e0e0e0; line-height: 1.4; }",
        ".screen-controls { text-align: center; padding: 10px; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; font-size: 11px; color: #555; }",
        ".btn-print { display: inline-block; background: #222; color: #fff; border: none; padding: 6px 20px; border-radius: 4px; font-size: 11px; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; font-weight: 600; cursor: pointer; margin-top: 6px; }",
        ".btn-print:hover { background: #000; }",
        ".page { width: 148mm; min-height: 210mm; background: #ffffff; margin: 8mm auto; padding: 8mm 9mm 9mm; box-shadow: 0 2px 12px rgba(0,0,0,0.18); page-break-after: always; }",
        ".page:last-child { page-break-after: auto; }",
        ".page-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #333333; box-shadow: 0 2px 0 #3b2f45; padding-bottom: 4px; margin-bottom: 5px; }",
        ".page-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #444444; margin-bottom: 2px; }",
        ".page-title { font-family: 'DM Serif Display', Georgia, serif; font-size: 18.5px; font-weight: 400; color: #111111; line-height: 1.1; }",
        ".overall-score { text-align: right; flex-shrink: 0; margin-left: 8px; }",
        ".overall-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #444444; margin-bottom: 1px; }",
        ".overall-value { display: inline-block; font-family: 'DM Serif Display', Georgia, serif; font-size: 24.5px; font-weight: 400; color: #111111; line-height: 1; border: 1px solid #999999; border-radius: 7px; padding: 1px 6px 3px; background: #ffffff; }",
        ".overall-value.score-excellent { color: #0f766e; border-color: #0f766e; background: #f0fdfa; }",
        ".overall-value.score-good { color: #334155; border-color: #64748b; background: #f8fafc; }",
        ".overall-value.score-developing { color: #92400e; border-color: #d97706; background: #fffbeb; }",
        ".overall-value.score-needs-support { color: #c2410c; border-color: #fb923c; background: #fff7ed; }",
        ".meta-row { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10.3px; color: #444444; padding: 3px 0 4px; border-bottom: 1px solid #cccccc; margin-bottom: 5px; }",
        ".meta-row strong { color: #111111; font-weight: 600; }",
        ".writing-type-chip { display: inline; border: 0; background: transparent; color: #444444; border-radius: 0; padding: 0; font-weight: 400; line-height: inherit; }",
        ".top-boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 5px; }",
        ".info-box { background: #f8fafc; border: 1px solid #cccccc; border-radius: 4px; padding: 4px 5px; }",
        ".strength-box { background: #f0fdfa; border-left: 3px solid #0f766e; }",
        ".strength-box .box-label { color: #0f766e; }",
        ".grow-goal-box { background: #fffbeb; border-left: 3px solid #d97706; }",
        ".grow-goal-box .box-label { color: #92400e; }",
        ".box-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #444444; margin-bottom: 2px; }",
        ".info-box p { font-size: 9.9px; color: #111111; line-height: 1.45; }",
        ".teacher-comment { background: #f8fafc; border: 1px solid #cccccc; border-left: 3px solid #64748b; border-radius: 4px; padding: 4px 5px; margin-bottom: 6px; }",
        ".teacher-comment p { font-size: 9.9px; color: #111111; line-height: 1.5; }",
        ".section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #444444; border-bottom: 1px solid #888888; padding-bottom: 2px; margin-bottom: 5px; }",
        ".assessment-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 6px; align-items: start; }",
        ".category { border: 1px solid #cccccc; border-radius: 3px; padding: 4px 5px; background: #ffffff; width: 100%; min-width: 0; }",
        ".category-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; width: 100%; min-width: 0; }",
        ".category-name { font-weight: 700; font-size: 10.3px; color: #111111; letter-spacing: 0.01em; min-width: 0; }",
        ".score-badge { font-size: 9.3px; font-weight: 700; background: #f3f4f6; border: 1px solid #9ca3af; border-radius: 99px; padding: 0px 5px; white-space: nowrap; color: #111111; }",
        ".score-excellent .score-badge { background: #f0fdfa; border-color: #0f766e; color: #0f766e; }",
        ".score-good .score-badge { background: #f8fafc; border-color: #64748b; color: #334155; }",
        ".score-developing .score-badge { background: #fffbeb; border-color: #d97706; color: #92400e; }",
        ".score-needs-support .score-badge { background: #fff7ed; border-color: #fb923c; color: #c2410c; }",
        ".score-bar-track { display: block; width: 100%; min-width: 0; height: 3.5px; min-height: 3.5px; background: #cccccc; border-radius: 99px; margin-bottom: 4px; overflow: hidden; }",
        ".score-bar-fill { display: block; height: 100%; min-height: 100%; border-radius: 99px; background: #333333; }",
        ".evidence-block { font-size: 9.3px; color: #111111; line-height: 1.45; margin-bottom: 3px; }",
        ".evidence-block strong { font-weight: 700; color: #111111; }",
        ".tip-block strong { font-weight: 700; color: #92400e; }",
        ".tip-block { font-size: 9.3px; color: #7c2d12; line-height: 1.45; padding-top: 3px; border-top: 1px dashed #f3d08a; }",
        ".page2-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #333333; box-shadow: 0 2px 0 #3b2f45; padding-bottom: 4px; margin-bottom: 8mm; }",
        ".page2-meta { font-size: 8px; color: #444444; margin-bottom: 2px; }",
        ".page2-title { font-family: 'DM Serif Display', Georgia, serif; font-size: 14px; font-weight: 400; }",
        ".page2-date { font-size: 8.5px; color: #444444; text-align: right; }",
        ".corrected-writing { border: 1px solid #cccccc; border-top: 3px solid #3b2f45; border-radius: 4px; padding: 6mm 7mm; }",
        ".corrected-writing .section-title { color: #3b2f45; border-bottom-color: #d6d3d1; margin-bottom: 2mm; }",
        ".revision-focus { font-size: 8.8px; color: #374151; background: #fafaf9; border-left: 2px solid #d97706; padding: 2mm 2.5mm; margin-bottom: 3mm; line-height: 1.35; }",
        ".revision-focus-title { font-size: 8.2px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #92400e; margin-bottom: 1mm; }",
        ".revision-focus ul { margin: 0; padding-left: 3.8mm; }",
        ".revision-focus li { margin: 0 0 0.5mm; }",
        ".revision-focus li:last-child { margin-bottom: 0; }",
        ".corrected-writing .notebook-corrected-text { font-size: 10px; color: #111111; line-height: 1.45; margin-bottom: 3mm; white-space: normal; }",
        ".corrected-writing .notebook-corrected-text p { font-size: 10px; color: #111111; line-height: 1.45; margin-bottom: 3mm; white-space: normal; border-left: 0; padding-left: 0; }",
        ".corrected-writing .notebook-corrected-text p:last-child { margin-bottom: 0; }",
        ".corrected-writing b, .corrected-writing .corrected-highlight { font-weight: inherit; text-decoration: none; background: transparent; color: #111111; padding: 0; border-radius: 0; }",
        ".corrected-writing .story-title-line { display: block; font-weight: 700; margin-bottom: 3mm; color: #111111; }",
        ".auto-fit-page { --fit-scale: 1; }",
        ".auto-fit-page .page-header { padding-bottom: calc(4px * var(--fit-scale)); margin-bottom: calc(5px * var(--fit-scale)); }",
        ".auto-fit-page .page-label { font-size: calc(9px * var(--fit-scale)); margin-bottom: calc(2px * var(--fit-scale)); }",
        ".auto-fit-page .page-title { font-size: calc(18.5px * var(--fit-scale)); }",
        ".auto-fit-page .overall-label { font-size: calc(8.5px * var(--fit-scale)); }",
        ".auto-fit-page .overall-value { font-size: calc(26.5px * var(--fit-scale)); }",
        ".auto-fit-page .meta-row { row-gap: calc(4px * var(--fit-scale)); column-gap: calc(12px * var(--fit-scale)); font-size: calc(10.3px * var(--fit-scale)); padding-top: calc(3px * var(--fit-scale)); padding-bottom: calc(4px * var(--fit-scale)); margin-bottom: calc(5px * var(--fit-scale)); }",
        ".auto-fit-page .top-boxes { gap: calc(5px * var(--fit-scale)); margin-bottom: calc(5px * var(--fit-scale)); }",
        ".auto-fit-page .info-box, .auto-fit-page .teacher-comment { padding: calc(4px * var(--fit-scale)) calc(5px * var(--fit-scale)); }",
        ".auto-fit-page .teacher-comment { margin-bottom: calc(6px * var(--fit-scale)); }",
        ".auto-fit-page .box-label, .auto-fit-page .section-title { font-size: calc(9px * var(--fit-scale)); }",
        ".auto-fit-page .box-label { margin-bottom: calc(2px * var(--fit-scale)); }",
        ".auto-fit-page .info-box p, .auto-fit-page .teacher-comment p { font-size: calc(9.9px * var(--fit-scale)); line-height: 1.32; }",
        ".auto-fit-page .section-title { padding-bottom: calc(2px * var(--fit-scale)); margin-bottom: calc(5px * var(--fit-scale)); }",
        ".auto-fit-page .assessment-grid { gap: calc(4px * var(--fit-scale)) calc(6px * var(--fit-scale)); }",
        ".auto-fit-page .category { padding: calc(4px * var(--fit-scale)) calc(5px * var(--fit-scale)); }",
        ".auto-fit-page .category-header { margin-bottom: calc(2px * var(--fit-scale)); }",
        ".auto-fit-page .category-name { font-size: calc(10.3px * var(--fit-scale)); }",
        ".auto-fit-page .score-badge { font-size: calc(9.3px * var(--fit-scale)); padding-left: calc(5px * var(--fit-scale)); padding-right: calc(5px * var(--fit-scale)); }",
        ".auto-fit-page .score-bar-track { width: 100%; min-width: 0; height: 3.5px; min-height: 3.5px; margin-bottom: calc(4px * var(--fit-scale)); }",
        ".auto-fit-page .evidence-block, .auto-fit-page .tip-block { font-size: calc(9.3px * var(--fit-scale)); line-height: 1.32; }",
        ".auto-fit-page .evidence-block { margin-bottom: calc(3px * var(--fit-scale)); }",
        ".auto-fit-page .tip-block { padding-top: calc(3px * var(--fit-scale)); }",
        "@media print { body { background: white; } .screen-controls { display: none; } .page { margin: 0; box-shadow: none; width: 148mm; min-height: 210mm; } .auto-fit-page { height: 210mm; min-height: 210mm; max-height: 210mm; overflow: hidden; } }"
    ].join("\n");
}

function getNotebookPrintFitScript() {
    return '<script>' +
        '(function(){' +
        'function mmToPx(mm){var probe=document.createElement("div");probe.style.position="absolute";probe.style.visibility="hidden";probe.style.height=mm+"mm";document.body.appendChild(probe);var px=probe.getBoundingClientRect().height;document.body.removeChild(probe);return px;}' +
        'function each(page,sel,fn){var nodes=page.querySelectorAll(sel);for(var i=0;i<nodes.length;i++){fn(nodes[i]);}}' +
        'function setPx(page,sel,prop,value){each(page,sel,function(node){node.style[prop]=(Math.max(0,value)).toFixed(2)+"px";});}' +
        'function applyScale(page,scale){page.style.setProperty("--fit-scale",String(scale));var rules=[[".page-header","paddingBottom",4],[".page-header","marginBottom",5],[".page-label","fontSize",9],[".page-label","marginBottom",2],[".page-title","fontSize",18.5],[".overall-label","fontSize",8.5],[".overall-value","fontSize",26.5],[".meta-row","rowGap",4],[".meta-row","columnGap",12],[".meta-row","fontSize",10.3],[".meta-row","paddingTop",3],[".meta-row","paddingBottom",4],[".meta-row","marginBottom",5],[".top-boxes","gap",5],[".top-boxes","marginBottom",5],[".box-label","fontSize",9],[".box-label","marginBottom",2],[".section-title","fontSize",9],[".section-title","paddingBottom",2],[".section-title","marginBottom",5],[".assessment-grid","rowGap",4],[".assessment-grid","columnGap",6],[".category","paddingTop",4],[".category","paddingRight",5],[".category","paddingBottom",4],[".category","paddingLeft",5],[".category-header","marginBottom",2],[".category-name","fontSize",10.3],[".score-badge","fontSize",9.3],[".score-badge","paddingLeft",5],[".score-badge","paddingRight",5],[".score-bar-track","marginBottom",4],[".evidence-block","fontSize",9.3],[".evidence-block","marginBottom",3],[".tip-block","fontSize",9.3],[".tip-block","paddingTop",3]];for(var i=0;i<rules.length;i++){setPx(page,rules[i][0],rules[i][1],rules[i][2]*scale);}each(page,".info-box,.teacher-comment",function(node){node.style.paddingTop=(4*scale).toFixed(2)+"px";node.style.paddingRight=(5*scale).toFixed(2)+"px";node.style.paddingBottom=(4*scale).toFixed(2)+"px";node.style.paddingLeft=(5*scale).toFixed(2)+"px";});setPx(page,".teacher-comment","marginBottom",6*scale);each(page,".score-bar-track",function(node){node.style.display="block";node.style.width="100%";node.style.minWidth="0";node.style.height="3.5px";node.style.minHeight="3.5px";});each(page,".score-bar-fill",function(node){node.style.display="block";node.style.height="100%";node.style.minHeight="100%";});each(page,".info-box p,.teacher-comment p,.evidence-block,.tip-block",function(node){node.style.lineHeight="1.32";});}' +
        'function pageOverflows(page){return page.scrollHeight>page.clientHeight+1;}' +
        'function fitPageOne(){var page=document.querySelector(".auto-fit-page");if(!page)return;var targetHeight=mmToPx(210)-mmToPx(5);var originalHeight=page.style.height;var originalMinHeight=page.style.minHeight;var originalMaxHeight=page.style.maxHeight;var originalOverflow=page.style.overflow;page.style.height=targetHeight+"px";page.style.minHeight=targetHeight+"px";page.style.maxHeight=targetHeight+"px";page.style.overflow="hidden";applyScale(page,1);var minScale=0.62;var low=minScale;var high=1;var best=1;if(pageOverflows(page)){best=minScale;for(var i=0;i<24;i++){var mid=(low+high)/2;applyScale(page,mid);if(pageOverflows(page)){high=mid;}else{best=mid;low=mid;}}applyScale(page,Math.floor(best*1000)/1000);}if(pageOverflows(page)){page.classList.add("fit-warning");}else{page.classList.remove("fit-warning");}page.style.height=originalHeight;page.style.minHeight=originalMinHeight;page.style.maxHeight=originalMaxHeight;page.style.overflow=originalOverflow;}' +
        'window.fitNotebookPageOne=fitPageOne;window.addEventListener("load",function(){var run=function(){fitPageOne();setTimeout(fitPageOne,120);setTimeout(fitPageOne,400);};if(document.fonts&&document.fonts.ready){document.fonts.ready.then(run);}else{run();}});window.addEventListener("resize",fitPageOne);window.addEventListener("beforeprint",fitPageOne);' +
        '})();' +
        '<\/script>';
}


function writeWftPrintWindow(printWindow, printHtml) {
    try { printWindow.opener = null; } catch (e) { }
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
}

function scheduleWftPrintWindow(printWindow) {
    try { printWindow.focus(); } catch (e) { }
    setTimeout(function() {
        try {
            if (printWindow.fitNotebookPageOne) printWindow.fitNotebookPageOne();
            printWindow.print();
        } catch (e) { }
    }, 700);
}

function buildNotebookPrintDocument(printContentHtml, studentName, writingTitle) {
    var safeName = (studentName || "").replace(/[\/\\:*?"<>|]/g, "").trim();
    var safeTitle = (writingTitle || "").replace(/[\/\\:*?"<>|]/g, "").trim();
    var docTitle = safeName && safeTitle
        ? (safeName + " - " + safeTitle)
        : (safeName || safeTitle || "Notebook Summary");
    return '<!DOCTYPE html>' +
        '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + escapeHtml(docTitle) + '</title>' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
        '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300..700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">' +
        '<style>' + getNotebookPrintCss() + '</style></head><body>' +
        '<div class="screen-controls">Writing Notebook Summary - A5 (2 pages) &nbsp;|&nbsp; <button class="btn-print" onclick="window.print()">Print / Save as PDF</button></div>' +
        printContentHtml + getNotebookPrintFitScript() + '</body></html>';
}

function printNotebookSummary() {
    if (!fillNotebookSummary()) return;

    var printDoc = document.getElementById("notebookPrintDocument");
    if (!printDoc) {
        alert("Notebook summary print document not found.");
        return;
    }

    var printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
        alert("Please allow pop-ups for this page to print the notebook summary.");
        return;
    }

    var studentName = (document.getElementById("notebookStudentName") || {}).textContent || "";
    var writingTitle = (document.getElementById("notebookTitle") || {}).textContent || "";
    var printHtml = buildNotebookPrintDocument(printDoc.innerHTML, studentName, writingTitle);
    writeWftPrintWindow(printWindow, printHtml);
    scheduleWftPrintWindow(printWindow);
}

function captureNotebookPrintSnapshotForCurrentAnalysis() {
    try {
        if (!latestAnalysisData) return "";
        if (!fillNotebookSummary()) return "";
        var printDoc = document.getElementById("notebookPrintDocument");
        return printDoc ? printDoc.innerHTML : "";
    } catch (e) {
        wftDebugWarn("Could not capture notebook print snapshot for portfolio.", e);
        return "";
    }
}

function findPortfolioSession(studentName, sessionId) {
    if (!studentName || !sessionId) return null;
    var portfolio = getPortfolioData();
    var studentData = portfolio && portfolio[studentName];
    var sessions = studentData && Array.isArray(studentData.sessions) ? studentData.sessions : [];
    for (var i = 0; i < sessions.length; i++) {
        var session = sessions[i];
        if (!session) continue;
        if (String(session.id || "") === String(sessionId) || String(session.createdAt || "") === String(sessionId) || String(i) === String(sessionId)) {
            return session;
        }
    }
    return null;
}

function renderNotebookDetailedAssessmentFromSavedSession(session) {
    session = session || {};
    if (session.detailedFeedback && session.detailedFeedback.categories) {
        return renderNotebookDetailedAssessment({
            detailed: {
                categories: session.detailedFeedback.categories || {},
                growGoal: session.detailedFeedback.growGoal && session.detailedFeedback.growGoal.growGoal || "",
                nextTime: session.detailedFeedback.growGoal && session.detailedFeedback.growGoal.nextTime || ""
            },
            categoryScores: session.categoryScores || {}
        });
    }
    var scores = session.categoryScores || {};
    var order = [
        ["Ideas & Details", "Ideas & Details"],
        ["Grammar", "Grammar"],
        ["Word Choice", "Vocabulary"],
        ["Organization", "Organization"],
        ["Flow", "Flow"],
        ["Spelling & Punctuation", "Spelling & Punctuation"],
        ["Neatness", "Neatness"]
    ];
    var html = "";
    var renderedCount = 0;
    for (var i = 0; i < order.length; i++) {
        var key = order[i][0];
        var label = order[i][1];
        if (scores[key] == null || scores[key] === "") continue;
        var score = Number(scores[key]);
        var hasScore = !isNaN(score);
        var scoreLabel = hasScore ? (escapeHtml(String(scores[key])) + " / " + RUBRIC_MAX) : escapeHtml(String(scores[key]));
        var width = hasScore ? Math.max(0, Math.min(100, Math.round((score / RUBRIC_MAX) * 100))) : 0;
        html += '<div class="category ' + getNotebookScoreClass(score, RUBRIC_MAX) + '">';
        html += '<div class="category-header"><span class="category-name">' + escapeHtml(label) + '</span><span class="score-badge">' + scoreLabel + '</span></div>';
        html += '<div class="score-bar-track"><div class="score-bar-fill" style="width:' + width + '%"></div></div>';
        html += '<div class="evidence-block"><strong>Teacher Comment:</strong> This saved portfolio entry was created before printable detailed feedback was stored.</div>';
        html += '<div class="evidence-block"><strong>What I noticed:</strong> Review the saved teacher notes for this category.</div>';
        html += '<div class="tip-block"><strong>Tip:</strong> Use the saved teacher notes and corrected writing from this entry.</div>';
        html += '</div>';
        renderedCount += 1;
    }
    if (!html) {
        html = '<div class="category"><div class="category-header"><span class="category-name">Detailed Assessment</span><span class="score-badge">--</span></div><div class="evidence-block"><strong>Teacher Comment:</strong> No saved assessment data.</div><div class="tip-block"><strong>Tip:</strong> Review the saved corrected writing and teacher notes.</div></div>';
        renderedCount = 1;
    }
    if (renderedCount % 2 === 1) html += '<div></div>';
    return html;
}

function buildNotebookPrintHtmlFromPortfolioSession(studentName, session) {
    session = session || {};
    var title = session.title || "Untitled Writing";
    var dateText = session.date || (session.createdAt ? new Date(session.createdAt).toLocaleDateString("en-GB") : "");
    var originalText = String(session.originalText || "");
    var correctedHtml = getPortfolioCorrectedHtml(session) || escapeHtml(session.correctedPlainText || originalText || "-");
    var feedback = session.feedbackSummary || {};
    var genreInfo = getWritingGenreInfoFromSession(session);
    var strength = sanitizeGenreReferenceInFeedback(feedback.strength || "Saved portfolio entry.", genreInfo);
    var growGoal = sanitizeGenreReferenceInFeedback(feedback.growGoal || feedback.nextTime || "Review the corrected writing and improve one focus area.", genreInfo);
    var teacherComment = sanitizeGenreReferenceInFeedback(feedback.closing || feedback.nextTime || "Review the saved feedback from this portfolio entry.", genreInfo);
    var notebookSettings = getNotebookAssessmentSettings({
        assessmentSettings: session.assessmentSettings || {},
        classGradeLevel: session.classGradeLevel || session.gradeLevel,
        classGradeLabel: session.classGradeLabel || session.gradeLabel,
        grammarStrictness: session.grammarStrictness,
        targetWords: session.targetWords != null ? session.targetWords : 0,
        actualWords: session.actualWords != null ? session.actualWords : countWords(originalText)
    });
    var scoreText = session.overall == null ? "Not scored" : (session.overall + "%");
    var scoreClass = getNotebookScoreClass(session.overall, 100);
    var writingTypeLabel = getNotebookWritingTypeLabel(genreInfo);
    var wordsTargetLabel = notebookSettings.wordTargetLabel;

    return ''
        + '<div class="page page-1 auto-fit-page">'
        + '<div class="page-header"><div><div class="page-label">Writing Notebook Summary</div><div class="page-title">' + escapeHtml(title) + '</div></div><div class="overall-score"><div class="overall-label">Overall</div><div class="overall-value ' + scoreClass + '">' + escapeHtml(scoreText) + '</div></div></div>'
        + '<div class="meta-row"><span><strong>Student:</strong> <span>' + escapeHtml(studentName || "No student selected") + '</span></span><span><strong>Date:</strong> <span>' + escapeHtml(dateText) + '</span></span><span><strong>Writing Type:</strong> <span class="writing-type-chip">' + escapeHtml(writingTypeLabel) + '</span></span><span><strong>Words:</strong> <span>' + escapeHtml(wordsTargetLabel) + '</span></span></div>'
        + '<div class="top-boxes"><div class="info-box strength-box"><div class="box-label">My Strength</div><p>' + escapeHtml(strength) + '</p></div><div class="info-box grow-goal-box"><div class="box-label">My Grow Goal</div><p>' + escapeHtml(growGoal) + '</p></div></div>'
        + '<div class="teacher-comment"><div class="box-label">Teacher Comment</div><p>' + escapeHtml(teacherComment) + '</p></div>'
        + '<div class="section-title">Detailed Writing Assessment</div><div class="assessment-grid">' + renderNotebookDetailedAssessmentFromSavedSession(session) + '</div>'
        + '</div>'
        + '<div class="page"><div class="page2-header"><div><div class="page2-meta">Writing Notebook Summary - Page 2</div><div class="page2-title">' + escapeHtml(title) + '</div></div><div class="page2-date">' + escapeHtml(dateText) + '</div></div>'
        + '<div class="corrected-writing"><div class="section-title">Corrected Writing</div><div class="revision-focus"><div class="revision-focus-title">Revision Focus</div><ul>' + renderNotebookRevisionFocusList(session) + '</ul></div><div class="notebook-corrected-text">' + wrapCorrectedHtmlForNotebookPrint(correctedHtml) + '</div></div></div>';
}


function getPortfolioSessionReassessText(session) {
    if (!session) return "";
    var text = String(session.originalText || "").trim();
    if (text) return text;
    text = String(session.correctedPlainText || "").trim();
    if (text) return text;
    return stripCorrectionMarkdown(session.correctedMarkup || "").trim();
}

function setActiveStudentForPortfolioReassessment(studentName) {
    if (!studentName) return;
    selectedStudent = studentName;
    try { localStorage.setItem("wft_selectedStudent", selectedStudent); } catch (e) { }
    var select = document.getElementById("studentSelect");
    if (select) {
        var exists = false;
        for (var i = 0; i < select.options.length; i++) {
            if (select.options[i].value === studentName) {
                exists = true;
                break;
            }
        }
        if (!exists && students && students.indexOf(studentName) === -1) {
            var option = document.createElement("option");
            option.value = studentName;
            option.textContent = studentName;
            select.appendChild(option);
        }
        select.value = studentName;
    }
}

function setGradeLevelForPortfolioReassessment(session) {
    var grade = session && session.gradeLevel ? parseGradeLevelValue(session.gradeLevel) : null;
    var gradeSelect = document.getElementById("gradeLevelSelect");
    if (!grade || !gradeSelect) return;
    gradeSelect.value = String(grade);
    wftStudentGradeLevelOverride = grade !== getClassGradeLevel();
    try { onGradeLevelChanged("student"); } catch (e) { }
}

function setNeatnessForPortfolioReassessment(enabled) {
    var el = document.getElementById("assessScriptQuality");
    if (el) el.checked = !!enabled;
    try { saveSettingsToLocalStorage(); } catch (e) { }
    try { refreshScoreWeightingDescription(); } catch (e2) { }
}

function dataUrlFromBlobForReassessment(blob) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function() { resolve(reader.result); };
        reader.onerror = function() { reject(new Error("Could not read restored portfolio image.")); };
        reader.readAsDataURL(blob);
    });
}

function getPortfolioImageDataUrlForReassessment(image) {
    image = image || {};
    if (image.dataUrl || image.originalDataUrl) {
        return Promise.resolve(image.dataUrl || image.originalDataUrl);
    }
    if (image.driveFileId && driveAccessToken && typeof downloadDriveFileAsBlobPromise === "function") {
        return downloadDriveFileAsBlobPromise(image.driveFileId).then(function(blob) {
            return dataUrlFromBlobForReassessment(blob);
        });
    }
    return Promise.resolve("");
}

function restorePortfolioSessionImagesForReassessment(session) {
    var images = session && Array.isArray(session.images) ? session.images : [];
    selectedImages = [];
    if (!images.length) {
        syncSelectedImageState();
        updateSelectedImagePreview();
        return Promise.resolve({ restored: 0, total: 0, driveSkipped: 0 });
    }

    var restored = [];
    var driveSkipped = 0;
    var chain = Promise.resolve();
    for (var i = 0; i < images.length; i++) {
        (function(image, index) {
            chain = chain.then(function() {
                if (image && image.driveFileId && !driveAccessToken && !image.dataUrl && !image.originalDataUrl) {
                    driveSkipped += 1;
                }
                return getPortfolioImageDataUrlForReassessment(image).then(function(dataUrl) {
                    if (!dataUrl) return;
                    restored.push({
                        dataUrl: dataUrl,
                        originalDataUrl: image.originalDataUrl || "",
                        name: image.name || ("portfolio-image-" + (index + 1) + ".jpg"),
                        mimeType: image.mimeType || "image/jpeg",
                        extractedText: "",
                        extractionPromise: null,
                        driveFileId: image.driveFileId || ""
                    });
                }).catch(function(e) {
                    wftDebugWarn("Could not restore portfolio image for reassessment:", e);
                });
            });
        }(images[i], i));
    }

    return chain.then(function() {
        selectedImages = restored;
        syncSelectedImageState();
        updateSelectedImagePreview();
        return { restored: restored.length, total: images.length, driveSkipped: driveSkipped };
    });
}

function reassessPortfolioSession(studentName, sessionId) {
    var session = findPortfolioSession(studentName, sessionId);
    if (!session) {
        alert("Could not find that saved portfolio entry.");
        return;
    }

    var reassessText = getPortfolioSessionReassessText(session);
    if (!reassessText) {
        alert("This saved portfolio entry does not include writing that can be reassessed.");
        return;
    }

    var message = "Reassess this saved writing?\n\n"
        + "This will load the original writing back into the analysis tool. You will press Analyze Writing manually when you are ready.\n\n"
        + "The saved portfolio entry will not be changed unless you sync the new results to the portfolio.";
    if (getPendingPortfolioSync && getPendingPortfolioSync()) {
        message += "\n\nNote: there is already an unsynced portfolio result. Reassessing will replace the current pending result.";
    }
    if (!window.confirm(message)) return;

    activePortfolioReassessmentSource = {
        sourceStudentName: studentName,
        sourceSessionId: session.id || session.createdAt || sessionId,
        sourceOriginalId: session.id || "",
        sourceCreatedAt: session.createdAt || "",
        sourceOriginalText: session.originalText || reassessText || "",
        sourceTargetWords: session.targetWords != null ? session.targetWords : (session.assessmentSettings && session.assessmentSettings.targetWordCount != null ? session.assessmentSettings.targetWordCount : 0),
        sourceAssessmentSettings: cloneWftJson(session.assessmentSettings || {}),
        startedAt: new Date().toISOString()
    };

    switchTab("tool");
    setActiveStudentForPortfolioReassessment(studentName);
    setGradeLevelForPortfolioReassessment(session);

    var writingEl = document.getElementById("studentWriting");
    if (writingEl) writingEl.value = reassessText;
    var reassessGenre = getWritingGenreInfoFromSession(session);
    currentWritingGenreInfo = reassessGenre;
    manualGenreOverrideValue = "__auto__";
    var reassessGenreSelect = document.getElementById("writingGenreSelect");
    if (reassessGenreSelect) reassessGenreSelect.value = "__auto__";
    correctedHtmlForDiff = "";
    latestAnalysisData = null;
    clearPendingPortfolioSync();

    setOcrStatus("Restoring saved writing for reassessment...", "");
    syncUiState();

    restorePortfolioSessionImagesForReassessment(session).then(function(result) {
        var shouldUseNeatness = !!(result && result.restored > 0 && (session.neatnessAssessed || session.assessScriptQuality || session.sourceType === "typed+photo"));
        setNeatnessForPortfolioReassessment(shouldUseNeatness);
        if (result && result.total > 0 && result.restored === 0) {
            setOcrStatus("Saved writing loaded. The original photo could not be restored, so reassessment will run without photo-based neatness.", "error");
            alert("The saved writing was loaded, but the original photo could not be restored. The reassessment will run without photo-based neatness.");
        } else if (result && result.restored > 0 && result.restored < result.total) {
            setOcrStatus("Saved writing loaded. Some photos were restored, but not all saved photos were available.", "error");
        } else if (result && result.restored > 0) {
            setOcrStatus("Saved writing and photo restored. Press Analyze Writing when you are ready.", "success");
        } else {
            setOcrStatus("Saved writing loaded. Press Analyze Writing when you are ready.", "");
        }
        syncUiState();
    }).catch(function(e) {
        wftDebugError("Could not restore saved portfolio entry for reassessment:", e);
        setNeatnessForPortfolioReassessment(false);
        setOcrStatus("Saved writing loaded, but photos could not be restored. Press Analyze Writing when you are ready.", "error");
        syncUiState();
    });
}

function refreshNotebookPage2CorrectedWriting(printContentHtml, studentName, session) {
    var html = String(printContentHtml || "");
    var correctedHtml = getPortfolioCorrectedHtml(session) || escapeHtml((session && session.correctedPlainText) || (session && session.originalText) || "-");
    var revisionFocusHtml = '<div class="revision-focus"><div class="revision-focus-title">Revision Focus</div><ul>' + renderNotebookRevisionFocusList(session || {}) + '</ul></div>';
    var replacement = '<div class="corrected-writing"><div class="section-title">Corrected Writing</div>' + revisionFocusHtml + '<div class="notebook-corrected-text">' + wrapCorrectedHtmlForNotebookPrint(correctedHtml) + '</div></div>';
    var pattern = /<div class="corrected-writing"><div class="section-title">Corrected Writing<\/div>(?:<div class="corrected-note">[\s\S]*?<\/div>|<div class="revision-focus">[\s\S]*?<\/ul><\/div>)?<div class="notebook-corrected-text">[\s\S]*?<\/div><\/div>/;
    if (pattern.test(html)) return html.replace(pattern, replacement);
    return buildNotebookPrintHtmlFromPortfolioSession(studentName, session);
}

function printPortfolioNotebookSummary(studentName, sessionId) {
    var session = findPortfolioSession(studentName, sessionId);
    if (!session) {
        alert("Could not find that saved portfolio entry.");
        return;
    }
    var printContentHtml = session.notebookPrintHtml || buildNotebookPrintHtmlFromPortfolioSession(studentName, session);
    printContentHtml = refreshNotebookPage2CorrectedWriting(printContentHtml, studentName, session);
    var printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
        alert("Please allow pop-ups for this page to re-print the notebook summary.");
        return;
    }
    var printHtml = buildNotebookPrintDocument(printContentHtml, studentName, session.title || "Notebook Summary");
    writeWftPrintWindow(printWindow, printHtml);
    scheduleWftPrintWindow(printWindow);
}

function buildQuickRubricText(quickRubric) {
    var lines = [];
    for (var i = 0; i < CATEGORY_KEYS.length; i++) {
        var key = CATEGORY_KEYS[i];
        var item = quickRubric[key];
        if (item && item.score != null) lines.push(key + ": " + item.score + "/" + RUBRIC_MAX + " - " + (item.reason || ""));
        else lines.push(key + ": Not scored - " + (item && item.reason ? item.reason : getEvidenceNote(key)));
    }
    return lines.join("\n");
}

function autoResizeStudentWriting() {
    var ta = document.getElementById("studentWriting");
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(ta.scrollHeight, isMobileLayout() ? 280 : 380) + "px";
}

function syncUiState() {
    var ta = document.getElementById("studentWriting");
    var btn = document.getElementById("analyzeBtn");
    var stopBtn = document.getElementById("stopAnalysisBtn");
    if (!ta || !btn) return;
    var hasText = ta.value.trim().length > 0;
    btn.disabled = isAnalyzing || !hasText;
    if (stopBtn) stopBtn.disabled = !isAnalyzing;
    updateMeter();
    autoResizeStudentWriting();
    updateOcrControls();
    updateScriptQualityToggleVisibility();
    updateGenreReviewBox();
    // Also update analyze button pulse animation
    updateAnalyzeBtnState();
}


function showTeacherReview() {
    var details = document.getElementById("teacherReviewDetails");
    if (!details) return;
    details.open = true;
    setTimeout(function() {
        if (!window.matchMedia('(max-width: 900px)').matches) { details.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }, 60);
}

function setLoadingButtonState(button, isLoading, busyLabel) {
    if (!button) return;
    if (!button.getAttribute('data-default-label')) {
        button.setAttribute('data-default-label', button.textContent);
    }
    if (isLoading) {
        button.classList.add('is-loading');
        button.textContent = busyLabel || button.getAttribute('data-default-label') || button.textContent;
        button.setAttribute('aria-busy', 'true');
    } else {
        button.classList.remove('is-loading');
        button.textContent = button.getAttribute('data-default-label') || button.textContent;
        button.removeAttribute('aria-busy');
    }
}


async function analyzeWriting() {
    var text = document.getElementById("studentWriting").value.trim();
    var assessmentSettings = getCurrentAssessmentSettingsSnapshot();
    var targetWords = assessmentSettings.targetWordCount || 0;
    var model = document.getElementById("modelSelect").value;
    // FIX O2: Resolve grade profile right at the start, before any early exits.
    var gradeProfile = getGradeProfile(assessmentSettings.gradeLevel);
    if (!text && selectedImages && selectedImages.length) {
        try {
            text = String(await extractTextFromSelectedImage(true) || "").trim();
        } catch (e) {
            wftDebugError("Automatic text extraction before analysis failed:", e);
        }
    }
    if (!text) {
        alert("Please paste student writing first.");
        return;
    }

    var btn = document.getElementById("analyzeBtn");
    var stopBtn = document.getElementById("stopAnalysisBtn");
    isAnalyzing = true;
    cancelAnalysis = false;
    analysisAbortController = new AbortController();
    btn.disabled = true;
    btn.classList.remove('pulse-ready');  // Stop pulse during analysis
    setLoadingButtonState(btn, true, "Analyzing...");
    setLoadingButtonState(stopBtn, false);
    stopBtn.textContent = 'Stop Analysis';
    stopBtn.disabled = false;

    try {
        var actualWords = countWords(text);
        var writingGenreInfo = getWritingGenreInfoFromUi(text);
        if (isAutoGenreSelected()) {
            try {
                writingGenreInfo = await classifyWritingGenreWithAi(text, model, { updateUi: true, reason: "analysis" });
            } catch (eGenreAnalysis) {
                wftDebugWarn("AI writing type classification failed during analysis; using local fallback.", eGenreAnalysis);
                writingGenreInfo = getAutoWritingGenreInfo(text);
            }
        }
        currentWritingGenreInfo = writingGenreInfo;
        updateGenreReviewBox();
        var sampleStatus = getSampleStatusData(text, gradeProfile);

        if (sampleStatus.status !== "scorable") {
            var lowSample = buildLowSampleAnalysis(text, sampleStatus);
            latestAnalysisData = {
                overall: null,
                gradeLevel: gradeProfile.grade,
                gradeLabel: gradeProfile.gradeLabel || gradeProfile.label,
                gradeTier: gradeProfile.tier,
                gradeProfileVersion: GRADE_PROFILE_VERSION,
                classGradeLevel: assessmentSettings.classGradeLevel,
                classGradeLabel: assessmentSettings.classGradeLabel,
                grammarStrictness: assessmentSettings.grammarStrictness,
                assessmentSettings: assessmentSettings,
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
        parsed1.quickRubric = parseStep2QuickRubric(step2, text, targetWords);
        var eligibility = getCategoryEligibility(sampleStatus);
        applyEligibilityToQuickRubric(parsed1.quickRubric, eligibility);

        // If neatness is enabled and we have an image, do image-based neatness assessment.
        // Store it separately until after Step 3 parsing so the parser cannot overwrite the sub-scores.
        var pendingNeatnessDetail = null;
        if (shouldAssessNeatness() && selectedImageDataUrl) {
            var neatnessResult = await assessNeatnessFromImage(selectedImageDataUrl, model);
            if (neatnessResult) {
                parsed1.quickRubric["Neatness"] = neatnessResult.quickRubric;
                var nqr = neatnessResult.quickRubric || {};
                pendingNeatnessDetail = {
                    score: nqr.score,
                    evidence: nqr.reason || "",
                    growthTip: nqr.growthTip || "",
                    subScores: nqr.subScores || null,
                    contentOrganization: "",
                    sentenceVariety: "",
                    rawBody: ""
                };
            }
        }

        var quickRubricText = buildQuickRubricText(parsed1.quickRubric);
        var step3Prompt = buildStep3Prompt(correctedText, quickRubricText, flowData, targetWords, actualWords, gradeProfile, writingGenreInfo);
        var step3 = await callOpenRouter(model, step3Prompt);
        var detailed = parseDetailedAssessment(step3);
        detailed.writingGenre = writingGenreInfo;
        if (detailed.keepWriting) detailed.keepWriting = sanitizeGenreReferenceInFeedback(detailed.keepWriting, writingGenreInfo);
        if (pendingNeatnessDetail) {
            detailed.categories["Neatness"] = pendingNeatnessDetail;
        }

        var adjustment = applyWordCountToIdeas(parsed1, detailed, actualWords, targetWords);
        applyComputedFlowToFlow(parsed1, detailed, flowData);
        applyOrganizationFallback(parsed1, detailed, eligibility);

        var correctedWordCount = countWords((parsed1.correctedStory || "").replace(/\*\*/g, ""));
        if (!correctedWordCount) correctedWordCount = countWords(text);
        var totalErrors = parsed1.errorCounts.grammar + parsed1.errorCounts.punctuation + parsed1.errorCounts.spelling;
        var errorDensity = correctedWordCount ? (totalErrors / correctedWordCount) * 100 : 0;
        var grammarScore = grammarDensityBand(errorDensity, gradeProfile);

        parsed1.quickRubric["Grammar"] = parsed1.quickRubric["Grammar"] || { score: grammarScore, reason: softFallback("Grammar", grammarScore, text, actualWords, targetWords) };
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

        applyEligibilityToDetailed(detailed, eligibility);
        polishFeedback(parsed1.quickRubric, detailed, text, parsed1.correctedStory, flowData);

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
                        subScores: qr.subScores || null
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

        // Spelling & Punctuation fallback (core category - always needs an entry).
        // If the detailed parser misses a flexible heading, inherit the quick rubric score
        // before showing this category as missing.
        var spellQuick = parsed1.quickRubric["Spelling & Punctuation"] || { score: null, reason: getEvidenceNote("Spelling & Punctuation") };
        if (!detailed.categories["Spelling & Punctuation"]) {
            detailed.categories["Spelling & Punctuation"] = {
                score: eligibility["Spelling & Punctuation"] ? spellQuick.score : null,
                evidence: "Spelling and punctuation were reviewed in this piece.",
                growthTip: spellQuick.reason || "Check your spelling and punctuation carefully before finishing your work.",
                contentOrganization: "",
                sentenceVariety: "",
                rawBody: ""
            };
        } else if (eligibility["Spelling & Punctuation"] && detailed.categories["Spelling & Punctuation"].score == null && spellQuick.score != null) {
            detailed.categories["Spelling & Punctuation"].score = spellQuick.score;
            if (!detailed.categories["Spelling & Punctuation"].growthTip) {
                detailed.categories["Spelling & Punctuation"].growthTip = spellQuick.reason || "Check your spelling and punctuation carefully before finishing your work.";
            }
            if (!detailed.categories["Spelling & Punctuation"].evidence) {
                detailed.categories["Spelling & Punctuation"].evidence = "Spelling and punctuation were reviewed in this piece.";
            }
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

        latestAnalysisData = {
            overall: overall,
            gradeLevel: gradeProfile.grade,
            gradeLabel: gradeProfile.gradeLabel || gradeProfile.label,
            gradeTier: gradeProfile.tier,
            gradeProfileVersion: GRADE_PROFILE_VERSION,
            classGradeLevel: assessmentSettings.classGradeLevel,
            classGradeLabel: assessmentSettings.classGradeLabel,
            grammarStrictness: assessmentSettings.grammarStrictness,
            assessmentSettings: assessmentSettings,
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
        if (e.message === "Analysis cancelled by user.") {
            document.getElementById("debugRaw").textContent = "Analysis stopped by user.";
            renderTeacherAuditView(null);
        } else {
            document.getElementById("debugRaw").textContent = "Error:\n" + e.message;
            alert("Analysis failed. See Debug for details.");
            showTeacherReview();
        }
    } finally {
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

function requestStopAnalysis() {
    if (!isAnalyzing) return;
    cancelAnalysis = true;
    if (typeof clearActivePortfolioReassessmentState === "function") {
        clearActivePortfolioReassessmentState("analysis-cancelled");
    }
    var debugEl = document.getElementById("debugRaw");
    if (debugEl) debugEl.textContent = "Stopping analysis...";
    var stopBtn = document.getElementById("stopAnalysisBtn");
    if (stopBtn) {
        setLoadingButtonState(stopBtn, true, "Stopping...");
        stopBtn.disabled = true;
    }
    if (analysisAbortController) {
        analysisAbortController.abort();
    }
}

function clearWritingArea() {
    if (typeof clearActivePortfolioReassessmentState === "function") {
        clearActivePortfolioReassessmentState("writing-area-cleared");
    }
    var ta = document.getElementById("studentWriting");
    if (ta) {
        ta.value = '';
        ta.focus();
    }
    manualGenreOverrideValue = "__auto__";
    var genreSelectClear = document.getElementById("writingGenreSelect");
    if (genreSelectClear) genreSelectClear.value = "__auto__";
    syncUiState();
    checkExpandBtnVisibility();
}

var studentWriting = document.getElementById("studentWriting");
var targetWordCountInput = document.getElementById("targetWordCount");
var useWordCountTargetInput = document.getElementById("useWordCountTarget");
var modelSelect = document.getElementById("modelSelect");
modelSelect.value = DEFAULT_MODEL; // default, overwritten below by saved settings
loadSettingsFromLocalStorage();
refreshApiKeyRuntimeValue();    // restore all saved settings including strictness
// Initialize grade level feature (sets up select, applies defaults)
try { initializeGradeLevelFeature(); } catch (e) { wftDebugWarn('Grade init:', e); }
loadStudents();
renderStudentList();
populateStudentDropdown();
refreshScoreWeightingDescription();
refreshAssessmentSettingsSummary();

studentWriting.addEventListener("input", syncUiState);
studentWriting.addEventListener("input", updateGenreReviewBox);
studentWriting.addEventListener("input", checkExpandBtnVisibility);
studentWriting.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !document.getElementById("analyzeBtn").disabled) {
        document.getElementById("analyzeBtn").click();
    }
});
targetWordCountInput.addEventListener("input", function() {
    updateMeter();
    saveSettingsToLocalStorage();
    refreshAssessmentSettingsSummary();
});
if (useWordCountTargetInput) {
    useWordCountTargetInput.addEventListener("change", function() {
        targetWordCountInput.disabled = !useWordCountTargetInput.checked;
        updateMeter();
        saveSettingsToLocalStorage();
        refreshAssessmentSettingsSummary();
    });
    targetWordCountInput.disabled = !useWordCountTargetInput.checked;
}
modelSelect.addEventListener("change", function() { updateMeter(); saveSettingsToLocalStorage(); });
var assessScriptQualityInput = document.getElementById("assessScriptQuality");
if (assessScriptQualityInput) {
    assessScriptQualityInput.addEventListener("change", function() {
        saveSettingsToLocalStorage();
        refreshScoreWeightingDescription();
        refreshAssessmentSettingsSummary();
    });
}
var apiKeyInput = document.getElementById("apiKeyInput");
var toggleApiKeyBtn = document.getElementById("toggleApiKeyBtn");
if (apiKeyInput) {
    apiKeyInput.addEventListener("input", function() {
        persistApiKeyStorageFromInput();
        refreshApiKeyRuntimeValue();
    });
}
var rememberApiKeyOnDeviceInput = document.getElementById("rememberApiKeyOnDevice");
if (rememberApiKeyOnDeviceInput) {
    rememberApiKeyOnDeviceInput.addEventListener("change", function() {
        persistApiKeyStorageFromInput();
        refreshApiKeyRuntimeValue();
    });
}
var writingGenreSelect = document.getElementById("writingGenreSelect");
if (writingGenreSelect) {
    populateWritingGenreSelect();
    writingGenreSelect.addEventListener("change", function() {
        manualGenreOverrideValue = writingGenreSelect.value || "__auto__";
        updateGenreReviewBox();
    });
}

if (toggleApiKeyBtn && apiKeyInput) {
    toggleApiKeyBtn.addEventListener("click", function() {
        var show = apiKeyInput.type === "password";
        apiKeyInput.type = show ? "text" : "password";
        toggleApiKeyBtn.textContent = show ? "Hide API Key" : "Show API Key";
    });
}
function openImagePicker() {
    var existingInput = document.getElementById("imageUploadInput");
    if (!existingInput) return;
    existingInput.click();
}

document.getElementById("takePhotoBtn").addEventListener("click", function() {
    document.getElementById("cameraInput").click();
});
document.getElementById("uploadImageBtn").addEventListener("click", function() {
    openImagePicker();
});
document.getElementById("cameraInput").addEventListener("change", async function(e) {
    await handleSelectedImages(Array.prototype.slice.call(e.target.files || []));
    refreshScoreWeightingDescription();
    e.target.value = "";
});
document.getElementById("imageUploadInput").addEventListener("change", async function(e) {
    await handleSelectedImages(Array.prototype.slice.call(e.target.files || []));
    refreshScoreWeightingDescription();
    e.target.value = "";
});
document.getElementById("extractTextBtn").addEventListener("click", function() {
    extractTextFromSelectedImage(false).catch(function(e) {
        wftDebugError("Text extraction failed:", e);
        setOcrStatus(e && e.message ? e.message : "Text extraction failed.", "error");
    });
});
document.getElementById("analyzeBtn").addEventListener("click", analyzeWriting);
document.getElementById("stopAnalysisBtn").addEventListener("click", requestStopAnalysis);
var printNotebookBtnTopEl = document.getElementById("printNotebookBtnTop");
if (printNotebookBtnTopEl) printNotebookBtnTopEl.addEventListener("click", printNotebookSummary);
var printNotebookBtnBottomEl = document.getElementById("printNotebookBtnBottom");
if (printNotebookBtnBottomEl) printNotebookBtnBottomEl.addEventListener("click", printNotebookSummary);
var syncPortfolioBtnTopEl = document.getElementById("syncPortfolioBtnTop");
if (syncPortfolioBtnTopEl) syncPortfolioBtnTopEl.addEventListener("click", manualSaveToDrive);
var syncPortfolioBtnBottomEl = document.getElementById("syncPortfolioBtnBottom");
if (syncPortfolioBtnBottomEl) syncPortfolioBtnBottomEl.addEventListener("click", manualSaveToDrive);
bindDesktopImageDrop();


window.addEventListener("resize", function() {
    syncMobileOcrPanelState();
    syncOcrPanelTitle();
    autoResizeStudentWriting();
});

window.addEventListener("load", function() {
    var ta = document.getElementById("studentWriting");
    // Clear any previously stored text so the box is empty on fresh load
    ta.value = '';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    syncMobileOcrPanelState();
    syncOcrPanelTitle();
    pendingPortfolioSync = loadPendingPortfolioSyncFromStorage();
    syncUiState();
    updateSyncPortfolioButtonState();
    restoreActiveTab();

    // ── WFT Sync V2: init lifecycle handlers ──
    if (WFT_SYNC_ENGINE_V2) {
        initWftSyncLifecycleHandlers();
    }

    // Check if tokens were delivered in the URL fragment after Google sign-in
    var fromOAuth = checkHashForOAuthTokens();

    var restoredFromStorage = restoreGoogleStateFromStorage();
    if (!restoredFromStorage) {
        restoreGoogleSessionOnce();
    }

    // If we just came back from OAuth, trigger a sync
    var pendingAction = localStorage.getItem("wft_oauth_pending_action");
    if (pendingAction === "sync" || fromOAuth) {
        localStorage.removeItem("wft_oauth_pending_action");
        // Small delay to let the token restore finish
        setTimeout(function() {
            if (driveAccessToken) {
                manualSaveToDrive();
            }
        }, 1500);
    }
});

restoreWftOAuthDraftAfterRedirect();
syncUiState();

// When the browser restores this page from the back/forward cache (bfcache)
// after an OAuth redirect, window.load does NOT fire again.  We must listen
// for pageshow to re-read localStorage tokens that were written by the
// Google sign-in redirect while this page was frozen in the bfcache.
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        // Page was served from bfcache - re-read auth state from sessionStorage
        // so tokens written by the OAuth callback are picked up.
        var restored = restoreGoogleStateFromStorage();
        if (!restored) {
            restoreGoogleSessionOnce();
        }
    }
});

window.addEventListener('pagehide', function() {
    // ── WFT Sync V2: only fast local save on hide; Drive upload is unsafe here ──
    if (WFT_SYNC_ENGINE_V2) {
        try { saveWftLocalSnapshotsBeforeHide(); } catch (e) {}
        return;
    }
    try {
        savePortfolioData(getPortfolioData());
        if (driveAccessToken) {
            syncAllToDrive();
        }
    } catch (e) {}
});

document.addEventListener('visibilitychange', function() {
    // ── WFT Sync V2: only fast local save on hide; Drive upload is unsafe here ──
    if (WFT_SYNC_ENGINE_V2) {
        if (document.visibilityState === 'hidden') {
            try { saveWftLocalSnapshotsBeforeHide(); } catch (e) {}
        }
        return;
    }
    if (document.visibilityState === 'hidden') {
        try {
            savePortfolioData(getPortfolioData());
            if (driveAccessToken) {
                syncAllToDrive();
            }
        } catch (e) {}
    }
});


/* =============================================
   Function overrides — applied after main JS block
============================================= */

/* --- updateMeter ---
   Wraps original to also update the status bar.
*/
var _originalUpdateMeter = updateMeter;
updateMeter = function() {
    _originalUpdateMeter();
    // Now sync the new status bar
    var ta   = document.getElementById("studentWriting");
    var text = ta ? ta.value : "";
    var words = countWords(text);
    var targetEnabled = isWordCountTargetEnabled();
    var target = getTargetWordCountValue();
    var ratio = targetEnabled && target > 0 ? words / target : 0;
    var percent = Math.max(0, Math.min(150, ratio * 100));
    var fillWidth = Math.min(percent, 100) + "%";
    var fillBackground = targetEnabled && words >= target
        ? "#3fb950"
        : "linear-gradient(90deg, #d29922, #3fb950)";

    var badgeText = "Start typing...";
    if (!targetEnabled) {
        badgeText = words === 0 ? "Start typing..." : "Target off";
    } else if (words === 0) {
        badgeText = "Start typing...";
    } else if (words < target * 0.75) {
        badgeText = "Need more detail";
    } else if (words < target * 0.95) {
        badgeText = "Getting close";
    } else if (words <= target * 1.05) {
        badgeText = "Near target";
    } else {
        badgeText = "Above target";
    }
    if (words === target) badgeText = "On target";

    updateStatusBar(words, target, targetEnabled, fillWidth, fillBackground, badgeText);
    updateAnalyzeBtnState();
};

/* --- Intercept correctedStory mutations: store original + corrected HTML, show diff controls, trigger slide-in. ---
*/
(function() {
    var correctedEl = document.getElementById("correctedStory");
    var observer = new MutationObserver(function(mutations) {
        // After each time correctedStory innerHTML changes:
        if (_diffSwitching) return; // ignore changes triggered by showDiffView
        var currentHtml = correctedEl.innerHTML;
        if (currentHtml && currentHtml !== 'No corrected story yet.' && currentHtml.indexOf('No corrected story yet.') === -1) {
            correctedHtmlForDiff = currentHtml;
            // Show diff controls
            var dc = document.getElementById('diffControls');
            if (dc) dc.style.display = '';
            // Reset to corrected view
            var btnC = document.getElementById('diffBtnCorrected');
            var btnO = document.getElementById('diffBtnOriginal');
            if (btnC) btnC.classList.add('active');
            if (btnO) btnO.classList.remove('active');
            // Trigger slide-in on results panel
            triggerResultsSlideIn();
        }
    });
    observer.observe(correctedEl, { childList: true, subtree: false });
})();

/* --- Capture original textarea text when Analyze is clicked, for diff view. ---
*/
(function() {
    var taEl = document.getElementById("studentWriting");
    var analyzeBtnEl = document.getElementById("analyzeBtn");
    if (analyzeBtnEl) {
        analyzeBtnEl.addEventListener("click", function() {
            originalTextForDiff = taEl ? taEl.value : '';
        }, true); // capture phase so fires first
    }
})();

/* --- Wire up the mobile FAB to trigger the camera input. ---
*/
(function() {
    var fab = document.getElementById('cameraFab');
    if (fab) {
        fab.addEventListener('click', function() {
            document.getElementById('imageUploadInput').click();
        });
    }
})();

// Initialize UI state
updateAnalyzeBtnState();
updateSyncPortfolioButtonState();

/* Also update the status bar once on load */
updateMeter();

// ── CROP FEATURES ──

// ── Crop logic ──────────────────────────────────
var _cropSourceDataUrl = "";
var _cropImageIndex = 0;
var _cropDragStart = null;
var _cropRect = null;
var _cropLastFocusedEl = null;

function openCropModal(imgIndex) {
    if (!selectedImages[imgIndex]) return;
    _cropImageIndex = imgIndex;
    _cropSourceDataUrl = selectedImages[imgIndex].originalDataUrl || selectedImages[imgIndex].dataUrl;
    _cropRect = null;
    _cropDragStart = null;

    var modal = document.getElementById("cropModal");
    var canvas = document.getElementById("cropCanvas");
    var overlay = document.getElementById("cropOverlay");
    var wrap = document.getElementById("cropCanvasWrap");
    if (!modal || !canvas || !overlay || !wrap) return;

    _cropLastFocusedEl = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("tabindex", "-1");
    modal.focus();
    var titleEl = document.getElementById("cropModalTitle");
    if (titleEl) titleEl.textContent = (selectedImages.length > 1)
        ? "Crop Image " + (imgIndex + 1) + " of " + selectedImages.length + " — drag to select the writing area"
        : "Crop Image — drag to select the writing area";

    var img = new Image();
    img.onload = function() {
        var maxW = wrap.clientWidth || 600;
        var scale = Math.min(1, maxW / img.naturalWidth);
        var w = Math.round(img.naturalWidth * scale);
        var h = Math.round(img.naturalHeight * scale);
        canvas.width = w;
        canvas.height = h;
        overlay.width = w;
        overlay.height = h;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        overlay.style.width = w + "px";
        overlay.style.height = h + "px";
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        drawCropOverlay();
    };
    img.src = _cropSourceDataUrl;
}

function drawCropOverlay() {
    var overlay = document.getElementById("cropOverlay");
    if (!overlay) return;
    var ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!_cropRect || Math.abs(_cropRect.w) < 2 || Math.abs(_cropRect.h) < 2) return;

    var x = Math.min(_cropRect.x, _cropRect.x + _cropRect.w);
    var y = Math.min(_cropRect.y, _cropRect.y + _cropRect.h);
    var w = Math.abs(_cropRect.w);
    var h = Math.abs(_cropRect.h);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(x, y, w, h);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    var hs = 8;
    ctx.fillStyle = "#2563eb";
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(function(pt) {
        ctx.fillRect(pt[0] - hs / 2, pt[1] - hs / 2, hs, hs);
    });
}

function getCropPos(e, el) {
    var rect = el.getBoundingClientRect();
    var touch = null;
    if (e.touches && e.touches.length) {
        touch = e.touches[0];
    } else if (e.changedTouches && e.changedTouches.length) {
        touch = e.changedTouches[0];
    }
    var clientX = touch ? touch.clientX : e.clientX;
    var clientY = touch ? touch.clientY : e.clientY;
    var scaleX = rect.width ? el.width / rect.width : 1;
    var scaleY = rect.height ? el.height / rect.height : 1;
    var x = Math.round((clientX - rect.left) * scaleX);
    var y = Math.round((clientY - rect.top) * scaleY);
    return {
        x: Math.max(0, Math.min(x, el.width)),
        y: Math.max(0, Math.min(y, el.height))
    };
}

function applyCrop() {
    var canvas = document.getElementById("cropCanvas");
    if (!canvas || !_cropRect || Math.abs(_cropRect.w) < 5 || Math.abs(_cropRect.h) < 5) {
        setOcrStatus("Please draw a crop region on the image first.", "error");
        return;
    }
    var x = Math.max(0, Math.min(_cropRect.x, _cropRect.x + _cropRect.w));
    var y = Math.max(0, Math.min(_cropRect.y, _cropRect.y + _cropRect.h));
    var w = Math.min(Math.abs(_cropRect.w), canvas.width - x);
    var h = Math.min(Math.abs(_cropRect.h), canvas.height - y);
    if (w < 5 || h < 5) {
        setOcrStatus("Crop region too small. Please draw a larger area.", "error");
        return;
    }
    var sourceImg = new Image();
    sourceImg.onload = function() {
        var scaleX = sourceImg.naturalWidth / canvas.width;
        var scaleY = sourceImg.naturalHeight / canvas.height;
        var out = document.createElement("canvas");
        out.width = Math.round(w * scaleX);
        out.height = Math.round(h * scaleY);
        out.getContext("2d").drawImage(
            sourceImg,
            Math.round(x * scaleX), Math.round(y * scaleY),
            out.width, out.height,
            0, 0, out.width, out.height
        );
        var croppedUrl = out.toDataURL("image/jpeg", 0.92);
        if (!selectedImages[_cropImageIndex].originalDataUrl) {
            selectedImages[_cropImageIndex].originalDataUrl = selectedImages[_cropImageIndex].dataUrl;
        }
        selectedImages[_cropImageIndex].dataUrl = croppedUrl;
        selectedImages[_cropImageIndex].extractedText = "";
        selectedImages[_cropImageIndex].extractionPromise = null;
        selectedImageExtractedText = "";
        selectedImageExtractionPromise = null;
        closeCropModal();
        updateSelectedImagePreview();
        setOcrStatus("Image cropped. Click \"Extract Text for Analysis\" to re-run OCR.", "success");
    };
    sourceImg.src = _cropSourceDataUrl;
}

function closeCropModal() {
    var modal = document.getElementById("cropModal");
    if (modal) modal.classList.remove("open");
    _cropRect = null;
    _cropDragStart = null;
    if (_cropLastFocusedEl && typeof _cropLastFocusedEl.focus === "function") {
        _cropLastFocusedEl.focus();
    }
    _cropLastFocusedEl = null;
}

function resetCrop() {
    if (selectedImages[_cropImageIndex] && selectedImages[_cropImageIndex].originalDataUrl) {
        selectedImages[_cropImageIndex].dataUrl = selectedImages[_cropImageIndex].originalDataUrl;
        selectedImages[_cropImageIndex].originalDataUrl = null;
        selectedImages[_cropImageIndex].extractedText = "";
        _cropSourceDataUrl = selectedImages[_cropImageIndex].dataUrl;
    }
    _cropRect = null;
    _cropDragStart = null;
    var canvas = document.getElementById("cropCanvas");
    var overlay = document.getElementById("cropOverlay");
    if (canvas && overlay) {
        var img = new Image();
        img.onload = function() {
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            drawCropOverlay();
        };
        img.src = _cropSourceDataUrl;
    }
}

// Wire crop modal — deferred so DOM is ready
document.addEventListener("DOMContentLoaded", function() {
    var overlay2 = document.getElementById("cropOverlay");
    if (!overlay2) return;

    function onDown(e) {
        e.preventDefault();
        var pos = getCropPos(e, overlay2);
        _cropDragStart = pos;
        _cropRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
    }
    function onMove(e) {
        if (!_cropDragStart) return;
        e.preventDefault();
        var pos = getCropPos(e, overlay2);
        _cropRect = { x: _cropDragStart.x, y: _cropDragStart.y, w: pos.x - _cropDragStart.x, h: pos.y - _cropDragStart.y };
        drawCropOverlay();
    }
    function onUp(e) {
        if (!_cropDragStart) return;
        _cropDragStart = null;
    }

    overlay2.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    overlay2.addEventListener("touchstart", onDown, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp, { passive: false });

    var cropApplyBtn = document.getElementById("cropApplyBtn");
    var cropResetBtn = document.getElementById("cropResetBtn");
    var cropCancelBtn = document.getElementById("cropCancelBtn");
    var cropModalEl = document.getElementById("cropModal");
    if (cropApplyBtn) cropApplyBtn.addEventListener("click", applyCrop);
    if (cropResetBtn) cropResetBtn.addEventListener("click", resetCrop);
    if (cropCancelBtn) cropCancelBtn.addEventListener("click", closeCropModal);
    if (cropModalEl) cropModalEl.addEventListener("click", function(e) {
        if (e.target === this) closeCropModal();
    });
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") closeCropModal();
    });
});
// ── END Re-extract & Crop ──────────────────

