import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllowedEmails } from "@/lib/auth/allowlist";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const urlWarnings: string[] = [];
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.pathname && parsed.pathname !== "/") {
        urlWarnings.push(
          `NEXT_PUBLIC_SUPABASE_URL must NOT contain a path. Got "${parsed.pathname}". Use just "https://<ref>.supabase.co".`,
        );
      }
      if (rawUrl.endsWith("/")) {
        urlWarnings.push(
          'NEXT_PUBLIC_SUPABASE_URL should not have a trailing slash.',
        );
      }
    } catch {
      urlWarnings.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
    }
  }

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: rawUrl,
    NEXT_PUBLIC_SUPABASE_URL_warnings: urlWarnings,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_present: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY_length:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length ?? 0,
    NEXT_PUBLIC_ALLOWED_EMAILS: getAllowedEmails(),
  };

  // What URL we'd ask Supabase to redirect back to.
  const computed_email_redirect_to = `${origin}/auth/callback?next=/`;

  // 1. Can we reach the Supabase project at all (anon-key auth endpoint)?
  let supabase_reachable: "yes" | "no" | "unknown" = "unknown";
  let supabase_reachable_error: string | null = null;
  try {
    const probe = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        cache: "no-store",
      },
    );
    supabase_reachable = probe.ok ? "yes" : "no";
    if (!probe.ok) {
      supabase_reachable_error = `HTTP ${probe.status}: ${await probe
        .text()
        .then((t) => t.slice(0, 200))}`;
    }
  } catch (e) {
    supabase_reachable = "no";
    supabase_reachable_error = e instanceof Error ? e.message : String(e);
  }

  // 2. Does the SDK auth client work?
  const supabase = await createClient();
  const { data: sessionData, error: sessionErr } =
    await supabase.auth.getSession();

  // 3. Did the schema migration run? (try a tiny read on profiles)
  let schema_ok: "yes" | "no" | "unknown" = "unknown";
  let schema_error: string | null = null;
  try {
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) {
      schema_ok = "no";
      schema_error = `${error.code ?? ""} ${error.message}`.trim();
    } else {
      schema_ok = "yes";
    }
  } catch (e) {
    schema_ok = "no";
    schema_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(
    {
      ok:
        env.NEXT_PUBLIC_SUPABASE_URL &&
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY_present &&
        supabase_reachable === "yes" &&
        schema_ok === "yes",
      origin,
      computed_email_redirect_to,
      env,
      supabase: {
        reachable: supabase_reachable,
        reachable_error: supabase_reachable_error,
        session_present: Boolean(sessionData?.session),
        session_error: sessionErr?.message ?? null,
      },
      schema_ok,
      schema_error,
      hint: "If `computed_email_redirect_to` is not allowed in your Supabase project's URL Configuration (Redirect URLs), the magic link will fail with 'Invalid path specified in request URL'. Add it explicitly or use `http://localhost:3000/**` as a wildcard.",
    },
    { status: 200 },
  );
}
