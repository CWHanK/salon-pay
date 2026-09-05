/**
 * SalonFlow - 系統設定：服務項目、工作人員與帳號管理 (js/settings.js)
 */

let currentStaffBindMode = 'select';

// 切換綁定方式模式：'select' (從選單挑選) 或 'manual' (手動輸入自訂帳號)
function setStaffBindMode(mode) {
  currentStaffBindMode = mode;
  const selectWrapper = document.getElementById('staff-bind-select-wrapper');
  const manualWrapper = document.getElementById('staff-bind-manual-wrapper');
  const btnSelect = document.getElementById('btn-bind-mode-select');
  const btnManual = document.getElementById('btn-bind-mode-manual');
  const helpText = document.getElementById('staff-bind-help-text');

  if (mode === 'select') {
    selectWrapper?.classList.remove('hidden');
    manualWrapper?.classList.add('hidden');
    if (btnSelect) btnSelect.className = 'px-2.5 py-0.5 rounded-md bg-white text-slate-800 shadow-xs transition cursor-pointer';
    if (btnManual) btnManual.className = 'px-2.5 py-0.5 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer';
    if (helpText) {
      helpText.innerHTML = '📌 <strong>從選單挑選：</strong>直接點擊選單挑選已註冊人員；若該人員尚未註冊，可點右上方「手動輸入」預先綁定自訂帳號。';
    }
  } else {
    selectWrapper?.classList.add('hidden');
    manualWrapper?.classList.remove('hidden');
    if (btnManual) btnManual.className = 'px-2.5 py-0.5 rounded-md bg-white text-slate-800 shadow-xs transition cursor-pointer';
    if (btnSelect) btnSelect.className = 'px-2.5 py-0.5 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer';
    if (helpText) {
      helpText.innerHTML = '📌 <strong>手動輸入：</strong>請輸入欲預先綁定的自訂帳號；日後該人員以此帳號註冊登入時，系統會自動無縫綁定並啟用開單！';
    }
    document.getElementById('modal-staff-email')?.focus();
  }
}

// 監聽下拉選單切換
function onStaffSelectChange(val) {
  if (val === '__MANUAL__') {
    setStaffBindMode('manual');
  } else if (val) {
    const emailInput = document.getElementById('modal-staff-email');
    if (emailInput) emailInput.value = formatEmailToUsername(val);
  }
}

