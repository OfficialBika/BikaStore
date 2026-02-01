// =========================
// BIKA Store Bot - index.js
// All-in-one Telegram Store Bot
// Features:
//  - Beautiful main menu (Professional Plus / Elegant + Detailed)
//  - Game items store (MLBB Diamonds, PUBG UC, Magic Chess, Telegram Premium, Telegram Stars)
//  - Order flow (item -> player info -> confirm -> payment details -> "I've Paid")
//  - Admin panel (inside Telegram)
//  - Promotions management
//  - Order log & payment confirmation UI
//  - Order Detail UI for admins
//  - CSV export of all orders
// =========================

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// ----- Basic Config -----
const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('Missing BOT_TOKEN in .env');
}

// Comma separated admin user IDs: ADMIN_IDS=123456789,987654321
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
  .map((id) => Number(id));

const PAYMENT_TEXT =
  process.env.PAYMENT_TEXT ||
  [
    '🧾 Payment Instructions',
    '',
    'KBZ Pay : 09xxxxxxxxx',
    'WavePay : 09yyyyyyyyy',
    'KPay    : 09zzzzzzzzz',
    '',
    '💡 Note: Please send correct slip & in-game ID.',
  ].join('\n');

const STORE_CURRENCY = process.env.STORE_CURRENCY || 'MMK';

const bot = new TelegramBot(token, { polling: true });

// ----- In-memory Database (for demo / single-file version) -----
// In production, replace with a real database.

// All users that ever started the bot (for broadcast)
const knownUserIds = new Set();

// Auto-increment order ID
let orderIdCounter = 1;

// Order structure example:
// {
//   id: 1,
//   userId: 123456,
//   username: 'bika',
//   firstName: 'Bika',
//   categoryKey: 'mlbb',
//   packageId: 'mlbb_86',
//   packageName: '86 Diamonds',
//   price: 1800,
//   currency: 'MMK',
//   gameId: '12345678',
//   playerName: 'MyName',
//   contact: '09xxxxxxxxx',
//   status: 'AWAITING_PAYMENT' | 'PENDING_CONFIRMATION' | 'COMPLETED' | 'REJECTED',
//   createdAt: '2026-02-01T...',
//   paidAt: null | '2026-02-01T...',
//   confirmedAt: null | '2026-02-01T...',
//   adminNote: ''
// }
const orders = [];

// Per-user state/session
// userId => { step, tempOrderData, isEditingPromotion, isBroadcasting }
const userSessions = new Map();

// Promotion config
const promoConfig = {
  isActive: true,
  text:
    '🎉 Welcome to BIKA Store – Special Promo!\n\n' +
    'MLBB Diamonds, PUBG UC, Magic Chess, Telegram Premium & Telegram Stars with fast delivery.\n' +
    'Order now and enjoy special service 💎',
};

// ----- Store Items / Categories -----

const CATEGORIES = {
  mlbb: {
    key: 'mlbb',
    name: 'MLBB Diamonds',
    description: 'Mobile Legends: Bang Bang top up service.',
    emoji: '💎',
    packages: [
      { id: 'mlbb_86', name: '86 Diamonds', price: 1800 },
      { id: 'mlbb_172', name: '172 Diamonds', price: 3600 },
      { id: 'mlbb_257', name: '257 Diamonds', price: 5400 },
      { id: 'mlbb_344', name: '344 Diamonds', price: 7200 },
    ],
  },
  pubg: {
    key: 'pubg',
    name: 'PUBG UC',
    description: 'PlayerUnknown’s Battlegrounds UC top up.',
    emoji: '🎯',
    packages: [
      { id: 'pubg_60', name: '60 UC', price: 1800 },
      { id: 'pubg_325', name: '325 UC', price: 9000 },
      { id: 'pubg_660', name: '660 UC', price: 18000 },
    ],
  },
  magicchess: {
    key: 'magicchess',
    name: 'Magic Chess Diamonds',
    description: 'Magic Chess Diamond top up.',
    emoji: '♟️',
    packages: [
      { id: 'mc_100', name: '100 Diamonds', price: 2000 },
      { id: 'mc_200', name: '200 Diamonds', price: 4000 },
    ],
  },
  tgpremium: {
    key: 'tgpremium',
    name: 'Telegram Premium',
    description: 'Official Telegram Premium subscription.',
    emoji: '⭐',
    packages: [
      { id: 'tg_prem_1m', name: 'Premium – 1 Month', price: 8000 },
      { id: 'tg_prem_3m', name: 'Premium – 3 Months', price: 22000 },
    ],
  },
  tgstar: {
    key: 'tgstar',
    name: 'Telegram Stars',
    description: 'Telegram Stars for bots & mini-apps.',
    emoji: '✨',
    packages: [
      { id: 'tg_star_100', name: '100 Stars', price: 1500 },
      { id: 'tg_star_300', name: '300 Stars', price: 4500 },
    ],
  },
};

