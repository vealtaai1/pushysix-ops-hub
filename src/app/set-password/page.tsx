import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";

import { SetPasswordClient } from "./setPasswordClient";

type SetPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const session = await auth();
  const resolvedSearchParams = (await searchParams) ?? {};

  if (session?.user) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (Array.isArray(value)) {
        for (const item of value) params.append(key, item);
      } else if (typeof value === "string") {
        params.set(key, value);
      }
    }

    const redirectTo = params.toString() ? `/set-password?${params.toString()}` : "/set-password";
    await signOut({ redirect: false });
    redirect(redirectTo);
  }

  return (
    <Suspense fallback={null}>
      <SetPasswordClient />
    </Suspense>
  );
}
