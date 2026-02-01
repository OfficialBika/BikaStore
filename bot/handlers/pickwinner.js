// bot/handlers/pickwinner.js — Admin Only Giveaway Winner Picker

const { bot } = require("../bot");
const { GiveawayEntry } = require("../../models/GiveawayEntry");
const { GiveawayPost } = require("../../models/GiveawayPost");
const { WinnerHistory } = require("../../models/WinnerHistory");
const { isAdminUser } = require("../../services/user.service");
const { formatMMK, escapeHTML } = require("../../utils/helpers");

bot.onText(/\/pickwinner/, async (msg) => {
  const cid = msg.chat.id;
  const uid = String(msg.from.id);

  if (!isAdminUser(uid)) return;

  const post = await GiveawayPost.findOne({ chatId: cid }).sort({ createdAt: -1 });
  if (!post) {
    return bot.sendMessage(cid, "📭 No giveaway post found for this group.", {
      parse_mode: "HTML",
    });
  }

  const entries = await GiveawayEntry.find({ postId: post._id });
  if (!entries.length) {
    return bot.sendMessage(cid, "😢 No entries yet. Try again later.", {
      parse_mode: "HTML",
    });
  }

  // Randomly pick one
  const winner = entries[Math.floor(Math.random() * entries.length)];
  const winnerText = `🎉 <b>Giveaway Winner</b>\n\n👤 ${escapeHTML(winner.firstName)}\n🆔 <code>${winner.userId}</code>`;

  // Save to history
  await WinnerHistory.create({
    userId: winner.userId,
    firstName: winner.firstName,
    username: winner.username,
    chatId: cid,
    postId: post._id,
    pickedAt: new Date(),
  });

  await bot.sendMessage(cid, winnerText, { parse_mode: "HTML" });
});
