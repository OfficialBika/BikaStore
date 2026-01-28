// ===============================
// ADMIN HANDLERS (BIKA STORE - STABLE)
// ===============================

const orders = require("./orders");
const ui = require("./ui");
const { isAdmin, monthRange } = require("./helpers");
const User = require("./models/User");

// ===============================
// ADMIN MESSAGE HANDLER
// ===============================
async function onMessage({ bot, msg, ADMIN_IDS }) {
  const chatId = msg.chat.id.toString();
  const text = (msg.text || "").trim();

  // 🛑 admin only
  if (!isAdmin(chatId, ADMIN_IDS)) return;

  try {
    // ===============================
    // /status
    // ===============================
    if (text === "/status") {
      const stats = await orders.getStatusStats(true);
      return bot.sendMessage(
        chatId,
        ui.statusUI(stats),
        { parse_mode: "Markdown" }
      );
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

      return bot.sendMessage(
        chatId,
        ui.top10UI(list),
        { parse_mode: "Markdown" }
      );
    }

    // ===============================
    // /myrank
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
    if (text.startsWith("/broadcast")) {
      const message = text.replace("/broadcast", "").trim();
      if (!message) {
        return bot.sendMessage(
          chatId,
          "❗ Usage:\n/broadcast Your message here"
        );
      }

      const users = await User.find({}, { userId: 1 });

      let success = 0;
      let fail = 0;

      for (const u of users) {
        try {
          await bot.sendMessage(
            u.userId,
            `📢 *Broadcast*
━━━━━━━━━━━━━━━

${message}`,
            { parse_mode: "Markdown" }
          );
          success++;
        } catch {
          fail++;
        }
      }

      return bot.sendMessage(
        chatId,
        `✅ *Broadcast Completed*
━━━━━━━━━━━━━━━
👥 Sent: ${success}
🚫 Failed: ${fail}`,
        { parse_mode: "Markdown" }
      );
    }

  } catch (err) {
    console.error("Admin handler error:", err);
    await bot.sendMessage(
      chatId,
      "⚠️ Admin command error occurred"
    );
  }
}

// ===============================
module.exports = {
  onMessage
};
