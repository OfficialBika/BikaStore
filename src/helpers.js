// ===============================
// HELPERS (BIKA STORE - FINAL)
// ===============================

function isAdmin(userId, ADMIN_IDS = []) {
  const id = String(userId || "").trim();
  return (ADMIN_IDS || []).map(x => String(x).trim()).includes(id);
}

// Returns [startDate, endDateExclusive] for current month in Asia/Bangkok time basis.
// Using JS Date in UTC is okay for aggregation range as long as both ends computed same way.
function monthRange(baseDate = new Date()) {
  const d = new Date(baseDate);
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
  return [start, end];
}

// Optional: today range
function dayRange(baseDate = new Date()) {
  const d = new Date(baseDate);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return [start, end];
}

function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function getMonthName(date = new Date()) {
  return date.toLocaleString("en-US", { month: "long" });
}

function splitAmounts(raw) {
  if (!raw) return [];

  return String(raw)
    .split("+")
    .map(s => s.trim())
    .filter(Boolean);
}

function computeTotalMMKMulti(productKey, rawAmount) {
  const parts = splitAmounts(rawAmount);
  if (!parts.length) return null;

  let total = 0;

  for (const part of parts) {
    const item = findPriceItem(productKey, part);
    if (!item) return null; // ❌ one item fail = all fail
    total += Number(item.price);
  }

  return total;
}

module.exports = {
  isAdmin,
  monthRange,
  dayRange,
  safeInt,
  getMonthName
};
