/**
 * SalonPay - 美髮沙龍員工薪資與抽成計算系統 (手機佈局 + Firebase 雲端版)
 */

// 預設資料：服務項目與抽成比例 (保留專業美髮服務項目以供下拉選用)
const DEFAULT_SERVICES = [
  { id: 'srv-1', name: '造型剪髮 (含基礎洗)', price: 800, rate: 50, category: '技術服務' },
  { id: 'srv-2', name: '舒壓洗髮 (含吹整)', price: 350, rate: 30, category: '技術服務' },
  { id: 'srv-3', name: '洗髮 + 精緻剪髮', price: 1000, rate: 50, category: '技術服務' },
  { id: 'srv-4', name: '溫塑熱燙 (全頭)', price: 3500, rate: 45, category: '技術服務' },
  { id: 'srv-5', name: '設計造型全染', price: 3200, rate: 45, category: '技術服務' },
  { id: 'srv-6', name: '髮根局部補染', price: 1800, rate: 45, category: '技術服務' },
  { id: 'srv-7', name: '特殊漂染/耳圈染', price: 4500, rate: 45, category: '技術服務' },
  { id: 'srv-8', name: '日本黑曜光結構護髮', price: 2000, rate: 40, category: '技術服務' },
  { id: 'srv-9', name: '草本深層頭皮淨化SPA', price: 1500, rate: 40, category: '技術服務' },
  { id: 'srv-10', name: '專業沙龍護髮精華油 (100ml)', price: 980, rate: 25, category: '產品銷售' },
  { id: 'srv-11', name: '控油豐盈洗髮精 (500ml)', price: 850, rate: 25, category: '產品銷售' },
  { id: 'srv-12', name: '強力定型霧 (300ml)', price: 650, rate: 20, category: '產品銷售' },
];

// 預設人員已全部清空，由使用者自行建立專屬團隊
const DEFAULT_STAFF = [];

// 系統核心狀態
let appState = {
  services: [...DEFAULT_SERVICES],
  staff: [],
  orders: []
};

// 雲端與認證狀態變數
let currentUser = null;
let currentUserRole = 'admin'; // 'admin' | 'staff'
let currentLinkedStaff = null;
let allRegisteredUsers = [];
let unsubscribeUsersList = null;
const DEFAULT_ADMIN_SECRET_KEY = "SALON888";
let salonAdminKey = DEFAULT_ADMIN_SECRET_KEY;

let firebaseApp = null;
let db = null;
let isAuthSignUpMode = false;
let unsubscribeFirestore = null;

// 現場開單明細行狀態暫存
let currentBillingRows = [];

// ==========================================
// 初始化流程
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initCurrentDate();
  initFirebase();
  lucide.createIcons();
});

// 清除先前舊範例人員 (如果有)
function sanitizeOldMockData(data) {
  if (data && Array.isArray(data.staff)) {
    data.staff = data.staff.filter(s => 
      !s.name.includes('Hank (設計師)') && 
      !s.name.includes('Emily (設計師)') && 
      !s.name.includes('小涵 (技術助理)')
    );
  }
  return data;
}

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

function loadLocalFallback() {
  const raw = localStorage.getItem('SALON_PAY_LOCAL_CACHE');
  if (raw) {
    try {
      appState = sanitizeOldMockData(JSON.parse(raw));
    } catch(e) {}
  } else {
    appState = {
      services: [...DEFAULT_SERVICES],
      staff: [],
      orders: []
    };
  }
  applyRolePermissions();
  populateStaffDropdowns();
  initBillingForm();
  initHistoryFilters();
  initMonthlyView();
  renderSettingsTables();
}

// ==========================================
// 雲端帳號登入與認證控制 (支援管理員密鑰驗證與身分分權)
// ==========================================
function setAuthMode(isSignUp) {
  isAuthSignUpMode = isSignUp;
  const submitText = document.getElementById('auth-submit-text');
  const roleContainer = document.getElementById('auth-role-container');
  const keyContainer = document.getElementById('auth-secret-key-container');
  const emailLabel = document.getElementById('auth-email-label');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');

  if (isAuthSignUpMode) {
    if (tabSignup) {
      tabSignup.className = 'py-2.5 rounded-xl transition bg-white text-slate-900 shadow-xs flex items-center justify-center gap-1.5';
    }
    if (tabLogin) {
      tabLogin.className = 'py-2.5 rounded-xl transition text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
    }
    if (submitText) submitText.textContent = '註冊並加入雲端沙龍';
    if (roleContainer) roleContainer.classList.remove('hidden');
    if (emailLabel) emailLabel.textContent = '註冊信箱 (Email)';

    const selectedRole = document.querySelector('input[name="auth-reg-role"]:checked')?.value || 'staff';
    onAuthRoleChange(selectedRole);
  } else {
    if (tabLogin) {
      tabLogin.className = 'py-2.5 rounded-xl transition bg-white text-slate-900 shadow-xs flex items-center justify-center gap-1.5';
    }
    if (tabSignup) {
      tabSignup.className = 'py-2.5 rounded-xl transition text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
    }
    if (submitText) submitText.textContent = '登入雲端系統';
    if (roleContainer) roleContainer.classList.add('hidden');
    if (keyContainer) keyContainer.classList.add('hidden');
    if (emailLabel) emailLabel.textContent = '信箱 (Email)';
  }
  if (window.lucide) lucide.createIcons();
}

function toggleAuthMode() {
  setAuthMode(!isAuthSignUpMode);
}

function onAuthRoleChange(role) {
  const keyContainer = document.getElementById('auth-secret-key-container');
  const adminKeyInput = document.getElementById('auth-admin-key');
  if (role === 'admin') {
    if (keyContainer) keyContainer.classList.remove('hidden');
    if (adminKeyInput) adminKeyInput.required = true;
  } else {
    if (keyContainer) keyContainer.classList.add('hidden');
    if (adminKeyInput) {
      adminKeyInput.required = false;
      adminKeyInput.value = '';
    }
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const submitBtn = document.getElementById('auth-submit-btn');

  hideAuthError();
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-75');

  try {
    if (isAuthSignUpMode) {
      const selectedRole = document.querySelector('input[name="auth-reg-role"]:checked')?.value || 'staff';

      // 若註冊為管理員，嚴格比對授權密鑰
      if (selectedRole === 'admin') {
        const inputKey = (document.getElementById('auth-admin-key')?.value || '').trim();
        if (!inputKey || (inputKey !== salonAdminKey && inputKey !== DEFAULT_ADMIN_SECRET_KEY)) {
          throw new Error('管理員授權密鑰不符！若您是一般員工，請切換身分為「一般員工」註冊。');
        }
      }

      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);

      // 將註冊資料寫入全店 salon_users 集合
      await db.collection('salon_users').doc(cred.user.uid).set({
        uid: cred.user.uid,
        email: email,
        role: selectedRole,
        createdAt: new Date().toISOString()
      });

      showToast(`註冊成功！身分：${selectedRole === 'admin' ? '管理員' : '員工'}`);
    } else {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      showToast('登入成功！已連線至雲端');
    }
  } catch (err) {
    console.error('Auth error:', err);
    let msg = '認證失敗：' + err.message;
    if (err.code === 'auth/wrong-password') msg = '密碼輸入錯誤，請重新確認。';
    if (err.code === 'auth/user-not-found') msg = '此信箱尚未註冊，請點下方註冊新帳號。';
    if (err.code === 'auth/email-already-in-use') msg = '此信箱已被註冊，請直接登入。';
    if (err.code === 'auth/weak-password') msg = '密碼強度不足，請輸入至少 6 位字元。';
    showAuthError(msg);
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-75');
  }
}

