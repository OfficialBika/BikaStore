'use strict';

/**
 * BIKA STORE BOT - MongoDB + Webhook Version (MLBB & PUBG only)
 *
 * Features:
 *  - MLBB: ask MLBB ID + Server ID together in one message (e.g. "12345678 1234")
 *  - Payment slip flow:
 *      User taps "I have paid" -> bot asks for screenshot -> user sends photo
 *      Then admins receive: slip + order info + Approve / Reject buttons
 *  - When admin Approve / Reject:
 *      - Buttons disappear on that admin message, caption changes to "Order Complete" or "Order Rejected"
 *      - If Approve -> user receives "Order Complete" summary
 *  - Promo system:
 *      /promocreate (admin) -> 1 hour MLBB promo
 *      /promo or Promo button -> first Claim wins
 *      Winner sends MLBB ID + Server ID -> goes to admin with Approve Gift button
 *  - Leaderboard:
 *      /top10 (last 3 months, COMPLETED only)
 *      /myrank (all-time COMPLETED)
 *  - /admin dashboard + /broadcast
 *
 * ENV:
 *  - TELEGRAM_BOT_TOKEN
 *  - ADMIN_IDS       (comma separated user IDs, e.g. 123,456)
 *  - STORE_CURRENCY  (optional, default 'Ks')
 *  - MONGODB_URI
 *  - PUBLIC_URL      (e.g. https://mybot.onrender.com)
 *  - TZ              (IANA timezone, e.g. Asia/Yangon)
 */

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');

// ====== ENV ======
const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN_HERE';
if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.warn('⚠️ Please set TELEGRAM_BOT_TOKEN in your environment!');
}

const STORE_CURRENCY = process.env.STORE_CURRENCY || 'Ks';
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bika_store_bot';

const PUBLIC_URL = process.env.PUBLIC_URL || '';
// 🕒 Timezone (env: TZ)
const TIME_ZONE = process.env.TZ || 'Asia/Yangon';

// ====== MONGOOSE INIT ======
mongoose
  .connect(MONGODB_URI, { autoIndex: true })
  .then(() => console.log('🍃 MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Counter for auto-increment order id
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', counterSchema);

// Order schema (MLBB / PUBG)
const orderSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true }, // human-friendly order ID (#1, #2, ...)
  userId: { type: Number, index: true },
  username: String,
  firstName: String,
  categoryKey: String, // 'mlbb' | 'pubg'
  packageId: String,
  packageName: String,
  price: Number,
  currency: String,
  // MLBB & PUBG IDs
  gameId: String, // MLBB ID or PUBG ID
  serverId: String, // MLBB Server ID (empty for PUBG)
  status: { type: String, index: true }, // PENDING_PAYMENT, AWAITING_SLIP, PENDING_CONFIRMATION, COMPLETED, REJECTED, ...
  createdAt: Date,
  paidAt: Date,
  confirmedAt: Date,
  adminNote: String,
  paymentSlipFileId: String, // telegram file_id of slip
});

const Order = mongoose.model('Order', orderSchema);

// ====== BOT INIT (Webhook mode) ======
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

// 🧼 Auto clean – normal users only (admins skipped)
const attachAutoClean = require('./autoClean');
const autoClean = attachAutoClean(bot, { skipChatIds: ADMIN_IDS });

// Webhook setup (if PUBLIC_URL provided)
if (PUBLIC_URL) {
  const cleanBase = PUBLIC_URL.replace(/\/+$/, '');
  const webhookUrl = `${cleanBase}/webhook/${BOT_TOKEN}`;
  bot
    .setWebHook(webhookUrl)
    .then(() => console.log('🔗 Webhook set to:', webhookUrl))
    .catch((err) =>
      console.error('Failed to set webhook automatically:', err.message)
    );
} else {
  console.warn(
    '⚠️ PUBLIC_URL not set. Please configure webhook manually via BotFather.'
  );
}

// Express app for webhook
const app = express();
app.use(express.json());

// Accept Telegram updates on ANY path (easy for BotFather / Render)
app.post('*', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Simple health check
app.get('/', (req, res) => {
  res.send('BIKA Store Bot is running (webhook mode).');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🌐 Express server listening on port', PORT);
});

// ====== IN-MEMORY DATA ======

/**
 * Session per user:
 * {
 *   step: 'WAIT_MLBB_ID_SVID' | 'WAIT_PUBG_ID' | 'WAIT_CONFIRM' | 'WAIT_SLIP' | null,
 *   orderDraft: {...},
 *   pendingOrderId: number | null
 * }
 */
const sessions = new Map();

/**
 * For auto-deleting step messages (per user)
 */
const userLastStepMessage = new Map();

/**
 * Known users for broadcast
 */
const knownUserIds = new Set();

/**
 * Promotion config (normal bot-wide promo text)
 */
const promoConfig = {
  isActive: true,
  text:
    '🎉 Welcome to BIKA Store – Game Top-up Promo!\n\n' +
    'MLBB Diamonds & Weekly Pass နှင့် PUBG UC ကို Telegram Bot လေးကနေပဲ မြန်မြန်ဆန်ဆန် top-up ပေးနေပါတယ်။\n' +
    'Order တင်ချင်ရင် Game Items ကိုနှိပ်ပြီး package ရွေးပေးလိုက်ရုံပါ ကိုယ်ဂယ်မဲ့ဟာ မပေါ်မချင်း Next ကိုနှိပ်သွားပါ 💎🎯',
};

/**
 * One-hour MLBB free diamonds promo state
 * Admin will use /promocreate to start.
 *
 * shape:
 * {
 *   createdBy, createdAt, expiresAt,
 *   winnerUserId, winnerUsername, winnerFirstName,
 *   winnerChatId,
 *   winnerGameId, winnerServerId
 * }
 */
let activePromo = null;

// ====== PROMO HELPERS ======

function startNewPromo(adminId) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

  activePromo = {
    createdBy: adminId,
    createdAt: now,
    expiresAt,
    winnerUserId: null,
    winnerUsername: null,
    winnerFirstName: null,
    winnerChatId: null,
    winnerGameId: null,
    winnerServerId: null,
  };
}

function getActivePromo() {
  if (!activePromo) return null;
  if (activePromo.expiresAt && activePromo.expiresAt.getTime() < Date.now()) {
    // expired → clear
    activePromo = null;
    return null;
  }
  return activePromo;
}

// User-side promo handler (used by /promo & Promo button)
async function handlePromoRequest(chatId, fromUser) {
  const promo = getActivePromo();
  const isAdminUser = isAdmin(fromUser.id);

  if (!promo) {
    await bot.sendMessage(
      chatId,
      '😢 ယခုအချိန်မှာ Claim လုပ်လို့ရမယ့် Promo မရှိသေးဘူးနော်။\n\nအားတိုင်း promo ပဲနှိပ်မနေကြနဲ့ 😎',
      {
        ...buildMainMenu(isAdminUser),
      }
    );
    return;
  }

  // already have winner
  if (promo.winnerUserId) {
    const winnerLabel = promo.winnerUsername
      ? '@' + promo.winnerUsername
      : promo.winnerFirstName || `User ${promo.winnerUserId}`;

    const text =
      '😢 ဒီတစ်ခါသင် နောက်ကျသွားပါပြီ...\n\n' +
      `ပထမဆုံး Claim လိုက်တဲ့ ကံကောင်းသူကတော့ *${winnerLabel}* ဖြစ်ပါတယ် 💎\n\n` +
      'နောက်ကျရင် ကောင်းတာဆိုလို့ သေတာပဲရှိတယ် ညိုကီဘိုကီ 😎';

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      ...buildMainMenu(isAdminUser),
    });
    return;
  }

  const expiresStr = formatDateTime(promo.expiresAt);
  const text =
    '🎁 **BIKA STORE – MLBB Free Diamonds Promo**\n\n' +
    '၁ နာရီအတွင်း **/promo** (သို့) Promo button ကို နှိပ်ပြီး\n' +
    '**Claim** button ကို *ပထမဆုံး* နှိပ်တဲ့သူက free MLBB Diamonds ရရှိမယ် 💎\n\n' +
    `⏰ Promo သက်တမ်း: \`${expiresStr}\` အထိ\n\n` +
    'အောက်က button ကိုနှိပ်ပြီး Claim လုပ်ကြည့်ပါ 😎';

  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 Claim free MLBB Diamonds', callback_data: 'promo:claim' }],
      ],
    },
  });
}

// ====== STORE CATEGORIES (MLBB + PUBG) ======

