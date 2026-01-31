// services/broadcast.service.js — Broadcast Messages to Groups

const { bot } = require("../bot/bot"); const fs = require("fs");

module.exports = { async sendBroadcast({ chatIds = [], message, photoFileId, buttons }) { const inlineKeyboard = buttons?.length ? { reply_markup: { inline_keyboard: [buttons.map((btn) => ({ text: btn.text, url: btn.url }))], }, } : {};

for (const chatId of chatIds) {
  try {
    if (photoFileId) {
      await bot.sendPhoto(chatId, photoFileId, {
        caption: message,
        parse_mode: "HTML",
        ...inlineKeyboard,
      });
    } else {
      await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        ...inlineKeyboard,
      });
    }
  } catch (err) {
    console.error(`❌ Failed to send broadcast to ${chatId}:`, err.message);
  }
}

}, };
