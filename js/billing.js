/**
 * SalonPay - 現場開單抽成試算 (js/billing.js)
 */

// 渲染所有設計師/助理下拉選單
function populateStaffDropdowns() {
  const billingStaff = document.getElementById('billing-staff-select');
  const billingAssistant = document.getElementById('billing-assistant-select');
  const historyStaff = document.getElementById('history-filter-staff');
  const monthlyStaff = document.getElementById('monthly-select-staff');

  updateLinkedStaff();

  if (billingStaff) {
    if (currentUserRole === 'staff') {
      if (currentLinkedStaff) {
        billingStaff.innerHTML = `<option value="${currentLinkedStaff.id}">${currentLinkedStaff.name} (${currentLinkedStaff.role})</option>`;
        billingStaff.value = currentLinkedStaff.id;
        billingStaff.disabled = true;
      } else {
        billingStaff.innerHTML = `<option value="">⚠️ 帳號尚未綁定店內人員 (請聯繫管理員)</option>`;
        billingStaff.disabled = true;
      }
    } else {
      billingStaff.disabled = false;
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
  }

  if (billingAssistant) {
    billingAssistant.innerHTML = `
      <option value="">無助理協助（全由設計師操作）</option>
      ${appState.staff.map(s => `<option value="${s.id}">${s.name} (${s.role})</option>`).join('')}
    `;
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
          <option value="${s.id}">${s.name} (${s.role})</option>
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

  const discountOptions = DISCOUNT_OPTIONS;
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

  if (window.lucide) lucide.createIcons();
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

  let staffId = document.getElementById('billing-staff-select').value;
  if (currentUserRole === 'staff') {
    if (!currentLinkedStaff) {
      alert('您的帳號尚未由管理員綁定店內人員身分，目前無法開單！請聯繫管理員協助綁定。');
      return;
    }
    staffId = currentLinkedStaff.id;
  }

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

  if (currentUserRole === 'staff') {
    showToast(`開單成功！顧客消費 NT$ ${totalAmount.toLocaleString()}`);
  } else {
    showToast(`開單成功！業績 NT$ ${totalAmount.toLocaleString()}，抽成 NT$ ${totalCommission.toLocaleString()}`);
  }
  resetBillingForm();
}

// 重設開單表單
function resetBillingForm() {
  document.getElementById('billing-customer').value = '';
  document.getElementById('billing-notes').value = '';
  document.getElementById('billing-assistant-select').value = '';
  if (currentUserRole === 'staff' && currentLinkedStaff) {
    const billingStaff = document.getElementById('billing-staff-select');
    if (billingStaff) billingStaff.value = currentLinkedStaff.id;
  }
  generateNewOrderNo();
  currentBillingRows = [];
  addServiceRow();
}
