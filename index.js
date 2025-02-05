require("dotenv").config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require("discord.js");
const db = require("./database");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const schedule = require("node-schedule");

const afkChannelId = process.env.AFK_CHANNEL_ID;
const wrappedChannelId = process.env.WRAPPED_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates, // Śledzenie kanałów głosowych
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`✅ Bot jest online jako ${client.user.tag}`);

  // 🔥 Po uruchomieniu bota sprawdzamy, kto już jest na kanałach głosowych
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache.forEach((channel) => {
      if (channel.type === 2) {
        channel.members.forEach((member) => {
          updateVoiceTime(member.id, channel.id, true); // Zapisujemy użytkownika jako aktywnego
        });
      }
    });
  });

  console.log("📊 Statystyki głosowe zaktualizowane po starcie.");
});

// 📌 Funkcja do aktualizacji czasu w bazie danych
function updateVoiceTime(userId, channelId, joined) {
  const user = db
    .prepare("SELECT * FROM voice_time WHERE user_id = ?")
    .get(userId);

  if (joined) {
    // Jeśli użytkownik dołączył, zapisujemy czas wejścia
    if (!user) {
      db.prepare(
        "INSERT INTO voice_time (user_id, last_join, last_channel) VALUES (?, ?, ?)"
      ).run(userId, Date.now(), channelId);
    } else {
      db.prepare(
        "UPDATE voice_time SET last_join = ?, last_channel = ? WHERE user_id = ?"
      ).run(Date.now(), channelId, userId);
    }
  } else {
    // Jeśli użytkownik opuszcza kanał, obliczamy czas spędzony
    if (user && user.last_join) {
      const timeSpent = Math.floor((Date.now() - user.last_join) / 1000); // Czas w sekundach
      db.prepare(
        "UPDATE voice_time SET total_time = total_time + ?, last_join = NULL, last_channel = NULL WHERE user_id = ?"
      ).run(timeSpent, userId);
    }
  }
}

// 📌 Event śledzący zmiany kanałów głosowych
client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.member.id;
  const oldChannelId = oldState.channel ? oldState.channel.id : null;
  const newChannelId = newState.channel ? newState.channel.id : null;

  // Ignorowanie kanału AFK
  if (newChannelId === afkChannelId) {
    console.log(`🚫 Użytkownik ${userId} wszedł na kanał AFK. Ignorujemy.`);
    updateVoiceTime(userId, oldChannelId, false);
    return;
  }

  // Powrót z AFK – wznawiamy liczenie
  if (oldChannelId === afkChannelId && newChannelId) {
    console.log(`✅ Użytkownik ${userId} opuścił AFK. Wznawiamy liczenie.`);
    updateVoiceTime(userId, newChannelId, true);
    return;
  }

  // Użytkownik zmienił kanał – nie traktujemy tego jako wyjście
  if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
    console.log(
      `🔄 Użytkownik ${userId} zmienił kanał z ${oldChannelId} na ${newChannelId}`
    );
    updateVoiceTime(userId, oldChannelId, false);
    updateVoiceTime(userId, newChannelId, true);
    return;
  }

  // Użytkownik dołączył na kanał
  if (!oldChannelId && newChannelId) {
    console.log(`🎤 Użytkownik ${userId} dołączył na kanał ${newChannelId}`);
    updateVoiceTime(userId, newChannelId, true);
  }

  // Użytkownik opuścił kanał
  if (oldChannelId && !newChannelId) {
    console.log(`🚪 Użytkownik ${userId} opuścił kanał ${oldChannelId}`);
    updateVoiceTime(userId, oldChannelId, false);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // KOMENDA /WRAPPED
  if (interaction.commandName === "wrapped") {
    await interaction.reply("📊 Generowanie podsumowania miesiąca");

    await generateWrappedImage(); // Tworzymy grafikę

    const channel = client.channels.cache.get(wrappedChannelId);
    if (!channel) {
      await interaction.followUp(
        "❌ Błąd! Nie znaleziono kanału do wysyłki podsumowania."
      );
      return;
    }

    await channel.send({
      files: ["./images/wrapped.png"],
    });
  }

  // KOMENDA /TOP
  if (interaction.commandName === "top") {
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
  }

  // KOMENDA /TOP_MESSAGES
  if (interaction.commandName === "top_messages") {
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
  }

  // KOMENDA /TOP_KAPUSIE
  if (interaction.commandName === "top_kapusie") {
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
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Ignorujemy wiadomości botów

  const userId = message.author.id;

  // Sprawdzamy, czy użytkownik jest już w bazie
  const user = db
    .prepare("SELECT * FROM message_count WHERE user_id = ?")
    .get(userId);

  if (!user) {
    // Jeśli użytkownik nie istnieje w bazie, dodajemy go z pierwszą wiadomością
    db.prepare(
      "INSERT INTO message_count (user_id, total_messages) VALUES (?, ?)"
    ).run(userId, 1);
  } else {
    // Jeśli użytkownik już jest w bazie, zwiększamy liczbę wiadomości
    db.prepare(
      "UPDATE message_count SET total_messages = total_messages + 1 WHERE user_id = ?"
    ).run(userId);
  }
});

client.on("guildMemberUpdate", (oldMember, newMember) => {
  const roleId = process.env.ROLE_SNITCH_ID;

  const hadRoleBefore = oldMember.roles.cache.has(roleId);
  const hasRoleNow = newMember.roles.cache.has(roleId);

  if (!hadRoleBefore && hasRoleNow) {
    updateKapusCount(newMember.id);
  }
});

