// ---------------------------
//  BIKA STORE API — server.js
//  DB-based Web Orders (IDEMPOTENT CLAIM + MULTI-ORDER SAFE)
// ---------------------------

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import crypto from "crypto";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 5000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "*";
const MONGO_URI = process.env.MONGO_URI;

// ---------------------------
//  MIDDLEWARE
// ---------------------------
app.use(
  cors({
    origin: WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));

// ---------------------------
//  MONGODB CONNECT
// ---------------------------
if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in environment variables");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 10,
  })
  .then(() => console.log("🍃 MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

// ---------------------------
//  WEB ORDER MODEL (TTL)
// ---------------------------
const webOrderSchema = new mongoose.Schema(
  {
    startCode: { type: String, unique: true, index: true },

    game: { type: String, enum: ["MLBB", "PUBG"], required: true },
    cart: { type: Array, required: true },

    mlbbId: { type: String, default: "" },
    svId: { type: String, default: "" },
    pubgId: { type: String, default: "" },

    total: { type: Number, required: true },

    // Claim state (idempotent)
    claimed: { type: Boolean, default: false },
    claimedBy: { type: String, default: "" }, // telegramUserId as string
    claimedAt: { type: Date, default: null },

    // TTL (auto delete after 30 mins)
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 30,
      index: true,
    },
  },
  { versionKey: false }
);

const WebOrder = mongoose.model("WebOrder", webOrderSchema);

// ---------------------------
//  HEALTH CHECK
// ---------------------------
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "BIKA Store API",
    time: new Date().toISOString(),
  });
});

app.get("/api/health", async (req, res) => {
  const dbState = mongoose.connection.readyState; // 1=connected
  res.json({ ok: true, dbConnected: dbState === 1 });
});

// ✅ DEBUG (optional): check startCode exists & status
// remove later if you want
app.get("/api/web-orders/debug/:startCode", async (req, res) => {
  try {
    const startCode = req.params.startCode;
    const doc = await WebOrder.findOne({ startCode }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: "not_found" });

    return res.json({
      ok: true,
      startCode: doc.startCode,
      game: doc.game,
      total: doc.total,
      claimed: doc.claimed,
      claimedBy: doc.claimedBy,
      createdAt: doc.createdAt,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: "server_error" });
  }
});

// =====================================================
//  WEBSITE → CREATE WEB ORDER
//  POST /api/web-orders
// =====================================================
app.post("/api/web-orders", async (req, res) => {
  try {
    const { game, cart, mlbbId, svId, pubgId } = req.body || {};

    if (!game || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload (game/cart missing)",
      });
    }

    if (game !== "MLBB" && game !== "PUBG") {
      return res.status(400).json({
        success: false,
        message: "Invalid game type",
      });
    }

    if (game === "MLBB" && (!mlbbId || !svId)) {
      return res.status(400).json({
        success: false,
        message: "MLBB ID + Server ID required",
      });
    }

    if (game === "PUBG" && !pubgId) {
      return res.status(400).json({
        success: false,
        message: "PUBG ID required",
      });
    }

    const total = cart.reduce(
      (s, i) => s + Number(i.price || 0) * Number(i.qty || 1),
      0
    );

    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid cart total",
      });
    }

    // Generate unique startCode (retry-safe)
    let startCode = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      startCode = "web_" + crypto.randomBytes(6).toString("hex");
      const exists = await WebOrder.findOne({ startCode }).lean();
      if (!exists) break;
    }

    await WebOrder.create({
      startCode,
      game,
      cart,
      mlbbId: mlbbId || "",
      svId: svId || "",
      pubgId: pubgId || "",
      total,
      claimed: false,
      claimedBy: "",
      claimedAt: null,
    });

    return res.json({ success: true, startCode });
  } catch (err) {
    console.error("❌ POST /api/web-orders error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// =====================================================
//  BOT → CLAIM WEB ORDER (IDEMPOTENT)
//  POST /api/web-orders/claim
// =====================================================
app.post("/api/web-orders/claim", async (req, res) => {
  try {
    const { startCode, telegramUserId, username, firstName } = req.body || {};

    if (!startCode) {
      return res.status(400).json({
        success: false,
        message: "startCode required",
      });
    }

    const tgId = telegramUserId ? String(telegramUserId) : "";

    const order = await WebOrder.findOne({ startCode });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired link",
      });
    }

    // If already claimed:
    // - If same user -> return again (idempotent)
    // - If different user -> reject
    if (order.claimed) {
      if (tgId && order.claimedBy && order.claimedBy === tgId) {
        return res.json({
          success: true,
          order: {
            game: order.game,
            cart: order.cart,
            total: order.total,
            mlbbId: order.mlbbId,
            svId: order.svId,
            pubgId: order.pubgId,
            telegramUserId,
            username,
            firstName,
            note: "already_claimed_by_same_user",
          },
        });
      }

      return res.status(400).json({
        success: false,
        message: "Order already claimed",
      });
    }

    // First time claim
    order.claimed = true;
    order.claimedBy = tgId || "";
    order.claimedAt = new Date();
    await order.save();

    return res.json({
      success: true,
      order: {
        game: order.game,
        cart: order.cart,
        total: order.total,
        mlbbId: order.mlbbId,
        svId: order.svId,
        pubgId: order.pubgId,
        telegramUserId,
        username,
        firstName,
      },
    });
  } catch (err) {
    console.error("❌ POST /api/web-orders/claim error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ---------------------------
//  404
// ---------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ---------------------------
//  START SERVER
// ---------------------------
app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
});
