const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

test('DEFAULT_REGISTRATION_KEY_HASH is a valid 64-char hex hash in constants', () => {
  const constantsJs = readFileSync(join(__dirname, '../js/constants.js'), 'utf8');
  assert.match(constantsJs, /DEFAULT_REGISTRATION_KEY_HASH\s*=\s*['"]8f48ecba137b707f170ce4fa4970c16ed27cd22a3deb33f558840f830692ef25['"]/);
});

test('DEFAULT_ADMIN_KEY_HASH is a valid 64-char hex hash in constants', () => {
  const constantsJs = readFileSync(join(__dirname, '../js/constants.js'), 'utf8');
  assert.match(constantsJs, /DEFAULT_ADMIN_KEY_HASH\s*=\s*['"]f365f5a9b76e95c1bf942df99b79063005ccc85a9d96aadbf846aa0ab72cca09['"]/);
});

test('firestore.rules contains isValidRegistrationSecret with expected hash', () => {
  const rules = readFileSync(join(__dirname, '../firestore.rules'), 'utf8');
  assert.match(rules, /function isValidRegistrationSecret\(inputHash\)/);
  assert.match(rules, /8f48ecba137b707f170ce4fa4970c16ed27cd22a3deb33f558840f830692ef25/);
  assert.match(rules, /isValidRegistrationSecret\(request\.resource\.data\.regKeyHash\)/);
});

test('firestore.rules contains isValidAdminSecret with expected hash', () => {
  const rules = readFileSync(join(__dirname, '../firestore.rules'), 'utf8');
  assert.match(rules, /function isValidAdminSecret\(inputHash\)/);
  assert.match(rules, /f365f5a9b76e95c1bf942df99b79063005ccc85a9d96aadbf846aa0ab72cca09/);
});

test('auth UI controls: registration key is required for both staff and admin in signup mode', () => {
  const elements = new Map();
  function makeElement(tag = 'div') {
    return {
      tagName: tag.toUpperCase(),
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      textContent: '',
      className: '',
      required: false,
      value: ''
    };
  }

  const ids = [
    'auth-submit-text', 'auth-role-container', 'auth-reg-key-container', 'auth-reg-key',
    'auth-secret-key-container', 'auth-admin-key', 'auth-email-label',
    'auth-tab-login', 'auth-tab-signup'
  ];
  for (const id of ids) {
    elements.set(id, makeElement());
  }

  const lucideMock = { createIcons: () => {} };
  const context = vm.createContext({
    console,
    lucide: lucideMock,
    window: { lucide: lucideMock },
    document: {
      getElementById: id => elements.get(id) || null,
      querySelector: sel => {
        if (sel === 'input[name="auth-reg-role"]:checked') {
          return { value: context.mockSelectedRole || 'staff' };
        }
        return null;
      }
    },
    crypto: {
      subtle: crypto.webcrypto.subtle
    },
    TextEncoder
  });

  vm.runInContext(readFileSync(join(__dirname, '../js/constants.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/state.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(__dirname, '../js/auth.js'), 'utf8'), context);

  // 1. 切換至註冊模式 (預設身分：員工)
  context.mockSelectedRole = 'staff';
  vm.runInContext('setAuthMode(true)', context);

  const regContainer = elements.get('auth-reg-key-container');
  const regInput = elements.get('auth-reg-key');
  const adminContainer = elements.get('auth-secret-key-container');
  const adminInput = elements.get('auth-admin-key');

  assert.equal(regContainer.classList.contains('hidden'), false, 'Registration key container is visible for staff');
  assert.equal(regInput.required, true, 'Registration key is required for staff');
  assert.equal(adminContainer.classList.contains('hidden'), true, 'Admin key container is hidden for staff');
  assert.equal(adminInput.required, false, 'Admin key is not required for staff');

  // 2. 切換身分為管理員
  context.mockSelectedRole = 'admin';
  vm.runInContext("onAuthRoleChange('admin')", context);

  assert.equal(regContainer.classList.contains('hidden'), false, 'Registration key container is still visible for admin');
  assert.equal(regInput.required, true, 'Registration key is still required for admin');
  assert.equal(adminContainer.classList.contains('hidden'), false, 'Admin key container is now visible for admin');
  assert.equal(adminInput.required, true, 'Admin key is required for admin');

  // 3. 切換回登入模式
  vm.runInContext('setAuthMode(false)', context);
  assert.equal(regContainer.classList.contains('hidden'), true, 'Registration key container is hidden in login mode');
  assert.equal(regInput.required, false, 'Registration key is not required in login mode');
  assert.equal(regInput.value, '', 'Registration key is cleared in login mode');
  assert.equal(adminContainer.classList.contains('hidden'), true, 'Admin key container is hidden in login mode');
  assert.equal(adminInput.required, false, 'Admin key is not required in login mode');
  assert.equal(adminInput.value, '', 'Admin key is cleared in login mode');
});

test('hashSecretKey computes correct SHA-256 hex string', async () => {
  const context = vm.createContext({
    console,
    crypto: { subtle: crypto.webcrypto.subtle },
    TextEncoder
  });

  vm.runInContext(readFileSync(join(__dirname, '../js/state.js'), 'utf8'), context);
  const sample = 'sample-verification-key';
  const hash = await vm.runInContext(`hashSecretKey('${sample}')`, context);
  const expected = crypto.createHash('sha256').update(sample).digest('hex');
  assert.equal(hash, expected);
});
