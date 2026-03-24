import { NextResponse } from "next/server";

const OPS_V2_ANALYTICS_ENABLED =
  process.env.OPS_V2_ANALYTICS_ENABLED === "true" || process.env.OPS_V2_ANALYTICS_ENABLED === "1";

import { requireAdminOrAccountManagerOrThrow } from "@/lib/adminAuth";
import { parseISODateOnly } from "@/lib/calgaryTime";
import { prisma } from "@/lib/db";

const OPS_V2_ANALYTICS_ENABLED =
  process.env.OPS_V2_ANALYTICS_ENABLED === "true" || process.env.OPS_V2_ANALYTICS_ENABLED === "1";

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status: 400 });
}

function asISODateOnly(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return parseISODateOnly(t) ? t : null;
}

function isoTodayUTC(): string {
  // YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isoDaysAgoUTC(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function isoToUTCDate(iso: string): Date {
  const p = parseISODateOnly(iso);
  if (!p) throw new Error("Invalid ISO date");
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0));
}

export async function GET(req: Request) {
  if (!OPS_V2_ANALYTICS_ENABLED) {
    // Keep endpoint dark by default, even if deployed.
    return NextResponse.json({ ok: false, message: "Not Found" }, { status: 404 });
  }

  try {
    await requireAdminOrAccountManagerOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const url = new URL(req.url);

  const fromISO = asISODateOnly(url.searchParams.get("from")) ?? isoDaysAgoUTC(30);
  const toISO = asISODateOnly(url.searchParams.get("to")) ?? isoTodayUTC();

  if (fromISO > toISO) {
    return badRequest("from must be <= to", { from: fromISO, to: toISO });
  }

  const clientId = (url.searchParams.get("clientId") ?? "").trim() || null;

  // Worklog workDate is stored at UTC midnight for the local date.
  const fromDate = isoToUTCDate(fromISO);
  const toDateInclusive = isoToUTCDate(toISO);
  const toDateExclusive = new Date(toDateInclusive);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  const whereEntries: any = {
    worklog: {
      workDate: {
        gte: fromDate,
        lt: toDateExclusive,
      },
    },
  };

  if (clientId) whereEntries.clientId = clientId;

  const entries = await prisma.worklogEntry.findMany({
    where: whereEntries,
    select: {
      minutes: true,
      bucketKey: true,
      bucketName: true,
      clientId: true,
      client: { select: { name: true } },
      worklog: {
        select: {
          workDate: true,
          userId: true,
        },
      },
    },
  });

  // Aggregate in-memory (fine for initial skeleton). If this grows, convert to SQL aggregates.
  const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);

  const dayMap = new Map<string, number>();
  const clientMap = new Map<string, { clientId: string; clientName: string; minutes: number }>();
  const bucketMap = new Map<string, { bucketKey: string; bucketName: string; minutes: number }>();
  const users = new Set<string>();

  for (const e of entries) {
    const d = e.worklog.workDate;
    const date = d.toISOString().slice(0, 10);
    dayMap.set(date, (dayMap.get(date) ?? 0) + e.minutes);

    const cId = e.clientId;
    const cName = e.client?.name ?? cId;
    const c = clientMap.get(cId) ?? { clientId: cId, clientName: cName, minutes: 0 };
    c.minutes += e.minutes;
    clientMap.set(cId, c);

    const bKey = e.bucketKey;
    const bName = e.bucketName ?? bKey;
    const b = bucketMap.get(bKey) ?? { bucketKey: bKey, bucketName: bName, minutes: 0 };
    b.minutes += e.minutes;
    bucketMap.set(bKey, b);

    users.add(e.worklog.userId);
  }

  // Ensure empty days show as 0 for the selected range.
  const minutesByDay: Array<{ date: string; minutes: number }> = [];
  {
    const start = isoToUTCDate(fromISO);
    const endEx = isoToUTCDate(toISO);
    endEx.setUTCDate(endEx.getUTCDate() + 1);

    for (let cur = new Date(start); cur < endEx; ) {
      const iso = cur.toISOString().slice(0, 10);
      minutesByDay.push({ date: iso, minutes: dayMap.get(iso) ?? 0 });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const minutesByClient = Array.from(clientMap.values()).sort((a, b) => b.minutes - a.minutes);
  const minutesByBucket = Array.from(bucketMap.values()).sort((a, b) => b.minutes - a.minutes);

  return NextResponse.json(
    {
      ok: true,
      range: { from: fromISO, to: toISO },
      totals: {
        totalMinutes,
        entryCount: entries.length,
        distinctClients: clientMap.size,
        distinctUsers: users.size,
      },
      minutesByDay,
      minutesByClient,
      minutesByBucket,
    },
    { status: 200 },
  );
}
