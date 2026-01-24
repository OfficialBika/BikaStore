const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

// ===== BOT SETUP =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== DATA STORE =====
const pendingOrders = {};

// ===== ADMIN IDS =====
const ADMIN_CHAT_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",")
  : [];

// ===== ORDER ID =====
function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BKS-${date}-${rand}`;
}

// ===== /start =====
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "🛒 *Bika Store Product Menu*\n\nကုန်ပစ္စည်းတစ်ခုကို ရွေးချယ်ပါ 👇",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }],
          [{ text: "🎮 PUBG UC", callback_data: "PUBG" }],
          [{ text: "⭐ Telegram Premium", callback_data: "TGPREMIUM" }],
          [{ text: "🌟 Telegram Star", callback_data: "TGSTAR" }],
          [{ text: "🏰 COC", callback_data: "COC" }],
          [{ text: "✂️ CapCut Premium", callback_data: "CAPCUT" }]
        ]
      }
    }
  );
});

// ===== BUTTON HANDLER =====
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  const products = {
    MLBB:
      "💎 *MLBB Diamonds*\n\n📝 Order format:\n`Game ID + Server`\n`Amount`",
    PUBG:
      "🔥 *PUBG UC*\n\n📝 Order format:\n`Player ID`\n`UC Amount`",
    TGPREMIUM:
      "⭐ *Telegram Premium*\n\n📝 Order format:\n`Username`\n`Duration`",
    TGSTAR:
      "🌟 *Telegram Star*\n\n📝 Order format:\n`Username`\n`Star Amount`",
    COC:
      "🏰 *COC Gems*\n\n📝 Order format:\n`Player Tag`\n`Gem Amount`",
    CAPCUT:
      "✂️ *CapCut Premium*\n\n📝 Order format:\n`Email / Username`\n`Duration`"
  };

  // show product
  if (products[data]) {
    bot.sendMessage(chatId, products[data], { parse_mode: "Markdown" });
    return bot.answerCallbackQuery(query.id);
  }

  // confirm order
  if (data === "CONFIRM_ORDER") {
    const order = pendingOrders[chatId];
    if (!order) {
      return bot.answerCallbackQuery(query.id, {
        text: "Order မတွေ့ပါ ❌",
        show_alert: true
      });
    }

    order.status = "WAITING_PAYMENT";

    bot.sendMessage(
      chatId,
      "✅ *Order Confirmed!*\n\n" +
        `🆔 Order ID: *${order.orderId}*\n\n` +
        "💰 Payment ပြုလုပ်ပြီး\n" +
        "📸 *Payment Screenshot ကို ဒီ chat ထဲ ပို့ပါ*",
      { parse_mode: "Markdown" }
    );

    ADMIN_CHAT_IDS.forEach((adminId) => {
      bot.sendMessage(
        adminId.trim(),
        "🚨 *New Order*\n\n" +
          `🆔 Order ID: *${order.orderId}*\n` +
          `👤 User: ${order.user}\n` +
          `🆔 Chat ID: ${chatId}\n\n` +
          `📦 Order Details:\n${order.text}`,
        { parse_mode: "Markdown" }
      );
    });

    return bot.answerCallbackQuery(query.id);
  }

  // cancel
  if (data === "CANCEL_ORDER") {
    delete pendingOrders[chatId];
    bot.sendMessage(chatId, "❌ Order ကို ပယ်ဖျက်လိုက်ပါပြီ");
    return bot.answerCallbackQuery(query.id);
  }
});

// ===== TEXT MESSAGE (ORDER INPUT) =====
bot.on("message", (msg) => {
  const chatId = msg.chat.id;

  if (!msg.text) return;
  if (msg.text.startsWith("/")) return;

  const orderId = generateOrderId();

  pendingOrders[chatId] = {
    orderId,
    text: msg.text,
    user: msg.from.first_name,
    status: "PREVIEW"
  };

  bot.sendMessage(
    chatId,
    "🧾 *Order Preview*\n\n" +
      `🆔 Order ID: *${orderId}*\n\n` +
      `📦 Order Details:\n${msg.text}\n\n` +
      "Confirm / Cancel ကိုရွေးပါ 👇",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm Order", callback_data: "CONFIRM_ORDER" },
            { text: "❌ Cancel", callback_data: "CANCEL_ORDER" }
          ]
        ]
      }
    }
  );
});

// ===== PHOTO (PAYMENT) =====
bot.on("photo", (msg) => {
  const chatId = msg.chat.id;
  const order = pendingOrders[chatId];

  if (!order || order.status !== "WAITING_PAYMENT") {
    bot.sendMessage(chatId, "❌ Confirm လုပ်ထားတဲ့ Order မတွေ့ပါ");
    return;
  }

  const photoId = msg.photo[msg.photo.length - 1].file_id;

  ADMIN_CHAT_IDS.forEach((adminId) => {
    bot.sendPhoto(adminId.trim(), photoId, {
      caption:
        "💰 *Payment Screenshot*\n\n" +
        `🆔 Order ID: *${order.orderId}*\n` +
        `👤 User: ${order.user}\n` +
        `🆔 Chat ID: ${chatId}`,
      parse_mode: "Markdown"
    });
  });

  bot.sendMessage(chatId, "✅ Payment Screenshot ရပါပြီ\n⏳ Admin စစ်ဆေးနေပါတယ်");

  delete pendingOrders[chatId];
});

// ===== WEB SERVICE (RENDER FREE) =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("BikaStore Bot is running");
});

app.listen(PORT, () => {
  console.log("Web server listening on port", PORT);
});
