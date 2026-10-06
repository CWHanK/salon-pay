let posGender = 'female';
let posIdentity = 'employee';
let posPermRolls = 1;
let posPermChemical = 'company';

function getServiceItem(serviceId) {
  const aliasMap = {
    'shampoo-act-long': 'shampoo-emp',
    'shampoo-act-short': 'shampoo-emp',
    'shampoo-ret-long': 'shampoo-ext',
    'shampoo-ret-short': 'shampoo-ext'
  };
  const targetId = aliasMap[serviceId] || serviceId;
  return (typeof appState !== 'undefined' && appState.services && (appState.services.find(s => s.id === targetId) || appState.services.find(s => s.id === serviceId))) ||
         (typeof DEFAULT_SERVICES !== 'undefined' && (DEFAULT_SERVICES.find(s => s.id === targetId) || DEFAULT_SERVICES.find(s => s.id === serviceId))) || null;
}

function getServicePrice(serviceId, fallback = 0) {
  const srv = getServiceItem(serviceId);
  return (srv && typeof srv.price === 'number') ? srv.price : fallback;
}

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
        historyStaff.innerHTML = `<option value="${currentLinkedStaff.id}">${currentLinkedStaff.name} (本人客單)</option>`;
      } else {
        historyStaff.innerHTML = `<option value="">(尚未綁定人員)</option>`;
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

function initBillingForm() {
  generateNewOrderNo();
  const restored = restoreBillingDraftFromStorage();
  if (!restored) {
    currentBillingRows = [];
  }
  renderPosWizard();
  renderBillingRows();
}

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

function generateNewOrderNo() {
  const dateVal = document.getElementById('billing-date')?.value || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]);
  const nextNo = getNextOrderNo(dateVal);
  const orderNoEl = document.getElementById('billing-order-no');
  if (orderNoEl) {
    orderNoEl.textContent = `單號：${nextNo}`;
  }
}

function setPosGender(gender) {
  posGender = gender;
  renderPosWizard();
}

function setPosIdentity(identity) {
  posIdentity = identity;
  renderPosWizard();
}

function renderPosWizard() {
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

  const pShampEmp = getServicePrice('shampoo-emp', 110);
  const pShampExt = getServicePrice('shampoo-ext', 140);

  const pScalp = getServicePrice('scalp-standard', 350);

  if (noteEl) {
    noteEl.textContent = '';
  }

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
    badgeShampoo.textContent = (posIdentity === 'employee') ? `$${pShampEmp}` : `$${pShampExt}`;
  }
  if (descShampoo) {
    descShampoo.textContent = (posIdentity === 'employee') ? `員工洗頭 $${pShampEmp}` : `洗頭 $${pShampExt}`;
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
    const colorPrices = ['color-company', 'color-bring', 'color-barrier'].map(id => getServicePrice(id, 0)).filter(p => p > 0);
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

  // 有「其他」分類自訂項目時才顯示「其他」磚塊
  const tileOther = document.getElementById('pos-tile-other');
  if (tileOther) {
    const hasOther = getCustomServicesByCategory('其他').length > 0;
    tileOther.classList.toggle('hidden', !hasOther);
    tileOther.classList.toggle('flex', hasOther);
    const grid = document.getElementById('pos-cat-grid');
    if (grid) {
      grid.classList.toggle('lg:grid-cols-7', !hasOther);
      grid.classList.toggle('lg:grid-cols-8', hasOther);
    }
  }

  renderTodaySummary();
}

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
    products: { emoji: '🧴', title: '產品' },
    other: { emoji: '📋', title: '其他' }
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
  } else if (catId === 'other') {
    contentEl.innerHTML = '';
  }
  appendCustomServiceOptions(contentEl, catId);

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// POS 分類代碼 → 服務項目 category 對照（產品銷售由 renderProductsOptions 動態列出，不需額外附加）
const POS_CATEGORY_TO_SERVICE_CATEGORY = {
  cut: '剪髮',
  shampoo: '洗頭',
  scalp: '去角質',
  treatment: '護髮',
  color: '染髮',
  perm: '燙髮',
  other: '其他'
};

// 管理員於「設定」新增的自訂項目（非內建 DEFAULT_SERVICES）
function getCustomServicesByCategory(category) {
  const defaultIds = new Set((typeof DEFAULT_SERVICES !== 'undefined' ? DEFAULT_SERVICES : []).map(s => s.id));
  const knownCategories = Object.values(POS_CATEGORY_TO_SERVICE_CATEGORY).concat('產品銷售');
  const services = (typeof appState !== 'undefined' && Array.isArray(appState.services)) ? appState.services : [];
  return services.filter(s => {
    if (!s || defaultIds.has(s.id)) return false;
    const cat = knownCategories.includes(s.category) ? s.category : '其他';
    return cat === category;
  });
}

