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
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    ...extra
  });
  for (const file of ['state', ...files]) {
    vm.runInContext(readFileSync(join(__dirname, '../js', `${file}.js`), 'utf8'), context);
  }
  return { elements, run: code => vm.runInContext(code, context) };
}

// 模擬 Firestore：記錄每次寫入的內容，FieldValue 以標記物件表示
function fakeFirestore() {
  const writes = [];
  const doc = {
    set: async (payload, opts) => { writes.push({ op: 'set', payload, opts }); },
    update: async payload => { writes.push({ op: 'update', payload }); }
  };
  const firebase = {
    firestore: {
      FieldValue: {
        arrayUnion: v => ({ __op: 'arrayUnion', value: v }),
        arrayRemove: v => ({ __op: 'arrayRemove', value: v })
      }
    }
  };
  return { writes, db: { collection: () => ({ doc: () => doc }) }, firebase };
}

test('appendOrderToCloud only appends the new order instead of overwriting the whole orders array', async () => {
  const fs = fakeFirestore();
  const { run } = setup(['firebase'], { firebase: fs.firebase, fakeDb: fs.db });
  run(`db = fakeDb; currentUser = { uid: 'u1' };
    appState.orders = [{ id: 'old-1' }, { id: 'old-2' }];`);

  const result = await run("appendOrderToCloud({ id: 'new-1', totalAmount: 500 })");
  assert.equal(result, 'synced');
  assert.equal(fs.writes.length, 1);
  const { payload, opts } = fs.writes[0];
  assert.equal(payload.orders.__op, 'arrayUnion');
  assert.equal(payload.orders.value.id, 'new-1');
  assert.deepEqual(JSON.parse(JSON.stringify(opts)), { merge: true });
});

test('removeOrderFromCloud only removes that single order', async () => {
  const fs = fakeFirestore();
  const { run } = setup(['firebase'], { firebase: fs.firebase, fakeDb: fs.db });
  run("db = fakeDb; currentUser = { uid: 'u1' };");
  await run("removeOrderFromCloud({ id: 'ord-9', totalAmount: 300 })");
  assert.equal(fs.writes[0].op, 'update');
  assert.equal(fs.writes[0].payload.orders.__op, 'arrayRemove');
  assert.equal(fs.writes[0].payload.orders.value.id, 'ord-9');
});

test('offline appends return queued immediately without blocking the UI', async () => {
  const fs = fakeFirestore();
  const { run } = setup(['firebase'], { firebase: fs.firebase, fakeDb: fs.db });
  run("db = fakeDb; currentUser = { uid: 'u1' }; cloudSyncState = 'offline';");
  assert.equal(await run("appendOrderToCloud({ id: 'n1' })"), 'queued');
  assert.equal(fs.writes.length, 1);
});

test('snapshot orders are sorted newest first even when arrayUnion appended them at the end', async () => {
  let snapshot;
  const callbacks = Object.fromEntries([
    'applyRolePermissions', 'initHistoryFilters', 'initMonthlyView', 'initBillingForm',
    'populateStaffDropdowns', 'filterHistoryOrders', 'calculateMonthlyPayroll',
    'renderSettingsTables', 'checkStaffEmptyState'
  ].map(name => [name, () => {}]));
  const { run } = setup(['firebase'], {
    ...callbacks,
    fakeDb: { collection: () => ({ doc: () => ({ onSnapshot(fn) { if (typeof fn === 'function') snapshot = fn; return () => {}; } }) }) }
  });
  run('db = fakeDb; subscribeToCloudData()');
  await snapshot({ exists: true, data: () => ({ staff: [], services: [], orders: [
    { id: 'a', date: '2026-10-05', time: '10:00' },
    { id: 'b', date: '2026-10-06', time: '09:00' },
    { id: 'c', date: '2026-10-06', time: '15:30' }
  ] }) });
  assert.deepEqual(Array.from(run('appState.orders.map(o => o.id)')), ['c', 'b', 'a']);
});

