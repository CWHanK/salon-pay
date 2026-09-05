/**
 * SalonFlow - 主入口與分頁導覽控制器 (js/main.js)
 */

// 取得當前年份與月份字串 (例如: 2026-09)
function getCurrentYearMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

// 日期與介面初始化
function initCurrentDate() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const dateInput = document.getElementById('billing-date');
  if (dateInput) dateInput.value = dateStr;

  const currentYM = getCurrentYearMonth();
  const historyMonth = document.getElementById('history-filter-month');
  if (historyMonth) historyMonth.value = currentYM;

  const monthlyMonth = document.getElementById('monthly-select-month');
  if (monthlyMonth) monthlyMonth.value = currentYM;
}

// 分頁切換 (同步手機 Dock 與桌面 Tab)
function switchTab(tabName) {
  if (tabName === 'monthly' && currentUserRole === 'staff') {
    tabName = 'history';
  }
  const tabs = ['billing', 'history', 'monthly', 'settings'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const desktopBtn = document.getElementById(`tab-btn-${t}`);
    const dockBtn = document.getElementById(`dock-btn-${t}`);

    if (t === tabName) {
      el?.classList.remove('hidden');
      desktopBtn?.classList.add('active');
      desktopBtn?.classList.remove('text-slate-600');
      dockBtn?.classList.add('active');
    } else {
      el?.classList.add('hidden');
      desktopBtn?.classList.remove('active');
      desktopBtn?.classList.add('text-slate-600');
      dockBtn?.classList.remove('active');
    }
  });

  // 捲動至頁面頂端
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabName === 'history') {
    const monthInput = document.getElementById('history-filter-month');
    if (monthInput && !monthInput.value) monthInput.value = getCurrentYearMonth();
    filterHistoryOrders();
  } else if (tabName === 'monthly') {
    const monthInput = document.getElementById('monthly-select-month');
    if (monthInput && !monthInput.value) monthInput.value = getCurrentYearMonth();
    calculateMonthlyPayroll();
  } else if (tabName === 'settings') {
    renderSettingsTables();
  }

  if (window.lucide) lucide.createIcons();
}

// 全域浮動提示 (Toast)
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.classList.remove('translate-y-12', 'opacity-0', 'pointer-events-none');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('translate-y-12', 'opacity-0', 'pointer-events-none');
  }, 2800);
}

// 應用程式進入點初始化
document.addEventListener('DOMContentLoaded', () => {
  initCurrentDate();
  initFirebase();
  if (window.lucide) lucide.createIcons();
});
