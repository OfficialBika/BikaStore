// index.js
"use strict";

/**
 * BIKA STORE BOT (simplified, module-structured version)
 * Features:
 *  - MLBB & PUBG single-package order flow
 *  - Payment slip upload
 *  - Admin approve / reject via inline buttons
 *  - Website → Web-order startCode → Bot /start web_xxxxx
 */

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const {
  STORE_CURRENCY,
  ADMIN_IDS,
  PUBLIC_URL,
  TIME_ZONE,
  API_BASE,
  BOT_TOKEN,
  isAdmin,
} = require("./config");
const { Order, getNextOrderId } = require("./models");

// =============== BASIC BOT + WEBHOOK SETUP ===============

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

let autoClean = null;
try {
  const attachAutoClean = require("./autoClean");
  autoClean = attachAutoClean(bot, { skipChatIds: ADMIN_IDS });
  console.log("🧼 autoClean helper loaded.");
} catch (err) {
  console.log("🧼 autoClean not enabled (autoClean.js missing).");
}

// Webhook
if (PUBLIC_URL) {
  const cleanBase = PUBLIC_URL.replace(/\/+$/, "");
  const webhookUrl = `${cleanBase}/webhook/${BOT_TOKEN}`;
  bot
    .setWebHook(webhookUrl)
    .then(() => console.log("🔗 Webhook set to:", webhookUrl))
    .catch((err) =>
      console.error("Failed to set webhook automatically:", err.message)
    );
} else {
  console.warn(
    "⚠️ PUBLIC_URL not set. Please configure webhook manually via BotFather."
  );
}

// Express app
const app = express();
app.use(express.json());

// Telegram webhook endpoint (any path)
app.post("*", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("BIKA Store Bot is running (webhook mode).");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌐 Express server listening on port", PORT);
});

// =============== IN-MEMORY STATE ===============

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
 * Known users for broadcast / stats
 */
const knownUserIds = new Set();

// =============== CATEGORIES ===============

const CATEGORIES = {
  mlbb: {
    key: "mlbb",
    name: "MLBB Diamonds & Pass",
    description: "Mobile Legends: Bang Bang – Diamonds and Weekly Pass.",
    emoji: "💎",
    packages: [
      { id: "mlbb_11", name: "11 Diamonds", price: 800 },
      { id: "mlbb_22", name: "22 Diamonds", price: 1600 },
      { id: "mlbb_33", name: "33 Diamonds", price: 2350 },
      { id: "mlbb_55", name: "55 Diamonds", price: 3600 },
      { id: "mlbb_86", name: "86 Diamonds", price: 4800 },
      { id: "mlbb_112", name: "112 Diamonds", price: 8200 },
      { id: "mlbb_172", name: "172 Diamonds", price: 9800 },
      { id: "mlbb_257", name: "257 Diamonds", price: 14500 },
      { id: "mlbb_343", name: "343 Diamonds", price: 20000 },
      { id: "mlbb_429", name: "429 Diamonds", price: 25000 },
      { id: "mlbb_514", name: "514 Diamonds", price: 29900 },
      { id: "mlbb_600", name: "600 Diamonds", price: 34500 },
      { id: "mlbb_706", name: "706 Diamonds", price: 39900 },
      { id: "mlbb_792", name: "792 Diamonds", price: 44500 },
      { id: "mlbb_878", name: "878 Diamonds", price: 48500 },
      { id: "mlbb_963", name: "963 Diamonds", price: 53000 },
      { id: "mlbb_1049", name: "1049 Diamonds", price: 59900 },
      { id: "mlbb_1135", name: "1135 Diamonds", price: 63500 },
      { id: "mlbb_1412", name: "1412 Diamonds", price: 77000 },
      { id: "mlbb_1584", name: "1584 Diamonds", price: 88000 },
      { id: "mlbb_1669", name: "1669 Diamonds", price: 94000 },
      { id: "mlbb_2195", name: "2195 Diamonds", price: 118900 },
      { id: "mlbb_3158", name: "3158 Diamonds", price: 172000 },
      { id: "mlbb_3688", name: "3688 Diamonds", price: 202000 },
      { id: "mlbb_4390", name: "4390 Diamonds", price: 237000 },
      { id: "mlbb_5100", name: "5100 Diamonds", price: 280000 },
      { id: "mlbb_5532", name: "5532 Diamonds", price: 300000 },
      { id: "mlbb_6055", name: "6055 Diamonds", price: 330000 },

      { id: "mlbb_wp1", name: "Weekly Pass 1 (wp1)", price: 5900 },
      { id: "mlbb_wp2", name: "Weekly Pass 2 (wp2)", price: 11800 },
      { id: "mlbb_wp3", name: "Weekly Pass 3 (wp3)", price: 17700 },
      { id: "mlbb_wp4", name: "Weekly Pass 4 (wp4)", price: 23600 },
      { id: "mlbb_wp5", name: "Weekly Pass 5 (wp5)", price: 29500 },
      { id: "mlbb_web", name: "WEB Pack (web)", price: 3500 },
      { id: "mlbb_meb", name: "MEB Pack (meb)", price: 16500 },
    ],
  },

  pubg: {
    key: "pubg",
    name: "PUBG UC & Prime",
    description: "PUBG Mobile – UC top-up and Prime subscriptions.",
    emoji: "🎯",
    packages: [
      { id: "pubg_60", name: "60 UC", price: 4500 },
      { id: "pubg_325", name: "325 UC", price: 19500 },
      { id: "pubg_660", name: "660 UC", price: 38000 },
      { id: "pubg_1800", name: "1800 UC", price: 90500 },
      { id: "pubg_3850", name: "3850 UC", price: 185000 },
      { id: "pubg_8100", name: "8100 UC", price: 363000 },
      { id: "pubg_prime1m", name: "Prime 1 Month", price: 4500 },
      { id: "pubg_primeplus", name: "Prime Plus", price: 39500 },
    ],
  },
};