async function onUserLoggedIn(user) {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.add('hidden');

  // 取得該使用者的角色權限
  let role = 'staff';
  try {
    const userDoc = await db.collection('salon_users').doc(user.uid).get();
    if (userDoc.exists) {
      role = userDoc.data().role || 'staff';
    }

    // 創始帳號（信箱含 hank）永久確保為管理員
    const isHank = user.email && user.email.toLowerCase().includes('hank');
    if (isHank) {
      role = 'admin';
    }

    await db.collection('salon_users').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      role: role,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch(e) {
    console.warn('載入使用者角色時發生錯誤:', e);
  }

  currentUserRole = role;
  applyRolePermissions();
  subscribeToCloudData();

  if (currentUserRole === 'admin') {
    subscribeToUsersList();
  }
}

function onUserLoggedOut() {
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
  if (unsubscribeUsersList) {
    unsubscribeUsersList();
    unsubscribeUsersList = null;
  }
  currentUser = null;
  currentLinkedStaff = null;
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.remove('hidden');
}

async function handleSignOut() {
  if (!confirm('確定要登出系統嗎？')) return;
  if (firebase.auth) {
    await firebase.auth().signOut();
  }
  showToast('已登出');
}

function showAuthError(msg) {
  const box = document.getElementById('auth-error-msg');
  const text = document.getElementById('auth-error-text');
  if (box && text) {
    text.textContent = msg;
    box.classList.remove('hidden');
  }
}

function hideAuthError() {
  const box = document.getElementById('auth-error-msg');
  if (box) box.classList.add('hidden');
}

// ==========================================
// 權限與身分切換控制
// ==========================================
function updateLinkedStaff() {
  if (!currentUser) {
    currentLinkedStaff = null;
    return;
  }
  const uid = currentUser.uid;
  const email = (currentUser.email || '').toLowerCase();

  currentLinkedStaff = appState.staff.find(s => 
    (s.linkedUid && s.linkedUid === uid) || 
    (s.linkedEmail && s.linkedEmail.toLowerCase() === email) ||
    (s.name && s.name.toLowerCase() === email.split('@')[0])
  ) || null;
}

function applyRolePermissions() {
  document.body.classList.remove('role-admin', 'role-staff');
  document.body.classList.add(`role-${currentUserRole}`);

  updateLinkedStaff();

  const userEmail = currentUser ? currentUser.email : '';
  const emailPrefix = userEmail.split('@')[0];
  const staffName = currentLinkedStaff ? currentLinkedStaff.name : emailPrefix;

  // 頂部狀態標籤
  const headerEmail = document.getElementById('header-user-email');
  if (headerEmail) {
    if (currentUserRole === 'admin') {
      headerEmail.innerHTML = `管理員 <span class="font-bold text-slate-800">(${emailPrefix})</span>`;
    } else {
      headerEmail.innerHTML = `員工 <span class="font-bold text-slate-800">(${staffName})</span>`;
    }
  }

  // 員工設定頁卡片
  const empName = document.getElementById('settings-employee-name');
  const empEmail = document.getElementById('settings-employee-email');
  const empCard = document.getElementById('settings-employee-card');
  if (empCard) {
    if (currentUserRole === 'staff') empCard.classList.remove('hidden');
    else empCard.classList.add('hidden');
  }
  if (empName) empName.textContent = currentLinkedStaff ? `${currentLinkedStaff.name} (${currentLinkedStaff.role})` : `店內員工 (${emailPrefix})`;
  if (empEmail) empEmail.textContent = `登入帳號: ${userEmail}`;

  // 導覽列與 Dock 標籤文字
  const dockMonthlyText = document.querySelector('#dock-btn-monthly span');
  const tabMonthlyBtn = document.getElementById('tab-btn-monthly');

  if (currentUserRole === 'staff') {
    if (dockMonthlyText) dockMonthlyText.textContent = '當月工作';
    if (tabMonthlyBtn) tabMonthlyBtn.innerHTML = '<i data-lucide="calendar-check-2" class="w-4 h-4"></i> 個人當月工作明細';

    // 現場開單頂部卡片：員工不顯示抽成大字，改為顯示顧客應付總金額
    const titleEl = document.getElementById('summary-card-title');
    if (titleEl) titleEl.textContent = '📝 顧客現場消費總金額';
    const commWrap = document.getElementById('summary-card-commission-wrap');
    if (commWrap) commWrap.classList.add('hidden');
    const staffTotalWrap = document.getElementById('summary-card-staff-total-wrap');
    if (staffTotalWrap) {
      staffTotalWrap.classList.remove('hidden');
      staffTotalWrap.classList.add('flex');
    }
    const rateText = document.getElementById('summary-card-rate-text');
    if (rateText) rateText.classList.add('hidden');
    const custPayWrap = document.getElementById('summary-card-customer-pay-wrap');
    if (custPayWrap) custPayWrap.classList.add('hidden');

    // 月檢視：隱藏列印薪資單按鈕
    const printSlipBtn = document.getElementById('btn-print-salary-slip');
    if (printSlipBtn) printSlipBtn.classList.add('hidden');
  } else {
    if (dockMonthlyText) dockMonthlyText.textContent = '月薪結算';
    if (tabMonthlyBtn) tabMonthlyBtn.innerHTML = '<i data-lucide="calendar-check-2" class="w-4 h-4"></i> 月薪結算與月報表匯出';

    const titleEl = document.getElementById('summary-card-title');
    if (titleEl) titleEl.textContent = '🌟 這單設計師應得抽成';
    const commWrap = document.getElementById('summary-card-commission-wrap');
    if (commWrap) commWrap.classList.remove('hidden');
    const staffTotalWrap = document.getElementById('summary-card-staff-total-wrap');
    if (staffTotalWrap) {
      staffTotalWrap.classList.add('hidden');
      staffTotalWrap.classList.remove('flex');
    }
    const rateText = document.getElementById('summary-card-rate-text');
    if (rateText) rateText.classList.remove('hidden');
    const custPayWrap = document.getElementById('summary-card-customer-pay-wrap');
    if (custPayWrap) custPayWrap.classList.remove('hidden');

    const printSlipBtn = document.getElementById('btn-print-salary-slip');
    if (printSlipBtn) printSlipBtn.classList.remove('hidden');
  }

  lucide.createIcons();
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

function populateLinkedUsersDropdown(currentLinkedUid = '') {
  const select = document.getElementById('modal-staff-linked-user');
  if (!select) return;

  select.innerHTML = `
    <option value="">(未綁定 - 僅於本店本機排班)</option>
    ${allRegisteredUsers.map(u => `
      <option value="${u.uid}" data-email="${u.email}" ${u.uid === currentLinkedUid ? 'selected' : ''}>
        ${u.email} (${u.role === 'admin' ? '管理員' : '員工'})
      </option>
    `).join('')}
  `;
}

// 渲染已註冊使用者名冊（供管理員檢視誰是管理員、誰是員工）
function renderUsersTable() {
  const tbody = document.getElementById('settings-users-tbody');
  const badge = document.getElementById('settings-users-count-badge');
  if (badge) badge.textContent = `共 ${allRegisteredUsers.length} 個帳號`;
  if (!tbody) return;

  if (allRegisteredUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">目前尚無其他註冊使用者</td></tr>`;
    return;
  }

  tbody.innerHTML = allRegisteredUsers.map(u => {
    const isAdmin = u.role === 'admin';
    const isCurrent = currentUser && currentUser.uid === u.uid;
    const dateStr = u.createdAt ? u.createdAt.split('T')[0] : (u.updatedAt ? u.updatedAt.split('T')[0] : '-');

    return `
      <tr class="hover:bg-slate-50 transition text-xs">
        <td class="px-3 py-2.5 font-bold text-slate-800 whitespace-nowrap">
          ${u.email}
          ${isCurrent ? '<span class="ml-1 text-[10px] text-amber-600 font-normal bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">本人</span>' : ''}
        </td>
        <td class="px-3 py-2.5 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}">
            ${isAdmin ? '管理員' : '員工'}
          </span>
        </td>
        <td class="px-3 py-2.5 text-slate-400 whitespace-nowrap">${dateStr}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">
          ${isCurrent ? '<span class="text-[11px] text-slate-400 font-medium">(目前登入中)</span>' : `
            <button onclick="toggleUserRole('${u.uid}', '${isAdmin ? 'staff' : 'admin'}')" class="text-xs px-2.5 py-1 rounded-xl font-bold border transition ${isAdmin ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100'}">
              ${isAdmin ? '降為員工' : '升為管理員'}
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function toggleUserRole(uid, newRole) {
  if (!confirm(`確定要將該帳號身分調整為「${newRole === 'admin' ? '管理員' : '員工'}」嗎？`)) return;
  try {
    await db.collection('salon_users').doc(uid).update({ role: newRole });
    showToast(`已成功將身分更新為 ${newRole === 'admin' ? '管理員' : '員工'}`);
  } catch(e) {
    alert('身分更新失敗：' + e.message);
  }
}

// ==========================================
// Firestore 全店共享沙龍即時同步 (salon_stores/main_store)
// ==========================================
function subscribeToCloudData() {
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
  if (!db) return;

  const storeDocRef = db.collection('salon_stores').doc('main_store');

  unsubscribeFirestore = storeDocRef.onSnapshot(async doc => {
    if (doc.exists) {
      const data = sanitizeOldMockData(doc.data());
      appState.services = data.services || [...DEFAULT_SERVICES];
      appState.staff = data.staff || [];
      appState.orders = data.orders || [];
      salonAdminKey = data.adminSecretKey || DEFAULT_ADMIN_SECRET_KEY;
      const keyDisplay = document.getElementById('settings-current-admin-key');
      if (keyDisplay) keyDisplay.textContent = salonAdminKey;

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
                orders: appState.orders,
                adminSecretKey: salonAdminKey
              }, { merge: true });
            }
          }
        } catch(e) {
          console.warn('檢查舊資料庫遷移失敗:', e);
        }
      }
    } else {
      // 若尚未建立 main_store，檢查現有使用者的舊獨立庫並自動無縫遷移！
      let initialServices = [...DEFAULT_SERVICES];
      let initialStaff = [];
      let initialOrders = [];

      try {
        if (currentUser) {
          const oldDoc = await db.collection('users').doc(currentUser.uid).get();
          if (oldDoc.exists) {
            const oldData = sanitizeOldMockData(oldDoc.data());
            initialServices = oldData.services || initialServices;
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
        orders: appState.orders,
        adminSecretKey: salonAdminKey
      });
    }

    localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));

    updateLinkedStaff();
    applyRolePermissions();
    initHistoryFilters();
    initMonthlyView();
    populateStaffDropdowns();
    initBillingForm();
    filterHistoryOrders();
    calculateMonthlyPayroll();
    renderSettingsTables();
    checkStaffEmptyState();
  }, err => {
    console.error('Firestore 共享沙龍即時同步錯誤:', err);
  });
}

