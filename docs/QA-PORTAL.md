# QA — Portal Calendar + Approvals + Submit/Resubmit/Day-off APIs

Date: 2026-02-05 (America/Edmonton)
Repo: `pushysix-ops-hub`
Scope:
- `/portal` calendar page + client calendar component
- `/admin/approvals` queue + approve/reject server actions
- API routes:
  - `POST /api/worklog/submit`
  - `POST /api/worklog/resubmit`
  - `POST /api/day-off/submit`

## Executive summary

- Build now succeeds: `/portal` dependencies are satisfied (`@/lib/time`, `@/lib/holidays`).
- The Portal calendar “NO (day off)” action is now wired to `POST /api/day-off/submit` with the correct payload shape.
- UI now blocks weekend day-off submissions to match the backend weekday-only rule.
- Worklog submit/resubmit + day-off submit APIs implement Calgary-local window logic (10:00 start; next-day 09:59 cutoff) and approval request creation as expected (code review).

---

## What I ran

### Production build

```bash
cd pushysix-ops-hub
npm run build
```

Result: **passed**.

---

## Expected behavior (requirements interpretation)

### Timezone
- All date/window logic should be based on **Calgary time** (`America/Edmonton`).

### Portal day colors
From server-side logic in `src/app/portal/page.tsx`:
- **Green**: Holiday OR Approved worklog
- **Yellow**: Pending worklog OR Pending day-off
- **Red**: Rejected worklog OR Missing weekday log (within window)
- **Blue**: Weekend (no log required)
- **Purple**: Approved day-off

### Window enforcement
From `src/lib/calgaryTime.ts`:
- For a given ISO date `YYYY-MM-DD`:
  - cannot submit **before 10:00** (Calgary local time) on that date
  - submissions **after 09:59 the next day** require approval (status becomes `PENDING` + an `ApprovalRequest` is created)

---

## Issues found

### 1) `/portal` build breaks due to missing modules
**Status:** Resolved

**Symptoms**
- `npm run build` fails with module resolution errors.

**Errors**
- `Can't resolve '@/lib/holidays'` referenced by `src/app/portal/page.tsx`
- `Can't resolve '@/lib/time'` referenced by:
  - `src/app/portal/page.tsx`
  - `src/app/portal/PortalCalendar.tsx`

**Steps to reproduce**
1. `cd pushysix-ops-hub`
2. Run `npm run build`
3. Observe Turbopack module-not-found errors.

**Notes / likely fix**
- Create/restore the modules expected by the portal:
  - `src/lib/time.ts` exporting `CALGARY_TZ`, `isoDateInTimeZone`, `hourInTimeZone`, `parseISODateAsUTC`
  - `src/lib/holidays.ts` exporting `holidayNameForISODate`
- OR update portal imports to use the existing `src/lib/calgaryTime.ts` and add any missing helpers.

---

### 2) Portal calendar “NO” button calls a non-existent API route + wrong payload
**Status:** Resolved

**Where**
- `src/app/portal/PortalCalendar.tsx` → `submitDayOff()`

**Problems**
1. It calls `fetch("/api/dayoff", { ... })`, but the implemented route is:
   - `POST /api/day-off/submit` (file: `src/app/api/day-off/submit/route.ts`)
2. It sends payload `{ date: isoDate, reason: maybeReason }`, but API expects:
   - `{ email: string, dayDate: string, reason?: string }`
3. The UI expects response `{ ok, error }`, but the API returns `{ ok, status, message }` and on error `{ ok:false, message, details }`.

**Steps to reproduce (once build is fixed enough to load /portal)**
1. Open `/portal`
2. Click any weekday date
3. Click **NO**
4. Observe:
   - 404 (route not found) OR
   - request rejected due to missing `email`/`dayDate`, depending on routing fixes.

**Notes / likely fix**
- Update the portal calendar to call the correct route and payload:
  - `fetch("/api/day-off/submit", ...)` with `{ email, dayDate: isoDate, reason }`
- Align error handling to `message` (not `error`).
- Also consider hiding/disabling weekend day-off submission in UI since backend rejects weekends (see Issue 3).

---

### 3) Portal UI allows weekend day-off submission, but API rejects weekends
**Status:** Resolved

**Where**
- UI: `src/app/portal/PortalCalendar.tsx` allows selecting any date and submitting day-off.
- API: `src/app/api/day-off/submit/route.ts`:
  - rejects if `!isWeekdayISODate(body.dayDate)` with message `Day-off requests are only allowed for weekdays (Mon–Fri).`

**Steps to reproduce (after wiring portal → day-off API)**
1. Open `/portal`
2. Click a Saturday/Sunday
3. Click **NO**
4. API returns 400 with weekday-only error.

**Suggested improvement**
- Prevent submitting day-off for weekends in the UI (disable button or show a message).

---

## Approval flow smoke-check (code review)

### `POST /api/worklog/submit`
File: `src/app/api/worklog/submit/route.ts`
- Validates: email, date, targetHours >= 0, totalKm >= 0, at least 1 task line.
- Enforces window using `calgaryLocalStamp()` + `getWorklogWindowStamps()`.
- Within window:
  - `Worklog.status = APPROVED`
  - `approvedAt = now`
- Outside window:
  - `Worklog.status = PENDING`
  - creates `ApprovalRequest(type=WORKLOG_LATE_SUBMIT, status=PENDING, workDate=workDate, worklogId=...)`

Potential note:
- Payload requires `clientId` for any task with hours > 0 and for any mileage with km > 0.

### `POST /api/worklog/resubmit`
File: `src/app/api/worklog/resubmit/route.ts`
- Requires an existing worklog for that user/date.
- Always marks the worklog as `PENDING` and creates:
  - `ApprovalRequest(type=WORKLOG_RESUBMIT, status=PENDING, ...)`

### `POST /api/day-off/submit`
File: `src/app/api/day-off/submit/route.ts`
- Weekday-only enforcement.
- Uses the same 10:00 → next-day 09:59 window rule.
- Outside window creates:
  - `ApprovalRequest(type=DAY_OFF, status=PENDING, dayOffId=...)`

---

## Admin approvals queue smoke-check (code review)

Route: `/admin/approvals`
- Page: `src/app/admin/approvals/page.tsx`
- Actions: `src/app/admin/approvals/actions.ts`

Behavior:
- Lists `ApprovalRequest` with `status=PENDING` oldest-first.
- Approve:
  - sets request `APPROVED`
  - updates linked worklog/dayOff to `APPROVED`
- Reject:
  - sets request `REJECTED`
  - updates linked worklog/dayOff to `REJECTED` and stores rejection reason

Notes:
- Reviewer attribution uses `ADMIN_REVIEWER_EMAIL` env var in `src/lib/actor.ts`. If unset, `reviewedByUserId`/`approvedByUserId` will be `null` (allowed by schema).

---

## Follow-ups / recommendations

1. **Unblock build** by restoring `@/lib/time` + `@/lib/holidays` or updating imports.
2. Wire Portal day-off submission to the implemented API route + payload, and align error handling.
3. Consider adding a lightweight integration test script (or Postman collection) for the three API routes once DB env is available.
