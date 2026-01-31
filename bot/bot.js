// bot/bot.js — Telegram Bot Setup

const TelegramBot = require("node-telegram-bot-api"); const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN; if (!BOT_TOKEN) { console.error("❌ Missing BOT_TOKEN"); process.exit(1); }

const bot = new TelegramBot(BOT_TOKEN); const app = express(); app.use(express.json());

// Webhook route (used in index.js) const WEBHOOK_PATH = "/telegram/webhook"; app.post(WEBHOOK_PATH, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

module.exports = { bot, app };
