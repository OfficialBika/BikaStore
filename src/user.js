// ===============================
// USER HANDLER (FINAL)
// Flow:
// /start -> (callbacks: MLBB/PUBG) -> ask ID+ServerID -> ask Diamonds/UC amount
// -> preview (callbacks: confirm/cancel) -> payment method (callbacks)
// -> ask receipt photo -> photo upload -> create order (orders.createOrder)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const Order = require("./models/order"); // ✅ move to top (avoid inside handler)

// -------------------------------
// Helpers
// -------------------------------
function getChatId(msg) {
  return msg?.chat?.id != null ? String(msg.chat.id) : null;
}

async function safeDelete(bot, chatId, messageId) {
  if (!messageId) return;
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (_) {}
}

function rememberMsg(t, key, messageObj) {
  if (!t || !t.msg || !messageObj) return;
  t.msg[key] = messageObj.message_id;
  if (Array.isArray(t.msg.stack)) t.msg.stack.push(messageObj.message_id);
}

function ensureSession(session, chatId) {
  if (!session || typeof session !== "object") {
    throw new Error("session object is missing");
  }

  if (!session[chatId] || typeof session[chatId] !== "object") {
    session[chatId] = {};
  }

  const t = session[chatId];

  if (!t.msg || typeof t.msg !== "object") {
    t.msg = Object.create(null);
  }

  if (!Array.isArray(t.msg.stack)) {
    t.msg.stack = [];
  }

  return t;
}

// Parse "id serverId" or "id|serverId" or "id,serverId" etc.
function parseGameIdAndServer(input) {
  const raw = String(input || "").trim();
  const parts = raw.split(/[\s,|\/\-:]+/).filter(Boolean);
  if (parts.length < 2) return null;

  const gameId = parts[0];
  const serverId = parts[1];
  if (!gameId || !serverId) return null;

  return { gameId, serverId };
}

