const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true
    },

    userId: {
      type: String,
      required: true
    },

    userRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    username: String,

    product: {
      type: String,
      required: true
    },

    gameId: String,
    serverId: String,

    items: {
      type: Array,
      default: []
    },

    totalPrice: {
      type: Number,
      required: true
    },

    paymentMethod: String,
    paymentPhoto: String,

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "REJECTED"],
      default: "PENDING"
    },

    waitMsgId: Number,
    adminMsgId: Number,
    adminChatId: String,

    approvedAt: Date,

    expireAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
