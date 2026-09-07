/**
 * SalonFlow - 版本自動偵測與智慧防遺失強制重載模組 (js/version.js)
 */

const CURRENT_APP_VERSION = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '20260907_3';
let isUpdatingApp = false;
let versionCheckTimer = null;

// 更新介面上的版本標籤
function renderVersionInfo() {
  const versionTags = [
    document.getElementById('header-version-tag'),
    document.getElementById('settings-current-version')
  ];
  versionTags.forEach(el => {
    if (el) el.textContent = `v${CURRENT_APP_VERSION}`;
  });
}

// 檢查雲端是否有新版本
async function checkForAppUpdates(options = {}) {
  const { manual = false, silent = false } = options;
  if (isUpdatingApp) return;

  try {
    // 透過時間戳與 no-store 繞過瀏覽器/PWA快取
    const response = await fetch(`version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      if (manual && typeof showToast === 'function') {
        showToast('無法取得版本資訊，請檢查網路連線');
      }
      return;
    }

    const data = await response.json();
    if (data && data.version && data.version !== CURRENT_APP_VERSION) {
      console.log(`[VersionChecker] 發現新版本：${data.version} (本地: ${CURRENT_APP_VERSION})`);
      triggerAppUpdate(data.version);
    } else if (manual && typeof showToast === 'function') {
      showToast(`目前已是最新版本 (v${CURRENT_APP_VERSION})`);
    }
  } catch (err) {
    if (manual && typeof showToast === 'function') {
      showToast('檢查版本失敗，請確認網路狀態');
    }
    console.warn('[VersionChecker] 版本檢查略過:', err.message);
  }
}

// 觸發強制重載與版本升級
function triggerAppUpdate(newVersion) {
  if (isUpdatingApp) return;
  isUpdatingApp = true;

  // 1. 自動備份當前開單草稿至 LocalStorage，防範資料遺失
  if (typeof saveBillingDraftToStorage === 'function') {
    try {
      saveBillingDraftToStorage();
    } catch (e) {
      console.warn('保存草稿失敗:', e);
    }
  }

  // 2. 顯示更新提示全螢幕蓋板，給予友善提示
  let modal = document.getElementById('version-update-modal');
  if (!modal && typeof document !== 'undefined' && document.body) {
    modal = document.createElement('div');
    modal.id = 'version-update-modal';
    modal.className = 'fixed inset-0 bg-slate-900/85 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-6 text-center select-none';
    modal.innerHTML = `
      <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-slate-800">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
          <svg class="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
        <h3 class="text-lg font-black text-slate-900 mb-1">發現新版本系統</h3>
        <p class="text-xs text-slate-500 mb-3 leading-relaxed">已為您安全保存當前草稿，正在重新載入套用最新版本...</p>
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-[11px] font-mono font-bold text-amber-800 mb-2">
          <span>v${CURRENT_APP_VERSION}</span>
          <span>➜</span>
          <span class="text-amber-600 font-black">v${newVersion}</span>
        </div>
        <div class="text-[10px] text-slate-400 mt-2">請稍候，即將自動刷新</div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 3. 清理快取（若瀏覽器支援 Cache Storage API）
  if (typeof window !== 'undefined' && 'caches' in window && window.caches.keys) {
    window.caches.keys().then(names => {
      return Promise.all(names.map(name => window.caches.delete(name)));
    }).catch(() => {});
  }

  // 4. 破快取強制重開
  setTimeout(() => {
    if (typeof window !== 'undefined' && window.location) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.replace(`${cleanUrl}?v=${encodeURIComponent(newVersion)}&_t=${Date.now()}`);
    }
  }, 900);
}

// 初始化版本檢查監聽器
function initVersionChecker() {
  renderVersionInfo();

  // 1. 頁面載入後 3 秒初次檢查
  setTimeout(() => {
    checkForAppUpdates({ silent: true });
  }, 3000);

  // 2. 每 60 秒常規背景輪詢
  if (versionCheckTimer) clearInterval(versionCheckTimer);
  versionCheckTimer = setInterval(() => {
    checkForAppUpdates({ silent: true });
  }, 60 * 1000);

  // 3. 手機螢幕待機解鎖喚醒 / 切回分頁時立即檢查 (關鍵)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForAppUpdates({ silent: true });
      }
    });
  }

  // 4. 視窗重獲焦點或網路重連時立即檢查
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      checkForAppUpdates({ silent: true });
    });
    window.addEventListener('online', () => {
      checkForAppUpdates({ silent: true });
    });
  }
}
