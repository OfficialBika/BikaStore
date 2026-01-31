// bot/commands.js — Register Bot Commands

const { bot } = require("./bot");

async function setupCommands() { try { await bot.setMyCommands([ { command: "start", description: "စတင်ရန်" }, { command: "top10", description: "6လ Top 10 Spend List" }, { command: "myrank", description: "သင့် Level / Rank" }, { command: "promo", description: "Giveaway ကြည့်ရန်" }, { command: "admin", description: "Admin Dashboard (Admin only)" }, { command: "promocreate", description: "Promo Create (Admin only)" }, { command: "broadcast", description: "Broadcast (Admin only)" }, { command: "pickwinner", description: "Channel Giveaway Winner Pick (Admin only)" }, { command: "winnerlist", description: "Winner History (this group)" }, ]); console.log("\u2705 Bot commands registered"); } catch (e) { console.error("❌ setMyCommands error:", e?.message || e); } }

setupCommands();
