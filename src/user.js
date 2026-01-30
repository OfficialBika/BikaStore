// ===============================
// USER HANDLER (FINAL - FIXED)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const Order = require("./models/order");

// 🔒 PROMO (OPTIONAL / SAFE)
let promo = null;
try {
  promo = require("./promo"); // promo.js ရှိရင်ပဲ load
} catch (_) {
  promo = null;
}

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
  if (Array.isArray(t.msg.stack)) {
    t.msg.stack.push(messageObj.message_id);
  }
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

// Parse "id serverId"
function parseGameIdAndServer(input) {
  const raw = String(input || "").trim();
  const parts = raw.split(/[\s,|\/\-:]+/).filter(Boolean);
  if (parts.length < 2) return null;

  return {
    gameId: parts[0],
    serverId: parts[1]
  };
}

// -------------------------------
// USER MESSAGE HANDLER
// -------------------------------
async function onMessage({ bot, msg, session, ADMIN_IDS }) {
  const chatId = getChatId(msg);
  if (!chatId) return;

  const text = msg.text?.trim();
  if (!text) return;

  const t = ensureSession(session, chatId);

  // ===============================
  // /start (RESET)
  // ===============================
  if (text === "/start") {
    session[chatId] = { step: "CHOOSE_GAME", msg: Object.create(null) };
    const t0 = ensureSession(session, chatId);

    const pendingCount = await Order.countDocuments({
      userId: chatId,
      status: "PENDING"
    });

    if (pendingCount > 0) {
      session[chatId].step = "PENDING_DECISION";

      return bot.sendMessage(
        chatId,
        `⛔ Pending order *${pendingCount}* ခု ရှိနေပါတယ်\n\nဘာလုပ်ချင်ပါသလဲ?`,
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

  // ===============================
  // PROMO WINNER FLOW (SAFE)
  // ===============================
  if (
    promo &&
    promo.active &&
    promo.winner &&
    chatId === promo.winner.userId &&
    !promo.winner.gameId
  ) {
    const parsed = parseGameIdAndServer(text);

    if (!parsed) {
      return bot.sendMessage(
        chatId,
        "⚠️ Game ID နှင့် Server ID ကို space ခြားပြီးပို့ပါ\nဥပမာ: `12345678 4321`",
        { parse_mode: "Markdown" }
      );
    }

    promo.winner.gameId = parsed.gameId;
    promo.winner.serverId = parsed.serverId;

    await bot.sendMessage(
      chatId,
      "✅ သင့်ဆုလက်ဆောင်ကို Admin ထံ တင်ပြပြီးပါပြီ ⏳"
    );

    for (const adminId of promo.adminIds || []) {
      await bot.sendMessage(
        adminId,
        `🎁 *PROMOTION WINNER*\n\n👤 ${promo.winner.username}\n🆔 \`${parsed.gameId}\`\n🖥 \`${parsed.serverId}\``,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Approve Reward", callback_data: "PROMO_APPROVE" }]
            ]
          }
        }
      );
    }

    return;
  }

  if (!t.step) return;

  // ===============================
  // WAIT_GAME_ID
  // ===============================
  if (t.step === "WAIT_GAME_ID") {
    const parsed = parseGameIdAndServer(text);
    if (!parsed) {
      return bot.sendMessage(
        chatId,
        "❌ ID & Server ID မှန်အောင်ထည့်ပါ\nဥပမာ: `123456789 1234`",
        { parse_mode: "Markdown" }
      );
    }

    t.game_id = parsed.gameId;
    t.server_id = parsed.serverId;
    t.step = "WAIT_AMOUNT";

    const m = await bot.sendMessage(
      chatId,
      t.game === "MLBB"
        ? "💎 Diamonds ပမာဏကို ထည့်ပါ"
        : "🎯 UC ပမာဏကို ထည့်ပါ",
      { parse_mode: "Markdown" }
    );

    t.msg.askAmountId = m.message_id;
    return;
  }

  // ===============================
  // WAIT_AMOUNT
  // ===============================
  if (t.step === "WAIT_AMOUNT") {
    const amount = text.replace(/\s+/g, "").replace(/^\//, "");
    if (!/^[a-zA-Z0-9+]+$/.test(amount)) {
      return bot.sendMessage(chatId, "❌ Amount မမှန်ပါ");
    }

    t.amount = amount.toLowerCase();
    t.step = "PREVIEW";

    const preview = await ui.sendOrderPreview(bot, chatId, t);
    t.msg.previewId = preview?.message_id;
    return;
  }

  // ===============================
  // WAIT_RECEIPT
  // ===============================
  if (t.step === "WAIT_RECEIPT") {
    return bot.sendMessage(
      chatId,
      "📸 Payment Screenshot ကို *photo* အနေနဲ့ပို့ပါ",
      { parse_mode: "Markdown" }
    );
  }
}

// -------------------------------
// PAYMENT PHOTO HANDLER
// -------------------------------
async function onPaymentPhoto({ bot, msg, session, ADMIN_IDS }) {
  const chatId = getChatId(msg);
  if (!chatId) return;

  const t = session[chatId];
  if (!t || t.step !== "WAIT_RECEIPT") return;

  try {
    await orders.createOrder({ bot, msg, session, ADMIN_IDS });
    delete session[chatId];
  } catch (err) {
    console.error("❌ Payment error:", err);
    await bot.sendMessage(chatId, "⚠️ Order failed. /start ပြန်လုပ်ပါ");
  }
}

module.exports = {
  onMessage,
  onPaymentPhoto
};
