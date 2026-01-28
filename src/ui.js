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

  return bot.sendMessage(
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
// t.game ("MLBB"/"PUBG"), t.game_id, t.server_id, t.amount
// We also set t.totalPrice, t.orderTime here.
// ===============================
async function sendOrderPreview(bot, chatId, t) {
  // Normalize keys (support older naming too)
  const game = t.game || t.product;
  const gameId = t.game_id || t.gameId || "";
  const serverId = t.server_id || t.serverId || "";
  const amount = t.amount ?? t.qty ?? "";

  // ensure order id & time
  const orderId = ensureOrderId(t);
  t.orderTime = t.orderTime || formatBangkokTime(t.createdAt || Date.now());

  // compute total
  const total = computeTotalMMK(game, amount);
  if (total == null) {
    // If price not found, still show preview but mark unknown total
    t.totalPrice = null;
  } else {
    t.totalPrice = total;
  }

  // Build preview text
  const lines = [
    `📦 *ORDER PREVIEW*`,
    `━━━━━━━━━━━━━━━`,
    `🆔 *Order ID:* ${esc(orderId)}`,
    `🎮 *Game:* ${esc(game)}`,
    `🆔 *ID:* ${esc(gameId)}${serverId ? ` (${esc(serverId)})` : ""}`,
    `${game === "MLBB" ? "💎" : "🎯"} *Amount:* ${esc(String(amount))}`,
    `💰 *Total:* ${t.totalPrice == null ? "_Price not found_" : `${Number(t.totalPrice).toLocaleString()} MMK`}`,
    `🕒 *Order time:* ${esc(t.orderTime)}`
  ].join("\n");

  return bot.sendMessage(chatId, lines, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirm", callback_data: "CONFIRM" },
          { text: "❌ Cancel", callback_data: "CANCEL" }
        ]
      ]
    }
  });
}

// ===============================
// USER WAITING
// ===============================
async function sendWaiting(bot, chatId, orderId) {
  return bot.sendMessage(
    chatId,
    `⏳ *Admin စစ်ဆေးနေပါသည်...*\n\n🆔 Order ID: ${esc(orderId)}`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// USER APPROVED
// ===============================
async function notifyUserApproved(bot, order) {
  if (order.waitMsgId) {
    try {
      await bot.deleteMessage(order.userId, order.waitMsgId);
    } catch {}
  }

  return bot.sendMessage(
    order.userId,
    `✅ *ORDER COMPLETED*
━━━━━━━━━━━━━━━
🎮 ${esc(order.product || order.game)}
🆔 ${esc(order.gameId)}${order.serverId ? ` (${esc(order.serverId)})` : ""}
${order.product === "MLBB" ? "💎" : "🎯"} ${esc(String(order.amount))}
💰 ${Number(order.totalPrice).toLocaleString()} MMK

🙏 ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါတယ်`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// USER REJECTED
// ===============================
async function notifyUserRejected(bot, order) {
  return bot.sendMessage(
    order.userId,
    `❌ *ORDER REJECTED*
━━━━━━━━━━━━━━━
🆔 Order ID: ${esc(order.orderId)}

Owner @Official_Bika ကို ဆက်သွယ်ပါ`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// ADMIN UPDATE (optional)
// ===============================
async function updateAdminMessage(bot, adminMsg, status) {
  const caption = status === "APPROVED" ? "✅ ORDER COMPLETED" : "❌ ORDER REJECTED";

  return bot.editMessageCaption(caption, {
    chat_id: adminMsg.adminChatId,
    message_id: adminMsg.adminMsgId
  });
}

// ===============================
// STATUS UI
// ===============================
function statusUI({ role, total, pending }) {
  return `🤖 *Bika Bot Status*
━━━━━━━━━━━━━━━
👤 Role: ${esc(role)}
📦 Orders: ${Number(total).toLocaleString()}
⏳ Pending: ${Number(pending).toLocaleString()}`;
}

// ===============================
// TOP 10 UI
// ===============================
function top10UI(list) {
  let text = "🏆 *TOP 10 USERS*\n━━━━━━━━━━━━━━━\n\n";
  (list || []).forEach((u, i) => {
    text += `${i + 1}. 👤 ${esc(u._id)}\n💰 ${Number(u.total).toLocaleString()} MMK\n\n`;
  });
  return text;
}

// ===============================
// MY RANK UI
// ===============================
function myRankUI(rank, total) {
  return `🏅 *YOUR RANK*
━━━━━━━━━━━━━━━
🥇 Rank: #${esc(rank)}
💰 Total: ${Number(total).toLocaleString()} MMK`;
}

// ===============================
module.exports = {
  sendPriceList,
  sendPaymentMethods,
  sendPaymentInfo,
  sendOrderPreview,
  sendWaiting,
  notifyUserApproved,
  notifyUserRejected,
  updateAdminMessage,
  statusUI,
  top10UI,
  myRankUI
};
