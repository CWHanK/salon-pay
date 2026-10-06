/**
 * SalonFlow - App 內提示對話框 (js/dialog.js)
 * 取代瀏覽器原生 alert / confirm / prompt，手機上外觀一致且不會被瀏覽器封鎖
 */

function escapeDialogText(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 建立對話框；回傳 Promise，於使用者按下按鈕後 resolve
function openAppDialog({ type = 'alert', title = '', message = '', okText = '確定', cancelText = '取消', danger = false, defaultValue = '', inputType = 'text', placeholder = '' }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4';
    overlay.style.zIndex = '90';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const icon = danger
      ? '<div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><i data-lucide="alert-triangle" class="w-5 h-5"></i></div>'
      : (type === 'alert'
        ? '<div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i data-lucide="info" class="w-5 h-5"></i></div>'
        : '<div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><i data-lucide="help-circle" class="w-5 h-5"></i></div>');
    const okClass = danger
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-amber-600 hover:bg-amber-700 text-white';

    overlay.innerHTML = `
      <div class="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
        <div class="flex items-start gap-3">
          ${icon}
          <div class="min-w-0 flex-1 pt-0.5">
            ${title ? `<h4 class="text-base font-black text-slate-900">${escapeDialogText(title)}</h4>` : ''}
            <p class="text-sm text-slate-600 mt-1 leading-relaxed" style="white-space: pre-line;">${escapeDialogText(message)}</p>
          </div>
        </div>
        ${type === 'prompt' ? `
          <input type="${inputType}" ${inputType === 'number' ? 'inputmode="decimal"' : ''} autocomplete="off" data-dialog-input
            value="${escapeDialogText(defaultValue)}" placeholder="${escapeDialogText(placeholder)}"
            class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
        ` : ''}
        <div class="flex gap-2">
          ${type !== 'alert' ? `<button type="button" data-dialog-cancel class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition">${escapeDialogText(cancelText)}</button>` : ''}
          <button type="button" data-dialog-ok class="flex-1 py-2.5 ${okClass} font-bold rounded-xl text-sm transition">${escapeDialogText(okText)}</button>
        </div>
      </div>
    `;

    const input = overlay.querySelector('[data-dialog-input]');
    const close = result => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    };
    const cancelResult = type === 'confirm' ? false : (type === 'prompt' ? null : undefined);
    const okResult = () => (type === 'confirm' ? true : (type === 'prompt' ? input.value : undefined));
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(cancelResult); }
      // 危險操作不接受 Enter 直接確認，避免誤觸
      if (e.key === 'Enter' && !danger) { e.preventDefault(); close(okResult()); }
    };

    overlay.querySelector('[data-dialog-ok]').addEventListener('click', () => close(okResult()));
    overlay.querySelector('[data-dialog-cancel]')?.addEventListener('click', () => close(cancelResult));
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => (input || overlay.querySelector('[data-dialog-ok]')).focus(), 30);
  });
}

function appAlert(message, options = {}) {
  return openAppDialog({ ...options, type: 'alert', message });
}

function appConfirm(message, options = {}) {
  return openAppDialog({ okText: '確定', ...options, type: 'confirm', message });
}

function appPrompt(message, defaultValue = '', options = {}) {
  return openAppDialog({ ...options, type: 'prompt', message, defaultValue });
}
