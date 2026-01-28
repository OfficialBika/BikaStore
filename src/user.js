// ===============================
// USER HANDLER (FINAL & FIXED)
// ===============================

const ui = require("./ui");
const orders = require("./orders");

// ===============================
// USER TEXT MESSAGE
// ===============================
async function onMessage({ bot, msg, session }) {
  const chatId = msg.chat.id.toString();
  const text = msg.text;

  if (!text) return;

  // ===============================
  // /start
  // ===============================
  if (text === "/start") {
    session[chatId] = null;

    await bot.sendMessage(
      chatId,
      "👋 Welcome to BikaStore!\n\nGame တစ်ခုကို ရွေးပါ ⬇️",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }],
            [{ text: "🎯 PUBG UC", callback_data: "PUBG" }]
          ]
        }
      }
    );
    return;
  }
}

// ===============================
// PAYMENT PHOTO
// ===============================
async function onPaymentPhoto({ bot, msg, session, ADMIN_IDS }) {
  const chatId = msg.chat.id.toString();
  const t = session[chatId];

  if (!t || t.step !== "PAYMENT") return;

  try {
    await orders.createOrder({
      bot,
      msg,
      session,
      ADMIN_IDS
    });
  } catch (err) {
    console.error("Payment photo error:", err);
  }
}

module.exports = {
  onMessage,
  onPaymentPhoto
};
