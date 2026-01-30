// ===================================
// BIKA STORE — FINAL SINGLE FILE BOT
// RENDER SAFE (POLLING MODE)
// ===================================

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

const ADMIN_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",").map(x => x.trim())
  : [];

if (!BOT_TOKEN || !MONGO_URI) {
  console.error("❌ Missing ENV");
  process.exit(1);
}

// ===== DB =====
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error", err));

// ===== ORDER MODEL =====
const OrderSchema = new mongoose.Schema({
  orderId: String,
  userId: String,
  username: String,
  game: String,
  gameId: String,
  amount: String,
  totalPrice: Number,
  paymentMethod: String,
  screenshot: String,
  status: { type: String, default: "PENDING" }
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);

// ===== BOT (POLLING) =====
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ===== EXPRESS (KEEP ALIVE) =====
const app = express();
app.get("/", (_, res) => res.send("🚀 Bika Store Bot Running"));
app.listen(PORT, () => console.log("🌐 Server running"));

// ===== SESSION =====
const session = {};

const isAdmin = id => ADMIN_IDS.includes(String(id));
const genOrderId = () => "BKS-" + Date.now().toString().slice(-6);

// ===== START =====
bot.onText(/\/start/, msg => {
  session[msg.chat.id] = {};
  bot.sendMessage(
    msg.chat.id,
    "👋 Welcome to *BIKA STORE*\n\nGame ID ကို ပို့ပါ",
    { parse_mode: "Markdown" }
  );
});

// ===== USER FLOW =====
bot.on("message", msg => {
  if (!msg.text) return;

  const chatId = msg.chat.id;
  if (isAdmin(chatId)) return;

  const s = session[chatId] ||= {};

  if (!s.gameId) {
    s.game = "MLBB";
    s.gameId = msg.text;
    return bot.sendMessage(chatId, "💎 Diamonds amount ပို့ပါ (ဥပမာ: 86)");
  }

  if (!s.amount) {
    s.amount = msg.text;
    s.totalPrice = Number(msg.text) * 100;
    return bot.sendMessage(chatId, "💳 Payment Method ရွေးပါ", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💜 KPay", callback_data: "PAY:KPay" }],
          [{ text: "💙 WavePay", callback_data: "PAY:WavePay" }]
        ]
      }
    });
  }
});

// ===== CALLBACKS =====
bot.on("callback_query", async q => {
  const chatId = q.message.chat.id;
  const data = q.data;

  if (data.startsWith("PAY:")) {
    const s = session[chatId];
    if (!s) return;

    s.paymentMethod = data.split(":")[1];
    s.orderId = genOrderId();

    return bot.sendMessage(
      chatId,
      `📸 Screenshot ပို့ပါ\n\n🆔 Order ID: ${s.orderId}`
    );
  }

  if (data.startsWith("APPROVE_") || data.startsWith("REJECT_")) {
    const orderId = data.split("_")[1];
    const status = data.startsWith("APPROVE") ? "COMPLETED" : "REJECTED";

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );
    if (!order) return;

    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: q.message.chat.id, message_id: q.message.message_id }
    );

    await bot.sendMessage(
      order.userId,
      status === "COMPLETED"
        ? "✅ Order Completed — Thank you!"
        : "❌ Order Rejected"
    );
  }
});

// ===== SCREENSHOT =====
bot.on("photo", async msg => {
  const chatId = msg.chat.id;
  const s = session[chatId];
  if (!s || !s.orderId) return;

  const fileId = msg.photo.at(-1).file_id;

  const order = await Order.create({
    orderId: s.orderId,
    userId: chatId,
    username: msg.from.username,
    game: s.game,
    gameId: s.gameId,
    amount: s.amount,
    totalPrice: s.totalPrice,
    paymentMethod: s.paymentMethod,
    screenshot: fileId
  });

  for (const admin of ADMIN_IDS) {
    await bot.sendPhoto(admin, fileId, {
      caption:
        `📦 NEW ORDER\n🆔 ${order.orderId}\n🎮 ${order.game}\nID: ${order.gameId}\n💎 ${order.amount}\n💰 ${order.totalPrice} MMK`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
            { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
          ]
        ]
      }
    });
  }

  delete session[chatId];
  bot.sendMessage(chatId, "⏳ Admin စစ်ဆေးနေပါသည်...");
});