function appendCustomServiceOptions(el, catId) {
  const category = POS_CATEGORY_TO_SERVICE_CATEGORY[catId];
  if (!el || !category) return;
  const customs = getCustomServicesByCategory(category);
  const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  if (customs.length === 0) {
    if (catId === 'other') {
      el.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs">尚無「其他」自訂項目，請至「設定」新增服務項目</div>';
    }
    return;
  }

  el.insertAdjacentHTML('beforeend', `
    <div class="space-y-2 ${catId === 'other' ? '' : 'pt-3 mt-3 border-t border-slate-100'}">
      ${catId === 'other' ? '' : '<div class="text-xs font-bold text-slate-500">自訂項目</div>'}
      ${customs.map(s => `
        <button type="button" onclick="selectPosItemWithDiscountCheck('${esc(s.id)}');" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="font-bold text-slate-900 text-sm">${esc(s.name)}</div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${(Number(s.price) || 0).toLocaleString()}</span>
        </button>
      `).join('')}
    </div>
  `);
}

function closePosPickerModal() {
  const modal = document.getElementById('modal-pos-picker');
  if (modal) modal.classList.add('hidden');
}

function selectPosItemWithDiscountCheck(serviceId, overridePrice = null, customName = '', customQty = 1, customRate = null) {
  const srv = getServiceItem(serviceId);
  const price = overridePrice !== null ? overridePrice : (srv ? srv.price : 0);
  const name = customName || (srv ? srv.name : '美髮項目');
  const rate = customRate !== null ? customRate : (srv ? (srv.rate || 0) : 0);
  const allowDiscount = srv ? (srv.allowDiscount === true) : false;

  if (!allowDiscount) {
    addPosItem(serviceId, price, name, customQty, rate);
    closePosPickerModal();
    return;
  }

  showItemDiscountPrompt(serviceId, price, name, customQty, rate);
}

