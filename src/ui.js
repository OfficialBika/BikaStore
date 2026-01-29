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
  try {
    return date.toLocaleString("en-US", { month: "long" });
  } catch {
    return "This Month";
  }
}

// ===============================
// TIME (Myanmar / Yangon, 12-hour AM/PM)
// ===============================
function formatMyanmarTime(ts = Date.now()) {
  try {
    return new Date(ts).toLocaleString("en-US", {
      timeZone: "Asia/Yangon",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return new Date(ts).toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
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
// ===============================
function extractAmountFromLabel(label) {
  const m = String(label || "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

// findPriceItem supports:
// - i.amount exact match (string/number) case-insensitive
// - digits in label match (e.g. "86 Diamonds")
function findPriceItem(productKey, amount) {
  const product = PRICES[productKey];
  if (!product || !Array.isArray(product.items)) return null;

  const a = amount == null ? "" : String(amount).trim();

  // 1) exact item.amount match (case-insensitive)
  const byField = product.items.find(i => {
    if (!i) return false;
    if (i.amount == null) return false;
    return String(i.amount).trim().toLowerCase() === a.toLowerCase();
  });
  if (byField) return byField;

  // 2) match by digits in label (only if amount is numeric-like)
  const n = Number(a);
  if (Number.isFinite(n)) {
    const byLabel = product.items.find(i => extractAmountFromLabel(i?.label) === n);
    if (byLabel) return byLabel;
  }

  return null;
}

// ===============================
// MULTI AMOUNT SUPPORT (86+343 / wp+wp2 / wp+343)
// returns: { total:number, breakdown:[{label, price}] } or null
// ===============================
function normalizeAmountToken(token) {
  return String(token || "")
    .trim()
    .replace(/^\//, "") // allow "/wp2"
    .toLowerCase(); // allow "WP2", "wP2"
}

function splitAmountParts(input) {
  const s = String(input || "").trim();
  if (!s) return [];
  return s
    .replace(/\s+/g, "") // remove spaces
    .split("+")
    .map(x => normalizeAmountToken(x))
    .filter(Boolean);
}

function computeTotalMMKMulti(productKey, amountInput) {
  const parts = splitAmountParts(amountInput);
  if (!parts.length) return null;

  let total = 0;
  const breakdown = [];

  for (const p of parts) {
    const item = findPriceItem(productKey, p);
    if (!item) return null;

    const label = item.label || p;
    const price = Number(item.price || 0);

    total += price;
    breakdown.push({ label, price });
  }

  if (!Number.isFinite(total)) return null;
  return { total, breakdown };
}

// ===============================
// PRICE LIST
// ===============================
async function sendPriceList(bot, chatId, productKey) {
  const product = PRICES[productKey];
  if (!product) return null;

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
// ===============================
async function sendOrderPreview(bot, chatId, t) {
  const game = t.game || t.product;
  const gameId = t.game_id || t.gameId || "";
  const serverId = t.server_id || t.serverId || "";
  const amount = t.amount ?? t.qty ?? "";

  const orderId = ensureOrderId(t);
  t.orderTime = t.orderTime || formatBangkokTime(t.createdAt || Date.now());

  // ✅ multi compute
  const multi = computeTotalMMKMulti(game, amount);

  if (!multi) {
    await bot.sendMessage(
      chatId,
      "❌ Diamonds / Package ကို မသိပါ\nဥပမာ: 86+343 / wp+wp2",
      { parse_mode: "Markdown" }
    );
    return null;
  }

  // ✅ save
  t.totalPrice = multi.total;
  t.breakdown = multi.breakdown || [];

  // breakdown text
  const breakdownText =
    t.breakdown.length > 1
      ? "\n\n🧾 *Breakdown*\n" +
        t.breakdown.map(b => `• ${esc(b.label)} — *${Number(b.price).toLocaleString()} MMK*`).join("\n")
      : "";

  const lines = [
    `📦 *ORDER PREVIEW*`,
    `━━━━━━━━━━━━━━━`,
    `🆔 *Order ID:* ${esc(orderId)}`,
    `🎮 *Game:* ${esc(game)}`,
    `🆔 *ID:* ${esc(gameId)}${serverId ? ` (${esc(serverId)})` : ""}`,
    `${game === "MLBB" ? "💎" : "🎯"} *Amount:* ${esc(String(amount))}`,
    `💰 *Total:* ${Number(t.totalPrice).toLocaleString()} MMK`,
    `🕒 *Order time:* ${esc(t.orderTime)}${breakdownText}`
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
  // order.createdAt may exist (mongoose timestamps)
  const time = order.createdAt ? formatBangkokTime(order.createdAt) : formatBangkokTime();

  return bot.sendMessage(
    order.userId,
    `✅ *ORDER COMPLETED*
━━━━━━━━━━━━━━━
🎮 ${esc(order.product || order.game)}
🆔 ${esc(order.gameId)}${order.serverId ? ` (${esc(order.serverId)})` : ""}
${order.product === "MLBB" ? "💎" : "🎯"} ${esc(String(order.amount))}
💰 ${Number(order.totalPrice).toLocaleString()} MMK
🕒 *Order time:* ${esc(time)}

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
// ADMIN UPDATE (edit caption)
// ===============================
async function updateAdminMessage(bot, adminMsg, status) {
  const caption = status === "APPROVED" ? "✅ ORDER COMPLETED" : "❌ ORDER REJECTED";

  return bot.editMessageCaption(caption, {
    chat_id: adminMsg.adminChatId,
    message_id: adminMsg.adminMsgId
  });
}

// ===============================
// STATUS UI (for /status) — PRO
// ===============================
function statusUI({ totalUsers = 0, approved = 0, aliveHours = 0 }) {
  return (
    `🤖 *BIKA STORE — BOT STATUS*\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `👥 *Users:* ${Number(totalUsers).toLocaleString()}\n` +
    `✅ *Approved Orders:* ${Number(approved).toLocaleString()}\n` +
    `⏱ *Bot Alive:* ${Number(aliveHours).toLocaleString()} hours`
  );
}

// ===============================
// TOP 10 UI (robust)
// list item may be: { username, userId, firstName, total } OR aggregate style
// ===============================
function top10UI(list = [], monthName = "") {
  const m = monthName || getMonthName();

  let text = `🏆 *TOP 10 USERS — ${esc(m)}*\n━━━━━━━━━━━━━━━\n\n`;
  if (!list.length) return text + "No completed orders yet 🙏";

  list.forEach((u, i) => {
    // best-effort display
    const name =
      u?.username
        ? `@${esc(u.username)}`
        : u?.userId
          ? `[User](tg://user?id=${u.userId})`
          : u?._id
            ? `[User](tg://user?id=${u._id})`
            : "User";

    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅";
    const total = Number(u.total || 0);

    text += `${medal} *#${i + 1}*\n👤 ${name}\n💰 ${total.toLocaleString()} MMK\n\n`;
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
    `🗓 *Month:* ${esc(monthName)}`,
    `━━━━━━━━━━━━━━━`,
    `🏅 *Rank:* #${esc(rank)}`,
    `💰 *Total Spent:* ${Number(total || 0).toLocaleString()} MMK`
  ].join("\n");
}

// ===============================
// ADMIN DASHBOARD UI + KEYBOARD
// (commands.js မှာ ui.adminDashboardUI() ခေါ်မယ်ဆို ဒီ function လိုတယ်)
// ===============================
function adminDashboardUI({ total = 0, pending = 0, completed = 0, rejected = 0 }) {
  return (
    `👑 *ADMIN DASHBOARD*\n` +
    `━━━━━━━━━━━━━━━\n\n` +
    `📦 *Total Orders:* ${Number(total).toLocaleString()}\n` +
    `⏳ *Pending:* ${Number(pending).toLocaleString()}\n` +
    `✅ *Completed:* ${Number(completed).toLocaleString()}\n` +
    `❌ *Rejected:* ${Number(rejected).toLocaleString()}`
  );
}

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
module.exports = {
  // price / payment
  sendPriceList,
  sendPaymentMethods,
  sendPaymentInfo,

  // order flow
  sendOrderPreview,
  sendWaiting,
  notifyUserApproved,
  notifyUserRejected,
  updateAdminMessage,

  // dashboards / commands
  statusUI,
  top10UI,
  myRankUI,
  adminDashboardUI,
  adminDashboardKeyboard,

  // helpers (optional export if you need elsewhere)
  computeTotalMMKMulti
};
