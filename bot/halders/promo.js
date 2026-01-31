// bot/handlers/promo.js — Handle /promo Command

const { bot } = require("../bot"); const { Promo } = require("../../models/Promo"); const { escapeHTML } = require("../../utils/helpers"); const { touchUser, touchChat } = require("../../services/user.service");

const session = {}; // in-memory session

bot.onText(//promo/, async (msg) => { await touchUser(msg.from); await touchChat(msg.chat);

const cid = msg.chat.id;

// Only allow in private chat if (msg.chat.type !== "private") { return bot.sendMessage(cid, "ℹ️ /promo ကို User Private Chat မှာပဲ သုံးနိုင်ပါတယ်။", { parse_mode: "HTML" }); }

// Clean up expired promos await Promo.updateMany( { active: true, expireAt: { $lte: new Date() } }, { $set: { active: false, stage: "DONE" } } );

const active = await Promo.findOne({ active: true, expireAt: { $gt: new Date() } }).sort({ createdAt: -1 });

if (!active) { return bot.sendMessage(cid, "😎 Giveaway မရှိသေးပါခင်ဗျ။ /promo ပြန်စစ်ကြည့်ပါ။", { parse_mode: "HTML" }); }

// Already claimed by someone if (active.claimed) { const winnerName = active.winnerUsername ? @${escapeHTML(active.winnerUsername)} : <b>${escapeHTML(active.winnerFirstName || "Winner")}</b>;

return bot.sendMessage(
  cid,
  `🎁 <b>${escapeHTML(active.title)}</b>\n\n❌ ဒီ Giveaway ကို ${winnerName} က အရင်ဦးစွာ ထုတ်ယူသွားပါပြီ။`,
  { parse_mode: "HTML" }
);

}

const promoText = `🎁 <b>${escapeHTML(active.title)}</b>

🥇 <b>အရင်ဆုံး Claim နှိပ်သူရပါမယ်</b> ⚠️ <i>Winner ၁ ယောက်ထဲသာရှိပါမယ်</i>

👇 <b>Claim Now</b>`;

const sent = await bot.sendMessage(cid, promoText, { parse_mode: "HTML", reply_markup: { inline_keyboard: [ [{ text: "🎉 CLAIM", callback_data: PROMO_CLAIM_${active._id} }] ] } });

const s = session[cid] || (session[cid] = {}); s.lastPromoMessageId = sent.message_id; });
