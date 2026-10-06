


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


// deletedServiceIds：管理員刪除的內建項目 ID 清單，同步時不再自動補回
function ensureServicesSynced(existingServices, deletedServiceIds = []) {
  const deletedSet = new Set(Array.isArray(deletedServiceIds) ? deletedServiceIds : []);
  const defaultList = ((typeof DEFAULT_SERVICES !== 'undefined') ? DEFAULT_SERVICES : []).filter(def => !deletedSet.has(def.id));
  const norm = (typeof normalizeServiceName === 'function')
    ? normalizeServiceName
    : (name => String(name || '').replace(/[\s\(\)\-_（）]/g, '').toLowerCase());


  const isDeprecatedService = s => {
    if (!s) return true;
    if (s.id === 'color-bring-next') return true;
    if (s.id === 'shampoo-act-short' || s.id === 'shampoo-ret-short') return true;
    const n = norm(s.name);
    if (n.includes('明年啟動') || (n.includes('自帶') && n.includes('明年'))) return true;
    if (n.includes('洗頭') && n.includes('短髮')) return true;
    return false;
  };

  const cleanExisting = (Array.isArray(existingServices) ? existingServices : []).filter(s => !isDeprecatedService(s) && !deletedSet.has(s.id));

  if (cleanExisting.length === 0) {
    return defaultList.map(s => {
      const copy = { ...s };
      if (typeof copy.empPrice !== 'number') delete copy.empPrice;
      return copy;
    });
  }

  const existingMap = new Map();
  cleanExisting.forEach(s => {
    if (s && s.id) {
      // 舊版 ID 映射轉移
      if (s.id === 'shampoo-act-long') s.id = 'shampoo-emp';
      if (s.id === 'shampoo-ret-long') s.id = 'shampoo-ext';
      existingMap.set(s.id, s);
    }
  });

  const merged = [];
  const handledIds = new Set();
  const seenNormNames = new Set();

  defaultList.forEach(def => {
    const defNormName = norm(def.name);
    let matchedItem = null;

    if (existingMap.has(def.id)) {
      matchedItem = existingMap.get(def.id);
      handledIds.add(def.id);
    } else {
      for (const [id, s] of existingMap.entries()) {
        const sNorm = norm(s.name);
        if (!handledIds.has(id) && (sNorm === defNormName || (def.id === 'shampoo-emp' && sNorm.includes('在職') && sNorm.includes('洗頭')) || (def.id === 'shampoo-ext' && (sNorm.includes('退休') || sNorm.includes('非員工')) && sNorm.includes('洗頭')))) {
          matchedItem = s;
          handledIds.add(id);
          break;
        }
      }
    }

    for (const [id, s] of existingMap.entries()) {
      if (!handledIds.has(id) && norm(s.name) === defNormName) {
        if (matchedItem && matchedItem.price === def.price && typeof s.price === 'number' && s.price !== def.price) {
          matchedItem.price = s.price;
        }
        if (matchedItem && (!matchedItem.rate || matchedItem.rate === 0) && typeof s.rate === 'number' && s.rate > 0) {
          matchedItem.rate = s.rate;
        }
        handledIds.add(id);
      }
    }

    if (matchedItem) {
      const item = {
        ...def,
        ...matchedItem,
        id: def.id,
        name: (matchedItem.id === def.id && def.id !== 'prod-16') ? (matchedItem.name || def.name) : def.name,
        category: (matchedItem.category && matchedItem.category !== '技術服務') ? matchedItem.category : def.category,
        price: typeof matchedItem.price === 'number' ? matchedItem.price : def.price,
        rate: (() => {
          let r = (typeof matchedItem.rate === 'number' && matchedItem.rate > 0) ? matchedItem.rate : (def.rate || 0);
          if (def.category === '產品銷售' && (r === 10 || r === 0)) {
            r = def.rate || 30;
          }
          return r;
        })(),
        gender: Array.isArray(matchedItem.gender) && matchedItem.gender.length > 0 ? matchedItem.gender : (def.gender || ['male', 'female']),
        identity: Array.isArray(matchedItem.identity) && matchedItem.identity.length > 0 ? matchedItem.identity : (def.identity || ['employee', 'retiree', 'family', 'external']),
        allowDiscount: typeof matchedItem.allowDiscount === 'boolean' ? matchedItem.allowDiscount : (def.allowDiscount !== undefined ? def.allowDiscount : (def.category === '產品銷售'))
      };
      if (typeof matchedItem.empPrice === 'number') {
        item.empPrice = matchedItem.empPrice;
      } else if (typeof def.empPrice === 'number') {
        item.empPrice = def.empPrice;
      } else {
        delete item.empPrice;
      }
      merged.push(item);
      seenNormNames.add(norm(item.name));
    } else {
      const item = { ...def };
      if (typeof item.empPrice !== 'number') {
        delete item.empPrice;
      }
      merged.push(item);
      seenNormNames.add(defNormName);
    }
  });

  existingMap.forEach((customItem, id) => {
    if (!handledIds.has(id)) {
      const normName = norm(customItem.name);
      if (!seenNormNames.has(normName)) {
        const item = { ...customItem };
        if (typeof item.empPrice !== 'number') {
          delete item.empPrice;
        }
        if (!Array.isArray(item.gender) || item.gender.length === 0) item.gender = ['male', 'female'];
        if (!Array.isArray(item.identity) || item.identity.length === 0) item.identity = ['employee', 'retiree', 'family', 'external'];
        if (typeof item.allowDiscount !== 'boolean') item.allowDiscount = item.category === '產品銷售';
        merged.push(item);
        seenNormNames.add(normName);
      }
    }
  });

  return merged;
}


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


      // 檢查雲端即時廣播版本（僅當雲端版本大於本地版本才觸發，絕不使用 return 阻斷正常資料處理）
      if (data && data.appVersion && typeof triggerAppUpdate === 'function' && typeof CURRENT_APP_VERSION !== 'undefined') {
        const isNewer = (typeof isNewerVersion === 'function')
          ? isNewerVersion(data.appVersion, CURRENT_APP_VERSION)
          : (data.appVersion > CURRENT_APP_VERSION);
        if (isNewer) {
          console.log(`[Firebase] 偵測到 Firestore 即時新版本推播: ${data.appVersion} (本地: ${CURRENT_APP_VERSION})`);
          triggerAppUpdate(data.appVersion);
        }
      }

      appState.deletedServiceIds = Array.isArray(data.deletedServiceIds) ? data.deletedServiceIds : [];
      appState.services = ensureServicesSynced(data.services, appState.deletedServiceIds);
      appState.staff = data.staff || [];
      appState.orders = sortOrdersNewestFirst(data.orders || []);

      // 版本較舊的管理員裝置（尚未更新快取）不得回寫雲端，避免與新版裝置互相覆蓋形成循環
      const hasVersionApi = typeof APP_VERSION !== 'undefined' && typeof isNewerVersion === 'function';
      const isOutdatedClient = hasVersionApi && !!data.appVersion && isNewerVersion(data.appVersion, APP_VERSION);

      // 管理員裝置版本較新時，才自動將雲端廣播版本往上校正（降版需由設定頁手動執行）
      if (currentUserRole === 'admin' && currentUser && hasVersionApi && (!data.appVersion || isNewerVersion(APP_VERSION, data.appVersion))) {
        storeDocRef.set({ appVersion: APP_VERSION }, { merge: true })
          .then(() => console.log(`[Firebase] 管理員已成功將雲端廣播版本同步校正為: ${APP_VERSION}`))
          .catch(e => console.warn('自動同步雲端版本失敗:', e));
      }
      if (currentUserRole === 'admin' && currentUser && !isOutdatedClient && Array.isArray(data.services) && JSON.stringify(appState.services) !== JSON.stringify(data.services)) {
        storeDocRef.set({ services: appState.services }, { merge: true }).catch(e => console.warn('自動同步清理雲端廢棄服務失敗:', e));
      }


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
                appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : undefined,
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

    if (!billingInitialized) {
      billingInitialized = true;
      initBillingForm();
    } else if (typeof renderPosWizard === 'function') {
      // 服務項目即時異動（如管理員新增自訂項目）時刷新開單磚塊
      renderPosWizard();
    }
    filterHistoryOrders();
    calculateMonthlyPayroll();
    renderSettingsTables();
    checkStaffEmptyState();
  }, err => {
    console.error('Firestore 共享沙龍即時同步錯誤:', err);
  });

  subscribeToConnectionStatus(storeDocRef);
}

