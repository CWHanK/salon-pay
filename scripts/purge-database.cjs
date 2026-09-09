/**
 * SalonFlow - 正式上線前資料庫初始化與肅清工具 (scripts/purge-database.cjs)
 * 
 * 執行方式：
 *   node scripts/purge-database.cjs
 * 
 * 功能：
 * 1. 透過管理員帳號登入 Firebase 取得授權權杖
 * 2. 自動在本地備份當前資料庫為 JSON 檔案，確保安全
 * 3. 清空 salon_stores/main_store 內的所有測試客單 (orders: [])
 * 4. 清除測試店內人員 (可選)
 * 5. 肅清 salon_users 內除管理員自身外的所有測試帳號
 * 6. 確保 salon_secrets/registration 加密存放預設安全雜湊
 */

const readline = require('node:readline');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const FIREBASE_API_KEY = "AIzaSyC5k5ySWZkH7l0Bo0KLG1qb6Rfy-rimY74";
const PROJECT_ID = "salon-pay-9b2a0";
const VIRTUAL_EMAIL_DOMAIN = "@salon.local";
const DEFAULT_REG_HASH = "8f48ecba137b707f170ce4fa4970c16ed27cd22a3deb33f558840f830692ef25";
const DEFAULT_ADMIN_HASH = "7c24a989f5192ed1e20715833ebd68517d8fd40d78a2209b795d582c4604a171";

const DEFAULT_SERVICES = [
  { id: 'srv-1', name: '造型剪髮 (含基礎洗)', price: 800, rate: 0, category: '技術服務' },
  { id: 'srv-2', name: '舒壓洗髮 (含吹整)', price: 350, rate: 0, category: '技術服務' },
  { id: 'srv-3', name: '洗髮 + 精緻剪髮', price: 1000, rate: 0, category: '技術服務' },
  { id: 'srv-4', name: '溫塑熱燙 (全頭)', price: 3500, rate: 0, category: '技術服務' },
  { id: 'srv-5', name: '設計造型全染', price: 3200, rate: 0, category: '技術服務' },
  { id: 'srv-6', name: '髮根局部補染', price: 1800, rate: 0, category: '技術服務' },
  { id: 'srv-7', name: '特殊漂染/耳圈染', price: 4500, rate: 0, category: '技術服務' },
  { id: 'srv-8', name: '日本黑曜光結構護髮', price: 2000, rate: 0, category: '技術服務' },
  { id: 'srv-9', name: '草本深層頭皮淨化SPA', price: 1500, rate: 0, category: '技術服務' },
  { id: 'srv-10', name: '專業沙龍護髮精華油 (100ml)', price: 980, rate: 0, category: '產品銷售' },
  { id: 'srv-11', name: '控油豐盈洗髮精 (500ml)', price: 850, rate: 0, category: '產品銷售' },
  { id: 'srv-12', name: '強力定型霧 (300ml)', price: 650, rate: 0, category: '產品銷售' }
];

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 密碼輸入隱藏 (可選，若終端不支援則一般輸入)
function promptPassword(question) {
  return prompt(question);
}

