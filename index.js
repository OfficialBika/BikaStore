// ===============================
// IMPORTS & SETUP (BIKA CODE OFFICIAL FINAL)
// ===============================
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_CHAT_IDS;
const PORT = process.env.PORT || 3000;

const app = express();

// ===============================
// DATABASE
// ===============================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(console.error);

// ===============================
// PRICE LIST (UNCHANGED)
// ===============================
const PRICES = {
  MLBB: {
    "wp":5900,"wp2":11800,"wp3":17700,"wp4":23600,"wp5":29500,
    "86":4800,"172":9800,"257":14500,"343":20000,"429":25000,
    "514":29900,"600":34500,"706":39900,"792":44500,
    "878":48500,"963":53000,"1049":59900
  },
  PUBG: {
    "60":4500,"325":19500,"660":38000,
    "1800":90500,"3850":185000,"8100":363000
  }
};

// ===============================
// PAYMENT ACCOUNTS
// ===============================
const PAYMENTS = {
  KPay: "💜 KPay\n09264202637\nName - Shine Htet Aung",
  WavePay: "💙 WavePay\n09264202637\nName - Shine Htet Aung"
};

// ===============================
// HELPERS
// ===============================
const isAdmin = id => id.toString() === ADMIN_ID;

function generateOrderId() {
  const d = new Date();
  const ymd = d.toISOString().slice(0,10).replace(/-/g,"");
  const r = Math.floor(1000 + Math.random() * 9000);
  return `BKS-${ymd}-${r}`;
}

const priceText = p =>
  Object.entries(PRICES[p])
    .map(([k,v]) => `• ${k} = ${v.toLocaleString()} MMK`)
    .join("\n");

// ===============================
// SCHEMAS
// ===============================
const OrderSchema = new mongoose.Schema({
  orderId: String,
  userId: String,
  username: String,
  product: String,
  gameId: String,
  serverId: String,
  items: [{ amount: String, price: Number }],
  totalPrice: Number,
  paymentMethod: String,
  paymentPhoto: String,
  adminMsgId: Number,
  userMsgId: Number,
  waitMsgId: Number,
  status: { type: String, default: "PENDING" },
  approvedAt: Date,
  expireAt: Date
});
OrderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
const Order = mongoose.model("Order", OrderSchema);

const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  username: String
}));

// ===============================
// TEMP SESSION
// ===============================
const temp = {};

// ===============================
// /start
// ===============================
bot.onText(/\/start/, async msg => {
  const id = msg.chat.id.toString();

  await User.updateOne(
    { userId: id },
    { userId: id, username: msg.from.username || msg.from.first_name },
    { upsert: true }
  );

  bot.sendMessage(id,"🛒 *Bika Store*\n\nGame ကိုရွေးပါ 👇",{
    parse_mode:"Markdown",
    reply_markup:{ inline_keyboard:[
      [{ text:"💎 MLBB Diamonds", callback_data:"MLBB" }],
      [{ text:"🎯 PUBG UC", callback_data:"PUBG" }]
    ]}
  });
});

// ===============================
// CALLBACK QUERY
// ===============================
bot.on("callback_query", async q => {
  const chatId = q.message.chat.id;
  const d = q.data;
  const t = temp[chatId];

  // GAME SELECT
  if (d === "MLBB" || d === "PUBG") {
    temp[chatId] = { product:d, step:"GAME", items:[], msgs:[] };

    const p1 = await bot.sendMessage(chatId,
`📋 *${d} Price List*\n\n${priceText(d)}`,
      { parse_mode:"Markdown" });

    const p2 = await bot.sendMessage(chatId,
d==="MLBB"
? "🆔 *Game ID + Server ID ကို တစ်ခါတည်းထည့်ပါ*\n\nဥပမာ:\n11111111 2222\n11111111(2222)"
: "🆔 *PUBG Game ID ကို ထည့်ပါ*",
      { parse_mode:"Markdown" });

    temp[chatId].msgs.push(p1.message_id,p2.message_id);
    return;
  }

  // CONFIRM ORDER
  if (d === "CONFIRM") {
    await bot.deleteMessage(chatId, t.previewMsgId);
    t.step = "PAY_METHOD";
    const m = await bot.sendMessage(chatId,"💳 Payment Method ရွေးပါ",{
      reply_markup:{ inline_keyboard:[
        [{ text:"💜 KPay", callback_data:"PAY_KPAY" }],
        [{ text:"💙 WavePay", callback_data:"PAY_WAVEPAY" }]
      ]}
    });
    t.msgs.push(m.message_id);
    return;
  }

  // PAYMENT METHOD
  if (d.startsWith("PAY_")) {
    t.paymentMethod = d.replace("PAY_","");
    t.step = "PAYMENT";
    const m = await bot.sendMessage(chatId,
`${PAYMENTS[t.paymentMethod]}\n\n📸 ငွေလွှဲ ပြေစာ ပို့ပေးပါ`);
    t.msgs.push(m.message_id);
    return;
  }

  // ADMIN APPROVE
  if (d.startsWith("APPROVE_") && isAdmin(q.from.id)) {
    const order = await Order.findById(d.split("_")[1]);
    if (!order) return;

    order.status="COMPLETED";
    order.approvedAt=new Date();
    await order.save();

    await bot.deleteMessage(order.userId, order.waitMsgId);

    await bot.editMessageCaption(
`📦 ORDER COMPLETED
━━━━━━━━━━━━━━━
🎮 ${order.product}
🆔 ${order.gameId} (${order.serverId})
💰 ${order.totalPrice.toLocaleString()} MMK

✅ သင့် Order လုပ်ဆောင်မှု ပြီးမြောက်သွားပါပြီ`,
      { chat_id: order.userId, message_id: order.userMsgId }
    );

    await bot.sendMessage(order.userId,
"🙏 ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါတယ်");

    await bot.editMessageCaption("✅ ORDER COMPLETED",
      { chat_id:ADMIN_ID, message_id:order.adminMsgId });
  }

  // ADMIN REJECT
  if (d.startsWith("REJECT_") && isAdmin(q.from.id)) {
    const order = await Order.findById(d.split("_")[1]);
    if (!order) return;

    order.status="REJECTED";
    await order.save();

    await bot.sendMessage(order.userId,
"❌ သင့် Order ကို Reject လုပ်လိုက်ပါသည်။ Owner @Official_Bika ကို ဆက်သွယ်ပါ");
  }
});

