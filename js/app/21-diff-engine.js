/* =============================================================================
   Diff / correction engine - tokenize, LCS diff, markdown helpers, corrected render.
   Extracted from 10-main-app.js (decompose-20261016). Classic script; global
   names unchanged, loaded before 10-main-app.js.
   ============================================================================= */

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

var SAFE_INSERT_WORD_SET = {
    "a": true, "an": true, "the": true,
    "is": true, "are": true, "am": true, "was": true, "were": true,
    "do": true, "does": true, "did": true,
    "to": true
};

function buildLcsMatrix(a, b) {
    var normalizedA = a.map(normalizeDiffToken);
    var normalizedB = b.map(normalizeDiffToken);
    var rows = a.length + 1;
    var cols = b.length + 1;
    // shortcut: the full LCS matrix still uses quadratic space, revisit if longer essays remain slow.
    var dp = [];
    for (var i = 0; i < rows; i++) {
        dp[i] = [];
        for (var j = 0; j < cols; j++) dp[i][j] = 0;
    }
    for (var ai = a.length - 1; ai >= 0; ai--) {
        for (var bi = b.length - 1; bi >= 0; bi--) {
            if (normalizedA[ai] === normalizedB[bi]) dp[ai][bi] = dp[ai + 1][bi + 1] + 1;
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
