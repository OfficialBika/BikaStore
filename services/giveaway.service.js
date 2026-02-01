// services/giveaway.service.js — Giveaway Logic & Utilities

const { GiveawayPost } = require("../models/GiveawayPost");
const { GiveawayEntry } = require("../models/GiveawayEntry");
const { WinnerHistory } = require("../models/WinnerHistory");

// Create a giveaway post (messageId, photoId, caption)
async function createGiveawayPost(data) {
  const post = new GiveawayPost(data);
  await post.save();
  return post;
}

// Add entry (userId, username, firstName)
async function addGiveawayEntry({ giveawayId, userId, username, firstName }) {
  const entry = new GiveawayEntry({ giveawayId, userId, username, firstName });
  await entry.save();
  return entry;
}

// Check if already entered
async function hasEntered(giveawayId, userId) {
  const existing = await GiveawayEntry.findOne({ giveawayId, userId });
  return !!existing;
}

// Pick a winner randomly
async function pickWinner(giveawayId) {
  const entries = await GiveawayEntry.find({ giveawayId });
  if (!entries.length) return null;

  const winner = entries[Math.floor(Math.random() * entries.length)];
  const history = new WinnerHistory({
    giveawayId,
    userId: winner.userId,
    username: winner.username,
    firstName: winner.firstName,
    pickedAt: new Date(),
  });
  await history.save();
  return winner;
}

// Clear giveaway data
async function clearGiveaway(giveawayId) {
  await GiveawayEntry.deleteMany({ giveawayId });
  await GiveawayPost.deleteOne({ _id: giveawayId });
}

module.exports = {
  createGiveawayPost,
  addGiveawayEntry,
  hasEntered,
  pickWinner,
  clearGiveaway,
};
