/**
 * SalonFlow - 雲端資料自動備份到本機 (scripts/backup-to-local.cjs)
 *
 * 第一次設定（只需一次，會請你輸入帳號密碼，密碼不會被儲存）：
 *   node scripts/backup-to-local.cjs --setup
 *
 * 之後每次執行（可交給 Windows 工作排程器每天自動執行）：
 *   node scripts/backup-to-local.cjs
 *
 * 選項：
 *   --keep 30     保留最近幾份每日備份（預設 30 份）；每個月的第一份備份另外永久保留
 *
 * 備份資料夾：預設為「文件\SalonFlow備份」，可用環境變數 SALONFLOW_BACKUP_DIR 指定。
 * 登入憑證（不是密碼）存在備份資料夾內的 .backup-credential.json，請勿分享此檔。
 */

const readline = require('node:readline');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const VIRTUAL_EMAIL_DOMAIN = '@salon.local';
const BACKUP_FILE_PATTERN = /^SalonFlow_\d{4}-\d{2}-\d{2}_\d{4}\.json$/;

function loadFirebaseConfig() {
  const fallback = { apiKey: 'AIzaSyC5k5ySWZkH7l0Bo0KLG1qb6Rfy-rimY74', projectId: 'salon-pay-9b2a0' };
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'firebase-config.js'), 'utf8');
    const ctx = { window: {} };
    vm.runInNewContext(src, ctx);
    const cfg = ctx.window.FIREBASE_CONFIG;
    if (cfg && cfg.apiKey && cfg.projectId) return cfg;
  } catch (_) {}
  return fallback;
}

const { apiKey: API_KEY, projectId: PROJECT_ID } = loadFirebaseConfig();
const BACKUP_DIR = process.env.SALONFLOW_BACKUP_DIR || path.join(os.homedir(), 'Documents', 'SalonFlow備份');
const CREDENTIAL_FILE = path.join(BACKUP_DIR, '.backup-credential.json');
const LOG_FILE = path.join(BACKUP_DIR, 'backup.log');

// ---------- 輸入 ----------
function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = str => {
      if (str.startsWith(question)) rl.output.write(question);
      else if (str.includes('\n') || str.includes('\r')) rl.output.write('\n');
      else rl.output.write('*');
    };
  }
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

function formatUsernameToEmail(input) {
  const trimmed = String(input || '').trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : `${trimmed}${VIRTUAL_EMAIL_DOMAIN}`;
}

// ---------- 登入 ----------
async function postJson(url, body, form = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data;
}

async function signInWithPassword(account, password) {
  const data = await postJson(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { email: formatUsernameToEmail(account), password, returnSecureToken: true });
  return { idToken: data.idToken, refreshToken: data.refreshToken };
}

async function refreshIdToken(refreshToken) {
  const data = await postJson(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
    { grant_type: 'refresh_token', refresh_token: refreshToken }, true);
  return { idToken: data.id_token, refreshToken: data.refresh_token };
}

