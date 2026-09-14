


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


function ensureServicesSynced(existingServices) {
  const defaultList = (typeof DEFAULT_SERVICES !== 'undefined') ? DEFAULT_SERVICES : [];
  const norm = (typeof normalizeServiceName === 'function')
    ? normalizeServiceName
    : (name => String(name || '').replace(/[\s\(\)\-_（）]/g, '').toLowerCase());


  const isDeprecatedService = s => {
    if (!s) return true;
    if (s.id === 'color-bring-next') return true;
    const n = norm(s.name);
    if (n.includes('明年啟動') || (n.includes('自帶') && n.includes('明年'))) return true;
    return false;
  };

  const cleanExisting = (Array.isArray(existingServices) ? existingServices : []).filter(s => !isDeprecatedService(s));

  if (cleanExisting.length === 0) {
    return defaultList.map(s => {
      const copy = { ...s };
      if (typeof copy.empPrice !== 'number') delete copy.empPrice;
      return copy;
    });
  }

  const existingMap = new Map();
  cleanExisting.forEach(s => {
    if (s && s.id) existingMap.set(s.id, s);
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
        if (!handledIds.has(id) && norm(s.name) === defNormName) {
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
        name: (matchedItem.id === def.id) ? (matchedItem.name || def.name) : def.name,

        category: (matchedItem.category && matchedItem.category !== '技術服務') ? matchedItem.category : def.category,
        price: typeof matchedItem.price === 'number' ? matchedItem.price : def.price,
        rate: (typeof matchedItem.rate === 'number' && matchedItem.rate > 0) ? matchedItem.rate : (def.rate || 0)
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


      if (data && data.appVersion && typeof triggerAppUpdate === 'function' && typeof CURRENT_APP_VERSION !== 'undefined' && data.appVersion !== CURRENT_APP_VERSION) {
        console.log(`[Firebase] 偵測到 Firestore 即時版本推播: ${data.appVersion}`);
        triggerAppUpdate(data.appVersion);
        return;
      }

      appState.services = ensureServicesSynced(data.services);
      appState.staff = data.staff || [];
      appState.orders = data.orders || [];


      if (currentUserRole === 'admin' && currentUser && typeof APP_VERSION !== 'undefined' && data.appVersion !== APP_VERSION) {
        storeDocRef.set({ appVersion: APP_VERSION }, { merge: true }).catch(e => console.warn('自動同步雲端版本失敗:', e));
      }
      if (currentUserRole === 'admin' && currentUser && Array.isArray(data.services) && JSON.stringify(appState.services) !== JSON.stringify(data.services)) {
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
    }
    filterHistoryOrders();
    calculateMonthlyPayroll();
    renderSettingsTables();
    checkStaffEmptyState();
  }, err => {
    console.error('Firestore 共享沙龍即時同步錯誤:', err);
  });
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
