const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const dbPath = path.join('/tmp', `botdot-sync-${process.pid}.db`);
fs.rmSync(dbPath, { force: true });
process.env.DB_PATH = dbPath;

const { getDb } = require('../src/db');
const { markProductsStale, hideStaleProducts } = require('../src/sync');

test('stale sync helpers deactivate and hide products not seen in a sync', () => {
  const db = getDb();
  db.prepare(`
    INSERT INTO products (
      sku, name, clean_name, stock, brand, processor, proc_tier,
      ram_gb, storage_gb, is_active
    )
    VALUES ('OLD', 'Old product', 'Old product', 12, 'HP', 'i5', 5, 8, 256, 1)
  `).run();

  markProductsStale(db, '2026-04-29T00:00:00.000Z');
  hideStaleProducts(db);

  const row = db.prepare('SELECT stock, is_active, stale_at FROM products WHERE sku = ?').get('OLD');
  assert.equal(row.stock, 0);
  assert.equal(row.is_active, 0);
  assert.equal(row.stale_at, '2026-04-29T00:00:00.000Z');
});
