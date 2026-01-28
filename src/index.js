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

