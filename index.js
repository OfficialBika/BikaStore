// ===================================
// BIKA STORE — PRODUCTION BOT (v3.1 Final Ready)
// Orders + Top10 + Admin Dashboard + Rank + Promo Giveaway + Broadcast
// + Channel Giveaway (comment entry) + /pickwinner + /winnerlist
// Webhook (Render) + MongoDB
// ===================================

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PUBLIC_URL = process.env.PUBLIC_URL;
const PORT = process.env.PORT || 3000;

const KPAY_NAME = process.env.KPAY_NAME || "Shine Htet Aung";
const KPAY_PHONE = process.env.KPAY_PHONE || "09264202637";
const WAVEPAY_NAME = process.env.WAVEPAY_NAME || "Shine Htet Aung";
const WAVEPAY_PHONE = process.env.WAVEPAY_PHONE || "09264202637";

const ADMIN_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",").map(x => x.trim()).filter(Boolean)
  : [];

if (!BOT_TOKEN || !MONGO_URI || !PUBLIC_URL) {
  console.error("❌ Missing ENV (BOT_TOKEN / MONGO_URI / PUBLIC_URL)");
  process.exit(1);
}

// ===== BOT & SERVER =====
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

// ===== WEBHOOK =====
const WEBHOOK_PATH = "/telegram/bika_webhook";
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ===== DB =====
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ===================================
// DB MODELS
// ===================================
const User = mongoose.model("User", new mongoose.Schema({
  userId: { type: String, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  startedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true }));

const Chat = mongoose.model("Chat", new mongoose.Schema({
  chatId: { type: String, unique: true },
  type: String, // private, group, supergroup, channel
  title: String,
  username: String,
  addedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true }));

const Counter = mongoose.model("Counter", new mongoose.Schema({
  name: { type: String, unique: true },
  seq: { type: Number, default: 0 }
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  orderId: String,         // BKS-0000001
  orderNo: Number,         // 1,2,3...
  orderDateText: String,   // 31/1/2026 10:45 PM

  userId: String,
  username: String,
  firstName: String,

  game: String,            // MLBB / PUBG
  gameId: String,
  serverId: String,

  items: [String],
  totalPrice: Number,

  paymentMethod: String,   // KPAY / WAVEPAY
  receiptFileId: String,   // Telegram file_id

  status: { type: String, default: "PENDING" },

  // for editing messages on approve/reject
  userOrderMessageId: Number,
  adminMessageId: Number,
  adminChatId: String
}, { timestamps: true }));

const Promo = mongoose.model("Promo", new mongoose.Schema({
  active: { type: Boolean, default: true },
  title: String,
  createdAt: { type: Date, default: Date.now },

  expireAt: Date,

  claimed: { type: Boolean, default: false },
  claimedAt: Date,

  winnerUserId: String,
  winnerChatId: String,
  winnerUsername: String,
  winnerFirstName: String,

  winnerGameId: String,
  winnerServerId: String,

  stage: { type: String, default: "CLAIM" }, // CLAIM -> WAIT_ID -> WAIT_APPROVE -> DONE
}, { timestamps: true }));

// =============================
// GIVEAWAY: ACTIVE CHANNEL POSTS
// =============================
const GiveawayPost = mongoose.model("GiveawayPost", new mongoose.Schema({
  channelId: String,          // Telegram channel id
  channelPostId: Number,      // message_id of channel post
  discussionChatId: String,   // linked discussion group id (optional)
  mentionTag: String,         // @Bikastorebot
  createdAt: { type: Date, default: Date.now },
}));

// =============================
// GIVEAWAY: COMMENT ENTRIES (DB-only)
// =============================
const GiveawayEntrySchema = new mongoose.Schema({
  groupChatId: String,        // discussion group id
  channelPostId: Number,      // channel post id

  userId: String,
  username: String,
  name: String,

  comment: String,
  commentMessageId: Number,

  createdAt: { type: Date, default: Date.now },
});

// one entry per user per post per group
GiveawayEntrySchema.index(
  { groupChatId: 1, channelPostId: 1, userId: 1 },
  { unique: true }
);

const GiveawayEntry = mongoose.model("GiveawayEntry", GiveawayEntrySchema);

// =============================
// GIVEAWAY: WINNER HISTORY
// =============================
const WinnerHistory = mongoose.model("WinnerHistory", new mongoose.Schema({
  groupChatId: String,

  channelId: String,
  channelPostId: Number,

  winnerUserId: String,
  winnerUsername: String,
  winnerName: String,
  winnerComment: String,

  pickedAt: { type: Date, default: Date.now },
}));

// ===================================
// PRICES
// ===================================
const MLBB_PRICES = {
  "11": 800, "22": 1600, "33": 2350, "55": 3600, "112": 8200,
  "86": 4800, "172": 9800, "257": 14500, "343": 20000, "429": 25000,
  "514": 29900, "600": 34500, "706": 39900, "792": 44500, "878": 48500,
  "963": 53000, "1049": 59900, "1135": 63500, "1412": 77000,
  "1584": 88000, "1669": 94000, "2195": 118900, "3158": 172000,
  "3688": 202000, "4390": 237000, "5100": 280000, "5532": 300000,
  "6055": 330000,

  "wp1": 5900, "wp2": 11800, "wp3": 17700, "wp4": 23600, "wp5": 29500,
};

const PUBG_PRICES = {
  "60": 4500, "325": 19500, "660": 38000, "1800": 90500,
  "3850": 185000, "8100": 363000,
  "prime1m": 4500, "primeplus": 39500,
};

// ===================================
// SESSION (in-memory) — only for order flow + promo flow UI cleanup
// ===================================
const session = {}; // chatId -> state

// ===================================
// HELPERS
// ===================================
const isAdminUser = (userId) => ADMIN_IDS.includes(String(userId));

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mentionUserHTML(user) {
  const name = user.first_name || user.username || "User";
  return `<a href="tg://user?id=${user.id}">${escapeHTML(name)}</a>`;
}

function formatMMK(n) {
  try { return Number(n).toLocaleString("en-US"); } catch { return String(n); }
}

function nowDateText() {
  const d = new Date();
  const day = d.getDate();
  const mon = d.getMonth() + 1;
  const yr = d.getFullYear();
  let hr = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = hr >= 12 ? "PM" : "AM";
  hr = hr % 12; if (hr === 0) hr = 12;
  return `${day}/${mon}/${yr}  ${hr}:${min} ${ampm}`;
}

function uptimeText() {
  const s = Math.floor(process.uptime());
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts = [];
  if (days) parts.push(`${days} days`);
  if (hours) parts.push(`${hours} hours`);
  if (mins) parts.push(`${mins} minutes`);
  parts.push(`${secs} seconds`);
  return parts.join(" ");
}

async function deleteIfPossible(chatId, messageId) {
  if (!chatId || !messageId) return;
  try { await bot.deleteMessage(chatId, messageId); } catch (_) {}
}

async function sendPrompt(chatId, s, html, extra = {}) {
  if (s?.lastPromptMessageId) await deleteIfPossible(chatId, s.lastPromptMessageId);
  const sent = await bot.sendMessage(chatId, html, { parse_mode: "HTML", ...extra });
  s.lastPromptMessageId = sent.message_id;
  return sent;
}

function buildPriceListText(game) {
  if (game === "MLBB") {
    return (
`<b>MLBB Price List</b>
11 = 800 ks
22 = 1600 ks
33 = 2350 ks
55 = 3600 ks
86 = 4800 ks
112 = 8200 ks
172 = 9800 ks
257 = 14500 ks
343 = 20000 ks
429 = 25000 ks
514 = 29900 ks
600 = 34500 ks
706 = 39900 ks
792 = 44500 ks
878 = 48500 ks
963 = 53000 ks
1049 = 59900 ks
1135 = 63500 ks
1412 = 77000 ks
1584 = 88000 ks
1669 = 94000 ks
2195 = 118900 ks
3158 = 172000 ks
3688 = 202000 ks
4390 = 237000 ks
5100 = 280000 ks
5532 = 300000 ks
6055 = 330000 ks

wp1 = 5900 ks
wp2 = 11800 ks
wp3 = 17700 ks
wp4 = 23600 ks
wp5 = 29500 ks`
    );
  }
  if (game === "PUBG") {
    return (
`<b>PUBG Price List</b>
60 = 4500 Ks
325 = 19500 Ks
660 = 38000 Ks
1800 = 90500 Ks
3850 = 185000 Ks
8100 = 363000 Ks

Prime1m = 4500 Ks
Primeplus = 39500 Ks`
    );
  }
  return "";
}

function buildOrderPreviewHTML(s) {
  const itemsText = (s.items || []).join(" + ");
  return (
`👤 User: ${s.userMentionHTML}
🆔 Order ID: <b>${escapeHTML(s.orderId || "")}</b>
🗓️ Order Date: <b>${escapeHTML(s.orderDateText || "")}</b>

🎮 Game: <b>${escapeHTML(s.game || "")}</b>
🎯 ID + SV: <b>${escapeHTML(s.gameId || "")}${s.serverId ? " (" + escapeHTML(s.serverId) + ")" : ""}</b>
💎 Amount: <b>${escapeHTML(itemsText)}</b>
💰 Total: <b>${formatMMK(s.totalPrice || 0)} MMK</b>`
  );
}

// Parse MLBB/PUBG ID + SV variants
function parseGameIdAndServer(text) {
  const t = String(text || "").trim();
  const m = t.match(/(\d{5,})(?:\D+(\d{2,}))?/);
  if (!m) return null;
  return { gameId: m[1], serverId: m[2] || "" };
}

// Parse items like: wp 1 +343+ Wp2 + wP 3
function parseItems(text) {
  let t = String(text || "").trim();
  if (!t) return [];
  t = t.replace(/wp\s*(\d)/gi, "wp$1");
  t = t.replace(/[+]/g, " ");
  t = t.replace(/[^\w\s]/g, " ");
  t = t.toLowerCase();
  const parts = t.split(/\s+/).map(x => x.trim()).filter(Boolean);

  const items = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === "wp" && parts[i + 1] && /^\d$/.test(parts[i + 1])) {
      items.push("wp" + parts[i + 1]);
      i++;
    } else {
      items.push(p);
    }
  }
  return items;
}

