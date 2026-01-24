const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "🛍 *Bika Store*\n\nDigital Products ကိုရွေးပါ 👇",
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
