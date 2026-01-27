// ===============================
// USER FLOW HANDLER (FINAL)
// ===============================

const PRICES = require("./prices");
const ui = require("./ui");
const orders = require("./orders");

// ===============================
// TEXT MESSAGE HANDLER
// ===============================
async function onMessage(bot, msg, temp) {
  const chatId = msg.chat.id.toString();
  const text = msg.text;

  if (!text) return;

  // ===============================
  // START COMMAND
  // ===============================
  if (text === "/start") {
    temp[chatId] = {
      step: null
    };

    return bot.sendMessage(
      chatId,
      "👋 Welcome to BikaStore!\n\nGame တစ်ခုကို ရွေးပါ ⬇️",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💎 MLBB Diamonds", callback_data: "MLBB" }],
            [{ text: "🎯 PUBG UC", callback_data: "PUBG" }]
          ]
        }
      }
    );
  }

  const t = temp[chatId];
  if (!t) return;

  try {
    // ===============================
    // GAME ID INPUT
    // ===============================
    if (t.step === "GAME") {
      if (t.product === "MLBB") {
        const match = text.match(/^(\d+)[\s(]+(\d+)\)?$/);
        if (!match) {
          return bot.sendMessage(
            chatId,
            "❌ Format မမှန်ပါ\n`12345678 1234`",
            { parse_mode: "Markdown" }
          );
        }
        t.gameId = match[1];
        t.serverId = match[2];
      } else {
        t.gameId = text.trim();
        t.serverId = "-";
      }

      t.step = "ITEM_SELECT";
      t.items = [];
      t.totalPrice = 0;

      return bot.sendMessage(chatId, "🛒 Diamond Amount ကို ရွေးပါ");
    }

    // ===============================
    // ITEM SELECT
    // ===============================
    if (t.step === "ITEM_SELECT") {
      const product = PRICES[t.product];
      const item = product.items.find(i => i.label === text.trim());

      if (!item) {
        return bot.sendMessage(chatId, "❌ မမှန်တဲ့ Package ပါ");
      }

      t.items.push(item);
      t.totalPrice += item.price;

      t.step = "CONFIRM";
      t.orderId = `BKS-${Date.now()}`;

      const preview = {
        orderId: t.orderId,
        product: t.product,
        gameId: t.gameId,
        serverId: t.serverId,
        totalPrice: t.totalPrice
      };

      t.previewMsgId = await ui.sendOrderPreview(bot, chatId, preview);
    }
  } catch (err) {
    console.error("User text error:", err);
  }
}

// ===============================
// PAYMENT PHOTO HANDLER
// ===============================
async function onPhoto(bot, msg, temp, ADMIN_IDS) {
  const chatId = msg.chat.id.toString();
  const t = temp[chatId];

  if (!t || t.step !== "PAYMENT") return;

  try {
    await orders.createOrder({
      bot,
      msg,
      temp,
      ADMIN_IDS
    });
  } catch (err) {
    console.error("Payment photo error:", err);
  }
}

module.exports = {
  onMessage,
  onPhoto
};
