// utils/helpers.js — Common Helpers

const { bot } = require("../bot");
const escapeHTML = require("./html").escapeHTML;

function formatMMK(amount) {
  return parseInt(amount || 0)
    .toLocaleString("en-US")
    .replace(/,/g, ",");
}

function mentionUserHTML(user) {
  const name = escapeHTML(user.first_name || "User");
  return `<a href="tg://user?id=${user.id}">${name}</a>`;
}

async function sendPrompt(cid, session, text, extra = {}) {
  if (session.lastPromptId) {
    try {
      await bot.deleteMessage(cid, session.lastPromptId);
    } catch (_) {}
  }

  const sent = await bot.sendMessage(cid, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });

  session.lastPromptId = sent.message_id;
}

async function deleteIfPossible(chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (_) {}
}

module.exports = {
  formatMMK,
  mentionUserHTML,
  sendPrompt,
  deleteIfPossible,
};
