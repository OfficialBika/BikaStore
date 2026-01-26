// ===============================
// IMPORTS & SETUP
// ===============================
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 3000;

const app = express();

// ===============================
// DATABASE
// ===============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(console.error);

// ===============================
// PRICE LIST (FULL)
// ===============================
const PRICES = {
  MLBB: {
    "wp": 5900,
    "wp2": 11800,
    "wp3": 17700,
    "wp4": 23600,
    "wp5": 29500,
    "86": 4800,
    "172": 9800,
    "257": 14500,
    "343": 20000,
    "429": 25000,
    "514": 29900,
    "600": 34500,
    "706": 39900,
    "792": 44500,
    "878": 48500,
    "963": 53000,
    "1049": 59900
  },
  PUBG: {
    "60": 4500,
    "325": 19500,
    "660": 38000,
    "1800": 90500,
    "3850": 185000,
    "8100": 363000
  }
};

// ===============================
// ORDER SCHEMA (TTL)
// ===============================
const OrderSchema = new mongoose.Schema({
  userId: String,
  username: String,

  product: String,
  gameId: String,
  serverId: String,

  items: [{ amount: String, price: Number }],
  totalPrice: Number,

  paymentPhoto: String,
  adminMsgId: Number,

  status: {
    type: String,
    default: "PENDING" // PENDING | COMPLETED | REJECTED
  },

  createdAt: { type: Date, default: Date.now },
  approvedAt: Date,

  expireAt: Date
});

OrderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
const Order = mongoose.model("Order", OrderSchema);

// ===============================
// TEMP SESSION
// ===============================
const temp = {};

// ===============================
// /start
// ===============================
bot.onText(/\/start/, msg => {
  bot.sendMessage(
    msg.chat.id,
    "🛒 *Bika Store*\n\nဝယ်ချင်တဲ့ ဂိမ်းကို ရွေးပါ 👇",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }],
          [{ text: "🎯 PUBG UC", callback_data: "PUBG" }]
        ]
      }
    }
  );
});

// ===============================
// CALLBACK QUERY
// ===============================
bot.on("callback_query", async q => {
  const chatId = q.message.chat.id;
  const d = q.data;
  const t = temp[chatId];

  // ---------- PRODUCT SELECT ----------
  if (d === "MLBB") {
    temp[chatId] = { product: "MLBB", step: "GAME", items: [] };
    return bot.sendMessage(
      chatId,
      "🆔 *Game ID + Server ID ကို တစ်ခါတည်း ထည့်ပါ*\n\nဥပမာ:\n486679424 2463\n486679424(2463)",
      { parse_mode: "Markdown" }
    );
  }

  if (d === "PUBG") {
    temp[chatId] = { product: "PUBG", step: "GAME", items: [] };
    return bot.sendMessage(chatId, "🆔 *PUBG Game ID ကို ထည့်ပါ*", {
      parse_mode: "Markdown"
    });
  }

  // ---------- CONFIRM ----------
  if (d === "CONFIRM" && t) {
    await bot.deleteMessage(chatId, t.previewMsgId);
    t.step = "PAYMENT";
    return bot.sendMessage(
      chatId,
      "💸 *ငွေလွှဲပြေစာကို ဓာတ်ပုံနဲ့ ပို့ပါ*",
      { parse_mode: "Markdown" }
    );
  }

  // ---------- CANCEL ----------
  if (d === "CANCEL") {
    delete temp[chatId];
    return bot.sendMessage(chatId, "❌ Order ကို ဖျက်လိုက်ပါပြီ");
  }

  // ---------- ADMIN APPROVE ----------
  if (d.startsWith("APPROVE_")) {
    const orderId = d.split("_")[1];
    const order = await Order.findById(orderId);
    if (!order) return;

    order.status = "COMPLETED";
    order.approvedAt = new Date();
    await order.save();

    await bot.editMessageCaption(
`📦 ORDER COMPLETED ✅

🎮 ${order.product}
🆔 ${order.gameId} (${order.serverId})
💰 ${order.totalPrice.toLocaleString()} MMK

✅ ဒီ Order လုပ်ဆောင်မှု ပြီးမြောက်သွားပါပြီ`,
      {
        chat_id: ADMIN_ID,
        message_id: order.adminMsgId
      }
    );

    await bot.sendPhoto(order.userId, order.paymentPhoto, {
      caption:
`📦 Order Completed ✅

🎮 ${order.product}
🆔 ${order.gameId} (${order.serverId})
💰 ${order.totalPrice.toLocaleString()} MMK

🙏 ကျေးဇူးတင်ပါတယ်`
    });
  }
});

