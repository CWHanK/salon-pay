/**
 * SalonFlow - 系統靜態常數設定 (js/constants.js)
 */

// 系統當前版本 (部署新版本時與 version.json 保持一致)
const APP_VERSION = '20260912_3';

// 店內正式技術服務與產品清單 (預設服務項目)
const DEFAULT_SERVICES = [
  // 剪髮
  { id: 'cut-emp-f', name: '剪髮 (員工-女)', price: 150, rate: 0, category: '剪髮' },
  { id: 'cut-emp-m', name: '剪髮 (員工-男)', price: 200, rate: 0, category: '剪髮' },
  { id: 'cut-ext-pure', name: '純剪 (非員工)', price: 250, rate: 0, category: '剪髮' },
  { id: 'cut-ext-blow', name: '剪吹 (非員工)', price: 300, rate: 0, category: '剪髮' },
  // 洗頭
  { id: 'shampoo-act-long', name: '在職員工洗頭 (長髮)', price: 110, rate: 0, category: '洗頭' },
  { id: 'shampoo-act-short', name: '在職員工洗頭 (短髮)', price: 80, rate: 0, category: '洗頭' },
  { id: 'shampoo-ret-long', name: '退休/非員工洗頭 (長髮)', price: 140, rate: 0, category: '洗頭' },
  { id: 'shampoo-ret-short', name: '退休/非員工洗頭 (短髮)', price: 110, rate: 0, category: '洗頭' },
  // 去角質
  { id: 'scalp-standard', name: '頭皮深層去角質', price: 350, rate: 0, category: '去角質' },
  // 護髮
  { id: 'treat-steamer', name: '護髮 (蒸器)', price: 120, rate: 0, category: '護髮' },
  { id: 'treat-sonic', name: '護髮 (超音波)', price: 250, rate: 0, category: '護髮' },
  { id: 'treat-ext-comp', name: '護髮 (非員工/用公司)', price: 450, rate: 0, category: '護髮' },
  { id: 'treat-emp-steamer', name: '護髮 (員工產品蒸器)', price: 450, rate: 0, category: '護髮' },
  { id: 'treat-emp-sonic', name: '護髮 (員工產品超音波)', price: 600, rate: 0, category: '護髮' },
  // 染髮
  { id: 'color-company', name: '染髮 (用公司染劑)', price: 800, rate: 0, category: '染髮' },
  { id: 'color-bring', name: '染髮 (員工/退休/自帶代工)', price: 350, rate: 0, category: '染髮' },
  { id: 'color-barrier', name: '染髮 (頭皮隔離霜)', price: 350, rate: 0, category: '染髮' },
  { id: 'color-bring-next', name: '染髮 (自帶-明年啟動)', price: 450, rate: 0, category: '染髮' },
  // 燙髮
  { id: 'perm-cold-emp', name: '冷燙髮 (整頭-員工)', price: 2000, rate: 0, category: '燙髮' },
  { id: 'perm-cold-fam', name: '冷燙髮 (整頭-員工家屬/非員工)', price: 2300, rate: 0, category: '燙髮' },
  { id: 'perm-cold-part', name: '冷燙髮 (局部補燙 $50/卷)', price: 50, rate: 0, category: '燙髮' },
  { id: 'perm-dig-short', name: '溫朔燙 (短髮)', price: 2300, rate: 0, category: '燙髮' },
  { id: 'perm-dig-long', name: '溫朔燙 (長髮)', price: 2500, rate: 0, category: '燙髮' },
  { id: 'perm-dig-xlong', name: '溫朔燙 (過長)', price: 2800, rate: 0, category: '燙髮' },
  // 產品銷售 (含 16 款品項)
  { id: 'prod-1', name: '元氣潔淨露1號', price: 2200, empPrice: 1980, rate: 0, category: '產品銷售' },
  { id: 'prod-2', name: '元氣調理霜1號', price: 2800, empPrice: 2520, rate: 0, category: '產品銷售' },
  { id: 'prod-3', name: '頭皮溫感凝膠', price: 980, empPrice: 882, rate: 0, category: '產品銷售' },
  { id: 'prod-4', name: '賦活養髮調理霜(一般髮質)', price: 1300, empPrice: 1170, rate: 0, category: '產品銷售' },
  { id: 'prod-5', name: '賦活養髮不老泉', price: 1800, empPrice: 1620, rate: 0, category: '產品銷售' },
  { id: 'prod-6', name: '珂蔻5淨髮精', price: 3080, empPrice: 2772, rate: 0, category: '產品銷售' },
  { id: 'prod-7', name: 'JOICO水潤悅髮超潤澤精華', price: 1300, empPrice: 1300, rate: 0, category: '產品銷售' },
  { id: 'prod-8', name: 'JOICO專業悅型水光霧', price: 1120, empPrice: 1120, rate: 0, category: '產品銷售' },
  { id: 'prod-9', name: '薰衣草修護露', price: 900, empPrice: 900, rate: 0, category: '產品銷售' },
  { id: 'prod-10', name: 'JOICO禦髮系列鏈鍵強化鎖色瞬效髮霜', price: 2600, empPrice: 2600, rate: 0, category: '產品銷售' },
  { id: 'prod-11', name: 'JOICO禦髮系列鏈鍵強化鎖色髮膜', price: 1080, empPrice: 1080, rate: 0, category: '產品銷售' },
  { id: 'prod-12', name: 'JOICO專業悅型長效霧', price: 980, empPrice: 980, rate: 0, category: '產品銷售' },
  { id: 'prod-13', name: 'JOICO髮質悅髮瞬效髮霜', price: 2600, empPrice: 2600, rate: 0, category: '產品銷售' },
  { id: 'prod-14', name: 'JOICO水潤悅髮瞬效髮霜', price: 1600, empPrice: 1600, rate: 0, category: '產品銷售' },
  { id: 'prod-15', name: '髮質重建專家 淨化潔髮乳', price: 700, empPrice: 700, rate: 0, category: '產品銷售' },
  { id: 'prod-16', name: '煥采重建瞬效髮霜（耀紫）', price: 900, empPrice: 900, rate: 0, category: '產品銷售' }
];

// 店內 POS 機互動答題分類結構與選項
const POS_CATEGORIES = [
  { id: 'cut', name: '剪髮', emoji: '✂️', desc: '男女/純剪/剪吹' },
  { id: 'shampoo', name: '洗頭', emoji: '💆', desc: '長短/在職/退休' },
  { id: 'scalp', name: '去角質', emoji: '🌿', desc: '頭皮深層淨化' },
  { id: 'treatment', name: '護髮', emoji: '🧖', desc: '蒸器/超音波/自帶' },
  { id: 'color', name: '染髮', emoji: '🎨', desc: '公司料/自帶/隔離霜' },
  { id: 'perm', name: '燙髮', emoji: '🦱', desc: '冷燙整頭補燙/溫朔' },
  { id: 'products', name: '產品銷售', emoji: '🧴', desc: '16款洗護與去角質品項' }
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

// 格式化日期時間 (YYYY-MM-DD HH:mm)，供稽核與紀錄顯示
function formatDateTime(input) {
  if (!input) return '';
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch (_) {
    return String(input);
  }
}


