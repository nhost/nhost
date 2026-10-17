-- Part 5 (functions & sharing): collaborators on a note. Matches the SQL in
-- docs/src/content/docs/getting-started/tutorials/*/5-functions-sharing.mdx

CREATE TABLE public.note_collaborators (
  note_id uuid NOT NULL REFERENCES public.notes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role    text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  PRIMARY KEY (note_id, user_id)
);
