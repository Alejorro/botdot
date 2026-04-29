# BotDot Setup and Deployment Guide

This guide is written for an operator who needs to run BotDot, connect WhatsApp through WAHA, and deploy both services.

BotDot has two jobs:
- Sync laptop stock from Odoo into a local SQLite database.
- Answer WhatsApp stock questions using that local database.

WAHA is only the WhatsApp connector for the first test version. Later, the production version should move to WhatsApp Cloud API.

## 1. Run the Bot Locally

1. Open a terminal in the BotDot folder.

```bash
cd /path/to/BotDot
```

2. Install dependencies.

```bash
npm install
```

Expected result:

```text
found 0 vulnerabilities
```

3. Create your local `.env` file.

```bash
cp .env.example .env
```

4. Edit `.env` and fill in real values.

5. Run tests.

```bash
npm test
```

Expected result:

```text
pass
```

6. Test the Odoo sync.

```bash
npm run sync
```

Expected result:

```text
[sync] Authenticating with Odoo...
[sync] Fetching PORTABLES from Odoo...
[sync] Done - 000 synced, 0 skipped (no SKU)
```

The number will depend on the Odoo data.

7. Start the bot.

```bash
npm start
```

Expected result:

```text
BotDot running on port 3000 - trigger: "stock"
```

## 2. Configure the `.env` File

Use `.env.example` as the template.

Example structure:

```text
PORT=3000
DB_PATH=./data/products.db

WAHA_URL=https://your-waha-service.example.com
WAHA_SESSION=default
WAHA_API_KEY=
WEBHOOK_SECRET=replace-this-with-a-long-random-secret

ODOO_URL=https://your-odoo.example.com
ODOO_DB=your-odoo-database
ODOO_USER=your-odoo-user@example.com
ODOO_PASSWORD=your-odoo-password

BOT_TRIGGER=stock
ADVISOR_PHONE=+00 0000 0000
```

Important:
- `WEBHOOK_SECRET` should be long and random.
- Use the same `WEBHOOK_SECRET` in BotDot and WAHA.
- Do not commit `.env`.
- Railway variables replace `.env` in production.

## 3. Connect and Configure WAHA

WAHA is the service that connects WhatsApp to BotDot.

You need:
- A WhatsApp number for testing.
- A running WAHA service.
- A BotDot public URL.

High-level steps:

1. Open the WAHA dashboard.
2. Create or start a session.
3. Use the session name you configured in BotDot, usually `default`.
4. Scan the QR code with the WhatsApp phone.
5. Confirm the session status is connected.

Use a separate test number if possible. Do not use a personal number for production testing.

## 4. Set the WAHA Webhook URL

BotDot webhook URL format:

```text
https://YOUR-BOTDOT-DOMAIN/webhook
```

WAHA must send this custom header with every webhook request:

```text
x-webhook-secret: YOUR_WEBHOOK_SECRET
```

If configuring WAHA with environment variables:

```text
WHATSAPP_HOOK_URL=https://YOUR-BOTDOT-DOMAIN/webhook
WHATSAPP_HOOK_EVENTS=message
WHATSAPP_HOOK_CUSTOM_HEADERS=x-webhook-secret:YOUR_WEBHOOK_SECRET
```

Expected result:
- WAHA sends message events to `/webhook`.
- BotDot accepts requests only when the `x-webhook-secret` value matches `WEBHOOK_SECRET`.
- Requests without the header receive HTTP `401`.

WAHA documentation reference:
- https://waha.devlike.pro/docs/how-to/config/
- https://waha.devlike.pro/docs/how-to/events/

## 5. Test From WhatsApp

Send a WhatsApp message to the connected WAHA number.

Try:

```text
stock
```

Expected result:
- BotDot replies with help and example searches.

Try:

```text
stock notebook i5 16 ram 512 ssd
```

Expected result:
- If exact matches exist, BotDot shows up to 5 products.
- Stock is shown as `Stock bajo`, `Disponible`, or `+10 disponibles`.
- Exact quantities and prices are not shown.

Try:

```text
stock hp i7 32 ram 1tb
```

Expected result:
- If exact specs are unavailable, BotDot says no exact option was found.
- Then it may show similar options.

## 6. Deploy BotDot to Railway

1. Create a new Railway project.
2. Choose this GitHub repository.
3. Set the start command:

```bash
npm start
```

4. Add environment variables in Railway:

