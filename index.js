'use strict';

/**
 * BIKA STORE BOT - Full index.js
 * Single-file Telegram store bot for MLBB & PUBG
 *
 * ENV:
 *  - TELEGRAM_BOT_TOKEN
 *  - ADMIN_IDS  (comma separated user IDs, e.g. 123,456)
 *  - STORE_CURRENCY (optional, default 'Ks')
 */

const TelegramBot = require('node-telegram-bot-api');

// ====== ENV ======
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN_HERE';
if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.warn('⚠️ Please set TELEGRAM_BOT_TOKEN in your environment!');
}

const STORE_CURRENCY = process.env.STORE_CURRENCY || 'Ks';
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

// ====== BOT INIT ======
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
});

// ====== IN-MEMORY DATA ======

/**
 * Session per user:
 * {
 *   step: 'WAIT_CATEGORY' | 'WAIT_GAME_ID' | 'WAIT_PLAYER_NAME' | 'WAIT_CONTACT' | null,
 *   orderDraft: {...}
 * }
 */
const sessions = new Map();

/**
 * Order model:
 * {
 *   id, userId, username, firstName,
 *   categoryKey, packageId, packageName, price, currency,
 *   gameId, playerName, contact,
 *   status, createdAt, paidAt, confirmedAt, adminNote
 * }
 */
let nextOrderId = 1;
const orders = [];

/**
 * Known users for broadcast
 */
const knownUserIds = new Set();

/**
 * Promotion config
 */
const promoConfig = {
  isActive: true,
  text:
    '🎉 Welcome to BIKA Store – Game Top-up Promo!\n\n' +
    'MLBB Diamonds & Weekly Pass နှင့် PUBG UC ကို Telegram Bot လေးကနေပဲ မြန်မြန်ဆန်ဆန် top-up ပေးနေပါတယ်။\n' +
    'Order တင်ချင်ရင် Browse Items ကိုနှိပ်ပြီး package ရွေးပေးလိုက်ရုံပါ 💎🎯',
};

// ====== STORE CATEGORIES (MLBB + PUBG) ======

