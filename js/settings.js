

let currentStaffBindMode = 'select';

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
      helpText.innerHTML = '';
      helpText.classList.add('hidden');
    }
  } else {
    selectWrapper?.classList.add('hidden');
    manualWrapper?.classList.remove('hidden');
    if (btnManual) btnManual.className = 'px-2.5 py-0.5 rounded-md bg-white text-slate-800 shadow-xs transition cursor-pointer';
    if (btnSelect) btnSelect.className = 'px-2.5 py-0.5 rounded-md text-slate-500 hover:text-slate-800 transition cursor-pointer';
    if (helpText) {
      helpText.innerHTML = '';
      helpText.classList.add('hidden');
    }
    document.getElementById('modal-staff-email')?.focus();
  }
}

function onStaffSelectChange(val) {
  if (val === '__MANUAL__') {
    setStaffBindMode('manual');
  } else if (val) {
    const emailInput = document.getElementById('modal-staff-email');
    if (emailInput) emailInput.value = formatEmailToUsername(val);
  }
}

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

async function changeAdminSecretKey() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }
  const newKey = await appPrompt('請輸入新的沙龍管理員授權密鑰（建議 6 碼以上）：', '', { title: '修改管理員授權密鑰', inputType: 'text' });
  if (!newKey || !newKey.trim()) return;

  if (newKey.trim().length < 4) {
    appAlert('密鑰長度建議至少 4 碼以上！');
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
    appAlert('更新密鑰失敗：' + err.message);
  }
}

async function changeRegistrationSecretKey() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }
  const newKey = await appPrompt('請輸入新的店家註冊密鑰（全店員工與管理員註冊帳號時皆需輸入）：', '', { title: '修改店家註冊密鑰', inputType: 'text' });
  if (!newKey || !newKey.trim()) return;

  if (newKey.trim().length < 4) {
    appAlert('密鑰長度建議至少 4 碼以上！');
    return;
  }

  try {
    const keyHash = await hashSecretKey(newKey.trim());
    if (db) {
      await db.collection('salon_secrets').doc('registration').set({
        keyHash: keyHash,
        updatedAt: new Date().toISOString(),
        description: '店家註冊密鑰 (員工與管理員註冊時皆需驗證)'
      });
    }
    salonRegKeyHash = keyHash;
    showToast('店家註冊密鑰已成功更新並加密儲存！');
  } catch (err) {
    console.error('更新店家註冊密鑰失敗:', err);
    appAlert('更新店家註冊密鑰失敗：' + err.message);
  }
}

async function initRegistrationSecretInCloud() {
  if (!db || currentUserRole !== 'admin') return;
  try {
    const regSecretRef = db.collection('salon_secrets').doc('registration');
    const doc = await regSecretRef.get();
    if (!doc.exists) {
      const defaultHash = typeof DEFAULT_REGISTRATION_KEY_HASH !== 'undefined'
        ? DEFAULT_REGISTRATION_KEY_HASH 
        : '8f48ecba137b707f170ce4fa4970c16ed27cd22a3deb33f558840f830692ef25';
      await regSecretRef.set({
        keyHash: defaultHash,
        updatedAt: new Date().toISOString(),
        description: '店家註冊密鑰 (員工與管理員註冊時皆需驗證)'
      });
      console.log('已自動將預設店家註冊密鑰加密寫入資料庫 (salon_secrets/registration)');
    } else if (doc.data() && doc.data().keyHash) {
      salonRegKeyHash = doc.data().keyHash;
    }
  } catch (err) {
    console.warn('檢查/初始化店家註冊密鑰庫失敗:', err);
  }
}

let isServicesListExpanded = typeof localStorage !== 'undefined' ? (localStorage.getItem('SALON_SERVICES_EXPANDED') !== 'false') : true;

