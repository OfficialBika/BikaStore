// models/GiveawayPost.js — Channel Giveaway Post Schema

const mongoose = require("mongoose");

const giveawayPostSchema = new mongoose.Schema( { messageId: { type: Number, required: true }, channelId: { type: Number, required: true }, hashtag: { type: String }, reward: { type: String },

postText: { type: String },
participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
entryCount: { type: Number, default: 0 },
endsAt: { type: Date },

createdAt: { type: Date, default: Date.now },

}, { timestamps: true } );

module.exports = mongoose.model("GiveawayPost", giveawayPostSchema);
