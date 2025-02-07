const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const db = require("./database"); // Import bazy danych
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function generateWrappedImage(client) {
  const width = 900;
  const margin = 30;
  const rowHeight = 100;
  const categorySpacing = 100;
  const titleHeight = 60;
  const footerHeight = 50;
  const medalSize = 50;
  const avatarSize = 80;

  // Wczytujemy dane z bazy
  const topVoiceUsers = db
    .prepare(
      "SELECT user_id, total_time FROM voice_time ORDER BY total_time DESC LIMIT 5"
    )
    .all();
  const topChatUsers = db
    .prepare(
      "SELECT user_id, total_messages FROM message_count ORDER BY total_messages DESC LIMIT 5"
    )
    .all();
  const mostUsedEmoji = db
    .prepare("SELECT emoji, count FROM emoji_usage ORDER BY count DESC LIMIT 1")
    .get();

  // 🔥 Obliczenie wysokości obrazu
  const totalHeight =
    titleHeight +
    topVoiceUsers.length * rowHeight +
    categorySpacing +
    topChatUsers.length * rowHeight +
    categorySpacing +
    450 +
    footerHeight;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext("2d");

  // 🔥 Wczytanie tła
  try {
    const background = await loadImage("./images/background.png");
    ctx.drawImage(background, 0, 0, width, totalHeight);
  } catch (error) {
    console.error("❌ Błąd ładowania tła:", error);
  }

  // 🏆 Nagłówek
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("📊 Miesięczne Podsumowanie Serwera", margin, 50);

  // 🏅 Wczytanie obrazków medali
  const goldMedal = await loadImage("./images/gold-medal.png");
  const silverMedal = await loadImage("./images/silver-medal.png");
  const bronzeMedal = await loadImage("./images/bronze-medal.png");
  const medals = [goldMedal, silverMedal, bronzeMedal];

  // 📌 Funkcja do pobierania informacji o użytkowniku
  async function getUserInfo(userId) {
    try {
      const user = await client.users.fetch(userId);
      return {
        name: user.username,
        avatarURL: user.displayAvatarURL({ extension: "png", size: 128 }),
      };
    } catch (error) {
      console.error(`❌ Błąd pobierania użytkownika ${userId}:`, error);
      return { name: `Nieznany (${userId})`, avatarURL: null };
    }
  }

  // 📌 Funkcja do rysowania awatarów
  async function drawAvatar(url, x, y, size) {
    if (!url) return;
    const avatarBuffer = await fetch(url).then((res) => res.arrayBuffer());
    const avatar = await loadImage(Buffer.from(avatarBuffer));

    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, x, y, size, size);
    ctx.restore();
  }

  // 📌 Pobieranie URL emotki
  async function getEmojiURL(emoji, client) {
    const emojiRegex = /<a?:\w+:(\d+)>/;
    const match = emoji.match(emojiRegex);

    if (match) {
      const emojiId = match[1];
      return `https://cdn.discordapp.com/emojis/${emojiId}.png`;
    }

    return null; // Jeśli to zwykła emoji, zostawiamy jako tekst
  }

  let currentY = titleHeight + 80;

  // 🎤 TOP 5 UŻYTKOWNIKÓW GŁOSOWYCH
  ctx.fillText("🎤 TOP 5 NA KANAŁACH GŁOSOWYCH:", margin + 20, currentY);
  currentY += 40;

  for (let i = 0; i < topVoiceUsers.length; i++) {
    const { name, avatarURL } = await getUserInfo(topVoiceUsers[i].user_id);

    if (medals[i]) {
      ctx.drawImage(
        medals[i],
        margin + 30,
        currentY + (rowHeight - medalSize) / 2,
        medalSize,
        medalSize
      );
    }

    await drawAvatar(
      avatarURL,
      margin + 100,
      currentY + (rowHeight - avatarSize) / 2,
      avatarSize
    );

    ctx.fillText(
      `${name} – ${Math.floor(topVoiceUsers[i].total_time / 60)} min`,
      margin + 200,
      currentY + rowHeight / 2 + 10
    );

    currentY += rowHeight;
  }

  currentY += categorySpacing - 30;

  // 💬 TOP 5 UŻYTKOWNIKÓW TEKSTOWYCH
  ctx.fillText("💬 TOP 5 NA KANAŁACH TEKSTOWYCH:", margin + 20, currentY);
  currentY += 40;

  for (let i = 0; i < topChatUsers.length; i++) {
    const { name, avatarURL } = await getUserInfo(topChatUsers[i].user_id);

    if (medals[i]) {
      ctx.drawImage(
        medals[i],
        margin + 30,
        currentY + (rowHeight - medalSize) / 2,
        medalSize,
        medalSize
      );
    }

    await drawAvatar(
      avatarURL,
      margin + 100,
      currentY + (rowHeight - avatarSize) / 2,
      avatarSize
    );

    ctx.fillText(
      `${name} – ${topChatUsers[i].total_messages} wiadomości`,
      margin + 200,
      currentY + rowHeight / 2 + 10
    );

    currentY += rowHeight;
  }

  currentY += categorySpacing - 30;

  // 😂 NAJCZĘŚCIEJ UŻYWANA EMOTKA
  ctx.fillText("😂 NAJCZĘŚCIEJ UŻYWANA EMOTKA:", margin + 20, currentY);
  currentY += 80;

  if (mostUsedEmoji) {
    const emojiURL = await getEmojiURL(mostUsedEmoji.emoji, client);

    if (emojiURL) {
      const emojiImage = await loadImage(emojiURL);
      ctx.drawImage(emojiImage, margin + 100, currentY - 40, 80, 80);
    } else {
      ctx.fillText(mostUsedEmoji.emoji, margin + 20, currentY);
    }

    ctx.fillText(
      `Użyta: ${mostUsedEmoji.count} razy`,
      margin + 250,
      currentY + 10
    );
  } else {
    ctx.fillText("Brak danych o emotkach", margin + 20, currentY);
  }

  currentY += 120;

  // 🔥 Funkcja do skracania tekstu, aby nie wychodził poza obraz
  function truncateText(ctx, text, maxWidth) {
    let width = ctx.measureText(text).width;
    if (width <= maxWidth) return text; // Jeśli mieści się, zwracamy oryginalny tekst

    while (ctx.measureText(text + "...").width > maxWidth) {
      text = text.slice(0, -1); // Usuwamy ostatni znak
    }

    return text + "...";
  }

  // 🔥 Funkcja do usuwania "Stream" na początku tytułu
  function cleanSongTitle(title) {
    return title.startsWith("Stream")
      ? title.replace("Stream", "").trim()
      : title;
  }

  // 📌 Pobieramy najczęściej wyszukiwaną piosenkę
  const topSong = db
    .prepare(
      "SELECT title, platform, count FROM song_stats ORDER BY count DESC LIMIT 1"
    )
    .get();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("🎵 NAJCZĘŚCIEJ WYSZUKIWANA PIOSENKA:", margin + 20, currentY);
  currentY += 40;

  const platformLogos = {
    Spotify: "./images/spotify-logo.png",
    YouTube: "./images/youtube-logo.png",
    SoundCloud: "./images/soundcloud-logo.png",
  };

  if (topSong) {
    let logoPath = platformLogos[topSong.platform] || null;

    if (logoPath) {
      try {
        const logo = await loadImage(logoPath);
        ctx.drawImage(logo, margin + 100, currentY, 80, 80);
      } catch (error) {
        console.error(`❌ Błąd ładowania logo ${topSong.platform}:`, error);
      }
    }

    // 🛑 Usuwamy "Stream" z początku tytułu
    const cleanedTitle = cleanSongTitle(topSong.title);

    // 🛑 Zabezpieczenie przed wychodzeniem tekstu poza obraz
    const maxTextWidth = 600; // Maksymalna szerokość dla tekstu
    const truncatedTitle = truncateText(
      ctx,
      `${cleanedTitle} 🎶 (${topSong.count} razy)`,
      maxTextWidth
    );

    ctx.fillText(truncatedTitle, margin + 200, currentY + 50);
  } else {
    ctx.fillText("Brak danych", margin + 20, currentY);
  }

  currentY += 140;

  // 📅 **Dodajemy datę generowania**
  const now = new Date();
  const formattedDate = now.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  ctx.font = "italic 26px Arial";
  ctx.fillText(
    `📅 Podsumowanie wygenerowane: ${formattedDate}`,
    margin,
    currentY
  );

  // 🔥 Dodanie logo serwera (jeśli masz)
  try {
    const logo = await loadImage("./images/server-logo2.png");
    ctx.drawImage(logo, width - 100, totalHeight - 150, 150, 150);
  } catch (error) {
    console.error("❌ Błąd ładowania logo:", error);
  }

  // 📊 Zapis grafiki
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync("./images/wrapped.png", buffer);
}

module.exports = { generateWrappedImage };
