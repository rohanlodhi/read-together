"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PixelIcon } from "@/components/pixel-icon";

const ANNIVERSARY_MMDD = "05-28";
const DISMISS_KEY = "rt:anniversary-dismissed-2026";

function isAnniversaryWindow(now = new Date()) {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${mm}-${dd}` === ANNIVERSARY_MMDD;
}

const COLORS = [
  "var(--color-peach)",
  "var(--color-lavender)",
  "var(--color-sage)",
  "var(--color-rose)",
  "var(--color-sun)",
];

const PIECES = 28;

type Piece = {
  left: number;
  delay: number;
  rot: number;
  drift: number;
  color: string;
};

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    rot: (Math.random() - 0.5) * 360,
    drift: (Math.random() - 0.5) * 80,
    color: COLORS[i % COLORS.length],
  }));
}

export function AnniversaryBanner() {
  const [shown, setShown] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isAnniversaryWindow()) return false;
    if (localStorage.getItem(DISMISS_KEY)) return false;
    return true;
  });
  const [burst, setBurst] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isAnniversaryWindow()) return false;
    if (localStorage.getItem(DISMISS_KEY)) return false;
    return true;
  });

  const pieces = useMemo<Piece[]>(
    () => (burst ? makePieces() : []),
    [burst],
  );

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(false), 3200);
    return () => clearTimeout(t);
  }, [burst]);

  if (!shown) return null;

  return (
    <>
      <AnimatePresence>
        {burst && (
          <div
            className="fixed inset-0 pointer-events-none z-40 overflow-hidden"
            aria-hidden
          >
            {pieces.map((p, i) => (
              <motion.span
                key={i}
                initial={{ y: -40, x: 0, opacity: 0, rotate: 0 }}
                animate={{
                  y:
                    typeof window !== "undefined"
                      ? window.innerHeight + 40
                      : 800,
                  x: p.drift,
                  opacity: [0, 1, 1, 0],
                  rotate: p.rot,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.6, delay: p.delay, ease: "easeIn" }}
                className="absolute"
                style={{
                  left: `${p.left}%`,
                  top: 0,
                  width: 10,
                  height: 14,
                  background: p.color,
                  border: "2px solid var(--color-ink)",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22, delay: 0.1 }}
        className="max-w-6xl mx-auto mt-2 mb-4 px-5 sm:px-8 relative z-10"
      >
        <div
          className="card-soft p-4 sm:p-5 flex items-center gap-3"
          style={{ background: "var(--color-rose-soft)" }}
        >
          <PixelIcon
            name="heart"
            size={28}
            className="text-rose-deep shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p
              className="font-display text-xl sm:text-2xl text-ink leading-none"
              style={{ fontWeight: 700 }}
            >
              happy anniversary
            </p>
            <p className="text-xs sm:text-sm text-ink-soft font-medium mt-1">
              one more year of reading the same page together
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setShown(false);
            }}
            aria-label="dismiss"
            className="shrink-0 rounded-lg border-2 border-ink bg-paper p-1.5 text-ink hover:bg-cream-deep/60 transition"
            style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
          >
            <PixelIcon name="close" size={14} />
          </button>
        </div>
      </motion.div>
    </>
  );
}
