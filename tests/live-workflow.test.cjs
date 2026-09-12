const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function setup(files, extra = {}) {
  const elements = new Map();
  const context = vm.createContext({
    console, window: {}, DEFAULT_ADMIN_KEY_HASH: '',
    document: { getElementById: id => elements.get(id) || null },
    ...extra
  });
  for (const file of ['state', ...files]) {
    vm.runInContext(readFileSync(join(__dirname, '../js', `${file}.js`), 'utf8'), context);
  }
  return { elements, run: code => vm.runInContext(code, context) };
}

function select(value = '') {
  return {
    value,
    set innerHTML(html) {
      this.value = /<option value="([^"]*)"/.exec(html)?.[1] || '';
      this.html = html;
    }
  };
}

test('desktop and mobile history show saved item receipts without customer names and include time', () => {
  const { elements, run } = setup(['history']);
  elements.set('history-table-body', {});
  elements.set('history-cards-mobile', {});
  run(`currentUser = {uid:'user'}; currentUserRole = 'staff';
    appState.services = [{id:'cut', price:9999}];
    renderHistoryView([{id:'o',orderNo:'T-001',date:'2026-09-07',time:'15:20',staffName:'A',
      customer:'OLD_CUSTOMER_NAME',notes:'',totalAmount:800,totalCommission:400,
      items:[{name:'Cut <special>',price:450,qty:2,amount:800}]}]);`);
  for (const id of ['history-table-body', 'history-cards-mobile']) {
    const html = elements.get(id).innerHTML;
    assert.match(html, /單價 NT\$ 450 × 2/);
    assert.match(html, /NT\$ 800/);
    assert.match(html, /Cut &lt;special&gt;/);
    assert.match(html, /15:20/);
    assert.doesNotMatch(html, /OLD_CUSTOMER_NAME|9999|NT\$ 400/);
  }
  // 電腦端表格服務項目內不再多出重複的「實收 NT$」標註
  assert.doesNotMatch(elements.get('history-table-body').innerHTML, /實收 NT\$/);
  // 手機卡片底部顯示實收總額
  assert.match(elements.get('history-cards-mobile').innerHTML, /實收: <strong.*?>NT\$ 800<\/strong>/);
  assert.match(run("renderHistoryItemPrices([{name:'Hair',price:500,qty:2}])"), /單價 NT\$ 500 × 2/);
});

test('history empty hint displays correct message for bound vs unbound staff with 0 orders', () => {
  const { elements, run } = setup(['history']);
  const emptyHint = { className: '', classList: { add() {}, remove() {} }, innerHTML: '' };
  elements.set('history-table-body', {});
  elements.set('history-cards-mobile', {});
  elements.set('history-empty-hint', emptyHint);

  // 1. Bound staff with 0 orders: shows normal empty hint
  run("currentUser = {uid:'user'}; currentUserRole = 'staff'; currentLinkedStaff = {id:'s1', name:'developer2'}; renderHistoryView([])");
  assert.match(emptyHint.innerHTML, /尚無符合條件的客單紀錄/);
  assert.doesNotMatch(emptyHint.innerHTML, /尚未由管理員綁定/);

  // 2. Unbound staff: shows unbound warning
  run("currentLinkedStaff = null; renderHistoryView([])");
  assert.match(emptyHint.innerHTML, /您的帳號尚未由管理員綁定店內人員身分/);
});

