# Security (MVP)

This project currently uses a **temporary MVP admin gate** to prevent casual/unintended access to the admin portal.

## What is protected

- All routes under **`/admin/*`**
- Admin **server actions** (e.g. create client, approve/reject)

Protection is implemented in:

- `src/middleware.ts` (blocks/redirects requests to `/admin/*`)
- `src/lib/adminAuth.ts` (shared auth helpers)

## Configure admin access

Set **at least one** of the following environment variables:

### Option A — Shared token (recommended for MVP)

- `ADMIN_TOKEN` — a shared secret token

How to provide it:

- HTTP header: `X-Admin-Token: <token>`
- or: `Authorization: Bearer <token>`
- or (browser MVP): enter it on `/admin/login` (stored in a cookie)

### Option B — Email allowlist (MVP placeholder)

- `ADMIN_EMAIL_ALLOWLIST` — comma-separated allowlist of emails (case-insensitive)

How to provide it:

- Enter an email on `/admin/login` (stored in a cookie)
- Or send header: `X-Admin-Email: you@company.com`

Example:

```bash
ADMIN_EMAIL_ALLOWLIST="alice@pushysix.com,bob@pushysix.com"
```

## Failure behavior (user-friendly)

- Visiting `/admin/*` without valid credentials redirects to **`/admin/login`**.
- Posting/mutating without credentials returns **401** with a plain-text message.
- If neither `ADMIN_TOKEN` nor `ADMIN_EMAIL_ALLOWLIST` is set, admin access fails closed with **503** and an explanation.

## Important notes / limitations

- This is **not** a full authentication system.
- Cookies set by `/admin/login` are only an MVP convenience and are not suitable as a long-term auth strategy.
- Replace this with real auth (e.g. NextAuth/Auth.js, Clerk, Cognito, etc.) before broad deployment.
