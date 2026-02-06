"use client";

import * as React from "react";
import { BUCKETS } from "@/lib/buckets";

type Client = { id: string; name: string };

type TaskLine = {
  id: string;
  clientId: string | null;
  clientName: string;
  bucketKey: string;
  hoursText: string; // kept as text so the field can be cleared
  notes: string;
};

type MileageLine = {
  id: string;
  clientId: string | null;
  clientName: string;
  kilometersText: string; // kept as text so the field can be cleared
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
  const t = text.trim();
  if (t === "") return 0;
  const n = Number(t);
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
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
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

export function WorklogForm({
  clients,
  initialDate,
  initialEmail,
}: {
  clients: Client[];
  initialDate?: string | null;
  initialEmail?: string | null;
}) {
  const today = React.useMemo(() => todayISODate(), []);

  const normalizedInitial = React.useMemo(() => {
    if (!initialDate) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : null;
  }, [initialDate]);

  const [workDate, setWorkDate] = React.useState(() => normalizedInitial ?? todayISODate());

  const [email, setEmail] = React.useState<string>(initialEmail?.trim().toLowerCase() ?? "");
  const [submitState, setSubmitState] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [existingWorklog, setExistingWorklog] = React.useState<
    | null
    | {
        exists: boolean;
        status?: "APPROVED" | "PENDING" | "REJECTED";
        submittedAt?: string | null;
      }
  >(null);
  const [checkingExistingWorklog, setCheckingExistingWorklog] = React.useState(false);
  const [resubmitReason, setResubmitReason] = React.useState("");

  React.useEffect(() => {
    // Keep portal + worklog email aligned for "view as" workflows.
    if (initialEmail && typeof initialEmail === "string") {
      try {
        window.localStorage.setItem("opsHubEmail", initialEmail.trim().toLowerCase());
      } catch {
        // ignore
      }
    }
  }, [initialEmail]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem("opsHubEmail", email);
    } catch {
      // ignore
    }
  }, [email]);

  React.useEffect(() => {
    if (normalizedInitial) setWorkDate(normalizedInitial);
  }, [normalizedInitial]);

  React.useEffect(() => {
    const trimmedEmail = email.trim().toLowerCase();
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(workDate);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

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
          body: JSON.stringify({ email: trimmedEmail, workDate }),
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
  }, [email, workDate]);

  // Totals as text so 0 is deletable (no stuck placeholder)
  const [targetHoursText, setTargetHoursText] = React.useState<string>("0");
  const [totalKmText, setTotalKmText] = React.useState<string>("0");

  const targetHours = React.useMemo(() => parseNumberText(targetHoursText), [targetHoursText]);
  const totalKm = React.useMemo(() => parseNumberText(totalKmText), [totalKmText]);

  const [tasks, setTasks] = React.useState<TaskLine[]>(() => [
    {
      id: uid(),
      clientId: null,
      clientName: "",
      bucketKey: "",
      hoursText: "0",
      notes: "",
    },
  ]);

  const [mileage, setMileage] = React.useState<MileageLine[]>(() => []);

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
      return (km > 0 ? Boolean(m.clientId) : true) && km >= 0;
    });
    if (!linesValid) return false;
    return nearlyEqual(allocatedKm, totalKm);
  }, [mileageRequired, mileage, allocatedKm, totalKm]);

  const targetHoursValid = Number.isFinite(targetHours) && targetHours > 0;

  const canSubmit =
    targetHoursValid &&
    hoursMatch &&
    !hasTaskHoursViolations &&
    !hasNotesViolations &&
    !hasClientViolations &&
    !hasBucketViolations &&
    mileageComplete;

  const isResubmission = existingWorklog?.exists === true;
  const resubmitReasonOk = !isResubmission || resubmitReason.trim().length > 0;
  const canSubmitWithResubmitRules = canSubmit && resubmitReasonOk;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@pushysix.com"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">
              Date
              {workDate === today ? <span className="ml-2 text-xs text-zinc-500">(today)</span> : null}
            </span>
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
              value={targetHoursText}
              onChange={(e) => setTargetHoursText(e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Total km (optional)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={totalKmText}
              onChange={(e) => {
                const nextText = e.target.value;
                setTotalKmText(nextText);
                const next = parseNumberText(nextText);
                if (Number.isFinite(next) && next <= 0) setMileage([]);
              }}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <div>
            <span className="text-zinc-600">Allocated hours:</span>{" "}
            <span className={hoursMatch ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
              {allocatedHours.toFixed(2)} / {(Number.isFinite(targetHours) ? targetHours : 0).toFixed(2)}
            </span>
          </div>
          {hasTaskHoursViolations ? (
            <div className="text-red-700">Task hours must be 0 or 0.25–20.00 in 0.25 increments.</div>
          ) : null}
          {!targetHoursValid ? <div className="text-red-700">Total hours must be greater than 0.</div> : null}
          {hasClientViolations ? <div className="text-red-700">Client is required for any task with hours &gt; 0.</div> : null}
          {hasBucketViolations ? <div className="text-red-700">Task category is required for any task with hours &gt; 0.</div> : null}
          {hasNotesViolations ? <div className="text-red-700">Notes are required for any task with hours &gt; 0.</div> : null}
          {mileageRequired ? (
            <div>
              <span className="text-zinc-600">Mileage allocated:</span>{" "}
              <span className={mileageComplete ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                {allocatedKm.toFixed(1)} / {(Number.isFinite(totalKm) ? totalKm : 0).toFixed(1)} km
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
                { id: uid(), clientId: null, clientName: "", bucketKey: "", hoursText: "0", notes: "" },
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
                const hoursNum = parseNumberText(t.hoursText);
                const notesRequired = Number.isFinite(hoursNum) && hoursNum > 0;
                const hoursInvalid = taskHoursInvalid[idx] ?? false;

                return (
                  <tr key={t.id} className="align-top">
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <ClientTypeahead
                        clients={clients}
                        valueName={t.clientName}
                        placeholder="Search client…"
                        onSelect={(c) =>
                          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, clientId: c.id, clientName: c.name } : x)))
                        }
                      />
                      {t.clientId ? null : <div className="mt-1 text-xs text-zinc-500">Choose a client</div>}
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <select
                        value={t.bucketKey}
                        onChange={(e) =>
                          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, bucketKey: e.target.value } : x)))
                        }
                        className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3"
                      >
                        <option value="">(select)</option>
                        {BUCKETS.map((b) => (
                          <option key={b.key} value={b.key}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        inputMode="decimal"
                        value={t.hoursText}
                        onChange={(e) => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, hoursText: e.target.value } : x)))}
                        className={"h-10 w-32 rounded-md border bg-white px-3 " + (hoursInvalid ? "border-red-300" : "border-zinc-300")}
                      />
                      <div className="mt-1 text-xs text-zinc-500">0.25 increments (0.25–20, or 0)</div>
                    </td>

                    <td className="border-b border-zinc-100 px-3 py-2">
                      <textarea
                        value={t.notes}
                        onChange={(e) => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, notes: e.target.value } : x)))}
                        placeholder="What did you work on?"
                        className={
                          "min-h-20 w-full rounded-md border bg-white px-3 py-2 " +
                          (notesRequired && t.notes.trim().length === 0 ? "border-red-300" : "border-zinc-300")
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
              onClick={() => setMileage((prev) => [...prev, { id: uid(), clientId: null, clientName: "", kilometersText: "0" }])}
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
                        onSelect={(c) => setMileage((prev) => prev.map((x) => (x.id === m.id ? { ...x, clientId: c.id, clientName: c.name } : x)))}
                      />
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={m.kilometersText}
                        onChange={(e) => setMileage((prev) => prev.map((x) => (x.id === m.id ? { ...x, kilometersText: e.target.value } : x)))}
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
              Mileage must be fully allocated to clients, and allocations must add up exactly to the total km.
            </div>
          ) : null}
        </div>
      ) : null}

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
              (submitState.ok ? "border border-emerald-200 bg-emerald-50 text-emerald-900" : "border border-red-200 bg-red-50 text-red-900")
            }
          >
            {submitState.message}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canSubmitWithResubmitRules || submitting || email.trim().length === 0}
          className={
            "h-10 rounded-md px-4 text-sm font-semibold text-white " +
            (!canSubmitWithResubmitRules || submitting || email.trim().length === 0 ? "bg-zinc-300" : "bg-[#2EA3F2] hover:opacity-90")
          }
          title={
            email.trim().length === 0
              ? "Email is required"
              : !resubmitReasonOk
                ? "Resubmission reason is required"
                : canSubmit
                  ? isResubmission
                    ? "Ready to resubmit (admin approval required)"
                    : "Ready to submit"
                  : "Hours must match target exactly; task hour values must be valid; client + notes required for non-zero hours; and mileage must be allocated if entered"
          }
          onClick={async () => {
            setSubmitting(true);
            setSubmitState(null);

            const trimmedEmail = email.trim().toLowerCase();

            const basePayload = {
              email: trimmedEmail,
              workDate,
              targetHours,
              totalKm,
              tasks: tasks.map((t) => {
                const bucket = BUCKETS.find((b) => b.key === t.bucketKey);
                return {
                  clientId: t.clientId,
                  bucketKey: t.bucketKey,
                  bucketName: bucket?.name ?? t.bucketKey,
                  hours: parseNumberText(t.hoursText),
                  notes: t.notes,
                };
              }),
              mileage: mileage.map((m) => ({
                clientId: m.clientId,
                kilometers: parseNumberText(m.kilometersText),
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
                  body: JSON.stringify({ email: trimmedEmail, workDate }),
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
              const data = (await res.json()) as { ok: boolean; message?: string };
              if (!res.ok || !data.ok) {
                setSubmitState({ ok: false, message: data.message ?? "Submit failed." });
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
