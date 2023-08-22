CREATE TABLE IF NOT EXISTS storage.virus (
  id uuid DEFAULT public.gen_random_uuid () NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  file_id UUID NOT NULL REFERENCES storage.files(id),
  filename TEXT NOT NULL,
  virus TEXT NOT NULL,
  user_session JSONB NOT NULL
);

DROP TRIGGER IF EXISTS set_storage_virus_updated_at ON storage.virus;
CREATE TRIGGER set_storage_virus_updated_at
  BEFORE UPDATE ON storage.virus
  FOR EACH ROW
  EXECUTE FUNCTION storage.set_current_timestamp_updated_at ();
