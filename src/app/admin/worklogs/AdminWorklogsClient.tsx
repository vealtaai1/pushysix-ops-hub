"use client";

// Fix: client-side admin worklogs table with inline editing so admins can update
// an existing worklog directly inside the table without leaving the page.
import * as React from "react";
import { useRouter } from "next/navigation";
import { BUCKETS } from "@/lib/buckets";

type UserRow = { email: string; name: string | null };

type WorklogEntryRow = {
  id: string;
  clientId: string;
  clientName: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  bucketKey: string;
  bucketName: string;
  minutes: number;
  notes: string;
};

type MileageRow = {
  id: string;
  clientId: string;
  clientName: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  kilometers: number;
  notes: string | null;
};

type ExpenseRow = {
  id: string;
  clientId: string;
  clientName: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  category: string;
  description: string;
  amountCents: number;
  receiptUrl: string | null;
};

type WorklogRow = {
  id: string;
  workDate: string;
  status: string;
  user: UserRow;
  entries: WorklogEntryRow[];
  mileage: MileageRow[];
  expenseEntries: ExpenseRow[];
};

type ClientOption = { id: string; name: string };

type ProjectOption = { id: string; clientId: string; code: string; shortCode: string; name: string; status: string };

type TaskDraft = {
  id: string;
  clientId: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  bucketKey: string;
  hoursText: string;
  notes: string;
};

type MileageDraft = {
  id: string;
  clientId: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  kilometersText: string;
  notes: string;
};

type ExpenseDraft = {
  id: string;
  clientId: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  category: string;
  description: string;
  amountText: string;
  receiptUrl: string;
};

