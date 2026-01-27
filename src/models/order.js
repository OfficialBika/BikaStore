// ===============================
// ORDER MODEL (Bika Store - FINAL)
// ===============================

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // Public Order ID (BKS-xxxx)
    orderId: {
      type: String,
      required: true,
      unique: true
    },

    // Telegram User ID
    userId: {
      type: String,
      required: true,
      index: true
    },

    // Mongo User Ref (JOIN)
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    username: {
      type: String,
      default: ""
    },

    // Product Info
    product: {
      type: String,
      required: true,
      enum: ["MLBB", "PUBG"]
    },

    gameId: {
      type: String,
      required: true
    },

    serverId: {
      type: String,
      default: ""
    },

    // Selected items (from prices.js)
    items: {
      type: Array,
      default: []
    },

    totalPrice: {
      type: Number,
      required: true
    },

    // Payment
    paymentMethod: {
      type: String,
      required: true
    },

    paymentPhoto: {
      type: String,
      required: true
    },

    // Order Status
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "REJECTED"],
      default: "PENDING",
      index: true
    },

    // Telegram message references
    waitMsgId: Number,
    adminMsgId: Number,
    adminChatId: String,

    // Dates
    approvedAt: Date,
    expireAt: Date
  },
  {
    timestamps: true // createdAt / updatedAt
  }
);

// ===============================
// INDEXES (performance)
// ===============================
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ approvedAt: 1 });

// ===============================
module.exports = mongoose.model("Order", orderSchema);
