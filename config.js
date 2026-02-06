// config.js
// ENV config + helper functions

const dotenv = require("dotenv");
dotenv.config();

// Currency (Ks by default)
const STORE_CURRENCY = process.env.STORE_CURRENCY || "Ks";

// Admin Telegram user IDs (comma separated)
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

// MongoDB connection URI
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bika_store_bot";

// Public URL for webhook (Render / Vercel etc.)
const PUBLIC_URL = process.env.PUBLIC_URL || "";

// Timezone
const TIME_ZONE = process.env.TZ || "Asia/Yangon";

// Backend API base (for website web-order integration)
const API_BASE =
  process.env.API_BASE || "https://bikastore-api.onrender.com";

// Bot token
const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "YOUR_TELEGRAM_BOT_TOKEN_HERE";

if (!BOT_TOKEN || BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN_HERE") {
  console.warn("⚠️ Please set TELEGRAM_BOT_TOKEN in your environment!");
}

function isAdmin(userId) {
  return ADMIN_IDS.includes(String(userId));
}

module.exports = {
  STORE_CURRENCY,
  ADMIN_IDS,
  MONGODB_URI,
  PUBLIC_URL,
  TIME_ZONE,
  API_BASE,
  BOT_TOKEN,
  isAdmin,
};
