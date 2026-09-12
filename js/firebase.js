/**
 * SalonFlow - Firebase 雲端資料庫連線與同步管理 (js/firebase.js)
 */

// 初始化 Firebase 雲端服務
function initFirebase() {
  let config = window.FIREBASE_CONFIG;
  const storedConfig = localStorage.getItem('SALON_FIREBASE_CONFIG');
  if (storedConfig) {
    try {
      config = JSON.parse(storedConfig);
    } catch (e) {}
  }

  if (!config || !config.apiKey || config.apiKey === '') {
    const configAlert = document.getElementById('auth-config-alert');
    if (configAlert) configAlert.classList.remove('hidden');
    loadLocalFallback();
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(config);
    } else {
      firebaseApp = firebase.app();
    }

    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      console.warn('離線快取提示:', err.code);
    });

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        onUserLoggedIn(user);
      } else {
        currentUser = null;
        onUserLoggedOut();
      }
    });

  } catch (err) {
    console.error('Firebase 初始化失敗:', err);
    showAuthError('Firebase 初始化錯誤：' + err.message);
  }
}

// 智慧合併店內服務項目清單（確保 POS 開單項目一應俱全，同時保留管理員修改之定價與抽成）
function ensureServicesSynced(existingServices) {
  const defaultList = (typeof DEFAULT_SERVICES !== 'undefined') ? DEFAULT_SERVICES : [];
  if (!Array.isArray(existingServices) || existingServices.length === 0) {
    return defaultList.map(s => {
      const copy = { ...s };
      if (typeof copy.empPrice !== 'number') delete copy.empPrice;
      return copy;
    });
  }

  const existingMap = new Map();
  existingServices.forEach(s => {
    if (s && s.id) existingMap.set(s.id, s);
  });

  const merged = [];

  // 1. 依序對應 DEFAULT_SERVICES，若已有則保留其自訂定價與抽成，但補足缺漏欄位(如分類)
  defaultList.forEach(def => {
    if (existingMap.has(def.id)) {
      const current = existingMap.get(def.id);
      const item = {
        ...def,
        ...current,
        // 若舊版分類為「技術服務」，自動對齊 POS 精確分類
        category: (current.category && current.category !== '技術服務') ? current.category : def.category,
        price: typeof current.price === 'number' ? current.price : def.price,
        rate: typeof current.rate === 'number' ? current.rate : (def.rate || 0)
      };
      if (typeof current.empPrice === 'number') {
        item.empPrice = current.empPrice;
      } else if (typeof def.empPrice === 'number') {
        item.empPrice = def.empPrice;
      } else {
        delete item.empPrice;
      }
      merged.push(item);
      existingMap.delete(def.id);
    } else {
      const item = { ...def };
      if (typeof item.empPrice !== 'number') {
        delete item.empPrice;
      }
      merged.push(item);
    }
  });

  // 2. 保留使用者自行新增之自訂項目
  existingMap.forEach(customItem => {
    const item = { ...customItem };
    if (typeof item.empPrice !== 'number') {
      delete item.empPrice;
    }
    merged.push(item);
  });

  return merged;
}

// 監聽全店共享沙龍即時同步 (salon_stores/main_store)
function subscribeToCloudData() {
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
  if (!db) return;

  const storeDocRef = db.collection('salon_stores').doc('main_store');
  let billingInitialized = false;

  unsubscribeFirestore = storeDocRef.onSnapshot(async doc => {
    if (doc.exists) {
      const data = sanitizeOldMockData(doc.data());

      // 若雲端文件指定了強制版本號且與本地不同，立刻觸發秒級更新
      if (data && data.appVersion && typeof triggerAppUpdate === 'function' && typeof CURRENT_APP_VERSION !== 'undefined' && data.appVersion !== CURRENT_APP_VERSION) {
        console.log(`[Firebase] 偵測到 Firestore 即時版本推播: ${data.appVersion}`);
        triggerAppUpdate(data.appVersion);
        return;
      }

      appState.services = ensureServicesSynced(data.services);
      appState.staff = data.staff || [];
      appState.orders = data.orders || [];

      // 若 main_store 中的人員名單為空，但目前登入者舊資料庫(users/{uid})有人員，自動匯入至共享沙龍
      if ((!appState.staff || appState.staff.length === 0) && currentUser) {
        try {
          const oldDoc = await db.collection('users').doc(currentUser.uid).get();
          if (oldDoc.exists) {
            const oldData = sanitizeOldMockData(oldDoc.data());
            if (oldData.staff && oldData.staff.length > 0) {
              appState.staff = oldData.staff;
              if (oldData.orders && oldData.orders.length > 0 && appState.orders.length === 0) {
                appState.orders = oldData.orders;
              }
              await storeDocRef.set({
                services: appState.services,
                staff: appState.staff,
                orders: appState.orders
              }, { merge: true });
            }
          }
        } catch(e) {
          console.warn('檢查舊資料庫遷移失敗:', e);
        }
      }
    } else {
      // 若尚未建立 main_store，檢查現有使用者的舊獨立庫並自動無縫遷移！
      let initialServices = ensureServicesSynced([]);
      let initialStaff = [];
      let initialOrders = [];

      try {
        if (currentUser) {
          const oldDoc = await db.collection('users').doc(currentUser.uid).get();
          if (oldDoc.exists) {
            const oldData = sanitizeOldMockData(oldDoc.data());
            initialServices = ensureServicesSynced(oldData.services || []);
            initialStaff = oldData.staff || initialStaff;
            initialOrders = oldData.orders || initialOrders;
          }
        }
      } catch(e) {
        console.warn('遷移舊個人資料跳過:', e);
      }

      appState.services = initialServices;
      appState.staff = initialStaff;
      appState.orders = initialOrders;

      await storeDocRef.set({
        services: appState.services,
        staff: appState.staff,
        orders: appState.orders
      });
    }

    localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));

    updateLinkedStaff();
    applyRolePermissions();
    initHistoryFilters();
    initMonthlyView();
    populateStaffDropdowns();
    // 即時資料更新不可重設正在輸入的客單；僅在訂閱首次載入時初始化。
    if (!billingInitialized) {
      billingInitialized = true;
      initBillingForm();
    }
    filterHistoryOrders();
    calculateMonthlyPayroll();
    renderSettingsTables();
    checkStaffEmptyState();
  }, err => {
    console.error('Firestore 共享沙龍即時同步錯誤:', err);
  });
}