function showItemDiscountPrompt(serviceId, originalPrice, name, qty, rate) {
  const contentEl = document.getElementById('pos-picker-content');
  if (!contentEl) return;

  const srv = getServiceItem(serviceId);
  const discountPrice = (srv && typeof srv.empPrice === 'number' && srv.empPrice > 0 && srv.empPrice < originalPrice)
    ? srv.empPrice
    : Math.round(originalPrice * 0.9);
  // 自訂項目名稱可能含引號，需轉義後才能安全放入 onclick 字串
  const jsName = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  contentEl.innerHTML = `
    <div class="space-y-3 py-1">
      <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
        <div>
          <div class="font-bold text-slate-900 text-sm">${String(name).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</div>
          <div class="text-[11px] text-slate-400">請選擇計價方式</div>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-400">原價</span>
          <div class="text-sm font-black text-slate-800 font-numeric">NT$ ${originalPrice.toLocaleString()}</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <button type="button" onclick="applyItemWithDiscount('${serviceId}', ${originalPrice}, '${jsName}', ${qty}, ${rate}, false); closePosPickerModal();" class="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 transition text-center space-y-1 active:scale-98">
          <div class="text-xs font-bold text-slate-600">原價</div>
          <div class="text-base font-black text-slate-900 font-numeric">NT$ ${originalPrice.toLocaleString()}</div>
        </button>

        <button type="button" onclick="applyItemWithDiscount('${serviceId}', ${discountPrice}, '${jsName}', ${qty}, ${rate}, true); closePosPickerModal();" class="p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 hover:bg-emerald-100 transition text-center space-y-1 shadow-sm active:scale-98">
          <div class="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1">
            <i data-lucide="tag" class="w-3.5 h-3.5"></i> 打折 (9折)
          </div>
          <div class="text-base font-black text-emerald-700 font-numeric">NT$ ${discountPrice.toLocaleString()}</div>
        </button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function applyItemWithDiscount(serviceId, finalPrice, name, qty, rate, isDiscounted) {
  const displayName = isDiscounted ? `${name} (打折)` : name;
  addPosItem(serviceId, finalPrice, displayName, qty, rate);
}

function renderCutOptions(el) {
  const isEmployee = posIdentity === 'employee' || posIdentity === 'retiree';
  const fPrice = getServicePrice('cut-emp-f', 150);
  const mPrice = getServicePrice('cut-emp-m', 200);
  const purePrice = getServicePrice('cut-ext-pure', 250);
  const blowPrice = getServicePrice('cut-ext-blow', 300);

  if (isEmployee) {
    el.innerHTML = `
      <div class="space-y-2">
        <button type="button" onclick="selectPosItemWithDiscountCheck('cut-emp-f', ${fPrice}, '剪髮 (員工-女)');" class="w-full p-4 rounded-2xl border ${posGender === 'female' ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400' : 'border-slate-200 bg-white hover:bg-slate-50'} transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">👩</span>
            <div class="font-bold text-slate-900 text-sm">女剪髮</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${fPrice.toLocaleString()}</span>
        </button>
        <button type="button" onclick="selectPosItemWithDiscountCheck('cut-emp-m', ${mPrice}, '剪髮 (員工-男)');" class="w-full p-4 rounded-2xl border ${posGender === 'male' ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400' : 'border-slate-200 bg-white hover:bg-slate-50'} transition flex items-center justify-between text-left">
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
        <button type="button" onclick="selectPosItemWithDiscountCheck('cut-ext-pure', ${purePrice}, '純剪 (非員工)');" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-2xl">✂️</span>
            <div class="font-bold text-slate-900 text-sm">純剪</div>
          </div>
          <span class="text-base font-black text-amber-700 font-numeric">NT$ ${purePrice.toLocaleString()}</span>
        </button>
        <button type="button" onclick="selectPosItemWithDiscountCheck('cut-ext-blow', ${blowPrice}, '剪吹 (非員工)');" class="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
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

function renderShampooOptions(el) {
  const isEmployee = posIdentity === 'employee';
  const empPrice = getServicePrice('shampoo-emp', 110);
  const extPrice = getServicePrice('shampoo-ext', 140);
  const defaultItemId = isEmployee ? 'shampoo-emp' : 'shampoo-ext';
  const defaultPrice = isEmployee ? empPrice : extPrice;
  const defaultTitle = isEmployee ? '在職員工洗頭' : '退休/非員工洗頭';

  el.innerHTML = `
    <div class="space-y-2.5">
      <button type="button" onclick="selectPosItemWithDiscountCheck('${defaultItemId}', ${defaultPrice}, '${defaultTitle}');" class="w-full p-4 rounded-2xl border border-amber-500 bg-amber-50/70 hover:bg-amber-50 ring-2 ring-amber-400 transition flex items-center justify-between text-left">
        <div class="flex items-center gap-3">
          <span class="text-2xl">💆</span>
          <div>
            <div class="font-bold text-slate-900 text-sm">${defaultTitle}</div>
          </div>
        </div>
        <span class="text-base font-black text-amber-700 font-numeric">NT$ ${defaultPrice.toLocaleString()}</span>
      </button>

      ${!isEmployee ? `
        <button type="button" onclick="selectPosItemWithDiscountCheck('shampoo-emp', ${empPrice}, '在職員工洗頭');" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-xl">💆</span>
            <div class="font-semibold text-slate-700 text-xs">在職員工洗頭</div>
          </div>
          <span class="text-xs font-bold text-slate-500 font-numeric">NT$ ${empPrice.toLocaleString()}</span>
        </button>
      ` : `
        <button type="button" onclick="selectPosItemWithDiscountCheck('shampoo-ext', ${extPrice}, '退休/非員工洗頭');" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-xl">💆</span>
            <div class="font-semibold text-slate-700 text-xs">退休/非員工洗頭</div>
          </div>
          <span class="text-xs font-bold text-slate-500 font-numeric">NT$ ${extPrice.toLocaleString()}</span>
        </button>
      `}
    </div>
  `;
}

function renderScalpOptions(el) {
  const scalpPrice = getServicePrice('scalp-standard', 350);
  el.innerHTML = `
    <div class="space-y-2">
      <button type="button" onclick="selectPosItemWithDiscountCheck('scalp-standard', ${scalpPrice}, '頭皮深層去角質', 1, 54);" class="w-full p-4 rounded-2xl border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 transition flex items-center justify-between text-left">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🌿</span>
          <div class="font-bold text-slate-900 text-sm">頭皮深層去角質</div>
        </div>
        <span class="text-base font-black text-emerald-800 font-numeric">NT$ ${scalpPrice.toLocaleString()}</span>
      </button>
    </div>
  `;
}

function renderTreatmentOptions(el) {
  const items = [
    { id: 'treat-steamer', name: getServiceItem('treat-steamer')?.name || '護髮 (蒸器)', price: getServicePrice('treat-steamer', 120), icon: '💨', rate: 60 },
    { id: 'treat-sonic', name: getServiceItem('treat-sonic')?.name || '護髮 (超音波)', price: getServicePrice('treat-sonic', 250), icon: '🔊', rate: 60 },
    { id: 'treat-ext-comp', name: getServiceItem('treat-ext-comp')?.name || '護髮 (非員工/用公司)', price: getServicePrice('treat-ext-comp', 450), icon: '🏢', rate: 54 },
    { id: 'treat-emp-steamer', name: getServiceItem('treat-emp-steamer')?.name || '護髮 (員工產品蒸器)', price: getServicePrice('treat-emp-steamer', 450), icon: '🧴', rate: 54 },
    { id: 'treat-emp-sonic', name: getServiceItem('treat-emp-sonic')?.name || '護髮 (員工產品超音波)', price: getServicePrice('treat-emp-sonic', 600), icon: '✨', rate: 54 }
  ];

  el.innerHTML = `
    <div class="space-y-2">
      ${items.map(it => `
        <button type="button" onclick="selectPosItemWithDiscountCheck('${it.id}', ${it.price}, '${it.name}', 1, ${it.rate});" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
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

function renderColorOptions(el) {
  const pCompany = getServicePrice('color-company', 800);
  const pBring = getServicePrice('color-bring', 350);
  const pDesigner = getServicePrice('color-designer', 800);
  const pBarrier = getServicePrice('color-barrier', 350);

  el.innerHTML = `
    <div class="space-y-2">
      <button type="button" onclick="selectPosItemWithDiscountCheck('color-company', ${pCompany}, '染髮 (用公司染劑)', 1, 54);" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🏢</span>
          <div class="font-bold text-slate-900 text-sm">用公司染劑</div>
        </div>
        <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${pCompany.toLocaleString()}</span>
      </button>

      <button type="button" onclick="selectPosItemWithDiscountCheck('color-bring', ${pBring}, '染髮 (顧客自備染膏)', 1, 60);" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🧴</span>
          <div class="font-bold text-slate-900 text-sm">顧客自備染膏</div>
        </div>
        <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${pBring.toLocaleString()}</span>
      </button>

      <button type="button" onclick="selectPosItemWithDiscountCheck('color-designer', ${pDesigner}, '染髮 (設計師自備染膏)', 1, 60);" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🎨</span>
          <div class="font-bold text-slate-900 text-sm">設計師自備染膏</div>
        </div>
        <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${pDesigner.toLocaleString()}</span>
      </button>

      <button type="button" onclick="selectPosItemWithDiscountCheck('color-barrier', ${pBarrier}, '染髮 (頭皮隔離霜)', 1, 54);" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🛡️</span>
          <div class="font-bold text-slate-900 text-sm">頭皮隔離霜</div>
        </div>
        <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${pBarrier.toLocaleString()}</span>
      </button>
    </div>
  `;
}

function setPermChemicalType(type) {
  posPermChemical = type;
  const contentEl = document.getElementById('pos-picker-content');
  if (contentEl) {
    renderPermOptions(contentEl);
    appendCustomServiceOptions(contentEl, 'perm');
  }
}

function renderPermOptions(el) {
  const isEmployee = posIdentity === 'employee';
  posPermRolls = 1;
  const isDesignerChem = posPermChemical === 'designer';
  const chemRate = isDesignerChem ? 60 : 54;
  const chemLabel = isDesignerChem ? '(自備藥水)' : '(公司藥水)';

  const coldEmp = isDesignerChem ? getServicePrice('perm-cold-emp-self', 2000) : getServicePrice('perm-cold-emp', 2000);
  const coldFam = isDesignerChem ? getServicePrice('perm-cold-fam-self', 2300) : getServicePrice('perm-cold-fam', 2300);
  const partRollUnit = isDesignerChem ? getServicePrice('perm-cold-part-self', 50) : getServicePrice('perm-cold-part', 50);
  const digShort = isDesignerChem ? getServicePrice('perm-dig-short-self', 2300) : getServicePrice('perm-dig-short', 2300);
  const digLong = isDesignerChem ? getServicePrice('perm-dig-long-self', 2500) : getServicePrice('perm-dig-long', 2500);
  const digXlong = isDesignerChem ? getServicePrice('perm-dig-xlong-self', 2800) : getServicePrice('perm-dig-xlong', 2800);

  const coldEmpId = isDesignerChem ? 'perm-cold-emp-self' : 'perm-cold-emp';
  const coldFamId = isDesignerChem ? 'perm-cold-fam-self' : 'perm-cold-fam';
  const digShortId = isDesignerChem ? 'perm-dig-short-self' : 'perm-dig-short';
  const digLongId = isDesignerChem ? 'perm-dig-long-self' : 'perm-dig-long';
  const digXlongId = isDesignerChem ? 'perm-dig-xlong-self' : 'perm-dig-xlong';

  el.innerHTML = `
    <div class="space-y-3">
      <div class="bg-slate-100 p-1 rounded-xl grid grid-cols-2 gap-1 text-xs font-bold">
        <button type="button" onclick="setPermChemicalType('company')" class="py-2 rounded-lg transition ${!isDesignerChem ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}">
          公司藥水
        </button>
        <button type="button" onclick="setPermChemicalType('designer')" class="py-2 rounded-lg transition ${isDesignerChem ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'}">
          設計師自備
        </button>
      </div>

      <div class="space-y-2">
        <div class="text-xs font-bold text-slate-500">
          冷燙髮 ${chemLabel}
        </div>

        ${isEmployee ? `
          <button type="button" onclick="selectPosItemWithDiscountCheck('${coldEmpId}', ${coldEmp}, '冷燙整頭-員工 ${chemLabel}', 1, ${chemRate});" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
            <div class="flex items-center gap-3">
              <span class="text-2xl">❄️</span>
              <div class="font-bold text-slate-900 text-sm">冷燙整頭 (員工)</div>
            </div>
            <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${coldEmp.toLocaleString()}</span>
          </button>
        ` : `
          <button type="button" onclick="selectPosItemWithDiscountCheck('${coldFamId}', ${coldFam}, '冷燙整頭-非員工 ${chemLabel}', 1, ${chemRate});" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
            <div class="flex items-center gap-3">
              <span class="text-2xl">❄️</span>
              <div class="font-bold text-slate-900 text-sm">冷燙整頭</div>
            </div>
            <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${coldFam.toLocaleString()}</span>
          </button>
        `}

        <div class="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-900 text-sm">局部補燙 ($${partRollUnit}/卷)</div>
            </div>
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

      <div class="space-y-2 pt-2 border-t border-slate-100">
        <div class="text-xs font-bold text-slate-500">
          溫朔燙 ${chemLabel}
        </div>
        <button type="button" onclick="selectPosItemWithDiscountCheck('${digShortId}', ${digShort}, '溫朔燙 (短髮) ${chemLabel}', 1, ${chemRate});" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="font-bold text-slate-900 text-sm">短髮</div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${digShort.toLocaleString()}</span>
        </button>
        <button type="button" onclick="selectPosItemWithDiscountCheck('${digLongId}', ${digLong}, '溫朔燙 (長髮) ${chemLabel}', 1, ${chemRate});" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="font-bold text-slate-900 text-sm">長髮</div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${digLong.toLocaleString()}</span>
        </button>
        <button type="button" onclick="selectPosItemWithDiscountCheck('${digXlongId}', ${digXlong}, '溫朔燙 (過長) ${chemLabel}', 1, ${chemRate});" class="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between text-left">
          <div class="font-bold text-slate-900 text-sm">過長</div>
          <span class="text-sm font-black text-amber-700 font-numeric">NT$ ${digXlong.toLocaleString()}</span>
        </button>
      </div>
    </div>
  `;
}

function updatePermRolls(delta) {
  posPermRolls = Math.max(1, posPermRolls + delta);
  const isDesignerChem = posPermChemical === 'designer';
  const unitPrice = isDesignerChem ? getServicePrice('perm-cold-part-self', 50) : getServicePrice('perm-cold-part', 50);
  const valEl = document.getElementById('pos-perm-rolls-val');
  const btnEl = document.getElementById('pos-perm-rolls-add-btn');
  if (valEl) valEl.textContent = posPermRolls;
  if (btnEl) btnEl.textContent = `＋ 加入局部補燙 (NT$ ${(posPermRolls * unitPrice).toLocaleString()})`;
}

function addPermRollsItem() {
  const isDesignerChem = posPermChemical === 'designer';
  const unitPrice = isDesignerChem ? getServicePrice('perm-cold-part-self', 50) : getServicePrice('perm-cold-part', 50);
  const partId = isDesignerChem ? 'perm-cold-part-self' : 'perm-cold-part';
  const total = posPermRolls * unitPrice;
  const chemRate = isDesignerChem ? 60 : 54;
  const chemLabel = isDesignerChem ? '(自備藥水)' : '(公司藥水)';
  selectPosItemWithDiscountCheck(partId, total, `冷燙髮 (局部補燙 ${posPermRolls}卷) ${chemLabel}`, 1, chemRate);
}

function renderProductsOptions(el, query = '') {
  const allServices = (typeof appState !== 'undefined' && appState.services && appState.services.length > 0)
    ? appState.services
    : (typeof DEFAULT_SERVICES !== 'undefined' ? DEFAULT_SERVICES : []);
  const products = allServices.filter(s => s.category === '產品銷售');
  const filtered = query
    ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : products;

  el.innerHTML = `
    <div class="space-y-3">
      <div class="relative">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <i data-lucide="search" class="w-4 h-4"></i>
        </span>
        <input type="text" id="pos-product-search" value="${query}" oninput="renderProductsOptions(document.getElementById('pos-picker-content'), this.value)" placeholder="搜尋產品名稱..." class="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
      </div>

      <div class="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        ${filtered.length === 0 ? `
          <div class="p-6 text-center text-slate-400 text-xs">查無符合名稱的產品</div>
        ` : filtered.map(p => {
          const empP = (typeof p.empPrice === 'number' && p.empPrice > 0 && p.empPrice < p.price)
            ? p.empPrice
            : Math.round(p.price * 0.9);
          const commRate = typeof p.rate === 'number' && p.rate > 0 ? p.rate : 30;
          const allowsDiscount = p.allowDiscount !== false;

          return `
            <div class="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition flex items-center justify-between gap-2 shadow-2xs">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-900 text-xs sm:text-sm truncate">${p.name}</div>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span class="text-xs font-black text-slate-800 font-numeric">NT$ ${p.price.toLocaleString()}</span>
                  ${allowsDiscount ? `
                    <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-numeric">9折 NT$ ${empP.toLocaleString()}</span>
                  ` : ''}
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                ${allowsDiscount ? `
                  <button type="button" onclick="applyItemWithDiscount('${p.id}', ${p.price}, '${p.name}', 1, ${commRate}, false); closePosPickerModal();" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition">
                    原價
                  </button>
                  <button type="button" onclick="applyItemWithDiscount('${p.id}', ${empP}, '${p.name}', 1, ${commRate}, true); closePosPickerModal();" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-0.5 shadow-2xs">
                    9折
                  </button>
                ` : `
                  <button type="button" onclick="addPosItem('${p.id}', ${p.price}, '${p.name}', 1, ${commRate}); closePosPickerModal();" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-2xs">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i> 加入
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function addPosItem(serviceId, overridePrice = null, customName = '', customQty = 1, customRate = null) {
  const srv = getServiceItem(serviceId);
  const price = overridePrice !== null ? overridePrice : (srv ? srv.price : 0);
  const name = customName || (srv ? srv.name : '美髮項目');
  const rate = customRate !== null ? customRate : (srv ? (srv.rate || 0) : 0);

  const existing = currentBillingRows.find(r => r.serviceId === serviceId && r.price === price && r.rate === rate && (!customName || r.name === customName));
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

function removeServiceRow(rowId) {
  currentBillingRows = currentBillingRows.filter(r => r.rowId !== rowId);
  renderBillingRows();
}

// 列上直接修改單價（取代瀏覽器跳窗）
let editingPriceRowId = null;

function startEditRowPrice(rowId) {
  editingPriceRowId = rowId;
  renderBillingRows();
  const input = document.getElementById(`${rowId}-price-input`);
  if (input) {
    input.focus();
    input.select?.();
  }
}

function commitRowPriceEdit(rowId, value) {
  if (editingPriceRowId !== rowId) return;
  editingPriceRowId = null;
  const num = parseFloat(value);
  if (!isNaN(num) && num >= 0) {
    onRowInputChange(rowId, 'price', num);
  }
  renderBillingRows();
}

function cancelRowPriceEdit() {
  editingPriceRowId = null;
  renderBillingRows();
}

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

function onRowInputChange(rowId, field, value) {
  const row = currentBillingRows.find(r => r.rowId === rowId);
  if (!row) return;

  const numVal = parseFloat(value) || 0;
  if (field === 'price') row.price = Math.max(0, numVal);
  if (field === 'rate') row.rate = Math.max(0, Math.min(100, numVal));
  if (field === 'qty') row.qty = Math.max(1, Math.floor(numVal));

  updateRowCalculations();
}

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

    // 兩行版面：第一行品名與刪除，第二行單價與數量小計，窄螢幕手機也不會擠壓
    return `
      <div id="${row.rowId}" class="service-row-item p-3.5 sm:p-4 bg-slate-50/95 hover:bg-slate-50 border border-slate-200 rounded-2xl transition space-y-2.5 shadow-2xs">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-start gap-2 min-w-0">
            <span class="w-5 h-5 mt-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
              ${index + 1}
            </span>
            <span class="font-bold text-slate-900 text-sm leading-snug break-words">${escapeBillingText(itemName)}</span>
          </div>
          <button type="button" onclick="removeServiceRow('${row.rowId}')" class="p-1 -mr-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0" title="移除此項目">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pl-7">
          <div class="text-xs text-slate-500 flex items-center gap-1.5 ${editingPriceRowId === row.rowId ? 'shrink-0' : 'min-w-0'}">
            ${editingPriceRowId === row.rowId ? `
              <span class="shrink-0">NT$</span>
              <input type="number" inputmode="numeric" min="0" step="1" id="${row.rowId}-price-input" value="${row.price || 0}"
                onkeydown="if (event.key === 'Enter') { event.preventDefault(); this.blur(); } else if (event.key === 'Escape') { cancelRowPriceEdit(); }"
                onblur="commitRowPriceEdit('${row.rowId}', this.value)"
                class="w-20 rounded-lg border border-amber-400 bg-white px-2 py-1 text-sm font-bold text-slate-900 font-numeric focus:ring-2 focus:ring-amber-500/30 focus:outline-none">
              <button type="button" onmousedown="event.preventDefault()" onclick="commitRowPriceEdit('${row.rowId}', document.getElementById('${row.rowId}-price-input').value)" class="shrink-0 px-2 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold">完成</button>
            ` : `
              <span class="whitespace-nowrap">單價 NT$ ${(row.price || 0).toLocaleString()}</span>
              <button type="button" onclick="startEditRowPrice('${row.rowId}')" class="whitespace-nowrap text-amber-700 hover:text-amber-800 underline text-[11px] font-semibold">
                修改
              </button>
            `}
          </div>

          <div class="flex items-center gap-2 shrink-0 ml-auto">
            <div class="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
              <button type="button" onclick="changeCartQty('${row.rowId}', -1)" class="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition font-bold text-base select-none">−</button>
              <span class="w-6 text-center text-xs font-bold font-numeric text-slate-900">${row.qty || 1}</span>
              <button type="button" onclick="changeCartQty('${row.rowId}', 1)" class="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition font-bold text-base select-none">＋</button>
            </div>
            <strong id="${row.rowId}-subtotal" class="text-slate-900 font-numeric text-sm font-extrabold text-right min-w-[64px]">NT$ ${itemTotal.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  updateRowCalculations();
}

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

const POS_GENDER_LABELS = { female: '女性', male: '男性' };
const POS_IDENTITY_LABELS = { employee: '在職員工', retiree: '退休員工', family: '員工眷屬', external: '非員工' };

// 開單前檢查；不通過時提示原因並回傳 false
function validateBillingBeforeSave() {
  if (typeof appState !== 'undefined' && appState.staff && appState.staff.length === 0) {
    appAlert('系統中尚無人員！請先點擊上方提示或前往「設定」新增第一位設計師！');
    if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin' && typeof openStaffModal === 'function') {
      openStaffModal();
    }
    return false;
  }

  if (!currentBillingRows || currentBillingRows.length === 0) {
    appAlert('請至少新增一項服務項目！');
    return false;
  }

  const unselectedRow = currentBillingRows.find(r => !r.serviceId);
  if (unselectedRow) {
    appAlert('請為所有項目選擇服務項目！');
    return false;
  }

  if (typeof currentLinkedStaff === 'undefined' || !currentLinkedStaff) {
    if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') {
      appAlert('您的管理員帳號尚未綁定店內設計師身分，目前無法開單！請先至「設定」綁定或新增人員。');
      if (typeof openStaffModal === 'function') openStaffModal();
    } else {
      appAlert('您的帳號尚未由管理員綁定店內人員身分，目前無法開單！請聯繫管理員協助綁定。');
    }
    return false;
  }
  return true;
}

function escapeBillingText(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 「確認開單」按鈕：先顯示確認卡，讓設計師與顧客核對項目、身分與總額
function reviewCurrentOrder() {
  if (editingPriceRowId) {
    const input = document.getElementById(`${editingPriceRowId}-price-input`);
    commitRowPriceEdit(editingPriceRowId, input ? input.value : '');
  }
  if (!validateBillingBeforeSave()) return;

  const modal = document.getElementById('modal-order-confirm');
  if (!modal) {
    saveCurrentOrder();
    return;
  }

  const dateVal = document.getElementById('billing-date')?.value || getLocalDateString();
  const notes = document.getElementById('billing-notes')?.value?.trim() || '';
  let total = 0;
  const itemsHtml = currentBillingRows.map(r => {
    const qty = r.qty || 1;
    const amount = (r.price || 0) * qty;
    total += amount;
    return `
      <div class="flex items-start justify-between gap-3 py-2">
        <div class="min-w-0">
          <div class="text-sm font-bold text-slate-900">${escapeBillingText(r.name || getServiceItem(r.serviceId)?.name || '美髮項目')}</div>
          <div class="text-xs text-slate-500 font-numeric">NT$ ${(r.price || 0).toLocaleString()} × ${qty}</div>
        </div>
        <div class="text-sm font-black text-slate-900 font-numeric shrink-0">NT$ ${amount.toLocaleString()}</div>
      </div>
    `;
  }).join('');

  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('order-confirm-staff', currentLinkedStaff.name);
  setText('order-confirm-date', dateVal);
  setText('order-confirm-customer', `${POS_GENDER_LABELS[posGender] || ''} · ${POS_IDENTITY_LABELS[posIdentity] || ''}`);
  setText('order-confirm-total', total.toLocaleString());
  const itemsEl = document.getElementById('order-confirm-items');
  if (itemsEl) itemsEl.innerHTML = itemsHtml;
  const notesWrap = document.getElementById('order-confirm-notes-wrap');
  if (notesWrap) notesWrap.classList.toggle('hidden', !notes);
  setText('order-confirm-notes', notes);

  const btn = document.getElementById('order-confirm-submit');
  if (btn) btn.disabled = false;
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeOrderConfirmModal() {
  document.getElementById('modal-order-confirm')?.classList.add('hidden');
}

async function confirmOrderFromReview() {
  const btn = document.getElementById('order-confirm-submit');
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
  }
  try {
    const ok = await saveCurrentOrder();
    if (ok) closeOrderConfirmModal();
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveCurrentOrder() {
  if (!validateBillingBeforeSave()) return false;

  const staff = currentLinkedStaff;
  const dateVal = document.getElementById('billing-date')?.value || (typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0]);
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
    id: 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
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

  // 保留目前購物車，供「復原」時還原
  const undoSnapshot = {
    order: newOrder,
    rows: JSON.parse(JSON.stringify(currentBillingRows)),
    notes,
    date: dateVal,
    posGender,
    posIdentity,
    posPermChemical
  };

  if (typeof appState !== 'undefined' && appState.orders) {
    appState.orders.unshift(newOrder);
  }

  let writeResult = 'synced';
  try {
    if (typeof appendOrderToCloud === 'function') {
      writeResult = await appendOrderToCloud(newOrder);
    } else if (typeof syncDataToCloud === 'function') {
      await syncDataToCloud('orders');
    }
  } catch (err) {
    // 寫入失敗：撤回本機這一筆，保留購物車讓使用者可再試一次
    if (typeof appState !== 'undefined' && appState.orders) {
      appState.orders = appState.orders.filter(o => o.id !== newOrder.id);
    }
    console.error('開單寫入失敗:', err);
    appAlert('開單失敗，項目仍保留在畫面上，請稍後再試一次。\n\n原因：' + (err && err.message ? err.message : '無法連線至雲端'), { title: '開單未完成' });
    return false;
  }

  resetBillingForm();
  showOrderSuccess(undoSnapshot, writeResult === 'queued');
  return true;
}

// ==========================================
// 開單成功畫面：大字顯示單號與金額，5 秒內可復原
// ==========================================
const ORDER_UNDO_SECONDS = 5;
let lastOrderUndo = null;
let orderUndoTimer = null;

function showOrderSuccess(undoSnapshot, isQueued) {
  const modal = document.getElementById('modal-order-success');
  if (!modal) {
    if (typeof showToast === 'function') showToast(isQueued ? '開單成功（離線暫存，連線後自動上傳）' : '開單成功！');
    return;
  }
  clearOrderUndoTimer();
  lastOrderUndo = undoSnapshot;

  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('order-success-no', undoSnapshot.order.orderNo);
  setText('order-success-amount', undoSnapshot.order.totalAmount.toLocaleString());
  document.getElementById('order-success-offline')?.classList.toggle('hidden', !isQueued);

  const undoBtn = document.getElementById('order-success-undo-btn');
  if (undoBtn) undoBtn.disabled = false;
  let remaining = ORDER_UNDO_SECONDS;
  setText('order-success-undo-count', remaining);
  orderUndoTimer = setInterval(() => {
    remaining -= 1;
    setText('order-success-undo-count', remaining);
    if (remaining <= 0) {
      closeOrderSuccess();
    }
  }, 1000);

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function clearOrderUndoTimer() {
  if (orderUndoTimer) {
    clearInterval(orderUndoTimer);
    orderUndoTimer = null;
  }
}

function closeOrderSuccess() {
  clearOrderUndoTimer();
  lastOrderUndo = null;
  document.getElementById('modal-order-success')?.classList.add('hidden');
}

async function undoLastOrder() {
  const snap = lastOrderUndo;
  if (!snap) return;
  const undoBtn = document.getElementById('order-success-undo-btn');
  if (undoBtn) undoBtn.disabled = true;
  clearOrderUndoTimer();

  appState.orders = appState.orders.filter(o => o.id !== snap.order.id);
  try {
    if (typeof removeOrderFromCloud === 'function') {
      await removeOrderFromCloud(snap.order);
    } else if (typeof syncDataToCloud === 'function') {
      await syncDataToCloud('orders');
    }
  } catch (err) {
    console.error('復原客單失敗:', err);
    closeOrderSuccess();
    appAlert(`這張單（${snap.order.orderNo}）沒能撤回，請到「歷史紀錄」將它作廢。`, { title: '復原失敗' });
    return;
  }

  // 還原購物車，讓使用者修改後重新開單
  currentBillingRows = snap.rows;
  posGender = snap.posGender;
  posIdentity = snap.posIdentity;
  posPermChemical = snap.posPermChemical;
  const notesEl = document.getElementById('billing-notes');
  if (notesEl) notesEl.value = snap.notes;
  const dateEl = document.getElementById('billing-date');
  if (dateEl) dateEl.value = snap.date;

  closeOrderSuccess();
  generateNewOrderNo();
  renderPosWizard();
  renderBillingRows();
  if (typeof showToast === 'function') showToast(`已復原，單號 ${snap.order.orderNo} 已取消，可修改後重新開單`);
}

// 開單頁「今日小計」：員工看自己的，管理員看全店
function renderTodaySummary() {
  const el = document.getElementById('today-summary-text');
  if (!el) return;
  const isAdmin = typeof currentUserRole !== 'undefined' && currentUserRole === 'admin';
  const linked = typeof currentLinkedStaff !== 'undefined' ? currentLinkedStaff : null;
  if (!isAdmin && !linked) {
    el.textContent = '';
    return;
  }
  const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
  const orders = (typeof appState !== 'undefined' && Array.isArray(appState.orders)) ? appState.orders : [];
  const todayOrders = orders.filter(o => o && !o.isDeleted && o.date === today &&
    (isAdmin || o.staffId === linked.id || o.assistantId === linked.id));
  const sum = todayOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  el.textContent = `${isAdmin ? '全店今日' : '我今日'} ${todayOrders.length} 單 · NT$ ${sum.toLocaleString()}`;
}

function resetBillingForm() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('SALON_BILLING_DRAFT');
    }
  } catch (e) {}

  const notesInput = document.getElementById('billing-notes');
  if (notesInput) notesInput.value = '';
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
  posPermChemical = 'company';
  currentBillingRows = [];

  generateNewOrderNo();
  renderPosWizard();
  renderBillingRows();
}

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
