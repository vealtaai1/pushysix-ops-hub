# MVP Smoke Test (Local)

Date: 2026-02-05 (America/Edmonton)

## Environment

- Repo: `pushysix-ops-hub`
- Node: `v25.5.0`
- Next.js: `16.1.6 (Turbopack)`
- Command port: `npm run dev -- --port 3100`
- `.env`: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pushysix_ops_hub?schema=public"`

## Build

- ✅ `npm run build` succeeds.
- ⚠️ Next.js warning:
  - “Next.js inferred your workspace root… detected multiple lockfiles”
  - Selected: `/Users/VealtaAgent/.openclaw/package-lock.json`
  - Additional lockfile: repo-local `package-lock.json`

## Dev server

- ✅ `npm run dev -- --port 3100` starts and serves requests.

## Route smoke checks

Using `curl` against `http://localhost:3100`:

- `/` → **307** (redirect)
- `/worklog` → **200**
  - Page renders and shows an inline warning banner:
    - “Database error loading clients. Check Vercel env DATABASE_URL / Prisma.”
- `/portal` → **500**
  - Prisma error in server output:
    - `PrismaClientInitializationError: Can't reach database server at localhost:5432`
- `/admin/approvals` → **500**
  - Same underlying Prisma connectivity error.

## Form/API smoke checks

### Day-off submit (`POST /api/day-off/submit`)

- ✅ Validation path works (fails before DB access when request is for a future date before the 10:00am Calgary window).
  - Example: `dayDate=2026-02-06` returned:
    - `400 { ok:false, message:"You can’t submit a day-off for that date before 10:00 (Calgary time)." }`
- ❌ Within-window submission attempts hit the DB and return **500** due to Postgres not running / unreachable.
  - Example: `dayDate=2026-02-05` → `500`.

### Worklog submit (`POST /api/worklog/submit`)

- Not fully exercised because successful submission requires DB connectivity and an existing Client list (clientId required for task lines).

## Admin approvals (approve/reject)

- ❌ Could not smoke test approve/reject flows.
- `/admin/approvals` fails with **500** due to DB connectivity (`localhost:5432` unreachable).

## Blocking issue

Local Postgres is not available from this environment (no running DB reachable at `localhost:5432`), causing server-rendered pages and API routes that touch Prisma to throw `PrismaClientInitializationError`.

## Suggested next steps to unblock local QA

1. Ensure Postgres is running and reachable at `localhost:5432`.
2. Create database `pushysix_ops_hub` and apply migrations (example patterns):
   - `PRISMA_MIGRATE_DEPLOY=true npm run build` (or run migrate separately)
   - or `npx prisma migrate dev`
3. Seed at least one `Client` record so worklog tasks can be submitted (clientId is required for any task hours > 0).
