/**
 * SalonFlow - 店內專屬 POS 機互動答題開單介面 (js/billing.js)
 */

// POS 答題當前狀態 (全域反應式變數)
let posGender = 'female';      // 'female' | 'male'
let posIdentity = 'employee';  // 'employee' | 'retiree' | 'family' | 'external'
let posPermRolls = 1;          // 燙髮局部補燙卷數

// 取得服務項目物件 (優先從 appState.services 讀取自訂價格與抽成，找不到時降級讀取 DEFAULT_SERVICES)
function getServiceItem(serviceId) {
  return (typeof appState !== 'undefined' && appState.services && appState.services.find(s => s.id === serviceId)) ||
         (typeof DEFAULT_SERVICES !== 'undefined' && DEFAULT_SERVICES.find(s => s.id === serviceId)) || null;
}

// 取得服務項目單價
function getServicePrice(serviceId, fallback = 0) {
  const srv = getServiceItem(serviceId);
  return (srv && typeof srv.price === 'number') ? srv.price : fallback;
}

// 渲染所有設計師下拉選單與開單設計師身分顯示
function populateStaffDropdowns() {
  const billingStaffName = document.getElementById('billing-staff-name');
  const billingStaffInput = document.getElementById('billing-staff-select');
  const billingStaffDisplay = document.getElementById('billing-staff-display');
  const historyStaff = document.getElementById('history-filter-staff');
  const monthlyStaff = document.getElementById('monthly-select-staff');
  const previousHistoryStaff = historyStaff?.value;
  const previousMonthlyStaff = monthlyStaff?.value;

  if (typeof updateLinkedStaff === 'function') {
    updateLinkedStaff();
  }

  // 主作設計師：直接綁定當前登入者
  if (billingStaffName || billingStaffInput) {
    if (typeof currentLinkedStaff !== 'undefined' && currentLinkedStaff) {
      if (billingStaffName) {
        billingStaffName.innerHTML = `<span class="font-bold text-slate-900">${currentLinkedStaff.name}</span>`;
      }
      if (billingStaffInput) {
        billingStaffInput.value = currentLinkedStaff.id;
      }
      if (billingStaffDisplay) {
        billingStaffDisplay.onclick = null;
        billingStaffDisplay.classList?.remove('cursor-pointer', 'border-amber-300', 'bg-amber-50');
        billingStaffDisplay.classList?.add('border-slate-200', 'bg-slate-50');
      }
    } else {
      if (billingStaffInput) {
        billingStaffInput.value = '';
      }
      if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') {
        if (billingStaffName) {
          billingStaffName.innerHTML = `<span class="text-amber-700 font-semibold text-xs flex items-center gap-1">⚠️ 尚未綁定設計師身分 (點此設定)</span>`;
        }
        if (billingStaffDisplay) {
          billingStaffDisplay.onclick = function() {
            if (typeof openStaffModal === 'function') openStaffModal();
          };
          billingStaffDisplay.classList?.add('cursor-pointer', 'border-amber-300', 'bg-amber-50');
          billingStaffDisplay.classList?.remove('border-slate-200', 'bg-slate-50');
        }
      } else {
        if (billingStaffName) {
          billingStaffName.innerHTML = `<span class="text-rose-600 font-semibold text-xs">⚠️ 帳號尚未綁定店內人員 (請聯繫管理員)</span>`;
        }
        if (billingStaffDisplay) {
          billingStaffDisplay.onclick = null;
          billingStaffDisplay.classList?.remove('cursor-pointer');
        }
      }
    }
  }

  if (historyStaff) {
    if (typeof currentUserRole !== 'undefined' && currentUserRole === 'staff') {
      if (typeof currentLinkedStaff !== 'undefined' && currentLinkedStaff) {
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
      const staffList = (typeof appState !== 'undefined' && appState.staff) ? appState.staff : [];
      historyStaff.innerHTML = `
        <option value="ALL">全部人員</option>
        ${staffList.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      `;
    }
  }

  if (monthlyStaff) {
    monthlyStaff.disabled = false;
    const staffList = (typeof appState !== 'undefined' && appState.staff) ? appState.staff : [];
    if (staffList.length === 0) {
      monthlyStaff.innerHTML = `<option value="">尚無人員資料</option>`;
    } else {
      monthlyStaff.innerHTML = staffList.map(s => `
        <option value="${s.id}">${s.name}</option>
      `).join('');
    }
  }

  if (historyStaff && typeof currentUserRole !== 'undefined' && currentUserRole === 'admin' &&
      typeof appState !== 'undefined' && (previousHistoryStaff === 'ALL' || appState.staff?.some(s => s.id === previousHistoryStaff))) {
    historyStaff.value = previousHistoryStaff;
  }
  if (monthlyStaff && typeof appState !== 'undefined' && appState.staff?.some(s => s.id === previousMonthlyStaff)) {
    monthlyStaff.value = previousMonthlyStaff;
  }

  checkStaffEmptyState();
}

// 檢查是否尚無人員，顯示提示引導
function checkStaffEmptyState() {
  const emptyAlert = document.getElementById('billing-empty-staff-alert');
  if (emptyAlert && typeof appState !== 'undefined' && appState.staff) {
    if (appState.staff.length === 0) {
      emptyAlert.classList.remove('hidden');
    } else {
      emptyAlert.classList.add('hidden');
    }
  }
}

