const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const dbPath = path.join('/tmp', `botdot-filter-${process.pid}.db`);
fs.rmSync(dbPath, { force: true });
process.env.DB_PATH = dbPath;

const { getDb } = require('../src/db');
const { filterProducts, fallbackProducts } = require('../src/filter');
const { parseQuery } = require('../src/parser');

function insertProduct(product) {
  getDb().prepare(`
    INSERT INTO products (
      sku, name, clean_name, price, stock, brand, processor, proc_tier,
      ram_gb, storage_gb, last_updated, is_active, stale_at
    )
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, datetime('now'), ?, NULL)
  `).run(
    product.sku,
    product.name,
    product.name,
    product.stock,
    product.brand,
    product.processor,
    product.procTier,
    product.ramGb,
    product.storageGb,
    product.isActive
  );
}

test('filter returns exact spec matches and excludes brand-only matches', () => {
  insertProduct({
    sku: 'HP-I5',
    name: 'HP i5 8GB 256GB',
    stock: 5,
    brand: 'HP',
    processor: 'i5',
    procTier: 5,
    ramGb: 8,
    storageGb: 256,
    isActive: 1,
  });
  insertProduct({
    sku: 'HP-I7',
    name: 'HP i7 16GB 1TB',
    stock: 2,
    brand: 'HP',
    processor: 'i7',
    procTier: 7,
    ramGb: 16,
    storageGb: 1000,
    isActive: 1,
  });

  const results = filterProducts(parseQuery('hp i7 16 ram 1tb'));
  assert.deepEqual(results.map(p => p.sku), ['HP-I7']);
});

test('fallback returns similar spec matches when exact configuration is unavailable', () => {
  const exact = filterProducts(parseQuery('hp i7 32 ram 1tb'));
  assert.deepEqual(exact, []);

  const fallback = fallbackProducts(parseQuery('hp i7 32 ram 1tb'));
  assert.equal(fallback.length > 0, true);
  assert.equal(fallback[0].sku, 'HP-I7');
});

test('inactive stale products are never returned', () => {
  insertProduct({
    sku: 'STALE',
    name: 'Lenovo i5 16GB 512GB',
    stock: 100,
    brand: 'Lenovo',
    processor: 'i5',
    procTier: 5,
    ramGb: 16,
    storageGb: 512,
    isActive: 0,
  });

  const results = filterProducts(parseQuery('lenovo i5 16 ram 512 ssd'));
  assert.equal(results.some(p => p.sku === 'STALE'), false);
});
