// bot/listeners/photo.js — Handle Payment Proof Uploads

const { bot } = require("../bot"); const { savePaymentProof } = require("../../services/order.service");

bot.on("photo", async (ctx) => { const { message } = ctx; const { from, photo, caption } = message;

if (!photo || !from) return;

const file = photo[photo.length - 1]; // Get highest resolution const fileId = file.file_id;

// Save payment proof for latest order session await savePaymentProof(from.id, fileId);

await bot.sendMessage( from.id, 📸 ငွေလွဲပုံတင်ခြင်းအောင်မြင်ပါသည်။\n\n📤 Admin team သို့ ပေးပို့စစ်ဆေးနေပါပြီ။ခေတ္တစောင့်ပါ။ ); });
