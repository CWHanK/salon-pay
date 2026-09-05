/**
 * SalonPay - 美髮沙龍員工薪資與抽成計算系統 (Firebase 雲端同步版)
 */

// 預設資料：服務項目與抽成比例
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

// 預設員工資料
const DEFAULT_STAFF = [
  { id: 'staff-1', name: 'Hank (設計師)', role: '設計師', baseSalary: 28000, attendanceBonus: 2000 },
  { id: 'staff-2', name: 'Emily (設計師)', role: '設計師', baseSalary: 30000, attendanceBonus: 2000 },
  { id: 'staff-3', name: '小涵 (技術助理)', role: '助理', baseSalary: 26000, attendanceBonus: 2000 }
];

// 系統核心狀態
let appState = {
  services: [...DEFAULT_SERVICES],
  staff: [...DEFAULT_STAFF],
  orders: []
};

// 雲端與認證狀態變數
let currentUser = null;
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

// 初始化 Firebase 雲端服務
function initFirebase() {
  let config = window.FIREBASE_CONFIG;
  const storedConfig = localStorage.getItem('SALON_FIREBASE_CONFIG');
  if (storedConfig) {
    try {
      config = JSON.parse(storedConfig);
    } catch (e) {}
  }

  // 檢查是否具備必要的金鑰
  if (!config || !config.apiKey || config.apiKey === '') {
    // 尚未綁定 Firebase，顯示提示
    const configAlert = document.getElementById('auth-config-alert');
    if (configAlert) configAlert.classList.remove('hidden');
    // 先載入本機快取資料讓介面有東西
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
    // 啟用離線支援
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      console.warn('離線快取提示:', err.code);
    });

    // 監聽登入狀態改變
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
      appState = JSON.parse(raw);
    } catch(e) {}
  } else {
    appState = {
      services: [...DEFAULT_SERVICES],
      staff: [...DEFAULT_STAFF],
      orders: []
    };
  }
  populateStaffDropdowns();
  initBillingForm();
  initHistoryFilters();
  initMonthlyView();
  renderSettingsTables();
}

// ==========================================
// 雲端帳號登入與認證控制 (Authentication)
// ==========================================
function toggleAuthMode() {
  isAuthSignUpMode = !isAuthSignUpMode;
  const submitText = document.getElementById('auth-submit-text');
  const toggleBtn = document.getElementById('auth-toggle-mode-btn');

  if (isAuthSignUpMode) {
    submitText.textContent = '註冊並建立沙龍帳號';
    toggleBtn.textContent = '已有帳號？點此登入';
  } else {
    submitText.textContent = '登入雲端系統';
    toggleBtn.textContent = '初次使用？點此註冊新帳號';
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
      // 註冊新帳號
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      // 初次註冊建立基本雲端範本資料
      await db.collection('users').doc(cred.user.uid).set(appState);
      showToast('註冊成功！已建立您的專屬沙龍資料庫');
    } else {
      // 登入現有帳號
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

function onUserLoggedIn(user) {
  // 隱藏登入遮罩
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.add('hidden');

  // 更新 Header 顯示的使用者信箱
  const emailEl = document.getElementById('header-user-email');
  if (emailEl) emailEl.textContent = user.email;

  // 開始即時監聽 Firestore 雲端資料庫
  subscribeToCloudData(user.uid);
}

function onUserLoggedOut() {
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
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
// Firestore 雲端即時同步 (Realtime Cloud Sync)
// ==========================================
function subscribeToCloudData(uid) {
  const userDocRef = db.collection('users').doc(uid);

  unsubscribeFirestore = userDocRef.onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      appState.services = data.services || [...DEFAULT_SERVICES];
      appState.staff = data.staff || [...DEFAULT_STAFF];
      appState.orders = data.orders || [];
    } else {
      // 若第一次使用尚無文件，則自動初始化寫入
      userDocRef.set(appState);
    }

    // 快取到本地
    localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));

    // 重新渲染畫面所有元件
    populateStaffDropdowns();
    initBillingForm();
    filterHistoryOrders();
    calculateMonthlyPayroll();
    renderSettingsTables();
  }, err => {
    console.error('Firestore 即時同步錯誤:', err);
  });
}

