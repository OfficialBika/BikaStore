// bot/handlers/start.js — Handle /start Command

const { bot } = require("../bot");
const { mentionUserHTML } = require("../../utils/html");
const { sendPrompt } = require("../../utils/helpers");
const { touchUser, touchChat } = require("../../services/user.service");
const session = require("../../session/session");

bot.onText(/^\/start/, async (msg) => {
  const cid = msg.chat.id;

  await touchUser(msg.from);
  await touchChat(msg.chat);

  const s = session[cid] || (session[cid] = {
    step: "GAME_SELECT",
    game: null,
    gameId: null,
    serverId: null,
    items: null,
    totalPrice: 0,
    orderId: null,
    orderNo: null,
    orderDateText: null,
    paymentMethod: null,
    userMentionHTML: mentionUserHTML(msg.from),
  });

  const startText = `မင်္ဂလာပါ ${s.userMentionHTML} ရေ

Bika Store မှ ကြိုဆိုပါတယ်ဗျ။

အောက်ပါ Game များမှ သင်ဝယ်ယူလိုတဲ့ Game ကို ရွေးချယ်ပေးပါ`;

  await sendPrompt(cid, s, startText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎮 MLBB", callback_data: "GAME_MLBB" }],
        [{ text: "🎮 PUBG", callback_data: "GAME_PUBG" }],
      ],
    },
  });
});
