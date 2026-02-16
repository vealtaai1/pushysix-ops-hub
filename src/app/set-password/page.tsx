import { Suspense } from "react";

import { SetPasswordClient } from "./setPasswordClient";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordClient />
    </Suspense>
  );
}