function validateAndSum(game, items) {
  const priceMap = game === "MLBB" ? MLBB_PRICES : game === "PUBG" ? PUBG_PRICES : null;
  if (!priceMap) return { ok: false, error: "Unknown game", total: 0, normalizedItems: [] };

  const bad = [];
  let total = 0;
  const normalized = [];

  for (const it of items) {
    const key = String(it).toLowerCase();
    if (!priceMap[key]) bad.push(it);
    else { normalized.push(key); total += priceMap[key]; }
  }

  if (bad.length) {
    return {
      ok: false,
      error: `ဤ Amount များကို Price List ထဲမှာ မတွေ့ပါ: ${bad.join(", ")}`,
      total: 0,
      normalizedItems: []
    };
  }
  return { ok: true, total, normalizedItems: normalized };
}

async function nextOrderNo() {
  const c = await Counter.findOneAndUpdate(
    { name: "order" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return c.seq;
}

// Track users + chats
async function touchUser(from) {
  if (!from || from.is_bot) return;
  const userId = String(from.id);
  await User.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: { userId, startedAt: new Date() },
      $set: {
        username: from.username || "",
        firstName: from.first_name || "",
        lastName: from.last_name || "",
        lastSeenAt: new Date(),
      }
    },
    { upsert: true, new: true }
  );
}

async function touchChat(chat) {
  if (!chat) return;
  const chatId = String(chat.id);
  await Chat.findOneAndUpdate(
    { chatId },
    {
      $setOnInsert: {
        chatId,
        type: chat.type,
        addedAt: new Date(),
      },
      $set: {
        type: chat.type,
        title: chat.title || "",
        username: chat.username || "",
        lastSeenAt: new Date(),
      }
    },
    { upsert: true, new: true }
  );
}

// ===================================
// COMMANDS (Telegram "/" menu)
// ===================================
async function setupCommands() {
  try {
    await bot.setMyCommands([
      { command: "start", description: "စတင်ရန်" },
      { command: "top10", description: "6လ Top 10 Spend List" },
      { command: "myrank", description: "သင့် Level / Rank" },
      { command: "promo", description: "Giveaway ကြည့်ရန်" },
      { command: "admin", description: "Admin Dashboard (Admin only)" },
      { command: "promocreate", description: "Promo Create (Admin only)" },
      { command: "broadcast", description: "Broadcast (Admin only)" },
      { command: "pickwinner", description: "Channel Giveaway Winner Pick (Admin only)" },
      { command: "winnerlist", description: "Winner History (this group)" },
    ]);
  } catch (e) {
    console.error("❌ setMyCommands error:", e?.message || e);
  }
}

