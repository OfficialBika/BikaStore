// bot/handlers/winnerlist.js — Giveaway Winner History (this group)

const { bot } = require("../bot");
const { WinnerHistory } = require("../../models/WinnerHistory");
const { escapeHTML, formatMMK } = require("../../utils/helpers");
const { touchUser, touchChat } = require("../../services/user.service");

bot.onText(/\/winnerlist/, async (msg) => {
  const cid = msg.chat.id;

  await touchUser(msg.from);
  await touchChat(msg.chat);

  const rows = await WinnerHistory.find({ chatId: cid }).sort({ pickedAt: -1 }).limit(20);

  if (!rows.length) {
    return bot.sendMessage(cid, "<b>📭 ဒီ Group မှာ Winner မရှိသေးပါ။</b>", {
      parse_mode: "HTML",
    });
  }

  const lines = rows.map((w, i) => {
    const username = w.username ? `@${escapeHTML(w.username)}` : escapeHTML(w.firstName || "User");
    const date = w.pickedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
    return `🏆 <b>#${i + 1}</b> — ${username}\n🕒 <code>${date}</code>`;
  });

  const text = `<b>🎯 GIVEAWAY WINNERS</b>\n<i>Last 20 winners in this group</i>\n━━━━━━━━━━━━━━━━━━━━━━\n\n${lines.join("\n\n")}`;

  await bot.sendMessage(cid, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
});
