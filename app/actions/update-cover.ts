"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/storage";

const schema = z.object({
  id: z.string().uuid(),
  cover_path: z.string().min(1),
});

export async function updateCover(input: { id: string; cover_path: string }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("books")
    .select("cover_url")
    .eq("id", parsed.data.id)
    .single();

  const { error } = await supabase
    .from("books")
    .update({ cover_url: parsed.data.cover_path })
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: error.message };

  // Best-effort cleanup of the old cover.
  if (existing?.cover_url && existing.cover_url !== parsed.data.cover_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([existing.cover_url]);
  }

  revalidatePath("/");
  return { ok: true as const };
}