// -------------------------------
// USER TEXT HANDLER
// -------------------------------
async function onMessage({ bot, msg, session, ADMIN_IDS }) {
  const chatId = getChatId(msg);
  if (!chatId) return;

  const text = msg.text?.trim();
  if (!text) return;

  const t = ensureSession(session, chatId);

  // ===============================
  // /start (RESET FLOW)
  // ===============================
  if (text === "/start") {
    // make clean session container (keep msg holder)
    session[chatId] = { step: "CHOOSE_GAME", msg: Object.create(null) };
    const t0 = ensureSession(session, chatId);

    // ✅ If user already has pending orders, ask what to do
    const pendingCount = await Order.countDocuments({ userId: chatId, status: "PENDING" });

    if (pendingCount > 0) {
      session[chatId] = { step: "PENDING_DECISION", msg: Object.create(null) };

      return bot.sendMessage(
        chatId,
        `⛔ Pending order *${pendingCount}* ခု ရှိနေပါတယ်。\n\nဘာလုပ်ချင်ပါသလဲ?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Pending ကိုဆက်လုပ်မယ်", callback_data: "PENDING_CONTINUE" }],
              [{ text: "➕ အသစ်တင်မယ်", callback_data: "PENDING_NEW" }],
              [{ text: "📦 My Orders", callback_data: "MYORDERS" }]
            ]
          }
        }
      );
    }

    // ✅ send start menu and remember message id
    const m = await bot.sendMessage(
      chatId,
      "👋 *Welcome to BikaStore!*\n\n🎮 Game တစ်ခုကို ရွေးပါ ⬇️",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💎 MLBB Diamonds", callback_data: "GAME:MLBB" }],
            [{ text: "🎯 PUBG UC", callback_data: "GAME:PUBG" }]
          ]
        }
      }
    );

    rememberMsg(t0, "startMenuId", m);
    return;
  }

  // If user hasn't started, ignore
  if (!t.step) return;

  // ===============================
  // STEP: WAIT_GAME_ID (ID + ServerID)
  // ===============================
  if (t.step === "WAIT_GAME_ID") {
    const parsed = parseGameIdAndServer(text);
    if (!parsed) {
      await bot.sendMessage(
        chatId,
        "❌ *ID နဲ့ Server ID ကို မှန်အောင်ထည့်ပါ*\n\nဥပမာ:\n`123456789 1234`\n( space သို့မဟုတ် comma သို့မဟုတ် | နဲ့ခွဲလို့ရ )",
        { parse_mode: "Markdown" }
      );
      return;
    }

    t.game_id = parsed.gameId;
    t.server_id = parsed.serverId;

    // Next: ask amount
    t.step = "WAIT_AMOUNT";

    const m = await bot.sendMessage(
      chatId,
      t.game === "MLBB"
        ? "💎 *Diamonds ပမာဏကို ထည့်ပါ* (ဥပမာ: `86` / အများဆို `wp+wp2` / `86+343` )"
        : "🎯 *UC ပမာဏကို ထည့်ပါ* (ဥပမာ: `60`)",
      { parse_mode: "Markdown" }
    );

    // remember
    t.msg.askAmountId = m?.message_id;
    return;
  }

  // ===============================
  // STEP: WAIT_AMOUNT (Diamonds/UC amount)
  // ===============================
  if (t.step === "WAIT_AMOUNT") {
    // ✅ allow: 86, 86+343, wp, wp2+wp3, Wp+343, /wp2, "wp + 343"
    const amountInput = String(text || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/^\//, "");

    const isValidAmount = /^[a-zA-Z0-9+]+$/.test(amountInput);

    if (!isValidAmount) {
      await bot.sendMessage(
        chatId,
        "❌ Diamonds / Package ကို မသိပါ\nဥပမာ: 86 | 86+343 | wp | wp+wp2",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // ✅ save amount as STRING (lowercase for wp/wp2 case-insensitive)
    t.amount = amountInput.toLowerCase();

    // ✅ delete old messages: price list + ask id + ask amount
    await safeDelete(bot, chatId, t.msg?.priceListId);
    await safeDelete(bot, chatId, t.msg?.askIdId);
    await safeDelete(bot, chatId, t.msg?.askAmountId);

    if (t.msg) {
      delete t.msg.priceListId;
      delete t.msg.askIdId;
      delete t.msg.askAmountId;
    }

    // Next step: preview
    t.step = "PREVIEW";

    const previewMsg = await ui.sendOrderPreview(bot, chatId, t);
    if (t.msg) t.msg.previewId = previewMsg?.message_id;

    return;
  }

  // ===============================
  // STEP: WAIT_RECEIPT (Tell user to send photo)
  // ===============================
  if (t.step === "WAIT_RECEIPT") {
    await bot.sendMessage(
      chatId,
      "📸 *ပြေစာ Screenshot ကို photo အနေနဲ့ ပို့ပါ*\n(Album မပို့ပါနဲ့—Photo တစ်ပုံချင်းပို့ပါ)",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Otherwise: ignore
}

// -------------------------------
// PAYMENT PHOTO HANDLER
// -------------------------------
async function onPaymentPhoto({ bot, msg, session, ADMIN_IDS }) {
  const chatId = getChatId(msg);
  if (!chatId) return;

  const t = session[chatId];

  // Only accept receipt photo at correct step
  if (!t || t.step !== "WAIT_RECEIPT") return;

  // ❌ delete payment info message
  try {
    if (t.msg?.paymentInfoId) {
      await bot.deleteMessage(chatId, t.msg.paymentInfoId);
      delete t.msg.paymentInfoId;
    }
  } catch (_) {}

  // ❌ delete preview message if still exists
  try {
    if (t.msg?.previewId) {
      await bot.deleteMessage(chatId, t.msg.previewId);
      delete t.msg.previewId;
    }
  } catch (_) {}

  try {
    await orders.createOrder({
      bot,
      msg,
      session,
      ADMIN_IDS
    });

    delete session[chatId];
  } catch (err) {
    console.error("❌ Payment photo error:", err);
    await bot.sendMessage(chatId, "⚠️ Order failed. Try again with /start");
  }
}

module.exports = {
  onMessage,
  onPaymentPhoto
};
