# Dev DB — Prisma + Postgres (Local or Neon)

This repo uses **Prisma** with a **Postgres** database.

Prisma is configured like this:

- `DATABASE_URL` = the URL the app uses at runtime (**pooled** is fine)
- `DIRECT_URL` = a **direct, non-pooled** URL Prisma uses for migrations/introspection

See `prisma/schema.prisma` (`url` + `directUrl`).

## Option A: Shared Neon dev DB (recommended)

In Neon, grab both connection strings:

- **Pooled** (PgBouncer) → use for `DATABASE_URL`
- **Direct** (no pooler) → use for `DIRECT_URL`

Example `.env` (values shown are placeholders):

```bash
# Runtime (pooled)
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.pooler.neon.tech/DB?sslmode=require"

# Migrations / introspection (direct)
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.neon.tech/DB?sslmode=require"

# Used by Prisma seed:
ADMIN_SEED_EMAIL="admin@pushysix.com"
```

Notes:

- Use the **direct** URL for migrations; pooled connections can break Prisma migrate.
- Avoid `prisma migrate reset` on a shared DB.

## Option B: Local Postgres

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pushysix_ops_hub?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/pushysix_ops_hub?schema=public"
```

## Migrations workflow

### Apply existing migrations (safe; matches production)

```bash
npx prisma migrate deploy
```

### Generate a new migration

1) Update `prisma/schema.prisma`
2) Create a migration:

```bash
# Local DB (creates + applies)
npx prisma migrate dev --name your_change

# Shared Neon DB (generate files only; then apply with deploy)
npx prisma migrate dev --create-only --name your_change
```

3) Commit `prisma/migrations/*`
4) Apply to the target DB:

```bash
npx prisma migrate deploy
```

## Seed the database

The seed script will:

- upsert an initial **ADMIN** `User` using `ADMIN_SEED_EMAIL`
- create **at least one** `Client` if none exist (so worklogs can be submitted)

Run:

```bash
npm run prisma:seed
```

Notes:

- If the admin user already exists, it will be updated to `role=ADMIN`.
- If any client exists, the seed script will not create a duplicate client.
