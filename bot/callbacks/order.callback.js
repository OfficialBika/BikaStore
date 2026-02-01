const { bot } = require("../bot");
const { Order } = require("../../models/Order");
const { sendPrompt } = require("../../utils/helpers");

bot.on("callback_query", async (q) => {
  const cid = q.message.chat.id;
  const uid = String(q.from.id);

  if (!q.data.startsWith("GAME_")) return;

  const game = q.data.replace("GAME_", "");
  const order = await Order.findOne({ userId: uid, status: "PENDING" }).sort({ createdAt: -1 });

  if (!order) {
    return bot.answerCallbackQuery(q.id, {
      text: "❌ Order not found or already processed!",
      show_alert: true,
    });
  }

  order.game = game;
  order.step = "SERVER_SELECT";
  await order.save();

  const nextText = `🎮 Game Selected: <b>${game}</b>\n\n➡️ Please choose your server`;
  await bot.editMessageText(nextText, {
    chat_id: cid,
    message_id: q.message.message_id,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌐 Asia", callback_data: `SERVER_Asia` }],
        [{ text: "🌍 Europe", callback_data: `SERVER_Europe` }],
      ],
    },
  });

  bot.answerCallbackQuery(q.id);
});
