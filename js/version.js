const CURRENT_APP_VERSION = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '20260907_3';
let isUpdatingApp = false;
let versionCheckTimer = null;
const UPDATE_ATTEMPT_KEY = 'SALON_UPDATE_ATTEMPT';

// 版本字串數值化（支援 YYYYMMDD 或 YYYYMMDD_N 格式）
function parseVersion(vStr) {
  if (!vStr) return 0;
  const match = String(vStr).match(/(\d{8})_?(\d+)?/);
  if (match) {
    const datePart = parseInt(match[1], 10);
    const revPart = parseInt(match[2] || '0', 10);
    return datePart * 10000 + revPart;
  }
  return 0;
}

// 嚴格判定遠端版本是否「大於」本地版本（只升不降，絕不對較舊版本重載）
function isNewerVersion(remote, local) {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  if (r > 0 && l > 0) return r > l;
  return String(remote) > String(local);
}

// 檢查是否可觸發更新（防重整死迴圈：30秒內已嘗試載入該版本則禁止再次自動重整）
function canTriggerUpdate(newVersion) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(UPDATE_ATTEMPT_KEY);
      if (raw) {
        const attempt = JSON.parse(raw);
        const timeDiff = Date.now() - (attempt.timestamp || 0);
        if (timeDiff < 30000 && attempt.targetVersion === newVersion) {
          console.warn(`[VersionChecker] 30秒內已針對版本 ${newVersion} 嘗試重載，中止自動重整以避免死迴圈`);
          return false;
        }
      }
    }
  } catch (e) {}
  return true;
}

function recordUpdateAttempt(newVersion) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(UPDATE_ATTEMPT_KEY, JSON.stringify({
        targetVersion: newVersion,
        fromVersion: CURRENT_APP_VERSION,
        timestamp: Date.now()
      }));
    }
  } catch (e) {}
}

function clearUpdateAttemptIfMatched() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(UPDATE_ATTEMPT_KEY);
      if (raw) {
        const attempt = JSON.parse(raw);
        if (attempt.targetVersion === CURRENT_APP_VERSION) {
          sessionStorage.removeItem(UPDATE_ATTEMPT_KEY);
        } else if (Date.now() - (attempt.timestamp || 0) < 30000) {
          console.warn(`[VersionChecker] 上次重載目標為 ${attempt.targetVersion}，但當前載入仍為 ${CURRENT_APP_VERSION}。已啟用防迴圈保護。`);
          if (typeof showToast === 'function') {
            showToast(`目前版本為 v${CURRENT_APP_VERSION} (已啟用防迴圈保護)`);
          }
        }
      }
    }
  } catch (e) {}
}

function renderVersionInfo() {
  const versionTags = [
    document.getElementById('header-version-tag'),
    document.getElementById('settings-current-version')
  ];
  versionTags.forEach(el => {
    if (el) el.textContent = `v${CURRENT_APP_VERSION}`;
  });
}

async function checkForAppUpdates(options = {}) {
  const { manual = false, silent = false } = options;
  if (isUpdatingApp) return;

  try {
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
    if (data && data.version) {
      if (isNewerVersion(data.version, CURRENT_APP_VERSION)) {
        console.log(`[VersionChecker] 發現新版本：${data.version} (本地: ${CURRENT_APP_VERSION})`);
        triggerAppUpdate(data.version);
      } else if (manual && typeof showToast === 'function') {
        showToast(`目前已是最新版本 (v${CURRENT_APP_VERSION})`);
      }
    }
  } catch (err) {
    if (manual && typeof showToast === 'function') {
      showToast('檢查版本失敗，請確認網路狀態');
    }
    console.warn('[VersionChecker] 版本檢查略過:', err.message);
  }
}

function triggerAppUpdate(newVersion) {
  if (isUpdatingApp) return;

  // 核心守門 1：若目標版本沒有大於本地版本，絕不自動觸發更新（支援降版不被死迴圈干擾）
  if (!isNewerVersion(newVersion, CURRENT_APP_VERSION)) {
    console.log(`[VersionChecker] 目標版本 (${newVersion}) 未大於當前版本 (${CURRENT_APP_VERSION})，略過更新`);
    return;
  }

  // 核心守門 2：防重整死迴圈保護（若 30 秒內已針對同一目標版本重載過，中止重複自動重整）
  if (!canTriggerUpdate(newVersion)) {
    return;
  }

  isUpdatingApp = true;
  recordUpdateAttempt(newVersion);

  if (typeof saveBillingDraftToStorage === 'function') {
    try {
      saveBillingDraftToStorage();
    } catch (e) {
      console.warn('保存草稿失敗:', e);
    }
  }

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

  if (typeof window !== 'undefined' && 'caches' in window && window.caches.keys) {
    window.caches.keys().then(names => {
      return Promise.all(names.map(name => window.caches.delete(name)));
    }).catch(() => {});
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const reg of registrations) {
        reg.unregister();
      }
    }).catch(() => {});
  }

  setTimeout(() => {
    if (typeof window !== 'undefined' && window.location) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.replace(`${cleanUrl}?v=${encodeURIComponent(newVersion)}&_t=${Date.now()}`);
    }
  }, 900);
}

function initVersionChecker() {
  clearUpdateAttemptIfMatched();
  renderVersionInfo();

  setTimeout(() => {
    checkForAppUpdates({ silent: true });
  }, 3000);

  if (versionCheckTimer) clearInterval(versionCheckTimer);
  versionCheckTimer = setInterval(() => {
    checkForAppUpdates({ silent: true });
  }, 60 * 1000);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForAppUpdates({ silent: true });
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
      checkForAppUpdates({ silent: true });
    });
    window.addEventListener('online', () => {
      checkForAppUpdates({ silent: true });
    });
  }
}

if (typeof window !== 'undefined') {
  window.isNewerVersion = isNewerVersion;
  window.parseVersion = parseVersion;
  window.canTriggerUpdate = canTriggerUpdate;
}
