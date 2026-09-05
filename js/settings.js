/**
 * SalonPay - 系統設定：服務項目、工作人員與帳號管理 (js/settings.js)
 */

// 下拉選單：綁定已註冊使用者
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
          ${isCurrent ? `
            <button onclick="demoteSelfToStaff()" class="text-xs px-2.5 py-1 rounded-xl font-bold border border-slate-300 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition" title="將自己的帳號降級為員工">
              降為員工
            </button>
          ` : `
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

// 修改沙龍管理員密鑰
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

// 渲染設定頁表格（服務項目與人員清單）
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
  document.getElementById('modal-service-id').value = '';
  document.getElementById('modal-service-name').value = '';
  document.getElementById('modal-service-price').value = '';
  document.getElementById('modal-service-rate').value = '50';
  document.getElementById('modal-service-title').textContent = '新增美髮服務項目';
  document.getElementById('modal-service').classList.remove('hidden');
}

function editServiceItem(serviceId) {
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
  document.getElementById('modal-staff-id').value = '';
  document.getElementById('modal-staff-name').value = '';
  document.getElementById('modal-staff-role').value = '設計師';
  populateLinkedUsersDropdown('');
  document.getElementById('modal-staff-title').textContent = '新增工作人員 / 設計師';
  document.getElementById('modal-staff').classList.remove('hidden');
}

function editStaffMember(staffId) {
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
  if (!confirm('確定要刪除這位工作人員嗎？')) return;
  appState.staff = appState.staff.filter(s => s.id !== staffId);
  await syncDataToCloud();
  populateStaffDropdowns();
  renderSettingsTables();
  showToast('人員已刪除');
}

// 備份與還原
function backupDataToJson() {
  if (currentUserRole !== 'admin') {
    alert('僅管理員有備份資料權限！');
    return;
  }
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有還原資料權限！');
    return;
  }
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
  if (currentUserRole !== 'admin') {
    alert('僅管理員有清空資料權限！');
    return;
  }
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
