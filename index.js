const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// ===== BOT SETUP =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== ADMIN IDS =====
const ADMIN_CHAT_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",")
  : [];

// ===== DATA STORE =====
const pendingOrders = {};
const paymentOrders = {};
const allUsers = new Set(); // for broadcast

// ===== PRICE LIST =====
const PRICES = {
  MLBB: {
    name: "💎 MLBB Diamonds",
    prices: {
      "86": 1500,
      "172": 3000,
      "257": 4500
    }
  },
  PUBG: {
    name: "🔥 PUBG UC",
    prices: {
      "60": 1800,
      "120": 3500
    }
  }
};

// ===== ORDER ID =====
function generateOrderId() {
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
