// bot/handlers/admin.js — Handle /admin Command (Pro Dashboard)

const { bot } = require("../bot");
const { formatMMK } = require("../../utils/helpers");
const { escapeHTML } = require("../../utils/html");
const { uptimeText } = require("../../utils/time");
const Order = require("../../models/Order");
const User = require("../../models/User");
const { touchUser, touchChat } = require("../../services/user.service");
const { ADMIN_CHAT_IDS } = require("../../config/env");

const isAdminUser = (userId) =>
  ADMIN_CHAT_IDS.includes(String(userId));

bot.onText(/^\/admin/, async (msg) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  if (!msg.from || !isAdminUser(msg.from.id)) return;

  const cid = msg.chat.id;

  const [usersCount, completedCount, rejectedCount] = await Promise.all([
    User.countDocuments({}),
    Order.countDocuments({ status: "COMPLETED" }),
    Order.countDocuments({ status: "REJECTED" }),
  ]);

  const revAgg = await Order.aggregate([
    { $match: { status: "COMPLETED" } },
    { $group: { _id: null, total: { $sum: "$totalPrice" } } },
  ]);

  const revenue = revAgg?.[0]?.total || 0;

  const text = `
📊 <b>BIKA STORE — ADMIN DASHBOARD</b>

━━━━━━━━━━━━━━━━━━━━━━

👥 <b>Total Users:</b> ${formatMMK(usersCount)}
✅ <b>Completed Orders:</b> ${formatMMK(completedCount)}
❌ <b>Rejected Orders:</b> ${formatMMK(rejectedCount)}

💰 <b>Total Revenue:</b>
<b>${formatMMK(revenue)} MMK</b>

⏱ <b>Bot Uptime:</b>
<code>${escapeHTML(uptimeText())}</code>

━━━━━━━━━━━━━━━━━━━━━━
<i>🔒 Only visible to admin users</i>
`;

  await bot.sendMessage(cid, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
});
