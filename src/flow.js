const { getSession, setSession, clearSession } = require('./session');
const { parseQuery } = require('./parser');
const { filterProducts, fallbackProducts } = require('./filter');
const { formatResults, formatNoResults, formatFallback } = require('./formatter');

const TIER_DOWN = { 5: 3, 7: 5, 9: 7 };
const TIER_UP   = { 3: 5, 5: 7, 7: 9 };

const GREETING = [
  '¡Hola! 👋 Soy el asistente de *DOT4*.',
  '¿Buscás notebooks o querés hablar con un asesor?\n',
  '1️⃣ Ver notebooks disponibles',
  '2️⃣ Hablar con un asesor',
].join('\n');

const QUERY_PROMPT = [
  '¿Qué características buscás?',
  'Podés decirme marca, procesador, RAM o almacenamiento.\n',
  'Ejemplos:',
  '• lenovo i5 16gb',
  '• ryzen 5 512gb',
  '• hp i7 1tb\n',
  '_Escribí *0* para volver al menú._',
].join('\n');

const ASESOR_MSG = 'Te conectamos con un asesor:\n👉 [PLACEHOLDER_ASESOR_PHONE]';
const INVALID    = '❌ No entendí esa opción. Por favor elegí una de las opciones disponibles.';
const NO_MORE    = 'No hay más opciones con esas características.\n\n' + ASESOR_MSG;

function isBack(t)    { return ['0', 'menu', 'inicio', 'volver'].includes(t); }
function isAsesor(t)  { return ['2', 'asesor', 'hablar', 'quiero hablar', 'necesito ayuda'].includes(t); }
function isMasOpc(t)  { return ['más opciones', 'mas opciones', 'más', 'otras', 'ver más', 'ver mas'].includes(t); }
function isMejor(t)   { return ['mejor', 'más potente', 'mas potente', 'más rápido', 'mas rapido', 'potente'].includes(t); }
function isBarato(t)  { return ['más barato', 'mas barato', 'barato', 'económico', 'economico', 'más económico', 'mas economico'].includes(t); }

function describeQuery(q) {
  const parts = [];
  if (q.brand) parts.push(q.brand);
  if (q.cpu) parts.push(q.cpu.toUpperCase());
  if (q.ramGb) parts.push(`${q.ramGb}GB`);
  if (q.storageGb) parts.push(q.storageGb === 1000 ? '1TB' : `${q.storageGb}GB`);
  return parts.join(' ') || 'esa búsqueda';
}

function showResults(chatId, query, offset = 0) {
  const results = filterProducts(query, offset);

  if (results.length > 0) {
    setSession(chatId, 'awaiting_followup', { lastQuery: query, lastOffset: offset + results.length });
    return formatResults(results, 'Tenemos estas opciones:', offset);
  }

  if (offset > 0) {
    setSession(chatId, 'awaiting_followup', { lastQuery: query, lastOffset: offset });
    return NO_MORE;
  }

  // No exact results — try fallback
  const fallback = fallbackProducts(query);
  if (fallback.length > 0) {
    setSession(chatId, 'awaiting_followup', { lastQuery: query, lastOffset: 0 });
    return formatFallback(fallback, describeQuery(query));
  }

  setSession(chatId, 'awaiting_query');
  return formatNoResults();
}

function handleMessage(chatId, rawText) {
  const text = rawText.trim();
  const normalized = text.toLowerCase();
  const session = getSession(chatId);

  // Always handle back and asesor shortcuts from anywhere
  if (!session || isBack(normalized)) {
    setSession(chatId, 'awaiting_main');
    return GREETING;
  }

  if (isAsesor(normalized)) {
    clearSession(chatId);
    return ASESOR_MSG;
  }

  const { step, lastQuery, lastOffset = 0 } = session;

  // ── Main menu ────────────────────────────────────────────────────────────
  if (step === 'awaiting_main') {
    if (normalized === '1' || ['notebook', 'notebooks', 'portables', 'laptop', 'laptops'].includes(normalized)) {
      setSession(chatId, 'awaiting_query');
      return QUERY_PROMPT;
    }
    return INVALID + '\n\n' + GREETING;
  }

  // ── Waiting for search query ──────────────────────────────────────────────
  if (step === 'awaiting_query') {
    const query = parseQuery(text);
    return showResults(chatId, query);
  }

  // ── Follow-up after results ───────────────────────────────────────────────
  if (step === 'awaiting_followup') {
    if (isMasOpc(normalized)) {
      return showResults(chatId, lastQuery, lastOffset);
    }

    if (isMejor(normalized) && lastQuery) {
      const newTier = TIER_UP[lastQuery.tier];
      if (!newTier) return 'Ya te mostré las opciones más potentes disponibles.\n\n' + ASESOR_MSG;
      const newQuery = { ...lastQuery, tier: newTier, cpu: null };
      return showResults(chatId, newQuery);
    }

    if (isBarato(normalized) && lastQuery) {
      const newTier = TIER_DOWN[lastQuery.tier];
      if (!newTier) return 'Ya te mostré las opciones más económicas disponibles.\n\n' + ASESOR_MSG;
      const newQuery = { ...lastQuery, tier: newTier, cpu: null };
      return showResults(chatId, newQuery);
    }

    // Any other text = new search
    const query = parseQuery(text);
    return showResults(chatId, query);
  }

  // Unknown state — reset
  setSession(chatId, 'awaiting_main');
  return GREETING;
}

module.exports = { handleMessage };
