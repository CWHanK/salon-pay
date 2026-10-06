const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// 每日客單文件（一天一份）測試：salon_stores/orders_YYYY-MM-DD

function fakeStore({ denyDaily = false } = {}) {
  const docs = new Map();
  const writes = [];
  const queries = [];
  const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  const docRef = id => ({
    id,
    set: async payload => {
      writes.push({ id, op: 'set', payload });
      if (denyDaily && id.startsWith('orders_')) throw denied();
    },
    update: async payload => { writes.push({ id, op: 'update', payload }); }
  });
  const makeQuery = filters => ({
    where(_f, op, val) { return makeQuery([...filters, [op, val]]); },
    async get() {
      queries.push(filters);
      const hits = [...docs.entries()]
        .filter(([id]) => filters.every(([op, v]) => (op === '>=' ? id >= v : id <= v)))
        .map(([id, data]) => ({ id, data: () => data }));
      return { forEach: fn => hits.forEach(fn) };
    },
    onSnapshot() { return () => {}; }
  });
  const db = {
    collection: () => ({ doc: docRef, where: (_f, op, val) => makeQuery([[op, val]]) }),
    runTransaction: async fn => fn({
      get: async ref => ({ exists: docs.has(ref.id), data: () => JSON.parse(JSON.stringify(docs.get(ref.id) || {})) }),
      update: (ref, payload) => { writes.push({ id: ref.id, op: 'tx-update', payload }); docs.set(ref.id, { ...docs.get(ref.id), ...payload }); },
      set: (ref, payload) => {
        writes.push({ id: ref.id, op: 'tx-set', payload });
        if (denyDaily && ref.id.startsWith('orders_')) throw denied();
        // 模擬 arrayUnion 附加
        if (payload.orders && payload.orders.__op === 'arrayUnion') {
          const prev = docs.get(ref.id) || {};
          docs.set(ref.id, { ...prev, orders: [...(prev.orders || []), payload.orders.value] });
        } else {
          docs.set(ref.id, payload);
        }
      }
    })
  };
  const firebase = {
    firestore: {
      FieldValue: {
        arrayUnion: v => ({ __op: 'arrayUnion', value: v }),
        arrayRemove: v => ({ __op: 'arrayRemove', value: v })
      },
      FieldPath: { documentId: () => '__name__' }
    }
  };
  return { docs, writes, queries, db, firebase };
}

function setup(store) {
  const storage = new Map();
  const context = vm.createContext({
    console, window: {}, DEFAULT_ADMIN_KEY_HASH: '',
    document: { getElementById: () => null },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    setTimeout, clearTimeout,
    firebase: store.firebase, fakeDb: store.db
  });
  for (const file of ['state', 'constants', 'firebase']) {
    vm.runInContext(readFileSync(join(__dirname, '../js', `${file}.js`), 'utf8'), context);
  }
  const run = code => vm.runInContext(code, context);
  run("db = fakeDb; currentUser = { uid: 'u1' };");
  return run;
}

test('new orders are written to the document for their own day', async () => {
  const store = fakeStore();
  const run = setup(store);
  await run("appendOrderToCloud({ id: 'n1', date: '2026-10-06', totalAmount: 500 })");
  assert.equal(store.writes[0].id, 'orders_2026-10-06');
  assert.equal(store.writes[0].payload.orders.__op, 'arrayUnion');
});

test('if database rules forbid daily documents, billing falls back to the old location instead of failing', async () => {
  const store = fakeStore({ denyDaily: true });
  const run = setup(store);
  assert.equal(await run("appendOrderToCloud({ id: 'n1', date: '2026-10-06' })"), 'synced');
  assert.deepEqual(store.writes.map(w => w.id), ['orders_2026-10-06', 'main_store']);
  await run("appendOrderToCloud({ id: 'n2', date: '2026-10-06' })");
  assert.equal(store.writes[2].id, 'main_store');
  assert.equal(run("orderLocations.get('n1')"), 'main_store');
});

test('old orders stay in main_store and are merged with daily documents (daily version wins)', () => {
  const run = setup(fakeStore());
  run(`legacyOrders = [
      { id: 'old-1', date: '2026-09-10', time: '10:00' },
      { id: 'dup', date: '2026-10-01', time: '09:00', isDeleted: false }
    ];
    dailyOrderDocs.set('orders_2026-10-01', [{ id: 'dup', date: '2026-10-01', time: '09:00', isDeleted: true }]);
    dailyOrderDocs.set('orders_2026-10-06', [{ id: 'new-1', date: '2026-10-06', time: '12:00' }]);
    rebuildOrdersFromSources();`);
  assert.deepEqual(Array.from(run('appState.orders.map(o => o.id)')), ['new-1', 'dup', 'old-1']);
  assert.equal(run("appState.orders.find(o => o.id === 'dup').isDeleted"), true);
  assert.equal(run("orderLocations.get('old-1')"), 'main_store');
  assert.equal(run("orderLocations.get('new-1')"), 'orders_2026-10-06');
});

