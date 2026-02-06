import Link from "next/link";

import { auth, signOut } from "@/auth";

export async function AuthButtons() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Link className="text-zinc-600 hover:text-[#2EA3F2]" href="/login">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-zinc-600 sm:inline">{session.user.email ?? session.user.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="text-zinc-600 hover:text-[#2EA3F2]" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
