// utils/parser.js — Parsing Helpers for Game Items & Orders

function parseGameId(text = "") { const lower = text.toLowerCase(); if (lower.includes("ml") || lower.includes("mobile")) return "mlbb"; if (lower.includes("pubg")) return "pubg"; return null; }

function parseItems(text = "") { const [gameRaw, itemRaw, uidRaw, serverRaw] = text.split("|").map((s) => s.trim());

return { game: parseGameId(gameRaw), itemCode: itemRaw, gameId: uidRaw, serverId: serverRaw || null, }; }

function parseNumber(text = "") { const num = parseInt(text); return isNaN(num) ? null : num; }

module.exports = { parseGameId, parseItems, parseNumber, };
