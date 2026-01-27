// ===============================
// ORDER MODEL (FINAL)
// ===============================

const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    // ===============================
    // BASIC INFO
    // ===============================
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    userId: {
      type: String,
      required: true,
      index: true
    },

    // 🔗 Reference to User collection
    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    username: {
      type: String
    },

    // ===============================
    // PRODUCT INFO
    // ===============================
    product: {
      type: String,
      required: true
    },

    gameId: {
      type: String,
      required: true
    },

    serverId: {
      type: String
    },

    items: [
      {
        name: String,
        price: Number
      }
    ],

    totalPrice: {
      type: Number,
      required: true
    },

    // ===============================
    // PAYMENT INFO
    // ===============================
    paymentMethod: {
      type: String,
      required: true
    },

    paymentPhoto: {
      type: String,
      required: true
    },

    // ===============================
    // ADMIN UI TRACKING
    // ===============================
    adminChatId: {
      type: String
    },

    adminMsgId: {
      type: Number
    },

    // ===============================
    // USER UI TRACKING
    // ===============================
    waitMsgId: {
      type: Number
    },

    // ===============================
    // ORDER STATUS
    // ===============================
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "REJECTED"],
      default: "PENDING",
      index: true
    },

    approvedAt: {
      type: Date
    },

    // ===============================
    // AUTO CLEAN
    // ===============================
    expireAt: {
      type: Date,
      index: { expireAfterSeconds: 0 }
    }
  },
  {
    timestamps: true
  }
);

// ===============================
// EXPORT
// ===============================
module.exports = mongoose.model("Order", OrderSchema);
