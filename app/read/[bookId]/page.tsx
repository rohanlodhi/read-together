import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { ReaderView } from "./reader-view";

type Params = { bookId: string };

export default async function ReadBookPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { bookId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    bookRes,
    profilesRes,
    progressRes,
    bookmarksRes,
    annotationsRes,
    reactionsRes,
  ] = await Promise.all([
    supabase
      .from("books")
      .select("id, title, author, total_pages, pdf_path")
      .eq("id", bookId)
      .single(),
    supabase.from("profiles").select("id, display_name, emoji, accent"),
    supabase
      .from("reading_progress")
      .select("user_id, page")
      .eq("book_id", bookId),
    supabase
      .from("bookmarks")
      .select("id, user_id, book_id, page, label, color, created_at")
      .eq("book_id", bookId)
      .order("page", { ascending: true }),
    supabase
      .from("annotations")
      .select(
        "id, user_id, book_id, page, kind, rects, selected_text, note_content, color, created_at",
      )
      .eq("book_id", bookId)
      .order("created_at", { ascending: true }),
    supabase
      .from("reactions")
      .select("id, user_id, book_id, page, emoji, x, y, created_at")
      .eq("book_id", bookId)
      .order("created_at", { ascending: true }),
  ]);

  if (bookRes.error || !bookRes.data) notFound();

  const book = bookRes.data;
  const profiles = profilesRes.data ?? [];
  const me = profiles.find((p) => p.id === user.id) ?? null;
  const partner = profiles.find((p) => p.id !== user.id) ?? null;

  const progress = progressRes.data ?? [];
  const myProgress = progress.find((p) => p.user_id === user.id)?.page ?? null;
  const partnerProgress = partner
    ? (progress.find((p) => p.user_id === partner.id)?.page ?? null)
    : null;

  const pdfUrl = await signedUrl(book.pdf_path, 60 * 60 * 2);

  return (
    <ReaderView
      bookId={book.id}
      bookTitle={book.title}
      bookAuthor={book.author}
      pdfUrl={pdfUrl}
      totalPages={book.total_pages}
      initialPage={myProgress ?? 1}
      initialBookmarks={bookmarksRes.data ?? []}
      initialAnnotations={annotationsRes.data ?? []}
      initialReactions={reactionsRes.data ?? []}
      me={
        me
          ? {
              userId: me.id,
              displayName: me.display_name,
              accent: me.accent,
            }
          : null
      }
      partner={
        partner
          ? {
              userId: partner.id,
              displayName: partner.display_name,
              accent: partner.accent,
            }
          : null
      }
      initialPartnerPage={partnerProgress}
    />
  );
}
