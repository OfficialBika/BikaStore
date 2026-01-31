// bot/callbacks/promo.callback.js — Promo Claim & Status Handler

const { bot } = require("../bot"); const { usePromo } = require("../../services/promo.service"); const { mentionUserHTML } = require("../../utils/html");

bot.on("callback_query", async (ctx) => { const { data, from } = ctx; if (!data.startsWith("promo:")) return;

const [, promoCode] = data.split(":");

try { const result = await usePromo(from.id, promoCode);

if (result.success) {
  await bot.sendMessage(
    from.id,
    `🎉 <b>PROMO SUCCESS!</b>\n\n` +
      `📦 Code: <code>${promoCode}</code>\n` +
      `💎 Reward: <b>${result.reward}</b>\n\n` +
      `🟢 သင့်ရဲ့ Promo ကိုအောင်မြင်စွာ သုံးပြီးပါပြီ။`,
    { parse_mode: "HTML" }
  );
} else {
  await bot.sendMessage(
    from.id,
    `⚠️ <b>PROMO ERROR</b>\n\n` +
      `📦 Code: <code>${promoCode}</code>\n` +
      `❌ Reason: ${result.message}`,
    { parse_mode: "HTML" }
  );
}

} catch (err) { await bot.sendMessage( from.id, ❌ Unknown error while using promo: ${promoCode} ); }

ctx.answerCallbackQuery(); });
