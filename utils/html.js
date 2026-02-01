// utils/html.js — HTML Escape Utilities

function escapeHTML(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mentionUserHTML(user) {
  const name = escapeHTML(user.first_name || "User");
  return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

module.exports = {
  escapeHTML,
  mentionUserHTML,
};
