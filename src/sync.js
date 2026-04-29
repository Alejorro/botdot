require('dotenv').config();
const xmlrpc = require('xmlrpc');
const { getDb } = require('./db');
const { parseProductName, parseBrand, normalizeCpuFromOdoo, parseRam, parseStorage } = require('./parser');

const PORTABLES_CATEG_ID = 141;

function rpcClient(path) {
  const url = new URL(process.env.ODOO_URL);
  const opts = {
    host: url.hostname,
    port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
    path,
  };
  return url.protocol === 'https:'
    ? xmlrpc.createSecureClient(opts)
    : xmlrpc.createClient(opts);
}

function call(client, method, params) {
  return new Promise((resolve, reject) =>
    client.methodCall(method, params, (err, val) => (err ? reject(err) : resolve(val)))
  );
}

async function sync() {
  const dbName = process.env.ODOO_DB;
  const user = process.env.ODOO_USER;
  const password = process.env.ODOO_PASSWORD;

  console.log('[sync] Authenticating with Odoo...');
  const common = rpcClient('/xmlrpc/2/common');
  const uid = await call(common, 'authenticate', [dbName, user, password, {}]);
  if (!uid) throw new Error('Odoo authentication failed');

  const models = rpcClient('/xmlrpc/2/object');
  const exec = (model, method, args, kwargs = {}) =>
    call(models, 'execute_kw', [dbName, uid, password, model, method, args, kwargs]);

  const brandRecords = await exec('product.brand', 'search_read', [[]], { fields: ['id', 'name'] });
  const brandMap = Object.fromEntries(brandRecords.map(b => [b.id, b.name]));

  const procRecords = await exec('product.processor', 'search_read', [[]], { fields: ['id', 'name'] });
  const procMap = Object.fromEntries(procRecords.map(p => [p.id, p.name]));

  console.log('[sync] Fetching PORTABLES from Odoo...');
  const products = await exec(
    'product.template', 'search_read',
    [[['categ_id', '=', PORTABLES_CATEG_ID], ['active', '=', true]]],
    { fields: ['name', 'default_code', 'list_price', 'qty_available', 'brand_ids', 'processor_ids', 'write_date'] }
  );

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO products (sku, name, clean_name, price, stock, brand, processor, proc_tier, ram_gb, storage_gb, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sku) DO UPDATE SET
      name=excluded.name, clean_name=excluded.clean_name,
      price=excluded.price, stock=excluded.stock,
      brand=excluded.brand, processor=excluded.processor,
      proc_tier=excluded.proc_tier,
      ram_gb=excluded.ram_gb, storage_gb=excluded.storage_gb,
      last_updated=excluded.last_updated
  `);

  let synced = 0;
  let skipped = 0;

  db.exec('BEGIN');
  try {
    for (const p of products) {
      if (!p.default_code) { skipped++; continue; }

      const sku = String(p.default_code).trim();
      const rawName = p.name.trim();
      const cleanName = rawName.replace(/^[A-Z0-9][\w\-]*\s*[-–]\s*/i, '').trim();

      let brand = null;
      if (p.brand_ids && p.brand_ids.length > 0) {
        const raw = brandMap[p.brand_ids[0]];
        // Use parser for consistent casing (handles HP, Dell, Lenovo, etc.)
        if (raw) brand = parseBrand(raw);
      }
      if (!brand) brand = parseBrand(cleanName);

      let processor = null;
      let procTier = null;
      if (p.processor_ids && p.processor_ids.length > 0) {
        const procName = procMap[p.processor_ids[0]];
        const parsed = normalizeCpuFromOdoo(procName);
        if (parsed) { processor = parsed.cpu; procTier = parsed.tier; }
      }
      if (!processor) {
        const parsed = parseProductName(rawName);
        processor = parsed.cpu;
        procTier = parsed.procTier;
      }

      const ramGb = parseRam(rawName);
      const storageGb = parseStorage(rawName);

      upsert.run(sku, rawName, cleanName, p.list_price, p.qty_available,
                 brand, processor, procTier, ramGb, storageGb, p.write_date);
      synced++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`[sync] Done — ${synced} synced, ${skipped} skipped (no SKU)`);
}

module.exports = { sync };

if (require.main === module) {
  sync().catch(err => { console.error('[sync] Error:', err.message); process.exit(1); });
}
