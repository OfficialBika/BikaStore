// bot/callbacks/payment.callback.js — Payment Method & Proof Flow

const { bot } = require("../bot"); const { PAYMENTS } = require("../../config/payments"); const { formatMMK } = require("../../utils/helpers"); const { touchUser } = require("../../services/user.service");

bot.on("callback_query", async (ctx) => { const { data, from } = ctx; if (!data.startsWith("pay:")) return;

const method = data.split(":")[1]; const payment = PAYMENTS[method];

if (!payment) { return ctx.answerCallbackQuery({ text: "Invalid payment method.", show_alert: true }); }

await touchUser(from);

const text = 💵 <b>ငွေပေးချေမှု ( ${payment.name} )</b>\n\n + 📱 <b>နာမည်:</b> ${payment.name}\n + 📞 <b>ဖုန်းနံပါတ်:</b> ${payment.accountNumber}\n\n + 🧾 ငွေလွဲပြီးပါက <b>Screenshot</b> တင်ပေးပါ။;

await bot.sendPhoto(from.id, payment.qr, { caption: text, parse_mode: "HTML", reply_markup: { inline_keyboard: [ [ { text: "📸 ငွေလွဲ Screenshot တင်မယ်", callback_data: upload_proof:${method} }, ], [ { text: "🔙 နောက်သို့", callback_data: "cancel_order" }, ], ], }, });

ctx.answerCallbackQuery(); });
