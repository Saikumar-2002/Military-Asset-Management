const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("crypto");

// SQLite file persisted in backend/data
const dbPath = path.join(__dirname, "..", "data", "military.db");
const db = new Database(dbPath);

// Enable foreign keys (best effort)
db.pragma("foreign_keys = ON");

function sha256(input) {
  // Lightweight hashing for assignment purposes (NOT production-grade).
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

  // NOTE: For a class/assignment demo; replace with a stronger hashing strategy in real deployments.
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

  // Seed balances
  const assets = db.prepare("SELECT id, asset_type FROM assets").all();
  const insertBal = db.prepare(`
    INSERT INTO asset_balances(base_id, asset_id, quantity, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  const initialByBase = { BASE_A: 10, BASE_B: 8, BASE_C: 6 };
  for (const baseId of baseCodes) {
    for (const a of assets) {
      const baseQty = initialByBase[baseId] || 0;
      // Make ammo slightly higher.
      const qty = a.asset_type === "ammunition" ? baseQty * 20 : baseQty;
      insertBal.run(baseId, a.id, qty);
    }
  }
}

ensureSchema();
seedIfEmpty();

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

function ensureBalanceRow(baseId, assetId) {
  db.prepare(`
    INSERT OR IGNORE INTO asset_balances(base_id, asset_id, quantity, updated_at)
    VALUES (?, ?, 0, datetime('now'))
  `).run(baseId, assetId);
}

function getBalance(baseId, assetId) {
  return db.prepare(`
    SELECT base_id, asset_id, quantity, updated_at
    FROM asset_balances
    WHERE base_id = ? AND asset_id = ?
  `).get(baseId, assetId);
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

function adjustBalanceInTx({ baseId, assetId, delta }) {
  // Caller should already be inside a db.transaction wrapper.
  ensureBalanceRow(baseId, assetId);
  const current = getBalance(baseId, assetId).quantity;
  const next = current + delta;
  if (next < 0) {
    const err = new Error(`Insufficient inventory for base ${baseId} asset ${assetId}`);
    err.code = "INSUFFICIENT_INVENTORY";
    throw err;
  }
  db.prepare(`
    UPDATE asset_balances
    SET quantity = ?, updated_at = datetime('now')
    WHERE base_id = ? AND asset_id = ?
  `).run(next, baseId, assetId);
  return next;
}

function createPurchaseTx({ baseId, assetId, quantity, notes, createdBy }) {
  return db.transaction(() => {
    ensureBalanceRow(baseId, assetId);
    adjustBalanceInTx({ baseId, assetId, delta: quantity });
    const info = db.prepare(`
      INSERT INTO purchases(base_id, asset_id, quantity, notes, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(baseId, assetId, quantity, notes || null, createdBy);
    return { id: info.lastInsertRowid };
  })();
}

function createAssignmentTx({ baseId, assetId, quantity, assignedTo, notes, createdBy }) {
  return db.transaction(() => {
    // Assignments reduce on-hand quantity.
    adjustBalanceInTx({ baseId, assetId, delta: -Math.abs(quantity) });
    const info = db.prepare(`
      INSERT INTO assignments(base_id, asset_id, quantity, assigned_to, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(baseId, assetId, Math.abs(quantity), assignedTo, notes || null, createdBy);
    return { id: info.lastInsertRowid };
  })();
}

function createTransferTx({ fromBaseId, toBaseId, assetId, quantity, notes, createdBy }) {
  return db.transaction(() => {
    // Transfers move inventory between bases.
    adjustBalanceInTx({ baseId: fromBaseId, assetId, delta: -Math.abs(quantity) });
    adjustBalanceInTx({ baseId: toBaseId, assetId, delta: Math.abs(quantity) });
    const info = db.prepare(`
      INSERT INTO transfers(from_base_id, to_base_id, asset_id, quantity, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fromBaseId, toBaseId, assetId, Math.abs(quantity), notes || null, createdBy);
    return { id: info.lastInsertRowid };
  })();
}

module.exports = {
  db,
  getUserByUsername,
  getUserById,
  listBases,
  listAssets,
  listBalancesForBase,
  createPurchaseTx,
  createTransferTx,
  createAssignmentTx
};

