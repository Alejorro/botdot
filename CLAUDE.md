# BotDot — WhatsApp Laptop Bot

WhatsApp bot that answers product availability queries from a local SQLite cache synced from Odoo.

## Current Status

- Code complete and tested locally against real Odoo data
- Repo: https://github.com/Alejorro/botdot
- Deployed to Railway (service: botdot) — env vars configured
- **Pending:** link a WhatsApp number via WAHA to activate the bot
  - Decision: use a separate prepaid SIM (not personal number)
  - WAHA instance already running at `waha-production-8cff.up.railway.app`
  - Once SIM is ready: add new session in WAHA, scan QR, set webhook to `https://<botdot-railway-url>/webhook`

## Architecture

```
User (WhatsApp)
    ↓ message
WAHA (Railway) — waha-production-8cff.up.railway.app
    ↓ POST /webhook
BotDot server (Express) — Railway
    ↓ reads
SQLite cache (data/products.db)
    ↑ synced every 2h via cron
Odoo — odoo.dot4sa.com
```

**The bot never queries Odoo at runtime.** All queries hit SQLite only.
Odoo credentials exist only for the sync process (`src/sync.js`).

## Environment Variables

| Variable | Description | Value |
|---|---|---|
| `PORT` | Express port | set by Railway automatically |
| `DB_PATH` | SQLite file path | `./data/products.db` (default) |
| `WAHA_URL` | WAHA instance URL | `https://waha-production-8cff.up.railway.app` |
| `WAHA_SESSION` | WAHA session name | `default` |
| `WAHA_API_KEY` | WAHA API key | empty (not used) |
| `ODOO_URL` | Odoo instance URL | `https://odoo.dot4sa.com` |
| `ODOO_DB` | Odoo database name | `dot4-prod` |
| `ODOO_USER` | Odoo login | `alejo.palladino@dot4sa.com` |
| `ODOO_PASSWORD` | Odoo password | set in Railway |
| `BOT_TRIGGER` | Trigger word | `stock` |
| `ADVISOR_PHONE` | Phone shown in responses | `+54 9 11 5221-4436` |

## Running Locally

```bash
cp .env.example .env
# fill in ODOO_PASSWORD and WAHA_URL

npm install
npm start        # starts server + initial sync + registers cron
npm run sync     # manual one-off sync
```

Requires Node 22.5+ (uses built-in `node:sqlite`, no native compilation).

## Trigger Word

The bot only responds to messages that start with `BOT_TRIGGER` (default: `stock`).
Messages without the trigger are silently ignored — allows sharing a WAHA session with another bot.

```
stock laptop i5 16gb
stock lenovo ryzen 5 512gb
stock hp i7
stock              ← returns help message
```

## Odoo Sync (`src/sync.js`)

- Runs on startup and every 2 hours via cron (`0 */2 * * *`)
- Fetches all products with `categ_id = 141` (PORTABLES)
- Resolves `brand_ids` → `product.brand.name` and `processor_ids` → `product.processor.name`
- Falls back to name parsing when those fields are empty (many older Odoo entries have them blank)
- Upserts into SQLite by SKU — 237 products total, ~51 in stock (as of last test)

**SQLite schema:**
```sql
sku         TEXT PRIMARY KEY
name        TEXT    -- raw Odoo name (includes SKU prefix)
clean_name  TEXT    -- name with SKU prefix stripped
price       REAL
stock       REAL
brand       TEXT    -- "Lenovo", "HP"
processor   TEXT    -- normalized: "i5", "ryzen7", "coreu7", "core5", etc.
proc_tier   INTEGER -- 3, 5, 7, or 9 (used for cross-brand fallback)
ram_gb      INTEGER -- 8, 16, 32
storage_gb  INTEGER -- 256, 512, 1000 (1TB = 1000)
last_updated TEXT   -- Odoo write_date
```

## Product Parsing (`src/parser.js`)

Structured Odoo fields (`brand_ids`, `processor_ids`) take priority.
Falls back to regex on the product name string.

| Field | Logic |
|---|---|
| **Brand** | Regex: Lenovo, HP, Dell, Asus, Acer, Apple |
| **CPU** | Regex: `i3/i5/i7/i9`, `R3/R5/R7/R9`, `Ryzen N`, `Core N`, `Core UN` |
| **proc_tier** | Integer 3/5/7/9 — cross-brand equivalence (i5 ↔ Ryzen 5 ↔ Core U5) |
| **RAM** | Matches `8GB`, `16GB`, `32GB` |
| **Storage** | Matches `256GB`, `512GB`, `1TB` → stored as 1000 |

Odoo processor name mapping examples:
- `INTEL - I5` → `i5` (tier 5)
- `AMD - R7` → `ryzen7` (tier 7)
- `INTEL - CORE U7` → `coreu7` (tier 7)
- `INTEL - C5` → `core5` (tier 5)

## Filtering Logic (`src/filter.js`)

**Score per product vs query:**
| Match | Points |
|---|---|
| Brand exact | +10 |
| CPU exact | +8 |
| CPU same tier (e.g. i5 ↔ Ryzen 5) | +4 |
| RAM exact | +5 |
| Storage exact | +3 |
| Storage ±1 tier | +1 |

Sort: score desc → stock desc → name asc. Returns max 5.

**Fallback** (when no results): relaxed criteria — same CPU tier across brands, same RAM, storage ±1 tier.

## Response Format (no prices ever shown)

**Results found:**
```
*Tenemos estas opciones disponibles:*

1) THINKPAD LENOVO X13 I5 8GB/256GB/W11P
📦 Stock: 27 unidades

¿Querés más info o reservar alguna?
👉 Hablá con un asesor: +54 9 11 5221-4436
```

**Fallback:**
```
No encontré exactamente eso, pero tengo opciones similares:
[same format]
```

**Nothing:**
```
No encontré notebooks con esas características en stock.
¿Querés que te muestre opciones similares o hablás con un asesor?
👉 +54 9 11 5221-4436
```

## WAHA Webhook Setup (pending)

1. Get a new prepaid SIM
2. In WAHA dashboard: add new session → scan QR with that number
3. Set webhook URL to `https://<botdot-railway-url>/webhook`
4. Test: send `stock laptop i5` from any WhatsApp

## Health Check

```
GET /health → { status: "ok", trigger: "stock", session: "default" }
```
