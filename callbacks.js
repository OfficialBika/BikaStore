// ===============================
// CALLBACK QUERY ROUTER
// ===============================

const Order = require("./models/order");
const ui = require("./ui");
const { isAdmin } = require("./helpers");

// temp session (shared from index.js)
let temp = null;

/*
|--------------------------------------------------------------------------
| INIT (index.js က inject လုပ်မယ်)
|--------------------------------------------------------------------------
*/
function initCallbackRouter({ bot, session }) {
  temp = session;

  bot.on("callback_query", async q => {
    const chatId = q.message.chat.id;
    const data = q.data;
    const t = temp[chatId];

    try {

      // ===============================
      // GAME SELECT
      // ===============================
      if (data === "MLBB" || data === "PUBG") {
        temp[chatId] = {
          product: data,
          step: "GAME",
          items: [],
          msgs: []
        };

        const msgs = await ui.sendPriceList(bot, chatId, data);
        temp[chatId].msgs.push(...msgs);
        return;
      }

      // ===============================
      // CONFIRM ORDER
      // ===============================
      if (data === "CONFIRM") {
        if (!t) return;

        await bot.deleteMessage(chatId, t.previewMsgId);
        t.step = "PAY_METHOD";

        const m = await ui.sendPaymentMethods(bot, chatId);
        t.msgs.push(m);
        return;
      }

      // ===============================
      // PAYMENT METHOD
      // ===============================
      if (data.startsWith("PAY_")) {
        if (!t) return;

        t.paymentMethod = data.replace("PAY_", "");
        t.step = "PAYMENT";

        await ui.sendPaymentInfo(bot, chatId, t.paymentMethod);
        return;
      }

      // ===============================
      // ADMIN APPROVE
      // ===============================
      if (data.startsWith("APPROVE_")) {
        if (!isAdmin(q.from.id)) return;

        const orderId = data.split("_")[1];
        const order = await orders.approveOrder(orderId);
        if (!order) return;

        await ui.notifyUserApproved(bot, order);
        await ui.updateAdminMessage(bot, order, "APPROVED");
        return;
      }

      // ===============================
      // ADMIN REJECT
      // ===============================
      if (data.startsWith("REJECT_")) {
        if (!isAdmin(q.from.id)) return;

        const orderId = data.split("_")[1];
        const order = await orders.rejectOrder(orderId);
        if (!order) return;

        await ui.notifyUserRejected(bot, order);
        await ui.updateAdminMessage(bot, order, "REJECTED");
        return;
      }

    } catch (err) {
      console.error("Callback error:", err);
    }
  });
}

module.exports = initCallbackRouter;
