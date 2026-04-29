require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/products.db';

let _db = null;

function getDb() {
  if (_db) return _db;
  const resolved = path.resolve(DB_PATH);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new DatabaseSync(resolved);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      sku         TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      clean_name  TEXT,
      price       REAL DEFAULT 0,
      stock       REAL DEFAULT 0,
      brand       TEXT,
      processor   TEXT,
      proc_tier   INTEGER,
      ram_gb      INTEGER,
      storage_gb  INTEGER,
      last_updated TEXT,
      is_active   INTEGER DEFAULT 1,
      stale_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  migrateProducts(_db);
  return _db;
}

function migrateProducts(db) {
  const columns = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
  if (!columns.includes('is_active')) {
    db.exec('ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1');
  }
  if (!columns.includes('stale_at')) {
    db.exec('ALTER TABLE products ADD COLUMN stale_at TEXT');
  }
}

function setMeta(key, value) {
  getDb().prepare(`
    INSERT INTO sync_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, value);
}

function getMeta(key) {
  const row = getDb().prepare('SELECT value FROM sync_meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getHealthStats(maxSyncAgeMs = 3 * 60 * 60 * 1000) {
  const db = getDb();
  const counts = db.prepare(`
    SELECT
      COUNT(*) AS totalProducts,
      SUM(CASE WHEN is_active = 1 AND stock > 0 THEN 1 ELSE 0 END) AS inStockProducts,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactiveProducts
    FROM products
  `).get();
  const lastSuccessfulSync = getMeta('last_successful_sync');
  const lastSyncAt = lastSuccessfulSync ? Date.parse(lastSuccessfulSync) : NaN;
  const syncStale = Number.isNaN(lastSyncAt) || (Date.now() - lastSyncAt) > maxSyncAgeMs;

  return {
    dbAvailable: true,
    totalProductCount: counts.totalProducts || 0,
    inStockProductCount: counts.inStockProducts || 0,
    inactiveProductCount: counts.inactiveProducts || 0,
    lastSuccessfulSync,
    syncStale,
  };
}

module.exports = { getDb, setMeta, getMeta, getHealthStats };
