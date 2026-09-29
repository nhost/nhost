drop trigger if exists todos_touch_updated_at on public.todos;
drop function if exists public.touch_updated_at();

alter table public.todos
  drop column if exists updated_at;
