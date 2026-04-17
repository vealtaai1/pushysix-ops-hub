"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { BUCKETS } from "@/lib/buckets";
import { ReceiptUploader } from "@/app/ops/v2/expenses/_components/ReceiptUploader";
import { ExpenseCategorySelectOptions } from "@/app/_components/ExpenseCategorySelectOptions";

type Client = { id: string; name: string };

type Project = { id: string; clientId: string; code: string; shortCode: string; name: string };

type TaskLine = {
  id: string;
  clientId: string | null;
  clientName: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  bucketKey: string;
  hoursText: string; // kept as text so the field can be cleared
  notes: string;
};

type MileageLine = {
  id: string;
  clientId: string | null;
  clientName: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  kilometersText: string; // kept as text so the field can be cleared
};

type ExpenseCategory =
  | "HOTEL_ACCOMMODATION"
  | "MEAL"
  | "PROP"
  | "CAMERA_GEAR_EQUIPMENT"
  | "PARKING"
  | "CAR_RENTAL"
  | "FUEL"
  | "FLIGHT_EXPENSE"
  | "GROUND_TRANSPORTATION"
  | "AD_SPEND"
  | "OTHER";

type ExpenseLine = {
  id: string;
  clientId: string | null;
  clientName: string;
  engagementType: "RETAINER" | "MISC_PROJECT";
  projectId: string | null;
  category: ExpenseCategory;
  description: string;
  amountText: string;
  // Receipt is uploaded (or captured via camera) and stored as a URL; we don't allow manual entry.
  receiptUrl: string | null;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function nearlyEqual(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

function quarterIncrementValid(n: number) {
  if (nearlyEqual(n, 0)) return true;
  const q = n * 4;
  return nearlyEqual(q, Math.round(q));
}

function parseNumberText(text: string) {
  // Keep parsing permissive because our inputs are stored as raw text.
  // - Accept commas as decimal separators ("1,5")
  // - Avoid HTML <input type="number"> browser coercion/rounding quirks by parsing ourselves.
  const t = text.trim();
  if (t === "") return 0;
  const normalized = t.replace(/,/g, ".");
  // parseFloat is more forgiving than Number for partial user input like "100.".
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ClientTypeahead(props: {
  clients: Client[];
  valueName: string;
  onSelect: (c: Client) => void;
  placeholder?: string;
  className?: string;
}) {
  const { clients, valueName, onSelect, placeholder, className } = props;

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(valueName);
  const [menuBox, setMenuBox] = React.useState<null | { left: number; top: number; width: number }>(null);

  React.useEffect(() => {
    setQuery(valueName);
  }, [valueName]);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 10);
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [clients, query]);

  const updateMenuBox = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({ left: r.left, top: r.bottom, width: r.width });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updateMenuBox();

    const onScroll = () => updateMenuBox();
    const onResize = () => updateMenuBox();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updateMenuBox]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          // Next tick so layout is stable
          window.setTimeout(() => updateMenuBox(), 0);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        placeholder={placeholder ?? "Search client…"}
        className={"h-10 w-full rounded-md border bg-white px-3 " + (className ?? "border-zinc-300")}
      />

      {open && menuBox
        ? createPortal(
            <div
              style={{ left: menuBox.left, top: menuBox.top + 4, width: menuBox.width, position: "fixed", zIndex: 1000 }}
              className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white shadow"
            >
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function WorklogForm({
  clients,
  projects,
  clientIdsWithRetainer,
  initialDate,
  initialEmail,
}: {
  clients: Client[];
  projects: Project[];
  clientIdsWithRetainer: string[];
  initialDate?: string | null;
  initialEmail?: string | null;
}) {
  const today = React.useMemo(() => todayISODate(), []);

  const cad = React.useMemo(() => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }), []);

  const projectsByClient = React.useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects ?? []) {
      const arr = map.get(p.clientId) ?? [];
      arr.push(p);
      map.set(p.clientId, arr);
    }
    // stable sort
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.code.localeCompare(b.code));
      map.set(k, arr);
    }
    return map;
  }, [projects]);

  const hasRetainerByClientId = React.useMemo(() => {
    return new Set<string>(clientIdsWithRetainer ?? []);
  }, [clientIdsWithRetainer]);

  const normalizedInitialDate = React.useMemo(() => {
    if (!initialDate) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : null;
  }, [initialDate]);

  const email = React.useMemo(() => {
    const t = (initialEmail ?? "").trim().toLowerCase();
    return t;
  }, [initialEmail]);

  const emailOk = React.useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  const [workDate, setWorkDate] = React.useState(() => normalizedInitialDate ?? todayISODate());

  const [submitState, setSubmitState] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [showValidation, setShowValidation] = React.useState(false);

  const [existingWorklog, setExistingWorklog] = React.useState<
    | null
    | {
        exists: boolean;
        status?: "APPROVED" | "PENDING" | "REJECTED";
        submittedAt?: string | null;
      }
  >(null);
  const [, setCheckingExistingWorklog] = React.useState(false);
  const [resubmitReason, setResubmitReason] = React.useState("");

  React.useEffect(() => {
    if (normalizedInitialDate) setWorkDate(normalizedInitialDate);
  }, [normalizedInitialDate]);

  const isFutureDate = React.useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return false;
    return workDate > today;
  }, [workDate, today]);

  React.useEffect(() => {
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(workDate);

    if (!dateOk || !emailOk) {
      setExistingWorklog(null);
      setResubmitReason("");
      return;
    }

    const ctrl = new AbortController();
    setCheckingExistingWorklog(true);

    (async () => {
      try {
        const res = await fetch("/api/worklog/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, workDate }),
          signal: ctrl.signal,
        });

        const data = (await res.json()) as {
          ok?: boolean;
          exists?: boolean;
          status?: "APPROVED" | "PENDING" | "REJECTED";
          submittedAt?: string | null;
        };

        if (!res.ok || data?.ok !== true) {
          setExistingWorklog(null);
          return;
        }

        if (data.exists === true) {
          setExistingWorklog({ exists: true, status: data.status, submittedAt: data.submittedAt ?? null });
        } else {
          setExistingWorklog({ exists: false });
          setResubmitReason("");
        }
      } catch {
        // Ignore background status check errors.
        setExistingWorklog(null);
      } finally {
        setCheckingExistingWorklog(false);
      }
    })();

    return () => ctrl.abort();
  }, [email, emailOk, workDate]);

  // Totals as text so 0 is deletable (no stuck placeholder)
  const [targetHoursText, setTargetHoursText] = React.useState<string>("");
  const [totalKmText, setTotalKmText] = React.useState<string>("");

  const targetHours = React.useMemo(() => parseNumberText(targetHoursText), [targetHoursText]);
  const totalKm = React.useMemo(() => parseNumberText(totalKmText), [totalKmText]);

  const [tasks, setTasks] = React.useState<TaskLine[]>(() => [
    {
      id: uid(),
      clientId: null,
      clientName: "",
      engagementType: "RETAINER",
      projectId: null,
      bucketKey: "",
      hoursText: "",
      notes: "",
    },
  ]);

  const [mileage, setMileage] = React.useState<MileageLine[]>(() => []);

  const [expenses, setExpenses] = React.useState<ExpenseLine[]>(() => []);

  const expenseLineIsActive = React.useCallback((ex: ExpenseLine) => {
    // Treat a line as “in use” if any meaningful field has been touched.
    // This avoids blocking submit when the user clicked “Add expense” but left the row blank.
    return (
      (ex.amountText ?? "").trim() !== "" ||
      (ex.description ?? "").trim() !== "" ||
      (ex.receiptUrl ?? "").trim() !== "" ||
      Boolean(ex.clientId)
    );
  }, []);

  const expenseTotalCad = React.useMemo(() => {
    return expenses.reduce((sum, ex) => {
      const amt = parseNumberText(ex.amountText);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
  }, [expenses]);

  const expensesComplete = React.useMemo(() => {
    return expenses.every((ex) => {
      if (!expenseLineIsActive(ex)) return true;

      const amt = parseNumberText(ex.amountText);
      if (ex.amountText.trim() === "") return false;
      if (!Number.isFinite(amt) || amt <= 0) return false;
      if (!ex.clientId) return false;
      if (ex.engagementType === "MISC_PROJECT" && !ex.projectId) return false;
      if (ex.description.trim().length === 0) return false;
      // Receipt is optional.
      return true;
    });
  }, [expenses, expenseLineIsActive]);

  const taskHoursInvalid = React.useMemo(() => {
    return tasks.map((t) => {
      const n = parseNumberText(t.hoursText);
      if (!Number.isFinite(n)) return true;
      if (nearlyEqual(n, 0)) return false;
      if (n < 0.25) return true;
      if (n > 20) return true;
      if (!quarterIncrementValid(n)) return true;
      return false;
    });
  }, [tasks]);

  const hasTaskHoursViolations = React.useMemo(() => taskHoursInvalid.some(Boolean), [taskHoursInvalid]);

  const allocatedHours = React.useMemo(() => {
    return tasks.reduce((sum, t) => {
      const n = parseNumberText(t.hoursText);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [tasks]);

  const hoursMatch = React.useMemo(() => nearlyEqual(allocatedHours, targetHours), [allocatedHours, targetHours]);

  const hoursCounterClass = React.useMemo(() => {
    // Don't flash red by default; only show red once the user attempts to submit.
    const targetValid = Number.isFinite(targetHours) && targetHours > 0;
    if (!targetValid) return "text-zinc-900";
    if (hoursMatch) return "text-emerald-700";
    return showValidation ? "text-red-700" : "text-zinc-900";
  }, [hoursMatch, showValidation, targetHours]);

  const hasNotesViolations = React.useMemo(() => {
    return tasks.some((t) => {
      const n = parseNumberText(t.hoursText);
      return Number.isFinite(n) && n > 0 && t.notes.trim().length === 0;
    });
  }, [tasks]);

  const hasClientViolations = React.useMemo(() => {
    return tasks.some((t) => {
      const n = parseNumberText(t.hoursText);
      return Number.isFinite(n) && n > 0 && !t.clientId;
    });
  }, [tasks]);

  const hasBucketViolations = React.useMemo(() => {
    return tasks.some((t) => {
      const n = parseNumberText(t.hoursText);
      return Number.isFinite(n) && n > 0 && t.bucketKey.trim().length === 0;
    });
  }, [tasks]);

  const hasTaskEngagementViolations = React.useMemo(() => {
    return tasks.some((t) => {
      const n = parseNumberText(t.hoursText);
      if (!Number.isFinite(n) || n <= 0) return false;
      if (!t.clientId) return false;

      if (t.engagementType === "RETAINER") {
        return !hasRetainerByClientId.has(t.clientId);
      }

      return !t.projectId;
    });
  }, [tasks, hasRetainerByClientId]);

  const allocatedKm = React.useMemo(() => {
    return mileage.reduce((sum, m) => {
      const n = parseNumberText(m.kilometersText);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [mileage]);

  const mileageRequired = totalKm > 0;

  const mileageComplete = React.useMemo(() => {
    if (!mileageRequired) return true;
    if (mileage.length === 0) return false;
    const linesValid = mileage.every((m) => {
      const km = parseNumberText(m.kilometersText);
      if (!Number.isFinite(km)) return false;
      if (km < 0) return false;
      if (km === 0) return true;
      if (!m.clientId) return false;
      if (m.engagementType === "MISC_PROJECT" && !m.projectId) return false;
      return true;
    });
    if (!linesValid) return false;
    return nearlyEqual(allocatedKm, totalKm);
  }, [mileageRequired, mileage, allocatedKm, totalKm]);

  const targetHoursValid = Number.isFinite(targetHours) && targetHours > 0;
  const targetHoursMissing = showValidation && targetHoursText.trim() === "";
  const targetHoursInvalid = showValidation && !targetHoursMissing && !targetHoursValid;

  const canSubmit =
    emailOk &&
    !isFutureDate &&
    targetHoursValid &&
    hoursMatch &&
    !hasTaskHoursViolations &&
    !hasNotesViolations &&
    !hasClientViolations &&
    !hasBucketViolations &&
    !hasTaskEngagementViolations &&
    mileageComplete &&
    expensesComplete;

  const isResubmission = existingWorklog?.exists === true;
  const resubmitReasonOk = !isResubmission || resubmitReason.trim().length > 0;
  const canSubmitWithResubmitRules = canSubmit && resubmitReasonOk;

  return (
    <div className="space-y-6">
      <div className="sticky top-2 z-20 rounded-lg border border-zinc-200 bg-white/95 p-4 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">
              Date
              {workDate === today ? <span className="ml-2 text-xs text-zinc-500">(today)</span> : null}
            </span>
            <input
              type="date"
              value={workDate}
              max={today}
              onChange={(e) => setWorkDate(e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
            {isFutureDate ? <div className="text-xs text-red-700">Future dates aren’t allowed.</div> : null}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Total hours</span>
            <input
              type="number"
              min={0}
              step={0.25}
              value={targetHoursText}
              onChange={(e) => setTargetHoursText(e.target.value)}
              className={"h-10 rounded-md border bg-white px-3 " + (targetHoursMissing || targetHoursInvalid ? "border-red-300" : "border-zinc-300")}
            />
            {targetHoursMissing ? <div className="text-xs text-red-700">Required</div> : null}
            {targetHoursInvalid ? <div className="text-xs text-red-700">Must be &gt; 0</div> : null}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Total km (if applicable)</span>
            <input
              // NOTE: We intentionally use text+inputMode instead of type=number.
              // Some browsers coerce/round number inputs based on step/min, which caused reports like 100 → 99.5.
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={totalKmText}
              onWheel={(e) => {
                // Prevent accidental scroll-wheel changes (common with numeric fields).
                (e.currentTarget as HTMLInputElement).blur();
              }}
              onChange={(e) => {
                const nextText = e.target.value;
                setTotalKmText(nextText);
                const next = parseNumberText(nextText);
                if (Number.isFinite(next) && next <= 0) setMileage([]);
              }}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <div className="grid gap-1">
            <span className="text-sm font-medium">Email</span>
            <div className="flex h-10 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800">
              {emailOk ? email : "(missing email)"}
            </div>
            {showValidation && !emailOk ? <div className="text-xs text-red-700">Email is required (provided by portal/session).</div> : null}
          </div>
        </div>

      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Tasks</h2>
            <span
              className={
                "text-xs font-semibold " +
                (allocatedHours === 0 && targetHours === 0
                  ? "text-zinc-500"
                  : targetHours > 0 && hoursMatch
                    ? "text-emerald-700"
                    : "text-red-700")
              }
            >
              Allocated {allocatedHours.toFixed(2)} / {Number.isFinite(targetHours) ? targetHours.toFixed(2) : "—"} hrs
            </span>
          </div>
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap hover:bg-zinc-50"
            onClick={() =>
              setTasks((prev) => [
                ...prev,
                {
                  id: uid(),
                  clientId: null,
                  clientName: "",
                  engagementType: "RETAINER",
                  projectId: null,
                  bucketKey: "",
                  hoursText: "",
                  notes: "",
                },
              ])
            }
          >
            + Add task
          </button>
        </div>

        <div className="overflow-x-auto pb-1">
          <table className="w-full min-w-[980px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-zinc-600">
                <th className="min-w-[180px] border-b border-zinc-200 px-3 py-2">Client</th>
                <th className="min-w-[220px] border-b border-zinc-200 px-3 py-2">Engagement</th>
                <th className="min-w-[180px] border-b border-zinc-200 px-3 py-2">Task category</th>
                <th className="min-w-[120px] border-b border-zinc-200 px-3 py-2">Hours</th>
                <th className="min-w-[260px] border-b border-zinc-200 px-3 py-2">Notes</th>
                <th className="w-[1%] border-b border-zinc-200 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, idx) => {
                const hoursNum = parseNumberText(t.hoursText);
                const notesRequired = Number.isFinite(hoursNum) && hoursNum > 0;
                const hoursInvalid = taskHoursInvalid[idx] ?? false;
                const clientInvalid = showValidation && notesRequired && !t.clientId;
                const bucketInvalid = showValidation && notesRequired && t.bucketKey.trim().length === 0;
                const engagementInvalid =
                  showValidation &&
                  notesRequired &&
                  !!t.clientId &&
                  ((t.engagementType === "RETAINER" && !hasRetainerByClientId.has(t.clientId)) ||
                    (t.engagementType === "MISC_PROJECT" && !t.projectId));
                const hoursMissing = showValidation && t.hoursText.trim() === "";
                const notesInvalid = showValidation && notesRequired && t.notes.trim().length === 0;

                return (
                  <tr key={t.id} className="align-top">
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <ClientTypeahead
                        clients={clients}
                        valueName={t.clientName}
                        placeholder="Search client…"
                        className={clientInvalid ? "border-red-300" : "border-zinc-300"}
                        onSelect={(c) => {
                          const hasRetainer = hasRetainerByClientId.has(c.id);
                          const openProjects = projectsByClient.get(c.id) ?? [];

                          const engagementType: TaskLine["engagementType"] = hasRetainer
                            ? "RETAINER"
                            : openProjects.length > 0
                              ? "MISC_PROJECT"
                              : "RETAINER";

                          const projectId = engagementType === "MISC_PROJECT" ? openProjects[0]?.id ?? null : null;

                          setTasks((prev) =>
                            prev.map((x) =>
                              x.id === t.id ? { ...x, clientId: c.id, clientName: c.name, engagementType, projectId } : x,
                            ),
                          );
                        }}
                      />
                      {clientInvalid ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
                      {!clientInvalid && !t.clientId ? <div className="mt-1 text-xs text-zinc-500">Choose a client</div> : null}
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <select
                        value={t.engagementType === "RETAINER" ? "RETAINER" : t.projectId ? `PROJECT:${t.projectId}` : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "RETAINER") {
                            setTasks((prev) =>
                              prev.map((x) => (x.id === t.id ? { ...x, engagementType: "RETAINER", projectId: null } : x)),
                            );
                            return;
                          }

                          if (v.startsWith("PROJECT:")) {
                            const pid = v.slice("PROJECT:".length) || null;
                            setTasks((prev) =>
                              prev.map((x) => (x.id === t.id ? { ...x, engagementType: "MISC_PROJECT", projectId: pid } : x)),
                            );
                          }
                        }}
                        disabled={!t.clientId}
                        className={"h-10 w-full rounded-md border bg-white px-3 disabled:bg-zinc-50 " + (engagementInvalid ? "border-red-300" : "border-zinc-300")}
                      >
                        {t.clientId ? (
                          <>
                            {hasRetainerByClientId.has(t.clientId) ? <option value="RETAINER">Retainer</option> : null}
                            {(projectsByClient.get(t.clientId) ?? []).length > 0 ? (
                              <>
                                {hasRetainerByClientId.has(t.clientId) ? (
                                  <option value="" disabled>
                                    Project…
                                  </option>
                                ) : null}
                                {(projectsByClient.get(t.clientId) ?? []).map((p) => (
                                  <option key={p.id} value={`PROJECT:${p.id}`}>
                                    {p.code} ({p.shortCode})
                                  </option>
                                ))}
                              </>
                            ) : null}
                            {!hasRetainerByClientId.has(t.clientId) && (projectsByClient.get(t.clientId) ?? []).length === 0 ? (
                              <option value="" disabled>
                                (No retainer or open projects)
                              </option>
                            ) : null}
                          </>
                        ) : (
                          <option value="" disabled>
                            Select client first
                          </option>
                        )}
                      </select>
                      {engagementInvalid ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
                      {!engagementInvalid ? <div className="mt-1 text-xs text-zinc-500">Choose retainer or a specific open project.</div> : null}
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <select
                        value={t.bucketKey}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, bucketKey: e.target.value } : x)))
                        }
                        className={"h-10 w-full rounded-md border bg-white px-3 " + (bucketInvalid ? "border-red-300" : "border-zinc-300")}
                      >
                        <option value="">(select)</option>
                        {BUCKETS.map((b) => (
                          <option key={b.key} value={b.key}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      {bucketInvalid ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        inputMode="decimal"
                        value={t.hoursText}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, hoursText: e.target.value } : x)))
                        }
                        className={
                          "h-10 w-full min-w-[96px] rounded-md border bg-white px-3 " +
                          (showValidation && (hoursMissing || hoursInvalid) ? "border-red-300" : "border-zinc-300")
                        }
                      />
                      {hoursMissing ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
                      {!hoursMissing && showValidation && hoursInvalid ? <p className="mt-1 text-xs text-red-600">Must be &gt; 0</p> : null}
                      <div className="mt-1 text-xs text-zinc-500">0.25 increments (0.25–20, or 0)</div>
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <textarea
                        value={t.notes}
                        onChange={(e) => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, notes: e.target.value } : x)))}
                        placeholder="What did you work on?"
                        className={
                          "min-h-20 w-full rounded-md border bg-white px-3 py-2 " +
                          (notesInvalid ? "border-red-300" : "border-zinc-300")
                        }
                      />
                      {notesInvalid ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
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

      {/* Sticky hour counter under Tasks (big + obvious) */}
      <div className="sticky top-2 z-10 rounded-lg border border-zinc-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-900">Allocated hours</div>
          <div className={"text-2xl font-bold " + hoursCounterClass}>
            {allocatedHours.toFixed(2)} <span className="text-zinc-400">/</span> {(Number.isFinite(targetHours) ? targetHours : 0).toFixed(2)}
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-600">
          Tip: totals must match exactly before submit unlocks.
        </div>
      </div>

      {mileageRequired ? (
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Mileage allocation</h2>
            <button
              type="button"
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap hover:bg-zinc-50"
              onClick={() =>
                setMileage((prev) => [
                  ...prev,
                  { id: uid(), clientId: null, clientName: "", engagementType: "RETAINER", projectId: null, kilometersText: "" },
                ])
              }
            >
              + Add allocation
            </button>
          </div>

          <div className="overflow-x-auto pb-1">
            <table className="w-full min-w-[760px] border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-zinc-600">
                  <th className="min-w-[180px] border-b border-zinc-200 px-3 py-2">Client</th>
                  <th className="min-w-[240px] border-b border-zinc-200 px-3 py-2">Engagement</th>
                  <th className="min-w-[140px] border-b border-zinc-200 px-3 py-2">Kilometers</th>
                  <th className="w-[1%] border-b border-zinc-200 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {mileage.map((m) => {
                  const km = parseNumberText(m.kilometersText);
                  const kmRequired = mileageRequired;
                  const kmMissing = showValidation && kmRequired && m.kilometersText.trim() === "";
                  const kmInvalid = showValidation && m.kilometersText.trim() !== "" && (!Number.isFinite(km) || km < 0);
                  const clientInvalid = showValidation && kmRequired && !m.clientId;
                  const engagementInvalid =
                    showValidation &&
                    kmRequired &&
                    !!m.clientId &&
                    ((m.engagementType === "RETAINER" && !hasRetainerByClientId.has(m.clientId)) ||
                      (m.engagementType === "MISC_PROJECT" && !m.projectId));

                  return (
                  <tr key={m.id} className="align-top">
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <ClientTypeahead
                        clients={clients}
                        valueName={m.clientName}
                        placeholder="Search client…"
                        className={clientInvalid ? "border-red-300" : "border-zinc-300"}
                        onSelect={(c) => {
                          const hasRetainer = hasRetainerByClientId.has(c.id);
                          const openProjects = projectsByClient.get(c.id) ?? [];

                          const engagementType: MileageLine["engagementType"] = hasRetainer
                            ? "RETAINER"
                            : openProjects.length > 0
                              ? "MISC_PROJECT"
                              : "RETAINER";

                          const projectId = engagementType === "MISC_PROJECT" ? openProjects[0]?.id ?? null : null;

                          setMileage((prev) =>
                            prev.map((x) => (x.id === m.id ? { ...x, clientId: c.id, clientName: c.name, engagementType, projectId } : x)),
                          );
                        }}
                      />
                      {clientInvalid ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <select
                        value={m.engagementType === "RETAINER" ? "RETAINER" : m.projectId ? `PROJECT:${m.projectId}` : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "RETAINER") {
                            setMileage((prev) =>
                              prev.map((x) => (x.id === m.id ? { ...x, engagementType: "RETAINER", projectId: null } : x)),
                            );
                            return;
                          }

                          if (v.startsWith("PROJECT:")) {
                            const pid = v.slice("PROJECT:".length) || null;
                            setMileage((prev) =>
                              prev.map((x) =>
                                x.id === m.id ? { ...x, engagementType: "MISC_PROJECT", projectId: pid } : x,
                              ),
                            );
                          }
                        }}
                        disabled={!m.clientId}
                        className={"h-10 w-full min-w-0 sm:w-72 rounded-md border bg-white px-3 disabled:bg-zinc-50 " + (engagementInvalid ? "border-red-300" : "border-zinc-300")}
                      >
                        {m.clientId ? (
                          <>
                            {hasRetainerByClientId.has(m.clientId) ? <option value="RETAINER">Retainer</option> : null}
                            {(projectsByClient.get(m.clientId) ?? []).length > 0 ? (
                              <>
                                {hasRetainerByClientId.has(m.clientId) ? (
                                  <option value="" disabled>
                                    Project…
                                  </option>
                                ) : null}
                                {(projectsByClient.get(m.clientId) ?? []).map((p) => (
                                  <option key={p.id} value={`PROJECT:${p.id}`}>
                                    {p.code} ({p.shortCode})
                                  </option>
                                ))}
                              </>
                            ) : null}
                            {!hasRetainerByClientId.has(m.clientId) && (projectsByClient.get(m.clientId) ?? []).length === 0 ? (
                              <option value="" disabled>
                                (No retainer or open projects)
                              </option>
                            ) : null}
                          </>
                        ) : (
                          <option value="" disabled>
                            Select client first
                          </option>
                        )}
                      </select>
                      {engagementInvalid ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
                      <div className="mt-1 text-xs text-zinc-500">Choose retainer or a specific project number.</div>
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={m.kilometersText}
                        onWheel={(e) => {
                          (e.currentTarget as HTMLInputElement).blur();
                        }}
                        onChange={(e) =>
                          setMileage((prev) => prev.map((x) => (x.id === m.id ? { ...x, kilometersText: e.target.value } : x)))
                        }
                        className={"h-10 w-full min-w-0 sm:w-40 rounded-md border bg-white px-3 " + (kmMissing || kmInvalid ? "border-red-300" : "border-zinc-300")}
                      />
                      {kmMissing ? <p className="mt-1 text-xs text-red-600">Required</p> : null}
                      {!kmMissing && kmInvalid ? <p className="mt-1 text-xs text-red-600">Must be 0 or more</p> : null}
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
                );})}
              </tbody>
            </table>
          </div>

          {!mileageComplete ? (
            <div className="mt-3 text-sm text-red-700">
              Mileage must be fully allocated to clients, and allocations must add up exactly to the total km.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Expenses (optional)</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span>Add expenses related to this work day. Each expense row requires: client/engagement, description, and amount (CAD). Receipt is optional.</span>
              <span className="font-medium text-zinc-800">Total: {cad.format(expenseTotalCad)}</span>
            </div>
          </div>
          <button
            type="button"
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap hover:bg-zinc-50"
            onClick={() =>
              setExpenses((prev) => [
                ...prev,
                {
                  id: uid(),
                  clientId: null,
                  clientName: "",
                  engagementType: "RETAINER",
                  projectId: null,
                  category: "OTHER",
                  description: "",
                  amountText: "",
                  receiptUrl: null,
                },
              ])
            }
          >
            + Add expense
          </button>
        </div>

        {expenses.length === 0 ? (
          <div className="text-sm text-zinc-600">No expenses.</div>
        ) : (
          <div className="space-y-3">
            {expenses.map((ex, i) => {
              const isActive = expenseLineIsActive(ex);
              const amt = parseNumberText(ex.amountText);
              const amountMissing = isActive && ex.amountText.trim() === "";
              const amountInvalid = ex.amountText.trim() !== "" && (!Number.isFinite(amt) || amt <= 0);

              return (
                <div key={ex.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-900">Expense {i + 1}</div>
                    <button
                      type="button"
                      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
                      onClick={() => setExpenses((prev) => prev.filter((x) => x.id !== ex.id))}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <div className="mb-1 text-xs font-medium text-zinc-600">Client</div>
                      <ClientTypeahead
                        clients={clients}
                        valueName={ex.clientName}
                        placeholder="Search client…"
                        className={showValidation && isActive && !ex.clientId ? "border-red-300" : "border-zinc-300"}
                        onSelect={(c) => {
                          const hasRetainer = hasRetainerByClientId.has(c.id);
                          const openProjects = projectsByClient.get(c.id) ?? [];

                          const engagementType: ExpenseLine["engagementType"] = hasRetainer
                            ? "RETAINER"
                            : openProjects.length > 0
                              ? "MISC_PROJECT"
                              : "RETAINER";

                          const projectId = engagementType === "MISC_PROJECT" ? openProjects[0]?.id ?? null : null;

                          setExpenses((prev) =>
                            prev.map((x) =>
                              x.id === ex.id ? { ...x, clientId: c.id, clientName: c.name, engagementType, projectId } : x,
                            ),
                          );
                        }}
                      />
                      {showValidation && isActive && !ex.clientId ? (
                        <div className="mt-1 text-xs text-red-700">Required</div>
                      ) : null}
                    </div>

                    <div className="md:col-span-4">
                      <div className="mb-1 text-xs font-medium text-zinc-600">Engagement</div>
                      <select
                        value={ex.engagementType === "RETAINER" ? "RETAINER" : ex.projectId ? `PROJECT:${ex.projectId}` : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "RETAINER") {
                            setExpenses((prev) =>
                              prev.map((x) => (x.id === ex.id ? { ...x, engagementType: "RETAINER", projectId: null } : x)),
                            );
                            return;
                          }

                          if (v.startsWith("PROJECT:")) {
                            const pid = v.slice("PROJECT:".length) || null;
                            setExpenses((prev) =>
                              prev.map((x) => (x.id === ex.id ? { ...x, engagementType: "MISC_PROJECT", projectId: pid } : x)),
                            );
                          }
                        }}
                        disabled={!ex.clientId}
                        className={"h-10 w-full rounded-md border bg-white px-3 disabled:bg-zinc-50 " + (showValidation && isActive && ex.engagementType === "MISC_PROJECT" && !ex.projectId ? "border-red-300" : "border-zinc-300")}
                      >
                        {ex.clientId ? (
                          <>
                            {hasRetainerByClientId.has(ex.clientId) ? <option value="RETAINER">Retainer</option> : null}
                            {(projectsByClient.get(ex.clientId) ?? []).length > 0 ? (
                              <>
                                {hasRetainerByClientId.has(ex.clientId) ? (
                                  <option value="" disabled>
                                    Project…
                                  </option>
                                ) : null}
                                {(projectsByClient.get(ex.clientId) ?? []).map((p) => (
                                  <option key={p.id} value={`PROJECT:${p.id}`}>
                                    {p.code} ({p.shortCode})
                                  </option>
                                ))}
                              </>
                            ) : null}
                            {!hasRetainerByClientId.has(ex.clientId) && (projectsByClient.get(ex.clientId) ?? []).length === 0 ? (
                              <option value="" disabled>
                                (No retainer or open projects)
                              </option>
                            ) : null}
                          </>
                        ) : (
                          <option value="" disabled>
                            Select client first
                          </option>
                        )}
                      </select>
                      {showValidation && isActive && ex.engagementType === "MISC_PROJECT" && !ex.projectId ? (
                        <div className="mt-1 text-xs text-red-700">Required</div>
                      ) : null}
                    </div>

                    <div className="md:col-span-4">
                      <div className="mb-1 text-xs font-medium text-zinc-600">Category</div>
                      <select
                        value={ex.category}
                        onChange={(e) =>
                          setExpenses((prev) => prev.map((x) => (x.id === ex.id ? { ...x, category: e.target.value as any } : x)))
                        }
                        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3"
                      >
                        <ExpenseCategorySelectOptions />
                      </select>
                    </div>

                    <div className="md:col-span-6">
                      <div className="mb-1 text-xs font-medium text-zinc-600">Description</div>
                      <input
                        value={ex.description}
                        onChange={(e) =>
                          setExpenses((prev) => prev.map((x) => (x.id === ex.id ? { ...x, description: e.target.value } : x)))
                        }
                        className={
                          "h-10 w-full rounded-md border bg-white px-3 " +
                          (showValidation && isActive && ex.description.trim().length === 0 ? "border-red-300" : "border-zinc-300")
                        }
                        placeholder="What was this for?"
                      />
                      {showValidation && isActive && ex.description.trim().length === 0 ? <div className="mt-1 text-xs text-red-700">Required</div> : null}
                    </div>

                    <div className="md:col-span-2">
                      <div className="mb-1 text-xs font-medium text-zinc-600">Amount (CAD)</div>
                      <input
                        inputMode="decimal"
                        value={ex.amountText}
                        onChange={(e) =>
                          setExpenses((prev) => prev.map((x) => (x.id === ex.id ? { ...x, amountText: e.target.value } : x)))
                        }
                        className={
                          "h-10 w-full rounded-md border bg-white px-3 " +
                          (amountInvalid || (showValidation && amountMissing) ? "border-red-300" : "border-zinc-300")
                        }
                        placeholder="0.00"
                      />
                      {showValidation && amountMissing ? <div className="mt-1 text-xs text-red-700">Amount is required.</div> : null}
                      {showValidation && !amountMissing && amountInvalid ? (
                        <div className="mt-1 text-xs text-red-700">Amount must be a number greater than 0.</div>
                      ) : null}
                    </div>

                    <div className="md:col-span-4">
                      <div className="mb-1 text-xs font-medium text-zinc-600">Receipt</div>
                      <div>
                        {!ex.clientId ? <div className="mb-2 text-xs text-zinc-600">Select a client to upload a receipt.</div> : null}
                        <div className={!ex.clientId ? "pointer-events-none opacity-50" : ""}>
                          <ReceiptUploader
                            clientId={ex.clientId ?? undefined}
                            expenseEntryId={ex.id}
                            initialUrl={ex.receiptUrl ?? null}
                            capture
                            variant="inline"
                            onUploaded={(url) =>
                              setExpenses((prev) => prev.map((x) => (x.id === ex.id ? { ...x, receiptUrl: url } : x)))
                            }
                            onRemoved={() =>
                              setExpenses((prev) => prev.map((x) => (x.id === ex.id ? { ...x, receiptUrl: null } : x)))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isResubmission ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="font-semibold">Resubmission (admin approval required)</div>
          <div className="mt-1 text-amber-900">
            A worklog already exists for <span className="font-medium">{workDate}</span>
            {existingWorklog?.status ? (
              <>
                {" "}
                (current status: <span className="font-medium">{existingWorklog.status}</span>)
              </>
            ) : null}
            . Submitting again will replace the existing worklog and will require admin review.
          </div>

          <label className="mt-3 grid gap-1">
            <span className="text-sm font-medium">Resubmission reason (required)</span>
            <textarea
              value={resubmitReason}
              onChange={(e) => setResubmitReason(e.target.value)}
              className="min-h-20 rounded-md border border-amber-300 bg-white px-3 py-2"
              placeholder="What changed, and why are you resubmitting?"
            />
            {!resubmitReasonOk ? <span className="text-xs text-red-700">A reason is required to resubmit.</span> : null}
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {submitState ? (
          <div
            className={
              "rounded-md px-3 py-2 text-sm " +
              (submitState.ok
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-red-200 bg-red-50 text-red-900")
            }
          >
            {submitState.message}
          </div>
        ) : null}

        <button
          type="button"
          disabled={submitting}
          className={
            "h-10 rounded-md px-4 text-sm font-semibold text-white " +
            (submitting ? "bg-zinc-300" : "bg-[#2EA3F2] hover:opacity-90")
          }
          title={
            canSubmitWithResubmitRules
              ? isResubmission
                ? "Ready to resubmit (admin approval required)"
                : "Ready to submit"
              : "Click to see what needs fixing"
          }
          onClick={async () => {
            setShowValidation(true);
            setSubmitState(null);

            if (!canSubmitWithResubmitRules) {
              return;
            }

            setSubmitting(true);

            if (!emailOk) {
              setSubmitState({ ok: false, message: "Missing email (must be provided by portal/session)." });
              setSubmitting(false);
              return;
            }

            if (isFutureDate) {
              setSubmitState({ ok: false, message: "Future dates aren’t allowed." });
              setSubmitting(false);
              return;
            }

            const safeTargetHours = Number.isFinite(targetHours) ? targetHours : 0;
            const safeTotalKm = Number.isFinite(totalKm) ? totalKm : 0;

            const basePayload = {
              email,
              workDate,
              targetHours: safeTargetHours,
              totalKm: safeTotalKm,
              tasks: tasks.map((t) => {
                const bucket = BUCKETS.find((b) => b.key === t.bucketKey);
                return {
                  clientId: t.clientId,
                  engagementType: t.engagementType,
                  projectId: t.projectId,
                  bucketKey: t.bucketKey,
                  bucketName: bucket?.name ?? t.bucketKey,
                  hours: parseNumberText(t.hoursText),
                  notes: t.notes,
                };
              }),
              mileage: mileage.map((m) => ({
                clientId: m.clientId,
                engagementType: m.engagementType,
                projectId: m.projectId,
                kilometers: parseNumberText(m.kilometersText),
              })),
              expenses: expenses.map((ex) => ({
                clientId: ex.clientId,
                engagementType: ex.engagementType,
                projectId: ex.projectId,
                category: ex.category,
                description: ex.description,
                amount: ex.amountText,
                receiptUrl: ex.receiptUrl,
              })),
            };

            // If a worklog already exists for this date, we treat this as a resubmission.
            // Resubmissions always require admin approval and a reason.
            let shouldResubmit = existingWorklog?.exists === true;

            // Safety net: if we don't know yet, re-check right before submit.
            if (existingWorklog === null) {
              try {
                const res = await fetch("/api/worklog/status", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ email, workDate }),
                });
                const data = (await res.json()) as { ok?: boolean; exists?: boolean };
                if (res.ok && data?.ok === true && data.exists === true) shouldResubmit = true;
              } catch {
                // If the status check fails, fall back to normal submit.
              }
            }

            const url = shouldResubmit ? "/api/worklog/resubmit" : "/api/worklog/submit";

            let payload: unknown = basePayload;
            if (shouldResubmit) {
              const reason = resubmitReason.trim();
              if (!reason) {
                setSubmitState({ ok: false, message: "Resubmission requires a reason." });
                setSubmitting(false);
                return;
              }

              payload = { ...(basePayload as object), reason };
            }

            try {
              const res = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              });
              const data = (await res.json()) as { ok?: boolean; message?: string; details?: unknown };

              if (!res.ok || data.ok !== true) {
                const detailsError =
                  data.details && typeof data.details === "object" && data.details !== null && "error" in data.details
                    ? String((data.details as any).error)
                    : null;

                const msg =
                  data.message && typeof data.message === "string"
                    ? data.message
                    : detailsError
                      ? detailsError
                      : "Submit failed.";

                setSubmitState({ ok: false, message: msg });
              } else {
                setSubmitState({ ok: true, message: data.message ?? "Submitted." });
              }
            } catch {
              setSubmitState({ ok: false, message: "Network error submitting worklog." });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Submitting…" : isResubmission ? "Resubmit worklog" : "Submit worklog"}
        </button>
      </div>
    </div>
  );
}
