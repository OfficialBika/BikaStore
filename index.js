const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

const pendingOrders = {}; 

function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BKS-${date}-${rand}`;
  }

const ADMIN_CHAT_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",")
  : [];

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
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
  };

  bot.sendMessage(
    chatId,
    "🛒 *Bika Store Product Menu*\n\nကုန်ပစ္စည်းတစ်ခုကို ရွေးချယ်ပါ 👇",
    { parse_mode: "Markdown", ...options }
  );
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // ===== PRODUCT DETAILS =====
  const products = {
    MLBB:
      "💎 *MLBB Diamonds*\n\n" +
      "• Diamonds Top-Up\n" +
      "• Fast delivery\n\n" +
      "📝 Order format:\n" +
      "`Game ID + Server`\n`Amount`",

    PUBG:
      "🔥 *PUBG UC*\n\n" +
      "• UC Top-Up\n" +
      "• Instant process\n\n" +
      "📝 Order format:\n" +
      "`Player ID`\n`UC Amount`",

    TGPREMIUM:
      "⭐ *Telegram Premium*\n\n" +
      "• 1 / 3 / 6 / 12 Months\n" +
      "• Official Premium\n\n" +
      "📝 Order format:\n" +
      "`Telegram Username`\n`Duration`",

    TGSTAR:
      "🌟 *Telegram Star*\n\n" +
      "• Star Recharge\n\n" +
      "📝 Order format:\n" +
      "`Telegram Username`\n`Star Amount`",

    COC:
      "🏰 *COC Gems*\n\n" +
      "• Gems Top-Up\n" +
      "• Safe & Fast\n\n" +
      "📝 Order format:\n" +
      "`Player Tag`\n`Gem Amount`",

    CAPCUT:
      "✂️ *CapCut Premium*\n\n" +
      "• Pro Account\n" +
      "• No watermark\n\n" +
      "📝 Order format:\n" +
      "`Email / Username`\n`Duration`"
  };

  // ===== SHOW PRODUCT =====
  if (products[data]) {
    bot.sendMessage(chatId, products[data], { parse_mode: "Markdown" });
    return bot.answerCallbackQuery(query.id);
  }

  // ===== CONFIRM ORDER =====
  if (data === "CONFIRM_ORDER") {
    const order = pendingOrders[chatId];
    if (!order) {
      return bot.answerCallbackQuery(query.id, {
        text: "Order မတွေ့ပါ ❌",
        show_alert: true
      });
    }

    bot.sendMessage(
      chatId,
      "✅ *Order Confirmed!*\n\n" +
        `🆔 Order ID: *${order.orderId}*\n` +
        "⏳ Please wait, admin will contact you.",
      { parse_mode: "Markdown" }
    );

    const adminMsg =
      "🚨 *New Confirmed Order*\n\n" +
      `🆔 Order ID: *${order.orderId}*\n` +
      `👤 User: ${order.user}\n` +
      `🆔 Chat ID: ${chatId}\n\n` +
      `📦 Order Details:\n${order.text}`;

    ADMIN_CHAT_IDS.forEach((adminId) => {
      bot.sendMessage(adminId.trim(), adminMsg, { parse_mode: "Markdown" });
    });

    delete pendingOrders[chatId];
    return bot.answerCallbackQuery(query.id);
  }

  // ===== CANCEL ORDER =====
  if (data === "CANCEL_ORDER") {
    delete pendingOrders[chatId];
    bot.sendMessage(chatId, "❌ Order ကို ပယ်ဖျက်လိုက်ပါပြီ");
    return bot.answerCallbackQuery(query.id);
  }
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;

  // command skip
  if (msg.text && msg.text.startsWith("/")) return;
  if (!msg.text) return;

  const orderId = generateOrderId();

  // store pending order
  pendingOrders[chatId] = {
    orderId,
    text: msg.text,
    user: msg.from.first_name
  };

  bot.sendMessage(
    chatId,
    "🧾 *Order Preview*\n\n" +
      `🆔 Order ID: *${orderId}*\n\n` +
      `📦 Order Details:\n${msg.text}\n\n` +
      "အောက်ကခလုတ်နဲ့ Confirm / Cancel လုပ်ပါ 👇",
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

// ===== Render Web Service keep-alive =====
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("BikaStore Bot is running");
});

app.listen(PORT, () => {
  console.log("Web server listening on port", PORT);
});
