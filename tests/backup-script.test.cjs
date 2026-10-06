const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeOrders, buildBackup, selectBackupsToDelete, firestoreDocToJs } = require('../scripts/backup-to-local.cjs');

test('backup merges old main_store orders with every daily document, newest first', () => {
  const orders = mergeOrders({
    main_store: { orders: [{ id: 'a', date: '2026-09-01', time: '10:00' }, { id: 'dup', date: '2026-10-01', time: '09:00' }] },
    'orders_2026-10-01': { orders: [{ id: 'dup', date: '2026-10-01', time: '09:00', isDeleted: true }] },
    'orders_2026-10-06': { orders: [{ id: 'b', date: '2026-10-06', time: '12:00' }] }
  });
  assert.deepEqual(orders.map(o => o.id), ['b', 'dup', 'a']);
  assert.equal(orders[1].isDeleted, true);
});

test('backup file keeps the same top-level format as the in-app JSON export', () => {
  const backup = buildBackup({
    main_store: { services: [{ id: 's' }], staff: [{ id: 'st' }], orders: [{ id: 'a', date: '2026-09-01' }] },
    'orders_2026-10-06': { orders: [{ id: 'b', date: '2026-10-06', isDeleted: true }] }
  }, null);
  assert.equal(backup.services.length, 1);
  assert.equal(backup.staff.length, 1);
  assert.equal(backup.orders.length, 2);
  assert.deepEqual(backup.summary, { orderCount: 2, activeOrderCount: 1, dailyDocuments: 1, staffCount: 1, serviceCount: 1 });
  assert.equal('orders' in backup.raw.main_store, false, 'orders are stored once, not duplicated in raw');
  assert.equal(backup.raw.main_store.services.length, 1);
});

test('retention keeps the newest N plus the first backup of every month, and ignores other files', () => {
  const files = [
    'SalonFlow_2026-09-01_1840.json', 'SalonFlow_2026-09-02_1840.json', 'SalonFlow_2026-09-03_1840.json',
    'SalonFlow_2026-10-01_1840.json', 'SalonFlow_2026-10-02_1840.json', 'SalonFlow_2026-10-03_1840.json',
    'backup.log', '.backup-credential.json', 'SalonFlow_Backup_2026-10-01.json', 'notes.txt'
  ];
  assert.deepEqual(selectBackupsToDelete(files, 2).sort(), [
    'SalonFlow_2026-09-02_1840.json', 'SalonFlow_2026-09-03_1840.json'
  ]);
  assert.deepEqual(selectBackupsToDelete(files, 10), []);
});

test('Firestore REST documents convert to plain values', () => {
  const obj = firestoreDocToJs({ fields: {
    orders: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: 'x' }, totalAmount: { integerValue: '450' }, isDeleted: { booleanValue: true } } } }] } }
  } });
  assert.deepEqual(obj, { orders: [{ id: 'x', totalAmount: 450, isDeleted: true }] });
});
