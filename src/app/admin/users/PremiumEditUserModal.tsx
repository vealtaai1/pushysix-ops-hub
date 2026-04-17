"use client";

import { useEffect, useMemo, useState } from "react";

import type { UserRole } from "@prisma/client";

const ROLE_ADMIN = "ADMIN" as unknown as UserRole;
const ROLE_EMPLOYEE = "EMPLOYEE" as unknown as UserRole;
const ROLE_ACCOUNT_MANAGER = "ACCOUNT_MANAGER" as unknown as UserRole;

function fmtCadCents(cents: number | null | undefined) {
  if (cents == null) return "";
  return String(cents / 100);
}

function getRoleLabel(role: UserRole) {
  switch (role) {
    case ROLE_ADMIN:
      return "Admin";
    case ROLE_ACCOUNT_MANAGER:
      return "Account Manager";
    case ROLE_EMPLOYEE:
    default:
      return "Employee";
  }
}

type Props = {
  open: boolean;
  title?: string;
  userEmail: string;
  initialName: string | null;
  initialHourlyWageCents?: number | null;
  initialRole: UserRole;
  adminsCount: number;
  onClose: () => void;
  onSave: (patch: { name: string | null; hourlyWage: string | null; role: UserRole }) => Promise<void>;
};

export function PremiumEditUserModal({
  open,
  title,
  userEmail,
  initialName,
  initialHourlyWageCents,
  initialRole,
  adminsCount,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [hourlyWage, setHourlyWage] = useState(fmtCadCents(initialHourlyWageCents ?? null));
  const [role, setRole] = useState<UserRole>(initialRole);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleWarning = useMemo(() => {
    if (initialRole === ROLE_ADMIN && role !== ROLE_ADMIN && adminsCount <= 1) {
      return "Can’t remove the last admin.";
    }
    return null;
  }, [adminsCount, initialRole, role]);

  useEffect(() => {
    if (!open) return;
    setName(initialName ?? "");
    setHourlyWage(fmtCadCents(initialHourlyWageCents ?? null));
    setRole(initialRole);
    setError(null);
  }, [open, initialName, initialHourlyWageCents, initialRole]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} />

      <div className="relative w-full max-w-lg overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">{title ?? "Edit user"}</div>
            <div className="mt-0.5 truncate text-xs text-zinc-500">{userEmail}</div>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                placeholder="Optional"
                autoComplete="off"
              />
              <div className="mt-1 text-[11px] text-zinc-500">Leave blank to clear.</div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Hourly wage (CAD)</label>
              <input
                type="text"
                inputMode="decimal"
                value={hourlyWage}
                onChange={(e) => setHourlyWage(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                placeholder="25.00"
                autoComplete="off"
              />
              <div className="mt-1 text-[11px] text-zinc-500">Leave blank to clear.</div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Role</label>
              <select
                value={role as unknown as string}
                onChange={(e) => setRole(e.target.value as unknown as UserRole)}
                className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
              >
                <option value={ROLE_EMPLOYEE as unknown as string}>{getRoleLabel(ROLE_EMPLOYEE)}</option>
                <option value={ROLE_ACCOUNT_MANAGER as unknown as string}>{getRoleLabel(ROLE_ACCOUNT_MANAGER)}</option>
                <option value={ROLE_ADMIN as unknown as string}>{getRoleLabel(ROLE_ADMIN)}</option>
              </select>
              {roleWarning ? <div className="mt-1 text-[11px] text-red-600">{roleWarning}</div> : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="h-9 rounded-md border border-zinc-300 bg-white px-4 text-sm hover:bg-zinc-50 disabled:opacity-50"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={saving || !!roleWarning}
              onClick={async () => {
                setSaving(true);
                setError(null);
                try {
                  await onSave({
                    name: name.trim() ? name.trim() : null,
                    hourlyWage: hourlyWage.trim() ? hourlyWage.trim() : null,
                    role,
                  });
                  onClose();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Save failed");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
