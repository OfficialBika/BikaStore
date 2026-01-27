// ===============================
// HELPERS (FINAL)
// ===============================

const ADMIN_CHAT_IDS = process.env.ADMIN_CHAT_IDS
  ? process.env.ADMIN_CHAT_IDS.split(",").map(id => Number(id))
  : [];

/**
 * Check admin
 */
function isAdmin(userId) {
  return ADMIN_CHAT_IDS.includes(Number(userId));
}

/**
 * Generate Order ID
 * BKS-20260127-4821
 */
function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BKS-${date}-${rand}`;
}

/**
 * Format price
 */
function formatMMK(amount) {
  return Number(amount).toLocaleString("en-US") + " MMK";
}

module.exports = {
  isAdmin,
  generateOrderId,
  formatMMK
};