const CATEGORY_LIST = Object.values(CATEGORIES);

// =============== UTILITIES ===============

function formatPrice(value) {
  if (typeof value !== "number") return value;
  return value.toLocaleString("en-US") + " " + STORE_CURRENCY;
}

function formatDateTime(dt) {
  if (!dt) return "-";
  let d = dt;
  if (!(d instanceof Date)) {
    d = new Date(dt);
  }
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
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

// send step message & auto-delete previous step msg
async function sendStepMessage(userId, chatId, text, options = {}) {
  const last = userLastStepMessage.get(userId);
  if (last && last.chatId === chatId) {
    try {
      await bot.deleteMessage(chatId, last.messageId);
    } catch (_) {}
  }
  const sent = await bot.sendMessage(chatId, text, options);
  userLastStepMessage.set(userId, { chatId, messageId: sent.message_id });
  return sent;
}

async function safeEditMessageText(botInstance, chatId, messageId, text, extra) {
  try {
    await botInstance.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      ...extra,
    });
  } catch (e) {
    const desc =
      e && e.response && e.response.body && e.response.body.description;
    if (desc !== "Bad Request: message to edit not found") {
      console.error("editMessageText error:", desc || e.message || e);
    }
  }
}

// =============== UI HELPERS ===============

function buildMainMenu(isAdminUser) {
  const keyboard = [
    [
      { text: "🛍 Game Items", callback_data: "m:browse" },
      { text: "📦 My Orders", callback_data: "m:orders" },
    ],
    [{ text: "❓ Help", callback_data: "m:help" }],
  ];

  if (isAdminUser) {
    keyboard.push([{ text: "🛠 Admin Panel", callback_data: "admin:panel" }]);
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
  rows.push([{ text: "⬅️ Back to Main Menu", callback_data: "m:main" }]);
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
      text: "« Prev",
      callback_data: `cat:${categoryKey}:${page - 1}`,
    });
  }
  if (page < totalPages) {
    navRow.push({
      text: "Next »",
      callback_data: `cat:${categoryKey}:${page + 1}`,
    });
  }
  if (navRow.length) rows.push(navRow);

  rows.push([{ text: "⬅️ Back to Categories", callback_data: "m:browse" }]);

  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

