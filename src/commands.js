// ===============================
// COMMANDS REGISTER (BIKA STORE - FINAL FIXED)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin, monthRange } = require("./helpers");
const { promo, resetPromo } = require("./models/promo");

module.exports = function registerCommands({ bot, session, ADMIN_IDS }) {

  // ===============================
  // BOT COMMAND LIST
  // ===============================
  bot.setMyCommands([
    { command: "start", description: "Start / reset order flow" },
    { command: "promo", description: "View current promotion" },
    { command: "promo_create", description: "Create promotion (admin)" },
    { command: "status", description: "Bot status (admin)" },
    { command: "top10", description: "Top 10 users this month" },
    { command: "myrank", description: "Your rank this month" },
    { command: "admin", description: "Admin dashboard" }
  ]).catch(() => null);

  // ===============================
  // /status (ADMIN)
  // ===============================
  bot.onText(/^\/status$/i, async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id.toString();

    if (!isAdmin(fromId, ADMIN_IDS)) {
      return bot.sendMessage(chatId, "⛔ Admin only");
    }

    try {
      const { totalUsers, approvedOrders } = await orders.getStatusSummary();
      const uptimeMs = Date.now() - (global.BOT_START_TIME || Date.now());
      const uptimeHours = Math.floor(uptimeMs / 3600000);

      return bot.sendMessage(
        chatId,
        ui.statusDashboardUI({ totalUsers, approvedOrders, uptimeHours }),
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error(e);
      return bot.sendMessage(chatId, "⚠️ Status error");
    }
  });

  // ===============================
  // /promo_create (ADMIN ONLY)
  // ===============================
  bot.onText(/^\/promo_create$/i, async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id.toString();

    if (!isAdmin(fromId, ADMIN_IDS)) {
      return bot.sendMessage(chatId, "⛔ Admin only");
    }

    resetPromo();

    promo.active = true;
    promo.title = "🎁 BIKA STORE PROMOTION";
    promo.message =
      "🎉 *PROMOTION TIME!*\n\n" +
      "ပထမဆုံး Claim လုပ်တဲ့သူက 💎 Diamonds လက်ဆောင်ရပါမယ်!\n\n" +
      "👇 အောက်က Button ကို နှိပ်ပါ";

    await bot.sendMessage(chatId, "✅ Promotion created successfully");

    return bot.sendMessage(chatId, promo.message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎁 Claim Promo", callback_data: "PROMO_CLAIM" }]
        ]
      }
    });
  });

  // ===============================
  // /promo (USER + ADMIN)
  // ===============================
  bot.onText(/^\/promo$/i, async (msg) => {
    const chatId = msg.chat.id;

    if (!promo.active) {
      return bot.sendMessage(chatId, "❌ Promotion မရှိသေးပါ");
    }

    return bot.sendMessage(chatId, promo.message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎁 Claim Promo", callback_data: "PROMO_CLAIM" }]
        ]
      }
    });
  });

  // ===============================
  // /top10
  // ===============================
  bot.onText(/^\/top10$/i, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const [start, end] = monthRange();
      const list = await orders.getTop10(start, end);
      const { getMonthName } = require("./helpers");

      return bot.sendMessage(
        chatId,
        ui.top10UI(list, getMonthName(start)),
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error(e);
      return bot.sendMessage(chatId, "⚠️ Top10 error");
    }
  });

  // ===============================
  // /myrank
  // ===============================
  bot.onText(/^\/myrank$/i, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    try {
      const [start, end] = monthRange();
      const r = await orders.getUserRank(userId, start, end);

      if (!r) {
        return bot.sendMessage(chatId, "ဒီလအတွင်း order မရှိသေးပါ");
      }

      return bot.sendMessage(
        chatId,
        ui.myRankUI(r.rank, r.total),
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error(e);
      return bot.sendMessage(chatId, "⚠️ MyRank error");
    }
  });

  // ===============================
  // /admin
  // ===============================
  bot.onText(/^\/admin$/i, async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id.toString();

    if (!isAdmin(fromId, ADMIN_IDS)) {
      return bot.sendMessage(chatId, "⛔ Admin only");
    }

    try {
      const Order = require("./models/order");

      const total = await Order.countDocuments();
      const pending = await Order.countDocuments({ status: "PENDING" });
      const completed = await Order.countDocuments({ status: "COMPLETED" });
      const rejected = await Order.countDocuments({ status: "REJECTED" });

      return bot.sendMessage(
        chatId,
        ui.adminDashboardUI({ total, pending, completed, rejected }),
        {
          parse_mode: "Markdown",
          reply_markup: ui.adminDashboardKeyboard()
        }
      );
    } catch (e) {
      console.error(e);
      return bot.sendMessage(chatId, "⚠️ Admin error");
    }
  });
};
