ALTER TABLE public.todos
  ADD COLUMN stale boolean NOT NULL DEFAULT false;
