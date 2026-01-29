// ===============================
// PROMOTION MODEL (SINGLE CLAIM)
// ===============================

const promo = {
  active: false,     // promo is running
  claimed: false,    // already claimed?
title: "🎁 MLBB Free Diamonds Promo",
  winner: {
    chatId: null,
    username: null
  },

  gameId: null,
  serverId: null,

  approved: false
};

// ===============================
function resetPromo() {
  promo.active = false;
  promo.claimed = false;

  promo.winner.chatId = null;
  promo.winner.username = null;

  promo.gameId = null;
  promo.serverId = null;

  promo.approved = false;
}

module.exports = {
  promo,
  resetPromo
};
