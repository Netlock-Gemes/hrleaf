/**
 * Light / dark / system theme, stored per browser.
 * The same logic runs inline in <head> (THEME_SCRIPT) so the right theme is
 * applied before first paint, with no flash.
 */

export type ThemePref = "system" | "light" | "dark";

const KEY = "hrleaf:theme";

export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.classList.toggle("light",!d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`;

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePref) {
  const theme = resolveTheme(pref);
  const el = document.documentElement;
  // Suppress transitions for the swap so every surface changes in the same frame.
  el.classList.add("theme-switching");
  el.classList.toggle("dark", theme === "dark");
  el.classList.toggle("light", theme === "light");
  el.style.colorScheme = theme;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("theme-switching")));
  window.dispatchEvent(new CustomEvent("hrleaf:theme", { detail: pref }));
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage blocked: still apply for this page */
  }
  applyTheme(pref);
}
