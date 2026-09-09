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

test('desktop and mobile history show saved item receipts without customer names', () => {
  const { elements, run } = setup(['history']);
  elements.set('history-table-body', {});
  elements.set('history-cards-mobile', {});
  run(`currentUser = {uid:'user'}; currentUserRole = 'staff';
    appState.services = [{id:'cut', price:9999}];
    renderHistoryView([{id:'o',orderNo:'T-001',date:'2026-09-07',staffName:'A',
      customer:'OLD_CUSTOMER_NAME',notes:'',totalAmount:800,totalCommission:400,
      items:[{name:'Cut <special>',price:450,qty:2,amount:800}]}]);`);
  for (const id of ['history-table-body', 'history-cards-mobile']) {
    const html = elements.get(id).innerHTML;
    assert.match(html, /單價 NT\$ 450 × 2/);
    assert.match(html, /實收 NT\$ 800/);
    assert.match(html, /Cut &lt;special&gt;/);
    assert.doesNotMatch(html, /OLD_CUSTOMER_NAME|9999|NT\$ 400/);
  }
  assert.match(run("renderHistoryItemPrices([{name:'Free',price:100,qty:2,amount:0}])"), /實收 NT\$ 0/);
  assert.match(run("renderHistoryItemPrices([{name:'Legacy',price:100,qty:2}])"), /實收 NT\$ 200/);
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
  elements.set('billing-notes', { value:'note' });
  elements.set('billing-order-no', { textContent:'單號：T-001' });
  run(`appState.staff = [{id:'a',name:'A'}]; currentLinkedStaff = appState.staff[0];
    appState.services = [{id:'cut',name:'Cut',price:500,rate:50}];
    currentBillingRows = [{serviceId:'cut',price:450,rate:50,qty:2}];`);
  await run('saveCurrentOrder()');
  assert.equal(synced, 1);
  assert.equal(run('appState.orders[0].totalAmount'), 900);
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
