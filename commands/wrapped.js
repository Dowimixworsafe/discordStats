const { generateWrappedImage } = require("../utils/generateImage");

module.exports = {
  name: "wrapped",
  async execute(interaction) {
    await interaction.reply("📊 Generowanie podsumowania miesiąca...");

    await generateWrappedImage(interaction.client); // 🔥 Przekazujemy client

    const wrappedChannelId = process.env.WRAPPED_CHANNEL_ID;
    const channel = interaction.client.channels.cache.get(wrappedChannelId);
    if (!channel) {
      await interaction.followUp(
        "❌ Błąd! Nie znaleziono kanału do wysyłki podsumowania."
      );
      return;
    }

    await channel.send({ files: ["./images/wrapped.png"] });
  },
};
