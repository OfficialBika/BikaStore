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
    createdAt: Date.now()
  };

  await ack();

  // ✅ 1) Send price list first
  await ui.sendPriceList(bot, chatId, game);

  // ✅ 2) Then ask for ID + Server ID
  return bot.sendMessage(
    chatId,
    game === "MLBB"
      ? "🆔 *MLBB ID + Server ID ကို ထည့်ပါ*\n\nဥပမာ:\n`123456789 1234`"
      : "🆔 *PUBG ID (သို့) Character ID ကို ထည့်ပါ*\n\nဥပမာ:\n`123456789 1`",
    { parse_mode: "Markdown" }
  );
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

        // Next: choose payment method via inline keyboard
        t.step = "PAY_METHOD";

        await ack({ text: "✅ Confirmed" });
        return ui.sendPaymentMethods(bot, chatId);
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

        // After payment method selected, we should wait for receipt photo
        t.step = "WAIT_RECEIPT";

        await ack({ text: `💳 ${method}` });

        // send payment info (account/qr/etc) + ask receipt
        await ui.sendPaymentInfo(bot, chatId, method);

        // ensure user gets the instruction (even if ui doesn't include it)
        return bot.sendMessage(
          chatId,
          "📸 *ငွေလွှဲပြီးပါက ပြေစာ Screenshot ကို photo အနေနဲ့ ပို့ပေးပါ*",
          { parse_mode: "Markdown" }
        );
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
