/**
 * SalonFlow - 系統靜態常數設定 (js/constants.js)
 */

// 預設服務項目與預設抽成比例
const DEFAULT_SERVICES = [
  { id: 'srv-1', name: '造型剪髮 (含基礎洗)', price: 800, rate: 50, category: '技術服務' },
  { id: 'srv-2', name: '舒壓洗髮 (含吹整)', price: 350, rate: 30, category: '技術服務' },
  { id: 'srv-3', name: '洗髮 + 精緻剪髮', price: 1000, rate: 50, category: '技術服務' },
  { id: 'srv-4', name: '溫塑熱燙 (全頭)', price: 3500, rate: 45, category: '技術服務' },
  { id: 'srv-5', name: '設計造型全染', price: 3200, rate: 45, category: '技術服務' },
  { id: 'srv-6', name: '髮根局部補染', price: 1800, rate: 45, category: '技術服務' },
  { id: 'srv-7', name: '特殊漂染/耳圈染', price: 4500, rate: 45, category: '技術服務' },
  { id: 'srv-8', name: '日本黑曜光結構護髮', price: 2000, rate: 40, category: '技術服務' },
  { id: 'srv-9', name: '草本深層頭皮淨化SPA', price: 1500, rate: 40, category: '技術服務' },
  { id: 'srv-10', name: '專業沙龍護髮精華油 (100ml)', price: 980, rate: 25, category: '產品銷售' },
  { id: 'srv-11', name: '控油豐盈洗髮精 (500ml)', price: 850, rate: 25, category: '產品銷售' },
  { id: 'srv-12', name: '強力定型霧 (300ml)', price: 650, rate: 20, category: '產品銷售' }
];

// 預設管理員密鑰 SHA-256 雜湊 (外部與原始碼中絕不儲存明文)
const DEFAULT_ADMIN_KEY_HASH = "7c24a989f5192ed1e20715833ebd68517d8fd40d78a2209b795d582c4604a171";

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


