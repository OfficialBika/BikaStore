// models/Chat.js — Chat Schema (Group / Private)

const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true, unique: true },
    type: { type: String, enum: ["private", "group", "supergroup", "channel"] },
    title: String, // for groups/channels
    username: String,
    inviteLink: String,
  },
  { timestamps: true }
);

module.exports = {
  Chat: mongoose.model("Chat", chatSchema),
};
