// ===============================
// CALLBACK QUERY ROUTER (BIKA STORE)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./helpers");

// temp session injected from index.js
let temp = null;

/*
|--------------------------------------------------------------------------
| INIT CALLBACK ROUTER
| index.js ကနေ bot + session inject လုပ်ရမယ်
|--------------------------------------------------------------------------
*/
function initCallbackRouter({ bot, session }) {
  temp = session;

  bot.on("callback_query", async q => {
    const chatId = q.message?.chat?.id?.toString();
    const data = q.data;

    if (!chatId || !data) return;

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
        if (!t) {
          await bot.sendMessage(chatId, "❌ Session expired. /start again");
          return;
        }

        if (t.previewMsgId) {
          try {
            await bot.deleteMessage(chatId, t.previewMsgId);
          } catch {}
        }

        t.step = "PAY_METHOD";
        const m = await ui.sendPaymentMethods(bot, chatId);
        t.msgs.push(m);
        return;
      }

      // ===============================
      // PAYMENT METHOD
      // ===============================
      if (data.startsWith("PAY_")) {
        if (!t) {
          await bot.sendMessage(chatId, "❌ Session expired. /start again");
          return;
        }

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

        const orderId = data.replace("APPROVE_", "");

        await orders.approveOrder({
          bot,
          orderId
        });

        return;
      }

      // ===============================
      // ADMIN REJECT
      // ===============================
      if (data.startsWith("REJECT_")) {
        if (!isAdmin(q.from.id)) return;

        const orderId = data.replace("REJECT_", "");

        await orders.rejectOrder({
          bot,
          orderId
        });

        return;
      }

    } catch (err) {
      console.error("❌ Callback Error:", err);
    }
  });
}

module.exports = initCallbackRouter;
