DROP TRIGGER enqueue_file_cleanup ON storage.files;
DROP FUNCTION storage.enqueue_file_cleanup();
DROP TABLE storage.files_to_delete;
