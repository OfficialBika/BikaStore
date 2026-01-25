// ===== IMPORTS =====
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// ===== ENV =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMINS = process.env.ADMIN_CHAT_IDS.split(",");

// ===== EXPRESS =====
const app = express();
const PORT = process.env.PORT || 3000;

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

// ===== DATA =====
const PRICES = {
  MLBB: {
    name: "💎 MLBB Diamonds",
    prices: {
      "86": 1500,
      "172": 3000
    }
  }
};

const temp = {};
const isAdmin = (id) => ADMINS.includes(id.toString());
const oid = () => `BKS-${Date.now().toString().slice(-6)}`;

// ===== START =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
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

// ===== CALLBACK =====
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const d = q.data;

  // ===== PRODUCT SELECT =====
  if (PRICES[d]) {
    temp[chatId] = { productKey: d };

    let priceText = "";
    for (let a in PRICES[d].prices) {
      priceText += `${a} → ${PRICES[d].prices[a]} MMK\n`;
    }

    return bot.sendMessage(
      chatId,
      `${PRICES[d].name}\n\n📋 Price List\n${priceText}\n📝 Order format:\nGameID ServerID\nAmount\n\nExample:\n12345678 4321\n86`
    );
  }

  // ===== PAYMENT METHOD =====
  if (d.startsWith("PAY_")) {
    const method = d.replace("PAY_", "");
    const t = temp[chatId];

    const order = await Order.create({
      orderId: oid(),
      chatId,
      user: q.from.first_name,

      gameId: t.gameId,
      serverId: t.serverId,

      product: PRICES[t.productKey].name,
      amount: t.amount,
      price: t.price,
      paymentMethod: method,
      status: "WAITING_PAYMENT"
    });

    return bot.sendMessage(
      chatId,
      `🆔 ${order.orderId}\n🎮 ${order.gameId} (${order.serverId})\n💰 ${order.price} MMK\n💳 ${method}\n\n📸 Payment Screenshot ပို့ပါ`
    );
  }

  // ===== ADMIN APPROVE / REJECT =====
  if (d.startsWith("APPROVE_") || d.startsWith("REJECT_")) {
    if (!isAdmin(chatId)) return;

    const [act, orderId] = d.split("_");
    const status = act === "APPROVE" ? "COMPLETED" : "REJECTED";

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status }
    );

    if (order) {
      bot.sendMessage(order.chatId, `✅ Order ${status}`);
    }
  }
});

// ===== USER TEXT =====
bot.on("message", (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t) return;

  const lines = msg.text.trim().split("\n");
  if (lines.length < 2) {
    return bot.sendMessage(
      chatId,
      "❌ Format မမှန်ပါ\nExample:\n12345678 4321\n86"
    );
  }

  const [gameId, serverId] = lines[0].split(" ");
  const amount = lines[1].trim();

  if (!gameId || !serverId) {
    return bot.sendMessage(chatId, "❌ Game ID / Server ID မမှန်ပါ");
  }

  const price = PRICES[t.productKey].prices[amount];
  if (!price) return bot.sendMessage(chatId, "❌ Amount မမှန်ပါ");

  t.gameId = gameId;
  t.serverId = serverId;
  t.amount = amount;
  t.price = price;

  bot.sendMessage(chatId, "💳 Choose Payment Method", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💜 K Pay", callback_data: "PAY_KPay" }],
        [{ text: "💙 Wave Pay", callback_data: "PAY_WavePay" }]
      ]
    }
  });
});

// ===== PAYMENT SCREENSHOT =====
bot.on("photo", async (msg) => {
  const order = await Order.findOne({
    chatId: msg.chat.id,
    status: "WAITING_PAYMENT"
  });
  if (!order) return;

  ADMINS.forEach(id => {
    bot.sendPhoto(id, msg.photo.at(-1).file_id, {
      caption:
`🆔 ${order.orderId}
🎮 ${order.gameId} (${order.serverId})
💰 ${order.price} MMK
💳 ${order.paymentMethod}`,
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
          { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
        ]]
      }
    });
  });

  bot.sendMessage(msg.chat.id, "⏳ Admin စစ်ဆေးနေပါတယ်...");
});

// ===== ADMIN: ORDERS =====
bot.onText(/\/orders/, async (msg) => {
  if (!isAdmin(msg.chat.id)) return;

  const orders = await Order.find().sort({ createdAt: -1 }).limit(10);
  let text = "📋 Last Orders\n\n";

  orders.forEach(o => {
    text += `${o.orderId} | ${o.price} | ${o.status}\n`;
  });

  bot.sendMessage(msg.chat.id, text);
});

// ===== ADMIN: REPORT =====
bot.onText(/\/report/, async (msg) => {
  if (!isAdmin(msg.chat.id)) return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const orders = await Order.find({
    status: "COMPLETED",
    createdAt: { $gte: start }
  });

  const total = orders.reduce((s, o) => s + o.price, 0);
  bot.sendMessage(
    msg.chat.id,
    `📊 Today Report\nOrders: ${orders.length}\nTotal: ${total} MMK`
  );
});

// ===== WEB (RENDER KEEP ALIVE) =====
app.get("/", (_, res) => res.send("Bot Running"));

// ===== WEB ROUTE (UptimeRobot အတွက်) =====
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log("Server running");
});
