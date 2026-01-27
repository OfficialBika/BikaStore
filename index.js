// ===============================
// BIKA STORE — MAIN ENTRY (index.js)
// ===============================

// Core //
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");
const commands  = require("./commands");
const callbacks = require("./callbacks");
const admin     = require("./admin");
const user      = require("./user");
const Order = require("./models/order");

//MONGO DB//

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));


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
