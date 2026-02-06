# Local DB (Dev) — Prisma + Postgres

This repo uses **Prisma** with a **Postgres** database.

## Prereqs

- Postgres running locally
- `DATABASE_URL` and `DIRECT_URL` set (via `.env`)

Example `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pushysix_ops_hub?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/pushysix_ops_hub?schema=public"

# Used by Prisma seed:
ADMIN_SEED_EMAIL="admin@pushysix.com"
```

## Apply migrations

For local dev you can use `migrate dev`:

```bash
npx prisma migrate dev
```

Or if you want to match production behavior (deploy existing migrations):

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
