-- Schema for Part 3 of the notes CLI tutorials (Go / Rust / Python).
-- Kept identical to the SQL in
-- docs/src/content/docs/getting-started/tutorials/*/3-graphql-operations.mdx
-- so following the tutorial by hand and running this project agree.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.notebooks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  notebook_id uuid REFERENCES public.notebooks (id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT '',
  content     text NOT NULL DEFAULT '',
  is_pinned   boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tags (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name    text NOT NULL,
  color   text NOT NULL DEFAULT '#808080',
  UNIQUE (user_id, name)
);

CREATE TABLE public.note_tags (
  note_id uuid NOT NULL REFERENCES public.notes (id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TRIGGER set_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
