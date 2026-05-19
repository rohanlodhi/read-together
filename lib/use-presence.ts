"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const CHANNEL_NAME = "presence:lobby";

export type PresenceLocation =
  | { kind: "library" }
  | { kind: "book"; book_id: string; page?: number };

export type PresentUser = {
  user_id: string;
  online_at: string;
  location: PresenceLocation;
};

/**
 * Track this user's presence on the shared lobby channel and return everyone
 * else who's currently online. Re-tracks whenever `location` changes (so we
 * push page-by-page updates without reconnecting).
 */
export function usePresence(
  myUserId: string | null,
  location: PresenceLocation | null,
) {
  const [present, setPresent] = useState<PresentUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const locationRef = useRef(location);
  locationRef.current = location;

  // Connect once per user.
  useEffect(() => {
    if (!myUserId) return;
    const supabase = createClient();
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: myUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const flat: PresentUser[] = [];
        for (const key in state) {
          for (const p of state[key]) {
            flat.push(p as unknown as PresentUser);
          }
        }
        setPresent(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          subscribedRef.current = true;
          if (locationRef.current) {
            await channel.track({
              user_id: myUserId,
              online_at: new Date().toISOString(),
              location: locationRef.current,
            });
          }
        }
      });

    channelRef.current = channel;
    return () => {
      subscribedRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [myUserId]);

  // Re-track when location changes (without reconnecting the channel).
  // Using JSON to compare avoids re-triggering on referentially-different
  // but value-equal location objects from parent re-renders.
  const locKey = location ? JSON.stringify(location) : "";
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current || !myUserId || !location) return;
    ch.track({
      user_id: myUserId,
      online_at: new Date().toISOString(),
      location,
    }).catch((e) => console.warn("presence track failed", e));
    // location captured via ref above; locKey forces re-run when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId, locKey]);

  return present;
}
