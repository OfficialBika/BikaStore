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
  ? process.env.ADMIN_CHAT_IDS.split(",")
  : [];

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
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

// ===============================
// TEMP SESSION (GLOBAL)
// ===============================
const session = {};

// ===============================
// GLOBAL CONTEXT
// ===============================
const context = {
  bot,
  session,
  ADMIN_IDS
};

// ===============================
// REGISTER COMMANDS
// ===============================
registerCommands(context);

// ===============================
// REGISTER CALLBACK QUERIES
// ===============================
registerCallbacks(context);

// ===============================
// /START MESSAGE HANDLER
// ===============================

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("START CMD FROM", chatId);

  await bot.sendMessage(
    chatId,
    "👋 Welcome to Bika Store\n\n💎 Order စတင်ရန် menu ကိုရွေးပါ"
  );
});


// ===============================
// USER MESSAGE HANDLER
// ===============================
bot.on("message", async msg => {
  try {
    // admin message handled separately
    if (ADMIN_IDS.includes(msg.from?.id?.toString())) {
      await adminHandlers.onMessage({
        bot,
        msg,
        ADMIN_IDS
      });
    }

    // user flow
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
// PAYMENT PHOTO HANDLER
// ===============================
bot.on("photo", async msg => {
  try {
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

// ===============================
// WEB SERVER (KEEP ALIVE)
// ===============================
app.get("/", (_, res) => {
  res.send("🚀 Bika Store Bot Running");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
