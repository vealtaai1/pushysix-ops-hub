"use client";

import * as React from "react";
import { clearClientRetainer, type ClearRetainerState } from "./actions";

export function ClearRetainerClient({ clientId }: { clientId: string }) {
  const init: ClearRetainerState = { ok: false };
  const [state, action, pending] = React.useActionState(clearClientRetainer, init);

  return (
    <div className="flex items-center gap-2">
      <form
        action={action}
        onSubmit={(e) => {
          const ok = window.confirm(
            "Clear retainer settings for this client?\n\nThis will:\n- set retainer hours to 0\n- clear fee\n- remove caps\n- delete quota items\n\nThis cannot be undone."
          );
          if (!ok) e.preventDefault();
        }}
      >
        <input type="hidden" name="clientId" value={clientId} />
        <button
          type="submit"
          disabled={pending}
          className={
            "inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold " +
            (pending ? "border-zinc-200 bg-zinc-100 text-zinc-400" : "border-red-300 bg-white text-red-700 hover:bg-red-50")
          }
        >
          {pending ? "Clearing…" : "Clear retainer"}
        </button>
      </form>

      {state.message ? (
        <div className={"text-xs " + (state.ok ? "text-emerald-700" : "text-red-700")}>{state.message}</div>
      ) : null}
    </div>
  );
}