async function syncDataToCloud() {
  localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));

  if (currentUser && db) {
    try {
      const storeDocRef = db.collection('salon_stores').doc('main_store');
      if (currentUserRole === 'admin') {
        // 管理員：同步整間沙龍資料
        await storeDocRef.set({
          services: appState.services,
          staff: appState.staff,
          orders: appState.orders,
          adminSecretKey: salonAdminKey
        });
      } else {
        // 員工：僅同步客單明細（不可覆蓋服務設定與人員名單）
        await storeDocRef.update({
          orders: appState.orders
        });
      }
    } catch (err) {
      console.error('上傳雲端失敗:', err);
      showToast('⚠️ 離線暫存中，恢復網路後將自動同步雲端');
    }
  }
}

async function changeAdminSecretKey() {
  if (currentUserRole !== 'admin') return;
  const newKey = prompt('請輸入新的沙龍管理員註冊密鑰（建議 6 碼以上）：', salonAdminKey);
  if (newKey && newKey.trim().length >= 4) {
    salonAdminKey = newKey.trim();
    const keyDisplay = document.getElementById('settings-current-admin-key');
    if (keyDisplay) keyDisplay.textContent = salonAdminKey;
    await syncDataToCloud();
    showToast('管理員註冊授權密鑰已更新！');
  }
}

// ==========================================
// 雲端金鑰貼上設定視窗
// ==========================================
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

// 檢查是否尚無人員，顯示提示引導
function checkStaffEmptyState() {
  const emptyAlert = document.getElementById('billing-empty-staff-alert');
  if (emptyAlert) {
    if (appState.staff.length === 0) {
      emptyAlert.classList.remove('hidden');
    } else {
      emptyAlert.classList.add('hidden');
    }
  }
}

// 渲染所有設計師/助理下拉選單
function populateStaffDropdowns() {
  const billingStaff = document.getElementById('billing-staff-select');
  const billingAssistant = document.getElementById('billing-assistant-select');
  const historyStaff = document.getElementById('history-filter-staff');
  const monthlyStaff = document.getElementById('monthly-select-staff');

  updateLinkedStaff();

  if (billingStaff) {
    if (appState.staff.length === 0) {
      billingStaff.innerHTML = `<option value="">⚠️ 尚未新增人員 (點此新增)</option>`;
      billingStaff.onchange = function() {
        if (this.value === '') openStaffModal();
      };
    } else {
      billingStaff.onchange = null;
      billingStaff.innerHTML = appState.staff.map(s => `
        <option value="${s.id}" ${currentLinkedStaff && currentLinkedStaff.id === s.id ? 'selected' : ''}>
          ${s.name} (${s.role})
        </option>
      `).join('');

      if (currentLinkedStaff) {
        billingStaff.value = currentLinkedStaff.id;
      }
    }
  }

  if (billingAssistant) {
    billingAssistant.innerHTML = `
      <option value="">無助理協助（全由設計師操作）</option>
      ${appState.staff.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('')}
    `;
  }

  if (historyStaff) {
    if (currentUserRole === 'staff' && currentLinkedStaff) {
      historyStaff.innerHTML = `
        <option value="${currentLinkedStaff.id}">${currentLinkedStaff.name} (本人客單)</option>
      `;
      historyStaff.disabled = true;
    } else {
      historyStaff.disabled = false;
      historyStaff.innerHTML = `
        <option value="ALL">全部人員</option>
        ${appState.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      `;
    }
  }

  if (monthlyStaff) {
    if (appState.staff.length === 0) {
      monthlyStaff.innerHTML = `<option value="">尚無人員資料</option>`;
    } else if (currentUserRole === 'staff' && currentLinkedStaff) {
      monthlyStaff.innerHTML = `
        <option value="${currentLinkedStaff.id}">${currentLinkedStaff.name} (本人)</option>
      `;
      monthlyStaff.disabled = true;
    } else {
      monthlyStaff.disabled = false;
      monthlyStaff.innerHTML = appState.staff.map(s => `
        <option value="${s.id}">${s.name} (${s.role})</option>
      `).join('');
    }
  }

  checkStaffEmptyState();
}

// ==========================================
// 分頁切換 (同步手機 Dock 與桌面 Tab)
// ==========================================
function switchTab(tabName) {
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

  lucide.createIcons();
}

// ==========================================
// 現場開單抽成試算 (Billing & Commission)
// ==========================================
function initBillingForm() {
  generateNewOrderNo();
  currentBillingRows = [];
  addServiceRow();
}

function generateNewOrderNo() {
  const dateVal = document.getElementById('billing-date')?.value || new Date().toISOString().split('T')[0];
  const compactDate = dateVal.replace(/-/g, '');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const orderNoEl = document.getElementById('billing-order-no');
  if (orderNoEl) {
    orderNoEl.textContent = `單號：T-${compactDate}-${randomSuffix}`;
  }
}

// 取得折數標籤文字 (例如: 0.85 -> 85 折, 0.8 -> 8 折, 1.0 -> 原價)
function getDiscountLabel(discount) {
  if (!discount || discount >= 1.0) return '原價 (無折扣)';
  const pct = Math.round(discount * 100);
  if (pct % 10 === 0) {
    return `${pct / 10} 折`;
  } else {
    return `${pct} 折`;
  }
}

// 新增一列服務項目
function addServiceRow(presetServiceId = '') {
  const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const defaultService = presetServiceId 
    ? appState.services.find(s => s.id === presetServiceId) 
    : appState.services[0];

  const newRow = {
    rowId: rowId,
    serviceId: defaultService ? defaultService.id : '',
    price: defaultService ? defaultService.price : 0,
    rate: defaultService ? defaultService.rate : 50,
    qty: 1,
    discount: 1.0, // 折扣率 (1.0 = 原價, 0.85 = 85折, 0.8 = 8折)
    discountCommission: true // 抽成是否也打折 (預設 true: 依折後實收金額抽成; false: 依原價抽成)
  };

  currentBillingRows.push(newRow);
  renderBillingRows();
}