// 初始化開單表單與 POS 狀態
function initBillingForm() {
  generateNewOrderNo();
  const restored = restoreBillingDraftFromStorage();
  if (!restored) {
    currentBillingRows = [];
  }
  renderPosWizard();
  renderBillingRows();
}

// 計算指定日期的下一號流水單號 (格式：T-YYYYMMDD-001)
function getNextOrderNo(dateStr) {
  const d = dateStr || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]);
  const compactDate = d.replace(/-/g, '');
  const prefix = `T-${compactDate}-`;

  const dayOrders = (typeof appState !== 'undefined' && appState.orders) 
    ? appState.orders.filter(o => o && o.date === d) 
    : [];
  let maxSeq = 0;

  dayOrders.forEach(o => {
    if (o.orderNo) {
      if (o.orderNo.startsWith(prefix)) {
        const seqPart = o.orderNo.slice(prefix.length);
        const parsed = parseInt(seqPart, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      } else {
        const match = o.orderNo.match(/-(\d+)$/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > maxSeq) {
            maxSeq = parsed;
          }
        }
      }
    }
  });

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

// 自動生成當日流水單號顯示
function generateNewOrderNo() {
  const dateVal = document.getElementById('billing-date')?.value || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]);
  const nextNo = getNextOrderNo(dateVal);
  const orderNoEl = document.getElementById('billing-order-no');
  if (orderNoEl) {
    orderNoEl.textContent = `單號：${nextNo}`;
  }
}

// ==================== POS 步驟 1：性別與身分切換 ====================

function setPosGender(gender) {
  posGender = gender;
  renderPosWizard();
}

function setPosIdentity(identity) {
  posIdentity = identity;
  renderPosWizard();
}

