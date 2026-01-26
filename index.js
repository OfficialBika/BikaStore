// ===== IMPORTS =====
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");
// ===== DATE HELPERS =====
const formatDateDMY = (date = new Date()) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const formatMonthYear = (date = new Date()) => {
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });
};
// ===== ENV =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;
const PORT = process.env.PORT || 3000;

// ===== ADMIN CHECK =====
const isAdmin = (chatId) => chatId.toString() === ADMIN_ID;

// ===== EXPRESS =====
const app = express();

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// ===== ORDER SCHEMA =====
const OrderSchema = new mongoose.Schema({
  userId: String,
  username: String,

  product: String,          // "MLBB" | "PUBG"
  gameId: String,
  serverId: String,

  items: [
    {
      amount: String,
      price: Number
    }
  ],

  totalPrice: Number,
  status: {
    type: String,
    default: "pending"       // pending | approved | rejected
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  // ⭐ TTL field
  expireAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// ⭐ TTL INDEX
OrderSchema.index(
  { expireAt: 1 },
  { expireAfterSeconds: 0 }
);

// ===== MODEL (တစ်ခါပဲ) =====
const Order = mongoose.model("Order", OrderSchema);

// ===== PAYMENT ACCOUNTS =====
const PAYMENT_ACCOUNTS = {
  KPay: {
    name: "💜 KPay",
    account: "09264202647 (Shine Htet Aung)"
  },
  WavePay: {
    name: "💙 WavePay",
    account: "09264202647 (Shine Htet Aung)"
   }
  };


const User = mongoose.model("User", new mongoose.Schema({
  chatId: { type: String, unique: true },
  firstName: String,
  username: String,
  createdAt: { type: Date, default: Date.now }
}));

// ===== DATA =====
const PRICES = {
  MLBB: {
    name: "💎 Mobile Legends Diamonds",
    prices: {
      "wp":5900,
      "wp2":11800,
      "wp3":17700,
      "wp4":23600,
      "wp5":29500,
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
      "1049": 59900
    }
  },
  PUBG: {
    name: "🎯 PUBG UC",
    prices: {
      "60": 4500,
      "325": 19500,
      "660": 38000,
      "1800": 90500,
      "3850": 185000,
      "8100": 363000
    }
  }
};

const temp = {};
const oid = () => `BKS-${Date.now().toString().slice(-6)}`;

// ===== START =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString();

  await User.updateOne(
    { chatId },
    { chatId, firstName: msg.from.first_name, username: msg.from.username },
    { upsert: true }
  );

  bot.sendMessage(chatId, "🛒 *Welcome to Bika Store*\n\n မိမိဝယ်ချင်တဲ့ ဂိမ်းကိုရွေးပါ 👇", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }],
        [{ text: "🎯 PUBG UC", callback_data: "PUBG" }]
      ]
    }
  });
});
// User Myrank cmt
bot.onText(/\/myrank/, async (msg) => {
  const chatId = msg.chat.id.toString();

  // 📅 ဒီလရဲ့ first day
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  // ✅ ဒီလအတွင်း COMPLETED order တွေကို user အလိုက် စု
  const ranking = await Order.aggregate([
    {
      $match: {
        status: "COMPLETED",
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: "$chatId",
        totalMMK: { $sum: "$price" },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { totalMMK: -1 } }
  ]);

  if (!ranking.length) {
    return bot.sendMessage(chatId, "📭 ဒီလ Order မရှိသေးပါ");
  }

  // 🏆 rank ရှာ
  const rankIndex = ranking.findIndex(r => r._id === chatId);

  if (rankIndex === -1) {
    return bot.sendMessage(
      chatId,
      "❌ ဒီလအတွင်း အတည်ပြုထားတဲ့ Order မရှိပါ"
    );
  }

  const me = ranking[rankIndex];

  // 👤 User info
  const user = await User.findOne({ chatId });

  const now = new Date();

bot.sendMessage(
  chatId,
`🏆 *My Monthly Rank*

📅 Month : ${formatMonthYear(now)}
🗓 Date  : ${formatDateDMY(now)}

👤 Name  : ${user?.firstName || "User"}
🏅 Rank  : #${rankIndex + 1}
📦 Orders: ${me.totalOrders}
💰 Total : ${me.totalMMK.toLocaleString()} MMK
`,
  { parse_mode: "Markdown" }
 );
});
// Top 10 CMT
bot.onText(/\/top10/, async (msg) => {
  const chatId = msg.chat.id.toString();

  // 📅 ဒီလအစ
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  // 🏆 Top 10 aggregation
  const topUsers = await Order.aggregate([
    {
      $match: {
        status: "COMPLETED",
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: "$chatId",
        totalMMK: { $sum: "$price" },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { totalMMK: -1 } },
    { $limit: 10 }
  ]);

  if (!topUsers.length) {
    return bot.sendMessage(chatId, "📭 ဒီလ Order မရှိသေးပါ");
  }

const now = new Date();
  
let text =
`━━━━━━━━━━━━━━━
🏆 *TOP 10 USERS*
📅 *${formatMonthYear(now)} Ranking*
🗓 Date - ${formatDateDMY(now)}
━━━━━━━━━━━━━━━

`;

  for (let i = 0; i < topUsers.length; i++) {
    const u = topUsers[i];
    const user = await User.findOne({ chatId: u._id });

    let title;
    if (i === 0) title = "🥇 *GOLD*";
    else if (i === 1) title = "🥈 *SILVER*";
    else if (i === 2) title = "🥉 *BRONZE*";
    else title = `🏅 *Rank #${i + 1}*`;

    text +=
`${title}
👤 *${user?.firstName || "User"}*
💰 *Total Spend* : ${u.totalMMK.toLocaleString()} MMK
📦 *Orders*      : ${u.totalOrders}
━━━━━━━━━━━━━━━

`;
  }

  text += "✨ *Keep shopping to rank up!*";

  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

// ===== CALLBACK QUERY =====
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const d = q.data;

  // ===== ADMIN APPROVE / REJECT =====
  if (d.startsWith("APPROVE_") || d.startsWith("REJECT_")) {
  if (!isAdmin(chatId)) return;

  const [action, orderId] = d.split("_");

  // 📅 ဒီလကုန် (next month 1st day)
  const endOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    1
  );

  const updateData =
    action === "APPROVE"
      ? {
          status: "COMPLETED",
          approvedAt: new Date(),
          expireAt: endOfMonth // ⭐ TTL trigger
        }
      : { status: "REJECTED" };

  const order = await Order.findOneAndUpdate(
    { orderId },
    updateData,
    { new: true }
  );

  if (!order) {
    return bot.sendMessage(chatId, "❌ Order မတွေ့ပါ");
  }

  await bot.sendMessage(
    chatId,
    action === "APPROVE"
      ? `✅ Order ${orderId} ပြီးဆုံး`
      : `❌ Order ${orderId} ငြင်းပယ်ပြီးပါပြီ`
  );

  await bot.sendMessage(
    order.chatId,
    action === "APPROVE"
      ? "✅ Order အောင်မြင်စွာ ပြီးဆုံးပါပြီ"
      : "❌ Order ကို ငြင်းပယ်လိုက်ပါသည်"
  );
  }

  // ===== PAYMENT METHOD =====
  if (d === "PAY_KPAY" || d === "PAY_WAVEPAY") {
    const t = temp[chatId];
    if (!t) return bot.sendMessage(chatId, "❌ Session မရှိပါ");

    const paymentMethod = d === "PAY_KPAY" ? "KPay" : "WavePay";
    const orderId = oid();

    await Order.create({
      orderId,
      chatId: chatId.toString(),
      user: q.from.username ? `@${q.from.username}` : q.from.first_name,
      gameId: t.gameId,
      serverId: t.serverId,
      product: t.productKey,
      amount: t.amount,
      price: t.price,
      paymentMethod,
      status: "WAITING_PAYMENT"
    });

    delete temp[chatId];

    return bot.sendMessage(chatId,
`🧾 *Order Created*

🆔 ${orderId}
💎 ${t.amount} Diamonds
💰 ${t.price} MMK
💳 ${paymentMethod}

📸 Screenshot ပို့ပေးပါ`,
      { parse_mode: "Markdown" }
    );
  }

  // ===== PRODUCT Form SELECT =====
  if (PRICES[d]) {
  temp[chatId] = { productKey: d };

  let priceText = "";
  for (let a in PRICES[d].prices) {
    priceText += `${a} → ${PRICES[d].prices[a]} MMK\n`;
  }

  // 🔥 PUBG order form
  if (d === "PUBG") {
    return bot.sendMessage(chatId,
`📝 *Order Form*

🎯 PUBG UC

${priceText}

✍️ *ရေးထည့်ပုံ (Example)*

5123456789
60+325

📌 UC အများကြီးဝယ်ချင်ရင် + နဲ့ရေးနိုင်ပါတယ်`,
                           
      { parse_mode: "Markdown", reply_markup: { force_reply: true } }
    );
  }

  // 🔥 MLBB order form
  return bot.sendMessage(chatId,
`📝 *Order Form*

💎 MLBB Diamonds

${priceText}

✍️ *ရေးထည့်ပုံ (Example)*

486679424 2463
86+343


📌 ပထမလိုင်း → Game ID + Server ID  
📌 ဒုတိယလိုင်း → DiaAmount(ဥပမာ-86)
📌 Diamond အများကြီးဆို + နဲ့ရေးနိုင်ပါတယ်`,
                         
    { parse_mode: "Markdown", reply_markup: { force_reply: true } }
  );
}
}); 
// callback quary end

// ===== BROADCAST (ADMIN ONLY) =====
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Admin only");
  }

  const text = match[1];
  const users = await User.find().select("chatId");

  let success = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await bot.sendMessage(u.chatId, text);
      success++;
    } catch (err) {
      failed++;
    }
  }

  bot.sendMessage(
    msg.chat.id,
    `📣 Broadcast Done

👥 Total: ${users.length}
✅ Success: ${success}
❌ Failed: ${failed}`
  );
});

