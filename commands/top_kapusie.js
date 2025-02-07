const db = require("../utils/database");

module.exports = {
  name: "top_kapusie",
  async execute(interaction) {
    const topKapusie = db
      .prepare(
        "SELECT user_id, total_days FROM kapus_count ORDER BY total_days DESC LIMIT 10"
      )
      .all();

    if (topKapusie.length === 0) {
      await interaction.reply("🔹 Brak danych do wyświetlenia.");
      return;
    }

    let leaderboard = "**🕵️ Top 10 Kapusiów 🕵️**\n";
    topKapusie.forEach((user, index) => {
      leaderboard += `**${index + 1}. <@${user.user_id}>** – ${
        user.total_days
      } dni kapusiowania\n`;
    });

    await interaction.reply(leaderboard);
  },
};
