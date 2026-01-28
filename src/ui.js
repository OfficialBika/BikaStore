// ===============================
// UI TEMPLATES (BIKA STORE - STABLE)
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
// MARKDOWN SAFE
// ===============================
function esc(text = "") {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ===============================
// PRICE LIST
// ===============================
async function sendPriceList(bot, chatId, productKey) {
  const product = PRICES[productKey];
  if (!product) return;

  const list = product.items
    .map(i => `• ${esc(i.label)} — *${i.price.toLocaleString()} ${product.currency}*`)
    .join("\n");

  await bot.sendMessage(
    chatId,
    `📋 *${esc(product.name)} PRICE LIST*\n━━━━━━━━━━━━━━━\n${list}`,
    { parse_mode: "Markdown" }
  );

  await bot.sendMessage(
    chatId,
    productKey === "MLBB"
      ? "🆔 *Game ID + Server ID*\n\n`12345678 1234`"
      : "🆔 *PUBG Game ID ကို ထည့်ပါ*",
    { parse_mode: "Markdown" }
  );
}

// ===============================
// PAYMENT METHOD SELECT
// ===============================
async function sendPaymentMethods(bot, chatId) {
  return bot.sendMessage(
    chatId,
    "💳 *Payment Method ရွေးပါ*",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💜 KPay", callback_data: "PAY_KPay" }],
          [{ text: "💙 WavePay", callback_data: "PAY_WavePay" }]
        ]
      }
    }
  );
}

// ===============================
// PAYMENT INFO
// ===============================
async function sendPaymentInfo(bot, chatId, method) {
  return bot.sendMessage(
    chatId,
    `${PAYMENTS[method]}\n\n📸 *ငွေလွှဲပြီး Screenshot ပို့ပေးပါ*`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// ORDER PREVIEW
// ===============================
async function sendOrderPreview(bot, chatId, t) {
  return bot.sendMessage(
    chatId,
    `📦 *ORDER PREVIEW*
━━━━━━━━━━━━━━━
🆔 *Order ID:* ${esc(t.orderId)}
🎮 *Game:* ${esc(t.product)}
🆔 *ID:* ${esc(t.gameId)} (${esc(t.serverId)})
💰 *Total:* ${t.totalPrice.toLocaleString()} MMK`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirm Order", callback_data: "CONFIRM" }]
        ]
      }
    }
  );
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
🎮 ${esc(order.product)}
🆔 ${esc(order.gameId)} (${esc(order.serverId)})
💰 ${order.totalPrice.toLocaleString()} MMK

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
// ADMIN UPDATE
// ===============================
async function updateAdminMessage(bot, adminMsg, status) {
  const caption =
    status === "APPROVED"
      ? "✅ ORDER COMPLETED"
      : "❌ ORDER REJECTED";

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
👤 Role: ${role}
📦 Orders: ${total}
⏳ Pending: ${pending}`;
}

// ===============================
// TOP 10 UI
// ===============================
function top10UI(list) {
  let text = "🏆 *TOP 10 USERS*\n━━━━━━━━━━━━━━━\n\n";
  list.forEach((u, i) => {
    text += `${i + 1}. 👤 ${u._id}\n💰 ${u.total.toLocaleString()} MMK\n\n`;
  });
  return text;
}

// ===============================
// MY RANK UI
// ===============================
function myRankUI(rank, total) {
  return `🏅 *YOUR RANK*
━━━━━━━━━━━━━━━
🥇 Rank: #${rank}
💰 Total: ${total.toLocaleString()} MMK`;
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
