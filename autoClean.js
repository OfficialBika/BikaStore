'use strict';

module.exports = function attachAutoClean(bot, options = {}) {
  const { skipChatIds = [], memoryLimit = 200 } = options;

  const skipSet = new Set(skipChatIds.map(String));
  const chatMessages = new Map(); // chatId -> [messageId...]

  function remember(chatId, messageId) {
    const key = String(chatId);
    if (skipSet.has(key)) return;
    if (!chatMessages.has(key)) chatMessages.set(key, []);
    const list = chatMessages.get(key);
    list.push(messageId);
    if (list.length > memoryLimit) {
      list.splice(0, list.length - memoryLimit);
    }
  }

  function wrapSend(methodName) {
    if (typeof bot[methodName] !== 'function') return;
    const original = bot[methodName].bind(bot);

    bot[methodName] = async (...args) => {
      const res = await original(...args);
      try {
        const chatId = args[0];
        if (res && typeof res.message_id !== 'undefined') {
          remember(chatId, res.message_id);
        }
      } catch (_) {}
      return res;
    };
  }

  wrapSend('sendMessage');
  wrapSend('sendPhoto');
  wrapSend('sendDocument');
  wrapSend('sendAnimation');
  wrapSend('sendVideo');

  async function cleanChat(chatId, opts = {}) {
    const { keepLast = 0 } = opts;
    const key = String(chatId);
    const list = chatMessages.get(key);
    if (!list || !list.length) return;

    const cutIndex = Math.max(0, list.length - keepLast);
    const toDelete = list.slice(0, cutIndex);
    const keep = list.slice(cutIndex);
    chatMessages.set(key, keep);

    for (const msgId of toDelete) {
      try {
        await bot.deleteMessage(chatId, msgId);
      } catch (e) {
        // already deleted / too old → မလုပ်ဘူး
      }
    }
  }

  return { cleanChat };
};
