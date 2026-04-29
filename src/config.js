require('dotenv').config();

const REQUIRED_ENV = [
  'WAHA_URL',
  'WEBHOOK_SECRET',
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USER',
  'ODOO_PASSWORD',
];

function getConfig() {
  return {
    port: process.env.PORT || 3000,
    dbPath: process.env.DB_PATH || './data/products.db',
    wahaUrl: process.env.WAHA_URL,
    wahaSession: process.env.WAHA_SESSION || 'default',
    wahaApiKey: process.env.WAHA_API_KEY || '',
    webhookSecret: process.env.WEBHOOK_SECRET,
    botTrigger: (process.env.BOT_TRIGGER || 'stock').toLowerCase(),
    advisorPhone: process.env.ADVISOR_PHONE || '+54 9 11 5221-4436',
    odooUrl: process.env.ODOO_URL,
    odooDb: process.env.ODOO_DB,
    odooUser: process.env.ODOO_USER,
    odooPassword: process.env.ODOO_PASSWORD,
  };
}

function validateStartupEnv() {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { getConfig, validateStartupEnv };
