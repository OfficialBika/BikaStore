// server/express.js — Express Server + Webhook Setup

const express = require("express");
const { bot } = require("../bot/bot");
const { WEBHOOK_SECRET } = require("../config/env");

const app = express();
app.use(express.json());

const routePath = `/webhook/${WEBHOOK_SECRET}`;

// Webhook endpoint
app.post(routePath, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Health check route
app.get("/", (req, res) => {
  res.send("✅ BIKA Store Bot Webhook is running.");
});

module.exports = {
  app,
  routePath,
};