// 刷新按鈕樣式與分類徽章預覽
function renderPosWizard() {
  // 1. 性別按鈕樣式
  const btnFemale = document.getElementById('pos-btn-gender-female');
  const btnMale = document.getElementById('pos-btn-gender-male');
  
  if (btnFemale && btnMale) {
    if (posGender === 'female') {
      btnFemale.className = 'pos-gender-btn py-2.5 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5 border bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/20 ring-2 ring-amber-400';
      btnMale.className = 'pos-gender-btn py-2.5 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';
    } else {
      btnMale.className = 'pos-gender-btn py-2.5 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5 border bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/20 ring-2 ring-amber-400';
      btnFemale.className = 'pos-gender-btn py-2.5 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';
    }
  }

  // 2. 身分按鈕樣式
  const identities = ['employee', 'retiree', 'family', 'external'];
  const idMap = {
    employee: 'pos-btn-id-employee',
    retiree: 'pos-btn-id-retiree',
    family: 'pos-btn-id-family',
    external: 'pos-btn-id-external'
  };

  identities.forEach(id => {
    const el = document.getElementById(idMap[id]);
    if (el) {
      if (posIdentity === id) {
        el.className = 'pos-id-btn py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center border bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/20 ring-2 ring-amber-400';
      } else {
        el.className = 'pos-id-btn py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100';
      }
    }
  });

  // 3. 條件徽章與說明文字 (相容保留更新)
  const badgeEl = document.getElementById('pos-condition-badge');
  const noteEl = document.getElementById('pos-discount-note-text');
  const genderLabel = posGender === 'female' ? '女性' : '男性';
  const identityLabels = {
    employee: '在職員工',
    retiree: '退休員工',
    family: '員工眷屬',
    external: '非員工'
  };

  if (badgeEl) {
    badgeEl.textContent = `${genderLabel} · ${identityLabels[posIdentity] || ''}`;
  }

  const pCutEmpF = getServicePrice('cut-emp-f', 150);
  const pCutEmpM = getServicePrice('cut-emp-m', 200);
  const pCutPure = getServicePrice('cut-ext-pure', 250);
  const pCutBlow = getServicePrice('cut-ext-blow', 300);

  const pShampActLong = getServicePrice('shampoo-act-long', 110);
  const pShampActShort = getServicePrice('shampoo-act-short', 80);
  const pShampRetLong = getServicePrice('shampoo-ret-long', 140);
  const pShampRetShort = getServicePrice('shampoo-ret-short', 110);

  const pScalp = getServicePrice('scalp-standard', 350);

  if (noteEl) {
    if (posIdentity === 'employee') {
      noteEl.textContent = `在職員工：女性剪髮 $${pCutEmpF} / 洗頭 $${pShampActShort}~$${pShampActLong} / 產品 9 折`;
    } else if (posIdentity === 'retiree') {
      noteEl.textContent = `退休員工：女性剪髮 $${pCutEmpF} / 洗頭 $${pShampRetShort}~$${pShampRetLong}`;
    } else if (posIdentity === 'family') {
      noteEl.textContent = `員工眷屬：純剪 $${pCutPure} / 洗頭 $${pShampRetShort}~$${pShampRetLong}`;
    } else {
      noteEl.textContent = `非員工：純剪 $${pCutPure} / 洗頭 $${pShampRetShort}~$${pShampRetLong}`;
    }
  }

  // 4. 更新大類卡片價格提示
  const badgeCut = document.getElementById('pos-badge-cut');
  const descCut = document.getElementById('pos-desc-cut');
  if (badgeCut) {
    if (posIdentity === 'employee' || posIdentity === 'retiree') {
      badgeCut.textContent = posGender === 'female' ? `$${pCutEmpF}` : `$${pCutEmpM}`;
    } else {
      badgeCut.textContent = pCutPure === pCutBlow ? `$${pCutPure}` : `$${pCutPure}~$${pCutBlow}`;
    }
  }
  if (descCut) {
    if (posIdentity === 'employee' || posIdentity === 'retiree') {
      descCut.textContent = posGender === 'female' ? `女 $${pCutEmpF} (員工)` : `男 $${pCutEmpM} (員工)`;
    } else {
      descCut.textContent = `純剪 $${pCutPure} / 剪吹 $${pCutBlow}`;
    }
  }

  const badgeShampoo = document.getElementById('pos-badge-shampoo');
  const descShampoo = document.getElementById('pos-desc-shampoo');
  if (badgeShampoo) {
    if (posIdentity === 'employee') {
      badgeShampoo.textContent = pShampActShort === pShampActLong ? `$${pShampActShort}` : `$${pShampActShort}~$${pShampActLong}`;
    } else {
      badgeShampoo.textContent = pShampRetShort === pShampRetLong ? `$${pShampRetShort}` : `$${pShampRetShort}~$${pShampRetLong}`;
    }
  }
  if (descShampoo) {
    if (posIdentity === 'employee') {
      descShampoo.textContent = `長髮 $${pShampActLong} / 短髮 $${pShampActShort}`;
    } else {
      descShampoo.textContent = `長髮 $${pShampRetLong} / 短髮 $${pShampRetShort}`;
    }
  }

  const badgeScalp = document.getElementById('pos-badge-scalp');
  if (badgeScalp) {
    badgeScalp.textContent = `$${pScalp}`;
  }

  const badgeTreatment = document.getElementById('pos-badge-treatment');
  if (badgeTreatment) {
    const treatPrices = ['treat-steamer', 'treat-sonic', 'treat-ext-comp', 'treat-emp-steamer', 'treat-emp-sonic'].map(id => getServicePrice(id, 0)).filter(p => p > 0);
    if (treatPrices.length > 0) {
      const minT = Math.min(...treatPrices);
      const maxT = Math.max(...treatPrices);
      badgeTreatment.textContent = minT === maxT ? `$${minT}` : `$${minT}~$${maxT}`;
    }
  }

  const badgeColor = document.getElementById('pos-badge-color');
  if (badgeColor) {
    const colorPrices = ['color-company', 'color-bring', 'color-barrier', 'color-bring-next'].map(id => getServicePrice(id, 0)).filter(p => p > 0);
    if (colorPrices.length > 0) {
      const minC = Math.min(...colorPrices);
      const maxC = Math.max(...colorPrices);
      badgeColor.textContent = minC === maxC ? `$${minC}` : `$${minC}~$${maxC}`;
    }
  }

  const badgePerm = document.getElementById('pos-badge-perm');
  if (badgePerm) {
    const pCold = posIdentity === 'employee' ? getServicePrice('perm-cold-emp', 2000) : getServicePrice('perm-cold-fam', 2300);
    badgePerm.textContent = `$${pCold.toLocaleString()}起`;
  }

  const badgeProd = document.getElementById('pos-badge-prod');
  if (badgeProd) {
    if (posIdentity === 'employee') {
      badgeProd.textContent = '9折';
      badgeProd.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800';
    } else {
      badgeProd.textContent = '門市定價';
      badgeProd.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700';
    }
  }
}

// ==================== POS 步驟 2：智能答題規格選擇器 ====================

