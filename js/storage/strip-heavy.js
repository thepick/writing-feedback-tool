// =============================================================================
// WFT UPGRADE — Patch 2: Proactive Heavy-Field Stripping
// =============================================================================
// Prevents base64 images and oversized text from entering localStorage.

var WFT_STRIP_CORRECTED_HTML_MAX = 10000;
var WFT_STRIP_MARKUP_MAX = 20000;
var WFT_STRIP_ORIGINAL_TEXT_MAX = 20000;

// ── Image metadata localStorage safety ──

function makeImageMetadataLocalStorageSafe(image, index) {
    if (!image) { return image; }
    var safe = {};
    var keys = Object.keys(image);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = image[k];

        // Never store base64 image data
        if (k === "dataUrl" || k === "originalDataUrl") {
            safe[k] = "";
            safe.dataUrlRemovedForStorage = true;
        }
        // Never store extracted OCR text (can be very large)
        else if (k === "extractedText") {
            safe[k] = "";
            safe.extractedTextRemovedForStorage = true;
        }
        // Pass through everything else
        else {
            safe[k] = v;
        }
    }
    return safe;
}

// ── Session localStorage safety ──

function makeSessionLocalStorageSafe(session) {
    if (!session) { return session; }
    var safe = {};
    var keys = Object.keys(session);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = session[k];

        if (k === "images" && Array.isArray(v)) {
            safe[k] = [];
            for (var j = 0; j < v.length; j++) {
                safe[k].push(makeImageMetadataLocalStorageSafe(v[j], j));
            }
        } else if (k === "correctedHtml" && typeof v === "string" && v.length > WFT_STRIP_CORRECTED_HTML_MAX) {
            safe[k] = v.substring(0, WFT_STRIP_CORRECTED_HTML_MAX);
            safe.correctedHtmlRemovedForStorage = true;
        } else if (k === "correctedMarkup" && typeof v === "string" && v.length > WFT_STRIP_MARKUP_MAX) {
            safe[k] = v.substring(0, WFT_STRIP_MARKUP_MAX);
            safe.correctedMarkupTruncatedForStorage = true;
        } else if (k === "originalText" && typeof v === "string" && v.length > WFT_STRIP_ORIGINAL_TEXT_MAX) {
            safe[k] = v.substring(0, WFT_STRIP_ORIGINAL_TEXT_MAX);
            safe.originalTextTruncatedForStorage = true;
        } else {
            safe[k] = v;
        }
    }
    return safe;
}

// ── Full portfolio localStorage safety ──

function makePortfolioLocalStorageSafe(data) {
    if (!data) { return data; }
    if (typeof isWftStorageSafeMode === "function" && isWftStorageSafeMode()) {
        return data;
    }
    var safe = {};
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = data[k];

        if (k === "_meta") {
            safe[k] = v;
        } else if (v && typeof v === "object" && v.sessions) {
            safe[k] = { sessions: [] };
            for (var j = 0; j < v.sessions.length; j++) {
                safe[k].sessions.push(makeSessionLocalStorageSafe(v.sessions[j]));
            }
        } else {
            safe[k] = v;
        }
    }
    return safe;
}
