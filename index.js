// ===================================
// BIKA STORE — PRODUCTION BOT (v2)
// MLBB + PUBG
// Order Preview + Confirm/Cancel
// Receipt submit -> Admin Approve/Reject (edit captions)
// Auto-delete old bot prompt messages (except editable important ones)
// Webhook on Render + MongoDB
// ===================================

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PUBLIC_URL = process.env.PUBLIC_URL;
const PORT = process.env.PORT || 3000;

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

// ===== MODELS =====
const OrderSchema = new mongoose.Schema({
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

  // For editing messages on approve/reject
  userOrderMessageId: Number, // message id in user chat (photo with caption)
  adminMessageId: Number,     // message id in admin chat (photo with caption)
  adminChatId: String         // which admin received (first admin we sent to or group chat id if you set)
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);

// Counter for sequential order numbers
const Counter = mongoose.model("Counter", new mongoose.Schema({
  name: { type: String, unique: true },
  seq: { type: Number, default: 0 }
}));

async function nextOrderNo() {
  const c = await Counter.findOneAndUpdate(
    { name: "order" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return c.seq;
}

// ===== PRICE TABLES =====
// Normalize keys to lowercase (we will parse user input -> lowercase)
const MLBB_PRICES = {
  "11": 800,
  "22": 1600,
  "33": 2350,
  "55": 3600,
  "112": 8200,
  "86": 4800,
  "172": 9800,
  "257": 14500,
  "343": 20000,
  "429": 25000,
  "514": 29900,
  "600": 34500,
  "706": 39900,
  "792": 44500,
  "878": 48500,
  "963": 53000,
  "1049": 59900,
  "1135": 63500,
  "1412": 77000,
  "1584": 88000,
  "1669": 94000,
  "2195": 118900,
  "3158": 172000,
  "3688": 202000,
  "4390": 237000,
  "5100": 280000,
  "5532": 300000,
  "6055": 330000,

  "wp1": 5900,
  "wp2": 11800,
  "wp3": 17700,
  "wp4": 23600,
  "wp5": 29500,
};

const PUBG_PRICES = {
  "60": 4500,
  "325": 19500,
  "660": 38000,
  "1800": 90500,
  "3850": 185000,
  "8100": 363000,
  "prime1m": 4500,
  "primeplus": 39500,
};

function formatMMK(n) {
  try {
    return Number(n).toLocaleString("en-US");
  } catch {
    return String(n);
  }
}

// ===== SESSION (in-memory) =====
// NOTE: Render restart => session reset. Orders are safe in DB.
// If you want "resume after restart", we can store sessions in DB later.
const session = {}; // { [chatId]: { step, game, gameId, serverId, items, totalPrice, ... } }

// ===== HELPERS =====
const isAdmin = (id) => ADMIN_IDS.includes(String(id));

function mentionUserHTML(user) {
  const name = user.first_name || user.username || "User";
  return `<a href="tg://user?id=${user.id}">${escapeHTML(name)}</a>`;
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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

function buildPriceListText(game) {
  if (game === "MLBB") {
    // Keep it readable (not too huge). You can shorten anytime.
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

// Delete old bot prompt messages (best-effort)
async function deleteIfPossible(chatId, messageId) {
  if (!chatId || !messageId) return;
  try { await bot.deleteMessage(chatId, messageId); } catch (_) {}
}

// In many steps we want to delete the previous bot prompt and send a new one.
async function sendPrompt(chatId, s, html, extra = {}) {
  // Do NOT delete important messages that we later edit (preview, userOrder)
  if (s?.lastPromptMessageId) {
    await deleteIfPossible(chatId, s.lastPromptMessageId);
  }
  const sent = await bot.sendMessage(chatId, html, { parse_mode: "HTML", ...extra });
  s.lastPromptMessageId = sent.message_id;
  return sent;
}

// ===== INPUT PARSERS =====

// Parse MLBB ID + SV variants:
// 486679424 (2463) / 486679424 2463 / 486679424(2463)
function parseGameIdAndServer(text) {
  const t = String(text || "").trim();
  // pick first digits as id and optional second digits as server
  const m = t.match(/(\d{5,})(?:\D+(\d{2,}))?/); // id >= 5 digits, server >= 2 digits
  if (!m) return null;
  return { gameId: m[1], serverId: m[2] || "" };
}

// Parse amount line: allow plus/space, case-insensitive, wp1/wp 1/wp 1 +343+ wP2 etc
function parseItems(text) {
  let t = String(text || "").trim();
  if (!t) return [];

  // normalize: wp 1 -> wp1
  t = t.replace(/wp\s*(\d)/gi, "wp$1");
  // replace + with space
  t = t.replace(/[+]/g, " ");
  // remove weird emojis/symbols except letters/digits/space
  t = t.replace(/[^\w\s]/g, " "); // will remove 🤩 etc
  t = t.toLowerCase();

  const parts = t.split(/\s+/).map(x => x.trim()).filter(Boolean);

  // Also handle "wp" "1" separated by space in some cases
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
    if (!priceMap[key]) {
      bad.push(it);
    } else {
      normalized.push(key);
      total += priceMap[key];
    }
  }

  if (bad.length) {
    return {
      ok: false,
      error: `ဤ Amount များကို Price List ထဲမှာ မတွေ့ပါ: ${bad.join(", ")}`,
      total: 0,
      normalizedItems: []
    };
  }

  // Pretty display: keep "wp1" as "wp1", others as digits
  const pretty = normalized.map(x => x);
  return { ok: true, total, normalizedItems: pretty };
}

// ===== /START =====
bot.onText(/\/start/, async (msg) => {
  const cid = msg.chat.id;
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

// ===== CALLBACK HANDLER =====
bot.on("callback_query", async (q) => {
  const cid = q.message.chat.id;
  const data = q.data;
  const s = session[cid] || (session[cid] = {});

  // Always answer callback to avoid "loading..."
  try { await bot.answerCallbackQuery(q.id); } catch (_) {}

  // ===== GAME SELECT =====
  if (data === "GAME_MLBB" || data === "GAME_PUBG") {
    s.game = data === "GAME_MLBB" ? "MLBB" : "PUBG";
    s.step = "WAIT_ID";
    s.userMentionHTML = s.userMentionHTML || mentionUserHTML(q.from);

    const askId =
`🆔 <b>${escapeHTML(s.game)}</b> ID + SV ID ပို့ပါ
ဥပမာ: <b>486679424 (2463)</b> / <b>486679424 2463</b> / <b>486679424(2463)</b>`;

    await sendPrompt(cid, s, askId);
    return;
  }

  // ===== CONFIRM / CANCEL (Order Preview) =====
  if (data === "ORDER_CANCEL") {
    // delete preview message (the message where buttons exist)
    if (s.previewMessageId) {
      await deleteIfPossible(cid, s.previewMessageId);
    }
    // also delete last prompt if any (not necessary but clean)
    if (s.lastPromptMessageId) {
      await deleteIfPossible(cid, s.lastPromptMessageId);
      s.lastPromptMessageId = null;
    }

    // Send cancel notice (this one can remain; next prompt will auto-delete it)
    const sent = await bot.sendMessage(cid, "✅ သင့်order ရုတ်သိမ်းလိုက်ပါပြီ။", { parse_mode: "HTML" });
    s.lastPromptMessageId = sent.message_id;

    // reset session
    delete session[cid];
    return;
  }

  if (data === "ORDER_CONFIRM") {
    if (!s.orderId) return;

    s.step = "PAY_SELECT";
    const payText =
`💳 Payment နည်းလမ်း ရွေးချယ်ပေးပါ 👇`;

    await sendPrompt(cid, s, payText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "KPay", callback_data: "PAY_KPAY" }],
          [{ text: "WavePay", callback_data: "PAY_WAVEPAY" }]
        ]
      }
    });
    return;
  }

  // ===== PAYMENT SELECT =====
  if (data === "PAY_KPAY" || data === "PAY_WAVEPAY") {
    if (!s.orderId) return;

    s.paymentMethod = data === "PAY_KPAY" ? "KPAY" : "WAVEPAY";
    s.step = "WAIT_RECEIPT";

    const payInfo = s.paymentMethod === "KPAY"
      ? `KPay: <b>Name</b> - Shine Htet Aung\n<b>Phone</b> - 09264202637`
      : `WavePay: <b>Name</b> - Shine Htet Aung\n<b>Phone</b> - 09264202637`;

    const askReceipt =
`${payInfo}

📸 ငွေလွှဲပြေစာ <b>ဓာတ်ပုံ</b> ပို့ပေးပါ
🆔 Order ID: <b>${escapeHTML(s.orderId)}</b>`;

    await sendPrompt(cid, s, askReceipt);
    return;
  }

  // ===== ADMIN APPROVE / REJECT =====
  if (data.startsWith("APPROVE_") || data.startsWith("REJECT_")) {
    if (!isAdmin(cid)) {
      try { await bot.answerCallbackQuery(q.id, { text: "Not allowed" }); } catch (_) {}
      return;
    }

    const orderId = data.split("_")[1];
    const approve = data.startsWith("APPROVE_");
    const newStatus = approve ? "COMPLETED" : "REJECTED";

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: newStatus },
      { new: true }
    );

    if (!order) return;

    // Build captions (keep preview same; only replace the headline text)
    const headline = approve ? "✅ Order Complete" : "❌ Order ပယ်ဖျက်ပြီးပါပြီ";
    const adminCaption =
`<b>${headline}</b>

${buildOrderPreviewHTML({
  userMentionHTML: order.username
    ? `@${escapeHTML(order.username)}`
    : `<a href="tg://user?id=${escapeHTML(order.userId)}">${escapeHTML(order.firstName || "User")}</a>`,
  orderId: order.orderId,
  orderDateText: order.orderDateText,
  game: order.game,
  gameId: order.gameId,
  serverId: order.serverId,
  items: order.items,
  totalPrice: order.totalPrice
})}`;

    // Edit admin message caption (do NOT delete rest)
    try {
      await bot.editMessageCaption(adminCaption, {
        chat_id: order.adminChatId,
        message_id: order.adminMessageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] } // remove buttons to prevent double-tap
      });
    } catch (_) {
      // ignore
    }

    // Edit user message caption: only change the last line text (we keep everything in one caption)
    const userHeadline = approve
      ? "🎉 သင့် Order အောင်မြင်စွာပြီးဆုံးသွားပါပြီ။ ဝယ်ယူအားပေးမူ့အတွက် ကျေးဇူးအထူးပါ။"
      : "❌ သင့်အော်ဒါကို Owner မှ ပယ်ချလိုက်ပါသည်။ အမှားအယွင်းရှိပါက Bot Owner @Official_Bika ထံသို့ ဆက်သွယ်ပါ။";

    const userCaption =
`<b>${userHeadline}</b>

${buildOrderPreviewHTML({
  userMentionHTML: order.username
    ? `@${escapeHTML(order.username)}`
    : `<a href="tg://user?id=${escapeHTML(order.userId)}">${escapeHTML(order.firstName || "User")}</a>`,
  orderId: order.orderId,
  orderDateText: order.orderDateText,
  game: order.game,
  gameId: order.gameId,
  serverId: order.serverId,
  items: order.items,
  totalPrice: order.totalPrice
})}`;

    try {
      await bot.editMessageCaption(userCaption, {
        chat_id: order.userId,
        message_id: order.userOrderMessageId,
        parse_mode: "HTML",
      });
    } catch (_) {
      // ignore
    }

    return;
  }
});

