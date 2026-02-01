// server/express.js — Express App for Telegram Webhook

const express = require("express"); const bodyParser = require("body-parser"); const { bot } = require("../bot/bot"); const { WEBHOOK_PATH } = process.env;

const app = express();

app.use(bodyParser.json());

// Telegram webhook endpoint app.post(WEBHOOK_PATH, (req, res) => { bot.handleUpdate(req.body); res.status(200).send("✅ Webhook received"); });

app.get("/", (req, res) => { res.send("🤖 Bika Store Bot is running!"); });

module.exports = app;
