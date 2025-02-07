const db = require("../utils/database");

module.exports = {
  name: "top_messages",
  async execute(interaction) {
    const topUsers = db
      .prepare(
        "SELECT user_id, total_messages FROM message_count ORDER BY total_messages DESC LIMIT 20"
      )
      .all();

    if (topUsers.length === 0) {
      await interaction.reply("🔹 Brak danych do wyświetlenia.");
      return;
    }

    let leaderboard = "**💬 Top 20 użytkowników (wiadomości) 💬**\n";
    topUsers.forEach((user, index) => {
      leaderboard += `**${index + 1}. <@${user.user_id}>** – ${
        user.total_messages
      } wiadomości\n`;
    });

    await interaction.reply(leaderboard);
  },
};