function openPosCategoryModal(catId) {
  const modal = document.getElementById('modal-pos-picker');
  const emojiEl = document.getElementById('pos-picker-emoji');
  const titleEl = document.getElementById('pos-picker-title');
  const subtitleEl = document.getElementById('pos-picker-subtitle');
  const contentEl = document.getElementById('pos-picker-content');
  if (!modal || !contentEl) return;

  const catMeta = {
    cut: { emoji: '✂️', title: '剪髮' },
    shampoo: { emoji: '💆', title: '洗頭' },
    scalp: { emoji: '🌿', title: '去角質' },
    treatment: { emoji: '🧖', title: '護髮' },
    color: { emoji: '🎨', title: '染髮' },
    perm: { emoji: '🦱', title: '燙髮' },
    products: { emoji: '🧴', title: '產品' }
  };

  const meta = catMeta[catId] || { emoji: '📋', title: '選項' };
  if (emojiEl) emojiEl.textContent = meta.emoji;
  if (titleEl) titleEl.textContent = meta.title;
  if (subtitleEl) subtitleEl.textContent = '';

  if (catId === 'cut') {
    renderCutOptions(contentEl);
  } else if (catId === 'shampoo') {
    renderShampooOptions(contentEl);
  } else if (catId === 'scalp') {
    renderScalpOptions(contentEl);
  } else if (catId === 'treatment') {
    renderTreatmentOptions(contentEl);
  } else if (catId === 'color') {
    renderColorOptions(contentEl);
  } else if (catId === 'perm') {
    renderPermOptions(contentEl);
  } else if (catId === 'products') {
    renderProductsOptions(contentEl);
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closePosPickerModal() {
  const modal = document.getElementById('modal-pos-picker');
  if (modal) modal.classList.add('hidden');
}

// 1. 剪髮
function renderCutOptions(el) {
  const isEmployee = posIdentity === 'employee' || posIdentity === 'retiree';
  const fPrice = getServicePrice('cut-emp-f', 150);
  const mPrice = getServicePrice('cut-emp-m', 200);
  const purePrice = getServicePrice('cut-ext-pure', 250);
  const blowPrice = getServicePrice('cut-ext-blow', 300);

  if (isEmployee) {
    el.innerHTML = `
      <div class="space-y-2">
        <button type="button" onclick="addPosItem('cut-emp-f'); closePosPickerModal();" class="w-full p-4 rounded-2xl border ${posGender === 'female' ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400' : 'border-slate-200 bg-white hover:bg-slate-50'} transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">👩</span>
            <div class="font-bold text-slate-900 text-sm">女剪髮</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${fPrice.toLocaleString()}</span>
        </button>
        <button type="button" onclick="addPosItem('cut-emp-m'); closePosPickerModal();" class="w-full p-4 rounded-2xl border ${posGender === 'male' ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400' : 'border-slate-200 bg-white hover:bg-slate-50'} transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">👨</span>
            <div class="font-bold text-slate-900 text-sm">男剪髮</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${mPrice.toLocaleString()}</span>
        </button>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="space-y-2">
        <button type="button" onclick="addPosItem('cut-ext-pure'); closePosPickerModal();" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">✂️</span>
            <div class="font-bold text-slate-900 text-sm">純剪</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${purePrice.toLocaleString()}</span>
        </button>
        <button type="button" onclick="addPosItem('cut-ext-blow'); closePosPickerModal();" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">💨</span>
            <div class="font-bold text-slate-900 text-sm">剪吹</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${blowPrice.toLocaleString()}</span>
        </button>
      </div>
    `;
  }
}

// 2. 洗頭
function renderShampooOptions(el) {
  const isEmployee = posIdentity === 'employee';
  const actLong = getServicePrice('shampoo-act-long', 110);
  const actShort = getServicePrice('shampoo-act-short', 80);
  const retLong = getServicePrice('shampoo-ret-long', 140);
  const retShort = getServicePrice('shampoo-ret-short', 110);

  if (isEmployee) {
    el.innerHTML = `
      <div class="space-y-2">
        <button type="button" onclick="addPosItem('shampoo-act-long'); closePosPickerModal();" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">💇‍♀️</span>
            <div class="font-bold text-slate-900 text-sm">長髮</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${actLong.toLocaleString()}</span>
        </button>
        <button type="button" onclick="addPosItem('shampoo-act-short'); closePosPickerModal();" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">💇‍♂️</span>
            <div class="font-bold text-slate-900 text-sm">短髮</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${actShort.toLocaleString()}</span>
        </button>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="space-y-2">
        <button type="button" onclick="addPosItem('shampoo-ret-long'); closePosPickerModal();" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">💇‍♀️</span>
            <div class="font-bold text-slate-900 text-sm">長髮</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${retLong.toLocaleString()}</span>
        </button>
        <button type="button" onclick="addPosItem('shampoo-ret-short'); closePosPickerModal();" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">💇‍♂️</span>
            <div class="font-bold text-slate-900 text-sm">短髮</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${retShort.toLocaleString()}</span>
        </button>
      </div>
    `;
  }
}

// 3. 去角質
function renderScalpOptions(el) {
  const scalpPrice = getServicePrice('scalp-standard', 350);
  el.innerHTML = `
    <div class="space-y-2">
      <button type="button" onclick="addPosItem('scalp-standard'); closePosPickerModal();" class="w-full p-4 rounded-2xl border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 transition flex items-center justify-between text-left">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🌿</span>
          <div class="font-bold text-slate-900 text-sm">頭皮去角質</div>
        </div>
        <span class="text-base font-black text-emerald-800 font-numeric">NT$ ${scalpPrice.toLocaleString()}</span>
      </button>
    </div>
  `;
}

// 4. 護髮
function renderTreatmentOptions(el) {
  const items = [
    { id: 'treat-steamer', name: getServiceItem('treat-steamer')?.name || '護髮 (蒸器)', price: getServicePrice('treat-steamer', 120), icon: '💨' },
    { id: 'treat-sonic', name: getServiceItem('treat-sonic')?.name || '護髮 (超音波)', price: getServicePrice('treat-sonic', 250), icon: '🔊' },
    { id: 'treat-ext-comp', name: getServiceItem('treat-ext-comp')?.name || '非員工 (用公司)', price: getServicePrice('treat-ext-comp', 450), icon: '🏢' },
    { id: 'treat-emp-steamer', name: getServiceItem('treat-emp-steamer')?.name || '員工產品 (蒸器)', price: getServicePrice('treat-emp-steamer', 450), icon: '🧴' },
    { id: 'treat-emp-sonic', name: getServiceItem('treat-emp-sonic')?.name || '員工產品 (超音波)', price: getServicePrice('treat-emp-sonic', 600), icon: '✨' }
  ];

  el.innerHTML = `
    <div class="space-y-2">
      ${items.map(it => `
        <button type="button" onclick="addPosItem('${it.id}'); closePosPickerModal();" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${it.icon}</span>
            <div class="font-bold text-slate-900 text-sm">${it.name}</div>
          </div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${it.price.toLocaleString()}</span>
        </button>
      `).join('')}
    </div>
  `;
}

// 5. 染髮
function renderColorOptions(el) {
  const items = [
    { id: 'color-company', name: getServiceItem('color-company')?.name || '用公司染劑', price: getServicePrice('color-company', 800), icon: '🏢' },
    { id: 'color-bring', name: getServiceItem('color-bring')?.name || '自帶代工', price: getServicePrice('color-bring', 350), icon: '🧴' },
    { id: 'color-barrier', name: getServiceItem('color-barrier')?.name || '頭皮隔離霜', price: getServicePrice('color-barrier', 350), icon: '🛡️' },
    { id: 'color-bring-next', name: getServiceItem('color-bring-next')?.name || '自帶代工 (明年)', price: getServicePrice('color-bring-next', 450), icon: '🗓️' }
  ];

  el.innerHTML = `
    <div class="space-y-2">
      ${items.map(it => `
        <button type="button" onclick="addPosItem('${it.id}'); closePosPickerModal();" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${it.icon}</span>
            <div class="font-bold text-slate-900 text-sm">${it.name}</div>
          </div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${it.price.toLocaleString()}</span>
        </button>
      `).join('')}
    </div>
  `;
}

// 6. 燙髮
function renderPermOptions(el) {
  const isEmployee = posIdentity === 'employee';
  posPermRolls = 1;
  const coldEmp = getServicePrice('perm-cold-emp', 2000);
  const coldFam = getServicePrice('perm-cold-fam', 2300);
  const partRollUnit = getServicePrice('perm-cold-part', 50);
  const digShort = getServicePrice('perm-dig-short', 2300);
  const digLong = getServicePrice('perm-dig-long', 2500);
  const digXlong = getServicePrice('perm-dig-xlong', 2800);

  el.innerHTML = `
    <div class="space-y-3">
      <!-- 冷燙 -->
      <div class="space-y-2">
        <div class="text-xs font-bold text-slate-500">冷燙</div>
        ${isEmployee ? `
          <button type="button" onclick="addPosItem('perm-cold-emp'); closePosPickerModal();" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
            <div class="flex items-center gap-3">
              <span class="text-2xl">❄️</span>
              <div class="font-bold text-slate-900 text-sm">冷燙整頭</div>
            </div>
            <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${coldEmp.toLocaleString()}</span>
          </button>
        ` : `
          <button type="button" onclick="addPosItem('perm-cold-fam'); closePosPickerModal();" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
            <div class="flex items-center gap-3">
              <span class="text-2xl">❄️</span>
              <div class="font-bold text-slate-900 text-sm">冷燙整頭</div>
            </div>
            <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${coldFam.toLocaleString()}</span>
          </button>
        `}

        <!-- 局部補燙 -->
        <div class="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
          <div class="flex items-center justify-between">
            <div class="font-bold text-slate-900 text-sm">局部補燙 ($${partRollUnit}/卷)</div>
            <div class="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
              <button type="button" onclick="updatePermRolls(-1)" class="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold select-none">−</button>
              <span id="pos-perm-rolls-val" class="w-8 text-center text-xs font-bold font-numeric">1</span>
              <button type="button" onclick="updatePermRolls(1)" class="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold select-none">＋</button>
            </div>
          </div>
          <button type="button" id="pos-perm-rolls-add-btn" onclick="addPermRollsItem()" class="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs">
            ＋ 加入局部補燙 (NT$ ${partRollUnit.toLocaleString()})
          </button>
        </div>
      </div>

      <!-- 溫朔燙 -->
      <div class="space-y-2 pt-2 border-t border-slate-100">
        <div class="text-xs font-bold text-slate-500">溫朔燙</div>
        <button type="button" onclick="addPosItem('perm-dig-short'); closePosPickerModal();" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="font-bold text-slate-900 text-sm">短髮</div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${digShort.toLocaleString()}</span>
        </button>
        <button type="button" onclick="addPosItem('perm-dig-long'); closePosPickerModal();" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="font-bold text-slate-900 text-sm">長髮</div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${digLong.toLocaleString()}</span>
        </button>
        <button type="button" onclick="addPosItem('perm-dig-xlong'); closePosPickerModal();" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="font-bold text-slate-900 text-sm">過長</div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${digXlong.toLocaleString()}</span>
        </button>
      </div>
    </div>
  `;
}

function updatePermRolls(delta) {
  posPermRolls = Math.max(1, posPermRolls + delta);
  const unitPrice = getServicePrice('perm-cold-part', 50);
  const valEl = document.getElementById('pos-perm-rolls-val');
  const btnEl = document.getElementById('pos-perm-rolls-add-btn');
  if (valEl) valEl.textContent = posPermRolls;
  if (btnEl) btnEl.textContent = `＋ 加入局部補燙 (NT$ ${(posPermRolls * unitPrice).toLocaleString()})`;
}

function addPermRollsItem() {
  const unitPrice = getServicePrice('perm-cold-part', 50);
  const total = posPermRolls * unitPrice;
  addPosItem('perm-cold-part', total, `冷燙髮 (局部補燙 ${posPermRolls}卷)`, 1);
  closePosPickerModal();
}

// 7. 產品銷售
function renderProductsOptions(el, query = '') {
  const isEmployee = posIdentity === 'employee';
  const allServices = (typeof appState !== 'undefined' && appState.services && appState.services.length > 0)
    ? appState.services
    : (typeof DEFAULT_SERVICES !== 'undefined' ? DEFAULT_SERVICES : []);
  const products = allServices.filter(s => s.category === '產品銷售');
  const filtered = query
    ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  el.innerHTML = `
    <div class="space-y-3">
      <!-- 搜尋 -->
      <div class="relative">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <i data-lucide="search" class="w-4 h-4"></i>
        </span>
        <input type="text" id="pos-product-search" value="${query}" oninput="renderProductsOptions(document.getElementById('pos-picker-content'), this.value)" placeholder="搜尋產品名稱..." class="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
      </div>

      <!-- 產品列表 -->
      <div class="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        ${filtered.length === 0 ? `
          <div class="p-6 text-center text-slate-400 text-xs">查無符合名稱的產品</div>
        ` : filtered.map(p => {
          const finalPrice = isEmployee ? ((typeof p.empPrice === 'number' && p.empPrice > 0) ? p.empPrice : p.price) : p.price;
          const hasDiscount = isEmployee && (typeof p.empPrice === 'number' && p.empPrice > 0 && p.empPrice < p.price);

          return `
            <div class="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition flex items-center justify-between gap-2 shadow-2xs">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-900 text-xs sm:text-sm truncate">${p.name}</div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="text-xs font-black text-amber-700 font-numeric">NT$ ${finalPrice.toLocaleString()}</span>
                  ${hasDiscount ? `
                    <span class="text-[10px] text-slate-400 line-through font-numeric">NT$ ${p.price.toLocaleString()}</span>
                    <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">員工價</span>
                  ` : ''}
                </div>
              </div>

              <button type="button" onclick="addPosItem('${p.id}', ${finalPrice}, '${p.name}');" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0 shadow-2xs">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> 加入
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

// ==================== POS 步驟 3：消費項目票據 (購物車) ====================

// 將指定項目加入客單購物車
function addPosItem(serviceId, overridePrice = null, customName = '', customQty = 1) {
  const srv = getServiceItem(serviceId);
  
  const price = overridePrice !== null ? overridePrice : (srv ? srv.price : 0);
  const name = customName || (srv ? srv.name : '美髮項目');
  const rate = srv ? (srv.rate || 0) : 0;

  // 檢查是否已有完全相同品項與相同單價 (自動累加數量)
  const existing = currentBillingRows.find(r => r.serviceId === serviceId && r.price === price && (!customName || r.name === customName));
  if (existing) {
    existing.qty = (existing.qty || 1) + customQty;
  } else {
    const rowId = 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    currentBillingRows.push({
      rowId,
      serviceId: srv ? srv.id : serviceId,
      name,
      price,
      rate,
      qty: customQty
    });
  }

  renderBillingRows();
  if (typeof showToast === 'function') {
    showToast(`已加入：${name} (NT$ ${price.toLocaleString()})`);
  }
}

// 支援歷史介面呼叫的新增列
function addServiceRow(presetServiceId = '') {
  if (presetServiceId) {
    addPosItem(presetServiceId);
    return;
  }
  const srv = (typeof appState !== 'undefined' && appState.services && appState.services[0]) || 
              (typeof DEFAULT_SERVICES !== 'undefined' && DEFAULT_SERVICES[0]);
  if (srv) {
    addPosItem(srv.id);
  }
}

// 購物車數量步進控制 (+1 / -1)
function changeCartQty(rowId, delta) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;

  const newQty = (row.qty || 1) + delta;
  if (newQty <= 0) {
    removeServiceRow(rowId);
  } else {
    row.qty = newQty;
    renderBillingRows();
  }
}

// 刪除客單項目
function removeServiceRow(rowId) {
  currentBillingRows = currentBillingRows.filter(r => r.rowId !== rowId);
  renderBillingRows();
}

// 彈窗自訂修改單價 (給店長特殊折扣或微調彈性)
function promptEditRowPrice(rowId) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;
  const currentPrice = row.price || 0;
  const input = prompt(`請輸入「${row.name || '此項目'}」的自訂單價 (NT$)：`, currentPrice);
  if (input !== null) {
    const num = parseFloat(input);
    if (!isNaN(num) && num >= 0) {
      onRowInputChange(rowId, 'price', num);
      renderBillingRows();
    }
  }
}

// 下拉選單變更服務項目 (相容保留)
function onServiceSelectChange(rowId, selectedServiceId) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;

  if (!selectedServiceId) {
    row.serviceId = '';
    row.price = 0;
    row.rate = 0;
  } else {
    const srv = (typeof appState !== 'undefined' && appState.services && appState.services.find(s => s.id === selectedServiceId)) ||
                (typeof DEFAULT_SERVICES !== 'undefined' && DEFAULT_SERVICES.find(s => s.id === selectedServiceId));
    if (srv) {
      row.serviceId = srv.id;
      row.price = srv.price;
      row.rate = srv.rate;
      row.name = srv.name;
    }
  }
  renderBillingRows();
}

