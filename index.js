// ===== IMPORTS =====
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");
const PAYMENT_ACCOUNTS = {
  KPay: {
    name: "💜 KPay",
    account: "09xxxxxxxx (Aung Aung)"
  },
  WavePay: {
    name: "💙 WavePay",
    account: "09yyyyyyyy (Mg Mg)"
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

// ====== CALLBACK QUERY MAIN POINT ======
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
    { status }
  );

  if (!order) {
    return bot.sendMessage(chatId, "❌ Order မတွေ့ပါ");
  }


  // ✅ Admin chat မှာ confirm message
  bot.sendMessage(
    chatId,
    status === "COMPLETED"
      ? `✅ Order ${order.orderId} အောင်မြင်စွာ ပြီးဆုံးပါပြီ`
      : `❌ Order ${order.orderId} ကို ငြင်းပယ်ခြင်းပြီးဆုံးပါပြီ`
  );
}
 
  if (PRICES[d]) {
  temp[chatId] = { productKey: d };

  let priceText = "";
  for (let a in PRICES[d].prices) {
    priceText += `${a} → ${PRICES[d].prices[a]} MMK\n`;
  }


  
  
  return bot.sendMessage(
    chatId,
`📝 *Order Form* (reply ပြန်ရေးပါ)

${PRICES[d].name}

📋 Price List
${priceText}

ID / Server ID:
Amount:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        force_reply: true
      }
    }
  );
}

// ===== USER TEXT INPUT (ORDER FORM) =====
bot.on("message", (msg) => {
  if (!msg.text) return;
  if (msg.text.startsWith("/")) return;
  if (!msg.reply_to_message) return;

  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t || !t.productKey) return;

  const lines = msg.text.trim().split("\n");
  if (lines.length < 2) {
    return bot.sendMessage(
      chatId,
      "❌ Format မမှန်ပါ\n\nExample:\n12345678 4321\n86"
    );
  }

  const [gameId, serverId] = lines[0].trim().split(" ");
  const amount = lines[1].trim();

  if (!gameId || !serverId) {
    return bot.sendMessage(chatId, "❌ Game ID / Server ID မမှန်ပါ");
  }

  const price = PRICES[t.productKey].prices[amount];
  if (!price) {
    return bot.sendMessage(chatId, "❌ Amount မမှန်ပါ");
  }

  // save temp
  t.gameId = gameId;
  t.serverId = serverId;
  t.amount = amount;
  t.price = price;

  bot.sendMessage(
    chatId,
`💳 *Payment Method ရွေးပါ*

💜 KPay  
Account: 09XXXXXXXX

💙 WavePay  
Account: 09YYYYYYYY`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💜 KPay", callback_data: "PAY_KPAY" }],
          [{ text: "💙 WavePay", callback_data: "PAY_WAVEPAY" }]
        ]
      }
    }
  );
});
}); // callback query close 

  
// ===== PAYMENT SCREENSHOT =====
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;

  // user ရဲ့ waiting order ကိုရှာ
  const order = await Order.findOne({
    chatId: chatId.toString(),
    status: "WAITING_PAYMENT"
  });

  if (!order) {
    return bot.sendMessage(chatId, "❌ Pending order မရှိပါ");
  }

  const photoId = msg.photo[msg.photo.length - 1].file_id;

  // Admin ဆီပို့မယ့် caption
  const caption =
`📥 *New Payment Screenshot*

🆔 Order ID: ${order.orderId}
👤 User: ${order.user}

🎮 Game ID: ${order.gameId}
🖥 Server ID: ${order.serverId}

💎 Amount: ${order.amount}
💰 Price: ${order.price} MMK
💳 Payment: ${order.paymentMethod}
`;

  // Admin ဆီပို့
  await bot.sendPhoto(
    ADMIN_ID,
    photoId,
    {
      caption,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
          { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
        ]]
      }
    }
  );

  bot.sendMessage(chatId, "⏳ Admin စစ်ဆေးနေပါတယ် ခနစောင့်ပေးပါ...");
});

// ✅ User ကို message
  bot.sendMessage(
    order.chatId,
    status === "COMPLETED"
      ? "✅ Order အောင်မြင်စွာ ပြီးဆုံးပါပြီ"
      : "❌ Order ကို ငြင်းပယ်လိုက်ပါသည်"
  );

  

// ===== WEB =====
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(PORT, () => console.log("Server running"));
