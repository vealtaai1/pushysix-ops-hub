# Security

This project uses **Google sign-in** via **Auth.js/NextAuth** (Next.js App Router) with the **Prisma Adapter**.

## What is protected

- All routes under **`/worklog/*`** and **`/portal/*`** require a signed-in session.
- All routes under **`/admin/*`** require a signed-in session **and** `User.role === ADMIN`.
- Admin **server actions** (e.g. create client, approve/reject) also enforce `ADMIN` role server-side.

Protection is implemented in:

- `src/middleware.ts` (blocks/redirects requests)
- `src/lib/adminAuth.ts` (shared admin authorization helper for server actions/routes)
- `src/auth.ts` (Auth.js/NextAuth configuration + session callbacks)

## Required environment variables

### Auth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `NEXTAUTH_URL` (recommended)

### Database

- `DATABASE_URL`
- `DIRECT_URL`

## Admin role management

- Admin access is controlled by `User.role` in the database.
- The seed script (`npm run prisma:seed`) upserts `ADMIN_SEED_EMAIL` as `role=ADMIN`.

## Notes / limitations

- This is SSO-style auth (Google) and assumes your Google OAuth app is configured appropriately.
- If you need domain restrictions (e.g. only `@pushysix.com`), implement it in the NextAuth `signIn` callback.
