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
