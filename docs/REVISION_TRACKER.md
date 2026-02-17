# PushySix Ops Hub — Revision Tracker

Owner: Paul

This file is the single source of truth for the revision batches Paul requested.
I will ~~strike through~~ items as they are completed, and add notes for anything blocked.

## Login / Auth
- [ ] Remove placeholder on login page (`you@pushysix.com`)
- [ ] Shared login for admins + users (no separate flows)
- [ ] Session persistence broken (sign in → navigate → asked to sign in again) — fix
- [ ] Admin access blocked after login (paul@pushysix.com can’t access admin pages) — fix
- [ ] Header: when logged in, show “Signed in as xxx@xxx.com” (clean, top-right)

## Navigation / Pages / IA
- [x] ~~Rename “Portal” to **Schedule** (calendar page)~~
- [ ] Create **Dashboard** (default landing after sign-in): icons/tiles linking to tools
- [ ] Create **Admin Dashboard** (admins only): icons/tiles linking to admin tools
- [ ] Clean up header: no giant list of links; show Back button only when not on Dashboard

## Daily Worklog / Shift Log Page
- [ ] Remove redundant **Email** field on daily worklog form
- [ ] Remove **0 placeholders** everywhere they appear in inputs
- [ ] Total km: change “OPTIONAL” → “If applicable”
- [ ] Allocated hours counter: larger + its own sticky module under tasks
- [ ] Remove **Quota item** field entirely
- [ ] Fix submit error: “invalid worklog payload”
- [ ] Prevent logging time on **future days** (grey out/disable)

## Schedule (Calendar)
- [x] ~~Fix month display: shows **January** but should be **February 2026**~~
- [ ] Audit every calendar implemented for month correctness
