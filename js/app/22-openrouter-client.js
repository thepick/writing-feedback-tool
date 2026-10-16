/* =============================================================================
   OpenRouter client - model fallback chain, retry/timeout, response parsing,
   text/image request wrappers. Extracted from 10-main-app.js (decompose-20261016).
   Classic script; global names unchanged, loaded before 10-main-app.js.
   ============================================================================= */

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

function parseOpenRouterResponse(res, rawText) {
    if (!res.ok) {
        var statusMessage = summarizeOpenRouterFailure(res.status, rawText);
        var err = new Error("OpenRouter error " + res.status + ": " + statusMessage + " Raw: " + rawText);
        err.status = res.status;
        err.rawText = rawText;
        throw err;
    }

    var data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        throw new Error("OpenRouter returned non-JSON: " + rawText);
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
    if (!data.choices[0].message.content.trim()) {
        throw new Error("OpenRouter returned empty content: " + rawText);
    }

    return data.choices[0].message.content;
}

async function requestOpenRouterWithFallback(primaryModel, payloadBuilder, options) {
    var requestContext = typeof activeAnalysisContext !== "undefined" ? activeAnalysisContext : null;
    if (cancelAnalysis) throw new Error("Analysis cancelled by user.");
    if (!analysisAbortController) analysisAbortController = new AbortController();

    options = options || {};
    var models = buildFallbackModelList(primaryModel, !!options.isImageRequest);
    var attempts = [];
    var lastError = null;
    var maxRetriesPerModel = options.maxRetriesPerModel == null ? 2 : options.maxRetriesPerModel;

    function parseCurrentOpenRouterResponse(res, rawText) {
        if (requestContext) assertCurrentAnalysisContext(requestContext);
        return parseOpenRouterResponse(res, rawText);
    }

    function prepareOpenRouterRetry(e, timeoutId) {
        clearTimeout(timeoutId);
        if (requestContext) assertCurrentAnalysisContext(requestContext);
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

        checkOpenRouterRetry();
    }

    function checkOpenRouterRetry() {
        var status = lastError && lastError.status ? Number(lastError.status) : 0;
        var summary = summarizeOpenRouterFailure(status, lastError && lastError.message ? lastError.message : "");
        attempts.push(model + " attempt " + (attempt + 1) + ": " + summary);

        var retryable = !status || isRetryableOpenRouterStatus(status) || /timed out|Failed to fetch|network|Upstream Response Error|Provider returned error|Decode transfer failed|KVTransferError/i.test(lastError && lastError.message ? lastError.message : "");
        var hasAnotherAttemptSameModel = attempt < maxRetriesPerModel;
        var hasAnotherModel = m < models.length - 1;

        if (!(retryable && (hasAnotherAttemptSameModel || hasAnotherModel))) {
            throw new Error("OpenRouter request failed after retries: " + (lastError && lastError.message ? lastError.message : String(lastError)));
        }
    }

    for (var m = 0, attempt = 0; m < models.length;) {
        var model = models[m];
        if (!(attempt <= maxRetriesPerModel)) {
            m++;
            attempt = 0;
            continue;
        }
        if (requestContext) assertCurrentAnalysisContext(requestContext);
        if (cancelAnalysis) throw new Error("Analysis cancelled by user.");
        if (refreshApiKeyRuntimeValue() === false) throw getWftApiKeyStorageError();
        if (!API_KEY) {
            throw new Error('No API key found. Open Settings and paste your OpenRouter API key.');
        }
        var requestController = analysisAbortController;
        var timeoutId = setTimeout(function() {
            requestController.abort();
        }, 90000);
        try {
            var payload = payloadBuilder(model);
            var res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + API_KEY,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.href,
                    "X-OpenRouter-Title": "Writing Feedback Tool"
                },
                body: JSON.stringify(payload),
                signal: requestController.signal
            });
            // Headers can arrive while the body stalls; keep the timeout through the body read.
            var rawText = await res.text();
            clearTimeout(timeoutId);
            return parseCurrentOpenRouterResponse(res, rawText);
        } catch (e) {
            prepareOpenRouterRetry(e, timeoutId);
            await sleepMs(Math.min(1200 * (attempt + 1), 3000));
        }
        attempt++;
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
