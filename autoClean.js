'use strict';

/**
 * Simple chat auto-clean helper for BIKA Store Bot
 *
 * Usage in index.js:
 *
 *   const attachAutoClean = require('./autoClean');
 *   const autoClean = attachAutoClean(bot, { skipChatIds: ADMIN_IDS });
 *
 *   // later, when order complete:
 *   await autoClean.cleanChat(order.userId, { keepLast: 1 });
 */

module.exports = function attachAutoClean(bot, options = {}) {
  const skipChatIds = new Set((options.skipChatIds || []).map(String));
  const maxPerChat = options.maxPerChat || 200; // how many message_ids to remember per chat

  // chatId(string) -> [message_id, ...]
  const chatStore = new Map();

  function rememberMessage(chatId, messageId) {
    const key = String(chatId);
    if (skipChatIds.has(key)) return;
    if (!messageId && messageId !== 0) return;

    let list = chatStore.get(key);
    if (!list) {
      list = [];
      chatStore.set(key, list);
    }
    list.push(messageId);

    // keep memory small
    if (list.length > maxPerChat) {
      list.splice(0, list.length - maxPerChat);
    }
  }

  // Incoming user messages
  bot.on('message', (msg) => {
    try {
      const chatId = msg.chat.id;
      rememberMessage(chatId, msg.message_id);
    } catch (_) {
      // ignore
    }
  });

  // Wrap outgoing send* methods to remember bot messages as well
  function wrapSendMethod(methodName) {
    if (typeof bot[methodName] !== 'function') return;

    const original = bot[methodName].bind(bot);

    bot[methodName] = async function (chatId, ...args) {
      const res = await original(chatId, ...args);

      try {
        // sendMessage / sendPhoto / sendVideo / sendDocument return a single Message
        if (res && typeof res.message_id === 'number') {
          rememberMessage(chatId, res.message_id);
        }
        // sendMediaGroup returns an array of Messages
        if (Array.isArray(res)) {
          res.forEach((m) => {
            if (m && typeof m.message_id === 'number') {
              rememberMessage(chatId, m.message_id);
            }
          });
        }
      } catch (_) {
        // ignore
      }

      return res;
    };
  }

  [
    'sendMessage',
    'sendPhoto',
    'sendVideo',
    'sendDocument',
    'sendAnimation',
    'sendMediaGroup',
  ].forEach(wrapSendMethod);

  /**
   * Clean chat by deleting remembered messages.
   * @param {number|string} chatId
   * @param {object} options
   *   - keepLast: number of newest messages to keep (default 0 = delete all)
   */
  async function cleanChat(chatId, options = {}) {
    const key = String(chatId);
    const keepLast =
      typeof options.keepLast === 'number' && options.keepLast > 0
        ? options.keepLast
        : 0;

    const list = chatStore.get(key);
    if (!list || !list.length) return;

    // Which message_ids to delete
    const toDelete =
      keepLast > 0 ? list.slice(0, -keepLast) : list.slice();

    for (const mid of toDelete) {
      try {
        await bot.deleteMessage(chatId, mid);
      } catch (_) {
        // can fail if message already deleted or too old → ignore
      }
    }

    // Keep last N in memory (or empty)
    const remaining = keepLast > 0 ? list.slice(-keepLast) : [];
    chatStore.set(key, remaining);
  }

  return {
    cleanChat,
  };
};
