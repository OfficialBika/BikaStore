// ===============================
// USER HANDLER (FINAL - NO ERROR)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const Order = require("./models/order");

// PROMO (OPTIONAL)
let promo = null;
try {
  promo = require("./promo"); // promo.js ရှိမှ load
} catch (_) {
  promo = null;
}

// -------------------------------
// HELPERS
// -------------------------------
function getChatId(msg) {
  return msg?.chat?.id != null ? String(msg.chat.id) : null;
}

function ensureSession(session, chatId) {
  if (!session[chatId]) session[chatId] = {};
  if (!session[chatId].msg) session[chatId].msg = {};
  return session[chatId];
}

// Game ID parser (RULE BASED)
function parseIdByGame(input, game) {
  const raw = String(input || "").trim();

  // PUBG → ID only
  if (game === "PUBG") {
    if (!/^\d+$/.test(raw)) return null;
    return { gameId: raw, serverId: null };
  }

  // MLBB & others → ID + Server
  const match = raw.match(/(\d+)\s*\(?\s*(\d+)\s*\)?/);
  if (!match) return null;

  return {
    gameId: match[1],
    serverId: match[2]
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
  // PROMO WINNER ID INPUT
  // ===============================
  if (
    promo?.active &&
    promo?.waitingForId &&
    promo?.winner &&
    String(promo.winner.userId) === chatId
  ) {
    const parsed = parseIdByGame(text, promo.winner.game || "MLBB");

    if (!parsed) {
      return bot.sendMessage(
        chatId,
        promo.winner.game === "PUBG"
          ? "❌ PUBG Game ID ကိုသာပို့ပါ"
          : "❌ Format မမှန်ပါ\nဥပမာ:\n123456789 1234\n123456789(1234)"
      );
    }

    promo.winner.gameId = parsed.gameId;
    promo.winner.serverId = parsed.serverId;
    promo.waitingForId = false;

    await bot.sendMessage(
      chatId,
      "✅ ID လက်ခံပြီးပါပြီ\nAdmin အတည်ပြုချက်ကို စောင့်ပါ 🙏"
    );

    for (const adminId of ADMIN_IDS) {
      await bot.sendMessage(
        adminId,
        `🎁 PROMO WINNER\n\n👤 ${promo.winner.username}\n🆔 ${parsed.gameId}${
          parsed.serverId ? " (" + parsed.serverId + ")" : ""
        }`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Approve Promo", callback_data: "PROMO_APPROVE" }]
            ]
          }
        }
      );
    }
    return;
  }

  // ===============================
  // /start (RESET FLOW)
  // ===============================
  if (text === "/start") {
    session[chatId] = { step: "CHOOSE_GAME", msg: {} };
    const t0 = ensureSession(session, chatId);

    const pendingCount = await Order.countDocuments({
      userId: chatId,
      status: "PENDING"
    });

    if (pendingCount > 0) {
      t0.step = "PENDING_DECISION";
      return bot.sendMessage(
        chatId,
        `⛔ Pending order ${pendingCount} ခုရှိပါတယ်\nဘာလုပ်ချင်ပါသလဲ?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Pending ဆက်လုပ်မယ်", callback_data: "PENDING_CONTINUE" }],
              [{ text: "➕ အသစ်တင်မယ်", callback_data: "PENDING_NEW" }],
              [{ text: "📦 My Orders", callback_data: "MYORDERS" }]
            ]
          }
        }
      );
    }

    await bot.sendMessage(
      chatId,
      "👋 Welcome to *Bika Store*\n\n🎮 Game တစ်ခုကို ရွေးပါ ⬇️",
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
    return;
  }

  // ===============================
  // WAIT GAME ID
  // ===============================
  if (t.step === "WAIT_GAME_ID") {
    const parsed = parseIdByGame(text, t.game);

    if (!parsed) {
      return bot.sendMessage(
        chatId,
        t.game === "PUBG"
          ? "❌ PUBG Game ID ကိုသာထည့်ပါ"
          : "❌ Game ID & Server ID ထည့်ပါ\nဥပမာ: 12345678 4321"
      );
    }

    t.game_id = parsed.gameId;
    t.server_id = parsed.serverId;
    t.step = "WAIT_AMOUNT";

    return bot.sendMessage(
      chatId,
      t.game === "PUBG"
        ? "🎯 UC ပမာဏကို ထည့်ပါ"
        : "💎 Diamonds ပမာဏကို ထည့်ပါ"
    );
  }

  // ===============================
  // WAIT AMOUNT
  // ===============================
  if (t.step === "WAIT_AMOUNT") {
    if (!/^[a-zA-Z0-9+]+$/.test(text)) {
      return bot.sendMessage(chatId, "❌ Amount မမှန်ပါ");
    }

    t.amount = text;
    t.step = "PREVIEW";

    await ui.sendOrderPreview(bot, chatId, t);
    return;
  }

  // ===============================
  // WAIT RECEIPT
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
    await bot.sendMessage(chatId, "⚠️ Order မအောင်မြင်ပါ /start ပြန်လုပ်ပါ");
  }
}

module.exports = {
  onMessage,
  onPaymentPhoto
};