test('voiding updates only the document that holds the order', async () => {
  const store = fakeStore();
  store.docs.set('main_store', { orders: [{ id: 'old-1', date: '2026-09-10' }] });
  store.docs.set('orders_2026-10-06', { orders: [{ id: 'new-1', date: '2026-10-06' }, { id: 'new-2', date: '2026-10-06' }] });
  const run = setup(store);
  run(`legacyOrders = [{ id: 'old-1', date: '2026-09-10' }];
    dailyOrderDocs.set('orders_2026-10-06', [{ id: 'new-1', date: '2026-10-06' }, { id: 'new-2', date: '2026-10-06' }]);
    rebuildOrdersFromSources();`);

  await run("updateOrderInCloud('new-2', { isDeleted: true })");
  assert.equal(store.writes.at(-1).id, 'orders_2026-10-06');
  assert.deepEqual(store.docs.get('orders_2026-10-06').orders.map(o => !!o.isDeleted), [false, true]);

  await run("updateOrderInCloud('old-1', { isDeleted: true })");
  assert.equal(store.writes.at(-1).id, 'main_store');
  assert.equal(store.docs.get('main_store').orders[0].isDeleted, true);
});

test('undo removes the order from the same daily document it was written to', async () => {
  const store = fakeStore();
  const run = setup(store);
  await run("globalThis.__o = { id: 'n1', date: '2026-10-06' }; appendOrderToCloud(globalThis.__o)");
  await run('removeOrderFromCloud(globalThis.__o)');
  assert.equal(store.writes[1].id, 'orders_2026-10-06');
  assert.equal(store.writes[1].payload.orders.__op, 'arrayRemove');
});

test('older months are loaded on demand only when a past period is viewed', async () => {
  const store = fakeStore();
  store.docs.set('orders_2026-03-15', { orders: [{ id: 'march', date: '2026-03-15', time: '10:00' }] });
  store.docs.set('orders_2026-04-02', { orders: [{ id: 'april', date: '2026-04-02', time: '10:00' }] });
  const run = setup(store);
  run("dailyLiveWindowStart = '2026-09-01';");

  // 即時同步範圍內：不需額外讀取
  assert.equal(run("ensureOrderRangeLoaded('2026-10-01', '2026-10-31')"), 'loaded');
  assert.equal(store.queries.length, 0);

  // 查詢三月：只讀三月份，讀完自動回呼重新顯示
  assert.equal(run("ensureOrderRangeLoaded('2026-03-01', '2026-03-31', () => { globalThis.__done = true; })"), 'started');
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(store.queries[0], [['>=', 'orders_2026-03-01'], ['<=', 'orders_2026-03-31']]);
  assert.equal(run('globalThis.__done'), true);
  assert.deepEqual(Array.from(run('appState.orders.map(o => o.id)')), ['march']);

  // 已載入過的月份不再重複讀取
  assert.equal(run("ensureOrderRangeLoaded('2026-03-01', '2026-03-31')"), 'loaded');
  assert.equal(store.queries.length, 1);
});

test('online order numbers come from the latest cloud data, so another device\'s order is never reused', async () => {
  const store = fakeStore();
  // 另一台手機剛開了 005，本機還沒同步到
  store.docs.set('orders_2026-10-06', { orders: [{ id: 'other', date: '2026-10-06', orderNo: 'T-20261006-005' }] });
  const run = setup(store);
  run("appState.orders = [{ id: 'mine', date: '2026-10-06', orderNo: 'T-20261006-003' }];");
  run("globalThis.__a = { id: 'a', date: '2026-10-06', orderNo: 'T-20261006-004' }; globalThis.__b = { id: 'b', date: '2026-10-06', orderNo: 'T-20261006-004' };");
  await run('appendOrderToCloud(globalThis.__a)');
  await run('appendOrderToCloud(globalThis.__b)');
  assert.equal(run('globalThis.__a.orderNo'), 'T-20261006-006');
  assert.equal(run('globalThis.__b.orderNo'), 'T-20261006-007');
  const nos = store.docs.get('orders_2026-10-06').orders.map(o => o.orderNo);
  assert.equal(new Set(nos).size, nos.length);
});

test('offline order numbers carry this device\'s code so they cannot clash with other devices', async () => {
  const store = fakeStore();
  const run = setup(store);
  run(`cloudSyncState = 'offline';
    appState.orders = [{ id: 'x', date: '2026-10-06', orderNo: 'T-20261006-012' }];
    globalThis.__o1 = { id: 'o1', date: '2026-10-06' }; globalThis.__o2 = { id: 'o2', date: '2026-10-06' };`);
  assert.equal(await run('appendOrderToCloud(globalThis.__o1)'), 'queued');
  run('appState.orders.unshift(globalThis.__o1)');
  await run('appendOrderToCloud(globalThis.__o2)');
  const code = run('getDeviceCode()');
  assert.match(code, /^[A-Z2-9]{2}$/);
  assert.equal(run('globalThis.__o1.orderNo'), `T-20261006-013-${code}`);
  assert.equal(run('globalThis.__o2.orderNo'), `T-20261006-014-${code}`);
  // 之後線上開的單仍會從 015 接續
  assert.equal(run("getMaxOrderSeq(appState.orders.concat([globalThis.__o2]), '2026-10-06')"), 14);
});

test('backup reads every daily document plus the old orders', async () => {
  const store = fakeStore();
  store.docs.set('orders_2026-03-15', { orders: [{ id: 'march', date: '2026-03-15' }] });
  store.docs.set('orders_2026-10-06', { orders: [{ id: 'today', date: '2026-10-06' }] });
  const run = setup(store);
  run("legacyOrders = [{ id: 'legacy', date: '2026-09-01' }]; rebuildOrdersFromSources();");
  const all = await run('fetchAllOrdersForBackup()');
  assert.deepEqual(Array.from(all, o => o.id).sort(), ['legacy', 'march', 'today']);
});
