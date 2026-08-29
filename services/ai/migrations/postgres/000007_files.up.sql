CREATE TABLE graphite.files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  file_id text NOT NULL UNIQUE,
  storage_file_id UUID NOT NULL UNIQUE,
  etag text NOT NULL,
  PRIMARY KEY (id)
);

CREATE TRIGGER set_graphite_files_updated_at
BEFORE UPDATE ON graphite.files
FOR EACH ROW
EXECUTE PROCEDURE graphite.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_graphite_files_updated_at ON graphite.files
IS 'trigger to set value of column updated_at to current timestamp on row update';
