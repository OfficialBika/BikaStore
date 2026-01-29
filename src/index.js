// ===============================
// BIKA STORE — MAIN ENTRY (FINAL)
// ===============================

// Core
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// Modules
const registerCommands = require("./commands");
const registerCallbacks = require("./callbacks");
const adminHandlers = require("./admin");
const userHandlers = require("./user");

// ===============================
// BOT START TIME (UPTIME)
// ===============================
global.BOT_START_TIME = Date.now();

// ===============================
// ENV
// ===============================
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

const ADMIN_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",").map(s => s.trim()).filter(Boolean)
  : [];

// Basic env guard (avoid silent crashes)
if (!BOT_TOKEN) {
  console.error("❌ Missing env: BOT_TOKEN");
  process.exit(1);
}
if (!MONGO_URI) {
  console.error("❌ Missing env: MONGO_URI");
  process.exit(1);
}

// ===============================
// DB CONNECT
// ===============================
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error:", err));

// ===============================
// BOT & SERVER
// ===============================
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());
// WEBHOOK //
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "bika_webhook";
const WEBHOOK_PATH = `/telegram/${WEBHOOK_SECRET}`;

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200); //fast reply
});

// ===============================
// TEMP SESSION (GLOBAL)
// ===============================
const session = Object.create(null);

// ===============================
// GLOBAL CONTEXT
// ===============================
const context = {
  bot,
  session,
  ADMIN_IDS
};

// ===============================
// REGISTER COMMANDS & CALLBACKS
// ===============================
registerCommands(context);
registerCallbacks(context);

// ===============================
// HELPERS
// ===============================
function getChatId(msg) {
  // For "message" events, msg.chat.id is always the reliable chat identifier
  return msg?.chat?.id != null ? String(msg.chat.id) : null;
}

// ===============================
// USER / ADMIN MESSAGE HANDLER
// ===============================
bot.on("message", async msg => {
  try {
    const text = msg.text?.trim();
    if (!msg || !msg.text) return;
    const chatId = getChatId(msg);
    if (!chatId) return;

    // ===============================
    // ADMIN MESSAGE
    // ===============================
    if (ADMIN_IDS.includes(chatId)) {
      await adminHandlers.onMessage({
        bot,
        msg,
        session,   // pass session too (optional but useful)
        ADMIN_IDS
      });
      return; // admin message ကို user handler မပို့
    }

    // ===============================
    // USER MESSAGE
    // ===============================
    await userHandlers.onMessage({
      bot,
      msg,
      session,
      ADMIN_IDS
    });
  } catch (err) {
    console.error("Message handler error:", err);
  }
});

  // ===============================
  // PROMO WINNER ID INPUT
  // ===============================
  if (
    promo.active &&
    promo.waitingForId &&
    promo.winner &&
    promo.winner.userId === chatId
  ) {
    // Accept formats:
    // 123456789 1234
    // 123456789(1234)
    // 123456789 (1234)
    const match = text.match(/(\d+)\s*\(?\s*(\d+)\s*\)?/);

    if (!match) {
      return bot.sendMessage(
        chatId,
        "❌ Format မမှန်ပါ\n\nဥပမာ:\n123456789 1234\n123456789(1234)"
      );
    }

    const gameId = match[1];
    const serverId = match[2];

    promo.winner.gameId = gameId;
    promo.winner.serverId = serverId;
    promo.waitingForId = false;

    await bot.sendMessage(
      chatId,
      "✅ ID လက်ခံပြီးပါပြီ\n\nAdmin မှ အတည်ပြုပေးမည်ကို စောင့်ပါ 🙏"
    );

    // Notify admin
    for (const adminId of ADMIN_IDS) {
      await bot.sendMessage(
        adminId,
        `🎁 *PROMO WINNER*\n━━━━━━━━━━━━━━━\n\n👤 ${promo.winner.username}\n🆔 Game ID: \`${gameId}\`\n🖥 Server ID: \`${serverId}\``,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Approve Promo", callback_data: "PROMO_APPROVE" }]
            ]
          }
        }
      );
    }
  }
});


// ===============================
// PAYMENT PHOTO HANDLER (USER)
// ===============================
bot.on("photo", async msg => {
  try {
    if (!msg) return;

    await userHandlers.onPaymentPhoto({
      bot,
      msg,
      session,
      ADMIN_IDS
    });
  } catch (err) {
    console.error("Photo handler error:", err);
  }
});

// Optional: Log polling errors so you can diagnose quickly
bot.on("polling_error", err => {
  console.error("Polling error:", err?.message || err);
});

// ===============================
// WEB SERVER (KEEP ALIVE)
// ===============================
app.get("/", (_, res) => {
  res.send("🚀 Bika Store Bot Running");
});

app.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`);

  const PUBLIC_URL = process.env.PUBLIC_URL;
  if (!PUBLIC_URL) {
    console.error("❌ Missing env: PUBLIC_URL (e.g. https://xxxx.onrender.com)");
    return;
  }

  const url = `${PUBLIC_URL}${WEBHOOK_PATH}`;

  try {
    await bot.setWebHook(url);
    console.log("✅ Webhook set:", url);
  } catch (e) {
    console.error("❌ setWebHook failed:", e?.message || e);
  }
});

