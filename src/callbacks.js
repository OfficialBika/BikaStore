// ===============================
// CALLBACK QUERY ROUTER (FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./helpers");
const Order = require("./models/order");
const { promo, resetPromo } = require("./models/promo");
const PromoHistory = require("./models/PromoHistory");

module.exports = function registerCallbacks({ bot, session, ADMIN_IDS }) {
  bot.on("callback_query", async (q) => {
    const chatId = q?.message?.chat?.id
      ? String(q.message.chat.id)
      : null;
    const data = q?.data;
    const from = q?.from;

    if (!chatId || !data || !from) {
      try { await bot.answerCallbackQuery(q.id); } catch (_) {}
      return;
    }

    // ACK helper
    const ack = async (opts = {}) =>
      bot.answerCallbackQuery(q.id, opts).catch(() => null);

    try {

      // ===============================
      // MY PENDING / MY ORDERS
      // ===============================
      if (data === "PENDING_CONTINUE" || data === "MYORDERS") {
        await ack();

        const list = await Order.find({
          userId: chatId,
          status: "PENDING"
        }).sort({ createdAt: -1 }).limit(10);

        if (!list.length) {
          return bot.sendMessage(chatId, "✅ Pending order မရှိပါ");
        }

        let text = "📦 *MY PENDING ORDERS*\n━━━━━━━━━━━━━━━\n\n";
        for (const o of list) {
          text +=
            `🆔 *${o.orderId}*\n` +
            `🎮 ${o.product}\n` +
            `🆔 ${o.gameId}${o.serverId ? ` (${o.serverId})` : ""}\n` +
            `${o.product === "MLBB" ? "💎" : "🎯"} ${o.amount}\n` +
            `💰 ${Number(o.totalPrice).toLocaleString()} MMK\n\n`;
        }

        return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      }

      // ===============================
      // NEW ORDER
      // ===============================
      if (data === "PENDING_NEW") {
        await ack();
        session[chatId] = { step: "CHOOSE_GAME" };

        return bot.sendMessage(chatId, "🎮 Game တစ်ခုရွေးပါ ⬇️", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "💎 MLBB Diamonds", callback_data: "GAME:MLBB" }],
              [{ text: "🎯 PUBG UC", callback_data: "GAME:PUBG" }]
            ]
          }
        });
      }

      // ===============================
      // GAME SELECT
      // ===============================
      if (data.startsWith("GAME:")) {
        const game = data.split(":")[1];

        session[chatId] = {
          step: "WAIT_GAME_ID",
          game,
          msg: {}
        };

        await ack();

        const priceMsg = await ui.sendPriceList(bot, chatId, game);
        session[chatId].msg.priceListId = priceMsg?.message_id;

        await bot.sendMessage(
          chatId,
          game === "MLBB"
            ? "🆔 *MLBB ID + Server ID*\nဥပမာ: `123456789 1234`"
            : "🆔 *PUBG ID + Server*\nဥပမာ: `123456789 1`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // ===============================
      // CONFIRM ORDER
      // ===============================
      if (data === "CONFIRM") {
        const t = session[chatId];
        if (!t) return ack();

        t.step = "PAY_METHOD";
        await ack({ text: "✅ Confirmed" });

        const payMsg = await ui.sendPaymentMethods(bot, chatId);
        t.msg.paymentMethodsId = payMsg?.message_id;
        return;
      }

      // ===============================
      // CANCEL ORDER
      // ===============================
      if (data === "CANCEL") {
        delete session[chatId];
        await ack({ text: "❌ Cancelled" });
        return bot.sendMessage(chatId, "အော်ဒါပယ်ဖျက်ပြီးပါပြီ /start ကိုနှိပ်ပါ");
      }

      // ===============================
      // PAYMENT METHOD
      // ===============================
      if (data.startsWith("PAY:")) {
        const t = session[chatId];
        if (!t) return ack();

        t.paymentMethod = data.replace("PAY:", "");
        t.step = "WAIT_RECEIPT";

        await ack({ text: "💳 Payment Selected" });
        await ui.sendPaymentInfo(bot, chatId, t.paymentMethod);
        return;
      }

      // ===============================
      // PROMO CLAIM
      // ===============================
      if (data === "PROMO_CLAIM") {
        const userId = from.id.toString();
        const username = from.username
          ? `@${from.username}`
          : `[User](tg://user?id=${from.id})`;

        if (!promo.active) {
          return ack({ text: "❌ Promotion မရှိတော့ပါ", show_alert: true });
        }

        if (promo.claimed) {
          return ack({
            text: `❌ ${promo.winner.username} က ထုတ်ယူပြီးပါပြီ`,
            show_alert: true
          });
        }

        promo.claimed = true;
        promo.winner = {
          userId,
          username,
          step: "WAIT_ID"
        };

        await bot.sendMessage(
          userId,
          `🎉 *ဂုဏ်ယူပါတယ်!*\n\nGame ID + Server ID ပို့ပါ\nဥပမာ: \`123456789 1234\``,
          { parse_mode: "Markdown" }
        );

        return ack({ text: "🎉 You won!", show_alert: true });
      }

      // ===============================
      // ADMIN PROMO APPROVE
      // ===============================
      if (data === "PROMO_APPROVE") {
        if (!isAdmin(from.id.toString(), ADMIN_IDS)) {
          return ack({ text: "⛔ Admin only", show_alert: true });
        }

        if (!promo.winner) {
          return ack({ text: "Promo data not found", show_alert: true });
        }

        await PromoHistory.create({
          promoTitle: promo.title,
          winnerId: promo.winner.userId,
          winnerUsername: promo.winner.username,
          gameId: promo.winner.gameId,
          serverId: promo.winner.serverId,
          approvedBy: from.id.toString()
        });

        await bot.sendMessage(
          promo.winner.userId,
          "🎁 Promotion ဆုကို ထုတ်ပေးပြီးပါပြီ 🙏"
        );

        resetPromo();
        return ack({ text: "Promo approved 🎉" });
      }

      // ===============================
      // ADMIN APPROVE ORDER
      // ===============================
      if (data.startsWith("APPROVE:")) {
        if (!isAdmin(from.id.toString(), ADMIN_IDS)) {
          return ack({ text: "⛔ Admin only", show_alert: true });
        }

        await orders.approveOrder({
          bot,
          orderId: data.replace("APPROVE:", "")
        });
        return ack({ text: "✅ Approved" });
      }

      // ===============================
      // ADMIN REJECT ORDER
      // ===============================
      if (data.startsWith("REJECT:")) {
        if (!isAdmin(from.id.toString(), ADMIN_IDS)) {
          return ack({ text: "⛔ Admin only", show_alert: true });
        }

        await orders.rejectOrder({
          bot,
          orderId: data.replace("REJECT:", "")
        });
        return ack({ text: "❌ Rejected" });
      }

      await ack();
    } catch (err) {
      console.error("❌ Callback error:", err);
      await ack({ text: "⚠️ Error occurred", show_alert: true });
    }
  });
};
