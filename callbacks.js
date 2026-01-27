const UI = require("./ui");

// helper
function isAdmin(chatId, adminIds) {
  return adminIds.includes(String(chatId));
}

const callbacks = async (bot, query, context) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // ---------- STATIC CALLBACKS ----------
  if (data === "MLBB") {
    return bot.sendMessage(chatId, UI.orderForm());
  }

  if (data === "BACK_MENU") {
    const menu = UI.mainMenu();
    return bot.sendMessage(chatId, menu.text, {
      reply_markup: menu.keyboard
    });
  }

  // ---------- DYNAMIC CALLBACKS ----------
  if (data.startsWith("APPROVE_")) {
    const orderId = data.replace("APPROVE_", "");

    if (!isAdmin(chatId, context.ADMIN_CHAT_IDS)) {
      return bot.answerCallbackQuery(query.id, {
        text: "⛔ Admin only",
        show_alert: true
      });
    }

    return context.approveOrder(bot, query, orderId);
  }

  if (data.startsWith("REJECT_")) {
    const orderId = data.replace("REJECT_", "");

    if (!isAdmin(chatId, context.ADMIN_CHAT_IDS)) {
      return bot.answerCallbackQuery(query.id, {
        text: "⛔ Admin only",
        show_alert: true
      });
    }

    return context.rejectOrder(bot, query, orderId);
  }

  // ---------- FALLBACK ----------
  bot.answerCallbackQuery(query.id, {
    text: "⚠️ Unknown action",
    show_alert: false
  });
};

module.exports = callbacks;
