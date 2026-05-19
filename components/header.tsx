"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "./avatar";
import { PixelIcon } from "./pixel-icon";
import { ProfileSheet } from "./profile-sheet";
import { ThemeToggle } from "./theme-toggle";
import { usePresence } from "@/lib/use-presence";

export default function Header({
  userId,
  displayName,
  accent,
  emoji,
  partner,
}: {
  userId: string;
  displayName: string;
  accent: string;
  emoji: string;
  partner: {
    userId: string;
    displayName: string;
    accent: string;
  } | null;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const present = usePresence(userId, { kind: "library" });
  const partnerOnline = Boolean(
    partner && present.find((p) => p.user_id === partner.userId),
  );

  return (
    <header className="w-full px-5 sm:px-8 py-4 flex items-center justify-between relative z-20">
      <Link href="/" className="flex items-center gap-2 group">
        <PixelIcon
          name="open-book"
          size={26}
          className="text-ink transition-transform group-hover:-rotate-6 group-hover:scale-110"
        />
        <span
          className="font-display text-2xl text-ink leading-none tracking-tight"
          style={{ fontWeight: 700 }}
        >
          read-together
        </span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        {partner && (
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-full bg-paper/80 border-2 border-ink-soft pl-1 pr-2.5 py-0.5"
            title={
              partnerOnline
                ? `${partner.displayName} is online`
                : `${partner.displayName}`
            }
          >
            <Avatar
              seed={partner.userId}
              accent={partner.accent}
              size={20}
              online={partnerOnline}
            />
            <span className="text-xs font-bold text-ink-faint">
              {partnerOnline ? `${partner.displayName} is here` : `with ${partner.displayName}`}
            </span>
          </div>
        )}
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2 rounded-full bg-paper border-2 border-ink pl-1 pr-3 py-1 shadow-soft hover:bg-peach-soft/30 transition"
          title="edit your profile"
        >
          <Avatar seed={userId} accent={accent} size={26} />
          <span className="text-sm font-bold text-ink-soft">{displayName}</span>
        </button>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="text-xs text-ink-faint hover:text-ink-soft underline-offset-4 hover:underline font-semibold transition-colors"
          >
            sign out
          </button>
        </form>
      </div>

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userId={userId}
        displayName={displayName}
        emoji={emoji}
        accent={accent}
      />
    </header>
  );
}
