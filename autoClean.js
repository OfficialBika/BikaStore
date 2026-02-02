// autoClean.js
'use strict';

/**
 * Auto clean helper
 *
 * - index.js ကနေ attachAutoClean(bot, { skipChatIds }) လို့ ခေါ်သုံးမယ်
 * - Bot / User messages အားလုံးကို per chatId ဆိုပြီး မှတ်ထားမယ်
 * - index.js ထဲက order complete ဖြစ်သွားတဲ့အချိန်
 *      autoClean.cleanChat(chatId, { keepLast: 1 })
 *   လို့ ခေါ်လိုက်ရင်
 *      => အဲဒီ chat ထဲက message တွေအားလုံးကို ဖျတ်ပြီး နောက်ဆုံး 1 ခုပဲ ကျန်စေမယ်
 */

module.exports = function attachAutoClean(bot, options = {}) {
  const skipChatIds = new Set((options.skipChatIds || []).map(String));

  // chatId => [messageId, ...]
  const chatHistory = new Map();

  function trackMessage(chatId, messageId) {
    const key = String(chatId);
    if (skipChatIds.has(key)) return; // admin တွေကို skip
    const list = chatHistory.get(key) || [];
    list.push(messageId);
    chatHistory.set(key, list);
  }

  // 📨 user / bot ရဲ့ incoming messages မှတ်မယ်
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    trackMessage(chatId, msg.message_id);
  });

  // 📨 bot.sendMessage ကို wrap လုပ်ပြီး bot ပို့တဲ့ messages အစုံကိုလည်း track မယ်
  const origSendMessage = bot.sendMessage.bind(bot);
  bot.sendMessage = async (...args) => {
    const chatId = args[0];
    const res = await origSendMessage(...args);
    try {
      if (res && res.message_id != null) {
        trackMessage(chatId, res.message_id);
      }
    } catch (_) {}
    return res;
  };

  /**
   * cleanChat(chatId, { keepLast })
   *  - chatHistory ထဲက chatId အတွက် message IDs တွေထဲက
   *    နောက်ဆုံး keepLast ခု ချန်ပြီး လျှော်တာ
   */
  async function cleanChat(chatId, opts = {}) {
    const key = String(chatId);
    const keepLast =
      typeof opts.keepLast === 'number' && opts.keepLast >= 0
        ? opts.keepLast
        : 1;

    const list = chatHistory.get(key);
    if (!list || !list.length) return;

    const cutIndex = Math.max(0, list.length - keepLast);
    const toDelete = list.slice(0, cutIndex);
    const toKeep = list.slice(cutIndex);

    for (const mid of toDelete) {
      try {
        await bot.deleteMessage(chatId, mid);
      } catch (e) {
        // delete မရရင်လည်း ထပ်မသိမ်းတော့ဘူး (too old / permission / already deleted)
        // console.log('delete fail', chatId, mid, e.message);
      }
    }

    chatHistory.set(key, toKeep);
  }

  // index.js ကနေ cleanChat ကိုသုံးဖို့ expose လုပ်ပေးမယ်
  return {
    cleanChat,
  };
};
