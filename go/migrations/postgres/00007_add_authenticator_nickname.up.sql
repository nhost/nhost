BEGIN;
ALTER TABLE auth.user_authenticators
  ADD COLUMN nickname text;
COMMIT;

