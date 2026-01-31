// utils/html.js — HTML Escape & Mention Helpers

function escapeHTML(text = "") { return text .replace(/&/g, "&") .replace(/</g, "<") .replace(/>/g, ">") .replace(/"/g, """) .replace(/'/g, "'"); }

function mentionUserHTML(user) { const name = escapeHTML(user.first_name || "User"); return <a href="tg://user?id=${user.id}">${name}</a>; }

module.exports = { escapeHTML, mentionUserHTML, };
