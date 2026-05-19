"use client";

import { useRef, useState } from "react";
import type { Rect } from "./types";

const MIN_W = 0.04;
const MIN_H = 0.012;

export function MarkCanvas({
  accent,
  onCommit,
  onCancel,
}: {
  accent: string;
  onCommit: (rect: Rect) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const accentFill: Record<string, string> = {
    peach: "rgba(255, 181, 167, 0.45)",
    lavender: "rgba(200, 182, 255, 0.45)",
    sage: "rgba(168, 212, 171, 0.45)",
    rose: "rgba(255, 168, 201, 0.45)",
    sun: "rgba(255, 217, 122, 0.55)",
  };

  const accentStroke: Record<string, string> = {
    peach: "var(--color-peach-deep)",
    lavender: "var(--color-lavender-deep)",
    sage: "var(--color-sage-deep)",
    rose: "var(--color-rose-deep)",
    sun: "var(--color-sun-deep)",
  };

  function pointToFrac(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const p = pointToFrac(e);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const p = pointToFrac(e);
    if (!p) return;
    const sx = start.current.x;
    const sy = start.current.y;
    const x = Math.min(sx, p.x);
    const y = Math.min(sy, p.y);
    const w = Math.abs(p.x - sx);
    const h = Math.abs(p.y - sy);
    setRect({ x, y, w, h });
  }

  function onPointerUp() {
    const r = rect;
    start.current = null;
    setRect(null);
    if (!r) return;
    if (r.w < MIN_W || r.h < MIN_H) return;
    onCommit(r);
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setRect(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 z-20"
      style={{
        cursor: "crosshair",
        touchAction: "none",
        background:
          "repeating-linear-gradient(45deg, rgba(58,46,41,0.04) 0 6px, transparent 6px 12px)",
      }}
    >
      {rect && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
            background: accentFill[accent] ?? accentFill.peach,
            boxShadow: `inset 0 0 0 2px ${accentStroke[accent] ?? accentStroke.peach}`,
            borderRadius: 3,
          }}
        />
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="absolute top-2 left-2 pill text-xs"
        style={{ background: "var(--color-paper)" }}
      >
        cancel
      </button>
    </div>
  );
}
