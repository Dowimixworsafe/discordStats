const db = require("../utils/database");

module.exports = (client) => {
  client.on("voiceStateUpdate", (oldState, newState) => {
    const user = newState.member;
    if (!user || user.user.bot) return; // 🚫 Ignorujemy boty

    const userId = user.id;
    const oldChannelId = oldState.channel?.id;
    const newChannelId = newState.channel?.id;

    if (oldChannelId && !newChannelId) {
      updateVoiceTime(userId, oldChannelId, false);
    } else if (!oldChannelId && newChannelId) {
      updateVoiceTime(userId, newChannelId, true);
    }
  });
};

function updateVoiceTime(userId, channelId, joined) {
  const user = db
    .prepare("SELECT * FROM voice_time WHERE user_id = ?")
    .get(userId);

  if (joined) {
    db.prepare(
      user
        ? "UPDATE voice_time SET last_join = ?, last_channel = ? WHERE user_id = ?"
        : "INSERT INTO voice_time (user_id, last_join, last_channel) VALUES (?, ?, ?)"
    ).run(Date.now(), channelId, userId);
  } else if (user?.last_join) {
    const timeSpent = Math.floor((Date.now() - user.last_join) / 1000);
    db.prepare(
      "UPDATE voice_time SET total_time = total_time + ?, last_join = NULL, last_channel = NULL WHERE user_id = ?"
    ).run(timeSpent, userId);
  }
}
