import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";

import { ProfileClient } from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, image: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Profile</h1>
        <p className="text-sm text-zinc-600">Manage your account details and password.</p>
      </div>

      <ProfileClient user={user} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:hidden">
        <h2 className="text-base font-semibold text-zinc-900">Session</h2>
        <p className="mt-1 text-sm text-zinc-600">Need to switch accounts? Sign out here.</p>

        <form
          className="mt-4"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
