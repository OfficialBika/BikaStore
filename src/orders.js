const Order = require("./models/order");
const ui = require("./ui");

async function createOrder({ bot, msg, session, ADMIN_IDS }) {
  const chatId = String(msg.chat.id);
  const t = session[chatId];
  const photo = msg.photo?.at(-1);
  if (!photo) return;

  const order = await Order.create({
    orderId: t.orderId,
    userId: chatId,
    product: t.game,
    gameId: t.game_id,
    serverId: t.server_id,
    amount: t.amount,
    totalPrice: t.totalPrice,
    paymentMethod: t.paymentMethod,
    paymentPhoto: photo.file_id,
    status: "PENDING"
  });

  await ui.sendWaiting(bot, chatId, order.orderId);

  for (const adminId of ADMIN_IDS) {
    await bot.sendPhoto(adminId, order.paymentPhoto, {
      caption: `📦 Order ${order.orderId}`,
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
          { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
        ]]
      }
    });
  }

  delete session[chatId];
}

async function approveOrder({ bot, orderId }) {
  const order = await Order.findOneAndUpdate(
    { orderId },
    { status: "COMPLETED" },
    { new: true }
  );
  if (!order) return;
  await ui.notifyUserApproved(bot, order);
}

async function rejectOrder({ bot, orderId }) {
  const order = await Order.findOneAndUpdate(
    { orderId },
    { status: "REJECTED" },
    { new: true }
  );
  if (!order) return;
  await ui.notifyUserRejected(bot, order);
}

module.exports = {
  createOrder,
  approveOrder,
  rejectOrder
};
