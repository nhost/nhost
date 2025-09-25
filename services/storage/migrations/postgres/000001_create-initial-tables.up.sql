BEGIN;
-- functions
CREATE OR REPLACE FUNCTION storage.set_current_timestamp_updated_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $a$
DECLARE
  _new record;
BEGIN
  _new := new;
  _new. "updated_at" = now();
  RETURN _new;
END;
$a$;

CREATE OR REPLACE FUNCTION storage.protect_default_bucket_delete ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $a$
BEGIN
  IF OLD.ID = 'default' THEN
    RAISE EXCEPTION 'Can not delete default bucket';
  END IF;
  RETURN OLD;
END;
$a$;

CREATE OR REPLACE FUNCTION storage.protect_default_bucket_update ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $a$
BEGIN
  IF OLD.ID = 'default' AND NEW.ID <> 'default' THEN
    RAISE EXCEPTION 'Can not rename default bucket';
  END IF;
  RETURN NEW;
END;
$a$;

-- tables
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  download_expiration int NOT NULL DEFAULT 30, -- 30 seconds
  min_upload_file_size int NOT NULL DEFAULT 1,
  max_upload_file_size int NOT NULL DEFAULT 50000000,
  cache_control text DEFAULT 'max-age=3600',
  presigned_urls_enabled boolean NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS storage.files (
  id uuid DEFAULT public.gen_random_uuid () NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  bucket_id text NOT NULL DEFAULT 'default',
  name text,
  size int,
  mime_type text,
  etag text,
  is_uploaded boolean DEFAULT FALSE,
  uploaded_by_user_id uuid
);

-- constraints
DO $$
BEGIN
  IF NOT EXISTS(SELECT table_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'storage'
              AND table_name = 'files'
              AND constraint_name = 'fk_bucket')
  THEN
    ALTER TABLE storage.files
      ADD CONSTRAINT fk_bucket FOREIGN KEY (bucket_id) REFERENCES storage.buckets (id) ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

-- triggers
DROP TRIGGER IF EXISTS set_storage_buckets_updated_at ON storage.buckets;
CREATE TRIGGER set_storage_buckets_updated_at
  BEFORE UPDATE ON storage.buckets
  FOR EACH ROW
  EXECUTE FUNCTION storage.set_current_timestamp_updated_at ();

DROP TRIGGER IF EXISTS set_storage_files_updated_at ON storage.files;
CREATE TRIGGER set_storage_files_updated_at
  BEFORE UPDATE ON storage.files
  FOR EACH ROW
  EXECUTE FUNCTION storage.set_current_timestamp_updated_at ();

DROP TRIGGER IF EXISTS check_default_bucket_delete ON storage.buckets;
CREATE TRIGGER check_default_bucket_delete
  BEFORE DELETE ON storage.buckets
  FOR EACH ROW
    EXECUTE PROCEDURE storage.protect_default_bucket_delete ();

DROP TRIGGER IF EXISTS check_default_bucket_update ON storage.buckets;
CREATE TRIGGER check_default_bucket_update
  BEFORE UPDATE ON storage.buckets
  FOR EACH ROW
    EXECUTE PROCEDURE storage.protect_default_bucket_update ();

-- data
DO $$
BEGIN
  IF NOT EXISTS(SELECT id
            FROM storage.buckets
            WHERE id = 'default')
  THEN
    INSERT INTO storage.buckets (id)
      VALUES ('default');
  END IF;
END $$;

COMMIT;
