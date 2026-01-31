// bot/handlers/top10.js — Handle /top10 Command (Pro UI)

const { bot } = require("../bot"); const { formatMMK, escapeHTML } = require("../../utils/helpers"); const { Order } = require("../../models/Order"); const { touchUser, touchChat } = require("../../services/user.service");

bot.onText(//top10/, async (msg) => { await touchUser(msg.from); await touchChat(msg.chat);

const cid = msg.chat.id; const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

const rows = await Order.aggregate([ { $match: { status: "COMPLETED", createdAt: { $gte: sixMonthsAgo } } }, { $group: { _id: "$userId", total: { $sum: "$totalPrice" }, username: { $last: "$username" }, firstName: { $last: "$firstName" }, orders: { $sum: 1 }, } }, { $sort: { total: -1 } }, { $limit: 10 } ]);

if (!rows.length) { return bot.sendMessage(cid, "<b>📭 6လအတွင်း Completed Order မရှိသေးပါ။</b>", { parse_mode: "HTML" }); }

const lines = rows.map((r, i) => { const rank = i + 1; const medal = ["🥇", "🥈", "🥉"][i] || "🏅"; const name = r.username ? @${escapeHTML(r.username)} : <b>${escapeHTML(r.firstName || "User")}</b>; return ( ${medal} <b>#${rank}</b> ${name}\n +    💰 <code>${formatMMK(r.total)} MMK</code>  •  📦 <code>${r.orders} orders</code> ); }).join("\n\n");

const text = `<b>🏆 TOP 10 BIG SPENDERS</b> <i>(Last 6 Months • Completed Orders)</i> ━━━━━━━━━━━━━━━━━━━━━━

${lines}

━━━━━━━━━━━━━━━━━━━━━━ 🔥 <i>ကျေးဇူးအထူးတင်ပါတယ် BIKA Supporters!</i>`;

await bot.sendMessage(cid, text, { parse_mode: "HTML", disable_web_page_preview: true }); });
