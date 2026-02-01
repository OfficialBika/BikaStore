// index.js — Entry Point (Start Express + Bot Webhook)

const { app, routePath } = require("./server/express");
const { bot } = require("./bot/bot");
const { PUBLIC_URL } = require("./config/env");

// Set webhook for Telegram Bot
(async () => {
  try {
    await bot.setWebHook(`${PUBLIC_URL}${routePath}`);
    console.log("🚀 Webhook set successfully");
  } catch (e) {
    console.error("❌ Failed to set webhook:", e.message || e);
  }
})();

// Start express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
