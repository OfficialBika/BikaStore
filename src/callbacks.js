// ===============================
// CALLBACK QUERY ROUTER (FINAL)
// Matches user.js FINAL states & keys
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin } = require("./helpers");
const Order = require("./models/order"); // ✅ move require up (clean)
const { promo, resetPromo } = require("./models/promo");
const PromoHistory = require("./models/PromoHistory");
module.exports = function registerCallbacks({ bot, session, ADMIN_IDS }) {
  bot.on("callback_query", async q => {
    const chatId = q?.message?.chat?.id != null ? String(q.message.chat.id) : null;
    const data = q?.data;

    if (!chatId || !data) {
      try { await bot.answerCallbackQuery(q.id); } catch (_) {}
      return;
    }

    // ✅ ack helper (must be inside callback)
    const ack = async (opts) =>
      bot.answerCallbackQuery(q.id, opts).catch(() => null);

    try {
      // ===============================
      // PENDING DECISION (from /start prompt)
      // ===============================
      if (data === "PENDING_CONTINUE" || data === "MYORDERS") {
        await ack();

        const list = await Order.find({ userId: chatId, status: "PENDING" })
          .sort({ createdAt: -1 })
          .limit(10);

        if (!list.length) {
          return bot.sendMessage(chatId, "✅ Pending order မရှိပါ");
        }

        let text = "📦 *MY PENDING ORDERS*\n━━━━━━━━━━━━━━━\n\n";
        for (const o of list) {
          text +=
            `🆔 *${o.orderId}*\n` +
            `🎮 ${o.product}\n` +
            `🆔 ${o.gameId}${o.serverId ? ` (${o.serverId})` : ""}\n` +
            `${o.product === "MLBB" ? "💎" : "🎯"} ${String(o.amount ?? "")}\n` +
            `💰 ${Number(o.totalPrice).toLocaleString()} MMK\n\n`;
        }

        return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      }

      if (data === "PENDING_NEW") {
        await ack();

        // ✅ allow new order even if pending exists
        session[chatId] = { step: "CHOOSE_GAME" };

        return bot.sendMessage(chatId, "🎮 Game တစ်ခုကို ရွေးပါ ⬇️", {
          parse_mode: "Markdown",
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
      // callback_data: "GAME:MLBB" | "GAME:PUBG"
      // ===============================
      if (data === "GAME:MLBB" || data === "GAME:PUBG") {
        const game = data.split(":")[1]; // MLBB | PUBG

        session[chatId] = {
          step: "WAIT_GAME_ID",
          game,
          createdAt: Date.now(),
          msg: Object.create(null)
        };

        const t = session[chatId];

        await ack();

        // 1) price list
        const priceMsg = await ui.sendPriceList(bot, chatId, game);
        t.msg.priceListId = priceMsg?.message_id;

        // 2) ask id/svid
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

        // delete preview message (optional)
        try {
          if (t.msg?.previewId) {
            await bot.deleteMessage(chatId, t.msg.previewId);
            delete t.msg.previewId;
          }
        } catch (_) {}

        t.step = "PAY_METHOD";

        await ack({ text: "✅ Confirmed" });

        const payMsg = await ui.sendPaymentMethods(bot, chatId);
        if (t.msg) t.msg.paymentMethodsId = payMsg?.message_id;

        return;
      }

      // ===============================
      // CANCEL ORDER
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
      // callback_data: "PAY:KPay" | "PAY:WavePay"
      // ===============================
      if (data.startsWith("PAY:")) {
        const t = session[chatId];
        if (!t) {
          await ack();
          return;
        }

        const method = data.replace("PAY:", "").trim();
        t.paymentMethod = method;

        // delete payment methods message
        try {
          if (t.msg?.paymentMethodsId) {
            await bot.deleteMessage(chatId, t.msg.paymentMethodsId);
            delete t.msg.paymentMethodsId;
          }
        } catch (_) {}

        t.step = "WAIT_RECEIPT";

        await ack({ text: `💳 ${method}` });

        const payInfoMsg = await ui.sendPaymentInfo(bot, chatId, method);
        if (t.msg) t.msg.paymentInfoId = payInfoMsg?.message_id;

        return;
      }

// ===============================
// PROMO CLAIM
// ===============================
if (data === "PROMO_CLAIM") {
  const userId = from.id.toString();
  const username =
    from.username
      ? `@${from.username}`
      : `[User](tg://user?id=${from.id})`;

  // Promo inactive
  if (!promo.active) {
    return bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Promotion မရှိတော့ပါ"
    });
  }

  // Already claimed
  if (promo.claimed) {
    return bot.answerCallbackQuery(callbackQuery.id, {
      text: `❌ ဒီ Promotion ကို ${promo.winner.username} က ထုတ်ယူပြီးပါပြီ`,
      show_alert: true
    });
  }

  // ===============================
  // FIRST WINNER
  // ===============================
  promo.claimed = true;
  promo.winner = {
    userId,
    username
  };

  // Ask winner for ID + Server ID
  await bot.sendMessage(
    userId,
    `🎉 *ဂုဏ်ယူပါတယ်!*\n\nသင် Promotion ကို အနိုင်ရရှိခဲ့ပါပြီ 🎁\n\n📩 *ကျေးဇူးပြု၍*\n👉 Game ID\n👉 Server ID\nကို ဒီ chat မှာပို့ပေးပါ`,
    { parse_mode: "Markdown" }
  );

  return bot.answerCallbackQuery(callbackQuery.id, {
    text: "🎉 Congratulations! You won!",
    show_alert: true
  });
}

// ===============================
// ADMIN DASHBOARD ACTIONS
// ===============================
if (data.startsWith("ADMIN:")) {
  const fromId = q?.from?.id != null ? String(q.from.id) : "";
  if (!isAdmin(fromId, ADMIN_IDS)) {
    await ack({ text: "⛔ Admin only", show_alert: true });
    return;
  }

  await ack();

  const Order = require("./models/order");

  // REFRESH dashboard (edit message)
  if (data === "ADMIN:REFRESH") {
    const total = await Order.countDocuments();
    const pending = await Order.countDocuments({ status: "PENDING" });
    const completed = await Order.countDocuments({ status: "COMPLETED" });
    const rejected = await Order.countDocuments({ status: "REJECTED" });

    const text = ui.adminDashboardUI({ total, pending, completed, rejected });

    return bot.editMessageText(text, {
      chat_id: chatId,
      message_id: q.message.message_id,
      parse_mode: "Markdown",
      reply_markup: ui.adminDashboardKeyboard()
    });
  }

  // PENDING list (send new message)
  if (data === "ADMIN:PENDING") {
    const list = await Order.find({ status: "PENDING" })
      .sort({ createdAt: -1 })
      .limit(10);

    if (!list.length) {
      return bot.sendMessage(chatId, "✅ Pending order မရှိပါ");
    }

    let text = "⏳ *PENDING ORDERS (Latest 10)*\n━━━━━━━━━━━━━━━\n\n";
    for (const o of list) {
      text +=
        `🆔 *${o.orderId}*\n` +
        `👤 ${o.username ? `@${o.username}` : `[User](tg://user?id=${o.userId})`}\n` +
        `🎮 ${o.product}\n` +
        `${o.product === "MLBB" ? "💎" : "🎯"} ${String(o.amount)}\n` +
        `💰 ${Number(o.totalPrice).toLocaleString()} MMK\n\n`;
    }

    return bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }

  // TOP10 month (send)
  if (data === "ADMIN:TOP10_MONTH") {
    const [start, end] = require("./helpers").monthRange();
    const list = await orders.getTop10(start, end);
    return bot.sendMessage(chatId, ui.top10UI(list), { parse_mode: "Markdown" });
  }

  // TOP10 today (send)
  if (data === "ADMIN:TOP10_TODAY") {
    const { dayRange } = require("./helpers");
    const [start, end] = dayRange();
    const list = await orders.getTop10(start, end);
    return bot.sendMessage(chatId, ui.top10UI(list, { period: "Today" }), { parse_mode: "Markdown" });
  }
}


// ===============================
// PROMO APPROVE (ADMIN)
// ===============================
if (data === "PROMO_APPROVE") {
  if (!isAdmin(q.from.id.toString(), ADMIN_IDS)) {
    return bot.answerCallbackQuery(q.id, {
      text: "⛔ Admin only",
      show_alert: true
    });
  }

  if (!promo.winner) {
    return bot.answerCallbackQuery(q.id, {
      text: "Promo data not found",
      show_alert: true
    });
  }

  const winner = promo.winner;

  // ✅ SAVE PROMO HISTORY
  await PromoHistory.create({
    promoTitle: promo.title,
    winnerId: winner.userId,
    winnerUsername: winner.username,
    gameId: winner.gameId,
    serverId: winner.serverId,
    approvedBy: q.from.id.toString()
  });

  // Admin UI update
  await bot.editMessageText(
    `🎁 *PROMOTION COMPLETED*\n━━━━━━━━━━━━━━━\n\n👤 Winner: ${winner.username}\n🆔 Game ID: \`${winner.gameId}\`\n🖥 Server ID: \`${winner.serverId}\`\n\n📦 Promo history saved`,
    {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      parse_mode: "Markdown"
    }
  );

  // Notify winner
  await bot.sendMessage(
    winner.userId,
    "🎉 *ဂုဏ်ယူပါတယ်!*\n━━━━━━━━━━━━━━━\n\nသင့်ရရှိတဲ့ Promotion ဆုကို ထုတ်ပေးပြီးပါပြီ 🙏",
    { parse_mode: "Markdown" }
  );

  resetPromo();
  return bot.answerCallbackQuery(q.id, { text: "Promo completed 🎉" });
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

      await ack();
    } catch (err) {
      console.error("❌ Callback error:", err);
      try {
        await bot.answerCallbackQuery(q.id, {
          text: "⚠️ Error occurred",
          show_alert: true
        });
      } catch (_) {}
    }
  });
};
