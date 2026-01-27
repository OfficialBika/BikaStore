// ===============================
// CALLBACK QUERY ROUTER (FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./src/models/helpers");

// temp session (inject from index.js)
let tempSession = null;

// ===============================
// INIT
// ===============================
function registerCallbacks({ bot, session, ADMIN_IDS }) {
  tempSession = session;

  bot.on("callback_query", async q => {
    const chatId = q.message.chat.id.toString();
    const data = q.data;
    const t = tempSession[chatId];

    try {
      // ===============================
      // GAME SELECT
      // ===============================
      if (data === "MLBB" || data === "PUBG") {
        tempSession[chatId] = {
          product: data,
          step: "GAME_ID",
          items: [],
          msgs: []
        };

        const msgs = await ui.sendPriceList(bot, chatId, data);
        tempSession[chatId].msgs.push(...msgs);
        return bot.answerCallbackQuery(q.id);
      }

      // ===============================
      // CONFIRM ORDER
      // ===============================
      if (data === "CONFIRM") {
        if (!t) return bot.answerCallbackQuery(q.id);

        if (t.previewMsgId) {
          await bot.deleteMessage(chatId, t.previewMsgId).catch(() => {});
        }

        t.step = "PAY_METHOD";
        const m = await ui.sendPaymentMethods(bot, chatId);
        t.msgs.push(m);

        return bot.answerCallbackQuery(q.id);
      }

      // ===============================
      // PAYMENT METHOD
      // ===============================
      if (data.startsWith("PAY_")) {
        if (!t) return bot.answerCallbackQuery(q.id);

        t.paymentMethod = data.replace("PAY_", "");
        t.step = "PAYMENT";

        await ui.sendPaymentInfo(bot, chatId, t.paymentMethod);
        return bot.answerCallbackQuery(q.id);
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

        return bot.answerCallbackQuery(q.id, {
          text: "✅ Order approved"
        });
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

        return bot.answerCallbackQuery(q.id, {
          text: "❌ Order rejected"
        });
      }

      // fallback
      await bot.answerCallbackQuery(q.id);

    } catch (err) {
      console.error("Callback error:", err);
      await bot.answerCallbackQuery(q.id, {
        text: "⚠️ Error occurred",
        show_alert: true
      });
    }
  });
}

module.exports = registerCallbacks;
