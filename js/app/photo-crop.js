function isCurrentCropSession(session) {
    if (!session || session !== _cropSession) return false;
    if (session.studentName !== getActivePortfolioStudentName()) return false;
    if (session.reassessmentSource !== activePortfolioReassessmentSource) return false;
    if (session.photo.dataUrl !== session.dataUrl || session.photo.originalDataUrl !== session.originalDataUrl) return false;
    if (session.images.length !== selectedImages.length) return false;
    return session.images.every(function(photo, index) { return photo === selectedImages[index]; });
}

function openCropModal(imgIndex) {
    if (!selectedImages[imgIndex]) return;
    var photo = selectedImages[imgIndex];
    _cropRect = null;
    _cropDragStart = null;

    var modal = document.getElementById("cropModal");
    var canvas = document.getElementById("cropCanvas");
    var overlay = document.getElementById("cropOverlay");
    var wrap = document.getElementById("cropCanvasWrap");
    if (!modal || !canvas) return;
    if (!overlay || !wrap) return;

    _cropSession = {
        photo: photo, images: selectedImages.slice(), studentName: getActivePortfolioStudentName(),
        reassessmentSource: activePortfolioReassessmentSource,
        dataUrl: photo.dataUrl, originalDataUrl: photo.originalDataUrl,
        sourceDataUrl: photo.originalDataUrl || photo.dataUrl, request: 0, ready: false
    };
    _cropLastFocusedEl = document.activeElement;
    modal.classList.add("open");
    if (typeof wftOpenDialog === "function") {
        wftOpenDialog(modal, document.getElementById("cropLeft"), closeCropModal);
    } else {
        modal.setAttribute("tabindex", "-1");
        modal.focus();
    }
    var titleEl = document.getElementById("cropModalTitle");
    if (titleEl) titleEl.textContent = (selectedImages.length > 1)
        ? "Crop Image " + (imgIndex + 1) + " of " + selectedImages.length
        : "Crop Image";
    loadCropCanvas(_cropSession);
}

function loadCropCanvas(session) {
    var canvas = document.getElementById("cropCanvas");
    var overlay = document.getElementById("cropOverlay");
    var wrap = document.getElementById("cropCanvasWrap");
    var previousWidth = canvas.width, previousHeight = canvas.height;
    var selection = _cropRect && previousWidth && previousHeight ? {
        x: _cropRect.x / previousWidth, y: _cropRect.y / previousHeight,
        w: _cropRect.w / previousWidth, h: _cropRect.h / previousHeight
    } : null;
    var request = ++session.request;
    session.ready = false;
    _cropDragStart = null;
    var applyButton = document.getElementById("cropApplyBtn");
    if (applyButton) applyButton.disabled = true;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    drawCropOverlay();
    var img = new Image();
    img.onload = function() {
        if (!isCurrentCropSession(session) || request !== session.request) return;
        var maxW = wrap.clientWidth || 600;
        var card = document.getElementById("cropModalCard");
        var cardStyle = getComputedStyle(card);
        var siblingsHeight = Array.from(card.children).reduce(function(height, child) {
            if (child === wrap) return height;
            var style = getComputedStyle(child);
            return height + child.getBoundingClientRect().height + parseFloat(style.marginTop || 0) + parseFloat(style.marginBottom || 0);
        }, 0);
        var chromeHeight = siblingsHeight + parseFloat(cardStyle.paddingTop) + parseFloat(cardStyle.paddingBottom)
            + (parseFloat(cardStyle.rowGap) || 0) * (card.children.length - 1);
        var maxH = Math.max(1, Math.min(parseFloat(getComputedStyle(wrap).maxHeight) || innerHeight * .56, innerHeight - chromeHeight - 48));
        var scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
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
        if (selection) _cropRect = { x: selection.x * w, y: selection.y * h, w: selection.w * w, h: selection.h * h };
        session.ready = true;
        if (applyButton) applyButton.disabled = false;
        drawCropOverlay();
    };
    img.onerror = function() {
        if (!isCurrentCropSession(session) || request !== session.request) return;
        var status = document.getElementById("cropSelectionStatus");
        if (status) status.textContent = "Image could not load. Cancel and try again.";
    };
    img.src = session.sourceDataUrl;
}

