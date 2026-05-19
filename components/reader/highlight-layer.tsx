"use client";

import { motion } from "motion/react";
import type { AnnotationRow } from "./types";

const ACCENT_FILL: Record<string, string> = {
  peach: "rgba(255, 181, 167, 0.42)",
  lavender: "rgba(200, 182, 255, 0.42)",
  sage: "rgba(168, 212, 171, 0.42)",
  rose: "rgba(255, 168, 201, 0.42)",
  sun: "rgba(255, 217, 122, 0.5)",
};

const ACCENT_STROKE: Record<string, string> = {
  peach: "var(--color-peach-deep)",
  lavender: "var(--color-lavender-deep)",
  sage: "var(--color-sage-deep)",
  rose: "var(--color-rose-deep)",
  sun: "var(--color-sun-deep)",
};

export function HighlightLayer({
  annotations,
  onTap,
  selectedId,
}: {
  annotations: AnnotationRow[];
  onTap: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {annotations.map((a) => {
        const accent = (a.color || "peach") as keyof typeof ACCENT_FILL;
        const fill = ACCENT_FILL[accent] ?? ACCENT_FILL.peach;
        const stroke = ACCENT_STROKE[accent] ?? ACCENT_STROKE.peach;
        return (
          <div key={a.id}>
            {a.rects.map((r, i) => (
              <motion.button
                key={`${a.id}-${i}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTap(a.id);
                }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className="absolute pointer-events-auto cursor-pointer"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  background: fill,
                  borderRadius: 3,
                  boxShadow:
                    selectedId === a.id
                      ? `inset 0 0 0 2px ${stroke}`
                      : `inset 0 0 0 1px ${stroke}`,
                  mixBlendMode: "multiply",
                }}
                title={a.note_content ? "has a note" : undefined}
              >
                {a.note_content && i === 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 bg-paper border-2 border-ink rounded-full w-3.5 h-3.5 flex items-center justify-center"
                    style={{ boxShadow: "1px 1px 0 0 var(--color-ink)" }}
                  >
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{ background: stroke }}
                    />
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
