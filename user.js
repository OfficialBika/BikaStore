const User = require("./models/User");
const Order = require("./models/Order");

// /start → create or update user
async function upsertUser(from) {
  return User.findOneAndUpdate(
    { userId: String(from.id) },
    {
      $set: {
        username: from.username || "",
        firstName: from.first_name || "",
        lastName: from.last_name || "",
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true, new: true }
  );
}

// /status (user view only)
async function getUserStatus(userId) {
  const totalOrders = await Order.countDocuments({ userId });
  const completed = await Order.countDocuments({
    userId,
    status: "COMPLETED"
  });

  return {
    totalOrders,
    completed
  };
}

// /myrank
async function getUserRank(userId, start, end) {
  const list = await Order.aggregate([
    { $match: { status: "COMPLETED", approvedAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$userId", total: { $sum: "$totalPrice" } } },
    { $sort: { total: -1 } }
  ]);

  const index = list.findIndex(u => u._id === userId);
  if (index === -1) return null;

  return {
    rank: index + 1,
    total: list[index].total
  };
}

module.exports = {
  upsertUser,
  getUserStatus,
  getUserRank
};