// ----- Helpers -----

function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

function formatPrice(amount) {
  if (amount == null) return '-';
  // Simple formatting with thousands separators
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ' + STORE_CURRENCY;
}

function getUserSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      step: null,
      tempOrderData: null,
      isEditingPromotion: false,
      isBroadcasting: false,
    });
  }
  return userSessions.get(userId);
}

function resetUserSession(userId) {
  userSessions.set(userId, {
    step: null,
    tempOrderData: null,
    isEditingPromotion: false,
    isBroadcasting: false,
  });
}

function buildMainMenu(isAdminUser) {
  const keyboard = [
    [
      { text: '🛍 Browse Items', callback_data: 'm:browse' },
      { text: '🎉 Promotions', callback_data: 'm:promos' },
    ],
    [
      { text: '📦 My Orders', callback_data: 'm:myorders' },
    ],
    [
      { text: '❓ Help', callback_data: 'm:help' },
    ],
  ];

  if (isAdminUser) {
    keyboard.push([
      { text: '🛠 Admin Panel', callback_data: 'admin:panel' },
    ]);
  }

  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
}

function buildCategoryKeyboard() {
  const rows = [];
  Object.values(CATEGORIES).forEach((cat) => {
    rows.push([
      {
        text: cat.emoji + ' ' + cat.name,
        callback_data: 'cat:' + cat.key,
      },
    ]);
  });
  rows.push([{ text: '⬅️ Back to Main Menu', callback_data: 'm:main' }]);
  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function buildPackagesKeyboard(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) {
    return {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Back', callback_data: 'm:browse' }]],
      },
    };
  }

  const rows = cat.packages.map((pkg) => [
    {
      text: pkg.name + ' – ' + formatPrice(pkg.price),
      callback_data: 'item:' + categoryKey + ':' + pkg.id,
    },
  ]);

  rows.push([{ text: '⬅️ Back to Categories', callback_data: 'm:browse' }]);

  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function buildOrderConfirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Confirm Order', callback_data: 'order:confirm' },
          { text: '❌ Cancel', callback_data: 'order:cancel' },
        ],
      ],
    },
  };
}

function buildOrderPaymentKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📸 I have paid (Send slip)',
            callback_data: 'order:paid:' + orderId,
          },
        ],
        [{ text: '⬅️ Back to Main Menu', callback_data: 'm:main' }],
      ],
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

function buildAdminOrderActionKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '✅ Confirm Payment',
            callback_data: 'admin:ok:' + orderId,
          },
          {
            text: '❌ Reject Payment',
            callback_data: 'admin:reject:' + orderId,
          },
        ],
      ],
    },
  };
}

function buildAdminOrderDetailKeyboard(order) {
  const rows = [];
  if (order.status === 'PENDING_CONFIRMATION' || order.status === 'AWAITING_PAYMENT') {
    rows.push([
      {
        text: '✅ Confirm Payment',
        callback_data: 'admin:ok:' + order.id,
      },
      {
        text: '❌ Reject Payment',
        callback_data: 'admin:reject:' + order.id,
      },
    ]);
  }
  rows.push([{ text: '⬅️ Back to Admin', callback_data: 'admin:panel' }]);
  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function buildPromoAdminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: promoConfig.isActive ? '🔴 Disable Promo' : '🟢 Enable Promo',
            callback_data: 'admin:promo_toggle',
          },
        ],
        [
          {
            text: '✏️ Edit Text',
            callback_data: 'admin:promo_edit',
          },
        ],
        [{ text: '⬅️ Back to Admin', callback_data: 'admin:panel' }],
      ],
    },
  };
}