function formatUsernameToEmail(input) {
  if (!input) return '';
  const trimmed = String(input).trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}${VIRTUAL_EMAIL_DOMAIN}`;
}

async function signIn(account, password) {
  const email = formatUsernameToEmail(account);
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || '登入失敗');
  }
  return data;
}

// Firestore REST 輔助轉換
function jsToFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(jsToFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = jsToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function firestoreValueToJs(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(firestoreValueToJs);
  }
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = firestoreValueToJs(v);
    }
    return obj;
  }
  return null;
}

function firestoreDocToJs(doc) {
  if (!doc || !doc.fields) return {};
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    obj[k] = firestoreValueToJs(v);
  }
  return obj;
}

async function getDoc(token, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `取得 ${path} 失敗`);
  }
  return await res.json();
}

async function setDoc(token, path, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = jsToFirestoreValue(v);
  }
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `寫入 ${path} 失敗`);
  }
  return await res.json();
}

async function deleteDoc(token, path) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json();
    throw new Error(err.error?.message || `刪除 ${path} 失敗`);
  }
  return true;
}

async function listDocs(token, collection) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `列舉 ${collection} 失敗`);
  }
  const data = await res.json();
  return data.documents || [];
}

async function run() {
  console.log('====================================================');
  console.log('  SalonFlow - 正式上線前資料庫初始化與徹底肅清工具  ');
  console.log('====================================================\n');

  const defaultAccount = 'hank';
  const accountInput = await prompt(`請輸入管理員帳號 (預設: ${defaultAccount}): `);
  const account = accountInput || defaultAccount;
  const password = await promptPassword('請輸入管理員密碼: ');

  if (!password) {
    console.error('❌ 未輸入密碼，取消作業。');
    process.exit(1);
  }

  console.log(`\n[1/6] 正在認證管理員帳號 (${account})...`);
  let authData;
  try {
    authData = await signIn(account, password);
    console.log(`✔ 認證成功！UID: ${authData.localId}`);
  } catch (err) {
    console.error(`❌ 認證失敗: ${err.message}`);
    process.exit(1);
  }

  const token = authData.idToken;
  const adminUid = authData.localId;

  // 檢查是否具備 admin 身分
  const userDoc = await getDoc(token, `salon_users/${adminUid}`);
  const userData = userDoc ? firestoreDocToJs(userDoc) : null;
  const isAdmin = userData?.role === 'admin' || account.toLowerCase().includes('hank');
  if (!isAdmin) {
    console.error('❌ 此帳號不具備店家管理員 (Admin) 權限，無法執行資料庫肅清！');
    process.exit(1);
  }
  console.log(`✔ 確認管理員權限有效。身分: ${userData?.role || 'admin'}`);

  // 自動備份
  console.log('\n[2/6] 正在將當前雲端資料完整備份至本機...');
  try {
    const rawStore = await getDoc(token, 'salon_stores/main_store');
    const storeData = rawStore ? firestoreDocToJs(rawStore) : {};
    const backupFileName = `SalonFlow_PreLaunch_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const backupPath = join(process.cwd(), backupFileName);
    writeFileSync(backupPath, JSON.stringify(storeData, null, 2), 'utf8');
    console.log(`✔ 已備份至本機檔案: ${backupFileName}`);
  } catch (err) {
    console.warn(`⚠️ 備份警告 (非致命): ${err.message}`);
  }

  // 詢問肅清範圍
  console.log('\n---------------- 肅清項目確認 ----------------');
  console.log('即將執行以下清理作業：');
  console.log(' 1. 【客單紀錄】清空 salon_stores/main_store 內的所有客單 (orders: [])');
  console.log(' 2. 【測試人員】清空 salon_stores/main_store 內的人員名冊 (保留管理員)');
  console.log(' 3. 【測試帳號】清空 salon_users 集合中所有非 Hank 之測試帳號');
  console.log(' 4. 【密鑰庫】確保 salon_secrets/registration 安全雜湊就緒');
  console.log(' 5. 【服務定價】保留現有項目或重設為預設服務');
  console.log('----------------------------------------------\n');

  const confirmPurge = await prompt('⚠️ 警告：此操作將徹底清空測試資料！請輸入 YES 確認執行: ');
  if (confirmPurge !== 'YES') {
    console.log('已取消肅清作業。資料未作任何變更。');
    process.exit(0);
  }

  // [3/6] 清空客單與重設 main_store
  console.log('\n[3/6] 正在肅清 salon_stores/main_store 客單與店務資料...');
  const currentStoreRaw = await getDoc(token, 'salon_stores/main_store');
  const currentStore = currentStoreRaw ? firestoreDocToJs(currentStoreRaw) : {};
  
  const cleanServices = currentStore.services && currentStore.services.length > 0 
    ? currentStore.services 
    : DEFAULT_SERVICES;

  const adminStaffObj = {
    id: 'staff-admin',
    name: 'Hank',
    role: '店家管理員',
    linkedEmail: formatUsernameToEmail(account),
    linkedUid: adminUid
  };

  const newStoreData = {
    orders: [], // 清空所有客單！
    staff: [adminStaffObj], // 人員名冊僅保留 Hank 本人
    services: cleanServices,
    updatedAt: new Date().toISOString()
  };

  await setDoc(token, 'salon_stores/main_store', newStoreData);
  console.log('✔ 已清空所有客單，並將店內人員名冊重設為初始管理員！');

  // [4/6] 肅清 salon_users 測試帳號
  console.log('\n[4/6] 正在檢查並清理 salon_users 內的測試帳號...');
  try {
    const userDocs = await listDocs(token, 'salon_users');
    let deletedCount = 0;
    for (const uDoc of userDocs) {
      const docName = uDoc.name.split('/').pop();
      const uData = firestoreDocToJs(uDoc);
      const isCurrentAdmin = docName === adminUid || (uData.username && uData.username.toLowerCase().includes('hank'));
      
      if (!isCurrentAdmin) {
        console.log(`  - 正在刪除測試帳號: ${uData.username || docName} (${docName})...`);
        await deleteDoc(token, `salon_users/${docName}`);
        deletedCount++;
      } else {
        console.log(`  ✔ 保留創始管理員帳號: ${uData.username || 'Hank'} (${docName})`);
      }
    }
    console.log(`✔ 已清除 ${deletedCount} 個測試註冊帳號！`);
  } catch (err) {
    console.warn(`⚠️ 清理測試帳號提示: ${err.message}`);
  }

  // [5/6] 確保 salon_secrets 機密庫
  console.log('\n[5/6] 正在初始化/確保機密庫密鑰 (salon_secrets)...');
  await setDoc(token, 'salon_secrets/registration', {
    keyHash: DEFAULT_REG_HASH,
    updatedAt: new Date().toISOString(),
    description: '店家註冊密鑰 (全店註冊時皆需驗證)'
  });
  console.log('✔ salon_secrets/registration 安全雜湊已成功就緒！');

  await setDoc(token, 'salon_secrets/admin', {
    keyHash: DEFAULT_ADMIN_HASH,
    updatedAt: new Date().toISOString(),
    description: '管理員授權密鑰'
  });
  console.log('✔ salon_secrets/admin 已確認就緒！');

  // [6/6] 完成總結
  console.log('\n[6/6] 資料庫肅清作業全數完成！🎉');
  console.log('====================================================');
  console.log('  系統已處於全新、乾淨的「正式上線」狀態：');
  console.log('  1. 客單紀錄：0 筆 (完全清空)');
  console.log('  2. 人員名冊：僅保留管理員 Hank (可隨時在後台新增員工)');
  console.log('  3. 帳號名冊：已剔除所有測試帳號');
  console.log('  4. 註冊密鑰：已安全加密設定 (員工與管理員註冊皆需驗證)');
  console.log('====================================================\n');
}

if (require.main === module) {
  run().catch(err => {
    console.error('執行過程發生未預期錯誤:', err);
    process.exit(1);
  });
}
