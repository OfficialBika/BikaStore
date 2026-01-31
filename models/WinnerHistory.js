// models/GiveawayEntry.js — Individual Entry Schema for Giveaways

const mongoose = require("mongoose");

const giveawayEntrySchema = new mongoose.Schema( { giveawayPost: { type: mongoose.Schema.Types.ObjectId, ref: "GiveawayPost", required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

enteredAt: { type: Date, default: Date.now },

}, { timestamps: true } );

giveawayEntrySchema.index({ giveawayPost: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("GiveawayEntry", giveawayEntrySchema);
