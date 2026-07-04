<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single service: a Next.js 16 (Turbopack) app "GoBaskit" using Prisma. Standard scripts are in `package.json` and setup steps in `README.md`. The datasource is **PostgreSQL** (Supabase); `prisma/schema.prisma` uses `url = env("DATABASE_URL")` (pooled, port 6543) and `directUrl = env("DIRECT_URL")` (session pooler, port 5432, used for migrations).
- **DB config:** `DATABASE_URL` and `DIRECT_URL` come from Supabase and are stored as Cursor secrets / in the gitignored `.env`. Gotcha discovered during setup: those secret values must be the raw connection string with the **real** password — not wrapped in surrounding quotes and not containing the `[YOUR-PASSWORD]` placeholder, or Prisma fails with `P1013`/`P1000`. If a password has special chars (`@ / : ? # %`), URL-encode them. The transaction pooler URL needs `?pgbouncer=true`.
- **Env & schema persistence:** `.env` is gitignored and persists via the VM snapshot. The database itself lives in Supabase, so schema/seed data survive across sessions; only re-run `npx prisma migrate deploy` + `npm run db:seed` when the schema changes or against a fresh DB (`migrate deploy` is non-interactive; `migrate dev` needs a shadow DB that the Supabase pooler does not allow).
- **Run:** `npm run dev` serves the store at http://localhost:3000 and admin at `/admin`. Seeded admin login: `admin@gobaskit.com` / `admin123`. The canonical base domain is `NEXT_PUBLIC_SITE_URL` (default `https://gobaskitkaro.com`), driving `metadataBase`, `robots.txt`, and `sitemap.xml`.
- **Checkout is real:** placing an order writes a `Customer` + `Order` to the DB (`/api/checkout`) and then redirects to a `wa.me` WhatsApp link; the DB write is not skipped despite the WhatsApp handoff.
- **Test/lint:** `npm test` (Jest) passes. `npm run lint` currently reports pre-existing errors/warnings in the codebase — that is expected, not caused by env setup.
- **E2E:** `npm run test:e2e` (Playwright) requires browsers first: `npx playwright install chromium`. Its `webServer` auto-starts `npm run dev` and reuses an existing server on port 3000.