// ===================================
// /START (Order flow entry)
// ===================================
bot.onText(/\/start/, async (msg) => {
  const cid = msg.chat.id;

  await touchUser(msg.from);
  await touchChat(msg.chat);

  const s = session[cid] || (session[cid] = {});
  s.step = "GAME_SELECT";
  s.game = null;
  s.gameId = null;
  s.serverId = null;
  s.items = null;
  s.totalPrice = 0;
  s.orderId = null;
  s.orderNo = null;
  s.orderDateText = null;
  s.paymentMethod = null;
  s.userMentionHTML = mentionUserHTML(msg.from);

  const startText =
`မင်္ဂလာပါ ${s.userMentionHTML} ရေ

Bika Store မှ ကြိုဆိုပါတယ်ဗျ

အောက်ပါ Game များမှ
သင်ဝယ်ယူလိုတဲ့ Game ကို ရွေးချယ်ပေးပါ`;

  await sendPrompt(cid, s, startText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎮 MLBB", callback_data: "GAME_MLBB" }],
        [{ text: "🎮 PUBG", callback_data: "GAME_PUBG" }]
      ]
    }
  });
});

// ===================================
// /TOP10 (6 months) — any chat
// ===================================
bot.onText(/\/top10/, async (msg) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  const cid = msg.chat.id;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const rows = await Order.aggregate([
    { $match: { status: "COMPLETED", createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: "$userId",
        total: { $sum: "$totalPrice" },
        username: { $last: "$username" },
        firstName: { $last: "$firstName" },
        orders: { $sum: 1 },
      }
    },
    { $sort: { total: -1 } },
    { $limit: 10 }
  ]);

  if (!rows.length) {
    return bot.sendMessage(cid, "📭 6လအတွင်း Completed Order မရှိသေးပါ။", { parse_mode: "HTML" });
  }

  const lines = rows.map((r, i) => {
    const rank = i + 1;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅";
    const name = r.username ? `@${escapeHTML(r.username)}` : `<b>${escapeHTML(r.firstName || "User")}</b>`;
    return `${medal} <b>#${rank}</b>  ${name}\n   💰 <b>${formatMMK(r.total)} MMK</b>  •  📦 ${r.orders} orders`;
  }).join("\n\n");

  const text =
`🏆 <b>TOP 10 BIG SPENDERS</b>
<i>(Last 6 Months • Completed Orders)</i>

${lines}`;

  await bot.sendMessage(cid, text, { parse_mode: "HTML", disable_web_page_preview: true });
});

// ===================================
// /ADMIN — Admin only dashboard
// ===================================
bot.onText(/\/admin/, async (msg) => {
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
    { $group: { _id: null, total: { $sum: "$totalPrice" } } }
  ]);
  const revenue = revAgg?.[0]?.total || 0;

  const text =
`📊 <b>BIKA STORE — ADMIN DASHBOARD</b>

👥 <b>Total Users (Start)</b>: <b>${formatMMK(usersCount)}</b>
✅ <b>Completed Orders</b>: <b>${formatMMK(completedCount)}</b>
❌ <b>Rejected Orders</b>: <b>${formatMMK(rejectedCount)}</b>

💰 <b>Total Revenue (Completed)</b>
<b>${formatMMK(revenue)} MMK</b>

⏱ <b>Bot Alive Time</b>
<b>${escapeHTML(uptimeText())}</b>`;

  await bot.sendMessage(cid, text, { parse_mode: "HTML" });
});

// ===================================
// /MYRANK — user level by total spend
// ===================================
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
  const idx = RANKS.findIndex(x => x.name === current.name);
  const next = idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
  return { current, next };
}

bot.onText(/\/myrank/, async (msg) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  const cid = msg.chat.id;
  const uid = String(msg.from.id);

  const agg = await Order.aggregate([
    { $match: { status: "COMPLETED", userId: uid } },
    { $group: { _id: null, total: { $sum: "$totalPrice" }, orders: { $sum: 1 } } }
  ]);
  const total = agg?.[0]?.total || 0;
  const orders = agg?.[0]?.orders || 0;

  const { current, next } = getRank(total);
  const remaining = next ? Math.max(0, next.min - total) : 0;

  const text =
`🎖 <b>Your Rank — BIKA STORE</b>

👤 User: ${mentionUserHTML(msg.from)}
📦 Completed Orders: <b>${formatMMK(orders)}</b>
💰 Total Spend: <b>${formatMMK(total)} MMK</b>

🏅 Current Level: <b>${escapeHTML(current.name)}</b>
${next
  ? `🚀 Next Level: <b>${escapeHTML(next.name)}</b>\n⏳ Remaining: <b>${formatMMK(remaining)} MMK</b>`
  : `👑 Status: <b>MAX LEVEL</b>`}`;

  await bot.sendMessage(cid, text, { parse_mode: "HTML", disable_web_page_preview: true });
});

// ===================================
// /PROMOCREATE — Admin only (expires in 1 hour)
// ===================================
bot.onText(/\/promocreate(?:\s+(.+))?/, async (msg, match) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  if (!msg.from || !isAdminUser(msg.from.id)) return;

  const cid = msg.chat.id;

  // deactivate old promos
  await Promo.updateMany({ active: true }, { $set: { active: false, stage: "DONE" } });

  const customTitle = (match?.[1] || "").trim();
  const title = customTitle || "MLBB Diamonds Free Giveaway ပါ";
  const expireAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const promo = await Promo.create({
    active: true,
    title,
    claimed: false,
    stage: "CLAIM",
    expireAt,
  });

  const text =
`✅ <b>Promo Created</b>

🎁 Title: <b>${escapeHTML(title)}</b>
🆔 Promo ID: <code>${promo._id}</code>

⏰ Expire: <b>1 hour</b>

User တွေ <b>/promo</b> နဲ့ Claim လုပ်နိုင်ပြီ။`;

  await bot.sendMessage(cid, text, { parse_mode: "HTML" });
});

