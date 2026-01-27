// ===============================
// ADMIN HANDLERS (FINAL)
// ===============================

const orders = require("./orders");
const ui = require("./ui");
const { isAdmin, monthRange } = require("./src/models/helpers");

// ===============================
// ADMIN MESSAGE HANDLER
// ===============================
async function onMessage({ bot, msg, ADMIN_IDS }) {
  const chatId = msg.chat.id.toString();
  const text = msg.text || "";

  // admin only
  if (!isAdmin(chatId, ADMIN_IDS)) return;

  try {
    // ===============================
    // /status
    // ===============================
    if (text === "/status") {
      const stats = await orders.getStatusStats(true);
      return bot.sendMessage(chatId, ui.statusUI(stats), {
        parse_mode: "Markdown"
      });
    }

    // ===============================
    // /top10
    // ===============================
    if (text === "/top10") {
      const { start, end } = monthRange();
      const list = await orders.getTop10(start, end);

      if (!list.length) {
        return bot.sendMessage(chatId, "📭 ဒီလ Order မရှိသေးပါ");
      }

      return bot.sendMessage(chatId, ui.top10UI(list), {
        parse_mode: "Markdown"
      });
    }

    // ===============================
    // /myrank (admin self rank)
    // ===============================
    if (text === "/myrank") {
      const { start, end } = monthRange();
      const rank = await orders.getUserRank(chatId, start, end);

      if (!rank) {
        return bot.sendMessage(chatId, "📭 ဒီလ Order မရှိသေးပါ");
      }

      return bot.sendMessage(
        chatId,
        ui.myRankUI(rank.rank, rank.total),
        { parse_mode: "Markdown" }
      );
    }

    // ===============================
    // /broadcast <message>
    // ===============================
    if (text.startsWith("/broadcast ")) {
      const message = text.replace("/broadcast ", "").trim();
      if (!message) return;

      const User = require("./src/models/User");
      const users = await User.find({}, { userId: 1 });

      let success = 0;
      for (const u of users) {
        try {
          await bot.sendMessage(
            u.userId,
            `📢 *Broadcast*\n━━━━━━━━━━━━━━━\n\n${message}`,
            { parse_mode: "Markdown" }
          );
          success++;
        } catch {
          // ignore blocked users
        }
      }

      return bot.sendMessage(
        chatId,
        `✅ Broadcast sent\n👥 Users: ${success}`,
        { parse_mode: "Markdown" }
      );
    }

  } catch (err) {
    console.error("Admin handler error:", err);
    bot.sendMessage(chatId, "⚠️ Admin command error");
  }
}

// ===============================
module.exports = {
  onMessage
};
