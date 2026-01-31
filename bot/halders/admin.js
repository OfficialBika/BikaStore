// bot/handlers/admin.js — Handle /admin Command

const { bot } = require("../bot"); const { formatMMK, escapeHTML, uptimeText } = require("../../utils/helpers"); const { Order } = require("../../models/Order"); const { User } = require("../../models/User"); const { touchUser, touchChat } = require("../../services/user.service");

const ADMIN_IDS = process.env.ADMIN_CHAT_IDS ? process.env.ADMIN_CHAT_IDS.split(",").map(x => x.trim()) : [];

const isAdminUser = (userId) => ADMIN_IDS.includes(String(userId));

bot.onText(//admin/, async (msg) => { await touchUser(msg.from); await touchChat(msg.chat);

const cid = msg.chat.id; if (!isAdminUser(msg.from.id)) return;

const [usersCount, completedCount, rejectedCount] = await Promise.all([ User.countDocuments({}), Order.countDocuments({ status: "COMPLETED" }), Order.countDocuments({ status: "REJECTED" }), ]);

const revAgg = await Order.aggregate([ { $match: { status: "COMPLETED" } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } } ]); const revenue = revAgg?.[0]?.total || 0;

const text = `<b>📊 BIKA STORE — ADMIN DASHBOARD</b> ━━━━━━━━━━━━━━━━━━━━━━

👥 <b>Total Users</b>: <code>${formatMMK(usersCount)}</code> ✅ <b>Completed Orders</b>: <code>${formatMMK(completedCount)}</code> ❌ <b>Rejected Orders</b>: <code>${formatMMK(rejectedCount)}</code>

💰 <b>Total Revenue</b> <code>${formatMMK(revenue)} MMK</code>

⏱ <b>Bot Uptime</b> <code>${escapeHTML(uptimeText())}</code> ━━━━━━━━━━━━━━━━━━━━━━ <i>Only visible to admin users</i>`;

await bot.sendMessage(cid, text, { parse_mode: "HTML" }); });
