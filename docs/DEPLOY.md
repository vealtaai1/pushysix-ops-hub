# Deploying to Vercel (PushySix Ops Hub)

This app is a **Next.js** app with **Prisma** + **Postgres**.

## Prisma / database configuration

`prisma/schema.prisma` uses:

- `url = env("DATABASE_URL")`
- `directUrl = env("DIRECT_URL")`

On Vercel you must provide **both** variables.

### Required Vercel Environment Variables

Add these in **Vercel → Project → Settings → Environment Variables**:

- `DATABASE_URL` (string)
  - Your pooled/primary connection string (Neon/Vercel/Postgres provider)
  - Example shape: `postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require`

- `DIRECT_URL` (string)
  - A **direct / non-pooled** connection string used by Prisma for migrations.
  - For Neon this is typically the **"direct"** connection string.

### Prisma migrations in Vercel

This repo is set up to run migrations during the Vercel build **only when explicitly enabled**.

`package.json`:

- `prebuild` runs `npm run prisma:generate` and `npm run prisma:migrate:deploy`
- `prisma:generate` uses `npx prisma generate`
- `prisma:migrate:deploy` runs **only if** `PRISMA_MIGRATE_DEPLOY === "true"`

Add this env var in Vercel:

- `PRISMA_MIGRATE_DEPLOY` = `true`

If it is not set (or not exactly `"true"`), the build will log:

> Skipping prisma migrate deploy (set PRISMA_MIGRATE_DEPLOY=true to enable)

## Optional app configuration env vars

These are referenced in the codebase and may be needed depending on features you enable.

### Admin attribution (temporary auth placeholder)

- `ADMIN_REVIEWER_EMAIL`
  - Email address used to attribute admin actions until real auth is implemented.

### Email (Postmark)

Used by `src/lib/email/postmark.ts` and the test endpoint at `/api/email/test-postmark`.

- `POSTMARK_SERVER_TOKEN` (required to send email)
- `EMAIL_FROM` (optional, default `noreply@pushysix.com`)
- `EMAIL_ADMIN` (optional, default `admin@pushysix.com`)

#### Postmark test endpoint (optional)

- `EMAIL_TEST_ENDPOINT_ENABLED` = `true` to enable the endpoint
- `EMAIL_TEST_ENDPOINT_TOKEN` (recommended; **required in production** if enabled)
- `POSTMARK_TEST_RECIPIENT` (required if endpoint enabled)

## Deployment steps (Vercel)

1. **Create a Postgres database** (e.g. Neon).
2. In Vercel, set env vars:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `PRISMA_MIGRATE_DEPLOY=true`
   - (optional) any email/admin vars listed above
3. Deploy.
   - During build, Vercel will run `npm run build`.
   - `prebuild` will:
     1) `npx prisma generate`
     2) `npx prisma migrate deploy` (only when `PRISMA_MIGRATE_DEPLOY=true`)

## Notes / troubleshooting

- If migrations are not applying, confirm `PRISMA_MIGRATE_DEPLOY` is set to **exactly** `true` (string).
- If migrations fail with connection/pooling errors, confirm `DIRECT_URL` is the provider’s **direct** connection string.
