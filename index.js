// ===== IMPORTS =====
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// ===== PAYMENT ACCOUNTS =====
const PAYMENT_ACCOUNTS = {
  KPay: {
    name: "💜 KPay",
    account: "09264202647 (Shine Htet Aung)"
  },
  WavePay: {
    name: "💙 WavePay",
    account: "09264202647 (Shine Htet Aung"
  }
};

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
    { chatId, firstName: msg.from.first_name, username: msg.from.username },
    { upsert: true }
  );

  bot.sendMessage(chatId, "🛒 *Bika Store*\n\nကုန်ပစ္စည်းရွေးပါ 👇", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }]
      ]
    }
  });
});

// ===== CALLBACK QUERY =====
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const d = q.data;

  // ===== ADMIN APPROVE / REJECT =====
  if (d.startsWith("APPROVE_") || d.startsWith("REJECT_")) {
    if (!isAdmin(chatId)) return;

    const [action, orderId] = d.split("_");
    const status = action === "APPROVE" ? "COMPLETED" : "REJECTED";

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );

    if (!order) {
      return bot.sendMessage(chatId, "❌ Order မတွေ့ပါ");
    }

    await bot.sendMessage(
      chatId,
      status === "COMPLETED"
        ? `✅ Order ${orderId} ပြီးဆုံး`
        : `❌ Order ${orderId} ငြင်းပယ်ပြီးပါပြီ`
    );

    await bot.sendMessage(
      order.chatId,
      status === "COMPLETED"
        ? "✅ Order အောင်မြင်စွာ ပြီးဆုံးပါပြီ"
        : "❌ Order ကို ငြင်းပယ်လိုက်ပါသည်"
    );
    return;
  }

  // ===== PAYMENT METHOD =====
  if (d === "PAY_KPAY" || d === "PAY_WAVEPAY") {
    const t = temp[chatId];
    if (!t) return bot.sendMessage(chatId, "❌ Session မရှိပါ");

    const paymentMethod = d === "PAY_KPAY" ? "KPay" : "WavePay";
    const orderId = oid();

    await Order.create({
      orderId,
      chatId: chatId.toString(),
      user: q.from.username ? `@${q.from.username}` : q.from.first_name,
      gameId: t.gameId,
      serverId: t.serverId,
      product: t.productKey,
      amount: t.amount,
      price: t.price,
      paymentMethod,
      status: "WAITING_PAYMENT"
    });

    delete temp[chatId];

    return bot.sendMessage(chatId,
`🧾 *Order Created*

🆔 ${orderId}
💎 ${t.amount} Diamonds
💰 ${t.price} MMK
💳 ${paymentMethod}

📸 Screenshot ပို့ပေးပါ`,
      { parse_mode: "Markdown" }
    );
  }

  // ===== PRODUCT SELECT =====
  if (PRICES[d]) {
    temp[chatId] = { productKey: d };

    let priceText = "";
    for (let a in PRICES[d].prices) {
      priceText += `${a} → ${PRICES[d].prices[a]} MMK\n`;
    }

    return bot.sendMessage(chatId,
`📝 *Order Form*

${PRICES[d].name}

${priceText}

ID ServerID
Amount`,
      { parse_mode: "Markdown", reply_markup: { force_reply: true } }
    );
  }
}); 
// callback quary end

// ===== USER FORM INPUT =====
bot.on("message", (msg) => {
  if (!msg.text || !msg.reply_to_message) return;

  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t) return;

  const [idLine, amount] = msg.text.split("\n");
  const [gameId, serverId] = idLine.split(" ");

  const price = PRICES[t.productKey].prices[amount];
  if (!price) return bot.sendMessage(chatId, "❌ Amount မမှန်ပါ");

  Object.assign(t, { gameId, serverId, amount, price });

  bot.sendMessage(chatId,
`💳 Payment Method`,
   bot.sendMessage(
  chatId,
`💳 *Payment Method ရွေးပါ*

${PAYMENT_ACCOUNTS.KPay.name}
Account: ${PAYMENT_ACCOUNTS.KPay.account}

${PAYMENT_ACCOUNTS.WavePay.name}
Account: ${PAYMENT_ACCOUNTS.WavePay.account}`,
  {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: PAYMENT_ACCOUNTS.KPay.name, callback_data: "PAY_KPAY" }],
        [{ text: PAYMENT_ACCOUNTS.WavePay.name, callback_data: "PAY_WAVEPAY" }]
      ]
    }
  }
);
});

// ===== PAYMENT SCREENSHOT =====
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;

  const order = await Order.findOne({
    chatId: chatId.toString(),
    status: "WAITING_PAYMENT"
  });

  if (!order) return bot.sendMessage(chatId, "❌ Pending order မရှိပါ");

  const photoId = msg.photo.pop().file_id;

  await bot.sendPhoto(ADMIN_ID, photoId, {
    caption:
`🆔 ${order.orderId}
👤 ${order.user}
💎 ${order.amount}
💰 ${order.price} MMK`,
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
        { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
      ]]
    }
  });

  bot.sendMessage(chatId, "⏳ Admin စစ်ဆေးနေပါတယ်...");
});

// ===== WEB =====
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(PORT, () => console.log("Server running"));
