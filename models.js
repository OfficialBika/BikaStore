// models.js
// MongoDB models + helper functions

const mongoose = require("mongoose");
const { MONGODB_URI } = require("./config");

// Connect MongoDB
mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => console.log("🍃 MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Counter for auto-increment order id
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

// Order schema (MLBB / PUBG)
const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true }, // human-friendly order ID (#1, #2, ...)
  userId: { type: Number, index: true },
  username: String,
  firstName: String,
  categoryKey: String, // 'mlbb' | 'pubg'
  packageId: String,
  packageName: String,
  price: Number,
  currency: String,
  // MLBB & PUBG IDs
  gameId: String, // MLBB ID or PUBG ID
  serverId: String, // MLBB Server ID (empty for PUBG)
  status: { type: String, index: true }, // PENDING_PAYMENT, AWAITING_SLIP, PENDING_CONFIRMATION, COMPLETED, REJECTED, ...
  createdAt: Date,
  paidAt: Date,
  confirmedAt: Date,
  adminNote: String,
  paymentSlipFileId: String, // telegram file_id of slip
});

const Order = mongoose.model("Order", orderSchema);

async function getNextOrderId() {
  const counter = await Counter.findByIdAndUpdate(
    "order",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = {
  mongoose,
  Counter,
  Order,
  getNextOrderId,
};
