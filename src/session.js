const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || '600000'); // 10 min

const sessions = new Map();

function getSession(chatId) {
  const s = sessions.get(chatId);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(chatId);
    return null;
  }
  return s;
}

function setSession(chatId, step) {
  sessions.set(chatId, {
    step,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

function clearSession(chatId) {
  sessions.delete(chatId);
}

module.exports = { getSession, setSession, clearSession };
