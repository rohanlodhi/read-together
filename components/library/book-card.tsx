"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/avatar";
import { PixelIcon } from "@/components/pixel-icon";
import { deleteBook } from "@/app/actions/delete-book";
import { ChangeCoverDialog } from "./change-cover-dialog";

const ACCENT_FILL: Record<string, string> = {
  peach: "bg-peach",
  lavender: "bg-lavender",
  sage: "bg-sage",
  rose: "bg-rose",
  sun: "bg-sun",
};

export type BookCardProps = {
  id: string;
  title: string;
  author: string | null;
  totalPages: number | null;
  coverSigned: string | null;
  myPage: number | null;
  me: {
    userId: string;
    displayName: string;
    accent: string;
  };
  partner: {
    userId: string;
    displayName: string;
    accent: string;
    page: number | null;
  } | null;
  index?: number;
};

export function BookCard(props: BookCardProps) {
  const {
    id,
    title,
    author,
    totalPages,
    coverSigned,
    myPage,
    me,
    partner,
    index = 0,
  } = props;

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const myPct =
    myPage && totalPages ? Math.min(100, (myPage / totalPages) * 100) : 0;
  const partnerPct =
    partner?.page && totalPages
      ? Math.min(100, (partner.page / totalPages) * 100)
      : 0;
  const samePage =
    myPage && partner?.page && myPage === partner.page ? true : false;

  function onRemove() {
    startTransition(async () => {
      const res = await deleteBook({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("removed from the library");
      setConfirmOpen(false);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 180,
        damping: 22,
        delay: 0.04 * index,
      }}
      whileHover={{ y: -3 }}
      className="group relative"
    >
      <Link
        href={`/read/${id}`}
        className="block card-soft overflow-hidden hover:shadow-pop transition-shadow"
      >
        <div className="aspect-[3/4] relative bg-gradient-to-br from-peach-soft via-cream-deep to-lavender-soft border-b-2 border-ink">
          {coverSigned ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSigned}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-ink">
              <PixelIcon name="book" size={64} />
            </div>
          )}

          {samePage && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="absolute top-2 right-2 pill"
              style={{ background: "var(--color-rose-soft)" }}
            >
              <PixelIcon
                name="heart"
                size={12}
                className="text-rose-deep"
              />
              same page
            </motion.div>
          )}
        </div>

        <div className="p-3.5">
          <h3
            className="font-display text-xl leading-[1.1] text-ink line-clamp-2"
            style={{ fontWeight: 700 }}
          >
            {title}
          </h3>
          {author && (
            <p className="text-xs text-ink-soft mt-0.5 line-clamp-1 font-medium">
              {author}
            </p>
          )}

          <div className="mt-3 space-y-2">
            <ProgressRow
              userId={me.userId}
              accent={me.accent}
              label="you"
              page={myPage}
              total={totalPages}
              pct={myPct}
            />
            {partner && (
              <ProgressRow
                userId={partner.userId}
                accent={partner.accent}
                label={partner.displayName}
                page={partner.page}
                total={totalPages}
                pct={partnerPct}
              />
            )}
          </div>
        </div>
      </Link>

      {/* kebab menu — outside the Link so it doesn't trigger navigation */}
      <div className="absolute top-2 left-2 z-10">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="rounded-full bg-paper/90 border-2 border-ink w-8 h-8 flex items-center justify-center text-ink opacity-0 group-hover:opacity-100 focus:opacity-100 transition shadow-soft"
          aria-label="book options"
          style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
        >
          <PixelIcon name="more" size={14} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <>
              <button
                aria-label="close menu"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
                className="fixed inset-0 z-10 cursor-default"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="absolute top-10 left-0 z-20 bg-paper border-2 border-ink rounded-xl py-1.5 min-w-[160px]"
                style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    setCoverOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm font-bold text-ink hover:bg-peach-soft/40 transition flex items-center gap-2"
                >
                  <PixelIcon name="image" size={14} />
                  change cover
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    setConfirmOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm font-bold text-rose-deep hover:bg-rose-soft/40 transition flex items-center gap-2"
                >
                  <PixelIcon name="trash" size={14} />
                  remove book
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => !pending && setConfirmOpen(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ y: 12, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              className="card-soft p-6 max-w-sm w-full relative text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <PixelIcon
                name="trash"
                size={36}
                className="mb-1 text-rose-deep"
              />
              <h3
                className="font-display text-2xl text-ink leading-tight"
                style={{ fontWeight: 700 }}
              >
                remove this book?
              </h3>
              <p className="text-sm text-ink-soft mt-2 font-medium">
                <span className="font-bold">{title}</span> — bookmarks,
                highlights and reactions for both of you will go with it.
              </p>
              <div className="flex gap-2 justify-center mt-5">
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={pending}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-ink-soft hover:bg-cream-deep/50 transition disabled:opacity-40"
                >
                  keep it
                </button>
                <button
                  onClick={onRemove}
                  disabled={pending}
                  className="rounded-lg border-2 border-ink bg-rose-soft px-4 py-2 text-sm font-bold text-rose-deep disabled:opacity-40"
                  style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
                >
                  {pending ? "removing…" : "remove"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChangeCoverDialog
        bookId={id}
        title={title}
        open={coverOpen}
        onClose={() => setCoverOpen(false)}
      />
    </motion.div>
  );
}

function ProgressRow({
  userId,
  accent,
  label,
  page,
  total,
  pct,
}: {
  userId: string;
  accent: string;
  label: string;
  page: number | null;
  total: number | null;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar seed={userId} accent={accent} size={22} />
      <span className="text-xs font-bold text-ink-soft min-w-0 truncate">
        {label}
      </span>
      <div
        className="flex-1 h-1.5 bg-cream-deep rounded-full overflow-hidden"
        style={{ border: "1.5px solid var(--color-ink-soft)" }}
      >
        <div
          className={`h-full ${ACCENT_FILL[accent] ?? "bg-peach"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-ink-faint font-bold tabular-nums">
        {page && total ? `p.${page}` : page ? `p.${page}` : "—"}
      </span>
    </div>
  );
}