// ===================================
// /PROMO — user private only (active only within 1 hour)
// ===================================
bot.onText(/\/promo/, async (msg) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  const cid = msg.chat.id;

  // expire old promos (lazy cleanup)
  await Promo.updateMany(
    { active: true, expireAt: { $lte: new Date() } },
    { $set: { active: false, stage: "DONE" } }
  );

  if (msg.chat.type !== "private") {
    return bot.sendMessage(cid, "ℹ️ /promo ကို User Private Chat မှာပဲ သုံးနိုင်ပါတယ်။", { parse_mode: "HTML" });
  }

  const active = await Promo.findOne({
    active: true,
    expireAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!active) {
    return bot.sendMessage(cid, "😎 Giveaway မရှိဘူးကွ အားတိုင်း promo ပဲနှိပ်မနေနဲ့ 😎", { parse_mode: "HTML" });
  }

  // already claimed
  if (active.claimed) {
    const winnerName = active.winnerUsername
      ? `@${escapeHTML(active.winnerUsername)}`
      : `<b>${escapeHTML(active.winnerFirstName || "Winner")}</b>`;
    return bot.sendMessage(
      cid,
      `🎁 <b>${escapeHTML(active.title)}</b>\n\n❌ ဒီ Giveaway ကို ${winnerName} က အရင်ဦးစွာ ထုတ်ယူသွားပါပြီ။`,
      { parse_mode: "HTML" }
    );
  }

  const promoText =
`🎁 <b>${escapeHTML(active.title)}</b>

🥇 <b>အရင်ဆုံး Claim နှိပ်သူရပါမယ်</b>
⚠️ <i>Winner ၁ ယောက်ထဲသာရှိပါမယ်</i>

👇 <b>Claim Now</b>`;

  const sent = await bot.sendMessage(cid, promoText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎉 CLAIM", callback_data: `PROMO_CLAIM_${active._id}` }]
      ]
    }
  });

  const s = session[cid] || (session[cid] = {});
  s.lastPromoMessageId = sent.message_id;
});

// ===================================
// /BROADCAST — Admin only (text)
// Usage: /broadcast Hello
// ===================================
async function broadcastToAll({ text, photoFileId, captionHTML }) {
  const users = await User.find({}, { userId: 1 }).lean();
  const chats = await Chat.find({ type: { $in: ["group", "supergroup"] } }, { chatId: 1 }).lean();

  const targets = [
    ...users.map(u => ({ chatId: u.userId })),
    ...chats.map(c => ({ chatId: c.chatId })),
  ];

  let ok = 0, fail = 0;

  for (const t of targets) {
    try {
      if (photoFileId) {
        await bot.sendPhoto(t.chatId, photoFileId, {
          caption: captionHTML || "",
          parse_mode: "HTML",
        });
      } else {
        await bot.sendMessage(t.chatId, text, { parse_mode: "HTML", disable_web_page_preview: true });
      }
      ok++;
    } catch (_) {
      fail++;
    }
  }
  return { ok, fail, total: targets.length };
}

// ===================================
// STEP D: /pickwinner (Admin only, reply-required, multiple-safe)
// ===================================
bot.onText(/\/pickwinner\b/, async (msg) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  const chatId = msg.chat.id;

  if (!msg.from || !isAdminUser(msg.from.id)) return;
  if (!(msg.chat.type === "group" || msg.chat.type === "supergroup")) {
    return bot.sendMessage(chatId, "❗ /pickwinner ကို Discussion Group ထဲမှာပဲ သုံးနိုင်ပါတယ်။");
  }

  // must reply to auto-forwarded channel post
  if (!msg.reply_to_message || !msg.reply_to_message.is_automatic_forward) {
    return bot.sendMessage(chatId, "⚠️ Channel post (auto-forwarded) ကို Reply လုပ်ပြီး /pickwinner ပို့ပါ။");
  }

  const groupChatId = String(chatId);
  const channelPostId =
    msg.reply_to_message.forward_from_message_id ||
    msg.reply_to_message.message_id;

  if (!channelPostId) return bot.sendMessage(chatId, "⚠️ channelPostId မရပါ။");

  const giveawayPost = await GiveawayPost.findOne({ channelPostId }).lean();
  if (!giveawayPost) {
    return bot.sendMessage(chatId, "⚠️ ဒီ post က giveaway မဟုတ်ပါ (DB ထဲမှာ မရှိပါ)။");
  }

  const entries = await GiveawayEntry.find({ groupChatId, channelPostId }).lean();
  if (!entries.length) {
    return bot.sendMessage(chatId, "⚠️ Comment မရှိသေးပါ။");
  }

  // 20s spinner countdown
  let countdown = 20;
  const spinnerFrames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  let spinnerIndex = 0;

  const sent = await bot.sendMessage(
    chatId,
    `🌀 <b>${spinnerFrames[0]} Winner ရွေးချယ်နေပါပြီ...</b>\n\n⏳ <b>${countdown}</b> စက္ကန့်`,
    { parse_mode: "HTML" }
  );

  const timer = setInterval(async () => {
    countdown--;
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;

    if (countdown > 0) {
      try {
        await bot.editMessageText(
          `🌀 <b>${spinnerFrames[spinnerIndex]} Winner ရွေးချယ်နေပါပြီ...</b>\n\n⏳ <b>${countdown}</b> စက္ကန့်`,
          { chat_id: chatId, message_id: sent.message_id, parse_mode: "HTML" }
        );
      } catch (_) {}
    }
  }, 1000);

  await new Promise(res => setTimeout(res, 20000));
  clearInterval(timer);

  // pick random
  const winner = entries[Math.floor(Math.random() * entries.length)];
  const mention = winner.username
    ? `@${escapeHTML(winner.username)}`
    : `<a href="tg://user?id=${escapeHTML(winner.userId)}">${escapeHTML(winner.name || "Winner")}</a>`;

  const resultText =
`✅ <b>Winner ထွက်ပေါ်လာပါပြီ!</b>

🏆 <b>Winner:</b> ${mention}
💬 <b>Winner comment:</b> <i>${escapeHTML(winner.comment)}</i>`;

  await bot.editMessageText(resultText, {
    chat_id: chatId,
    message_id: sent.message_id,
    parse_mode: "HTML"
  });

  // save history
  await WinnerHistory.create({
    groupChatId,
    channelId: giveawayPost.channelId || "",
    channelPostId,
    winnerUserId: winner.userId,
    winnerUsername: winner.username || "",
    winnerName: winner.name || "",
    winnerComment: winner.comment || "",
    pickedAt: new Date(),
  });

  // cleanup current giveaway (avoid mixing with next giveaways)
  await GiveawayEntry.deleteMany({ groupChatId, channelPostId });
  await GiveawayPost.deleteOne({ channelPostId });
});

