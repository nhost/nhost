-- start a transaction
BEGIN;
ALTER TABLE auth.users
ADD COLUMN metadata JSONB;
COMMIT;