/* =============================================
   APP CONFIRMATION DIALOG
   - Replaces native browser confirm() for important actions.
   - Native dialogs can be suppressed by the browser after "Don't show again",
     which makes destructive actions fail silently.
============================================= */
function ensureWftConfirmStyles() {
    if (document.getElementById('wftConfirmDialogStyles')) return;
    var style = document.createElement('style');
    style.id = 'wftConfirmDialogStyles';
    style.textContent = ''
        + '.wft-confirm-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.46);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;}'
        + '.wft-confirm-dialog{width:min(460px,100%);background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);border:1px solid rgba(148,163,184,.35);overflow:hidden;font-family:inherit;}'
        + '.wft-confirm-header{padding:18px 20px 8px;font-weight:800;font-size:1.05rem;color:#0f172a;}'
        + '.wft-confirm-body{padding:0 20px 18px;color:#334155;font-size:.95rem;line-height:1.45;white-space:pre-wrap;}'
        + '.wft-confirm-actions{display:flex;gap:10px;justify-content:flex-end;padding:14px 20px 18px;background:#f8fafc;border-top:1px solid #e2e8f0;}'
        + '.wft-confirm-actions button{border:0;border-radius:999px;padding:10px 16px;font-weight:800;cursor:pointer;font-family:inherit;}'
        + '.wft-confirm-cancel{background:#e2e8f0;color:#0f172a;}'
        + '.wft-confirm-ok{background:#2563eb;color:#fff;}'
        + '.wft-confirm-ok.danger{background:#dc2626;color:#fff;}'
        + '.wft-confirm-actions button:focus{outline:3px solid rgba(37,99,235,.28);outline-offset:2px;}'
        + '.wft-modal-field{padding:0 20px 18px;}'
        + '.wft-modal-label{display:block;font-weight:800;color:#0f172a;margin-bottom:8px;font-size:.92rem;}'
        + '.wft-modal-input,.wft-modal-select{width:100%;box-sizing:border-box;border:2px solid #cbd5e1;border-radius:10px;padding:11px 12px;font:inherit;color:#0f172a;background:#fff;}'
        + '.wft-modal-input:focus,.wft-modal-select:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.14);}'
        + '.wft-modal-help{margin-top:8px;color:#64748b;font-size:.86rem;line-height:1.35;}';
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

        var backdrop = document.createElement('div');
        backdrop.className = 'wft-confirm-backdrop';
        backdrop.setAttribute('role', 'presentation');

        var dialog = document.createElement('div');
        dialog.className = 'wft-confirm-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'wftConfirmTitle');
        dialog.setAttribute('aria-describedby', 'wftConfirmBody');

        var title = document.createElement('div');
        title.className = 'wft-confirm-header';
        title.id = 'wftConfirmTitle';
        title.textContent = options.title || 'Please confirm';

        var body = document.createElement('div');
        body.className = 'wft-confirm-body';
        body.id = 'wftConfirmBody';
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
        actions.appendChild(okBtn);
        dialog.appendChild(title);
        dialog.appendChild(body);
        dialog.appendChild(actions);
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        var settled = false;
        function close(result) {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKeyDown);
            if (backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }
            resolve(!!result);
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

        setTimeout(function() {
            try { cancelBtn.focus(); } catch (e) { }
        }, 0);
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

        var backdrop = document.createElement('div');
        backdrop.className = 'wft-confirm-backdrop';
        backdrop.setAttribute('role', 'presentation');

        var dialog = document.createElement('div');
        dialog.className = 'wft-confirm-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'wftTextInputTitle');
        dialog.setAttribute('aria-describedby', 'wftTextInputBody');

        var title = document.createElement('div');
        title.className = 'wft-confirm-header';
        title.id = 'wftTextInputTitle';
        title.textContent = options.title || 'Enter a value';

        var body = document.createElement('div');
        body.className = 'wft-confirm-body';
        body.id = 'wftTextInputBody';
        body.textContent = message || '';

        var fieldWrap = document.createElement('div');
        fieldWrap.className = 'wft-modal-field';

        var label = document.createElement('label');
        label.className = 'wft-modal-label';
        label.setAttribute('for', 'wftTextInputField');
        label.textContent = options.label || 'Value';

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'wft-modal-input';
        input.id = 'wftTextInputField';
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

        setTimeout(function() {
            try { input.focus(); input.select(); } catch (e) { }
        }, 0);
    });
}

