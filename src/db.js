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
      last_updated TEXT
    )
  `);
  return _db;
}

module.exports = { getDb };
