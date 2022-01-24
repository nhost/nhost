-- start a transaction
BEGIN;
ALTER TABLE auth.users
ADD COLUMN custom JSONB;
COMMIT;