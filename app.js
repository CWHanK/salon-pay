/**
 * SalonPay - 美髮沙龍員工薪資與抽成計算系統
 * 核心邏輯腳本
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

// 產生今日與示範月度初始資料
function getInitialOrders() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  
  return [
    {
      id: 'ord-101',
      orderNo: `T-${yyyy}${mm}01-001`,
      date: `${yyyy}-${mm}-01`,
      staffId: 'staff-1',
      staffName: 'Hank (設計師)',
      assistantId: 'staff-3',
      assistantName: '小涵 (技術助理)',
      customer: '陳小姐 (VIP)',
      notes: '洗+剪 + 結構式護髮，指定 Hank',
      items: [
        { serviceId: 'srv-3', name: '洗髮 + 精緻剪髮', price: 1000, rate: 50, qty: 1, amount: 1000, commission: 500 },
        { serviceId: 'srv-8', name: '日本黑曜光結構護髮', price: 2000, rate: 40, qty: 1, amount: 2000, commission: 800 }
      ],
      totalAmount: 3000,
      totalCommission: 1300,
      assistantCommission: 150,
      salonNet: 1550,
      createdAt: new Date().toISOString()
    },
    {
      id: 'ord-102',
      orderNo: `T-${yyyy}${mm}02-002`,
      date: `${yyyy}-${mm}-02`,
      staffId: 'staff-1',
      staffName: 'Hank (設計師)',
      assistantId: '',
      assistantName: '',
      customer: '張先生',
      notes: '油頭修剪',
      items: [
        { serviceId: 'srv-1', name: '造型剪髮 (含基礎洗)', price: 800, rate: 50, qty: 1, amount: 800, commission: 400 }
      ],
      totalAmount: 800,
      totalCommission: 400,
      assistantCommission: 0,
      salonNet: 400,
      createdAt: new Date().toISOString()
    },
    {
      id: 'ord-103',
      orderNo: `T-${yyyy}${mm}03-003`,
      date: `${yyyy}-${mm}-03`,
      staffId: 'staff-1',
      staffName: 'Hank (設計師)',
      assistantId: 'staff-3',
      assistantName: '小涵 (技術助理)',
      customer: '王小姐',
      notes: '溫塑熱燙 + 帶一瓶護髮油',
      items: [
        { serviceId: 'srv-4', name: '溫塑熱燙 (全頭)', price: 3500, rate: 45, qty: 1, amount: 3500, commission: 1575 },
        { serviceId: 'srv-10', name: '專業沙龍護髮精華油 (100ml)', price: 980, rate: 25, qty: 1, amount: 980, commission: 245 }
      ],
      totalAmount: 4480,
      totalCommission: 1820,
      assistantCommission: 200,
      salonNet: 2460,
      createdAt: new Date().toISOString()
    },
    {
      id: 'ord-104',
      orderNo: `T-${yyyy}${mm}04-004`,
      date: `${yyyy}-${mm}-04`,
      staffId: 'staff-2',
      staffName: 'Emily (設計師)',
      assistantId: '',
      assistantName: '',
      customer: '林小姐',
      notes: '設計全染 + 護髮',
      items: [
        { serviceId: 'srv-5', name: '設計造型全染', price: 3200, rate: 45, qty: 1, amount: 3200, commission: 1440 },
        { serviceId: 'srv-8', name: '日本黑曜光結構護髮', price: 2000, rate: 40, qty: 1, amount: 2000, commission: 800 }
      ],
      totalAmount: 5200,
      totalCommission: 2240,
      assistantCommission: 0,
      salonNet: 2960,
      createdAt: new Date().toISOString()
    }
  ];
}

// 系統核心狀態
const STORAGE_KEY = 'SALON_PAY_DATA_V2';
let appState = {
  services: [],
  staff: [],
  orders: []
};

// 現場開單明細行狀態暫存
let currentBillingRows = [];

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
  loadDataFromStorage();
  initCurrentDate();
  populateStaffDropdowns();
  initBillingForm();
  initHistoryFilters();
  initMonthlyView();
  renderSettingsTables();
  lucide.createIcons();
});

// 載入本機資料
function loadDataFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      appState = JSON.parse(raw);
    } catch (e) {
      console.error('資料解析失敗，初始化為預設值', e);
      resetToDefaultState();
    }
  } else {
    resetToDefaultState();
  }
}

function resetToDefaultState() {
  appState = {
    services: [...DEFAULT_SERVICES],
    staff: [...DEFAULT_STAFF],
    orders: getInitialOrders()
  };
  saveDataToStorage();
}

function saveDataToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// 日期與介面初始化
function initCurrentDate() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const dateInput = document.getElementById('billing-date');
  if (dateInput) dateInput.value = dateStr;

  const currentDatetime = document.getElementById('current-datetime');
  if (currentDatetime) {
    currentDatetime.textContent = `系統日期：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  }
}

// 渲染所有設計師/助理下拉選單
function populateStaffDropdowns() {
  const billingStaff = document.getElementById('billing-staff-select');
  const billingAssistant = document.getElementById('billing-assistant-select');
  const historyStaff = document.getElementById('history-filter-staff');
  const monthlyStaff = document.getElementById('monthly-select-staff');

  const designers = appState.staff.filter(s => s.role !== '助理');
  const assistants = appState.staff.filter(s => s.role === '助理');

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
  // 預設新增一筆空白服務列供直接選擇
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

          <!-- 刪除此項按鈕 -->
          <button type="button" onclick="removeServiceRow('${row.rowId}')" class="text-xs text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition self-end sm:self-center flex items-center gap-1" title="刪除此項目">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            <span class="sm:hidden">刪除項目</span>
          </button>
        </div>

        <!-- 數值調整與單項小計 -->
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
    // 助理協助洗頭或上捲，提撥固定比例或獎勵（預設按客單 5% 獎勵計入助理）
    assistantComm = Math.round(totalAmount * 0.05);
    if (assistantRow) assistantRow.classList.remove('hidden');
  } else {
    if (assistantRow) assistantRow.classList.add('hidden');
  }

  const salonNet = Math.max(0, totalAmount - totalCommission - assistantComm);
  const avgRate = totalAmount > 0 ? ((totalCommission / totalAmount) * 100).toFixed(1) : 0;

  // 更新介面
  document.getElementById('summary-card-commission').textContent = totalCommission.toLocaleString();
  document.getElementById('summary-card-rate-text').textContent = `平均抽成率：${avgRate}%`;
  document.getElementById('summary-card-items-count').textContent = `${totalItemsCount} 項服務`;
  document.getElementById('summary-card-total-amount').textContent = totalAmount.toLocaleString();
  document.getElementById('summary-card-assistant-comm').textContent = assistantComm.toLocaleString();
  document.getElementById('summary-card-salon-net').textContent = salonNet.toLocaleString();
}

// 助理切換時更新計算
document.getElementById('billing-assistant-select')?.addEventListener('change', updateRowCalculations);

// 儲存當前單據
function saveCurrentOrder() {
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

  // 取得完整項目內容
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

  // 加入狀態並儲存本機
  appState.orders.unshift(newOrder);
  saveDataToStorage();

  showToast(`已成功儲存客單！業績 NT$ ${totalAmount.toLocaleString()}，抽成 NT$ ${totalCommission.toLocaleString()}`);

  // 重置表單迎接下一單
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
    // 月份篩選
    if (monthVal && !order.date.startsWith(monthVal)) return false;
    // 人員篩選
    if (staffVal && staffVal !== 'ALL' && order.staffId !== staffVal && order.assistantId !== staffVal) return false;
    // 關鍵字搜尋
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

function deleteOrder(orderId) {
  if (!confirm('確定要作廢並刪除這筆帳單記錄嗎？')) return;
  appState.orders = appState.orders.filter(o => o.id !== orderId);
  saveDataToStorage();
  filterHistoryOrders();
  showToast('帳單已刪除');
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

// 計算月薪核心
function calculateMonthlyPayroll() {
  const monthVal = document.getElementById('monthly-select-month')?.value;
  const staffId = document.getElementById('monthly-select-staff')?.value;
  if (!monthVal || !staffId) return;

  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff) return;

  // 載入該員工預設底薪與全勤
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

  // 篩選當月該員工所有訂單
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
      // 若為助理身份參與本單
      totalRevenue += o.totalAmount;
      totalCommission += o.assistantCommission;
    }
  });

  const avgTicket = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0;

  // 更新 KPI 卡
  document.getElementById('stat-month-clients').textContent = totalClients;
  document.getElementById('stat-month-avg-ticket').textContent = avgTicket.toLocaleString();
  document.getElementById('stat-month-revenue').textContent = totalRevenue.toLocaleString();
  document.getElementById('stat-month-commission').textContent = totalCommission.toLocaleString();

  // 更新計算器抽成欄位
  const commissionInput = document.getElementById('calc-commission');
  if (commissionInput) commissionInput.value = totalCommission;

  // 重新計算實發薪資
  updateCalculatedNetPay();

  // 渲染當月流水明細表格
  renderMonthlyOrdersTable(monthlyOrders, staffId);
}

// 實發薪資聯動計算
function updateCalculatedNetPay() {
  const baseSalary = parseFloat(document.getElementById('calc-base-salary')?.value) || 0;
  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const attendanceBonus = parseFloat(document.getElementById('calc-attendance-bonus')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;
  const deductions = parseFloat(document.getElementById('calc-deductions')?.value) || 0;

  // 實發金額 = 底薪 + 抽成 + 全勤 + 其他獎金 - 扣除額
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

// 匯出月報表至 Excel (包含月度薪資摘要 + 客單明細兩頁 Sheet)
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

  // Sheet 1: 薪資結算總表
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

  // Sheet 2: 當月客單流水明細
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

// 列印 / 產生 PDF 薪資明細單
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
      
      <!-- 表頭 -->
      <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px;">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0;">SALON 美髮沙龍 員工薪資結算明細單</h1>
        <p style="font-size: 14px; color: #555; margin: 4px 0 0 0;">結算月份：${year} 年 ${month} 月度 ‧ 列印日期：${new Date().toLocaleDateString('zh-TW')}</p>
      </div>

      <!-- 員工基本資料 -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px;">
        <div><strong>員工姓名：</strong> ${staff.name}</div>
        <div><strong>職務角色：</strong> ${staff.role}</div>
        <div><strong>全月服務客數：</strong> ${monthlyOrders.length} 人次</div>
        <div><strong>全月技術/商品總業績：</strong> NT$ ${totalRev.toLocaleString()}</div>
      </div>

      <!-- 薪資結構試算表 -->
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

      <!-- 顧客抽成明細摘錄 -->
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

      <!-- 簽名欄位 -->
      <div style="display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #94a3b8;">
        <div>店長 / 負責人覆核簽名：___________________</div>
        <div>員工本人核對簽收：___________________</div>
      </div>

    </div>
  `;

  // 觸發列印
  window.print();
}

// ==========================================
// 設定頁面：服務項目與人員管理 (Settings Tab)
// ==========================================
function renderSettingsTables() {
  // 渲染服務清單
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

  // 渲染員工清單
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

// 服務項目 Modal 控制
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

function saveServiceItem() {
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
    // 編輯現有項目
    const item = appState.services.find(s => s.id === id);
    if (item) {
      item.name = name;
      item.price = price;
      item.rate = rate;
      item.category = category;
    }
  } else {
    // 新增項目
    appState.services.push({
      id: 'srv-' + Date.now(),
      name: name,
      price: price,
      rate: rate,
      category: category
    });
  }

  saveDataToStorage();
  closeServiceModal();
  renderSettingsTables();
  showToast('服務項目已儲存');
}

function deleteServiceItem(serviceId) {
  if (appState.services.length <= 1) {
    alert('至少需保留一項服務項目！');
    return;
  }
  if (!confirm('確定要刪除此服務項目嗎？')) return;
  appState.services = appState.services.filter(s => s.id !== serviceId);
  saveDataToStorage();
  renderSettingsTables();
  showToast('項目已刪除');
}

// 員工 Modal 控制
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

function saveStaffMember() {
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

  saveDataToStorage();
  closeStaffModal();
  populateStaffDropdowns();
  renderSettingsTables();
  showToast('人員資料已儲存');
}

function deleteStaffMember(staffId) {
  if (appState.staff.length <= 1) {
    alert('系統至少需保留一位工作人員！');
    return;
  }
  if (!confirm('確定要刪除這位工作人員嗎？')) return;
  appState.staff = appState.staff.filter(s => s.id !== staffId);
  saveDataToStorage();
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
  downloadAnchor.setAttribute("download", `SalonPay_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('已匯出完整系統備份檔案！');
}

function restoreDataFromJson(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.services && imported.staff && imported.orders) {
        appState = imported;
        saveDataToStorage();
        populateStaffDropdowns();
        renderSettingsTables();
        initBillingForm();
        filterHistoryOrders();
        calculateMonthlyPayroll();
        showToast('資料還原成功！');
      } else {
        alert('檔案格式不正確，找不到預期之系統結構！');
      }
    } catch (err) {
      alert('解析 JSON 備份檔失敗：' + err.message);
    }
  };
  reader.readAsText(file);
}

function loadDemoData() {
  if (!confirm('載入示範資料將重新設置示範帳單與項目，是否繼續？')) return;
  resetToDefaultState();
  populateStaffDropdowns();
  renderSettingsTables();
  initBillingForm();
  filterHistoryOrders();
  calculateMonthlyPayroll();
  showToast('已成功載入示範帳單資料！');
}

function confirmResetAll() {
  if (!confirm('警告：確定要清空所有資料嗎？此操作不可復原！')) return;
  appState = {
    services: [...DEFAULT_SERVICES],
    staff: [{ id: 'staff-1', name: '店長設計師', role: '設計師', baseSalary: 30000, attendanceBonus: 2000 }],
    orders: []
  };
  saveDataToStorage();
  populateStaffDropdowns();
  renderSettingsTables();
  initBillingForm();
  filterHistoryOrders();
  calculateMonthlyPayroll();
  showToast('已重設為全新系統狀態');
}

// ==========================================
// 簡易 Toast 提示小工具
// ==========================================
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
