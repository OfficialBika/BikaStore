// ===============================
// CALLBACK QUERY ROUTER (FINAL)
// Matches user.js FINAL states & keys
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./helpers");

module.exports = function registerCallbacks({ bot, session, ADMIN_IDS }) {
  bot.on("callback_query", async q => {
    const chatId = q?.message?.chat?.id != null ? String(q.message.chat.id) : null;
    const data = q?.data;

    if (!chatId || !data) {
      try { await bot.answerCallbackQuery(q.id); } catch (_) {}
      return;
    }

    try {
      // Helper: always ack quickly (avoid Telegram "loading..." stuck)
      const ack = async (opts) => bot.answerCallbackQuery(q.id, opts).catch(() => null);

      // ===============================
      // GAME SELECT (from /start keyboard)
      // callback_data: "GAME:MLBB" | "GAME:PUBG"
      // ===============================
     if (data === "GAME:MLBB" || data === "GAME:PUBG") {
  const game = data.split(":")[1]; // MLBB | PUBG

  session[chatId] = {
    step: "WAIT_GAME_ID",
    game,
    createdAt: Date.now(),
    msg: Object.create(null) // ✅ message ids store
  };

  const t = session[chatId];

  await ack();

  // ✅ 1) Send price list first (and remember id)
  const priceMsg = await ui.sendPriceList(bot, chatId, game);
  t.msg.priceListId = priceMsg?.message_id;

  // ✅ 2) Then ask for ID + Server ID (and remember id)
  const askIdMsg = await bot.sendMessage(
    chatId,
    game === "MLBB"
      ? "🆔 *MLBB ID + Server ID ကို ထည့်ပါ*\n\nဥပမာ:\n`123456789 1234`"
      : "🆔 *PUBG ID (သို့) Character ID ကို ထည့်ပါ*\n\nဥပမာ:\n`123456789 1`",
    { parse_mode: "Markdown" }
  );

  t.msg.askIdId = askIdMsg?.message_id;

  return;
}

      // ===============================
      // CONFIRM ORDER (from preview)
      // callback_data: "CONFIRM"
      // ===============================
      if (data === "CONFIRM") {
  const t = session[chatId];
  if (!t) {
    await ack();
    return;
  }

  // ✅ delete preview message
  try {
    if (t.msg?.previewId) {
      await bot.deleteMessage(chatId, t.msg.previewId);
      delete t.msg.previewId;
    }
  } catch (_) {}

  // next step
  t.step = "PAY_METHOD";

  await ack({ text: "✅ Confirmed" });

  // ✅ send payment methods & remember id
  const payMsg = await ui.sendPaymentMethods(bot, chatId);
  if (t.msg) t.msg.paymentMethodsId = payMsg?.message_id;

  return;
      }

      // ===============================
      // CANCEL ORDER (from preview)
      // callback_data: "CANCEL"
      // ===============================
      if (data === "CANCEL") {
        delete session[chatId];
        await ack({ text: "❌ Cancelled" });

        return bot.sendMessage(
          chatId,
          "အော်ဒါကို ပယ်ဖျက်ပြီးပါပြီ။ ပြန်စချင်ရင် /start ကိုနှိပ်ပါ ✅"
        );
      }

      // ===============================
      // PAYMENT METHOD SELECT
      // callback_data: "PAY:KBZ" | "PAY:KPay" | "PAY:Wave" ... (UI decide)
      // ===============================
      if (data.startsWith("PAY:")) {
  const t = session[chatId];
  if (!t) {
    await ack();
    return;
  }

  const method = data.replace("PAY:", "").trim();
  t.paymentMethod = method;

  // ❌ delete payment methods message
  try {
    if (t.msg?.paymentMethodsId) {
      await bot.deleteMessage(chatId, t.msg.paymentMethodsId);
      delete t.msg.paymentMethodsId;
    }
  } catch (_) {}

  // next step: wait receipt
  t.step = "WAIT_RECEIPT";

  await ack({ text: `💳 ${method}` });

  // ✅ send payment info & remember id
  const payInfoMsg = await ui.sendPaymentInfo(bot, chatId, method);
  if (t.msg) t.msg.paymentInfoId = payInfoMsg?.message_id;

  return;
      }
    

      // ===============================
      // ADMIN APPROVE
      // callback_data: "APPROVE:<orderId>"
      // ===============================
      if (data.startsWith("APPROVE:")) {
        const fromId = q?.from?.id != null ? String(q.from.id) : "";
        if (!isAdmin(fromId, ADMIN_IDS)) {
          await ack({ text: "⛔ Admin only", show_alert: true });
          return;
        }

        const orderId = data.replace("APPROVE:", "").trim();
        if (!orderId) {
          await ack();
          return;
        }

        await orders.approveOrder({ bot, orderId });
        await ack({ text: "✅ Approved" });
        return;
      }

      // ===============================
      // ADMIN REJECT
      // callback_data: "REJECT:<orderId>"
      // ===============================
      if (data.startsWith("REJECT:")) {
        const fromId = q?.from?.id != null ? String(q.from.id) : "";
        if (!isAdmin(fromId, ADMIN_IDS)) {
          await ack({ text: "⛔ Admin only", show_alert: true });
          return;
        }

        const orderId = data.replace("REJECT:", "").trim();
        if (!orderId) {
          await ack();
          return;
        }

        await orders.rejectOrder({ bot, orderId });
        await ack({ text: "❌ Rejected" });
        return;
      }

      // Default ack
      await ack();
    } catch (err) {
      console.error("❌ Callback error:", err);
      try {
        await bot.answerCallbackQuery(q.id, { text: "⚠️ Error occurred", show_alert: true });
      } catch (_) {}
    }
  });
};