// ===================================
// /winnerlist — show last winners in this group
// ===================================
bot.onText(/\/winnerlist\b/, async (msg) => {
  await touchUser(msg.from);
  await touchChat(msg.chat);

  const chatId = msg.chat.id;
  if (!(msg.chat.type === "group" || msg.chat.type === "supergroup")) {
    return bot.sendMessage(chatId, "ℹ️ /winnerlist ကို group/supergroup ထဲမှာပဲ သုံးနိုင်ပါတယ်။");
  }

  const groupChatId = String(chatId);

  const rows = await WinnerHistory.find({ groupChatId })
    .sort({ pickedAt: -1 })
    .limit(20)
    .lean();

  if (!rows.length) {
    return bot.sendMessage(chatId, "📭 ဒီ group မှာ Winner History မရှိသေးပါ။");
  }

  const lines = rows.map((w, i) => {
    const n = rows.length - i;
    const who = w.winnerUsername ? `@${escapeHTML(w.winnerUsername)}` : `<b>${escapeHTML(w.winnerName || "Winner")}</b>`;
    const when = new Date(w.pickedAt).toLocaleString("en-GB");
    return `#${n}\n🏆 ${who}\n💬 <i>${escapeHTML(w.winnerComment || "")}</i>\n🕒 ${escapeHTML(when)}`;
  }).join("\n\n");

  await bot.sendMessage(chatId, `📜 <b>Winner List (Last 20)</b>\n\n${lines}`, { parse_mode: "HTML" });
});

// ===================================
// STEP B: DETECT GIVEAWAY CHANNEL POST (text or photo caption)
// Save only posts that contain @Bikastorebot mention
// ===================================
bot.on("channel_post", async (msg) => {
  try {
    const text = msg.caption || msg.text || "";
    if (!text.includes("@Bikastorebot")) return;

    const channelId = String(msg.chat.id);
    const channelPostId = msg.message_id;

    // linked discussion group (if exists)
    const discussionChatId =
      msg.chat?.linked_chat_id ? String(msg.chat.linked_chat_id) : null;

    const exists = await GiveawayPost.findOne({ channelId, channelPostId }).lean();
    if (exists) return;

    await GiveawayPost.create({
      channelId,
      channelPostId,
      discussionChatId,
      mentionTag: "@Bikastorebot",
      createdAt: new Date(),
    });

    console.log("🎁 Giveaway post detected:", channelId, channelPostId);
  } catch (err) {
    console.error("❌ Giveaway channel_post error:", err?.message || err);
  }
});

