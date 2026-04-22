import { prisma } from "@/lib/db";
import { AdminWorklogsClient } from "./AdminWorklogsClient";

export const dynamic = "force-dynamic";

function isoDay(d: Date) {
  // Fix: workDate is stored as UTC midnight; format in UTC so the date matches what the
  // employee submitted (formatting in local time shifted it one day earlier).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default async function AdminWorklogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const userIdRaw = sp.userId;
  const userId = typeof userIdRaw === "string" ? userIdRaw : undefined;

  const users = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, email: true, name: true, role: true },
  });

  const where = userId ? { userId } : {};

  const [worklogs, daysOff, clients, projects, retainerClients] = await Promise.all([
    prisma.worklog.findMany({
      where,
      orderBy: [{ workDate: "desc" }],
      take: 50,
      include: {
        user: { select: { email: true, name: true } },
        entries: {
          include: {
            client: { select: { id: true, name: true } },
          },
        },
        mileage: {
          include: {
            client: { select: { id: true, name: true } },
          },
        },
        expenseEntries: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            clientId: true,
            engagementType: true,
            projectId: true,
            category: true,
            description: true,
            amountCents: true,
            receiptUrl: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.dayOff.findMany({
      where,
      orderBy: [{ dayDate: "desc" }],
      take: 50,
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: [{ clientId: "asc" }, { code: "asc" }],
      select: { id: true, clientId: true, code: true, shortCode: true, name: true, status: true },
    }),
    prisma.client.findMany({
      where: { monthlyRetainerHours: { gt: 0 } },
      select: { id: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Worklogs & day-offs</h1>
        <p className="text-sm text-zinc-600">Manager view across users.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2" action="/admin/worklogs">
          <label className="text-sm text-zinc-700">User</label>
          <select name="userId" defaultValue={userId ?? ""} className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm">
            <option value="">(all)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50">Filter</button>
        </form>

        <form className="flex items-center gap-2" action="/schedule">
          <label className="text-sm text-zinc-700">View as</label>
          <select name="email" defaultValue="" className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm">
            <option value="">(pick employee)</option>
            {users.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50">Open schedule</button>
        </form>

        <form className="flex items-center gap-2" action="/worklog">
          <label className="text-sm text-zinc-700">Worklog as</label>
          <select name="email" defaultValue="" className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm">
            <option value="">(pick employee)</option>
            {users.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50">Open worklog</button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="space-y-3 min-w-0">
          <h2 className="text-sm font-semibold">Recent worklogs</h2>
          {/* Fix: render the worklogs table through a client component so admin rows can expand inline for editing */}
          <AdminWorklogsClient
            worklogs={worklogs.map((worklog) => ({
              id: worklog.id,
              workDate: worklog.workDate.toISOString(),
              status: worklog.status,
              user: worklog.user,
              entries: worklog.entries.map((entry) => ({
                id: entry.id,
                clientId: entry.client.id,
                clientName: entry.client.name,
                engagementType: entry.engagementType,
                projectId: entry.projectId,
                bucketKey: entry.bucketKey,
                bucketName: entry.bucketName,
                minutes: entry.minutes,
                notes: entry.notes ?? "",
              })),
              mileage: worklog.mileage.map((item) => ({
                id: item.id,
                clientId: item.client?.id ?? "",
                clientName: item.client?.name ?? "—",
                engagementType: item.engagementType,
                projectId: item.projectId,
                kilometers: item.kilometers,
                notes: item.notes,
              })),
              expenseEntries: worklog.expenseEntries.map((expense) => ({
                id: expense.id,
                clientId: expense.clientId,
                clientName: expense.client?.name ?? "—",
                engagementType: expense.engagementType,
                projectId: expense.projectId,
                category: expense.category,
                description: expense.description,
                amountCents: expense.amountCents,
                receiptUrl: expense.receiptUrl,
              })),
            }))}
            clients={clients}
            projects={projects}
            clientIdsWithRetainer={retainerClients.map((client) => client.id)}
          />
        </section>

        <section className="space-y-3 min-w-0">
          <h2 className="text-sm font-semibold">Recent day-offs</h2>
          <div className="rounded-lg border border-zinc-200">
            <table className="w-full table-fixed border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="border-b border-zinc-200 px-3 py-2">Date</th>
                  <th className="border-b border-zinc-200 px-3 py-2">User</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {daysOff.map((d) => (
                  <tr key={d.id}>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{isoDay(d.dayDate)}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{d.user.name ?? d.user.email}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm font-medium">{d.status}</td>
                  </tr>
                ))}
                {daysOff.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-600" colSpan={3}>
                      No day-offs.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
