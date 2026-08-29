CREATE TABLE graphite.file_stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  name text NOT NULL,
  vector_store_id text UNIQUE,
  user_id UUID,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TRIGGER set_graphite_file_stores_updated_at
BEFORE UPDATE ON graphite.file_stores
FOR EACH ROW
EXECUTE PROCEDURE graphite.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_graphite_file_stores_updated_at ON graphite.file_stores
IS 'trigger to set value of column updated_at to current timestamp on row update';