// ===================================
// ONE bot.on("message") — merged (broadcast + giveaway entry + order flow + promo wait)
// ===================================
bot.on("message", async (msg) => {
  await touchChat(msg.chat);
  if (msg.from) await touchUser(msg.from);

  const cid = msg.chat.id;

  // ========= STEP C: SAVE GIVEAWAY COMMENTS (DB-only, multiple-safe) =========
  // When users comment in discussion group replying to auto-forwarded channel post
  if (
    (msg.chat?.type === "group" || msg.chat?.type === "supergroup") &&
    msg.reply_to_message &&
    msg.reply_to_message.is_automatic_forward &&
    msg.from &&
    !msg.from.is_bot
  ) {
    const groupChatId = String(msg.chat.id);
    const channelPostId =
      msg.reply_to_message.forward_from_message_id ||
      msg.reply_to_message.message_id;

    if (channelPostId) {
      const giveawayPost = await GiveawayPost.findOne({ channelPostId }).lean();
      if (giveawayPost) {
        const userId = String(msg.from.id);
        const commentText = (msg.text && msg.text.trim()) || (msg.caption && msg.caption.trim()) || "[non-text]";

        try {
          await GiveawayEntry.create({
            groupChatId,
            channelPostId,
            userId,
            username: msg.from.username || "",
            name: msg.from.first_name || msg.from.username || "User",
            comment: commentText,
            commentMessageId: msg.message_id,
            createdAt: new Date(),
          });
        } catch (e) {
          // duplicate comment ignored
          if (String(e?.code) !== "11000") console.error("GiveawayEntry create error:", e?.message || e);
        }
      }
    }
  }

  // ========= ADMIN BROADCAST (TEXT) =========
  if (msg.text && msg.text.startsWith("/broadcast")) {
    if (!msg.from || !isAdminUser(msg.from.id)) return;

    const body = msg.text.replace(/^\/broadcast\s*/i, "").trim();
    if (!body) {
      return bot.sendMessage(cid, "Usage: <code>/broadcast Hello everyone</code>", { parse_mode: "HTML" });
    }

    const status = await bot.sendMessage(cid, "📣 Broadcasting…", { parse_mode: "HTML" });
    const res = await broadcastToAll({ text: body });

    try {
      await bot.editMessageText(
        `✅ Broadcast Done\n\n📤 Sent: <b>${formatMMK(res.ok)}</b>\n❌ Failed: <b>${formatMMK(res.fail)}</b>\n👥 Total: <b>${formatMMK(res.total)}</b>`,
        { chat_id: cid, message_id: status.message_id, parse_mode: "HTML" }
      );
    } catch (_) {}

    return;
  }

  // ========= IGNORE OTHER COMMANDS =========
  if (msg.text && msg.text.startsWith("/")) return;

  // ========= PROMO WINNER WAIT ID/SV (private only) =========
  const s = session[cid] || (session[cid] = {});
  s.userMentionHTML = s.userMentionHTML || (msg.from ? mentionUserHTML(msg.from) : "User");

  if (s.promoWaitId === true && msg.text && msg.chat.type === "private") {
    const parsed = parseGameIdAndServer(msg.text);
    if (!parsed) {
      await sendPrompt(cid, s, "⚠️ ID ပုံစံမမှန်ပါ။ ဥပမာ: <b>486679424 (2463)</b>");
      return;
    }

    const active = await Promo.findOne({
      active: true,
      claimed: true,
      winnerUserId: String(msg.from.id),
      stage: "WAIT_ID"
    });

    if (!active) {
      s.promoWaitId = false;
      return bot.sendMessage(cid, "ℹ️ Promo မတွေ့ပါ။ /promo ကိုပြန်စစ်ပါ။", { parse_mode: "HTML" });
    }

    active.winnerGameId = parsed.gameId;
    active.winnerServerId = parsed.serverId || "";
    active.stage = "WAIT_APPROVE";
    await active.save();

    s.promoWaitId = false;

    await bot.sendMessage(
      cid,
      "✅ သင့်ဆုမဲကို ကို Bika ထံ ပေးပို့တင်ပြထားတယ်။ မကြာခင် Dia ထည့်ပေးပါလိမ့်မယ်။",
      { parse_mode: "HTML" }
    );

    const winnerMention = mentionUserHTML(msg.from);
    const adminText =
`🏆 <b>Giveaway Winner</b>

👤 Winner: ${winnerMention}
🎮 MLBB ID: <b>${escapeHTML(active.winnerGameId)}</b>${active.winnerServerId ? ` (<b>${escapeHTML(active.winnerServerId)}</b>)` : ""}

👇 Approve`;

    for (const adminId of ADMIN_IDS) {
      try {
        await bot.sendMessage(String(adminId), adminText, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Approve Giveaway", callback_data: `PROMO_APPROVE_${active._id}` }]
            ]
          }
        });
      } catch (_) {}
    }
    return;
  }

  // ========= ORDER FLOW TEXT STEPS (non-admin only) =========
  if (msg.from && isAdminUser(msg.from.id)) return; // admin chats ignore order flow

  if (!s.step) return;

  // WAIT_ID
  if (s.step === "WAIT_ID") {
    if (!msg.text) return;
    const parsed = parseGameIdAndServer(msg.text);
    if (!parsed) {
      await sendPrompt(cid, s, "⚠️ ID ပုံစံမမှန်ပါ။ ဥပမာ: <b>486679424 (2463)</b>");
      return;
    }
    s.gameId = parsed.gameId;
    s.serverId = parsed.serverId || "";
    s.step = "WAIT_ITEMS";

    const askItems =
`${buildPriceListText(s.game)}

🛒 ဝယ်ယူမဲ့ Amount ကို ရိုက်ထည့်ပါ
(single လဲရ / အများလဲရ, space/ + နဲ့ ခြားလို့ရ)

ဥပမာ:
<b>343</b>
<b>wp1 + 343 + wp2 + wp3</b>`;

    await sendPrompt(cid, s, askItems);
    return;
  }

  // WAIT_ITEMS
  if (s.step === "WAIT_ITEMS") {
    if (!msg.text) return;
    const items = parseItems(msg.text);
    if (!items.length) {
      await sendPrompt(cid, s, "⚠️ Amount မတွေ့ပါ။ ဥပမာ: <b>343</b> / <b>wp1 + 343</b>");
      return;
    }

    const { ok, total, normalizedItems, error } = validateAndSum(s.game, items);
    if (!ok) {
      await sendPrompt(cid, s, `⚠️ ${escapeHTML(error)}\n\nPrice list ပြန်စစ်ပြီး ပြန်ပို့ပါ။`);
      return;
    }

    s.items = normalizedItems;
    s.totalPrice = total;

    const no = await nextOrderNo();
    s.orderNo = no;
    s.orderId = `BKS-${String(no).padStart(7, "0")}`;
    s.orderDateText = nowDateText();
    s.step = "PREVIEW";

    if (s.lastPromptMessageId) {
      await deleteIfPossible(cid, s.lastPromptMessageId);
      s.lastPromptMessageId = null;
    }

    const previewHeader = `<b>📦 Order Preview</b>\n\n${buildOrderPreviewHTML(s)}`;
    const sent = await bot.sendMessage(cid, previewHeader, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: "ORDER_CONFIRM" },
            { text: "❌ Cancel", callback_data: "ORDER_CANCEL" }
          ]
        ]
      }
    });
    s.previewMessageId = sent.message_id;
    return;
  }
});

// ===================================
// PHOTO handler: (admin broadcast photo) + (order receipt flow)
// ===================================
bot.on("photo", async (msg) => {
  await touchChat(msg.chat);
  if (msg.from) await touchUser(msg.from);

  const cid = msg.chat.id;

  // ADMIN PHOTO BROADCAST
  const caption = msg.caption || "";
  if (caption && caption.startsWith("/broadcast")) {
    if (!msg.from || !isAdminUser(msg.from.id)) return;

    const body = caption.replace(/^\/broadcast\s*/i, "").trim();
    const fileId = msg.photo?.at(-1)?.file_id;
    if (!fileId) return;

    const status = await bot.sendMessage(cid, "📣 Broadcasting photo…", { parse_mode: "HTML" });
    const res = await broadcastToAll({
      photoFileId: fileId,
      captionHTML: body ? escapeHTML(body) : ""
    });

    try {
      await bot.editMessageText(
        `✅ Broadcast Done\n\n📤 Sent: <b>${formatMMK(res.ok)}</b>\n❌ Failed: <b>${formatMMK(res.fail)}</b>\n👥 Total: <b>${formatMMK(res.total)}</b>`,
        { chat_id: cid, message_id: status.message_id, parse_mode: "HTML" }
      );
    } catch (_) {}

    return;
  }

  // ORDER RECEIPT FLOW (non-admin)
  if (msg.from && isAdminUser(msg.from.id)) return;

  const s = session[cid];
  if (!s || s.step !== "WAIT_RECEIPT" || !s.orderId) return;

  const fileId = msg.photo?.at(-1)?.file_id;
  if (!fileId) return;

  if (s.lastPromptMessageId) {
    await deleteIfPossible(cid, s.lastPromptMessageId);
    s.lastPromptMessageId = null;
  }

  const pendingLine = "⏳ သင့်အော်ဒါကို Owner ထံ တင်ပြပြီးပါပြီ။ ကျေးဇူးပြု၍ ခေတ္တခန စောင့်ပေးပါ။";
  const userCaption =
`<b>${pendingLine}</b>

${buildOrderPreviewHTML(s)}`;

  const userSent = await bot.sendPhoto(cid, fileId, {
    caption: userCaption,
    parse_mode: "HTML",
  });

  const order = await Order.create({
    orderId: s.orderId,
    orderNo: s.orderNo,
    orderDateText: s.orderDateText,

    userId: String(cid),
    username: msg.from.username || "",
    firstName: msg.from.first_name || "",

    game: s.game,
    gameId: s.gameId,
    serverId: s.serverId,

    items: s.items,
    totalPrice: s.totalPrice,

    paymentMethod: s.paymentMethod || "",
    receiptFileId: fileId,

    status: "PENDING",

    userOrderMessageId: userSent.message_id,
  });

  const adminHeadline = "🧾 Order အသစ်ရောက်ရှိပါတယ်";
  const adminCaption =
`<b>${adminHeadline}</b>

👤 User: ${msg.from.username ? `@${escapeHTML(msg.from.username)}` : mentionUserHTML(msg.from)}
🆔 Order ID: <b>${escapeHTML(order.orderId)}</b>
🗓️ Order Date: <b>${escapeHTML(order.orderDateText || "")}</b>

🎮 Game: <b>${escapeHTML(order.game || "")}</b>
🎯 ID + SV: <b>${escapeHTML(order.gameId || "")}${order.serverId ? " (" + escapeHTML(order.serverId) + ")" : ""}</b>
💎 Amount: <b>${escapeHTML((order.items || []).join(" + "))}</b>
💰 Total: <b>${formatMMK(order.totalPrice || 0)} MMK</b>`;

  // send to all admins (store first message for edit)
  for (const adminId of ADMIN_IDS) {
    try {
      const adminSent = await bot.sendPhoto(String(adminId), fileId, {
        caption: adminCaption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
            { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
          ]]
        }
      });

      if (!order.adminMessageId) {
        order.adminMessageId = adminSent.message_id;
        order.adminChatId = String(adminId);
        await order.save();
      }
    } catch (e) {
      console.error("❌ Send to admin failed:", adminId, e?.message || e);
    }
  }

  delete session[cid];
});

