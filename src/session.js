const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || '300000'); // 5 min

const sessions = new Map();
const timers = new Map();

let _onExpire = null;

function onExpire(callback) {
  _onExpire = callback;
}

function getSession(chatId) {
  return sessions.get(chatId) || null;
}

function setSession(chatId, step) {
  // Reset timer on every interaction
  if (timers.has(chatId)) clearTimeout(timers.get(chatId));

  sessions.set(chatId, { step });

  const timer = setTimeout(() => {
    sessions.delete(chatId);
    timers.delete(chatId);
    if (_onExpire) _onExpire(chatId);
  }, SESSION_TTL_MS);

  timers.set(chatId, timer);
}

function clearSession(chatId) {
  if (timers.has(chatId)) {
    clearTimeout(timers.get(chatId));
    timers.delete(chatId);
  }
  sessions.delete(chatId);
}

module.exports = { getSession, setSession, clearSession, onExpire };
