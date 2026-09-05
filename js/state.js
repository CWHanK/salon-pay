/**
 * SalonPay - 系統狀態與輔助管理 (js/state.js)
 */

// 系統核心業務狀態
let appState = {
  services: [...DEFAULT_SERVICES],
  staff: [],
  orders: []
};

// 雲端認證與身分權限狀態
let currentUser = null;
let currentUserRole = 'admin'; // 'admin' | 'staff'
let currentLinkedStaff = null;
let allRegisteredUsers = [];
let salonAdminKey = DEFAULT_ADMIN_SECRET_KEY;

// Firebase 服務與監聽器實例
let firebaseApp = null;
let db = null;
let isAuthSignUpMode = false;
let unsubscribeFirestore = null;
let unsubscribeUsersList = null;

// 現場開單明細行狀態暫存
let currentBillingRows = [];

// 更新當前登入者對應的店內人員物件
function updateLinkedStaff() {
  if (!currentUser) {
    currentLinkedStaff = null;
    return;
  }
  const uid = currentUser.uid;
  const email = (currentUser.email || '').toLowerCase();
  const emailPrefix = email ? email.split('@')[0] : '';

  currentLinkedStaff = appState.staff.find(s => 
    (s.linkedUid && s.linkedUid === uid) || 
    (s.linkedEmail && s.linkedEmail.toLowerCase() === email) ||
    (s.name && emailPrefix && s.name.toLowerCase() === emailPrefix)
  ) || null;

  // 若找到人員但缺少 linkedUid / linkedEmail，補充綁定並同步
  if (currentLinkedStaff && (!currentLinkedStaff.linkedUid || !currentLinkedStaff.linkedEmail)) {
    currentLinkedStaff.linkedUid = uid;
    currentLinkedStaff.linkedEmail = email;
    if (typeof syncDataToCloud === 'function') syncDataToCloud().catch(() => {});
  }

  // 若仍未配對到且店內僅有一位未綁定人員，自動進行綁定
  if (!currentLinkedStaff && appState.staff && appState.staff.length === 1 && !appState.staff[0].linkedUid) {
    appState.staff[0].linkedUid = uid;
    appState.staff[0].linkedEmail = email;
    currentLinkedStaff = appState.staff[0];
    if (typeof syncDataToCloud === 'function') syncDataToCloud().catch(() => {});
  }
}

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
