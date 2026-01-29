// ===============================
// ADMIN HANDLERS (BIKA STORE - FINAL)
// ===============================

const ui = require("./ui");
const orders = require("./orders");
const { isAdmin, monthRange } = require("./helpers");
const PromoHistory = require("./models/PromoHistory");

// Admin က message ပို့တဲ့အခါ text command style နဲ့ handle လုပ်ချင်ရင် ဒီမှာ
// (commands.js က /status /top10 /myrank ကို register လုပ်ထားပြီးသား)
// ဒီ admin.js ကို index.js မှာ adminHandlers.onMessage({...}) လို့ခေါ်ထားတဲ့အတွက်
// အဓိကမှာ: admin chat ထဲက non-command message တွေကို friendly response ပေးထားမယ်။

async function onMessage({ bot, msg, ADMIN_IDS }) {
  const chatId = String(msg.chat.id);
  const fromId = String(msg.from?.id || "");

  if (!isAdmin(fromId, ADMIN_IDS)) return;

  const text = msg.text?.trim();
  if (!text) return;

  // Optional: extra admin text shortcuts
  // "/month" -> top10 current month
  if (/^\/month$/i.test(text)) {
    const [start, end] = monthRange();
    const list = await orders.getTop10(start, end);
    return bot.sendMessage(chatId, ui.top10UI(list), { parse_mode: "Markdown" });
  }

  if (text === "/lastpromo") {
  const last = await PromoHistory.findOne().sort({ approvedAt: -1 });

  if (!last) {
    return bot.sendMessage(chatId, "📭 Promo history မရှိသေးပါ");
  }

  return bot.sendMessage(
    chatId,
    `🎁 *LAST PROMOTION*
━━━━━━━━━━━━━━━
🏷 ${last.promoTitle}
👤 ${last.winnerUsername}
🆔 ${last.gameId} (${last.serverId})
🕒 ${last.approvedAt.toLocaleString()}`,
    { parse_mode: "Markdown" }
  );
  }

  // Default help
  if (/^\/help$/i.test(text) || /^help$/i.test(text)) {
    return bot.sendMessage(
      chatId,
      `👑 *Admin Commands*
/status - bot status
/top10 - top 10 users (this month)
/myrank - your rank (this month)

Approve/Reject ကိုတော့ order message အောက်က button နဲ့လုပ်ပါ ✅`,
      { parse_mode: "Markdown" }
    );
  }

  // If admin types something else, just ignore or show hint
  if (text.startsWith("/")) {
    return bot.sendMessage(chatId, "⚠️ Unknown command. /help");
  }
}

module.exports = {
  onMessage
};
