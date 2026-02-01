const { bot } = require("../bot");
const { Order } = require("../../models/Order");
const { parseItems, parseGameId } = require("../../utils/parser");
const { formatMMK } = require("../../utils/helpers");

bot.on("callback_query", async (q) => {
  const cid = q.message.chat.id;
  const uid = String(q.from.id);

  if (!q.data.startsWith("ORDER_ITEM_")) return;

  const data = q.data.replace("ORDER_ITEM_", "");
  const [game, itemId] = data.split("_");

  const { itemName, itemPrice } = parseItems(game, itemId);
  if (!itemName || !itemPrice) {
    return bot.answerCallbackQuery(q.id, {
      text: "❌ Invalid item selected!",
      show_alert: true,
    });
  }

  // Check if there's a pending order
  let order = await Order.findOne({ userId: uid, status: "PENDING" }).sort({ createdAt: -1 });

  if (!order) {
    order = new Order({
      userId: uid,
      username: q.from.username,
      firstName: q.from.first_name,
      status: "PENDING",
      items: [],
      totalPrice: 0,
    });
  }

  order.items.push({ itemId, name: itemName, price: itemPrice });
  order.totalPrice += itemPrice;

  await order.save();

  const summary = order.items
    .map((i, idx) => `#${idx + 1} ${i.name} — <code>${formatMMK(i.price)} MMK</code>`)
    .join("\n");

  const text = `🧾 <b>Order Updated</b>\n━━━━━━━━━━━━━━\n${summary}\n━━━━━━━━━━━━━━\n💰 Total: <b>${formatMMK(order.totalPrice)} MMK</b>`;

  await bot.editMessageText(text, {
    chat_id: cid,
    message_id: q.message.message_id,
    parse_mode: "HTML",
  });

  bot.answerCallbackQuery(q.id, {
    text: `✅ Added: ${itemName}`,
    show_alert: false,
  });
});
