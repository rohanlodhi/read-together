-- Storage bucket for PDFs and cover images.
-- Run AFTER 0001_init.sql.

insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do nothing;

-- Allow any authenticated user (i.e. both partners) to read + write files in
-- the "books" bucket. Middleware already restricts sign-in to the allowlist.

create policy "books bucket: read"
  on storage.objects for select to authenticated
  using (bucket_id = 'books');

create policy "books bucket: insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'books');

create policy "books bucket: update"
  on storage.objects for update to authenticated
  using (bucket_id = 'books');

create policy "books bucket: delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'books');
