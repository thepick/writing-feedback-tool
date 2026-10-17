/* =============================================================================
   Writing titles - normalize, title-case and extract a writing title from
   story text and a suggested title. Extracted from 10-main-app.js
   (title-extract-20261017). Classic script; global names unchanged, loaded
   before 10-main-app.js.
   ============================================================================= */

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
            var shouldCapitalize = forceCapitalize || !Object.prototype.hasOwnProperty.call(lowercaseWords, lower) || (!isFirstSegment && isLastSegment);
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