function formatOrderSummary(order, options = {}) {
  const showStatus = options.showStatus !== false;
  const titleVariant = options.title || "DEFAULT";

  const lines = [];

  if (titleVariant === "COMPLETE") {
    lines.push("✅ **BIKA STORE – Order Complete**");
  } else if (titleVariant === "REJECTED") {
    lines.push("❌ **BIKA STORE – Order Rejected**");
  } else if (titleVariant === "NEW") {
    lines.push("🆕 **BIKA STORE – New Order**");
  } else {
    lines.push("🧾 **BIKA STORE – Order Detail**");
  }

  lines.push("");
  lines.push(`**Order ID:** \`#${order.id}\``);

  if (showStatus) {
    const statusLabel =
      {
        PENDING_PAYMENT: "⏳ Pending Payment",
        AWAITING_SLIP: "📸 Awaiting Slip",
        PENDING_CONFIRMATION: "🕒 Waiting Admin Confirmation",
        COMPLETED: "✅ Completed",
        REJECTED: "❌ Rejected",
        CANCELLED_BY_USER: "🚫 Cancelled by Customer",
      }[order.status] || order.status;

    lines.push(`**Status:** ${statusLabel}`);
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");

  const gameLabel =
    order.categoryKey === "mlbb"
      ? "MLBB Diamonds & Weekly Pass"
      : "PUBG UC & Prime";

  lines.push("🎮 **Game & Package**");
  lines.push(`• Game: *${gameLabel}*`);
  lines.push(`• Package: *${order.packageName}*`);
  lines.push(`• Price: *${formatPrice(order.price)}*`);

  lines.push("");
  lines.push("👤 **Account Info**");
  if (order.categoryKey === "mlbb") {
    lines.push(`• MLBB ID: \`${order.gameId || "-"}\``);
    lines.push(`• Server ID: \`${order.serverId || "-"}\``);
  } else {
    lines.push(`• PUBG ID: \`${order.gameId || "-"}\``);
  }

  lines.push("");
  lines.push("💬 **Telegram User**");
  lines.push(
    `• @${order.username || "unknown"} (${order.firstName || "User"})`
  );

  lines.push("");
  lines.push("🕓 **Timeline**");
  lines.push(`• Created:   ${formatDateTime(order.createdAt)}`);
  if (order.paidAt) {
    lines.push(`• Paid:      ${formatDateTime(order.paidAt)}`);
  }
  if (order.confirmedAt) {
    lines.push(`• Confirmed: ${formatDateTime(order.confirmedAt)}`);
  }

  if (order.adminNote) {
    lines.push("");
    lines.push("📝 **Admin Note**");
    lines.push(order.adminNote);
  }

  return lines.join("\n");
}

function buildOrderDetailKeyboard(order, forAdmin) {
  const rows = [];

  if (forAdmin) {
    if (order.status === "PENDING_CONFIRMATION") {
      rows.push([
        {
          text: "✅ Approve (Complete)",
          callback_data: `admin:complete:${order.id}`,
        },
        {
          text: "❌ Reject Order",
          callback_data: `admin:reject:${order.id}`,
        },
      ]);
    }
  } else {
    if (order.status === "PENDING_PAYMENT") {
      rows.push([
        {
          text: "💰 I have paid",
          callback_data: `payment:paid:${order.id}`,
        },
      ]);
    }
  }

  rows.push([
    {
      text: "⬅️ Back",
      callback_data: forAdmin ? "admin:panel" : "m:orders",
    },
  ]);

  return {
    reply_markup: {
      inline_keyboard: rows,
    },
  };
}

async function sendWelcome(chatId, user) {
  const isAdminUser = isAdmin(user.id);
  const lines = [
    "👋 **Welcome To BIKA Store**",
    "",
    "Game Items & Digital Services:",
    "• MLBB Diamonds & Weekly Pass (ID + Server ID)",
    "• PUBG UC & Prime (ID only)",
    "",
    "Telegram Bot ကနေပဲ မြန်မြန်ဆန်ဆန် top-up ပေးနေပါတယ်။",
    "",
    "အောက်က Menu ထဲက **🛍 Game Items** ကိုနှိပ်ပြီး အော်ဒါတင်ရအောင် ✨",
  ];

  await bot.sendMessage(chatId, lines.join("\n"), {
    parse_mode: "Markdown",
    ...buildMainMenu(isAdminUser),
  });
}

async function sendPaymentInstructions(chatId, order) {
  const lines = [];
  lines.push(`💰 **Payment Instructions for Order #${order.id}**`);
  lines.push("");
  lines.push(`Amount to pay: *${formatPrice(order.price)}*`);
  lines.push("");
  lines.push("📌 Payment Methods:");
  lines.push("  Name: Shine Htet Aung");
  lines.push("- KBZ Pay - 09264202637");
  lines.push("- WavePay - 09264202637");
  lines.push("");
  lines.push(
    'ငွေလွှဲပြီးသွားရင် အောက်က **"I have paid"** button ကိုနှိပ်ပြီး ' +
      "Bot က တောင်းတဲ့ ငွေလွှဲပြေစာ screenshot ကို ပို့ပေးပါ။"
  );

  await bot.sendMessage(chatId, lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💰 I have paid", callback_data: `payment:paid:${order.id}` }],
        [
          {
            text: "❌ Cancel Order",
            callback_data: `order:cancel:${order.id}`,
          },
        ],
      ],
    },
  });
}

