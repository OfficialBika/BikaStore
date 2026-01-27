// ===============================
// ORDERS DOMAIN LOGIC
// ===============================

const Order = require("./models/Order");

/*
|--------------------------------------------------------------------------
| 1️⃣ CREATE ORDER
|--------------------------------------------------------------------------
| Payment photo received -> DB only
*/
async function createOrder(data) {
  const order = await Order.create({
    orderId: data.orderId,
    userId: data.userId,
    username: data.username,

    product: data.product,
    gameId: data.gameId,
    serverId: data.serverId,

    items: data.items,
    totalPrice: data.totalPrice,

    paymentMethod: data.paymentMethod,
    paymentPhoto: data.paymentPhoto,

    userMsgId: data.userMsgId,
    waitMsgId: data.waitMsgId,

    status: "PENDING",
    approvedAt: null,

    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  return order;
}

/*
|--------------------------------------------------------------------------
| 2️⃣ ANTI-DUPLICATE ORDER CHECK
|--------------------------------------------------------------------------
| Same user + same gameId + serverId
| PENDING within last X minutes
*/
async function hasPendingDuplicate({
  userId,
  gameId,
  serverId,
  minutes = 5
}) {
  const timeLimit = new Date(Date.now() - minutes * 60 * 1000);

  return Order.exists({
    userId,
    gameId,
    serverId,
    status: "PENDING",
    createdAt: { $gte: timeLimit }
  });
}

/*
|--------------------------------------------------------------------------
| 3️⃣ APPROVE ORDER (ADMIN)
|--------------------------------------------------------------------------
*/
async function approveOrder(orderMongoId) {
  return Order.findOneAndUpdate(
    { _id: orderMongoId, status: "PENDING" },
    {
      $set: {
        status: "COMPLETED",
        approvedAt: new Date()
      }
    },
    { new: true }
  );
}

/*
|--------------------------------------------------------------------------
| 4️⃣ REJECT ORDER (ADMIN)
|--------------------------------------------------------------------------
*/
async function rejectOrder(orderMongoId) {
  return Order.findOneAndUpdate(
    { _id: orderMongoId, status: "PENDING" },
    {
      $set: { status: "REJECTED" }
    },
    { new: true }
  );
}

/*
|--------------------------------------------------------------------------
| 5️⃣ GET ORDER BY ID
|--------------------------------------------------------------------------
*/
async function getOrderById(orderMongoId) {
  return Order.findById(orderMongoId);
}

/*
|--------------------------------------------------------------------------
| 6️⃣ MONTH RANGE HELPER
|--------------------------------------------------------------------------
*/
function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

/*
|--------------------------------------------------------------------------
| 7️⃣ TOP 10 USERS (MONTH)
|--------------------------------------------------------------------------
*/
async function getTop10Users(date) {
  const { start, end } = getMonthRange(date);

  return Order.aggregate([
    {
      $match: {
        status: "COMPLETED",
        approvedAt: { $gte: start, $lt: end }
      }
    },
    {
      $group: {
        _id: "$userId",
        total: { $sum: "$totalPrice" }
      }
    },
    { $sort: { total: -1 } },
    { $limit: 10 }
  ]);
}

/*
|--------------------------------------------------------------------------
| 8️⃣ USER RANK (MONTH)
|--------------------------------------------------------------------------
*/
async function getUserRank(userId, date) {
  const { start, end } = getMonthRange(date);

  const list = await Order.aggregate([
    {
      $match: {
        status: "COMPLETED",
        approvedAt: { $gte: start, $lt: end }
      }
    },
    {
      $group: {
        _id: "$userId",
        total: { $sum: "$totalPrice" }
      }
    },
    { $sort: { total: -1 } }
  ]);

  const index = list.findIndex(u => u._id === userId);
  if (index === -1) return null;

  return {
    rank: index + 1,
    total: list[index].total
  };
}

/*
|--------------------------------------------------------------------------
| 9️⃣ ADMIN DASHBOARD STATS
|--------------------------------------------------------------------------
*/
async function getAdminStats() {
  const totalOrders = await Order.countDocuments();
  const pendingOrders = await Order.countDocuments({ status: "PENDING" });
  const completedOrders = await Order.countDocuments({ status: "COMPLETED" });

  return {
    totalOrders,
    pendingOrders,
    completedOrders
  };
}

/*
|--------------------------------------------------------------------------
| 🔟 USER ORDER HISTORY
|--------------------------------------------------------------------------
*/
async function getUserOrders(userId, limit = 10) {
  return Order.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/
module.exports = {
  createOrder,
  hasPendingDuplicate,

  approveOrder,
  rejectOrder,
  getOrderById,

  getTop10Users,
  getUserRank,

  getAdminStats,
  getUserOrders
};
