<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single service: a Next.js 16 (Turbopack) app "GoBaskit" using Prisma + SQLite. Standard scripts are in `package.json` and setup steps in `README.md`.

- **Env & DB persistence:** `.env` and the SQLite DB (`prisma/dev.db`) are gitignored and are NOT recreated by the update script; they persist via the VM snapshot. If starting truly fresh (no `.env`), run the README Quick Start once: `cp .env.example .env`, then `npx prisma migrate deploy` (use this instead of `migrate dev` in non-interactive envs), then `npm run db:seed`.
- **Run:** `npm run dev` serves the store at http://localhost:3000 and admin at `/admin`. Seeded admin login: `admin@gobaskit.com` / `admin123`.
- **Checkout is real:** placing an order writes a `Customer` + `Order` to the DB (`/api/checkout`) and then redirects to a `wa.me` WhatsApp link; the DB write is not skipped despite the WhatsApp handoff.
- **Test/lint:** `npm test` (Jest) passes. `npm run lint` currently reports pre-existing errors/warnings in the codebase — that is expected, not caused by env setup.
- **E2E:** `npm run test:e2e` (Playwright) requires browsers first: `npx playwright install chromium`. Its `webServer` auto-starts `npm run dev` and reuses an existing server on port 3000.
