-- read-together initial schema
-- Two-user app: middleware restricts sign-in to an email allowlist.
-- RLS treats every authenticated user as a "partner" — they can read everything,
-- but can only mutate their own rows.

set search_path = public;

-- ============================================================================
-- profiles
-- ============================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'partner',
  emoji         text not null default '💞',
  accent        text not null default 'peach'
                check (accent in ('peach', 'lavender', 'sage', 'rose', 'sun')),
  avatar_url    text,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: anyone signed in can read"
  on public.profiles for select to authenticated using (true);
create policy "profiles: update own"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles: insert own"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Auto-create a profile when a new auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'partner'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- books
-- ============================================================================
create table if not exists public.books (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  author       text,
  cover_url    text,
  pdf_path     text not null,
  total_pages  int,
  uploaded_by  uuid not null references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "books: read all" on public.books for select to authenticated using (true);
create policy "books: insert" on public.books for insert to authenticated
  with check (auth.uid() = uploaded_by);
create policy "books: update any" on public.books for update to authenticated using (true);
create policy "books: delete uploader" on public.books for delete to authenticated
  using (auth.uid() = uploaded_by);

-- ============================================================================
-- reading_progress
-- ============================================================================
create table if not exists public.reading_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  page       int  not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.reading_progress enable row level security;

create policy "progress: read all" on public.reading_progress for select to authenticated using (true);
create policy "progress: upsert own" on public.reading_progress for insert to authenticated
  with check (auth.uid() = user_id);
create policy "progress: update own" on public.reading_progress for update to authenticated
  using (auth.uid() = user_id);
create policy "progress: delete own" on public.reading_progress for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- bookmarks
-- ============================================================================
create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  page       int  not null,
  label      text,
  color      text,
  created_at timestamptz not null default now()
);

create index if not exists bookmarks_book_idx on public.bookmarks(book_id);

alter table public.bookmarks enable row level security;

create policy "bookmarks: read all" on public.bookmarks for select to authenticated using (true);
create policy "bookmarks: insert own" on public.bookmarks for insert to authenticated
  with check (auth.uid() = user_id);
create policy "bookmarks: update own" on public.bookmarks for update to authenticated
  using (auth.uid() = user_id);
create policy "bookmarks: delete own" on public.bookmarks for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- annotations (highlights + notes)
-- ============================================================================
create table if not exists public.annotations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  book_id       uuid not null references public.books(id) on delete cascade,
  page          int  not null,
  kind          text not null check (kind in ('highlight', 'note')),
  rects         jsonb not null default '[]'::jsonb,
  selected_text text,
  note_content  text,
  color         text,
  created_at    timestamptz not null default now()
);

create index if not exists annotations_book_page_idx on public.annotations(book_id, page);

alter table public.annotations enable row level security;

create policy "annotations: read all" on public.annotations for select to authenticated using (true);
create policy "annotations: insert own" on public.annotations for insert to authenticated
  with check (auth.uid() = user_id);
create policy "annotations: update own" on public.annotations for update to authenticated
  using (auth.uid() = user_id);
create policy "annotations: delete own" on public.annotations for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- reactions (positioned stickers)
-- ============================================================================
create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid not null references public.books(id) on delete cascade,
  page       int  not null,
  emoji      text not null,
  x          real not null,
  y          real not null,
  created_at timestamptz not null default now()
);

create index if not exists reactions_book_page_idx on public.reactions(book_id, page);

alter table public.reactions enable row level security;

create policy "reactions: read all" on public.reactions for select to authenticated using (true);
create policy "reactions: insert own" on public.reactions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "reactions: delete own" on public.reactions for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- Enable Realtime on shared tables
-- ============================================================================
alter publication supabase_realtime add table public.reading_progress;
alter publication supabase_realtime add table public.bookmarks;
alter publication supabase_realtime add table public.annotations;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.books;
alter publication supabase_realtime add table public.profiles;
