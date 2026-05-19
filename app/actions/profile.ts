"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ACCENTS = ["peach", "lavender", "sage", "rose", "sun"] as const;

const schema = z.object({
  display_name: z.string().min(1).max(40),
  emoji: z.string().min(1).max(8),
  accent: z.enum(ACCENTS),
});

export type UpdateProfileInput = z.input<typeof schema>;

export async function updateProfile(input: UpdateProfileInput) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid profile values." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name.trim(),
      emoji: parsed.data.emoji,
      accent: parsed.data.accent,
    })
    .eq("id", user.id);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/");
  return { ok: true as const };
}
