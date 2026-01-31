// bot/callbacks/order.callback.js — Game Item Order Flow

const { bot } = require("../bot");
const { parseGameId, parseItems } = require("../../utils/parser");
const { formatMMK } = require("../../utils/helpers");
const { makeOrderSession, confirmOrderUI } = require("../../services/order.service");
const { touchUser } = require("../../services/user.service");

bot.on("callback_query", async (ctx) => {
  const { data, message, from } = ctx;
  if (!data.startsWith("order:")) return;

  const [, gameCode, itemCode] = data.split(":");

  const gameId = parseGameId(gameCode);
  const item = parseItems(gameCode).find((i) => i.code === itemCode);
  if (!item) return ctx.answerCallbackQuery({ text: "Invalid item.", show_alert: true });

  await touchUser(from);
  await makeOrderSession(from.id, gameId, item);

  const price = formatMMK(item.price);
  const caption = `🛒 <b>Order Summary</b>\n\n🎮 Game: <b>${gameId}</b>\n📦 Item: <b>${item.name}</b>\n💵 Price: <b>${price}</b>\n\nသင့်အမှာစာကို အတည်ပြုရန် Confirm ကိုနှိပ်ပါ။`;

  const buttons = {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Confirm", callback_data: `confirm:${gameCode}:${itemCode}` },
        { text: "❌ Cancel", callback_data: `cancel_order` },
      ]],
    },
    parse_mode: "HTML",
  };

  await bot.sendMessage(from.id, caption, buttons);
  ctx.answerCallbackQuery();
});
