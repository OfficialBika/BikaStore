"use strict";

/**
 * BIKA STORE BOT — FULL SINGLE FILE (FIXED)
 * - Website web-order flow (DB-based)
 * - /start web_xxxxx -> claim from API -> create Order
 * - Payment slip upload (FIXED: use "message" not "photo")
 * - Admin approve / reject
 */

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const mongoose = require("mongoose");

require("dotenv").config();

// ================== ENV ==================
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const API_BASE = process.env.API_BASE; // e.g. https://bikastore-api.onrender.com
const MONGO_URI = process.env.MONGO_URI;

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => Number(String(x).trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

if (!BOT_TOKEN) {
  console.error("❌ Missing BOT_TOKEN in env");
  process.exit(1);
}
if (!API_BASE) {
  console.error("❌ Missing API_BASE in env");
  process.exit(1);
}
if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in env");
  process.exit(1);
}
if (!ADMIN_IDS.length) {
  console.warn("⚠️ ADMIN_IDS empty. Admin approve/reject will not work.");
}

// ================== MONGODB ==================
mongoose
  .connect(MONGO_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 15000 })
  .then(() => console.log("🍃 Bot MongoDB connected"))
  .catch((e) => {
    console.error("❌ Mongo error:", e.message);
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
  const clean = PUBLIC_URL.replace(/\/+$/, "");
  const hook = `${clean}/webhook/${BOT_TOKEN}`;
  bot
    .setWebHook(hook)
    .then(() => console.log("🔗 Webhook set:", hook))
    .catch((e) => console.error("❌ setWebhook failed:", e.message));
} else {
  console.warn("⚠️ PUBLIC_URL not set. Webhook may not be configured.");
}

const app = express();
app.use(express.json());

// Telegram webhook endpoint (must exist)
app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Optional: catch-all (not required, but safe)
app.post("*", (req, res) => res.sendStatus(200));

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
    `🎮 Game: ${String(order.categoryKey || "").toUpperCase()}\n` +
    `📦 Package: ${order.packageName}\n` +
    `💰 Price: ${formatPrice(order.price)}\n\n` +
    `👤 User: @${order.username || "-"}\n` +
    (order.categoryKey === "mlbb"
      ? `MLBB ID: ${order.gameId}\nServer: ${order.serverId}\n`
      : `PUBG ID: ${order.gameId}\n`) +
    `\nStatus: ${order.status}`
  );
}

async function safeAnswerCb(q) {
  try {
    await bot.answerCallbackQuery(q.id);
  } catch (_) {}
}

// ================== /START ==================
bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const payloadRaw = (match && match[1] ? String(match[1]) : "").trim();
  const payload = payloadRaw ? payloadRaw.split(/\s+/)[0] : "";

  // Website web-order
  if (payload.startsWith("web_")) {
    await bot.sendMessage(chatId, "🔄 Website order ကို ဖတ်နေပါတယ်…");

    try {
      const resp = await axios.post(
        `${API_BASE.replace(/\/+$/, "")}/api/web-orders/claim`,
        {
          startCode: payload,
          telegramUserId: userId,
          username: msg.from.username || "",
          firstName: msg.from.first_name || "",
        },
        { timeout: 20000 }
      );

      const data = resp.data || {};
      if (!data.success || !data.order) {
        const m = data.message || "claim failed";
        throw new Error(m);
      }

      const wo = data.order;
      const orderId = await getNextOrderId();

      const cart = Array.isArray(wo.cart) ? wo.cart : [];
      const packageName = cart.length
        ? cart
            .map((i) => `${i.label || i.display || "Item"} ×${i.qty || 1}`)
            .join(" + ")
        : "Website Order";

      const categoryKey = wo.game === "PUBG" ? "pubg" : "mlbb";
      const price =
        typeof wo.total === "number"
          ? wo.total
          : cart.reduce(
              (s, i) => s + Number(i.price || 0) * Number(i.qty || 1),
              0
            );

      const order = await Order.create({
        id: orderId,
        userId,
        username: msg.from.username || "",
        firstName: msg.from.first_name || "",
        categoryKey,
        packageId: "WEB_CART",
        packageName,
        price,
        currency: "MMK",
        gameId: categoryKey === "pubg" ? wo.pubgId : wo.mlbbId,
        serverId: wo.svId || "",
        status: "PENDING_PAYMENT",
        webStartCode: payload,
        webCart: cart,
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

      return;
    } catch (e) {
      const apiErr = e?.response?.data;
      console.error("❌ web claim error:", apiErr || e.message);

      await bot.sendMessage(
        chatId,
        "❌ Website order ကို မဖတ်နိုင်ပါ။\n" +
          (apiErr?.message
            ? `Reason: ${apiErr.message}`
            : "link သက်တမ်းကုန်သွားနိုင်ပါတယ်။")
      );
      return;
    }
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
  const data = q.data || "";
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  await safeAnswerCb(q);

  // User paid
  if (data.startsWith("paid:")) {
    const id = Number(data.split(":")[1]);
    const order = await Order.findOne({ id, userId });
    if (!order) return;

    // Only allow from PENDING_PAYMENT
    if (order.status !== "PENDING_PAYMENT") {
      await bot.sendMessage(chatId, "ဒီ Order က Payment စောင့်နေတဲ့အခြေအနေမဟုတ်တော့ပါ။");
      return;
    }

    order.status = "AWAITING_SLIP";
    order.paidAt = new Date();
    await order.save();

    await bot.sendMessage(
      chatId,
      "📸 ငွေလွှဲပြေစာ Screenshot ကို ပုံအနေနဲ့ *တစ်ပုံပဲ* ပို့ပေးပါ။",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Admin approve / reject
  if (data.startsWith("admin:") && isAdmin(userId)) {
    const parts = data.split(":");
    const action = parts[1]; // approve / reject
    const idStr = parts[2];

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

    // notify customer
    try {
      await bot.sendMessage(
        order.userId,
        orderSummary(order, action === "approve" ? "Completed" : "Rejected"),
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("❌ notify user failed:", order.userId, e.message);
    }
  }
});

// ================== PAYMENT SLIP (FIXED) ==================
// IMPORTANT: node-telegram-bot-api does NOT emit "photo" event.
// Photo comes inside "message" => msg.photo
bot.on("message", async (msg) => {
  try {
    if (!msg.photo || !msg.photo.length) return;

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
      try {
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
      } catch (e) {
        console.error("❌ sendPhoto to admin failed:", adminId, e.message);
      }
    }
  } catch (e) {
    console.error("❌ message handler error:", e.message);
  }
});

console.log("🚀 BIKA Store Bot started");
console.log("API_BASE =", API_BASE);
console.log("Admins =", ADMIN_IDS.join(", ") || "(none)");
