require('dotenv').config();
const { getConfig } = require('./config');

const ADVISOR_PHONE = getConfig().advisorPhone;

const CPU_DISPLAY = {
  i3: 'Core i3', i5: 'Core i5', i7: 'Core i7', i9: 'Core i9',
  ryzen3: 'Ryzen 3', ryzen5: 'Ryzen 5', ryzen7: 'Ryzen 7', ryzen9: 'Ryzen 9',
  coreu5: 'Core Ultra 5', coreu7: 'Core Ultra 7', coreu9: 'Core Ultra 9',
  core5: 'Core 5', core7: 'Core 7', core9: 'Core 9',
};

const SERIES_DISPLAY = {
  thinkpad: 'ThinkPad', thinkbook: 'ThinkBook', ideapad: 'IdeaPad',
  vivobook: 'VivoBook', zenbook: 'ZenBook', pavilion: 'Pavilion',
  elitebook: 'EliteBook', probook: 'ProBook', envy: 'Envy', spectre: 'Spectre',
  inspiron: 'Inspiron', latitude: 'Latitude', xps: 'XPS',
};

function formatStock(stock) {
  const n = Math.floor(stock);
  if (n <= 2) return 'Stock bajo';
  if (n <= 10) return 'Disponible';
  return '+10 disponibles';
}

function formatProductTitle(product) {
  const brand = product.brand || '';
  const text = (product.clean_name || product.name).replace(/^[-–\s]+/, '').trim();
  const lower = text.toLowerCase();

  let series = null;
  for (const [key, display] of Object.entries(SERIES_DISPLAY)) {
    if (lower.includes(key)) { series = display; break; }
  }

  // Model number: letter + 2-3 digits (L16, E14, X13) or standalone digits (1040)
  const modelMatch = text.match(/\b([A-Z]\d{2,3})\b/);
  const modelNum = modelMatch ? modelMatch[1] : null;

  // Generation: G1–G11
  const genMatch = text.match(/\bG(\d{1,2})\b/i);
  const gen = genMatch ? `Gen ${genMatch[1]}` : null;

  const parts = [brand];
  if (series) parts.push(series);
  if (modelNum) parts.push(modelNum);
  if (gen) parts.push(gen);

  return parts.filter(Boolean).join(' ');
}

function formatProductSpecs(product) {
  const parts = [];
  if (product.processor) parts.push(CPU_DISPLAY[product.processor] || product.processor.toUpperCase());
  if (product.ram_gb) parts.push(`${product.ram_gb}GB RAM`);
  if (product.storage_gb) parts.push(product.storage_gb === 1000 ? '1TB SSD' : `${product.storage_gb}GB SSD`);
  return parts.join(' · ');
}

function formatProductCard(product, index) {
  const title = formatProductTitle(product);
  const specs = formatProductSpecs(product);
  const stock = formatStock(product.stock);
  const lines = [`${index}) ${title}`];
  if (specs) lines.push(specs);
  lines.push(`📦 ${stock}`);
  return lines.join('\n');
}

const FOLLOWUP_HINT = [
  '',
  'Podés escribir:',
  '• *más opciones* — ver más resultados',
  '• *mejor* — procesador más potente',
  '• *más barato* — opción más económica',
  '• *asesor* — hablar con alguien',
].join('\n');

function formatResults(products, intro = 'Tenemos estas opciones:', offset = 0) {
  const lines = [intro, ''];
  products.forEach((p, i) => {
    lines.push(formatProductCard(p, offset + i + 1));
    lines.push('');
  });
  lines.push(`¿Querés más info o reservar alguna?`);
  lines.push(`👉 Asesor: ${ADVISOR_PHONE}`);
  lines.push(FOLLOWUP_HINT);
  return lines.join('\n');
}

function formatNoResults() {
  return [
    'No encontré notebooks con esas características en stock.',
    '',
    'Podés intentar con otros términos o hablar con un asesor:',
    `👉 ${ADVISOR_PHONE}`,
  ].join('\n');
}

function formatFallback(products, originalQuery) {
  const intro = `No encontré exactamente *${originalQuery}* en stock, pero tengo estas opciones similares:`;
  return formatResults(products, intro);
}

module.exports = { formatResults, formatNoResults, formatFallback };