// 監聽全店已註冊帳號列表 (供管理員綁定人員)
function subscribeToUsersList() {
  if (unsubscribeUsersList) {
    unsubscribeUsersList();
    unsubscribeUsersList = null;
  }
  if (!db) return;

  unsubscribeUsersList = db.collection('salon_users').onSnapshot(snap => {
    allRegisteredUsers = [];
    snap.forEach(doc => {
      allRegisteredUsers.push(doc.data());
    });
    renderSettingsTables();
  }, err => {
    console.warn('讀取註冊使用者清單失敗:', err);
  });
}

// 上傳與同步全店資料至雲端 (支援精準欄位獨立更新 targetField: 'services' | 'staff' | 'orders')
async function syncDataToCloud(targetField = null) {
  localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));

  if (currentUser && db) {
    try {
      const storeDocRef = db.collection('salon_stores').doc('main_store');
      let payload = {};
      if (targetField === 'services') {
        payload = { services: appState.services };
      } else if (targetField === 'staff') {
        payload = { staff: appState.staff };
      } else if (targetField === 'orders') {
        payload = { orders: appState.orders };
      } else {
        // 未指定特定欄位時：完整安全合併
        payload = {
          services: appState.services,
          staff: appState.staff,
          orders: appState.orders
        };
      }
      // 防禦性清理：確保送往 Firestore 之物件絕對不含任何 undefined 屬性，避免 SDK 拋出 DocumentReference.set() 異常
      const safePayload = JSON.parse(JSON.stringify(payload));
      await storeDocRef.set(safePayload, { merge: true });
    } catch (err) {
      console.error('上傳雲端失敗:', err);
      if (typeof showToast === 'function') {
        showToast('⚠️ 雲端同步失敗: ' + (err.message || '請檢查網路連線'));
      }
      throw err;
    }
  }
}

// 雲端金鑰貼上設定視窗
function openCloudConfigModal() {
  const modal = document.getElementById('modal-cloud-config');
  const input = document.getElementById('modal-config-input');
  
  let currentCfg = window.FIREBASE_CONFIG;
  const stored = localStorage.getItem('SALON_FIREBASE_CONFIG');
  if (stored) {
    try { currentCfg = JSON.parse(stored); } catch(e){}
  }

  if (input && currentCfg && currentCfg.apiKey) {
    input.value = JSON.stringify(currentCfg, null, 2);
  }
  if (modal) modal.classList.remove('hidden');
}

function closeCloudConfigModal() {
  const modal = document.getElementById('modal-cloud-config');
  if (modal) modal.classList.add('hidden');
}

function saveCloudConfig() {
  const raw = document.getElementById('modal-config-input').value.trim();
  if (!raw) {
    alert('請輸入或貼上 Firebase Config 代碼！');
    return;
  }

  try {
    let parsedConfig = null;
    if (raw.includes('{') && raw.includes('}')) {
      const jsonStr = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}');
      parsedConfig = JSON.parse(jsonStr);
    } else {
      parsedConfig = JSON.parse(raw);
    }

    if (!parsedConfig.apiKey || !parsedConfig.projectId) {
      throw new Error('解析結果缺少 apiKey 或 projectId');
    }

    localStorage.setItem('SALON_FIREBASE_CONFIG', JSON.stringify(parsedConfig));
    window.FIREBASE_CONFIG = parsedConfig;

    closeCloudConfigModal();
    showToast('Firebase 金鑰設定成功！重新連線雲端...');

    setTimeout(() => {
      window.location.reload();
    }, 800);

  } catch (err) {
    alert('金鑰格式解析錯誤，請確認貼上的內容包含正確的 apiKey 與 projectId！\n\n錯誤訊息：' + err.message);
  }
}