// 刪除一列服務
function removeServiceRow(rowId) {
  if (currentBillingRows.length <= 1) {
    showToast('每單至少需保留一項服務項目');
    return;
  }
  currentBillingRows = currentBillingRows.filter(r => r.rowId !== rowId);
  renderBillingRows();
}

// 下拉選單選中服務項目時，自動帶入價格與抽成！
function onServiceSelectChange(rowId, selectedServiceId) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;

  const srv = appState.services.find(s => s.id === selectedServiceId);
  if (srv) {
    row.serviceId = srv.id;
    row.price = srv.price;
    row.rate = srv.rate;
  }
  renderBillingRows();
}

// 價格、抽成趴數、數量手動輸入變更時
function onRowInputChange(rowId, field, value) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;

  const numVal = parseFloat(value) || 0;
  if (field === 'price') row.price = Math.max(0, numVal);
  if (field === 'rate') row.rate = Math.max(0, Math.min(100, numVal));
  if (field === 'qty') row.qty = Math.max(1, Math.floor(numVal));

  updateRowCalculations();
}

// 折扣選單變更
function onRowDiscountSelect(rowId, val) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;

  if (val === 'custom') {
    const input = prompt('請輸入自訂折數（例如輸入 85 或 8.5 表示 85折，輸入 8 或 80 表示 8折，輸入 75 表示 75折）：', '85');
    if (input !== null) {
      let num = parseFloat(input.trim());
      if (!isNaN(num) && num > 0) {
        if (num >= 10) num = num / 100;
        else if (num > 1) num = num / 10;
        row.discount = Math.min(1.0, Math.max(0.01, num));
      }
    }
  } else {
    row.discount = parseFloat(val) || 1.0;
  }
  renderBillingRows();
}

// 抽成是否也打折 Checkbox 變更
function onRowDiscountCommChange(rowId, checked) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;
  row.discountCommission = checked;
  renderBillingRows();
}

// 重新繪製開單項目清單 (支援折扣選單與抽成打折勾選)
function renderBillingRows() {
  const container = document.getElementById('service-rows-container');
  if (!container) return;

  const discountOptions = [
    { val: 1.0, label: '原價 (無折扣)' },
    { val: 0.95, label: '95 折 (x0.95)' },
    { val: 0.90, label: '9 折 (x0.9)' },
    { val: 0.88, label: '88 折 (x0.88)' },
    { val: 0.85, label: '85 折 (x0.85)' },
    { val: 0.80, label: '8 折 (x0.8)' },
    { val: 0.75, label: '75 折 (x0.75)' },
    { val: 0.70, label: '7 折 (x0.7)' },
    { val: 0.60, label: '6 折 (x0.6)' },
    { val: 0.50, label: '5 折 (半價)' }
  ];

  const isStaff = currentUserRole === 'staff';

  container.innerHTML = currentBillingRows.map((row, index) => {
    const originalTotal = row.price * row.qty;
    const discount = row.discount || 1.0;
    const finalAmount = Math.round(originalTotal * discount);
    const isCommDiscounted = row.discountCommission !== false;
    // 核心計算：若勾選「抽成也打折」，抽成基數為折後實收 finalAmount；否則為原價 originalTotal
    const commBase = isCommDiscounted ? finalAmount : originalTotal;
    const itemCommission = Math.round(commBase * (row.rate / 100));

    const isPredefined = discountOptions.some(opt => Math.abs(opt.val - discount) < 0.001);

    return `
      <div id="${row.rowId}" class="service-row-item p-3.5 sm:p-4 bg-slate-50/95 hover:bg-slate-50 border border-slate-200/90 rounded-2xl transition space-y-2.5 shadow-sm">
        
        <!-- 頂部：序號、下拉選單與刪除按鈕 -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
              ${index + 1}
            </span>
            <div class="flex-1 min-w-0">
              <label class="block text-[11px] font-bold text-slate-500 mb-0.5">
                ${isStaff ? '選擇服務項目' : '選擇服務項目 (下拉即帶出金額與抽成)'}
              </label>
              <select onchange="onServiceSelectChange('${row.rowId}', this.value)" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                ${appState.services.map(s => {
                  const sLabel = isStaff ? `${s.name} [定價$${s.price}]` : `${s.name} [定價$${s.price} | 抽${s.rate}%]`;
                  return `<option value="${s.id}" ${s.id === row.serviceId ? 'selected' : ''}>${sLabel}</option>`;
                }).join('')}
              </select>
            </div>
          </div>

          <button type="button" onclick="removeServiceRow('${row.rowId}')" class="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition shrink-0" title="刪除項目">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- 數值調整：單價、數量、抽成%、折扣選單 -->
        <div class="grid grid-cols-2 ${isStaff ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} gap-2 pt-2 border-t border-slate-200/70">
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">單價 ($)</label>
            <input type="number" value="${row.price}" oninput="onRowInputChange('${row.rowId}', 'price', this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-numeric bg-white font-bold text-slate-900 focus:ring-1 focus:ring-amber-500">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">數量</label>
            <input type="number" min="1" value="${row.qty}" oninput="onRowInputChange('${row.rowId}', 'qty', this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-numeric bg-white focus:ring-1 focus:ring-amber-500">
          </div>

          <div class="admin-only-block">
            <label class="block text-[11px] font-semibold text-amber-800 mb-0.5">抽成 (%)</label>
            <div class="relative">
              <input type="number" min="0" max="100" value="${row.rate}" oninput="onRowInputChange('${row.rowId}', 'rate', this.value)" class="w-full rounded-xl border border-amber-300 bg-amber-50/60 px-3 py-1.5 text-sm font-numeric font-extrabold text-amber-900 focus:ring-1 focus:ring-amber-500 pr-6">
              <span class="absolute right-2 top-2 text-xs text-amber-700 font-bold">%</span>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-rose-700 mb-0.5">折扣優惠 (折數)</label>
            <select onchange="onRowDiscountSelect('${row.rowId}', this.value)" class="w-full rounded-xl border border-rose-300 bg-rose-50/40 px-2.5 py-1.5 text-sm font-bold text-rose-900 focus:ring-1 focus:ring-rose-500">
              ${discountOptions.map(opt => `
                <option value="${opt.val}" ${Math.abs(opt.val - discount) < 0.001 ? 'selected' : ''}>
                  ${opt.label}
                </option>
              `).join('')}
              <option value="custom" ${!isPredefined ? 'selected' : ''}>
                ✍️ 自訂 (${getDiscountLabel(discount)})
              </option>
            </select>
          </div>
        </div>

        <!-- 折扣連動設定 (Checkbox) + 實收與抽成即時小計 -->
        <div class="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label class="admin-only-inline inline-flex items-center gap-2 cursor-pointer text-xs font-bold py-1.5 px-3 rounded-xl border transition select-none ${discount < 1.0 ? (isCommDiscounted ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-blue-50 border-blue-200 text-blue-900') : 'bg-slate-100/70 border-slate-200 text-slate-500'}">
            <input type="checkbox" onchange="onRowDiscountCommChange('${row.rowId}', this.checked)" ${isCommDiscounted ? 'checked' : ''} class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600">
            <span>抽成也打折</span>
            <span class="text-[10px] font-normal opacity-90">
              ${discount < 1.0 ? (isCommDiscounted ? '(依折後實收抽成)' : '(依原價抽成，店家吸收)') : ''}
            </span>
          </label>

          <div class="flex items-center justify-between sm:justify-end gap-3 text-xs w-full sm:w-auto">
            <div>
              <span class="text-slate-500 text-[11px]">實收金額:</span>
              <strong class="text-slate-900 font-numeric text-sm font-bold">NT$ ${finalAmount.toLocaleString()}</strong>
              ${discount < 1.0 ? `<span class="text-[10px] text-slate-400 line-through ml-0.5">($${originalTotal.toLocaleString()})</span>` : ''}
            </div>
            <div class="admin-only-block bg-amber-100/80 px-2.5 py-1 rounded-xl border border-amber-200 text-right">
              <span class="text-[10px] text-amber-800 font-medium">這項抽成:</span>
              <strong class="text-amber-950 font-numeric font-black text-sm">NT$ ${itemCommission.toLocaleString()}</strong>
            </div>
          </div>
        </div>

      </div>
    `;
  }).join('');

  lucide.createIcons();
  updateRowCalculations();
}

