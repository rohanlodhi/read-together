"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import { createClient } from "@/lib/supabase/client";
import { readPdfMeta, renderCover } from "@/lib/pdf-client";
import { insertBook } from "@/app/actions/upload-book";

type Stage =
  | { kind: "idle" }
  | { kind: "analyzing"; file: File }
  | {
      kind: "ready";
      file: File;
      title: string;
      author: string;
      totalPages: number;
      coverBlob: Blob | null;
      coverUrl: string | null;
      coverSource: "auto" | "manual" | "none";
    }
  | { kind: "uploading"; progress: number; label: string }
  | { kind: "done" };

const ACCEPTED = "application/pdf";
const ACCEPTED_IMAGE = ["image/png", "image/jpeg", "image/webp"];

export function UploadBookDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);

  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) setStage({ kind: "idle" });
  }

  useEffect(() => {
    if (stage.kind === "ready" && stage.coverUrl) {
      const url = stage.coverUrl;
      return () => URL.revokeObjectURL(url);
    }
  }, [stage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage.kind !== "uploading") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, stage.kind, onClose]);

  async function handleFile(file: File) {
    if (file.type !== ACCEPTED && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files for now.");
      return;
    }
    setStage({ kind: "analyzing", file });
    try {
      const meta = await readPdfMeta(file);
      let coverBlob: Blob | null = null;
      try {
        coverBlob = await renderCover(file, 600);
      } catch (coverErr) {
        console.warn("cover render failed", coverErr);
      }
      const coverUrl = coverBlob ? URL.createObjectURL(coverBlob) : null;
      const cleanName = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      setStage({
        kind: "ready",
        file,
        title: meta.title ?? cleanName,
        author: meta.author ?? "",
        totalPages: meta.totalPages,
        coverBlob,
        coverUrl,
        coverSource: coverBlob ? "auto" : "none",
      });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't read that PDF. Try a different file?");
      setStage({ kind: "idle" });
    }
  }

  function pickManualCover(image: File) {
    if (!ACCEPTED_IMAGE.includes(image.type)) {
      toast.error("PNG, JPG or WebP only");
      return;
    }
    if (stage.kind !== "ready") return;
    if (stage.coverUrl) URL.revokeObjectURL(stage.coverUrl);
    setStage({
      ...stage,
      coverBlob: image,
      coverUrl: URL.createObjectURL(image),
      coverSource: "manual",
    });
  }

  async function handleUpload() {
    if (stage.kind !== "ready") return;
    const { file, title, author, totalPages, coverBlob, coverSource } = stage;
    const supabase = createClient();
    const id = crypto.randomUUID();
    const pdfPath = `${id}/book.pdf`;
    const coverExt =
      coverBlob && coverBlob.type === "image/jpeg"
        ? "jpg"
        : coverBlob && coverBlob.type === "image/webp"
          ? "webp"
          : "png";
    const coverPath = coverBlob ? `${id}/cover.${coverExt}` : null;
    const coverContentType = coverBlob?.type || "image/png";

    const revert = () =>
      setStage({
        kind: "ready",
        file,
        title,
        author,
        totalPages,
        coverBlob,
        coverUrl: coverBlob ? URL.createObjectURL(coverBlob) : null,
        coverSource,
      });

    setStage({ kind: "uploading", progress: 0.1, label: "uploading book…" });

    const up1 = await supabase.storage
      .from("books")
      .upload(pdfPath, file, { contentType: "application/pdf", upsert: false });
    if (up1.error) {
      toast.error(`Upload failed: ${up1.error.message}`);
      revert();
      return;
    }

    if (coverBlob && coverPath) {
      setStage({ kind: "uploading", progress: 0.7, label: "saving cover…" });
      const up2 = await supabase.storage
        .from("books")
        .upload(coverPath, coverBlob, {
          contentType: coverContentType,
          upsert: false,
        });
      if (up2.error) {
        toast.error(`Cover upload failed: ${up2.error.message}`);
        revert();
        return;
      }
    }

    setStage({
      kind: "uploading",
      progress: 0.95,
      label: "adding to library…",
    });
    const res = await insertBook({
      id,
      title: title.trim() || "Untitled",
      author: author.trim() || null,
      pdf_path: pdfPath,
      cover_path: coverPath,
      total_pages: totalPages,
    });
    if (!res.ok) {
      toast.error(res.error);
      revert();
      return;
    }

    setStage({ kind: "done" });
    toast.success("added to the library");
    setTimeout(() => {
      router.refresh();
      onClose();
    }, 700);
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
          onClick={() => stage.kind !== "uploading" && onClose()}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative card-soft w-full max-w-lg p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1 text-ink">
              <PixelIcon name="book" size={26} />
              <h2
                className="font-display text-3xl text-ink leading-none"
                style={{ fontWeight: 700 }}
              >
                add a book
              </h2>
            </div>
            <p className="text-sm text-ink-soft mb-5 font-medium">
              drop a PDF and we&apos;ll set up the cover for you
            </p>

            {stage.kind === "idle" && (
              <DropZone
                dragOver={dragOver}
                onDragOver={(v) => setDragOver(v)}
                onPick={() => fileInputRef.current?.click()}
                onDrop={(file) => handleFile(file)}
              />
            )}

            {stage.kind === "analyzing" && (
              <div
                className="card-soft-quiet p-10 text-center text-ink"
                style={{ background: "var(--color-cream-deep)" }}
              >
                <PixelIcon name="sparkles" size={36} className="mb-2" />
                <p className="font-bold text-ink">peeking inside the book…</p>
                <p className="text-xs text-ink-faint mt-1 font-medium">
                  reading metadata + generating cover
                </p>
              </div>
            )}

            {stage.kind === "ready" && (
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1.5 items-center">
                    {stage.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={stage.coverUrl}
                        alt="cover preview"
                        className="w-28 h-36 object-cover rounded-lg border-2 border-ink"
                        style={{
                          boxShadow: "3px 3px 0 0 var(--color-ink)",
                        }}
                      />
                    ) : (
                      <div
                        className="w-28 h-36 rounded-lg border-2 border-dashed border-ink-soft bg-cream-deep/30 flex flex-col items-center justify-center text-ink-soft text-center px-2"
                        style={{
                          boxShadow: "3px 3px 0 0 var(--color-ink-faint)",
                        }}
                      >
                        <PixelIcon name="image" size={20} />
                        <p className="text-[10px] font-bold mt-1 leading-tight">
                          no cover
                          <br />
                          parsed
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="text-[11px] font-bold text-ink-soft hover:text-ink underline-offset-2 hover:underline inline-flex items-center gap-1"
                    >
                      <PixelIcon name="image" size={10} />
                      {stage.coverSource === "auto"
                        ? "change cover"
                        : stage.coverSource === "manual"
                          ? "pick different"
                          : "upload cover"}
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-xs font-bold text-ink-soft pl-1">
                      title
                    </label>
                    <input
                      value={stage.title}
                      onChange={(e) =>
                        setStage({ ...stage, title: e.target.value })
                      }
                      className="rounded-lg bg-cream-deep/40 border-2 border-ink-soft px-3 py-2 text-ink focus:outline-none focus:border-peach-deep focus:bg-paper transition font-semibold"
                    />
                    <label className="text-xs font-bold text-ink-soft pl-1 mt-1">
                      author
                    </label>
                    <input
                      value={stage.author}
                      placeholder="optional"
                      onChange={(e) =>
                        setStage({ ...stage, author: e.target.value })
                      }
                      className="rounded-lg bg-cream-deep/40 border-2 border-ink-soft px-3 py-2 text-ink placeholder:text-ink-faint focus:outline-none focus:border-peach-deep focus:bg-paper transition font-semibold"
                    />
                    <p className="text-xs text-ink-faint pl-1 mt-1 font-semibold">
                      {stage.totalPages} pages
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-2">
                  <button
                    onClick={() => setStage({ kind: "idle" })}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-ink-soft hover:bg-cream-deep/50 transition"
                  >
                    pick another
                  </button>
                  <motion.button
                    onClick={handleUpload}
                    whileTap={{ scale: 0.97 }}
                    className="btn-bouncy"
                  >
                    <PixelIcon name="gift" size={18} />
                    add to library
                  </motion.button>
                </div>
              </div>
            )}

            {stage.kind === "uploading" && (
              <div
                className="card-soft-quiet p-8 text-center text-ink"
                style={{ background: "var(--color-cream-deep)" }}
              >
                <PixelIcon name="sparkles" size={36} className="mb-2" />
                <p className="font-bold text-ink mb-3">{stage.label}</p>
                <div
                  className="h-2.5 bg-cream rounded-full overflow-hidden"
                  style={{ border: "2px solid var(--color-ink)" }}
                >
                  <motion.div
                    className="h-full bg-peach"
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.progress * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {stage.kind === "done" && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
                className="card-soft-quiet p-10 text-center text-ink"
                style={{ background: "var(--color-sage-soft)" }}
              >
                <PixelIcon
                  name="heart"
                  size={52}
                  className="mb-2 text-rose-deep"
                />
                <p className="font-bold text-ink text-lg">
                  added to the library
                </p>
              </motion.div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept={ACCEPTED_IMAGE.join(",")}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickManualCover(f);
                e.target.value = "";
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DropZone({
  dragOver,
  onDragOver,
  onPick,
  onDrop,
}: {
  dragOver: boolean;
  onDragOver: (v: boolean) => void;
  onPick: () => void;
  onDrop: (file: File) => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(true);
      }}
      onDragLeave={() => onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
      className={`w-full rounded-2xl border-2 border-dashed p-10 text-center transition text-ink ${
        dragOver
          ? "border-peach-deep bg-peach-soft/40 scale-[1.01]"
          : "border-ink-soft bg-cream-deep/20 hover:bg-cream-deep/40"
      }`}
    >
      <PixelIcon name="upload" size={42} className="mb-2" />
      <p className="font-bold text-ink">drop a PDF here</p>
      <p className="text-sm text-ink-soft mt-1 font-medium">
        or click to browse
      </p>
    </button>
  );
}