// 填入人員綁定選單：跳出已註冊帳號選單供管理者選擇
function populateLinkedUsersDropdown(currentLinkedEmail = '', editingStaffId = '') {
  const selectEl = document.getElementById('modal-staff-user-select');
  const emailInput = document.getElementById('modal-staff-email');

  if (selectEl) {
    let optionsHtml = '<option value="">-- 點擊展開選擇店內已註冊帳號 --</option>';

    if (allRegisteredUsers.length === 0) {
      optionsHtml += '<option value="" disabled>(目前無已註冊帳號，請切換手動輸入)</option>';
    } else {
      optionsHtml += allRegisteredUsers.map(u => {
        const username = formatEmailToUsername(u.email);
        const roleLabel = u.role === 'admin' ? '管理員' : '已註冊員工';
        const isBound = appState.staff.some(s => s.id !== editingStaffId && (
          s.linkedUid === u.uid || 
          (s.linkedEmail && s.linkedEmail.toLowerCase() === u.email.toLowerCase())
        ));
        const boundLabel = isBound ? ' · 已綁定他人' : '';
        return `<option value="${u.email}">${username} (${roleLabel}${boundLabel})</option>`;
      }).join('');
    }

    optionsHtml += '<option value="__MANUAL__">➕ 手動輸入尚未註冊的自訂帳號...</option>';
    selectEl.innerHTML = optionsHtml;
  }

  // 判斷預設選中哪一個
  if (currentLinkedEmail) {
    const norm = currentLinkedEmail.toLowerCase();
    const matchedUser = allRegisteredUsers.find(u => 
      u.email.toLowerCase() === norm || 
      formatEmailToUsername(u.email).toLowerCase() === norm ||
      formatUsernameToEmail(norm) === u.email.toLowerCase()
    );

    if (matchedUser) {
      setStaffBindMode('select');
      if (selectEl) selectEl.value = matchedUser.email;
      if (emailInput) emailInput.value = formatEmailToUsername(matchedUser.email);
    } else {
      // 找不到代表是尚未註冊的自訂帳號，切換為手動輸入模式
      setStaffBindMode('manual');
      if (emailInput) emailInput.value = formatEmailToUsername(currentLinkedEmail);
      if (selectEl) selectEl.value = '__MANUAL__';
    }
  } else {
    if (allRegisteredUsers.length > 0) {
      setStaffBindMode('select');
      if (selectEl) selectEl.value = '';
      if (emailInput) emailInput.value = '';
    } else {
      setStaffBindMode('manual');
      if (emailInput) emailInput.value = '';
    }
  }
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
    const displayAccount = formatEmailToUsername(u.email);

    return `
      <tr class="hover:bg-slate-50 transition text-xs">
        <td class="px-3 py-2.5 font-bold text-slate-800 whitespace-nowrap">
          ${displayAccount}
          ${isCurrent ? '<span class="ml-1 text-[10px] text-amber-600 font-normal bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">本人</span>' : ''}
        </td>
        <td class="px-3 py-2.5 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isAdmin ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}">
            ${isAdmin ? '管理員' : '員工'}
          </span>
        </td>
        <td class="px-3 py-2.5 text-slate-400 whitespace-nowrap">${dateStr}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap space-x-1.5">
          ${isCurrent ? `
            <button onclick="demoteSelfToStaff()" class="text-xs px-2.5 py-1 rounded-xl font-bold border border-slate-300 text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 transition" title="將自己的帳號降級為員工">
              降為員工
            </button>
          ` : `
            <button onclick="toggleUserRole('${u.uid}', '${isAdmin ? 'staff' : 'admin'}')" class="text-xs px-2.5 py-1 rounded-xl font-bold border transition ${isAdmin ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100'}">
              ${isAdmin ? '降為員工' : '升為管理員'}
            </button>
            <button onclick="startDeleteUserFlow('${u.uid}', '${u.email}')" class="text-xs px-2.5 py-1 rounded-xl font-bold border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition shadow-2xs inline-flex items-center gap-1" title="刪除此註冊帳號">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 刪除
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// 修改沙龍管理員密鑰 (以 SHA-256 雜湊儲存於獨立安全庫)
async function changeAdminSecretKey() {
  if (currentUserRole !== 'admin') {
    alert('僅管理員有此操作權限！');
    return;
  }
  const newKey = prompt('請輸入新的沙龍管理員授權密鑰（建議 6 碼以上）：');
  if (!newKey || !newKey.trim()) return;

  if (newKey.trim().length < 4) {
    alert('密鑰長度建議至少 4 碼以上！');
    return;
  }

  try {
    const keyHash = await hashSecretKey(newKey.trim());
    if (db) {
      await db.collection('salon_secrets').doc('admin').set({
        keyHash: keyHash,
        updatedAt: new Date().toISOString()
      });
    }
    salonAdminKeyHash = keyHash;
    showToast('管理員授權密鑰已成功更新並加密儲存！');
  } catch (err) {
    console.error('更新密鑰失敗:', err);
    alert('更新密鑰失敗：' + err.message);
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
          <td colspan="3" class="py-6 text-center text-xs text-slate-400">
            目前尚未建立工作人員，請點擊上方「新增人員」開始建立！
          </td>
        </tr>
      `;
    } else {
      staffTbody.innerHTML = appState.staff.map(st => `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-3 py-2.5 font-semibold text-slate-900">${st.name}</td>
          <td class="px-3 py-2.5">
            ${st.linkedEmail ? `
              <span class="inline-flex items-center gap-1.5 ${st.linkedUid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'} border px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                <span class="w-1.5 h-1.5 rounded-full ${st.linkedUid ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}"></span>
                ${formatEmailToUsername(st.linkedEmail)}
                <span class="text-[10px] font-normal opacity-80">${st.linkedUid ? '(已註冊)' : '(未註冊·待綁定)'}</span>
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
  const emailInput = document.getElementById('modal-staff-email');
  if (emailInput) emailInput.value = '';
  const roleEl = document.getElementById('modal-staff-role');
  if (roleEl) roleEl.value = '人員';
  populateLinkedUsersDropdown('', '');
  document.getElementById('modal-staff-title').textContent = '新增工作人員';
  document.getElementById('modal-staff').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
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
  const emailInput = document.getElementById('modal-staff-email');
  if (emailInput) emailInput.value = staff.linkedEmail ? formatEmailToUsername(staff.linkedEmail) : '';
  const roleEl = document.getElementById('modal-staff-role');
  if (roleEl) roleEl.value = staff.role || '人員';
  populateLinkedUsersDropdown(staff.linkedEmail || '', staff.id);
  document.getElementById('modal-staff-title').textContent = '編輯工作人員';
  document.getElementById('modal-staff').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
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
  const roleEl = document.getElementById('modal-staff-role');
  const role = roleEl ? (roleEl.value || '人員') : '人員';

  let rawInput = '';
  if (currentStaffBindMode === 'select') {
    const selectEl = document.getElementById('modal-staff-user-select');
    const selectVal = selectEl ? selectEl.value : '';
    if (!selectVal || selectVal === '__MANUAL__') {
      alert('請從選單中挑選要綁定的帳號，或點右上角切換至「手動輸入」！');
      selectEl?.focus();
      return;
    }
    rawInput = formatEmailToUsername(selectVal);
  } else {
    const emailInput = document.getElementById('modal-staff-email');
    rawInput = (emailInput ? emailInput.value : '').trim();
    if (!rawInput) {
      alert('請輸入人員綁定的自訂帳號（即使該人員「尚未註冊」亦可輸入，等日後註冊時系統會自動對應綁定）！');
      emailInput?.focus();
      return;
    }
  }

  const linkedEmail = formatUsernameToEmail(rawInput);

  if (!name) {
    alert('請輸入人員姓名！');
    document.getElementById('modal-staff-name')?.focus();
    return;
  }

  // 檢查此帳號是否已經在全店使用者中註冊過
  const registeredUser = allRegisteredUsers.find(u => 
    u.email && (
      u.email.toLowerCase() === linkedEmail.toLowerCase() ||
      formatEmailToUsername(u.email).toLowerCase() === rawInput.toLowerCase()
    )
  );
  const linkedUid = registeredUser ? registeredUser.uid : '';

  if (id) {
    const s = appState.staff.find(item => item.id === id);
    if (s) {
      s.name = name;
      s.role = role;
      s.linkedUid = linkedUid || (s.linkedEmail === linkedEmail ? s.linkedUid : '');
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

  const tipText = registeredUser ? '已對應現有註冊帳號' : '已預先綁定未註冊帳號，日後註冊即可直接連線！';
  showToast(`已儲存人員：${name} (${tipText})`);
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
  downloadAnchor.setAttribute("download", `SalonFlow_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('已匯出系統備份檔案！');
}

// ==================== 刪除已註冊帳號雙重安全確認機制 ====================
let pendingDeleteUser = null;
let deleteUserCountdownTimer = null;
let deleteUserCountdownSeconds = 5;

// 第 1 步：啟動雙重確認流程，彈出第一道確認視窗
function startDeleteUserFlow(uid, email) {
  if (currentUserRole !== 'admin') {
    alert('僅管理員有刪除帳號權限！');
    return;
  }
  if (currentUser && currentUser.uid === uid) {
    alert('不可刪除您目前正在登入使用的管理員帳號！');
    return;
  }

  pendingDeleteUser = { uid, email };

  const displayEl1 = document.getElementById('delete-user-email-display-1');
  if (displayEl1) displayEl1.textContent = formatEmailToUsername(email);

  document.getElementById('delete-user-step-1')?.classList.remove('hidden');
  document.getElementById('delete-user-step-2')?.classList.add('hidden');
  document.getElementById('modal-delete-user')?.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}

// 第 2 步：通過第一道確認，進入第二道安全確認 (強制倒數 5 秒防誤觸)
function proceedToDeleteUserStep2() {
  if (!pendingDeleteUser) return;

  const displayEl2 = document.getElementById('delete-user-email-display-2');
  if (displayEl2) displayEl2.textContent = formatEmailToUsername(pendingDeleteUser.email);

  document.getElementById('delete-user-step-1')?.classList.add('hidden');
  document.getElementById('delete-user-step-2')?.classList.remove('hidden');

  const confirmBtn = document.getElementById('btn-confirm-delete-user');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.className = 'flex-1 py-2.5 bg-slate-200 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed transition flex items-center justify-center gap-1.5';
    confirmBtn.innerHTML = `請稍候 (<span id="delete-countdown-num">5</span>s)`;
  }

  deleteUserCountdownSeconds = 5;
  if (deleteUserCountdownTimer) clearInterval(deleteUserCountdownTimer);

  deleteUserCountdownTimer = setInterval(() => {
    deleteUserCountdownSeconds--;
    const numEl = document.getElementById('delete-countdown-num');
    if (numEl) numEl.textContent = deleteUserCountdownSeconds;

    if (deleteUserCountdownSeconds <= 0) {
      clearInterval(deleteUserCountdownTimer);
      deleteUserCountdownTimer = null;

      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.className = 'flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer';
        confirmBtn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> 確定徹底刪除此帳號`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }, 1000);

  if (window.lucide) lucide.createIcons();
}

// 關閉刪除確認視窗並停止計時器
function closeDeleteUserModal() {
  if (deleteUserCountdownTimer) {
    clearInterval(deleteUserCountdownTimer);
    deleteUserCountdownTimer = null;
  }
  pendingDeleteUser = null;
  document.getElementById('modal-delete-user')?.classList.add('hidden');
}

// 執行最終刪除帳號操作 (需通過兩道確認後觸發)
async function executeDeleteUser() {
  if (!pendingDeleteUser) return;
  if (currentUserRole !== 'admin') {
    alert('僅管理員有刪除帳號權限！');
    closeDeleteUserModal();
    return;
  }

  const { uid, email } = pendingDeleteUser;
  const confirmBtn = document.getElementById('btn-confirm-delete-user');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '刪除處理中...';
  }

  try {
    // 1. 從 Firestore salon_users 集合中永久刪除此文件
    await db.collection('salon_users').doc(uid).delete();

    // 2. 若該使用者已綁定到店內人員，自動解除該人員的 UID 綁定
    let hasUpdatedStaff = false;
    appState.staff.forEach(s => {
      if (s.linkedUid === uid) {
        s.linkedUid = '';
        hasUpdatedStaff = true;
      }
    });

    if (hasUpdatedStaff) {
      await syncDataToCloud();
    }

    closeDeleteUserModal();
    renderUsersTable();
    renderSettingsTables();
    showToast(`已成功徹底刪除帳號：${formatEmailToUsername(email)}`);
  } catch (err) {
    console.error('刪除帳號失敗:', err);
    alert('刪除帳號失敗：' + err.message);
    closeDeleteUserModal();
  }
}
