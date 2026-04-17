"use client";

import { useState } from "react";
import Image from "next/image";

export function AuthProfileAvatar({ image, initial, label }: { image: string | null | undefined; initial: string; label: string }) {
  const [hadError, setHadError] = useState(false);

  if (image && !hadError) {
    return (
      <Image
        src={image}
        alt={`${label} profile photo`}
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        unoptimized
        onError={() => setHadError(true)}
      />
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
      {initial}
    </span>
  );
}
