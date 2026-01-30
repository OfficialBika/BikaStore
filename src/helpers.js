function isAdmin(userId, ADMIN_IDS = []) {
  return ADMIN_IDS.map(String).includes(String(userId));
}

function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return [start, end];
}

function dayRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return [start, end];
}

function getMonthName(d = new Date()) {
  return d.toLocaleString("en-US", { month: "long" });
}

module.exports = { isAdmin, monthRange, dayRange, getMonthName };
