import Link from "next/link";

import { auth, signOut } from "@/auth";
import { AuthProfileAvatar } from "./AuthProfileAvatar";

function getInitial(name: string | null | undefined, email: string | null | undefined) {
  return (name?.trim()?.[0] ?? email?.trim()?.[0] ?? "U").toUpperCase();
}

export async function AuthButtons() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link className="text-zinc-600 hover:text-[#2EA3F2]" href="/login">
        Sign in
      </Link>
    );
  }

  const label = session.user.name?.trim() || session.user.email || "Profile";
  const sublabel = session.user.name?.trim() && session.user.email ? session.user.email : null;
  const initial = getInitial(session.user.name, session.user.email);

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Link
        href="/profile"
        className="group flex max-w-[240px] items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left transition hover:border-zinc-300 hover:bg-zinc-100"
      >
        <AuthProfileAvatar image={session.user.image} initial={initial} label={label} />
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-xs font-semibold text-zinc-900">{label}</span>
          {sublabel ? <span className="block truncate text-[11px] text-zinc-500">{sublabel}</span> : null}
        </span>
      </Link>

      <form
        className="hidden sm:inline-flex"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          className="inline-flex h-9 items-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900"
          type="submit"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
