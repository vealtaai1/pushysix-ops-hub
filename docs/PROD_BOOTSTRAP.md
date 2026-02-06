# Production Bootstrap — Migrations + Seed

This doc describes the **one-time** steps to bootstrap a new production database.

## Required env vars

- `DATABASE_URL` — pooled/primary connection string
- `DIRECT_URL` — direct/non-pooled connection string (used by Prisma migrate)
- `ADMIN_SEED_EMAIL` — email to upsert as the initial `User(role=ADMIN)`

## One-off bootstrap (recommended)

Run these commands from a clean checkout of the repo at the version you’re deploying.

1) Generate Prisma client + apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

2) Seed:

```bash
ADMIN_SEED_EMAIL="admin@pushysix.com" npx prisma db seed
```

(You can also run the npm script: `npm run prisma:seed`.)

## Notes / behavior

- The seed script is **idempotent** for the admin user (uses `upsert` by email).
- It will create **one** seed Client only if no Clients exist yet.
- The seed script does not create passwords/auth credentials; auth is handled elsewhere (MVP admin gate / future SSO).
