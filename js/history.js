/**
 * SalonFlow - 歷史帳單與每日流水 (js/history.js)
 */

function initHistoryFilters() {
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentYearMonth();
  }
}

function clearHistoryFilters() {
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput) monthInput.value = getCurrentYearMonth();
  const historyStaff = document.getElementById('history-filter-staff');
  if (historyStaff) {
    if (currentUserRole === 'staff') {
      historyStaff.value = currentLinkedStaff ? currentLinkedStaff.id : '';
    } else {
      historyStaff.value = 'ALL';
    }
  }
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
  if (currentUserRole === 'staff') {
    if (currentLinkedStaff) {
      effectiveStaffId = currentLinkedStaff.id;
    } else {
      // 員工尚未綁定店內人員身分，絕不能看全店流水！顯示空列表與專屬提示
      renderHistoryView([]);
      const emptyHint = document.getElementById('history-empty-hint');
      if (emptyHint) {
        emptyHint.classList.remove('hidden');
        emptyHint.innerHTML = `
          <div class="p-6 text-center text-amber-800 bg-amber-50 rounded-2xl border border-amber-200">
            <i data-lucide="shield-alert" class="w-8 h-8 mx-auto mb-2 text-amber-600"></i>
            <p class="text-sm font-bold">您的帳號尚未由管理員綁定店內人員身分</p>
            <p class="text-xs text-slate-500 mt-1">為保障店內隱私，請聯繫管理員完成帳號綁定，綁定後即可在此查閱個人客單流水。</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      }
      return;
    }
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
          ${order.items.map(it => `<span class="bg-slate-100 px-2 py-0.5 rounded">${it.name} (x${it.qty})</span>`).join('')}
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-slate-400 font-mono">${order.date}</span>
          <div class="flex items-center gap-3">
            <span class="text-slate-600">實收: <strong>NT$ ${order.totalAmount.toLocaleString()}</strong></span>
            ${currentUserRole === 'admin' ? `<span class="admin-only-inline text-amber-700 font-bold text-sm font-numeric">抽: NT$ ${order.totalCommission.toLocaleString()}</span>` : ''}
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
          <div>${order.items.map(i => `${i.name} (x${i.qty})`).join('、')}</div>
        </td>
        <td class="px-4 py-3 text-right font-numeric font-bold text-slate-800">NT$ ${order.totalAmount.toLocaleString()}</td>
        <td class="admin-only-cell px-4 py-3 text-right font-numeric font-extrabold text-amber-700">${currentUserRole === 'admin' ? `NT$ ${order.totalCommission.toLocaleString()}` : ''}</td>
        <td class="px-4 py-3 text-center">
          <button onclick="deleteOrder('${order.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  if (window.lucide) lucide.createIcons();
}

async function deleteOrder(orderId) {
  const order = appState.orders.find(o => o.id === orderId);
  if (!order) return;
  if (currentUserRole === 'staff') {
    if (!currentLinkedStaff || order.staffId !== currentLinkedStaff.id) {
      alert('您僅能管理自己開立的客單！');
      return;
    }
  }
  if (!confirm('確定要刪除這筆客單嗎？（將同步從雲端刪除）')) return;
  appState.orders = appState.orders.filter(o => o.id !== orderId);
  await syncDataToCloud();
  filterHistoryOrders();
  showToast('客單已從雲端刪除');
}

function exportHistoryToExcel() {
  const monthVal = document.getElementById('history-filter-month')?.value || '全部月份';
  let staffVal = document.getElementById('history-filter-staff')?.value;
  
  if (currentUserRole === 'staff') {
    if (!currentLinkedStaff) {
      alert('您的帳號尚未由管理員綁定店內人員身分，目前無客單可匯出！');
      return;
    }
    staffVal = currentLinkedStaff.id;
  }

  const filtered = appState.orders.filter(order => {
    if (monthVal && monthVal !== '全部月份' && !order.date.startsWith(monthVal)) return false;
    if (currentUserRole === 'staff') {
      return order.staffId === currentLinkedStaff.id || order.assistantId === currentLinkedStaff.id;
    }
    if (staffVal && staffVal !== 'ALL' && order.staffId !== staffVal && order.assistantId !== staffVal) return false;
    return true;
  });

  if (filtered.length === 0) {
    alert('目前篩選條件下無任何客單可匯出！');
    return;
  }

  const exportData = [];
  filtered.forEach(o => {
    o.items.forEach(it => {
      if (currentUserRole === 'staff') {
        exportData.push({
          '服務日期': o.date,
          '帳單編號': o.orderNo,
          '顧客稱呼': o.customer,
          '消費服務項目': it.name,
          '單價': it.price,
          '數量': it.qty,
          '小計金額': it.amount,
          '整單實收總額': o.totalAmount,
          '備註': o.notes || ''
        });
      } else {
        exportData.push({
          '服務日期': o.date,
          '帳單編號': o.orderNo,
          '主作人員': o.staffName,
          '顧客稱呼': o.customer,
          '消費服務項目': it.name,
          '單價': it.price,
          '數量': it.qty,
          '小計金額': it.amount,
          '抽成比例(%)': it.rate + '%',
          '該項抽成金額': it.commission,
          '整單總收費': o.totalAmount,
          '整單總抽成': o.totalCommission,
          '備註': o.notes || ''
        });
      }
    });
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '帳單流水明細');
  const filename = currentUserRole === 'staff' 
    ? `個人客單流水明細_${currentLinkedStaff.name}_${monthVal}.xlsx`
    : `沙龍客單流水報表_${monthVal}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('Excel 流水報表已成功下載！');
}
