"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import toast from "react-hot-toast";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// react-pdf / pdfjs-dist reference DOMMatrix at module evaluation, which
// crashes during SSR. Load them client-only.
//
// Worker URL is pinned to whatever version react-pdf's nested pdfjs-dist
// actually reports (`pdfjs.version`) — react-pdf 10.x bundles its own
// pdfjs-dist that may differ from the top-level one. Always overwrite
// unconditionally because react-pdf pre-sets workerSrc to a bare module
// specifier that the browser can't resolve.
const Document = dynamic(
  () =>
    import("react-pdf").then((m) => {
      if (typeof window !== "undefined") {
        m.pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${m.pdfjs.version}/build/pdf.worker.min.mjs`;
      }
      return m.Document;
    }),
  { ssr: false },
);
const Page = dynamic(
  () => import("react-pdf").then((m) => m.Page),
  { ssr: false },
);
import { PixelIcon } from "@/components/pixel-icon";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  BookmarksDrawer,
  type BookmarkRow,
} from "@/components/reader/bookmarks-drawer";
import { HighlightLayer } from "@/components/reader/highlight-layer";
import { MarkCanvas } from "@/components/reader/mark-canvas";
import { AnnotationBubble } from "@/components/reader/annotation-bubble";
import { ReactionsLayer } from "@/components/reader/reactions-layer";
import { ReactCanvas } from "@/components/reader/react-canvas";
import type { AnnotationRow, ReactionRow, Rect } from "@/components/reader/types";
import type { IconName } from "@/components/pixel-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePresence } from "@/lib/use-presence";

const SWIPE_OFFSET = 60;
const SWIPE_VELOCITY = 400;
const AUTO_HIDE_MS = 3500;
const DEFAULT_ASPECT = 0.7727;

type Me = {
  userId: string;
  displayName: string;
  accent: string;
};

type Partner = {
  userId: string;
  displayName: string;
  accent: string;
};

export function ReaderView({
  bookId,
  bookTitle,
  bookAuthor,
  pdfUrl,
  totalPages: initialTotal,
  initialPage,
  initialBookmarks,
  initialAnnotations,
  initialReactions,
  initialPartnerPage,
  me,
  partner,
}: {
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
  pdfUrl: string;
  totalPages: number | null;
  initialPage: number;
  initialBookmarks: BookmarkRow[];
  initialAnnotations: AnnotationRow[];
  initialReactions: ReactionRow[];
  initialPartnerPage: number | null;
  me: Me | null;
  partner: Partner | null;
}) {
  const [page, setPage] = useState<number>(initialPage);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [total, setTotal] = useState<number>(initialTotal ?? 0);
  const [aspect, setAspect] = useState<number>(DEFAULT_ASPECT);
  const [docError, setDocError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [chromeVisible, setChromeVisible] = useState(true);
  const [partnerPage, setPartnerPage] = useState<number | null>(
    initialPartnerPage,
  );
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>(initialBookmarks);
  const [annotations, setAnnotations] =
    useState<AnnotationRow[]>(initialAnnotations);
  const [reactions, setReactions] = useState<ReactionRow[]>(initialReactions);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [markMode, setMarkMode] = useState(false);
  const [reactMode, setReactMode] = useState(false);
  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(
    null,
  );
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromePinned = useRef(false);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const [incomingHearts, setIncomingHearts] = useState<
    Array<{ id: string; x: number }>
  >([]);

  const burstHeart = useCallback(() => {
    const id = crypto.randomUUID();
    // small horizontal jitter so back-to-back hearts don't stack
    const x = 0.5 + (Math.random() - 0.5) * 0.3;
    setIncomingHearts((hs) => [...hs, { id, x }]);
    setTimeout(() => {
      setIncomingHearts((hs) => hs.filter((h) => h.id !== id));
    }, 2400);
  }, []);

  // ----------------------------------------------------------------- presence
  const present = usePresence(
    me?.userId ?? null,
    me ? { kind: "book", book_id: bookId, page } : null,
  );
  const partnerPresence = useMemo(
    () =>
      partner ? present.find((p) => p.user_id === partner.userId) : null,
    [present, partner],
  );
  const partnerOnline = Boolean(partnerPresence);
  const partnerInThisBook =
    partnerPresence?.location.kind === "book" &&
    partnerPresence.location.book_id === bookId;

  const sendHeart = useCallback(() => {
    burstHeart(); // immediate local feedback
    const ch = channelRef.current;
    if (!ch || !me) return;
    ch.send({
      type: "broadcast",
      event: "heart",
      payload: { from: me.userId, t: Date.now() },
    }).catch((e) => console.warn("heart send failed", e));
  }, [burstHeart, me]);
  const gestureRef = useRef<{
    mode: "idle" | "pinch" | "pan";
    startDist?: number;
    startScale?: number;
    startX?: number;
    startY?: number;
    startPanX?: number;
    startPanY?: number;
  }>({ mode: "idle" });
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);

  const MAX_SCALE = 4;
  const MIN_SCALE = 1;
  const isZoomed = scale > 1.001;

  // Reset zoom when changing pages.
  const [lastPageForZoom, setLastPageForZoom] = useState(page);
  if (lastPageForZoom !== page) {
    setLastPageForZoom(page);
    if (isZoomed) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }

  const setZoom = useCallback(
    (nextScale: number) => {
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      setScale(s);
      if (s === 1) setPan({ x: 0, y: 0 });
    },
    [],
  );

  const file = useMemo(() => ({ url: pdfUrl }), [pdfUrl]);

  // ------------------------------------------------------------------- size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // ----------------------------------------------------------------- chrome
  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHide();
    if (chromePinned.current) return;
    hideTimer.current = setTimeout(
      () => setChromeVisible(false),
      AUTO_HIDE_MS,
    );
  }, [clearHide]);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const pinChrome = useCallback(() => {
    chromePinned.current = true;
    clearHide();
    setChromeVisible(true);
  }, [clearHide]);

  const unpinChrome = useCallback(() => {
    chromePinned.current = false;
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return () => clearHide();
  }, [scheduleHide, clearHide]);

  // ----------------------------------------------------------------- realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`book:${bookId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reading_progress",
          filter: `book_id=eq.${bookId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as
            | { user_id: string; page: number }
            | null;
          if (!row || !partner) return;
          if (row.user_id !== partner.userId) return;
          if (payload.eventType === "DELETE") {
            setPartnerPage(null);
          } else {
            const newRow = payload.new as { page: number };
            setPartnerPage(newRow.page);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `book_id=eq.${bookId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as BookmarkRow;
            setBookmarks((bs) =>
              bs.some((b) => b.id === row.id) ? bs : [...bs, row],
            );
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id?: string };
            if (!row.id) return;
            setBookmarks((bs) => bs.filter((b) => b.id !== row.id));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as BookmarkRow;
            setBookmarks((bs) =>
              bs.map((b) => (b.id === row.id ? row : b)),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "annotations",
          filter: `book_id=eq.${bookId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as AnnotationRow;
            setAnnotations((as) =>
              as.some((a) => a.id === row.id) ? as : [...as, row],
            );
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id?: string };
            if (!row.id) return;
            setAnnotations((as) => as.filter((a) => a.id !== row.id));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as AnnotationRow;
            setAnnotations((as) =>
              as.map((a) => (a.id === row.id ? row : a)),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
          filter: `book_id=eq.${bookId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as ReactionRow;
            setReactions((rs) =>
              rs.some((r) => r.id === row.id) ? rs : [...rs, row],
            );
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id?: string };
            if (!row.id) return;
            setReactions((rs) => rs.filter((r) => r.id !== row.id));
          }
        },
      )
      .on("broadcast", { event: "heart" }, (msg) => {
        const from = (msg.payload as { from?: string } | null)?.from;
        if (!from || (me && from === me.userId)) return;
        burstHeart();
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`realtime channel status: ${status}`);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [bookId, partner, me, burstHeart]);

  // ----------------------------------------------------- refetch on refocus
  // Safety net: if realtime dropped a message while the tab was backgrounded
  // we re-pull the collab tables when the user returns.
  useEffect(() => {
    const onFocus = async () => {
      if (document.visibilityState !== "visible") return;
      const supabase = createClient();
      const [bm, an, rx] = await Promise.all([
        supabase
          .from("bookmarks")
          .select("id, user_id, book_id, page, label, color, created_at")
          .eq("book_id", bookId),
        supabase
          .from("annotations")
          .select(
            "id, user_id, book_id, page, kind, rects, selected_text, note_content, color, created_at",
          )
          .eq("book_id", bookId),
        supabase
          .from("reactions")
          .select("id, user_id, book_id, page, emoji, x, y, created_at")
          .eq("book_id", bookId),
      ]);
      if (bm.data) setBookmarks(bm.data);
      if (an.data) setAnnotations(an.data as AnnotationRow[]);
      if (rx.data) setReactions(rx.data as ReactionRow[]);
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [bookId]);

  // ----------------------------------------------------------------- save
  useEffect(() => {
    if (page < 1) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("reading_progress").upsert(
        {
          user_id: user.id,
          book_id: bookId,
          page,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" },
      );
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [page, bookId]);

  // ------------------------------------------------------------- nav
  const goPrev = useCallback(
    (revealChrome = true) => {
      setDirection(-1);
      setPage((p) => Math.max(1, p - 1));
      if (revealChrome) showChrome();
    },
    [showChrome],
  );

  const goNext = useCallback(
    (revealChrome = true) => {
      setDirection(1);
      setPage((p) => (total ? Math.min(total, p + 1) : p + 1));
      if (revealChrome) showChrome();
    },
    [total, showChrome],
  );

  const jumpTo = useCallback(
    (p: number) => {
      setDirection(p > page ? 1 : -1);
      setPage(p);
      showChrome();
    },
    [page, showChrome],
  );

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
      )
        return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        setDirection(-1);
        setPage(1);
        showChrome();
      } else if (e.key === "End" && total) {
        setDirection(1);
        setPage(total);
        showChrome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, goNext, goPrev, showChrome]);

  // ----------------------------------------------------------- page sizing
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("fullscreen toggle failed", e);
      // iOS Safari etc. — silently fall through.
    }
  }, []);

  const { pageWidth, pageHeight, ready } = useMemo(() => {
    if (size.w === 0 || size.h === 0) {
      return { pageWidth: 0, pageHeight: 0, ready: false };
    }
    const isMobile = size.w < 640;
    const pad = fullscreen ? 0 : isMobile ? 6 : 28;
    const maxW = size.w - pad * 2;
    const maxH = size.h - pad * 2;
    const w = Math.floor(Math.min(maxW, maxH * aspect));
    const h = Math.floor(w / aspect);
    return { pageWidth: w, pageHeight: h, ready: true };
  }, [size.w, size.h, aspect, fullscreen]);

  // ----------------------------------------------------------------- swipe
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (
      offset.x < -SWIPE_OFFSET ||
      (offset.x < -10 && velocity.x < -SWIPE_VELOCITY)
    ) {
      goNext(false);
    } else if (
      offset.x > SWIPE_OFFSET ||
      (offset.x > 10 && velocity.x > SWIPE_VELOCITY)
    ) {
      goPrev(false);
    }
  };

  // ----------------------------------------------------------- bookmarks
  const myBookmarkOnCurrentPage = useMemo(
    () =>
      me ? bookmarks.find((b) => b.user_id === me.userId && b.page === page) : null,
    [bookmarks, me, page],
  );
  const partnerBookmarkOnCurrentPage = useMemo(
    () =>
      partner
        ? bookmarks.find(
            (b) => b.user_id === partner.userId && b.page === page,
          )
        : null,
    [bookmarks, partner, page],
  );

  const toggleCurrentBookmark = useCallback(async () => {
    if (!me) return;
    const supabase = createClient();
    if (myBookmarkOnCurrentPage) {
      const id = myBookmarkOnCurrentPage.id;
      setBookmarks((bs) => bs.filter((b) => b.id !== id));
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error("couldn't remove bookmark");
        setBookmarks((bs) =>
          bs.some((b) => b.id === id) ? bs : [...bs, myBookmarkOnCurrentPage],
        );
      }
    } else {
      const newRow: BookmarkRow = {
        id: crypto.randomUUID(),
        user_id: me.userId,
        book_id: bookId,
        page,
        label: null,
        color: me.accent,
        created_at: new Date().toISOString(),
      };
      setBookmarks((bs) => [...bs, newRow]);
      const { error } = await supabase.from("bookmarks").insert({
        id: newRow.id,
        user_id: me.userId,
        book_id: bookId,
        page,
        color: me.accent,
      });
      if (error) {
        toast.error("couldn't save bookmark");
        setBookmarks((bs) => bs.filter((b) => b.id !== newRow.id));
      }
    }
  }, [bookId, me, myBookmarkOnCurrentPage, page]);

  const deleteBookmark = useCallback(
    async (id: string) => {
      const prev = bookmarks;
      setBookmarks((bs) => bs.filter((b) => b.id !== id));
      const supabase = createClient();
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error("couldn't delete bookmark");
        setBookmarks(prev);
      }
    },
    [bookmarks],
  );

  // ----------------------------------------------------------- annotations
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === page),
    [annotations, page],
  );

  const openAnnotation = useMemo(
    () =>
      openAnnotationId
        ? annotations.find((a) => a.id === openAnnotationId) ?? null
        : null,
    [annotations, openAnnotationId],
  );

  const annotationOwner = useCallback(
    (userId: string) => {
      if (me && userId === me.userId)
        return { name: me.displayName, accent: me.accent, isMine: true };
      if (partner && userId === partner.userId)
        return {
          name: partner.displayName,
          accent: partner.accent,
          isMine: false,
        };
      return { name: "someone", accent: "peach", isMine: false };
    },
    [me, partner],
  );

  const commitHighlight = useCallback(
    async (rect: Rect) => {
      if (!me) return;
      const supabase = createClient();
      const optimistic: AnnotationRow = {
        id: crypto.randomUUID(),
        user_id: me.userId,
        book_id: bookId,
        page,
        kind: "highlight",
        rects: [rect],
        selected_text: null,
        note_content: null,
        color: me.accent,
        created_at: new Date().toISOString(),
      };
      setAnnotations((as) => [...as, optimistic]);
      setMarkMode(false);
      setOpenAnnotationId(optimistic.id);
      const { error } = await supabase.from("annotations").insert({
        id: optimistic.id,
        user_id: me.userId,
        book_id: bookId,
        page,
        kind: "highlight",
        rects: [rect],
        color: me.accent,
      });
      if (error) {
        toast.error("couldn't save highlight");
        setAnnotations((as) => as.filter((a) => a.id !== optimistic.id));
        setOpenAnnotationId(null);
      }
    },
    [bookId, me, page],
  );

  const saveAnnotationNote = useCallback(
    async (id: string, note: string) => {
      const trimmed = note.trim();
      const prev = annotations.find((a) => a.id === id);
      if (!prev) return;
      setAnnotations((as) =>
        as.map((a) =>
          a.id === id ? { ...a, note_content: trimmed || null } : a,
        ),
      );
      const supabase = createClient();
      const { error } = await supabase
        .from("annotations")
        .update({ note_content: trimmed || null })
        .eq("id", id);
      if (error) {
        toast.error("couldn't save note");
        setAnnotations((as) => as.map((a) => (a.id === id ? prev : a)));
      }
    },
    [annotations],
  );

  const deleteAnnotation = useCallback(
    async (id: string) => {
      const prev = annotations;
      setAnnotations((as) => as.filter((a) => a.id !== id));
      setOpenAnnotationId((cur) => (cur === id ? null : cur));
      const supabase = createClient();
      const { error } = await supabase
        .from("annotations")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error("couldn't delete");
        setAnnotations(prev);
      }
    },
    [annotations],
  );

  // ----------------------------------------------------------- reactions
  const pageReactions = useMemo(
    () => reactions.filter((r) => r.page === page),
    [reactions, page],
  );

  const dropReaction = useCallback(
    async (emoji: IconName, x: number, y: number) => {
      if (!me) return;
      const supabase = createClient();
      const optimistic: ReactionRow = {
        id: crypto.randomUUID(),
        user_id: me.userId,
        book_id: bookId,
        page,
        emoji,
        x,
        y,
        created_at: new Date().toISOString(),
      };
      setReactions((rs) => [...rs, optimistic]);
      setReactMode(false);
      const { error } = await supabase.from("reactions").insert({
        id: optimistic.id,
        user_id: me.userId,
        book_id: bookId,
        page,
        emoji,
        x,
        y,
      });
      if (error) {
        toast.error("couldn't drop sticker");
        setReactions((rs) => rs.filter((r) => r.id !== optimistic.id));
      }
    },
    [bookId, me, page],
  );

  const deleteReaction = useCallback(
    async (id: string) => {
      const prev = reactions;
      setReactions((rs) => rs.filter((r) => r.id !== id));
      const supabase = createClient();
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("id", id);
      if (error) {
        toast.error("couldn't remove");
        setReactions(prev);
      }
    },
    [reactions],
  );

  const reactionAccentFor = useCallback(
    (userId: string) => annotationOwner(userId).accent,
    [annotationOwner],
  );

  const dragDisabled = markMode || reactMode || isZoomed;

  const samePage = partnerPage === page;
  const canPrev = page > 1;
  const canNext = total === 0 || page < total;
  const isBookmarked = Boolean(myBookmarkOnCurrentPage);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-cream overflow-hidden select-none"
      style={{ height: "100dvh" }}
    >
      {/* ------- TOP CHROME ------- */}
      <AnimatePresence>
        {chromeVisible && (
          <motion.header
            key="top-chrome"
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -56, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute top-0 left-0 right-0 z-30 px-3 sm:px-5 py-2.5 flex items-center gap-3 bg-cream/95 backdrop-blur border-b-2 border-ink-soft"
            style={{
              paddingTop: "calc(0.625rem + env(safe-area-inset-top, 0))",
            }}
          >
            <Link
              href="/"
              className="flex items-center gap-1.5 text-ink-soft hover:text-ink transition-colors shrink-0"
              onMouseEnter={pinChrome}
              onMouseLeave={unpinChrome}
            >
              <PixelIcon name="arrow-left" size={18} />
              <PixelIcon name="book" size={18} />
              <span className="text-xs font-bold hidden sm:inline">
                library
              </span>
            </Link>

            <div className="flex-1 min-w-0 text-center">
              <h1
                className="font-display text-base sm:text-lg text-ink leading-tight truncate"
                style={{ fontWeight: 700 }}
              >
                {bookTitle}
              </h1>
              {bookAuthor && (
                <p className="text-[10px] sm:text-xs text-ink-faint truncate font-medium leading-none mt-0.5">
                  {bookAuthor}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle size="sm" />
              <button
                onClick={() => {
                  toggleFullscreen();
                  pinChrome();
                }}
                aria-label={fullscreen ? "exit fullscreen" : "fullscreen"}
                title={fullscreen ? "exit fullscreen" : "fullscreen"}
                className={`rounded-lg border-2 border-ink transition shrink-0 px-2 py-1.5 ${
                  fullscreen
                    ? "bg-sage-soft text-ink"
                    : "bg-paper text-ink hover:bg-peach-soft/40"
                }`}
                style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
              >
                <PixelIcon
                  name={fullscreen ? "collapse" : "expand"}
                  size={14}
                />
              </button>
              <button
                onClick={() => {
                  setMarkMode((v) => !v);
                  setReactMode(false);
                  setOpenAnnotationId(null);
                  pinChrome();
                }}
                aria-label="highlight mode"
                className={`rounded-lg border-2 border-ink px-2 py-1.5 transition ${
                  markMode
                    ? "bg-sun text-ink"
                    : "bg-paper text-ink hover:bg-peach-soft/40"
                }`}
                style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
              >
                <PixelIcon name="edit" size={14} />
              </button>
              <button
                onClick={() => {
                  setReactMode((v) => !v);
                  setMarkMode(false);
                  setOpenAnnotationId(null);
                  pinChrome();
                }}
                aria-label="react"
                className={`rounded-lg border-2 border-ink px-2 py-1.5 transition ${
                  reactMode
                    ? "bg-rose-soft text-rose-deep"
                    : "bg-paper text-ink hover:bg-peach-soft/40"
                }`}
                style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
              >
                <PixelIcon name="heart" size={14} />
              </button>
              <div className="flex items-center -space-x-2">
                {partner && (
                  <motion.button
                    onClick={sendHeart}
                    whileTap={{ scale: 0.9 }}
                    title={
                      partnerOnline
                        ? `${partner.displayName} is online — tap to send a heart`
                        : `send ${partner.displayName} a heart`
                    }
                    aria-label={`send ${partner.displayName} a heart`}
                    className="relative rounded-full border-2 border-paper hover:scale-110 transition"
                  >
                    <Avatar
                      seed={partner.userId}
                      accent={partner.accent}
                      size={22}
                      online={partnerOnline}
                    />
                    <span
                      className="absolute -bottom-1 -left-1 inline-flex items-center justify-center rounded-full bg-rose-deep text-paper border-2 border-paper"
                      style={{ width: 14, height: 14 }}
                    >
                      <PixelIcon name="heart" size={8} />
                    </span>
                  </motion.button>
                )}
                {me && (
                  <div
                    title={me.displayName}
                    className="relative rounded-full border-2 border-paper"
                  >
                    <Avatar seed={me.userId} accent={me.accent} size={22} />
                  </div>
                )}
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ------- PDF PAGE + SWIPE ------- */}
      <div className="absolute inset-0 flex items-center justify-center">
        {ready && (
          <Document
            file={file}
            onLoadSuccess={({ numPages }) => {
              setTotal(numPages);
              setDocError(null);
            }}
            onLoadError={(e) => setDocError(e.message)}
            loading={<DocLoading />}
            error={
              <DocError message={docError ?? "Could not open the PDF."} />
            }
          >
            <motion.div
              drag={dragDisabled ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              dragSnapToOrigin
              onTap={(e, info) => {
                if (markMode || reactMode) return;
                if (isZoomed) return;
                // double-tap detection for zoom toggle
                const now = Date.now();
                const last = lastTapRef.current;
                if (
                  last &&
                  now - last.t < 300 &&
                  Math.hypot(
                    info.point.x - last.x,
                    info.point.y - last.y,
                  ) < 24
                ) {
                  setZoom(2);
                  lastTapRef.current = null;
                  return;
                }
                lastTapRef.current = {
                  t: now,
                  x: info.point.x,
                  y: info.point.y,
                };
                if (openAnnotationId) {
                  setOpenAnnotationId(null);
                  unpinChrome();
                  return;
                }
                setChromeVisible((v) => !v);
              }}
              onDragEnd={onDragEnd}
              className="relative"
              style={{
                width: pageWidth,
                height: pageHeight,
                maxWidth: "100%",
                maxHeight: "100%",
                touchAction:
                  dragDisabled || isZoomed ? "none" : "pan-y",
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  const [a, b] = [e.touches[0], e.touches[1]];
                  gestureRef.current = {
                    mode: "pinch",
                    startDist: Math.hypot(
                      a.clientX - b.clientX,
                      a.clientY - b.clientY,
                    ),
                    startScale: scale,
                  };
                } else if (e.touches.length === 1 && isZoomed) {
                  gestureRef.current = {
                    mode: "pan",
                    startX: e.touches[0].clientX,
                    startY: e.touches[0].clientY,
                    startPanX: pan.x,
                    startPanY: pan.y,
                  };
                }
              }}
              onTouchMove={(e) => {
                const g = gestureRef.current;
                if (g.mode === "pinch" && e.touches.length === 2) {
                  e.preventDefault();
                  const [a, b] = [e.touches[0], e.touches[1]];
                  const dist = Math.hypot(
                    a.clientX - b.clientX,
                    a.clientY - b.clientY,
                  );
                  const next =
                    ((g.startScale ?? 1) * dist) / (g.startDist ?? dist);
                  setZoom(next);
                } else if (
                  g.mode === "pan" &&
                  e.touches.length === 1 &&
                  isZoomed
                ) {
                  e.preventDefault();
                  const dx = e.touches[0].clientX - (g.startX ?? 0);
                  const dy = e.touches[0].clientY - (g.startY ?? 0);
                  setPan({
                    x: (g.startPanX ?? 0) + dx,
                    y: (g.startPanY ?? 0) + dy,
                  });
                }
              }}
              onTouchEnd={(e) => {
                if (e.touches.length === 0) {
                  gestureRef.current = { mode: "idle" };
                } else if (e.touches.length === 1 && isZoomed) {
                  gestureRef.current = {
                    mode: "pan",
                    startX: e.touches[0].clientX,
                    startY: e.touches[0].clientY,
                    startPanX: pan.x,
                    startPanY: pan.y,
                  };
                }
              }}
            >
              <AnimatePresence custom={direction} initial={false}>
                <motion.div
                  key={page}
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 320, damping: 32 },
                    opacity: { duration: 0.18 },
                  }}
                  className="absolute inset-0"
                >
                  <div
                    className="w-full h-full bg-white border-2 border-ink rounded-md overflow-hidden relative"
                    style={{ boxShadow: "5px 5px 0 0 var(--color-ink)" }}
                  >
                    <div
                      className="absolute inset-0 origin-center"
                      style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transition: gestureRef.current.mode === "idle"
                          ? "transform 0.18s ease"
                          : "none",
                        willChange: "transform",
                      }}
                    >
                      <Page
                        pageNumber={page}
                        width={pageWidth}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        onLoadSuccess={(pdfPage) => {
                          const vp = pdfPage.getViewport({ scale: 1 });
                          const a = vp.width / vp.height;
                          if (
                            Number.isFinite(a) &&
                            Math.abs(a - aspect) > 0.01
                          ) {
                            setAspect(a);
                          }
                        }}
                        loading={
                          <PageSkeleton width={pageWidth} aspect={aspect} />
                        }
                      />

                      <HighlightLayer
                        annotations={pageAnnotations}
                        onTap={(id) => {
                          setOpenAnnotationId(id);
                          pinChrome();
                        }}
                        selectedId={openAnnotationId}
                      />

                      <ReactionsLayer
                        reactions={pageReactions}
                        myUserId={me?.userId ?? null}
                        ownerAccent={reactionAccentFor}
                        onDeleteMine={deleteReaction}
                      />

                      {markMode && me && (
                        <MarkCanvas
                          accent={me.accent}
                          onCommit={commitHighlight}
                          onCancel={() => setMarkMode(false)}
                        />
                      )}

                      {reactMode && me && (
                        <ReactCanvas
                          onDrop={dropReaction}
                          onCancel={() => setReactMode(false)}
                        />
                      )}
                    </div>

                    {openAnnotation && (
                      <AnnotationBubble
                        key={openAnnotation.id}
                        annotation={openAnnotation}
                        ownerName={annotationOwner(openAnnotation.user_id).name}
                        ownerAccent={
                          annotationOwner(openAnnotation.user_id).accent
                        }
                        isMine={
                          annotationOwner(openAnnotation.user_id).isMine
                        }
                        onClose={() => {
                          setOpenAnnotationId(null);
                          unpinChrome();
                        }}
                        onSave={(note) =>
                          saveAnnotationNote(openAnnotation.id, note)
                        }
                        onDelete={() => deleteAnnotation(openAnnotation.id)}
                      />
                    )}
                  </div>

                  {/* Partner bookmark marker — small flag at top-right of page */}
                  {partnerBookmarkOnCurrentPage && partner && (
                    <PartnerBookmarkFlag accent={partner.accent} />
                  )}

                  {/* Partner presence — avatar floats on the page when they're here too */}
                  {partner && samePage && (
                    <PartnerPresenceBadge
                      userId={partner.userId}
                      accent={partner.accent}
                      displayName={partner.displayName}
                      onSendHeart={sendHeart}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </Document>
        )}
      </div>

      {/* ------- BOTTOM CHROME ------- */}
      <AnimatePresence>
        {chromeVisible && (
          <motion.div
            key="bot-chrome"
            initial={{ y: 64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 64, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-0 left-0 right-0 z-30 px-2 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 bg-cream/95 backdrop-blur border-t-2 border-ink-soft"
            style={{
              paddingBottom:
                "calc(0.625rem + env(safe-area-inset-bottom, 0))",
            }}
          >
            <button
              onClick={() => goPrev()}
              disabled={!canPrev}
              aria-label="previous page"
              className="rounded-lg bg-paper border-2 border-ink px-2 py-1.5 sm:px-2.5 text-ink hover:bg-peach-soft/40 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
              style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
            >
              <PixelIcon name="chevron-left" size={16} />
            </button>

            <button
              onClick={toggleCurrentBookmark}
              aria-label={isBookmarked ? "remove bookmark" : "bookmark page"}
              className={`rounded-lg border-2 border-ink px-2 py-1.5 sm:px-2.5 transition shrink-0 ${
                isBookmarked
                  ? "bg-rose-soft text-rose-deep"
                  : "bg-paper text-ink hover:bg-peach-soft/40"
              }`}
              style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
            >
              <motion.span
                key={isBookmarked ? "yes" : "no"}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                className="block"
              >
                <PixelIcon name="bookmark" size={16} />
              </motion.span>
            </button>

            <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
              <PageJumper
                page={page}
                total={total}
                onJump={jumpTo}
                onPin={pinChrome}
                onUnpin={unpinChrome}
              />
              {partner && partnerPage && !samePage && (
                <button
                  onClick={() => jumpTo(partnerPage)}
                  className="pill hover:bg-peach-soft/30 shrink-0 !px-2 !py-1 sm:!px-2.5 sm:!py-1.5"
                  title={
                    partnerInThisBook
                      ? `${partner.displayName} is reading on page ${partnerPage} — jump?`
                      : `${partner.displayName} left off on page ${partnerPage}`
                  }
                >
                  <Avatar
                    seed={partner.userId}
                    accent={partner.accent}
                    size={14}
                    online={partnerInThisBook}
                  />
                  <span className="text-[11px] sm:text-xs">p.{partnerPage}</span>
                </button>
              )}
              {partner && samePage && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 16 }}
                  className="pill shrink-0 !px-2 !py-1 sm:!px-2.5 sm:!py-1.5"
                  style={{ background: "var(--color-rose-soft)" }}
                  title="same page"
                >
                  <Avatar
                    seed={partner.userId}
                    accent={partner.accent}
                    size={14}
                  />
                  <PixelIcon
                    name="heart"
                    size={12}
                    className="text-rose-deep"
                  />
                  <span className="hidden sm:inline text-xs">same page</span>
                </motion.div>
              )}
            </div>

            <button
              onClick={() => {
                setDrawerOpen(true);
                pinChrome();
              }}
              aria-label="open bookmarks"
              className="rounded-lg bg-paper border-2 border-ink px-2 py-1.5 sm:px-2.5 text-ink hover:bg-peach-soft/40 transition shrink-0 relative"
              style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
            >
              <PixelIcon name="bookmarks" size={16} />
              {bookmarks.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold tabular-nums bg-rose-deep text-paper rounded-full min-w-[18px] h-[18px] px-1 border-2 border-ink flex items-center justify-center">
                  {bookmarks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => goNext()}
              disabled={!canNext}
              aria-label="next page"
              className="rounded-lg bg-paper border-2 border-ink px-2 py-1.5 sm:px-2.5 text-ink hover:bg-peach-soft/40 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
              style={{ boxShadow: "3px 3px 0 0 var(--color-ink)" }}
            >
              <PixelIcon name="chevron-right" size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live heart bursts */}
      <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
        <AnimatePresence>
          {incomingHearts.map((h) => (
            <motion.div
              key={h.id}
              initial={{ y: 40, opacity: 0, scale: 0.4 }}
              animate={{
                y: -260,
                opacity: [0, 1, 1, 0],
                scale: [0.4, 1.4, 1.2, 0.9],
                rotate: [-8, 8, -4, 4],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              className="absolute text-rose-deep"
              style={{
                left: `${h.x * 100}%`,
                bottom: "35%",
                transform: "translateX(-50%)",
                filter: "drop-shadow(2px 2px 0 var(--color-ink))",
              }}
            >
              <PixelIcon name="heart" size={96} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isZoomed && (
          <motion.div
            key="zoom-pill"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="absolute left-1/2 -translate-x-1/2 z-40 pill"
            style={{
              bottom: "calc(4rem + env(safe-area-inset-bottom, 0))",
              background: "var(--color-paper)",
            }}
          >
            <button
              onClick={() => setZoom(scale - 0.5)}
              aria-label="zoom out"
              className="rounded-full p-1 text-ink hover:bg-cream-deep/40"
            >
              <PixelIcon name="chevron-left" size={14} />
            </button>
            <span className="text-xs font-bold tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setZoom(scale + 0.5)}
              aria-label="zoom in"
              className="rounded-full p-1 text-ink hover:bg-cream-deep/40"
            >
              <PixelIcon name="chevron-right" size={14} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
              }}
              aria-label="reset zoom"
              className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold border-2 border-ink bg-cream hover:bg-peach-soft/40"
              style={{ boxShadow: "1px 1px 0 0 var(--color-ink)" }}
            >
              fit
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <FirstHint />

      <BookmarksDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          unpinChrome();
        }}
        bookmarks={bookmarks}
        me={me}
        partner={partner}
        currentPage={page}
        isCurrentBookmarkedByMe={isBookmarked}
        onToggleCurrentPage={toggleCurrentBookmark}
        onJump={jumpTo}
        onDelete={deleteBookmark}
      />
    </div>
  );
}

const pageVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

function PartnerPresenceBadge({
  userId,
  accent,
  displayName,
  onSendHeart,
}: {
  userId: string;
  accent: string;
  displayName: string;
  onSendHeart: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSendHeart();
      }}
      initial={{ scale: 0, rotate: -15, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 360, damping: 16 }}
      className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-paper border-2 border-ink pl-0.5 pr-2 py-0.5 cursor-pointer"
      style={{ boxShadow: "2px 2px 0 0 var(--color-ink)" }}
      title={`tap to send ${displayName} a heart`}
      aria-label={`send ${displayName} a heart`}
    >
      <motion.div
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Avatar seed={userId} accent={accent} size={22} />
      </motion.div>
      <span className="text-[10px] font-bold text-ink-soft whitespace-nowrap">
        {displayName}
        <span className="text-rose-deep ml-0.5">♡</span>
      </span>
    </motion.button>
  );
}