function drawCropOverlay() {
    var overlay = document.getElementById("cropOverlay");
    if (!overlay) return;
    var ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    updateCropBounds();
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

function updateCropBounds() {
    var canvas = document.getElementById("cropCanvas");
    if (!canvas || !canvas.width || !canvas.height) return;
    var rect = _cropRect || { x: 0, y: 0, w: canvas.width, h: canvas.height };
    var values = [Math.min(rect.x, rect.x + rect.w) / canvas.width * 100,
        Math.min(rect.y, rect.y + rect.h) / canvas.height * 100,
        Math.max(rect.x, rect.x + rect.w) / canvas.width * 100,
        Math.max(rect.y, rect.y + rect.h) / canvas.height * 100].map(function(value) { return Math.round(value * 100) / 100; });
    ["cropLeft", "cropTop", "cropRight", "cropBottom"].forEach(function(id, index) {
        var input = document.getElementById(id);
        if (input) input.value = values[index];
    });
    var status = document.getElementById("cropSelectionStatus");
    if (status) status.textContent = _cropRect
        ? "Selected bounds: left " + values[0] + "%, top " + values[1] + "%, right " + values[2] + "%, bottom " + values[3] + "%."
        : "Select the writing with the image or percentage controls.";
}

function changeCropBound(index, input) {
    if (!isCurrentCropSession(_cropSession) || !_cropSession.ready || !Number.isFinite(input.valueAsNumber)) return;
    var canvas = document.getElementById("cropCanvas");
    var rect = _cropRect || { x: 0, y: 0, w: canvas.width, h: canvas.height };
    var values = [Math.min(rect.x, rect.x + rect.w) / canvas.width * 100,
        Math.min(rect.y, rect.y + rect.h) / canvas.height * 100,
        Math.max(rect.x, rect.x + rect.w) / canvas.width * 100,
        Math.max(rect.y, rect.y + rect.h) / canvas.height * 100];
    values[index] = index < 2 ? Math.max(0, Math.min(input.valueAsNumber, values[index + 2] - 1))
        : Math.min(100, Math.max(input.valueAsNumber, values[index - 2] + 1));
    _cropDragStart = null;
    _cropRect = { x: values[0] / 100 * canvas.width, y: values[1] / 100 * canvas.height,
        w: (values[2] - values[0]) / 100 * canvas.width, h: (values[3] - values[1]) / 100 * canvas.height };
    drawCropOverlay();
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

function setWftPhotoBytes(photo, dataUrl) {
    if (photo.dataUrl === dataUrl) return;
    photo.imageId = photo.imageId || photo.driveFileId || '';
    ensureWftImageId(photo, 'photo', selectedImages.indexOf(photo));
    photo.imageRevision = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    photo.dataUrl = dataUrl;
    photo.driveFileId = '';
    delete photo.driveName;
    delete photo.driveUploadedAt;
    delete photo.dataUrlRemovedForStorage;
    photo.pendingDriveUpload = true;
}

function applyCrop() {
    var session = _cropSession;
    if (!isCurrentCropSession(session)) return;
    if (!session.ready) return;
    var canvas = document.getElementById("cropCanvas");
    var cropUnavailable = !canvas || !_cropRect;
    if (cropUnavailable || Math.abs(_cropRect.w) < 5 || Math.abs(_cropRect.h) < 5) {
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
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;
    var request = ++session.request;
    var sourceImg = new Image();
    sourceImg.onload = function() {
        if (!isCurrentCropSession(session) || request !== session.request) return;
        var scaleX = sourceImg.naturalWidth / canvasWidth;
        var scaleY = sourceImg.naturalHeight / canvasHeight;
        var out = document.createElement("canvas");
        out.width = Math.round(w * scaleX);
        out.height = Math.round(h * scaleY);
        out.getContext("2d").fillStyle = "#fff";
        out.getContext("2d").fillRect(0, 0, out.width, out.height);
        out.getContext("2d").drawImage(
            sourceImg,
            Math.round(x * scaleX), Math.round(y * scaleY),
            out.width, out.height,
            0, 0, out.width, out.height
        );
        var croppedUrl = out.toDataURL("image/jpeg", 0.92);
        if (!session.photo.originalDataUrl) {
            session.photo.originalDataUrl = session.photo.dataUrl;
        }
        setWftPhotoBytes(session.photo, croppedUrl);
        session.dataUrl = session.photo.dataUrl;
        session.originalDataUrl = session.photo.originalDataUrl;
        session.photo.extractedText = "";
        session.photo.extractionPromise = null;
        selectedImageExtractedText = "";
        selectedImageExtractionPromise = null;
        syncSelectedImageState();
        updateSelectedImagePreview();
        closeCropModal();
        setOcrStatus("Image cropped. Click \"Extract Text for Analysis\" to re-run OCR.", "success");
    };
    sourceImg.src = session.sourceDataUrl;
}

function closeCropModal() {
    var modal = document.getElementById("cropModal");
    var imageIndex = _cropSession ? selectedImages.indexOf(_cropSession.photo) : -1;
    var returnTarget = _cropLastFocusedEl;
    if (returnTarget && !returnTarget.isConnected && imageIndex >= 0) returnTarget = document.querySelector('.ocr-preview-crop[data-index="' + imageIndex + '"]');
    if (modal) {
        if (typeof wftCloseDialog === "function" && wftCloseDialog(modal) === false) return;
        modal.classList.remove("open");
    }
    _cropSession = null;
    _cropRect = null;
    _cropDragStart = null;
    if (returnTarget && returnTarget.isConnected && typeof returnTarget.focus === 'function') returnTarget.focus();
    _cropLastFocusedEl = null;
}

function resetCrop() {
    var session = _cropSession;
    if (!isCurrentCropSession(session)) return;
    if (session.photo.originalDataUrl) {
        setWftPhotoBytes(session.photo, session.photo.originalDataUrl);
        session.photo.originalDataUrl = null;
        session.photo.extractedText = "";
        session.photo.extractionPromise = null;
        session.dataUrl = session.photo.dataUrl;
        session.originalDataUrl = session.photo.originalDataUrl;
        session.sourceDataUrl = session.photo.dataUrl;
        syncSelectedImageState();
        updateSelectedImagePreview();
    }
    _cropRect = null;
    _cropDragStart = null;
    loadCropCanvas(session);
}

// Wire crop modal — deferred so DOM is ready
document.addEventListener("DOMContentLoaded", function() {
    var overlay2 = document.getElementById("cropOverlay");
    if (!overlay2) return;

    function onDown(e) {
        if (!isCurrentCropSession(_cropSession) || !_cropSession.ready) return;
        if (e.type === "mousedown" && e.button !== 0) return;
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
    document.addEventListener("touchcancel", onUp, { passive: false });
    overlay2.addEventListener("lostpointercapture", onUp);
    window.addEventListener("blur", onUp);
    document.addEventListener("visibilitychange", function() { if (document.hidden) onUp(); });
    window.addEventListener("resize", function() {
        if (isCurrentCropSession(_cropSession)) loadCropCanvas(_cropSession);
    });
    ["cropLeft", "cropTop", "cropRight", "cropBottom"].forEach(function(id, index) {
        var input = document.getElementById(id);
        if (!input) return;
        input.addEventListener("input", function() { changeCropBound(index, input); });
        input.addEventListener("change", updateCropBounds);
    });

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
        if (e.key === "Escape" && typeof wftOpenDialog !== "function") closeCropModal();
    });
});
// ── END Re-extract & Crop ──────────────────
