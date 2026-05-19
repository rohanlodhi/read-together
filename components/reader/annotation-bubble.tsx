"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import { Avatar } from "@/components/avatar";
import type { AnnotationRow } from "./types";

export function AnnotationBubble({
  annotation,
  ownerName,
  ownerAccent,
  isMine,
  onClose,
  onSave,
  onDelete,
}: {
  annotation: AnnotationRow;
  ownerName: string;
  ownerAccent: string;
  isMine: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(annotation.note_content ?? "");
  const [syncedNote, setSyncedNote] = useState(annotation.note_content);
  const [editing, setEditing] = useState(
    isMine && !annotation.note_content,
  );
  const [isMobile, setIsMobile] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  if (syncedNote !== annotation.note_content) {
    setSyncedNote(annotation.note_content);
    setDraft(annotation.note_content ?? "");
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (editing && taRef.current) taRef.current.focus();
  }, [editing]);

  // Tooltip positioning (desktop only).
  const firstRect = annotation.rects[0];
  const anchorTop = firstRect ? firstRect.y * 100 : 50;
  const placeBelow = anchorTop < 18;
  const left = firstRect
    ? Math.min(82, Math.max(8, (firstRect.x + firstRect.w / 2) * 100))
    : 50;

  const card = (
    <div
      className="bg-paper border-2 border-ink rounded-2xl p-3"
      style={{ boxShadow: "4px 4px 0 0 var(--color-ink)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Avatar seed={annotation.user_id} accent={ownerAccent} size={22} />
        <span className="font-bold text-sm text-ink">
          {isMine ? "you" : ownerName}
        </span>
        <button
          onClick={onClose}
          aria-label="close"
          className="ml-auto rounded p-1 text-ink-soft hover:text-ink"
        >
          <PixelIcon name="close" size={14} />
        </button>
      </div>

      {annotation.selected_text && (
        <p className="text-[11px] italic text-ink-soft mb-2 line-clamp-2 border-l-2 border-ink-faint pl-2">
          {annotation.selected_text}
        </p>
      )}

      {editing ? (
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="leave a note for them…"
          rows={3}
          className="w-full text-sm rounded-lg border-2 border-ink bg-cream px-2.5 py-1.5 font-medium focus:outline-none resize-none"
          style={{
            fontFamily: "var(--font-hand)",
            fontSize: "1.05rem",
            lineHeight: 1.3,
          }}
        />
      ) : annotation.note_content ? (
        <p
          className="text-ink whitespace-pre-wrap"
          style={{
            fontFamily: "var(--font-hand)",
            fontSize: "1.15rem",
            lineHeight: 1.3,
          }}
        >
          {annotation.note_content}
        </p>
      ) : (
        <p className="text-sm text-ink-faint italic">
          just a highlight — no note
        </p>
      )}

      {isMine && (
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={onDelete}
            className="text-xs font-bold text-rose-deep hover:underline flex items-center gap-1"
          >
            <PixelIcon name="close" size={12} />
            remove
          </button>
          {editing ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  setDraft(annotation.note_content ?? "");
                  setEditing(false);
                  if (!annotation.note_content) onClose();
                }}
                className="rounded-lg px-2 py-1 text-xs font-bold text-ink-soft hover:text-ink"
              >
                cancel
              </button>
              <button
                onClick={() => {
                  onSave(draft.trim());
                  setEditing(false);
                }}
                className="rounded-lg border-2 border-ink bg-peach px-2.5 py-1 text-xs font-bold text-ink"
                style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
              >
                save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border-2 border-ink bg-paper px-2.5 py-1 text-xs font-bold text-ink hover:bg-peach-soft/40"
              style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
            >
              <span className="inline-flex items-center gap-1">
                <PixelIcon name="edit" size={12} />
                {annotation.note_content ? "edit note" : "add note"}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    // Bottom sheet — fixed to viewport so it can't go off-screen.
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed left-2 right-2 z-50"
          style={{
            bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {card}
        </motion.div>
      </>
    );
  }

  // Desktop tooltip.
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: placeBelow ? -8 : 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="absolute z-30 w-[min(20rem,80vw)]"
      style={{
        left: `${left}%`,
        [placeBelow ? "top" : "bottom"]: placeBelow
          ? `calc(${(firstRect?.y ?? 0) * 100 + (firstRect?.h ?? 0) * 100}% + 8px)`
          : `calc(${100 - (firstRect?.y ?? 0) * 100}% + 8px)`,
        transform: "translateX(-50%)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {card}
    </motion.div>
  );
}