test('saving and resetting an order works without a customer field', async () => {
  let synced = 0;
  const { elements, run } = setup(['billing'], {
    syncDataToCloud: async () => { synced++; }, showToast() {}
  });
  elements.set('billing-date', { value:'2026-09-07' });
  elements.set('billing-time', { value:'16:45' });
  elements.set('billing-notes', { value:'note' });
  elements.set('billing-order-no', { textContent:'單號：T-001' });
  run(`appState.staff = [{id:'a',name:'A'}]; currentLinkedStaff = appState.staff[0];
    appState.services = [{id:'cut',name:'Cut',price:500,rate:50}];
    currentBillingRows = [{serviceId:'cut',price:450,rate:50,qty:2}];`);
  await run('saveCurrentOrder()');
  assert.equal(synced, 1);
  assert.equal(run('appState.orders[0].totalAmount'), 900);
  assert.match(run('appState.orders[0].time'), /^\d{2}:\d{2}$/);
  assert.equal(run("Object.hasOwn(appState.orders[0], 'customer')"), false);
  assert.equal(elements.get('billing-notes').value, '');
});

test('editing price and quantity updates both the row subtotal and summary', () => {
  const { elements, run } = setup(['billing']);
  for (const id of ['r-subtotal', 'summary-card-total-amount', 'summary-card-items-count']) {
    elements.set(id, {});
  }
  run("currentBillingRows = [{ rowId: 'r', price: 100, qty: 1, rate: 50 }]");
  run("onRowInputChange('r', 'price', '250'); onRowInputChange('r', 'qty', '3')");
  assert.equal(elements.get('r-subtotal').textContent, 'NT$ 750');
  assert.equal(elements.get('summary-card-total-amount').textContent, '750');
  assert.equal(elements.get('summary-card-items-count').textContent, '3 項服務');
});

test('staff filters survive refresh and fall back when the selected staff is removed', () => {
  const { elements, run } = setup(['billing']);
  elements.set('history-filter-staff', select('b'));
  elements.set('monthly-select-staff', select('b'));
  run("currentUserRole = 'admin'; appState.staff = [{id:'a',name:'A'}, {id:'b',name:'B'}]; populateStaffDropdowns()");
  assert.equal(elements.get('history-filter-staff').value, 'b');
  assert.equal(elements.get('monthly-select-staff').value, 'b');
  run('appState.staff.pop(); populateStaffDropdowns()');
  assert.equal(elements.get('history-filter-staff').value, 'ALL');
  assert.equal(elements.get('monthly-select-staff').value, 'a');
  run("currentUserRole = 'staff'; populateStaffDropdowns()");
  assert.equal(elements.get('history-filter-staff').value, '');
  assert.equal(elements.get('history-filter-staff').disabled, true);
});

test('historical years come from lexical appState and retain the selected year', () => {
  const { elements, run } = setup(['history']);
  const year = select('2020');
  elements.set('history-filter-year', year);
  run("appState.orders = [{date:'2020-03-01'}, {date:'2019-12-31'}]; populateHistoryYearOptions()");
  assert.match(year.html, /value="2019"/);
  assert.equal(year.value, '2020');
});

test('cloud updates retain a billing draft and a new subscription initializes once', async () => {
  let snapshot;
  let initialized = 0;
  const callbacks = Object.fromEntries([
    'applyRolePermissions', 'initHistoryFilters', 'initMonthlyView',
    'populateStaffDropdowns', 'filterHistoryOrders', 'calculateMonthlyPayroll',
    'renderSettingsTables', 'checkStaffEmptyState'
  ].map(name => [name, () => {}]));
  const { run } = setup(['firebase'], {
    ...callbacks,
    localStorage: { setItem() {} },
    initBillingForm() { initialized++; run('currentBillingRows = []'); },
    fakeDb: { collection: () => ({ doc: () => ({ onSnapshot(fn) { snapshot = fn; return () => {}; } }) }) }
  });
  run('db = fakeDb; subscribeToCloudData()');
  const doc = { exists: true, data: () => ({ staff: [], services: [], orders: [] }) };
  await snapshot(doc);
  run("currentBillingRows = [{rowId:'draft', price:450, qty:2}]");
  await snapshot(doc);
  await snapshot(doc);
  assert.equal(initialized, 1);
  assert.equal(run('currentBillingRows[0].price'), 450);
  run('subscribeToCloudData()');
  await snapshot(doc);
  assert.equal(initialized, 2);
});