test('deleted built-in services stay deleted while custom items and other defaults are kept', () => {
  const { run } = setup(['constants', 'firebase']);
  const result = run(`ensureServicesSynced([
    ...DEFAULT_SERVICES.map(s => ({ ...s })),
    { id: 'srv-1', name: '頭皮按摩', price: 300, rate: 50, category: '其他' }
  ], ['cut-ext-blow'])`);
  const ids = result.map(s => s.id);
  assert.equal(ids.includes('cut-ext-blow'), false);
  assert.equal(ids.includes('cut-ext-pure'), true);
  assert.equal(ids.includes('srv-1'), true);
  // 沒有刪除紀錄時，舊資料照常補齊所有內建項目
  const legacy = run("ensureServicesSynced([{ id: 'cut-emp-f', name: '剪髮 (員工-女)', price: 180, rate: 60, category: '剪髮' }])");
  assert.equal(legacy.length, run('DEFAULT_SERVICES.length'));
  assert.equal(legacy.find(s => s.id === 'cut-emp-f').price, 180);
});

test('an outdated admin device does not write services or downgrade the cloud version', async () => {
  let snapshot;
  const writes = [];
  const callbacks = Object.fromEntries([
    'applyRolePermissions', 'initHistoryFilters', 'initMonthlyView', 'initBillingForm',
    'populateStaffDropdowns', 'filterHistoryOrders', 'calculateMonthlyPayroll',
    'renderSettingsTables', 'checkStaffEmptyState'
  ].map(name => [name, () => {}]));
  const { run } = setup(['constants', 'version', 'firebase'], {
    ...callbacks,
    fakeDb: { collection: () => ({ doc: () => ({
      onSnapshot(fn) { if (typeof fn === 'function') snapshot = fn; return () => {}; },
      set: async p => { writes.push(p); }
    }) }) }
  });
  run("db = fakeDb; currentUser = { uid: 'admin' }; currentUserRole = 'admin'; triggerAppUpdate = () => {}; subscribeToCloudData()");
  await snapshot({ exists: true, data: () => ({ appVersion: '20991231_1', staff: [], services: [{ id: 'x', name: 'X', price: 1 }], orders: [] }) });
  assert.equal(writes.length, 0);

  // 版本較新的管理員裝置則會往上校正雲端版本
  await snapshot({ exists: true, data: () => ({ appVersion: '20200101_1', staff: [], services: run('appState.services'), orders: [] }) });
  assert.ok(writes.some(p => p.appVersion === run('APP_VERSION')));
});

test('auto-binding never grabs an unrelated staff record', () => {
  const { run } = setup(['constants'], { syncDataToCloud: async () => {} });
  // 店內唯一一位人員綁定的是別的帳號，任何人登入都不應被綁到她身上
  run(`currentUser = { uid: 'stranger', email: 'stranger@salon.local' };
    appState.staff = [{ id: 's1', name: 'amy', linkedEmail: 'amy@salon.local', linkedUid: '' }];
    updateLinkedStaff();`);
  assert.equal(run('currentLinkedStaff'), null);
  assert.equal(run('appState.staff[0].linkedUid'), '');

  // 同名帳號也不能搶綁已設定綁定帳號的人員
  run(`currentUser = { uid: 'other-amy', email: 'amy@gmail.com' };
    appState.staff = [{ id: 's1', name: 'amy', linkedEmail: 'amy@salon.local', linkedUid: 'real-amy' }];
    updateLinkedStaff();`);
  assert.equal(run('appState.staff[0].linkedUid'), 'real-amy');

  // 管理員設定的綁定帳號本人登入：正常綁定並補上 UID
  run(`currentUser = { uid: 'amy-uid', email: 'amy@salon.local' };
    appState.staff = [{ id: 's1', name: 'Amy', linkedEmail: 'amy@salon.local', linkedUid: '' }];
    updateLinkedStaff();`);
  assert.equal(run('currentLinkedStaff.id'), 's1');
  assert.equal(run('appState.staff[0].linkedUid'), 'amy-uid');
});

