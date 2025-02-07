const Database = require("better-sqlite3");
const db = new Database("bot_stats.db");

// 🛠️ Sprawdzamy, czy kolumna platform istnieje
const checkColumnPlatform = db
  .prepare("PRAGMA table_info(song_stats)")
  .all()
  .some((col) => col.name === "platform");

if (!checkColumnPlatform) {
  console.log("🔧 Dodaję kolumnę platform do song_stats...");
  db.exec(`ALTER TABLE song_stats ADD COLUMN platform TEXT DEFAULT 'Unknown';`);
  console.log("✅ Kolumna platform została dodana!");
} else {
  console.log("✅ Kolumna platform już istnieje, nie trzeba jej dodawać.");
}

db.close();
