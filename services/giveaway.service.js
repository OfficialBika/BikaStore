// services/giveaway.service.js — Giveaway Logic Handler

const GiveawayPost = require("../models/GiveawayPost"); const GiveawayEntry = require("../models/GiveawayEntry"); const WinnerHistory = require("../models/WinnerHistory"); const User = require("../models/User");

module.exports = { async handleGiveawayEntry(channelPost) { const { message_id, chat, text } = channelPost;

const existing = await GiveawayPost.findOne({ messageId: message_id, channelId: chat.id });
if (existing) return;

await GiveawayPost.create({
  messageId: message_id,
  channelId: chat.id,
  hashtag: "#BIKA_GIVEAWAY",
  postText: text,
});

},

async enterGiveaway(postId, userId) { const entry = await GiveawayEntry.findOne({ giveawayPost: postId, user: userId }); if (entry) return; // already entered

await GiveawayEntry.create({ giveawayPost: postId, user: userId });
await GiveawayPost.findByIdAndUpdate(postId, {
  $inc: { entryCount: 1 },
  $addToSet: { participants: userId },
});

},

async pickWinner(postId) { const post = await GiveawayPost.findById(postId).populate("participants"); if (!post || post.participants.length === 0) throw new Error("No participants");

const winnerIndex = Math.floor(Math.random() * post.participants.length);
const winner = post.participants[winnerIndex];

const history = await WinnerHistory.create({
  giveawayPost: postId,
  user: winner._id,
  reward: post.reward || "Unknown Reward",
});

return winner;

},

async getWinnerHistory(groupId) { return await WinnerHistory.find() .populate("user") .populate("giveawayPost") .sort({ createdAt: -1 }); }, };
