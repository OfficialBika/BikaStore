// models/Chat.js — Telegram Chat Schema

const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema( { chatId: { type: Number, required: true, unique: true }, title: String, type: String, username: String, inviteLink: String,

isGroup: { type: Boolean, default: true },
memberCount: Number,
lastMessageAt: { type: Date, default: Date.now },

}, { timestamps: true } );

module.exports = mongoose.model("Chat", chatSchema);