test('order numbering follows daily sequential order and flows continuously even with deleted orders', async () => {
  let synced = 0;
  const { elements, run } = setup(['billing'], {
    syncDataToCloud: async () => { synced++; }, showToast() {}
  });
  elements.set('billing-date', { value:'2026-09-09' });
  elements.set('billing-time', { value:'10:00' });
  elements.set('billing-notes', { value:'' });
  elements.set('billing-order-no', { textContent:'' });
  run(`appState.staff = [{id:'s1',name:'Alice'}]; currentLinkedStaff = appState.staff[0];
    appState.services = [{id:'cut',name:'Cut',price:500,rate:50}];
    currentBillingRows = [{serviceId:'cut',price:500,rate:50,qty:1}];`);

  // 開第一單
  await run('saveCurrentOrder()');
  assert.equal(run('appState.orders[0].orderNo'), 'T-20260909-001');

  // 開第二單
  run("currentBillingRows = [{serviceId:'cut',price:500,rate:50,qty:1}];");
  await run('saveCurrentOrder()');
  assert.equal(run('appState.orders[0].orderNo'), 'T-20260909-002');

  // 將第一單標記為軟刪除
  run("appState.orders[1].isDeleted = true;");

  // 開第三單，流水號順著流下去成為 003（不撞號且不重複發號）
  run("currentBillingRows = [{serviceId:'cut',price:500,rate:50,qty:1}];");
  await run('saveCurrentOrder()');
  assert.equal(run('appState.orders[0].orderNo'), 'T-20260909-003');
  assert.equal(run('appState.orders.length'), 3);
});

test('soft deleting an order retains data, logs deleter name and time, and excludes from revenue stats', async () => {
  let synced = 0;
  const { elements, run } = setup(['history'], {
    syncDataToCloud: async () => { synced++; },
    showToast() {},
    confirm: () => true
  });
  elements.set('history-table-body', {});
  elements.set('history-cards-mobile', {});
  elements.set('history-count', {});
  elements.set('history-total-revenue', {});
  elements.set('history-total-commission', {});

  run(`currentUser = {uid:'uid_hank', displayName:'Hank'}; currentUserRole = 'admin';
    currentLinkedStaff = {id:'s_hank', name:'Hank'};
    appState.orders = [
      { id:'ord_1', orderNo:'T-20260909-001', date:'2026-09-09', time:'11:00', staffId:'s_hank', staffName:'Hank',
        totalAmount:1000, totalCommission:500, items:[{name:'剪髮', price:1000, qty:1, amount:1000}], createdAt:'2026-09-09T11:00:00Z' },
      { id:'ord_2', orderNo:'T-20260909-002', date:'2026-09-09', time:'12:00', staffId:'s_hank', staffName:'Hank',
        totalAmount:2000, totalCommission:1000, items:[{name:'染髮', price:2000, qty:1, amount:2000}], createdAt:'2026-09-09T12:00:00Z' }
    ];
  `);

  // 刪除第 1 單
  await run("deleteOrder('ord_1')");
  assert.equal(synced, 1);

  // 驗證未抹除資料，且記錄刪除資訊
  assert.equal(run('appState.orders.length'), 2);
  const ord1 = run("appState.orders.find(o => o.id === 'ord_1')");
  assert.equal(ord1.isDeleted, true);
  assert.equal(ord1.deletedByName, 'Hank (管理員)');
  assert.ok(ord1.deletedAt);

  // 驗證歷史統計僅加總未刪除者 (第 2 單: 2000 實收 / 1000 抽成)
  run('renderHistoryView(appState.orders)');
  assert.equal(elements.get('history-total-revenue').textContent, 'NT$ 2,000');
  assert.equal(elements.get('history-total-commission').textContent, 'NT$ 1,000');
  assert.match(elements.get('history-count').innerHTML, /1 <span.*作廢 1 筆/);

  // 驗證畫面包含作廢與刪除資訊
  const tableHtml = elements.get('history-table-body').innerHTML;
  assert.match(tableHtml, /已作廢/);
  assert.match(tableHtml, /Hank \(管理員\)/);
  assert.match(tableHtml, /作廢不計/);
});

