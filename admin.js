// ===============================
// ADMIN COMMANDS & LOGIC (FINAL)
// ===============================

const orders = require("./orders");
const ui = require("./ui");
const User = require("./models/User");
const { isAdmin } = require("./helpers");

// ===============================
// /status (admin & user)
// ===============================
async function statusCommand(bot, msg) {
  const chatId = msg.chat.id;

  const admin = isAdmin(msg.from.id);
  const stats = await orders.getStatusStats(admin);

  return bot.sendMessage(
    chatId,
    ui.statusUI(stats),
    { parse_mode: "Markdown" }
  );
}

// ===============================
// /top10 (admin only)
// ===============================
async function top10Command(bot, msg) {
  if (!isAdmin(msg.from.id)) return;

  const chatId = msg.chat.id;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  end.setDate(1);
  end.setHours(0, 0, 0, 0);

  const list = await orders.getTop10(start, end);

  if (!list.length) {
    return bot.sendMessage(chatId, "📭 No data yet");
  }

  return bot.sendMessage(
    chatId,
    ui.top10UI(list),
    { parse_mode: "Markdown" }
  );
}

// ===============================
// /myrank (user)
// ===============================
async function myRankCommand(bot, msg) {
  const chatId = msg.chat.id.toString();

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  end.setDate(1);
  end.setHours(0, 0, 0, 0);

  const rank = await orders.getUserRank(chatId, start, end);

  if (!rank) {
    return bot.sendMessage(chatId, "❌ You are not ranked yet");
  }

  return bot.sendMessage(
    chatId,
    ui.myRankUI(rank.rank, rank.total),
    { parse_mode: "Markdown" }
  );
}

// ===============================
// ADMIN MANUAL ROLE (optional)
// ===============================
async function promoteAdmin(userId) {
  return User.findOneAndUpdate(
    { userId: String(userId) },
    { role: "ADMIN" },
    { new: true }
  );
}

// ===============================
module.exports = {
  statusCommand,
  top10Command,
  myRankCommand,
  promoteAdmin
};