async function sendOrderConfirmMessage(userId, chatId, draft) {
  const gameLabel =
    draft.categoryKey === "mlbb" ? "MLBB Diamonds & Pass" : "PUBG UC & Prime";

  const lines = [];
  lines.push("📦 **Review & Confirm your order**");
  lines.push("");
  lines.push("**1. Game & Package**");
  lines.push(`• Game: *${gameLabel}*`);
  lines.push(`• Package: *${draft.packageName}*`);
  lines.push(`• Price: *${formatPrice(draft.price)}*`);
  lines.push("");
  lines.push("**2. Account Info**");

  if (draft.categoryKey === "mlbb") {
    lines.push(`• MLBB ID: \`${draft.gameId}\``);
    lines.push(`• Server ID: \`${draft.serverId || "-"}\``);
  } else {
    lines.push(`• PUBG ID: \`${draft.gameId}\``);
  }

  lines.push("");
  lines.push("အထက်ပါ အချက်အလက်တွေ **မှန်ကန်တယ်** လို့သေချာရင်");
  lines.push(
    'အောက်က "✅ Confirm Order" ကိုနှိပ်ပြီး order ကို အတည်ပြုပါ။'
  );

  await sendStepMessage(userId, chatId, lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Confirm Order", callback_data: "order:confirm" }],
        [{ text: "❌ Cancel", callback_data: "order:cancel_draft" }],
      ],
    },
  });
}

// =============== WEBSITE WEB-ORDER HANDLER ===============

async function handleWebStartCode(startCode, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || "";
  const firstName = msg.from.first_name || "";

  await bot.sendMessage(
    chatId,
    "🔄 Website မှာ တင်ထားတဲ့ order ကို ဖတ်နေပါတယ်…"
  );

  try {
    const resp = await axios.post(API_BASE + "/api/webOrders/claim", {
  startCode,
  telegramUserId: userId,
  username,
  firstName,
});

    const data = resp.data;

    if (!data.success || !data.order) {
      const msgText =
        data && data.message
          ? data.message
          : "Website မှ order record ကို မတွေ့ရသေးပါ။ link သက်တမ်းကုန်သွားလို့ ဖြစ်နိုင်ပါတယ်။";
      await bot.sendMessage(chatId, "❌ " + msgText);
      return;
    }

    const wo = data.order;

    const cart = Array.isArray(wo.cart) ? wo.cart : [];
    const total =
      typeof wo.total === "number"
        ? wo.total
        : cart.reduce(
            (s, item) =>
              s + Number(item.price || 0) * Number(item.qty || 0),
            0
          );

    const categoryKey = wo.game === "PUBG" ? "pubg" : "mlbb";

    const packageName =
      cart.length > 0
        ? cart
            .map((i) => {
              const label = i.display || i.label || "";
              const qty = Number(i.qty || 0) || 1;
              return `${label} ×${qty}`;
            })
            .join(" + ")
        : "Web Order Cart";

    const gameId =
      categoryKey === "mlbb" ? wo.mlbbId || "" : wo.pubgId || "";
    const serverId = categoryKey === "mlbb" ? wo.svId || "" : "";

    const orderId = await getNextOrderId();

    const order = await Order.create({
      id: orderId,
      userId,
      username,
      firstName,
      categoryKey,
      packageId: "WEB_CART",
      packageName,
      price: total,
      currency: STORE_CURRENCY,
      gameId,
      serverId,
      status: "PENDING_PAYMENT",
      createdAt: new Date(),
      paidAt: null,
      confirmedAt: null,
      adminNote: `[WEB] startCode ${startCode}`,
      paymentSlipFileId: "",
    });

    const summaryText = formatOrderSummary(order, { title: "NEW" });

    await bot.sendMessage(chatId, summaryText, {
      parse_mode: "Markdown",
      ...buildOrderDetailKeyboard(order, false),
    });

    await sendPaymentInstructions(chatId, order);
  } catch (err) {
    console.error("Error in handleWebStartCode:", err);
    await bot.sendMessage(
      chatId,
      "❌ Website order ကို ဖတ်နေစဉ် Network ပြဿနာတစ်ခု ဖြစ်သွားပါတယ်။\n" +
        "နောက်တစ်ခါ ပြန်ကြိုးစားပေးပါနော်။"
    );
  }
}

// =============== TEXT COMMAND HANDLERS ===============

