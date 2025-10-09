-- start a transaction
BEGIN;
ALTER TABLE auth.users
DROP COLUMN IF EXISTS metadata;
COMMIT;