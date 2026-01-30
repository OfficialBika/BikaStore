// ===================================
// BIKA STORE — FINAL SINGLE FILE BOT
// MULTI BUY + FLEX INPUT + ADMIN DASH
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
  ? process.env.ADMIN_CHAT_IDS.split(",").map(x => x.trim())
  : [];

if (!BOT_TOKEN || !MONGO_URI || !PUBLIC_URL) {
  console.error("❌ Missing ENV");
  process.exit(1);
}

// ===== DB =====
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error:", err));

// ===== ORDER MODEL =====
const OrderSchema = new mongoose.Schema({
  orderId: String,
  userId: String,
  username: String,
  game: String,
  gameId: String,
  serverId: String,
  items: [String],
  totalPrice: Number,
  paymentMethod: String,
  screenshot: String,
  status: { type: String, default: "PENDING" }
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);

// ===== BOT & SERVER =====
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
const app = express();
app.use(express.json());

const WEBHOOK_PATH = "/telegram/bika_webhook";
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ===== SESSION =====
const session = Object.create(null);

// ===== HELPERS =====
const isAdmin = id => ADMIN_IDS.includes(String(id));
const genOrderId = () => "BKS-" + Date.now().toString().slice(-6);

const autoDelete = (cid, mid, ms = 8000) =>
  setTimeout(() => bot.deleteMessage(cid, mid).catch(() => {}), ms);

// ===== PRICE TABLE =====
const PRICE = {
  "11": 800, "22": 1600, "33": 2350, "55": 3600, "86": 4800,
  "112": 8200, "172": 9800, "257": 14500, "343": 20000,
  "429": 25000, "514": 29900, "600": 34500, "706": 39900,
  "792": 44500, "878": 48500, "963": 53000, "1049": 59900,
  "1135": 63500, "1412": 77000, "1584": 88000, "1669": 94000,
  "2195": 118900, "3158": 172000, "3688": 202000,
  "wp1": 5900, "wp2": 11800, "wp3": 17700, "wp4": 23600, "wp5": 29500
};

const PRICE_LIST_TEXT =
`📋 *Mobile Legends PRICE LIST*
━━━━━━━━━━━━━━━
• 💎 11 — 800 MMK
• 💎 22 — 1,600 MMK
• 💎 33 — 2,350 MMK
• 💎 55 — 3,600 MMK
• 💎 86 — 4,800 MMK
• 💎 112 — 8,200 MMK
• 💎 172 — 9,800 MMK
• 💎 257 — 14,500 MMK
• 💎 343 — 20,000 MMK
• ✨ wp1 — 5,900 MMK
• ✨ wp2 — 11,800 MMK
• ✨ wp3 — 17,700 MMK
• ✨ wp4 — 23,600 MMK
• ✨ wp5 — 29,500 MMK`;

// ===== PARSERS =====
function parseGameId(text) {
  const m = text.match(/(\d+)\s*\(?\s*(\d+)?\s*\)?/);
  if (!m) return {};
  return { gameId: m[1], serverId: m[2] || "" };
}

function normalizeAmount(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .split("+")
    .map(x => x.replace(/^wp/, "wp"));
}

// ===== START =====
bot.onText(/\/start/, async msg => {
  const cid = msg.chat.id;
  session[cid] = {};

  await bot.sendMessage(
    cid,
    "🎮 *MLBB Game ID + Server ID ပို့ပါ*\nဥပမာ: `7822288393(2228)`",
    { parse_mode: "Markdown" }
  );
});

// ===== USER MESSAGE =====
bot.on("message", async msg => {
  if (!msg.text) return;
  if (msg.text.startsWith("/")) return;

  const cid = msg.chat.id;
  if (isAdmin(cid)) return;

  const s = session[cid] ||= {};

  // STEP 1: ID
  if (!s.gameId) {
    const { gameId, serverId } = parseGameId(msg.text);
    if (!gameId) return;

    s.gameId = gameId;
    s.serverId = serverId;

    const p = await bot.sendMessage(cid, PRICE_LIST_TEXT, { parse_mode: "Markdown" });
    s.priceMsgId = p.message_id;

    const m = await bot.sendMessage(cid, "💎 Amount ပို့ပါ (86+343 / wp1+wp2)");
    autoDelete(cid, m.message_id);
    return;
  }

  // STEP 2: AMOUNT
  if (!s.items) {
    const items = normalizeAmount(msg.text);
    let total = 0;

    for (const i of items) {
      if (!PRICE[i]) {
        const e = await bot.sendMessage(cid, "❌ Amount မမှန်ပါ");
        autoDelete(cid, e.message_id);
        return;
      }
      total += PRICE[i];
    }

    if (s.priceMsgId) {
      bot.deleteMessage(cid, s.priceMsgId).catch(() => {});
      delete s.priceMsgId;
    }

    s.items = items;
    s.totalPrice = total;

    return bot.sendMessage(cid,
      `💰 *Total:* ${total.toLocaleString()} MMK\n💳 Payment Method ရွေးပါ`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💜 KPay", callback_data: "PAY:KPay" }],
            [{ text: "💙 WavePay", callback_data: "PAY:WavePay" }]
          ]
        }
      }
    );
  }
});

