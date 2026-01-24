const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMINS = process.env.ADMIN_CHAT_IDS.split(",");

// ===== DB =====
mongoose.connect(process.env.MONGO_URI);

// ===== SCHEMA =====
const Order = mongoose.model("Order", new mongoose.Schema({
  orderId: String,
  chatId: String,
  user: String,
  product: String,
  amount: String,
  price: Number,
  paymentMethod: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
}));

// ===== PRICE =====
const PRICES = {
  MLBB: { name: "💎 MLBB Diamonds", prices: { "86": 1500, "172": 3000 } }
};

// ===== TEMP =====
const temp = {};

// ===== UTILS =====
const oid = () => `BKS-${Date.now().toString().slice(-6)}`;
const isAdmin = (id) => ADMINS.includes(id.toString());

// ===== START =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🛒 Select Product", {
    reply_markup: {
      inline_keyboard: [[{ text: "💎 MLBB", callback_data: "MLBB" }]]
    }
  });
});

// ===== PRODUCT =====
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const d = q.data;

  // PRODUCT
  if (PRICES[d]) {
    temp[chatId] = { productKey: d };
    let p = "";
    for (let a in PRICES[d].prices) p += `${a} → ${PRICES[d].prices[a]} MMK\n`;
    return bot.sendMessage(chatId, `${PRICES[d].name}\n\n${p}\nSend amount`);
  }

  // PAYMENT METHOD
  if (d.startsWith("PAY_")) {
    const method = d.replace("PAY_", "");
    temp[chatId].paymentMethod = method;

    const o = await Order.create({
      orderId: oid(),
      chatId,
      user: q.from.first_name,
      product: PRICES[temp[chatId].productKey].name,
      amount: temp[chatId].amount,
      price: temp[chatId].price,
      paymentMethod: method,
      status: "WAITING_PAYMENT"
    });

    return bot.sendMessage(
      chatId,
      `🆔 ${o.orderId}\n💰 ${o.price} MMK\n💳 ${method}\n📸 Send Screenshot`
    );
  }

  // ADMIN INLINE
  if (d.startsWith("APPROVE_") || d.startsWith("REJECT_")) {
    if (!isAdmin(chatId)) return;

    const action = d.split("_")[0];
    const orderId = d.split("_")[1];

    const status = action === "APPROVE" ? "COMPLETED" : "REJECTED";
    const order = await Order.findOneAndUpdate(
      { orderId },
      { status }
    );

    if (order) {
      bot.sendMessage(order.chatId, `✅ Order ${status}`);
      bot.editMessageCaption(
        `🆔 ${orderId}\n✅ ${status}`,
        { chat_id: chatId, message_id: q.message.message_id }
      );
    }
  }
});

// ===== USER TEXT =====
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const chatId = msg.chat.id;
  if (!temp[chatId]) return;

  const price = PRICES[temp[chatId].productKey].prices[msg.text];
  if (!price) return bot.sendMessage(chatId, "❌ Invalid amount");

  temp[chatId].amount = msg.text;
  temp[chatId].price = price;

  bot.sendMessage(chatId, "💳 Choose Payment Method", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💜 K Pay", callback_data: "PAY_KPay" }],
        [{ text: "💙 Wave Pay", callback_data: "PAY_WavePay" }]
      ]
    }
  });
});

// ===== SCREENSHOT =====
bot.on("photo", async (msg) => {
  const order = await Order.findOne({
    chatId: msg.chat.id,
    status: "WAITING_PAYMENT"
  });
  if (!order) return;

  ADMINS.forEach(id => {
    bot.sendPhoto(id, msg.photo.at(-1).file_id, {
      caption:
        `🆔 ${order.orderId}\n💰 ${order.price} MMK\n💳 ${order.paymentMethod}`,
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
          { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
        ]]
      }
    });
  });

  bot.sendMessage(msg.chat.id, "⏳ Admin checking...");
});

