const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

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

  bot.sendMessage(
    chatId,
    " *Welcome to Bika Store* 🛍\n\nဝယ်ယူရရှိနိူင်သော Productများ👇",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 MLBB Diamonds", callback_data: "p_mlbb" }],
          [{ text: "🔥 PUBG UC", callback_data: "p_pubg" }],
          [{ text: "⭐ Telegram Premium", callback_data: "p_tg_premium" }],
          [{ text: "🌟 Telegram Star", callback_data: "p_tg_star" }],
          [{ text: "🏰 COC Gems", callback_data: "p_coc" }],
          [{ text: "🎬 CapCut Premium", callback_data: "p_capcut" }],
          [{ text: "🛒 Order Now", callback_data: "order_now" }]
        ]
      }
    }
  );
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  const products = {
    p_mlbb:
      "💎 *MLBB Diamonds*\n\n" +
      "• Diamonds Top-Up\n" +
      "• Fast delivery\n\n" +
      "📝 Order format:\n" +
      "`Game ID + Server`\n`Amount`",

    p_pubg:
      "🔥 *PUBG UC*\n\n" +
      "• UC Top-Up\n" +
      "• Instant process\n\n" +
      "📝 Order format:\n" +
      "`Player ID`\n`UC Amount`",

    p_tg_premium:
      "⭐ *Telegram Premium*\n\n" +
      "• 1 / 3 / 6 / 12 Months\n" +
      "• Official Premium\n\n" +
      "📝 Order format:\n" +
      "`Telegram Username`\n`Duration`",

    p_tg_star:
      "🌟 *Telegram Star*\n\n" +
      "• Star Recharge\n\n" +
      "📝 Order format:\n" +
      "`Telegram Username`\n`Star Amount`",

    p_coc:
      "🏰 *COC Gems*\n\n" +
      "• Gems Top-Up\n" +
      "• Safe & Fast\n\n" +
      "📝 Order format:\n" +
      "`Player Tag`\n`Gem Amount`",

    p_capcut:
      "🎬 *CapCut Premium*\n\n" +
      "• Pro Account\n" +
      "• No watermark\n\n" +
      "📝 Order format:\n" +
      "`Email / Username`\n`Duration`"
  };

  if (products[data]) {
    bot.sendMessage(chatId, products[data], {
      parse_mode: "Markdown"
    });
  }

  if (data === "order_now") {
    bot.sendMessage(
      chatId,
      "🛒 Order ပြုလုပ်ရန် အပေါ်က product တစ်ခုကိုရွေးပြီး format အတိုင်းပို့ပါ"
    );
  }

  bot.answerCallbackQuery(query.id);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;

  // /start ကို skip
  if (msg.text && msg.text.startsWith("/")) return;

  // Button click message မဟုတ်တဲ့ text ကိုသာ
  if (!msg.text) return;

  const orderId = generateOrderId();

  const orderSummary =
    "🧾 *Order Received*\n\n" +
    `🆔 Order ID: *${orderId}*\n` +
    `👤 Customer: ${msg.from.first_name}\n` +
    `💬 Order Info:\n${msg.text}\n\n` +
    "⏳ Please wait, we will contact you soon.";

  bot.sendMessage(chatId, orderSummary, {
    parse_mode: "Markdown"
  });
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;

  // 1️⃣ Command skip (/start)
  if (msg.text && msg.text.startsWith("/")) return;

  // 2️⃣ Button click message skip
  if (msg.via_bot) return;

  // 3️⃣ Text မဟုတ်ရင် skip
  if (!msg.text) return;

  // 4️⃣ Menu prompt စာကို skip (optional safeguard)
  if (msg.text.includes("Bika Store")) return;

  // ✅ Now this is real order text
  const orderId = generateOrderId();

  // User summary
  bot.sendMessage(
    chatId,
    "🧾 *Order Received*\n\n" +
      `🆔 Order ID: *${orderId}*\n\n` +
      `📦 Order Details:\n${msg.text}\n\n` +
      "⏳ Please wait, we will contact you soon.",
    { parse_mode: "Markdown" }
  );

  // Admin notify
  const adminMessage =
    "🚨 *New Order*\n\n" +
    `🆔 Order ID: *${orderId}*\n` +
    `👤 User: ${msg.from.first_name}\n` +
    `🆔 Chat ID: ${chatId}\n\n` +
    `📦 Order Details:\n${msg.text}`;

  ADMIN_CHAT_IDS.forEach((adminId) => {
    bot.sendMessage(adminId.trim(), adminMessage, {
      parse_mode: "Markdown"
    });
  });
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