test('monthly payroll calculation excludes soft-deleted orders', () => {
  const { elements, run } = setup(['monthly']);
  elements.set('monthly-select-month', { value: '2026-09' });
  elements.set('monthly-select-staff', select('staff_1'));
  elements.set('stat-month-clients', {});
  elements.set('stat-month-avg-ticket', {});
  elements.set('stat-month-revenue', {});
  elements.set('stat-month-commission', {});
  elements.set('calc-commission', { value: '0' });
  elements.set('calc-other-bonus', { value: '0' });
  elements.set('monthly-net-salary', {});
  elements.set('monthly-orders-tbody', {});

  run(`currentUserRole = 'admin';
    appState.staff = [{id:'staff_1', name:'Bob'}];
    appState.orders = [
      { id:'o1', orderNo:'T-20260901-001', date:'2026-09-01', staffId:'staff_1', staffName:'Bob',
        totalAmount:1500, totalCommission:750, items:[] },
      { id:'o2', orderNo:'T-20260902-001', date:'2026-09-02', staffId:'staff_1', staffName:'Bob',
        totalAmount:3000, totalCommission:1500, isDeleted:true, deletedAt:'2026-09-02T10:00:00Z', items:[] }
    ];
    calculateMonthlyPayroll();
  `);

  // 僅計算未作廢的 o1 (客數 1, 營收 1500, 抽成 750)
  assert.equal(elements.get('stat-month-clients').textContent, 1);
  assert.equal(elements.get('stat-month-revenue').textContent, '1,500');
  assert.equal(elements.get('stat-month-commission').textContent, '750');
});

test('POS wizard correctly switches gender, identity, and updates condition badges', () => {
  const { elements, run } = setup(['constants', 'billing']);
  const badge = {};
  const note = {};
  const badgeCut = {};
  const descCut = {};
  const badgeShampoo = {};
  const descShampoo = {};
  const badgeProd = {};

  elements.set('pos-condition-badge', badge);
  elements.set('pos-discount-note-text', note);
  elements.set('pos-badge-cut', badgeCut);
  elements.set('pos-desc-cut', descCut);
  elements.set('pos-badge-shampoo', badgeShampoo);
  elements.set('pos-desc-shampoo', descShampoo);
  elements.set('pos-badge-prod', badgeProd);

  // 1. 預設女性 + 在職員工
  run("setPosGender('female'); setPosIdentity('employee');");
  assert.equal(badge.textContent, '女性 · 在職員工');
  assert.match(note.textContent, /女性剪髮 \$150/);
  assert.equal(badgeCut.textContent, '$150');
  assert.equal(badgeShampoo.textContent, '$80~$110');
  assert.equal(badgeProd.textContent, '9折');

  // 2. 切換男性 + 在職員工
  run("setPosGender('male');");
  assert.equal(badge.textContent, '男性 · 在職員工');
  assert.equal(badgeCut.textContent, '$200');

  // 3. 切換一般外客
  run("setPosIdentity('external');");
  assert.equal(badge.textContent, '男性 · 非員工');
  assert.equal(badgeCut.textContent, '$250~$300');
  assert.equal(badgeShampoo.textContent, '$110~$140');
  assert.equal(badgeProd.textContent, '門市定價');
});

