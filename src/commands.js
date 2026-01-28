// ===============================
// COMMANDS REGISTER (BIKA STORE - FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders"); // ✅ fix: orders defined
const { isAdmin, monthRange } = require("./helpers");

module.exports = function registerCommands({ bot, session, ADMIN_IDS }) {
  // /start ကို user.js မှာ handle လုပ်ထားလို့ ဒီမှာ မလုပ်လည်းရ
  // ဒါပေမယ့် bot command list ထဲမှာ ထည့်ချင်ရင် setMyCommands လုပ်ထားနိုင်
  bot.setMyCommands([
    { command: "start", description: "Start / reset order flow" },
    { command: "status", description: "Bot status (admin)" },
    { command: "top10", description: "Top 10 users this month (admin)" },
    { command: "myrank", description: "Your rank this month" }
  ]).catch(() => null);

  // ===============================
  // /status (admin)
  // ===============================
  bot.onText(/^\/status(?:\s+.*)?$/i, async (msg) => {
    const chatId = String(msg.chat.id);
    const admin = isAdmin(msg.from?.id, ADMIN_IDS);

    try {
      const stats = await orders.getStatusStats(admin);
      return bot.sendMessage(chatId, ui.statusUI(stats), { parse_mode: "Markdown" });
    } catch (err) {
      console.error("status cmd error:", err);
      return bot.sendMessage(chatId, "⚠️ status error");
    }
  });

  // ===============================
  // /top10 (admin) - current month
  // ===============================
  bot.onText(/^\/top10(?:\s+.*)?$/i, async (msg) => {
    const chatId = String(msg.chat.id);
    const admin = isAdmin(msg.from?.id, ADMIN_IDS);

    if (!admin) {
      return bot.sendMessage(chatId, "⛔ Admin only");
    }

    try {
      const [start, end] = monthRange();
      const list = await orders.getTop10(start, end);
      return bot.sendMessage(chatId, ui.top10UI(list), { parse_mode: "Markdown" });
    } catch (err) {
      console.error("top10 cmd error:", err);
      return bot.sendMessage(chatId, "⚠️ top10 error");
    }
  });

  // ===============================
  // /myrank - current month (user)
  // ===============================
  bot.onText(/^\/myrank(?:\s+.*)?$/i, async (msg) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id || msg.chat.id);

    try {
      const [start, end] = monthRange();
      const r = await orders.getUserRank(userId, start, end);

      if (!r) {
        return bot.sendMessage(chatId, "ဒီလအတွင်း Completed order မရှိသေးပါ ✅");
      }

      return bot.sendMessage(chatId, ui.myRankUI(r.rank, r.total), { parse_mode: "Markdown" });
    } catch (err) {
      console.error("myrank cmd error:", err);
      return bot.sendMessage(chatId, "⚠️ myrank error");
    }
  });
};
