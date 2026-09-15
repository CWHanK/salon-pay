const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

test('version.json matches constants.js APP_VERSION', () => {
  const versionJsonRaw = readFileSync(join(__dirname, '../version.json'), 'utf8');
  const versionData = JSON.parse(versionJsonRaw);
  assert.ok(versionData.version, 'version property exists');

  const constantsJs = readFileSync(join(__dirname, '../js/constants.js'), 'utf8');
  assert.match(constantsJs, new RegExp(`APP_VERSION\\s*=\\s*['"]${versionData.version}['"]`));
});

test('draft storage preserves current billing input and restores it', () => {
  const elements = new Map();
  const storage = new Map();
  const context = vm.createContext({
    console,
    window: {},
    DEFAULT_ADMIN_KEY_HASH: '',
    document: {
      getElementById: id => elements.get(id) || null
    },
    localStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k)
    }
  });

  vm.runInContext(readFileSync(join(__dirname, '../js/state.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/constants.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/billing.js'), 'utf8'), context);

  elements.set('billing-notes', { value: '急件染髮' });
  elements.set('billing-date', { value: '2026-09-08' });

  vm.runInContext(`
    currentBillingRows = [{ serviceId: 'srv-1', price: 800, qty: 2, rate: 50 }];
    saveBillingDraftToStorage();
  `, context);

  assert.ok(storage.has('SALON_BILLING_DRAFT'), 'Draft was saved to localStorage');

  // 清空記憶體中狀態以模擬重開
  vm.runInContext('currentBillingRows = [];', context);
  elements.get('billing-notes').value = '';
  elements.get('billing-date').value = '';

  const restored = vm.runInContext('restoreBillingDraftFromStorage()', context);
  assert.equal(restored, true, 'Draft should be successfully restored');
  assert.equal(vm.runInContext('currentBillingRows.length', context), 1);
  assert.equal(vm.runInContext('currentBillingRows[0].price', context), 800);
  assert.equal(elements.get('billing-notes').value, '急件染髮');
  assert.equal(elements.get('billing-date').value, '2026-09-08');
  assert.equal(storage.has('SALON_BILLING_DRAFT'), false, 'Draft is cleared once restored');
});

test('checkForAppUpdates detects newer version and triggers force reload', async () => {
  let replacedUrl = null;
  const elements = new Map();
  const storage = new Map();

  const context = vm.createContext({
    console,
    DEFAULT_ADMIN_KEY_HASH: '',
    window: {
      location: {
        origin: 'https://salonflow.local',
        pathname: '/app',
        replace: url => { replacedUrl = url; }
      }
    },
    document: {
      getElementById: id => elements.get(id) || null,
      body: { appendChild: () => {} },
      createElement: () => ({ setAttribute: () => {}, innerHTML: '' })
    },
    localStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k)
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({ version: '20260999_9' })
    }),
    setTimeout: (fn, ms) => fn(),
    setInterval: () => {},
    clearInterval: () => {}
  });

  vm.runInContext(readFileSync(join(__dirname, '../js/state.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/constants.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/billing.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/version.js'), 'utf8'), context);

  await vm.runInContext('checkForAppUpdates()', context);
  assert.ok(replacedUrl, 'window.location.replace should have been called');
  assert.match(replacedUrl, /v=20260999_9/);
});

test('index.html script tags match constants.js APP_VERSION', () => {
  const indexHtml = readFileSync(join(__dirname, '../index.html'), 'utf8');
  const versionJsonRaw = readFileSync(join(__dirname, '../version.json'), 'utf8');
  const versionData = JSON.parse(versionJsonRaw);

  const scriptMatches = [...indexHtml.matchAll(/src="js\/([^"]+?)\.js\?v=([^"]+)"/g)];
  assert.ok(scriptMatches.length >= 8, 'should have script tags with version query param');
  for (const m of scriptMatches) {
    assert.equal(m[2], versionData.version, 'script ' + m[1] + ' has matching version');
  }
});

test('isNewerVersion handles versions and strictly ignores downgrade/same versions', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(join(__dirname, '../js/constants.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/version.js'), 'utf8'), context);

  // 1. 新版本判定
  assert.equal(vm.runInContext("isNewerVersion('20260914_3', '20260913_2')", context), true);
  assert.equal(vm.runInContext("isNewerVersion('20260916_1', '20260914_3')", context), true);
  assert.equal(vm.runInContext("isNewerVersion('20260916_2', '20260916_1')", context), true);

  // 2. 舊版本（降版）或相同版本，絕不視為新版本（防止降版時觸發更新死迴圈）
  assert.equal(vm.runInContext("isNewerVersion('20260913_2', '20260914_3')", context), false);
  assert.equal(vm.runInContext("isNewerVersion('20260914_3', '20260914_3')", context), false);
  assert.equal(vm.runInContext("isNewerVersion('20260914_1', '20260914_3')", context), false);
});

test('anti-loop guard prevents infinite reload loops within 30 seconds', () => {
  const storage = new Map();
  const context = vm.createContext({
    window: {},
    sessionStorage: {
      getItem: k => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k)
    }
  });
  vm.runInContext(readFileSync(join(__dirname, '../js/constants.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/version.js'), 'utf8'), context);

  // 初次檢查允許觸發
  assert.equal(vm.runInContext("canTriggerUpdate('20260999_1')", context), true);

  // 記錄一次更新嘗試
  vm.runInContext("recordUpdateAttempt('20260999_1')", context);

  // 30 秒內針對同版本再次要求重整時，guard 必須攔截並回傳 false 中止重整迴圈
  assert.equal(vm.runInContext("canTriggerUpdate('20260999_1')", context), false);
});

