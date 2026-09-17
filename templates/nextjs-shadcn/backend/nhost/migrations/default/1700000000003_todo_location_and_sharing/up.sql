-- An item is something you want to do, optionally somewhere in particular:
-- "I want to go skateboarding in Los Angeles, California". The location is the
-- optional half, so it is nullable and the preposition that joins the two
-- always has a value.
--
-- The preposition only means anything next to a location, so it carries a
-- default and is never null: a row with no location just ignores it.
--
-- No check constraint on it. It is a display word rather than something the
-- app branches on, and the set is the kind that grows, so narrowing it belongs
-- in the UI where widening it costs nothing.
-- `sort_order` rather than `position`, which Postgres also uses as a function
-- name. Rows are read by `sort_order` first and `created_at` second, so a list
-- nobody has reordered still comes back newest first and ties can never make
-- the order jump around between requests.
alter table public.todos
  add column location text,
  add column preposition text not null default 'in',
  add column is_public boolean not null default false,
  add column sort_order integer not null default 0,
  add column file_id uuid references storage.files(id) on delete set null;

-- Attachments are whatever the owner picked, so this bucket caps the upload
-- itself rather than a processed result the way the avatars bucket does.
insert into storage.buckets (id, min_upload_file_size, max_upload_file_size, cache_control)
values ('todo-attachments', 1, 5242880, 'max-age=3600')
on conflict (id) do nothing;
