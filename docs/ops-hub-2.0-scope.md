# Ops Hub 2.0 (Ops) — Scope

This doc captures what **Ops Hub 2.0** currently includes in the repo, what is **feature-flagged**, and what is **explicitly out of scope / not yet shipped**.

Source branches:
- `feature/expenses-persistence-billing-email-flag`
- `feature/ops-v2-analytics`

> Naming note: Ops Hub 2.0 now lives under the canonical **`/ops/*`** routes (with **`/ops/v2`** kept only as a compatibility redirect).

---

## In scope (shipped in code)

### Core routes (UI)

- **`/ops`**
  - Landing page linking to Clients / Expenses / Analytics.

- **Clients + Project tracking**
  - **`/ops/clients`** — list clients (status + link to hub).
  - **`/ops/clients/[clientId]`** — client hub:
    - view client status + billing email (read-only display)
    - list projects for the client
    - **create project** (server action)
      - generates code like `YY-####` + unique short code
    - **close project** (server action)

- **Retainers / Ad spend**
  - **`/ops/retainers/[clientId]`** — client-specific retainer ad spend grid

- **Expenses (CRUD + receipt upload)**
  - **`/ops/expenses`** — list + filters + create links
  - **`/ops/expenses/new`** — chooser
  - **`/ops/expenses/new/manual`** — manual expense (AM/Admin)
  - **`/ops/expenses/new/employee`** — employee submission
  - **`/ops/expenses/new/retainer`** — recurring retainer expense (UI exists; backend is TODO)
  - **`/ops/expenses/[expenseId]`** — view/edit an expense entry

### API routes (server)

- **Expenses API**
  - **`GET /api/ops/v2/expenses`** — list (optional `clientId`, `q`, `limit`)
  - **`POST /api/ops/v2/expenses`** — create (persists to DB via Prisma)
    - enforces **CAD-only** on the server
    - receipt required for `MANUAL` + `EMPLOYEE_SUBMISSION`
  - **`GET /api/ops/v2/expenses/[expenseId]`** — fetch one
  - **`PATCH /api/ops/v2/expenses/[expenseId]`** — update fields
  - **`DELETE /api/ops/v2/expenses/[expenseId]`** — delete
  - **`POST /api/ops/v2/expenses/receipt-upload`** — receipt upload token/handler via `@vercel/blob/client`

- **Analytics API (only on `feature/ops-v2-analytics`)**
  - **`GET /api/ops/v2/analytics`** — JSON aggregates for worklog minutes
  - **`GET /api/ops/v2/analytics.csv`** — CSV export

---

## Feature-flagged / gated functionality

### 1) Ops Analytics (UI + API)

Branch: `feature/ops-v2-analytics`

- Flag: **`OPS_V2_ANALYTICS_ENABLED`**
  - Enabled when env var is `"true"` or `"1"`.
- Behavior when disabled:
  - **`/ops/analytics`** returns **404** via `notFound()`
  - **`/api/ops/v2/analytics*`** returns **404**
- Access control when enabled:
  - UI + API require signed-in user with role **`ADMIN`** or **`ACCOUNT_MANAGER`**

### 2) Billing email on project close

Branch: `feature/expenses-persistence-billing-email-flag` (also present on analytics branch as currently checked out)

- Flag: **`BILLING_CLOSE_EMAIL_ENABLED`**
  - Enabled when env var is exactly `"true"`.
- Trigger:
  - Closing a project from **`/ops/clients/[clientId]`** calls a server action that can send an email.
- Delivery:
  - Uses Postmark helper (`@/lib/email/postmark`) **only if configured**.
- Safety/idempotency:
  - Creates `ProjectCloseBillingEmail` row keyed by a dedupe key; duplicate closes won’t re-send.

---

## Explicitly out of scope / not yet shipped (incomplete)

### Expenses

- **Recurring retainer expenses are not wired end-to-end.**
  - UI exists at **`/ops/expenses/new/retainer`**, but it currently shows a TODO and does **not** call a backend endpoint.
  - Code explicitly notes: `TODO: POST /api/ops/v2/expenses (kind=RETAINER_RECURRING)`.

- **Multi-currency is not supported.**
  - Server enforces **CAD-only** (even if some UI controls show USD).

- No accounting exports / QBO posting / reimbursement workflows are implemented in Ops v2.
  - Status enum includes values like `PAID` / `POSTED`, but Ops v2 screens/API do not implement these flows.

### Clients / Projects

- Client billing email is **displayed** on the client hub header when present, but there is **no Ops v2 UI to edit it**.
- No project reopen / archive / edit flows in Ops v2 (create + close only).

### Analytics

- Analytics is intentionally “dark” by default (404 unless enabled).
- No scheduled reports, alerts, or emailing of analytics; only interactive UI + CSV/JSON endpoints.

---

## Branch differences (important)

- `feature/ops-v2-analytics` adds:
  - **`/ops/v2/analytics`** UI
  - **`/api/ops/v2/analytics`** + **`/api/ops/v2/analytics.csv`**
  - (Also includes older admin analytics files under `/admin/analytics` in this branch snapshot.)

- `feature/expenses-persistence-billing-email-flag` does **not** include the Ops v2 analytics route/API.

---

## Quick checklist: what to set in env when deploying

- **Analytics (optional):** `OPS_V2_ANALYTICS_ENABLED=true`
- **Billing close email (optional):** `BILLING_CLOSE_EMAIL_ENABLED=true` plus Postmark configuration required by `@/lib/email/postmark`
- **Expenses receipts:** Vercel Blob configuration (used by `@vercel/blob/client`) must be present for receipt uploads to work
