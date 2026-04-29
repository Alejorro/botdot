require('dotenv').config();

const ADVISOR_PHONE = process.env.ADVISOR_PHONE || '+54 9 11 5221-4436';

function formatStock(stock) {
  const n = Math.floor(stock);
  return n === 1 ? '1 unidad' : `${n} unidades`;
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