type DraftState = {
  workDate: string;
  targetHoursText: string;
  totalKmText: string;
  tasks: TaskDraft[];
  mileage: MileageDraft[];
  expenses: ExpenseDraft[];
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function parseNumberText(text: string) {
  const t = text.trim();
  if (t === "") return 0;
  const normalized = t.replace(/,/g, ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function blankTask(): TaskDraft {
  return {
    id: uid(),
    clientId: "",
    engagementType: "RETAINER",
    projectId: null,
    bucketKey: "",
    hoursText: "",
    notes: "",
  };
}

function blankMileage(): MileageDraft {
  return {
    id: uid(),
    clientId: "",
    engagementType: "RETAINER",
    projectId: null,
    kilometersText: "",
    notes: "",
  };
}

function blankExpense(): ExpenseDraft {
  return {
    id: uid(),
    clientId: "",
    engagementType: "RETAINER",
    projectId: null,
    category: "OTHER",
    description: "",
    amountText: "",
    receiptUrl: "",
  };
}

function buildDraft(row: WorklogRow): DraftState {
  const tasks = row.entries.length
    ? row.entries.map((entry) => ({
        id: entry.id,
        clientId: entry.clientId,
        engagementType: entry.engagementType,
        projectId: entry.projectId,
        bucketKey: entry.bucketKey,
        hoursText: (entry.minutes / 60).toFixed(2).replace(/\.00$/, ""),
        notes: entry.notes,
      }))
    : [blankTask()];

  const mileage = row.mileage.map((item) => ({
    id: item.id,
    clientId: item.clientId,
    engagementType: item.engagementType,
    projectId: item.projectId,
    kilometersText: String(item.kilometers),
    notes: item.notes ?? "",
  }));

  const expenses = row.expenseEntries.map((item) => ({
    id: item.id,
    clientId: item.clientId,
    engagementType: item.engagementType,
    projectId: item.projectId,
    category: item.category,
    description: item.description,
    amountText: (item.amountCents / 100).toFixed(2),
    receiptUrl: item.receiptUrl ?? "",
  }));

  const targetHours = row.entries.reduce((sum, entry) => sum + entry.minutes, 0) / 60;
  const totalKm = row.mileage.reduce((sum, item) => sum + item.kilometers, 0);

  return {
    workDate: row.workDate.slice(0, 10),
    targetHoursText: targetHours ? String(targetHours).replace(/\.00$/, "") : "",
    totalKmText: totalKm ? String(totalKm) : "",
    tasks,
    mileage,
    expenses,
  };
}

function projectLabel(project: ProjectOption) {
  return `${project.code} (${project.shortCode})`;
}

function WorklogEditModal({
  row,
  clients,
  projects,
  clientIdsWithRetainer,
  onCancel,
  onSaved,
}: {
  row: WorklogRow;
  clients: ClientOption[];
  projects: ProjectOption[];
  clientIdsWithRetainer: string[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const [draft, setDraft] = React.useState<DraftState>(() => buildDraft(row));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasRetainerByClientId = React.useMemo(() => new Set(clientIdsWithRetainer), [clientIdsWithRetainer]);

  const projectsByClient = React.useMemo(() => {
    const map = new Map<string, ProjectOption[]>();
    for (const project of projects) {
      const list = map.get(project.clientId) ?? [];
      list.push(project);
      map.set(project.clientId, list);
    }
    return map;
  }, [projects]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/worklogs/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          worklogId: row.id,
          workDate: draft.workDate,
          targetHours: parseNumberText(draft.targetHoursText),
          totalKm: parseNumberText(draft.totalKmText),
          tasks: draft.tasks.map((task) => ({
            clientId: task.clientId || null,
            engagementType: task.engagementType,
            projectId: task.projectId,
            bucketKey: task.bucketKey,
            hours: parseNumberText(task.hoursText),
            notes: task.notes,
          })),
          mileage: draft.mileage.map((item) => ({
            clientId: item.clientId || null,
            engagementType: item.engagementType,
            projectId: item.projectId,
            kilometers: parseNumberText(item.kilometersText),
            notes: item.notes,
          })),
          expenses: draft.expenses.map((item) => ({
            id: item.id.startsWith("new:") ? null : item.id,
            clientId: item.clientId || null,
            engagementType: item.engagementType,
            projectId: item.projectId,
            category: item.category,
            description: item.description,
            amount: item.amountText,
            receiptUrl: item.receiptUrl || null,
          })),
        }),
      });

      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || json?.ok !== true) {
        throw new Error(json?.message ?? `Save failed (${res.status})`);
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="flex w-full max-w-3xl flex-col rounded-xl border border-zinc-200 bg-white shadow-xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              {row.user.name ?? row.user.email}
            </div>
            <div className="text-xs text-zinc-500">
              {fmtDate(row.workDate)} · {row.status} · edit mode
            </div>
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            onClick={onCancel}
            aria-label="Close"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={draft.workDate}
            onChange={(e) => setDraft((prev) => ({ ...prev, workDate: e.target.value }))}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Total hours</span>
          <input
            type="number"
            step={0.25}
            min={0}
            value={draft.targetHoursText}
            onChange={(e) => setDraft((prev) => ({ ...prev, targetHoursText: e.target.value }))}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Total km</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.totalKmText}
            onChange={(e) => setDraft((prev) => ({ ...prev, totalKmText: e.target.value }))}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3"
          />
        </label>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Tasks</h3>
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
            onClick={() => setDraft((prev) => ({ ...prev, tasks: [...prev.tasks, blankTask()] }))}
          >
            + Add task
          </button>
        </div>
        <div className="space-y-3">
          {draft.tasks.map((task, index) => {
            const clientProjects = task.clientId ? projectsByClient.get(task.clientId) ?? [] : [];
            return (
              <div key={task.id} className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
                {/* Row 1: Client / Engagement / Category */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-zinc-600">Client</span>
                    <select
                      value={task.clientId}
                      onChange={(e) => {
                        const clientId = e.target.value;
                        const hasRetainer = hasRetainerByClientId.has(clientId);
                        const nextProjects = clientId ? projectsByClient.get(clientId) ?? [] : [];
                        setDraft((prev) => ({
                          ...prev,
                          tasks: prev.tasks.map((item, itemIndex) =>
                            itemIndex !== index
                              ? item
                              : {
                                  ...item,
                                  clientId,
                                  engagementType: hasRetainer ? "RETAINER" : "MISC_PROJECT",
                                  projectId: hasRetainer ? null : nextProjects[0]?.id ?? null,
                                },
                          ),
                        }));
                      }}
                      className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    >
                      <option value="">(select)</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-zinc-600">Engagement</span>
                    <select
                      value={task.engagementType === "RETAINER" ? "RETAINER" : task.projectId ? `PROJECT:${task.projectId}` : ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          tasks: prev.tasks.map((item, itemIndex) => {
                            if (itemIndex !== index) return item;
                            if (value === "RETAINER") return { ...item, engagementType: "RETAINER", projectId: null };
                            return { ...item, engagementType: "MISC_PROJECT", projectId: value.replace("PROJECT:", "") || null };
                          }),
                        }));
                      }}
                      disabled={!task.clientId}
                      className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
                    >
                      <option value="">(select)</option>
                      {task.clientId && hasRetainerByClientId.has(task.clientId) ? <option value="RETAINER">Retainer</option> : null}
                      {clientProjects.map((project) => (
                        <option key={project.id} value={`PROJECT:${project.id}`}>
                          {projectLabel(project)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-zinc-600">Category</span>
                    <select
                      value={task.bucketKey}
                      onChange={(e) => {
                        const bucketKey = e.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          tasks: prev.tasks.map((item, itemIndex) => (itemIndex === index ? { ...item, bucketKey } : item)),
                        }));
                      }}
                      className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    >
                      <option value="">(select)</option>
                      {BUCKETS.map((bucket) => (
                        <option key={bucket.key} value={bucket.key}>
                          {bucket.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {/* Row 2: Hours / Notes / Delete */}
                <div className="flex flex-wrap items-start gap-3">
                  <label className="grid w-28 shrink-0 gap-1">
                    <span className="text-xs font-medium text-zinc-600">Hours</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={task.hoursText}
                      onChange={(e) => {
                        const hoursText = e.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          tasks: prev.tasks.map((item, itemIndex) => (itemIndex === index ? { ...item, hoursText } : item)),
                        }));
                      }}
                      className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                    />
                  </label>
                  <label className="grid min-w-0 flex-1 gap-1">
                    <span className="text-xs font-medium text-zinc-600">Notes</span>
                    <textarea
                      rows={2}
                      value={task.notes}
                      onChange={(e) => {
                        const notes = e.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          tasks: prev.tasks.map((item, itemIndex) => (itemIndex === index ? { ...item, notes } : item)),
                        }));
                      }}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex items-end pt-5">
                    <button
                      type="button"
                      className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          tasks: prev.tasks.length === 1 ? [blankTask()] : prev.tasks.filter((item, itemIndex) => itemIndex !== index),
                        }))
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Mileage</h3>
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
            onClick={() => setDraft((prev) => ({ ...prev, mileage: [...prev.mileage, blankMileage()] }))}
          >
            + Add mileage
          </button>
        </div>
        <div className="space-y-3">
          {draft.mileage.map((item, index) => {
            const clientProjects = item.clientId ? projectsByClient.get(item.clientId) ?? [] : [];
            return (
              <div key={item.id} className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-[1.2fr_1fr_0.8fr_1.4fr_auto]">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Client</span>
                  <select
                    value={item.clientId}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      const hasRetainer = hasRetainerByClientId.has(clientId);
                      const nextProjects = clientId ? projectsByClient.get(clientId) ?? [] : [];
                      setDraft((prev) => ({
                        ...prev,
                        mileage: prev.mileage.map((line, lineIndex) =>
                          lineIndex !== index
                            ? line
                            : {
                                ...line,
                                clientId,
                                engagementType: hasRetainer ? "RETAINER" : "MISC_PROJECT",
                                projectId: hasRetainer ? null : nextProjects[0]?.id ?? null,
                              },
                        ),
                      }));
                    }}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  >
                    <option value="">(select)</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Engagement</span>
                  <select
                    value={item.engagementType === "RETAINER" ? "RETAINER" : item.projectId ? `PROJECT:${item.projectId}` : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        mileage: prev.mileage.map((line, lineIndex) => {
                          if (lineIndex !== index) return line;
                          if (value === "RETAINER") return { ...line, engagementType: "RETAINER", projectId: null };
                          return { ...line, engagementType: "MISC_PROJECT", projectId: value.replace("PROJECT:", "") || null };
                        }),
                      }));
                    }}
                    disabled={!item.clientId}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
                  >
                    <option value="">(select)</option>
                    {item.clientId && hasRetainerByClientId.has(item.clientId) ? <option value="RETAINER">Retainer</option> : null}
                    {clientProjects.map((project) => (
                      <option key={project.id} value={`PROJECT:${project.id}`}>
                        {projectLabel(project)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Kilometers</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.kilometersText}
                    onChange={(e) => {
                      const kilometersText = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        mileage: prev.mileage.map((line, lineIndex) => (lineIndex === index ? { ...line, kilometersText } : line)),
                      }));
                    }}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Notes</span>
                  <textarea
                    value={item.notes}
                    onChange={(e) => {
                      const notes = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        mileage: prev.mileage.map((line, lineIndex) => (lineIndex === index ? { ...line, notes } : line)),
                      }));
                    }}
                    className="min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        mileage: prev.mileage.filter((line, lineIndex) => lineIndex !== index),
                      }))
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Expenses</h3>
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
            onClick={() => setDraft((prev) => ({ ...prev, expenses: [...prev.expenses, { ...blankExpense(), id: `new:${uid()}` }] }))}
          >
            + Add expense
          </button>
        </div>
        <div className="space-y-3">
          {draft.expenses.map((item, index) => {
            const clientProjects = item.clientId ? projectsByClient.get(item.clientId) ?? [] : [];
            return (
              <div key={item.id} className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-[1.1fr_1fr_1fr_1.2fr_1.1fr_1.3fr_auto]">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Client</span>
                  <select
                    value={item.clientId}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      const hasRetainer = hasRetainerByClientId.has(clientId);
                      const nextProjects = clientId ? projectsByClient.get(clientId) ?? [] : [];
                      setDraft((prev) => ({
                        ...prev,
                        expenses: prev.expenses.map((expense, expenseIndex) =>
                          expenseIndex !== index
                            ? expense
                            : {
                                ...expense,
                                clientId,
                                engagementType: hasRetainer ? "RETAINER" : "MISC_PROJECT",
                                projectId: hasRetainer ? null : nextProjects[0]?.id ?? null,
                              },
                        ),
                      }));
                    }}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  >
                    <option value="">(select)</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Engagement</span>
                  <select
                    value={item.engagementType === "RETAINER" ? "RETAINER" : item.projectId ? `PROJECT:${item.projectId}` : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        expenses: prev.expenses.map((expense, expenseIndex) => {
                          if (expenseIndex !== index) return expense;
                          if (value === "RETAINER") return { ...expense, engagementType: "RETAINER", projectId: null };
                          return { ...expense, engagementType: "MISC_PROJECT", projectId: value.replace("PROJECT:", "") || null };
                        }),
                      }));
                    }}
                    disabled={!item.clientId}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 disabled:bg-zinc-50"
                  >
                    <option value="">(select)</option>
                    {item.clientId && hasRetainerByClientId.has(item.clientId) ? <option value="RETAINER">Retainer</option> : null}
                    {clientProjects.map((project) => (
                      <option key={project.id} value={`PROJECT:${project.id}`}>
                        {projectLabel(project)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Category</span>
                  <select
                    value={item.category}
                    onChange={(e) => {
                      const category = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        expenses: prev.expenses.map((expense, expenseIndex) => (expenseIndex === index ? { ...expense, category } : expense)),
                      }));
                    }}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  >
                    <option value="HOTEL_ACCOMMODATION">Hotel Accommodation</option>
                    <option value="MEAL">Meal</option>
                    <option value="PROP">Filming Prop</option>
                    <option value="CAMERA_GEAR_EQUIPMENT">Camera Gear / Equipment</option>
                    <option value="PARKING">Parking</option>
                    <option value="CAR_RENTAL">Rental Car</option>
                    <option value="FUEL">Fuel</option>
                    <option value="FLIGHT_EXPENSE">Flight Expense</option>
                    <option value="GROUND_TRANSPORTATION">Ground Transportation</option>
                    <option value="AD_SPEND">Ad Spend</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Description</span>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => {
                      const description = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        expenses: prev.expenses.map((expense, expenseIndex) => (expenseIndex === index ? { ...expense, description } : expense)),
                      }));
                    }}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Amount</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.amountText}
                    onChange={(e) => {
                      const amountText = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        expenses: prev.expenses.map((expense, expenseIndex) => (expenseIndex === index ? { ...expense, amountText } : expense)),
                      }));
                    }}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-600">Receipt URL</span>
                  <input
                    type="text"
                    value={item.receiptUrl}
                    onChange={(e) => {
                      const receiptUrl = e.target.value;
                      setDraft((prev) => ({
                        ...prev,
                        expenses: prev.expenses.map((expense, expenseIndex) => (expenseIndex === index ? { ...expense, receiptUrl } : expense)),
                      }));
                    }}
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="h-10 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        expenses: prev.expenses.filter((expense, expenseIndex) => expenseIndex !== index),
                      }))
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

        </div>{/* end scrollable body */}

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 px-5 py-3">
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorklogDetailModal({
  worklog,
  onClose,
}: {
  worklog: WorklogRow;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              {worklog.user.name ?? worklog.user.email}
            </div>
            <div className="text-xs text-zinc-500">
              {fmtDate(worklog.workDate)} · {worklog.status}
            </div>
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {worklog.entries.length === 0 ? (
            <p className="text-sm text-zinc-500">No task entries on this worklog.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-3">Client</th>
                  <th className="pb-2 pr-3">Engagement</th>
                  <th className="pb-2 pr-3">Task Category</th>
                  <th className="pb-2 pr-3">Hours</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {worklog.entries.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="py-2 pr-3 text-zinc-800">{entry.clientName}</td>
                    <td className="py-2 pr-3 text-zinc-600">
                      {entry.engagementType === "RETAINER" ? "Retainer" : "Project"}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600">{entry.bucketName}</td>
                    <td className="py-2 pr-3 tabular-nums text-zinc-800">
                      {(entry.minutes / 60).toFixed(2)}h
                    </td>
                    <td className="py-2 text-zinc-500">{entry.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-100 px-5 py-3">
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminWorklogsClient({
  worklogs,
  clients,
  projects,
  clientIdsWithRetainer,
}: {
  worklogs: WorklogRow[];
  clients: ClientOption[];
  projects: ProjectOption[];
  clientIdsWithRetainer: string[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [viewingId, setViewingId] = React.useState<string | null>(null);
  const editingWorklog = worklogs.find((w) => w.id === editingId) ?? null;
  const viewingWorklog = worklogs.find((w) => w.id === viewingId) ?? null;

  return (
    <div className="rounded-lg border border-zinc-200">
      {editingWorklog ? (
        <WorklogEditModal
          row={editingWorklog}
          clients={clients}
          projects={projects}
          clientIdsWithRetainer={clientIdsWithRetainer}
          onCancel={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            router.refresh();
          }}
        />
      ) : null}
      {viewingWorklog ? (
        <WorklogDetailModal worklog={viewingWorklog} onClose={() => setViewingId(null)} />
      ) : null}
      <table className="w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-xs text-zinc-600">
            <th className="w-24 border-b border-zinc-200 px-3 py-2">Date</th>
            <th className="hidden w-40 border-b border-zinc-200 px-3 py-2 sm:table-cell">User</th>
            <th className="w-24 border-b border-zinc-200 px-3 py-2">Status</th>
            <th className="border-b border-zinc-200 px-3 py-2">Lines</th>
            {/* Fix: added Edit column so admins can open an inline editor for each worklog row */}
            <th className="w-40 border-b border-zinc-200 px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {worklogs.map((worklog) => {
            const isEditing = editingId === worklog.id;
            return (
              <React.Fragment key={worklog.id}>
                <tr className="align-top">
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">{fmtDate(worklog.workDate)}</td>
                  <td className="hidden border-b border-zinc-100 px-3 py-2 text-sm sm:table-cell">{worklog.user.name ?? worklog.user.email}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm font-medium">{worklog.status}</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-700">
                    <div className="max-h-24 overflow-hidden">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:hidden">
                        {worklog.user.name ?? worklog.user.email}
                      </div>
                      {worklog.entries.slice(0, 4).map((entry) => (
                        <div key={entry.id} className="truncate">
                          {entry.clientName} · {entry.bucketName} · {(entry.minutes / 60).toFixed(2)}h
                        </div>
                      ))}
                      {worklog.entries.length > 4 ? <div className="text-zinc-400">+{worklog.entries.length - 4} more</div> : null}
                    </div>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
                        onClick={() => setEditingId(worklog.id)}
                        disabled={editingId !== null || viewingId !== null}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50"
                        onClick={() => setViewingId(worklog.id)}
                        disabled={editingId !== null || viewingId !== null}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>

              </React.Fragment>
            );
          })}
          {worklogs.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-sm text-zinc-600" colSpan={5}>
                No worklogs.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
