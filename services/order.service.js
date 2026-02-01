// services/order.service.js — Order creation, listing, status change

const { Order } = require("../models/Order");
const { Counter } = require("../models/Counter");

async function getNextOrderNo() {
  const counter = await Counter.findOneAndUpdate(
    { name: "order" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

async function createOrder({
  userId,
  username,
  firstName,
  game,
  gameId,
  serverId,
  items,
  totalPrice,
  method,
}) {
  const orderNo = await getNextOrderNo();

  const order = await Order.create({
    userId,
    username,
    firstName,
    orderNo,
    game,
    gameId,
    serverId,
    items,
    totalPrice,
    paymentMethod: method,
    status: "PENDING",
  });

  return order;
}

async function completeOrder(orderId) {
  return Order.findByIdAndUpdate(orderId, {
    status: "COMPLETED",
    completedAt: new Date(),
  });
}

async function rejectOrder(orderId) {
  return Order.findByIdAndUpdate(orderId, {
    status: "REJECTED",
    rejectedAt: new Date(),
  });
}

module.exports = {
  createOrder,
  completeOrder,
  rejectOrder,
};
