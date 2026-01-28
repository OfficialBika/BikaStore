// ===============================
// UI TEMPLATES (BIKA STORE - FINAL)
// Matches: user.js FINAL + callbacks.js FINAL
// ===============================

const PRICES = require("./prices");

// ===============================
// PAYMENT ACCOUNTS
// ===============================
const PAYMENTS = {
  KPay: "💜 *KPay*\n09264202637\nName - Shine Htet Aung",
  WavePay: "💙 *WavePay*\n09264202637\nName - Shine Htet Aung"
};

// ===============================
// MARKDOWN SAFE (Markdown v1 safe enough)
// ===============================
function esc(text = "") {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ===============================
// TIME (Asia/Bangkok)
// ===============================
function formatBangkokTime(ts = Date.now()) {
  try {
    return new Date(ts).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" });
  } catch {
    return new Date(ts).toLocaleString();
  }
}

// ===============================
// TEMP ORDER ID (before DB)
// ===============================
function ensureOrderId(t) {
  if (t.orderId) return t.orderId;
  const rand = Math.floor(Math.random() * 9000) + 1000; // 4 digits
  t.orderId = `BK${String(Date.now()).slice(-6)}${rand}`;
  return t.orderId;
}

// ===============================
// PRICE HELPERS
// PRICES expected like:
// PRICES.MLBB = { name, currency, items:[ {label, price, ...} ] }
// We try to match by amount from item.amount OR digits in label.
// ===============================
function extractAmountFromLabel(label) {
  const m = String(label || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function findPriceItem(productKey, amount) {
  const product = PRICES[productKey];
  if (!product || !Array.isArray(product.items)) return null;

  // 1) exact item.amount match (if exists)
  const byField = product.items.find(i => i && Number(i.amount) === Number(amount));
  if (byField) return byField;

  // 2) match by digits in label (e.g. "86 Diamonds")
  const byLabel = product.items.find(i => extractAmountFromLabel(i?.label) === Number(amount));
  if (byLabel) return byLabel;

  return null;
}

function computeTotalMMK(productKey, amount) {
  const item = findPriceItem(productKey, amount);
  if (!item) return null;
  return Number(item.price);
}

// ===============================
// PRICE LIST (optional utility)
// ===============================
async function sendPriceList(bot, chatId, productKey) {
  const product = PRICES[productKey];
  if (!product) return;

  const list = (product.items || [])
    .map(i => `• ${esc(i.label)} — *${Number(i.price).toLocaleString()} ${esc(product.currency || "MMK")}*`)
    .join("\n");

  await bot.sendMessage(
    chatId,
    `📋 *${esc(product.name || productKey)} PRICE LIST*\n━━━━━━━━━━━━━━━\n${list || "_No prices found_"} `,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// PAYMENT METHOD SELECT
// callback_data MUST MATCH callbacks.js FINAL: "PAY:KPay", "PAY:WavePay"
// ===============================
async function sendPaymentMethods(bot, chatId) {
  return bot.sendMessage(chatId, "💳 *Payment Method ရွေးပါ*", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💜 KPay", callback_data: "PAY:KPay" }],
        [{ text: "💙 WavePay", callback_data: "PAY:WavePay" }],
        [{ text: "❌ Cancel", callback_data: "CANCEL" }]
      ]
    }
  });
}

// ===============================
// PAYMENT INFO
// ===============================
async function sendPaymentInfo(bot, chatId, method) {
  const info = PAYMENTS[method] || `*${esc(method)}*\n(ပေးချေမှုအချက်အလက် မတွေ့ပါ)`;

  return bot.sendMessage(
    chatId,
    `${info}\n\n📸 *ငွေလွှဲပြီးပါက ပြေစာ Screenshot ကို photo အနေနဲ့ ပို့ပေးပါ*`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// ORDER PREVIEW (Confirm/Cancel)
// Expects t fields from user.js FINAL:
// t.game ("MLBB"/"PUBG"),