// 價格、抽成趴數、數量變更時即時重算
function onRowInputChange(rowId, field, value) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;

  const numVal = parseFloat(value) || 0;
  if (field === 'price') row.price = Math.max(0, numVal);
  if (field === 'rate') row.rate = Math.max(0, Math.min(100, numVal));
  if (field === 'qty') row.qty = Math.max(1, Math.floor(numVal));

  updateRowCalculations();
}

// 繪製消費項目清單 (購物車清單)
function renderBillingRows() {
  const container = document.getElementById('service-rows-container');
  if (!container) return;

  if (!currentBillingRows || currentBillingRows.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 bg-slate-50/80 rounded-2xl border border-dashed border-slate-300">
        <div class="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <i data-lucide="shopping-bag" class="w-5 h-5"></i>
        </div>
        <p class="text-sm font-bold text-slate-600">本單尚未點選任何項目</p>
        <p class="text-xs text-slate-400 mt-1">請點選上方服務項目加入</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    updateRowCalculations();
    return;
  }

  container.innerHTML = currentBillingRows.map((row, index) => {
    const srv = getServiceItem(row.serviceId);
    const itemName = row.name || (srv ? srv.name : '美髮服務');
    const itemTotal = (row.price || 0) * (row.qty || 1);

    return `
      <div id="${row.rowId}" class="service-row-item p-3.5 sm:p-4 bg-slate-50/95 hover:bg-slate-50 border border-slate-200 rounded-2xl transition space-y-2 shadow-2xs">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                ${index + 1}
              </span>
              <span class="font-bold text-slate-900 text-sm truncate">${itemName}</span>
            </div>
            <div class="text-xs text-slate-500 mt-0.5 pl-7 flex items-center gap-2">
              <span>單價 NT$ ${(row.price || 0).toLocaleString()}</span>
              <span class="text-slate-300">|</span>
              <button type="button" onclick="promptEditRowPrice('${row.rowId}')" class="text-amber-700 hover:text-amber-800 underline text-[11px]">
                修改金額
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2.5 shrink-0">
            <!-- 數量控制 -->
            <div class="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
              <button type="button" onclick="changeCartQty('${row.rowId}', -1)" class="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition font-bold text-base select-none">−</button>
              <span class="w-7 text-center text-xs font-bold font-numeric text-slate-900">${row.qty || 1}</span>
              <button type="button" onclick="changeCartQty('${row.rowId}', 1)" class="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition font-bold text-base select-none">＋</button>
            </div>

            <!-- 小計 -->
            <div class="text-right min-w-[70px]">
              <strong id="${row.rowId}-subtotal" class="text-slate-900 font-numeric text-sm font-extrabold block">NT$ ${itemTotal.toLocaleString()}</strong>
            </div>

            <!-- 刪除 -->
            <button type="button" onclick="removeServiceRow('${row.rowId}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0" title="移除此項目">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
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

  if (currentBillingRows && Array.isArray(currentBillingRows)) {
    currentBillingRows.forEach(row => {
      const itemTotal = (row.price || 0) * (row.qty || 1);
      const itemComm = Math.round(itemTotal * ((row.rate || 0) / 100));
      const subtotalEl = document.getElementById(`${row.rowId}-subtotal`);
      if (subtotalEl) subtotalEl.textContent = `NT$ ${itemTotal.toLocaleString()}`;

      totalAmount += itemTotal;
      totalCommission += itemComm;
      totalItemsCount += (row.qty || 1);
    });
  }

  const countEl = document.getElementById('summary-card-items-count');
  if (countEl) countEl.textContent = `${totalItemsCount} 項服務`;

  const totEl = document.getElementById('summary-card-total-amount');
  if (totEl) totEl.textContent = totalAmount.toLocaleString();
}

// 儲存當前客單並同步雲端 (當日流水號依序流續)
async function saveCurrentOrder() {
  if (typeof appState !== 'undefined' && appState.staff && appState.staff.length === 0) {
    alert('系統中尚無人員！請先點擊上方提示或前往「設定」新增第一位設計師！');
    if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin' && typeof openStaffModal === 'function') {
      openStaffModal();
    }
    return;
  }

  if (!currentBillingRows || currentBillingRows.length === 0) {
    alert('請至少新增一項服務項目！');
    return;
  }

  const unselectedRow = currentBillingRows.find(r => !r.serviceId);
  if (unselectedRow) {
    alert('請為所有項目選擇服務項目！');
    return;
  }

  if (typeof currentLinkedStaff === 'undefined' || !currentLinkedStaff) {
    if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') {
      alert('您的管理員帳號尚未綁定店內設計師身分，目前無法開單！請先至「設定」綁定或新增人員。');
      if (typeof openStaffModal === 'function') openStaffModal();
    } else {
      alert('您的帳號尚未由管理員綁定店內人員身分，目前無法開單！請聯繫管理員協助綁定。');
    }
    return;
  }

  if (typeof confirm === 'function' && !confirm('確認開單？')) {
    return;
  }

  const staff = currentLinkedStaff;
  const dateVal = document.getElementById('billing-date')?.value || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]);
  // 開單當下由系統即時抓取「記錄時間」(HH:mm)，不受網頁閒置影響
  const timeVal = (typeof getLocalTimeString === 'function') ? getLocalTimeString() : new Date().toTimeString().slice(0, 5);
  const notes = document.getElementById('billing-notes')?.value?.trim() || '';

  const itemsDetail = currentBillingRows.map(r => {
    const srv = getServiceItem(r.serviceId);
    const name = r.name || (srv ? srv.name : '美髮項目');
    const amount = (r.price || 0) * (r.qty || 1);
    const commission = Math.round(amount * ((r.rate || 0) / 100));

    return {
      serviceId: r.serviceId,
      name: name,
      price: r.price || 0,
      rate: r.rate || 0,
      qty: r.qty || 1,
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

  const salonNet = Math.max(0, totalAmount - totalCommission);
  const finalOrderNo = typeof getNextOrderNo === 'function' 
    ? getNextOrderNo(dateVal) 
    : (document.getElementById('billing-order-no')?.textContent?.replace('單號：', '')?.trim() || `T-${dateVal.replace(/-/g, '')}-001`);

  const newOrder = {
    id: 'ord-' + Date.now(),
    orderNo: finalOrderNo,
    date: dateVal,
    time: timeVal,
    staffId: staff.id,
    staffName: staff.name,
    assistantId: '',
    assistantName: '',
    notes: notes,
    items: itemsDetail,
    totalAmount: totalAmount,
    totalCommission: totalCommission,
    assistantCommission: 0,
    salonNet: salonNet,
    createdAt: new Date().toISOString()
  };

  if (typeof appState !== 'undefined' && appState.orders) {
    appState.orders.unshift(newOrder);
  }

  if (typeof syncDataToCloud === 'function') {
    await syncDataToCloud('orders');
  }

  if (typeof showToast === 'function') {
    showToast('開單成功！');
  }

  resetBillingForm();
}

// 重設開單表單與 POS 介面
function resetBillingForm() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('SALON_BILLING_DRAFT');
    }
  } catch (e) {}

  const notesInput = document.getElementById('billing-notes');
  if (notesInput) notesInput.value = '';
  // 服務日期若為空則重設為今日
  const dateInput = document.getElementById('billing-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
  }
  const billingStaffInput = document.getElementById('billing-staff-select');
  if (billingStaffInput && typeof currentLinkedStaff !== 'undefined' && currentLinkedStaff) {
    billingStaffInput.value = currentLinkedStaff.id;
  }

  posGender = 'female';
  posIdentity = 'employee';
  currentBillingRows = [];

  generateNewOrderNo();
  renderPosWizard();
  renderBillingRows();
}

// 暫存開單草稿至 LocalStorage
function saveBillingDraftToStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const hasMeaningfulItems = currentBillingRows && currentBillingRows.some(r => r.serviceId || (r.price && r.price > 0));
    const notes = document.getElementById('billing-notes')?.value || '';
    const date = document.getElementById('billing-date')?.value || '';
    if (hasMeaningfulItems || (notes && notes.trim())) {
      const draft = {
        rows: currentBillingRows,
        notes: notes,
        date: date,
        posGender: posGender,
        posIdentity: posIdentity,
        savedAt: Date.now()
      };
      localStorage.setItem('SALON_BILLING_DRAFT', JSON.stringify(draft));
    }
  } catch (e) {
    console.warn('暫存開單草稿失敗:', e);
  }
}

// 從 LocalStorage 還原開單草稿
function restoreBillingDraftFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('SALON_BILLING_DRAFT');
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (draft && Array.isArray(draft.rows) && draft.rows.length > 0 && (Date.now() - (draft.savedAt || 0) < 24 * 3600 * 1000)) {
      currentBillingRows = draft.rows;
      if (draft.posGender) posGender = draft.posGender;
      if (draft.posIdentity) posIdentity = draft.posIdentity;
      if (draft.notes) {
        const notesEl = document.getElementById('billing-notes');
        if (notesEl) notesEl.value = draft.notes;
      }
      if (draft.date) {
        const dateEl = document.getElementById('billing-date');
        if (dateEl) dateEl.value = draft.date;
      }
      if (typeof renderPosWizard === 'function') renderPosWizard();
      if (typeof renderBillingRows === 'function') renderBillingRows();
      localStorage.removeItem('SALON_BILLING_DRAFT');
      return true;
    }
  } catch (e) {
    console.warn('還原開單草稿失敗:', e);
  }
  return false;
}