// ===== MESSAGE FLOW (TEXT) =====
bot.on("message", async (msg) => {
  const cid = msg.chat.id;
  if (isAdmin(cid)) return;

  // ignore commands (handled by /start)
  if (msg.text && msg.text.startsWith("/")) return;

  const s = session[cid] || (session[cid] = {});
  s.userMentionHTML = s.userMentionHTML || mentionUserHTML(msg.from);

  // Step must exist
  if (!s.step) {
    s.step = "GAME_SELECT";
    await sendPrompt(cid, s, "ကျေးဇူးပြု၍ /start နှိပ်ပြီး စတင်ပါ။");
    return;
  }

  // ===== WAIT_ID =====
  if (s.step === "WAIT_ID") {
    if (!msg.text) return;

    const parsed = parseGameIdAndServer(msg.text);
    if (!parsed) {
      await sendPrompt(cid, s, "⚠️ ID ပုံစံမမှန်ပါ။ ဥပမာ: <b>486679424 (2463)</b>");
      return;
    }

    s.gameId = parsed.gameId;
    s.serverId = parsed.serverId;

    s.step = "WAIT_ITEMS";
    const priceList = buildPriceListText(s.game);

    const askItems =
`${priceList}

🛒 ဝယ်ယူမဲ့ Amount ကို ရိုက်ထည့်ပါ
(single လဲရ / အများလဲရ, space/ + နဲ့ ခြားလို့ရ)

ဥပမာ:
<b>343</b>
<b>wp1 + 343 + wp2 + wp3</b>`;

    await sendPrompt(cid, s, askItems);
    return;
  }

  // ===== WAIT_ITEMS =====
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

    // Create sequential order id now (preview step)
    const no = await nextOrderNo();
    s.orderNo = no;
    s.orderId = `BKS-${String(no).padStart(7, "0")}`; // BKS-0000001 style (7 digits)
    s.orderDateText = nowDateText();

    s.step = "PREVIEW";

    // delete last prompt (ask items), then send preview with buttons (important -> don't auto-delete)
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

  // Other steps: ignore random text
});

