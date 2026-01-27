// ===============================
// USER MODEL (FINAL)
// ===============================

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    // ===============================
    // TELEGRAM INFO
    // ===============================
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

    // ===============================
    // USER STATS
    // ===============================
    totalOrders: {
      type: Number,
      default: 0
    },

    completedOrders: {
      type: Number,
      default: 0
    },

    totalSpent: {
      type: Number,
      default: 0
    },

    // ===============================
    // ROLE
    // ===============================
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
      index: true
    }
  },
  {
    timestamps: true
  }
);

// ===============================
// EXPORT
// ===============================
module.exports = mongoose.model("User", UserSchema);
