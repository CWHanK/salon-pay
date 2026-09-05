/**
 * SalonPay - 系統靜態常數設定 (js/constants.js)
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

// 預設管理員註冊密鑰
const DEFAULT_ADMIN_SECRET_KEY = "SALON888";

// 台灣常見折數定義
const DISCOUNT_OPTIONS = [
  { val: 1.0, label: '原價 (無折扣)' },
  { val: 0.95, label: '95 折 (x0.95)' },
  { val: 0.90, label: '9 折 (x0.9)' },
  { val: 0.85, label: '85 折 (x0.85)' },
  { val: 0.80, label: '8 折 (x0.8)' },
  { val: 0.75, label: '75 折 (x0.75)' },
  { val: 0.70, label: '7 折 (x0.7)' },
  { val: 0.60, label: '6 折 (x0.6)' },
  { val: 0.50, label: '5 折 (半價)' }
];
