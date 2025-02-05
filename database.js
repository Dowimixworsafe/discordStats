const Database = require("better-sqlite3");
const db = new Database("bot_stats.db");

// 🏆 Tworzymy tabelę dla czasu głosowego (jeśli nie istnieje)
db.exec(`
    CREATE TABLE IF NOT EXISTS voice_time (
        user_id TEXT PRIMARY KEY,
        total_time INTEGER DEFAULT 0,
        last_join INTEGER
    )
`);

// 🛠️ Sprawdzamy, czy `last_channel` istnieje
const checkColumn = db
  .prepare("PRAGMA table_info(voice_time)")
  .all()
  .some((col) => col.name === "last_channel");

if (!checkColumn) {
  console.log("🔧 Dodaję kolumnę last_channel do voice_time...");
  db.exec(`ALTER TABLE voice_time ADD COLUMN last_channel TEXT DEFAULT NULL;`);
  console.log("✅ Kolumna last_channel została dodana!");
}

// 🔥 Tworzymy tabelę dla licznika wiadomości (jeśli nie istnieje)
db.exec(`
    CREATE TABLE IF NOT EXISTS message_count (
        user_id TEXT PRIMARY KEY,
        total_messages INTEGER DEFAULT 0
    )
`);

// 🔍 Tworzymy tabelę dla kapusiów (jeśli nie istnieje)
db.exec(`
    CREATE TABLE IF NOT EXISTS kapus_count (
        user_id TEXT PRIMARY KEY,
        total_days INTEGER DEFAULT 0,
        last_given INTEGER
    )
`);

console.log("✅ Baza danych załadowana!");

module.exports = db;
