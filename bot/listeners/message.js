// bot/listeners/message.js — Handle Text Messages

const { bot } = require("../bot"); const { mentionUserHTML } = require("../../utils/html");

bot.on("message", async (ctx) => { const { message, from } = ctx;

// Only respond to text messages if (!message.text) return;

const mention = mentionUserHTML(from); const text = message.text.trim();

// Example greeting auto-reply if (/(hi|hello|hey|မင်္ဂလာပါ)/i.test(text)) { return bot.sendMessage( message.chat.id, 👋 မင်္ဂလာပါ ${mention}! Bika Store Bot မှကြိုဆိုပါတယ်။\n/menu မှာ သုံးနိုင်တဲ့ပစ္စည်းစာရင်းတွေရှိပါတယ်။, { parse_mode: "HTML" } ); }

// Unknown message fallback return bot.sendMessage( message.chat.id, 🤖 မသိသော command တစ်ခုဖြစ်နေပါတယ်။ /start နဲ့စပြီးအသုံးပြုနိုင်ပါတယ်။ ); });
