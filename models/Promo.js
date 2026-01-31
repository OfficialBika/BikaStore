// models/Promo.js — Promo Code Schema

const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema( { code: { type: String, required: true, unique: true }, reward: { type: String, required: true }, // e.g. '100 Diamonds', '1-Week Premium'

maxUse: { type: Number, default: 1 },
usedCount: { type: Number, default: 0 },

expiresAt: { type: Date },
active: { type: Boolean, default: true },

createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

}, { timestamps: true } );

module.exports = mongoose.model("Promo", promoSchema);