function updateKapusCount(userId) {
  const user = db
    .prepare("SELECT * FROM kapus_count WHERE user_id = ?")
    .get(userId);
  const today = new Date().setHours(0, 0, 0, 0);

  if (!user) {
    db.prepare(
      "INSERT INTO kapus_count (user_id, total_days, last_given) VALUES (?, ?, ?)"
    ).run(userId, 1, today);
  } else if (user.last_given !== today) {
    db.prepare(
      "UPDATE kapus_count SET total_days = total_days + 1, last_given = ? WHERE user_id = ?"
    ).run(today, userId);
  }
}

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function generateWrappedImage() {
  const width = 900;
  const margin = 30;
  const rowHeight = 100; // Większe odstępy na awatary + tekst
  const categorySpacing = 100; // Większe odstępy między kategoriami
  const titleHeight = 60; // Nagłówek
  const footerHeight = 50; // Data
  const medalSize = 50; // Rozmiar medalu
  const avatarSize = 80; // Rozmiar awatara

  // Wczytujemy dane
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

  // 🔥 Dynamiczne obliczenie wysokości
  const totalHeight =
    titleHeight +
    topVoiceUsers.length * rowHeight +
    categorySpacing +
    topChatUsers.length * rowHeight +
    footerHeight +
    250;

  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext("2d");

  try {
    const background = await loadImage("./images/background.png"); // Plik tła
    ctx.drawImage(background, 0, 0, width, totalHeight);
  } catch (error) {
    console.error("❌ Błąd ładowania tła:", error);
  }

  // 🏆 Nagłówek
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("📊 Miesięczne Podsumowanie Serwera", margin, 50);

  // 🏅 Medale
  const goldMedal = await loadImage("./images/gold-medal.png");
  const silverMedal = await loadImage("./images/silver-medal.png");
  const bronzeMedal = await loadImage("./images/bronze-medal.png");
  const medals = [goldMedal, silverMedal, bronzeMedal];

  // 📌 Funkcja do rysowania sekcji z zaokrąglonymi rogami
  function drawSection(y, height) {
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; // Ostatnia wartość (0.85) to przezroczystość
    ctx.fillRect(margin, y, width - 2 * margin, height);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(margin, y, width - 2 * margin, height, 20);
    ctx.fill();
    ctx.stroke();
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

  // 🔍 Pobieranie informacji o użytkowniku
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

  let currentY = titleHeight + 80;

  // 🎤 Top 5 użytkowników Voice
  drawSection(currentY - 60, topVoiceUsers.length * rowHeight + 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("🎤 TOP 5 NA KANAŁACH GŁOSOWYCH:", margin + 20, currentY);
  currentY += 40;

  for (let i = 0; i < topVoiceUsers.length; i++) {
    const { name, avatarURL } = await getUserInfo(topVoiceUsers[i].user_id);

    // Rysujemy medal
    if (medals[i]) {
      ctx.drawImage(
        medals[i],
        margin + 30,
        currentY + (rowHeight - medalSize) / 2,
        medalSize,
        medalSize
      );
    }

    // Rysujemy awatar
    await drawAvatar(
      avatarURL,
      margin + 100,
      currentY + (rowHeight - avatarSize) / 2,
      avatarSize
    );

    // Tekst użytkownika
    ctx.fillText(
      `${name} – ${Math.floor(topVoiceUsers[i].total_time / 60)} min`,
      margin + 200,
      currentY + rowHeight / 2 + 10
    );

    currentY += rowHeight;
  }

  currentY += categorySpacing;

  // 💬 Top 5 użytkowników Chat
  drawSection(currentY - 60, topChatUsers.length * rowHeight + 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("💬 TOP 5 NA KANAŁACH TEKSTOWYCH:", margin + 20, currentY);
  currentY += 40;

  for (let i = 0; i < topChatUsers.length; i++) {
    const { name, avatarURL } = await getUserInfo(topChatUsers[i].user_id);

    // Rysujemy medal
    if (medals[i]) {
      ctx.drawImage(
        medals[i],
        margin + 30,
        currentY + (rowHeight - medalSize) / 2,
        medalSize,
        medalSize
      );
    }

    // Rysujemy awatar
    await drawAvatar(
      avatarURL,
      margin + 100,
      currentY + (rowHeight - avatarSize) / 2,
      avatarSize
    );

    // Tekst użytkownika
    ctx.fillText(
      `${name} – ${topChatUsers[i].total_messages} wiadomości`,
      margin + 200,
      currentY + rowHeight / 2 + 10
    );

    currentY += rowHeight;
  }

  currentY += categorySpacing;

  // 📅 **Dodajemy datę generowania**
  const now = new Date();
  const formattedDate = now.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  ctx.font = "italic 24px Arial";
  ctx.fillText(
    `📅 Podsumowanie wygenerowane: ${formattedDate}`,
    margin,
    currentY
  );

  // 🔥 Dodanie logo w prawym górnym rogu
  const logo = await loadImage("./images/server-logo.png");
  ctx.drawImage(logo, width - 180, 1170, 150, 150);

  // 📊 Zapis grafiki
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync("./images/wrapped.png", buffer);
}

// 📅 Harmonogram – ostatni dzień miesiąca o 23:59
schedule.scheduleJob("59 23 L * *", async () => {
  await generateWrappedImage(); // Tworzymy grafikę

  const channel = client.channels.cache.get(wrappedChannelId);
  if (!channel) {
    console.log("❌ Nie znaleziono kanału do wysyłki podsumowania!");
    return;
  }

  await channel.send({
    files: ["./images/wrapped.png"],
  });
});

client.login(process.env.TOKEN);