// ===================================
// CALLBACKS (Order + Promo)
// ===================================
bot.on("callback_query", async (q) => {
  const cid = q.message.chat.id;
  const data = q.data;

  try { await bot.answerCallbackQuery(q.id); } catch (_) {}

  // ----- GAME SELECT -----
  if (data === "GAME_MLBB" || data === "GAME_PUBG") {
    const s = session[cid] || (session[cid] = {});
    s.userMentionHTML = s.userMentionHTML || mentionUserHTML(q.from);

    s.game = data === "GAME_MLBB" ? "MLBB" : "PUBG";
    s.step = "WAIT_ID";

    const askId =
`🆔 <b>${escapeHTML(s.game)}</b> ID + SV ID ပို့ပါ
ဥပမာ: <b>486679424 (2463)</b> / <b>486679424 2463</b> / <b>486679424(2463)</b>`;

    await sendPrompt(cid, s, askId);
    return;
  }

  // ----- ORDER CANCEL -----
  if (data === "ORDER_CANCEL") {
    const s = session[cid];
    if (s?.previewMessageId) await deleteIfPossible(cid, s.previewMessageId);
    if (s?.lastPromptMessageId) await deleteIfPossible(cid, s.lastPromptMessageId);
    await bot.sendMessage(cid, "✅ သင့်order ရုတ်သိမ်းလိုက်ပါပြီ။", { parse_mode: "HTML" });
    delete session[cid];
    return;
  }

  // ----- ORDER CONFIRM -> choose payment -----
  if (data === "ORDER_CONFIRM") {
    const s = session[cid];
    if (!s?.orderId) return;

    s.step = "PAY_SELECT";
    await sendPrompt(cid, s, "💳 Payment နည်းလမ်း ရွေးချယ်ပေးပါ 👇", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "KPay", callback_data: "PAY_KPAY" }],
          [{ text: "WavePay", callback_data: "PAY_WAVEPAY" }]
        ]
      }
    });
    return;
  }

  // ----- PAYMENT SELECT -> ask receipt -----
  if (data === "PAY_KPAY" || data === "PAY_WAVEPAY") {
    const s = session[cid];
    if (!s?.orderId) return;

    s.paymentMethod = data === "PAY_KPAY" ? "KPAY" : "WAVEPAY";
    s.step = "WAIT_RECEIPT";

    const payInfo = s.paymentMethod === "KPAY"
      ? `💳 <b>KPay</b>\n<b>Name</b> - ${escapeHTML(KPAY_NAME)}\n<b>Phone</b> - ${escapeHTML(KPAY_PHONE)}`
      : `💳 <b>WavePay</b>\n<b>Name</b> - ${escapeHTML(WAVEPAY_NAME)}\n<b>Phone</b> - ${escapeHTML(WAVEPAY_PHONE)}`;

    const askReceipt =
`${payInfo}

📸 ငွေလွှဲပြေစာ <b>ဓာတ်ပုံ</b> ပို့ပေးပါ
🆔 Order ID: <b>${escapeHTML(s.orderId)}</b>`;

    await sendPrompt(cid, s, askReceipt);
    return;
  }

  // ----- ADMIN ORDER APPROVE/REJECT -----
  if (data.startsWith("APPROVE_") || data.startsWith("REJECT_")) {
    if (!isAdminUser(q.from.id)) return;

    const orderId = data.split("_")[1];
    const approve = data.startsWith("APPROVE_");
    const newStatus = approve ? "COMPLETED" : "REJECTED";

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: newStatus },
      { new: true }
    );

    if (!order) {
      return bot.sendMessage(cid, "⚠️ Order မတွေ့ပါ။", { parse_mode: "HTML" });
    }

    const adminHeadline = approve ? "✅ Order Complete" : "❌ Order ပယ်ဖျက်ပြီးပါပြီ";

    const adminUserName = order.username
      ? `@${escapeHTML(order.username)}`
      : `<b>${escapeHTML(order.firstName || "User")}</b>`;

    const adminCaption =
