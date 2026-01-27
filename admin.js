const Order = require("./models/Order");

// permission
function isAdmin(chatId, adminIds) {
  return adminIds.includes(String(chatId));
}

// approve
async function approveOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "PENDING") return null;

  order.status = "COMPLETED";
  order.approvedAt = new Date();
  await order.save();

  return order;
}

// reject
async function rejectOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== "PENDING") return null;

  order.status = "REJECTED";
  await order.save();

  return order;
}

// admin dashboard stats (later)
async function getAdminStats() {
  const total = await Order.countDocuments();
  const pending = await Order.countDocuments({ status: "PENDING" });
  return { total, pending };
}

module.exports = {
  isAdmin,
  approveOrder,
  rejectOrder,
  getAdminStats
};
