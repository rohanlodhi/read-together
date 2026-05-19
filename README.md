# read‑together 📖💞

A tiny shared PDF reader for two long‑distance readers. See each other's pages, bookmarks, highlights, notes, and stickers in real time.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Supabase (Postgres + Storage + Realtime + Auth)
- `react-pdf` for rendering, `motion` for animations
- Deployed on Vercel

## First-time setup

### 1. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) and create a new project.
2. Save the project URL and **anon** key from `Project Settings → API`.

### 2. Run the migrations

In `Supabase Studio → SQL Editor`, run these files **in order**:

1. `supabase/migrations/0001_init.sql` — tables, RLS, realtime
2. `supabase/migrations/0002_storage.sql` — `books` storage bucket + policies
3. `supabase/migrations/0003_collab_tables.sql` — bookmarks / highlights / reactions (idempotent; safe to re-run if you applied an early version of 0001 that didn't have these)

Or, with the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

### 3. Configure auth

**`Authentication → Providers → Email`:**

- Enable **Email** provider.
- Disable **Confirm email** (magic links handle it).

**`Authentication → URL Configuration`** (this is what fixes "Invalid path specified in request URL"):

- **Site URL** — set to your dev URL while building: `http://localhost:3000`. Change to your Vercel URL once deployed.
- **Redirect URLs** — add **both**:
  - `http://localhost:3000/**`
  - `https://YOUR-VERCEL-URL.vercel.app/**` (once deployed)

The default email template's `{{ .ConfirmationURL }}` works as-is — our `/auth/callback` route handles the resulting `?code=...` redirect.

### 4. Local env

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from step 1
- `NEXT_PUBLIC_ALLOWED_EMAILS` — comma-separated. **Only these emails can sign in.** This is the gate that keeps the library private.

### 5. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploying

Push to GitHub, import on Vercel, paste the same env vars. Add your production URL to the Supabase Site URL and to the `emailRedirectTo` allowlist.

## Project layout

```
app/
  layout.tsx              cute fonts + toaster
  page.tsx                home (library — wip)
  login/                  magic-link sign-in
  auth/callback/          OTP verify + session redirect
  auth/sign-out/          sign out POST
components/               shared UI
lib/
  supabase/
    client.ts             browser client
    server.ts             server client (cookies)
    middleware.ts         session refresh + allowlist gate
    types.ts              DB row types
  auth/allowlist.ts       email allowlist helper
  utils.ts                cn() helper
proxy.ts                  Next 16 proxy (auth gate)
supabase/migrations/      SQL — run these on the Supabase project
```

## Roadmap (2 weeks)

- [x] Days 1–2: scaffold, theme, auth, schema
- [ ] Days 3–4: PDF upload, library, reader
- [ ] Days 5–7: realtime presence, bookmarks
- [ ] Days 8–10: highlights + notes
- [ ] Days 11–12: reactions + animations
- [ ] Day 13: mobile QA, seed real books
- [ ] Day 14: anniversary easter eggs ✨
