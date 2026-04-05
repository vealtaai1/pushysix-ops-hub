"use client";

import * as React from "react";

type PendingRow = {
  id: string;
  createdAt: string;
  type: string;
  reason: string;
  workDate: string | null;
  requestedByUser: { email: string; name: string | null };
  worklog: null | { id: string; workDate: string; status: string; approvalReason: string | null; submittedAt: string | null };
  dayOff: null | { id: string; dayDate: string; status: string; approvalReason: string | null; submittedAt: string | null };
  payload: any | null;
};

function fmtDateTimeISO(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Edmonton",
  }).format(d);
}

export function ApprovalsClient({ initialPending }: { initialPending: PendingRow[] }) {
  const [rows, setRows] = React.useState<PendingRow[]>(initialPending);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [toast, setToast] = React.useState<null | { text: string; undoId: string }>(null);

  const [submissionOpen, setSubmissionOpen] = React.useState(false);
  const [submissionLoading, setSubmissionLoading] = React.useState(false);
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);
  const [submission, setSubmission] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!submissionOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSubmissionOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submissionOpen]);

  async function loadSubmission(id: string) {
    setSubmissionOpen(true);
    setSubmissionLoading(true);
    setSubmissionError(null);
    setSubmission(null);
    try {
      const res = await fetch(`/api/admin/approvals/submission?id=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Failed to load submission (${res.status})`);
      setSubmission(json.submission);
    } catch (e) {
      setSubmissionError(e instanceof Error ? e.message : "Failed to load submission");
    } finally {
      setSubmissionLoading(false);
    }
  }

  async function parseJsonOrText(res: Response): Promise<{ json: any | null; text: string | null }> {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const json = (await res.json().catch(() => null)) as any;
      return { json, text: null };
    }
    const text = await res.text().catch(() => null);
    return { json: null, text };
  }

  function handleAuthError(res: Response) {
    if (res.status !== 401 && res.status !== 403) return false;
    // Session expired or role changed. Send user to login.
    const callbackUrl = window.location.pathname + window.location.search;
    window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    return true;
  }

  async function approve(id: string, note: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/approvals/approve", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, note }),
      });

      if (handleAuthError(res)) return;

      const { json, text } = await parseJsonOrText(res);
      if (!res.ok || !json?.ok) {
        const extra = text ? `\n\n${text.slice(0, 300)}` : "";
        throw new Error(json?.message ?? `Approve failed (${res.status})${extra}`);
      }

      const removed = rows.find((r) => r.id === id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setToast({ text: `Approved ${removed?.requestedByUser.email ?? "request"}. Undo?`, undoId: id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string, note: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/approvals/reject", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, note }),
      });

      if (handleAuthError(res)) return;

      const { json, text } = await parseJsonOrText(res);
      if (!res.ok || !json?.ok) {
        const extra = text ? `\n\n${text.slice(0, 300)}` : "";
        throw new Error(json?.message ?? `Reject failed (${res.status})${extra}`);
      }

      const removed = rows.find((r) => r.id === id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setToast({ text: `Rejected ${removed?.requestedByUser.email ?? "request"}. Undo?`, undoId: id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  async function undo(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/approvals/undo", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? `Undo failed (${res.status})`);

      // easiest: reload the page data by hard refresh
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Undo failed");
    } finally {
      setBusyId(null);
      setToast(null);
    }
  }

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-medium">{toast.text}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => undo(toast.undoId)}
              className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              disabled={busyId === toast.undoId}
            >
              {busyId === toast.undoId ? "Undoing…" : "Undo"}
            </button>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="h-9 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {submissionOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setSubmissionOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">Submission details</div>
                {submission?.requestedByUser?.email ? (
                  <div className="mt-0.5 text-sm text-zinc-600 truncate">{submission.requestedByUser.email}</div>
                ) : null}
              </div>
              <button
                type="button"
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm hover:bg-zinc-50"
                onClick={() => setSubmissionOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-auto">
              {submissionLoading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
              {submissionError ? <div className="text-sm text-red-700">{submissionError}</div> : null}

              {submission?.worklog ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-sm font-semibold">Worklog</div>
                    <div className="mt-1 text-sm text-zinc-700">
                      Date: <span className="font-medium">{fmtDateTimeISO(submission.worklog.workDate).slice(0, 10)}</span>
                      {submission.worklog.submittedAt ? (
                        <span className="text-zinc-500"> · submitted {fmtDateTimeISO(submission.worklog.submittedAt)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-sm font-semibold">Entries</div>
                    {(submission.worklog.entries ?? []).length === 0 ? (
                      <div className="mt-2 text-sm text-zinc-600">No entries.</div>
                    ) : (
                      <div className="mt-2 overflow-x-hidden">
                        <table className="w-full table-fixed border-separate border-spacing-0">
                          <thead>
                            <tr className="text-left text-xs text-zinc-600">
                              <th className="border-b border-zinc-200 px-2 py-1.5">Client</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Category</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Hours</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(submission.worklog.entries ?? []).map((e: any) => (
                              <tr key={e.id} className="text-sm align-top">
                                <td className="border-b border-zinc-100 px-2 py-1.5">{e.client?.name ?? "—"}</td>
                                <td className="border-b border-zinc-100 px-2 py-1.5">{e.bucketName ?? e.bucketKey ?? "—"}</td>
                                <td className="border-b border-zinc-100 px-2 py-1.5">{(Number(e.minutes ?? 0) / 60).toFixed(2)}h</td>
                                <td className="border-b border-zinc-100 px-2 py-1.5 text-zinc-700">{e.notes ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-sm font-semibold">Mileage</div>
                    {(submission.worklog.mileage ?? []).length === 0 ? (
                      <div className="mt-2 text-sm text-zinc-600">No mileage entries.</div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {(submission.worklog.mileage ?? []).map((m: any) => (
                          <div key={m.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                            <div>
                              <span className="font-medium">{m.kilometers} km</span>
                              {m.client?.name ? <span className="text-zinc-600"> · {m.client.name}</span> : null}
                            </div>
                            {m.notes ? <div className="text-zinc-700">{m.notes}</div> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-sm font-semibold">Expenses</div>
                    {(submission.worklog.expenseEntries ?? []).length === 0 ? (
                      <div className="mt-2 text-sm text-zinc-600">No expenses.</div>
                    ) : (
                      <div className="mt-2 overflow-x-hidden">
                        <table className="w-full table-fixed border-separate border-spacing-0">
                          <thead>
                            <tr className="text-left text-xs text-zinc-600">
                              <th className="border-b border-zinc-200 px-2 py-1.5">Client</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Vendor</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Description</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Amount</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Receipt</th>
                              <th className="border-b border-zinc-200 px-2 py-1.5">Reimburse</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(submission.worklog.expenseEntries ?? []).map((ex: any) => (
                              <tr key={ex.id} className="text-sm align-top">
                                <td className="border-b border-zinc-100 px-2 py-1.5">{ex.client?.name ?? "—"}</td>
                                <td className="border-b border-zinc-100 px-2 py-1.5">{ex.vendor ?? "—"}</td>
                                <td className="border-b border-zinc-100 px-2 py-1.5">{ex.description ?? "—"}</td>
                                <td className="border-b border-zinc-100 px-2 py-1.5">{((Number(ex.amountCents ?? 0) / 100) || 0).toFixed(2)} {ex.currency ?? "CAD"}</td>
                                <td className="border-b border-zinc-100 px-2 py-1.5">
                                  {ex.receiptUrl ? (
                                    <a className="text-blue-700 underline" href={ex.receiptUrl} target="_blank" rel="noreferrer">
                                      receipt
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="border-b border-zinc-100 px-2 py-1.5">{ex.reimburseToEmployee ? "Yes" : "No"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {submission?.dayOff ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-sm font-semibold">Day off request</div>
                    <div className="mt-1 text-sm text-zinc-700">
                      Date: <span className="font-medium">{fmtDateTimeISO(submission.dayOff.dayDate).slice(0, 10)}</span>
                      {submission.dayOff.submittedAt ? (
                        <span className="text-zinc-500"> · submitted {fmtDateTimeISO(submission.dayOff.submittedAt)}</span>
                      ) : null}
                    </div>
                    {submission.dayOff.requestReason ? <div className="mt-2 text-sm text-zinc-700">Reason: {submission.dayOff.requestReason}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">No pending approvals.</div>
      ) : (
        <div className="overflow-x-hidden rounded-lg border border-zinc-200">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs font-medium text-zinc-600">
                <th className="border-b border-zinc-200 px-3 py-2.5">Created</th>
                <th className="border-b border-zinc-200 px-3 py-2.5">Type</th>
                <th className="border-b border-zinc-200 px-3 py-2.5">User</th>
                <th className="border-b border-zinc-200 px-3 py-2.5">Date</th>
                <th className="border-b border-zinc-200 px-3 py-2.5">Reason</th>
                <th className="border-b border-zinc-200 px-3 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const dateISO = p.worklog?.workDate ?? p.dayOff?.dayDate ?? p.workDate;
                const dateShort = dateISO ? fmtDateTimeISO(dateISO).slice(0, 10) : "—";

                return (
                  <tr key={p.id} className="align-top hover:bg-zinc-50/60">
                    <td className="border-b border-zinc-100 px-3 py-3 text-xs text-zinc-600 whitespace-nowrap">{fmtDateTimeISO(p.createdAt)}</td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm font-medium text-zinc-900 whitespace-nowrap">{p.type}</td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      <div className="font-medium text-zinc-900">{p.requestedByUser.name ?? "(no name)"}</div>
                      <div className="text-xs text-zinc-600">{p.requestedByUser.email}</div>
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700 whitespace-nowrap">{dateShort}</td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      <div className="whitespace-pre-wrap">{p.reason}</div>
                      <div className="mt-1 text-xs text-zinc-500">Request ID: {p.id}</div>
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3">
                      <div className="flex items-center justify-between gap-2 pb-2">
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                          onClick={() => loadSubmission(p.id)}
                          disabled={busyId === p.id}
                          aria-label="View submission"
                          title="View submission"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                            <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                          </svg>
                          <span>View</span>
                        </button>
                        <div className="text-xs text-zinc-500">{busyId === p.id ? "Working…" : null}</div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            name={`note-${p.id}`}
                            placeholder="Note (optional)"
                            className="h-9 w-full min-w-0 max-w-[14rem] rounded-md border border-zinc-300 bg-white px-3 text-sm"
                            disabled={busyId === p.id}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            id={`approve-note-${p.id}`}
                          />
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            className="h-9 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            onClick={() => {
                              const el = document.getElementById(`approve-note-${p.id}`) as HTMLInputElement | null;
                              approve(p.id, el?.value ?? "");
                            }}
                          >
                            {busyId === p.id ? "Working…" : "Approve"}
                          </button>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            name={`reject-${p.id}`}
                            placeholder="Rejection reason (required)"
                            className="h-9 w-full min-w-0 max-w-[14rem] rounded-md border border-zinc-300 bg-white px-3 text-sm"
                            disabled={busyId === p.id}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            id={`reject-note-${p.id}`}
                          />
                          <button
                            type="button"
                            disabled={busyId === p.id}
                            className="h-9 rounded-md bg-red-600 px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            onClick={() => {
                              const el = document.getElementById(`reject-note-${p.id}`) as HTMLInputElement | null;
                              const note = (el?.value ?? "").trim();
                              if (!note) {
                                alert("Rejection reason is required");
                                return;
                              }
                              reject(p.id, note);
                            }}
                          >
                            {busyId === p.id ? "Working…" : "Reject"}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