// 更新結算卡片總數值
function updateRowCalculations() {
  let totalAmount = 0;
  let totalCommission = 0;
  let totalItemsCount = 0;

  currentBillingRows.forEach(row => {
    const originalTotal = row.price * row.qty;
    const discount = row.discount || 1.0;
    const finalAmount = Math.round(originalTotal * discount);
    const isCommDiscounted = row.discountCommission !== false;
    const commBase = isCommDiscounted ? finalAmount : originalTotal;
    const itemComm = Math.round(commBase * (row.rate / 100));

    totalAmount += finalAmount;
    totalCommission += itemComm;
    totalItemsCount += row.qty;
  });

  const assistantId = document.getElementById('billing-assistant-select')?.value;
  let assistantComm = 0;
  const assistantRow = document.getElementById('summary-assistant-row');
  
  if (assistantId) {
    assistantComm = Math.round(totalAmount * 0.05);
    if (assistantRow) assistantRow.classList.remove('hidden');
  } else {
    if (assistantRow) assistantRow.classList.add('hidden');
  }

  const salonNet = Math.max(0, totalAmount - totalCommission - assistantComm);
  const avgRate = totalAmount > 0 ? ((totalCommission / totalAmount) * 100).toFixed(1) : 0;

  // 更新介面金額
  const commEls = document.querySelectorAll('.summary-commission-display');
  commEls.forEach(el => el.textContent = totalCommission.toLocaleString());

  const staffTotalEl = document.getElementById('summary-card-staff-total');
  if (staffTotalEl) staffTotalEl.textContent = totalAmount.toLocaleString();

  const rateEl = document.getElementById('summary-card-rate-text');
  if (rateEl) rateEl.textContent = `平均抽成率：${avgRate}%`;

  const countEl = document.getElementById('summary-card-items-count');
  if (countEl) countEl.textContent = `${totalItemsCount} 項服務`;

  const totEl = document.getElementById('summary-card-total-amount');
  if (totEl) totEl.textContent = totalAmount.toLocaleString();

  const asstEl = document.getElementById('summary-card-assistant-comm');
  if (asstEl) asstEl.textContent = assistantComm.toLocaleString();

  const netEl = document.getElementById('summary-card-salon-net');
  if (netEl) netEl.textContent = salonNet.toLocaleString();
}

document.getElementById('billing-assistant-select')?.addEventListener('change', updateRowCalculations);

// 儲存當前單據並同步雲端
async function saveCurrentOrder() {
  if (appState.staff.length === 0) {
    alert('系統中尚無人員！請先點擊上方提示或前往「設定」新增第一位設計師！');
    openStaffModal();
    return;
  }

  if (currentBillingRows.length === 0) {
    alert('請至少新增一項服務項目！');
    return;
  }

  const staffId = document.getElementById('billing-staff-select').value;
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff) {
    alert('請選擇主作設計師！');
    return;
  }

  const dateVal = document.getElementById('billing-date').value || new Date().toISOString().split('T')[0];
  const customer = document.getElementById('billing-customer').value.trim() || '現場顧客';
  const notes = document.getElementById('billing-notes').value.trim();
  const assistantId = document.getElementById('billing-assistant-select').value;
  const assistant = appState.staff.find(s => s.id === assistantId);

  const itemsDetail = currentBillingRows.map(r => {
    const srv = appState.services.find(s => s.id === r.serviceId);
    const name = srv ? srv.name : '自訂美髮項目';
    const originalTotal = r.price * r.qty;
    const discount = r.discount || 1.0;
    const finalAmount = Math.round(originalTotal * discount);
    const isCommDiscounted = r.discountCommission !== false;
    const commBase = isCommDiscounted ? finalAmount : originalTotal;
    const commission = Math.round(commBase * (r.rate / 100));

    return {
      serviceId: r.serviceId,
      name: name,
      price: r.price,
      rate: r.rate,
      qty: r.qty,
      discount: discount,
      discountCommission: isCommDiscounted,
      originalTotal: originalTotal,
      amount: finalAmount, // 顧客實付金額
      commission: commission // 設計師應得抽成
    };
  });

  let totalAmount = 0;
  let totalCommission = 0;
  itemsDetail.forEach(item => {
    totalAmount += item.amount;
    totalCommission += item.commission;
  });

  const assistantComm = assistantId ? Math.round(totalAmount * 0.05) : 0;
  const salonNet = Math.max(0, totalAmount - totalCommission - assistantComm);
  const rawOrderNo = document.getElementById('billing-order-no').textContent.replace('單號：', '').trim();

  const newOrder = {
    id: 'ord-' + Date.now(),
    orderNo: rawOrderNo,
    date: dateVal,
    staffId: staff.id,
    staffName: staff.name,
    assistantId: assistant ? assistant.id : '',
    assistantName: assistant ? assistant.name : '',
    customer: customer,
    notes: notes,
    items: itemsDetail,
    totalAmount: totalAmount,
    totalCommission: totalCommission,
    assistantCommission: assistantComm,
    salonNet: salonNet,
    createdAt: new Date().toISOString()
  };

  appState.orders.unshift(newOrder);
  await syncDataToCloud();

  showToast(`開單成功！業績 NT$ ${totalAmount.toLocaleString()}，抽成 NT$ ${totalCommission.toLocaleString()}`);
  resetBillingForm();
}

function resetBillingForm() {
  document.getElementById('billing-customer').value = '';
  document.getElementById('billing-notes').value = '';
  document.getElementById('billing-assistant-select').value = '';
  generateNewOrderNo();
  currentBillingRows = [];
  addServiceRow();
}

// ==========================================
// 歷史帳單與每日流水 (History Tab - 手機卡片式優化)
// ==========================================
function initHistoryFilters() {
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentYearMonth();
  }
}

function clearHistoryFilters() {
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput) monthInput.value = getCurrentYearMonth();
  document.getElementById('history-filter-staff').value = 'ALL';
  document.getElementById('history-filter-search').value = '';
  filterHistoryOrders();
}

function filterHistoryOrders() {
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentYearMonth();
  }
  const monthVal = monthInput?.value || getCurrentYearMonth();
  const staffVal = document.getElementById('history-filter-staff')?.value;
  const searchVal = document.getElementById('history-filter-search')?.value.trim().toLowerCase();

  let effectiveStaffId = staffVal;
  if (currentUserRole === 'staff' && currentLinkedStaff) {
    effectiveStaffId = currentLinkedStaff.id;
  }

  const filtered = appState.orders.filter(order => {
    if (monthVal && !order.date.startsWith(monthVal)) return false;
    if (effectiveStaffId && effectiveStaffId !== 'ALL' && order.staffId !== effectiveStaffId && order.assistantId !== effectiveStaffId) return false;
    if (searchVal) {
      const matchCustomer = order.customer.toLowerCase().includes(searchVal);
      const matchNotes = order.notes && order.notes.toLowerCase().includes(searchVal);
      const matchNo = order.orderNo.toLowerCase().includes(searchVal);
      const matchItems = order.items.some(it => it.name.toLowerCase().includes(searchVal));
      if (!matchCustomer && !matchNotes && !matchNo && !matchItems) return false;
    }
    return true;
  });

  renderHistoryView(filtered);
}

