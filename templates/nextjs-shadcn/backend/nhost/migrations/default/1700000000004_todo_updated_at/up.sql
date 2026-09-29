-- When a row last changed, so the list can say so.
--
-- Backfilled from `created_at` rather than `now()`: a row nobody has touched
-- since writing it was last changed when it was written, and stamping the
-- migration's own clock onto every existing row would tell the opposite story.
alter table public.todos
  add column updated_at timestamptz not null default now();

update public.todos set updated_at = created_at;

-- The column is maintained by the database, not by the client. Every write
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
