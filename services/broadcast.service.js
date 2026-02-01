// services/broadcast.service.js — Broadcast Helper for Bot Admins

const { bot } = require("../bot");
const { User } = require("../models/User");
const { Chat } = require("../models/Chat");

async function getBroadcastTargets() {
  const users = await User.find({}, { userId: 1 }).lean();
  const chats = await Chat.find({ type: { $in: ["group", "supergroup"] } }, { chatId: 1 }).lean();

  const targets = [
    ...users.map((u) => ({ chatId: u.userId })),
    ...chats.map((c) => ({ chatId: c.chatId })),
  ];

  return targets;
}

async function broadcastMessage({ text, buttons }) {
  const targets = await getBroadcastTargets();
  let ok = 0,
    fail = 0;

  for (const t of targets) {
    try {
      await bot.sendMessage(t.chatId, text, {
        parse_mode: "HTML",
        reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
        disable_web_page_preview: true,
      });
      ok++;
    } catch (_) {
      fail++;
    }
  }

  return { ok, fail, total: targets.length };
}

async function broadcastPhoto({ photoFileId, captionHTML, buttons }) {
  const targets = await getBroadcastTargets();
  let ok = 0,
    fail = 0;

  for (const t of targets) {
    try {
      await bot.sendPhoto(t.chatId, photoFileId, {
        caption: captionHTML,
        parse_mode: "HTML",
        reply_markup: buttons ? { inline_keyboard: buttons } : undefined,
      });
      ok++;
    } catch (_) {
      fail++;
    }
  }

  return { ok, fail, total: targets.length };
}

module.exports = {
  broadcastMessage,
  broadcastPhoto,
};
