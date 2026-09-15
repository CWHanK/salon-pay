const APP_VERSION = '20260916_2';

const DEFAULT_SERVICES = [
  { id: 'cut-emp-f', name: '剪髮 (員工-女)', price: 150, rate: 60, category: '剪髮', gender: ['female'], identity: ['employee', 'retiree'], allowDiscount: false },
  { id: 'cut-emp-m', name: '剪髮 (員工-男)', price: 200, rate: 60, category: '剪髮', gender: ['male'], identity: ['employee', 'retiree'], allowDiscount: false },
  { id: 'cut-ext-pure', name: '純剪 (非員工)', price: 250, rate: 60, category: '剪髮', gender: ['male', 'female'], identity: ['family', 'external'], allowDiscount: false },
  { id: 'cut-ext-blow', name: '剪吹 (非員工)', price: 300, rate: 60, category: '剪髮', gender: ['male', 'female'], identity: ['family', 'external'], allowDiscount: false },
  { id: 'shampoo-emp', name: '在職員工洗頭', price: 110, rate: 60, category: '洗頭', gender: ['male', 'female'], identity: ['employee'], allowDiscount: false },
  { id: 'shampoo-ext', name: '退休/非員工洗頭', price: 140, rate: 60, category: '洗頭', gender: ['male', 'female'], identity: ['retiree', 'family', 'external'], allowDiscount: false },
  { id: 'scalp-standard', name: '頭皮深層去角質', price: 350, rate: 54, category: '去角質', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'treat-steamer', name: '護髮 (蒸器)', price: 120, rate: 60, category: '護髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'treat-sonic', name: '護髮 (超音波)', price: 250, rate: 60, category: '護髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'treat-ext-comp', name: '護髮 (非員工/用公司)', price: 450, rate: 54, category: '護髮', gender: ['male', 'female'], identity: ['family', 'external'], allowDiscount: false },
  { id: 'treat-emp-steamer', name: '護髮 (員工產品蒸器)', price: 450, rate: 54, category: '護髮', gender: ['male', 'female'], identity: ['employee', 'retiree'], allowDiscount: false },
  { id: 'treat-emp-sonic', name: '護髮 (員工產品超音波)', price: 600, rate: 54, category: '護髮', gender: ['male', 'female'], identity: ['employee', 'retiree'], allowDiscount: false },
  { id: 'color-company', name: '染髮 (用公司染劑)', price: 800, rate: 54, category: '染髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'color-bring', name: '染髮 (員工/退休/自帶代工)', price: 350, rate: 60, category: '染髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'color-designer', name: '染髮 (設計師自備染膏)', price: 800, rate: 60, category: '染髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'color-barrier', name: '染髮 (頭皮隔離霜)', price: 350, rate: 54, category: '染髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-cold-emp', name: '冷燙髮 (整頭-員工)', price: 2000, rate: 54, category: '燙髮', gender: ['male', 'female'], identity: ['employee'], allowDiscount: false },
  { id: 'perm-cold-fam', name: '冷燙髮 (整頭-員工家屬/非員工)', price: 2300, rate: 54, category: '燙髮', gender: ['male', 'female'], identity: ['retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-cold-part', name: '冷燙髮 (局部補燙 $50/卷)', price: 50, rate: 54, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-cold-emp-self', name: '冷燙髮 (整頭-設計師自備)', price: 2000, rate: 60, category: '燙髮', gender: ['male', 'female'], identity: ['employee'], allowDiscount: false },
  { id: 'perm-cold-fam-self', name: '冷燙髮 (非員工-設計師自備)', price: 2300, rate: 60, category: '燙髮', gender: ['male', 'female'], identity: ['retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-cold-part-self', name: '冷燙髮 (補燙-設計師自備 $50/卷)', price: 50, rate: 60, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-dig-short', name: '溫朔燙 (短髮)', price: 2300, rate: 54, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-dig-long', name: '溫朔燙 (長髮)', price: 2500, rate: 54, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-dig-xlong', name: '溫朔燙 (過長)', price: 2800, rate: 54, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-dig-short-self', name: '溫朔燙 (短髮-設計師自備)', price: 2300, rate: 60, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-dig-long-self', name: '溫朔燙 (長髮-設計師自備)', price: 2500, rate: 60, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'perm-dig-xlong-self', name: '溫朔燙 (過長-設計師自備)', price: 2800, rate: 60, category: '燙髮', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: false },
  { id: 'prod-1', name: '元氣潔淨露1號', price: 2200, empPrice: 1980, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-2', name: '元氣調理霜1號', price: 2800, empPrice: 2520, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-3', name: '頭皮溫感凝膠', price: 980, empPrice: 882, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-4', name: '賦活養髮調理霜(一般髮質)', price: 1300, empPrice: 1170, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-5', name: '賦活養髮不老泉', price: 1800, empPrice: 1620, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-6', name: '珂蔻5淨髮精', price: 3080, empPrice: 2772, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-7', name: 'JOICO水潤悅髮超潤澤精華', price: 1300, empPrice: 1170, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-8', name: 'JOICO專業悅型水光霧', price: 1120, empPrice: 1008, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-9', name: '薰衣草修護露', price: 900, empPrice: 810, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-10', name: 'JOICO禦髮系列鏈鍵強化鎖色瞬效髮霜', price: 2600, empPrice: 2340, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-11', name: 'JOICO禦髮系列鏈鍵強化鎖色髮膜', price: 1080, empPrice: 972, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-12', name: 'JOICO專業悅型長效霧', price: 980, empPrice: 882, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-13', name: 'JOICO髮質悅髮瞬效髮霜', price: 2600, empPrice: 2340, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-14', name: 'JOICO水潤悅髮瞬效髮霜', price: 1600, empPrice: 1440, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-15', name: '髮質重建專家 淨化潔髮乳', price: 700, empPrice: 630, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true },
  { id: 'prod-16', name: '煥采重建瞬效髮霜（耀紫）', price: 900, empPrice: 810, rate: 30, category: '產品銷售', gender: ['male', 'female'], identity: ['employee', 'retiree', 'family', 'external'], allowDiscount: true }
];

const POS_CATEGORIES = [
  { id: 'cut', name: '剪髮', emoji: '✂️' },
  { id: 'shampoo', name: '洗頭', emoji: '💆' },
  { id: 'scalp', name: '去角質', emoji: '🌿' },
  { id: 'treatment', name: '護髮', emoji: '🧖' },
  { id: 'color', name: '染髮', emoji: '🎨' },
  { id: 'perm', name: '燙髮', emoji: '🦱' },
  { id: 'products', name: '產品銷售', emoji: '🧴' }
];

const DEFAULT_ADMIN_KEY_HASH = "f365f5a9b76e95c1bf942df99b79063005ccc85a9d96aadbf846aa0ab72cca09";
const DEFAULT_REGISTRATION_KEY_HASH = "8f48ecba137b707f170ce4fa4970c16ed27cd22a3deb33f558840f830692ef25";
const VIRTUAL_EMAIL_DOMAIN = '@salon.local';

function formatUsernameToEmail(input) {
  if (!input) return '';
  const trimmed = String(input).trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}${VIRTUAL_EMAIL_DOMAIN}`;
}

function formatEmailToUsername(email) {
  if (!email) return '';
  const str = String(email).trim();
  if (str.toLowerCase().endsWith(VIRTUAL_EMAIL_DOMAIN)) {
    return str.slice(0, -VIRTUAL_EMAIL_DOMAIN.length);
  }
  return str;
}

function getLocalDateString(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getLocalTimeString(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

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

function normalizeServiceName(name) {
  return String(name || '').replace(/[\s\(\)\-_（）]/g, '').toLowerCase();
}