const CATEGORIES = {
  mlbb: {
    key: 'mlbb',
    name: 'MLBB Diamonds & Pass',
    description: 'Mobile Legends: Bang Bang – Diamonds and Weekly Pass.',
    emoji: '💎',
    packages: [
      { id: 'mlbb_11', name: '11 Diamonds', price: 800 },
      { id: 'mlbb_22', name: '22 Diamonds', price: 1600 },
      { id: 'mlbb_33', name: '33 Diamonds', price: 2350 },
      { id: 'mlbb_55', name: '55 Diamonds', price: 3600 },
      { id: 'mlbb_86', name: '86 Diamonds', price: 4800 },
      { id: 'mlbb_112', name: '112 Diamonds', price: 8200 },
      { id: 'mlbb_172', name: '172 Diamonds', price: 9800 },
      { id: 'mlbb_257', name: '257 Diamonds', price: 14500 },
      { id: 'mlbb_343', name: '343 Diamonds', price: 20000 },
      { id: 'mlbb_429', name: '429 Diamonds', price: 25000 },
      { id: 'mlbb_514', name: '514 Diamonds', price: 29900 },
      { id: 'mlbb_600', name: '600 Diamonds', price: 34500 },
      { id: 'mlbb_706', name: '706 Diamonds', price: 39900 },
      { id: 'mlbb_792', name: '792 Diamonds', price: 44500 },
      { id: 'mlbb_878', name: '878 Diamonds', price: 48500 },
      { id: 'mlbb_963', name: '963 Diamonds', price: 53000 },
      { id: 'mlbb_1049', name: '1049 Diamonds', price: 59900 },
      { id: 'mlbb_1135', name: '1135 Diamonds', price: 63500 },
      { id: 'mlbb_1412', name: '1412 Diamonds', price: 77000 },
      { id: 'mlbb_1584', name: '1584 Diamonds', price: 88000 },
      { id: 'mlbb_1669', name: '1669 Diamonds', price: 94000 },
      { id: 'mlbb_2195', name: '2195 Diamonds', price: 118900 },
      { id: 'mlbb_3158', name: '3158 Diamonds', price: 172000 },
      { id: 'mlbb_3688', name: '3688 Diamonds', price: 202000 },
      { id: 'mlbb_4390', name: '4390 Diamonds', price: 237000 },
      { id: 'mlbb_5100', name: '5100 Diamonds', price: 280000 },
      { id: 'mlbb_5532', name: '5532 Diamonds', price: 300000 },
      { id: 'mlbb_6055', name: '6055 Diamonds', price: 330000 },

      { id: 'mlbb_wp1', name: 'Weekly Pass 1 (wp1)', price: 5900 },
      { id: 'mlbb_wp2', name: 'Weekly Pass 2 (wp2)', price: 11800 },
      { id: 'mlbb_wp3', name: 'Weekly Pass 3 (wp3)', price: 17700 },
      { id: 'mlbb_wp4', name: 'Weekly Pass 4 (wp4)', price: 23600 },
      { id: 'mlbb_wp5', name: 'Weekly Pass 5 (wp5)', price: 29500 },
      { id: 'mlbb_web', name: 'WEB Pack (web)', price: 3500 },
      { id: 'mlbb_meb', name: 'MEB Pack (meb)', price: 16500 },
    ],
  },

  pubg: {
    key: 'pubg',
    name: 'PUBG UC & Prime',
    description: 'PUBG Mobile – UC top-up and Prime subscriptions.',
    emoji: '🎯',
    packages: [
      { id: 'pubg_60', name: '60 UC', price: 4500 },
      { id: 'pubg_325', name: '325 UC', price: 19500 },
      { id: 'pubg_660', name: '660 UC', price: 38000 },
      { id: 'pubg_1800', name: '1800 UC', price: 90500 },
      { id: 'pubg_3850', name: '3850 UC', price: 185000 },
      { id: 'pubg_8100', name: '8100 UC', price: 363000 },
      { id: 'pubg_prime1m', name: 'Prime 1 Month', price: 4500 },
      { id: 'pubg_primeplus', name: 'Prime Plus', price: 39500 },
    ],
  },
};

const CATEGORY_LIST = Object.values(CATEGORIES);

// ====== UTILITIES ======

function isAdmin(userId) {
  return ADMIN_IDS.includes(String(userId));
}

function formatPrice(value) {
  if (typeof value !== 'number') return value;
  return value.toLocaleString('en-US') + ' ' + STORE_CURRENCY;
}

// Reset session + auto delete last step message
function resetUserSession(userId) {
  const last = userLastStepMessage.get(userId);
  if (last) {
    bot.deleteMessage(last.chatId, last.messageId).catch(() => {});
  }
  sessions.delete(userId);
  userLastStepMessage.delete(userId);
}

function getUserSession(userId, createIfMissing = false) {
  if (!sessions.has(userId) && createIfMissing) {
    sessions.set(userId, {
      step: null,
      orderDraft: null,
      pendingOrderId: null,
    });
  }
  return sessions.get(userId) || null;
}