const CATEGORIES = {
  mlbb: {
    key: 'mlbb',
    name: 'MLBB Diamonds & Pass',
    description: 'Mobile Legends: Bang Bang – Diamonds and Weekly Pass.',
    emoji: '💎',
    packages: [
      // Diamonds
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

      // Weekly / special
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

// Convenience list
const CATEGORY_LIST = Object.values(CATEGORIES);

// ====== UTILITIES ======

function isAdmin(userId) {
  return ADMIN_IDS.includes(String(userId));
}

function formatPrice(value) {
  if (typeof value !== 'number') return value;
  return value.toLocaleString('en-US') + ' ' + STORE_CURRENCY;
}

function resetUserSession(userId) {
  sessions.delete(userId);
}

function getUserSession(userId, createIfMissing = false) {
  if (!sessions.has(userId) && createIfMissing) {
    sessions.set(userId, { step: null, orderDraft: null });
  }
  return sessions.get(userId) || null;
}

function generateOrderId() {
  const id = nextOrderId;
  nextOrderId += 1;
  return id;
}

function formatDateTime(dt) {
  if (!dt) return '-';
  if (typeof dt === 'string') dt = new Date(dt);
  if (!(dt instanceof Date)) return String(dt);
  return dt.toLocaleString('en-GB');
}

function shortUserLabel(order) {
  const name = order.firstName || order.username || order.userId;
  return `${name}`;
}

// ====== CSV Export Helpers ======

function escapeCSVValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function ordersToCSV() {
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
    'playerName',
    'contact',
    'status',
    'createdAt',
    'paidAt',
    'confirmedAt',
    'adminNote',
  ];

  const lines = [];
  lines.push(header.join(','));

  orders.forEach((o) => {
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
      escapeCSVValue(o.playerName),
      escapeCSVValue(o.contact),
      escapeCSVValue(o.status),
      escapeCSVValue(o.createdAt),
      escapeCSVValue(o.paidAt),
      escapeCSVValue(o.confirmedAt),
      escapeCSVValue(o.adminNote),
    ];
    lines.push(row.join(','));
  });

  return lines.join('\n');
}

// ====== UI BUILDERS ======

function buildMainMenu(isAdminUser) {
  const keyboard = [
    [
      { text: '🛍 Browse Items', callback_data: 'm:browse' },
      { text: '📦 My Orders', callback_data: 'm:orders' },
    ],
    [{ text: '❓ Help', callback_data: 'm:help' }],
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
  const lines = [];
  lines.push(`🧾 **Order #${order.id}**`);
  if (showStatus) {
    lines.push(`Status: \`${order.status}\``);
  }
  lines.push('');
  lines.push(`Game: ${order.categoryKey === 'mlbb' ? 'MLBB' : 'PUBG'}`);
  lines.push(`Package: ${order.packageName}`);
  lines.push(`Price: ${formatPrice(order.price)}`);
  lines.push('');
  lines.push(`Game ID: \`${order.gameId || '-'}\``);
  lines.push(`Player Name: ${order.playerName || '-'}`);
  lines.push(`Contact: ${order.contact || '-'}`);
  lines.push('');
  lines.push(`Created at: ${formatDateTime(order.createdAt)}`);
  if (order.paidAt) lines.push(`Paid at: ${formatDateTime(order.paidAt)}`);
  if (order.confirmedAt) lines.push(`Confirmed at: ${formatDateTime(order.confirmedAt)}`);
  if (order.adminNote) lines.push(`Admin note: ${order.adminNote}`);
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
          text: '✅ Mark as Completed',
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
    '• MLBB Diamonds & Weekly Pass',
    '• PUBG UC & Prime',
    '',
    'Telegram Bot ကနေပဲ မြန်မြန်ဆန်ဆန် top-up ပေးနေတာဖြစ်ပါတယ်။',
    '',
    'အောက်က Menu ထဲက **🛍 Browse Items** ကိုနှိပ်ပြီး အော်ဒါတင်ရအောင် ✨',
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
  lines.push('📌 Payment channels (example):');
  lines.push('- KBZ Pay');
  lines.push('- WavePay');
  lines.push('- (Admin will specify exact account)');
  lines.push('');
  lines.push(
    'ငွေလွှဲပြီးသွားရင် အောက်က **"I have paid"** button ကိုနှိပ်ပြီး slip ကို Bot ထဲပို့ပေးပါ။'
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

// ====== BOT HANDLERS ======

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
      '🌐 BIKA STORE Website ကနေ ဝင်လာတာကို ကြိုဆိုင်စွာကြိုဆိုပါတယ်!\n\n' +
        'အော်ဒါတင်ရန်အတွက် အောက်က Menu ထဲက **🛍 Browse Items** ကိုနှိပ်ပြီး ' +
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

// /setpromo <text> (admin only, quick edit)
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

// Text messages for steps
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // track known users
  knownUserIds.add(userId);

  const session = getUserSession(userId, false);
  if (!session || !session.step) {
    return; // no active flow
  }

  const text = msg.text.trim();

  if (session.step === 'WAIT_GAME_ID') {
    session.orderDraft.gameId = text;
    session.step = 'WAIT_PLAYER_NAME';

    await bot.sendMessage(
      chatId,
      '👤 Player Name ထည့်ပေးပါ (in-game မှာမြင်ရတဲ့နာမည်။)',
      {
        reply_markup: {
          keyboard: [[{ text: '❌ Cancel' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
    return;
  }

  if (session.step === 'WAIT_PLAYER_NAME') {
    session.orderDraft.playerName = text;
    session.step = 'WAIT_CONTACT';

    await bot.sendMessage(
      chatId,
      '📱 Contact / Phone / Telegram link ထည့်ပေးပါ (သတ်မှတ်စေချင်တဲ့နံပါတ်။)',
      {
        reply_markup: {
          keyboard: [[{ text: '❌ Cancel' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
    return;
  }

  if (session.step === 'WAIT_CONTACT') {
    if (text === '❌ Cancel') {
      resetUserSession(userId);
      await bot.sendMessage(chatId, 'အော်ဒါကို ဖျက်ထားလိုက်ပြီ။', {
        reply_markup: { remove_keyboard: true },
      });
      return;
    }

    session.orderDraft.contact = text;
    session.step = 'WAIT_CONFIRM';
    await bot.sendMessage(chatId, '✅ အချက်အလက်တွေကို အတည်ပြုပေးပါ...', {
      reply_markup: { remove_keyboard: true },
    });

    const draft = session.orderDraft;
    const summaryLines = [];
    summaryLines.push('📦 **Confirm your order**');
    summaryLines.push('');
    summaryLines.push(
      `Game: ${draft.categoryKey === 'mlbb' ? 'MLBB Diamonds & Pass' : 'PUBG UC & Prime'}`
    );
    summaryLines.push(`Package: ${draft.packageName}`);
    summaryLines.push(`Price: ${formatPrice(draft.price)}`);
    summaryLines.push('');
    summaryLines.push(`Game ID: \`${draft.gameId}\``);
    summaryLines.push(`Player Name: ${draft.playerName}`);
    summaryLines.push(`Contact: ${draft.contact}`);
    summaryLines.push('');
    summaryLines.push('အထက်ပါအချက်အလက်တွေမှန်ကန်ရင် **Confirm** ကိုနှိပ်ပါ။');

    await bot.sendMessage(chatId, summaryLines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Confirm Order', callback_data: 'order:confirm' }],
          [{ text: '❌ Cancel', callback_data: 'order:cancel_draft' }],
        ],
      },
    });

    return;
  }
});

// ====== CALLBACK HANDLER ======

bot.on('callback_query', async (query) => {
  try {
    const data = query.data || '';
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;

    knownUserIds.add(userId);

    // Helper functions
    const acknowledge = () => bot.answerCallbackQuery(query.id).catch(() => {});
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
        '3️⃣ Bot က မေးတဲ့ **Game ID / Player Name / Contact** တွေကို ဖြည့်ပေးပါ',
        '4️⃣ Order summary ကို စစ်ပြီး **Confirm Order** ကိုနှိပ်ပါ',
        '5️⃣ Payment info အတိုင်း KBZ Pay / WavePay နဲ့ ငွေလွှဲပါ',
        '6️⃣ ပြီးသွားရင် **"I have paid"** ကိုနှိပ်ပြီး slip ပို့ပေးပါ',
        '',
        'Admin က payment confirm လုပ်ပြီး game ထဲက item တွေကို မြန်မြန်ပို့ပေးပါမယ် 💨',
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
      const text =
        (promoConfig.isActive ? '🎉 **Promotion is active**\n\n' : 'ℹ️ Promotion is currently off.\n\n') +
        (promoConfig.text || 'No promotion text yet.');
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        ...buildMainMenu(isAdminUser),
      });
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
      const userOrders = orders
        .filter((o) => o.userId === userId)
        .sort((a, b) => b.id - a.id)
        .slice(0, 10);

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
          `#${o.id} • ${o.categoryKey === 'mlbb' ? 'MLBB' : 'PUBG'} • ${o.packageName} • ${formatPrice(
            o.price
          )}`
        );
        lines.push(`   Status: ${o.status}`);
      });
      lines.push('');
      lines.push('Order တစုံတခုကို အသေးစိတ်ကြည့်ချင်ရင် Admin ကို မေးနိုင်ပါတယ် (version simple).');

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
      session.step = 'WAIT_GAME_ID';
      session.orderDraft = {
        categoryKey: catKey,
        packageId: pkg.id,
        packageName: pkg.name,
        price: pkg.price,
        currency: STORE_CURRENCY,
        gameId: '',
        playerName: '',
        contact: '',
      };

      const lines = [];
      lines.push('📝 **Order Form**');
      lines.push('');
      lines.push(
        `Game: ${catKey === 'mlbb' ? 'MLBB Diamonds & Pass' : 'PUBG UC & Prime'}\nPackage: ${
          pkg.name
        }\nPrice: ${formatPrice(pkg.price)}`
      );
      lines.push('');
      lines.push('အရင်ဆုံး **Game ID** ထည့်ပေးပါ (MLBB / PUBG အတွက် in-game ID).');

      await bot.editMessageText(lines.join('\n'), {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
      });

      await bot.sendMessage(chatId, '👉 Game ID ကို ရိုက်ထည့်ပေးပါ။', {
        reply_markup: {
          keyboard: [[{ text: '❌ Cancel' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });

      return;
    }

    // Order confirm / cancel (draft)
    if (data === 'order:confirm') {
      await acknowledge();
      const session = getUserSession(userId, false);
      if (!session || !session.orderDraft) return;

      const draft = session.orderDraft;
      const order = {
        id: generateOrderId(),
        userId,
        username: query.from.username || '',
        firstName: query.from.first_name || '',
        categoryKey: draft.categoryKey,
        packageId: draft.packageId,
        packageName: draft.packageName,
        price: draft.price,
        currency: draft.currency,
        gameId: draft.gameId,
        playerName: draft.playerName,
        contact: draft.contact,
        status: 'PENDING_PAYMENT',
        createdAt: new Date(),
        paidAt: null,
        confirmedAt: null,
        adminNote: '',
      };

      orders.push(order);
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
      const order = orders.find((o) => o.id === orderId && o.userId === userId);
      if (!order) return;

      order.status = 'CANCELLED_BY_USER';

      await bot.editMessageText('❌ Order ကို customer ထဲကနေ cancel လုပ်လိုက်ပြီ။', {
        chat_id: chatId,
        message_id: msgId,
      });
      return;
    }

    // Payment: user says "I have paid"
    if (data.startsWith('payment:paid:')) {
      await acknowledge();
      const [, , idStr] = data.split(':');
      const orderId = parseInt(idStr, 10);
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.userId !== userId) return;

      if (order.status !== 'PENDING_PAYMENT') {
        await bot.answerCallbackQuery(query.id, { text: 'This order is not awaiting payment.', show_alert: true });
        return;
      }

      order.status = 'PENDING_CONFIRMATION';
      order.paidAt = new Date();

      await bot.editMessageText(
        `✅ Order #${order.id} အတွက် "I have paid" ကို လက်ခံရရှိပါပြီ။\nAdmin က slip ကို စစ်ဆေးပြီး Confirm လုပ်ပေးမယ်။`,
        {
          chat_id: chatId,
          message_id: msgId,
        }
      );

      // Notify admins
      for (const adminId of ADMIN_IDS) {
        try {
          await bot.sendMessage(
            adminId,
            `💳 **Payment to confirm**\n\n${formatOrderSummary(order)}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '✅ Confirm (Complete)',
                      callback_data: `admin:complete:${order.id}`,
                    },
                    {
                      text: '❌ Reject',
                      callback_data: `admin:reject:${order.id}`,
                    },
                  ],
                  [
                    {
                      text: '📄 View in Admin Panel',
                      callback_data: `admin:order:${order.id}`,
                    },
                  ],
                ],
              },
            }
          );
        } catch (e) {
          console.error('Failed to notify admin', adminId, e.message);
        }
      }
      return;
    }

    // ====== ADMIN HANDLERS ======
    if (data.startsWith('admin:')) {
      if (!isAdminUser) {
        await acknowledge();
        return;
      }

      // admin:panel
      if (data === 'admin:panel') {
        await acknowledge();
        await bot.editMessageText('🛠 **Admin Panel**', {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          ...buildAdminPanelKeyboard(),
        });
        return;
      }

      // admin:orders
      if (data === 'admin:orders') {
        await acknowledge();
        const latest = orders.slice().sort((a, b) => b.id - a.id).slice(0, 15);
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
            `#${o.id} • ${o.categoryKey === 'mlbb' ? 'MLBB' : 'PUBG'} • ${o.packageName} • ${formatPrice(
              o.price
            )}`
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

      // admin:pending
      if (data === 'admin:pending') {
        await acknowledge();
        const pending = orders
          .filter((o) => o.status === 'PENDING_CONFIRMATION')
          .sort((a, b) => a.id - b.id);
        if (!pending.length) {
          await bot.editMessageText('⏳ Pending confirm orders မရှိသေးပါ။', {
            chat_id: chatId,
            message_id: msgId,
            ...buildAdminPanelKeyboard(),
          });
          return;
        }

        const lines = [];
        lines.push('⏳ **Pending Payments / Confirmation**');
        lines.push('');
        pending.forEach((o) => {
          lines.push(
            `#${o.id} • ${o.categoryKey === 'mlbb' ? 'MLBB' : 'PUBG'} • ${o.packageName} • ${formatPrice(
              o.price
            )}`
          );
          lines.push(`   ${shortUserLabel(o)} • Paid at: ${formatDateTime(o.paidAt)}`);
        });

        await bot.editMessageText(lines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          ...buildAdminPanelKeyboard(),
        });
        return;
      }

      // admin:promo
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
        lines.push('Text ကိုပြင်ချင်ရင် `/setpromo your text` လို့သုံးနိုင်ပါတယ်။');

        await bot.editMessageText(lines.join('\n'), {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: promoConfig.isActive ? '⏸ Disable Promo' : '▶ Enable Promo',
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

      // admin:broadcast
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
              [{ text: '📣 Send now', callback_data: 'admin:broadcast_send' }],
              [{ text: '⬅️ Back', callback_data: 'admin:panel' }],
            ],
          },
        });
        return;
      }

      if (data === 'admin:broadcast_send') {
        await acknowledge();
        const text =
          (promoConfig.text || '') +
          '\n\n— Sent from BIKA Store Bot\n(ဒီ message ကိုရရှိထားရင် bot ကို block ထားမထားပဲ ရှိနေတယ်ဟုNကို လုံးဝမပြောဘူး 😄)';
        let sent = 0;
        for (const uid of knownUserIds) {
          try {
            await bot.sendMessage(uid, text, { disable_notification: true });
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

      // admin:export_csv
      if (data === 'admin:export_csv') {
        await acknowledge();
        if (!orders.length) {
          await bot.answerCallbackQuery(query.id, {
            text: 'No orders to export yet.',
            show_alert: true,
          });
          return;
        }

        const csv = ordersToCSV();
        const buffer = Buffer.from(csv, 'utf-8');

        await bot.sendDocument(chatId, buffer, {}, { filename: 'orders.csv', contentType: 'text/csv' });
        return;
      }

      // admin:order:<id>
      if (data.startsWith('admin:order:')) {
        await acknowledge();
        const [, , idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = orders.find((o) => o.id === orderId);
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

      // admin:complete:<id>
      if (data.startsWith('admin:complete:')) {
        await acknowledge();
        const [, , idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;

        order.status = 'COMPLETED';
        order.confirmedAt = new Date();

        await bot.editMessageText(`✅ Order #${order.id} ကို Completed လို့မှတ်လိုက်ပါတယ်။`, {
          chat_id: chatId,
          message_id: msgId,
          ...buildAdminPanelKeyboard(),
        });

        // notify user
        try {
          await bot.sendMessage(
            order.userId,
            `✅ BIKA Store – Order #${order.id} Completed!\n\n` +
              'Game ထဲကို ဝင်စစ်ကြည့်ပါ။ မရှိသေးရင် Admin ကို အချိုမေးနိုင်ပါတယ်။'
          );
        } catch (e) {
          console.error('Notify user failed', order.userId, e.message);
        }

        return;
      }

      // admin:reject:<id>
      if (data.startsWith('admin:reject:')) {
        await acknowledge();
        const [, , idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;

        order.status = 'REJECTED';
        order.confirmedAt = new Date();
        order.adminNote = 'Rejected by admin';

        await bot.editMessageText(`❌ Order #${order.id} ကို Rejected လုပ်လိုက်ပါတယ်။`, {
          chat_id: chatId,
          message_id: msgId,
          ...buildAdminPanelKeyboard(),
        });

        try {
          await bot.sendMessage(
            order.userId,
            `❌ BIKA Store – Order #${order.id} Rejected.\n\nငွေလွှဲအဆင့်/အချက်အလက်တွေကို Admin နဲ့ ထပ်မံဆွေးနွေးပါ။`
          );
        } catch (e) {
          console.error('Notify user failed', order.userId, e.message);
        }

        return;
      }

      // admin:markpaid:<id> (force set paid)
      if (data.startsWith('admin:markpaid:')) {
        await acknowledge();
        const [, , idStr] = data.split(':');
        const orderId = parseInt(idStr, 10);
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;

        order.status = 'PENDING_CONFIRMATION';
        order.paidAt = new Date();

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
    } catch (_) {
      // ignore
    }
  }
});

// ====== STARTUP LOG ======

console.log('🚀 BIKA Store Bot is running...');
console.log('Admins:', ADMIN_IDS.join(', ') || '(none configured)');
```0
