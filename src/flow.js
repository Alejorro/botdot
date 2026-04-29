const { getSession, setSession, clearSession } = require('./session');
const { parseQuery } = require('./parser');
const { filterProducts, fallbackProducts } = require('./filter');
const { formatResults, formatNoResults } = require('./formatter');

const GREETING = [
  '¡Hola! 👋 Soy el asistente de *DOT4*.',
  '¿En qué te puedo ayudar?\n',
  '1️⃣ Consultar stock de Portables',
  '2️⃣ Otros',
].join('\n');

const PORTABLES_PROMPT = [
  '¿Qué características buscás?',
  'Podés decirme marca, procesador, RAM o almacenamiento.\n',
  'Ejemplos:',
  '• lenovo i5 16gb',
  '• ryzen 5 512gb',
  '• hp i7 1tb\n',
  '_Escribí *0* para volver al menú._',
].join('\n');

const OTHERS_MENU = [
  '¿Con qué necesitás ayuda?\n',
  '1️⃣ Hablar con un asesor',
  '2️⃣ Soporte técnico',
  '3️⃣ Página web\n',
  '_Escribí *0* para volver al menú principal._',
].join('\n');

const INVALID = '❌ No entendí esa opción. Por favor elegí una de las opciones disponibles.';

const BACK_HINT = '\n_Podés buscar otra vez o escribí *0* para volver al menú._';

const REDIRECT = {
  asesor:  'Te conectamos con un asesor:\n👉 [PLACEHOLDER_ASESOR_PHONE]',
  soporte: 'Para soporte técnico contactate con:\n👉 [PLACEHOLDER_SOPORTE_PHONE]',
  web:     'Visitá nuestra página web:\n👉 www.dot4sa.com.ar',
};

function isBackCommand(text) {
  return ['0', 'menu', 'inicio', 'volver'].includes(text);
}

function handleMessage(chatId, rawText) {
  const text = rawText.trim();
  const normalized = text.toLowerCase();
  const session = getSession(chatId);

  if (!session || isBackCommand(normalized)) {
    setSession(chatId, 'awaiting_main');
    return GREETING;
  }

  const { step } = session;

  if (step === 'awaiting_main') {
    if (normalized === '1') {
      setSession(chatId, 'awaiting_query');
      return PORTABLES_PROMPT;
    }
    if (normalized === '2') {
      setSession(chatId, 'awaiting_others');
      return OTHERS_MENU;
    }
    return INVALID + '\n\n' + GREETING;
  }

  if (step === 'awaiting_query') {
    const query = parseQuery(text);
    const results = filterProducts(query);

    let response;
    if (results.length > 0) {
      response = formatResults(results);
    } else {
      const fallback = fallbackProducts(query);
      response = fallback.length > 0
        ? formatResults(fallback, 'No encontré una opción exacta, pero tengo opciones similares:')
        : formatNoResults();
    }

    setSession(chatId, 'awaiting_query');
    return response + BACK_HINT;
  }

  if (step === 'awaiting_others') {
    if (normalized === '1') { clearSession(chatId); return REDIRECT.asesor; }
    if (normalized === '2') { clearSession(chatId); return REDIRECT.soporte; }
    if (normalized === '3') { clearSession(chatId); return REDIRECT.web; }
    return INVALID + '\n\n' + OTHERS_MENU;
  }

  // Unknown state — reset
  setSession(chatId, 'awaiting_main');
  return GREETING;
}

module.exports = { handleMessage };
