const UI = require("./ui");

// Command handlers map
const commands = {
  start: (bot, msg) => {
    const chatId = msg.chat.id;

    const menu = UI.mainMenu();
    bot.sendMessage(chatId, menu.text, {
      reply_markup: menu.keyboard
    });
  },

  status: (bot, msg, user) => {
    bot.sendMessage(msg.chat.id, UI.status(user));
  },

  myrank: (bot, msg, user) => {
    bot.sendMessage(msg.chat.id, UI.myrank(user));
  },

  top10: (bot, msg, users) => {
    bot.sendMessage(msg.chat.id, UI.top10(users));
  }
};

module.exports = commands;
