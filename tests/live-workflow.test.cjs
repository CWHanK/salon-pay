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
  assert.equal(run('appState.orders[0].time'), '16:45');
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


