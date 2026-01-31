// config/env.js — ENV Loader & Validator

require("dotenv").config();
const assert = require("assert");

function required(name) {
  const val = process.env[name];
  assert(val, `Missing required ENV: ${name}`);
  return val;
}

function optional(name, fallback = "") {
  return process.env[name] || fallback;
}

module.exports = {
  BOT_TOKEN: required("BOT_TOKEN"),
  MONGO_URI: required("MONGO_URI"),
  PUBLIC_URL: required("PUBLIC_URL"),
  WEBHOOK_SECRET: required("WEBHOOK_SECRET"),

  ADMIN_ID: required("ADMIN_ID"),
  ADMIN_CHAT_IDS: required("ADMIN_CHAT_IDS").split(","), // comma-separated list

  USER_CHAT_ID: optional("USER_CHAT_ID"),

  KPAY_NAME: optional("KPAY_NAME"),
  KPAY_PHONE: optional("KPAY_PHONE"),

  WAVEPAY_NAME: optional("WAVEPAY_NAME"),
  WAVEPAY_PHONE: optional("WAVEPAY_PHONE"),

  TZ: optional("TZ", "Asia/Yangon"),
};
