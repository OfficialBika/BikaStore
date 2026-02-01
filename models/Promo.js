// models/Promo.js — Giveaway Promo Schema

const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    active: { type: Boolean, default: true },
    claimed: { type: Boolean, default: false },
    stage: {
      type: String,
      enum: ["OPEN", "CLAIMED", "DONE"],
      default: "OPEN",
    },

    // Winner Info
    winnerUserId: String,
    winnerUsername: String,
    winnerFirstName: String,

    expireAt: { type: Date, required: true },
  },
  { timestamps: true }
);

promoSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = {
  Promo: mongoose.model("Promo", promoSchema),
};
