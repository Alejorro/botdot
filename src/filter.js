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

function matchesRequestedSpecsExactly(product, query) {
  if (query.cpu && product.processor !== query.cpu) return false;
  if (query.ramGb && product.ram_gb !== query.ramGb) return false;
  if (query.storageGb && product.storage_gb !== query.storageGb) return false;
  return true;
}

function matchesAtLeastOneRequestedSpec(product, query) {
  if (query.cpu && product.processor === query.cpu) return true;
  if (query.tier && product.proc_tier === query.tier) return true;
  if (query.ramGb && product.ram_gb === query.ramGb) return true;
  if (query.storageGb && product.storage_gb === query.storageGb) return true;
  return false;
}

function sortProducts(scored) {
  return scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    if (b.stock !== a.stock) return b.stock - a.stock;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function filterProducts(query, offset = 0) {
  const db = getDb();
  let products = [...db.prepare('SELECT * FROM products WHERE stock > 0 AND is_active = 1').all()];

  if (query.brand) {
    products = products.filter(
      p => p.brand && p.brand.toLowerCase() === query.brand.toLowerCase()
    );
  }

  const hasSpecifics = query.cpu || query.ramGb || query.storageGb;
  const exactProducts = hasSpecifics
    ? products.filter(p => matchesRequestedSpecsExactly(p, query))
    : products;
  const scored = exactProducts.map(p => ({ ...p, _score: scoreProduct(p, query) }));

  return sortProducts(scored).slice(offset, offset + 5);
}

function fallbackProducts(query) {
  const db = getDb();
  const products = [...db.prepare('SELECT * FROM products WHERE stock > 0 AND is_active = 1').all()];
  const tierMembers = query.tier ? (CPU_TIER_MEMBERS[query.tier] || []) : [];
  const hasSpecifics = query.cpu || query.ramGb || query.storageGb;
  if (!hasSpecifics) return [];

  const candidates = products.filter(p => {
    if (!matchesAtLeastOneRequestedSpec(p, query)) return false;
    if (query.brand && p.brand && p.brand.toLowerCase() !== query.brand.toLowerCase()) {
      // Similar options may cross brands only when no same-brand spec match exists.
      const sameBrandSpecExists = products.some(other =>
        other.brand &&
        other.brand.toLowerCase() === query.brand.toLowerCase() &&
        matchesAtLeastOneRequestedSpec(other, query)
      );
      if (sameBrandSpecExists) return false;
    }
    if (query.tier && p.processor && tierMembers.includes(p.processor)) return true;
    if (query.ramGb && p.ram_gb === query.ramGb) return true;
    if (query.storageGb && p.storage_gb) {
      const qi = STORAGE_TIERS.indexOf(query.storageGb);
      const pi = STORAGE_TIERS.indexOf(p.storage_gb);
      if (qi !== -1 && pi !== -1 && Math.abs(qi - pi) <= 1) return true;
    }
    return false;
  });

  const scored = candidates
    .filter(p => {
      if (!matchesRequestedSpecsExactly(p, query)) return true;
      if (!query.brand) return false;
      return !p.brand || p.brand.toLowerCase() !== query.brand.toLowerCase();
    })
    .map(p => ({ ...p, _score: scoreProduct(p, query) }));
  return sortProducts(scored).slice(0, 5);
}

module.exports = { filterProducts, fallbackProducts };
