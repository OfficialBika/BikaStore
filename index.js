const fetch = require("node-fetch");

const token = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;

async function sendOrder(message) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message
    })
  });
}
