/**
 * SalonFlow - 歷史紀錄 (js/history.js)
 */

// 當前歷史紀錄查詢週期：'day' | 'month' | 'year'（預設為 'day'）
let currentHistoryPeriod = 'day';

function setHistoryPeriod(period) {
  if (currentHistoryPeriod === period) return;
  const prevPeriod = currentHistoryPeriod;
  currentHistoryPeriod = period;

  const dayInput = document.getElementById('history-filter-day');
  const monthInput = document.getElementById('history-filter-month');
  const yearSelect = document.getElementById('history-filter-year');

  const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
  const currentYM = typeof getCurrentYearMonth === 'function' ? getCurrentYearMonth() : todayStr.slice(0, 7);

  if (period === 'day') {
    if (dayInput && !dayInput.value) {
      dayInput.value = todayStr;
    } else if (monthInput && monthInput.value && dayInput) {
      if (todayStr.startsWith(monthInput.value)) {
        dayInput.value = todayStr;
      } else if (!dayInput.value.startsWith(monthInput.value)) {
        dayInput.value = `${monthInput.value}-01`;
      }
    }
  } else if (period === 'month') {
    if (prevPeriod === 'day' && dayInput && dayInput.value) {
      if (monthInput) monthInput.value = dayInput.value.slice(0, 7);
    } else if (prevPeriod === 'year' && yearSelect && yearSelect.value) {
      if (currentYM.startsWith(yearSelect.value)) {
        if (monthInput) monthInput.value = currentYM;
      } else {
        if (monthInput) monthInput.value = `${yearSelect.value}-01`;
      }
    } else if (monthInput && !monthInput.value) {
      monthInput.value = currentYM;
    }
  } else if (period === 'year') {
    populateHistoryYearOptions();
    if (monthInput && monthInput.value && yearSelect) {
      yearSelect.value = monthInput.value.slice(0, 4);
    }
  }

  updateHistoryPeriodUI();
  filterHistoryOrders();
}

function updateHistoryPeriodUI() {
  const periods = ['day', 'month', 'year'];
  periods.forEach(p => {
    const btn = document.getElementById(`period-btn-${p}`);
    const wrapper = document.getElementById(`history-filter-${p}-wrapper`);
    if (p === currentHistoryPeriod) {
      btn?.classList.add('bg-amber-600', 'text-white', 'shadow-sm');
      btn?.classList.remove('text-slate-600', 'hover:text-slate-900');
      wrapper?.classList.remove('hidden');
    } else {
      btn?.classList.remove('bg-amber-600', 'text-white', 'shadow-sm');
      btn?.classList.add('text-slate-600', 'hover:text-slate-900');
      wrapper?.classList.add('hidden');
    }
  });
}

function populateHistoryYearOptions() {
  const yearSelect = document.getElementById('history-filter-year');
  if (!yearSelect) return;
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear, currentYear - 1]);
  if (appState.orders) {
    appState.orders.forEach(o => {
      if (o.date) {
        const y = parseInt(o.date.split('-')[0], 10);
        if (!isNaN(y)) years.add(y);
      }
    });
  }
  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const currentVal = yearSelect.value || String(currentYear);
  yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}">${y} 年</option>`).join('');
  if (years.has(parseInt(currentVal, 10))) {
    yearSelect.value = currentVal;
  } else {
    yearSelect.value = String(currentYear);
  }
}

function initHistoryFilters() {
  const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
  const dayInput = document.getElementById('history-filter-day');
  if (dayInput && !dayInput.value) {
    dayInput.value = todayStr;
  }
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = typeof getCurrentYearMonth === 'function' ? getCurrentYearMonth() : todayStr.slice(0, 7);
  }
  populateHistoryYearOptions();
  updateHistoryPeriodUI();
}

