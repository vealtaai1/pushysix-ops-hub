# PushySix Operations Hub — Requirements (v1)

## Purpose
Build a single day-to-day operations hub that:
- captures daily worklogs (time + notes + kilometers) reliably
- tracks monthly retainer usage by bucket (different caps per client)
- connects billing status (QuickBooks Online) to delivery enforcement (ClickUp)

This doc is the source of truth for what we agreed to build first.

## Users & Access
- Team size: ~7 employees logging daily
- Platforms: **mobile + desktop** (mobile-first UI)
- Authentication: **Google Workspace SSO** (pushysix.com)
- Permissions (v1):
  - `EMPLOYEE`: submit/edit own worklogs
  - `ADMIN`: manage clients, bucket limits, mappings, schedules, rules

## Timezone / Calendar
- Locale: Calgary, Alberta
- Timezone: **America/Edmonton**
- Work schedule (default): **Mon–Fri, 9:00am–5:30pm**
- Holidays: **Canadian federal stat holidays** (no reminder/escalation on these days)

## Core Modules (v1)

### 1) Daily Worklog (replaces Google Forms + Sheets)
Employees submit a worklog at end of day or the next day if they forget.

**Worklog fields (per date):**
- Date (defaults to today; supports backfill)
- Entries (repeatable):
  - Client
  - Bucket
  - Duration (minutes / hh:mm)
  - Notes (what was done)
  - (Future) optional: ClickUp task URL
- Mileage (optional):
  - Kilometers (float)
  - Notes/purpose
  - (Optional future) attach mileage to a client

**Trust-but-audit:**
- Allow edits with an **audit trail** (who changed what and when)

### 2) Retainers (monthly, bucketed)
- Retainers are monthly and start on either:
  - **1st of the month**, or
  - **15th of the month**
- Each client can have different bucket limits.

**Bucket list (v1):**
- filming/photography capture
- traveling
- editing
- social media management
- photo/video editing
- web design
- marketing strategy deployment
- consulting
- graphic design
- miscellaneous

**Outputs (v1):**
- hours/minutes used per bucket (this cycle)
- remaining per bucket
- projected depletion date (later)

### 3) Ops Dashboard (day-to-day hub)
- Upcoming tasks due / overdue (ClickUp)
- Client health summary:
  - financial status (QBO)
  - retainer remaining by bucket
  - delivery status / at-risk signals

### 4) Billing enforcement (QuickBooks Online → ClickUp)
**Rule:** If a client has an invoice **10 days overdue** in QBO, place client **ON HOLD**.

**On Hold behavior:**
- Pause **ALL tasks** in that client’s ClickUp Space:
  - for all tasks not Done → set status to **Paused – Billing**

**Unhold behavior:**
- When invoice is paid in QBO:
  - remove hold
  - resume tasks (restore from Paused – Billing; details TBD)

**Client mapping:**
- QBO customer ↔ ClickUp space is **manual mapping** (admin-managed)

### 5) Reminder + escalation emails
Notifications go to **email**.

**Reminder:**
- If employee has not submitted a worklog for a workday:
  - send reminder at **7:30pm** (5:30pm + 2h)

**Escalation:**
- If still missing next working day:
  - escalate to **admin@pushysix.com**

## Email templates (defaults approved)
- Internal hold notice → admin@pushysix.com
- Internal resume notice → admin@pushysix.com
- Client-facing “work paused” notice
- Client-facing “work resumed” notice

(Templates live in-app and can be updated later.)

## Integrations (v1)
- ClickUp (status updates; space-per-client structure)
- QuickBooks Online (invoice status / overdue / paid)
- Email sending (provider TBD)

## UI/Branding
- App name: **Pushysix Operations Hub**
- Brand cues pulled from pushysix.com:
  - Accent/link color observed: **#2EA3F2**
  - Typography observed: **Open Sans**

## Build Milestones (target)
- MVP live (worklogs + reminders + retainers + admin): **7–10 days** with fast inputs
- Add automations (QBO hold/unhold + ClickUp pause): **14–21 days**

## Open Questions (to resolve later)
- Exact ClickUp resume behavior (restore prior status vs set to Active)
- VIP exceptions / critical-work exceptions (v2)
- Timesheet cut-off rules (how many days back edits allowed)
- Time logging against ClickUp tasks (future)