`<b>${adminHeadline}</b>

👤 User: ${adminUserName}
🆔 Order ID: <b>${escapeHTML(order.orderId)}</b>
🗓️ Order Date: <b>${escapeHTML(order.orderDateText || "")}</b>

🎮 Game: <b>${escapeHTML(order.game || "")}</b>
🎯 ID + SV: <b>${escapeHTML(order.gameId || "")}${order.serverId ? " (" + escapeHTML(order.serverId) + ")" : ""}</b>
💎 Amount: <b>${escapeHTML((order.items || []).join(" + "))}</b>
💰 Total: <b>${formatMMK(order.totalPrice || 0)} MMK</b>`;

    // edit admin message caption (remove buttons)
    try {
      await bot.editMessageCaption(adminCaption, {
        chat_id: order.adminChatId,
        message_id: order.adminMessageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] }
      });
    } catch (_) {}

    const userHeadline = approve
      ? "🎉 သင့် Order အောင်မြင်စွာပြီးဆုံးသွားပါပြီ ဝယ်ယူအားပေးမူ့အတွက် ကျေးဇူးအထူးပါ"
      : "❌ သင့်အော်ဒါကို Owner မှ ပယ်ချလိုက်ပါသည်။ အမှားအယွင်းရှိပါက Bot Owner @Official_Bika ထံသို့ဆက်သွယ်ပါ။";

    const userCaption =
`<b>${escapeHTML(userHeadline)}</b>

👤 User: ${order.username ? `@${escapeHTML(order.username)}` : `<b>${escapeHTML(order.firstName || "User")}</b>`}
🆔 Order ID: <b>${escapeHTML(order.orderId)}</b>
🗓️ Order Date: <b>${escapeHTML(order.orderDateText || "")}</b>

🎮 Game: <b>${escapeHTML(order.game || "")}</b>
🎯 ID + SV: <b>${escapeHTML(order.gameId || "")}${order.serverId ? " (" + escapeHTML(order.serverId) + ")" : ""}</b>
💎 Amount: <b>${escapeHTML((order.items || []).join(" + "))}</b>
💰 Total: <b>${formatMMK(order.totalPrice || 0)} MMK</b>`;

    try {
      await bot.editMessageCaption(userCaption, {
        chat_id: order.userId,
        message_id: order.userOrderMessageId,
        parse_mode: "HTML",
      });
    } catch (_) {}

    return;
  }

  // ===================================
  // PROMO: CLAIM BUTTON (first click wins, within expireAt)
  // ===================================
  if (data.startsWith("PROMO_CLAIM_")) {
    if (q.message.chat.type !== "private") {
      return bot.sendMessage(cid, "ℹ️ Promo Claim ကို User Private Chat မှာပဲ လုပ်နိုင်ပါတယ်။", { parse_mode: "HTML" });
    }

    const promoId = data.replace("PROMO_CLAIM_", "").trim();
    const winnerId = String(q.from.id);

    const claimed = await Promo.findOneAndUpdate(
      {
        _id: promoId,
        active: true,
        claimed: false,
        stage: "CLAIM",
        expireAt: { $gt: new Date() }
      },
      {
        $set: {
          claimed: true,
          claimedAt: new Date(),
          winnerUserId: winnerId,
          winnerChatId: String(cid),
          winnerUsername: q.from.username || "",
          winnerFirstName: q.from.first_name || "",
          stage: "WAIT_ID"
        }
      },
      { new: true }
    );

    if (claimed) {
      // delete promo UI message in winner chat
      const s = session[cid] || (session[cid] = {});
      if (s.lastPromoMessageId) {
        await deleteIfPossible(cid, s.lastPromoMessageId);
        s.lastPromoMessageId = null;
      }

      s.promoWaitId = true;
      await bot.sendMessage(
        cid,
        `🎉 <b>ဂုဏ်ယူပါတယ်!</b>\nသင်ကံထူးရှင်ဖြစ်သွားပါပြီ 🎊\n\n🆔 သင့် <b>MLBB ID + Server ID</b> ပို့ပေးပါ\nဥပမာ: <b>486679424 (2463)</b>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // already claimed by someone else
    const active = await Promo.findOne({ _id: promoId }).lean();
    if (!active || !active.claimed) {
      return bot.sendMessage(cid, "ℹ️ Promo မတွေ့ပါ (သို့) အလုပ်မလုပ်ပါ။ /promo ပြန်စမ်းပါ။", { parse_mode: "HTML" });
    }

    const winnerMention = active.winnerUsername
      ? `@${escapeHTML(active.winnerUsername)}`
      : `<b>${escapeHTML(active.winnerFirstName || "Winner")}</b>`;

    const loserText =
`${winnerMention} က ယခုဆုမဲကို သင့်ထက်အရင် ဦးစွာထုတ်ယူသွားပါပြီ။
နောက်ကျရင် ကောင်းတာဆိုလို့ သေတာပဲရှိတယ် ညိုကီဘိုကီ❗`;

    try {
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: cid, message_id: q.message.message_id });
    } catch (_) {}

    await bot.sendMessage(cid, loserText, { parse_mode: "HTML" });
    return;
  }

  // ===================================
  // PROMO: ADMIN APPROVE GIVEAWAY
  // ===================================
  if (data.startsWith("PROMO_APPROVE_")) {
    if (!isAdminUser(q.from.id)) return;

    const promoId = data.replace("PROMO_APPROVE_", "").trim();
    const promo = await Promo.findOne({ _id: promoId });

    if (!promo || !promo.claimed) {
      return bot.sendMessage(cid, "⚠️ Promo မရှိသေးဘူးကွ အားတိုင်း promo ပဲနှိပ်မနေနဲ့။", { parse_mode: "HTML" });
    }

    promo.stage = "DONE";
    promo.active = false;
    await promo.save();

    const winnerChatId = promo.winnerChatId;
    const winnerMention = promo.winnerUsername
      ? `@${escapeHTML(promo.winnerUsername)}`
      : `<b>${escapeHTML(promo.winnerFirstName || "Winner")}</b>`;

    try {
      await bot.sendMessage(
        winnerChatId,
        `🎁 သင့်ဆုမဲကို ကို Bika ထုတ်ပေးလိုက်ပါပြီ ${winnerMention} ရေ`,
        { parse_mode: "HTML" }
      );
    } catch (_) {}

    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: cid, message_id: q.message.message_id }
      );
    } catch (_) {}

    await bot.sendMessage(cid, "✅ Giveaway Approved (Winner ကို notify လုပ်ပြီးပါပြီ)", { parse_mode: "HTML" });
    return;
  }
});

// ===================================
// SERVER
// ===================================
app.get("/", (_, res) => res.send("Bika Store Bot Running"));

app.listen(PORT, async () => {
  await bot.setWebHook(`${PUBLIC_URL}${WEBHOOK_PATH}`);
  await setupCommands();
  console.log("✅ Bot Ready");
});
