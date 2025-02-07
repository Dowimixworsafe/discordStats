const db = require("../utils/database");

module.exports = {
  name: "top",
  async execute(interaction) {
    const topUsers = db
      .prepare(
        "SELECT user_id, total_time FROM voice_time ORDER BY total_time DESC LIMIT 20"
      )
      .all();

    if (topUsers.length === 0) {
      await interaction.reply("🔹 Brak danych do wyświetlenia.");
      return;
    }

    let leaderboard = "**🏆 Top 20 użytkowników 🏆**\n";
    topUsers.forEach((user, index) => {
      leaderboard += `**${index + 1}. <@${user.user_id}>** – ${Math.floor(
        user.total_time / 60
      )} min\n`;
    });

    await interaction.reply(leaderboard);
  },
};
