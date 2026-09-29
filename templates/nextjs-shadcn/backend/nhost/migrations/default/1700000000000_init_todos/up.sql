-- An item is something you want to do, optionally somewhere in particular:
-- "I want to go skateboarding in Los Angeles, California". The location is the
-- optional half, so it is nullable and the preposition that joins the two
-- always has a value.
--
-- The preposition only means anything next to a location, so it carries a
-- default and is never null: a row with no location simply ignores it. There
-- is no check constraint on it either. It is a display word rather than
-- something the app branches on, and the set is the kind that grows, so
-- narrowing it belongs in the UI, where widening it again costs nothing.
--
-- `sort_order` rather than `position`, which Postgres also uses as a function
-- name. Rows are read by `sort_order` first and `created_at` second, so a list
-- nobody has reordered still comes back newest first, and rows sharing a rank
-- can never swap places between one request and the next.
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  location text,
  preposition text not null default 'in',
  is_public boolean not null default false,
  sort_order integer not null default 0,
  file_id uuid references storage.files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Both foreign keys are filtered on, so both are indexed: `user_id` by every
-- row-level permission on this table, and `file_id` by the `public` rule in
-- `storage_files.yaml`, which reaches `storage.files` back through here.
create index on public.todos (user_id);
create index on public.todos (file_id);

-- `updated_at` is maintained by the database, not by the client. Every write
-- path would otherwise have to remember to set it - the sentence edit, the
-- checkbox, the share toggle, the photo - and the one that forgot would be a
-- row that quietly claims to be older than it is. `auth` and `storage` keep
-- their own timestamps this way; this is the same function under a name this
-- project owns.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger todos_touch_updated_at
  before update on public.todos
  for each row
  execute function public.touch_updated_at();

-- Attachments are whatever the owner picked, so this bucket caps the upload
-- itself rather than a processed result the way the avatars bucket does.
insert into storage.buckets (id, min_upload_file_size, max_upload_file_size, cache_control)
values ('todo-attachments', 1, 5242880, 'max-age=3600')
on conflict (id) do nothing;