function applyServicesExpandUI() {
  const container = document.getElementById('settings-services-scroll-container');
  const btn = document.getElementById('btn-toggle-services-expand');
  if (!container || !btn) return;

  if (isServicesListExpanded) {
    container.classList.remove('max-h-[360px]', 'overflow-y-auto');
    container.classList.add('overflow-y-visible');
    btn.innerHTML = '<i data-lucide="chevrons-down-up" class="w-3.5 h-3.5"></i> <span id="text-toggle-services-expand">收合為捲動</span>';
    btn.title = '點擊收合為固定高度捲動模式';
  } else {
    container.classList.add('max-h-[360px]', 'overflow-y-auto');
    container.classList.remove('overflow-y-visible');
    btn.innerHTML = '<i data-lucide="chevrons-up-down" class="w-3.5 h-3.5"></i> <span id="text-toggle-services-expand">展開全部</span>';
    btn.title = '點擊展開全部項目一覽無遺';
  }
  if (window.lucide) lucide.createIcons();
}

function toggleServicesExpand() {
  isServicesListExpanded = !isServicesListExpanded;
  if (typeof localStorage !== 'undefined') localStorage.setItem('SALON_SERVICES_EXPANDED', isServicesListExpanded ? 'true' : 'false');
  applyServicesExpandUI();
}

let currentServiceCategoryFilter = 'ALL';

function setServiceCategoryFilter(category) {
  currentServiceCategoryFilter = category;
  renderSettingsTables();
  // 手機上分類列可左右滑動，確保選中的分類保持在畫面內
  document.getElementById(`filter-srv-${category}`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function getCategoryBadge(cat) {
  const badgeMap = {
    '剪髮': 'bg-amber-100 text-amber-800 border-amber-200',
    '洗頭': 'bg-blue-100 text-blue-800 border-blue-200',
    '去角質': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    '護髮': 'bg-purple-100 text-purple-800 border-purple-200',
    '染髮': 'bg-rose-100 text-rose-800 border-rose-200',
    '燙髮': 'bg-sky-100 text-sky-800 border-sky-200',
    '產品銷售': 'bg-teal-100 text-teal-800 border-teal-200'
  };
  const cls = badgeMap[cat] || 'bg-slate-100 text-slate-700 border-slate-200';
  return `<span class="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${cls}">${cat || '其他'}</span>`;
}

async function restoreDefaultServices() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }
  if (!(await appConfirm('會補齊店內所有標準服務與產品項目，先前刪除的內建項目也會一併恢復。\n\n現有已修改的價格、抽成與自訂項目皆會完整保留。', { title: '補齊標準項目', okText: '補齊' }))) {
    return;
  }
  // 補齊時一併恢復先前刪除的內建項目
  appState.deletedServiceIds = [];
  if (typeof ensureServicesSynced === 'function') {
    appState.services = ensureServicesSynced(appState.services, []);
  }
  await syncDataToCloud('services');
  renderSettingsTables();
  if (typeof renderPosWizard === 'function') renderPosWizard();
  showToast('已成功補齊標準服務項目');
}