// ===============================
// MESSAGE FLOW
// ===============================
bot.on("message", async msg => {
  if (!msg.text) return;
  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t) return;

  // GAME ID
  if (t.step === "GAME") {
    if (t.product==="MLBB") {
      const m = msg.text.match(/^(\d+)\s*\(?(\d+)\)?$/);
      if (!m) return bot.sendMessage(chatId,"❌ Format မမှန်ပါ");
      t.gameId=m[1]; t.serverId=m[2];
    } else {
      t.gameId=msg.text.trim(); t.serverId="-";
    }
    t.step="ITEMS";
    return bot.sendMessage(chatId,"🛒 Amount ထည့်ပါ (86+343)");
  }

  // ITEMS
  if (t.step==="ITEMS") {
    let total=0; t.items=[];
    for (const a of msg.text.split("+")) {
      const p = PRICES[t.product][a];
      if (!p) return bot.sendMessage(chatId,`❌ ${a} မမှန်ပါ`);
      t.items.push({ amount:a, price:p });
      total+=p;
    }
    t.totalPrice=total;
    t.orderId = generateOrderId();

    // CLEAN OLD MSGS
    for (const id of t.msgs) {
      try { await bot.deleteMessage(chatId,id); } catch {}
    }

    const p = await bot.sendMessage(chatId,
`📦 Order Preview
━━━━━━━━━━━━━━━
🆔 Order ID: ${t.orderId}
🎮 ${t.product}
🆔 ${t.gameId} (${t.serverId})
💰 ${total.toLocaleString()} MMK`,
      { reply_markup:{ inline_keyboard:[
        [{ text:"✅ Confirm Order", callback_data:"CONFIRM" }]
      ]}}
    );
    t.previewMsgId=p.message_id;
  }
});

// ===============================
// PAYMENT PHOTO
// ===============================
bot.on("photo", async msg => {
  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t || t.step!=="PAYMENT") return;

  const userMsg = await bot.sendPhoto(chatId,msg.photo.at(-1).file_id,{
    caption:
`📦 Order Info
━━━━━━━━━━━━━━━
🆔 ${t.orderId}
🎮 ${t.product}
🆔 ${t.gameId} (${t.serverId})
💰 ${t.totalPrice.toLocaleString()} MMK

📨 Admin ထံ ပေးပို့ထားပါသည်`
  });

  const waitMsg = await bot.sendMessage(chatId,
`⏳ Admin စစ်ဆေးနေပါသည်...
Your Order ID: ${t.orderId}`);

  const order = await Order.create({
    orderId: t.orderId,
    userId: chatId.toString(),
    username: msg.from.username || msg.from.first_name,
    product: t.product,
    gameId: t.gameId,
    serverId: t.serverId,
    items: t.items,
    totalPrice: t.totalPrice,
    paymentMethod: t.paymentMethod,
    paymentPhoto: msg.photo.at(-1).file_id,
    userMsgId: userMsg.message_id,
    waitMsgId: waitMsg.message_id,
    expireAt: new Date(Date.now()+30*24*60*60*1000)
  });

  const adminMsg = await bot.sendPhoto(
    ADMIN_ID,
    order.paymentPhoto,
    {
      caption:
`📦 NEW ORDER
━━━━━━━━━━━━━━━
🆔 ${order.orderId}
👤 @${order.username}
🎮 ${order.product}
🆔 ${order.gameId} (${order.serverId})
💰 ${order.totalPrice.toLocaleString()} MMK`,
      reply_markup:{ inline_keyboard:[
        [{ text:"✅ Approve", callback_data:`APPROVE_${order._id}` },
         { text:"❌ Reject", callback_data:`REJECT_${order._id}` }]
      ]}
    }
  );

  order.adminMsgId = adminMsg.message_id;
  await order.save();
  delete temp[chatId];
});

// ===============================
// WEB SERVER (RENDER)
// ===============================
app.get("/",(_,res)=>res.send("Bot Running"));
app.listen(PORT,()=>console.log("Server Running"));
