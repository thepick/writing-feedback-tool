/* =============================================
   APP CONFIRMATION DIALOG
   - Replaces native browser confirm() for important actions.
   - Native dialogs can be suppressed by the browser after "Don't show again",
     which makes destructive actions fail silently.
============================================= */
var wftDialogStack = [];
var wftDialogSequence = 0;

function wftDialogFocusTargets(dialog) {
    return Array.prototype.filter.call(dialog.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]'), function(element) {
        return !element.disabled && element.tabIndex >= 0 && !element.closest('[inert]') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
    });
}

function wftOpenDialog(dialog, initialFocus, onDismiss) {
    if (!dialog || wftDialogStack.some(function(entry) { return entry.dialog === dialog; })) return;
    var entry = { dialog: dialog, opener: document.activeElement, blocked: [], inert: dialog.inert, overflow: document.body.style.overflow, onDismiss: onDismiss };
    dialog.inert = false;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    for (var node = dialog; node && node !== document.body; node = node.parentElement) {
        Array.prototype.forEach.call(node.parentElement.children, function(sibling) {
            if (sibling === node) return;
            entry.blocked.push({ element: sibling, inert: sibling.inert });
            sibling.inert = true;
        });
    }
    wftDialogStack.push(entry);
    document.body.style.overflow = 'hidden';
    var target = initialFocus || wftDialogFocusTargets(dialog)[0] || dialog;
    target.focus({ preventScroll: true });
}

function wftCloseDialog(dialog) {
    var index = wftDialogStack.findIndex(function(entry) { return entry.dialog === dialog; });
    if (index === -1) return;
    var entry = wftDialogStack[index];
    while (index !== wftDialogStack.length - 1) {
        var child = wftDialogStack[wftDialogStack.length - 1];
        if (child.onDismiss) child.onDismiss();
        if (wftDialogStack[wftDialogStack.length - 1] === child) return false;
    }
    wftDialogStack.pop();
    entry.blocked.forEach(function(item) { item.element.inert = item.inert; });
    dialog.inert = entry.inert;
    document.body.style.overflow = entry.overflow;
    var parent = wftDialogStack[wftDialogStack.length - 1];
    var openerVisible = entry.opener && entry.opener.isConnected && !entry.opener.closest('[inert]') && entry.opener.getClientRects().length && getComputedStyle(entry.opener).visibility !== 'hidden';
    var target = openerVisible ? entry.opener : parent && (wftDialogFocusTargets(parent.dialog)[0] || parent.dialog);
    if (!target) target = document.querySelector('#mainApp .nav-tab.active');
    if (target) target.focus();
    return true;
}

document.addEventListener('keydown', function(event) {
    var entry = wftDialogStack[wftDialogStack.length - 1];
    if (!entry) return;
    if (event.isComposing || event.keyCode === 229) {
        if (event.key === 'Escape') event.stopImmediatePropagation();
        return;
    }
    if (event.key === 'Escape' && entry.onDismiss) {
        event.preventDefault();
        event.stopImmediatePropagation();
        entry.onDismiss();
    } else if (event.key === 'Tab') {
        var targets = wftDialogFocusTargets(entry.dialog);
        var first = targets[0] || entry.dialog, last = targets[targets.length - 1] || entry.dialog;
        if (!targets.length || !entry.dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
        }
    }
}, true);

document.addEventListener('focusin', function(event) {
    var entry = wftDialogStack[wftDialogStack.length - 1];
    if (entry && !entry.dialog.contains(event.target)) (wftDialogFocusTargets(entry.dialog)[0] || entry.dialog).focus();
});

function ensureWftConfirmStyles() {
    if (document.getElementById('wftConfirmDialogStyles')) return;
    var style = document.createElement('style');
    style.id = 'wftConfirmDialogStyles';
    style.textContent = ''
        + '.wft-confirm-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.46);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;}'
        + '.wft-confirm-dialog{width:min(460px,100%);max-height:calc(100dvh - 36px);background:var(--panel,#fff);border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:auto;font-family:inherit;}'
        + '.wft-confirm-header{padding:18px 20px 8px;font-weight:800;font-size:1.05rem;color:var(--text,#1e293b);}'
        + '.wft-confirm-body{padding:0 20px 18px;color:var(--text,#1e293b);font-size:.95rem;line-height:1.5;white-space:pre-wrap;}'
        + '.wft-confirm-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;padding:14px 20px 18px;background:var(--card,#f8fafc);border-top:1px solid var(--line,#e2e8f0);}'
        + '.wft-confirm-actions button{border:0;border-radius:999px;padding:10px 16px;font-weight:800;cursor:pointer;font-family:inherit;}'
        + '.wft-confirm-cancel,.wft-confirm-alternative{background:#e2e8f0;color:#0f172a;}'
        + '.wft-confirm-ok{background:var(--primary-color,#2563eb);color:#fff;}'
        + '.wft-confirm-ok.danger{background:var(--error-color,#b91c1c);color:#fff;}'
        + '.wft-confirm-actions button:focus-visible{outline:3px solid var(--primary-color,#2563eb);outline-offset:3px;}'
        + '.wft-modal-field{padding:0 20px 18px;}'
        + '.wft-modal-label{display:block;font-weight:800;color:#0f172a;margin-bottom:8px;font-size:.92rem;}'
        + '.wft-modal-input,.wft-modal-select{width:100%;box-sizing:border-box;border:2px solid #cbd5e1;border-radius:10px;padding:11px 12px;font:inherit;color:#0f172a;background:#fff;}'
        + '.wft-modal-input:focus,.wft-modal-select:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.14);}'
        + '.wft-modal-help{margin-top:8px;color:var(--muted,#526178);font-size:.875rem;line-height:1.5;}';
    document.head.appendChild(style);
}

