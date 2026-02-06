# Production Bootstrap — Migrations + Seed

This doc describes the **one-time** steps to bootstrap a new production database.

## Required env vars

### Database (Neon)

- `DATABASE_URL` — **pooled** connection string (Neon “Pooled connection”). This is what the app should use at runtime.
- `DIRECT_URL` — **direct** (non-pooled) connection string (Neon “Direct connection”). Prisma migrations/seed should prefer this.

> Why both? Neon’s pooled URL usually sits behind PgBouncer. Prisma migrations and some one-off scripts are more reliable against a direct connection.

### Auth (Google)

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`) — required by Auth.js/NextAuth to sign/encrypt session cookies.
- `NEXTAUTH_URL` (recommended on Vercel) — e.g. `https://ops.pushysix.com`

### Seed

- `ADMIN_SEED_EMAIL` — email to upsert as the initial `User(role=ADMIN)`.

## Vercel: exact bootstrap steps (recommended)

### 0) Set Vercel Environment Variables (Production)

In **Vercel → Project → Settings → Environment Variables** (Production):

- `DATABASE_URL` (Neon pooled URL)
- `DIRECT_URL` (Neon direct URL)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` (generate a long random string)
- `NEXTAUTH_URL` (your canonical domain URL)
- `ADMIN_SEED_EMAIL` (the email that should become the initial ADMIN)
- `PRISMA_MIGRATE_DEPLOY=true` (enables the repo’s `prebuild` migrate-deploy step)

Deploy once after setting these so migrations run.

### 1) Run the seed once

Option A: run Prisma seed locally against Production env

1) Pull prod env vars locally (Vercel CLI):

```bash
vercel env pull .env.production.local
```

2) Run seed (note: seed prefers `DIRECT_URL` if present):

```bash
npm run prisma:seed
```

Option B: create the admin user manually (SQL/Prisma Studio) and ensure they can sign in with Google.

## Notes / behavior

- Seed is **idempotent**:
  - admin user is upserted by email, role forced to `ADMIN`
  - a seed Client is created **only if no clients exist yet**
- Auth is **Google sign-in** via Auth.js/NextAuth + Prisma adapter.
- The `/api/admin/bootstrap` endpoint now requires a **signed-in ADMIN session** (no `ADMIN_TOKEN`).
