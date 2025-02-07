const db = require("../utils/database");
const axios = require("axios");

module.exports = (client) => {
  // 🔥 Funkcja do pobierania tokena Spotify (odświeżany co godzinę)
  let spotifyToken = null;

  async function getSpotifyToken() {
    try {
      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({ grant_type: "client_credentials" }),
        {
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                process.env.SPOTIFY_CLIENT_ID +
                  ":" +
                  process.env.SPOTIFY_CLIENT_SECRET
              ).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      spotifyToken = response.data.access_token;
      setTimeout(getSpotifyToken, response.data.expires_in * 1000); // Odśwież token przed wygaśnięciem
    } catch (error) {
      console.error("❌ Błąd pobierania tokena Spotify:", error);
    }
  }

  // Uruchomienie pobierania tokena przy starcie
  getSpotifyToken();

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return; // Ignorujemy boty
    if (!message.channel.name.includes("🎶┃𝙳𝙹")) return; // Filtrujemy kanały DJ

    let songId = null;
    let platform = null;

    if (message.content.startsWith("/play")) {
      songId = message.content.replace("/play", "").trim();
      platform = "Manual";
    }

    const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
    const spotifyRegex = /open\.spotify\.com\/(track|album)\/([\w-]+)/;
    const soundcloudRegex = /soundcloud\.com\/([\w-]+)\/([\w-]+)/;

    const ytMatch = message.content.match(ytRegex);
    const spotifyMatch = message.content.match(spotifyRegex);
    const soundcloudMatch = message.content.match(soundcloudRegex);

    if (ytMatch) {
      songId = ytMatch[1];
      platform = "YouTube";
    } else if (spotifyMatch) {
      songId = spotifyMatch[2];
      platform = "Spotify";
    } else if (soundcloudMatch) {
      songId = soundcloudMatch[1] + "/" + soundcloudMatch[2];
      platform = "SoundCloud";
    }

    if (songId && platform) {
      const songTitle = await fetchSongTitle(platform, songId);
      if (songTitle) {
        updateSongStats(songTitle, platform);
      }
    }
  });

  // 🔥 Funkcja do pobierania tytułu utworu
  async function fetchSongTitle(platform, songId) {
    try {
      if (platform === "Spotify") {
        if (!spotifyToken) await getSpotifyToken(); // Odśwież token, jeśli nie istnieje

        const response = await axios.get(
          `https://api.spotify.com/v1/tracks/${songId}`,
          {
            headers: { Authorization: `Bearer ${spotifyToken}` },
          }
        );

        return response.data.name + " - " + response.data.artists[0].name;
      } else if (platform === "YouTube") {
        const response = await axios.get(
          `https://www.googleapis.com/youtube/v3/videos`,
          {
            params: {
              part: "snippet",
              id: songId,
              key: process.env.YOUTUBE_API_KEY,
            },
          }
        );

        return response.data.items[0]?.snippet?.title || "Nieznany utwór";
      } else if (platform === "SoundCloud") {
        // 🔥 Scrapowanie strony SoundCloud w celu pobrania tytułu utworu
        const songUrl = `https://soundcloud.com/${songId}`;
        const response = await axios.get(songUrl);
        const pageContent = response.data;

        // 🟢 Wyciągamy tytuł utworu z <title>...</title>
        const match = pageContent.match(/<title>(.*?)<\/title>/);

        return match
          ? match[1].replace(" | SoundCloud", "").trim()
          : "Nieznany utwór";
      }
    } catch (error) {
      console.error(`❌ Błąd pobierania tytułu dla ${platform}:`, error);
      return "Nieznany utwór";
    }
  }

  // 🔥 Funkcja do zapisywania utworu do bazy danych
  function updateSongStats(songTitle, platform) {
    const song = db
      .prepare("SELECT * FROM song_stats WHERE title = ?")
      .get(songTitle);

    if (!song) {
      db.prepare(
        "INSERT INTO song_stats (title, platform, count) VALUES (?, ?, ?)"
      ).run(songTitle, platform, 1);
    } else {
      db.prepare("UPDATE song_stats SET count = count + 1 WHERE title = ?").run(
        songTitle
      );
    }
  }

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return; // Ignorujemy boty

    const customEmojiRegex = /<a?:\w+:(\d+)>/g;
    const matches = message.content.match(customEmojiRegex);

    if (matches) {
      for (const match of matches) {
        const emojiId = match.match(/\d+/)[0];
        const emoji = message.guild.emojis.cache.get(emojiId);

        if (emoji) {
          const existing = db
            .prepare("SELECT * FROM emoji_usage WHERE emoji = ?")
            .get(emoji.toString());

          if (existing) {
            db.prepare(
              "UPDATE emoji_usage SET count = count + 1 WHERE emoji = ?"
            ).run(emoji.toString());
          } else {
            db.prepare(
              "INSERT INTO emoji_usage (emoji, count) VALUES (?, ?)"
            ).run(emoji.toString(), 1);
          }
        }
      }
    }

    const userId = message.author.id;
    const user = db
      .prepare("SELECT * FROM message_count WHERE user_id = ?")
      .get(userId);

    if (!user) {
      db.prepare(
        "INSERT INTO message_count (user_id, total_messages) VALUES (?, ?)"
      ).run(userId, 1);
    } else {
      db.prepare(
        "UPDATE message_count SET total_messages = total_messages + 1 WHERE user_id = ?"
      ).run(userId);
    }
  });
};