function wftConfirm(message, options) {
    options = options || {};
    return new Promise(function(resolve) {
        if (!document.body) {
            resolve(false);
            return;
        }

        ensureWftConfirmStyles();
        var suffix = document.getElementById('wftConfirmTitle') ? '-' + (++wftDialogSequence) : '';

        var backdrop = document.createElement('div');
        backdrop.className = 'wft-confirm-backdrop';
        backdrop.setAttribute('role', 'presentation');

        var dialog = document.createElement('div');
        dialog.className = 'wft-confirm-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'wftConfirmTitle' + suffix);
        dialog.setAttribute('aria-describedby', 'wftConfirmBody' + suffix);

        var title = document.createElement('div');
        title.className = 'wft-confirm-header';
        title.id = 'wftConfirmTitle' + suffix;
        title.textContent = options.title || 'Please confirm';

        var body = document.createElement('div');
        body.className = 'wft-confirm-body';
        body.id = 'wftConfirmBody' + suffix;
        body.textContent = message || 'Are you sure?';

        var actions = document.createElement('div');
        actions.className = 'wft-confirm-actions';

        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wft-confirm-cancel';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        var okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'wft-confirm-ok' + (options.danger ? ' danger' : '');
        okBtn.textContent = options.confirmText || 'Continue';

        actions.appendChild(cancelBtn);
        if (options.alternativeText) {
            var alternativeBtn = document.createElement('button');
            alternativeBtn.type = 'button';
            alternativeBtn.className = 'wft-confirm-alternative';
            alternativeBtn.textContent = options.alternativeText;
            alternativeBtn.addEventListener('click', function() { close('alternative'); });
            actions.appendChild(alternativeBtn);
        }
        actions.appendChild(okBtn);
        dialog.appendChild(title);
        dialog.appendChild(body);
        dialog.appendChild(actions);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        var settled = false;
        function close(result) {
            if (settled) return;
            if (wftCloseDialog(dialog) === false) return;
            settled = true;
            document.removeEventListener('keydown', onKeyDown);
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
            resolve(result === 'alternative' ? 'alternative' : !!result);
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(false);
            }
        }

        cancelBtn.addEventListener('click', function() { close(false); });
        okBtn.addEventListener('click', function() { close(true); });
        backdrop.addEventListener('click', function(event) {
            if (event.target === backdrop) close(false);
        });
        document.addEventListener('keydown', onKeyDown);

        wftOpenDialog(dialog, cancelBtn, function() { close(false); });
    });
}


function wftTextInput(message, options) {
    options = options || {};
    return new Promise(function(resolve) {
        if (!document.body) {
            resolve(null);
            return;
        }

        ensureWftConfirmStyles();
        var suffix = document.getElementById('wftTextInputTitle') ? '-' + (++wftDialogSequence) : '';

        var backdrop = document.createElement('div');
        backdrop.className = 'wft-confirm-backdrop';
        backdrop.setAttribute('role', 'presentation');

        var dialog = document.createElement('div');
        dialog.className = 'wft-confirm-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'wftTextInputTitle' + suffix);
        if (message) dialog.setAttribute('aria-describedby', 'wftTextInputBody' + suffix);

        var title = document.createElement('div');
        title.className = 'wft-confirm-header';
        title.id = 'wftTextInputTitle' + suffix;
        title.textContent = options.title || 'Enter a value';

        var body = document.createElement('div');
        body.className = 'wft-confirm-body';
        body.id = 'wftTextInputBody' + suffix;
        body.textContent = message || '';

        var fieldWrap = document.createElement('div');
        fieldWrap.className = 'wft-modal-field';

        var label = document.createElement('label');
        label.className = 'wft-modal-label';
        label.setAttribute('for', 'wftTextInputField' + suffix);
        label.textContent = options.label || 'Value';

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'wft-modal-input';
        input.id = 'wftTextInputField' + suffix;
        input.value = options.defaultValue != null ? String(options.defaultValue) : '';
        input.placeholder = options.placeholder || '';
        input.setAttribute('autocomplete', 'off');

        fieldWrap.appendChild(label);
        fieldWrap.appendChild(input);

        if (options.helpText) {
            var help = document.createElement('div');
            help.className = 'wft-modal-help';
            help.textContent = options.helpText;
            fieldWrap.appendChild(help);
        }

        var actions = document.createElement('div');
        actions.className = 'wft-confirm-actions';

        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wft-confirm-cancel';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        var okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'wft-confirm-ok' + (options.danger ? ' danger' : '');
        okBtn.textContent = options.confirmText || 'Continue';

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        dialog.appendChild(title);
        if (message) dialog.appendChild(body);
        dialog.appendChild(fieldWrap);
        dialog.appendChild(actions);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        var settled = false;
        function close(result) {
            if (settled) return;
            if (wftCloseDialog(dialog) === false) return;
            settled = true;
            document.removeEventListener('keydown', onKeyDown);
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
            resolve(result);
        }

        function submit() {
            close(input.value);
        }

        function onKeyDown(event) {
            if (event.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                close(null);
            } else if (event.key === 'Enter' && event.target === input) {
                event.preventDefault();
                submit();
            }
        }

        cancelBtn.addEventListener('click', function() { close(null); });
        okBtn.addEventListener('click', submit);
        backdrop.addEventListener('click', function(event) {
            if (event.target === backdrop) close(null);
        });
        document.addEventListener('keydown', onKeyDown);

        wftOpenDialog(dialog, input, function() { close(null); });
        input.select();
    });
}

