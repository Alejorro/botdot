# BotDot - WhatsApp Laptop Stock Bot

BotDot answers WhatsApp messages about laptop availability. It reads from a local SQLite cache that is synced from Odoo, so customer messages do not query Odoo directly.

## Deploy Status

### BotDot — ✅ funcionando
- URL: `https://botdot-production-8fb0.up.railway.app`
- Health OK: 237 productos, 50 en stock, sync corriendo cada 2h
- Todas las variables configuradas en Railway

### WAHA para BotDot — ⚠️ pendiente de configurar
- URL: `https://waha-production-39db.up.railway.app`
- Variables actuales en Railway:
  - `WAHA_DASHBOARD_USERNAME=admin`
  - `WAHA_DASHBOARD_PASSWORD=admin`
  - `WHATSAPP_DEFAULT_ENGINE=WEBJS`
  - `WHATSAPP_HOOK_URL=https://botdot-production-8fb0.up.railway.app/webhook`
  - `WHATSAPP_HOOK_EVENTS=message`
  - `WHATSAPP_HOOK_CUSTOM_HEADERS=x-webhook-secret:dot4bot2024secreto`
  - `WAHA_API_KEY=admin`
- **Pendiente:** agregar `WHATSAPP_API_KEY=admin` (falta esta variable)
- **Pendiente:** el login al dashboard no funcionó — probar con `admin`/`admin` después del redeploy
- **Pendiente:** corregir en BotDot `WAHA_URL` → agregar `https://` adelante

### Próximos pasos para activar el bot
1. En WAHA (`waha-production-39db`) → agregar variable `WHATSAPP_API_KEY=admin` → redeploy
2. En BotDot → corregir `WAHA_URL=https://waha-production-39db.up.railway.app` → redeploy
3. Entrar al dashboard WAHA con `admin` / `admin`
4. Crear sesión → escanear QR con el número nuevo (SIM prepago)
5. Mandar `Hola` desde WhatsApp y verificar que responde

### WAHA del otro bot (NO tocar)
- URL: `https://waha-production-8cff.up.railway.app`
- Sesión: `default` — número Ayudame Loco Ayudame (549115221...)
- API key: `gasta22`

## Current Status

Implemented and verified locally:
- Webhook security with required `WEBHOOK_SECRET` header validation.
- WAHA send error logging with `chatId`, HTTP status, and error message.
- Startup environment validation for required BotDot, WAHA, and Odoo variables.
- Stale product handling with `is_active` and `stale_at`.
- Safer filtering: exact requested specs first, similar options only when exact specs are unavailable.
- Casual WhatsApp parser support for phrases like `16 ram`, `512 ssd`, `1 tera`, and `1000gb`.
- Customer-safe stock labels: `Stock bajo`, `Disponible`, and `+10 disponibles`.
- Improved `/health` endpoint with DB and sync status.
- Sync lock to avoid overlapping startup/cron syncs.
- Basic tests for parser, filtering, stale sync behavior, and formatter.
- `node-cron` updated to `4.2.1`; `npm audit --omit=dev` reports zero vulnerabilities.

Verification commands run:

```bash
node --check src/server.js
node --check src/sync.js
node --check src/db.js
node --check src/config.js
node --check src/parser.js
node --check src/filter.js
node --check src/formatter.js
npm test
npm audit --omit=dev
```

Operator setup instructions live in `SETUP.md`.

## Current Architecture

```text
Customer on WhatsApp
  -> WAHA webhook
  -> BotDot Express server
  -> SQLite cache at DB_PATH
  -> periodic Odoo sync updates the cache
```

Runtime behavior:
- `/webhook` receives WAHA message events.
- The webhook must include header `x-webhook-secret` with the same value as `WEBHOOK_SECRET`.
- Invalid or missing webhook secrets return HTTP `401`.
- Only messages that start with `BOT_TRIGGER` are handled.
- The bot reads only active, in-stock products from SQLite.
- Odoo sync runs at startup and every 2 hours.
- A sync lock prevents overlapping syncs.
- Products not seen in the latest successful sync are marked inactive and stock is set to `0`.
- `/health` reports DB availability, product counts, last successful sync, stale sync status, and sync lock status.
- Customer replies never show prices or exact stock quantities.

## Key Source Files

| File | Purpose |
|---|---|
| `src/server.js` | Express app, webhook validation, WAHA send calls, `/health`, startup sync scheduling. |
| `src/config.js` | Central config reader and required environment validation. |
| `src/sync.js` | Odoo XML-RPC sync, stale product handling, sync lock. |
| `src/db.js` | SQLite connection, schema creation/migration, sync metadata, health stats. |
| `src/parser.js` | Product/query parsing for brand, CPU, RAM, and storage. |
| `src/filter.js` | Exact matching, similar fallback matching, active-stock filtering. |
| `src/formatter.js` | Customer-facing WhatsApp response formatting. |
| `test/` | Node test suite for parser, filter, formatter, and stale sync behavior. |

## Environment Variables

Copy `.env.example` to `.env` locally, and set the same variables in Railway for deployment.

