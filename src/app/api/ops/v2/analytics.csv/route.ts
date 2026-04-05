import { NextResponse } from "next/server";

import { requireAdminOrThrow } from "@/lib/adminAuth";
import { parseISODateOnly } from "@/lib/calgaryTime";
import { prisma } from "@/lib/db";

const OPS_V2_ANALYTICS_ENABLED =
  process.env.OPS_V2_ANALYTICS_ENABLED === "true" || process.env.OPS_V2_ANALYTICS_ENABLED === "1";

function asISODateOnly(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  return parseISODateOnly(t) ? t : null;
}

function isoTodayUTC(): string {
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

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export async function GET(req: Request) {
  if (!OPS_V2_ANALYTICS_ENABLED) {
    return NextResponse.json({ ok: false, message: "Not Found" }, { status: 404 });
  }

  try {
    await requireAdminOrThrow();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.startsWith("Forbidden") ? 403 : 401;
    return NextResponse.json({ ok: false, message }, { status });
  }

  const url = new URL(req.url);

  const fromISO = asISODateOnly(url.searchParams.get("from")) ?? isoDaysAgoUTC(30);
  const toISO = asISODateOnly(url.searchParams.get("to")) ?? isoTodayUTC();

  if (fromISO > toISO) {
    return NextResponse.json({ ok: false, message: "from must be <= to", details: { from: fromISO, to: toISO } }, { status: 400 });
  }

  const clientId = (url.searchParams.get("clientId") ?? "").trim() || null;
  const bucketKey = (url.searchParams.get("bucketKey") ?? "").trim() || null;
  const userId = (url.searchParams.get("userId") ?? "").trim() || null;

  const view = (url.searchParams.get("view") ?? "project").trim();

  const fromDate = isoToUTCDate(fromISO);
  const toDateInclusive = isoToUTCDate(toISO);
  const toDateExclusive = new Date(toDateInclusive);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  const whereEntries: any = {
    bucketKey: bucketKey ?? undefined,
    clientId: clientId ?? undefined,
    worklog: {
      workDate: { gte: fromDate, lt: toDateExclusive },
      status: "APPROVED",
      userId: userId ?? undefined,
    },
  };

  // Remove undefined keys to keep Prisma happy.
  if (!bucketKey) delete whereEntries.bucketKey;
  if (!clientId) delete whereEntries.clientId;
  if (!userId) delete whereEntries.worklog.userId;

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
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);

  const dayMap = new Map<string, number>();
  const clientMap = new Map<string, { clientId: string; clientName: string; minutes: number }>();
  const bucketMap = new Map<string, { bucketKey: string; bucketName: string; minutes: number }>();
  const userMap = new Map<string, { userId: string; userName: string | null; userEmail: string | null; minutes: number }>();
  const projectMap = new Map<
    string,
    { projectKey: string; clientId: string; clientName: string; bucketKey: string; bucketName: string; minutes: number }
  >();
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

    const uId = e.worklog.userId;
    const uName = e.worklog.user?.name ?? null;
    const uEmail = e.worklog.user?.email ?? null;
    const u = userMap.get(uId) ?? { userId: uId, userName: uName, userEmail: uEmail, minutes: 0 };
    u.minutes += e.minutes;
    userMap.set(uId, u);

    const projectKey = `${cId}::${bKey}`;
    const p = projectMap.get(projectKey) ?? {
      projectKey,
      clientId: cId,
      clientName: cName,
      bucketKey: bKey,
      bucketName: bName,
      minutes: 0,
    };
    p.minutes += e.minutes;
    projectMap.set(projectKey, p);

    users.add(uId);
  }

  // Fill days
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
  const minutesByUser = Array.from(userMap.values()).sort((a, b) => b.minutes - a.minutes);
  const minutesByProject = Array.from(projectMap.values()).sort((a, b) => b.minutes - a.minutes);

  const entryCount = entries.length;
  const distinctClients = clientMap.size;
  const distinctUsers = users.size;

  const lines: string[] = [];
  lines.push(`# Ops v2 Analytics export`);
  lines.push(`# Range,${fromISO},${toISO}`);
  lines.push(`# Filters,clientId=${clientId ?? ""},bucketKey=${bucketKey ?? ""},userId=${userId ?? ""}`);
  lines.push(`# Totals,totalMinutes=${totalMinutes},hours=${toHours(totalMinutes)},entries=${entryCount},clients=${distinctClients},users=${distinctUsers}`);
  lines.push("");

  function emitTable(headers: string[], rows: Array<Array<unknown>>) {
    lines.push(headers.map(csvEscape).join(","));
    for (const r of rows) {
      lines.push(r.map(csvEscape).join(","));
    }
  }

  switch (view) {
    case "day": {
      emitTable([
        "date",
        "minutes",
        "hours",
      ], minutesByDay.map((d) => [d.date, d.minutes, toHours(d.minutes)]));
      break;
    }
    case "client": {
      emitTable(["clientId", "clientName", "minutes", "hours"], minutesByClient.map((c) => [c.clientId, c.clientName, c.minutes, toHours(c.minutes)]));
      break;
    }
    case "bucket": {
      emitTable(["bucketKey", "bucketName", "minutes", "hours"], minutesByBucket.map((b) => [b.bucketKey, b.bucketName, b.minutes, toHours(b.minutes)]));
      break;
    }
    case "user": {
      emitTable(["userId", "userName", "userEmail", "minutes", "hours"], minutesByUser.map((u) => [u.userId, u.userName ?? "", u.userEmail ?? "", u.minutes, toHours(u.minutes)]));
      break;
    }
    case "project":
    default: {
      emitTable(
        ["projectKey", "clientId", "clientName", "bucketKey", "bucketName", "minutes", "hours"],
        minutesByProject.map((p) => [p.projectKey, p.clientId, p.clientName, p.bucketKey, p.bucketName, p.minutes, toHours(p.minutes)])
      );
      break;
    }
  }

  const csv = lines.join("\n") + "\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=ops-v2-analytics-${fromISO}-to-${toISO}.csv`,
    },
  });
}
