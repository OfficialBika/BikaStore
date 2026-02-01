// utils/parser.js — Game ID + Item Parser

function parseGameId(text) {
  const clean = text.replace(/[^\d]/g, "").trim();
  return clean.length >= 6 ? clean : null;
}

function parseItems(text) {
  const parts = text
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "");

  const items = [];
  for (const part of parts) {
    const match = /^(\d+)\s*x\s*(\w+)$/.exec(part);
    if (match) {
      const qty = parseInt(match[1], 10);
      const code = match[2];
      if (qty > 0) {
        items.push({ code, qty });
      }
    }
  }

  return items.length ? items : null;
}

module.exports = {
  parseGameId,
  parseItems,
};