function renderHistoryView(ordersList) {
  const tbody = document.getElementById('history-table-body');
  const cardsContainer = document.getElementById('history-cards-mobile');
  const emptyHint = document.getElementById('history-empty-hint');
  const countEl = document.getElementById('history-count');
  const totalRevEl = document.getElementById('history-total-revenue');
  const totalCommEl = document.getElementById('history-total-commission');

  let sumRev = 0;
  let sumComm = 0;

  ordersList.forEach(o => {
    sumRev += o.totalAmount;
    sumComm += o.totalCommission;
  });

  if (countEl) countEl.textContent = ordersList.length;
  if (totalRevEl) totalRevEl.textContent = `NT$ ${sumRev.toLocaleString()}`;
  if (totalCommEl) totalCommEl.textContent = `NT$ ${sumComm.toLocaleString()}`;

  if (ordersList.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (emptyHint) emptyHint.classList.remove('hidden');
    return;
  }

  if (emptyHint) emptyHint.classList.add('hidden');

  // 手機專屬卡片流
  if (cardsContainer) {
    cardsContainer.innerHTML = ordersList.map(order => `
      <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900 text-sm">${order.customer}</span>
            <span class="text-xs bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full">${order.staffName}</span>
          </div>
          <button onclick="deleteOrder('${order.id}')" class="text-slate-400 hover:text-rose-600 p-1">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="text-xs text-slate-600 flex flex-wrap gap-1">
          ${order.items.map(it => {
            const discTag = it.discount && it.discount < 1.0 ? ` <span class="text-rose-600 font-bold">[${getDiscountLabel(it.discount)}]</span>` : '';
            return `<span class="bg-slate-100 px-2 py-0.5 rounded">${it.name} (x${it.qty})${discTag}</span>`;
          }).join('')}
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-slate-400 font-mono">${order.date}</span>
          <div class="flex items-center gap-3">
            <span class="text-slate-600">實收: <strong>NT$ ${order.totalAmount.toLocaleString()}</strong></span>
            <span class="admin-only-inline text-amber-700 font-bold text-sm font-numeric">抽: NT$ ${order.totalCommission.toLocaleString()}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 電腦端表格
  if (tbody) {
    tbody.innerHTML = ordersList.map(order => `
      <tr class="hover:bg-slate-50/80 transition text-xs">
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="font-mono font-semibold text-slate-800">${order.orderNo}</div>
          <div class="text-slate-400">${order.date}</div>
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="font-medium text-slate-900">${order.staffName}</div>
          ${order.assistantName ? `<div class="text-[11px] text-blue-600">助：${order.assistantName}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <div class="font-semibold text-slate-800">${order.customer}</div>
          ${order.notes ? `<div class="text-[11px] text-slate-400 line-clamp-1">${order.notes}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <div>${order.items.map(i => {
            const discTag = i.discount && i.discount < 1.0 ? ` <span class="text-rose-600 font-semibold">[${getDiscountLabel(i.discount)}]</span>` : '';
            return `${i.name} (x${i.qty})${discTag}`;
          }).join('、')}</div>
        </td>
        <td class="px-4 py-3 text-right font-numeric font-bold text-slate-800">NT$ ${order.totalAmount.toLocaleString()}</td>
        <td class="admin-only-cell px-4 py-3 text-right font-numeric font-extrabold text-amber-700">NT$ ${order.totalCommission.toLocaleString()}</td>
        <td class="px-4 py-3 text-center">
          <button onclick="deleteOrder('${order.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  lucide.createIcons();
}

async function deleteOrder(orderId) {
  if (!confirm('確定要刪除這筆客單嗎？（將同步從雲端刪除）')) return;
  appState.orders = appState.orders.filter(o => o.id !== orderId);
  await syncDataToCloud();
  filterHistoryOrders();
  showToast('客單已從雲端刪除');
}

function exportHistoryToExcel() {
  const monthVal = document.getElementById('history-filter-month')?.value || '全部月份';
  const staffVal = document.getElementById('history-filter-staff')?.value;
  
  const filtered = appState.orders.filter(order => {
    if (monthVal && monthVal !== '全部月份' && !order.date.startsWith(monthVal)) return false;
    if (staffVal && staffVal !== 'ALL' && order.staffId !== staffVal) return false;
    return true;
  });

  if (filtered.length === 0) {
    alert('目前篩選條件下無任何客單可匯出！');
    return;
  }

  const exportData = [];
  filtered.forEach(o => {
    o.items.forEach(it => {
      exportData.push({
        '服務日期': o.date,
        '帳單編號': o.orderNo,
        '主作設計師': o.staffName,
        '協助助理': o.assistantName || '無',
        '顧客稱呼': o.customer,
        '消費服務項目': it.name,
        '原價定價': it.price,
        '數量': it.qty,
        '原價合計': it.originalTotal || (it.price * it.qty),
        '折扣優惠': getDiscountLabel(it.discount || 1.0),
        '實收金額': it.amount,
        '抽成比例(%)': it.rate + '%',
        '抽成是否打折': it.discountCommission !== false ? '是 (依實收)' : '否 (依原價)',
        '該項抽成金額': it.commission,
        '整單總收費': o.totalAmount,
        '整單總抽成': o.totalCommission,
        '備註': o.notes || ''
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '帳單流水明細');
  XLSX.writeFile(wb, `沙龍客單流水報表_${monthVal}.xlsx`);
  showToast('Excel 流水報表已成功下載！');
}

// ==========================================
// 月薪結算與月報表
// ==========================================
function initMonthlyView() {
  const monthInput = document.getElementById('monthly-select-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentYearMonth();
  }
}

function calculateMonthlyPayroll() {
  const monthInput = document.getElementById('monthly-select-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentYearMonth();
  }
  const monthVal = monthInput?.value || getCurrentYearMonth();
  
  let staffId = document.getElementById('monthly-select-staff')?.value;
  if (currentUserRole === 'staff' && currentLinkedStaff) {
    staffId = currentLinkedStaff.id;
  }
  if (!staffId) return;

  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff) return;

  const monthlyOrders = appState.orders.filter(order => {
    return order.date.startsWith(monthVal) && (order.staffId === staffId || order.assistantId === staffId);
  });

  let totalClients = monthlyOrders.length;
  let totalRevenue = 0;
  let totalCommission = 0;

  monthlyOrders.forEach(o => {
    if (o.staffId === staffId) {
      totalRevenue += o.totalAmount;
      totalCommission += o.totalCommission;
    } else if (o.assistantId === staffId) {
      totalRevenue += o.totalAmount;
      totalCommission += o.assistantCommission;
    }
  });

  const avgTicket = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0;

  document.getElementById('stat-month-clients').textContent = totalClients;
  document.getElementById('stat-month-avg-ticket').textContent = avgTicket.toLocaleString();
  document.getElementById('stat-month-revenue').textContent = totalRevenue.toLocaleString();
  document.getElementById('stat-month-commission').textContent = totalCommission.toLocaleString();

  const commissionInput = document.getElementById('calc-commission');
  if (commissionInput) commissionInput.value = totalCommission;

  updateCalculatedNetPay();
  renderMonthlyOrdersTable(monthlyOrders, staffId);
}

function updateCalculatedNetPay() {
  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;

  const netPay = Math.round(commission + otherBonus);

  const netPayStat = document.getElementById('stat-month-net-pay');
  if (netPayStat) netPayStat.textContent = netPay.toLocaleString();
  const summaryNet = document.getElementById('calc-summary-net');
  if (summaryNet) summaryNet.textContent = netPay.toLocaleString();
}

function renderMonthlyOrdersTable(monthlyOrders, currentStaffId) {
  const tbody = document.getElementById('monthly-table-body');
  const badge = document.getElementById('monthly-orders-count-badge');
  if (badge) badge.textContent = `共 ${monthlyOrders.length} 筆客單`;

  if (!tbody) return;

  if (monthlyOrders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-400">
          該月份尚無服務客單紀錄
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = monthlyOrders.map(order => {
    const isMain = order.staffId === currentStaffId;
    const earnedComm = isMain ? order.totalCommission : order.assistantCommission;
    const roleTag = isMain ? '' : '<span class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">助理獎勵</span>';
    const itemsText = order.items.map(it => {
      const discTag = it.discount && it.discount < 1.0 ? ` [${getDiscountLabel(it.discount)}]` : '';
      if (currentUserRole === 'staff') {
        return `${it.name}${discTag} (x${it.qty})`;
      } else {
        return `${it.name}${discTag} ($${it.price}, 抽${it.rate}%)`;
      }
    }).join('、');

    return `
      <tr class="hover:bg-slate-50 transition text-xs">
        <td class="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800">${order.date}</td>
        <td class="px-3 py-2.5 whitespace-nowrap font-mono text-slate-500">${order.orderNo}</td>
        <td class="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-900">${order.customer}</td>
        <td class="px-3 py-2.5">
          <div class="max-w-xs truncate text-slate-600" title="${itemsText}">${itemsText}</div>
        </td>
        <td class="px-3 py-2.5 text-right font-numeric font-bold text-slate-800 whitespace-nowrap">NT$ ${order.totalAmount.toLocaleString()}</td>
        <td class="admin-only-cell px-3 py-2.5 text-right font-numeric font-extrabold text-amber-700 whitespace-nowrap">
          NT$ ${earnedComm.toLocaleString()} ${roleTag}
        </td>
        <td class="px-3 py-2.5 text-slate-400 whitespace-nowrap">${order.notes || '-'}</td>
      </tr>
    `;
  }).join('');
}

function exportMonthlyReportExcel() {
  const monthVal = document.getElementById('monthly-select-month')?.value;
  let staffId = document.getElementById('monthly-select-staff')?.value;
  if (currentUserRole === 'staff' && currentLinkedStaff) {
    staffId = currentLinkedStaff.id;
  }
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff || !monthVal) return;

  const monthlyOrders = appState.orders.filter(order => {
    return order.date.startsWith(monthVal) && (order.staffId === staffId || order.assistantId === staffId);
  });

  const wb = XLSX.utils.book_new();

  // 若為員工，匯出個人專屬工作實績清單 (無敏感抽成與底薪)
  if (currentUserRole === 'staff') {
    let totalRev = 0;
    const detailData = [];
    monthlyOrders.forEach(o => {
      const isMain = o.staffId === staffId;
      totalRev += o.totalAmount;
      o.items.forEach(it => {
        detailData.push({
          '服務日期': o.date,
          '帳單編號': o.orderNo,
          '顧客姓名': o.customer,
          '消費服務項目': it.name,
          '數量': it.qty,
          '定價單價': it.price,
          '折扣優惠': getDiscountLabel(it.discount || 1.0),
          '實收金額': it.amount,
          '擔任角色': isMain ? '主作設計師' : '協助助理',
          '備註': o.notes || ''
        });
      });
    });

    const summarySheetData = [
      { '項目': '明細月份', '內容': monthVal },
      { '項目': '員工姓名', '內容': staff.name },
      { '項目': '職務身分', '內容': staff.role },
      { '項目': '本月完成服務客數', '內容': `${monthlyOrders.length} 人次` },
      { '項目': '本月個人營業額總額', '內容': `NT$ ${totalRev.toLocaleString()}` }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, '工作成果摘要');

    const wsDetail = XLSX.utils.json_to_sheet(detailData.length > 0 ? detailData : [{ '提示': '當月尚無客單資料' }]);
    XLSX.utils.book_append_sheet(wb, wsDetail, '當月客單明細');

    XLSX.writeFile(wb, `美髮沙龍個人當月工作明細_${staff.name}_${monthVal}.xlsx`);
    showToast(`已匯出 ${staff.name} 的 ${monthVal} 工作明細 Excel！`);
    return;
  }

  // 管理員：完整月薪資結算總表與客單抽成明細
  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;
  const netPay = Math.round(commission + otherBonus);

  const summarySheetData = [
    { '項目': '結算月份', '內容/金額': monthVal },
    { '項目': '員工姓名', '內容/金額': staff.name },
    { '項目': '職務身分', '內容/金額': staff.role },
    { '項目': '完成服務客數', '內容/金額': `${monthlyOrders.length} 人次` },
    { '項目': '----------------', '內容/金額': '----------------' },
    { '項目': '【(+) 業績抽成總額】', '內容/金額': commission },
    { '項目': '【(+) 其他獎金/補貼】', '內容/金額': otherBonus },
    { '項目': '================', '內容/金額': '================' },
    { '項目': '【★ 實發薪資合計】', '內容/金額': netPay },
  ];
  const ws1 = XLSX.utils.json_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(wb, ws1, '月薪資結算總表');

  const detailData = [];
  monthlyOrders.forEach(o => {
    const isMain = o.staffId === staffId;
    o.items.forEach(it => {
      detailData.push({
        '服務日期': o.date,
        '帳單號': o.orderNo,
        '顧客姓名': o.customer,
        '消費服務項目': it.name,
        '定價單價': it.price,
        '數量': it.qty,
        '原價合計': it.originalTotal || (it.price * it.qty),
        '折扣優惠': getDiscountLabel(it.discount || 1.0),
        '實收金額': it.amount,
        '項目抽成率': it.rate + '%',
        '抽成是否打折': it.discountCommission !== false ? '是 (依實收)' : '否 (依原價)',
        '本單設計師抽成': isMain ? it.commission : o.assistantCommission,
        '擔任角色': isMain ? '主作設計師' : '協助助理',
        '備註': o.notes || ''
      });
    });
  });

  const ws2 = XLSX.utils.json_to_sheet(detailData.length > 0 ? detailData : [{ '提示': '當月尚無客單資料' }]);
  XLSX.utils.book_append_sheet(wb, ws2, '當月客單明細');

  XLSX.writeFile(wb, `美髮沙龍薪資月報表_${staff.name}_${monthVal}.xlsx`);
  showToast(`已匯出 ${staff.name} 的 ${monthVal} Excel 月報表！`);
}

function printSalarySlip() {
  if (currentUserRole === 'staff') {
    alert('員工身分無列印薪資單權限！');
    return;
  }
  const monthVal = document.getElementById('monthly-select-month')?.value;
  const staffId = document.getElementById('monthly-select-staff')?.value;
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff || !monthVal) return;

  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;
  const netPay = Math.round(commission + otherBonus);

  const monthlyOrders = appState.orders.filter(order => {
    return order.date.startsWith(monthVal) && (order.staffId === staffId || order.assistantId === staffId);
  });

  let totalRev = 0;
  monthlyOrders.forEach(o => {
    if (o.staffId === staffId) totalRev += o.totalAmount;
  });

  const printContainer = document.getElementById('printable-slip');
  if (!printContainer) return;

  const [year, month] = monthVal.split('-');

  printContainer.innerHTML = `
    <div style="font-family: 'Noto Sans TC', sans-serif; max-width: 800px; margin: 0 auto; color: #111;">
      <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px;">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0;">SALON 美髮沙龍 員工薪資結算明細單</h1>
        <p style="font-size: 14px; color: #555; margin: 4px 0 0 0;">結算月份：${year} 年 ${month} 月度 ‧ 列印日期：${new Date().toLocaleDateString('zh-TW')}</p>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px;">
        <div><strong>員工姓名：</strong> ${staff.name}</div>
        <div><strong>職務角色：</strong> ${staff.role}</div>
        <div><strong>全月服務客數：</strong> ${monthlyOrders.length} 人次</div>
        <div><strong>全月技術/商品總業績：</strong> NT$ ${totalRev.toLocaleString()}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #e2e8f0;">
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">薪資結算項目</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">金額 (NT$)</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">說明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>技術服務與產品業績抽成</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #b45309;">$ ${commission.toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; color: #64748b;">當月各項客單累計之抽成實額</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">其他獎金 / 補貼加給</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">$ ${otherBonus.toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; color: #64748b;">主管調整之額外績效或獎金</td>
          </tr>
          <tr style="background: #fef3c7; font-size: 15px; font-weight: bold;">
            <td style="border: 1px solid #cbd5e1; padding: 10px;">★ 本月實發薪資合計</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: #b45309;">
              NT$ ${netPay.toLocaleString()}
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; color: #b45309;">業績抽成 + 其他獎金</td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">服務客單抽成摘錄表 (共 ${monthlyOrders.length} 筆)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 5px;">日期</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px;">單號</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px;">顧客</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px;">服務項目</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: right;">客單總額</th>
            <th style="border: 1px solid #cbd5e1; padding: 5px; text-align: right;">抽成收入</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyOrders.map(o => `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${o.date}</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${o.orderNo}</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${o.customer}</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px;">${o.items.map(i => `${i.name}`).join('、')}</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right;">$${o.totalAmount.toLocaleString()}</td>
              <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; font-weight: bold;">$${(o.staffId === staffId ? o.totalCommission : o.assistantCommission).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #94a3b8;">
        <div>店長 / 負責人覆核簽名：___________________</div>
        <div>員工本人核對簽收：___________________</div>
      </div>
    </div>
  `;

  window.print();
}

// ==========================================
// 設定頁面：服務項目與人員管理
// ==========================================
function renderSettingsTables() {
  const srvTbody = document.getElementById('settings-services-tbody');
  if (srvTbody) {
    srvTbody.innerHTML = appState.services.map(s => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-3 py-2.5 font-medium text-slate-800">
          ${s.name}
          <span class="block text-[10px] text-slate-400">${s.category || '技術服務'}</span>
        </td>
        <td class="px-3 py-2.5 text-right font-numeric font-bold text-slate-700">NT$ ${s.price.toLocaleString()}</td>
        <td class="px-3 py-2.5 text-right font-numeric font-bold text-amber-700">${s.rate}%</td>
        <td class="px-3 py-2.5 text-center space-x-1 whitespace-nowrap">
          <button onclick="editServiceItem('${s.id}')" class="text-xs text-amber-600 hover:text-amber-800 font-semibold p-1">編輯</button>
          <button onclick="deleteServiceItem('${s.id}')" class="text-xs text-rose-500 hover:text-rose-700 p-1">刪除</button>
        </td>
      </tr>
    `).join('');
  }

  const staffTbody = document.getElementById('settings-staff-tbody');
  if (staffTbody) {
    if (appState.staff.length === 0) {
      staffTbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-6 text-center text-xs text-slate-400">
            目前尚未建立工作人員，請點擊上方「新增人員」開始建立！
          </td>
        </tr>
      `;
    } else {
      staffTbody.innerHTML = appState.staff.map(st => `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-3 py-2.5 font-semibold text-slate-900">${st.name}</td>
          <td class="px-3 py-2.5">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${st.role === '助理' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}">
              ${st.role}
            </span>
          </td>
          <td class="px-3 py-2.5">
            ${st.linkedEmail ? `
              <span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>${st.linkedEmail}
              </span>
            ` : '<span class="text-slate-400 text-[10px]">未綁定帳號</span>'}
          </td>
          <td class="px-3 py-2.5 text-center space-x-1 whitespace-nowrap">
            <button onclick="editStaffMember('${st.id}')" class="text-xs text-amber-600 hover:text-amber-800 font-semibold p-1">編輯</button>
            <button onclick="deleteStaffMember('${st.id}')" class="text-xs text-rose-500 hover:text-rose-700 p-1">刪除</button>
          </td>
        </tr>
      `).join('');
    }
  }

  renderUsersTable();
}

// 服務項目 Modal
function openServiceModal() {
  document.getElementById('modal-service-id').value = '';
  document.getElementById('modal-service-name').value = '';
  document.getElementById('modal-service-price').value = '';
  document.getElementById('modal-service-rate').value = '50';
  document.getElementById('modal-service-title').textContent = '新增美髮服務項目';
  document.getElementById('modal-service').classList.remove('hidden');
}

function editServiceItem(serviceId) {
  const srv = appState.services.find(s => s.id === serviceId);
  if (!srv) return;

  document.getElementById('modal-service-id').value = srv.id;
  document.getElementById('modal-service-name').value = srv.name;
  document.getElementById('modal-service-price').value = srv.price;
  document.getElementById('modal-service-rate').value = srv.rate;
  document.getElementById('modal-service-category').value = srv.category || '技術服務';
  document.getElementById('modal-service-title').textContent = '編輯服務項目';
  document.getElementById('modal-service').classList.remove('hidden');
}

function closeServiceModal() {
  document.getElementById('modal-service').classList.add('hidden');
}

async function saveServiceItem() {
  const id = document.getElementById('modal-service-id').value;
  const name = document.getElementById('modal-service-name').value.trim();
  const price = parseFloat(document.getElementById('modal-service-price').value) || 0;
  const rate = parseFloat(document.getElementById('modal-service-rate').value) || 0;
  const category = document.getElementById('modal-service-category').value;

  if (!name) {
    alert('請輸入服務項目名稱！');
    return;
  }

  if (id) {
    const item = appState.services.find(s => s.id === id);
    if (item) {
      item.name = name;
      item.price = price;
      item.rate = rate;
      item.category = category;
    }
  } else {
    appState.services.push({
      id: 'srv-' + Date.now(),
      name: name,
      price: price,
      rate: rate,
      category: category
    });
  }

  await syncDataToCloud();
  closeServiceModal();
  renderSettingsTables();
  showToast('服務項目已同步更新');
}

async function deleteServiceItem(serviceId) {
  if (appState.services.length <= 1) {
    alert('至少需保留一項服務項目！');
    return;
  }
  if (!confirm('確定要刪除此服務項目嗎？')) return;
  appState.services = appState.services.filter(s => s.id !== serviceId);
  await syncDataToCloud();
  renderSettingsTables();
  showToast('項目已刪除');
}

// 員工 Modal
function openStaffModal() {
  document.getElementById('modal-staff-id').value = '';
  document.getElementById('modal-staff-name').value = '';
  document.getElementById('modal-staff-role').value = '設計師';
  populateLinkedUsersDropdown('');
  document.getElementById('modal-staff-title').textContent = '新增工作人員 / 設計師';
  document.getElementById('modal-staff').classList.remove('hidden');
}

function editStaffMember(staffId) {
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff) return;

  document.getElementById('modal-staff-id').value = staff.id;
  document.getElementById('modal-staff-name').value = staff.name;
  document.getElementById('modal-staff-role').value = staff.role;
  populateLinkedUsersDropdown(staff.linkedUid || '');
  document.getElementById('modal-staff-title').textContent = '編輯工作人員';
  document.getElementById('modal-staff').classList.remove('hidden');
}

function closeStaffModal() {
  document.getElementById('modal-staff').classList.add('hidden');
}

async function saveStaffMember() {
  const id = document.getElementById('modal-staff-id').value;
  const name = document.getElementById('modal-staff-name').value.trim();
  const role = document.getElementById('modal-staff-role').value;

  const linkedUserSelect = document.getElementById('modal-staff-linked-user');
  const linkedUid = linkedUserSelect ? linkedUserSelect.value : '';
  const selectedOpt = linkedUserSelect && linkedUserSelect.selectedIndex >= 0 ? linkedUserSelect.options[linkedUserSelect.selectedIndex] : null;
  const linkedEmail = selectedOpt ? (selectedOpt.getAttribute('data-email') || '') : '';

  if (!name) {
    alert('請輸入員工姓名！');
    return;
  }

  if (id) {
    const s = appState.staff.find(item => item.id === id);
    if (s) {
      s.name = name;
      s.role = role;
      s.linkedUid = linkedUid;
      s.linkedEmail = linkedEmail;
    }
  } else {
    appState.staff.push({
      id: 'staff-' + Date.now(),
      name: name,
      role: role,
      baseSalary: 0,
      attendanceBonus: 0,
      linkedUid: linkedUid,
      linkedEmail: linkedEmail
    });
  }

  await syncDataToCloud();
  closeStaffModal();
  updateLinkedStaff();
  applyRolePermissions();
  populateStaffDropdowns();
  renderSettingsTables();
  showToast(`已儲存工作人員：${name}${linkedEmail ? ` (已綁定帳號 ${linkedEmail})` : ''}`);
}

async function deleteStaffMember(staffId) {
  if (!confirm('確定要刪除這位工作人員嗎？')) return;
  appState.staff = appState.staff.filter(s => s.id !== staffId);
  await syncDataToCloud();
  populateStaffDropdowns();
  renderSettingsTables();
  showToast('人員已刪除');
}

// 備份與還原
function backupDataToJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `SalonPay_CloudBackup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('已匯出系統備份檔案！');
}

function restoreDataFromJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.services && Array.isArray(imported.staff) && Array.isArray(imported.orders)) {
        appState = imported;
        await syncDataToCloud();
        populateStaffDropdowns();
        renderSettingsTables();
        initBillingForm();
        filterHistoryOrders();
        calculateMonthlyPayroll();
        showToast('資料還原並同步雲端成功！');
      } else {
        alert('檔案格式不正確！');
      }
    } catch (err) {
      alert('解析 JSON 備份檔失敗：' + err.message);
    }
  };
  reader.readAsText(file);
}

async function confirmResetAll() {
  if (!confirm('警告：確定要清空雲端所有資料嗎？此操作不可復原！')) return;
  appState = {
    services: [...DEFAULT_SERVICES],
    staff: [],
    orders: []
  };
  await syncDataToCloud();
  populateStaffDropdowns();
  renderSettingsTables();
  initBillingForm();
  filterHistoryOrders();
  calculateMonthlyPayroll();
  showToast('已清空所有帳單與人員');
}

// Toast
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