// 儲存資料同步到雲端
async function syncDataToCloud() {
  // 本地先存一份
  localStorage.setItem('SALON_PAY_LOCAL_CACHE', JSON.stringify(appState));

  if (currentUser && db) {
    try {
      await db.collection('users').doc(currentUser.uid).set(appState);
    } catch (err) {
      console.error('上傳雲端失敗:', err);
      showToast('⚠️ 離線暫存中，恢復網路後將自動同步雲端');
    }
  }
}

// ==========================================
// 雲端金鑰貼上設定視窗 (Modal Cloud Config)
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
      // 擷取大括弧內的 JSON / 物件內容
      const jsonStr = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
        // 修正非嚴格 JSON 屬性名稱 (例如 apiKey: -> "apiKey":)
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

// ==========================================
// 日期與介面初始化
// ==========================================
function initCurrentDate() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const dateInput = document.getElementById('billing-date');
  if (dateInput) dateInput.value = dateStr;
}

// 渲染所有設計師/助理下拉選單
function populateStaffDropdowns() {
  const billingStaff = document.getElementById('billing-staff-select');
  const billingAssistant = document.getElementById('billing-assistant-select');
  const historyStaff = document.getElementById('history-filter-staff');
  const monthlyStaff = document.getElementById('monthly-select-staff');

  if (billingStaff) {
    billingStaff.innerHTML = appState.staff.map(s => `
      <option value="${s.id}">${s.name} (${s.role})</option>
    `).join('');
  }

  if (billingAssistant) {
    billingAssistant.innerHTML = `
      <option value="">無助理協助（全由設計師操作）</option>
      ${appState.staff.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('')}
    `;
  }

  if (historyStaff) {
    historyStaff.innerHTML = `
      <option value="ALL">全部人員</option>
      ${appState.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    `;
  }

  if (monthlyStaff) {
    monthlyStaff.innerHTML = appState.staff.map(s => `
      <option value="${s.id}">${s.name} (${s.role})</option>
    `).join('');
  }
}