function renderSettingsTables() {
  if (currentUserRole !== 'admin') {
    const srvTbody = document.getElementById('settings-services-tbody');
    if (srvTbody) srvTbody.innerHTML = '';
    const staffTbody = document.getElementById('settings-staff-tbody');
    if (staffTbody) staffTbody.innerHTML = '';
    return;
  }

  const allServices = (appState && Array.isArray(appState.services)) ? appState.services : [];
  const countBadge = document.getElementById('settings-services-count-badge');
  if (countBadge) {
    countBadge.textContent = `共 ${allServices.length} 項服務`;
  }
  applyServicesExpandUI();

  const filterTabs = ['ALL', '剪髮', '洗頭', '去角質', '護髮', '染髮', '燙髮', '產品銷售'];
  filterTabs.forEach(cat => {
    const tabEl = document.getElementById(`filter-srv-${cat}`);
    if (tabEl) {
      if (cat === currentServiceCategoryFilter) {
        tabEl.className = 'service-cat-tab px-3 py-1.5 rounded-xl font-bold transition bg-amber-600 text-white shadow-xs';
      } else {
        tabEl.className = 'service-cat-tab px-3 py-1.5 rounded-xl font-bold transition bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    }
  });

  const filteredServices = currentServiceCategoryFilter === 'ALL'
    ? allServices
    : allServices.filter(s => s.category === currentServiceCategoryFilter);

  const srvTbody = document.getElementById('settings-services-tbody');
  if (srvTbody) {
    if (filteredServices.length === 0) {
      srvTbody.innerHTML = `
        <div class="py-8 text-center text-xs text-slate-400">
          目前「${currentServiceCategoryFilter === 'ALL' ? '全部' : currentServiceCategoryFilter}」分類中尚無項目
        </div>
      `;
    } else {
      srvTbody.innerHTML = filteredServices.map(s => {
        const empPriceBadge = (s.category === '產品銷售' && typeof s.empPrice === 'number' && s.empPrice < s.price)
          ? `<div class="text-[10px] text-emerald-700 font-bold mt-0.5">員工價 NT$ ${s.empPrice.toLocaleString()}</div>`
          : '';

        const rNum = typeof s.rate === 'number' ? s.rate : 0;
        const commAmt = Math.round(s.price * (rNum / 100));
        const sNet = Math.max(0, s.price - commAmt);
        // 清單式版面：名稱可完整換行，價格資訊在第二行，窄螢幕手機也不會擠成一行兩個字
        return `
          <div class="py-3 flex items-start justify-between gap-3 hover:bg-slate-50/70 transition">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-slate-900 text-sm leading-snug">${escapeHtml(s.name)}</span>
                ${getCategoryBadge(s.category)}
                ${s.allowDiscount ? '<span class="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-md border bg-amber-50 text-amber-700 border-amber-200">可打折</span>' : ''}
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-numeric">
                <span class="whitespace-nowrap text-slate-500">定價 <b class="text-slate-800">NT$ ${s.price.toLocaleString()}</b></span>
                <span class="whitespace-nowrap text-slate-500">抽成 <b class="text-amber-700">${rNum}%</b> <span class="text-emerald-700 font-bold">NT$ ${commAmt.toLocaleString()}</span></span>
                <span class="whitespace-nowrap text-slate-400">店家 NT$ ${sNet.toLocaleString()}</span>
              </div>
              ${empPriceBadge}
            </div>
            <div class="shrink-0 flex items-center gap-1">
              <button onclick="editServiceItem('${s.id}')" class="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition">編輯</button>
              <button onclick="deleteServiceItem('${s.id}')" class="text-xs font-bold px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition">刪除</button>
            </div>
          </div>
        `;
      }).join('');
    }
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
          <td class="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">${st.name}</td>
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
  if (typeof initBatchSettingsUI === 'function') initBatchSettingsUI();
}

function onServiceModalCategoryChange(category) {
  updateServiceModalPreview();
  const wrapper = document.getElementById('modal-service-empprice-wrapper');
  if (wrapper) {
    if (category === '產品銷售') {
      wrapper.classList.remove('hidden');
    } else {
      wrapper.classList.add('hidden');
    }
  }
}

function openServiceModal() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }
  document.getElementById('modal-service-id').value = '';
  document.getElementById('modal-service-name').value = '';
  document.getElementById('modal-service-price').value = '';
  document.getElementById('modal-service-rate').value = '50';
  const defaultCat = currentServiceCategoryFilter !== 'ALL' ? currentServiceCategoryFilter : '剪髮';
  document.getElementById('modal-service-category').value = defaultCat;
  const empPriceInput = document.getElementById('modal-service-empprice');
  if (empPriceInput) empPriceInput.value = '';
  const allowDiscountCheckbox = document.getElementById('modal-service-allow-discount');
  if (allowDiscountCheckbox) {
    allowDiscountCheckbox.checked = (defaultCat === '產品銷售');
  }
  onServiceModalCategoryChange(defaultCat);
  document.getElementById('modal-service-title').textContent = '新增美髮服務項目';
  updateServiceModalPreview();
  document.getElementById('modal-service').classList.remove('hidden');
}

function editServiceItem(serviceId) {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }
  const srv = appState.services.find(s => s.id === serviceId);
  if (!srv) return;

  document.getElementById('modal-service-id').value = srv.id;
  document.getElementById('modal-service-name').value = srv.name;
  document.getElementById('modal-service-price').value = srv.price;
  document.getElementById('modal-service-rate').value = typeof srv.rate === 'number' ? srv.rate : 0;
  document.getElementById('modal-service-category').value = srv.category || '剪髮';
  const empPriceInput = document.getElementById('modal-service-empprice');
  if (empPriceInput) {
    empPriceInput.value = (typeof srv.empPrice === 'number') ? srv.empPrice : '';
  }
  const allowDiscountCheckbox = document.getElementById('modal-service-allow-discount');
  if (allowDiscountCheckbox) {
    allowDiscountCheckbox.checked = !!srv.allowDiscount;
  }
  onServiceModalCategoryChange(srv.category || '剪髮');
  document.getElementById('modal-service-title').textContent = '編輯服務項目';
  updateServiceModalPreview();
  document.getElementById('modal-service').classList.remove('hidden');
}

