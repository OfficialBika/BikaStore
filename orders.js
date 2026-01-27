// ===============================
// ORDERS LOGIC (BIKA STORE - FINAL)
// ===============================

const Order = require("./src/models/order");
const User  = require("./src/models/User");
const ui    = require("./ui");

// ===============================
// UTILS
// ===============================
function escapeMd(text = "") {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ===============================
// CREATE ORDER (after payment photo)
// ===============================
async function createOrder({ bot, msg, temp, ADMIN_IDS }) {
  const chatId = msg.chat.id.toString();
  const t = temp[chatId];

  if (!t) {
    await bot.sendMessage(chatId, "❌ Session expired. /start again");
    return null;
  }

  // 🛑 Anti duplicate pending order
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

  // 🖼 Payment photo safe check
  const photo = msg.photo?.[msg.photo.length - 1];
  if (!photo) {
    await bot.sendMessage(chatId, "❌ Payment screenshot မတွေ့ပါ");
    return null;
  }

  // 🔗 user reference
  const user = await User.findOne({ userId: chatId });

  // ===============================
  // CREATE ORDER (DB)
  // ===============================
  const order = await Order.create({
    orderId: t.orderId,
    userId: chatId,
    userRef: user?._id || null,
    username: msg.from.username || msg.from.first_name || "",
    product: t.product,
    gameId: t.gameId,
    serverId: t.serverId,
    items: t.items,
    totalPrice: t.totalPrice,
    paymentMethod: t.paymentMethod,
    paymentPhoto: photo.file_id,
    status: "PENDING",
    adminMessages: [],
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  // ===============================
  // USER UI (WAITING)
  // ===============================
  const waitMsg = await ui.sendWaiting(bot, chatId, order.orderId);
  order.waitMsgId = waitMsg.message_id;

  // ===============================
  // ADMIN UI (MULTI ADMIN SAFE)
  // ===============================
  for (const adminId of ADMIN_IDS) {
    try {
      const adminMsg = await bot.sendPhoto(
        adminId,
        order.paymentPhoto,
        {
          caption:
`📦 *NEW ORDER*
━━━━━━━━━━━━━━━
🆔 ${escapeMd(order.orderId)}
👤 @${escapeMd(order.username)}
🎮 ${escapeMd(order.product)}
🆔 ${escapeMd(order.gameId)} (${escapeMd(order.serverId)})
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

      order.adminMessages.push({
        chatId: adminId,
        messageId: adminMsg.message_id
      });
    } catch (e) {
      console.error("Admin send failed:", adminId);
    }
  }

  await order.save();
  delete temp[chatId];
  return order;
}

// ===============================
// APPROVE ORDER (ATOMIC)
// ===============================
async function approveOrder({ bot, orderId }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "PENDING" },
    { status: "COMPLETED", approvedAt: new Date() },
    { new: true }
  ).populate("userRef");

  if (!order) return;

  // USER UI
  try {
    await ui.notifyUserApproved(bot, order);
  } catch {}

  // ADMIN UI (ALL ADMINS)
  for (const m of order.adminMessages || []) {
    try {
      await ui.updateAdminMessage(bot, {
        adminChatId: m.chatId,
        adminMsgId: m.messageId
      }, "APPROVED");
    } catch {}
  }
}

// ===============================
// REJECT ORDER (ATOMIC)
// ===============================
async function rejectOrder({ bot, orderId }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "PENDING" },
    { status: "REJECTED" },
    { new: true }
  );

  if (!order) return;

  // USER UI
  try {
    await ui.notifyUserRejected(bot, order);
  } catch {}

  // ADMIN UI
  for (const m of order.adminMessages || []) {
    try {
      await ui.updateAdminMessage(bot, {
        adminChatId: m.chatId,
        adminMsgId: m.messageId
      }, "REJECTED");
    } catch {}
  }
}

// ===============================
// STATS
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