// ==========================================
// 分頁切換 (Tab Navigation)
// ==========================================
function switchTab(tabName) {
  const tabs = ['billing', 'history', 'monthly', 'settings'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (t === tabName) {
      el?.classList.remove('hidden');
      btn?.classList.add('active');
      btn?.classList.remove('text-slate-600');
    } else {
      el?.classList.add('hidden');
      btn?.classList.remove('active');
      btn?.classList.add('text-slate-600');
    }
  });

  if (tabName === 'history') {
    filterHistoryOrders();
  } else if (tabName === 'monthly') {
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
    qty: 1
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

// 重新繪製開單項目清單
function renderBillingRows() {
  const container = document.getElementById('service-rows-container');
  if (!container) return;

  container.innerHTML = currentBillingRows.map((row, index) => {
    const itemTotal = row.price * row.qty;
    const itemCommission = Math.round(itemTotal * (row.rate / 100));

    return `
      <div id="${row.rowId}" class="service-row-item p-3.5 bg-slate-50/90 hover:bg-slate-50 border border-slate-200/90 rounded-2xl transition space-y-3">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <span class="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
              ${index + 1}
            </span>
            <div class="flex-1 sm:w-64">
              <label class="block text-[11px] font-semibold text-slate-500 mb-0.5">選擇服務項目 (下拉自動帶入)</label>
              <select onchange="onServiceSelectChange('${row.rowId}', this.value)" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                ${appState.services.map(s => `
                  <option value="${s.id}" ${s.id === row.serviceId ? 'selected' : ''}>
                    ${s.name} [定價$${s.price} | 抽${s.rate}%]
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <button type="button" onclick="removeServiceRow('${row.rowId}')" class="text-xs text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition self-end sm:self-center flex items-center gap-1" title="刪除此項目">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span class="sm:hidden">刪除項目</span>
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-slate-200/60">
          <div>
            <label class="block text-[11px] font-medium text-slate-500 mb-0.5">收費單價 (NT$)</label>
            <input type="number" value="${row.price}" oninput="onRowInputChange('${row.rowId}', 'price', this.value)" class="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-sm font-numeric bg-white font-semibold text-slate-800 focus:ring-1 focus:ring-amber-500">
          </div>

          <div>
            <label class="block text-[11px] font-medium text-amber-700 mb-0.5">抽成比例 (%)</label>
            <div class="relative">
              <input type="number" min="0" max="100" value="${row.rate}" oninput="onRowInputChange('${row.rowId}', 'rate', this.value)" class="w-full rounded-lg border border-amber-300 bg-amber-50/50 px-2.5 py-1 text-sm font-numeric font-bold text-amber-800 focus:ring-1 focus:ring-amber-500 pr-6">
              <span class="absolute right-2 top-1.5 text-xs text-amber-700 font-bold">%</span>
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-medium text-slate-500 mb-0.5">數量</label>
            <input type="number" min="1" value="${row.qty}" oninput="onRowInputChange('${row.rowId}', 'qty', this.value)" class="w-full rounded-lg border border-slate-300 px-2.5 py-1 text-sm font-numeric bg-white focus:ring-1 focus:ring-amber-500">
          </div>

          <div class="bg-amber-100/60 rounded-lg p-1.5 flex flex-col justify-center text-right border border-amber-200/60">
            <div class="text-[10px] text-slate-500">此項抽成金額</div>
            <div class="text-sm font-bold text-amber-800 font-numeric">NT$ ${itemCommission.toLocaleString()}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
  updateRowCalculations();
}

// 更新右側結算卡片總數值
function updateRowCalculations() {
  let totalAmount = 0;
  let totalCommission = 0;
  let totalItemsCount = 0;

  currentBillingRows.forEach(row => {
    const itemTotal = row.price * row.qty;
    const itemComm = Math.round(itemTotal * (row.rate / 100));
    totalAmount += itemTotal;
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

  document.getElementById('summary-card-commission').textContent = totalCommission.toLocaleString();
  document.getElementById('summary-card-rate-text').textContent = `平均抽成率：${avgRate}%`;
  document.getElementById('summary-card-items-count').textContent = `${totalItemsCount} 項服務`;
  document.getElementById('summary-card-total-amount').textContent = totalAmount.toLocaleString();
  document.getElementById('summary-card-assistant-comm').textContent = assistantComm.toLocaleString();
  document.getElementById('summary-card-salon-net').textContent = salonNet.toLocaleString();
}

document.getElementById('billing-assistant-select')?.addEventListener('change', updateRowCalculations);

// 儲存當前單據並同步雲端
async function saveCurrentOrder() {
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
  const customer = document.getElementById('billing-customer').value.trim() || '現場一般顧客';
  const notes = document.getElementById('billing-notes').value.trim();
  const assistantId = document.getElementById('billing-assistant-select').value;
  const assistant = appState.staff.find(s => s.id === assistantId);

  const itemsDetail = currentBillingRows.map(r => {
    const srv = appState.services.find(s => s.id === r.serviceId);
    const name = srv ? srv.name : '自訂美髮項目';
    const amount = r.price * r.qty;
    const commission = Math.round(amount * (r.rate / 100));
    return {
      serviceId: r.serviceId,
      name: name,
      price: r.price,
      rate: r.rate,
      qty: r.qty,
      amount: amount,
      commission: commission
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

  showToast(`已成功開單並同步雲端！業績 NT$ ${totalAmount.toLocaleString()}，抽成 NT$ ${totalCommission.toLocaleString()}`);
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
// 歷史帳單與每日流水 (History Tab)
// ==========================================
function initHistoryFilters() {
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    monthInput.value = `${yyyy}-${mm}`;
  }
}

function clearHistoryFilters() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  document.getElementById('history-filter-month').value = `${yyyy}-${mm}`;
  document.getElementById('history-filter-staff').value = 'ALL';
  document.getElementById('history-filter-search').value = '';
  filterHistoryOrders();
}

function filterHistoryOrders() {
  const monthVal = document.getElementById('history-filter-month')?.value;
  const staffVal = document.getElementById('history-filter-staff')?.value;
  const searchVal = document.getElementById('history-filter-search')?.value.trim().toLowerCase();

  const filtered = appState.orders.filter(order => {
    if (monthVal && !order.date.startsWith(monthVal)) return false;
    if (staffVal && staffVal !== 'ALL' && order.staffId !== staffVal && order.assistantId !== staffVal) return false;
    if (searchVal) {
      const matchCustomer = order.customer.toLowerCase().includes(searchVal);
      const matchNotes = order.notes && order.notes.toLowerCase().includes(searchVal);
      const matchNo = order.orderNo.toLowerCase().includes(searchVal);
      const matchItems = order.items.some(it => it.name.toLowerCase().includes(searchVal));
      if (!matchCustomer && !matchNotes && !matchNo && !matchItems) return false;
    }
    return true;
  });

  renderHistoryTable(filtered);
}

function renderHistoryTable(ordersList) {
  const tbody = document.getElementById('history-table-body');
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
    if (emptyHint) emptyHint.classList.remove('hidden');
    return;
  }

  if (emptyHint) emptyHint.classList.add('hidden');

  tbody.innerHTML = ordersList.map(order => {
    const itemsSummary = order.items.map(it => `
      <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs mr-1 mb-1">
        ${it.name} (x${it.qty}) <strong class="text-amber-700">抽${it.rate}%</strong>
      </span>
    `).join('');

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="font-mono text-xs font-semibold text-slate-800">${order.orderNo}</div>
          <div class="text-xs text-slate-400">${order.date}</div>
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="font-medium text-slate-900 text-xs">${order.staffName}</div>
          ${order.assistantName ? `<div class="text-[11px] text-blue-600">助：${order.assistantName}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <div class="font-semibold text-slate-800 text-xs">${order.customer}</div>
          ${order.notes ? `<div class="text-[11px] text-slate-400 line-clamp-1">${order.notes}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <div class="max-w-xs sm:max-w-md">${itemsSummary}</div>
        </td>
        <td class="px-4 py-3 text-right font-numeric font-bold text-slate-800 whitespace-nowrap">
          NT$ ${order.totalAmount.toLocaleString()}
        </td>
        <td class="px-4 py-3 text-right font-numeric font-extrabold text-amber-700 whitespace-nowrap">
          NT$ ${order.totalCommission.toLocaleString()}
        </td>
        <td class="px-4 py-3 text-center whitespace-nowrap">
          <button onclick="deleteOrder('${order.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition" title="刪除此帳單">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

async function deleteOrder(orderId) {
  if (!confirm('確定要刪除這筆帳單記錄嗎？（將同步刪除雲端記錄）')) return;
  appState.orders = appState.orders.filter(o => o.id !== orderId);
  await syncDataToCloud();
  filterHistoryOrders();
  showToast('帳單已從雲端刪除');
}

// 匯出歷史流水到 Excel
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
        '收費單價': it.price,
        '數量': it.qty,
        '該項小計': it.amount,
        '抽成比例(%)': it.rate + '%',
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
// 月薪結算與月報表 (Monthly Payroll & Reports)
// ==========================================
function initMonthlyView() {
  const monthInput = document.getElementById('monthly-select-month');
  if (monthInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    monthInput.value = `${yyyy}-${mm}`;
  }
}

function calculateMonthlyPayroll() {
  const monthVal = document.getElementById('monthly-select-month')?.value;
  const staffId = document.getElementById('monthly-select-staff')?.value;
  if (!monthVal || !staffId) return;

  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff) return;

  const baseSalaryInput = document.getElementById('calc-base-salary');
  const attendanceBonusInput = document.getElementById('calc-attendance-bonus');
  
  if (baseSalaryInput && (!baseSalaryInput.dataset.modified || baseSalaryInput.dataset.staffId !== staffId)) {
    baseSalaryInput.value = staff.baseSalary;
    baseSalaryInput.dataset.staffId = staffId;
  }
  if (attendanceBonusInput && (!attendanceBonusInput.dataset.modified || attendanceBonusInput.dataset.staffId !== staffId)) {
    attendanceBonusInput.value = staff.attendanceBonus;
    attendanceBonusInput.dataset.staffId = staffId;
  }

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
  const baseSalary = parseFloat(document.getElementById('calc-base-salary')?.value) || 0;
  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const attendanceBonus = parseFloat(document.getElementById('calc-attendance-bonus')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;
  const deductions = parseFloat(document.getElementById('calc-deductions')?.value) || 0;

  const netPay = Math.round(baseSalary + commission + attendanceBonus + otherBonus - deductions);

  document.getElementById('stat-month-net-pay').textContent = netPay.toLocaleString();
  document.getElementById('calc-summary-net').textContent = netPay.toLocaleString();
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
          該月份尚無此位員工之服務開單紀錄
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = monthlyOrders.map(order => {
    const isMain = order.staffId === currentStaffId;
    const earnedComm = isMain ? order.totalCommission : order.assistantCommission;
    const roleTag = isMain ? '' : '<span class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">助理獎勵</span>';
    const itemsText = order.items.map(it => `${it.name} ($${it.price}, 抽${it.rate}%)`).join('、');

    return `
      <tr class="hover:bg-slate-50 transition text-xs">
        <td class="px-4 py-3 whitespace-nowrap font-medium text-slate-800">${order.date}</td>
        <td class="px-4 py-3 whitespace-nowrap font-mono text-slate-500">${order.orderNo}</td>
        <td class="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">${order.customer}</td>
        <td class="px-4 py-3">
          <div class="max-w-xs truncate text-slate-600" title="${itemsText}">${itemsText}</div>
        </td>
        <td class="px-4 py-3 text-right font-numeric font-bold text-slate-800">NT$ ${order.totalAmount.toLocaleString()}</td>
        <td class="px-4 py-3 text-right font-numeric font-extrabold text-amber-700 whitespace-nowrap">
          NT$ ${earnedComm.toLocaleString()} ${roleTag}
        </td>
        <td class="px-4 py-3 text-slate-400">${order.notes || '-'}</td>
      </tr>
    `;
  }).join('');
}

function exportMonthlyReportExcel() {
  const monthVal = document.getElementById('monthly-select-month')?.value;
  const staffId = document.getElementById('monthly-select-staff')?.value;
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff || !monthVal) return;

  const baseSalary = parseFloat(document.getElementById('calc-base-salary')?.value) || 0;
  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const attendance = parseFloat(document.getElementById('calc-attendance-bonus')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;
  const deductions = parseFloat(document.getElementById('calc-deductions')?.value) || 0;
  const netPay = Math.round(baseSalary + commission + attendance + otherBonus - deductions);

  const monthlyOrders = appState.orders.filter(order => {
    return order.date.startsWith(monthVal) && (order.staffId === staffId || order.assistantId === staffId);
  });

  const wb = XLSX.utils.book_new();

  const summarySheetData = [
    { '項目': '結算月份', '內容/金額': monthVal },
    { '項目': '員工姓名', '內容/金額': staff.name },
    { '項目': '職務身分', '內容/金額': staff.role },
    { '項目': '完成服務客數', '內容/金額': `${monthlyOrders.length} 人次` },
    { '項目': '----------------', '內容/金額': '----------------' },
    { '項目': '【(+) 保障底薪】', '內容/金額': baseSalary },
    { '項目': '【(+) 業績抽成總額】', '內容/金額': commission },
    { '項目': '【(+) 全勤獎金】', '內容/金額': attendance },
    { '項目': '【(+) 績效/其他獎金】', '內容/金額': otherBonus },
    { '項目': '【(-) 勞健保及請假扣款】', '內容/金額': deductions },
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
        '收費金額': it.amount,
        '項目抽成率': it.rate + '%',
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
  const monthVal = document.getElementById('monthly-select-month')?.value;
  const staffId = document.getElementById('monthly-select-staff')?.value;
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff || !monthVal) return;

  const baseSalary = parseFloat(document.getElementById('calc-base-salary')?.value) || 0;
  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const attendance = parseFloat(document.getElementById('calc-attendance-bonus')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;
  const deductions = parseFloat(document.getElementById('calc-deductions')?.value) || 0;
  const netPay = Math.round(baseSalary + commission + attendance + otherBonus - deductions);

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
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">加項薪酬明細</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">金額 (NT$)</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">扣除項明細</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">金額 (NT$)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">保障底薪</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">$ ${baseSalary.toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">勞保/健保個人自付額</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #e11d48;">$ ${deductions.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>技術服務與產品抽成總計</strong></td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold; color: #b45309;">$ ${commission.toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">其他代扣/扣款</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">$ 0</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">全勤獎金</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">$ ${attendance.toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">-</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">-</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">績效/額外獎勵加給</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">$ ${otherBonus.toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">-</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">-</td>
          </tr>
          <tr style="background: #fef3c7; font-size: 15px; font-weight: bold;">
            <td colspan="2" style="border: 1px solid #cbd5e1; padding: 10px;">應發金額小計：NT$ ${(baseSalary + commission + attendance + otherBonus).toLocaleString()}</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: #b45309;">
              ★ 本月實發薪資淨額：NT$ ${netPay.toLocaleString()}
            </td>
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
// 設定頁面：服務項目與人員管理 (Settings Tab)
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
    staffTbody.innerHTML = appState.staff.map(st => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-3 py-2.5 font-semibold text-slate-900">${st.name}</td>
        <td class="px-3 py-2.5">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${st.role === '助理' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}">
            ${st.role}
          </span>
        </td>
        <td class="px-3 py-2.5 text-right font-numeric font-bold text-slate-700">NT$ ${st.baseSalary.toLocaleString()}</td>
        <td class="px-3 py-2.5 text-right font-numeric text-slate-600">NT$ ${st.attendanceBonus.toLocaleString()}</td>
        <td class="px-3 py-2.5 text-center space-x-1 whitespace-nowrap">
          <button onclick="editStaffMember('${st.id}')" class="text-xs text-amber-600 hover:text-amber-800 font-semibold p-1">編輯</button>
          <button onclick="deleteStaffMember('${st.id}')" class="text-xs text-rose-500 hover:text-rose-700 p-1">刪除</button>
        </td>
      </tr>
    `).join('');
  }
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
  document.getElementById('modal-staff-base').value = '28000';
  document.getElementById('modal-staff-bonus').value = '2000';
  document.getElementById('modal-staff-title').textContent = '新增工作人員';
  document.getElementById('modal-staff').classList.remove('hidden');
}

function editStaffMember(staffId) {
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff) return;

  document.getElementById('modal-staff-id').value = staff.id;
  document.getElementById('modal-staff-name').value = staff.name;
  document.getElementById('modal-staff-role').value = staff.role;
  document.getElementById('modal-staff-base').value = staff.baseSalary;
  document.getElementById('modal-staff-bonus').value = staff.attendanceBonus;
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
  const baseSalary = parseFloat(document.getElementById('modal-staff-base').value) || 0;
  const attendanceBonus = parseFloat(document.getElementById('modal-staff-bonus').value) || 0;

  if (!name) {
    alert('請輸入員工姓名！');
    return;
  }

  if (id) {
    const s = appState.staff.find(item => item.id === id);
    if (s) {
      s.name = name;
      s.role = role;
      s.baseSalary = baseSalary;
      s.attendanceBonus = attendanceBonus;
    }
  } else {
    appState.staff.push({
      id: 'staff-' + Date.now(),
      name: name,
      role: role,
      baseSalary: baseSalary,
      attendanceBonus: attendanceBonus
    });
  }

  await syncDataToCloud();
  closeStaffModal();
  populateStaffDropdowns();
  renderSettingsTables();
  showToast('人員資料已更新');
}

async function deleteStaffMember(staffId) {
  if (appState.staff.length <= 1) {
    alert('系統至少需保留一位工作人員！');
    return;
  }
  if (!confirm('確定要刪除這位工作人員嗎？')) return;
  appState.staff = appState.staff.filter(s => s.id !== staffId);
  await syncDataToCloud();
  populateStaffDropdowns();
  renderSettingsTables();
  showToast('人員已刪除');
}

// ==========================================
// 備份與還原 (JSON Backup & Restore)
// ==========================================
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
      if (imported.services && imported.staff && imported.orders) {
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

async function loadDemoData() {
  if (!confirm('重新載入示範資料將更新您的資料庫，是否繼續？')) return;
  appState = {
    services: [...DEFAULT_SERVICES],
    staff: [...DEFAULT_STAFF],
    orders: []
  };
  await syncDataToCloud();
  populateStaffDropdowns();
  renderSettingsTables();
  initBillingForm();
  filterHistoryOrders();
  calculateMonthlyPayroll();
  showToast('已重設為預設項目資料！');
}

async function confirmResetAll() {
  if (!confirm('警告：確定要清空雲端所有資料嗎？此操作不可復原！')) return;
  appState = {
    services: [...DEFAULT_SERVICES],
    staff: [{ id: 'staff-1', name: '店長設計師', role: '設計師', baseSalary: 30000, attendanceBonus: 2000 }],
    orders: []
  };
  await syncDataToCloud();
  populateStaffDropdowns();
  renderSettingsTables();
  initBillingForm();
  filterHistoryOrders();
  calculateMonthlyPayroll();
  showToast('已清空所有帳單');
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
