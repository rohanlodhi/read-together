"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";

const schema = z.object({
  email: z.string().email(),
});

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "That doesn't look like a real email." };
  }

  const email = parsed.data.email.toLowerCase();

  if (!isAllowedEmail(email)) {
    return {
      status: "error",
      message: "Hmm, that email isn't on the list 🥺",
    };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("x-forwarded-proto") && h.get("host")
      ? `${h.get("x-forwarded-proto")}://${h.get("host")}`
      : "http://localhost:3000");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "sent", email };
}