// ===== PHOTO (RECEIPT) =====
bot.on("photo", async (msg) => {
  const cid = msg.chat.id;
  if (isAdmin(cid)) return;

  const s = session[cid];
  if (!s || s.step !== "WAIT_RECEIPT" || !s.orderId) return;

  const fileId = msg.photo?.at(-1)?.file_id;
  if (!fileId) return;

  // Remove last prompt asking receipt (auto-delete)
  if (s.lastPromptMessageId) {
    await deleteIfPossible(cid, s.lastPromptMessageId);
    s.lastPromptMessageId = null;
  }

  const preview = buildOrderPreviewHTML(s);
  const pendingLine = "⏳ သင့်အော်ဒါကို Owner ထံ တင်ပြပြီးပါပြီ။ ကျေးဇူးပြု၍ ခေတ္တခန စောင့်ပေးပါ။";

  // Send to user: receipt + full preview + pending text (IMPORTANT message - will be edited on approve/reject)
  const userCaption =
`<b>${pendingLine}</b>

${preview}`;

  const userSent = await bot.sendPhoto(cid, fileId, {
    caption: userCaption,
    parse_mode: "HTML",
  });

  // Create order in DB
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

  // Send to each admin: receipt + "Order အသစ်ရောက်ရှိပါတယ်" + full preview + buttons
  const adminHeadline = "🧾 Order အသစ်ရောက်ရှိပါတယ်";
  const adminPreview = buildOrderPreviewHTML({
    ...s,
    // For admin preview: mention user by @username if available
    userMentionHTML: msg.from.username ? `@${escapeHTML(msg.from.username)}` : mentionUserHTML(msg.from),
  });

  const adminCaption =
`<b>${adminHeadline}</b>

${adminPreview}`;

  // If you want to send only to first admin (owner) change loop -> only ADMIN_IDS[0]
  for (const adminId of ADMIN_IDS) {
    try {
      const adminSent = await bot.sendPhoto(adminId, fileId, {
        caption: adminCaption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
            { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
          ]]
        }
      });

      // Save the first admin message id for editing later (or last one)
      // If you use admin group chat id, set ADMIN_CHAT_IDS to that group id only.
      if (!order.adminMessageId) {
        order.adminMessageId = adminSent.message_id;
        order.adminChatId = String(adminId);
        await order.save();
      }
    } catch (e) {
      console.error("❌ Send to admin failed:", adminId, e?.message || e);
    }
  }

  // Clean session (user flow finished)
  delete session[cid];
});

// ===== SERVER =====
app.get("/", (_, res) => res.send("Bika Store Bot Running"));
app.listen(PORT, async () => {
  await bot.setWebHook(`${PUBLIC_URL}${WEBHOOK_PATH}`);
  console.log("✅ Bot Ready");
});