test('POS item addition applies exact pricing for employee, family, external, and retail 9-discount', () => {
  const { elements, run } = setup(['constants', 'billing'], { showToast() {} });
  elements.set('service-rows-container', {});
  elements.set('summary-card-total-amount', {});
  elements.set('summary-card-items-count', {});

  // 測試在職員工加單：女剪髮 ($150) + 在職長髮洗頭 ($110) + 元氣潔淨露1號 (原價$2200, 員工價$1980)
  run(`
    appState.services = DEFAULT_SERVICES;
    posGender = 'female';
    posIdentity = 'employee';
    addPosItem('cut-emp-f');
    addPosItem('shampoo-act-long');
    addPosItem('prod-1', 1980, '元氣潔淨露1號');
  `);

  assert.equal(run('currentBillingRows.length'), 3);
  assert.equal(run('currentBillingRows[0].price'), 150);
  assert.equal(run('currentBillingRows[1].price'), 110);
  assert.equal(run('currentBillingRows[2].price'), 1980);
  // 實收總計 = 150 + 110 + 1980 = 2240
  assert.equal(elements.get('summary-card-total-amount').textContent, '2,240');
  assert.equal(elements.get('summary-card-items-count').textContent, '3 項服務');

  // 測試數量加減與局部補燙卷數
  const rowId0 = run('currentBillingRows[0].rowId');
  run(`changeCartQty('${rowId0}', 1);`); // 女剪髮變 2
  assert.equal(run('currentBillingRows[0].qty'), 2);
  assert.equal(elements.get('summary-card-total-amount').textContent, '2,390'); // 2240 + 150
});

test('POS complete billing flow generates sequential order and resets smoothly', async () => {
  let synced = 0;
  const { elements, run } = setup(['constants', 'billing'], {
    syncDataToCloud: async () => { synced++; },
    showToast() {}
  });

  elements.set('billing-date', { value: '2026-09-10' });
  elements.set('billing-time', { value: '14:30' });
  elements.set('billing-notes', { value: 'VIP 同仁指定洗剪' });
  elements.set('billing-order-no', { textContent: '' });
  elements.set('service-rows-container', {});
  elements.set('summary-card-total-amount', {});
  elements.set('summary-card-items-count', {});

  run(`
    appState.staff = [{id: 's_hank', name: 'Hank'}];
    currentLinkedStaff = appState.staff[0];
    appState.services = DEFAULT_SERVICES;
    appState.orders = [];

    // 開單：頭皮深層去角質 $350 + 護髮(蒸器) $120
    addPosItem('scalp-standard');
    addPosItem('treat-steamer');
  `);

  await run('saveCurrentOrder()');

  assert.equal(synced, 1);
  assert.equal(run('appState.orders.length'), 1);
  const order = run('appState.orders[0]');
  assert.equal(order.orderNo, 'T-20260910-001');
  assert.equal(order.staffName, 'Hank');
  assert.equal(order.totalAmount, 470); // 350 + 120
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0].name, '頭皮深層去角質');
  assert.equal(order.items[1].name, '護髮 (蒸器)');
  assert.match(order.time, /^\d{2}:\d{2}$/);
  assert.equal(order.notes, 'VIP 同仁指定洗剪');

  // 開單後購物車清空且備註重設
  assert.equal(run('currentBillingRows.length'), 0);
  assert.equal(elements.get('billing-notes').value, '');
});

test('ensureServicesSynced preserves admin-customized price and commission while providing all POS items', () => {
  const { run } = setup(['constants', 'firebase']);
  const customList = [
    { id: 'cut-emp-f', name: '女剪髮', price: 180, rate: 60, category: '剪髮' },
    { id: 'custom-special', name: '店長特調護髮', price: 880, rate: 50, category: '護髮' }
  ];

  const result = run(`ensureServicesSynced(${JSON.stringify(customList)})`);
  assert.equal(result.length, 41); // 40 default POS items + 1 custom item
  const cutItem = result.find(s => s.id === 'cut-emp-f');
  assert.equal(cutItem.price, 180);
  assert.equal(cutItem.rate, 60);
  assert.equal(cutItem.category, '剪髮');

  const customItem = result.find(s => s.id === 'custom-special');
  assert.equal(customItem.name, '店長特調護髮');
  assert.equal(customItem.price, 880);
  assert.equal(customItem.rate, 50);

  const prodItem = result.find(s => s.id === 'prod-1');
  assert.equal(prodItem.category, '產品銷售');
});