function closeServiceModal() {
  document.getElementById('modal-service').classList.add('hidden');
}

async function saveServiceItem() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }
  const id = document.getElementById('modal-service-id').value;
  const name = document.getElementById('modal-service-name').value.trim();
  const price = parseFloat(document.getElementById('modal-service-price').value) || 0;
  const rate = parseFloat(document.getElementById('modal-service-rate').value) || 0;
  const category = document.getElementById('modal-service-category').value;
  const empPriceRaw = document.getElementById('modal-service-empprice')?.value?.trim();
  const empPrice = empPriceRaw ? parseFloat(empPriceRaw) : (category === '產品銷售' ? Math.round(price * 0.9) : null);
  const allowDiscount = !!document.getElementById('modal-service-allow-discount')?.checked;

  if (!name) {
    appAlert('請輸入服務項目名稱！');
    return;
  }

  if (id) {
    const item = appState.services.find(s => s.id === id);
    if (item) {
      item.name = name;
      item.price = price;
      item.rate = rate;
      item.category = category;
      item.allowDiscount = allowDiscount;
      if (category === '產品銷售') {
        item.empPrice = empPrice !== null ? empPrice : Math.round(price * 0.9);
      } else {
        delete item.empPrice;
      }
    }
  } else {
    const newItem = {
      id: 'srv-' + Date.now(),
      name: name,
      price: price,
      rate: rate,
      category: category,
      allowDiscount: allowDiscount
    };
    if (category === '產品銷售' && empPrice !== null) {
      newItem.empPrice = empPrice;
    }
    appState.services.push(newItem);
  }

  await syncDataToCloud('services');
  closeServiceModal();
  renderSettingsTables();
  if (typeof renderPosWizard === 'function') renderPosWizard();
  showToast('服務項目已同步更新');
}

async function deleteServiceItem(serviceId) {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }
  if (appState.services.length <= 1) {
    appAlert('至少需保留一項服務項目！');
    return;
  }
  const targetService = appState.services.find(s => s.id === serviceId);
  if (!(await appConfirm(`「${targetService?.name || '此項目'}」刪除後不會再出現在開單畫面（已開立的客單不受影響）。\n\n內建項目日後可用「補齊標準項目」恢復。`, { title: '確定刪除此服務項目？', okText: '刪除', danger: true }))) return;
  appState.services = appState.services.filter(s => s.id !== serviceId);
  // 刪除內建項目時記錄下來，避免同步時被自動補回（可由「補齊標準項目」恢復）
  const isDefaultService = typeof DEFAULT_SERVICES !== 'undefined' && DEFAULT_SERVICES.some(d => d.id === serviceId);
  if (isDefaultService) {
    const deletedIds = Array.isArray(appState.deletedServiceIds) ? appState.deletedServiceIds : [];
    if (!deletedIds.includes(serviceId)) appState.deletedServiceIds = [...deletedIds, serviceId];
  }
  await syncDataToCloud('services');
  renderSettingsTables();
  if (typeof renderPosWizard === 'function') renderPosWizard();
  showToast('項目已刪除');
}

