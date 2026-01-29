// ===============================
// COMMANDS REGISTER (BIKA STORE - FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin, monthRange } = require("./helpers");
const { promo, resetPromo } = require("./models/promo");

module.exports = function registerCommands({ bot, session, ADMIN_IDS }) {
  // Bot command list
  bot.setMyCommands([
    { command: "start", description: "Start / reset order flow" },
    { command: "status", description: "Bot status (admin)" },
    { command: "top10", description: "Top 10 users this month" },
    { command: "myrank", description: "Your rank this month" },
    { command: "admin", description: "Admin dashboard" }
  ]).catch(() => null);

  // ===============================
// /status (admin) — PRO DASHBOARD
// ===============================
bot.onText(/^\/status(?:\s+.*)?$/i, async (msg) => {
  const chatId = String(msg.chat.id);
  const fromId = String(msg.from?.id || "");

  if (!isAdmin(fromId, ADMIN_IDS)) {
    return bot.sendMessage(chatId, "⛔ Admin only");
  }

  try {
    const { totalUsers, approvedOrders } = await orders.getStatusSummary();

    const uptimeMs = Date.now() - (global.BOT_START_TIME || Date.now());
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));

    const text = ui.statusDashboardUI({
      totalUsers,
      approvedOrders,
      uptimeHours
    });

    return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("status cmd error:", err);
    return bot.sendMessage(chatId, "⚠️ status error");
  }
});


  // ===============================
  // /promo (ADMIN ONLY)
  // ===============================
  bot.onText(/\/promo/, async (msg) => {
    const chatId = msg.from.id.toString();

    // Admin check
    if (!ADMIN_IDS.includes(chatId)) {
      return bot.sendMessage(chatId, "⛔ Admin only command");
    }

    // Reset & activate promo
    resetPromo();
    promo.active = true;

    const promoText = `
🎁 *Bika Store Promotion*

🔥 ပထမဆုံးနှိပ်တဲ့ ၁ ယောက်သာ ဆုရမယ်!
⚡ လက်မလွတ်စေနဲ့!

👇 အောက်က button ကိုနှိပ်ပါ
`;

    await bot.sendMessage(chatId, promoText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎯 Claim Promotion",
              callback_data: "PROMO_CLAIM"
            }
          ]
        ]
      }
    });
  });

  // ===============================
  // /top10 (USER + ADMIN) - current month
  // ===============================
bot.onText(/^\/top10(?:\s+.*)?$/i, async (msg) => {
  const chatId = String(msg.chat.id);

  try {
    const [start, end] = monthRange();
    const list = await orders.getTop10(start, end);

    const { getMonthName } = require("./helpers");
    const monthName = getMonthName(start);

    return bot.sendMessage(
      chatId,
      ui.top10UI(list, monthName),
      {
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }
    );
  } catch (err) {
    console.error("top10 cmd error:", err);
    return bot.sendMessage(chatId, "⚠️ top10 error");
  }
});

  // ===============================
  // /myrank (user) - current month
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

  // ===============================
  // /admin - Admin Dashboard (admin only)
  // ===============================
  bot.onText(/^\/admin(?:\s+.*)?$/i, async (msg) => {
    const chatId = String(msg.chat.id);
    const fromId = String(msg.from?.id || "");

    if (!isAdmin(fromId, ADMIN_IDS)) {
      return bot.sendMessage(chatId, "⛔ Admin only");
    }

    try {
      const Order = require("./models/order");

      const total = await Order.countDocuments();
      const pending = await Order.countDocuments({ status: "PENDING" });
      const completed = await Order.countDocuments({ status: "COMPLETED" });
      const rejected = await Order.countDocuments({ status: "REJECTED" });

      const text = ui.adminDashboardUI({
        total,
        pending,
        completed,
        rejected
      });

      return bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: ui.adminDashboardKeyboard()
      });
    } catch (err) {
      console.error("admin dashboard error:", err);
      return bot.sendMessage(chatId, "⚠️ admin dashboard error");
    }
  });
}; // ✅ IMPORTANT: close registerCommands
