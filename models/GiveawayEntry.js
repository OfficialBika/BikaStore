// models/GiveawayEntry.js — Tracks each user's forwarded entry for promo

const mongoose = require("mongoose");

const giveawayEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // Telegram user ID
    promoId: { type: mongoose.Schema.Types.ObjectId, ref: "Promo", required: true },
    forwardedFromChatId: { type: String, required: true }, // Where did they forward from (channel/group)
    messageId: { type: Number, required: true }, // The forwarded message ID
    entryAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

giveawayEntrySchema.index({ userId: 1, promoId: 1 }, { unique: true });

module.exports = {
  GiveawayEntry: mongoose.model("GiveawayEntry", giveawayEntrySchema),
};
