// services/promo.service.js — Promo creation, claiming, and expiration

const { Promo } = require("../models/Promo");

async function createPromo({ title, expireAt }) {
  const promo = new Promo({
    title,
    expireAt,
    claimed: false,
    active: true,
    stage: "LIVE",
  });
  await promo.save();
  return promo;
}

async function claimPromo(promoId, { userId, username, firstName }) {
  const promo = await Promo.findById(promoId);

  if (!promo || !promo.active || promo.claimed || promo.expireAt < new Date()) {
    throw new Error("Promo invalid or already claimed");
  }

  promo.claimed = true;
  promo.active = false;
  promo.stage = "CLAIMED";
  promo.winnerUserId = userId;
  promo.winnerUsername = username;
  promo.winnerFirstName = firstName;

  await promo.save();
  return promo;
}

async function expirePromos() {
  const now = new Date();
  const result = await Promo.updateMany(
    { active: true, expireAt: { $lte: now } },
    { $set: { active: false, stage: "DONE" } }
  );
  return result;
}

module.exports = {
  createPromo,
  claimPromo,
  expirePromos,
};
