"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { PixelIcon } from "@/components/pixel-icon";
import { BookCard } from "./book-card";
import { UploadBookDialog } from "./upload-book-dialog";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/lib/use-presence";

type Book = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  cover_signed: string | null;
  my_page: number | null;
  partner_page: number | null;
};

type Profile = {
  id: string;
  display_name: string;
  emoji: string;
  accent: string;
};

export function LibraryView({
  books: initialBooks,
  me,
  partner,
}: {
  books: Book[];
  me: Profile;
  partner: Profile | null;
}) {
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [lastInitial, setLastInitial] = useState<Book[]>(initialBooks);
  const router = useRouter();

  const present = usePresence(me.id, { kind: "library" });
  const partnerPresence = useMemo(
    () => (partner ? present.find((p) => p.user_id === partner.id) : null),
    [present, partner],
  );
  const partnerOnline = Boolean(partnerPresence);
  const partnerReadingBookId =
    partnerPresence?.location.kind === "book"
      ? partnerPresence.location.book_id
      : null;

  // Re-derive from server props when revalidatePath updates them.
  if (lastInitial !== initialBooks) {
    setLastInitial(initialBooks);
    setBooks(initialBooks);
  }

  // Realtime: progress updates + new/removed books.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("library")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reading_progress",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { user_id: string; book_id: string; page: number }
            | null;
          if (!row) return;
          const isMine = row.user_id === me.id;
          const isPartners = partner && row.user_id === partner.id;
          if (!isMine && !isPartners) return;

          setBooks((prev) =>
            prev.map((b) => {
              if (b.id !== row.book_id) return b;
              if (payload.eventType === "DELETE") {
                return {
                  ...b,
                  my_page: isMine ? null : b.my_page,
                  partner_page: isPartners ? null : b.partner_page,
                };
              }
              return {
                ...b,
                my_page: isMine ? row.page : b.my_page,
                partner_page: isPartners ? row.page : b.partner_page,
              };
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "books",
        },
        () => {
          // New book needs a signed cover URL from the server.
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "books",
        },
        (payload) => {
          const row = payload.old as { id?: string };
          if (!row.id) return;
          setBooks((prev) => prev.filter((b) => b.id !== row.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me.id, partner, router]);

  return (
    <>
      <main className="flex-1 px-5 sm:px-8 pb-16 pt-2 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-end justify-between gap-3 mb-6 sm:mb-10 mt-2"
          >
            <div>
              <h1
                className="font-display text-5xl sm:text-6xl text-ink leading-none tracking-tight"
                style={{ fontWeight: 700 }}
              >
                our library
              </h1>
              <p className="text-ink-soft mt-2 text-sm sm:text-base font-medium">
                {books.length === 0
                  ? "no books yet — add one to start reading together"
                  : `${books.length} book${books.length === 1 ? "" : "s"} on the shelf`}
              </p>
            </div>
            <motion.button
              onClick={() => setOpen(true)}
              whileTap={{ scale: 0.97 }}
              className="btn-bouncy whitespace-nowrap"
            >
              <PixelIcon name="plus" size={18} />
              add a book
            </motion.button>
          </motion.div>

          {books.length === 0 ? (
            <EmptyState onAdd={() => setOpen(true)} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {books.map((b, i) => (
                <BookCard
                  key={b.id}
                  index={i}
                  id={b.id}
                  title={b.title}
                  author={b.author}
                  totalPages={b.total_pages}
                  coverSigned={b.cover_signed}
                  myPage={b.my_page}
                  me={{
                    userId: me.id,
                    displayName: me.display_name,
                    accent: me.accent,
                  }}
                  partner={
                    partner
                      ? {
                          userId: partner.id,
                          displayName: partner.display_name,
                          accent: partner.accent,
                          page: b.partner_page,
                          online: partnerOnline,
                          inThisBook: partnerReadingBookId === b.id,
                        }
                      : null
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <UploadBookDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
      className="card-soft p-10 sm:p-16 text-center max-w-xl mx-auto mt-8"
    >
      <div className="mb-3 flex items-center justify-center gap-1 text-ink">
        <PixelIcon name="book" size={56} />
        <PixelIcon name="heart" size={36} className="text-rose-deep" />
      </div>
      <h2
        className="font-display text-3xl text-ink leading-none"
        style={{ fontWeight: 700 }}
      >
        an empty shelf
      </h2>
      <p className="text-ink-soft mt-3 max-w-sm mx-auto font-medium">
        add the first book and your reading lives can finally happen on the
        same page
      </p>
      <motion.button
        onClick={onAdd}
        whileTap={{ scale: 0.97 }}
        className="btn-bouncy mt-6"
      >
        <PixelIcon name="gift" size={18} />
        add a book
      </motion.button>
    </motion.div>
  );
}