// ===== USER FORM INPUT =====
bot.on("message", async (msg) => {
  if (!msg.text || !msg.reply_to_message) return;

  const chatId = msg.chat.id;
  const t = temp[chatId];
  if (!t) return;

  const lines = msg.text.trim().split("\n");

  // ===== PUBG =====
  if (t.productKey === "PUBG") {
  const gameId = lines[0];
  const amountLine = lines[1];

  if (!gameId || !amountLine) {
    return bot.sendMessage(chatId, "❌ Pubg ID / Amount မမှန်ပါ");
  }

  // ⭐ multiple UC support (60+325)
  const amounts = amountLine.split("+");

  let totalPrice = 0;

  for (const amt of amounts) {
    const price = PRICES.PUBG.prices[amt];
    if (!price) {
      return bot.sendMessage(chatId, `❌ Amount မမှန်ပါ : ${amt}`);
    }
    totalPrice += price;
  }

  Object.assign(t, {
    gameId,
    serverId: "-",
    amount: amounts.join(" + "),
    price: totalPrice
  });
}

  // ===== MLBB =====
 if (t.productKey === "MLBB") {
  const [idLine, amountLine] = lines;
  const [gameId, serverId] = idLine.split(" ");

  if (!gameId || !serverId || !amountLine) {
    return bot.sendMessage(chatId, "❌ ID / Server ID / Amount မမှန်ပါ");
  }

  // ⭐ multiple amount support (86+343)
  const amounts = amountLine.split("+");

  let totalPrice = 0;

  for (const amt of amounts) {
    const price = PRICES.MLBB.prices[amt];
    if (!price) {
      return bot.sendMessage(chatId, `❌ Amount မမှန်ပါ : ${amt}`);
    }
    totalPrice += price;
  }

  Object.assign(t, {
    gameId,
    serverId,
    amount: amounts.join(" + "),
    price: totalPrice
  });
}
  // ===== STEP 2: CREATE ORDER IN MONGODB =====

// items array ပြင်ဆင်
const items = t.amount.split(" + ").map((amt) => {
  const price =
    t.productKey === "MLBB"
      ? PRICES.MLBB.prices[amt]
      : PRICES.PUBG.prices[amt];

  return {
    amount: amt,
    price: price
  };
});

// Order save

  // ===== STEP 3:Wait ORDER SUMMARY MESSAGE =====
const order = await Order.create({
// Items list text
 const itemsText = order.items
  .map(i => `• ${i.amount} 💎 — ${i.price.toLocaleString()} MMK`)
  .join("\n");

// Message text
const summaryMessage = `
━━━━━━━━━━━━━━━
📦 Order Submitted Successfully!
━━━━━━━━━━━━━━━
🎮 Product : ${order.product}
🆔 Game ID : ${order.gameId}
🌐 Server  : ${order.serverId}

🛒 Items:
${itemsText}

💰 Total : ${order.totalPrice.toLocaleString()} MMK
📌 Status: ⏳ Pending Admin Approval
━━━━━━━━━━━━━━━
`;
});

await bot.sendMessage(chatId, summaryMessage);

// ===== STEP 4: SEND ORDER TO ADMIN =====

const adminText = `
🆕 *New Order Received*
━━━━━━━━━━━━━━━
👤 User     : ${order.user}
🎮 Product  : ${order.product}
🆔 Game ID  : ${order.gameId}
🌐 Server   : ${order.serverId}

🛒 Items:
${itemsText}

💰 Total : ${order.totalPrice.toLocaleString()} MMK
📌 Status: ⏳ Pending
`;

await bot.sendMessage(ADMIN_ID, adminText, {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `APPROVE_${order._id}` },
        { text: "❌ Reject", callback_data: `REJECT_${order._id}` }
      ]
    ]
  }
});

  // ===== PAYMENT METHOD =====
  return bot.sendMessage(
    chatId,
`💳 *Payment Method ရွေးပါ*

${PAYMENT_ACCOUNTS.KPay.name}
Account: ${PAYMENT_ACCOUNTS.KPay.account}

${PAYMENT_ACCOUNTS.WavePay.name}
Account: ${PAYMENT_ACCOUNTS.WavePay.account}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: PAYMENT_ACCOUNTS.KPay.name, callback_data: "PAY_KPAY" }],
          [{ text: PAYMENT_ACCOUNTS.WavePay.name, callback_data: "PAY_WAVEPAY" }]
        ]
      }
    }
  );
});

// ===== PAYMENT SCREENSHOT =====
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;

  const order = await Order.findOne({
    chatId: chatId.toString(),
    status: "WAITING_PAYMENT"
  });

  if (!order) return bot.sendMessage(chatId, "❌ Pending order မရှိပါ");

  const photoId = msg.photo.pop().file_id;

  await bot.sendPhoto(ADMIN_ID, photoId, {
    caption:
`🆔 ${order.orderId}
👤 ${order.user}
💎 ${order.amount}
💰 ${order.price} MMK`,
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approve", callback_data: `APPROVE_${order.orderId}` },
        { text: "❌ Reject", callback_data: `REJECT_${order.orderId}` }
      ]]
    }
  });

  bot.sendMessage(chatId, "⏳ Admin စစ်ဆေးနေပါတယ်...");
});


// ===== TOP USERS CMT (ADD HERE) =====
bot.onText(/\/topusers/, async (msg) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Admin only");
  }

  const start = new Date();
  start.setDate(1);
  start.setHours(0,0,0,0);

  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  end.setHours(23,59,59,999);

  const result = await Order.aggregate([
    {
      $match: {
        status: "COMPLETED",
        approvedAt: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: "$chatId",
        user: { $first: "$user" },
        totalMMK: { $sum: "$price" },
        orders: { $sum: 1 }
      }
    },
    { $sort: { totalMMK: -1 } },
    { $limit: 10 }
  ]);

  if (!result.length) {
    return bot.sendMessage(msg.chat.id, "ဒီလအတွက် data မရှိသေးပါ");
  }

  let text =
`🏆 *Bika Store – Monthly Top Users*
━━━━━━━━━━━━━━━━━━━
📅 *${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}*

`;

result.forEach((u, i) => {
  const medal =
    i === 0 ? "🥇" :
    i === 1 ? "🥈" :
    i === 2 ? "🥉" : "🎖";

  text +=
`${medal} *Rank #${i + 1}*
👤 *User* : ${u.user}
💰 *Total* : ${u.totalMMK.toLocaleString()} MMK
📦 *Orders* : ${u.orders}
━━━━━━━━━━━━━━━━━━━
`;
});

text += `🔥 *Top ${result.length} Customers of the Month*\nThank you for supporting *Bika Store* 💙`;

bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// ===== DELETE ALL ORDERS BY USER (ADMIN) =====
bot.onText(/\/deleteorders (.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Admin only");
  }

  const targetChatId = match[1].trim();

  const result = await Order.deleteMany({ chatId: targetChatId });

  if (result.deletedCount === 0) {
    return bot.sendMessage(
      msg.chat.id,
      "❌ ဒီ user အတွက် order မတွေ့ပါ"
    );
  }

  bot.sendMessage(
    msg.chat.id,
    `🗑️ Order Deleted Successfully

👤 User Chat ID : ${targetChatId}
📦 Deleted Orders : ${result.deletedCount}`
  );
});

// ===== DELETE SINGLE ORDER (ADMIN) =====
bot.onText(/\/deleteorder (.+)/, async (msg, match) => {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Admin only");
  }

  const orderId = match[1].trim();

  const result = await Order.findOneAndDelete({ orderId });

  if (!result) {
    return bot.sendMessage(
      msg.chat.id,
      "❌ Order ID မတွေ့ပါ"
    );
  }

  bot.sendMessage(
    msg.chat.id,
    `🗑️ Order Deleted

🆔 Order ID : ${orderId}
👤 User : ${result.user}`
  );
});

// ===== WEB Sever =====
app.get("/", (_, res) => res.send("Bot Running"));
  
app.listen(PORT, () => console.log("Server running"));
