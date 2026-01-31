// bot/handlers/pickwinner.js — Handle /pickwinner Command (Admin, Channel Giveaway)

const { bot } = require("../bot"); const { GiveawayEntry } = require("../../models/GiveawayEntry"); const { GiveawayPost } = require("../../models/GiveawayPost"); const { WinnerHistory } = require("../../models/WinnerHistory"); const { escapeHTML } = require("../../utils/helpers"); const { isAdminUser } = require("../../services/user.service");

bot.onText(//pickwinner\b/, async (msg) => { const chatId = msg.chat.id;

if (!msg.from || !isAdminUser(msg.from.id)) return; if (!(msg.chat.type === "group" || msg.chat.type === "supergroup")) { return bot.sendMessage(chatId, "❗ /pickwinner ကို Discussion Group ထဲမှာပဲ သုံးနိုင်ပါတယ်။"); }

// Must reply to auto-forwarded post if (!msg.reply_to_message || !msg.reply_to_message.is_automatic_forward) { return bot.sendMessage(chatId, "⚠️ Channel post (auto-forwarded) ကို Reply လုပ်ပြီး /pickwinner ပို့ပါ။"); }

const groupChatId = String(chatId); const channelPostId = msg.reply_to_message.forward_from_message_id || msg.reply_to_message.message_id;

const giveawayPost = await GiveawayPost.findOne({ channelPostId }).lean(); if (!giveawayPost) { return bot.sendMessage(chatId, "⚠️ ဒီ post က giveaway မဟုတ်ပါ (DB ထဲမှာ မရှိပါ)။"); }

const entries = await GiveawayEntry.find({ groupChatId, channelPostId }).lean(); if (!entries.length) { return bot.sendMessage(chatId, "⚠️ Comment မရှိသေးပါ။"); }

// Spinner loading let countdown = 10; const spinnerFrames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]; let spinnerIndex = 0;

const sent = await bot.sendMessage( chatId, 🌀 <b>${spinnerFrames[0]} Winner ရွေးချယ်နေပါပြီ...</b>\n\n⏳ <b>${countdown}</b> စက္ကန့်, { parse_mode: "HTML" } );

const timer = setInterval(async () => { countdown--; spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;

if (countdown > 0) {
  try {
    await bot.editMessageText(
      `🌀 <b>${spinnerFrames[spinnerIndex]} Winner ရွေးချယ်နေပါပြီ...</b>\n\n⏳ <b>${countdown}</b> စက္ကန့်`,
      { chat_id: chatId, message_id: sent.message_id, parse_mode: "HTML" }
    );
  } catch (_) {}
}

}, 1000);

await new Promise(res => setTimeout(res, 10000)); clearInterval(timer);

// Pick random winner const winner = entries[Math.floor(Math.random() * entries.length)]; const mention = winner.username ? @${escapeHTML(winner.username)} : <a href=\"tg://user?id=${escapeHTML(winner.userId)}\">${escapeHTML(winner.name || "Winner")}</a>;

const resultText = ✅ <b>Winner ထွက်ပေါ်လာပါပြီ!</b> ━━━━━━━━━━━━━━ 🏆 <b>Winner:</b> ${mention} 💬 <b>Comment:</b> <i>${escapeHTML(winner.comment)}</i>;

await bot.editMessageText(resultText, { chat_id: chatId, message_id: sent.message_id, parse_mode: "HTML" });

// Save to history await WinnerHistory.create({ groupChatId, channelId: giveawayPost.channelId || "", channelPostId, winnerUserId: winner.userId, winnerUsername: winner.username || "", winnerName: winner.name || "", winnerComment: winner.comment || "", pickedAt: new Date(), });

// Clean up await GiveawayEntry.deleteMany({ groupChatId, channelPostId }); await GiveawayPost.deleteOne({ channelPostId }); });
