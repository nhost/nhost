-- start a transaction
BEGIN;

-- drop foreign key constraint
ALTER TABLE auth.user_authenticators
  DROP CONSTRAINT IF EXISTS fk_user;

-- drop table
DROP TABLE IF EXISTS auth.user_authenticators;

-- drop column from users table
ALTER TABLE auth.users
    DROP COLUMN IF EXISTS webauthn_current_challenge;

COMMIT;