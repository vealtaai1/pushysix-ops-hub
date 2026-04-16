import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AddRetainerClient } from "./AddRetainerClient";
import { ClearRetainerClient } from "./ClearRetainerClient";
import { RetainerFeeEditorClient } from "./RetainerFeeEditorClient";
import { RetainerSettingsEditorClient } from "./RetainerSettingsEditorClient";

type RetainersSectionProps = {
  client: {
    id: string;
    name: string;
    billingCycleStartDay: "FIRST" | "FIFTEENTH";
    monthlyRetainerHours: number;
    monthlyRetainerFeeCents: number | null;
    monthlyRetainerFeeCurrency: string;
    monthlyRetainerSpendCents: number | null;
    maxShootsPerCycle: number | null;
    maxCaptureHoursPerCycle: number | null;
  };
  quotaItems: Array<{
    id: string;
    name: string;
    usageMode: "PER_DAY" | "PER_HOUR";
    limitPerCycleDays: number;
    limitPerCycleMinutes: number;
  }>;
};

function formatUsageMode(mode: "PER_DAY" | "PER_HOUR"): string {
  return mode === "PER_DAY" ? "per day" : "per hour";
}

function fmtMoneyFromCents(cents: number | null, currency: string): string {
  if (cents == null) return "—";
  if (!Number.isFinite(cents)) return "—";
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency || "CAD"}`;
  }
}

export async function RetainersSection({ client, quotaItems }: RetainersSectionProps) {
  const session = await auth();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";

  const hasAny =
    client.monthlyRetainerHours > 0 ||
    client.maxShootsPerCycle !== null ||
    client.maxCaptureHoursPerCycle !== null ||
    quotaItems.length > 0;

  const canAddInitialRetainer = isAdmin && !hasAny;

  const now = new Date();
  const currentCycle = hasAny
    ? await prisma.retainerCycle.findFirst({
        where: {
          clientId: client.id,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: [{ startDate: "desc" }],
        select: { id: true },
      })
    : null;

  const adSpendQuoteCents = currentCycle
    ? (
        await prisma.retainerAdSpendItem.aggregate({
          where: { retainerCycleId: currentCycle.id },
          _sum: { quotaCents: true },
        })
      )._sum.quotaCents ?? 0
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Retainer</h2>
        <div className="flex items-center gap-2">
          {canAddInitialRetainer ? <AddRetainerClient clientId={client.id} clientName={client.name} /> : null}

          {isAdmin && hasAny ? <ClearRetainerClient clientId={client.id} /> : null}

          {isAdmin && hasAny ? (
            <>
              <Link
                href={`/admin/retainers?clientId=${encodeURIComponent(client.id)}`}
                className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Retainer log
              </Link>
              <Link
                href={`/admin/finance?clientId=${encodeURIComponent(client.id)}&engagementType=RETAINER`}
                className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Retainer finance
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200">
        {!hasAny ? (
          <div className="px-4 py-10 text-sm text-zinc-500">No retainer configuration yet.</div>
        ) : (
          <div className="divide-y divide-zinc-200">
            <div className="grid grid-cols-12 gap-2 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600">
              <div className="col-span-6">Item</div>
              <div className="col-span-3">Limit</div>
              <div className="col-span-3">Notes</div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
              <div className="col-span-6 font-medium">Base retainer</div>
              <div className="col-span-3">{client.monthlyRetainerHours}h / cycle</div>
              <div className="col-span-3 flex items-center justify-between gap-2 text-zinc-600">
                <span>Cycle start: {client.billingCycleStartDay.toLowerCase()}</span>
                {isAdmin ? (
                  <RetainerSettingsEditorClient
                    clientId={client.id}
                    initial={{
                      billingCycleStartDay: client.billingCycleStartDay,
                      monthlyRetainerHours: client.monthlyRetainerHours,
                      monthlyRetainerFeeCents: client.monthlyRetainerFeeCents,
                      maxShootsPerCycle: client.maxShootsPerCycle,
                      maxCaptureHoursPerCycle: client.maxCaptureHoursPerCycle,
                    }}
                  />
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-t border-zinc-200">
              <div className="col-span-6 font-medium">Monthly retainer spend (total)</div>
              <div className="col-span-3 whitespace-nowrap">{fmtMoneyFromCents(client.monthlyRetainerSpendCents, client.monthlyRetainerFeeCurrency)}</div>
              <div className="col-span-3">
                {isAdmin ? (
                  <RetainerFeeEditorClient
                    clientId={client.id}
                    initialFeeCents={client.monthlyRetainerFeeCents}
                    initialSpendCents={client.monthlyRetainerSpendCents}
                    currency={client.monthlyRetainerFeeCurrency}
                  />
                ) : (
                  <span className="text-zinc-600">Admin-only</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-t border-zinc-200">
              <div className="col-span-6 font-medium">Monthly retainer fee</div>
              <div className="col-span-3 whitespace-nowrap">{fmtMoneyFromCents(client.monthlyRetainerFeeCents, client.monthlyRetainerFeeCurrency)}</div>
              <div className="col-span-3 text-zinc-600">Shown on finance vs total cycle cost</div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-t border-zinc-200">
              <div className="col-span-6 font-medium">Monthly ad spend (quote)</div>
              <div className="col-span-3 whitespace-nowrap">
                {adSpendQuoteCents > 0 ? fmtMoneyFromCents(adSpendQuoteCents, client.monthlyRetainerFeeCurrency) : "—"}
              </div>
              <div className="col-span-3 text-zinc-600">Current cycle quota</div>
            </div>

            {client.maxShootsPerCycle !== null ? (
              <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
                <div className="col-span-6 font-medium">Max shoots</div>
                <div className="col-span-3">{client.maxShootsPerCycle} / cycle</div>
                <div className="col-span-3 text-zinc-600">Optional cap</div>
              </div>
            ) : null}

            {client.maxCaptureHoursPerCycle !== null ? (
              <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
                <div className="col-span-6 font-medium">Max capture hours</div>
                <div className="col-span-3">{client.maxCaptureHoursPerCycle}h / cycle</div>
                <div className="col-span-3 text-zinc-600">Optional cap</div>
              </div>
            ) : null}

            {quotaItems.length ? (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-zinc-600 bg-zinc-50">Quota items</div>
                {quotaItems.map((q) => {
                  const limit = q.usageMode === "PER_DAY" ? `${q.limitPerCycleDays} days / cycle` : `${Math.round(q.limitPerCycleMinutes / 60)}h / cycle`;
                  return (
                    <div key={q.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-t border-zinc-200">
                      <div className="col-span-6 font-medium">{q.name}</div>
                      <div className="col-span-3">{limit}</div>
                      <div className="col-span-3 text-zinc-600">Usage: {formatUsageMode(q.usageMode)}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
