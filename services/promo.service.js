// services/promo.service.js — Promo Code Logic

const Promo = require("../models/Promo"); const User = require("../models/User");

module.exports = { async createPromo(code, reward, maxUse = 1, expiresAt = null, createdBy = null) { return await Promo.create({ code, reward, maxUse, expiresAt, createdBy, }); },

async findPromo(code) { return await Promo.findOne({ code: code.toUpperCase(), active: true }); },

async usePromo(code, userId) { const promo = await Promo.findOne({ code: code.toUpperCase(), active: true }); if (!promo) throw new Error("Promo code not found or inactive");

if (promo.expiresAt && promo.expiresAt < new Date()) {
  throw new Error("Promo code expired");
}

if (promo.usedCount >= promo.maxUse) {
  throw new Error("Promo usage limit reached");
}

promo.usedCount++;
if (promo.usedCount >= promo.maxUse) promo.active = false;

await promo.save();
return promo.reward;

}, };
