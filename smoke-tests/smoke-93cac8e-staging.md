# Staging smoke test — Ops expenses + billing close email flag

Target: commit `93cac8e` (and follow-up migration commit `278fa1e`).

> Run these on **staging only**. Do **not** deploy to `ops.pushysix.com` yet.

## Preconditions
- Staging deploy includes commits:
  - `93cac8e` (features)
  - `278fa1e` (migration folder)
- DB migrations applied:
  - `npx prisma migrate deploy`
  - `npx prisma migrate status` shows no pending migrations
- Env vars:
  - Receipt uploads: staging has the required Vercel Blob token/config (e.g. `BLOB_READ_WRITE_TOKEN`)
  - Billing email: start with `BILLING_CLOSE_EMAIL_ENABLED=false`

---

## A) Expenses — Manual (receipt required)
1. Navigate to **Ops → v2 → Expenses**.
2. Click **New → Manual**.
3. Upload a receipt (try **PNG/JPG/WebP** and **PDF** in separate runs).
4. Confirm receiptUrl shows and “View uploaded” opens the blob.
5. Fill:
   - Client
   - Date
   - Amount (e.g. `12.34`)
   - Description
6. Click **Save manual expense**.

Expected:
- Success message.
- You return to `/ops/expenses`.
- The new entry appears in the list.
- Amount renders correctly.
- Receipt “View” link opens.

Negative:
- Try saving without uploading receipt → Save should be disabled (or API rejects).

---

## B) Expenses — Employee submission (receipt required)
1. **New → Employee submission**.
2. Upload receipt.
3. Choose employee.
4. Fill amount + description.
5. Submit.

Expected:
- Entry appears in list.

---

## C) Expenses — Retainer recurring (receipt optional)
1. **New → Retainer recurring**.
2. Save without receipt.

Expected:
- Entry can be created without receiptUrl.

---

## D) Expenses — Delete
1. On `/ops/expenses`, pick a test entry.
2. Click **Delete** and confirm.

Expected:
- Entry disappears after refresh.

---

## E) Receipt upload constraints
1. Upload a file >15MB.

Expected:
- Upload fails (size limit enforced).

2. (Optional security) attempt invalid pathname prefix.

Expected:
- Token generation rejected (prefix enforced to `expense-receipts/`).

---

## F) Project close behavior (billing email flag)
### Flag OFF
- Ensure `BILLING_CLOSE_EMAIL_ENABLED=false`.
- Close a project.

Expected:
- Project becomes `CLOSED`.
- No email is sent.

### Flag ON (controlled test)
- Set:
  - `BILLING_CLOSE_EMAIL_ENABLED=true`
  - Postmark env vars configured (`POSTMARK_SERVER_TOKEN`, optional `EMAIL_FROM`)
- Ensure client has `clientBillingEmail` set.
- Close a project.

Expected:
- A `ProjectCloseBillingEmail` row is created and transitions to SENT.
- Email is received.

Idempotency:
- Try to trigger close again (or re-submit action) → should not send duplicates.
