"use client";

import * as React from "react";

type TabKey = "specs" | "expenses" | "worklog" | "analytics";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "specs", label: "Specs" },
  { key: "expenses", label: "Expenses" },
  { key: "worklog", label: "Worklog" },
  { key: "analytics", label: "Analytics" },
];

export function ProjectDashboardClient({ initialTab }: { initialTab: TabKey }) {
  const [tab, setTab] = React.useState<TabKey>(initialTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              "h-9 rounded-md px-3 text-sm font-semibold " +
              (tab === t.key ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        {tab === "specs" ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Specs</div>
            <div className="text-sm text-zinc-600">Placeholder for project scope, deliverables, and key dates.</div>
          </div>
        ) : null}

        {tab === "expenses" ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Expenses</div>
            <div className="text-sm text-zinc-600">Placeholder for project expenses (manual + receipts).</div>
          </div>
        ) : null}

        {tab === "worklog" ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Worklog</div>
            <div className="text-sm text-zinc-600">Placeholder for project time entries and burn-down.</div>
          </div>
        ) : null}

        {tab === "analytics" ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Analytics</div>
            <div className="text-sm text-zinc-600">Placeholder for project analytics.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
