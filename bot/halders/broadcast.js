// bot/handlers/broadcast.js — Handle /broadcast Command (Admin: text + photo + inline)

const { bot } = require("../bot"); const { escapeHTML, formatMMK } = require("../../utils/helpers"); const { User } = require("../../models/User"); const { Chat } = require("../../models/Chat"); const { isAdminUser } = require("../../services/user.service");

async function broadcastToAll({ text, photoFileId, captionHTML, buttons }) { const users = await User.find({}, { userId: 1 }).lean(); const chats = await Chat.find({ type: { $in: ["group", "supergroup"] } }, { chatId: 1 }).lean();

const targets = [ ...users.map(u => ({ chatId: u.userId })), ...chats.map(c => ({ chatId: c.chatId })), ];

let ok = 0, fail = 0; for (const t of targets) { try { const opts = { parse_mode: "HTML", reply_markup: buttons ? { inline_keyboard: buttons } : undefined, disable_web_page_preview: true };

if (photoFileId) {
    await bot.sendPhoto(t.chatId, photoFileId, {
      caption: captionHTML || "",
      ...opts
    });
  } else {
    await bot.sendMessage(t.chatId, text, opts);
  }
  ok++;
} catch (_) {
  fail++;
}

} return { ok, fail, total: targets.length }; }

bot.on("message", async (msg) => { const cid = msg.chat.id; const uid = msg.from.id;

if (!isAdminUser(uid)) return;

// TEXT broadcast with optional inline buttons if (msg.text && msg.text.startsWith("/broadcast")) { const [, ...rest] = msg.text.split("\n"); const firstLine = rest.shift()?.trim() || ""; const buttons = rest .filter(l => l.includes("|")) .map(l => l.split("|").map(t => t.trim())) .map(([label, url]) => [{ text: label, url }]);

const body = firstLine;
if (!body) {
  return bot.sendMessage(cid, "Usage: <code>/broadcast\nMessage\nGoogle|https://google.com</code>", { parse_mode: "HTML" });
}

const status = await bot.sendMessage(cid, "📣 Broadcasting…", { parse_mode: "HTML" });
const res = await broadcastToAll({ text: body, buttons });

const report =

✅ <b>Broadcast Complete</b> ━━━━━━━━━━━━━━ 📤 Sent: <b>${formatMMK(res.ok)}</b> ❌ Failed: <b>${formatMMK(res.fail)}</b> 👥 Total: <b>${formatMMK(res.total)}</b>;

await bot.editMessageText(report, {
  chat_id: cid,
  message_id: status.message_id,
  parse_mode: "HTML"
});

}

// PHOTO broadcast with caption and buttons if (msg.photo && msg.caption && msg.caption.startsWith("/broadcast")) { const [, ...rest] = msg.caption.split("\n"); const firstLine = rest.shift()?.trim() || ""; const buttons = rest .filter(l => l.includes("|")) .map(l => l.split("|").map(t => t.trim())) .map(([label, url]) => [{ text: label, url }]);

const fileId = msg.photo.at(-1)?.file_id;
const body = firstLine;
if (!fileId || !body) return;

const status = await bot.sendMessage(cid, "📣 Broadcasting photo…", { parse_mode: "HTML" });
const res = await broadcastToAll({ photoFileId: fileId, captionHTML: escapeHTML(body), buttons });

const report =

✅ <b>Photo Broadcast Done</b> ━━━━━━━━━━━━━━ 📤 Sent: <b>${formatMMK(res.ok)}</b> ❌ Failed: <b>${formatMMK(res.fail)}</b> 👥 Total: <b>${formatMMK(res.total)}</b>;

await bot.editMessageText(report, {
  chat_id: cid,
  message_id: status.message_id,
  parse_mode: "HTML"
});

} });
