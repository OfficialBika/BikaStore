// ===============================
// UI TEMPLATES (Bika Store)
// ===============================

const PAYMENTS = {
  KPay: "💜 *KPay*\n09264202637\nName - Shine Htet Aung",
  WavePay: "💙 *WavePay*\n09264202637\nName - Shine Htet Aung"
};

const PRICES = require("./prices"); // optional (if separated)

// ===============================
// PRICE LIST
// ===============================
async function sendPriceList(bot, chatId, product) {
  const priceText = Object.entries(PRICES[product])
    .map(([k, v]) => `• *${k}* = ${v.toLocaleString()} MMK`)
    .join("\n");

  const p1 = await bot.sendMessage(
    chatId,
    `📋 *${product} PRICE LIST*\n━━━━━━━━━━━━━━━\n${priceText}`,
    { parse_mode: "Markdown" }
  );

  const p2 = await bot.sendMessage(
    chatId,
    product === "MLBB"
      ? "🆔 *Game ID + Server ID*\n\n`11111111 2222`\n`11111111(2222)`"
      : "🆔 *PUBG Game ID ကို ထည့်ပါ*",
    { parse_mode: "Markdown" }
  );

  return [p1.message_id, p2.message_id];
}

// ===============================
// PAYMENT METHOD SELECT
// ===============================
async function sendPaymentMethods(bot, chatId) {
  const m = await bot.sendMessage(chatId, "💳 *Payment Method ရွေးပါ*", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💜 KPay", callback_data: "PAY_KPay" }],
        [{ text: "💙 WavePay", callback_data: "PAY_WavePay" }]
      ]
    }
  });
  return m.message_id;
}

// ===============================
// PAYMENT INFO
// ===============================
async function sendPaymentInfo(bot, chatId, method) {
  return bot.sendMessage(
    chatId,
    `${PAYMENTS[method]}\n\n📸 *ငွေလွှဲ ပြေစာ ပို့ပေးပါ*`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// ORDER PREVIEW
// ===============================
async function sendOrderPreview(bot, chatId, order) {
  const m = await bot.sendMessage(
    chatId,
    `📦 *ORDER PREVIEW*
━━━━━━━━━━━━━━━
🆔 *Order ID:* ${order.orderId}
🎮 *Game:* ${order.product}
🆔 *ID:* ${order.gameId} (${order.serverId})
💰 *Total:* ${order.totalPrice.toLocaleString()} MMK`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirm Order", callback_data: "CONFIRM" }]
        ]
      }
    }
  );

  return m.message_id;
}

// ===============================
// USER WAITING
// ===============================
async function sendWaiting(bot, chatId, orderId) {
  return bot.sendMessage(
    chatId,
    `⏳ *Admin စစ်ဆေးနေပါသည်...*\n\n🆔 Order ID: ${orderId}`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// USER APPROVED
// ===============================
async function notifyUserApproved(bot, order) {
  await bot.deleteMessage(order.userId, order.waitMsgId);

  return bot.sendMessage(
    order.userId,
    `✅ *ORDER COMPLETED*
━━━━━━━━━━━━━━━
🎮 ${order.product}
🆔 ${order.gameId} (${order.serverId})
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
Order ID: ${order.orderId}

Owner @Official_Bika ကို ဆက်သွယ်ပါ`,
    { parse_mode: "Markdown" }
  );
}

// ===============================
// ADMIN UPDATE
// ===============================
async function updateAdminMessage(bot, order, status) {
  const text =
    status === "APPROVED"
      ? "✅ ORDER COMPLETED"
      : "❌ ORDER REJECTED";

  return bot.editMessageCaption(text, {
    chat_id: order.adminChatId,
    message_id: order.adminMsgId
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
// TOP10 UI
// ===============================
function top10UI(list) {
  let text = "🏆 *TOP 10 USERS (This Month)*\n━━━━━━━━━━━━━━━\n\n";
  list.forEach((u, i) => {
    text += `${i + 1}. 👤 ${u.username || u._id}\n💰 ${u.total.toLocaleString()} MMK\n\n`;
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
