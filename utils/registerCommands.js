require("dotenv").config();
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const { SlashCommandBuilder } = require("discord.js");

console.log(`✅ Token: ${process.env.TOKEN ? "OK" : "Brak tokena"}`);
console.log(
  `✅ Client ID: ${
    process.env.CLIENT_ID ? process.env.CLIENT_ID : "Brak Client ID"
  }`
);

const commands = [
  new SlashCommandBuilder()
    .setName("top")
    .setDescription(
      "Wyświetla top 20 użytkowników z największym czasem na kanałach głosowych"
    ),

  new SlashCommandBuilder()
    .setName("top_messages")
    .setDescription(
      "Wyświetla top 20 użytkowników z największą liczbą wysłanych wiadomości"
    ),

  new SlashCommandBuilder()
    .setName("top_kapusie")
    .setDescription("Wyświetla 10 największych kapusiów."),

  new SlashCommandBuilder()
    .setName("wrapped")
    .setDescription("Ręczne uruchomienie podsumowania miesiąca"),

  new SlashCommandBuilder()
    .setName("top_songs")
    .setDescription("Wyświetla najczęściej wyszukiwane piosenki"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("🔄 Rejestracja komend...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.SERVER_ID
      ),
      { body: commands }
    );
    console.log("✅ Komendy zarejestrowane!");
  } catch (error) {
    console.error(error);
  }
})();
