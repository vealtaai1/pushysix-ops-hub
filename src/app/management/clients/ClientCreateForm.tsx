"use client";

import * as React from "react";
import { createClient, type CreateClientState } from "./actions";

const initialState: CreateClientState = { ok: false };

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div className="mt-1 text-xs text-red-700">{msg}</div>;
}

export function ClientCreateForm() {
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const [state, action, pending] = React.useActionState(createClient, initialState);

  React.useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="mb-4">
        <div className="text-sm font-semibold">Add client</div>
        <div className="text-xs text-zinc-500">Create the client first. You can add retainer/projects later.</div>
      </div>

      <form ref={formRef} action={action} className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Client name</span>
            <input
              name="name"
              required
              placeholder="Acme Inc."
              className={
                "h-10 rounded-md border bg-white px-3 " + (state.fieldErrors?.name ? "border-red-300" : "border-zinc-300")
              }
            />
            <FieldError msg={state.fieldErrors?.name} />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Billing email</span>
            <input
              name="clientBillingEmail"
              type="email"
              placeholder="billing@client.com"
              className={
                "h-10 rounded-md border bg-white px-3 " +
                (state.fieldErrors?.clientBillingEmail ? "border-red-300" : "border-zinc-300")
              }
            />
            <FieldError msg={state.fieldErrors?.clientBillingEmail} />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Billing cycle start</span>
            <select
              name="billingCycleStartDay"
              defaultValue="FIRST"
              className={
                "h-10 rounded-md border bg-white px-3 " +
                (state.fieldErrors?.billingCycleStartDay ? "border-red-300" : "border-zinc-300")
              }
            >
              <option value="FIRST">1st</option>
              <option value="FIFTEENTH">15th</option>
            </select>
            <FieldError msg={state.fieldErrors?.billingCycleStartDay} />
          </label>

          <div className="hidden md:block" />
          <div className="hidden md:block" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            {state.ok ? (
              <span className="font-medium text-emerald-700">{state.message}</span>
            ) : state.fieldErrors ? (
              <span className="text-red-700">Fix the highlighted fields.</span>
            ) : (
              <span className="text-zinc-500">&nbsp;</span>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className={
              "h-10 rounded-md px-4 text-sm font-semibold text-white " +
              (pending ? "bg-zinc-300" : "bg-[#2EA3F2] hover:opacity-90")
            }
          >
            {pending ? "Creating…" : "Create client"}
          </button>
        </div>
      </form>
    </div>
  );
}