function billingSetup(extra = {}) {
  const { elements, run } = setup(['constants', 'billing'], { showToast() {}, appAlert: async () => {}, ...extra });
  elements.set('billing-date', { value: '2026-10-06' });
  elements.set('billing-notes', { value: '急件' });
  elements.set('billing-order-no', { textContent: '' });
  run(`appState.staff = [{ id: 's1', name: 'Amy' }]; currentLinkedStaff = appState.staff[0];
    appState.services = DEFAULT_SERVICES.map(s => ({ ...s })); appState.orders = [];
    currentBillingRows = [{ rowId: 'r1', serviceId: 'cut-emp-f', name: '剪髮 (員工-女)', price: 150, rate: 60, qty: 1 }];`);
  return { elements, run };
}

test('a failed cloud write keeps the cart and does not leave a phantom local order', async () => {
  const alerts = [];
  const { run } = billingSetup({
    appendOrderToCloud: async () => { throw new Error('Document too large'); },
    appAlert: async msg => { alerts.push(msg); }
  });
  assert.equal(await run('saveCurrentOrder()'), false);
  assert.equal(run('appState.orders.length'), 0);
  assert.equal(run('currentBillingRows.length'), 1);
  assert.match(alerts[0], /Document too large/);
});

test('undo right after billing removes the order from the cloud and restores the cart', async () => {
  const removed = [];
  const { elements, run } = billingSetup({
    appendOrderToCloud: async () => 'synced',
    removeOrderFromCloud: async o => { removed.push(o.id); }
  });
  elements.set('modal-order-success', { classList: { add() {}, remove() {}, toggle() {} } });
  run("posIdentity = 'family'; posGender = 'male';");
  assert.equal(await run('saveCurrentOrder()'), true);
  const orderId = run('appState.orders[0].id');
  assert.equal(run('currentBillingRows.length'), 0);
  assert.equal(run('posIdentity'), 'employee');

  await run('undoLastOrder()');
  assert.deepEqual(removed, [orderId]);
  assert.equal(run('appState.orders.length'), 0);
  assert.equal(run('currentBillingRows.length'), 1);
  assert.equal(run('posIdentity'), 'family');
  assert.equal(run('posGender'), 'male');
  assert.equal(elements.get('billing-notes').value, '急件');
});

test('today summary shows own orders for staff and the whole salon for admins', () => {
  const { elements, run } = setup(['constants', 'billing']);
  const el = {};
  elements.set('today-summary-text', el);
  run(`const today = getLocalDateString();
    appState.orders = [
      { staffId: 's1', date: today, totalAmount: 500 },
      { staffId: 's2', date: today, totalAmount: 300 },
      { staffId: 's1', date: today, totalAmount: 999, isDeleted: true },
      { staffId: 's1', date: '2000-01-01', totalAmount: 700 }
    ];
    currentUserRole = 'staff'; currentLinkedStaff = { id: 's1' }; renderTodaySummary();`);
  assert.equal(el.textContent, '我今日 1 單 · NT$ 500');
  run("currentUserRole = 'admin'; renderTodaySummary();");
  assert.equal(el.textContent, '全店今日 2 單 · NT$ 800');
});

test('inline price editing commits a valid number and ignores invalid input', () => {
  const { run } = billingSetup();
  run("startEditRowPrice('r1'); commitRowPriceEdit('r1', '120');");
  assert.equal(run('currentBillingRows[0].price'), 120);
  run("startEditRowPrice('r1'); commitRowPriceEdit('r1', 'abc');");
  assert.equal(run('currentBillingRows[0].price'), 120);
  assert.equal(run('editingPriceRowId'), null);
});
