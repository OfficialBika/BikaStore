// session/session.js — In-memory Session Store

const sessions = new Map();

/**
 * Get or create session for chat ID
 * @param {number|string} chatId
 * @returns {object} session
 */
function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      step: null,
      game: null,
      gameId: null,
      serverId: null,
      items: null,
      totalPrice: 0,
      orderId: null,
      orderNo: null,
      orderDateText: null,
      paymentMethod: null,
      userMentionHTML: null,
    });
  }
  return sessions.get(chatId);
}

/**
 * Clear session for chat ID
 * @param {number|string} chatId
 */
function clearSession(chatId) {
  sessions.delete(chatId);
}

module.exports = {
  getSession,
  clearSession,
};
