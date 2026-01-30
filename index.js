// ===================================
// BIKA STORE — SINGLE FILE FINAL BOT
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
  .catch(err => console.error(err));

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
const genOrderId = () => "BKS-" + Date.now().toString().slice(-6);
const autoDelete = (cid, mid, ms = 8000) =>
  setTimeout(() => bot.deleteMessage(cid, mid).catch(()=>{}), ms);

// ===== PRICE TABLE =====
const PRICE = {
  "11":800,"22":1600,"33":2350,"55":3600,"86":4800,
  "112":8200,"172":9800,"257":14500,"343":20000,
  "429":25000,"514":29900,"600":34500,"706":39900,
  "792":44500,"878":48500,"963":53000,"1049":59900,
  "1135":63500,"1412":77000,"1584":88000,"1669":94000,
  "2195":118900,"3158":172000,"3688":202000,
  "wp1":5900,"wp2":11800,"wp3":17700,"wp4":23600,"wp5":29500
};

const PRICE_LIST_TEXT = `📋 *Mobile Legends PRICE LIST*
━━━━━━━━━━━━━━━
💎 86 — 4,800 MMK
💎 343 — 20,000 MMK
✨ wp1 — 5,900 MMK
✨ wp2 — 11,800 MMK
( Multi-buy allowed )`;

// ===== NORMALIZE =====
const normalizeAmount = txt =>
  txt.toLowerCase().replace(/\s+/g,"").split("+");

const parseGameId = txt => {
  const m = txt.match(/(\d+)(?:\D+(\d+))?/);
  return { gameId: m?.[1], serverId: m?.[2] || "" };
};

// ===== /START =====
bot.onText(/\/start/, msg => {
  const cid = msg.chat.id;
  const name = msg.from.first_name || "Customer";
  session[cid] = {};

  bot.sendMessage(cid,
`✨ *BikaStore မှ လှိုက်လှဲစွာ ကြိုဆိုပါတယ်* ✨

👤 *${name}*
ဝယ်ယူချင်တဲ့ Game ကို ရွေးချယ်ပေးပါ 👇`,
  {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text:"💎 MLBB Diamonds", callback_data:"GAME_MLBB" }],
        [{ text:"🔥 PUBG UC", callback_data:"GAME_PUBG" }],
        [{ text:"♟ Magic Chess", callback_data:"GAME_MAGIC" }],
        [{ text:"⭐ Telegram Premium", callback_data:"GAME_TGPREMIUM" }],
        [{ text:"🌟 Telegram Star", callback_data:"GAME_TGSTAR" }]
      ]
    }
  });
});

// ===== MESSAGE FLOW =====
bot.on("message", async msg => {
  if (!msg.text) return;
  const cid = msg.chat.id;
  if (isAdmin(cid)) return;

  const s = session[cid];
  if (!s || !s.game) return;

  if (!s.gameId && (s.game==="MLBB"||s.game==="MAGIC")) {
    const { gameId, serverId } = parseGameId(msg.text);
    if (!gameId) return;
    s.gameId = gameId;
    s.serverId = serverId;

    const p = await bot.sendMessage(cid, PRICE_LIST_TEXT, { parse_mode:"Markdown" });
    s.priceMsgId = p.message_id;
    return bot.sendMessage(cid,"💎 Amount ပို့ပါ (86+343 / wp1+wp2)");
  }

  if (!s.items && s.gameId) {
    const items = normalizeAmount(msg.text);
    let total = 0;
    for (const i of items) {
      if (!PRICE[i]) return;
      total += PRICE[i];
    }

    s.items = items;
    s.totalPrice = total;

    bot.deleteMessage(cid, s.priceMsgId).catch(()=>{});

    return bot.sendMessage(cid,
      `💰 Total: ${total.toLocaleString()} MMK`,
      {
        reply_markup:{
          inline_keyboard:[
            [{ text:"KPay", callback_data:"PAY_KPAY" }],
            [{ text:"WavePay", callback_data:"PAY_WAVE" }]
          ]
        }
      }
    );
  }
});

// ===== CALLBACK =====
bot.on("callback_query", async q => {
  const cid = q.message.chat.id;
  const data = q.data;
  const s = session[cid];

  if (data.startsWith("GAME_")) {
    s.game = data.replace("GAME_","");
    await bot.editMessageReplyMarkup({ inline_keyboard:[] },
      { chat_id:cid, message_id:q.message.message_id });

    return bot.sendMessage(cid,"🆔 ID ပို့ပါ");
  }

  if (data.startsWith("PAY_")) {
    s.paymentMethod = data.replace("PAY_","");
    s.orderId = genOrderId();
    return bot.sendMessage(cid,`📸 Screenshot ပို့ပါ\n🆔 ${s.orderId}`);
  }

  if (data.startsWith("APPROVE_")||data.startsWith("REJECT_")||data.startsWith("CANCEL_")) {
    const id = data.split("_")[1];
    const status =
      data.startsWith("APPROVE")?"COMPLETED":
      data.startsWith("REJECT")?"REJECTED":"CANCELED";

    const order = await Order.findOneAndUpdate({ orderId:id },{ status });
    if (!order) return;

    bot.sendMessage(order.userId,`📦 Order ${status}`);
    bot.editMessageReplyMarkup({ inline_keyboard:[] },
      { chat_id:cid, message_id:q.message.message_id });
  }
});

// ===== PHOTO =====
bot.on("photo", async msg => {
  const cid = msg.chat.id;
  const s = session[cid];
  if (!s?.orderId) return;

  const order = await Order.create({
    orderId:s.orderId,
    userId:cid,
    game:s.game,
    gameId:s.gameId,
    serverId:s.serverId,
    items:s.items,
    totalPrice:s.totalPrice,
    paymentMethod:s.paymentMethod,
    screenshot:msg.photo.at(-1).file_id
  });

  for (const a of ADMIN_IDS) {
    bot.sendPhoto(a, order.screenshot, {
      caption:`📦 ${order.orderId}\n${order.items.join("+")}\n${order.totalPrice} MMK`,
      reply_markup:{ inline_keyboard:[[
        { text:"✅ Approve", callback_data:`APPROVE_${order.orderId}` },
        { text:"❌ Reject", callback_data:`REJECT_${order.orderId}` },
        { text:"🚫 Cancel", callback_data:`CANCEL_${order.orderId}` }
      ]]}
    });
  }

  delete session[cid];
  bot.sendMessage(cid,"⏳ Admin စစ်ဆေးနေပါသည်...");
});

// ===== SERVER =====
app.get("/",(_,res)=>res.send("Bika Store Bot Running"));
app.listen(PORT, async ()=>{
  await bot.setWebHook(`${PUBLIC_URL}${WEBHOOK_PATH}`);
  console.log("✅ Bot Ready");
});
