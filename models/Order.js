// models/Order.js — Order Schema (MLBB, PUBG, etc.)

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    username: String,
    firstName: String,

    game: { type: String, enum: ["MLBB", "PUBG"], required: true },
    gameId: String,
    serverId: String,

    items: [
      {
        name: String,
        qty: Number,
        unitPrice: Number,
        total: Number,
      },
    ],

    totalPrice: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ["kpay", "wavepay"],
      required: true,
    },
    paid: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "REJECTED"],
      default: "PENDING",
    },

    screenshotFileId: String, // Telegram File ID
    rejectReason: String,
    completedAt: Date,
  },
  { timestamps: true }
);

module.exports = {
  Order: mongoose.model("Order", orderSchema),
};
