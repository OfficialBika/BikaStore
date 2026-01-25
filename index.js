// ===== IMPORTS =====
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// ===== ENV =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID; // single admin
const PORT = process.env.PORT || 3000;

// ===== ADMIN CHECK =====
const isAdmin = (id) => id.toString() === ADMIN_ID;

// ===== EXPRESS =====
const app = express();

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// ===== SCHEMA =====
const Order = mongoose.model("Order", new mongoose.Schema({
  orderId: String,
  chatId: String,
  user: String,
  gameId: String,
  serverId: String,
  product: String,
  amount: String,
  price: Number,
  paymentMethod: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
}));

const User = mongoose.model("User", new mongoose.Schema({
  chatId: { type: String, unique: true },
  firstName: String,
  username: String,
  createdAt: { type: Date, default: Date.now }
}));

// ===== DATA =====
const PRICES = {
  MLBB: {
    name: "💎 MLBB Diamonds",
    prices: { "86": 1500, "172": 3000 }
  }
};

const temp = {};
const oid = () => `BKS-${Date.now().toString().slice(-6)}`;

// ===== START =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString();

  await User.updateOne(
    { chatId },
    {
      chatId,
      firstName: msg.from.first_name,
      username: msg.from.username
    },
    { upsert: true }
  );

  bot.sendMessage(
    chatId,
    "👋 *Bika Store*\nကုန်ပစ္စည်းရွေးပါ 👇",
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [[{ text: "/orders" }]],
        resize_keyboard: true,
        inline_keyboard: [
          [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }]
        ]
      }
    }
  );
});

// ===== BROADCAST (ADMIN ONLY) =====
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, "⛔ Admin only command");
  }

  const text = match[1];
  const users = await User.find().select("chatId");

  let success = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await bot.sendMessage(
        u.chatId,
        `📢 *Announcement*\n\n${text}`,
        { parse_mode: "Markdown" }
      );
      success++;
    } catch {
      failed++;
    }
  }

  bot.sendMessage(
    chatId,
    `✅ *Broadcast Finished*\n\n👥 Total: ${users.length}\n📬 Success: ${success}\n❌ Failed: ${failed}`,
    { parse_mode: "Markdown" }
  );
});

// ===== KEEP ALIVE =====
app.get("/", (_, res) => res.send("Bot Running"));

app.listen(PORT, () => {
  console.log("Server running");
});
