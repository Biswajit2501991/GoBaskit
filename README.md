# GoBaskit — Online Grocery Ordering Platform

A modern, production-ready grocery ordering website built with **Next.js 16**, **React 19**, **TypeScript**, **Prisma**, and **Tailwind CSS**. Customers browse products, manage a cart, and place orders via **WhatsApp**. Admins manage products, categories, orders, and bulk uploads.

## Features

### Customer Store
- Blinkit-inspired UI with hero banners, category rail, and product grid
- Search, filter by category, featured/best sellers
- Zustand cart with persistent state
- Full checkout form with Zod validation
- **Dynamic WhatsApp message** — regenerates live as cart, address, or payment changes
- COD and QR Payment on Delivery options
- Order saved to database on checkout

### Admin Panel (`/admin`)
- Secure JWT login
- Dashboard with stats and recent orders
- Product & category management
- Order management with status tracking
- Bulk product upload (Excel/CSV) with preview & duplicate detection

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| State | Zustand (persisted cart) |
| Forms | React Hook Form + Zod |
| Backend | Next.js API Routes |
| Database | Prisma ORM + PostgreSQL (Supabase) |
| Auth | JWT + bcrypt (admin) |
| Bulk Import | xlsx |

## Quick Start

```bash
cd gobasket
npm install
cp .env.example .env
# Set DATABASE_URL (pooled, port 6543) and DIRECT_URL (session pooler, port 5432)
# in .env to your Postgres/Supabase connection strings, then:
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open:
- **Store:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

Default admin: `admin@gobaskit.com` / `admin123`

## Project Structure

```
gobasket/
├── app/
│   ├── (customer)/          # Store pages
│   │   ├── page.tsx           # Home
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── success/
│   │   ├── category/[slug]/
│   │   └── product/[id]/
│   ├── admin/                 # Admin panel
│   └── api/                   # API routes
├── components/
├── services/
├── store/cartStore.ts
├── utils/whatsapp.ts
├── prisma/
└── tests/
```

## WhatsApp Integration

Orders are placed via WhatsApp. The message is built dynamically from the latest cart state:

```
Hello GoBaskit,
I would like to place the following order.
...
```

Configure via `.env`:
```
WHATSAPP_NUMBER=919046370119
NEXT_PUBLIC_WHATSAPP_NUMBER=919046370119
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (`?search=`, `?category=`, `?featured=`) |
| GET | `/api/products/[id]` | Single product |
| GET | `/api/categories` | List categories |
| POST | `/api/checkout` | Place order |
| POST | `/api/auth/login` | Admin login |
| GET/POST | `/api/admin/products` | Admin product CRUD |
| POST | `/api/admin/bulk-upload` | Bulk import |

## Testing

```bash
npm test
```

Test structure:
- `tests/unit/` — Component and utility tests
- `tests/integration/` — Flow tests (scaffold ready)
- `tests/e2e/` — Playwright specs (scaffold ready)

## Deployment

**Stack: Supabase (database) + Cloudflare Tunnel (hosting)**

Project path: `~/Projects/GoBaskit` (not Desktop — macOS blocks 24/7 services there).

No Vercel required. The app runs as a Node.js server on your machine (or VPS); Cloudflare Tunnel exposes it at `www.gobaskitkaro.com`.

### 1. Database (Supabase)

1. Set `DATABASE_URL` (pooler, port **6543**, `?pgbouncer=true`) and `DIRECT_URL` (session pooler, port **5432**) in `.env`
2. Run once against Supabase:
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

### 2. Run production app locally

```bash
npm run build
npm run start
```

Serves on **http://localhost:3000**. Use production mode (`start`), not `dev`, when serving through a tunnel.

### 3. Cloudflare Tunnel

Tunnel config lives at `~/.cloudflared/config.yml` and routes `www.gobaskitkaro.com` → `localhost:3000`.

Start the tunnel (keep running alongside `npm run start`):

```bash
cloudflared tunnel run
```

Or use the token-based tunnel if configured in the Cloudflare dashboard.

### 4. Cloudflare DNS

In the Cloudflare dashboard for `gobaskitkaro.com`:

- **www** → CNAME to your tunnel (`<tunnel-id>.cfargotunnel.com`) — proxied (orange cloud)
- **@** (apex) → redirect to `https://www.gobaskitkaro.com` (Redirect Rule or Page Rule)
- SSL/TLS mode: **Full**

Set `NEXT_PUBLIC_SITE_URL="https://www.gobaskitkaro.com"` in `.env` before `npm run build`.

### 5. Run 24/7 (auto-start, sleep & network recovery)

One-time install — registers macOS LaunchAgents that start at login, restart on crash, and health-check every 3 minutes:

```bash
bash scripts/install-services.sh
```

This installs:
- **com.gobaskit.app** — production Next.js server (supervised restart loop)
- **com.gobaskit.tunnel** — Cloudflare tunnel with fresh token + http2
- **com.gobaskit.healthcheck** — recovers after network blips or stale connections

For instant recovery after **laptop sleep**, also install sleepwatcher:

```bash
brew install sleepwatcher
bash scripts/install-services.sh   # re-run to wire ~/.wakeup hook
```

**After code deploy:**

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.gobaskit.app
```

**Logs:** `logs/` in the project root.

**Uninstall:**

```bash
bash scripts/uninstall-services.sh
```

**Note:** If you previously ran `cloudflared service install`, disable the old system daemon to avoid conflicts:

```bash
sudo launchctl bootout system/com.cloudflare.cloudflared
sudo cloudflared service uninstall
```

## Future-Ready Modules

Architecture supports adding without major refactors:
- Online payments (Razorpay, Stripe)
- Customer accounts & OTP login
- Inventory, coupons, loyalty
- Delivery tracking & notifications
- Multi-vendor support

## License

Private — GoBaskit © 2026
