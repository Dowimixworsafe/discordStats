const db = require("../utils/database");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");

module.exports = {
  name: "top_songs",
  description: "Wyświetla najczęściej wyszukiwane piosenki",
  async execute(interaction) {
    try {
      const topSongs = db
        .prepare(
          "SELECT title, platform, count FROM song_stats ORDER BY count DESC LIMIT 5"
        )
        .all();

      if (!topSongs || topSongs.length === 0) {
        await interaction.reply("🔹 Brak danych o wyszukiwanych piosenkach.");
        return;
      }

      // 🎨 Rozpoczynamy generowanie obrazu
      const width = 900;
      const height = 500;
      const margin = 30;
      const rowHeight = 80;
      const titleHeight = 60;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // 🏆 Tło i nagłówek
      ctx.fillStyle = "#333";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px Arial";
      ctx.fillText("🎶 Top 5 wyszukiwanych piosenek", margin, 50);

      // 📌 Ścieżki do ikon platform
      const platformLogos = {
        Spotify: "./images/spotify-logo.png",
        YouTube: "./images/youtube-logo.png",
        SoundCloud: "./images/soundcloud-logo.png",
      };

      let currentY = titleHeight + 30;

      for (let i = 0; i < topSongs.length; i++) {
        const song = topSongs[i];
        const logoPath = platformLogos[song.platform] || null;

        if (logoPath) {
          try {
            const logo = await loadImage(logoPath);
            ctx.drawImage(logo, margin, currentY, 40, 40); // Ikona platformy
          } catch (error) {
            console.error(`❌ Błąd ładowania logo ${song.platform}:`, error);
          }
        }

        // Tekst piosenki
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Arial";
        ctx.fillText(
          `${i + 1}. ${song.title} 🎶 (${song.count} razy)`,
          margin + 60,
          currentY + 30
        );

        currentY += rowHeight;
      }

      // 📊 Zapis obrazu i wysłanie w Discord
      const buffer = canvas.toBuffer("image/png");
      const imagePath = "./images/top_songs.png";
      fs.writeFileSync(imagePath, buffer);

      const attachment = new AttachmentBuilder(imagePath, {
        name: "top_songs.png",
      });

      await interaction.reply({ files: [attachment] });
    } catch (error) {
      console.error("❌ Błąd w komendzie top_songs:", error);
      await interaction.reply("❌ Wystąpił błąd podczas pobierania danych.");
    }
  },
};
