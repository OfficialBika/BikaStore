// ===============================
// USER HANDLER (CLEAN & FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders");

// ===============================
// USER TEXT HANDLER
// ===============================
async function onMessage({ bot, msg, session }) {
  const chatId = msg.chat.id.toString();
  const text = msg.text?.trim();

  if (!text) return;

  // ===============================
  // /start (RESET FLOW)
  // ===============================
  if (text === "/start") {
    session[chatId] = {};

    await bot.sendMessage(
      chatId,
      "👋 *Welcome to BikaStore!*\n\n🎮 Game တစ်ခုကို ရွေးပါ ⬇️",
      {
        parse_mode: "Markdown",
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

  const t = session[chatId];
  if (!t || !t.step) return;

  // ===============================
  // STEP: GAME → USER ID
  // ===============================
  if (t.step === "GAME") {
    t.gameUserId = text;
    t.step = "QTY";

    await bot.sendMessage(
      chatId,
      "📦 *Quantity ကို ထည့်ပါ*",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ===============================
  // STEP: QTY → CONFIRM
  // ===============================
  if (t.step === "QTY") {
    if (isNaN(text)) {
      await bot.sendMessage(chatId, "❌ Quantity မှန်အောင် ထည့်ပါ");
      return;
    }

    t.qty = Number(text);
    t.step = "CONFIRM";

    return ui.sendOrderPreview(bot, chatId, t);
  }

  // ===============================
  // STEP: PAYMENT METHOD
  // ===============================
  if (t.step === "PAY_METHOD") {
    return;
  }

  // ===============================
  // STEP: PAYMENT (WAIT PHOTO)
  // ===============================
  if (t.step === "PAYMENT") {
    await bot.sendMessage(
      chatId,
      "📸 Screenshot ကို *photo* အနေနဲ့ ပို့ပါ",
      { parse_mode: "Markdown" }
    );
    return;
  }
}

// ===============================
// PAYMENT PHOTO HANDLER
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

    session[chatId] = null; // ✅ clear session

  } catch (err) {
    console.error("❌ Payment photo error:", err);
    await bot.sendMessage(chatId, "⚠️ Order failed. Try again.");
  }
}

module.exports = {
  onMessage,
  onPaymentPhoto
};
