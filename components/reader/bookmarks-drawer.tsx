"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

const ACCENT_RING: Record<string, string> = {
  peach: "ring-peach-deep",
  lavender: "ring-lavender-deep",
  sage: "ring-sage-deep",
  rose: "ring-rose-deep",
  sun: "ring-sun-deep",
};

export type BookmarkRow = {
  id: string;
  user_id: string;
  book_id: string;
  page: number;
  label: string | null;
  color: string | null;
  created_at: string;
};

export type DrawerProfile = {
  userId: string;
  displayName: string;
  accent: string;
};

export function BookmarksDrawer({
  open,
  onClose,
  bookmarks,
  me,
  partner,
  currentPage,
  isCurrentBookmarkedByMe,
  onToggleCurrentPage,
  onJump,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  bookmarks: BookmarkRow[];
  me: DrawerProfile | null;
  partner: DrawerProfile | null;
  currentPage: number;
  isCurrentBookmarkedByMe: boolean;
  onToggleCurrentPage: () => void;
  onJump: (page: number) => void;
  onDelete: (bookmarkId: string) => void;
}) {
  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sorted = [...bookmarks].sort((a, b) => a.page - b.page);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[78dvh] bg-cream border-t-2 border-ink rounded-t-3xl flex flex-col"
            style={{
              boxShadow: "0 -6px 0 0 var(--color-ink)",
              paddingBottom:
                "calc(0.75rem + env(safe-area-inset-bottom, 0))",
            }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b-2 border-ink-soft/40">
              <div className="flex items-center gap-2 text-ink">
                <PixelIcon name="bookmarks" size={22} />
                <h2
                  className="font-display text-2xl leading-none"
                  style={{ fontWeight: 700 }}
                >
                  bookmarks
                </h2>
                {sorted.length > 0 && (
                  <span className="text-xs font-bold text-ink-faint tabular-nums">
                    {sorted.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="close"
                className="rounded-lg p-1.5 text-ink hover:bg-cream-deep/60 transition"
              >
                <PixelIcon name="close" size={20} />
              </button>
            </div>

            <div className="px-5 py-3 border-b-2 border-ink-soft/40">
              <button
                onClick={onToggleCurrentPage}
                className={cn(
                  "w-full flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 font-bold text-sm transition",
                  isCurrentBookmarkedByMe
                    ? "border-ink bg-peach-soft text-ink"
                    : "border-ink bg-paper text-ink hover:bg-peach-soft/40",
                )}
                style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
              >
                <span className="flex items-center gap-2">
                  <PixelIcon
                    name="bookmark"
                    size={18}
                    className={
                      isCurrentBookmarkedByMe ? "text-rose-deep" : "text-ink"
                    }
                  />
                  {isCurrentBookmarkedByMe
                    ? `bookmarked page ${currentPage}`
                    : `bookmark page ${currentPage}`}
                </span>
                <span className="text-xs text-ink-faint">
                  {isCurrentBookmarkedByMe ? "tap to remove" : "tap to add"}
                </span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-3 py-2">
              {sorted.length === 0 ? (
                <div className="text-center py-12 px-5">
                  <PixelIcon
                    name="bookmark"
                    size={42}
                    className="text-ink-faint mb-2"
                  />
                  <p className="font-bold text-ink-soft">no bookmarks yet</p>
                  <p className="text-xs text-ink-faint mt-1 font-medium">
                    bookmark a page above to save your spot
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5 py-1">
                  {sorted.map((b) => {
                    const isMine = me && b.user_id === me.userId;
                    const owner = isMine
                      ? me
                      : partner && b.user_id === partner.userId
                        ? partner
                        : null;
                    const isCurrent = b.page === currentPage;
                    return (
                      <li key={b.id}>
                        <div
                          className={cn(
                            "flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition",
                            isCurrent
                              ? "border-ink bg-paper"
                              : "border-ink-soft/40 bg-paper/60 hover:bg-paper",
                          )}
                        >
                          <button
                            onClick={() => {
                              onJump(b.page);
                              onClose();
                            }}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            {owner ? (
                              <Avatar
                                seed={owner.userId}
                                accent={owner.accent}
                                size={28}
                              />
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-cream-deep" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-display text-lg leading-none text-ink"
                                  style={{ fontWeight: 700 }}
                                >
                                  page {b.page}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] uppercase tracking-wide font-bold text-rose-deep">
                                    here
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ink-soft font-semibold mt-0.5 truncate">
                                {owner
                                  ? isMine
                                    ? "you"
                                    : owner.displayName
                                  : "someone"}
                                {b.label ? ` · ${b.label}` : ""}
                              </p>
                            </div>
                          </button>
                          {isMine && (
                            <button
                              onClick={() => onDelete(b.id)}
                              aria-label="delete bookmark"
                              className="rounded-lg p-1.5 text-ink-faint hover:text-rose-deep hover:bg-rose-soft/40 transition shrink-0"
                            >
                              <PixelIcon name="close" size={16} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// silence unused-import linter when ring colors are referenced via cn() string lookup
void ACCENT_RING;