// ===============================
// MESSAGE FLOW
// ===============================
bot.on("message", async msg => {
  if (!msg.text) return;
  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t) return;

  // ---------- GAME STEP ----------
  if (t.step === "GAME") {
    if (t.product === "MLBB") {
      const m = msg.text.match(/^(\d+)\s*\(?(\d+)\)?$/);
      if (!m) return bot.sendMessage(chatId, "❌ Format မမှန်ပါ");

      t.gameId = m[1];
      t.serverId = m[2];
    } else {
      t.gameId = msg.text.trim();
      t.serverId = "-";
    }

    t.step = "ITEMS";
    return bot.sendMessage(chatId, "🛒 Amount ထည့်ပါ (ဥပမာ: 86+343)");
  }

  // ---------- ITEMS ----------
  if (t.step === "ITEMS") {
    const arr = msg.text.split("+");
    let total = 0;
    t.items = [];

    for (const a of arr) {
      const price = PRICES[t.product][a];
      if (!price) return bot.sendMessage(chatId, `❌ ${a} မမှန်ပါ`);

      t.items.push({ amount: a, price });
      total += price;
    }

    t.totalPrice = total;
    t.step = "PREVIEW";

    const preview = await bot.sendMessage(
      chatId,
`━━━━━━━━━━━━━━━
📦 Order Preview
━━━━━━━━━━━━━━━
🎮 ${t.product}
🆔 ${t.gameId}
🌐 ${t.serverId}

🛒 Items:
${t.items.map(i => `• ${i.amount} — ${i.price.toLocaleString()} MMK`).join("\n")}

💰 Total : ${total.toLocaleString()} MMK
━━━━━━━━━━━━━━━`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Confirm", callback_data: "CONFIRM" }],
            [{ text: "❌ Cancel", callback_data: "CANCEL" }]
          ]
        }
      }
    );

    t.previewMsgId = preview.message_id;
  }
});

// ===============================
// PAYMENT PHOTO
// ===============================
bot.on("photo", async msg => {
  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t || t.step !== "PAYMENT") return;

  const fileId = msg.photo.at(-1).file_id;

  const order = await Order.create({
    userId: chatId.toString(),
    username: msg.from.username || msg.from.first_name,
    product: t.product,
    gameId: t.gameId,
    serverId: t.serverId,
    items: t.items,
    totalPrice: t.totalPrice,
    paymentPhoto: fileId,
    status: "PENDING",
    expireAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  });

  const adminMsg = await bot.sendPhoto(
    ADMIN_ID,
    fileId,
    {
      caption:
`📦 NEW ORDER
━━━━━━━━━━━━━━━
👤 ${order.username}
🎮 ${order.product}
🆔 ${order.gameId} (${order.serverId})
💰 ${order.totalPrice.toLocaleString()} MMK`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Approve", callback_data: `APPROVE_${order._id}` }]
        ]
      }
    }
  );

  order.adminMsgId = adminMsg.message_id;
  await order.save();

  delete temp[chatId];
  bot.sendMessage(chatId, "⏳ Admin စစ်ဆေးနေပါသည်...");
});

// ===============================
// WEB SERVER (RENDER)
// ===============================
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(PORT, () => console.log("Server Running"));
