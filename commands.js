// ===============================
// COMMANDS HANDLER (Bika Store)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const users = require("./user");
const { isAdmin } = require("./helpers");

// ===============================
// REGISTER COMMANDS
// ===============================
function registerCommands({ bot, ADMIN_IDS }) {

  // -------------------------------
  // /start
  // -------------------------------
  bot.onText(/\/start/, async msg => {
    const chatId = msg.chat.id;
    const from = msg.from;

    // upsert user
    await users.upsertUser(from);

    await bot.sendMessage(
      chatId,
      `👋 *Welcome to Bika Store*
━━━━━━━━━━━━━━━
💎 MLBB Diamonds
🪙 PUBG UC

အောက်က button ကိုနှိပ်ပြီး စတင်နိုင်ပါတယ်`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }],
            [{ text: "🪙 PUBG UC", callback_data: "PUBG" }]
          ]
        }
      }
    );
  });

  // -------------------------------
  // /status (user + admin)
  // -------------------------------
  bot.onText(/\/status/, async msg => {
    const chatId = msg.chat.id;
    const userId = chatId.toString();

    const admin = isAdmin(userId, ADMIN_IDS);

    const stats = await orders.getStatusStats(admin);

    await bot.sendMessage(
      chatId,
      ui.statusUI(stats),
      { parse_mode: "Markdown" }
    );
  });

  // -------------------------------
  // /top10 (admin only)
  // -------------------------------
  bot.onText(/\/top10/, async msg => {
    const chatId = msg.chat.id;
    const userId = chatId.toString();

    if (!isAdmin(userId, ADMIN_IDS)) return;

    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const list = await orders.getTop10(start, end);

    if (!list.length) {
      return bot.sendMessage(chatId, "No data yet");
    }

    await bot.sendMessage(
      chatId,
      ui.top10UI(list),
      { parse_mode: "Markdown" }
    );
  });

  // -------------------------------
  // /myrank (user)
  // -------------------------------
  bot.onText(/\/myrank/, async msg => {
    const chatId = msg.chat.id;
    const userId = chatId.toString();

    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const rank = await orders.getUserRank(userId, start, end);

    if (!rank) {
      return bot.sendMessage(
        chatId,
        "❌ Rank မရှိသေးပါ",
        { parse_mode: "Markdown" }
      );
    }

    await bot.sendMessage(
      chatId,
      ui.myRankUI(rank.rank, rank.total),
      { parse_mode: "Markdown" }
    );
  });

}

module.exports = registerCommands;
