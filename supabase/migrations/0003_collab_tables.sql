-- Adds the collaboration tables (bookmarks / annotations / reactions),
-- their RLS policies, and the supabase_realtime publication entries.
--
-- Safe to re-run: every statement is guarded with `if not exists` or
-- `on conflict do nothing` style. Run this if you applied the very first
-- version of 0001_init.sql before these tables were folded in.

set search_path = public;

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

drop policy if exists "bookmarks: read all" on public.bookmarks;
drop policy if exists "bookmarks: insert own" on public.bookmarks;
drop policy if exists "bookmarks: update own" on public.bookmarks;
drop policy if exists "bookmarks: delete own" on public.bookmarks;

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

drop policy if exists "annotations: read all" on public.annotations;
drop policy if exists "annotations: insert own" on public.annotations;
drop policy if exists "annotations: update own" on public.annotations;
drop policy if exists "annotations: delete own" on public.annotations;

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

drop policy if exists "reactions: read all" on public.reactions;
drop policy if exists "reactions: insert own" on public.reactions;
drop policy if exists "reactions: delete own" on public.reactions;

create policy "reactions: read all" on public.reactions for select to authenticated using (true);
create policy "reactions: insert own" on public.reactions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "reactions: delete own" on public.reactions for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- Realtime publication — idempotent adds.
-- (alter publication add table errors if already present, so guard each.)
-- ============================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'bookmarks',
      'annotations',
      'reactions',
      'reading_progress',
      'books',
      'profiles'
    ])
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;
