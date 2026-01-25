// ===== IMPORTS =====
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// ===== ENV =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;

// ===== ADMIN CHECK =====
const isAdmin = (chatId) => chatId.toString() === ADMIN_ID;

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
    "🛒 *Bika Store*\n\nကုန်ပစ္စည်းရွေးပါ 👇",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }]
        ]
      }
    }
  );
});

// ===== BROADCAST (ADMIN ONLY) =====
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Admin only command");
  }

  const users = await User.find().select("chatId");
  const text = match[1];

  let success = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await bot.sendMessage(u.chatId, text);
      success++;
    } catch {
      failed++;
    }
  }

  bot.sendMessage(
    msg.chat.id,
    `✅ Broadcast Finished\n👥 Total: ${users.length}\n📬 Success: ${success}\n❌ Failed: ${failed}`
  );
});

// ===== CALLBACK =====
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const d = q.data;

  if (PRICES[d]) {
    temp[chatId] = { productKey: d };

    let priceText = "";
    for (let a in PRICES[d].prices) {
      priceText += `${a} → ${PRICES[d].prices[a]} MMK\n`;
    }

    return bot.sendMessage(
      chatId,
      `${PRICES[d].name}\n\n${priceText}\nGameID ServerID\nAmount`
    );
  }
});

// ===== WEB =====
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(PORT, () => console.log("Server running"));
