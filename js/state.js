/**
 * SalonFlow - 系統狀態與輔助管理 (js/state.js)
 */

// 系統核心業務狀態（登入前維持全空，通過雲端驗證後方載入資料）
let appState = {
  services: [],
  staff: [],
  orders: []
};

// 雲端認證與身分權限狀態
let currentUser = null;
let currentUserRole = null; // 'admin' | 'staff'，未通過驗證前為 null 絕無任何權限
let currentLinkedStaff = null;
let allRegisteredUsers = [];
let salonAdminKeyHash = typeof DEFAULT_ADMIN_KEY_HASH !== 'undefined' ? DEFAULT_ADMIN_KEY_HASH : "f365f5a9b76e95c1bf942df99b79063005ccc85a9d96aadbf846aa0ab72cca09";
let salonRegKeyHash = typeof DEFAULT_REGISTRATION_KEY_HASH !== 'undefined' ? DEFAULT_REGISTRATION_KEY_HASH : "8f48ecba137b707f170ce4fa4970c16ed27cd22a3deb33f558840f830692ef25";

// 計算 SHA-256 雜湊 (確保密鑰絕不以明文傳輸或儲存)
async function hashSecretKey(str) {
  if (!str) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  const username = formatEmailToUsername(email).toLowerCase();

  const staffList = Array.isArray(appState.staff) ? appState.staff : [];
  const matchesEmail = s => {
    if (!s.linkedEmail) return false;
    const sLinkedEmail = formatUsernameToEmail(s.linkedEmail).toLowerCase();
    const sLinkedUsername = formatEmailToUsername(s.linkedEmail).toLowerCase();
    return sLinkedEmail === email || (!!username && sLinkedUsername === username);
  };
  // 依可靠程度依序比對：已綁定 UID → 管理員設定的綁定帳號（帳號唯一，可信）→ 尚無任何綁定的人員且姓名與帳號相同
  // 已有綁定的人員不會被別人以姓名搶綁
  currentLinkedStaff =
    staffList.find(s => s.linkedUid && s.linkedUid === uid) ||
    staffList.find(matchesEmail) ||
    staffList.find(s => !s.linkedUid && !s.linkedEmail && s.name && username && s.name.toLowerCase() === username) ||
    null;

  // 若找到人員但 UID 未綁定（或帳號重新註冊後 UID 已變）/ 缺少綁定帳號，補上並同步
  const exactEmailMatch = !!currentLinkedStaff?.linkedEmail &&
    formatUsernameToEmail(currentLinkedStaff.linkedEmail).toLowerCase() === email;
  const shouldRebindUid = currentLinkedStaff && currentLinkedStaff.linkedUid !== uid &&
    (!currentLinkedStaff.linkedUid || exactEmailMatch);
  if (currentLinkedStaff && (shouldRebindUid || !currentLinkedStaff.linkedEmail)) {
    if (shouldRebindUid) currentLinkedStaff.linkedUid = uid;
    if (!currentLinkedStaff.linkedEmail) currentLinkedStaff.linkedEmail = email;
    if (typeof syncDataToCloud === 'function') syncDataToCloud('staff').catch(() => {});
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
