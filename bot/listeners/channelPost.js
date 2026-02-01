// bot/listeners/channelPost.js — Handle posts from linked channels

const { bot } = require("../bot");
const { GiveawayPost } = require("../../models/GiveawayPost");

bot.on("channel_post", async (msg) => {
  const cid = msg.chat.id;

  // Only process posts with PROMO tag
  if (!msg.text || !msg.text.includes("#PROMO")) return;

  const record = new GiveawayPost({
    channelId: cid,
    messageId: msg.message_id,
    text: msg.text,
    createdAt: new Date(),
  });

  await record.save();
});
