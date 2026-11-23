CREATE TABLE storage.files_to_delete (
  id uuid PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX files_to_delete_deleted_at_idx ON storage.files_to_delete (deleted_at);

CREATE FUNCTION storage.enqueue_file_cleanup()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO storage.files_to_delete (id, deleted_at)
    VALUES (OLD.id, now())
    ON CONFLICT (id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at;
  RETURN OLD;
END;
$$;

CREATE TRIGGER enqueue_file_cleanup
  AFTER DELETE ON storage.files
  FOR EACH ROW
  EXECUTE FUNCTION storage.enqueue_file_cleanup();
