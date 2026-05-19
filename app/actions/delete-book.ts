"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/storage";

const schema = z.object({ id: z.string().uuid() });

export async function deleteBook(input: { id: string }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Bad book id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { data: book, error: lookupErr } = await supabase
    .from("books")
    .select("id, pdf_path, cover_url")
    .eq("id", parsed.data.id)
    .single();

  if (lookupErr || !book) {
    return { ok: false as const, error: "Book not found." };
  }

  const paths = [book.pdf_path, book.cover_url].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  }

  const { error: delErr } = await supabase
    .from("books")
    .delete()
    .eq("id", parsed.data.id);

  if (delErr) return { ok: false as const, error: delErr.message };

  revalidatePath("/");
  return { ok: true as const };
}
