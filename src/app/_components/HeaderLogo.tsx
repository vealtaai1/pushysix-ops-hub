"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function HeaderLogo() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Read initial state
    const check = () =>
      setDark(document.documentElement.classList.contains("theme-dark"));

    check();

    // Watch for class changes (toggled by DarkModeToggle)
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Image
      src={dark ? "/brand/pushysix-logo-dark.png" : "/brand/pushysix-logo-light.png"}
      alt="Pushysix"
      width={52}
      height={52}
      priority
      className="h-13 w-13 shrink-0 transition-opacity group-hover:opacity-80"
    />
  );
}
