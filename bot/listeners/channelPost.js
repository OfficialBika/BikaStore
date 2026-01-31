// bot/listeners/channelPost.js — Handle Channel Giveaway Post Entry

const { bot } = require("../bot"); const { handleGiveawayEntry } = require("../../services/giveaway.service");

bot.on("channel_post", async (ctx) => { const { channelPost } = ctx; if (!channelPost || !channelPost.text) return;

// Detect special giveaway format or hashtag like #BIKA_GIVEAWAY const isGiveaway = /#BIKA_GIVEAWAY/i.test(channelPost.text); if (!isGiveaway) return;

// Register post as a giveaway entry try { await handleGiveawayEntry(channelPost); } catch (err) { console.error("❌ Error handling giveaway post:", err); } });
