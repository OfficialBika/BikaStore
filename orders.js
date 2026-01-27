// ===============================
// ORDERS LOGIC (Bika Store)
// ===============================

const Order = require("./models/Order");
const User = require("./models/User");
const ui = require("../ui/ui");

// ===============================
// CREATE ORDER (after payment photo)
// ===============================
async function createOrder({ bot, msg, temp, ADMIN_IDS }) {
  const chatId = msg.chat.id.toString();
  const t = temp[chatId];

  // 🛑 Anti duplicate (pending order)
  const exist = await Order.findOne({
    userId: chatId,
    status: "PENDING"
  });
  if (exist) {
    await bot.sendMessage(
      chatId,
      "⛔ *Pending Order ရှိပြီးသားပါ*\nAdmin approve ပြီးမှ အသစ်လုပ်နိုင်ပါတယ်",
      { parse_mode: "Markdown" }
    );
    return null;
  }

  // 🔗 user ref (important)
  const user = await User.findOne({ userId: chatId });

  // Create order
  const order = await Order.create({
    orderId: t.orderId,
    userId: chatId,
    userRef: user?._id,          // ⭐ JOIN KEY
    username: msg.from.username || msg.from.first_name,
    product: t.product,
    gameId: t.gameId,
    serverId: t.serverId,
    items: t.items,
    totalPrice: t.totalPrice,
    paymentMethod: t.paymentMethod,
    paymentPhoto: msg.photo.at(-1).file_id,
    status: "PENDING",
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  // USER UI
  const waitMsg = await ui.sendWaiting(bot, chatId, order.orderId);
  order.waitMsgId = waitMsg.message_id;

  // ADMIN UI
  for (const adminId of ADMIN_IDS) {
    const adminMsg = await bot.sendPhoto(
      adminId,
      order.paymentPhoto,
      {
        caption:
`📦 *NEW ORDER*
━━━━━━━━━━━━━━━
🆔 ${order.orderId}
👤 @${order.username}
🎮 ${order.product}
🆔 ${order.gameId} (${order.serverId})
💰 ${order.totalPrice.toLocaleString()} MMK`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `APPROVE_${order._id}` },
              { text: "❌ Reject",  callback_data: `REJECT_${order._id}` }
            ]
          ]
        }
      }
    );
    order.adminMsgId = adminMsg.message_id;
    order.adminChatId = adminId;
  }

  await order.save();
  delete temp[chatId];
  return order;
}

// ===============================
// APPROVE ORDER
// ===============================
async function approveOrder({ bot, orderId }) {
  const order = await Order.findById(orderId).populate("userRef");
  if (!order || order.status !== "PENDING") return;

  order.status = "COMPLETED";
  order.approvedAt = new Date();
  await order.save();

  // USER UI
  await ui.notifyUserApproved(bot, order);

  // ADMIN UI
  await ui.updateAdminMessage(bot, order, "APPROVED");
}

// ===============================
// REJECT ORDER
// ===============================
async function rejectOrder({ bot, orderId }) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "PENDING") return;

  order.status = "REJECTED";
  await order.save();

  // USER UI
  await ui.notifyUserRejected(bot, order);

  // ADMIN UI
  await ui.updateAdminMessage(bot, order, "REJECTED");
}

// ===============================
// STATS HELPERS
// ===============================
async function getStatusStats(isAdmin) {
  const total = await Order.countDocuments();
  const pending = await Order.countDocuments({ status: "PENDING" });

  return {
    role: isAdmin ? "👑 Admin" : "👤 User",
    total,
    pending
  };
}

async function getTop10(start, end) {
  return Order.aggregate([
    { $match: { status: "COMPLETED", approvedAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$userRef", total: { $sum: "$totalPrice" } } },
    { $sort: { total: -1 } },
    { $limit: 10 }
  ]);
}

async function getUserRank(userId, start, end) {
  const list = await Order.aggregate([
    { $match: { status: "COMPLETED", approvedAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$userId", total: { $sum: "$totalPrice" } } },
    { $sort: { total: -1 } }
  ]);

  const index = list.findIndex(u => u._id === userId);
  return index === -1 ? null : { rank: index + 1, total: list[index].total };
}

// ===============================
module.exports = {
  createOrder,
  approveOrder,
  rejectOrder,
  getStatusStats,
  getTop10,
  getUserRank
};
