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
  .catch(err => console.error("❌ Mongo Error", err));

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
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

const WEBHOOK_PATH = "/telegram/bika_webhook";
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ===== SESSION =====
const session = {};

// ===== HELPERS =====
const autoDelete = (cid, mid, ms = 8000) =>
  setTimeout(() => bot.deleteMessage(cid, mid).catch(() => {}), ms);

const genOrderId = () => "BKS-" + Date.now().toString().slice(-6);
const isAdmin = id => ADMIN_IDS.includes(String(id));

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

// ===== NORMALIZE INPUT =====
function normalizeAmount(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .split("+")
    .map(x => x.replace("wp", "wp"));
}

function parseGameId(text) {
  const match = text.match(/(\d+)(?:\D+(\d+))?/);
  return { gameId: match?.[1], serverId: match?.[2] || "" };
}

// ===== START =====
bot.onText(/\/start/, msg => {
  session[msg.chat.id] = {};
  bot.sendMessage(msg.chat.id, "🎮 MLBB Game ID + Server ID ပို့ပါ\nဥပမာ: 7822288393(2228)");
});

// ===== USER FLOW =====
bot.on("message", async msg => {
  if (!msg.text) return;
  const chatId = msg.chat.id;
  if (isAdmin(chatId)) return;

  const s = session[chatId] ||= {};

  // STEP 1 ID
  if (!s.gameId) {
    const { gameId, serverId } = parseGameId(msg.text);
    if (!gameId) return;
    s.gameId = gameId;
    s.serverId = serverId;
    const m = await bot.sendMessage(chatId, "💎 Amount ပို့ပါ (86+343 / wp1+wp2)");
    return autoDelete(chatId, m.message_id);
  }

  // STEP 2 Amount
  if (!s.items) {
    const items = normalizeAmount(msg.text);
    let total = 0;

    for (const i of items) {
      if (!PRICE[i]) {
        const m = await bot.sendMessage(chatId, "❌ Invalid Amount");
        autoDelete(chatId, m.message_id);
        return;
      }
      total += PRICE[i];
    }

    s.items = items;
    s.totalPrice = total;

    const m = await bot.sendMessage(chatId,
      `💰 Total: ${total.toLocaleString()} MMK\n💳 Payment Method`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "KPay", callback_data: "PAY:KPay" }],
            [{ text: "WavePay", callback_data: "PAY:WavePay" }]
          ]
        }
      }
    );
    autoDelete(chatId, m.message_id, 10000);
  }
});

// ===== CALLBACKS =====
bot.on("callback_query", async q => {
  const cid = q.message.chat.id;
  const data = q.data;

  // USER PAY
  if (data.startsWith("PAY:")) {
    const s = session[cid];
    s.paymentMethod = data.split(":")[1];
    s.orderId = genOrderId();
    return bot.sendMessage(cid, `📸 Screenshot ပို့ပါ\n🆔 ${s.orderId}`);
  }

  // ADMIN ACTIONS
  if (data.startsWith("APPROVE_") || data.startsWith("REJECT_") || data.startsWith("CANCEL_")) {
    const id = data.split("_")[1];
    const status =
      data.startsWith("APPROVE") ? "COMPLETED" :
      data.startsWith("REJECT") ? "REJECTED" : "CANCELED";

    const order = await Order.findOneAndUpdate({ orderId: id }, { status }, { new: true });
    if (!order) return;

    await bot.sendMessage(order.userId,
      status === "COMPLETED" ? "✅ Order Approved" :
      status === "REJECTED" ? "❌ Order Rejected" :
      "🚫 Order Canceled"
    );

    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: cid, message_id: q.message.message_id }
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
        `📦 ORDER ${order.orderId}\n` +
        `ID: ${order.gameId} (${order.serverId})\n` +
        `Items: ${order.items.join("+")}\n` +
        `Total: ${order.totalPrice} MMK`,
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

// ===== SERVER =====
app.get("/", (_, res) => res.send("🚀 Bika Store Bot Running"));
app.listen(PORT, async () => {
  await bot.setWebHook(`${PUBLIC_URL}${WEBHOOK_PATH}`);
  console.log("✅ Webhook Ready");
});
