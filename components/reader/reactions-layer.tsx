"use client";

import { motion, AnimatePresence } from "motion/react";
import { PixelIcon, type IconName } from "@/components/pixel-icon";
import type { ReactionRow } from "./types";

const ACCENT_COLOR: Record<string, string> = {
  peach: "var(--color-peach-deep)",
  lavender: "var(--color-lavender-deep)",
  sage: "var(--color-sage-deep)",
  rose: "var(--color-rose-deep)",
  sun: "var(--color-sun-deep)",
};

const ACCENT_BG: Record<string, string> = {
  peach: "var(--color-peach-soft)",
  lavender: "var(--color-lavender-soft)",
  sage: "var(--color-sage-soft)",
  rose: "var(--color-rose-soft)",
  sun: "var(--color-sun-soft)",
};

export function ReactionsLayer({
  reactions,
  myUserId,
  ownerAccent,
  onDeleteMine,
}: {
  reactions: ReactionRow[];
  myUserId: string | null;
  ownerAccent: (userId: string) => string;
  onDeleteMine: (id: string) => void;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {reactions.map((r) => {
          const isMine = myUserId === r.user_id;
          const accent = ownerAccent(r.user_id) || "peach";
          return (
            <motion.button
              key={r.id}
              initial={{ scale: 0, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 14 }}
              whileHover={isMine ? { scale: 1.08 } : undefined}
              whileTap={isMine ? { scale: 0.9 } : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (isMine) onDeleteMine(r.id);
              }}
              className="absolute pointer-events-auto"
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                transform: "translate(-50%, -50%)",
                cursor: isMine ? "pointer" : "default",
              }}
              title={isMine ? "tap to remove" : undefined}
            >
              <span
                className="inline-flex items-center justify-center rounded-full border-2 border-ink"
                style={{
                  width: 36,
                  height: 36,
                  background: ACCENT_BG[accent] ?? ACCENT_BG.peach,
                  color: ACCENT_COLOR[accent] ?? ACCENT_COLOR.peach,
                  boxShadow: "2px 2px 0 0 var(--color-ink)",
                }}
              >
                <PixelIcon name={r.emoji as IconName} size={20} />
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