// 客單依日期、時間、建立時間由新到舊排序（雲端以 arrayUnion 附加時新單位於陣列尾端）
function sortOrdersNewestFirst(orders) {
  const key = o => `${o?.date || ''} ${o?.time || ''} ${o?.createdAt || ''}`;
  return (Array.isArray(orders) ? orders.slice() : []).sort((a, b) => key(b).localeCompare(key(a)));
}

// ==========================================
// 連線狀態指示：區分「已同步 / 上傳中 / 離線暫存」
// ==========================================
let unsubscribeConnectionStatus = null;
let cloudSyncState = 'synced';

function subscribeToConnectionStatus(storeDocRef) {
  if (unsubscribeConnectionStatus) {
    unsubscribeConnectionStatus();
    unsubscribeConnectionStatus = null;
  }
  const update = (fromCache, hasPendingWrites) => {
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || fromCache;
    cloudSyncState = offline ? 'offline' : (hasPendingWrites ? 'pending' : 'synced');
    renderConnectionStatus();
  };
  let lastMeta = { fromCache: false, hasPendingWrites: false };
  unsubscribeConnectionStatus = storeDocRef.onSnapshot({ includeMetadataChanges: true }, doc => {
    lastMeta = { fromCache: doc.metadata.fromCache, hasPendingWrites: doc.metadata.hasPendingWrites };
    update(lastMeta.fromCache, lastMeta.hasPendingWrites);
  }, () => update(true, false));

  if (!subscribeToConnectionStatus.listening && typeof window !== 'undefined' && window.addEventListener) {
    subscribeToConnectionStatus.listening = true;
    window.addEventListener('online', () => update(lastMeta.fromCache, lastMeta.hasPendingWrites));
    window.addEventListener('offline', () => update(true, lastMeta.hasPendingWrites));
  }
}

