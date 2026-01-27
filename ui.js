const UI = {
  // =====Order form====//
  orderForm: () => `
🎮 ORDER INFORMATION
━━━━━━━━━━━━━━━━━━
🕹 Game        : MLBB Diamonds
🆔 Game ID     :
🌐 Server ID   :

✍️ Format:
12345678(1234)
━━━━━━━━━━━━━━━━━━
`,
  
// =====Order Preview====//
  orderPreview: (order) => `
📦 ORDER PREVIEW
━━━━━━━━━━━━━━━━━━
🆔 Order ID : ${order.orderId}
🎮 Game     : ${order.game}
🆔 Game ID  : ${order.gameId}

💎 Items:
${order.items.map(i => `• ${i}`).join("\n")}

💰 Total    : ${order.total} MMK
━━━━━━━━━━━━━━━━━━
`,

  paymentKPay: () => `
💜 KBZ Pay Payment
━━━━━━━━━━━━━━━━━━
📱 Phone : 09264202637
👤 Name  : Shine Htet Aung

📸 Screenshot ပုံပို့ပါ
━━━━━━━━━━━━━━━━━━
`
};

module.exports = UI;