test('customizing service price and commission in appState.services propagates to POS modal, cart, and order commission', async () => {
  let synced = 0;
  const { elements, run } = setup(['constants', 'billing'], {
    syncDataToCloud: async () => { synced++; },
    showToast() {}
  });

  const pickerContainer = {};
  elements.set('pos-picker-content', pickerContainer);
  elements.set('billing-date', { value: '2026-09-12' });
  elements.set('billing-time', { value: '11:00' });
  elements.set('billing-notes', { value: '' });
  elements.set('billing-order-no', { textContent: '' });
  elements.set('service-rows-container', {});
  elements.set('summary-card-total-amount', {});
  elements.set('summary-card-items-count', {});

  run(`
    appState.staff = [{id: 's1', name: 'Alice'}];
    currentLinkedStaff = appState.staff[0];
    appState.services = DEFAULT_SERVICES.map(s => ({ ...s }));
    appState.orders = [];

    // 管理員在設定頁面修改了「女剪髮」價格為 $180，抽成調整為 60%
    const cutSrv = appState.services.find(s => s.id === 'cut-emp-f');
    cutSrv.price = 180;
    cutSrv.rate = 60;

    // 驗證 POS 彈窗即時渲染最新單價 NT$ 180
    posIdentity = 'employee';
    posGender = 'female';
    renderCutOptions(document.getElementById('pos-picker-content'));
  `);

  assert.match(pickerContainer.innerHTML, /NT\$ 180/);
  assert.doesNotMatch(pickerContainer.innerHTML, /NT\$ 150/);

  // 點選加入客單購物車並開單
  run(`
    addPosItem('cut-emp-f');
  `);

  assert.equal(run('currentBillingRows.length'), 1);
  assert.equal(run('currentBillingRows[0].price'), 180);
  assert.equal(run('currentBillingRows[0].rate'), 60);

  await run('saveCurrentOrder()');

  assert.equal(synced, 1);
  const order = run('appState.orders[0]');
  assert.equal(order.totalAmount, 180);
  // 抽成: Math.round(180 * (60 / 100)) = 108
  assert.equal(order.totalCommission, 108);
  assert.equal(order.salonNet, 72);
});

test('syncDataToCloud executes targeted field updates with merge to prevent overwriting other collections', async () => {
  const writtenPayloads = [];
  const fakeDoc = {
    set: async (payload, opts) => {
      writtenPayloads.push({ payload, opts });
    }
  };
  const { run } = setup(['firebase'], {
    localStorage: { setItem() {} },
    fakeDb: { collection: () => ({ doc: () => fakeDoc }) }
  });

  run(`
    db = fakeDb;
    currentUser = { uid: 'user_1' };
    currentUserRole = 'staff'; // 即使身分非 admin 也能成功同步指定欄位
    appState.services = [{ id: 's1', price: 200 }];
    appState.staff = [{ id: 'st1', name: 'Bob' }];
    appState.orders = [{ id: 'o1', totalAmount: 500 }];
  `);

  // 1. 僅同步 services
  await run("syncDataToCloud('services')");
  assert.equal(writtenPayloads.length, 1);
  assert.equal(JSON.stringify(writtenPayloads[0].payload), JSON.stringify({ services: [{ id: 's1', price: 200 }] }));
  assert.equal(JSON.stringify(writtenPayloads[0].opts), JSON.stringify({ merge: true }));

  // 2. 僅同步 staff
  await run("syncDataToCloud('staff')");
  assert.equal(writtenPayloads.length, 2);
  assert.equal(JSON.stringify(writtenPayloads[1].payload), JSON.stringify({ staff: [{ id: 'st1', name: 'Bob' }] }));
  assert.equal(JSON.stringify(writtenPayloads[1].opts), JSON.stringify({ merge: true }));

  // 3. 僅同步 orders
  await run("syncDataToCloud('orders')");
  assert.equal(writtenPayloads.length, 3);
  assert.equal(JSON.stringify(writtenPayloads[2].payload), JSON.stringify({ orders: [{ id: 'o1', totalAmount: 500 }] }));
  assert.equal(JSON.stringify(writtenPayloads[2].opts), JSON.stringify({ merge: true }));
});