// /start with optional payload (/start, /start review, /start from_website, /start web_xxx)
bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    knownUserIds.add(userId);
    resetUserSession(userId);

    const payloadRaw = match && match[1] ? match[1].trim() : "";
    const payload = payloadRaw ? payloadRaw.split(" ")[0] : "";

    // 1) Website review link: https://t.me/BikaStoreBot?start=review
    if (payload === "review") {
      await bot.sendMessage(
        chatId,
        "⭐ Review မလေးရေးချင်ရင် ဒီ chat ထဲမှာ သဘောကျသလို စာတိုလေး ပို့ထားပေးလို့ရပါတယ်။\n\n" +
          "BIKA STORE ကို သဘောကျနေသွားရင် အခြား Player တွေအတွက်လည်း အသိပေးချင်ပါတယ် 😎"
      );
      await sendWelcome(chatId, msg.from);
      return;
    }

    // 2) Website မှာ Button ထဲက start=from_website
    if (payload === "from_website") {
      await bot.sendMessage(
        chatId,
        "🌐 BIKA STORE Website ကနေ ဝင်လာတာကို ကြိုဆိုပါတယ်!\n\n" +
          "အော်ဒါတင်ရန်အတွက် အောက်က Menu ထဲက **🛍 Game Items** ကိုနှိပ်ပြီး " +
          "MLBB Diamonds / Weekly Pass သို့မဟုတ် PUBG UC ကိုရွေးပြီး ဆက်လုပ်ပေးပါ 😊",
        { parse_mode: "Markdown" }
      );
      await sendWelcome(chatId, msg.from);
      return;
    }

    // 3) Website web-order startCode (eg. /start web_abc123)
    if (payload && payload.startsWith("web_")) {
      await handleWebStartCode(payload, msg);
      return; // အဲဒီမှာ Order summary + payment info ပြသပြီးသား ဖြစ်သွားမယ်
    }

    // 4) Default /start
    await sendWelcome(chatId, msg.from);
  } catch (e) {
    console.error("Error in /start handler:", e);
    try {
      await sendWelcome(msg.chat.id, msg.from);
    } catch (_) {}
  }
});

// /menu shortcut
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  const isAdminUser = isAdmin(msg.from.id);
  resetUserSession(msg.from.id);
  await bot.sendMessage(chatId, "🏠 Main menu", buildMainMenu(isAdminUser));
});

