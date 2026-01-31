// models/WinnerHistory.js — Record Giveaway Winners

const mongoose = require("mongoose");

const winnerHistorySchema = new mongoose.Schema( { giveawayPost: { type: mongoose.Schema.Types.ObjectId, ref: "GiveawayPost", required: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, reward: { type: String, required: true }, wonAt: { type: Date, default: Date.now }, }, { timestamps: true } );

module.exports = mongoose.model("WinnerHistory", winnerHistorySchema);
