/**
 * SalonFlow - 系統靜態常數設定 (js/constants.js)
 */

// 系統當前版本 (部署新版本時與 version.json 保持一致)
const APP_VERSION = '20260909_4';

// 預設服務項目 (全新空白沙龍首創時使用，抽成率預設為 0，需由管理員於後台設定)
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

// 預設管理員密鑰 SHA-256 雜湊 (外部與原始碼中絕不儲存明文)
const DEFAULT_ADMIN_KEY_HASH = "f365f5a9b76e95c1bf942df99b79063005ccc85a9d96aadbf846aa0ab72cca09";

// 預設店家註冊密鑰 SHA-256 雜湊 (外部與原始碼中絕不儲存明文)
const DEFAULT_REGISTRATION_KEY_HASH = "8f48ecba137b707f170ce4fa4970c16ed27cd22a3deb33f558840f830692ef25";

// 虛擬信箱網域後綴（支援自訂帳號無感轉換為 Firebase Auth Email）
const VIRTUAL_EMAIL_DOMAIN = '@salon.local';

// 將使用者輸入之自訂帳號轉換為 Firebase Auth Email 格式 (如 hank -> hank@salon.local，若本身已含 @ 則保留)
function formatUsernameToEmail(input) {
  if (!input) return '';
  const trimmed = String(input).trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}${VIRTUAL_EMAIL_DOMAIN}`;
}

// 將 Firebase Auth 信箱轉換為乾淨的自訂帳號名稱 (如 hank@salon.local -> hank)
function formatEmailToUsername(email) {
  if (!email) return '';
  const str = String(email).trim();
  if (str.toLowerCase().endsWith(VIRTUAL_EMAIL_DOMAIN)) {
    return str.slice(0, -VIRTUAL_EMAIL_DOMAIN.length);
  }
  return str;
}

// 取得本地日期字串 (YYYY-MM-DD)，避免 UTC 跨日時區偏差
function getLocalDateString(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 取得本地時間字串 (HH:mm)，提供開單預設時間
function getLocalTimeString(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}


