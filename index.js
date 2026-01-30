// ===================================
// BIKA STORE — FINAL PRODUCTION BOT
// ADMIN APPROVE/REJECT WITH RECEIPT UI
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
  .catch(console.error);

// ===== MODEL =====
const Order = mongoose.model("Order", new mongoose.Schema({
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
}, { timestamps: true }));

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
const isAdmin = id => ADMIN_IDS.includes(String(id));
const genOrderId = () => "BK" + Date.now();
const formatOrder = o => (
`📦 *NEW ORDER*

🆔 *Order ID:* ${o.orderId}
👤 *User:* @${o.username || "unknown"}
🎮 *Game:* ${o.game}
🎯 *ID:* ${o.gameId}${o.serverId ? ` (${o.serverId})` : ""}
💎 *Amount:* ${o.items.join(" + ")}
💰 *Total:* ${o.totalPrice.toLocaleString()} MMK
💳 *Payment:* ${o.paymentMethod}`
);

// ===== /START =====
bot.onText(/\/start/, msg => {
  const cid = msg.chat.id;
  session[cid] = {};

  bot.sendMessage(cid,
`✨ *BikaStore မှ လှိုက်လှဲစွာ ကြိုဆိုပါတယ်* ✨

ဝယ်ယူချင်တဲ့ Game ကို ရွေးချယ်ပေးပါ 👇`,
{
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{ text: "💎 MLBB Diamonds", callback_data: "GAME_MLBB" }]
    ]
  }
});
});

// ===== CALLBACK =====
bot.on("callback_query", async q => {
  const cid = q.message.chat.id;
  const data = q.data;

  // ===== GAME SELECT =====
  if (data === "GAME_MLBB") {
    session[cid] = { game: "MLBB" };
    return bot.sendMessage(cid, "🆔 Game ID + Server ID ပို့ပါ\nဥပမာ: 22333383(3339)");
  }

  // ===== PAY =====
  if (data.startsWith("PAY_")) {
    const s = session[cid];
    s.paymentMethod = data.replace("PAY_", "");
    s.orderId = genOrderId();
    return bot.sendMessage(cid, `📸 Payment Screenshot ပို့ပါ\n🆔 ${s.orderId}`);
  }

  // ===== ADMIN APPROVE / REJECT =====
  if (data.startsWith("APPROVE_") || data.startsWith("REJECT_")) {
    const orderId = data.split("_")[1];
    const status = data.startsWith("APPROVE") ? "COMPLETED" : "REJECTED";

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );
    if (!order) return;

    // remove buttons
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: cid, message_id: q.message.message_id }
    );

    const caption =
`${formatOrder(order)}

${status === "COMPLETED" ? "✅ *ORDER COMPLETED*" : "❌ *ORDER REJECTED*"}`;

    // admin confirm
    await bot.sendPhoto(cid, order.screenshot, {
      caption,
      parse_mode: "Markdown"
    });

    // user notify
    await bot.sendPhoto(order.userId, order.screenshot, {
      caption:
`${formatOrder(order)}

${status === "COMPLETED"
? "🎉 *သင့် Order အောင်မြင်စွာပြီးဆုံးပါပြီ*"
: "❌ *Order ပယ်ဖျက်လိုက်ပါသည်*\n\nတစ်စုံတစ်ခု အမှားအယွင်းရှိပါက @Official_Bika ထံ ဆက်သွယ်ပါ"}`,
      parse_mode: "Markdown"
    });
  }
});

// ===== MESSAGE FLOW =====
bot.on("message", async msg => {
  if (!msg.text) return;
  const cid = msg.chat.id;
  if (isAdmin(cid)) return;

  const s = session[cid];
  if (!s?.gameId) {
    const m = msg.text.match(/(\d+)(?:\D+(\d+))?/);
    if (!m) return;
    s.gameId = m[1];
    s.serverId = m[2] || "";
    s.items = ["86"];
    s.totalPrice = 4800;

    return bot.sendMessage(cid,
`💰 Total: 4,800 MMK`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: "KPay", callback_data: "PAY_KPAY" }],
      [{ text: "WavePay", callback_data: "PAY_WAVEPAY" }]
    ]
  }
});
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
    game: s.game,
    gameId: s.gameId,
    serverId: s.serverId,
    items: s.items,
    totalPrice: s.totalPrice,
    paymentMethod: s.paymentMethod,
    screenshot: msg.photo.at(-1).file_id
  });

  for (const admin of ADMIN_IDS) {
    await bot.sendPhoto(admin, order.screenshot, {
      caption: formatOrder(order),
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
          { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
        ]]
      }
    });
  }

  delete session[cid];
  bot.sendMessage(cid, "⏳ Admin စစ်ဆေးနေပါသည်...");
});

// ===== SERVER =====
app.get("/", (_, res) => res.send("Bika Store Bot Running"));
app.listen(PORT, async () => {
  await bot.setWebHook(`${PUBLIC_URL}${WEBHOOK_PATH}`);
  console.log("✅ Bot Ready");
});
