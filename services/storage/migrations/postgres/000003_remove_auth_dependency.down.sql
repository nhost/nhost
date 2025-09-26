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
              AND constraint_name = 'fk_user')
  THEN
    ALTER TABLE storage.files
      ADD CONSTRAINT fk_user FOREIGN KEY (uploaded_by_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;
END $$;