function saveCredential(account, refreshToken) {
  fs.writeFileSync(CREDENTIAL_FILE, JSON.stringify({ account, refreshToken, savedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
}

// ---------- Firestore REST ----------
function firestoreValueToJs(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(firestoreValueToJs);
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = firestoreValueToJs(v);
    return obj;
  }
  return null;
}

function firestoreDocToJs(doc) {
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = firestoreValueToJs(v);
  return obj;
}

async function listCollection(idToken, collection) {
  const docs = {};
  let pageToken = '';
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}` +
      `?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `讀取 ${collection} 失敗 (HTTP ${res.status})`);
    for (const doc of data.documents || []) {
      docs[doc.name.split('/').pop()] = firestoreDocToJs(doc);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

// ---------- 備份內容 ----------
// 合併舊客單 (main_store.orders) 與每日文件 (orders_YYYY-MM-DD)，與 App 內的合併規則相同
function mergeOrders(storeDocs) {
  const byKey = new Map();
  const keyOf = o => o.id || `${o.orderNo || ''}|${o.createdAt || ''}`;
  (storeDocs.main_store?.orders || []).forEach(o => o && byKey.set(keyOf(o), o));
  Object.keys(storeDocs).filter(id => id.startsWith('orders_')).sort().forEach(id => {
    (storeDocs[id].orders || []).forEach(o => o && byKey.set(keyOf(o), o));
  });
  const sortKey = o => `${o.date || ''} ${o.time || ''} ${o.createdAt || ''}`;
  return [...byKey.values()].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}

function buildBackup(storeDocs, users) {
  const main = storeDocs.main_store || {};
  const orders = mergeOrders(storeDocs);
  return {
    exportedAt: new Date().toISOString(),
    source: 'scheduled-local-backup',
    projectId: PROJECT_ID,
    summary: {
      orderCount: orders.length,
      activeOrderCount: orders.filter(o => !o.isDeleted).length,
      dailyDocuments: Object.keys(storeDocs).filter(id => id.startsWith('orders_')).length,
      staffCount: (main.staff || []).length,
      serviceCount: (main.services || []).length
    },
    // 與 App「匯出 JSON 備份」相同的格式
    services: main.services || [],
    staff: main.staff || [],
    deletedServiceIds: main.deletedServiceIds || [],
    orders,
    // 其餘雲端文件（客單已完整收錄於上方 orders，不重複存放以節省空間）
    raw: {
      main_store: Object.fromEntries(Object.entries(main).filter(([k]) => k !== 'orders')),
      salon_users: users
    }
  };
}

function timestampForFile(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// 只挑出本程式產生的備份檔：保留最新 keep 份，以及每個月的第一份（長期留存），回傳要刪除的檔名
function selectBackupsToDelete(fileNames, keep) {
  const backups = fileNames.filter(n => BACKUP_FILE_PATTERN.test(n)).sort();
  const firstOfMonth = new Set();
  const seenMonths = new Set();
  backups.forEach(n => {
    const month = n.slice('SalonFlow_'.length, 'SalonFlow_'.length + 7);
    if (!seenMonths.has(month)) {
      seenMonths.add(month);
      firstOfMonth.add(n);
    }
  });
  return backups.slice().reverse().slice(keep).filter(n => !firstOfMonth.has(n));
}

function log(message) {
  const line = `[${new Date().toLocaleString('zh-TW', { hour12: false })}] ${message}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + os.EOL); } catch (_) {}
}

// ---------- 主程式 ----------
async function setup() {
  console.log(`備份資料夾：${BACKUP_DIR}`);
  console.log('請輸入要用來備份的 SalonFlow 帳號（建議另外註冊一個專門備份用的員工帳號）。密碼只用來登入一次，不會被儲存。');
  const account = await ask('帳號：');
  const password = await ask('密碼：', { hidden: true });
  const { refreshToken } = await signInWithPassword(account, password);
  saveCredential(account, refreshToken);
  log(`已完成備份設定，帳號：${account}`);
}

async function runBackup(keep) {
  if (!fs.existsSync(CREDENTIAL_FILE)) {
    throw new Error('尚未設定備份帳號，請先執行：node scripts/backup-to-local.cjs --setup');
  }
  const cred = JSON.parse(fs.readFileSync(CREDENTIAL_FILE, 'utf8'));
  const { idToken, refreshToken } = await refreshIdToken(cred.refreshToken);
  if (refreshToken && refreshToken !== cred.refreshToken) saveCredential(cred.account, refreshToken);

  const storeDocs = await listCollection(idToken, 'salon_stores');
  let users = null;
  try {
    users = await listCollection(idToken, 'salon_users');
  } catch (err) {
    log(`略過帳號名冊（此帳號無讀取權限）：${err.message}`);
  }

  const backup = buildBackup(storeDocs, users);
  const fileName = `SalonFlow_${timestampForFile()}.json`;
  const target = path.join(BACKUP_DIR, fileName);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(backup));
  fs.renameSync(tmp, target);

  const toDelete = selectBackupsToDelete(fs.readdirSync(BACKUP_DIR), keep);
  toDelete.forEach(n => fs.unlinkSync(path.join(BACKUP_DIR, n)));

  const sizeKb = Math.round(fs.statSync(target).size / 1024);
  log(`備份完成：${fileName}（${sizeKb} KB，客單 ${backup.summary.orderCount} 張，每日文件 ${backup.summary.dailyDocuments} 份）` +
    (toDelete.length ? `；已清除 ${toDelete.length} 份舊備份` : ''));
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const keepIdx = args.indexOf('--keep');
  const keep = keepIdx >= 0 ? Math.max(1, parseInt(args[keepIdx + 1], 10) || 30) : 30;
  try {
    if (args.includes('--setup')) {
      await setup();
    }
    await runBackup(keep);
  } catch (err) {
    log(`備份失敗：${err.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { mergeOrders, buildBackup, selectBackupsToDelete, timestampForFile, firestoreDocToJs };
