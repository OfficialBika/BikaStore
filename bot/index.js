"use strict";

/**
 * BIKA STORE BOT — FULL SINGLE FILE (MULTI-ORDER SAFE)
 * - /start web_xxxxx -> claim from API -> create Order (idempotent)
 * - If user repeats /start web_xxxxx -> show existing Order (no duplicate)
 * - Payment slip upload
 * - Admin approve / reject
 */

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();

// ================== CONFIG ==================
const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_URL = process.env.PUBLIC_URL;
const MONGO_URI = process.env.MONGO_URI;

// ✅ Hardcode API base (as you requested)
const API_BASE = "https://bikastore-api.onrender.com";

const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((x) => Number(String(x).trim()))
  .filter(Boolean);

if (!BOT_TOKEN) {
  console.error("❌ Missing BOT_TOKEN in env");
  process.exit(1);
}
if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI in env (bot DB)");
  process.exit(1);
}

// ================== MONGODB ==================
mongoose
  .connect(MONGO_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 15000 })
  .then(() => console.log("🍃 Bot MongoDB connected"))
  .catch((e) => {
    console.error("❌ Bot Mongo error:", e.message);
    process.exit(1);
  });

// ================== ORDER MODEL ==================
const OrderSchema = new mongoose.Schema(
  {
    id: { type: Number, index: true },
    userId: { type: Number, index: true },
    username: String,
    firstName: String,

    categoryKey: String, // mlbb / pubg
    packageId: String,
    packageName: String,

    price: Number,
    currency: { type: String, default: "MMK" },

    gameId: String,
    serverId: String,

    status: String, // PENDING_PAYMENT, AWAITING_SLIP, PENDING_CONFIRMATION, COMPLETED, REJECTED, CANCELLED

    // ✅ for web flow idempotency
    webStartCode: { type: String, index: true },
    webCart: Array,

    paymentSlipFileId: String,
    adminNote: String,

    createdAt: Date,
    paidAt: Date,
    confirmedAt: Date,
  },
  { versionKey: false }
);

OrderSchema.index({ userId: 1, webStartCode: 1 }, { unique: false });

const Order = mongoose.model("Order", OrderSchema);

async function getNextOrderId() {
  const last = await Order.findOne().sort({ id: -1 }).lean();
  return last ? last.id + 1 : 1001;
}

// ================== BOT + WEBHOOK ==================
const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

if (PUBLIC_URL) {
  const base = PUBLIC_URL.replace(/\/+$/, "");
  const hook = `${base}/webhook/${BOT_TOKEN}`;
  bot
    .setWebHook(hook)
    .then(() => console.log("🔗 Webhook set:", hook))
    .catch((e) => console.error("❌ setWebHook error:", e.message));
} else {
  console.warn("⚠️ PUBLIC_URL not set (webhook may not work).");
}

const app = express();
app.use(express.json({ limit: "2mb" }));

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
  return Number(n || 0).toLocaleString("en-US") + " MMK";
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
      ? `MLBB ID: ${order.gameId || "-"}\nServer: ${order.serverId || "-"}\n`
      : `PUBG ID: ${order.gameId || "-"}\n`) +
    `\nStatus: ${order.status}`
  );
}

function paidKeyboard(orderId) {
  return {
    inline_keyboard: [[{ text: "💰 I have paid", callback_data: `paid:${orderId}` }]],
  };
}

function adminKeyboard(orderId) {
  return {
    inline_keyboard: [[
      { text: "✅ Approve", callback_data: `admin:approve:${orderId}` },
      { text: "❌ Reject", callback_data: `admin:reject:${orderId}` },
    ]],
  };
}

