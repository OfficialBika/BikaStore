// bot/handlers/myrank.js — Handle /myrank Command

const { bot } = require("../bot");
const { formatMMK } = require("../../utils/helpers");
const { escapeHTML, mentionUserHTML } = require("../../utils/html");
const Order = require("../../models/Order");
const { touchUser, touchChat } = require("../../services/user.service");

const RANKS = [
  { name: "BRONZE", min: 50000 },
  { name: "SILVER", min: 200000 },
  { name: "GOLD", min: 500000 },
  { name: "PLATINUM", min: 1000000 },
  { name: "DIAMOND", min: 3000000 },
];

function getRank(total) {
  let current = RANKS[0];
  for (const r of RANKS) if (total >= r.min) current = r;

  const idx = RANKS.findIndex((x) => x.name === current.name);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  return { current, next };
}

bot.onText(/^\/myrank/, async (msg) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  const cid = msg.chat.id;
  const uid = String(msg.from.id);

  const agg = await Order.aggregate([
    { $match: { status: "COMPLETED", userId: uid } },
    {
      $group: {
        _id: null,
        total: { $sum: "$totalPrice" },
        orders: { $sum: 1 },
      },
    },
  ]);

  const total = agg?.[0]?.total || 0;
  const orders = agg?.[0]?.orders || 0;

  const { current, next } = getRank(total);
  const remaining = next ? Math.max(0, next.min - total) : 0;

  const progressText = next
    ? `🚀 <b>Next Level:</b> ${escapeHTML(next.name)}\n⏳ <b>Remaining:</b> ${formatMMK(
        remaining
      )} MMK`
    : `👑 <b>Status:</b> MAX LEVEL`;

  const text = `
🎖 <b>Your Rank — BIKA STORE</b>

👤 <b>User:</b> ${mentionUserHTML(msg.from)}
📦 <b>Completed Orders:</b> ${formatMMK(orders)}
💰 <b>Total Spend:</b> ${formatMMK(total)} MMK

🏅 <b>Current Level:</b> ${escapeHTML(current.name)}

${progressText}
`;

  await bot.sendMessage(cid, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
});