function PartnerBookmarkFlag({ accent }: { accent: string }) {
  const fillMap: Record<string, string> = {
    peach: "var(--color-peach)",
    lavender: "var(--color-lavender)",
    sage: "var(--color-sage)",
    rose: "var(--color-rose)",
    sun: "var(--color-sun)",
  };
  return (
    <div
      className="absolute top-2 right-2 rounded-md border-2 border-ink px-1.5 py-1 shadow-soft"
      style={{
        background: fillMap[accent] ?? fillMap.peach,
        boxShadow: "2px 2px 0 0 var(--color-ink)",
      }}
      title="partner bookmarked this page"
    >
      <PixelIcon name="bookmark" size={14} className="text-ink" />
    </div>
  );
}

function PageJumper({
  page,
  total,
  onJump,
  onPin,
  onUnpin,
}: {
  page: number;
  total: number;
  onJump: (p: number) => void;
  onPin: () => void;
  onUnpin: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(page));
  const [lastPage, setLastPage] = useState(page);

  if (lastPage !== page) {
    setLastPage(page);
    setValue(String(page));
  }

  const commit = () => {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n >= 1 && (!total || n <= total)) {
      onJump(n);
    }
    setEditing(false);
    onUnpin();
  };

  return (
    <div className="text-xs sm:text-sm font-bold text-ink-soft tabular-nums flex items-center gap-1 shrink min-w-0">
      {editing ? (
        <input
          autoFocus
          value={value}
          inputMode="numeric"
          onFocus={onPin}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") {
              setEditing(false);
              onUnpin();
            }
          }}
          className="w-12 sm:w-14 text-center rounded-lg bg-paper border-2 border-ink px-1.5 sm:px-2 py-1 focus:outline-none"
        />
      ) : (
        <button
          onClick={() => {
            setEditing(true);
            onPin();
          }}
          className="rounded-lg px-2 sm:px-2.5 py-1 hover:bg-peach-soft/40 transition whitespace-nowrap"
        >
          <span className="hidden sm:inline">page </span>
          {page}
        </button>
      )}
      {total > 0 && (
        <span className="text-ink-faint whitespace-nowrap">/ {total}</span>
      )}
    </div>
  );
}

