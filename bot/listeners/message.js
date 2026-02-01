// bot/listeners/message.js — Handle incoming messages (text, screenshot, etc)

const { bot } = require("../bot");
const { Order } = require("../../models/Order");
const { isPhoto } = require("../../utils/helpers");

bot.on("message", async (msg) => {
  const cid = msg.chat.id;
  const uid = String(msg.from.id);

  // Only process photo or caption as proof of payment
  const isProof = msg.photo || (msg.document && msg.caption);

  if (!isProof) return;

  const order = await Order.findOne({ userId: uid, status: "PENDING" }).sort({ createdAt: -1 });
  if (!order) return;

  order.paymentProof = isPhoto(msg) ? msg.photo.at(-1).file_id : msg.document?.file_id;
  order.status = "WAITING";
  await order.save();

  await bot.sendMessage(cid, "📩 Payment proof accepted. Admin will verify soon.", {
    parse_mode: "HTML",
  });
});
