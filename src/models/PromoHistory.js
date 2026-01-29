const mongoose = require("mongoose");

const promoHistorySchema = new mongoose.Schema({
  promoTitle: {
    type: String,
    default: "Special Promotion"
  },

  winnerId: {
    type: String,
    required: true
  },

  winnerUsername: {
    type: String
  },

  gameId: {
    type: String,
    required: true
  },

  serverId: {
    type: String,
    required: true
  },

  approvedBy: {
    type: String // admin userId
  },

  approvedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("PromoHistory", promoHistorySchema);
