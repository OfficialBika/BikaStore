// utils/helpers.js — Common Utility Helpers

function formatMMK(amount) { return amount?.toLocaleString("en-US") + " Ks"; }

async function deleteIfPossible(ctx) { try { if (ctx?.message?.message_id) { await ctx.deleteMessage(ctx.message.message_id); } else if (ctx?.callbackQuery?.message?.message_id) { await ctx.deleteMessage(ctx.callbackQuery.message.message_id); } } catch (err) { console.warn("⚠️ Failed to delete message:", err.message); } }

module.exports = { formatMMK, deleteIfPossible, };
