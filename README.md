# read‑together

A tiny shared PDF reader for real time collaborative reading.

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

Open <http://localhost:3000>