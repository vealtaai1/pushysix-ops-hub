import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function isoDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default async function ManagementWorklogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (searchParams ? await searchParams : {}) as Record<string, unknown>;
  const userIdRaw = sp.userId;
  const userId = typeof userIdRaw === "string" ? userIdRaw : undefined;

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });

  const where = userId ? { userId } : {};

  const worklogs = await prisma.worklog.findMany({
    where,
    orderBy: [{ workDate: "desc" }],
    take: 50,
    include: {
      user: { select: { email: true } },
      entries: { include: { client: { select: { name: true } } } },
      mileage: { include: { client: { select: { name: true } } } },
    },
  });

  const daysOff = await prisma.dayOff.findMany({
    where,
    orderBy: [{ dayDate: "desc" }],
    take: 50,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Worklogs & day-offs</h1>
        <p className="text-sm text-zinc-600">Manager view across users.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2" action="/management/worklogs">
          <label className="text-sm text-zinc-700">User</label>
          <select name="userId" defaultValue={userId ?? ""} className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm">
            <option value="">(all)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
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
                {u.email}
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
                {u.email}
              </option>
            ))}
          </select>
          <button className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50">Open worklog</button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recent worklogs</h2>
          <div className="overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[650px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="border-b border-zinc-200 px-3 py-2">Date</th>
                  <th className="border-b border-zinc-200 px-3 py-2">User</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Status</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Lines</th>
                </tr>
              </thead>
              <tbody>
                {worklogs.map((w) => (
                  <tr key={w.id} className="align-top">
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{isoDay(w.workDate)}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{w.user.email}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm font-medium">{w.status}</td>
                    <td className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-700">
                      <div className="space-y-1">
                        {w.entries.slice(0, 5).map((e) => (
                          <div key={e.id}>
                            {e.client.name} • {e.bucketName} • {(e.minutes / 60).toFixed(2)}h
                          </div>
                        ))}
                        {w.entries.length > 5 ? <div>… +{w.entries.length - 5} more</div> : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {worklogs.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-zinc-600" colSpan={4}>
                      No worklogs.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recent day-offs</h2>
          <div className="overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[520px] border-separate border-spacing-0">
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
                    <td className="border-b border-zinc-100 px-3 py-2 text-sm">{d.user.email}</td>
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
