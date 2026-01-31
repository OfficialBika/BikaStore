// bot/handlers/winnerlist.js — Handle /winnerlist Command (Styled History)

const { bot } = require("../bot"); const { WinnerHistory } = require("../../models/WinnerHistory"); const { escapeHTML } = require("../../utils/helpers"); const { touchUser, touchChat } = require("../../services/user.service");

bot.onText(//winnerlist\b/, async (msg) => { const chatId = msg.chat.id;

await touchUser(msg.from); await touchChat(msg.chat);

if (!(msg.chat.type === "group" || msg.chat.type === "supergroup")) { return bot.sendMessage(chatId, "ℹ️ /winnerlist ကို group/supergroup ထဲမှာပဲ သုံးနိုင်ပါတယ်။"); }

const groupChatId = String(chatId);

const rows = await WinnerHistory.find({ groupChatId }) .sort({ pickedAt: -1 }) .limit(20) .lean();

if (!rows.length) { return bot.sendMessage(chatId, "📭 ဒီ group မှာ Winner History မရှိသေးပါ။"); }

const lines = rows.map((w, i) => { const n = rows.length - i; const who = w.winnerUsername ? @${escapeHTML(w.winnerUsername)} : <b>${escapeHTML(w.winnerName || "Winner")}</b>; const when = new Date(w.pickedAt).toLocaleString("en-GB"); return ( 🏆 <b>Winner #${n}</b>\n + 👤 ${who}\n + 💬 <i>${escapeHTML(w.winnerComment || "")}</i>\n + 🕒 <code>${escapeHTML(when)}</code> ); }).join("\n\n━━━━━━━━━━━━━━\n\n");

const text = `📜 <b>Winners History</b> <i>(Latest 20 from this group)</i> ━━━━━━━━━━━━━━

${lines}`;

await bot.sendMessage(chatId, text, { parse_mode: "HTML" }); });
