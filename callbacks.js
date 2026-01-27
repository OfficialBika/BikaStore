// ===============================
// CALLBACK QUERY ROUTER (FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./helpers"); // ✅ PATH FIX

module.exports = function registerCallbacks({ bot, session, ADMIN_IDS }) {

  bot.on("callback_query", async q => {
    const chatId = q.message.chat.id.toString();
    const data = q.data;

    try {
      // ===============================
      // GAME SELECT
      // ===============================
      if (data === "MLBB" || data === "PUBG") {

        // ✅ SESSION INIT (CRITICAL)
        session[chatId] = {
          product: data,
          step: "GAME",   // ✅ MATCH user.js
          items: [],
          totalPrice: 0
        };

        await bot.answerCallbackQuery(q.id);

        // 👉 Ask for Game ID FIRST
        return bot.sendMessage(
          chatId,
          data === "MLBB"
            ? "🆔 *Game ID + Server ID*\n`12345678 1234`"
            : "🆔 *PUBG Game ID ကို ထည့်ပါ*",
          { parse_mode: "Markdown" }
        );
      }

      // ===============================
      // CONFIRM ORDER
      // ===============================
      if (data === "CONFIRM") {
        const t = session[chatId];
        if (!t) return bot.answerCallbackQuery(q.id);

        if (t.previewMsgId) {
          await bot.deleteMessage(chatId, t.previewMsgId).catch(() => {});
        }

        t.step = "PAY_METHOD";

        await bot.answerCallbackQuery(q.id);
        return ui.sendPaymentMethods(bot, chatId);
      }

      // ===============================
      // PAYMENT METHOD
      // ===============================
      if (data.startsWith("PAY_")) {
        const t = session[chatId];
        if (!t) return bot.answerCallbackQuery(q.id);

        t.paymentMethod = data.replace("PAY_", "");
        t.step = "PAYMENT";

        await bot.answerCallbackQuery(q.id);
        return ui.sendPaymentInfo(bot, chatId, t.paymentMethod);
      }

      // ===============================
      // ADMIN APPROVE
      // ===============================
      if (data.startsWith("APPROVE_")) {
        if (!isAdmin(q.from.id.toString(), ADMIN_IDS)) {
          return bot.answerCallbackQuery(q.id, {
            text: "⛔ Admin only",
            show_alert: true
          });
        }

        const orderId = data.replace("APPROVE_", "");
        await orders.approveOrder({ bot, orderId });

        return bot.answerCallbackQuery(q.id, { text: "✅ Approved" });
      }

      // ===============================
      // ADMIN REJECT
      // ===============================
      if (data.startsWith("REJECT_")) {
        if (!isAdmin(q.from.id.toString(), ADMIN_IDS)) {
          return bot.answerCallbackQuery(q.id, {
            text: "⛔ Admin only",
            show_alert: true
          });
        }

        const orderId = data.replace("REJECT_", "");
        await orders.rejectOrder({ bot, orderId });

        return bot.answerCallbackQuery(q.id, { text: "❌ Rejected" });
      }

      await bot.answerCallbackQuery(q.id);

    } catch (err) {
      console.error("Callback error:", err);
      await bot.answerCallbackQuery(q.id, {
        text: "⚠️ Error occurred",
        show_alert: true
      });
    }
  });
};