function openStaffModal() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
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
    appAlert('僅管理員有此操作權限！');
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
    appAlert('僅管理員有此操作權限！');
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
      appAlert('請從選單中挑選要綁定的帳號，或點右上角切換至「手動輸入」！');
      selectEl?.focus();
      return;
    }
    rawInput = formatEmailToUsername(selectVal);
  } else {
    const emailInput = document.getElementById('modal-staff-email');
    rawInput = (emailInput ? emailInput.value : '').trim();
    if (!rawInput) {
      appAlert('請輸入人員綁定的自訂帳號（即使該人員「尚未註冊」亦可輸入，等日後註冊時系統會自動對應綁定）！');
      emailInput?.focus();
      return;
    }
  }

  const linkedEmail = formatUsernameToEmail(rawInput);

  if (!name) {
    appAlert('請輸入人員姓名！');
    document.getElementById('modal-staff-name')?.focus();
    return;
  }

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

  await syncDataToCloud('staff');
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
    appAlert('僅管理員有此操作權限！');
    return;
  }
  const targetStaff = appState.staff.find(s => s.id === staffId);
  if (!(await appConfirm(`確定要刪除「${targetStaff?.name || '這位工作人員'}」嗎？（已開立的客單不受影響）`, { title: '刪除工作人員', okText: '刪除', danger: true }))) return;
  appState.staff = appState.staff.filter(s => s.id !== staffId);
  await syncDataToCloud('staff');
  populateStaffDropdowns();
  renderSettingsTables();
  showToast('人員已刪除');
}

