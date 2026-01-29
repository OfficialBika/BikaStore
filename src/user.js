// ===============================
// USER HANDLER (FINAL - CLEAN)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const Order = require("./models/order");

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

function ensureSession(session, chatId) {
  if (!session[chatId]) session[chatId] = {};
  const t = session[chatId];

  if (!t.msg || typeof t.msg !== "object") {
    t.msg = Object.create(null);
  }

  if (!Array.isArray(t.msg.stack)) {
    t.msg.stack = [];
  }

  return t;
}

function rememberMsg(t, key, m) {
  if (!t?.msg || !m?.message_id) return;
  t.msg[key] = m.message_id;
  t.msg.stack.push(m.message_id);
}

// Parse "id server"
function parseGameIdAndServer(input) {
  const raw = String(input || "").trim();
  const parts = raw.split(/[\s,|/:-]+/).filter(Boolean);
  if (parts.length < 2) return null;

  return {
    gameId: parts[0],
    serverId: parts[1]
  };
}

// -------------------------------
// USER TEXT HANDLER
// -------------------------------
async function onMessage({ bot, msg, session, ADMIN_IDS, promo }) {
  const chatId = getChatId(msg);
  if (!chatId) return;

  const text = msg.text?.trim();
  if (!text) return;

  const t = ensureSession(session, chatId);

  // ===============================
  // /start (RESET FLOW)
  // ===============================
  if (text === "/start") {
    // clean state (keep msg container)
    t.msg = { stack: [] };
    t.msg.step = "CHOOSE_GAME";

    const pendingCount = await Order.countDocuments({
      userId: chatId,
      status: "PENDING"
    });

    if (pendingCount > 0) {
      t.msg.step = "PENDING_DECISION";

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

    rememberMsg(t, "startMenuId", m);
    return;
  }

  // ===============================
  // PROMO WINNER INPUT (SAFE)
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

    await bot.sendMessage(chatId, "✅ ဆုလက်ဆောင်ကို Admin ထံပို့ပြီးပါပြီ ⏳");

    for (const adminId of promo.adminIds || []) {
      await bot.sendMessage(
        adminId,
        `🎁 *PROMO WINNER*\n\n👤 ${promo.winner.username}\n🆔 ${parsed.gameId}\n🖥 ${parsed.serverId}`,
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

  // -------------------------------
  // FLOW STEPS
  // -------------------------------
  const step = t.msg.step;
  if (!step) return;

  // ===============================
  // WAIT_GAME_ID
  // ===============================
  if (step === "WAIT_GAME_ID") {
    const parsed = parseGameIdAndServer(text);
    if (!parsed) {
      return bot.sendMessage(
        chatId,
        "❌ ID & Server ID မှန်အောင်ထည့်ပါ\nဥပမာ: `123456789 1234`",
        { parse_mode: "Markdown" }
      );
    }

    t.msg.game_id = parsed.gameId;
    t.msg.server_id = parsed.serverId;
    t.msg.step = "WAIT_AMOUNT";

    const m = await bot.sendMessage(
      chatId,
      t.msg.game === "MLBB"
        ? "💎 Diamonds ပမာဏကို ထည့်ပါ (ဥပမာ: `86` / `wp+wp2`)"
        : "🎯 UC ပမာဏကို ထည့်ပါ (ဥပမာ: `60`)",
      { parse_mode: "Markdown" }
    );

    rememberMsg(t, "askAmountId", m);
    return;
  }

  // ===============================
  // WAIT_AMOUNT
  // ===============================
  if (step === "WAIT_AMOUNT") {
    const amount = text.replace(/\s+/g, "").replace(/^\//, "").toLowerCase();
    if (!/^[a-z0-9+]+$/.test(amount)) {
      return bot.sendMessage(
        chatId,
        "❌ Amount မမှန်ပါ\nဥပမာ: 86 | 86+343 | wp | wp+wp2"
      );
    }

    t.msg.amount = amount;
    t.msg.step = "PREVIEW";

    const preview = await ui.sendOrderPreview(bot, chatId, t.msg);
    rememberMsg(t, "previewId", preview);
    return;
  }
}

// -------------------------------
// PAYMENT PHOTO HANDLER
// -------------------------------
async function onPaymentPhoto({ bot, msg, session, ADMIN_IDS }) {
  const chatId = getChatId(msg);
  if (!chatId) return;

  const t = session[chatId];
  if (!t?.msg || t.msg.step !== "WAIT_RECEIPT") return;

  try {
    await orders.createOrder({ bot, msg, session, ADMIN_IDS });
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
