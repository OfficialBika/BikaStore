// src/server/express.js

const express = require("express");
const bodyParser = require("body-parser");
const { bot } = require("../../bot");

const app = express();

// Use JSON parser for incoming webhook updates
app.use(bodyParser.json());

// Webhook endpoint
app.post("/webhook", (req, res) => {
  try {
    bot.processUpdate(req.body);
  } catch (err) {
    console.error("Error handling webhook:", err);
  }
  res.sendStatus(200);
});

module.exports = { app };
