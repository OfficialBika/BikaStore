// models/User.js — Telegram User Schema

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema( { telegramId: { type: Number, required: true, unique: true }, username: String, firstName: String, lastName: String, languageCode: String, isBot: { type: Boolean, default: false },

level: { type: Number, default: 1 },
totalSpent: { type: Number, default: 0 },

isAdmin: { type: Boolean, default: false },
lastActiveAt: { type: Date, default: Date.now },

}, { timestamps: true } );

module.exports = mongoose.model("User", userSchema);