function renderConnectionStatus() {
  const pill = document.getElementById('header-sync-pill');
  const dot = document.getElementById('header-sync-dot');
  const banner = document.getElementById('offline-banner');
  const styles = {
    synced: { pill: 'text-emerald-600 bg-emerald-50/80 border-emerald-200/50', dot: 'bg-emerald-500', title: '已連線，資料已同步' },
    pending: { pill: 'text-amber-700 bg-amber-50/80 border-amber-200/60', dot: 'bg-amber-500 animate-pulse', title: '資料上傳中…' },
    offline: { pill: 'text-rose-700 bg-rose-50/80 border-rose-200/60', dot: 'bg-rose-500 animate-pulse', title: '目前離線：開單會先存在本機，恢復連線後自動上傳' }
  };
  const s = styles[cloudSyncState] || styles.synced;
  if (pill) {
    pill.className = `flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${s.pill}`;
    pill.title = s.title;
  }
  if (dot) dot.className = `w-2 h-2 rounded-full ${s.dot}`;
  if (banner) banner.classList.toggle('hidden', cloudSyncState !== 'offline');
}

function isCloudOffline() {
  return cloudSyncState === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

// ==========================================
// 客單寫入：只「附加 / 修改單筆」，絕不以整份陣列覆蓋，避免多裝置同時開單或離線裝置回線時覆蓋他人客單
// ==========================================
function getStoreDocRef() {
  return (currentUser && db) ? db.collection('salon_stores').doc('main_store') : null;
}

function toFirestoreSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 新增客單：arrayUnion 由伺服器端附加，離線時亦可排隊、回線後只附加這一筆
async function appendOrderToCloud(order) {
  localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));
  const ref = getStoreDocRef();
  if (!ref) return;
  const write = ref.set({ orders: firebase.firestore.FieldValue.arrayUnion(toFirestoreSafe(order)) }, { merge: true });
  return waitForCloudWrite(write);
}

// 等待雲端確認；離線或連線過慢時不阻塞畫面（寫入已存入本機佇列，回線後自動上傳），回傳 'queued'
async function waitForCloudWrite(write, timeoutMs = 4000) {
  write.catch(err => console.error('雲端寫入失敗:', err));
  if (isCloudOffline()) return 'queued';
  let timer = null;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve('queued'), timeoutMs); });
  try {
    return await Promise.race([write.then(() => 'synced'), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// 撤回剛開立的客單（開單成功畫面的「復原」）：arrayRemove 只移除這一筆
async function removeOrderFromCloud(order) {
  localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));
  const ref = getStoreDocRef();
  if (!ref) return;
  const write = ref.update({ orders: firebase.firestore.FieldValue.arrayRemove(toFirestoreSafe(order)) });
  return waitForCloudWrite(write);
}

// 修改單筆客單（如作廢）：以交易讀取雲端最新資料後僅修改該筆，需連線
async function updateOrderInCloud(orderId, patch) {
  const ref = getStoreDocRef();
  if (!ref) return;
  if (isCloudOffline()) {
    throw new Error('目前離線中，請恢復網路連線後再操作');
  }
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('連線逾時，請確認網路後重新整理，查看此單狀態')), 10000);
  });
  const tx = db.runTransaction(async t => {
    const snap = await t.get(ref);
    const orders = (snap.exists && Array.isArray(snap.data().orders)) ? snap.data().orders : [];
    const idx = orders.findIndex(o => o && o.id === orderId);
    if (idx === -1) throw new Error('雲端找不到此客單，請重新整理後再試');
    orders[idx] = { ...orders[idx], ...toFirestoreSafe(patch) };
    t.update(ref, { orders });
  });
  try {
    await Promise.race([tx, timeout]);
  } finally {
    clearTimeout(timer);
  }
  localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));
}


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


async function syncDataToCloud(targetField = null) {
  localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));

  if (currentUser && db) {
    try {
      const storeDocRef = db.collection('salon_stores').doc('main_store');
      let payload = {};
      if (targetField === 'services') {
        payload = { services: appState.services };
        if (Array.isArray(appState.deletedServiceIds)) {
          payload.deletedServiceIds = appState.deletedServiceIds;
        }
      } else if (targetField === 'staff') {
        payload = { staff: appState.staff };
      } else if (targetField === 'orders') {
        payload = { orders: appState.orders };
      } else {

        payload = {
          services: appState.services,
          staff: appState.staff,
          orders: appState.orders
        };
      }

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
    appAlert('請輸入或貼上 Firebase Config 代碼！');
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
    appAlert('金鑰格式解析錯誤，請確認貼上的內容包含正確的 apiKey 與 projectId！\n\n錯誤訊息：' + err.message);
  }
}
