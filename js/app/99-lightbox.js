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
