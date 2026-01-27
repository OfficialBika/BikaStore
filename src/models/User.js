// ===============================
// USER MODEL (Bika Store - FINAL)
// ===============================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Telegram User ID
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    username: {
      type: String,
      default: ""
    },

    firstName: {
      type: String,
      default: ""
    },

    lastName: {
      type: String,
      default: ""
    },

    // Stats (optional but useful)
    totalOrders: {
      type: Number,
      default: 0
    },

    totalSpent: {
      type: Number,
      default: 0
    },

    // Role (future use)
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER"
    }
  },
  {
    timestamps: true // createdAt / updatedAt
  }
);

// ===============================
// INDEXES
// ===============================
userSchema.index({ totalSpent: -1 });

// ===============================
module.exports = mongoose.model("User", userSchema);
