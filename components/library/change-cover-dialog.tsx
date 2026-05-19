"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PixelIcon } from "@/components/pixel-icon";
import { createClient } from "@/lib/supabase/client";
import { updateCover } from "@/app/actions/update-cover";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export function ChangeCoverDialog({
  bookId,
  title,
  open,
  onClose,
}: {
  bookId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setFile(null);
      setPreviewUrl(null);
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  function pick(f: File) {
    if (!ACCEPTED.includes(f.type)) {
      toast.error("PNG, JPG or WebP only");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const ext = file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
      const coverPath = `${bookId}/cover-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("books")
        .upload(coverPath, file, { contentType: file.type, upsert: false });
      if (up.error) {
        toast.error(`upload failed: ${up.error.message}`);
        return;
      }
      const res = await updateCover({ id: bookId, cover_path: coverPath });
      if (!res.ok) {
        toast.error(res.error);
        // Best-effort cleanup.
        await supabase.storage.from("books").remove([coverPath]);
        return;
      }
      toast.success("new cover saved");
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
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
            className="relative card-soft w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1 text-ink">
              <PixelIcon name="image" size={22} />
              <h2
                className="font-display text-2xl text-ink leading-none"
                style={{ fontWeight: 700 }}
              >
                pick a cover
              </h2>
              <button
                onClick={onClose}
                className="ml-auto text-ink-soft hover:text-ink rounded p-1"
                aria-label="close"
              >
                <PixelIcon name="close" size={16} />
              </button>
            </div>
            <p className="text-sm text-ink-soft mb-4 font-medium">
              for{" "}
              <span className="font-bold text-ink">{title}</span>
            </p>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-ink-soft bg-cream-deep/20 hover:bg-cream-deep/40 p-4 transition text-ink"
            >
              {previewUrl ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="cover preview"
                    className="max-h-56 rounded-lg border-2 border-ink"
                    style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
                  />
                  <p className="text-xs font-bold text-ink-soft">
                    click to pick a different image
                  </p>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <PixelIcon name="upload" size={36} className="mb-2" />
                  <p className="font-bold text-ink">pick a cover image</p>
                  <p className="text-xs text-ink-soft mt-1 font-medium">
                    PNG, JPG or WebP
                  </p>
                </div>
              )}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pick(f);
                e.target.value = "";
              }}
            />

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-bold text-ink-soft hover:bg-cream-deep/50 transition disabled:opacity-40"
              >
                cancel
              </button>
              <motion.button
                onClick={save}
                disabled={!file || saving}
                whileTap={{ scale: 0.97 }}
                className="btn-bouncy disabled:opacity-40"
              >
                <PixelIcon name="check" size={16} />
                {saving ? "saving…" : "use this cover"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
