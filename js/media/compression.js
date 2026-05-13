// =============================================================================
// WFT UPGRADE — Patch 3: Image Compression Before Drive Upload
// =============================================================================
// Shrinks images before uploading to Google Drive using canvas-based resize.

var WFT_IMAGE_FULL_MAX_WIDTH = 1600;
var WFT_IMAGE_FULL_JPEG_QUALITY = 0.78;
var WFT_THUMB_MAX_WIDTH = 300;
var WFT_THUMB_JPEG_QUALITY = 0.72;

// ── Load image element from data URL ──

function loadImageElementFromDataUrl(dataUrl, callback) {
    var img = new Image();
    img.onload = function() {
        callback(null, img);
    };
    img.onerror = function() {
        callback(new Error("Failed to load image from data URL"), null);
    };
    // Handle non-standard data URLs
    if (dataUrl && dataUrl.indexOf("data:") === 0) {
        img.src = dataUrl;
    } else {
        callback(new Error("Invalid data URL"), null);
    }
}

// ── Resize data URL image to Blob ──

function resizeImageDataUrlToBlob(dataUrl, options, callback) {
    options = options || {};
    var maxWidth = options.maxWidth || WFT_IMAGE_FULL_MAX_WIDTH;
    var quality = options.quality || WFT_IMAGE_FULL_JPEG_QUALITY;
    var outputType = options.outputType || "image/jpeg";

    loadImageElementFromDataUrl(dataUrl, function(err, img) {
        if (err) {
            // Fallback: try direct dataUrlToBlob
            try {
                var fallbackBlob = dataUrlToBlob(dataUrl);
                callback(null, fallbackBlob);
            } catch (e2) {
                callback(err, null);
            }
            return;
        }

        try {
            var origW = img.naturalWidth || img.width;
            var origH = img.naturalHeight || img.height;

            // Don't upscale
            var targetW = origW;
            var targetH = origH;
            if (origW > maxWidth) {
                var ratio = maxWidth / origW;
                targetW = maxWidth;
                targetH = Math.round(origH * ratio);
            }

            var canvas = document.createElement("canvas");
            canvas.width = targetW;
            canvas.height = targetH;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, targetW, targetH);

            canvas.toBlob(function(blob) {
                if (blob) {
                    callback(null, blob);
                } else {
                    // toBlob fallback for older browsers
                    var dataUrlOut = canvas.toDataURL(outputType, quality);
                    try {
                        var fallbackBlob = dataUrlToBlob(dataUrlOut);
                        callback(null, fallbackBlob);
                    } catch (e3) {
                        callback(new Error("canvas.toBlob failed"), null);
                    }
                }
            }, outputType, quality);
        } catch (e) {
            // Canvas failure — return original as fallback
            try {
                var fallbackBlob = dataUrlToBlob(dataUrl);
                callback(null, fallbackBlob);
            } catch (e2) {
                callback(e, null);
            }
        }
    });
}

// ── Compress portfolio image for Drive ──

function compressPortfolioImageForDrive(image, callback) {
    if (!image || !image.dataUrl) {
        callback(new Error("No image data URL to compress"), null);
        return;
    }

    resizeImageDataUrlToBlob(image.dataUrl, {
        maxWidth: WFT_IMAGE_FULL_MAX_WIDTH,
        quality: WFT_IMAGE_FULL_JPEG_QUALITY,
        outputType: "image/jpeg"
    }, callback);
}

// ── Create thumbnail Blob ──

function createPortfolioThumbnailBlob(image, callback) {
    if (!image || !image.dataUrl) {
        callback(new Error("No image data URL for thumbnail"), null);
        return;
    }

    resizeImageDataUrlToBlob(image.dataUrl, {
        maxWidth: WFT_THUMB_MAX_WIDTH,
        quality: WFT_THUMB_JPEG_QUALITY,
        outputType: "image/jpeg"
    }, callback);
}
