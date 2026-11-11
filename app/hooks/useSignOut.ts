"use client";

import { useTransition } from "react";

import { clearLocalNotes } from "@/lib/recent";
import { logoutAction } from "@/server/auth-actions";

/** Sign out, forgetting this device's recent notes, drafts and offline copies first. */
export function useSignOut() {
  const [pending, start] = useTransition();
  const signOut = () =>
    start(async () => {
      clearLocalNotes();
      // Offline copies of notes live in the service worker's cache.
      try {
        await caches.delete("hrleaf-pages");
      } catch {
        /* no cache support */
      }
      await logoutAction();
    });
  return { pending, signOut };
}
