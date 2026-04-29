require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const { parseQuery } = require('./parser');
const { filterProducts, fallbackProducts } = require('./filter');
const { formatResults, formatNoResults, formatHelp } = require('./formatter');
const { sync } = require('./sync');

const app = express();
app.use(express.json());

const WAHA_URL = process.env.WAHA_URL;
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const BOT_TRIGGER = (process.env.BOT_TRIGGER || 'stock').toLowerCase();
const PORT = process.env.PORT || 3000;

async function sendMessage(chatId, text) {
  const headers = WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {};
  await axios.post(
    `${WAHA_URL}/api/sendText`,
    { chatId, text, session: WAHA_SESSION },
    { headers }
  );
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const { event, payload } = req.body || {};
  if (event !== 'message' || !payload || payload.fromMe) return;

  const body = (payload.body || '').trim();
  const chatId = payload.from;
  if (!chatId || !body) return;

  if (!body.toLowerCase().startsWith(BOT_TRIGGER)) return;

  const queryText = body.slice(BOT_TRIGGER.length).trim();
  if (!queryText) {
    await sendMessage(chatId, formatHelp(BOT_TRIGGER)).catch(() => {});
    return;
  }

  const query = parseQuery(queryText);
  const results = filterProducts(query);

  if (results.length > 0) {
    await sendMessage(chatId, formatResults(results)).catch(() => {});
    return;
  }

  const fallback = fallbackProducts(query);
  if (fallback.length > 0) {
    const msg = formatResults(fallback, 'No encontré exactamente eso, pero tengo opciones similares:');
    await sendMessage(chatId, msg).catch(() => {});
  } else {
    await sendMessage(chatId, formatNoResults()).catch(() => {});
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', trigger: BOT_TRIGGER, session: WAHA_SESSION });
});

// Sync every 2 hours
cron.schedule('0 */2 * * *', () => {
  sync().catch(err => console.error('[cron] Sync failed:', err.message));
});

app.listen(PORT, () => {
  console.log(`BotDot running on port ${PORT} — trigger: "${BOT_TRIGGER}"`);
  sync().catch(err => console.error('[startup] Initial sync failed:', err.message));
});
