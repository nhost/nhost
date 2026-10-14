-- Use an explicit transaction so trigger installation and the initial seed are atomic.
-- Lock storage.files before seeding so concurrent file writes cannot escape the snapshot.
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE storage.files IN SHARE ROW EXCLUSIVE MODE;

-- An exact total trades off write concurrency: size-changing storage.files writes
-- serialize on this row until commit; a bulk delete holds the lock for the statement.
CREATE TABLE storage.usage (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  total_bytes bigint NOT NULL DEFAULT 0
);

CREATE FUNCTION storage.update_usage_on_file_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, pg_temp
AS $$
DECLARE
  old_bytes bigint := 0;
  new_bytes bigint := 0;
  delta bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_bytes := CASE WHEN NEW.is_uploaded THEN coalesce(NEW.size, 0) ELSE 0 END;
  ELSIF TG_OP = 'UPDATE' THEN
    old_bytes := CASE WHEN OLD.is_uploaded THEN coalesce(OLD.size, 0) ELSE 0 END;
    new_bytes := CASE WHEN NEW.is_uploaded THEN coalesce(NEW.size, 0) ELSE 0 END;
  ELSIF TG_OP = 'DELETE' THEN
    old_bytes := CASE WHEN OLD.is_uploaded THEN coalesce(OLD.size, 0) ELSE 0 END;
  ELSE
    RAISE EXCEPTION 'unexpected operation: %', TG_OP;
  END IF;

  delta := new_bytes - old_bytes;
  IF delta <> 0 THEN
    UPDATE storage.usage SET total_bytes = total_bytes + delta WHERE id = true;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION storage.reset_usage_on_files_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, pg_temp
AS $$
BEGIN
  UPDATE storage.usage SET total_bytes = 0 WHERE id = true;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_usage_on_file_change
AFTER INSERT OR UPDATE OR DELETE ON storage.files
FOR EACH ROW EXECUTE FUNCTION storage.update_usage_on_file_change();

CREATE TRIGGER reset_usage_on_files_truncate
AFTER TRUNCATE ON storage.files
FOR EACH STATEMENT EXECUTE FUNCTION storage.reset_usage_on_files_truncate();

INSERT INTO storage.usage (id, total_bytes)
SELECT true, coalesce(sum(size), 0) FROM storage.files WHERE is_uploaded;
COMMIT;