async function backupDataToJson() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有備份資料權限！');
    return;
  }
  // 客單分散在每日文件中，備份前先讀取全部日期
  let allOrders = appState.orders;
  try {
    if (typeof fetchAllOrdersForBackup === 'function') {
      showToast('正在讀取全部客單…');
      allOrders = await fetchAllOrdersForBackup();
    }
  } catch (err) {
    console.error('讀取全部客單失敗:', err);
    appAlert('讀取全部客單失敗，備份未完成：' + (err && err.message ? err.message : ''), { title: '備份未完成' });
    return;
  }
  const backup = {
    exportedAt: new Date().toISOString(),
    appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '',
    services: appState.services,
    staff: appState.staff,
    deletedServiceIds: appState.deletedServiceIds || [],
    orders: allOrders
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const dataStr = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `SalonFlow_Backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(dataStr), 1000);
  showToast(`已匯出系統備份檔案（共 ${allOrders.length} 張客單）！`);
}

let pendingDeleteUser = null;
let deleteUserCountdownTimer = null;
let deleteUserCountdownSeconds = 5;

function startDeleteUserFlow(uid, email) {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有刪除帳號權限！');
    return;
  }
  if (currentUser && currentUser.uid === uid) {
    appAlert('不可刪除您目前正在登入使用的管理員帳號！');
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

function closeDeleteUserModal() {
  if (deleteUserCountdownTimer) {
    clearInterval(deleteUserCountdownTimer);
    deleteUserCountdownTimer = null;
  }
  pendingDeleteUser = null;
  document.getElementById('modal-delete-user')?.classList.add('hidden');
}

async function executeDeleteUser() {
  if (!pendingDeleteUser) return;
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有刪除帳號權限！');
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
    await db.collection('salon_users').doc(uid).delete();

    let hasUpdatedStaff = false;
    appState.staff.forEach(s => {
      if (s.linkedUid === uid) {
        s.linkedUid = '';
        hasUpdatedStaff = true;
      }
    });

    if (hasUpdatedStaff) {
      await syncDataToCloud('staff');
    }

    closeDeleteUserModal();
    renderUsersTable();
    renderSettingsTables();
    showToast(`已成功徹底刪除帳號：${formatEmailToUsername(email)}`);
  } catch (err) {
    console.error('刪除帳號失敗:', err);
    appAlert('刪除帳號失敗：' + err.message);
    closeDeleteUserModal();
  }
}

function updateServiceModalPreview() {
  const priceInput = document.getElementById('modal-service-price');
  const rateInput = document.getElementById('modal-service-rate');
  const previewText = document.getElementById('modal-service-preview-text');
  if (!previewText) return;
  const price = parseFloat(priceInput?.value) || 0;
  const rate = parseFloat(rateInput?.value) || 0;
  const comm = Math.round(price * (rate / 100));
  const net = Math.max(0, price - comm);
  previewText.textContent = 'NT$ ' + comm.toLocaleString() + ' (店家淨額: NT$ ' + net.toLocaleString() + ')';
}

// 管理員手動校正並同步當前版本至雲端廣播
async function syncAppVersionToCloud() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有權執行此操作！');
    return;
  }
  if (!db) {
    appAlert('尚未連線至 Firebase 雲端！');
    return;
  }
  try {
    const storeDocRef = db.collection('salon_stores').doc('main_store');
    const targetVer = (typeof CURRENT_APP_VERSION !== 'undefined') ? CURRENT_APP_VERSION : APP_VERSION;
    await storeDocRef.set({ appVersion: targetVer }, { merge: true });
    if (typeof showToast === 'function') {
      showToast(`已成功將雲端版本廣播校正為 v${targetVer}`);
    }
  } catch (e) {
    console.error('同步雲端版本失敗:', e);
    appAlert('同步失敗: ' + (e.message || e));
  }
}

let currentBatchCategory = '剪髮';

function initBatchSettingsUI() {
  const allGenderCb = document.getElementById('batch-gender-all');
  const maleCb = document.getElementById('batch-gender-male');
  const femaleCb = document.getElementById('batch-gender-female');
  const allIdCb = document.getElementById('batch-id-all');
  const priceInput = document.getElementById('batch-price');
  const rateInput = document.getElementById('batch-rate');

  if (!priceInput || !rateInput) return;

  if (maleCb && !maleCb.checked && femaleCb && !femaleCb.checked && allGenderCb && !allGenderCb.checked) {
    maleCb.checked = true;
  }
  if (allIdCb && !allIdCb.checked) {
    allIdCb.checked = true;
    ['emp', 'ret', 'fam', 'ext'].forEach(k => {
      const cb = document.getElementById(`batch-id-${k}`);
      if (cb) cb.checked = true;
    });
  }

  setBatchSelectedCategory(currentBatchCategory);
}

function setBatchSelectedCategory(cat) {
  currentBatchCategory = cat;
  const cats = ['剪髮', '洗頭', '去角質', '護髮', '染髮', '燙髮', '產品銷售'];
  cats.forEach(c => {
    const btn = document.getElementById(`batch-cat-${c}`);
    if (btn) {
      if (c === cat) {
        btn.className = 'batch-cat-btn px-3 py-1.5 rounded-xl font-bold transition bg-amber-600 text-white shadow-xs';
      } else {
        btn.className = 'batch-cat-btn px-3 py-1.5 rounded-xl font-bold transition bg-slate-100 text-slate-600 hover:bg-slate-200';
      }
    }
  });
  syncBatchInputsFromMatched();
}

function toggleBatchGenderAll(checked) {
  const maleCb = document.getElementById('batch-gender-male');
  const femaleCb = document.getElementById('batch-gender-female');
  if (maleCb) maleCb.checked = checked;
  if (femaleCb) femaleCb.checked = checked;
  syncBatchInputsFromMatched();
}

function onBatchGenderChange() {
  const allCb = document.getElementById('batch-gender-all');
  const maleCb = document.getElementById('batch-gender-male');
  const femaleCb = document.getElementById('batch-gender-female');
  if (allCb && maleCb && femaleCb) {
    allCb.checked = maleCb.checked && femaleCb.checked;
  }
  syncBatchInputsFromMatched();
}

function toggleBatchIdentityAll(checked) {
  ['emp', 'ret', 'fam', 'ext'].forEach(k => {
    const cb = document.getElementById(`batch-id-${k}`);
    if (cb) cb.checked = checked;
  });
  syncBatchInputsFromMatched();
}

function onBatchIdentityChange() {
  const allCb = document.getElementById('batch-id-all');
  const ids = ['emp', 'ret', 'fam', 'ext'];
  const allChecked = ids.every(k => {
    const cb = document.getElementById(`batch-id-${k}`);
    return cb && cb.checked;
  });
  if (allCb) allCb.checked = allChecked;
  syncBatchInputsFromMatched();
}

function getBatchSelectedGenders() {
  const allCb = document.getElementById('batch-gender-all');
  const maleCb = document.getElementById('batch-gender-male');
  const femaleCb = document.getElementById('batch-gender-female');
  if (allCb?.checked) return ['male', 'female'];
  const selected = [];
  if (maleCb?.checked) selected.push('male');
  if (femaleCb?.checked) selected.push('female');
  if (selected.length === 0) return ['male', 'female'];
  return selected;
}

function getBatchSelectedIdentities() {
  const allCb = document.getElementById('batch-id-all');
  const idMap = {
    'batch-id-emp': 'employee',
    'batch-id-ret': 'retiree',
    'batch-id-fam': 'family',
    'batch-id-ext': 'external'
  };
  if (allCb?.checked) return ['employee', 'retiree', 'family', 'external'];
  const selected = [];
  Object.entries(idMap).forEach(([domId, idVal]) => {
    const cb = document.getElementById(domId);
    if (cb?.checked) selected.push(idVal);
  });
  if (selected.length === 0) return ['employee', 'retiree', 'family', 'external'];
  return selected;
}

function getBatchMatchedServices() {
  const allServices = (appState && Array.isArray(appState.services)) ? appState.services : [];
  const selectedGenders = getBatchSelectedGenders();
  const selectedIdentities = getBatchSelectedIdentities();

  const catServices = allServices.filter(s => s.category === currentBatchCategory);
  const hasGenderSpecificItems = catServices.some(s => 
    Array.isArray(s.gender) && s.gender.length === 1 && (s.gender[0] === 'male' || s.gender[0] === 'female')
  );

  const isOnlyMale = selectedGenders.length === 1 && selectedGenders[0] === 'male';
  const isOnlyFemale = selectedGenders.length === 1 && selectedGenders[0] === 'female';

  return catServices.filter(s => {
    if (hasGenderSpecificItems) {
      if (isOnlyMale) {
        const isMale = Array.isArray(s.gender) ? (s.gender.includes('male') && !s.gender.includes('female')) : (s.gender === 'male');
        if (!isMale) return false;
      } else if (isOnlyFemale) {
        const isFemale = Array.isArray(s.gender) ? (s.gender.includes('female') && !s.gender.includes('male')) : (s.gender === 'female');
        if (!isFemale) return false;
      } else {
        const hasMatch = Array.isArray(s.gender)
          ? s.gender.some(g => selectedGenders.includes(g))
          : (s.gender === 'all' || !s.gender || selectedGenders.includes(s.gender));
        if (!hasMatch) return false;
      }
    }

    if (Array.isArray(s.identity)) {
      const hasIdMatch = s.identity.some(id => selectedIdentities.includes(id));
      if (!hasIdMatch) return false;
    } else if (typeof s.identity === 'string' && s.identity !== 'all') {
      if (!selectedIdentities.includes(s.identity)) return false;
    }

    return true;
  });
}

function syncBatchInputsFromMatched() {
  const matched = getBatchMatchedServices();
  const priceInput = document.getElementById('batch-price');
  const rateInput = document.getElementById('batch-rate');
  const discountCb = document.getElementById('batch-allow-discount');
  if (!priceInput || !rateInput || !discountCb) return;

  if (matched.length > 0) {
    priceInput.value = matched[0].price ?? '';
    rateInput.value = matched[0].rate ?? '';
    discountCb.checked = !!matched[0].allowDiscount;
  }
}

async function saveBatchServiceSettings() {
  if (currentUserRole !== 'admin') {
    appAlert('僅管理員有此操作權限！');
    return;
  }

  const priceVal = document.getElementById('batch-price')?.value;
  const rateVal = document.getElementById('batch-rate')?.value;
  const allowDiscount = !!document.getElementById('batch-allow-discount')?.checked;

  if (priceVal === '' || isNaN(parseFloat(priceVal))) {
    appAlert('請輸入有效的定價金額！');
    return;
  }
  if (rateVal === '' || isNaN(parseFloat(rateVal))) {
    appAlert('請輸入有效的抽成百分比！');
    return;
  }

  const price = parseFloat(priceVal);
  const rate = parseFloat(rateVal);

  const matched = getBatchMatchedServices();
  if (matched.length === 0) {
    appAlert('未找到符合所選條件的服務項目！');
    return;
  }

  matched.forEach(item => {
    item.price = price;
    item.rate = rate;
    item.allowDiscount = allowDiscount;
    if (item.category === '產品銷售') {
      item.empPrice = allowDiscount ? Math.round(price * 0.9) : price;
    }
  });

  await syncDataToCloud('services');
  renderSettingsTables();
  if (typeof renderPosWizard === 'function') renderPosWizard();
  showToast(`已成功更新 ${matched.length} 項服務的定價與抽成！`);
}