async function getNextOrderId() {
  const counter = await Counter.findByIdAndUpdate(
    'order',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

function formatDateTime(dt) {
  if (!dt) return '-';

  let d = dt;
  if (!(d instanceof Date)) {
    d = new Date(dt);
  }
  if (Number.isNaN(d.getTime())) {
    return '-';
  }

  return d.toLocaleString('en-GB', {
    timeZone: TIME_ZONE, // 👉 env.TZ ကို သုံးမယ်
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function shortUserLabel(order) {
  const name = order.firstName || order.username || order.userId;
  return `${name}`;
}

// send step message & auto-delete previous step msg
async function sendStepMessage(userId, chatId, text, options = {}) {
  const last = userLastStepMessage.get(userId);
  if (last && last.chatId === chatId) {
    try {
      await bot.deleteMessage(chatId, last.messageId);
    } catch (e) {
      // ignore (too old / already deleted)
    }
  }
  const sent = await bot.sendMessage(chatId, text, options);
  userLastStepMessage.set(userId, { chatId, messageId: sent.message_id });
  return sent;
}

// ====== CSV EXPORT ======

async function ordersToCSV() {
  const header = [
    'id',
    'userId',
    'username',
    'firstName',
    'categoryKey',
    'packageId',
    'packageName',
    'price',
    'currency',
    'gameId',
    'serverId',
    'status',
    'createdAt',
    'paidAt',
    'confirmedAt',
    'adminNote',
    'paymentSlipFileId',
  ];

  const lines = [];
  lines.push(header.join(','));

  const allOrders = await Order.find({}).sort({ id: 1 }).lean();

  for (const o of allOrders) {
    const row = [
      escapeCSVValue(o.id),
      escapeCSVValue(o.userId),
      escapeCSVValue(o.username),
      escapeCSVValue(o.firstName),
      escapeCSVValue(o.categoryKey),
      escapeCSVValue(o.packageId),
      escapeCSVValue(o.packageName),
      escapeCSVValue(o.price),
      escapeCSVValue(o.currency),
      escapeCSVValue(o.gameId),
      escapeCSVValue(o.serverId),
      escapeCSVValue(o.status),
      escapeCSVValue(o.createdAt),
      escapeCSVValue(o.paidAt),
      escapeCSVValue(o.confirmedAt),
      escapeCSVValue(o.adminNote),
      escapeCSVValue(o.paymentSlipFileId),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

function escapeCSVValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ====== LEADERBOARD & ADMIN STATS ======

/**
 * Top customers by total spent (COMPLETED orders only, last 3 months)
 */
async function getTopCustomers(limit = 10) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  const results = await Order.aggregate([
    {
      $match: {
        status: 'COMPLETED',
        createdAt: { $gte: threeMonthsAgo },
      },
    },
    {
      $group: {
        _id: '$userId',
        totalAmount: { $sum: '$price' },
        orderCount: { $sum: 1 },
        username: { $first: '$username' },
        firstName: { $first: '$firstName' },
      },
    },
    { $sort: { totalAmount: -1 } },
    { $limit: limit },
  ]);

  return results;
}

/**
 * Get rank and stats for a single user (COMPLETED orders only, all time)
 */
async function getUserRank(userId) {
  const uid = Number(userId);

  // User's own total
  const userAgg = await Order.aggregate([
    { $match: { status: 'COMPLETED', userId: uid } },
    {
      $group: {
        _id: '$userId',
        totalAmount: { $sum: '$price' },
        orderCount: { $sum: 1 },
        username: { $first: '$username' },
        firstName: { $first: '$firstName' },
      },
    },
    { $limit: 1 },
  ]);

  if (!userAgg.length) {
    return null; // no completed orders for this user yet
  }

  const userStat = userAgg[0];

  // How many users have strictly higher totalAmount?
  const higherAgg = await Order.aggregate([
    { $match: { status: 'COMPLETED' } },
    {
      $group: {
        _id: '$userId',
        totalAmount: { $sum: '$price' },
      },
    },
    { $match: { totalAmount: { $gt: userStat.totalAmount } } },
    { $count: 'higherCount' },
  ]);

  const higherCount =
    (higherAgg && higherAgg[0] && higherAgg[0].higherCount) || 0;

  return {
    rank: higherCount + 1,
    totalAmount: userStat.totalAmount,
    orderCount: userStat.orderCount,
    username: userStat.username,
    firstName: userStat.firstName,
  };
}

/**
 * Admin dashboard stats (completed orders only)
 */
async function getAdminStats() {
  const totalUsers = knownUserIds.size;

  const agg = await Order.aggregate([
    { $match: { status: 'COMPLETED' } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalMmk: { $sum: '$price' },
      },
    },
  ]);

  let totalOrders = 0;
  let totalMmk = 0;

  if (agg.length) {
    totalOrders = agg[0].totalOrders;
    totalMmk = agg[0].totalMmk;
  }

  return { totalUsers, totalOrders, totalMmk };
}

// ====== UI BUILDERS ======

function buildMainMenu(isAdminUser) {
  const keyboard = [
    [
      { text: '🛍 Game Items', callback_data: 'm:browse' },
      { text: '📦 My Orders', callback_data: 'm:orders' },
    ],
    [{ text: ' Help', callback_data: 'm:help' }],
  ];
  if (promoConfig.isActive && promoConfig.text) {
    keyboard.unshift([{ text: '🎉 Promo', callback_data: 'm:promo' }]);
  }
  if (isAdminUser) {
    keyboard.push([{ text: '🛠 Admin Panel', callback_data: 'admin:panel' }]);
  }

  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
}

function buildCategoryKeyboard() {
  const rows = CATEGORY_LIST.map((cat) => [
    {
      text: `${cat.emoji} ${cat.name}`,
      callback_data: `cat:${cat.key}:1`, // page 1
    },
  ]);
  rows.push([{ text: '⬅️ Back to Main Menu', callback_data: 'm:main' }]);
  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function buildPackagesKeyboard(categoryKey, page = 1, pageSize = 6) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return { reply_markup: { inline_keyboard: [] } };

  const start = (page - 1) * pageSize;
  const items = cat.packages.slice(start, start + pageSize);
  const rows = items.map((pkg) => [
    {
      text: `${pkg.name} – ${formatPrice(pkg.price)}`,
      callback_data: `pkg:${categoryKey}:${pkg.id}`,
    },
  ]);

  const totalPages = Math.max(1, Math.ceil(cat.packages.length / pageSize));
  const navRow = [];

  if (page > 1) {
    navRow.push({
      text: '« Prev',
      callback_data: `cat:${categoryKey}:${page - 1}`,
    });
  }
  if (page < totalPages) {
    navRow.push({
      text: 'Next »',
      callback_data: `cat:${categoryKey}:${page + 1}`,
    });
  }
  if (navRow.length) rows.push(navRow);

  rows.push([{ text: '⬅️ Back to Categories', callback_data: 'm:browse' }]);

  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function buildAdminPanelKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Recent Orders', callback_data: 'admin:orders' },
          { text: '⏳ Pending Payments', callback_data: 'admin:pending' },
        ],
        [
          { text: '🎯 Promotions', callback_data: 'admin:promo' },
          { text: '📣 Broadcast Promo', callback_data: 'admin:broadcast' },
        ],
        [
          { text: '📄 Export Orders (CSV)', callback_data: 'admin:export_csv' },
        ],
        [{ text: '⬅️ Back to Main Menu', callback_data: 'm:main' }],
      ],
    },
  };
}

function formatOrderSummary(order, options = {}) {
  const showStatus = options.showStatus !== false;
  const titleVariant = options.title || 'DEFAULT';

  const lines = [];

  // Header title
  if (titleVariant === 'COMPLETE') {
    lines.push('✅ **BIKA STORE – Order Complete**');
  } else if (titleVariant === 'REJECTED') {
    lines.push('❌ **BIKA STORE – Order Rejected**');
  } else if (titleVariant === 'NEW') {
    lines.push('🆕 **BIKA STORE – New Order**');
  } else {
    lines.push('🧾 **BIKA STORE – Order Detail**');
  }

  lines.push('');
  lines.push(`**Order ID:** \`#${order.id}\``);

  // Status line
  if (showStatus) {
    const statusLabel =
      {
        PENDING_PAYMENT: '⏳ Pending Payment',
        AWAITING_SLIP: '📸 Awaiting Slip',
        PENDING_CONFIRMATION: '🕒 Waiting Admin Confirmation',
        COMPLETED: '✅ Completed',
        REJECTED: '❌ Rejected',
        CANCELLED_BY_USER: '🚫 Cancelled by Customer',
      }[order.status] || order.status;

    lines.push(`**Status:** ${statusLabel}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');

  // Game & Package
  lines.push('🎮 **Game & Package**');
  const gameLabel =
    order.categoryKey === 'mlbb'
      ? 'MLBB Diamonds & Weekly Pass'
      : 'PUBG UC & Prime';

  lines.push(`• Game: *${gameLabel}*`);
  lines.push(`• Package: *${order.packageName}*`);
  lines.push(`• Price: *${formatPrice(order.price)}*`);

  // Account Info
  lines.push('');
  lines.push('👤 **Account Info**');
  if (order.categoryKey === 'mlbb') {
    lines.push(`• MLBB ID: \`${order.gameId || '-'}\``);
    lines.push(`• Server ID: \`${order.serverId || '-'}\``);
  } else {
    lines.push(`• PUBG ID: \`${order.gameId || '-'}\``);
  }

  // Telegram user
  lines.push('');
  lines.push('💬 **Telegram User**');
  lines.push(
    `• @${order.username || 'unknown'} (${order.firstName || 'User'})`
  );

  // Timeline
  lines.push('');
  lines.push('🕓 **Timeline**');
  lines.push(`• Created:   ${formatDateTime(order.createdAt)}`);
  if (order.paidAt) {
    lines.push(`• Paid:      ${formatDateTime(order.paidAt)}`);
  }
  if (order.confirmedAt) {
    lines.push(`• Confirmed: ${formatDateTime(order.confirmedAt)}`);
  }

  // Admin note
  if (order.adminNote) {
    lines.push('');
    lines.push('📝 **Admin Note**');
    lines.push(order.adminNote);
  }

  return lines.join('\n');
}

function buildOrderDetailKeyboard(order, forAdmin) {
  const rows = [];

  if (forAdmin) {
    if (order.status === 'PENDING_PAYMENT') {
      rows.push([
        {
          text: 'Mark as Paid & Pending',
          callback_data: `admin:markpaid:${order.id}`,
        },
      ]);
    }
    if (order.status === 'PENDING_CONFIRMATION') {
      rows.push([
        {
          text: '✅ Approve (Complete)',
          callback_data: `admin:complete:${order.id}`,
        },
        {
          text: '❌ Reject Order',
          callback_data: `admin:reject:${order.id}`,
        },
      ]);
    }
  } else {
    if (order.status === 'PENDING_PAYMENT') {
      rows.push([
        {
          text: '💰 I have paid',
          callback_data: `payment:paid:${order.id}`,
        },
      ]);
    }
  }

  rows.push([
    {
      text: '⬅️ Back',
      callback_data: forAdmin ? 'admin:orders' : 'm:orders',
    },
  ]);

  return {
    reply_markup: {
      inline_keyboard: rows,
    },
    parse_mode: 'Markdown',
  };
}

// ====== MESSAGES ======

async function sendWelcome(chatId, user) {
  const isAdminUser = isAdmin(user.id);
  const lines = [
    '👋 **Welcome To BIKA Store**',
    '',
    'Game Items & Digital Services:',
    '• MLBB Diamonds & Weekly Pass (ID + Server ID)',
    '• PUBG UC & Prime (ID only)',
    '',
    'Telegram Bot ကနေပဲ မြန်မြန်ဆန်ဆန် top-up ပေးနေပါတယ်။',
    '',
    'အောက်က Menu ထဲက **🛍 Game Items** ကိုနှိပ်ပြီး အော်ဒါတင်ရအောင် ✨',
  ];

  await bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'Markdown',
    ...buildMainMenu(isAdminUser),
  });
}

