# BotDot — WhatsApp Laptop Bot

WhatsApp bot that answers product availability queries from a local SQLite cache synced from Odoo.

## Architecture

```
User (WhatsApp)
    ↓ message
WAHA (Railway)
    ↓ POST /webhook
BotDot server (Express)
    ↓ reads
SQLite cache (data/products.db)
    ↑ synced every 2h
Odoo (odoo.dot4sa.com)
```

**The bot never queries Odoo at runtime.** All queries hit SQLite only.  
Odoo credentials exist only for the sync process.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Express port (default: 3000) |
| `DB_PATH` | SQLite file path (default: `./data/products.db`) |
| `WAHA_URL` | WAHA instance URL (Railway) |
| `WAHA_SESSION` | WAHA session name (default: `default`) |
| `WAHA_API_KEY` | WAHA API key (optional) |
| `ODOO_URL` | Odoo instance URL |
| `ODOO_DB` | Odoo database name |
| `ODOO_USER` | Odoo login email |
| `ODOO_PASSWORD` | Odoo password |
| `BOT_TRIGGER` | Trigger word (default: `stock`) |
| `ADVISOR_PHONE` | Phone shown in all responses |

## Running Locally

```bash
cp .env.example .env
# fill in .env

npm install
npm start          # starts server + runs initial sync + registers cron
npm run sync       # manual one-off sync
```

## Trigger Word

The bot only responds to messages that start with `BOT_TRIGGER` (default: `stock`).  
This allows sharing the WAHA phone number with another bot — messages without the trigger are ignored.

**Examples:**
```
stock laptop i5 16gb
stock lenovo ryzen 5 512gb
stock hp i7
stock
```

`stock` alone returns a help message with usage examples.

## Odoo Sync (`src/sync.js`)

- Runs on startup and every 2 hours via cron (`0 */2 * * *`)
- Fetches all products with `categ_id = 141` (PORTABLES)
- Resolves `brand_ids` → `product.brand.name` and `processor_ids` → `product.processor.name`
- Falls back to name parsing when those fields are empty (many older products)
- Upserts into SQLite by SKU

**SQLite schema:**
```sql
sku TEXT PRIMARY KEY
name TEXT          -- raw Odoo name (includes SKU prefix)
clean_name TEXT    -- name with SKU prefix stripped
price REAL
stock REAL
brand TEXT         -- e.g. "Lenovo", "HP"
processor TEXT     -- normalized key: "i5", "ryzen7", "coreu7"
proc_tier INTEGER  -- 3, 5, 7, or 9
ram_gb INTEGER     -- 8, 16, 32
storage_gb INTEGER -- 256, 512, 1000 (1TB = 1000)
last_updated TEXT  -- Odoo write_date
```

## Product Parsing (`src/parser.js`)

Extracts structured fields from the product name string.

| Field | Logic |
|---|---|
| **Brand** | Regex match: Lenovo, HP, Dell, Asus, Acer, Apple |
| **CPU** | Regex match on `i3/i5/i7/i9`, `R3/R5/R7/R9`, `Ryzen N`, `Core N`, `Core UN` |
| **proc_tier** | Integer: 3, 5, 7, or 9 — used for cross-brand fallback |
| **RAM** | Matches `8GB`, `16GB`, `32GB` (short values only, not storage) |
| **Storage** | Matches `256GB`, `512GB`, `1TB` / `1024GB` → stored as 1000 |

Structured Odoo fields (`brand_ids`, `processor_ids`) take priority over parsed values when populated.

## Filtering Logic (`src/filter.js`)

**Score per product:**
| Match | Points |
|---|---|
| Brand exact | +10 |
| CPU exact | +8 |
| CPU same tier (i5 ↔ Ryzen 5) | +4 |
| RAM exact | +5 |
| Storage exact | +3 |
| Storage ±1 tier | +1 |

Sort: score desc → stock desc → name asc. Returns max 5.

If no results, fallback runs with relaxed criteria:
- Same CPU tier across brands
- Same RAM
- Storage ±1 tier (256 ↔ 512 ↔ 1TB)

## WAHA Webhook

Configure WAHA to POST to `https://your-server/webhook`.

The bot:
1. Ignores all non-`message` events
2. Ignores outbound messages (`fromMe: true`)
3. Ignores messages that don't start with `BOT_TRIGGER`
4. ACKs 200 immediately before processing

## Response Format

**Results found:**
```
*Tenemos estas opciones disponibles:*

1) THINKPAD LENOVO X13 I5 8GB/256GB/W11P
📦 Stock: 27 unidades

2) THINKBOOK 16 G8 IRL C7/ 16GB/512GB/ FREE DOS
📦 Stock: 2 unidades

¿Querés más info o reservar alguna?
👉 Hablá con un asesor: +54 9 11 5221-4436
```

**No exact match (fallback):**
```
No encontré exactamente eso, pero tengo opciones similares:
[same product list format]
```

**Nothing at all:**
```
No encontré notebooks con esas características en stock.
¿Querés que te muestre opciones similares o hablás con un asesor?
👉 +54 9 11 5221-4436
```

## Health Check

```
GET /health → { status: "ok", trigger: "stock", session: "default" }
```