function clearHistoryFilters() {
  const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
  const dayInput = document.getElementById('history-filter-day');
  if (dayInput) dayInput.value = todayStr;
  const monthInput = document.getElementById('history-filter-month');
  if (monthInput) monthInput.value = typeof getCurrentYearMonth === 'function' ? getCurrentYearMonth() : todayStr.slice(0, 7);
  populateHistoryYearOptions();

  const historyStaff = document.getElementById('history-filter-staff');
  if (historyStaff) {
    if (currentUserRole === 'staff') {
      historyStaff.value = currentLinkedStaff ? currentLinkedStaff.id : '';
    } else {
      historyStaff.value = 'ALL';
    }
  }
  filterHistoryOrders();
}

function filterHistoryOrders() {
  const staffVal = document.getElementById('history-filter-staff')?.value;

  let effectiveStaffId = staffVal;
  if (currentUserRole === 'staff') {
    if (currentLinkedStaff) {
      effectiveStaffId = currentLinkedStaff.id;
    } else {
      // 員工尚未綁定店內人員身分，絕不能看全店流水！顯示空列表與未綁定提示
      renderHistoryView([]);
      return;
    }
  }

  // 根據日 / 月 / 年取得比對字串
  let filterVal = '';
  const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
  if (currentHistoryPeriod === 'day') {
    const dayInput = document.getElementById('history-filter-day');
    if (dayInput && !dayInput.value) dayInput.value = todayStr;
    filterVal = dayInput?.value || todayStr;
  } else if (currentHistoryPeriod === 'year') {
    const yearSelect = document.getElementById('history-filter-year');
    if (yearSelect && !yearSelect.value) populateHistoryYearOptions();
    filterVal = yearSelect?.value || String(new Date().getFullYear());
  } else {
    // 預設為 'month'
    const monthInput = document.getElementById('history-filter-month');
    const currentYM = typeof getCurrentYearMonth === 'function' ? getCurrentYearMonth() : todayStr.slice(0, 7);
    if (monthInput && !monthInput.value) monthInput.value = currentYM;
    filterVal = monthInput?.value || currentYM;
  }

  const filtered = appState.orders.filter(order => {
    if (filterVal) {
      if (currentHistoryPeriod === 'day') {
        if (order.date !== filterVal) return false;
      } else {
        // 'month' (YYYY-MM) 或 'year' (YYYY)
        if (!order.date.startsWith(filterVal)) return false;
      }
    }
    if (effectiveStaffId && effectiveStaffId !== 'ALL' && order.staffId !== effectiveStaffId && order.assistantId !== effectiveStaffId) return false;
    return true;
  });

  renderHistoryView(filtered);
}

// 取得客單開單時間（優先取用 time 欄位，若舊客單無 time 則自 createdAt 解析本地時間）
function getOrderTimeDisplay(order) {
  if (order.time) return order.time;
  if (order.createdAt) {
    try {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) {
        return typeof getLocalTimeString === 'function' ? getLocalTimeString(d) : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    } catch (_) {}
  }
  return '';
}

// 使用客單儲存的實際單價與小計，避免服務定價變更影響歷史金額。
function renderHistoryItemPrices(items) {
  return items.map(item => {
    const amount = item.amount ?? item.price * item.qty;
    const name = String(item.name).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    return `<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span>${name}<span class="block text-[11px] text-slate-500">單價 NT$ ${item.price.toLocaleString()} × ${item.qty}</span></span>
      <strong class="font-numeric text-slate-800 whitespace-nowrap">實收 NT$ ${amount.toLocaleString()}</strong>
    </div>`;
  }).join('');
}

