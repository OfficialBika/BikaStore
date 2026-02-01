// models/WinnerHistory.js — History log of winners

const mongoose = require("mongoose");

const winnerHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },           // Telegram user ID
    username: { type: String },                         // Telegram @username
    firstName: { type: String },
    promoId: { type: mongoose.Schema.Types.ObjectId, ref: "Promo" },
    promoTitle: { type: String },
    wonAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = {
  WinnerHistory: mongoose.model("WinnerHistory", winnerHistorySchema),
};
