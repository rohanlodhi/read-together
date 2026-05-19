"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Avatar } from "@/components/avatar";
import { PixelIcon } from "@/components/pixel-icon";
import { updateProfile } from "@/app/actions/profile";

const ACCENTS = ["peach", "lavender", "sage", "rose", "sun"] as const;
type Accent = (typeof ACCENTS)[number];

const EMOJIS = ["💞", "📚", "🌸", "✨", "🌙", "🍯", "🦋", "☕", "🐝", "🍓"];

export function ProfileSheet({
  open,
  onClose,
  userId,
  displayName,
  emoji,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  displayName: string;
  emoji: string;
  accent: string;
}) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(displayName);
  const [draftEmoji, setDraftEmoji] = useState(emoji);
  const [draftAccent, setDraftAccent] = useState<Accent>(
    (ACCENTS as readonly string[]).includes(accent)
      ? (accent as Accent)
      : "peach",
  );
  const [saving, setSaving] = useState(false);

  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setDraftName(displayName);
      setDraftEmoji(emoji);
      setDraftAccent(
        (ACCENTS as readonly string[]).includes(accent)
          ? (accent as Accent)
          : "peach",
      );
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  async function save() {
    const name = draftName.trim();
    if (!name) {
      toast.error("name can't be empty");
      return;
    }
    setSaving(true);
    const res = await updateProfile({
      display_name: name,
      emoji: draftEmoji,
      accent: draftAccent,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("looking good");
    router.refresh();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !saving && onClose()}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative card-soft w-full max-w-md p-6 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1 text-ink">
              <PixelIcon name="user" size={22} />
              <h2
                className="font-display text-2xl text-ink leading-none"
                style={{ fontWeight: 700 }}
              >
                make it yours
              </h2>
              <button
                onClick={onClose}
                className="ml-auto text-ink-soft hover:text-ink rounded p-1"
                aria-label="close"
              >
                <PixelIcon name="close" size={16} />
              </button>
            </div>
            <p className="text-sm text-ink-soft mb-5 font-medium">
              pick a name and a vibe so the two of you look different
            </p>

            <div className="flex items-center gap-4 mb-5">
              <Avatar seed={userId} accent={draftAccent} size={64} />
              <div className="flex-1">
                <label className="text-xs font-bold text-ink-soft pl-1">
                  display name
                </label>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={40}
                  className="mt-1 w-full rounded-lg bg-cream-deep/40 border-2 border-ink-soft px-3 py-2 text-ink focus:outline-none focus:border-peach-deep focus:bg-paper transition font-semibold"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-bold text-ink-soft pl-1 block mb-2">
                accent color
              </label>
              <div className="flex gap-2 flex-wrap">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setDraftAccent(a)}
                    className={`relative w-10 h-10 rounded-full border-2 transition ${
                      draftAccent === a
                        ? "border-ink scale-110"
                        : "border-ink-soft hover:scale-105"
                    }`}
                    style={{
                      background: `var(--color-${a})`,
                      boxShadow:
                        draftAccent === a
                          ? "3px 3px 0 0 var(--color-ink)"
                          : "2px 2px 0 0 var(--color-ink-soft)",
                    }}
                    aria-label={a}
                  >
                    {draftAccent === a && (
                      <span className="absolute inset-0 flex items-center justify-center text-ink">
                        <PixelIcon name="check" size={16} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-bold text-ink-soft pl-1 block mb-2">
                little emoji
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setDraftEmoji(e)}
                    className={`w-9 h-9 rounded-lg border-2 text-lg leading-none transition ${
                      draftEmoji === e
                        ? "border-ink bg-paper scale-110"
                        : "border-ink-soft bg-cream-deep/30 hover:bg-paper"
                    }`}
                    style={
                      draftEmoji === e
                        ? { boxShadow: "2px 2px 0 0 var(--color-ink)" }
                        : undefined
                    }
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-bold text-ink-soft hover:bg-cream-deep/50 transition disabled:opacity-40"
              >
                cancel
              </button>
              <motion.button
                onClick={save}
                disabled={saving}
                whileTap={{ scale: 0.97 }}
                className="btn-bouncy"
              >
                <PixelIcon name="check" size={16} />
                {saving ? "saving…" : "save"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
