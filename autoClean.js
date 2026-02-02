'use strict';

/**
 * attachAutoClean(bot, { skipChatIds })
 *
 * - Messages ကို သာရီသိမ်းထားပေးတယ် (chat အလိုက် message_id list)
 * - ဘာ message ကိုမှ auto delete မလုပ်ပါ
 * - index.js ထဲကနေ autoClean.cleanChat(chatId, { keepLast })
 *   ကိုခေါ်မရင် ဘာမှ မဖျက်ပါ
 */

module.exports = function attachAutoClean(bot, options = {}) {
  const { skipChatIds = [], memoryLimit = 200 } = options;

  const skipSet = new Set(skipChatIds.map(String));
  const chatMessages = new Map(); // key: chatId(string) -> [messageId...]

  function remember(chatId, messageId) {
    const key = String(chatId);
    if (skipSet.has(key)) return;
    if (!chatMessages.has(key)) chatMessages.set(key, []);
    const list = chatMessages.get(key);
    list.push(messageId);
    // များလွန်းရင် အဟောင်းအောက်ဆုံးတွေ ဖျက်ထုတ်ပစ်
    if (list.length > memoryLimit) {
      list.splice(0, list.length - memoryLimit);
    }
  }

  // send* methods တွေကို "မှတ်တမ်းစာရင်းပဲ ထည့်မယ်" ဆိုပြီး wrap လုပ်ထားမယ်
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

  // Manual clean – chat ထဲက message တွေကို သုတ်ဖို့
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
        // already deleted / too old / etc. → ငြင်းပယ်ထားပါ
      }
    }
  }

  return { cleanChat };
};
