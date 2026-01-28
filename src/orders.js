// ===============================
// ORDERS LOGIC (BIKA STORE - FINAL)
// Matches: user.js FINAL + callbacks.js FINAL + ui.js FINAL
// ===============================

const Order = require("./models/order");
const User = require("./models/User");
const ui = require("./ui");

// ===============================
// ESCAPE MARKDOWN
// ===============================
function escapeMd(text = "") {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ===============================
// CREATE ORDER (PAYMENT PHOTO)
// ===============================
async function createOrder({ bot, msg, session, ADMIN_IDS }) {
  const chatId = String(msg.chat.id);
  const t = session[chatId];

  if (!t) {
    await bot.sendMessage(chatId, "❌ Session expired. /start again");
    return null;
  }

  // ⛔ Only accept when we are waiting receipt
  if (t.step !== "WAIT_RECEIPT") {
    await bot.sendMessage(chatId, "❌ ဒီအဆင့်မှာ ပြေစာ မလိုသေးပါ။ /start နဲ့ပြန်စပါ");
    return null;
  }

  // ⛔ Prevent duplicate pending
  const exist = await Order.findOne({ userId: chatId, status: "PENDING" });
  if (exist) {
    await bot.sendMessage(
      chatId,
      "⛔ *Pending Order ရှိပြီးသားပါ*\nAdmin approve/reject ပြီးမှ အသစ်လုပ်နိုင်ပါတယ်",
      { parse_mode: "Markdown" }
    );
    return null;
  }

  // 🖼 Payment photo
  const photo = msg.photo?.at(-1);
  if (!photo) {
    await bot.sendMessage(chatId, "❌ Payment screenshot မတွေ့ပါ (photo အနေနဲ့ပို့ပါ)");
    return null;
  }

  // Normalize fields from session (support both old/new keys)
  const product = t.game || t.product; // MLBB | PUBG
  const gameId = t.game_id || t.gameId || "";
  const serverId = t.server_id || t.serverId || "";
  const amountRaw = t.amount ?? t.qty ?? null;
const amount = amountRaw == null ? null : Number(amountRaw);

  if (!product || !gameId || amount == null) {
    await bot.sendMessage(chatId, "❌ Order info မစုံပါ။ /start နဲ့ပြန်စပါ");
    return null;
  }

  // 👤 user reference (optional)
  const user = await User.findOne({ userId: chatId });

  // Username safe
  const usernameRaw = msg.from?.username || msg.from?.first_name || "";
  const username = String(usernameRaw).trim();
  const usernameLabel = username ? `@${escapeMd(username)}` : escapeMd(msg.from?.first_name || "User");

  // ===============================
  // CREATE ORDER
  // ===============================
  const order = await Order.create({
    // Use session orderId if exists, else fallback (ui ensures)
    orderId: t.orderId || t.order_id || `BK${Date.now()}`,
    userId: chatId,
    userRef: user?._id || null,

    username,

    product,          // MLBB/PUBG
    gameId,
    serverId,

    amount,           // ✅ store amount for preview/notify
    items: t.items || [],

    totalPrice: t.totalPrice ?? 0,
    paymentMethod: t.paymentMethod || "",
    paymentPhoto: photo.file_id,

    status: "PENDING",
    adminMessages: [],

    createdAt: new Date(),
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });

  // ===============================
  // USER WAITING MESSAGE
  // ===============================
  const waitMsg = await ui.sendWaiting(bot, chatId, order.orderId);
  order.waitMsgId = waitMsg.message_id;

  // ===============================
  // ADMIN NOTIFY (MULTI ADMIN)
  // ===============================
  for (const adminIdRaw of ADMIN_IDS || []) {
    const adminId = String(adminIdRaw).trim();
    if (!adminId) continue;

    try {
      const caption =
        `📦 *NEW ORDER*\n` +
        `━━━━━━━━━━━━━━━\n` +
        `🆔 *Order ID:* ${escapeMd(order.orderId)}\n` +
        `👤 *User:* ${usernameLabel}\n` +
        `🎮 *Game:* ${escapeMd(order.product)}\n` +
        `🆔 *ID:* ${escapeMd(order.gameId)}${order.serverId ? ` (${escapeMd(order.serverId)})` : ""}\n` +
        `${order.product === "MLBB" ? "💎" : "🎯"} *Amount:* ${escapeMd(String(order.amount))}\n` +
        `💰 *Total:* ${Number(order.totalPrice).toLocaleString()} MMK`;

      const adminMsg = await bot.sendPhoto(adminId, order.paymentPhoto, {
        caption,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              // ✅ Must match callbacks.js FINAL: "APPROVE:<id>" / "REJECT:<id>"
              { text: "✅ Approve", callback_data: `APPROVE:${order._id}` },
              { text: "❌ Reject", callback_data: `REJECT:${order._id}` }
            ]
          ]
        }
      });

      order.adminMessages.push({
        chatId: adminId,
        messageId: adminMsg.message_id
      });
    } catch (e) {
      console.error("Admin notify failed:", adminId, e?.message || e);
    }
  }

  await order.save();

  // Clear session
  delete session[chatId];

  return order;
}

// ===============================
// APPROVE ORDER
// orderId here is Mongo _id string
// ===============================
async function approveOrder({ bot, orderId }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "PENDING" },
    { status: "COMPLETED", approvedAt: new Date() },
    { new: true }
  );

  if (!order) return;

  // ❌ delete waiting message
if (order.waitMsgId) {
  try {
    await bot.deleteMessage(order.userId, order.waitMsgId);
  } catch (_) {}
}

  await ui.notifyUserApproved(bot, order);

  for (const m of order.adminMessages || []) {
    try {
      await ui.updateAdminMessage(
        bot,
        { adminChatId: m.chatId, adminMsgId: m.messageId },
        "APPROVED"
      );
    } catch {}
  }
}

// ===============================
// REJECT ORDER
// ===============================
async function rejectOrder({ bot, orderId }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "PENDING" },
    { status: "REJECTED" },
    { new: true }
  );

  if (!order) return;

  // ❌ delete waiting message
if (order.waitMsgId) {
  try {
    await bot.deleteMessage(order.userId, order.waitMsgId);
  } catch (_) {}
}

  await ui.notifyUserRejected(bot, order);

  for (const m of order.adminMessages || []) {
    try {
      await ui.updateAdminMessage(
        bot,
        { adminChatId: m.chatId, adminMsgId: m.messageId },
        "REJECTED"
      );
    } catch {}
  }
}

// ===============================
// STATS
// ===============================
async function getStatusStats(isAdminFlag) {
  return {
    role: isAdminFlag ? "👑 Admin" : "👤 User",
    total: await Order.countDocuments(),
    pending: await Order.countDocuments({ status: "PENDING" })
  };
}

async function getTop10(start, end) {
  return Order.aggregate([
    { $match: { status: "COMPLETED", approvedAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$userRef", total: { $sum: "$totalPrice" } } },
    { $sort: { total: -1 } },
    { $limit: 10 }
  ]);
}

async function getUserRank(userId, start, end) {
  const list = await Order.aggregate([
    { $match: { status: "COMPLETED", approvedAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$userId", total: { $sum: "$totalPrice" } } },
    { $sort: { total: -1 } }
  ]);

  const index = list.findIndex(u => u._id === userId);
  return index === -1 ? null : { rank: index + 1, total: list[index].total };
}

module.exports = {
  createOrder,
  approveOrder,
  rejectOrder,
  getStatusStats,
  getTop10,
  getUserRank
};
