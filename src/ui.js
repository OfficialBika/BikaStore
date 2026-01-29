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

function getMonthName(date = new Date()) {
  return date.toLocaleString("en-US", { month: "long" });
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

function formatUserDisplay(u) {
  // 1️⃣ username ရှိရင် @username
  if (u?.username) {
    return `@${esc(u.username)}`;
  }

  // 2️⃣ username မရှိရင် Telegram mention
  if (u?.telegramId || u?._id) {
    const id = u.telegramId || u._id;
    return `[User](tg://user?id=${id})`;
  }

  return "Unknown";
}


function extractAmountFromLabel(label) {
  const m = String(label || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function findPriceItem(productKey, amount) {
  const product = PRICES[productKey];
  if (!product || !Array.isArray(product.items)) return null;

  // 1) exact item.amount match (if exists)
  const byField = product.items.find(i => {
  if (!i.amount) return false;
  return String(i.amount).toLowerCase() === String(amount).toLowerCase();
});
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

  
 // compute total (support "86+343" / "wp+wp2")
const total = computeTotalMMKMulti(game, amount);

if (total == null) {
  await bot.sendMessage(
    chatId,
    "❌ Diamonds / Package ကို မသိပါ\nဥပမာ: 86+343 / wp+wp2"
  );
  return;
}

t.totalPrice = total;

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
// STATUS UI (PRO)
// ===============================
function statusDashboardUI({ totalUsers, approvedOrders, uptimeHours }) {
  return (
    `🤖 *BIKA STORE — BOT STATUS*\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    
    `👥 *Users:* ${totalUsers.toLocaleString()}\n` +
    
    `✅ *Approved Orders:* ${approvedOrders.toLocaleString()}\n` +
    
    `⏱ *Bot Alive:* ${uptimeHours} hours\n\n` +
    
    `🟢 Status: *ONLINE*`
  );
}

// ===============================
// TOP 10 UI
// ===============================
function top10UI(list = [], monthName = "") {
  let text =
    `🏆 *TOP 10 USERS — ${esc(monthName)}*\n` +
    `━━━━━━━━━━━━━━━\n\n`;

  if (!list.length) {
    return text + "No completed orders yet 🙏";
  }

  list.forEach((u, i) => {
    const displayName = u.username
      ? `@${esc(u.username)}`
      : `[${esc(u.firstName || "User")}](tg://user?id=${u.userId})`;

    const medal =
      i === 0 ? "🥇" :
      i === 1 ? "🥈" :
      i === 2 ? "🥉" : "🏅";

    text +=
      `${medal} *#${i + 1}*\n` +
      `👤 ${displayName}\n` +
      `💰 ${Number(u.total).toLocaleString()} MMK\n\n`;
  });

  return text;
}
// ===============================
// MY RANK UI
// ===============================
function myRankUI(rank, total) {
  const monthName = getMonthName();

  return [
    `🎯 *YOUR RANK*`,
    `🗓 *Month:* ${monthName}`,
    `━━━━━━━━━━━━━━━`,
    `🏅 *Rank:* #${esc(rank)}`,
    `💰 *Total Spent:* ${Number(total || 0).toLocaleString()} MMK`
  ].join("\n");
}

 // ===============================
  // /admin UI 
  // ===============================

function adminDashboardKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Refresh", callback_data: "ADMIN:REFRESH" },
        { text: "⏳ Pending", callback_data: "ADMIN:PENDING" }
      ],
      [
        { text: "🏆 Top10 (Month)", callback_data: "ADMIN:TOP10_MONTH" },
        { text: "🏆 Top10 (Today)", callback_data: "ADMIN:TOP10_TODAY" }
      ]
    ]
  };
}

// ===============================
// STATUS UI (for /status)
// ===============================
function statusUI({ totalUsers = 0, approved = 0, aliveHours = 0 }) {
  return (
    `🤖 *BIKA STORE — BOT STATUS*\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `👥 *Users:* ${Number(totalUsers).toLocaleString()}\n` +
    `✅ *Approved Orders:* ${Number(approved).toLocaleString()}\n` +
    `⏱ *Bot Alive:* ${aliveHours} hours`
  );
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
  myRankUI,
  statusDashboardUI
};
