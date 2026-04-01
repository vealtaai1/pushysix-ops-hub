# Post-deploy verification (Ops routing + Analytics + Clients hub)

Scope: **/ops routing + analytics + clients hub**.
- Ignores Prisma migrations / schema changes.
- Designed to run immediately after a Vercel deploy.

## Inputs you need

- **BASE_URL**: deployed URL, e.g. `https://pushysix-ops-hub.vercel.app`
- (Optional) **OPS_COOKIE_HEADER**: a *real* logged-in session cookie header copied from your browser.
  - Example format:
    - `OPS_COOKIE_HEADER='Cookie: __Secure-authjs.session-token=...; __Host-authjs.csrf-token=...'
`

## 1) Automated smoke (recommended)

From repo root (`pushysix-ops-hub/`):

```bash
BASE_URL="https://<your-domain>" ./scripts/postdeploy-smoke-ops.sh
```

Expected output (unauthenticated mode):
- `/ops`, `/ops/clients`, `/ops/expenses`, `/ops/analytics` return **302/307** with `Location: /login?callbackUrl=...`
- `/api/ops/v2/analytics?...` returns **401 or 403** JSON with `{"ok":false,...}`

Authenticated mode (optional):

```bash
OPS_COOKIE_HEADER='Cookie: <paste-cookie-header-here>' \
BASE_URL="https://<your-domain>" \
./scripts/postdeploy-smoke-ops.sh
```

Expected output (authenticated mode):
- `/ops` returns **200** and HTML contains `Ops`
- `/ops` returns **200** and HTML contains links to `/ops/clients`, `/ops/expenses`, and `/ops/analytics`
- `/ops/clients` returns **200** and HTML contains `Ops — Clients`
  - If no clients exist, page may show `No clients yet.` (still OK)
- `/api/ops/v2/analytics?...` returns:
  - **200** with JSON containing `"ok":true`, `"totals"`, `"minutesByDay"` when user role is **ADMIN** or **ACCOUNT_MANAGER**
  - otherwise **403** with `{"ok":false,"message":"Forbidden..."}` (this is still a *pass* if you expected a non-privileged user)

## 2) Manual checklist (browser)

### A) /ops routing

1. Visit: `/ops`
   - Unauthed: redirects to `/login?callbackUrl=/ops`
   - Authed: shows **Ops** page with tiles/links for Clients / Expenses / Analytics

2. (Compatibility) Visit: `/ops/v1` or `/ops/v2`
   - Unauthed: redirects to login
   - Authed: redirects to `/ops`

### B) Clients hub

1. Visit: `/ops/clients`
   - Authed: shows **Ops — Clients**
   - Expected elements:
     - table header `Client / Status / Open`
     - for each client, an **Open** button linking to `/ops/clients/<clientId>`

2. Click one **Open** link
   - Expected: client-specific hub route loads (even if sparse content)
   - If you see a 500: DB connectivity or server error (not a routing issue).

### C) Analytics

1. Visit: `/ops/analytics`
   - Unauthed: redirect to login
   - Authed but wrong role: page shows **Forbidden**
   - Authed with ADMIN or ACCOUNT_MANAGER: page shows **Ops — Analytics**

2. Confirm API is working (devtools / curl)

```bash
curl -sS -H 'Cookie: <session-cookie>' \
  "${BASE_URL}/api/ops/v2/analytics?from=2026-01-01&to=2026-01-02" | head
```

Expected (privileged):
- JSON with:
  - `ok: true`
  - `range: {from,to}`
  - `totals: { totalMinutes, entryCount, distinctClients, distinctUsers }`
  - `minutesByDay: [...]`

## Common failures & what they mean

- **/ops/* redirects to /login even when you think you’re logged in**
  - Cookie not being sent (wrong domain / missing secure cookie)
  - Session cookie name mismatch (middleware checks several names; confirm one exists)

- **Analytics API returns 403**
  - Logged in user role is not `ADMIN` or `ACCOUNT_MANAGER` (expected behavior).

- **Analytics API returns 500**
  - DB connectivity issue or query regression in `worklogEntry` / joins.

- **Clients page 500**
  - DB connectivity issue or Prisma model mismatch.