function DocLoading() {
  return (
    <div className="card-soft p-10 text-center text-ink">
      <PixelIcon name="sparkles" size={32} />
      <p className="font-bold text-ink mt-3">opening the book…</p>
    </div>
  );
}

function PageSkeleton({
  width,
  aspect,
}: {
  width: number;
  aspect: number;
}) {
  return (
    <div
      style={{ width, height: Math.round(width / aspect) }}
      className="bg-cream-deep/50 animate-pulse"
    />
  );
}

function DocError({ message }: { message: string }) {
  return (
    <div className="card-soft p-8 text-center max-w-md mx-4 text-ink">
      <PixelIcon name="alert" size={48} className="text-rose-deep" />
      <p className="font-bold text-ink mt-3">couldn&apos;t open this book</p>
      <p className="text-sm text-ink-soft mt-1 font-medium">{message}</p>
    </div>
  );
}

function FirstHint() {
  const [shown, setShown] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("rt:swipe-hint-shown");
  });

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => {
      setShown(false);
      localStorage.setItem("rt:swipe-hint-shown", "1");
    }, 2800);
    return () => clearTimeout(t);
  }, [shown]);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-24 z-40 pill"
          style={{ background: "var(--color-paper)" }}
        >
          <PixelIcon name="chevron-left" size={12} />
          swipe to flip
          <PixelIcon name="chevron-right" size={12} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