test('ensureServicesSynced and syncDataToCloud never pass undefined properties to Firestore', async () => {
  const writtenPayloads = [];
  const fakeDoc = {
    set: async (payload, opts) => {
      // 模擬 Firestore JS SDK 對 undefined 的嚴格檢查
      const checkUndefined = (obj, path = '') => {
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          const currPath = path ? `${path}.${key}` : key;
          if (val === undefined) {
            throw new Error(`Function DocumentReference.set() called with invalid data. Unsupported field value: undefined (found in field ${currPath})`);
          }
          if (val && typeof val === 'object') {
            checkUndefined(val, currPath);
          }
        }
      };
      checkUndefined(payload);
      writtenPayloads.push(payload);
    }
  };

  const { run } = setup(['constants', 'firebase'], {
    localStorage: { setItem() {} },
    fakeDb: { collection: () => ({ doc: () => fakeDoc }) }
  });

  run(`
    db = fakeDb;
    currentUser = { uid: 'user_dev' };
    currentUserRole = 'admin';
    // 故意注入包含 undefined 屬性的項目
    appState.services = ensureServicesSynced([
      { id: 'cut-emp-f', price: 160 },
      { id: 'prod-1', price: 2200, empPrice: 1980 }
    ]);
  `);

  const cutItem = run("appState.services.find(s => s.id === 'cut-emp-f')");
  assert.equal('empPrice' in cutItem, false, 'Non-retail service must not have empPrice key');

  // 嘗試同步到雲端，Firestore set() 絕不可拋出 undefined 異常
  await run("syncDataToCloud('services')");
  assert.equal(writtenPayloads.length, 1);
});

test('saveCurrentOrder captures live dynamic record time without manual time input and preserves editable date', async () => {
  let synced = 0;
  let dynamicTime = '10:00';
  const { elements, run } = setup(['billing'], {
    syncDataToCloud: async () => { synced++; },
    showToast() {},
    getLocalTimeString: () => dynamicTime
  });

  // 介面上完全沒有 billing-time 輸入框，僅有可編輯的 billing-date
  elements.set('billing-date', { value: '2026-09-15' });
  elements.set('billing-notes', { value: '指定預約' });
  elements.set('billing-order-no', { textContent: '單號：T-20260915-001' });

  run(`
    appState.staff = [{ id: 'st1', name: 'Amy' }];
    currentLinkedStaff = appState.staff[0];
    appState.services = [{ id: 'cut', name: '剪髮', price: 200, rate: 0 }];
    currentBillingRows = [{ serviceId: 'cut', price: 200, qty: 1 }];
  `);

  // 第一單在 10:00 開出
  await run('saveCurrentOrder()');
  assert.equal(run('appState.orders[0].date'), '2026-09-15');
  assert.equal(run('appState.orders[0].time'), '10:00');

  // 經過一段時間閒置，系統時間推進至 11:35
  dynamicTime = '11:35';
  run(`currentBillingRows = [{ serviceId: 'cut', price: 200, qty: 1 }];`);

  // 第二單在 11:35 開出，記錄時間即時抓取 11:35 而不受任何舊時間或閒置影響
  await run('saveCurrentOrder()');
  assert.equal(run('appState.orders[0].time'), '11:35');
  assert.equal(run('appState.orders[0].date'), '2026-09-15');
});




