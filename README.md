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
WHATSAPP_NUMBER=917899813212
NEXT_PUBLIC_WHATSAPP_NUMBER=917899813212
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

**Vercel + Supabase:**
1. Set `DATABASE_URL` (pooled, port 6543, with `?pgbouncer=true`) and `DIRECT_URL` (session pooler, port 5432) to your Supabase connection strings
2. `prisma/schema.prisma` already uses `provider = "postgresql"` with `directUrl`
3. Deploy to Vercel with environment variables from `.env.example`
4. Run `npx prisma migrate deploy` (and `npm run db:seed` once) against the Supabase database

**Domain (`www.gobaskitkaro.com`):**
The canonical site URL is controlled by `NEXT_PUBLIC_SITE_URL` (default `https://www.gobaskitkaro.com`). It drives `metadataBase`, canonical/Open Graph tags, `robots.txt`, and `sitemap.xml`. To deploy on the domain:
1. Add `NEXT_PUBLIC_SITE_URL="https://www.gobaskitkaro.com"` to the hosting environment variables.
2. In Vercel add both `www.gobaskitkaro.com` (set as the primary domain) and the apex `gobaskitkaro.com` (redirecting to `www`).
3. In Cloudflare DNS: `CNAME www -> cname.vercel-dns.com` and `A @ -> 76.76.21.21` (both "DNS only"); set SSL/TLS mode to Full (strict).

## Future-Ready Modules

Architecture supports adding without major refactors:
- Online payments (Razorpay, Stripe)
- Customer accounts & OTP login
- Inventory, coupons, loyalty
- Delivery tracking & notifications
- Multi-vendor support

## License

Private — GoBaskit © 2026