```text
WAHA_URL
WAHA_SESSION
WAHA_API_KEY
WEBHOOK_SECRET
ODOO_URL
ODOO_DB
ODOO_USER
ODOO_PASSWORD
BOT_TRIGGER
ADVISOR_PHONE
```

You do not need to set `PORT`; Railway sets it automatically.

5. Deploy.

6. Open:

```text
https://YOUR-BOTDOT-DOMAIN/health
```

Expected result:

```json
{
  "status": "ok",
  "dbAvailable": true,
  "totalProductCount": 237,
  "inStockProductCount": 50,
  "lastSuccessfulSync": "2026-04-29T00:00:00.000Z",
  "syncStale": false
}
```

The counts and timestamp will be different in real deployments.

## 7. Deploy and Configure WAHA

Deploy WAHA as a separate Railway service.

Minimum variables to configure for BotDot integration:

```text
WHATSAPP_HOOK_URL=https://YOUR-BOTDOT-DOMAIN/webhook
WHATSAPP_HOOK_EVENTS=message
WHATSAPP_HOOK_CUSTOM_HEADERS=x-webhook-secret:YOUR_WEBHOOK_SECRET
```

If WAHA API authentication is enabled, also set the WAHA API key and put the same value in BotDot as `WAHA_API_KEY`.

After WAHA deploys:

1. Open the WAHA dashboard.
2. Start the session, usually named `default`.
3. Scan the QR code with the WhatsApp phone.
4. Confirm the session is connected.
5. Send a WhatsApp test message.

## 8. Verify Odoo Sync

Run locally:

```bash
npm run sync
```

Or check Railway logs after deployment.

Expected successful logs:

```text
[sync] Authenticating with Odoo...
[sync] Fetching PORTABLES from Odoo...
[sync] Done - 237 synced, 0 skipped (no SKU)
```

Then open `/health`.

Healthy sync signs:
- `dbAvailable` is `true`.
- `totalProductCount` is greater than `0`.
- `inStockProductCount` is greater than `0` if Odoo has stock.
- `lastSuccessfulSync` has a recent timestamp.
- `syncStale` is `false`.

## 9. Troubleshooting Common Errors

### Bot starts with missing environment variables

Error:

```text
Missing required environment variables
```

Fix:
- Add the missing variables to `.env` locally.
- Add the missing variables to Railway in production.
- Redeploy after changing Railway variables.

### WAHA webhook gets HTTP 401

Cause:
- WAHA is not sending `x-webhook-secret`.
- The WAHA header value does not match BotDot `WEBHOOK_SECRET`.

Fix:
- Check BotDot `WEBHOOK_SECRET`.
- Check WAHA `WHATSAPP_HOOK_CUSTOM_HEADERS`.
- Make sure the format is exactly:

```text
x-webhook-secret:YOUR_WEBHOOK_SECRET
```

### Bot receives messages but does not reply

Possible causes:
- Message does not start with the trigger word.
- WAHA session name does not match `WAHA_SESSION`.
- `WAHA_URL` is wrong.
- WAHA API key is missing or wrong.

Fix:
- Send `stock` first.
- Check Railway logs for `[waha] Send failed`.
- Confirm `WAHA_URL` points to the WAHA service base URL.

### Odoo sync fails

Possible causes:
- Wrong Odoo URL, database, user, or password.
- Odoo user lacks permission to read products.
- Network from Railway to Odoo is blocked.

Fix:
- Run `npm run sync` locally with the same credentials.
- Check Railway logs for `[sync] Error`.
- Confirm Odoo permissions for product templates, brands, and processors.

### `/health` shows `syncStale: true`

Meaning:
- No successful sync has happened yet, or the last successful sync is old.

Fix:
- Check Odoo credentials.
- Check Railway logs.
- Restart the BotDot service to trigger startup sync.

## 10. Later Migration Notes

WAHA is only for the first test version.

The final production version should use WhatsApp Cloud API because it is the official Meta provider path.

Keep provider logic separated:
- Incoming webhook parsing should be isolated.
- Outgoing `sendMessage` should be isolated.
- Product sync, parser, filter, and formatter should not depend on WAHA.

When migrating to WhatsApp Cloud API, replace:
- WAHA webhook request parsing.
- WAHA `/api/sendText` call.
- WAHA session configuration.

Keep:
- Odoo sync.
- SQLite cache.
- Product parser.
- Product filtering.
- Message formatting.
