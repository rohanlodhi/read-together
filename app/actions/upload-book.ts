"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  author: z.string().max(200).optional().nullable(),
  pdf_path: z.string().min(1),
  cover_path: z.string().min(1).optional().nullable(),
  total_pages: z.number().int().positive().nullable(),
});

export type UploadBookInput = z.input<typeof schema>;

export async function insertBook(input: UploadBookInput) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid book metadata." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { error } = await supabase.from("books").insert({
    id: parsed.data.id,
    title: parsed.data.title,
    author: parsed.data.author ?? null,
    pdf_path: parsed.data.pdf_path,
    cover_url: parsed.data.cover_path ?? null,
    total_pages: parsed.data.total_pages,
    uploaded_by: user.id,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/");
  return { ok: true as const, id: parsed.data.id };
}
