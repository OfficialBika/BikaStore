// ===============================
// CALLBACK QUERY ROUTER (FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./helpers");
const Order = require("./models/order");
const promo = require("./promo"); // ✅ SAME PROMO OBJECT
const PromoHistory = require("./models/PromoHistory");

module.exports = function registerCallbacks({ bot, session, ADMIN_IDS }) {
  bot.on("callback_query", async (q) => {
    const data = q.data;
    const from = q.from;
    const msg = q.message;
    const chatId = msg?.chat?.id ? String(msg.chat.id) : null;

    const ack = (opts = {}) =>
      bot.answerCallbackQuery(q.id, opts).catch(() => null);

    if (!data || !from) return ack();

    try {

      // ===============================
      // MY ORDERS / PENDING
      // ===============================
      if (data === "PENDING_CONTINUE" || data === "MYORDERS") {
        await ack();

        const list = await Order.find({
          userId: chatId,
          status: "PENDING"
        }).sort({ createdAt: -1 });

        if (!list.length) {
          return bot.sendMessage(chatId, "✅ Pending order မရှိပါ");
        }

        let text = "📦 *MY PENDING ORDERS*\n━━━━━━━━━━━━━━━\n\n";
        for (const o of list) {
          text +=
            `🆔 *${o.orderId}*\n` +
            `🎮 ${o.product}\n` +
            `🆔 ${o.gameId}${o.serverId ? ` (${o.serverId})` : ""}\n` +
            `💰 ${o.amount}\n\n`;
        }

        return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      }

      // ===============================
      // NEW ORDER
      // ===============================
      if (data === "PENDING_NEW") {
        await ack();
        session[chatId] = { step: "CHOOSE_GAME", msg: {} };

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
        await ui.sendPriceList(bot, chatId, game);

        return bot.sendMessage(
          chatId,
          game === "PUBG"
            ? "🆔 PUBG Game ID ကိုထည့်ပါ"
            : "🆔 MLBB ID + Server ID\nဥပမာ: 12345678 4321"
        );
      }

      // ===============================
      // CONFIRM ORDER
      // ===============================
      if (data === "CONFIRM") {
        const t = session[chatId];
        if (!t) return ack();

        t.step = "PAY_METHOD";
        await ack({ text: "✅ Confirmed" });

        await ui.sendPaymentMethods(bot, chatId);
        return;
      }

      // ===============================
      // CANCEL ORDER
      // ===============================
      if (data === "CANCEL") {
        delete session[chatId];
        await ack({ text: "❌ Cancelled" });
        return bot.sendMessage(chatId, "Order ကိုဖျက်ပြီးပါပြီ /start");
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
        if (!promo.active) {
          return ack({ text: "Promo မရှိတော့ပါ", show_alert: true });
        }

        if (promo.claimed) {
          return ack({
            text: "Promo ကို တစ်ယောက်ထုတ်ပြီးပါပြီ",
            show_alert: true
          });
        }

        promo.claimed = true;
        promo.waitingForId = true;
        promo.winner = {
          userId: from.id.toString(),
          username: from.username ? `@${from.username}` : from.first_name
        };

        await bot.sendMessage(
          promo.winner.userId,
          "🎉 Promo အနိုင်ရပါသည်!\n\nGame ID + Server ID ပို့ပါ"
        );

        return ack({ text: "🎉 You won!", show_alert: true });
      }

      // ===============================
      // ADMIN PROMO APPROVE
      // ===============================
      if (data === "PROMO_APPROVE") {
        if (!isAdmin(from.id.toString(), ADMIN_IDS)) {
          return ack({ text: "Admin only", show_alert: true });
        }

        if (!promo.winner) {
          return ack({ text: "Promo data မရှိပါ", show_alert: true });
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
          "🎁 Promo ဆုကို ထုတ်ပေးပြီးပါပြီ 🙏"
        );

        promo.reset();
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: msg.chat.id, message_id: msg.message_id }
        );

        return ack({ text: "Promo approved 🎉" });
      }

      // ===============================
      // ADMIN APPROVE ORDER
      // ===============================
      if (data.startsWith("APPROVE:")) {
        if (!isAdmin(from.id.toString(), ADMIN_IDS)) {
          return ack({ text: "Admin only", show_alert: true });
        }

        await orders.approveOrder({
          bot,
          orderId: data.replace("APPROVE:", "")
        });

        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: msg.chat.id, message_id: msg.message_id }
        );

        return ack({ text: "✅ Approved" });
      }

      // ===============================
      // ADMIN REJECT ORDER
      // ===============================
      if (data.startsWith("REJECT:")) {
        if (!isAdmin(from.id.toString(), ADMIN_IDS)) {
          return ack({ text: "Admin only", show_alert: true });
        }

        await orders.rejectOrder({
          bot,
          orderId: data.replace("REJECT:", "")
        });

        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: msg.chat.id, message_id: msg.message_id }
        );

        return ack({ text: "❌ Rejected" });
      }

      await ack();
    } catch (err) {
      console.error("Callback error:", err);
      await ack({ text: "Error occurred", show_alert: true });
    }
  });
};
