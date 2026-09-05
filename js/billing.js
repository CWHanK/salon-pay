/**
 * SalonPay - 現場開單抽成試算 (js/billing.js)
 */

// 渲染所有設計師下拉選單與開單設計師身分顯示
function populateStaffDropdowns() {
  const billingStaffName = document.getElementById('billing-staff-name');
  const billingStaffInput = document.getElementById('billing-staff-select');
  const billingStaffDisplay = document.getElementById('billing-staff-display');
  const historyStaff = document.getElementById('history-filter-staff');
  const monthlyStaff = document.getElementById('monthly-select-staff');

  updateLinkedStaff();

  // 主作設計師：不再設計為選單，管理員與員工統一同一套（直接綁定當前登入者）
  if (billingStaffName || billingStaffInput) {
    if (currentLinkedStaff) {
      if (billingStaffName) {
        billingStaffName.innerHTML = `<span class="font-bold text-slate-900">${currentLinkedStaff.name}</span>`;
      }
      if (billingStaffInput) {
        billingStaffInput.value = currentLinkedStaff.id;
      }
      if (billingStaffDisplay) {
        billingStaffDisplay.onclick = null;
        billingStaffDisplay.classList.remove('cursor-pointer', 'border-amber-300', 'bg-amber-50');
        billingStaffDisplay.classList.add('border-slate-200', 'bg-slate-50');
      }
    } else {
      if (billingStaffInput) {
        billingStaffInput.value = '';
      }
      if (currentUserRole === 'admin') {
        if (billingStaffName) {
          billingStaffName.innerHTML = `<span class="text-amber-700 font-semibold text-xs flex items-center gap-1">⚠️ 尚未綁定設計師身分 (點此設定)</span>`;
        }
        if (billingStaffDisplay) {
          billingStaffDisplay.onclick = function() {
            openStaffModal();
          };
          billingStaffDisplay.classList.add('cursor-pointer', 'border-amber-300', 'bg-amber-50');
          billingStaffDisplay.classList.remove('border-slate-200', 'bg-slate-50');
        }
      } else {
        if (billingStaffName) {
          billingStaffName.innerHTML = `<span class="text-rose-600 font-semibold text-xs">⚠️ 帳號尚未綁定店內人員 (請聯繫管理員)</span>`;
        }
        if (billingStaffDisplay) {
          billingStaffDisplay.onclick = null;
          billingStaffDisplay.classList.remove('cursor-pointer');
        }
      }
    }
  }

  if (historyStaff) {
    if (currentUserRole === 'staff') {
      if (currentLinkedStaff) {
        historyStaff.innerHTML = `
          <option value="${currentLinkedStaff.id}">${currentLinkedStaff.name} (本人客單)</option>
        `;
      } else {
        historyStaff.innerHTML = `
          <option value="">(尚未綁定人員)</option>
        `;
      }
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
    if (currentUserRole === 'staff') {
      if (currentLinkedStaff) {
        monthlyStaff.innerHTML = `
          <option value="${currentLinkedStaff.id}">${currentLinkedStaff.name} (本人)</option>
        `;
      } else {
        monthlyStaff.innerHTML = `
          <option value="">(尚未綁定人員)</option>
        `;
      }
      monthlyStaff.disabled = true;
    } else {
      monthlyStaff.disabled = false;
      if (appState.staff.length === 0) {
        monthlyStaff.innerHTML = `<option value="">尚無人員資料</option>`;
      } else {
        monthlyStaff.innerHTML = appState.staff.map(s => `
          <option value="${s.id}">${s.name}</option>
        `).join('');
      }
    }
  }

  checkStaffEmptyState();
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

// 初始化開單表單
function initBillingForm() {
  generateNewOrderNo();
  currentBillingRows = [];
  addServiceRow();
}

// 自動生成單號
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

// 重新繪製開單項目清單（管理員與員工介面完全一致）
function renderBillingRows() {
  const container = document.getElementById('service-rows-container');
  if (!container) return;

  container.innerHTML = currentBillingRows.map((row, index) => {
    const itemTotal = row.price * row.qty;

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
                選擇服務項目
              </label>
              <select onchange="onServiceSelectChange('${row.rowId}', this.value)" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                ${appState.services.map(s => {
                  return `<option value="${s.id}" ${s.id === row.serviceId ? 'selected' : ''}>${s.name} [定價$${s.price}]</option>`;
                }).join('')}
              </select>
            </div>
          </div>

          <button type="button" onclick="removeServiceRow('${row.rowId}')" class="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition shrink-0" title="刪除項目">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- 數值調整：單價、數量 -->
        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70">
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">單價 ($)</label>
            <input type="number" value="${row.price}" oninput="onRowInputChange('${row.rowId}', 'price', this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-numeric bg-white font-bold text-slate-900 focus:ring-1 focus:ring-amber-500">
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">數量</label>
            <input type="number" min="1" value="${row.qty}" oninput="onRowInputChange('${row.rowId}', 'qty', this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-numeric bg-white focus:ring-1 focus:ring-amber-500">
          </div>
        </div>

        <!-- 金額即時小計 -->
        <div class="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-3 text-xs">
          <div>
            <span class="text-slate-500 text-[11px]">小計金額:</span>
            <strong class="text-slate-900 font-numeric text-sm font-bold">NT$ ${itemTotal.toLocaleString()}</strong>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  updateRowCalculations();
}

// 更新結算卡片總數值
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

  const countEl = document.getElementById('summary-card-items-count');
  if (countEl) countEl.textContent = `${totalItemsCount} 項服務`;

  const totEl = document.getElementById('summary-card-total-amount');
  if (totEl) totEl.textContent = totalAmount.toLocaleString();
}

// 儲存當前單據並同步雲端
async function saveCurrentOrder() {
  if (appState.staff.length === 0) {
    alert('系統中尚無人員！請先點擊上方提示或前往「設定」新增第一位設計師！');
    if (currentUserRole === 'admin') openStaffModal();
    return;
  }

  if (currentBillingRows.length === 0) {
    alert('請至少新增一項服務項目！');
    return;
  }

  // 管理員與員工開單同一套：直接綁定當前登入之人員身分
  if (!currentLinkedStaff) {
    if (currentUserRole === 'admin') {
      alert('您的管理員帳號尚未綁定店內設計師身分，目前無法開單！請先至「設定」綁定或新增人員。');
      openStaffModal();
    } else {
      alert('您的帳號尚未由管理員綁定店內人員身分，目前無法開單！請聯繫管理員協助綁定。');
    }
    return;
  }

  const staff = currentLinkedStaff;

  const dateVal = document.getElementById('billing-date').value || new Date().toISOString().split('T')[0];
  const customer = document.getElementById('billing-customer').value.trim() || '現場顧客';
  const notes = document.getElementById('billing-notes').value.trim();
  const assistantId = '';
  const assistant = null;

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
      amount: amount, // 顧客實付金額
      commission: commission // 設計師應得抽成
    };
  });

  let totalAmount = 0;
  let totalCommission = 0;
  itemsDetail.forEach(item => {
    totalAmount += item.amount;
    totalCommission += item.commission;
  });

  const assistantComm = 0;
  const salonNet = Math.max(0, totalAmount - totalCommission);
  const rawOrderNo = document.getElementById('billing-order-no').textContent.replace('單號：', '').trim();

  const newOrder = {
    id: 'ord-' + Date.now(),
    orderNo: rawOrderNo,
    date: dateVal,
    staffId: staff.id,
    staffName: staff.name,
    assistantId: '',
    assistantName: '',
    customer: customer,
    notes: notes,
    items: itemsDetail,
    totalAmount: totalAmount,
    totalCommission: totalCommission,
    assistantCommission: 0,
    salonNet: salonNet,
    createdAt: new Date().toISOString()
  };

  appState.orders.unshift(newOrder);
  await syncDataToCloud();

  showToast(`開單成功！顧客消費 NT$ ${totalAmount.toLocaleString()}`);
  resetBillingForm();
}

// 重設開單表單
function resetBillingForm() {
  const custInput = document.getElementById('billing-customer');
  if (custInput) custInput.value = '';
  const notesInput = document.getElementById('billing-notes');
  if (notesInput) notesInput.value = '';
  const asstSelect = document.getElementById('billing-assistant-select');
  if (asstSelect) asstSelect.value = '';
  const billingStaffInput = document.getElementById('billing-staff-select');
  if (billingStaffInput && currentLinkedStaff) {
    billingStaffInput.value = currentLinkedStaff.id;
  }
  generateNewOrderNo();
  currentBillingRows = [];
  addServiceRow();
}