// ===== ADMIN: ORDER LIST =====
bot.onText(/\/orders/, async (msg) => {
  if (!isAdmin(msg.chat.id)) return;
  const orders = await Order.find().sort({ createdAt: -1 }).limit(10);

  let text = "📋 *Last Orders*\n\n";
  orders.forEach(o => {
    text += `🆔 ${o.orderId}\n💰 ${o.price} MMK\n📦 ${o.status}\n\n`;
  });

  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// ===== ADMIN: DAILY REPORT =====
bot.onText(/\/report/, async (msg) => {
  if (!isAdmin(msg.chat.id)) return;

  const start = new Date();
  start.setHours(0,0,0,0);

  const orders = await Order.find({
    status: "COMPLETED",
    createdAt: { $gte: start }
  });

  const total = orders.reduce((s,o)=>s+o.price,0);

  bot.sendMessage(
    msg.chat.id,
    `📊 *Today Report*\nOrders: ${orders.length}\nTotal: ${total} MMK`,
    { parse_mode: "Markdown" }
  );
});

// ===== WEB =====
const app = express();
app.get("/", (_,res)=>res.send("Bot Running"));
app.listen(3000);function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BKS-${date}-${rand}`;
}

// ===== /start =====
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  allUsers.add(chatId);

  bot.sendMessage(
    chatId,
    "🛒 *Bika Store Product Menu*\n\nကုန်ပစ္စည်းရွေးပါ 👇",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 MLBB Diamonds", callback_data: "PRODUCT_MLBB" }],
          [{ text: "🔥 PUBG UC", callback_data: "PRODUCT_PUBG" }]
        ]
      }
    }
  );
});

// ===== CALLBACK HANDLER =====
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // ===== PRODUCT SELECT =====
  if (data.startsWith("PRODUCT_")) {
    const productKey = data.replace("PRODUCT_", "");
    const product = PRICES[productKey];

    pendingOrders[chatId] = {
      productKey,
      status: "INPUT"
    };

    let priceText = "";
    for (let amt in product.prices) {
      priceText += `• ${amt} → ${product.prices[amt]} MMK\n`;
    }

    bot.sendMessage(
      chatId,
      `*${product.name}*\n\n📋 Price List:\n${priceText}\n📝 Order format:\nID + Server\nAmount`,
      { parse_mode: "Markdown" }
    );

    return bot.answerCallbackQuery(query.id);
  }

  // ===== CONFIRM ORDER (USER) =====
  if (data === "CONFIRM_ORDER") {
    const order = pendingOrders[chatId];
    if (!order) return;

    order.status = "WAITING_PAYMENT";
    paymentOrders[order.orderId] = order;

    bot.sendMessage(
      chatId,
      `✅ *Order Confirmed*\n\n🆔 ${order.orderId}\n💰 ${order.price} MMK\n\n📸 Payment Screenshot ပို့ပါ`,
      { parse_mode: "Markdown" }
    );

    ADMIN_CHAT_IDS.forEach((admin) => {
      bot.sendMessage(
        admin.trim(),
        `🚨 *New Order*\n\n🆔 ${order.orderId}\n👤 ${order.user}\n💰 ${order.price} MMK`,
        { parse_mode: "Markdown" }
      );
    });

    return bot.answerCallbackQuery(query.id);
  }

  // ===== CANCEL =====
  if (data === "CANCEL_ORDER") {
    delete pendingOrders[chatId];
    bot.sendMessage(chatId, "❌ Order Cancelled");
    return bot.answerCallbackQuery(query.id);
  }
});

// ===== TEXT MESSAGE =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  allUsers.add(chatId);

  if (!msg.text || msg.text.startsWith("/")) return;

  const order = pendingOrders[chatId];
  if (!order || order.status !== "INPUT") {
    return bot.sendMessage(chatId, "❗ အရင် Product ကိုရွေးပါ");
  }

  const lines = msg.text.split("\n");
  const amount = lines[lines.length - 1].trim();
  const productData = PRICES[order.productKey];

  if (!productData.prices[amount]) {
    return bot.sendMessage(chatId, "❌ Amount မမှန်ပါ");
  }

  const orderId = generateOrderId();
  const price = productData.prices[amount];

  pendingOrders[chatId] = {
    orderId,
    product: productData.name,
    price,
    text: msg.text,
    user: msg.from.first_name,
    chatId,
    status: "PREVIEW"
  };

  bot.sendMessage(
    chatId,
    `🧾 *Order Preview*\n\n🆔 ${orderId}\n📦 ${productData.name}\n💰 ${price} MMK\n\n${msg.text}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: "CONFIRM_ORDER" },
            { text: "❌ Cancel", callback_data: "CANCEL_ORDER" }
          ]
        ]
      }
    }
  );
});

// ===== PAYMENT SCREENSHOT =====
bot.on("photo", (msg) => {
  const chatId = msg.chat.id;
  const order = pendingOrders[chatId];
  if (!order || order.status !== "WAITING_PAYMENT") return;

  const photoId = msg.photo[msg.photo.length - 1].file_id;

  ADMIN_CHAT_IDS.forEach((admin) => {
    bot.sendPhoto(admin.trim(), photoId, {
      caption:
        `💰 *Payment Received*\n\n🆔 ${order.orderId}\n\n/admin confirm ${order.orderId}`,
      parse_mode: "Markdown"
    });
  });

  bot.sendMessage(chatId, "⏳ Payment received. Admin စစ်ဆေးနေပါတယ်");
});

// ===== ADMIN: CONFIRM ORDER =====
bot.onText(/\/confirm (.+)/, (msg, match) => {
  const adminId = msg.chat.id.toString();
  if (!ADMIN_CHAT_IDS.includes(adminId)) return;

  const orderId = match[1];
  const order = paymentOrders[orderId];
  if (!order) return bot.sendMessage(adminId, "❌ Order မတွေ့ပါ");

  bot.sendMessage(order.chatId, `🎉 *Order Completed*\n🆔 ${orderId}`, {
    parse_mode: "Markdown"
  });

  delete paymentOrders[orderId];
});

// ===== ADMIN: BROADCAST =====
bot.onText(/\/broadcast (.+)/, (msg, match) => {
  const adminId = msg.chat.id.toString();
  if (!ADMIN_CHAT_IDS.includes(adminId)) return;

  const message = match[1];
  let sent = 0;

  allUsers.forEach((uid) => {
    bot.sendMessage(uid, `📢 *Announcement*\n\n${message}`, {
      parse_mode: "Markdown"
    }).then(() => sent++).catch(() => {});
  });

  bot.sendMessage(adminId, `✅ Broadcast sent to ${sent} users`);
});

// ===== WEB SERVICE =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bika Store Bot Running"));
app.listen(PORT, () => console.log("Server running on", PORT));
