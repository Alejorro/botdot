# BotDot - WhatsApp Laptop Stock Bot

BotDot answers WhatsApp messages about laptop availability. It reads from a local SQLite cache that is synced from Odoo, so customer messages do not query Odoo directly.

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
- Only messages that start with `BOT_TRIGGER` are handled.
- The bot reads only active, in-stock products from SQLite.
- Odoo sync runs at startup and every 2 hours.
- Products not seen in the latest successful sync are marked inactive and stock is set to `0`.
- Customer replies never show prices or exact stock quantities.

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

## Production Note

WAHA is intended for the first test version. The final production version should use WhatsApp Cloud API. Keep WhatsApp provider logic isolated so `sendMessage` and webhook parsing can later be replaced without changing product sync, filtering, or formatting logic.
