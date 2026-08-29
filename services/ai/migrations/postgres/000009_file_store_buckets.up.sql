CREATE TABLE graphite.file_store_buckets (
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  bucket_id text,
  file_store_id UUID,
  PRIMARY KEY (bucket_id, file_store_id),
  FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (file_store_id) REFERENCES graphite.file_stores(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TRIGGER set_graphite_file_store_buckets_updated_at
BEFORE UPDATE ON graphite.file_store_buckets
FOR EACH ROW
EXECUTE PROCEDURE graphite.set_current_timestamp_updated_at();

COMMENT ON TRIGGER set_graphite_file_store_buckets_updated_at ON graphite.file_store_buckets
IS 'trigger to set value of column updated_at to current timestamp on row update';