// Format single order as text
function formatOrder(order) {
  const cat = CATEGORIES[order.categoryKey];
  const catName = cat ? cat.name : order.categoryKey;
  let statusEmoji;
  if (order.status === 'COMPLETED') statusEmoji = '✅';
  else if (order.status === 'PENDING_CONFIRMATION') statusEmoji = '⏳';
  else if (order.status === 'AWAITING_PAYMENT') statusEmoji = '💸';
  else statusEmoji = '❌';

  const lines = [
    statusEmoji + ' Order #' + order.id,
    '• Item : ' + catName + ' - ' + order.packageName,
    '• Price: ' + formatPrice(order.price),
    '• Game ID   : ' + order.gameId,
    '• Player    : ' + order.playerName,
    '• Contact   : ' + (order.contact || '-'),
    '• Status    : ' + order.status,
    '• CreatedAt : ' + order.createdAt,
  ];

  if (order.paidAt) {
    lines.push('• PaidAt    : ' + order.paidAt);
  }
  if (order.confirmedAt) {
    lines.push('• DoneAt    : ' + order.confirmedAt);
  }

  return lines.join('\n');
}

// Detailed order text (with user info, for admin)
function formatOrderDetail(order) {
  const base = formatOrder(order);
  const extra = [
    '',
    '👤 Customer:',
    '• User ID   : ' + order.userId,
    '• Username  : ' + (order.username ? '@' + order.username : '(none)'),
    '• FirstName : ' + (order.firstName || '(none)'),
  ];
  return base + '\n' + extra.join('\n');
}

// CSV helpers
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

// ----- Main Menu -----

async function sendWelcome(chatId, user) {
  const isAdminUser = isAdmin(user.id);
  const lines = [
    '👋 **Welcome To BIKA Store**',
    '',
    'Game Items & Digital Services:',
    '• MLBB Diamonds & Weekly Pass',
    '• PUBG UC',
    '• Magic Chess Diamonds',
    '• Telegram Premium',
    '• Telegram Stars',
    '',
    'Choose from the menu below to start your order ✨',
  ];

  await bot.sendMessage(chatId, lines.join('\n'), {
    parse_mode: 'Markdown',
    ...buildMainMenu(isAdminUser),
  });
}

// ----- Telegram Handlers -----

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  knownUserIds.add(userId);
  resetUserSession(userId);

  await sendWelcome(chatId, msg.from);
});

// /menu
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isAdminUser = isAdmin(userId);
  await bot.sendMessage(
    chatId,
    '📋 Main Menu – What would you like to do?',
    buildMainMenu(isAdminUser)
  );
});

// /admin
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAdmin(userId)) {
    await bot.sendMessage(
      chatId,
      '🚫 You are not allowed to access the admin panel.'
    );
    return;
  }

  await bot.sendMessage(
    chatId,
    '🛠 Admin Panel – Choose an option:',
    buildAdminPanelKeyboard()
  );
});

// Generic message handler (for steps like asking ID, name, etc.)
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Ignore non-private or command-only messages here
    if (msg.chat.type !== 'private') return;
    if (!msg.text) return;

    // Commands are already handled above
    if (msg.text.startsWith('/')) return;

    const session = getUserSession(userId);

    // Admin: editing promotion text
    if (session.isEditingPromotion && isAdmin(userId)) {
      promoConfig.text = msg.text;
      session.isEditingPromotion = false;
      await bot.sendMessage(
        chatId,
        '✅ Promotion text updated.',
        buildPromoAdminKeyboard()
      );
      return;
    }

    // Admin: broadcast text (optional separate content)
    if (session.isBroadcasting && isAdmin(userId)) {
      session.isBroadcasting = false;

      const textToBroadcast = msg.text;
      if (!textToBroadcast || !textToBroadcast.trim()) {
        await bot.sendMessage(
          chatId,
          '⚠️ Empty message. Broadcast cancelled.'
        );
        return;
      }

      let success = 0;
      for (const uid of knownUserIds) {
        try {
          await bot.sendMessage(uid, textToBroadcast);
          success += 1;
        } catch (e) {
          // ignore individual errors
        }
      }

      await bot.sendMessage(
        chatId,
        '📣 Broadcast complete. Sent to ' + success + ' user(s).'
      );
      return;
    }

    // Customer order flow
    if (!session.step) {
      // No active flow -> ignore or gently remind
      return;
    }

    if (session.step === 'WAITING_GAME_ID') {
      session.tempOrderData.gameId = msg.text.trim();
      session.step = 'WAITING_PLAYER_NAME';

      await bot.sendMessage(
        chatId,
        '💳 Please send your **in-game name / nickname**.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (session.step === 'WAITING_PLAYER_NAME') {
      session.tempOrderData.playerName = msg.text.trim();
      session.step = 'WAITING_CONTACT';

      await bot.sendMessage(
        chatId,
        '📱 Please send your **Phone / Telegram contact** (or type "-" to skip).',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (session.step === 'WAITING_CONTACT') {
      const contactText = msg.text.trim();
      session.tempOrderData.contact = contactText === '-' ? '' : contactText;
      session.step = 'WAITING_CONFIRM';

      const temp = session.tempOrderData;
      const cat = CATEGORIES[temp.categoryKey];

      const summaryLines = [
        '🧾 **Order Summary**',
        '',
        '• Item : ' + (cat ? cat.name : temp.categoryKey) + ' - ' + temp.packageName,
        '• Price: ' + formatPrice(temp.price),
        '',
        '• Game ID : ' + temp.gameId,
        '• Player  : ' + temp.playerName,
        '• Contact : ' + (temp.contact || '-'),
        '',
        'If everything is correct, tap **Confirm Order** to receive payment details.',
      ];

      await bot.sendMessage(chatId, summaryLines.join('\n'), {
        parse_mode: 'Markdown',
        ...buildOrderConfirmKeyboard(),
      });

      return;
    }
  } catch (err) {
    console.error('Error in message handler:', err);
  }
});

