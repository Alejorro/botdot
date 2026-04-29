// Order matters: longer/more specific patterns first
const CPU_PATTERNS = [
  { re: /\bcore\s*u\s*9\b/i, cpu: 'coreu9', tier: 9 },
  { re: /\bcore\s*u\s*7\b/i, cpu: 'coreu7', tier: 7 },
  { re: /\bcore\s*u\s*5\b/i, cpu: 'coreu5', tier: 5 },
  { re: /\bcore\s*9\b/i,     cpu: 'core9',  tier: 9 },
  { re: /\bcore\s*7\b/i,     cpu: 'core7',  tier: 7 },
  { re: /\bcore\s*5\b/i,     cpu: 'core5',  tier: 5 },
  { re: /\bi\s*9\b/i,        cpu: 'i9',     tier: 9 },
  { re: /\bi\s*7\b/i,        cpu: 'i7',     tier: 7 },
  { re: /\bi\s*5\b/i,        cpu: 'i5',     tier: 5 },
  { re: /\bi\s*3\b/i,        cpu: 'i3',     tier: 3 },
  { re: /\bryzen\s*9\b/i,    cpu: 'ryzen9', tier: 9 },
  { re: /\bryzen\s*7\b/i,    cpu: 'ryzen7', tier: 7 },
  { re: /\bryzen\s*5\b/i,    cpu: 'ryzen5', tier: 5 },
  { re: /\bryzen\s*3\b/i,    cpu: 'ryzen3', tier: 3 },
  // Shorthand "R7 7730" style — only after ryzen variants are matched
  { re: /\br\s*9\b/i,        cpu: 'ryzen9', tier: 9 },
  { re: /\br\s*7\b/i,        cpu: 'ryzen7', tier: 7 },
  { re: /\br\s*5\b/i,        cpu: 'ryzen5', tier: 5 },
  { re: /\br\s*3\b/i,        cpu: 'ryzen3', tier: 3 },
];

// Which CPU labels belong to each tier (for fallback matching)
const CPU_TIER_MEMBERS = {
  3: ['i3', 'ryzen3'],
  5: ['i5', 'ryzen5', 'coreu5', 'core5'],
  7: ['i7', 'ryzen7', 'coreu7', 'core7'],
  9: ['i9', 'ryzen9', 'coreu9', 'core9'],
};

const STORAGE_TIERS = [256, 512, 1000]; // 1TB stored as 1000

const NOTEBOOK_WORDS = ['notebook', 'notebooks', 'laptop', 'laptops', 'portatil', 'portable'];

function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBrand(text) {
  const n = normalize(text);
  if (/\blenovo\b/.test(n)) return 'Lenovo';
  if (/\bhp\b/.test(n))     return 'HP';
  if (/\bdell\b/.test(n))   return 'Dell';
  if (/\basus\b/.test(n))   return 'Asus';
  if (/\bacer\b/.test(n))   return 'Acer';
  if (/\bapple\b/.test(n))  return 'Apple';
  return null;
}

function parseCpu(text) {
  const n = normalize(text);
  for (const { re, cpu, tier } of CPU_PATTERNS) {
    if (re.test(n)) return { cpu, tier };
  }
  return null;
}

function parseRam(text) {
  const n = normalize(text);
  const m = n.match(/\b(4|8|12|16|24|32|64)\s*(?:gb|g\b|de\s+ram\b|ram\b)/);
  if (!m) return null;
  return parseInt(m[1]);
}

function parseStorage(text) {
  const n = normalize(text);
  if (/\b1\s*(?:tb|tera|terabyte)\b/.test(n)) return 1000;
  const m = n.match(/\b(128|256|512|1000|1024)\s*(?:gb|g\b|ssd\b|disco\b|almacenamiento\b)?/);
  if (!m) return null;
  const v = parseInt(m[1]);
  return v === 1000 || v === 1024 ? 1000 : v;
}

// Convert Odoo product.processor name to normalized cpu/tier
function normalizeCpuFromOdoo(processorName) {
  if (!processorName) return null;
  const n = normalize(processorName);
  // Matches like "intel - i5", "amd - r7", "intel - core u7", "intel - c5"
  if (/core\s*u\s*9/.test(n)) return { cpu: 'coreu9', tier: 9 };
  if (/core\s*u\s*7/.test(n)) return { cpu: 'coreu7', tier: 7 };
  if (/core\s*u\s*5/.test(n)) return { cpu: 'coreu5', tier: 5 };
  if (/core\s*7|c\s*7/.test(n)) return { cpu: 'core7', tier: 7 };
  if (/core\s*5|c\s*5/.test(n)) return { cpu: 'core5', tier: 5 };
  if (/i\s*9/.test(n)) return { cpu: 'i9', tier: 9 };
  if (/i\s*7/.test(n)) return { cpu: 'i7', tier: 7 };
  if (/i\s*5/.test(n)) return { cpu: 'i5', tier: 5 };
  if (/i\s*3/.test(n)) return { cpu: 'i3', tier: 3 };
  if (/r\s*9|ryzen\s*9/.test(n)) return { cpu: 'ryzen9', tier: 9 };
  if (/r\s*7|ryzen\s*7/.test(n)) return { cpu: 'ryzen7', tier: 7 };
  if (/r\s*5|ryzen\s*5/.test(n)) return { cpu: 'ryzen5', tier: 5 };
  if (/r\s*3|ryzen\s*3/.test(n)) return { cpu: 'ryzen3', tier: 3 };
  return null;
}

// Parse structured fields from an Odoo product name (strips SKU prefix)
function parseProductName(name) {
  const desc = name.replace(/^[A-Z0-9][\w\-]*\s*[-–]\s*/i, '').trim();
  const cpuResult = parseCpu(desc);
  return {
    cleanName: desc,
    brand: parseBrand(desc),
    cpu: cpuResult ? cpuResult.cpu : null,
    procTier: cpuResult ? cpuResult.tier : null,
    ramGb: parseRam(desc),
    storageGb: parseStorage(desc),
  };
}

// Parse a user's WhatsApp query
function parseQuery(text) {
  const cpuResult = parseCpu(text);
  return {
    brand: parseBrand(text),
    cpu: cpuResult ? cpuResult.cpu : null,
    tier: cpuResult ? cpuResult.tier : null,
    ramGb: parseRam(text),
    storageGb: parseStorage(text),
  };
}

module.exports = {
  normalize,
  parseBrand,
  parseCpu,
  parseRam,
  parseStorage,
  parseProductName,
  parseQuery,
  normalizeCpuFromOdoo,
  CPU_TIER_MEMBERS,
  STORAGE_TIERS,
};
