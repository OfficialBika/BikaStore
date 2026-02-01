// session/session.js — In-Memory Session Store

const sessions = new Map();

function getSession(userId) { if (!sessions.has(userId)) { sessions.set(userId, {}); } return sessions.get(userId); }

function clearSession(userId) { sessions.delete(userId); }

module.exports = { getSession, clearSession, };
