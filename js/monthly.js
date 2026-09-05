/**
 * SalonFlow - 月薪結算與月報表 (js/monthly.js)
 */

function initMonthlyView() {
  const monthInput = document.getElementById('monthly-select-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentYearMonth();
  }
}

function calculateMonthlyPayroll() {
  if (currentUserRole !== 'admin') return;
  const monthInput = document.getElementById('monthly-select-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentYearMonth();
  }
  const monthVal = monthInput?.value || getCurrentYearMonth();
  
  const staffId = document.getElementById('monthly-select-staff')?.value;
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
    const itemsText = order.items.map(it => `${it.name} ($${it.price}, 抽${it.rate}%)`).join('、');

    return `
      <tr class="hover:bg-slate-50 transition text-xs">
        <td class="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800">${order.date}</td>
        <td class="px-3 py-2.5 whitespace-nowrap font-mono text-slate-500">${order.orderNo}</td>
        <td class="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-900">${order.customer}</td>
        <td class="px-3 py-2.5">
          <div class="max-w-xs truncate text-slate-600" title="${itemsText}">${itemsText}</div>
        </td>
        <td class="px-3 py-2.5 text-right font-numeric font-bold text-slate-800 whitespace-nowrap">NT$ ${order.totalAmount.toLocaleString()}</td>
        <td class="px-3 py-2.5 text-right font-numeric font-extrabold text-amber-700 whitespace-nowrap">
          NT$ ${earnedComm.toLocaleString()} ${roleTag}
        </td>
        <td class="px-3 py-2.5 text-slate-400 whitespace-nowrap">${order.notes || '-'}</td>
      </tr>
    `;
  }).join('');
}

function exportMonthlyReportExcel() {
  const monthVal = document.getElementById('monthly-select-month')?.value;
  const staffId = document.getElementById('monthly-select-staff')?.value;
  const staff = appState.staff.find(s => s.id === staffId);
  if (!staff || !monthVal) {
    alert('請先選擇欲結算匯出之員工！');
    return;
  }

  const monthlyOrders = appState.orders.filter(order => {
    return order.date.startsWith(monthVal) && (order.staffId === staffId || order.assistantId === staffId);
  });

  const wb = XLSX.utils.book_new();

  // 管理員：完整月薪資結算總表與客單抽成明細
  const commission = parseFloat(document.getElementById('calc-commission')?.value) || 0;
  const otherBonus = parseFloat(document.getElementById('calc-other-bonus')?.value) || 0;
  const netPay = Math.round(commission + otherBonus);

  const summarySheetData = [
    { '項目': '結算月份', '內容/金額': monthVal },
    { '項目': '人員姓名', '內容/金額': staff.name },
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
        '單價': it.price,
        '數量': it.qty,
        '小計金額': it.amount,
        '項目抽成率': it.rate + '%',
        '本單抽成': isMain ? it.commission : o.assistantCommission,
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
        <div><strong>人員姓名：</strong> ${staff.name}</div>
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