// ===== CALLBACKS =====
bot.on("callback_query", async q => {
  const cid = q.message.chat.id;
  const data = q.data;

  // USER PAY
  if (data.startsWith("PAY:")) {
    const s = session[cid];
    if (!s) return;

    s.paymentMethod = data.split(":")[1];
    s.orderId = genOrderId();

    return bot.sendMessage(cid,
      `📸 Screenshot ပို့ပါ\n🆔 *${s.orderId}*`,
      { parse_mode: "Markdown" }
    );
  }

  // ADMIN ACTIONS
  if (/^(APPROVE|REJECT|CANCEL)_/.test(data)) {
    const [action, id] = data.split("_");
    const status =
      action === "APPROVE" ? "COMPLETED" :
      action === "REJECT" ? "REJECTED" : "CANCELED";

    const order = await Order.findOneAndUpdate(
      { orderId: id },
      { status },
      { new: true }
    );
    if (!order) return;

    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: cid, message_id: q.message.message_id }
    );

    await bot.sendMessage(
      order.userId,
      status === "COMPLETED" ? "✅ Order Approved" :
      status === "REJECTED" ? "❌ Order Rejected" :
      "🚫 Order Canceled"
    );
  }
});

// ===== PHOTO =====
bot.on("photo", async msg => {
  const cid = msg.chat.id;
  const s = session[cid];
  if (!s?.orderId) return;

  const order = await Order.create({
    orderId: s.orderId,
    userId: cid,
    username: msg.from.username,
    game: "MLBB",
    gameId: s.gameId,
    serverId: s.serverId,
    items: s.items,
    totalPrice: s.totalPrice,
    paymentMethod: s.paymentMethod,
    screenshot: msg.photo.at(-1).file_id
  });

  for (const a of ADMIN_IDS) {
    await bot.sendPhoto(a, order.screenshot, {
      caption:
        `📦 ORDER ${order.orderId}
ID: ${order.gameId} (${order.serverId})
Items: ${order.items.join("+")}
Total: ${order.totalPrice} MMK`,
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
          { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` },
          { text: "🚫 Cancel", callback_data: `CANCEL_${order.orderId}` }
        ]]
      }
    });
  }

  delete session[cid];
  bot.sendMessage(cid, "⏳ Admin စစ်ဆေးနေပါသည်...");
});

// ===== ADMIN DASHBOARD =====
bot.onText(/\/admin/, async msg => {
  if (!isAdmin(msg.chat.id)) return;

  const total = await Order.countDocuments();
  const pending = await Order.countDocuments({ status: "PENDING" });
  const completed = await Order.countDocuments({ status: "COMPLETED" });
  const rejected = await Order.countDocuments({ status: "REJECTED" });

  bot.sendMessage(
    msg.chat.id,
    `👑 *ADMIN DASHBOARD*

📦 Total: ${total}
⏳ Pending: ${pending}
✅ Completed: ${completed}
❌ Rejected: ${rejected}`,
    { parse_mode: "Markdown" }
  );
});

// ===== SERVER =====
app.get("/", (_, res) => res.send("🚀 Bika Store Bot Running"));
app.listen(PORT, async () => {
  try {
    await bot.setWebHook(`${PUBLIC_URL}${WEBHOOK_PATH}`);
    console.log("✅ Webhook Ready");
  } catch (e) {
    console.error("❌ Webhook Error:", e);
  }
});