// Callback queries (buttons)
bot.on('callback_query', async (query) => {
  const data = query.data;
  const msg = query.message;
  const chatId = msg.chat.id;
  const userId = query.from.id;

  try {
    await bot.answerCallbackQuery(query.id);

    // Main menu navigation
    if (data === 'm:main') {
      resetUserSession(userId);
      await sendWelcome(chatId, query.from);
      return;
    }

    if (data === 'm:browse') {
      resetUserSession(userId);
      await bot.sendMessage(
        chatId,
        '🛍 Choose a category:',
        buildCategoryKeyboard()
      );
      return;
    }

    if (data === 'm:promos') {
      const lines = [];

      lines.push('🎉 Promotions');
      lines.push('');

      if (promoConfig.isActive && promoConfig.text) {
        lines.push(promoConfig.text);
      } else {
        lines.push('No active promotion at the moment.');
      }

      await bot.sendMessage(chatId, lines.join('\n'), {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Back to Main Menu', callback_data: 'm:main' }]],
        },
      });

      return;
    }

    if (data === 'm:myorders') {
      const myOrders = orders
        .filter((o) => o.userId === userId)
        .sort((a, b) => b.id - a.id)
        .slice(0, 10);

      if (!myOrders.length) {
        await bot.sendMessage(chatId, '📦 You have no orders yet.');
        return;
      }

      const lines = ['📦 Your recent orders:', ''];
      myOrders.forEach((o) => {
        lines.push(formatOrder(o));
        lines.push(''); // spacing
      });

      await bot.sendMessage(chatId, lines.join('\n'));
      return;
    }

    if (data === 'm:help') {
      const lines = [
        '❓ **How to Order**',
        '',
        '1️⃣ Tap **Browse Items**',
        '2️⃣ Choose your game / item',
        '3️⃣ Select the package you want',
        '4️⃣ Send your in-game ID & name',
        '5️⃣ Confirm order & see payment details',
        '6️⃣ Pay and tap **I have paid**',
        '',
        'Admin will confirm your payment and deliver as fast as possible 💨',
      ];
      await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
      return;
    }

    // Category selected
    if (data.startsWith('cat:')) {
      resetUserSession(userId);

      const categoryKey = data.split(':')[1];
      const cat = CATEGORIES[categoryKey];
      if (!cat) {
        await bot.sendMessage(
          chatId,
          '⚠️ Unknown category. Please try again.',
          buildCategoryKeyboard()
        );
        return;
      }

      const lines = [
        cat.emoji + ' *' + cat.name + '*',
        '',
        cat.description,
        '',
        'Choose a package:',
      ];

      await bot.sendMessage(chatId, lines.join('\n'), {
        parse_mode: 'Markdown',
        ...buildPackagesKeyboard(categoryKey),
      });

      return;
    }

    // Item selected
    if (data.startsWith('item:')) {
      const parts = data.split(':');
      const categoryKey = parts[1];
      const packageId = parts[2];
      const cat = CATEGORIES[categoryKey];
      if (!cat) {
        await bot.sendMessage(chatId, '⚠️ Category not found.');
        return;
      }
      const pkg = cat.packages.find((p) => p.id === packageId);
      if (!pkg) {
        await bot.sendMessage(chatId, '⚠️ Package not found.');
        return;
      }

      const session = getUserSession(userId);
      session.step = 'WAITING_GAME_ID';
      session.tempOrderData = {
        categoryKey,
        packageId,
        packageName: pkg.name,
        price: pkg.price,
      };

      const lines = [
        '🧾 You selected:',
        '',
        '• Item : ' + cat.name + ' - ' + pkg.name,
        '• Price: ' + formatPrice(pkg.price),
        '',
        'Please send your **in-game ID**.',
      ];

      await bot.sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' });
      return;
    }

    // Order confirm / cancel (from summary)
    if (data === 'order:confirm') {
      const session = getUserSession(userId);
      if (!session.tempOrderData || session.step !== 'WAITING_CONFIRM') {
        await bot.sendMessage(chatId, '⚠️ No order to confirm. Please start again.');
        return;
      }

      const temp = session.tempOrderData;
      const newOrder = {
        id: orderIdCounter++,
        userId,
        username: query.from.username || '',
        firstName: query.from.first_name || '',
        categoryKey: temp.categoryKey,
        packageId: temp.packageId,
        packageName: temp.packageName,
        price: temp.price,
        currency: STORE_CURRENCY,
        gameId: temp.gameId,
        playerName: temp.playerName,
        contact: temp.contact || '',
        status: 'AWAITING_PAYMENT',
        createdAt: new Date().toISOString(),
        paidAt: null,
        confirmedAt: null,
        adminNote: '',
      };

      orders.push(newOrder);

      // Clear session
      resetUserSession(userId);

      const lines = [
        '✅ Order #' + newOrder.id + ' created.',
        '',
        'Please pay using the details below and then tap **I have paid**.',
        '',
        PAYMENT_TEXT,
      ];

      await bot.sendMessage(chatId, lines.join('\n'), {
        parse_mode: 'Markdown',
        ...buildOrderPaymentKeyboard(newOrder.id),
      });

      return;
    }

    if (data === 'order:cancel') {
      resetUserSession(userId);
      await bot.sendMessage(chatId, '❌ Order cancelled.');
      return;
    }

    // User pressed "I have paid"
    if (data.startsWith('order:paid:')) {
      const orderId = Number(data.split(':')[2]);
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.userId !== userId) {
        await bot.sendMessage(chatId, '⚠️ Order not found.');
        return;
      }

      order.status = 'PENDING_CONFIRMATION';
      order.paidAt = new Date().toISOString();

      await bot.sendMessage(
        chatId,
        '⏳ Thank you! Your payment for Order #' + order.id + ' is pending admin confirmation.'
      );

      // Notify admins
      const textForAdmin =
        '💰 New payment pending confirmation:\n\n' +
        formatOrder(order) +
        '\n\nUse the buttons below to confirm or reject.';

      for (const adminId of ADMIN_IDS) {
        try {
          await bot.sendMessage(adminId, textForAdmin, buildAdminOrderActionKeyboard(order.id));
        } catch (e) {
          // ignore
        }
      }

      return;
    }

    // ----- Admin Area -----
    if (data === 'admin:panel') {
      if (!isAdmin(userId)) {
        await bot.sendMessage(chatId, '🚫 You are not an admin.');
        return;
      }

      await bot.sendMessage(
        chatId,
        '🛠 Admin Panel – Choose an option:',
        buildAdminPanelKeyboard()
      );
      return;
    }

    if (data === 'admin:orders') {
      if (!isAdmin(userId)) return;

      const recent = orders
        .slice()
        .sort((a, b) => b.id - a.id)
        .slice(0, 15);

      if (!recent.length) {
        await bot.sendMessage(chatId, '📋 No orders yet.');
        return;
      }

      for (const o of recent) {
        const text = formatOrder(o);
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '👁 View Detail',
                  callback_data: 'admin:detail:' + o.id,
                },
              ],
            ],
          },
        };
        await bot.sendMessage(chatId, text, keyboard);
      }

      return;
    }

    if (data === 'admin:pending') {
      if (!isAdmin(userId)) return;

      const pending = orders
        .filter((o) => o.status === 'PENDING_CONFIRMATION')
        .sort((a, b) => a.id - b.id)
        .slice(0, 20);

      if (!pending.length) {
        await bot.sendMessage(chatId, '⏳ No pending payments.');
        return;
      }

      for (const o of pending) {
        await bot.sendMessage(
          chatId,
          formatOrder(o),
          buildAdminOrderActionKeyboard(o.id)
        );
      }

      return;
    }

    if (data.startsWith('admin:detail:')) {
      if (!isAdmin(userId)) return;

      const orderId = Number(data.split(':')[2]);
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        await bot.sendMessage(chatId, '⚠️ Order not found.');
        return;
      }

      const text = '📄 Order Detail\n\n' + formatOrderDetail(order);
      await bot.sendMessage(chatId, text, buildAdminOrderDetailKeyboard(order));
      return;
    }

    if (data.startsWith('admin:ok:')) {
      if (!isAdmin(userId)) return;

      const orderId = Number(data.split(':')[2]);
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        await bot.sendMessage(chatId, '⚠️ Order not found.');
        return;
      }

      order.status = 'COMPLETED';
      order.confirmedAt = new Date().toISOString();

      await bot.sendMessage(chatId, '✅ Order #' + order.id + ' marked as COMPLETED.');

      // Notify customer
      try {
        await bot.sendMessage(
          order.userId,
          '🎉 Your Order #' + order.id + ' has been confirmed. Thank you for shopping with BIKA Store!'
        );
      } catch (e) {
        // ignore
      }

      return;
    }

    if (data.startsWith('admin:reject:')) {
      if (!isAdmin(userId)) return;

      const orderId = Number(data.split(':')[2]);
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        await bot.sendMessage(chatId, '⚠️ Order not found.');
        return;
      }

      order.status = 'REJECTED';
      order.confirmedAt = new Date().toISOString();

      await bot.sendMessage(chatId, '❌ Order #' + order.id + ' marked as REJECTED.');

      // Notify customer
      try {
        await bot.sendMessage(
          order.userId,
          '⚠️ Your payment for Order #' + order.id + ' was rejected. Please contact admin for more details.'
        );
      } catch (e) {
        // ignore
      }

      return;
    }

    // Promotion admin
    if (data === 'admin:promo') {
      if (!isAdmin(userId)) return;

      const lines = [
        '🎯 Promotion Settings',
        '',
        'Status: ' + (promoConfig.isActive ? '🟢 Active' : '🔴 Inactive'),
        '',
        'Current Text:',
        promoConfig.text || '(empty)',
      ];

      await bot.sendMessage(chatId, lines.join('\n'), buildPromoAdminKeyboard());
      return;
    }

    if (data === 'admin:promo_toggle') {
      if (!isAdmin(userId)) return;

      promoConfig.isActive = !promoConfig.isActive;

      const lines = [
        '✅ Promotion status updated.',
        '',
        'Now: ' + (promoConfig.isActive ? '🟢 Active' : '🔴 Inactive'),
      ];

      await bot.sendMessage(chatId, lines.join('\n'), buildPromoAdminKeyboard());
      return;
    }

    if (data === 'admin:promo_edit') {
      if (!isAdmin(userId)) return;

      const session = getUserSession(userId);
      session.isEditingPromotion = true;

      await bot.sendMessage(
        chatId,
        '✏️ Please send the new promotion text now.\n\n(Your next message will replace the existing promo text.)'
      );
      return;
    }

    // Broadcast
    if (data === 'admin:broadcast') {
      if (!isAdmin(userId)) return;

      const session = getUserSession(userId);
      session.isBroadcasting = true;

      const lines = [
        '📣 Broadcast Message',
        '',
        'Please send the message you want to broadcast to all users.\n',
        '⚠️ Use carefully. This will send to everyone who started the bot.',
      ];

      await bot.sendMessage(chatId, lines.join('\n'));
      return;
    }

    // CSV Export
    if (data === 'admin:export_csv') {
      if (!isAdmin(userId)) return;

      if (!orders.length) {
        await bot.sendMessage(chatId, '📄 No orders to export yet.');
        return;
      }

      const csv = ordersToCSV();
      const buffer = Buffer.from(csv, 'utf-8');

      await bot.sendDocument(
        chatId,
        buffer,
        {},
        {
          filename: 'orders.csv',
          contentType: 'text/csv',
        }
      );

      return;
    }
  } catch (err) {
    console.error('Error in callback_query handler:', err);
  }
});

// ----- Global Error Handlers -----
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// ----- Startup Log -----
console.log('✅ BIKA Store Bot is running...');
console.log('Admin IDs:', ADMIN_IDS);
