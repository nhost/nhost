BEGIN;

-- triggers
DROP TRIGGER set_storage_buckets_updated_at ON storage.buckets;
DROP TRIGGER set_storage_files_updated_at ON storage.files;
DROP TRIGGER check_default_bucket_delete ON storage.buckets;
DROP TRIGGER check_default_bucket_update ON storage.buckets;

-- constraints
ALTER TABLE storage.files
  DROP CONSTRAINT fk_bucket;


DO $$
BEGIN
  IF EXISTS(SELECT table_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'storage'
              AND table_name = 'files'
              AND constraint_name = 'fk_user')
  THEN
    ALTER TABLE storage.files
      DROP CONSTRAINT fk_user;
  END IF;
END $$;



-- tables
DROP TABLE storage.buckets;
DROP TABLE storage.files;

-- functions
DROP FUNCTION storage.set_current_timestamp_updated_at();
DROP FUNCTION storage.protect_default_bucket_delete();
DROP FUNCTION storage.protect_default_bucket_update();

COMMIT;
