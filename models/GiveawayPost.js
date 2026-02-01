// models/GiveawayPost.js — Tracks forwarded giveaway post from channel/group

const mongoose = require("mongoose");

const giveawayPostSchema = new mongoose.Schema(
  {
    messageId: { type: Number, required: true }, // Telegram message ID
    chatId: { type: String, required: true },    // Channel or group chat ID
    forwardedByUserId: { type: String, required: true }, // The user who forwarded
    promoId: { type: mongoose.Schema.Types.ObjectId, ref: "Promo", required: true },
  },
  { timestamps: true }
);

giveawayPostSchema.index({ messageId: 1, chatId: 1 }, { unique: true });

module.exports = {
  GiveawayPost: mongoose.model("GiveawayPost", giveawayPostSchema),
};
