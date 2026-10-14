BEGIN;
DROP TRIGGER reset_usage_on_files_truncate ON storage.files;
DROP TRIGGER update_usage_on_file_change ON storage.files;
DROP FUNCTION storage.reset_usage_on_files_truncate();
DROP FUNCTION storage.update_usage_on_file_change();
DROP TABLE storage.usage;
COMMIT;