| Variable | Required | Description |
|---|---:|---|
| `PORT` | No | Express port. Railway sets this automatically. |
| `DB_PATH` | No | SQLite file path. Default: `./data/products.db`. |
| `WAHA_URL` | Yes | Base URL of the WAHA service. |
| `WAHA_SESSION` | No | WAHA session name. Default: `default`. |
| `WAHA_API_KEY` | No | WAHA API key if WAHA API auth is enabled. |
| `WEBHOOK_SECRET` | Yes | Shared secret required in WAHA webhook header `x-webhook-secret`. |
| `ODOO_URL` | Yes | Odoo base URL. |
| `ODOO_DB` | Yes | Odoo database name. |
| `ODOO_USER` | Yes | Odoo user/login used for sync. |
| `ODOO_PASSWORD` | Yes | Odoo password or API credential used for sync. |
| `BOT_TRIGGER` | No | Trigger word. Default: `stock`. |
| `ADVISOR_PHONE` | No | Advisor phone shown in bot replies. |

Do not commit real service URLs, Odoo users, passwords, API keys, or phone numbers unless they are intentionally public.

Safe local example:

```text
WAHA_URL=https://your-waha-service.example.com
WAHA_SESSION=default
WAHA_API_KEY=
WEBHOOK_SECRET=replace-with-a-long-random-secret
ODOO_URL=https://your-odoo-instance.example.com
ODOO_DB=your-odoo-database
ODOO_USER=your-odoo-user@example.com
ODOO_PASSWORD=replace-with-real-password-locally-only
BOT_TRIGGER=stock
ADVISOR_PHONE=+00 0000 0000
```

## Local Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and fill in the real values.

Run tests:

```bash
npm test
```

Run a one-off Odoo sync:

```bash
npm run sync
```

Start the bot:

```bash
npm start
```

Expected startup result:
- The server logs the selected port and trigger word.
- The startup sync begins.
- `/health` returns JSON with DB counts and sync status.

## Filtering Rules

For customer queries with CPU, RAM, or storage:
- Exact results must match every requested spec that the parser understood.
- Brand-only matches are not enough when specs were requested.
- If no exact result exists, the bot says no exact option was found before showing similar options.
- Similar options can match CPU tier, RAM, or nearby storage, but stale/inactive products are never shown.

Examples:
- `stock hp i7 16gb 1tb` does not return an HP product only because it is HP.
- `stock notebook i5 16 ram 512 ssd` can match casual RAM/storage wording.

## Stock Display Rules

Never show exact stock quantities to customers.

| Internal stock | Customer label |
|---:|---|
| `1-2` | `Stock bajo` |
| `3-10` | `Disponible` |
| `11+` | `+10 disponibles` |

## WAHA Webhook Setup

Configure WAHA to send only message events to BotDot.

Webhook URL:

```text
https://YOUR-BOTDOT-DOMAIN/webhook
```

Custom webhook header:

```text
x-webhook-secret: YOUR_WEBHOOK_SECRET
```

For WAHA environment-based setup, set:

```text
WHATSAPP_HOOK_URL=https://YOUR-BOTDOT-DOMAIN/webhook
WHATSAPP_HOOK_EVENTS=message
WHATSAPP_HOOK_CUSTOM_HEADERS=x-webhook-secret:YOUR_WEBHOOK_SECRET
```

WAHA also supports session-level webhook `customHeaders`. Use the same header name and value there if configuring the session through the dashboard/API.

Requests without this header, or with the wrong value, are rejected before BotDot processes the message.

## Testing

From WhatsApp, send messages to the connected WAHA number:

```text
stock
stock laptop i5 16 ram 512 ssd
stock lenovo ryzen 5 16gb
stock hp i7 1tb
```

Expected behavior:
- `stock` returns help.
- Matching products return up to 5 options.
- Exact product stock is shown as `Stock bajo`, `Disponible`, or `+10 disponibles`.
- If exact specs are unavailable, the reply says that first and then shows similar options.

## Health Check

```bash
curl https://YOUR-BOTDOT-DOMAIN/health
```

Expected fields:
- `status`
- `dbAvailable`
- `totalProductCount`
- `inStockProductCount`
- `inactiveProductCount`
- `lastSuccessfulSync`
- `syncStale`
- `syncRunning`
- `trigger`
- `session`

`syncStale: true` means the last successful sync is missing or older than the configured health threshold.

Local health check:

```bash
curl http://localhost:3000/health
```

## Deployment

Deploy BotDot and WAHA as separate services.

BotDot Railway service:
1. Connect this repository.
2. Set the start command to `npm start`.
3. Add all required environment variables.
4. Deploy.
5. Open `/health` and confirm the DB and sync fields look correct.

WAHA Railway service:
1. Deploy WAHA separately.
2. Add the WAHA webhook URL and custom header.
3. Create/start a WAHA session.
4. Link the WhatsApp number by scanning the QR code.
5. Send test WhatsApp messages.

## Manual Configuration Still Required

- Create or choose the WhatsApp number for the test bot.
- Start the WAHA session and scan the QR code.
- Configure WAHA webhook URL and `x-webhook-secret` header.
- Set all Railway variables for BotDot and WAHA.
- Confirm Odoo credentials have permission to read product templates, brands, and processors.
- Confirm `/health` after deployment.
- Send a real WhatsApp message beginning with `BOT_TRIGGER`.

## Production Note

WAHA is intended for the first test version. The final production version should use WhatsApp Cloud API. Keep WhatsApp provider logic isolated so `sendMessage` and webhook parsing can later be replaced without changing product sync, filtering, or formatting logic.

Provider migration rule:
- Keep Odoo sync, SQLite, parser, filter, and formatter independent from WAHA.
- Replace only incoming webhook parsing and outgoing message delivery when moving to WhatsApp Cloud API.
