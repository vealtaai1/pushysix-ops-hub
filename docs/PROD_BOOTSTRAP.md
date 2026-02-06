# Production Bootstrap — Migrations + Seed

This doc describes the **one-time** steps to bootstrap a new production database.

## Required env vars

### Database (Neon)

- `DATABASE_URL` — **pooled** connection string (Neon “Pooled connection”). This is what the app should use at runtime.
- `DIRECT_URL` — **direct** (non-pooled) connection string (Neon “Direct connection”). Prisma migrations/seed should prefer this.

> Why both? Neon’s pooled URL usually sits behind PgBouncer. Prisma migrations and some one-off scripts are more reliable against a direct connection.

### Admin bootstrap

- `ADMIN_SEED_EMAIL` — email to upsert as the initial `User(role=ADMIN)`
- `ADMIN_TOKEN` — shared secret used to protect the one-off bootstrap endpoint (`/api/admin/bootstrap`)

## Vercel: exact bootstrap steps (recommended)

### 0) Set Vercel Environment Variables (Production)

In **Vercel → Project → Settings → Environment Variables** (Production):

- `DATABASE_URL` (Neon pooled URL)
- `DIRECT_URL` (Neon direct URL)
- `ADMIN_SEED_EMAIL` (the email that should become the initial ADMIN)
- `ADMIN_TOKEN` (generate a long random string)
- `PRISMA_MIGRATE_DEPLOY=true` (enables the repo’s `prebuild` migrate-deploy step)

Deploy once after setting these so migrations run.

### 1) Run the seed once

Option A (recommended): call the protected endpoint

```bash
curl -X POST "https://<your-domain>/api/admin/bootstrap" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- If it already ran, it will return `alreadyBootstrapped: true`.
- Otherwise it will upsert the admin user and create a seed Client if none exists.

Option B: run Prisma seed locally against Production env

1) Pull prod env vars locally (Vercel CLI):

```bash
vercel env pull .env.production.local
```

2) Run seed (note: seed prefers `DIRECT_URL` if present):

```bash
npm run prisma:seed
```

## Notes / behavior

- Seed is **idempotent**:
  - admin user is upserted by email, role forced to `ADMIN`
  - a seed Client is created **only if no clients exist yet**
- `/api/admin/bootstrap` is **token-gated** by `ADMIN_TOKEN` and is safe to call multiple times.
- The seed script does not create passwords/auth credentials; auth is handled elsewhere (MVP admin gate / future SSO).

## Notes / behavior

- The seed script is **idempotent** for the admin user (uses `upsert` by email).
- It will create **one** seed Client only if no Clients exist yet.
- The seed script does not create passwords/auth credentials; auth is handled elsewhere (MVP admin gate / future SSO).
