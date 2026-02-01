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
      text: "⛔️ မရှိတဲ့ Order ပါ။",
      show_alert: true,
    });
  }

  const pay = PAYMENTS[method];
  if (!pay) {
    return bot.answerCallbackQuery(q.id, {
      text: "❌ မမှန်ကန်တဲ့ Payment Method ဖြစ်ပါတယ်။",
      show_alert: true,
    });
  }

  order.paymentMethod = method;
  await order.save();

  const text = `💸 <b>ငွေပေးချေမှုအချက်အလက် (${method.toUpperCase()})</b>
━━━━━━━━━━━━━━━━━━
👤 အကောင့်အမည် — <b>${pay.name}</b>
📱 ဖုန်းနံပါတ် — <code>${pay.accountNumber}</code>
💰 ပေးရန်Totalငွေ — <b>${formatMMK(order.totalPrice)} MMK</b>
━━━━━━━━━━━━━━━━━━
🧾 <b>Order ID</b> — <code>${order._id}</code>

❗️ငွေလွှဲပြီးရင် Screenshot ကို ပေးပို့ပေးပါ။`;

  try {
    await bot.editMessageMedia(
      {
        type: "photo",
        media: pay.qr,
        caption: text,
        parse_mode: "HTML",
      },
      {
        chat_id: cid,
        message_id: q.message.message_id,
      }
    );
  } catch (_) {
    await bot.sendPhoto(cid, pay.qr, {
      caption: text,
      parse_mode: "HTML",
    });
  }

  bot.answerCallbackQuery(q.id, {
    text: "✅ ငွေချေမှုအချက်အလက် စီစစ်နေပါသည်။ခေတ္တစောင့်ပါ",
    show_alert: true,
  });
});
