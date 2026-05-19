"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PixelIcon, type IconName } from "@/components/pixel-icon";

export const REACTION_PALETTE: IconName[] = [
  "heart",
  "sparkles",
  "sun",
  "moon",
  "happy",
  "sad",
];

export function ReactCanvas({
  onDrop,
  onCancel,
}: {
  onDrop: (emoji: IconName, x: number, y: number) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pick, setPick] = useState<IconName>("heart");

  function pointToFrac(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const p = pointToFrac(e);
        if (!p) return;
        onDrop(pick, p.x, p.y);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 z-20"
      style={{
        cursor: "crosshair",
        touchAction: "none",
        background: "rgba(255, 248, 240, 0.18)",
      }}
    >
      <AnimatePresence>
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="absolute left-1/2 -translate-x-1/2 top-3 flex items-center gap-1.5 bg-paper border-2 border-ink rounded-full px-2 py-1.5"
          style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {REACTION_PALETTE.map((name) => (
            <button
              key={name}
              onClick={() => setPick(name)}
              aria-label={name}
              className={`rounded-full p-1.5 transition ${
                pick === name
                  ? "bg-peach-soft text-ink ring-2 ring-ink"
                  : "text-ink-soft hover:bg-cream-deep/60"
              }`}
            >
              <PixelIcon name={name} size={18} />
            </button>
          ))}
          <button
            onClick={onCancel}
            className="ml-1 rounded-full p-1 text-ink-soft hover:text-ink"
            aria-label="cancel"
          >
            <PixelIcon name="close" size={16} />
          </button>
        </motion.div>
      </AnimatePresence>
      <p
        className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-bold text-ink bg-paper/90 border-2 border-ink rounded-full px-3 py-1"
        style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
      >
        tap anywhere to drop
      </p>
    </div>
  );
}
