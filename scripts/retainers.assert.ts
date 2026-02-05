import assert from "node:assert/strict";
import { BillingCycleStartDay } from "@prisma/client";
import {
  computeRetainerCycleUsage,
  computeCycleRetainerMinutesLimit,
  getRetainerCycleRange,
  type WorklogEntryLike,
} from "../src/lib/retainers";

function d(iso: string): Date {
  // Use noon UTC to avoid edge cases from local conversions.
  return new Date(`${iso}T12:00:00.000Z`);
}

// --- Cycle range math ---
{
  const range = getRetainerCycleRange(d("2026-02-02"), BillingCycleStartDay.FIRST);
  assert.deepEqual(range, { startISO: "2026-02-01", endISO: "2026-02-14" });
}

{
  const range = getRetainerCycleRange(d("2026-02-20"), BillingCycleStartDay.FIRST);
  assert.deepEqual(range, { startISO: "2026-02-15", endISO: "2026-02-28" });
}

{
  const range = getRetainerCycleRange(d("2026-02-02"), BillingCycleStartDay.FIFTEENTH);
  assert.deepEqual(range, { startISO: "2026-01-15", endISO: "2026-02-14" });
}

{
  const range = getRetainerCycleRange(d("2026-02-20"), BillingCycleStartDay.FIFTEENTH);
  assert.deepEqual(range, { startISO: "2026-02-15", endISO: "2026-03-14" });
}

// --- Cap math ---
{
  assert.equal(computeCycleRetainerMinutesLimit(10), 300); // 10h/month => 5h/cycle => 300m
  assert.equal(computeCycleRetainerMinutesLimit(9), 270); // 4.5h/cycle
}

// --- Usage computation ---
{
  const range = { startISO: "2026-02-01", endISO: "2026-02-14" };

  const entries: WorklogEntryLike[] = [
    { workDate: d("2026-02-01"), bucketKey: "capture", minutes: 60 },
    { workDate: d("2026-02-01"), bucketKey: "editing", minutes: 120 },
    { workDate: d("2026-02-02"), bucketKey: "capture", minutes: 30 },
    // outside range (should not count as a shoot day)
    { workDate: d("2026-02-15"), bucketKey: "capture", minutes: 999 },
  ];

  const usage = computeRetainerCycleUsage({
    entries,
    range,
    caps: { monthlyRetainerHours: 10, maxShootsPerCycle: 2, maxCaptureHoursPerCycle: 1 },
  });

  assert.equal(usage.totalMinutes, 60 + 120 + 30 + 999);
  assert.equal(usage.captureMinutes, 60 + 30 + 999);
  assert.equal(usage.shoots, 2);

  assert.equal(usage.caps.totalMinutes.limit, 300);
  assert.equal(usage.caps.shoots.limit, 2);
  assert.equal(usage.caps.captureMinutes.limit, 60);

  assert.equal(usage.caps.shoots.isOver, false);
  assert.equal(usage.caps.captureMinutes.isOver, true);
}

console.log("retainers assertions: OK");
