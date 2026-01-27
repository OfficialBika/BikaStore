// ===============================
// BIKA STORE — MAIN ENTRY (index.js)
// ===============================

// Core
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// Handlers
const registerCommands = require("./handlers/commands");
const registerCallbacks = require("./handlers/callbacks");
const userHandlers = require("./handlers/user");
const adminHandlers = require("./handlers/admin");

// ===============================
// BOT & SERVER SETUP
// ===============================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// ADMIN IDS
// ===============================
const ADMIN_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",")
  : [];

// ===============================
// DATABASE
// ===============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error", err));

// ===============================
// GLOBAL CONTEXT (shared)
// ===============================
const context = {
  bot,
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
// USER MESSAGE HANDLERS
// ===============================
bot.on("message", async msg => {
  await userHandlers.onMessage({ ...context, msg });
});

// ===============================
// PAYMENT PHOTO HANDLER
// ===============================
bot.on("photo", async msg => {
  await userHandlers.onPaymentPhoto({ ...context, msg });
});

// ===============================
// ADMIN MESSAGE HANDLERS (optional)
// ===============================
bot.on("message", async msg => {
  if (!ADMIN_IDS.includes(msg.from?.id?.toString())) return;
  await adminHandlers.onMessage({ ...context, msg });
});

// ===============================
// WEB SERVER (Render / Railway keep-alive)
// ===============================
app.get("/", (_, res) => res.send("🚀 Bika Store Bot Running"));
app.listen(PORT, () => console.log("🌐 Server Running on", PORT));