async function sendPaymentInstructions(chatId, order) {
  const lines = [];
  lines.push(`💰 **Payment Instructions for Order #${order.id}**`);
  lines.push('');
  lines.push(`Amount to pay: *${formatPrice(order.price)}*`);
  lines.push('');
  lines.push('📌 Payment Methods ():');
  lines.push(' Payment Acc Name');
  lines.push('  Shine Htet Aung');
  lines.push('- KBZ Pay - 09264202637');
  lines.push('- WavePay - 09264202637');
  lines.push('- (Admin will specify exact account)');
  lines.push('');
  lines.push(
    'ငွေလွှဲပြီးသွားရင် အောက်က **"I have paid"** button ကိုနှိပ်ပြီး ' +
      'Bot က တောင်းတဲ့ ငွေလွှဲပြေစာ screenshot ကို ပို့ပေးပါ။'
  );

  await bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 I have paid', callback_data: `payment:paid:${order.id}` }],
        [{ text: '❌ Cancel Order', callback_data: `order:cancel:${order.id}` }],
      ],
    },
  });
}

// Helper – best-looking order confirm UI
async function sendOrderConfirmMessage(userId, chatId, draft) {
  const gameLabel =
    draft.categoryKey === 'mlbb' ? 'MLBB Diamonds & Pass' : 'PUBG UC & Prime';

  const lines = [];
  lines.push('📦 **Review & Confirm your order**');
  lines.push('');
  lines.push('**1. Game & Package**');
  lines.push(`• Game: *${gameLabel}*`);
  lines.push(`• Package: *${draft.packageName}*`);
  lines.push(`• Price: *${formatPrice(draft.price)}*`);
  lines.push('');
  lines.push('**2. Account Info**');

  if (draft.categoryKey === 'mlbb') {
    lines.push(`• MLBB ID: \`${draft.gameId}\``);
    lines.push(`• Server ID: \`${draft.serverId || '-'}\``);
  } else {
    lines.push(`• PUBG ID: \`${draft.gameId}\``);
  }

  lines.push('');
  lines.push('အထက်ပါ အချက်အလက်တွေ **မှန်ကန်တယ်** လို့သေချာရင်');
  lines.push(
    'အောက်က "✅ Confirm Order" ကိုနှိပ်ပြီး order ကို အတည်ပြုပါ။'
  );

  await sendStepMessage(userId, chatId, lines.join('\n'), {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Confirm Order', callback_data: 'order:confirm' }],
        [{ text: '❌ Cancel', callback_data: 'order:cancel_draft' }],
      ],
    },
  });
}

// ====== BOT HANDLERS (TEXT COMMANDS) ======

// /start with optional payload (/start from_website)
bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  knownUserIds.add(userId);
  resetUserSession(userId);

  const payloadRaw = match && match[1] ? match[1].trim() : '';
  const payload = payloadRaw ? payloadRaw.split(' ')[0] : '';

  if (payload === 'from_website') {
    await bot.sendMessage(
      chatId,
      '🌐 BIKA STORE Website ကနေ ဝင်လာတာကို ကြိုဆိုပါတယ်!\n\n' +
        'အော်ဒါတင်ရန်အတွက် အောက်က Menu ထဲက **🛍 Game Items** ကိုနှိပ်ပြီး ' +
        'MLBB Diamonds / Weekly Pass သို့မဟုတ် PUBG UC ကိုရွေးပြီး ဆက်လုပ်ပေးပါ 😊',
      { parse_mode: 'Markdown' }
    );
  }

  await sendWelcome(chatId, msg.from);
});

// /menu shortcut
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  const isAdminUser = isAdmin(msg.from.id);
  resetUserSession(msg.from.id);
  await bot.sendMessage(chatId, '🏠 Main menu', buildMainMenu(isAdminUser));
});

// /setpromo <text> (admin only)
bot.onText(/\/setpromo(?:\s+([\s\S]+))?/, async (msg, match) => {
  const userId = msg.from.id;
  if (!isAdmin(userId)) return;

  const chatId = msg.chat.id;
  const text = match && match[1] ? match[1].trim() : '';

  if (!text) {
    await bot.sendMessage(
      chatId,
      'Usage: `/setpromo your promotion text...`\n\nCurrent promo:\n' +
        (promoConfig.text || '_none_'),
      { parse_mode: 'Markdown' }
    );
    return;
  }

  promoConfig.text = text;
  promoConfig.isActive = true;

  await bot.sendMessage(chatId, '✅ Promotion text updated & enabled.');
});

// /promocreate – start 1-hour MLBB promo (admin only)
bot.onText(/\/promocreate/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) return;

  startNewPromo(userId);
  const promo = getActivePromo();
  const expiresStr = formatDateTime(promo.expiresAt);

  const text =
    '🎁 **MLBB Free Diamonds Promo Started!**\n\n' +
    'ယနေ့မှစပြီး ၁ နာရီအတွင်း /promo ကို ပို့သည့် user တွေထဲက\n' +
    '**Claim** button ကို ပထမဆုံးနှိပ်သူတစ်ယောက်သာ free MLBB Diamonds ရရှိမယ် 💎\n\n' +
    `⏰ သက်တမ်းက: \`${expiresStr}\` ထိ ဖြစ်ပါတယ်။`;

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// /promo – user-side lucky claim entry
bot.onText(/\/promo/, async (msg) => {
  const chatId = msg.chat.id;
  await handlePromoRequest(chatId, msg.from);
});

// /admin – show admin dashboard (stats + admin menu)
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) return;

  const stats = await getAdminStats();

  const lines = [];
  lines.push('🛠 **BIKA STORE – Admin Dashboard**');
  lines.push('');
  lines.push(`👥 Bot Users (started): *${stats.totalUsers}*`);
  lines.push(`📦 Completed Orders: *${stats.totalOrders}*`);
  lines.push(`💰 Total MMK: *${formatPrice(stats.totalMmk)}*`);

  await bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'Markdown',
    ...buildAdminPanelKeyboard(),
  });
});

// /top10 – last 3 months top spenders (COMPLETED)
bot.onText(/\/top10/, async (msg) => {
  const chatId = msg.chat.id;
  const isAdminUser = isAdmin(msg.from.id);

  const top = await getTopCustomers(10);

  if (!top.length) {
    await bot.sendMessage(
      chatId,
      '🏆 Top 10 ကိုပြဖို့ နောက်ဆုံး ၃ လအတွင်း COMPLETED orders မရှိသေးပါ။\n\nOrder တွေပြီးတင်ပီးရင် Leaderboard ကို ပြပေးပါမယ်',
      {
        ...buildMainMenu(isAdminUser),
      }
    );
    return;
  }

  const lines = [];
  lines.push('🏆 **BIKA STORE – Top 10 Spenders (Last 3 Months)**');
  lines.push('');
  lines.push('နောက်ဆုံး ၃ လအတွင်း COMPLETED orders ကိုသာတွက်ထားပါတယ်။');
  lines.push('');

  top.forEach((entry, index) => {
    const rank = index + 1;
    let medal = '';
    if (rank === 1) medal = '🥇';
    else if (rank === 2) medal = '🥈';
    else if (rank === 3) medal = '🥉';
    else medal = '✨';

    const name =
      entry.firstName || entry.username || `User ${String(entry._id)}`;
    const handle = entry.username ? `@${entry.username}` : '';

    lines.push(
      `${rank}. ${medal} ${name} ${handle ? `(${handle})` : ''}\n` +
        `   • Total Spent: *${formatPrice(entry.totalAmount)}*\n` +
        `   • Completed Orders: *${entry.orderCount}*`
    );
  });

  await bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'Markdown',
    ...buildMainMenu(isAdminUser),
  });
});

// /myrank – current user's rank (all-time COMPLETED)
bot.onText(/\/myrank/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdminUser = isAdmin(userId);

  const stat = await getUserRank(userId);

  if (!stat) {
    await bot.sendMessage(
      chatId,
      '📊 လက်ရှိ အကောင့်နဲ့ COMPLETED order မရှိသေးလို့ Rank သတ်မှတ်ထားခြင်းမရှိသေးပါ။\n\nBIKA Store မှာ order တစ်ခုပြီးတိုင်း /myrank လိုက်စမ်းကြည့်နိုင်ပါတယ်',
      {
        ...buildMainMenu(isAdminUser),
      }
    );
    return;
  }

  const name = stat.firstName || stat.username || `User ${userId}`;
  const handle = stat.username ? `@${stat.username}` : '';

  const lines = [];
  lines.push('📊 **BIKA STORE – My Rank (All-time Completed)**');
  lines.push('');
  lines.push(`👤 User: *${name}* ${handle ? `(${handle})` : ''}`);
  lines.push(`🏅 Rank: *#${stat.rank}*`);
  lines.push(`💰 Total MMK: *${formatPrice(stat.totalAmount)}*`);
  lines.push(`📦 Completed Orders: *${stat.orderCount}*`);
  lines.push('');
  lines.push('ရေရှည်မှာ မင်းက BIKA Store ရဲ့ Top1 Buyer ဖြစ်လာနိူင်ပါတယ်😎');

  await bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'Markdown',
    ...buildMainMenu(isAdminUser),
  });
});

