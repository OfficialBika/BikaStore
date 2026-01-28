// ===============================
// USER HANDLER (FINAL)
// Flow:
// /start -> (callbacks: MLBB/PUBG) -> ask ID+ServerID -> ask Diamonds/UC amount
// -> preview (callbacks: confirm/cancel) -> payment method (callbacks)
// -> ask receipt photo -> photo upload -> create order (orders.createOrder)
// ===============================

const ui = require("./ui");
const orders = require("./orders");

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
  // keep stack too (optional)
  if (Array.isArray(t.msg.stack)) t.msg.stack.push(messageObj.message_id);
}


function ensureSession(session, chatId) {
  // 1) make sure container exists
  if (!session || typeof session !== "object") {
    throw new Error("session object is missing");
  }

  // 2) make sure this chat session exists
  if (!session[chatId] || typeof session[chatId] !== "object") {
    session[chatId] = {};
  }

  const t = session[chatId];

  // 3) make sure msg container exists
  if (!t.msg || typeof t.msg !== "object") {
    t.msg = Object.create(null);
  }

  // 4) optional stack for bulk delete
  if (!Array.isArray(t.msg.stack)) {
    t.msg.stack = [];
  }

  return t;
}

// Parse "id serverId" or "id|serverId" or "id,serverId" etc.
function parseGameIdAndServer(input) {
  const raw = String(input || "").trim();
  // allow separators: space, comma, |, /, -, :
  const parts = raw.split(/[\s,|\/\-:]+/).filter(Boolean);

  if (parts.length < 2) return null;

  const gameId = parts[0];
  const serverId = parts[1];

  // simple sanity checks: numbers only is common, but allow alphanum just in case
  if (!gameId || !serverId) return null;

  return { gameId, serverId };
}

function isPositiveIntString(s) {
  if (typeof s !== "string") return false;
  if (!/^\d+$/.test(s)) return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
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
  session[chatId] = { step: "CHOOSE_GAME", msg: Object.create(null) };

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

  // remember message id in session
  const t2 = ensureSession(session, chatId);
  rememberMsg(t2, "startMenuId", m);

  return;
  }

  // If user hasn't started, ignore or gently guide
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

    // Next: ask amount (diamonds/UC)
    t.step = "WAIT_AMOUNT";

    // If you want amount selection via inline buttons, do it in ui.
    // Here we ask as text input (safe fallback).
    const m = await bot.sendMessage(
  chatId,
  t.game === "MLBB"
    ? "💎 *Diamonds ပမာဏကို ထည့်ပါ* (ဥပမာ: `86/အများဆို + သုံး 86+343`)"
    : "🎯 *UC ပမာဏကို ထည့်ပါ* (ဥပမာ: `60`)",
  { parse_mode: "Markdown" }
);

// ✅ remember amount ask message id
t.msg.askAmountId = m?.message_id;

return;
  }

  // ===============================
  // STEP: WAIT_AMOUNT (Diamonds/UC amount)
  // ===============================
  if (t.step === "WAIT_AMOUNT") {
    if (!isPositiveIntString(text)) {
      await bot.sendMessage(chatId, "❌ ပမာဏကို ကိန်းဂဏန်း (1,2,3...) နဲ့ပဲ ထည့်ပါ");
      return;
    }

    t.amount = Number(text);

    // price calc: let ui or prices module handle.
    // We call ui to prepare preview and totals.
    t.step = "PREVIEW";

    // ui.sendOrderPreview should show:
    // - Order ID (temp)
    // - game, game_id, server_id
    // - amount
    // - total mmk
    // - order time
    // - inline buttons: confirm/cancel
    await ui.sendOrderPreview(bot, chatId, t);
    return;
  }

  // ===============================
  // STEP: WAIT_RECEIPT (Tell user to send photo)
  // (We DON'T accept text here except reminding)
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

  try {
    // orders.createOrder should:
    // - save order to DB
    // - send user confirmation ("admin စစ်ဆေးနေပါသည်")
    // - forward receipt + order details to admin chat with approve/decline buttons
    await orders.createOrder({
      bot,
      msg,
      session,
      ADMIN_IDS
    });

    // Clear session after successful order creation
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
