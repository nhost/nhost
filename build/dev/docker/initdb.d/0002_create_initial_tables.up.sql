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

CREATE OR REPLACE FUNCTION protect_default_bucket_delete ()
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

CREATE OR REPLACE FUNCTION protect_default_bucket_update ()
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
CREATE TABLE storage.buckets (
  id text NOT NULL PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  download_expiration int NOT NULL DEFAULT 30, -- 30 seconds
  min_upload_file_size int NOT NULL DEFAULT 1,
  max_upload_file_size int NOT NULL DEFAULT 50000000,
  cache_control text DEFAULT 'max-age=3600',
  presigned_urls_enabled boolean NOT NULL DEFAULT TRUE
);

CREATE TABLE storage.files (
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
ALTER TABLE storage.files
  ADD CONSTRAINT fk_bucket FOREIGN KEY (bucket_id) REFERENCES storage.buckets (id) ON UPDATE CASCADE ON DELETE CASCADE;

-- add constraints if auth.users table exists and there is not an existing constraint
DO $$
BEGIN
  IF EXISTS(SELECT table_name
              FROM information_schema.tables
            WHERE table_schema = 'auth'
              AND table_name LIKE 'users')
    AND NOT EXISTS(SELECT table_name
              FROM information_schema.table_constraints
            WHERE table_schema = 'storage'
              AND table_name = 'files'
              AND constraint_name = 'fk_users')
  THEN
    ALTER TABLE storage.files
      ADD CONSTRAINT fk_user FOREIGN KEY (uploaded_by_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $$;

-- triggers
CREATE TRIGGER set_storage_buckets_updated_at
  BEFORE UPDATE ON storage.buckets
  FOR EACH ROW
  EXECUTE FUNCTION storage.set_current_timestamp_updated_at ();

CREATE TRIGGER set_storage_files_updated_at
  BEFORE UPDATE ON storage.files
  FOR EACH ROW
  EXECUTE FUNCTION storage.set_current_timestamp_updated_at ();

CREATE TRIGGER check_default_bucket_delete
  BEFORE DELETE ON storage.buckets
  FOR EACH ROW
  EXECUTE PROCEDURE protect_default_bucket_delete ();

CREATE TRIGGER check_default_bucket_update
  BEFORE UPDATE ON storage.buckets
  FOR EACH ROW
  EXECUTE PROCEDURE protect_default_bucket_update ();

-- data
INSERT INTO storage.buckets (id)
  VALUES ('default');

INSERT INTO storage.files (id, created_at, updated_at, bucket_id, name, size, mime_type, etag, is_uploaded, uploaded_by_user_id)
  VALUES (
    'fe07bc9c-2a18-42b4-817f-97cfdc8f79bb',
    '2022-01-04T16:47:37.762868+00:00',
    '2022-01-04T16:47:37.762868+00:00',
    'default',
    'some-file.txt',
    17,
    'text/plain; charset=utf-8',
    '"nbdfgyrejhg324hjgadnbv"',
    true,
    'a3dcdb8f-d1c7-4cfb-829b-57881633dadc'
);

COMMIT;
