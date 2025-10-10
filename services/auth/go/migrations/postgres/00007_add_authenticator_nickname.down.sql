BEGIN;
ALTER TABLE auth.user_authenticators
  DROP COLUMN IF EXISTS nickname;
COMMIT;