import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";

export type BookListItem = {
  id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  pdf_path: string;
  cover_url: string | null;
  cover_signed: string | null;
  uploaded_by: string;
  created_at: string;
};

export type PartnerProgress = {
  user_id: string;
  display_name: string;
  emoji: string;
  accent: string;
  page: number | null;
};

export async function getLibraryData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");

  const [booksRes, profilesRes, progressRes] = await Promise.all([
    supabase
      .from("books")
      .select(
        "id, title, author, total_pages, pdf_path, cover_url, uploaded_by, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, emoji, accent, avatar_url"),
    supabase.from("reading_progress").select("user_id, book_id, page"),
  ]);

  if (booksRes.error) throw booksRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (progressRes.error) throw progressRes.error;

  const books = booksRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const progress = progressRes.data ?? [];

  // Sign all cover URLs in one batch.
  const coverPaths = books
    .map((b) => b.cover_url)
    .filter((p): p is string => Boolean(p));
  const signed = await signedUrls(coverPaths, 60 * 60);

  const meProfile = profiles.find((p) => p.id === user.id) ?? null;
  const partnerProfile =
    profiles.find((p) => p.id !== user.id) ?? null;

  const progressByBook = new Map<
    string,
    { mine: number | null; partner: number | null }
  >();
  for (const p of progress) {
    const entry = progressByBook.get(p.book_id) ?? {
      mine: null,
      partner: null,
    };
    if (p.user_id === user.id) entry.mine = p.page;
    else if (partnerProfile && p.user_id === partnerProfile.id)
      entry.partner = p.page;
    progressByBook.set(p.book_id, entry);
  }

  const enriched: (BookListItem & {
    my_page: number | null;
    partner_page: number | null;
  })[] = books.map((b) => ({
    ...b,
    cover_signed: b.cover_url ? signed.get(b.cover_url) ?? null : null,
    my_page: progressByBook.get(b.id)?.mine ?? null,
    partner_page: progressByBook.get(b.id)?.partner ?? null,
  }));

  return {
    user,
    me: meProfile,
    partner: partnerProfile,
    books: enriched,
  };
}
