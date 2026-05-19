"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  usePresence,
  type PresenceLocation,
  type PresentUser,
} from "@/lib/use-presence";

const PresenceContext = createContext<PresentUser[]>([]);

/**
 * Owns the single `presence:lobby` subscription for a page. All children
 * read presence state via `usePresenceContext()` — avoids the
 * "cannot add presence callbacks after subscribe()" error from multiple
 * hooks calling `supabase.channel("presence:lobby")`.
 */
export function PresenceProvider({
  userId,
  location,
  children,
}: {
  userId: string | null;
  location: PresenceLocation | null;
  children: ReactNode;
}) {
  const present = usePresence(userId, location);
  return (
    <PresenceContext.Provider value={present}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresenceContext() {
  return useContext(PresenceContext);
}

export function usePartnerOnline(partnerUserId: string | null | undefined) {
  const present = usePresenceContext();
  if (!partnerUserId) return false;
  return present.some((p) => p.user_id === partnerUserId);
}
