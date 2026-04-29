require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
const { parseQuery } = require('./parser');
const { filterProducts, fallbackProducts } = require('./filter');
const { formatResults, formatNoResults, formatHelp } = require('./formatter');
const { syncWithLock, isSyncRunning } = require('./sync');
const { getHealthStats } = require('./db');
const { getConfig, validateStartupEnv } = require('./config');

const app = express();
app.use(express.json());

const config = getConfig();

function timingSafeEqualText(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAuthorizedWebhook(req) {
  return timingSafeEqualText(req.get('x-webhook-secret'), config.webhookSecret);
}

function logSendError(err, chatId) {
  const status = err.response ? err.response.status : null;
  const detail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
  console.error('[waha] Send failed', { chatId, status, message: detail });
}

async function sendMessage(chatId, text) {
  const headers = config.wahaApiKey ? { 'X-Api-Key': config.wahaApiKey } : {};
  await axios.post(
    `${config.wahaUrl}/api/sendText`,
    { chatId, text, session: config.wahaSession },
    { headers }
  );
}

app.post('/webhook', async (req, res) => {
  if (!isAuthorizedWebhook(req)) {
    console.warn('[webhook] Rejected request with invalid or missing x-webhook-secret');
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  const { event, payload } = req.body || {};
  if (event !== 'message' || !payload || payload.fromMe) return;

  const body = (payload.body || '').trim();
  const chatId = payload.from;
  if (!chatId || !body) return;

  if (!body.toLowerCase().startsWith(config.botTrigger)) return;

  const queryText = body.slice(config.botTrigger.length).trim();
  if (!queryText) {
    try {
      await sendMessage(chatId, formatHelp(config.botTrigger));
    } catch (err) {
      logSendError(err, chatId);
    }
    return;
  }

  const query = parseQuery(queryText);
  const results = filterProducts(query);

  if (results.length > 0) {
    try {
      await sendMessage(chatId, formatResults(results));
    } catch (err) {
      logSendError(err, chatId);
    }
    return;
  }

  const fallback = fallbackProducts(query);
  if (fallback.length > 0) {
    const msg = formatResults(
      fallback,
      'No encontré una opción exacta con esas características, pero tengo opciones similares:'
    );
    try {
      await sendMessage(chatId, msg);
    } catch (err) {
      logSendError(err, chatId);
    }
  } else {
    try {
      await sendMessage(chatId, formatNoResults());
    } catch (err) {
      logSendError(err, chatId);
    }
  }
});

app.get('/health', (_req, res) => {
  try {
    res.json({
      status: 'ok',
      trigger: config.botTrigger,
      session: config.wahaSession,
      syncRunning: isSyncRunning(),
      ...getHealthStats(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      dbAvailable: false,
      message: err.message,
      trigger: config.botTrigger,
      session: config.wahaSession,
      syncRunning: isSyncRunning(),
    });
  }
});

function start() {
  validateStartupEnv();
  // Sync every 2 hours.
  cron.schedule('0 */2 * * *', () => {
    syncWithLock().catch(err => console.error('[cron] Sync failed:', err.message));
  });

  app.listen(config.port, () => {
    console.log(`BotDot running on port ${config.port} - trigger: "${config.botTrigger}"`);
    syncWithLock().catch(err => console.error('[startup] Initial sync failed:', err.message));
  });
}

if (require.main === module) start();

module.exports = { app, start, sendMessage, isAuthorizedWebhook };
