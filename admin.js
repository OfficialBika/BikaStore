// ===============================
// ADMIN COMMAND HANDLER (FINAL)
// ===============================

const orders = require("./orders");
const ui = require("./ui");
const { isAdmin } = require("./helpers");

// ===============================
// INIT ADMIN HANDLER
// ===============================
function initAdmin({ bot }) {

  // ===============================
  // /status
  // ===============================
  bot.onText(/\/status/, async msg => {
    const chatId = msg.chat.id;

    try {
      const admin = isAdmin(msg.from.id);
      const stats = await orders.getStatusStats(admin);

      await bot.sendMessage(
        chatId,
        ui.statusUI(stats),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("/status error:", err);
    }
  });

  // ===============================
  // /top10 (admin only)
  // ===============================
  bot.onText(/\/top10/, async msg => {
    if (!isAdmin(msg.from.id)) return;

    try {
      const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

      const list = await orders.getTop10(start, end);
      if (!list.length) {
        return bot.sendMessage(msg.chat.id, "📭 No data yet");
      }

      await bot.sendMessage(
        msg.chat.id,
        ui.top10UI(list),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("/top10 error:", err);
    }
  });

  // ===============================
  // /myrank (admin allowed too)
  // ===============================
  bot.onText(/\/myrank/, async msg => {
    try {
      const userId = msg.chat.id.toString();

      const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

      const rank = await orders.getUserRank(userId, start, end);
      if (!rank) {
        return bot.sendMessage(msg.chat.id, "📭 Rank မရှိသေးပါ");
      }

      await bot.sendMessage(
        msg.chat.id,
        ui.myRankUI(rank.rank, rank.total),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("/myrank error:", err);
    }
  });

}

module.exports = initAdmin;
