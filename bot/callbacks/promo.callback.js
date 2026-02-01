// bot/callbacks/promo.callback.js — Handle PROMO_CLAIM Callback

const { bot } = require("../bot");
const { Promo } = require("../../models/Promo");
const { escapeHTML } = require("../../utils/helpers");

bot.on("callback_query", async (q) => {
  const cid = q.message.chat.id;
  const uid = String(q.from.id);
  const username = q.from.username;
  const firstName = q.from.first_name;

  if (!q.data.startsWith("PROMO_CLAIM_")) return;

  const promoId = q.data.replace("PROMO_CLAIM_", "");
  const promo = await Promo.findById(promoId);

  if (!promo || !promo.active || promo.claimed || promo.expireAt < new Date()) {
    return bot.answerCallbackQuery(q.id, {
      text: "⛔️ This giveaway is already claimed or expired!",
      show_alert: true,
    });
  }

  // Update promo as claimed
  promo.claimed = true;
  promo.winnerUserId = uid;
  promo.winnerUsername = username;
  promo.winnerFirstName = firstName;
  promo.stage = "CLAIMED";
  await promo.save();

  // Edit original message
  const winner = username ? `@${escapeHTML(username)}` : `<b>${escapeHTML(firstName || "User")}</b>`;
  const claimText = `🎉 <b>${escapeHTML(promo.title)}</b>\n\n🥇 Winner: ${winner}\n✅ <i>This giveaway is now claimed.</i>`;

  try {
    await bot.editMessageText(claimText, {
      chat_id: cid,
      message_id: q.message.message_id,
      parse_mode: "HTML",
    });
  } catch (_) {
    // fallback
    await bot.sendMessage(cid, claimText, { parse_mode: "HTML" });
  }

  bot.answerCallbackQuery(q.id, { text: "🎉 You’ve successfully claimed!", show_alert: true });
});
