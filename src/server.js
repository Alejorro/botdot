require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
const { handleMessage } = require('./flow');
const { onExpire } = require('./session');
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

  const response = handleMessage(chatId, body);
  try {
    await sendMessage(chatId, response);
  } catch (err) {
    logSendError(err, chatId);
  }
});

app.get('/health', (_req, res) => {
  try {
    res.json({
      status: 'ok',
      session: config.wahaSession,
      syncRunning: isSyncRunning(),
      ...getHealthStats(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      dbAvailable: false,
      message: err.message,
      session: config.wahaSession,
      syncRunning: isSyncRunning(),
    });
  }
});

const GOODBYE = [
  'Esta conversación ha finalizado por inactividad.',
  'Si necesitás algo más, escribinos cuando quieras. 👋',
].join('\n');

function start() {
  validateStartupEnv();

  onExpire(async (chatId) => {
    try {
      await sendMessage(chatId, GOODBYE);
    } catch (err) {
      logSendError(err, chatId);
    }
  });

  cron.schedule('0 */2 * * *', () => {
    syncWithLock().catch(err => console.error('[cron] Sync failed:', err.message));
  });

  app.listen(config.port, () => {
    console.log(`BotDot running on port ${config.port}`);
    syncWithLock().catch(err => console.error('[startup] Initial sync failed:', err.message));
  });
}

if (require.main === module) start();

module.exports = { app, start, sendMessage, isAuthorizedWebhook };
