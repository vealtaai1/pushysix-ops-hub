"use client";

import * as React from "react";
import { BUCKETS } from "@/lib/buckets";

type Client = { id: string; name: string };

type TaskLine = {
  id: string;
  clientId: string | null;
  clientName: string;
  bucketKey: string;
  hours: number;
  notes: string;
};

type MileageLine = {
  id: string;
  clientId: string | null;
  clientName: string;
  kilometers: number;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function hoursOptions(maxHours = 24) {
  const opts: number[] = [];
  for (let h = 0; h <= maxHours; h += 0.25) {
    // Avoid floating point artifacts
    opts.push(Math.round(h * 100) / 100);
  }
  return opts;
}

function nearlyEqual(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

function ClientTypeahead(props: {
  clients: Client[];
  valueName: string;
  onSelect: (c: Client) => void;
  placeholder?: string;
}) {
  const { clients, valueName, onSelect, placeholder } = props;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(valueName);

  React.useEffect(() => {
    setQuery(valueName);
  }, [valueName]);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 10);
    return clients
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [clients, query]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Let clicks on the menu register
          window.setTimeout(() => setOpen(false), 100);
        }}
        placeholder={placeholder ?? "Search client…"}
        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3"
      />

      {open ? (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">No matches</div>
          ) : (
            matches.map((c) => (
              <button
                key={c.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function WorklogForm({ clients }: { clients: Client[] }) {
  const [workDate, setWorkDate] = React.useState(() => {
    const d = new Date();
    // yyyy-mm-dd for <input type=date>
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [targetHours, setTargetHours] = React.useState<number>(8);
  const [totalKm, setTotalKm] = React.useState<number>(0);

  const [tasks, setTasks] = React.useState<TaskLine[]>(() => [
    {
      id: uid(),
      clientId: null,
      clientName: "",
      bucketKey: BUCKETS[0]?.key ?? "",
      hours: 0,
      notes: "",
    },
  ]);

  const [mileage, setMileage] = React.useState<MileageLine[]>(() => []);

  const hourOpts = React.useMemo(() => hoursOptions(24), []);

  const allocatedHours = React.useMemo(
    () => tasks.reduce((sum, t) => sum + (Number.isFinite(t.hours) ? t.hours : 0), 0),
    [tasks]
  );

  const hoursMatch = React.useMemo(
    () => nearlyEqual(allocatedHours, targetHours),
    [allocatedHours, targetHours]
  );

  const hasNotesViolations = React.useMemo(() => {
    return tasks.some((t) => t.hours > 0 && t.notes.trim().length === 0);
  }, [tasks]);

  const hasClientViolations = React.useMemo(() => {
    return tasks.some((t) => t.hours > 0 && !t.clientId);
  }, [tasks]);

  const allocatedKm = React.useMemo(
    () => mileage.reduce((sum, m) => sum + (Number.isFinite(m.kilometers) ? m.kilometers : 0), 0),
    [mileage]
  );

  const mileageRequired = totalKm > 0;

  const mileageComplete = React.useMemo(() => {
    if (!mileageRequired) return true;
    if (mileage.length === 0) return false;
    const linesValid = mileage.every(
      (m) => (m.kilometers > 0 ? Boolean(m.clientId) : true) && m.kilometers >= 0
    );
    if (!linesValid) return false;
    return nearlyEqual(allocatedKm, totalKm);
  }, [mileageRequired, mileage, allocatedKm, totalKm]);

  const canSubmit = hoursMatch && !hasNotesViolations && !hasClientViolations && mileageComplete;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Date</span>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Total hours (target)</span>
            <input
              type="number"
              min={0}
              step={0.25}
              value={targetHours}
              onChange={(e) => setTargetHours(Number(e.target.value || 0))}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Total km (optional)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={totalKm}
              onChange={(e) => {
                const next = Number(e.target.value || 0);
                setTotalKm(next);
                if (next <= 0) setMileage([]);
              }}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <div>
            <span className="text-zinc-600">Allocated hours:</span>{" "}
            <span className={hoursMatch ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
              {allocatedHours.toFixed(2)} / {targetHours.toFixed(2)}
            </span>
          </div>
          {hasClientViolations ? (
            <div className="text-red-700">Client is required for any task with hours &gt; 0.</div>
          ) : null}
          {hasNotesViolations ? (
            <div className="text-red-700">Notes are required for any task with hours &gt; 0.</div>
          ) : null}
          {mileageRequired ? (
            <div>
              <span className="text-zinc-600">Mileage allocated:</span>{" "}
              <span
                className={
                  mileageComplete
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-red-700"
                }
              >
                {allocatedKm.toFixed(1)} / {totalKm.toFixed(1)} km
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Tasks</h2>
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
            onClick={() =>
              setTasks((prev) => [
                ...prev,
                {
                  id: uid(),
                  clientId: null,
                  clientName: "",
                  bucketKey: BUCKETS[0]?.key ?? "",
                  hours: 0,
                  notes: "",
                },
              ])
            }
          >
            + Add task
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-zinc-600">
                <th className="border-b border-zinc-200 px-3 py-2">Client</th>
                <th className="border-b border-zinc-200 px-3 py-2">Task category</th>
                <th className="border-b border-zinc-200 px-3 py-2">Hours</th>
                <th className="border-b border-zinc-200 px-3 py-2">Notes</th>
                <th className="border-b border-zinc-200 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, idx) => {
                const notesRequired = t.hours > 0;
                return (
                  <tr key={t.id} className="align-top">
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <ClientTypeahead
                        clients={clients}
                        valueName={t.clientName}
                        placeholder="Search client…"
                        onSelect={(c) =>
                          setTasks((prev) =>
                            prev.map((x) =>
                              x.id === t.id
                                ? { ...x, clientId: c.id, clientName: c.name }
                                : x
                            )
                          )
                        }
                      />
                      {t.clientId ? null : (
                        <div className="mt-1 text-xs text-zinc-500">Choose a client</div>
                      )}
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <select
                        value={t.bucketKey}
                        onChange={(e) =>
                          setTasks((prev) =>
                            prev.map((x) => (x.id === t.id ? { ...x, bucketKey: e.target.value } : x))
                          )
                        }
                        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3"
                      >
                        {BUCKETS.map((b) => (
                          <option key={b.key} value={b.key}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <select
                        value={t.hours}
                        onChange={(e) =>
                          setTasks((prev) =>
                            prev.map((x) =>
                              x.id === t.id ? { ...x, hours: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="h-10 w-32 rounded-md border border-zinc-300 bg-white px-3"
                      >
                        {hourOpts.map((h) => (
                          <option key={h} value={h}>
                            {h.toFixed(2)}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs text-zinc-500">0.25 increments</div>
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <textarea
                        value={t.notes}
                        onChange={(e) =>
                          setTasks((prev) =>
                            prev.map((x) => (x.id === t.id ? { ...x, notes: e.target.value } : x))
                          )
                        }
                        placeholder="What did you work on?"
                        className={
                          "min-h-20 w-full rounded-md border bg-white px-3 py-2 " +
                          (notesRequired && t.notes.trim().length === 0
                            ? "border-red-300"
                            : "border-zinc-300")
                        }
                      />
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <button
                        type="button"
                        className="h-10 rounded-md px-3 text-sm text-zinc-700 hover:bg-zinc-50"
                        onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                        disabled={tasks.length === 1}
                        title={tasks.length === 1 ? "At least one task is required" : "Remove"}
                      >
                        Remove
                      </button>
                      {idx === 0 ? null : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {mileageRequired ? (
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Mileage allocation</h2>
            <button
              type="button"
              className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
              onClick={() =>
                setMileage((prev) => [
                  ...prev,
                  { id: uid(), clientId: null, clientName: "", kilometers: 0 },
                ])
              }
            >
              + Add allocation
            </button>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[700px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="border-b border-zinc-200 px-3 py-2">Client</th>
                  <th className="border-b border-zinc-200 px-3 py-2">Kilometers</th>
                  <th className="border-b border-zinc-200 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {mileage.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <ClientTypeahead
                        clients={clients}
                        valueName={m.clientName}
                        placeholder="Search client…"
                        onSelect={(c) =>
                          setMileage((prev) =>
                            prev.map((x) =>
                              x.id === m.id ? { ...x, clientId: c.id, clientName: c.name } : x
                            )
                          )
                        }
                      />
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={m.kilometers}
                        onChange={(e) =>
                          setMileage((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? { ...x, kilometers: Number(e.target.value || 0) }
                                : x
                            )
                          )
                        }
                        className="h-10 w-40 rounded-md border border-zinc-300 bg-white px-3"
                      />
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <button
                        type="button"
                        className="h-10 rounded-md px-3 text-sm text-zinc-700 hover:bg-zinc-50"
                        onClick={() => setMileage((prev) => prev.filter((x) => x.id !== m.id))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!mileageComplete ? (
            <div className="mt-3 text-sm text-red-700">
              Mileage must be fully allocated to clients, and allocations must add up exactly to the total
              km.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          className={
            "h-10 rounded-md px-4 text-sm font-semibold text-white " +
            (canSubmit ? "bg-[#2EA3F2] hover:opacity-90" : "bg-zinc-300")
          }
          title={
            canSubmit
              ? "Ready to submit"
              : "Hours must match target exactly; client + notes required for non-zero hours; and mileage must be allocated if entered"
          }
          onClick={() => {
            // Save action not implemented yet (UI-only per scaffold).
            alert(
              JSON.stringify(
                {
                  workDate,
                  targetHours,
                  totalKm,
                  tasks,
                  mileage,
                },
                null,
                2
              )
            );
          }}
        >
          Submit worklog
        </button>
      </div>
    </div>
  );
}
