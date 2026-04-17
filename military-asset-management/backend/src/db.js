const path = require("path");
const fs = require("fs"); // ✅ added
const Database = require("better-sqlite3");
const bcrypt = require("crypto");

// SQLite file persisted in backend/data
const dbDir = path.join(__dirname, "..", "data"); // ✅ folder path
const dbPath = path.join(dbDir, "military.db");

// ✅ ensure directory exists (FIX)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys (best effort)
db.pragma("foreign_keys = ON");

function sha256(input) {
  return bcrypt.createHash("sha256").update(String(input)).digest("hex");
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bases (
      code TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      base_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_type TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_balances (
      base_id TEXT NOT NULL,
      asset_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (base_id, asset_id),
      FOREIGN KEY (base_id) REFERENCES bases(code),
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id TEXT NOT NULL,
      asset_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (base_id) REFERENCES bases(code),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_base_id TEXT NOT NULL,
      to_base_id TEXT NOT NULL,
      asset_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (from_base_id) REFERENCES bases(code),
      FOREIGN KEY (to_base_id) REFERENCES bases(code),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id TEXT NOT NULL,
      asset_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      assigned_to TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (base_id) REFERENCES bases(code),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);
}

function seedIfEmpty() {
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (userCount > 0) return;

  const baseCodes = ["BASE_A", "BASE_B", "BASE_C"];
  const insertBase = db.prepare("INSERT OR IGNORE INTO bases(code) VALUES (?)");
  for (const code of baseCodes) insertBase.run(code);

  const insertUser = db.prepare(`
    INSERT INTO users(username, password_hash, role, base_id)
    VALUES (?, ?, ?, ?)
  `);

  insertUser.run("admin", sha256("admin123"), "ADMIN", null);
  insertUser.run("commander", sha256("commander123"), "COMMANDER", "BASE_A");
  insertUser.run("logistics_a", sha256("logistics123"), "LOGISTICS", "BASE_A");
  insertUser.run("logistics_b", sha256("logistics123"), "LOGISTICS", "BASE_B");

  const insertAsset = db.prepare(`
    INSERT INTO assets(asset_type, name, unit)
    VALUES (?, ?, ?)
  `);
  insertAsset.run("vehicle", "Truck", "each");
  insertAsset.run("vehicle", "Jeep", "each");
  insertAsset.run("weapon", "Rifle", "each");
  insertAsset.run("ammunition", "7.62mm Rounds", "round");

  const assets = db.prepare("SELECT id, asset_type FROM assets").all();
  const insertBal = db.prepare(`
    INSERT INTO asset_balances(base_id, asset_id, quantity, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `);

  const initialByBase = { BASE_A: 10, BASE_B: 8, BASE_C: 6 };

  for (const baseId of baseCodes) {
    for (const a of assets) {
      const baseQty = initialByBase[baseId] || 0;
      const qty = a.asset_type === "ammunition" ? baseQty * 20 : baseQty;
      insertBal.run(baseId, a.id, qty);
    }
  }
}

ensureSchema();
seedIfEmpty();

// ===== EXPORT FUNCTIONS =====

function getUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function listBases() {
  return db.prepare("SELECT code FROM bases ORDER BY code").all();
}

function listAssets() {
  return db.prepare("SELECT id, asset_type, name, unit FROM assets ORDER BY asset_type, name").all();
}

function listBalancesForBase(baseId) {
  return db.prepare(`
    SELECT ab.base_id, ab.asset_id, ab.quantity, ab.updated_at, a.asset_type, a.name, a.unit
    FROM asset_balances ab
    JOIN assets a ON a.id = ab.asset_id
    WHERE ab.base_id = ?
    ORDER BY a.asset_type, a.name
  `).all(baseId);
}

module.exports = {
  db,
  getUserByUsername,
  getUserById,
  listBases,
  listAssets,
  listBalancesForBase
};