// /broadcast or /broadcat – admin broadcast to all known users
// If admin reply to a photo message + /broadcast → photo + caption broadcast
// Else → text broadcast
bot.onText(/\/(?:broadcast|broadcat)(?:\s+([\s\S]+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) return;

  const baseText = (match && match[1] ? match[1] : '').trim();
  const reply = msg.reply_to_message;

  let sentCount = 0;

  // Case 1: reply to a photo → broadcast photo + caption
  if (reply && reply.photo && reply.photo.length) {
    const photoSizes = reply.photo;
    const fileId = photoSizes[photoSizes.length - 1].file_id;
    const caption = baseText || reply.caption || '';

    if (!caption) {
      await bot.sendMessage(
        chatId,
        '📣 Photo broadcast ပို့ချင်ရင် photo အောက်က caption ထဲမှာ message ရေးထားပါ\nသို့မဟုတ် `/broadcast your text...` လို့ရိုက်ပို့ပါ။',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    for (const uid of knownUserIds) {
      try {
        await bot.sendPhoto(uid, fileId, {
          caption,
          parse_mode: 'Markdown',
          disable_notification: true,
        });
        sentCount += 1;
      } catch (e) {
        console.error('Broadcast photo failed to', uid, e.message);
      }
    }

    await bot.sendMessage(
      chatId,
      `✅ Photo broadcast ပို့ပြီးပါပြီ။\nEstimated recipients: *${sentCount}* users.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Case 2: text broadcast only
  const text = baseText || promoConfig.text || '';

  if (!text) {
    await bot.sendMessage(
      chatId,
      '📣 Broadcast ပို့ဖို့ text မရှိသေးပါ။\n\n`/broadcast your message...` လို့ရိုက်ပို့ပါ။ သို့မဟုတ် Promo text သတ်မှတ်ပြီး /broadcast လိုက်နိုင်ပါတယ်။',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const payload =
    '📣 **BIKA STORE Announcement**\n\n' +
    text +
    '\n\n— Sent from BIKA Store Bot';

  for (const uid of knownUserIds) {
    try {
      await bot.sendMessage(uid, payload, {
        parse_mode: 'Markdown',
        disable_notification: true,
      });
      sentCount += 1;
    } catch (e) {
      console.error('Broadcast failed to', uid, e.message);
    }
  }

  await bot.sendMessage(
    chatId,
    `✅ Broadcast ပို့ပြီးပါပြီ။\nEstimated recipients: *${sentCount}* users.`,
    { parse_mode: 'Markdown' }
  );
});

// ====== MESSAGE HANDLER (ID+SV, PUBG ID, Slip Photo, Promo winner ID) ======

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  knownUserIds.add(userId);

  const session = getUserSession(userId, false);

  // 1) Handle payment slip photo
  if (session && session.step === 'WAIT_SLIP' && msg.photo && msg.photo.length) {
    const orderId = session.pendingOrderId;
    const order = await Order.findOne({ id: orderId, userId });
    if (!order) {
      resetUserSession(userId);
      return;
    }

    const photoSizes = msg.photo;
    const largestPhoto = photoSizes[photoSizes.length - 1];
    const fileId = largestPhoto.file_id;

    order.status = 'PENDING_CONFIRMATION';
    order.paidAt = order.paidAt || new Date();
    order.paymentSlipFileId = fileId;
    await order.save();

    session.step = null;
    session.pendingOrderId = null;

    await bot.sendMessage(
      chatId,
      '✅ ငွေလွှဲပြေစာ Screenshot ကို လက်ခံရရှိပြီးပါပြီ။ ' +
        'Admin ထံသို့ သင့်အော်ဒါတင်ပြနေပါပြီ။ခေတ္တစောင့်ဆိုင်းပေးပါ'
    );

    // send to admins – slip + order info + approve/reject
    const caption = formatOrderSummary(order, { title: 'NEW' });
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `admin:complete:${order.id}` },
          { text: '❌ Reject', callback_data: `admin:reject:${order.id}` },
        ],
      ],
    };

    for (const adminId of ADMIN_IDS) {
      try {
        await bot.sendPhoto(adminId, fileId, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } catch (e) {
        console.error('Failed to send slip to admin', adminId, e.message);
      }
    }

    return;
  }

  // 2) Promo winner – MLBB ID + Server ID ကြေညာဖို့
  const promo = getActivePromo();
  if (
    promo &&
    promo.winnerUserId === userId &&
    !promo.winnerGameId && // winner game info not set yet
    msg.text &&
    !msg.text.startsWith('/')
  ) {
    const raw = msg.text.trim();
    const parts = raw.split(/[\s,]+/).filter(Boolean);

    const gameId = parts[0] || '';
    const serverId = parts[1] || '';

    promo.winnerGameId = gameId;
    promo.winnerServerId = serverId;
    promo.winnerChatId = chatId;
    activePromo = promo; // update global

    // winner ကို confirm message ပို့မယ်
    await bot.sendMessage(
      chatId,
      '✅ သင့် MLBB ID + Server ID ကို လက်ခံရရှိပြီးပါပြီ။\n' +
        'Admin မှာ confirm လုပ်သလို သင့်လက်ဆောင် diamonds ကို ထုတ်ပေးမှာဖြစ်ပါတယ် 💎'
    );

    // Admin တွေကို winner info + Approve button ပို့မယ်
    const winnerLabel = promo.winnerUsername
      ? '@' + promo.winnerUsername
      : promo.winnerFirstName || `User ${promo.winnerUserId}`;

    const adminText =
      '🎁 **Promo Winner MLBB Info**\n\n' +
      `👤 Winner: *${winnerLabel}*\n` +
      `🆔 User ID: \`${promo.winnerUserId}\`\n\n` +
      `MLBB ID: \`${promo.winnerGameId || '-'}\`\n` +
      `Server ID: \`${promo.winnerServerId || '-'}\`\n\n` +
      'Gift ကို confirm လုပ်ဖို့ အောက်က button ကိုနှိပ်ပါ။';

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '✅ Approve Gift',
            callback_data: `promo:approve:${promo.winnerUserId}`,
          },
        ],
      ],
    };

    for (const adminId of ADMIN_IDS) {
      try {
        await bot.sendMessage(adminId, adminText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } catch (e) {
        console.error('Failed to send promo info to admin', adminId, e.message);
      }
    }

    return; // အောက်က order form flow ကို မဆက်သွားတော့ဘူး
  }

  // For other flows we only care about text (ignore photos if not WAIT_SLIP)
  if (!msg.text || msg.text.startsWith('/')) return;
  if (!session || !session.step) return;

  const text = msg.text.trim();
  const draft = session.orderDraft || {};

  // optional cancel
  if (text === '❌ Cancel') {
    resetUserSession(userId);
    await bot.sendMessage(chatId, '❌ Order ကို cancel လုပ်ထားပါတယ်။', {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  // MLBB (ID + SVID in one message)
  if (session.step === 'WAIT_MLBB_ID_SVID') {
    const parts = text.split(/[\s,]+/).filter(Boolean);
    let gameId = '';
    let serverId = '';

    if (parts.length >= 2) {
      gameId = parts[0];
      serverId = parts[1];
    } else {
      // user တစ်ခုတည်းပဲ ထည့်ရင် ID အနေနဲ့ယူပြီး ServerId ကို ထပ်မေးမနေတော့
      gameId = text;
      serverId = '';
    }

    draft.gameId = gameId;
    draft.serverId = serverId;
    session.step = 'WAIT_CONFIRM';
    session.orderDraft = draft;

    await bot.sendMessage(
      chatId,
      '✅ MLBB ID + Server ID ကို လက်ခံရရှိပြီးပါပြီ။ Order ကို အတည်ပြုဖို့ Id နဲ့ Server ID ကို စစ်ဆေးကြည့်ပါ။',
      { reply_markup: { remove_keyboard: true } }
    );

    await sendOrderConfirmMessage(userId, chatId, draft);
    return;
  }

  // PUBG (ID only)
  if (session.step === 'WAIT_PUBG_ID') {
    draft.gameId = text;
    draft.serverId = '';
    session.step = 'WAIT_CONFIRM';
    session.orderDraft = draft;

    await bot.sendMessage(
      chatId,
      '✅ PUBG ID ကို လက်ခံရရှိပြီးပါပြီ။ Order ကို အတည်ပြုဖို့ စစ်ဆေးကြည့်ပါ။',
      { reply_markup: { remove_keyboard: true } }
    );

    await sendOrderConfirmMessage(userId, chatId, draft);
    return;
  }

  // WAIT_CONFIRM – ignore random text
});

// ====== CALLBACK HANDLER ======

bot.on('callback_query', async (query) => {
  try {
    const data = query.data || '';
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;

    knownUserIds.add(userId);

    const acknowledge = () =>
      bot.answerCallbackQuery(query.id).catch(() => {});
    const isAdminUser = isAdmin(userId);

    // Main navigation
    if (data === 'm:main') {
      resetUserSession(userId);
      await acknowledge();
      await bot.editMessageText('🏠 Main menu', {
        chat_id: chatId,
        message_id: msgId,
        ...buildMainMenu(isAdminUser),
      });
      return;
    }

    if (data === 'm:help') {
      await acknowledge();
      const lines = [
        '❓ **How to Order (BIKA STORE)**',
        '',
        '1️⃣ **Browse Items** ကိုနှိပ်ပါ',
        '2️⃣ ထဲကနေ **MLBB** (Diamonds / Pass) နဲ့ **PUBG UC** ထဲကလိုချင်တာရွေးပါ',
        '3️⃣ MLBB အတွက်: **ID + Server ID** ကို တစ်ကြိမ်တည်းထဲ space နဲ့ ခွဲရေးပြီး ထည့်ပေးပါ (ဥပမာ 12345678 1234)',
        '4️⃣ PUBG အတွက်: **PUBG ID** တစ်ခုတည်း ထည့်ပေးပါ',
        '5️⃣ Order summary ကို စစ်ပြီး **Confirm Order** ကိုနှိပ်ပါ',
        '6️⃣ Payment info အတိုင်း KBZ Pay / WavePay နဲ့ ငွေလွှဲပါ',
        '7️⃣ **I have paid** ကိုနှိပ်ပြီး Bot ပြောသလို Slip ပုံ ပို့ပါ',
        '8️⃣ Admin confirm လုပ်လိုက်တာနဲ့ Order Complete ဖြစ်သွားမယ် 💨',
      ];
      await bot.editMessageText(lines.join('\n'), {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        ...buildMainMenu(isAdminUser),
      });
      return;
    }

    if (data === 'm:promo') {
      await acknowledge();
      await handlePromoRequest(chatId, query.from);
      return;
    }

    // Promo claim – first click wins
    if (data === 'promo:claim') {
      await acknowledge();

      const promo = getActivePromo();

      if (!promo) {
        // expired or not active
        try {
          await bot.editMessageText(
            '😢 ဒီ Promo က သက်တမ်းကုန်သွားပြီ ဖြစ်လို့ Claim လုပ်လို့ မရတော့ပါ။',
            {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [] },
            }
          );
        } catch (_) {}
        return;
      }

      // already have winner
      if (promo.winnerUserId) {
        const winnerLabel = promo.winnerUsername
          ? '@' + promo.winnerUsername
          : promo.winnerFirstName || `User ${promo.winnerUserId}`;

        const loseText =
          'ဒီတစ်ခါသင် နောက်ကျသွားပါပြီ...\n\n' +
          `ပထမဆုံး Claim လိုက်တဲ့ ကံကောင်းသူကတော့ *${winnerLabel}* ဖြစ်ပါတယ် 💎\n\n` +
          'နောက်မကျစေနဲ့ နောက်ကျရင် ကောင်းတာဆိုလို့ သေတာပဲရှိတယ် ညိုကီဘိုကီ 😎';

        try {
          await bot.editMessageText(loseText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] },
          });
        } catch (_) {}

        return;
      }

      // first winner here
      promo.winnerUserId = userId;
      promo.winnerUsername = query.from.username || '';
      promo.winnerFirstName = query.from.first_name || '';
      promo.winnerChatId = chatId;
      promo.winnerGameId = null;
      promo.winnerServerId = null;
      activePromo = promo;

      const winText =
        '🎉 **ဂုဏ်ယူပါတယ်! သင်ကံထူးသွားပါပြီ**\n\n' +
        'MLBB free diamonds ကို claim လုပ်ဖို့\n' +
        '**မိမိရဲ့ MLBB ID + Server ID ကို တစ်ကြိမ်တည်း space နဲ့ ခွဲပြီး ဒီ chat ထဲမှာ ပို့ပေးပါ။**\n\n' +
        'ဥပမာ: `12345678 1234`\n\n' +
        'Admin မှာ ID + SV ID ကိုပဲ အခြေခံပြီး Top-up လုပ်ပေးမှာ ဖြစ်ပါတယ် 💎';

      try {
        await bot.editMessageText(winText, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] },
        });
      } catch (_) {}

      // Admin တွေကို "winner ဆီက ID+SV ထပ်စောင့််ရ" စာတိုပဲ ပို့မယ် (optional)
      const adminInfo =
        '🎁 **Promo Winner Found!**\n\n' +
        `User: @${promo.winnerUsername || 'unknown'} (${promo.winnerFirstName ||
          'User ' + promo.winnerUserId})\n` +
        `User ID: \`${promo.winnerUserId}\`\n\n` +
        'Winner ဆီက MLBB ID + Server ID ကို စောင့်ယူနေပါတယ်...';

      for (const adminId of ADMIN_IDS) {
        try {
          await bot.sendMessage(adminId, adminInfo, {
            parse_mode: 'Markdown',
          });
        } catch (e) {
          console.error(
            'Failed to notify admin promo winner base',
            adminId,
            e.message
          );
        }
      }

      return;
    }

    // Promo approve – admin confirms gift
    if (data.startsWith('promo:approve:')) {
      await acknowledge();

      const [, , uidStr] = data.split(':');
      const targetUserId = parseInt(uidStr, 10);

      if (!isAdminUser) {
        return;
      }

      const promo = getActivePromo();
      if (
        !promo ||
        !promo.winnerUserId ||
        promo.winnerUserId !== targetUserId
      ) {
        try {
          await bot.answerCallbackQuery(query.id, {
            text: 'Promo မှတ်တမ်း မရှိတော့ပါဘူး (သို့) သက်တမ်းကုန်သွားပါပြီ။',
            show_alert: true,
          });
        } catch (_) {}
        return;
      }

      const winnerLabel = promo.winnerUsername
        ? '@' + promo.winnerUsername
        : promo.winnerFirstName || `User ${promo.winnerUserId}`;

      const newText =
        '✅ **Promo Gift Approved**\n\n' +
        `👤 Winner: *${winnerLabel}*\n` +
        `🆔 User ID: \`${promo.winnerUserId}\`\n\n` +
        `MLBB ID: \`${promo.winnerGameId || '-'}\`\n` +
        `Server ID: \`${promo.winnerServerId || '-'}\`\n\n` +
        'Admin မှာ gift ကို ထုတ်ပေးပြီးသား ဖြစ်ပါတယ်။';

      // Admin message ကနေ button ဖယ်ပြီး Approved စာပြ
      try {
        await bot.editMessageText(newText, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] },
        });
      } catch (_) {}

      // Winner ကို final gift message ပို့မယ်
      const winnerChatId = promo.winnerChatId || promo.winnerUserId;
      try {
        await bot.sendMessage(
          winnerChatId,
          '🎁 သင့်လက်ဆောင်ဆုမဲကို ကို Bika ထုတ်ပေးလိုက်ပါပြီ 💎\n\n' +
            'ကံကောင်းသွားတဲ့အတွက် ဂုဏ်ယူပါတယ်'
        );
      } catch (e) {
        console.error(
          'Failed to notify promo winner final',
          winnerChatId,
          e.message
        );
      }

      // Promo session ကို ပြီးတော့အောင် clear လုပ်မယ်
      activePromo = null;

      return;
    }

    if (data === 'm:browse') {
      resetUserSession(userId);
      await acknowledge();
      const lines = [
        '🛍 **Browse Items**',
        '',
        'MLBB နဲ့ PUBG UC အတွက် လက်ရှိရရှိနိုင်တဲ့ package တွေပါ။',
      ];
      await bot.editMessageText(lines.join('\n'), {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        ...buildCategoryKeyboard(),
      });
      return;
    }

    if (data === 'm:orders') {
      await acknowledge();
      const userOrders = await Order.find({ userId })
        .sort({ id: -1 })
        .limit(10)
        .lean();

      if (!userOrders.length) {
        await bot.editMessageText('📦 မင်းနဲ့ပတ်သက်တဲ့ order မရှိသေးပါ။', {
          chat_id: chatId,
          message_id: msgId,
          ...buildMainMenu(isAdminUser),
        });
        return;
      }

      const lines = [];
      lines.push('📦 **Your Recent Orders**');
      lines.push('');
      userOrders.forEach((o) => {
        lines.push(
          `#${o.id} • ${
            o.categoryKey === 'mlbb' ? 'MLBB' : 'PUBG'
          } • ${o.packageName} • ${formatPrice(o.price)}`
        );
        lines.push(`   Status: ${o.status}`);
      });

      await bot.editMessageText(lines.join('\n'), {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        ...buildMainMenu(isAdminUser),
      });
      return;
    }

    // Category pagination: cat:<key>:<page>
    if (data.startsWith('cat:')) {
      await acknowledge();
      const [, key, pageStr] = data.split(':');
      const page = parseInt(pageStr, 10) || 1;
      const cat = CATEGORIES[key];

      if (!cat) return;

      const text = `**${cat.emoji} ${cat.name}**\n\n${cat.description}\n\nPackage တစ်ခုရွေးချယ်ပါ။`;
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        ...buildPackagesKeyboard(key, page),
      });
      return;
    }

    // Package selected: pkg:<catKey>:<pkgId>
    if (data.startsWith('pkg:')) {
      await acknowledge();

      const parts = data.split(':');
      const catKey = parts[1];
      const pkgId = parts[2];

      const cat = CATEGORIES[catKey];
      if (!cat) return;
      const pkg = cat.packages.find((p) => p.id === pkgId);
      if (!pkg) return;

      const session = getUserSession(userId, true);
      session.orderDraft = {
        categoryKey: catKey,
        packageId: pkg.id,
        packageName: pkg.name,
        price: pkg.price,
        currency: STORE_CURRENCY,
        gameId: '',
        serverId: '',
      };

      // first question depending on category
      if (catKey === 'mlbb') {
        session.step = 'WAIT_MLBB_ID_SVID';

        const introLines = [];
        introLines.push('📝 **Order Form – MLBB**');
        introLines.push('');
        introLines.push(
          `Package: ${pkg.name}\nPrice: ${formatPrice(
            pkg.price
          )}\n\nအောက်ကအချက်အလက်ကို ထည့်ပေးပါ👇`
        );
        introLines.push(
          '**MLBB ID + Server ID** ကို တစ်ကြိမ်တည်း space နဲ့ ခွဲရေးပြီး ထည့်ပါ (ဥပမာ `12345678 1234`)'
        );

        await bot.editMessageText(introLines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
        });

        await sendStepMessage(
          userId,
          chatId,
          '👉 ကိုယ့် **MLBB ID + Server ID** ကို `12345678 1234` ဆိုပြီး space နဲ့ ခွဲပြီး ရိုက်ထည့်ပေးပါ။',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [[{ text: '❌ Cancel' }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
      } else {
        // PUBG
        session.step = 'WAIT_PUBG_ID';

        const introLines = [];
        introLines.push('📝 **Order Form – PUBG UC & Prime**');
        introLines.push('');
        introLines.push(
          `Package: ${pkg.name}\nPrice: ${formatPrice(
            pkg.price
          )}\n\nအောက်ကအချက်အလက်ကို ထည့်ပေးပါ👇`
        );
        introLines.push('**PUBG ID (Character ID)** ကို ထည့်ပါ။');

        await bot.editMessageText(introLines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
        });

        await sendStepMessage(
          userId,
          chatId,
          '👉 ကိုယ့် **PUBG ID (Character ID)** ကို ရိုက်ထည့်ပေးပါ။',
          {
            reply_markup: {
              keyboard: [[{ text: '❌ Cancel' }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
      }

      return;
    }

    // Order confirm / cancel (draft)
    if (data === 'order:confirm') {
      await acknowledge();
      const session = getUserSession(userId, false);
      if (!session || !session.orderDraft) return;

      const draft = session.orderDraft;

      const orderId = await getNextOrderId();

      const order = await Order.create({
        id: orderId,
        userId,
        username: query.from.username || '',
        firstName: query.from.first_name || '',
        categoryKey: draft.categoryKey,
        packageId: draft.packageId,
        packageName: draft.packageName,
        price: draft.price,
        currency: draft.currency,
        gameId: draft.gameId,
        serverId: draft.serverId || '',
        status: 'PENDING_PAYMENT',
        createdAt: new Date(),
        paidAt: null,
        confirmedAt: null,
        adminNote: '',
        paymentSlipFileId: '',
      });

      resetUserSession(userId);

      await bot.editMessageText(
        `✅ Order #${order.id} ကို ပြုလုပ်ပြီးပါပြီ!\n\nPayment instructions ကို အောက်တွင် ပို့ပေးမယ်။`,
        {
          chat_id: chatId,
          message_id: msgId,
        }
      );

      await sendPaymentInstructions(chatId, order);
      return;
    }

    if (data === 'order:cancel_draft') {
      await acknowledge();
      resetUserSession(userId);
      await bot.editMessageText('Order draft ကို ဖျက်ထားလိုက်ပါတယ်။', {
        chat_id: chatId,
        message_id: msgId,
        ...buildMainMenu(isAdminUser),
      });
      return;
    }

    if (data.startsWith('order:cancel:')) {
      await acknowledge();
      const [, , idStr] = data.split(':');
      const orderId = parseInt(idStr, 10);
      const order = await Order.findOne({ id: orderId, userId });
      if (!order) return;

      order.status = 'CANCELLED_BY_USER';
      await order.save();

      await bot.editMessageText(
        '❌ Order ကို customer ထဲကနေ cancel လုပ်လိုက်ပြီ။',
        {
          chat_id: chatId,
          message_id: msgId,
        }
      );
      return;
    }

    // Payment: user says "I have paid" -> ask for slip
    if (data.startsWith('payment:paid:')) {
      await acknowledge();
      const [, , idStr] = data.split(':');
      const orderId = parseInt(idStr, 10);
      const order = await Order.findOne({ id: orderId });
      if (!order || order.userId !== userId) return;

      if (order.status !== 'PENDING_PAYMENT') {
        await bot.answerCallbackQuery(query.id, {
          text: 'This order is not awaiting payment.',
          show_alert: true,
        });
        return;
      }

      order.status = 'AWAITING_SLIP';
      order.paidAt = new Date();
      await order.save();

      const session = getUserSession(userId, true);
      session.step = 'WAIT_SLIP';
      session.pendingOrderId = order.id;

      await bot.editMessageText(
        `💳 Order #${order.id} အတွက် "I have paid" ကို လက်ခံရရှိပြီ။\n\n` +
          '👉 အောက်တွင် KBZ/WavePay စသဖြင့် ငွေလွှဲပြေစာ screenshot ကို **တစ်ပုံပဲ** ပို့ပေးပါ။',
        {
          chat_id: chatId,
          message_id: msgId,
        }
      );

      await sendStepMessage(
        userId,
        chatId,
        '📸 ငွေလွှဲပြေစာ screenshot ကို ပုံအနေနဲ့ တစ်ပုံပို့ပေးပါ။\n\n' +
          '(*ဤပုံကို Admin ထံ Order အသစ်အဖြစ် ပို့ပေးမည်ဖြစ်ပါတယ်*)'
      );
      return;
    }

    // ====== ADMIN HANDLERS ======
    if (data.startsWith('admin:')) {
      if (!isAdminUser) {
        await acknowledge();
        return;
      }

      if (data === 'admin:panel') {
        await acknowledge();

        const stats = await getAdminStats();

        const lines = [];
        lines.push('🛠 **BIKA STORE – Admin Dashboard**');
        lines.push('');
        lines.push(`👥 Bot Users (started): *${stats.totalUsers}*`);
        lines.push(`📦 Completed Orders: *${stats.totalOrders}*`);
        lines.push(`💰 Total MMK: *${formatPrice(stats.totalMmk)}*`);

        await bot.editMessageText(lines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          ...buildAdminPanelKeyboard(),
        });
        return;
      }

      if (data === 'admin:orders') {
        await acknowledge();
        const latest = await Order.find({})
          .sort({ id: -1 })
          .limit(15)
          .lean();

        if (!latest.length) {
          await bot.editMessageText('📋 Orders မရှိသေးပါ။', {
            chat_id: chatId,
            message_id: msgId,
            ...buildAdminPanelKeyboard(),
          });
          return;
        }

        const lines = [];
        lines.push('📋 **Recent Orders**');
        lines.push('');
        latest.forEach((o) => {
          lines.push(
            `#${o.id} • ${
              o.categoryKey === 'mlbb' ? 'MLBB' : 'PUBG'
            } • ${o.packageName} • ${formatPrice(o.price)}`
          );
          lines.push(`   ${shortUserLabel(o)} • ${o.status}`);
        });

        await bot.editMessageText(lines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          ...buildAdminPanelKeyboard(),
        });
        return;
      }

      if (data === 'admin:pending') {
        await acknowledge();
        const pending = await Order.find({
          status: 'PENDING_CONFIRMATION',
        })
          .sort({ id: 1 })
          .lean();

        if (!pending.length) {
          await bot.editMessageText(
            '⏳ Pending confirm orders မရှိသေးပါ။',
            {
              chat_id: chatId,
              message_id: msgId,
              ...buildAdminPanelKeyboard(),
            }
          );
          return;
        }

        const lines = [];
        lines.push('⏳ **Pending Payments / Confirmation**');
        lines.push('');
        pending.forEach((o) => {
          lines.push(
            `#${o.id} • ${
              o.categoryKey === 'mlbb' ? 'MLBB' : 'PUBG'
            } • ${o.packageName} • ${formatPrice(o.price)}`
          );
          lines.push(
            `   ${shortUserLabel(o)} • Paid at: ${formatDateTime(o.paidAt)}`
          );
        });

        await bot.editMessageText(lines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          ...buildAdminPanelKeyboard(),
        });
        return;
      }

      if (data === 'admin:promo') {
        await acknowledge();
        const status = promoConfig.isActive ? 'ON ✅' : 'OFF ⏸';
        const lines = [];
        lines.push('🎯 **Promotion Settings**');
        lines.push('');
        lines.push(`Status: *${status}*`);
        lines.push('');
        lines.push(promoConfig.text || '_no promo text_');
        lines.push('');
        lines.push(
          'Text ကိုပြင်ချင်ရင် `/setpromo your text` လို့သုံးနိုင်ပါတယ်။'
        );

        await bot.editMessageText(lines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: promoConfig.isActive
                    ? '⏸ Disable Promo'
                    : '▶ Enable Promo',
                  callback_data: 'admin:promo_toggle',
                },
              ],
              [{ text: '⬅️ Back', callback_data: 'admin:panel' }],
            ],
          },
        });
        return;
      }

      if (data === 'admin:promo_toggle') {
        await acknowledge();
        promoConfig.isActive = !promoConfig.isActive;
        const status = promoConfig.isActive ? 'ON ✅' : 'OFF ⏸';
        await bot.editMessageText(
          `🎯 Promotion status ကို *${status}* လို့ပြောင်းလိုက်ပြီးပါပြီ။`,
          {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown',
            ...buildAdminPanelKeyboard(),
          }
        );
        return;
      }

      if (data === 'admin:broadcast') {
        await acknowledge();
        const count = knownUserIds.size;
        const lines = [];
        lines.push('📣 **Broadcast Promotion**');
        lines.push('');
        lines.push(`Recipients: *${count}* users`);
        lines.push('');
        lines.push('အောက်ပါ Promotion text ကိုပို့မယ်👇');
        lines.push('');
        lines.push(promoConfig.text || '_no promo_');

        await bot.editMessageText(lines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📣 Send now',
                  callback_data: 'admin:broadcast_send',
                },
              ],
              [{ text: '⬅️ Back', callback_data: 'admin:panel' }],
            ],
          },
        });
        return;
      }

      if (data === 'admin:broadcast_send') {
        await acknowledge();
        const text =
          (promoConfig.text || '') + '\n\n— Sent from BIKA Store Bot';
        let sent = 0;
        for (const uid of knownUserIds) {
          try {
            await bot.sendMessage(uid, text, {
              disable_notification: true,
            });
            sent += 1;
          } catch (e) {
            console.error('Broadcast failed to', uid, e.message);
          }
        }
        await bot.editMessageText(`✅ Broadcast sent to ~${sent} users.`, {
          chat_id: chatId,
          message_id: msgId,
          ...buildAdminPanelKeyboard(),
        });
        return;
      }

      if (data === 'admin:export_csv') {
        await acknowledge();
        const count = await Order.countDocuments({});
        if (!count) {
          await bot.answerCallbackQuery(query.id, {
            text: 'No orders to export yet.',
            show_alert: true,
          });
          return;
        }

        const csv = await ordersToCSV();
        const buffer = Buffer.from(csv, 'utf-8');

        await bot.sendDocument(
          chatId,
          buffer,
          {},
          { filename: 'orders.csv', contentType: 'text/csv' }
        );
        return;
      }

      if (data.startsWith('admin:order:')) {
        await acknowledge();
        const [, , idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = await Order.findOne({ id: orderId }).lean();
        if (!order) {
          await bot.answerCallbackQuery(query.id, {
            text: 'Order not found.',
            show_alert: true,
          });
          return;
        }

        await bot.editMessageText(formatOrderSummary(order), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          ...buildOrderDetailKeyboard(order, true),
        });
        return;
      }

      // COMPLETE / REJECT (with caption change)
      // COMPLETE / REJECT (with caption change + auto clean)
      if (
        data.startsWith('admin:complete:') ||
        data.startsWith('admin:reject:')
      ) {
        await acknowledge();
        const isComplete = data.startsWith('admin:complete:');
        const [, , idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = await Order.findOne({ id: orderId });
        if (!order) return;

        if (isComplete) {
          order.status = 'COMPLETED';
          order.confirmedAt = new Date();
        } else {
          order.status = 'REJECTED';
          order.confirmedAt = new Date();
          order.adminNote = 'Rejected by admin';
        }
        await order.save();

        // Admin message (slip) ကို update လုပ်မယ် – buttons ဖယ် + status text ပြောင်း
        const newText = formatOrderSummary(order, {
          title: isComplete ? 'COMPLETE' : 'REJECTED',
        });

        if (query.message && query.message.photo) {
          await bot.editMessageCaption(newText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] },
          });
        } else {
          await bot.editMessageText(newText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] },
          });
        }

        if (isComplete) {
          try {
            // User ထဲကို order complete summary ပို့မယ်
            await bot.sendMessage(
              order.userId,
              formatOrderSummary(order, {
                title: 'COMPLETE',
              }),
              { parse_mode: 'Markdown' }
            );

            // ✅ Order Complete ဖြစ်သွားတဲ့အချိန်
            //    user chat ထဲက အဟောင်း messages တွေ အကုန်ဖျက်ပြီး နောက်ဆုံးစာတစ်ခုပဲ ကျန်စေမယ်
            if (autoClean && autoClean.cleanChat) {
              // Private chat ဖြစ်နေတာကတော့ order.userId က chatId ဖြစ်နိုင်ရမယ်
              autoClean.cleanChat(order.userId, { keepLast: 1 }).catch(() => {});
            }
          } catch (e) {
            console.error('Notify user failed', order.userId, e.message);
          }
        } else {
          try {
            await bot.sendMessage(
              order.userId,
              formatOrderSummary(order, {
                title: 'REJECTED',
              }),
              { parse_mode: 'Markdown' }
            );
          } catch (e) {
            console.error('Notify user failed', order.userId, e.message);
          }
        }

        return;
      }
      ////////////////////////////////////////

      if (data.startsWith('admin:markpaid:')) {
        await acknowledge();
        const [, , idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = await Order.findOne({ id: orderId });
        if (!order) return;

        order.status = 'PENDING_CONFIRMATION';
        order.paidAt = new Date();
        await order.save();

        await bot.editMessageText(
          `💳 Order #${order.id} ကို admin မှ manual paid & pending confirm လို ပြောင်းလိုက်ပါတယ်။`,
          {
            chat_id: chatId,
            message_id: msgId,
            ...buildAdminPanelKeyboard(),
          }
        );
        return;
      }

      return;
    }
  } catch (err) {
    console.error('Error in callback_query handler:', err);
    try {
      await bot.answerCallbackQuery(query.id, {
        text: 'Something went wrong. Please try again.',
        show_alert: true,
      });
    } catch (_) {}
  }
});

// ====== STARTUP LOG ======

console.log('🚀 BIKA Store Bot is running with MongoDB (webhook mode)...');
console.log('Admins:', ADMIN_IDS.join(', ') || '(none configured)');
