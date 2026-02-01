// models/User.js — User Schema

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    username: String,
    firstName: String,
    lastName: String,
    languageCode: String,
    isBot: Boolean,
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model("User", userSchema),
};
