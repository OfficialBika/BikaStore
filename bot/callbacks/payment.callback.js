const { bot } = require("../bot");
const { Order } = require("../../models/Order");
const { PAYMENTS } = require("../../config/payments");
const { formatMMK } = require("../../utils/helpers");

bot.on("callback_query", async (q) => {
  const cid = q.message.chat.id;
  const uid = String(q.from.id);

  if (!q.data.startsWith("PAY_")) return;

  const method = q.data.replace("PAY_", "");
  const order = await Order.findOne({ userId: uid, status: "PENDING" }).sort({ createdAt: -1 });

  if (!order) {
    return bot.answerCallbackQuery(q.id, {
      text: "❌ Order not found or already submitted!",
      show_alert: true,
    });
  }

  const payment = PAYMENTS[method];
  if (!payment) {
    return bot.answerCallbackQuery(q.id, {
      text: "❌ Invalid payment method!",
      show_alert: true,
    });
  }

  order.paymentMethod = method;
  await order.save();

  const text = `💰 <b>Payment Method Selected</b>
━━━━━━━━━━━━━━━━━━
🏦 Method: <b>${method.toUpperCase()}</b>
👤 Name: <b>${payment.name}</b>
📱 Account: <b>${payment.accountNumber}</b>
💸 Amount: <b>${formatMMK(order.totalPrice)} MMK</b>
━━━━━━━━━━━━━━━━━━
📤 <b>ကျေးဇူးပြုပြီး ငွေလွှဲပြီးပါက Screenshot ကို ပို့ပေးပါ။</b>`;

  await bot.sendPhoto(cid, payment.qr, {
    caption: text,
    parse_mode: "HTML",
  });

  bot.answerCallbackQuery(q.id, { text: "✅ Payment method selected", show_alert: false });
});
