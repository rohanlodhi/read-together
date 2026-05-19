import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/allowlist";

/**
 * Handles two magic-link styles:
 *   1. Default email template → ?code=...           (PKCE, exchangeCodeForSession)
 *   2. Custom token-hash template → ?token_hash=... (verifyOtp)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as
    | "magiclink"
    | "email"
    | "signup"
    | "recovery"
    | "invite"
    | "email_change"
    | null;
  const next = url.searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=exchange", url));
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      return NextResponse.redirect(new URL("/login?error=verify", url));
    }
  } else {
    return NextResponse.redirect(new URL("/login?error=missing", url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not-allowed", url));
  }

  return NextResponse.redirect(new URL(next, url));
}
