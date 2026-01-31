services/orde// services/order.service.js — Order Flow Logic

const Order = require("../models/Order"); const User = require("../models/User");

module.exports = { async createOrder(userId, gameId, itemCode, itemName, price, quantity = 1) { const order = await Order.create({ userId, gameId, itemCode, itemName, price, quantity, }); return order; },

async markAsPaid(orderId, paymentMethod) { return await Order.findByIdAndUpdate( orderId, { isPaid: true, status: "paid", paymentMethod }, { new: true } ); },

async markAsDelivered(orderId) { return await Order.findByIdAndUpdate( orderId, { isDelivered: true, status: "delivered" }, { new: true } ); },

async savePaymentProof(telegramUserId, fileId) { const user = await User.findOne({ telegramId: telegramUserId }); if (!user) return;

const order = await Order.findOne({ userId: user._id, status: "pending" }).sort({ createdAt: -1 });
if (!order) return;

order.proofFileId = fileId;
order.status = "paid";
order.isPaid = true;
await order.save();

},

async getUserOrders(userId) { return await Order.find({ userId }).sort({ createdAt: -1 }); }, };r.service.js
