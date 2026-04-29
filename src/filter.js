const { getDb } = require('./db');
const { CPU_TIER_MEMBERS, STORAGE_TIERS } = require('./parser');

function scoreProduct(product, query) {
  let s = 0;

  if (query.brand && product.brand) {
    if (product.brand.toLowerCase() === query.brand.toLowerCase()) s += 10;
  }

  if (query.cpu && product.processor) {
    if (product.processor === query.cpu) {
      s += 8;
    } else if (query.tier && product.proc_tier === query.tier) {
      s += 4;
    }
  }

  if (query.ramGb && product.ram_gb === query.ramGb) s += 5;

  if (query.storageGb && product.storage_gb) {
    if (product.storage_gb === query.storageGb) {
      s += 3;
    } else {
      const qi = STORAGE_TIERS.indexOf(query.storageGb);
      const pi = STORAGE_TIERS.indexOf(product.storage_gb);
      if (qi !== -1 && pi !== -1 && Math.abs(qi - pi) === 1) s += 1;
    }
  }

  return s;
}

function sortProducts(scored) {
  return scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    if (b.stock !== a.stock) return b.stock - a.stock;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function filterProducts(query) {
  const db = getDb();
  let products = [...db.prepare('SELECT * FROM products WHERE stock > 0').all()];

  if (query.brand) {
    products = products.filter(
      p => p.brand && p.brand.toLowerCase() === query.brand.toLowerCase()
    );
  }

  const hasSpecifics = query.cpu || query.ramGb || query.storageGb;
  const scored = products.map(p => ({ ...p, _score: scoreProduct(p, query) }));
  const filtered = hasSpecifics ? scored.filter(p => p._score > 0) : scored;

  return sortProducts(filtered).slice(0, 5);
}

function fallbackProducts(query) {
  const db = getDb();
  const products = [...db.prepare('SELECT * FROM products WHERE stock > 0').all()];
  const tierMembers = query.tier ? (CPU_TIER_MEMBERS[query.tier] || []) : [];

  const candidates = products.filter(p => {
    if (query.tier && p.processor && tierMembers.includes(p.processor)) return true;
    if (query.ramGb && p.ram_gb === query.ramGb) return true;
    if (query.storageGb && p.storage_gb) {
      const qi = STORAGE_TIERS.indexOf(query.storageGb);
      const pi = STORAGE_TIERS.indexOf(p.storage_gb);
      if (qi !== -1 && pi !== -1 && Math.abs(qi - pi) <= 1) return true;
    }
    return false;
  });

  const scored = candidates.map(p => ({ ...p, _score: scoreProduct(p, query) }));
  return sortProducts(scored).slice(0, 5);
}

module.exports = { filterProducts, fallbackProducts };
