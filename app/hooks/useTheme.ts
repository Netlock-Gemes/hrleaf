"use client";

import { useEffect, useState } from "react";

import { ThemePref, applyTheme, readThemePref, resolveTheme, setThemePref } from "@/lib/theme";

/** Current theme preference, kept in sync across components and with the OS setting. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const sync = () => {
      const p = readThemePref();
      setPref(p);
      setResolved(resolveTheme(p));
    };
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readThemePref() === "system") applyTheme("system");
      sync();
    };
    mq.addEventListener("change", onSystem);
    window.addEventListener("hrleaf:theme", sync);
    window.addEventListener("storage", onSystem);
    return () => {
      mq.removeEventListener("change", onSystem);
      window.removeEventListener("hrleaf:theme", sync);
      window.removeEventListener("storage", onSystem);
    };
  }, []);

  return { pref, resolved, setTheme: setThemePref };
}
