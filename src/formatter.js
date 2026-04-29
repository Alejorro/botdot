require('dotenv').config();

const { getConfig } = require('./config');
const ADVISOR_PHONE = getConfig().advisorPhone;

function formatStock(stock) {
  const n = Math.floor(stock);
  if (n <= 2) return 'Stock bajo';
  if (n <= 10) return 'Disponible';
  return '+10 disponibles';
}

function formatProductLine(product) {
  return (product.clean_name || product.name)
    .replace(/^[-–\s]+/, '')
    .trim();
}

function formatResults(products, intro = '*Tenemos estas opciones disponibles:*') {
  const lines = [intro, ''];
  products.forEach((p, i) => {
    lines.push(`${i + 1}) ${formatProductLine(p)}`);
    lines.push(`📦 Stock: ${formatStock(p.stock)}`);
    lines.push('');
  });
  lines.push('¿Querés más info o reservar alguna?');
  lines.push(`👉 Hablá con un asesor: ${ADVISOR_PHONE}`);
  return lines.join('\n');
}

function formatNoResults() {
  return [
    'No encontré notebooks con esas características en stock.',
    '¿Querés que te muestre opciones similares o hablás con un asesor?',
    `👉 ${ADVISOR_PHONE}`,
  ].join('\n');
}

function formatHelp(trigger) {
  return [
    `Buscá notebooks disponibles escribiendo *${trigger}* seguido de lo que necesitás.`,
    '',
    'Ejemplos:',
    `• ${trigger} laptop i5 16gb`,
    `• ${trigger} lenovo ryzen 5 512gb`,
    `• ${trigger} hp i7 16gb 1tb`,
    '',
    `👉 Asesor: ${ADVISOR_PHONE}`,
  ].join('\n');
}

module.exports = { formatResults, formatNoResults, formatHelp };