// =============== MESSAGE HANDLER (ID / SLIP) ===============

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  knownUserIds.add(userId);

  const session = getUserSession(userId, false);

  // 1) Handle payment slip photo
  if (session && session.step === "WAIT_SLIP" && msg.photo && msg.photo.length) {
    const orderId = session.pendingOrderId;
    const order = await Order.findOne({ id: orderId, userId });
    if (!order) {
      resetUserSession(userId);
      return;
    }

    const photoSizes = msg.photo;
    const largestPhoto = photoSizes[photoSizes.length - 1];
    const fileId = largestPhoto.file_id;

    order.status = "PENDING_CONFIRMATION";
    order.paidAt = order.paidAt || new Date();
    order.paymentSlipFileId = fileId;
    await order.save();

    session.step = null;
    session.pendingOrderId = null;

    await bot.sendMessage(
      chatId,
      "✅ ငွေလွှဲပြေစာ Screenshot ကို လက်ခံရရှိပြီးပါပြီ။ " +
        "Admin ထံသို့ သင့်အော်ဒါတင်ပြနေပါပြီ။ခေတ္တစောင့်ဆိုင်းပေးပါ"
    );

    const caption = formatOrderSummary(order, { title: "NEW" });
    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `admin:complete:${order.id}` },
          { text: "❌ Reject", callback_data: `admin:reject:${order.id}` },
        ],
      ],
    };

    for (const adminId of ADMIN_IDS) {
      try {
        await bot.sendPhoto(adminId, fileId, {
          caption,
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });
      } catch (e) {
        console.error("Failed to send slip to admin", adminId, e.message);
      }
    }

    return;
  }

  // Text only below
  if (!msg.text || msg.text.startsWith("/")) return;
  if (!session || !session.step) return;

  const text = msg.text.trim();
  const draft = session.orderDraft || {};

  if (text === "❌ Cancel") {
    resetUserSession(userId);
    await bot.sendMessage(chatId, "❌ Order ကို cancel လုပ်ထားပါတယ်။", {
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  // MLBB (ID + SVID)
  if (session.step === "WAIT_MLBB_ID_SVID") {
    const parts = text.split(/[\s,]+/).filter(Boolean);
    let gameId = "";
    let serverId = "";

    if (parts.length >= 2) {
      gameId = parts[0];
      serverId = parts[1];
    } else {
      gameId = text;
      serverId = "";
    }

    draft.gameId = gameId;
    draft.serverId = serverId;
    session.step = "WAIT_CONFIRM";
    session.orderDraft = draft;

    await bot.sendMessage(
      chatId,
      "✅ MLBB ID + Server ID ကို လက်ခံရရှိပြီးပါပြီ။ Order ကို အတည်ပြုဖို့ စစ်ဆေးကြည့်ပါ။",
      { reply_markup: { remove_keyboard: true } }
    );

    await sendOrderConfirmMessage(userId, chatId, draft);
    return;
  }

  // PUBG (ID only)
  if (session.step === "WAIT_PUBG_ID") {
    draft.gameId = text;
    draft.serverId = "";
    session.step = "WAIT_CONFIRM";
    session.orderDraft = draft;

    await bot.sendMessage(
      chatId,
      "✅ PUBG ID ကို လက်ခံရရှိပြီးပါပြီ။ Order ကို အတည်ပြုဖို့ စစ်ဆေးကြည့်ပါ။",
      { reply_markup: { remove_keyboard: true } }
    );

    await sendOrderConfirmMessage(userId, chatId, draft);
    return;
  }

  // WAIT_CONFIRM – ignore random text
});

// =============== CALLBACK QUERY HANDLER ===============

bot.on("callback_query", async (query) => {
  try {
    const data = query.data || "";
    const userId = query.from.id;
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;

    knownUserIds.add(userId);
    const isAdminUser = isAdmin(userId);

    const acknowledge = () => bot.answerCallbackQuery(query.id).catch(() => {});

    // Main navigation
    if (data === "m:main") {
      resetUserSession(userId);
      await acknowledge();
      await safeEditMessageText(bot, chatId, msgId, "🏠 Main menu", {
        ...buildMainMenu(isAdminUser),
      });
      return;
    }

    if (data === "m:help") {
      await acknowledge();
      const lines = [
        "❓ **How to Order (BIKA STORE)**",
        "",
        "1️⃣ **Browse Items** ကိုနှိပ်ပါ",
        "2️⃣ ထဲကနေ **MLBB** (Diamonds / Pass) နဲ့ **PUBG UC** ထဲကလိုချင်တာရွေးပါ",
        "3️⃣ MLBB အတွက်: **ID + Server ID** ကို တစ်ကြိမ်တည်းထဲ space နဲ့ ခွဲရေးပြီး ထည့်ပေးပါ (ဥပမာ 12345678 1234)",
        "4️⃣ PUBG အတွက်: **PUBG ID** တစ်ခုတည်း ထည့်ပေးပါ",
        "5️⃣ Order summary ကို စစ်ပြီး **Confirm Order** ကိုနှိပ်ပါ",
        "6️⃣ Payment info အတိုင်း KBZ Pay / WavePay နဲ့ ငွေလွှဲပါ",
        "7️⃣ **I have paid** ကိုနှိပ်ပြီး Bot ပြောသလို Slip ပုံ ပို့ပါ",
        "8️⃣ Admin confirm လုပ်လိုက်တာနဲ့ Order Complete ဖြစ်သွားမယ် 💨",
      ];
      await safeEditMessageText(bot, chatId, msgId, lines.join("\n"), {
        parse_mode: "Markdown",
        ...buildMainMenu(isAdminUser),
      });
      return;
    }

    if (data === "m:browse") {
      resetUserSession(userId);
      await acknowledge();
      const lines = [
        "🛍 **Browse Items**",
        "",
        "MLBB နဲ့ PUBG UC အတွက် လက်ရှိရရှိနိုင်တဲ့ package တွေပါ။",
      ];
      await safeEditMessageText(bot, chatId, msgId, lines.join("\n"), {
        parse_mode: "Markdown",
        ...buildCategoryKeyboard(),
      });
      return;
    }

    if (data === "m:orders") {
      await acknowledge();
      const userOrders = await Order.find({ userId })
        .sort({ id: -1 })
        .limit(10)
        .lean();

      if (!userOrders.length) {
        await safeEditMessageText(
          bot,
          chatId,
          msgId,
          "📦 မင်းနဲ့ပတ်သက်တဲ့ order မရှိသေးပါ။",
          {
            ...buildMainMenu(isAdminUser),
          }
        );
        return;
      }

      const lines = [];
      lines.push("📦 **Your Recent Orders**");
      lines.push("");
      userOrders.forEach((o) => {
        lines.push(
          `#${o.id} • ${
            o.categoryKey === "mlbb" ? "MLBB" : "PUBG"
          } • ${o.packageName} • ${formatPrice(o.price)}`
        );
        lines.push(`   Status: ${o.status}`);
      });

      await safeEditMessageText(bot, chatId, msgId, lines.join("\n"), {
        parse_mode: "Markdown",
        ...buildMainMenu(isAdminUser),
      });
      return;
    }

    // Category pagination: cat:<key>:<page>
    if (data.startsWith("cat:")) {
      await acknowledge();
      const [, key, pageStr] = data.split(":");
      const page = parseInt(pageStr, 10) || 1;
      const cat = CATEGORIES[key];

      if (!cat) return;

      const text =
        `**${cat.emoji} ${cat.name}**\n\n${cat.description}\n\n` +
        "Package တစ်ခုရွေးချယ်ပါ။";
      await safeEditMessageText(bot, chatId, msgId, text, {
        parse_mode: "Markdown",
        ...buildPackagesKeyboard(key, page),
      });
      return;
    }

    // Package selected: pkg:<catKey>:<pkgId>
    if (data.startsWith("pkg:")) {
      await acknowledge();

      const parts = data.split(":");
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
        gameId: "",
        serverId: "",
      };

      if (catKey === "mlbb") {
        session.step = "WAIT_MLBB_ID_SVID";

        const introLines = [];
        introLines.push("📝 **Order Form – MLBB**");
        introLines.push("");
        introLines.push(
          `Package: ${pkg.name}\nPrice: ${formatPrice(
            pkg.price
          )}\n\nအောက်ကအချက်အလက်ကို ထည့်ပေးပါ👇`
        );
        introLines.push(
          "**MLBB ID + Server ID** ကို တစ်ကြိမ်တည်း space နဲ့ ခွဲရေးပြီး ထည့်ပါ (ဥပမာ `12345678 1234`)"
        );

        await safeEditMessageText(bot, chatId, msgId, introLines.join("\n"), {
          parse_mode: "Markdown",
        });

        await sendStepMessage(
          userId,
          chatId,
          "👉 ကိုယ့် **MLBB ID + Server ID** ကို `12345678 1234` ဆိုပြီး space နဲ့ ခွဲပြီး ရိုက်ထည့်ပေးပါ။",
          {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [[{ text: "❌ Cancel" }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
      } else {
        session.step = "WAIT_PUBG_ID";

        const introLines = [];
        introLines.push("📝 **Order Form – PUBG UC & Prime**");
        introLines.push("");
        introLines.push(
          `Package: ${pkg.name}\nPrice: ${formatPrice(
            pkg.price
          )}\n\nအောက်ကအချက်အလက်ကို ထည့်ပေးပါ👇`
        );
        introLines.push("**PUBG ID (Character ID)** ကို ထည့်ပါ။");

        await safeEditMessageText(bot, chatId, msgId, introLines.join("\n"), {
          parse_mode: "Markdown",
        });

        await sendStepMessage(
          userId,
          chatId,
          "👉 ကိုယ့် **PUBG ID (Character ID)** ကို ရိုက်ထည့်ပေးပါ။",
          {
            reply_markup: {
              keyboard: [[{ text: "❌ Cancel" }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          }
        );
      }

      return;
    }

    // Order confirm / cancel (draft)
    if (data === "order:confirm") {
      await acknowledge();
      const session = getUserSession(userId, false);
      if (!session || !session.orderDraft) return;

      const draft = session.orderDraft;

      const orderId = await getNextOrderId();

      const order = await Order.create({
        id: orderId,
        userId,
        username: query.from.username || "",
        firstName: query.from.first_name || "",
        categoryKey: draft.categoryKey,
        packageId: draft.packageId,
        packageName: draft.packageName,
        price: draft.price,
        currency: draft.currency,
        gameId: draft.gameId,
        serverId: draft.serverId || "",
        status: "PENDING_PAYMENT",
        createdAt: new Date(),
        paidAt: null,
        confirmedAt: null,
        adminNote: "",
        paymentSlipFileId: "",
      });

      resetUserSession(userId);

      await safeEditMessageText(
        bot,
        chatId,
        msgId,
        `✅ Order #${order.id} ကို ပြုလုပ်ပြီးပါပြီ!\n\nPayment instructions ကို အောက်တွင် ပို့ပေးမယ်။`,
        {}
      );

      await sendPaymentInstructions(chatId, order);
      return;
    }

    if (data === "order:cancel_draft") {
      await acknowledge();
      resetUserSession(userId);
      await safeEditMessageText(
        bot,
        chatId,
        msgId,
        "Order draft ကို ဖျက်ထားလိုက်ပါတယ်။",
        {
          ...buildMainMenu(isAdminUser),
        }
      );
      return;
    }

    if (data.startsWith("order:cancel:")) {
      await acknowledge();
      const [, , idStr] = data.split(":");
      const orderId = parseInt(idStr, 10);
      const order = await Order.findOne({ id: orderId, userId });
      if (!order) return;

      order.status = "CANCELLED_BY_USER";
      await order.save();

      await safeEditMessageText(
        bot,
        chatId,
        msgId,
        "❌ Order ကို customer ထဲကနေ cancel လုပ်လိုက်ပြီ။",
        {}
      );
      return;
    }

    // Payment: user says "I have paid" -> ask for slip
    if (data.startsWith("payment:paid:")) {
      await acknowledge();
      const [, , idStr] = data.split(":");
      const orderId = parseInt(idStr, 10);
      const order = await Order.findOne({ id: orderId });
      if (!order || order.userId !== userId) return;

      if (order.status !== "PENDING_PAYMENT") {
        await bot.answerCallbackQuery(query.id, {
          text: "This order is not awaiting payment.",
          show_alert: true,
        });
        return;
      }

      order.status = "AWAITING_SLIP";
      order.paidAt = new Date();
      await order.save();

      const session = getUserSession(userId, true);
      session.step = "WAIT_SLIP";
      session.pendingOrderId = order.id;

      await safeEditMessageText(
        bot,
        chatId,
        msgId,
        `💳 Order #${order.id} အတွက် "I have paid" ကို လက်ခံရရှိပြီ။\n\n` +
          "👉 အောက်တွင် KBZ/WavePay စသဖြင့် ငွေလွှဲပြေစာ screenshot ကို **တစ်ပုံပဲ** ပို့ပေးပါ။",
        {}
      );

      await sendStepMessage(
        userId,
        chatId,
        "📸 ငွေလွှဲပြေစာ screenshot ကို ပုံအနေနဲ့ တစ်ပုံပို့ပေးပါ။\n\n" +
          "(*ဤပုံကို Admin ထံ Order အသစ်အဖြစ် ပို့ပေးမည်ဖြစ်ပါတယ်*)"
      );
      return;
    }

    // Admin only callbacks
    if (data.startsWith("admin:")) {
      if (!isAdminUser) {
        await acknowledge();
        return;
      }

      if (data === "admin:panel") {
        await acknowledge();
        const totalUsers = knownUserIds.size;
        const completedCount = await Order.countDocuments({
          status: "COMPLETED",
        });
        const agg = await Order.aggregate([
          { $match: { status: "COMPLETED" } },
          { $group: { _id: null, total: { $sum: "$price" } } },
        ]);
        const totalMmk = agg.length ? agg[0].total : 0;

        const lines = [];
        lines.push("🛠 **BIKA STORE – Admin Dashboard**");
        lines.push("");
        lines.push(`👥 Bot Users (started): *${totalUsers}*`);
        lines.push(`📦 Completed Orders: *${completedCount}*`);
        lines.push(`💰 Total MMK: *${formatPrice(totalMmk)}*`);

        await safeEditMessageText(bot, chatId, msgId, lines.join("\n"), {
          parse_mode: "Markdown",
          ...buildMainMenu(true),
        });
        return;
      }

      if (
        data.startsWith("admin:complete:") ||
        data.startsWith("admin:reject:")
      ) {
        await acknowledge();
        const isComplete = data.startsWith("admin:complete:");
        const [, , idStr] = data.split(":");
        const orderId = parseInt(idStr, 10);
        const order = await Order.findOne({ id: orderId });
        if (!order) return;

        if (isComplete) {
          order.status = "COMPLETED";
          order.confirmedAt = new Date();
        } else {
          order.status = "REJECTED";
          order.confirmedAt = new Date();
          order.adminNote = "Rejected by admin";
        }
        await order.save();

        const newText = formatOrderSummary(order, {
          title: isComplete ? "COMPLETE" : "REJECTED",
        });

        await safeEditMessageText(bot, chatId, msgId, newText, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [] },
        });

        try {
          await bot.sendMessage(
            order.userId,
            formatOrderSummary(order, {
              title: isComplete ? "COMPLETE" : "REJECTED",
            }),
            { parse_mode: "Markdown" }
          );
        } catch (e) {
          console.error("Notify user failed", order.userId, e.message);
        }

        return;
      }

      return;
    }
  } catch (err) {
    console.error("Error in callback_query handler:", err);
    try {
      await bot.answerCallbackQuery(query.id, {
        text: "Something went wrong. Please try again.",
        show_alert: true,
      });
    } catch (_) {}
  }
});

// =============== STARTUP LOG ===============

console.log("🚀 BIKA Store Bot is running with MongoDB (webhook mode)...");
console.log("Admins:", ADMIN_IDS.join(", ") || "(none configured)");
