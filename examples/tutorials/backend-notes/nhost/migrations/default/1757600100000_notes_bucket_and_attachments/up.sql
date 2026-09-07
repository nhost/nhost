-- Part 4 (file uploads): the `notes` storage bucket and the join table that
-- links an uploaded file to a note. Matches the SQL in
-- docs/src/content/docs/getting-started/tutorials/*/4-file-uploads.mdx

INSERT INTO storage.buckets (id) VALUES ('notes') ON CONFLICT DO NOTHING;

CREATE TABLE public.note_attachments (
  note_id uuid NOT NULL REFERENCES public.notes (id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES storage.files (id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, file_id)
);