// ================== /START ==================
bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const payloadRaw = (match && match[1] ? String(match[1]).trim() : "");
  const payload = payloadRaw ? payloadRaw.split(" ")[0] : "";

  // Web deep-link
  if (payload && payload.startsWith("web_")) {
    await bot.sendMessage(chatId, "🔄 Website order ကို ဖတ်နေပါတယ်…");

    try {
      // ✅ If already created in bot DB (user double-click / retry) -> show it
      const existing = await Order.findOne({ userId, webStartCode: payload })
        .sort({ createdAt: -1 })
        .lean();

      if (existing) {
        await bot.sendMessage(chatId, orderSummary(existing, "Your Web Order"), {
          parse_mode: "Markdown",
          reply_markup: paidKeyboard(existing.id),
        });
        return;
      }

      // ✅ claim from API (idempotent on API side too)
      const resp = await axios.post(`${API_BASE}/api/web-orders/claim`, {
        startCode: payload,
        telegramUserId: userId,
        username: msg.from.username || "",
        firstName: msg.from.first_name || "",
      }, { timeout: 15000 });

      const data = resp.data;
      if (!data || !data.success || !data.order) {
        throw new Error("claim_failed");
      }

      const wo = data.order;

      const categoryKey = wo.game === "PUBG" ? "pubg" : "mlbb";
      const total =
        typeof wo.total === "number"
          ? wo.total
          : (Array.isArray(wo.cart) ? wo.cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0) : 0);

      const packageName = Array.isArray(wo.cart) && wo.cart.length
        ? wo.cart.map((i) => `${i.label || i.display || "Item"} ×${Number(i.qty || 1)}`).join(" + ")
        : "Website Order";

      const gameId = categoryKey === "pubg" ? (wo.pubgId || "") : (wo.mlbbId || "");
      const serverId = categoryKey === "mlbb" ? (wo.svId || "") : "";

      const orderId = await getNextOrderId();

      const order = await Order.create({
        id: orderId,
        userId,
        username: msg.from.username || "",
        firstName: msg.from.first_name || "",
        categoryKey,
        packageId: "WEB_CART",
        packageName,
        price: total,
        currency: "MMK",
        gameId,
        serverId,
        status: "PENDING_PAYMENT",
        webStartCode: payload,
        webCart: wo.cart || [],
        createdAt: new Date(),
        adminNote: "",
        paymentSlipFileId: "",
      });

      await bot.sendMessage(chatId, orderSummary(order, "New Web Order"), {
        parse_mode: "Markdown",
        reply_markup: paidKeyboard(order.id),
      });

      return;
    } catch (e) {
      const apiMsg = e?.response?.data?.message;
      console.error("❌ /start web_ error:", e?.response?.data || e.message);

      await bot.sendMessage(
        chatId,
        "❌ Website order ကို မဖတ်နိုင်ပါ။\n" +
          (apiMsg ? `Reason: ${apiMsg}\n` : "") +
          "➡️ (အများဆုံးဖြစ်တာ) link ကို တစ်ခါတည်းထဲ ၂ ကြိမ်နှိပ်တာ/ထပ်သုံးတာကြောင့်ပါ။ Website မှာ order ကို ပြန်လုပ်ပြီး link အသစ်နဲ့ ထပ်စမ်းပါ။"
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

  bot.answerCallbackQuery(q.id).catch(() => {});

  // User paid -> request slip
  if (data.startsWith("paid:")) {
    const id = Number(data.split(":")[1]);
    const order = await Order.findOne({ id, userId });
    if (!order) return;

    if (order.status !== "PENDING_PAYMENT") {
      await bot.sendMessage(chatId, "ဒီ order က payment step မဟုတ်တော့ပါ။");
      return;
    }

    order.status = "AWAITING_SLIP";
    order.paidAt = new Date();
    await order.save();

    await bot.sendMessage(chatId, "📸 ငွေလွှဲပြေစာ Screenshot ကို ပုံအနေနဲ့ *တစ်ပုံပဲ* ပို့ပေးပါ။", {
      parse_mode: "Markdown",
    });
    return;
  }

  // Admin approve / reject
  if (data.startsWith("admin:") && isAdmin(userId)) {
    const [, action, idStr] = data.split(":");
    const order = await Order.findOne({ id: Number(idStr) });
    if (!order) return;

    if (order.status !== "PENDING_CONFIRMATION") {
      await bot.sendMessage(chatId, "ဒီ order က confirm step မဟုတ်တော့ပါ။");
      return;
    }

    if (action === "approve") {
      order.status = "COMPLETED";
      order.confirmedAt = new Date();
    } else {
      order.status = "REJECTED";
      order.confirmedAt = new Date();
      order.adminNote = "Rejected by admin";
    }
    await order.save();

    // notify user
    try {
      await bot.sendMessage(
        order.userId,
        orderSummary(order, action === "approve" ? "✅ Completed" : "❌ Rejected"),
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Notify user failed:", err.message);
    }
  }
});

// ================== PAYMENT SLIP ==================
bot.on("photo", async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // take the latest AWAITING_SLIP order for this user
  const order = await Order.findOne({ userId, status: "AWAITING_SLIP" }).sort({ createdAt: -1 });
  if (!order) {
    await bot.sendMessage(chatId, "Slip ပို့မယ့် order ကို မတွေ့ပါ။ ပထမဆုံး 'I have paid' ကိုနှိပ်ပြီးမှ slip ပို့ပါ။");
    return;
  }

  const fileId = msg.photo[msg.photo.length - 1].file_id;

  order.paymentSlipFileId = fileId;
  order.status = "PENDING_CONFIRMATION";
  await order.save();

  await bot.sendMessage(chatId, "✅ Slip လက်ခံပြီးပါပြီ။ Admin စစ်ဆေးနေပါပြီ။");

  // send to admins
  for (const adminId of ADMIN_IDS) {
    try {
      await bot.sendPhoto(adminId, fileId, {
        caption: orderSummary(order, "Payment Slip"),
        parse_mode: "Markdown",
        reply_markup: adminKeyboard(order.id),
      });
    } catch (e) {
      console.error("Send to admin failed:", adminId, e.message);
    }
  }
});

console.log("🚀 BIKA Store Bot started");
console.log("API_BASE:", API_BASE);
console.log("Admins:", ADMIN_IDS.join(", ") || "(none)");
