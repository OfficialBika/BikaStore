const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./helpers");
const promo = require("./models/promo");

module.exports = ({ bot, session, ADMIN_IDS }) => {
  bot.on("callback_query", async q => {
    const data = q.data;
    const chatId = String(q.message.chat.id);
    const fromId = String(q.from.id);

    const ack = () => bot.answerCallbackQuery(q.id).catch(() => {});

    try {
      // GAME SELECT
      if (data.startsWith("GAME:")) {
        const game = data.split(":")[1];
        session[chatId] = { step: "WAIT_GAME_ID", game };
        await ack();
        await ui.sendPriceList(bot, chatId, game);
        return bot.sendMessage(chatId, "🆔 Game ID ထည့်ပါ");
      }

      // CONFIRM
      if (data === "CONFIRM") {
        session[chatId].step = "PAY_METHOD";
        await ack();
        return ui.sendPaymentMethods(bot, chatId);
      }

      // CANCEL
      if (data === "CANCEL") {
        delete session[chatId];
        await ack();
        return bot.sendMessage(chatId, "❌ Cancelled /start");
      }

      // PAYMENT
      if (data.startsWith("PAY:")) {
        session[chatId].paymentMethod = data.replace("PAY:", "");
        session[chatId].step = "WAIT_RECEIPT";
        await ack();
        return ui.sendPaymentInfo(bot, chatId, session[chatId].paymentMethod);
      }

      // PROMO CLAIM
      if (data === "PROMO_CLAIM") {
        if (!promo.active || promo.claimed) {
          return ack();
        }
        promo.claimed = true;
        promo.waitingForId = true;
        promo.winner = {
          userId: fromId,
          username: q.from.username || q.from.first_name
        };
        await bot.sendMessage(fromId, "🎉 Game ID + Server ID ပို့ပါ");
        return ack();
      }

      // ADMIN APPROVE
      if (data.startsWith("APPROVE_")) {
        if (!isAdmin(fromId, ADMIN_IDS)) return ack();
        const orderId = data.replace("APPROVE_", "");
        await orders.approveOrder({ bot, orderId });
        return ack();
      }

      // ADMIN REJECT
      if (data.startsWith("REJECT_")) {
        if (!isAdmin(fromId, ADMIN_IDS)) return ack();
        const orderId = data.replace("REJECT_", "");
        await orders.rejectOrder({ bot, orderId });
        return ack();
      }

      await ack();
    } catch (e) {
      console.error("callback error", e);
      await ack();
    }
  });
};