function renderHistoryView(ordersList) {
  if (!currentUser) return;
  const tbody = document.getElementById('history-table-body');
  const cardsContainer = document.getElementById('history-cards-mobile');
  const emptyHint = document.getElementById('history-empty-hint');
  const countEl = document.getElementById('history-count');
  const totalRevEl = document.getElementById('history-total-revenue');
  const totalCommEl = document.getElementById('history-total-commission');

  let sumRev = 0;
  let sumComm = 0;
  let activeCount = 0;
  let deletedCount = 0;

  ordersList.forEach(o => {
    if (o.isDeleted) {
      deletedCount++;
    } else {
      activeCount++;
      sumRev += o.totalAmount;
      sumComm += o.totalCommission;
    }
  });

  if (countEl) {
    if (deletedCount > 0) {
      countEl.innerHTML = `${activeCount} <span class="text-xs font-normal text-slate-400">(作廢 ${deletedCount} 筆)</span>`;
    } else {
      countEl.textContent = activeCount;
    }
  }
  if (totalRevEl) totalRevEl.textContent = `NT$ ${sumRev.toLocaleString()}`;
  if (totalCommEl) totalCommEl.textContent = `NT$ ${sumComm.toLocaleString()}`;

  if (ordersList.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (emptyHint) {
      emptyHint.classList.remove('hidden');
      if (currentUserRole === 'staff' && !currentLinkedStaff) {
        emptyHint.className = 'py-6';
        emptyHint.innerHTML = `
          <div class="p-6 text-center text-amber-800 bg-amber-50 rounded-2xl border border-amber-200">
            <i data-lucide="shield-alert" class="w-8 h-8 mx-auto mb-2 text-amber-600"></i>
            <p class="text-sm font-bold">您的帳號尚未由管理員綁定店內人員身分</p>
            <p class="text-xs text-slate-500 mt-1">為保障店內隱私，請聯繫管理員完成帳號綁定，綁定後即可在此查閱個人歷史紀錄。</p>
          </div>
        `;
      } else {
        emptyHint.className = 'py-12 text-center text-slate-400';
        emptyHint.innerHTML = `
          <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
          <p class="text-xs">尚無符合條件的客單紀錄</p>
        `;
      }
      if (window.lucide) lucide.createIcons();
    }
    return;
  }

  if (emptyHint) emptyHint.classList.add('hidden');

  // 手機專屬卡片流
  if (cardsContainer) {
    cardsContainer.innerHTML = ordersList.map(order => {
      const timeDisplay = getOrderTimeDisplay(order);
      const isDel = !!order.isDeleted;
      const delTimeStr = isDel ? (typeof formatDateTime === 'function' ? formatDateTime(order.deletedAt) : (order.deletedAt || '')) : '';

      return `
      <div class="rounded-2xl p-4 border shadow-sm space-y-2.5 transition ${isDel ? 'bg-slate-50/90 border-rose-200/80 text-slate-400' : 'bg-white border-slate-200/80'}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm ${isDel ? 'line-through text-slate-500' : 'text-slate-900'}">${order.orderNo}</span>
            <span class="text-xs ${isDel ? 'bg-slate-200 text-slate-600' : 'bg-amber-50 text-amber-800'} font-semibold px-2 py-0.5 rounded-full">${order.staffName}</span>
            ${isDel ? `<span class="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md">已作廢</span>` : ''}
          </div>
          ${isDel ? `
            <span class="text-[11px] text-rose-500 font-semibold px-1 py-0.5 select-none">已作廢</span>
          ` : `
            <button onclick="deleteOrder('${order.id}')" class="text-slate-400 hover:text-rose-600 p-1" title="作廢客單">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          `}
        </div>

        ${isDel ? `
          <div class="text-[11px] text-rose-700 bg-rose-50/90 p-2 rounded-xl border border-rose-100 flex items-center gap-1.5">
            <i data-lucide="alert-circle" class="w-3.5 h-3.5 shrink-0 text-rose-600"></i>
            <span>由 <strong>${order.deletedByName || '未知'}</strong> 於 ${delTimeStr} 刪除作廢</span>
          </div>
        ` : ''}

        <div class="text-xs ${isDel ? 'text-slate-400 line-through opacity-70' : 'text-slate-600'} space-y-2">
          ${renderHistoryItemPrices(order.items)}
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <span class="text-slate-400 font-mono">${order.date}${timeDisplay ? ` <span class="${isDel ? 'text-slate-400' : 'text-slate-600 font-semibold'} ml-1">${timeDisplay}</span>` : ''}</span>
          <div class="flex items-center gap-3">
            <span class="${isDel ? 'text-slate-400' : 'text-slate-600'}">實收: <strong class="${isDel ? 'line-through text-slate-400' : ''}">NT$ ${order.totalAmount.toLocaleString()}</strong>${isDel ? ' <span class="text-[10px] text-rose-500 font-normal">(不計)</span>' : ''}</span>
            ${currentUserRole === 'admin' ? `<span class="admin-only-inline ${isDel ? 'text-slate-400' : 'text-amber-700'} font-bold text-sm font-numeric">抽: <span class="${isDel ? 'line-through' : ''}">NT$ ${order.totalCommission.toLocaleString()}</span></span>` : ''}
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  // 電腦端表格
  if (tbody) {
    tbody.innerHTML = ordersList.map(order => {
      const timeDisplay = getOrderTimeDisplay(order);
      const isDel = !!order.isDeleted;
      const delTimeStr = isDel ? (typeof formatDateTime === 'function' ? formatDateTime(order.deletedAt) : (order.deletedAt || '')) : '';

      return `
      <tr class="hover:bg-slate-50/80 transition text-xs ${isDel ? 'bg-rose-50/30 text-slate-400' : ''}">
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="flex items-center gap-1.5">
            <div class="font-mono font-semibold ${isDel ? 'line-through text-slate-500' : 'text-slate-800'}">${order.orderNo}</div>
            ${isDel ? `<span class="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-1 py-0.2 rounded">已作廢</span>` : ''}
          </div>
          <div class="text-slate-400 font-mono">${order.date}${timeDisplay ? ` <span class="${isDel ? 'text-slate-400' : 'text-slate-600 font-semibold'} text-[11px] ml-0.5">${timeDisplay}</span>` : ''}</div>
          ${isDel ? `<div class="text-[10px] text-rose-600 mt-0.5">⚠️ 由 ${order.deletedByName || '未知'} 於 ${delTimeStr} 刪除</div>` : ''}
        </td>
        <td class="px-4 py-3 whitespace-nowrap">
          <div class="font-medium ${isDel ? 'text-slate-500' : 'text-slate-900'}">${order.staffName}</div>
          ${order.assistantName ? `<div class="text-[11px] text-blue-600">助：${order.assistantName}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <div class="text-[11px] text-slate-500">${order.notes || '—'}</div>
        </td>
        <td class="px-4 py-3">
          <div class="space-y-2 ${isDel ? 'line-through opacity-70' : ''}">${renderHistoryItemPrices(order.items)}</div>
        </td>
        <td class="px-4 py-3 text-right font-numeric font-bold ${isDel ? 'text-slate-400' : 'text-slate-800'}">
          <span class="${isDel ? 'line-through' : ''}">NT$ ${order.totalAmount.toLocaleString()}</span>
          ${isDel ? `<div class="text-[10px] text-rose-500 font-normal">(作廢不計)</div>` : ''}
        </td>
        <td class="admin-only-cell px-4 py-3 text-right font-numeric font-extrabold ${isDel ? 'text-slate-400' : 'text-amber-700'}">
          ${currentUserRole === 'admin' ? `<span class="${isDel ? 'line-through' : ''}">NT$ ${order.totalCommission.toLocaleString()}</span>` : ''}
        </td>
        <td class="px-4 py-3 text-center">
          ${isDel ? `
            <span class="text-[11px] text-rose-400 font-medium select-none">已作廢</span>
          ` : `
            <button onclick="deleteOrder('${order.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition" title="作廢客單">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          `}
        </td>
      </tr>
    `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

async function deleteOrder(orderId) {
  const order = appState.orders.find(o => o.id === orderId);
  if (!order) return;
  if (order.isDeleted) {
    alert('此客單已處於作廢狀態！');
    return;
  }
  if (currentUserRole === 'staff') {
    if (!currentLinkedStaff || order.staffId !== currentLinkedStaff.id) {
      alert('您僅能管理自己開立的客單！');
      return;
    }
  }
  if (!confirm('確定要作廢此筆客單嗎？（系統將保留作廢稽核紀錄並同步至雲端）')) return;

  // 軟刪除：保留資料並標記刪除者身分與時間
  order.isDeleted = true;
  order.deletedAt = new Date().toISOString();
  order.deletedBy = currentUser ? (currentUser.uid || '') : '';
  const deleterName = currentLinkedStaff
    ? `${currentLinkedStaff.name}${currentUserRole === 'admin' ? ' (管理員)' : ''}`
    : (currentUserRole === 'admin' ? '管理員' : (currentUser?.displayName || currentUser?.email || '店內人員'));
  order.deletedByName = deleterName;
  order.deletedByRole = currentUserRole;

  await syncDataToCloud();
  filterHistoryOrders();
  showToast('客單已標記作廢，並記錄刪除人員與時間');
}

function exportHistoryToExcel() {
  let filterVal = '';
  let periodLabel = '';
  const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];

  if (currentHistoryPeriod === 'day') {
    const dayInput = document.getElementById('history-filter-day');
    filterVal = dayInput?.value || todayStr;
    periodLabel = `${filterVal}日`;
  } else if (currentHistoryPeriod === 'year') {
    const yearSelect = document.getElementById('history-filter-year');
    filterVal = yearSelect?.value || String(new Date().getFullYear());
    periodLabel = `${filterVal}年`;
  } else {
    const monthInput = document.getElementById('history-filter-month');
    filterVal = monthInput?.value || (typeof getCurrentYearMonth === 'function' ? getCurrentYearMonth() : todayStr.slice(0, 7));
    periodLabel = `${filterVal}月`;
  }

  let staffVal = document.getElementById('history-filter-staff')?.value;
  
  if (currentUserRole === 'staff') {
    if (!currentLinkedStaff) {
      alert('您的帳號尚未由管理員綁定店內人員身分，目前無紀錄可匯出！');
      return;
    }
    staffVal = currentLinkedStaff.id;
  }

  const filtered = appState.orders.filter(order => {
    if (filterVal) {
      if (currentHistoryPeriod === 'day') {
        if (order.date !== filterVal) return false;
      } else {
        if (!order.date.startsWith(filterVal)) return false;
      }
    }
    if (currentUserRole === 'staff') {
      return order.staffId === currentLinkedStaff.id || order.assistantId === currentLinkedStaff.id;
    }
    if (staffVal && staffVal !== 'ALL' && order.staffId !== staffVal && order.assistantId !== staffVal) return false;
    return true;
  });

  if (filtered.length === 0) {
    alert('目前篩選條件下無任何紀錄可匯出！');
    return;
  }

  const exportData = [];
  filtered.forEach(o => {
    const isDel = !!o.isDeleted;
    const delAudit = isDel ? `由 ${o.deletedByName || '未知'} 於 ${typeof formatDateTime === 'function' ? formatDateTime(o.deletedAt) : (o.deletedAt || '')} 刪除` : '';

    o.items.forEach(it => {
      if (currentUserRole === 'staff') {
        exportData.push({
          '服務日期': o.date,
          '開單時間': getOrderTimeDisplay(o),
          '帳單編號': o.orderNo,
          '單況': isDel ? '已作廢(不計入)' : '有效',
          '消費服務項目': it.name,
          '單價': it.price,
          '數量': it.qty,
          '小計金額': it.amount,
          '整單實收總額': o.totalAmount,
          '備註': o.notes || '',
          '作廢稽核紀錄': delAudit
        });
      } else {
        exportData.push({
          '服務日期': o.date,
          '開單時間': getOrderTimeDisplay(o),
          '帳單編號': o.orderNo,
          '單況': isDel ? '已作廢(不計入)' : '有效',
          '主作人員': o.staffName,
          '消費服務項目': it.name,
          '單價': it.price,
          '數量': it.qty,
          '小計金額': it.amount,
          '抽成比例(%)': it.rate + '%',
          '該項抽成金額': it.commission,
          '整單總收費': o.totalAmount,
          '整單總抽成': o.totalCommission,
          '備註': o.notes || '',
          '作廢稽核紀錄': delAudit
        });
      }
    });
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '歷史紀錄明細');
  const filename = currentUserRole === 'staff' 
    ? `個人歷史紀錄_${currentLinkedStaff.name}_${periodLabel}.xlsx`
    : `沙龍歷史紀錄_${periodLabel}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('Excel 歷史紀錄已成功下載！');
}
