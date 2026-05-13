/* === LAYOUT POLISH OVERRIDES === */
function injectWftLayoutPolishStyles() {
    if (document.getElementById('wftLayoutPolishStyles')) return;
    var style = document.createElement('style');
    style.id = 'wftLayoutPolishStyles';
    style.textContent = ''
        + '.assessment-settings-actions .mini-settings-btn {'
        + 'display:inline-flex;'
        + 'align-items:center;'
        + 'justify-content:center;'
        + 'min-height:44px;'
        + 'padding:12px 20px;'
        + 'font-size:15px;'
        + 'text-align:center;'
        + '}'
        + '#assessmentOverrideClearBtn {'
        + 'justify-content:center;'
        + 'text-align:center;'
        + '}'
        + '.class-defaults-field label,.class-defaults-field .checkbox-label {'
        + 'color:var(--text-primary);'
        + 'font-size:13px;'
        + 'font-weight:600;'
        + 'letter-spacing:normal;'
        + 'text-transform:none;'
        + '}'
        + '.class-defaults-field #classGradeProfileDescription {'
        + 'margin:14px 0 0;'
        + '}';
    document.head.appendChild(style);
}
injectWftLayoutPolishStyles();
/* === END LAYOUT POLISH OVERRIDES === */

/* === IMAGE LIGHTBOX === */
function openImageLightbox(imgEl) {
    var lb = document.getElementById('imgLightbox');
    var lbImg = document.getElementById('imgLightboxImg');
    var lbCap = document.getElementById('imgLightboxCaption');
    if (!lb || !lbImg || !imgEl || !imgEl.getAttribute('src')) return;

    lbImg.src = imgEl.src;
    lbImg.alt = imgEl.alt || 'Writing sample preview';
    if (lbCap) {
        lbCap.textContent = imgEl.getAttribute('data-caption') || imgEl.alt || '';
    }

    lb.classList.add('open');
    document.body.style.overflow = 'hidden';

    lb.onclick = function(e) {
        if (e.target === lb) closeImageLightbox();
    };
}
function closeImageLightbox() {
    var lb = document.getElementById('imgLightbox');
    if (!lb) return;
    lb.classList.remove('open');
    document.body.style.overflow = '';
    var lbImg = document.getElementById('imgLightboxImg');
    if (lbImg) lbImg.src = '';
}
// Close with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeImageLightbox();
});
/* === END IMAGE LIGHTBOX === */
