// autoClean.js
'use strict';

/**
 * Per-chat Auto Clean (keep last 2 bot messages)
 *
 * Idea:
 *   - Chat တစ်ခါစီ마다 bot က မက်ဆေ့အသစ်ပို့တိုင်း
 *     အရင်က bot messages တွေထဲက "အဟောင်းဆုံး" ကို ဖြုတ်ပေးမယ်
 *   - အမြဲနေတတ်မှာက "နောက်ဆုံး 2 ခု" ပဲ
 *
 * Usage (index.js ထဲ):
 *   const attachAutoClean = require('./autoClean');
 *   attachAutoClean(bot, { skipChatIds: ADMIN_IDS });
 */

module.exports = function attachAutoClean(bot, options = {}) {
  // auto clean မလုပ်ချင်တဲ့ chatId list (ဥပမာ admin user ids)
  const skipChatIds = new Set(
    (options.skipChatIds || []).map((id) => String(id))
  );

  // chatId => [msgId1, msgId2]  (အများဆုံး 2 ခု만 သိမ်းမယ်)
  const lastMsgsByChat = new Map();

  async function safeDelete(chatId, msgId) {
    if (!msgId) return;
    try {
      await bot.deleteMessage(chatId, msgId);
    } catch (e) {
      if (process.env.DEBUG_AUTOCLEAN === '1') {
        console.error(
          'AutoClean delete failed:',
          chatId,
          msgId,
          e.message
        );
      }
    }
  }

  function wrap(methodName) {
    if (typeof bot[methodName] !== 'function') return;
    const original = bot[methodName].bind(bot);

    bot[methodName] = async (...args) => {
      const chatId = args[0];
      const key = String(chatId);

      // skip list ထဲမပါတဲ့ chat တွေကိုပဲ auto clean
      if (!skipChatIds.has(key)) {
        const list = lastMsgsByChat.get(key) || [];

        // အသစ်ပို့ဖို့မတိုင်မီ လက်ရှိရှိပြီးသားက 2ခု/2ခုထက်ပိုသွားရင်
        // အဟောင်းဆုံးတွေကို စနစ်လိုက် ဖျတ်မယ် (oldest first)
        while (list.length >= 2) {
          const oldId = list.shift();
          await safeDelete(chatId, oldId);
        }

        lastMsgsByChat.set(key, list);
      }

      // အခုမှ သာမန် sendMessage / sendPhoto စတာတွေ run မယ်
      const sent = await original(...args);

      // ပို့အောင်မြင်ရင် အသစ် msgId ကို ရရှိတဲ့ chat ရဲ့ list ထဲ push
      if (sent && sent.message_id && sent.chat && sent.chat.id) {
        const cId = sent.chat.id;
        const k = String(cId);

        if (!skipChatIds.has(k)) {
          const list = lastMsgsByChat.get(k) || [];
          list.push(sent.message_id);

          // တစ်ခါတလေ logic race ကြောင့် 3 ခုကျော်သွားရင်လည်း
          // နောက်ထပ် oldest မက်ဆေ့ကို ဖျတ်ပြီး နောက်ဆုံး 2 ခုပဲ ဆက်ထားမယ်
          while (list.length > 2) {
            const oldId = list.shift();
            await safeDelete(cId, oldId);
          }

          lastMsgsByChat.set(k, list);
        }
      }

      return sent;
    };
  }

  // အများဆုံးသုံးဖြစ်မယ့် methods တွေကို wrap လုပ်ထားမယ်
  [
    'sendMessage',
    'sendPhoto',
    'sendDocument',
    'sendVideo',
    'sendAnimation',
  ].forEach(wrap);

  console.log(
    '🧼 AutoClean enabled – each chat keeps only the latest 2 bot messages.'
  );
};
