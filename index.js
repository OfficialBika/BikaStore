"use strict";

/**
 * BIKA STORE BOT — FULL SINGLE FILE
 * - Website web-order flow (DB-based)
 * - /start web_xxxxx -> claim from API -> create Order
 * - Payment slip upload
 * - Admin approve / reject
 */

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const mongoose = require("mongoose");

// ================== ENV ==================
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const API_BASE = process.env.API_BASE; // e.g. https://bikastore-api.onrender.com
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => Number(x.trim()))
  .filter(Boolean);

if (!BOT_TOKEN || !API_BASE) {
  console.error("❌ Missing BOT_TOKEN or API_BASE in env");
  process.exit(1);
}

// ================== MONGODB ==================
mongoose
  .connect(process.env.MONGO_URI, { maxPoolSize: 10 })
  .then(() => console.log("🍃 Bot MongoDB connected"))
  .catch((e) => {
    console.error("Mongo error", e.message);
    process.exit(1);
  });

// ================== ORDER MODEL ==================
const OrderSchema = new mongoose.Schema({
  id: Number,
  userId: Number,
  username: String,
  firstName: String,

  categoryKey: String, // mlbb / pubg
  packageId: String,
  packageName: String,

  price: Number,
  currency: { type: String, default: "MMK" },

  gameId: String,
  serverId: String,

  status: String, // PENDING_PAYMENT, AWAITING_SLIP, PENDING_CONFIRMATION, COMPLETED, REJECTED

  webStartCode: String,
  webCart: Array,

  paymentSlipFileId: String,
  adminNote: String,

  createdAt: Date,
  paidAt: Date,
  confirmedAt: Date,
});

const Order = mongoose.model("Order", OrderSchema);

// Auto increment order id
async function getNextOrderId() {
  const last = await Order.findOne().sort({ id: -1 }).lean();
  return last ? last.id + 1 : 1001;
}

// ================== BOT + WEBHOOK ==================
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

if (PUBLIC_URL) {
  const hook = `${PUBLIC_URL.replace(/\/+$/, "")}/webhook/${BOT_TOKEN}`;
  bot.setWebHook(hook).then(() => console.log("🔗 Webhook set:", hook));
}

const app = express();
app.use(express.json());

app.post("*", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (_, res) => res.send("BIKA Store Bot running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌐 Bot server on", PORT));

// ================== HELPERS ==================
const isAdmin = (id) => ADMIN_IDS.includes(id);

function formatPrice(n) {
  return Number(n || 0).toLocaleString() + " MMK";
}

function orderSummary(order, title = "Order") {
  return (
    `🧾 *${title}*\n\n` +
    `🆔 Order ID: #${order.id}\n` +
    `🎮 Game: ${order.categoryKey.toUpperCase()}\n` +
    `📦 Package: ${order.packageName}\n` +
    `💰 Price: ${formatPrice(order.price)}\n\n` +
    `👤 User: @${order.username || "-"}\n` +
    (order.categoryKey === "mlbb"
      ? `MLBB ID: ${order.gameId}\nServer: ${order.serverId}\n`
      : `PUBG ID: ${order.gameId}\n`) +
    `\nStatus: ${order.status}`
  );
}

// ================== /START ==================
bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const payload = (match && match[1]) || "";

  // Website web-order
  if (payload.startsWith("web_")) {
    await bot.sendMessage(chatId, "🔄 Website order ကို ဖတ်နေပါတယ်…");

    try {
      const resp = await axios.post(`${API_BASE}/api/web-orders/claim`, {
        startCode: payload,
        telegramUserId: userId,
        username: msg.from.username || "",
        firstName: msg.from.first_name || "",
      });

      if (!resp.data.success) throw new Error("claim failed");

      const wo = resp.data.order;
      const orderId = await getNextOrderId();

      const packageName = Array.isArray(wo.cart)
        ? wo.cart
            .map((i) => `${i.label || i.display} ×${i.qty || 1}`)
            .join(" + ")
        : "Website Order";

      const order = await Order.create({
        id: orderId,
        userId,
        username: msg.from.username || "",
        firstName: msg.from.first_name || "",
        categoryKey: wo.game === "PUBG" ? "pubg" : "mlbb",
        packageId: "WEB_CART",
        packageName,
        price: wo.total,
        currency: "MMK",
        gameId: wo.game === "PUBG" ? wo.pubgId : wo.mlbbId,
        serverId: wo.svId || "",
        status: "PENDING_PAYMENT",
        webStartCode: payload,
        webCart: wo.cart,
        createdAt: new Date(),
      });

      await bot.sendMessage(chatId, orderSummary(order, "New Web Order"), {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 I have paid", callback_data: `paid:${order.id}` }],
          ],
        },
      });
    } catch (e) {
      console.error(e.response?.data || e.message);
      await bot.sendMessage(
        chatId,
        "❌ Website order ကို မဖတ်နိုင်ပါ။ link သက်တမ်းကုန်သွားနိုင်ပါတယ်။"
      );
    }
    return;
  }

  // Normal start
  await bot.sendMessage(
    chatId,
    "👋 *Welcome to BIKA Store*\n\nWebsite မှာ order တင်ပြီး Bot ကို ပြန်လာနိုင်ပါတယ်။",
    { parse_mode: "Markdown" }
  );
});

// ================== CALLBACKS ==================
bot.on("callback_query", async (q) => {
  const data = q.data;
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  // User paid
  if (data.startsWith("paid:")) {
    const id = Number(data.split(":")[1]);
    const order = await Order.findOne({ id, userId });
    if (!order) return;

    order.status = "AWAITING_SLIP";
    order.paidAt = new Date();
    await order.save();

    await bot.sendMessage(
      chatId,
      "📸 ငွေလွှဲပြေစာ Screenshot ကို ပုံအနေနဲ့ ပို့ပေးပါ။"
    );
  }

  // Admin approve / reject
  if (data.startsWith("admin:") && isAdmin(userId)) {
    const [_, action, idStr] = data.split(":");
    const order = await Order.findOne({ id: Number(idStr) });
    if (!order) return;

    if (action === "approve") {
      order.status = "COMPLETED";
      order.confirmedAt = new Date();
    } else {
      order.status = "REJECTED";
      order.confirmedAt = new Date();
    }
    await order.save();

    await bot.sendMessage(
      order.userId,
      orderSummary(order, action === "approve" ? "Completed" : "Rejected"),
      { parse_mode: "Markdown" }
    );
  }
});

// ================== PAYMENT SLIP ==================
bot.on("photo", async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  const order = await Order.findOne({
    userId,
    status: "AWAITING_SLIP",
  }).sort({ createdAt: -1 });

  if (!order) return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;

  order.paymentSlipFileId = fileId;
  order.status = "PENDING_CONFIRMATION";
  await order.save();

  await bot.sendMessage(chatId, "✅ Slip လက်ခံပြီးပါပြီ။ Admin စစ်ဆေးနေပါပြီ။");

  for (const adminId of ADMIN_IDS) {
    await bot.sendPhoto(adminId, fileId, {
      caption: orderSummary(order, "Payment Slip"),
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `admin:approve:${order.id}` },
            { text: "❌ Reject", callback_data: `admin:reject:${order.id}` },
          ],
        ],
      },
    });
  }
});

console.log("🚀 BIKA Store Bot started");
